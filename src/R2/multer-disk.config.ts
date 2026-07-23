import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { I18nContext } from 'nestjs-i18n';
import * as path from 'path';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from './r2.interface';

// derived from the existing ALLOWED_IMAGE_TYPES mimetypes, e.g. 'image/jpeg' -> '.jpeg'
const ALLOWED_IMAGE_EXTENSIONS = ALLOWED_IMAGE_TYPES.map(
  (type) => `.${type.split('/')[1]}`,
);

export const TMP_DIR = path.join(
  process.cwd(),
  process.env.UPLOAD_TMP_DIR ?? 'src/tmp',
);
fs.mkdirSync(TMP_DIR, { recursive: true });

export function multerDiskOptions(): MulterOptions {
  return {
    storage: diskStorage({
      destination: TMP_DIR,
      filename: (_req, file, cb) =>
        cb(
          null,
          `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`,
        ),
    }),
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
        const message =
          I18nContext.current()?.t('errors.file.invalid_type') ??
          'Invalid image type';
        return cb(new BadRequestException(message), false);
      }
      cb(null, true);
    },
    limits: { fileSize: MAX_IMAGE_SIZE },
  };
}
