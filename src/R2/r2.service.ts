import {
  PutObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { createR2Client } from './r2.client';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from './r2.interface';
import sharp from 'sharp';

@Injectable()
export class R2Service {
  readonly client: S3Client;
  readonly bucket: string;
  readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    this.client = createR2Client(config);
    this.bucket = config.get<string>('R2_BUCKET')!;
    this.publicUrl = config.get<string>('R2_PUB_URL')!;
  }

  private async optimizeImage(buffer: Buffer) {
    return await sharp(buffer)
      .resize(1200, 800, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();
  }

  private validateFile(file: Express.Multer.File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype as any)) {
      throw new BadRequestException('Invalid image type');
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('Max file size is 1MB');
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
    // validate each files before upload
    files.forEach((file) => {
      // validate image
      this.validateFile(file);
    });
    // upload file after validate
    const uploads = files.map(async (file) => {
      // generate file name
      const key = this.generateFileName(folder);

      const optimizedBuffer = await this.optimizeImage(file.buffer);
      return await this.putObjectCommand(key, optimizedBuffer);
    });

    return Promise.all(uploads);
  }

  async uploadSingleFile(file: Express.Multer.File, folder: string = 'rooms') {
    this.validateFile(file);
    const key = this.generateFileName(folder);
    const optimizedBuffer = await this.optimizeImage(file.buffer);

    return await this.putObjectCommand(key, optimizedBuffer);
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
