import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { createR2Client } from './r2.client';

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
}
