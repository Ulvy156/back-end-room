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

@Injectable()
export class PropertyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: R2Service,
    private readonly cache: CacheService,
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

      const { amenityKeys, ...propertyData } = createPropertyDto;
      uploadedImgKeys = await this.r2Service.uploadMultipleFiles(
        files,
        createPropertyDto.folderType,
      );
      const property = await this.prisma.property.create({
        data: {
          ...propertyData,
          images: {
            create: uploadedImgKeys.map((img) => ({
              imageKey: img.key,
            })),
          },

          propertyAmenities: {
            create: amenityKeys.map((a) => ({
              amenity: {
                connect: { id: a },
              },
            })),
          },
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

  async findOne(id: string) {
    return await this.prisma.property.findUniqueOrThrow({
      where: { id },
    });
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
      const updateProperty = await this.prisma.property.update({
        data: updatePropertyDto,
        where: { id },
      });

      await this.clearCacheHomePage();

      return updateProperty;
    } catch (error) {
      prismaError(error);
    }
  }

  remove(id: number) {
    return `This action removes a #${id} property`;
  }

  async incrementView(id: string) {
    return await this.prisma.property.update({
      data: {
        totalViews: {
          increment: 1,
        },
      },
      where: { id },
    });
  }

  async setPropertyToFeature(id: string) {
    try {
      const property = await this.findOne(id);
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
        price: true,
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
        price: true,
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
      WHERE p."isPublished" = true
      GROUP BY p."district_id", d.name_en, d.name_kh
      ORDER BY "totalListings" DESC
      LIMIT 10;
    `;

    await this.cache.set(CACHE_KEYS.POPULAR_LOCATIONS, popularLocations);

    return popularLocations;
  }

  async browseProperties(filter: BrowsePropertyDto) {
    const where: Prisma.PropertyWhereInput = {};
    // default get only public property
    where.isPublished = true;
    // price
    if (filter.maxPrice && filter.maxPrice > 0) {
      where.price = {
        gte: filter.minPrice ?? 0,
        lte: filter.maxPrice || undefined,
      };
    }

    // location
    if (filter.location && filter.location !== 0) {
      where.districtId = filter.location;
    }
    // property type
    if (filter.roomType && filter.roomType !== 0) {
      where.propertyTypeId = filter.roomType;
    }
    // bedroom
    if (filter.bedroom && filter.bedroom > 0) {
      where.bedroom = filter.bedroom;
    }
    // bathroom
    if (filter.bathroom && filter.bathroom > 0) {
      where.bathroom = filter.bathroom;
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
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 12;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          price: true,
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
        orderBy: buildOrder(filter.orderType),
      }),
      this.prisma.property.count({ where }),
    ]);

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
}
