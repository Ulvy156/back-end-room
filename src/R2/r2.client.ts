import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export const createR2Client = (config: ConfigService) => {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.get<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.get<string>('R2_ACCESS_KEY_ID')!,
      secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY')!,
    },
  });
};
