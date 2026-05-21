import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

@Injectable()
export class PropertyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: R2Service,
    private readonly cache: CacheService,
    private readonly queue: QueueService,
  ) {}

  async create(
    createPropertyDto: CreatePropertyDto,
    files: Express.Multer.File[],
  ) {
    let uploadedImgKeys: Array<{ key: string; url: string }> = [];
    try {
      if (!files.length) {
        throw new BadRequestException('At least one file is required');
      }

      const { amenityKeys, parkings, ...propertyData } = createPropertyDto;
      uploadedImgKeys = await this.r2Service.uploadMultipleFiles(
        files,
        createPropertyDto.folderType,
      );
      const property = await this.prisma.property.create({
        data: {
          ...propertyData,
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

  async findAll() {
    return await this.prisma.property.findMany({
      include: {
        images: true,
        propertyAmenities: true,
        propertyType: true,
      },
    });
  }

  async findOne(filter: PropertyDetailDTO) {
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
    property['distanceKm'] = '~';
    if (filter.lat && filter.lng && property.lat && property.lng) {
      property['distanceKm'] = haversineKm(
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

    return {
      ...rest,
      amenities: propertyAmenities.map((p) => p.amenity),
      rules,
    };
  }

  private async clearCacheHomePage() {
    // remove home page cache
    await Promise.all([
      this.cache.del(CACHE_KEYS.FEATURED_LISTINGS),
      this.cache.del(CACHE_KEYS.LATEST_LISTINGS),
      this.cache.del(CACHE_KEYS.POPULAR_LOCATIONS),
    ]);
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto) {
    try {
      const { userId, amenityKeys, parkings, ...updateData } =
        updatePropertyDto;

      const property = await this.prisma.$transaction(async (tx) => {
        // 1️⃣ Update property main fields
        const updatedProperty = await tx.property.update({
          where: { id },
          data: updateData,
        });

        // 2️⃣ Update amenities (REPLACE)
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

        // 3️⃣ Update parking (REPLACE)
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

  remove(id: number) {
    return `This action removes a #${id} property`;
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
            'You can only feature up to 4 properties',
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
        images: {
          take: 1,
          where: { isCover: true },
          select: {
            imageKey: true,
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
      take: 4,
      select: {
        id: true,
        title: true,
        monthly_price: true,
        sizeSqm: true,
        totalViews: true,
        bathroom: true,
        bedroom: true,
        isAvailable: true,
        images: {
          take: 1,
          where: { isCover: true },
          select: {
            imageKey: true,
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
      LIMIT 10;
    `;

    await this.cache.set(CACHE_KEYS.POPULAR_LOCATIONS, popularLocations);

    return popularLocations;
  }

  // filter properties
  async browseProperties(filter: BrowsePropertyDto) {
    const where: Prisma.PropertyWhereInput = {};
    // default get only public property
    where.isPublished = true;
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
      const lngDelta = radius / 111;

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
    // property amenities
    if (filter.amenities?.length) {
      where.propertyAmenities = {
        some: {
          amenityId: { in: filter.amenities },
        },
      };
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
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 6;
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

    // calculate real distance + sort
    items = items.map((p) => {
      const lat = p.lat ?? 0;
      const lng = p.lng ?? 0;
      const distance = haversineKm(filter.lat!, filter.lng!, lat, lng);

      return {
        ...p,
        distanceKm: Number(distance.toFixed(2)),
      };
    });

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
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) throw new NotFoundException();

    const minPrice = property.monthly_price * 0.8;
    const maxPrice = property.monthly_price * 1.2;
    const bedroom = property.bedroom;

    // get related property IDs using distance
    const nearby = await this.prisma.$queryRaw<{ id: string }[]>`
    SELECT sub.id
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
        AND p.bedroom BETWEEN (${bedroom - 2}) AND ${bedroom + 2}
        AND p.property_type_id = ${property.propertyTypeId}
        AND p.monthly_price BETWEEN ${minPrice} AND ${maxPrice}
        AND p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND p.is_published = true
    ) sub
    WHERE sub.distance < 15
    ORDER BY sub.distance ASC
    LIMIT 6
  `;

    const ids = nearby.map((p) => p.id);

    if (!ids.length) return [];

    // fetch full structured data
    return this.prisma.property.findMany({
      where: {
        id: { in: ids },
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
        deposit: true,
        availableFrom: true,
        images: {
          take: 1,
          where: { isCover: true },
          select: { imageKey: true },
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
  }
}
