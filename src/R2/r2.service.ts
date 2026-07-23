import {
  PutObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { createR2Client } from './r2.client';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from './r2.interface';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import { TranslationService } from 'src/i18n/translation.service';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  readonly client: S3Client;
  readonly bucket: string;
  readonly publicUrl: string;

  constructor(
    config: ConfigService,
    private readonly translation: TranslationService,
  ) {
    this.client = createR2Client(config);
    this.bucket = config.get<string>('R2_BUCKET')!;
    this.publicUrl = config.get<string>('R2_PUB_URL')!;
  }

  private async optimizeImage(filePath: string) {
    return await sharp(filePath)
      .resize(2400, 3200, {
        fit: 'inside',
        withoutEnlargement: true, // Small images are NOT upscaled
      })
      .webp({ quality: 82 })
      .toBuffer();
  }

  private async cleanupTempFile(filePath?: string) {
    if (!filePath) return;

    try {
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.warn(`Failed to remove temp file ${filePath}: ${error}`);
    }
  }

  private validateFile(file: Express.Multer.File) {
    if (!file)
      throw new BadRequestException(this.translation.t('errors.file.required'));

    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype as any)) {
      throw new BadRequestException(
        this.translation.t('errors.file.invalid_type'),
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException(
        this.translation.t('errors.file.too_large'),
      );
    }
  }

  private generateFileName(folder: string) {
    return `${folder}/${crypto.randomUUID()}.webp`;
  }

  private async putObjectCommand(key: string, buffer: Buffer) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/webp',
      }),
    );

    return {
      key,
      url: `${this.publicUrl}/${key}`,
    };
  }

  private async deleteSingleObjCommand(key: string) {
    return await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  private async deleteMultiplesObjCommand(keys: string[]) {
    return await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          // Map keys to S3 Delete format
          Objects: keys.map((key) => ({ Key: key })),
          // Quiet = true → R2 doesn't return per-file delete result
          // Better performance, less response payload
          Quiet: true,
        },
      }),
    );
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'rooms',
  ) {
    try {
      // validate each files before upload
      files.forEach((file) => {
        // validate image
        this.validateFile(file);
      });
      // upload file after validate
      const uploads = files.map(async (file) => {
        // generate file name
        const key = this.generateFileName(folder);

        const optimizedBuffer = await this.optimizeImage(file.path);
        return await this.putObjectCommand(key, optimizedBuffer);
      });

      return await Promise.all(uploads);
    } finally {
      await Promise.all(files.map((file) => this.cleanupTempFile(file.path)));
    }
  }

  async uploadSingleFile(file: Express.Multer.File, folder: string = 'rooms') {
    try {
      this.validateFile(file);
      const key = this.generateFileName(folder);
      const optimizedBuffer = await this.optimizeImage(file.path);

      return await this.putObjectCommand(key, optimizedBuffer);
    } finally {
      await this.cleanupTempFile(file?.path);
    }
  }

  async deleteMultipleFiles(keys: string[]) {
    if (!keys.length) return;

    await this.deleteMultiplesObjCommand(keys);

    return { deleted: keys.length };
  }

  async deleteSingleFile(key: string) {
    // Safety guard
    if (!key) return;

    await this.deleteSingleObjCommand(key);

    return { deleted: true };
  }
}
