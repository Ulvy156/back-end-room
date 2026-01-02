import { Injectable, BadRequestException } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { r2 } from '../storage/r2.client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PropertyImageService {
  constructor(private prisma: PrismaService) {}

  async uploadPropertyImage(propertyId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only images allowed');
    }

    const imageKey = `properties/${propertyId}/${randomUUID()}.webp`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: imageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return this.prisma.propertyImage.create({
      data: {
        propertyId,
        imageKey,
      },
    });
  }
}
