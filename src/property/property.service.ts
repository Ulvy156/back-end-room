import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';
import { R2Service } from 'src/R2/r2.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { CACHE_KEYS } from 'src/cache/cache.key';

@Injectable()
export class PropertyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: R2Service,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
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

        if (featuredCount > 3) {
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

  // get latest 3 featured property
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
      LIMIT 5;
    `;

    await this.cache.set(CACHE_KEYS.POPULAR_LOCATIONS, popularLocations);

    return popularLocations;
  }
}
