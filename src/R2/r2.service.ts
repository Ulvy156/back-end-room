import {
  PutObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { createR2Client } from './r2.client';
import { ALLOWED_IMAGE_TYPES, foldersR2, MAX_IMAGE_SIZE } from './r2.interface';
import { extname } from 'path';

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

  private validateFile(file: Express.Multer.File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype as any)) {
      throw new BadRequestException('Invalid image type');
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('Max file size is 1MB');
    }
  }

  private generateFileName(folder: foldersR2, file: Express.Multer.File) {
    const ext = extname(file.originalname);
    return `${folder}/${crypto.randomUUID()}${ext}`;
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: foldersR2 = 'rooms',
  ) {
    // validate each files before upload
    files.map((file) => {
      // validate image
      this.validateFile(file);
    });
    // upload file after validate
    const uploads = files.map(async (file) => {
      // generate file name
      const key = this.generateFileName(folder, file);

      return await this.client
        .send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          }),
        )
        .then(() => ({
          key,
          url: `${this.publicUrl}/${key}`,
        }));
    });

    return Promise.all(uploads);
  }

  async uploadSingleFile(
    file: Express.Multer.File,
    folder: foldersR2 = 'rooms',
  ) {
    this.validateFile(file);
    const key = this.generateFileName(folder, file);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      key,
      url: `${this.publicUrl}/${key}`,
    };
  }

  async deleteMultipleFiles(keys: string[]) {
    if (!keys.length) return;

    await this.client.send(
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

    return { deleted: keys.length };
  }

  async deleteSingleFile(key: string) {
    // Safety guard
    if (!key) return;

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    return { deleted: true };
  }
}
