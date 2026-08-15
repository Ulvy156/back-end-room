import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserRole } from 'prisma/generated/enums';
import { Prisma } from 'prisma/generated/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { R2Service } from 'src/R2/r2.service';
import { SettingsService } from 'src/settings/settings.service';
import { TranslationService } from 'src/i18n/translation.service';
import { PropertyService } from 'src/property/property.service';
import { CreatePropertyDto } from 'src/property/dto/create-property.dto';
import { prismaError } from 'src/utils/prismaError';
import { CreatePropertyDraftDto } from './dto/create-property-draft.dto';
import { DraftImage } from './types/draft-image.type';
import { getDraftImages } from './draft-image.util';

@Injectable()
export class PropertyDraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: R2Service,
    private readonly settingsService: SettingsService,
    private readonly translation: TranslationService,
    private readonly propertyService: PropertyService,
  ) {}

  private async assertOwner(id: string, requesterId: string, role: UserRole) {
    const draft = await this.prisma.propertyDraft.findUnique({
      where: { id },
    });
    if (!draft) {
      throw new NotFoundException(
        this.translation.t('errors.property_draft.not_found'),
      );
    }
    if (draft.userId !== requesterId && role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        this.translation.t('errors.property_draft.forbidden'),
      );
    }
    return draft;
  }

  private getData(draft: { data: Prisma.JsonValue }): Record<string, unknown> {
    return (draft.data as unknown as Record<string, unknown> | null) ?? {};
  }

  // [LANDLORD | ADMIN] Save a new draft — nothing is required, not even an image.
  async create(
    dto: CreatePropertyDraftDto,
    files: Express.Multer.File[],
    requesterId: string,
  ) {
    const maxDraftsPerLandlord =
      (await this.settingsService.get<number>(
        'property',
        'maxDraftsPerLandlord',
      )) ?? Infinity;
    const draftCount = await this.prisma.propertyDraft.count({
      where: { userId: requesterId },
    });
    if (draftCount >= maxDraftsPerLandlord) {
      throw new BadRequestException(
        this.translation.t('errors.property_draft.draft_limit'),
      );
    }

    const { folderType, removeImageKeys: _removeImageKeys, ...data } = dto;

    let images: DraftImage[] = [];
    if (files.length) {
      try {
        images = await this.r2Service.uploadMultipleFiles(files, folderType);
      } catch (error) {
        prismaError(error);
        return;
      }
    }

    try {
      return await this.prisma.propertyDraft.create({
        data: {
          userId: requesterId,
          data: data as Prisma.InputJsonValue,
          images: images as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (images.length) {
        await this.r2Service.deleteMultipleFiles(images.map((img) => img.key));
      }
      prismaError(error);
    }
  }

  // [LANDLORD | ADMIN] List the requester's own drafts.
  findMyDrafts(requesterId: string) {
    return this.prisma.propertyDraft.findMany({
      where: { userId: requesterId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // [LANDLORD | ADMIN] Fetch one draft — for loading the edit form.
  async findOne(id: string, requesterId: string, role: UserRole) {
    return this.assertOwner(id, requesterId, role);
  }

  // [LANDLORD | ADMIN] Partially update a draft — merges sent fields into
  // the existing data blob, optionally appending/removing images.
  async update(
    id: string,
    dto: CreatePropertyDraftDto,
    files: Express.Multer.File[],
    requesterId: string,
    role: UserRole,
  ) {
    const draft = await this.assertOwner(id, requesterId, role);
    const { folderType, removeImageKeys, ...fields } = dto;

    let images = getDraftImages(draft);
    if (removeImageKeys?.length) {
      const toRemove = images.filter((img) =>
        removeImageKeys.includes(img.key),
      );
      images = images.filter((img) => !removeImageKeys.includes(img.key));
      if (toRemove.length) {
        await this.r2Service.deleteMultipleFiles(
          toRemove.map((img) => img.key),
        );
      }
    }

    let newlyUploaded: DraftImage[] = [];
    if (files.length) {
      const maxImagesPerProperty =
        (await this.settingsService.get<number>(
          'property',
          'maxImagesPerProperty',
        )) ?? Infinity;
      if (images.length + files.length > maxImagesPerProperty) {
        throw new BadRequestException(
          this.translation.t('errors.property_image.image_limit'),
        );
      }
      try {
        newlyUploaded = await this.r2Service.uploadMultipleFiles(
          files,
          folderType,
        );
      } catch (error) {
        prismaError(error);
        return;
      }
      images = [...images, ...newlyUploaded];
    }

    const mergedData = { ...this.getData(draft), ...fields };

    try {
      return await this.prisma.propertyDraft.update({
        where: { id },
        data: {
          data: mergedData as Prisma.InputJsonValue,
          images: images as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (newlyUploaded.length) {
        await this.r2Service.deleteMultipleFiles(
          newlyUploaded.map((img) => img.key),
        );
      }
      prismaError(error);
    }
  }

  // [LANDLORD | ADMIN] Discard a draft — removes its R2 images too.
  async remove(id: string, requesterId: string, role: UserRole) {
    const draft = await this.assertOwner(id, requesterId, role);
    const images = getDraftImages(draft);
    try {
      await this.prisma.propertyDraft.delete({ where: { id } });
    } catch (error) {
      prismaError(error);
      return;
    }
    if (images.length) {
      await this.r2Service.deleteMultipleFiles(images.map((img) => img.key));
    }
  }

  // [LANDLORD | ADMIN] Publish — all-or-nothing: every field POST /property
  // requires must already be present on the draft, exactly matching
  // CreatePropertyDto's own validation, or nothing is created.
  async publish(id: string, requesterId: string, role: UserRole) {
    const draft = await this.assertOwner(id, requesterId, role);
    const images = getDraftImages(draft);

    const candidate = plainToInstance(CreatePropertyDto, this.getData(draft));
    const validationErrors = await validate(candidate);
    const maxImagesPerProperty =
      (await this.settingsService.get<number>(
        'property',
        'maxImagesPerProperty',
      )) ?? Infinity;

    const messages = validationErrors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    if (!images.length) {
      messages.push(this.translation.t('errors.property.image_required'));
    } else if (images.length > maxImagesPerProperty) {
      messages.push(this.translation.t('errors.property_image.image_limit'));
    }
    if (messages.length) {
      throw new BadRequestException(messages);
    }

    const {
      amenityKeys,
      ruleKeys,
      parkings,
      userId: _candidateUserId,
      folderType: _candidateFolderType,
      ...propertyData
    } = candidate;

    const property = await this.propertyService.createFromUploadedData(
      draft.userId,
      propertyData,
      images,
      amenityKeys,
      ruleKeys,
      parkings,
      false,
    );

    await this.prisma.propertyDraft.delete({ where: { id } });

    return property;
  }
}
