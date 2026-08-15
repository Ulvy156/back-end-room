import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import { SettingsService } from 'src/settings/settings.service';
import { TranslationService } from 'src/i18n/translation.service';
import { multerDiskOptions } from './multer-disk.config';

// Multer's own error messages when `.array()` receives more files than its
// count limit — surfaced as a plain BadRequestException by Nest's multer
// adapter, with no field-specific code left to branch on other than this text.
const FILE_COUNT_EXCEEDED_MESSAGES = ['Too many files', 'Unexpected field'];

// `@UseInterceptors(FilesInterceptor('files', N, ...))` bakes N in at
// decorator-evaluation time, so it can't read an async app setting per
// request. This rebuilds the underlying multer interceptor on every request
// using the live `maxImagesPerProperty` value instead of a hardcoded count.
@Injectable()
export class DynamicImagesInterceptor implements NestInterceptor {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly translation: TranslationService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    // Falls back to 20 in the (practically never happening) case the setting
    // is missing — matches the frontend's own fallback for the same gap.
    const maxImagesPerProperty =
      (await this.settingsService.get<number>(
        'property',
        'maxImagesPerProperty',
      )) ?? 20;
    const Interceptor = FilesInterceptor(
      'files',
      maxImagesPerProperty,
      multerDiskOptions(),
    );
    const inner = new (Interceptor as new () => NestInterceptor)();

    try {
      return await inner.intercept(context, next);
    } catch (error) {
      if (
        error instanceof HttpException &&
        FILE_COUNT_EXCEEDED_MESSAGES.some((msg) =>
          (error.message ?? '').startsWith(msg),
        )
      ) {
        throw new BadRequestException(
          this.translation.t('errors.property_image.image_limit'),
        );
      }
      throw error;
    }
  }
}
