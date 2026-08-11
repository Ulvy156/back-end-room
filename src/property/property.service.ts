import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, PhoneNumberType } from 'prisma/generated/enums';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';
import { R2Service } from 'src/R2/r2.service';
import { CacheService } from 'src/cache/cache.service';
import { CACHE_KEYS } from 'src/cache/cache.key';
import { BrowsePropertyDto } from './dto/browser-property.dto';
import { Prisma } from 'prisma/generated/client';
import { buildOrder } from 'src/utils/buildOrder';
import { haversineKm } from 'src/utils/geDistanceKm';
import { PropertyDetailDTO } from './dto/property-detail.dto';
import { QueueService } from 'src/queue/queue.service';
import { QUEUE_JOBS, IncrementPropertyViewJob } from 'src/queue/queue.jobs';
import { TranslationService } from 'src/i18n/translation.service';
import { FindPropertiesDto } from './dto/find-properties.dto';
import { SettingsService } from 'src/settings/settings.service';

@Injectable()
export class PropertyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: R2Service,
    private readonly cache: CacheService,
    private readonly queue: QueueService,
    private readonly translation: TranslationService,
    private readonly settingsService: SettingsService,
  ) {}

  private async assertPriceInRange(monthlyPrice: number | undefined) {
    if (monthlyPrice == null) return;
    const settings = await this.settingsService.getSettings();
    const min = settings.minPropertyPrice;
    const max = settings.maxPropertyPrice;
    if (
      (min != null && monthlyPrice < Number(min)) ||
      (max != null && monthlyPrice > Number(max))
    ) {
      throw new BadRequestException(
        this.translation.t('errors.property.price_out_of_range'),
      );
    }
  }

  // pinned lat/lng must stay within this radius of the selected district's province center
  private readonly MAX_LOCATION_DISTANCE_KM = 60;

  private async assertLocationWithinDistrict(
    districtId: number,
    lat: number | null | undefined,
    lng: number | null | undefined,
  ) {
    if (lat == null || lng == null) return;

    const district = await this.prisma.district.findUnique({
      where: { id: districtId },
      include: { province: true },
    });
    if (!district) return;

    const distance = haversineKm(
      lat,
      lng,
      district.province.latitude,
      district.province.longitude,
    );

    if (distance > this.MAX_LOCATION_DISTANCE_KM) {
      throw new BadRequestException(
        this.translation.t('errors.property.location_out_of_bounds'),
      );
    }
  }

  async create(
    createPropertyDto: CreatePropertyDto,
    files: Express.Multer.File[],
    requesterId: string,
    role: UserRole,
  ) {
    let uploadedImgKeys: Array<{ key: string; url: string }> = [];
    try {
      if (!files.length) {
        throw new BadRequestException(
          this.translation.t('errors.property.image_required'),
        );
      }

      // Client-supplied userId is only trusted from an ADMIN, to create a
      // listing on a specific landlord's behalf — a LANDLORD can never set
      // another user as the owner, only themselves.
      const ownerId =
        role === UserRole.ADMIN && createPropertyDto.userId
          ? createPropertyDto.userId
          : requesterId;

      const settings = await this.settingsService.getSettings();
      if (files.length > settings.maxImagesPerProperty) {
        throw new BadRequestException(
          this.translation.t('errors.property_image.image_limit'),
        );
      }

      const since = new Date();
      since.setDate(since.getDate() - 30);
      const recentCount = await this.prisma.property.count({
        where: { userId: ownerId, createdAt: { gte: since } },
      });
      if (recentCount >= settings.maxPropertiesPerLandlord) {
        throw new BadRequestException(
          this.translation.t('errors.property.monthly_limit'),
        );
      }

      const {
        amenityKeys,
        ruleKeys,
        parkings,
        folderType,
        userId: _bodyUserId,
        ...propertyData
      } = createPropertyDto;
      await this.assertPriceInRange(propertyData.monthly_price);
      await this.assertLocationWithinDistrict(
        propertyData.districtId,
        propertyData.lat,
        propertyData.lng,
      );
      uploadedImgKeys = await this.r2Service.uploadMultipleFiles(
        files,
        folderType,
      );
      const property = await this.prisma.property.create({
        data: {
          ...propertyData,
          userId: ownerId,
          images: {
            create: uploadedImgKeys.map((img, index) => ({
              imageKey: img.key,
              isCover: index === 0, // first image be selected as cover
            })),
          },

          propertyAmenities: {
            create: amenityKeys.map((a) => ({
              amenity: {
                connect: { id: a },
              },
            })),
          },
          propertyRuleValue: ruleKeys?.length
            ? {
                create: ruleKeys.map((ruleId) => ({
                  rule: { connect: { id: ruleId } },
                })),
              }
            : undefined,
          parkings: parkings?.length
            ? {
                create: parkings.map((p) => ({
                  type: p.type,
                  slots: p.slots,
                  isFree: p.isFree ?? true,
                  price: p.isFree ? null : (p.price ?? null), // if free price = null
                  note: p.note ?? null,
                })),
              }
            : undefined,
        },
      });

      // remove cache from feature and lastest listing ( re-cache )
      await this.cache.del(CACHE_KEYS.LATEST_LISTINGS);

      return property;
    } catch (error) {
      // Cleanup uploaded images if ANYTHING fails
      if (uploadedImgKeys.length) {
        await this.r2Service.deleteMultipleFiles(
          uploadedImgKeys.map((img) => img.key),
        );
      }
      prismaError(error);
    }
  }

  async findAll(filter: FindPropertiesDto) {
    const {
      isPublished,
      isFeatured,
      isAvailable,
      search,
      page = 1,
      limit = 20,
    } = filter;
    const skip = (page - 1) * limit;

    const where = {
      ...(isPublished !== undefined ? { isPublished } : {}),
      ...(isFeatured !== undefined ? { isFeatured } : {}),
      ...(isAvailable !== undefined ? { isAvailable } : {}),
      ...(search
        ? { title: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          monthly_price: true,
          isPublished: true,
          isAvailable: true,
          isFeatured: true,
          totalViews: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          images: {
            take: 1,
            where: { isCover: true },
            select: { imageKey: true },
          },
          _count: {
            select: {
              images: true,
            },
          },
          district: {
            select: {
              nameEn: true,
              nameKh: true,
              province: { select: { nameEn: true, nameKh: true } },
            },
          },
          propertyType: { select: { nameEn: true, nameKh: true, icon: true } },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(filter: PropertyDetailDTO) {
    try {
      const property = await this.prisma.property.findFirstOrThrow({
        where: {
          id: filter.id,
          isPublished: true,
        },
        include: {
          user: {
            select: {
              imgUrl: true,
              role: true,
              showPhone: true,
              showTelegram: true,
              showEmail: true,
              hasVerifiedBadge: true,
              phones: {
                select: {
                  phoneNumber: true,
                  type: true,
                },
              },
              name: true,
              email: true,
            },
          },
          images: {
            select: {
              imageKey: true,
            },
          },
          propertyType: {
            select: {
              nameEn: true,
              nameKh: true,
              icon: true,
            },
          },
          propertyAmenities: {
            select: {
              amenity: {
                select: {
                  nameEn: true,
                  nameKh: true,
                  icon: true,
                },
              },
            },
          },
          district: {
            select: {
              nameEn: true,
              nameKh: true,
              province: {
                select: {
                  nameEn: true,
                  nameKh: true,
                },
              },
            },
          },
          propertyRuleValue: {
            select: {
              rule: {
                select: {
                  id: true,
                  nameEn: true,
                  nameKh: true,
                  icon: true,
                },
              },
            },
          },
          parkings: {
            select: {
              id: true,
              type: true,
              slots: true,
              isFree: true,
              price: true,
              note: true,
            },
          },
        },
      });
      // set to empty if user doenst provide lat and lng
      let distanceKm: string = '~';
      if (filter.lat && filter.lng && property.lat && property.lng) {
        distanceKm = haversineKm(
          filter.lat,
          filter.lng,
          property.lat,
          property.lng,
        ).toFixed(2);
      }

      const allRules = await this.prisma.propertyRules.findMany({
        select: {
          id: true,
          nameEn: true,
          nameKh: true,
          icon: true,
        },
      });

      const selectedRuleIds = new Set(
        property.propertyRuleValue.map((prv) => prv.rule.id),
      );

      const rules = allRules.map((rule) => ({
        nameEn: rule.nameEn,
        nameKh: rule.nameKh,
        icon: rule.icon,
        is_allow: selectedRuleIds.has(rule.id) ? true : false,
      }));

      const { propertyAmenities, ...rest } = property;

      const { showPhone, showTelegram, showEmail, phones, email, ...userRest } =
        rest.user;
      rest.user = {
        ...userRest,
        email: showEmail ? email : null,
        phones: phones.filter(
          (p) =>
            (p.type === PhoneNumberType.PHONE && showPhone) ||
            (p.type === PhoneNumberType.TELEGRAM && showTelegram),
        ),
      } as typeof rest.user;

      return {
        ...rest,
        amenities: propertyAmenities.map((p) => p.amenity),
        rules,
        distanceKm,
      };
    } catch (error) {
      prismaError(error);
    }
  }

  private async assertOwner(id: string, requesterId: string, role: UserRole) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property)
      throw new NotFoundException(
        this.translation.t('errors.property.not_found'),
      );
    if (property.userId !== requesterId && role !== UserRole.ADMIN)
      throw new ForbiddenException(
        this.translation.t('errors.property.forbidden'),
      );
    return property;
  }

  private async clearCacheHomePage() {
    // remove home page cache
    await Promise.all([
      this.cache.del(CACHE_KEYS.FEATURED_LISTINGS),
      this.cache.del(CACHE_KEYS.LATEST_LISTINGS),
      this.cache.del(CACHE_KEYS.POPULAR_LOCATIONS),
    ]);
  }

  async update(
    id: string,
    updatePropertyDto: UpdatePropertyDto,
    requesterId: string,
    role: UserRole,
  ) {
    try {
      const existingProperty = await this.assertOwner(id, requesterId, role);

      const {
        amenityKeys,
        ruleKeys,
        parkings,
        userId: bodyUserId,
        ...updateData
      } = updatePropertyDto;
      await this.assertPriceInRange(updateData.monthly_price);
      await this.assertLocationWithinDistrict(
        updateData.districtId ?? existingProperty.districtId,
        updateData.lat !== undefined ? updateData.lat : existingProperty.lat,
        updateData.lng !== undefined ? updateData.lng : existingProperty.lng,
      );

      // Reassigning the owner is an ADMIN-only capability — a LANDLORD
      // editing their own property can never hand it off to someone else.
      const ownerUpdate =
        role === UserRole.ADMIN && bodyUserId ? { userId: bodyUserId } : {};

      const property = await this.prisma.$transaction(async (tx) => {
        const updatedProperty = await tx.property.update({
          where: { id },
          data: { ...updateData, ...ownerUpdate },
        });

        // Update amenities (REPLACE)
        if (amenityKeys) {
          await tx.propertyAmenity.deleteMany({
            where: { propertyId: id },
          });

          if (amenityKeys.length) {
            await tx.propertyAmenity.createMany({
              data: amenityKeys.map((amenityId) => ({
                propertyId: id,
                amenityId,
              })),
            });
          }
        }

        // Update rules (REPLACE)
        if (ruleKeys) {
          await tx.propertyRuleValue.deleteMany({
            where: { propertyId: id },
          });

          if (ruleKeys.length) {
            await tx.propertyRuleValue.createMany({
              data: ruleKeys.map((propertyRuleId) => ({
                propertyId: id,
                propertyRuleId,
              })),
            });
          }
        }

        // Update parking (REPLACE)
        if (parkings) {
          await tx.parking.deleteMany({
            where: { propertyId: id },
          });

          if (parkings.length) {
            await tx.parking.createMany({
              data: parkings.map((p) => ({
                propertyId: id,
                type: p.type, // generated enum
                slots: p.slots,
                isFree: p.isFree ?? true,
                price: p.price ?? null,
                note: p.note ?? null,
              })),
            });
          }
        }

        return updatedProperty;
      });

      await this.clearCacheHomePage();

      return property;
    } catch (error) {
      prismaError(error);
    }
  }

  async getMyProperties(userId: string) {
    return this.prisma.property.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        monthly_price: true,
        isPublished: true,
        isAvailable: true,
        isFeatured: true,
        totalViews: true,
        createdAt: true,
        images: {
          take: 1,
          where: { isCover: true },
          select: { imageKey: true },
        },
        _count: {
          select: {
            images: true,
          },
        },
        district: {
          select: {
            nameEn: true,
            nameKh: true,
            province: { select: { nameEn: true, nameKh: true } },
          },
        },
      },
    });
  }

  async togglePublish(id: string, requesterId: string, role: UserRole) {
    const property = await this.assertOwner(id, requesterId, role);
    const updated = await this.prisma.property.update({
      where: { id },
      data: { isPublished: !property.isPublished },
      select: { id: true, isPublished: true },
    });
    await this.clearCacheHomePage();
    return updated;
  }

  async toggleAvailability(id: string, requesterId: string, role: UserRole) {
    const property = await this.assertOwner(id, requesterId, role);
    return this.prisma.property.update({
      where: { id },
      data: { isAvailable: !property.isAvailable },
      select: { id: true, isAvailable: true },
    });
  }

  async remove(id: string, requesterId: string, role: UserRole) {
    await this.assertOwner(id, requesterId, role);

    const images = await this.prisma.propertyImage.findMany({
      where: { propertyId: id },
      select: { imageKey: true },
    });

    if (images.length) {
      await this.r2Service.deleteMultipleFiles(
        images.map((img) => img.imageKey),
      );
    }

    await this.prisma.property.delete({ where: { id } });
  }

  async duplicate(id: string, requesterId: string, role: UserRole) {
    await this.assertOwner(id, requesterId, role);

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const recentCount = await this.prisma.property.count({
      where: { userId: requesterId, createdAt: { gte: since } },
    });
    if (recentCount >= 3) {
      throw new BadRequestException(
        this.translation.t('errors.property.monthly_limit'),
      );
    }

    const source = await this.prisma.property.findUniqueOrThrow({
      where: { id },
      include: {
        propertyAmenities: true,
        propertyRuleValue: true,
        parkings: true,
        images: true,
      },
    });

    // Copy each image object in R2 so the duplicate owns independent files —
    // sharing imageKeys with the source would mean deleting either property's
    // image (or the property itself) deletes the underlying file for both.
    const copiedImages = source.images.length
      ? await this.r2Service.copyMultipleFiles(
          source.images.map((img) => img.imageKey),
        )
      : [];

    try {
      const copy = await this.prisma.property.create({
        data: {
          userId: requesterId,
          districtId: source.districtId,
          address: source.address,
          lat: source.lat,
          lng: source.lng,
          nearby_location: source.nearby_location,
          title: `${source.title} (copy)`,
          description: source.description,
          monthly_price: source.monthly_price,
          deposit: source.deposit,
          bedroom: source.bedroom,
          bathroom: source.bathroom,
          floor: source.floor,
          totalFloors: source.totalFloors,
          availableFrom: source.availableFrom,
          propertyTypeId: source.propertyTypeId,
          sizeSqm: source.sizeSqm,
          furnished: source.furnished,
          minimumStayLength: source.minimumStayLength,
          openTime: source.openTime,
          closeTime: source.closeTime,
          isPublished: false,
          images: copiedImages.length
            ? {
                create: copiedImages.map((img, index) => ({
                  imageKey: img.key,
                  isCover: source.images[index].isCover,
                })),
              }
            : undefined,
          propertyAmenities: {
            create: source.propertyAmenities.map((a) => ({
              amenity: { connect: { id: a.amenityId } },
            })),
          },
          propertyRuleValue: {
            create: source.propertyRuleValue.map((r) => ({
              rule: { connect: { id: r.propertyRuleId } },
            })),
          },
          parkings: source.parkings.length
            ? {
                create: source.parkings.map((p) => ({
                  type: p.type,
                  slots: p.slots,
                  isFree: p.isFree,
                  price: p.price,
                  note: p.note,
                })),
              }
            : undefined,
        },
      });

      return copy;
    } catch (error) {
      // Cleanup copied images if the DB write fails
      if (copiedImages.length) {
        await this.r2Service.deleteMultipleFiles(
          copiedImages.map((img) => img.key),
        );
      }
      prismaError(error);
    }
  }

  async incrementView(id: string): Promise<void> {
    await this.queue.send<IncrementPropertyViewJob>(
      QUEUE_JOBS.INCREMENT_PROPERTY_VIEW,
      { propertyId: id },
    );
  }

  async setPropertyToFeature(id: string) {
    try {
      const property = await this.prisma.property.findFirstOrThrow({
        where: {
          id,
        },
      });
      if (!property) throw new NotFoundException('Property not found!');

      // Only check limit when turning feature ON
      if (!property.isFeatured) {
        const featuredCount = await this.prisma.property.count({
          where: { isFeatured: true },
        });

        if (featuredCount >= 3) {
          throw new BadRequestException(
            this.translation.t('errors.property.feature_limit'),
          );
        }
      }

      const update = await this.prisma.property.update({
        data: {
          isFeatured: !property.isFeatured,
          featuredAt: property.isFeatured ? null : new Date(),
        },
        where: { id },
      });

      await this.clearCacheHomePage();

      return update;
    } catch (error) {
      prismaError(error);
    }
  }

  // get data for display in homepage
  async getDataHomePage() {
    const [featuredListings, latestListings, popularLocations] =
      await Promise.all([
        this.getFeaturedProperties(),
        this.getLatestListing(),
        this.getPopularLocations(),
      ]);
    return {
      featuredListings,
      latestListings,
      popularLocations,
    };
  }

  // get latest 4 featured property
  async getFeaturedProperties() {
    const cache = await this.cache.get(CACHE_KEYS.FEATURED_LISTINGS);
    if (cache) return cache;

    const featureProperties = await this.prisma.property.findMany({
      where: {
        isFeatured: true,
        isPublished: true,
      },
      orderBy: {
        featuredAt: 'desc',
      },
      take: 3,
      select: {
        id: true,
        title: true,
        monthly_price: true,
        sizeSqm: true,
        totalViews: true,
        bathroom: true,
        bedroom: true,
        isAvailable: true,
        openTime: true,
        closeTime: true,
        images: {
          take: 1,
          where: { isCover: true },
          select: {
            imageKey: true,
          },
        },
        _count: {
          select: {
            images: true,
          },
        },
        district: {
          select: {
            nameEn: true,
            nameKh: true,
            province: {
              select: {
                nameEn: true,
                nameKh: true,
              },
            },
          },
        },
        propertyType: {
          select: {
            nameEn: true,
            nameKh: true,
            icon: true,
          },
        },
      },
    });

    await this.cache.set(CACHE_KEYS.FEATURED_LISTINGS, featureProperties);

    return featureProperties;
  }

  // get latest listing 3
  async getLatestListing() {
    const cache = await this.cache.get(CACHE_KEYS.LATEST_LISTINGS);
    if (cache) return cache;

    const latestListings = await this.prisma.property.findMany({
      where: {
        isFeatured: false,
        isPublished: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 8,
      select: {
        id: true,
        title: true,
        monthly_price: true,
        sizeSqm: true,
        totalViews: true,
        bathroom: true,
        bedroom: true,
        isAvailable: true,
        openTime: true,
        closeTime: true,
        images: {
          take: 1,
          where: { isCover: true },
          select: {
            imageKey: true,
          },
        },
        _count: {
          select: {
            images: true,
          },
        },
        district: {
          select: {
            nameEn: true,
            nameKh: true,
            province: {
              select: {
                nameEn: true,
                nameKh: true,
              },
            },
          },
        },
        propertyType: {
          select: {
            nameEn: true,
            nameKh: true,
            icon: true,
          },
        },
      },
    });

    await this.cache.set(CACHE_KEYS.LATEST_LISTINGS, latestListings);

    return latestListings;
  }

  // get popular locations 5
  async getPopularLocations() {
    const cache = await this.cache.get(CACHE_KEYS.POPULAR_LOCATIONS);
    if (cache) return cache;

    const popularLocations = await this.prisma.$queryRaw<
      {
        districtId: number;
        districtName: string;
        totalListings: number;
      }[]
    >`
      SELECT
        p."district_id"        AS "districtId",
        d.name_kh              AS "nameKh",
        d.name_en              AS "nameEn",
        COUNT(*)::int          AS "totalListings"
      FROM "properties" p
      JOIN "districts" d
        ON d.id = p."district_id"
      WHERE p."is_published" = true
      GROUP BY p."district_id", d.name_en, d.name_kh
      ORDER BY "totalListings" DESC
      LIMIT 8;
    `;

    await this.cache.set(CACHE_KEYS.POPULAR_LOCATIONS, popularLocations);

    return popularLocations;
  }

  // filter properties
  async browseProperties(filter: BrowsePropertyDto) {
    const where: Prisma.PropertyWhereInput = {};
    // default get only public property
    where.isPublished = true;
    where.isAvailable = true;
    // monthly_price
    if (filter.maxPrice && filter.maxPrice > 0) {
      where.monthly_price = {
        gte: filter.minPrice ?? 0,
        lte: filter.maxPrice || undefined,
      };
    }

    // location
    if (filter.location && filter.location !== 0) {
      if (filter.locationType === 'province') {
        where.district = {
          provinceId: filter.location,
        };
      } else {
        where.districtId = filter.location;
      }
    }
    if (filter.lat && filter.lng && filter.orderType === 4) {
      const radius = 15; // default 15km

      const latDelta = radius / 111;
      const lngDelta = radius / (111 * Math.cos((filter.lat * Math.PI) / 180));

      where.lat = {
        gte: filter.lat - latDelta,
        lte: filter.lat + latDelta,
      };

      where.lng = {
        gte: filter.lng - lngDelta,
        lte: filter.lng + lngDelta,
      };
    }

    // property type
    if (filter.roomType && filter.roomType !== 0) {
      where.propertyTypeId = filter.roomType;
    }
    // furnishing: 1 = furnished only, 2 = unfurnished only, 0/undefined = no filter
    if (filter.furnishing === 1) {
      where.furnished = true;
    } else if (filter.furnishing === 2) {
      where.furnished = false;
    }
    // bedroom
    if (filter.bedroom && filter.bedroom > 0) {
      where.bedroom = {
        gte: filter.bedroom,
      };
    }
    // bathroom
    if (filter.bathroom && filter.bathroom > 0) {
      where.bathroom = {
        gte: filter.bathroom,
      };
    }
    // property amenities — AND logic: property must have every selected amenity
    if (filter.amenities?.length) {
      where.AND = filter.amenities.map((amenityId) => ({
        propertyAmenities: { some: { amenityId } },
      }));
    }
    // property rules
    if (filter.houseRules?.length) {
      where.propertyRuleValue = {
        some: {
          id: { in: filter.houseRules },
        },
      };
    }

    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 20;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line prefer-const
    let [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          monthly_price: true,
          sizeSqm: true,
          totalViews: true,
          bathroom: true,
          bedroom: true,
          isAvailable: true,
          openTime: true,
          closeTime: true,
          deposit: true,
          availableFrom: true,
          lat: true,
          lng: true,
          images: {
            take: 1,
            where: { isCover: true },
            select: {
              imageKey: true,
            },
          },
          _count: {
            select: {
              images: true,
            },
          },
          district: {
            select: {
              nameEn: true,
              nameKh: true,
              province: {
                select: {
                  nameEn: true,
                  nameKh: true,
                },
              },
            },
          },
          propertyType: {
            select: {
              nameEn: true,
              nameKh: true,
              icon: true,
            },
          },
        },
        orderBy: buildOrder(filter.orderType),
      }),
      this.prisma.property.count({ where }),
    ]);

    if (filter.lat != null && filter.lng != null) {
      items = items.map((p) => ({
        ...p,
        distanceKm: Number(
          haversineKm(filter.lat!, filter.lng!, p.lat ?? 0, p.lng ?? 0).toFixed(
            2,
          ),
        ),
      }));
      if (filter.orderType === 4) {
        (items as Array<(typeof items)[0] & { distanceKm: number }>).sort(
          (a, b) => a.distanceKm - b.distanceKm,
        );
      }
    }

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // get related properties based on current selected properties
  async getRelatedProperties(propertyId: string) {
    const TAKE = 6;
    const MAX_DISTANCE_KM = 15;
    const PRICE_RANGE_RATIO = 0.2; // +/- 20%
    const BEDROOM_RANGE = 2;

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId, isPublished: true, isAvailable: true },
      select: {
        id: true,
        lat: true,
        lng: true,
        monthly_price: true,
        bedroom: true,
        propertyTypeId: true,
      },
    });

    if (!property) throw new NotFoundException();

    const minPrice = property.monthly_price * (1 - PRICE_RANGE_RATIO);
    const maxPrice = property.monthly_price * (1 + PRICE_RANGE_RATIO);
    const bedroom = property.bedroom;

    // shared match criteria for any non-geo (ORM) query below — keep this in
    // sync with the raw SQL WHERE clause in the geo branch
    const similarWhere: Prisma.PropertyWhereInput = {
      propertyTypeId: property.propertyTypeId,
      bedroom: { gte: bedroom - BEDROOM_RANGE, lte: bedroom + BEDROOM_RANGE },
      monthly_price: { gte: minPrice, lte: maxPrice },
      isPublished: true,
      isAvailable: true,
    };

    let nearby: { id: string; distance: number | null }[] = [];

    if (property.lat != null && property.lng != null) {
      nearby = await this.prisma.$queryRaw<{ id: string; distance: number }[]>`
      SELECT sub.id, sub.distance
      FROM (
        SELECT p.id,
        (
          6371 * acos(
            cos(radians(${property.lat})) *
            cos(radians(p.lat)) *
            cos(radians(p.lng) - radians(${property.lng})) +
            sin(radians(${property.lat})) *
            sin(radians(p.lat))
          )
        ) AS distance
        FROM properties p
        WHERE p.id != ${property.id}
          AND p.bedroom BETWEEN (${bedroom - BEDROOM_RANGE}) AND ${bedroom + BEDROOM_RANGE}
          AND p.property_type_id = ${property.propertyTypeId}
          AND p.monthly_price BETWEEN ${minPrice} AND ${maxPrice}
          AND p.lat IS NOT NULL
          AND p.lng IS NOT NULL
          AND p.is_published = true
          AND p.is_available = true
      ) sub
      WHERE sub.distance < ${MAX_DISTANCE_KM}
      ORDER BY sub.distance ASC
      LIMIT ${TAKE}
    `;

      if (nearby.length < TAKE) {
        const excludeIds = [property.id, ...nearby.map((n) => n.id)];
        const backfill = await this.prisma.property.findMany({
          where: { ...similarWhere, id: { notIn: excludeIds } },
          select: { id: true },
          orderBy: [{ totalViews: 'desc' }, { createdAt: 'desc' }],
          take: TAKE - nearby.length,
        });
        nearby = [
          ...nearby,
          ...backfill.map((p) => ({ id: p.id, distance: null })),
        ];
      }
    } else {
      const fallback = await this.prisma.property.findMany({
        where: { ...similarWhere, id: { not: property.id } },
        select: { id: true },
        orderBy: [{ totalViews: 'desc' }, { createdAt: 'desc' }],
        take: TAKE,
      });
      nearby = fallback.map((p) => ({ id: p.id, distance: null }));
    }

    if (!nearby.length) return [];

    const ids = nearby.map((p) => p.id);

    const properties = await this.prisma.property.findMany({
      where: {
        id: { in: ids, not: property.id },
      },
      select: {
        id: true,
        title: true,
        monthly_price: true,
        sizeSqm: true,
        totalViews: true,
        bathroom: true,
        bedroom: true,
        isAvailable: true,
        openTime: true,
        closeTime: true,
        deposit: true,
        availableFrom: true,
        images: {
          take: 1,
          where: { isCover: true },
          select: { imageKey: true },
        },
        _count: {
          select: {
            images: true,
          },
        },
        district: {
          select: {
            nameEn: true,
            nameKh: true,
            province: {
              select: {
                nameEn: true,
                nameKh: true,
              },
            },
          },
        },
        propertyType: {
          select: {
            nameEn: true,
            nameKh: true,
            icon: true,
          },
        },
      },
    });

    return nearby
      .map((n) => {
        const prop = properties.find((p) => p.id === n.id);
        if (!prop) return null;
        return {
          ...prop,
          distanceKm: n.distance != null ? Number(n.distance.toFixed(2)) : null,
        };
      })
      .filter((p) => p != null);
  }
}
