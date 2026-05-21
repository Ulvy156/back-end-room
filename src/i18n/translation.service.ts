import { Injectable } from '@nestjs/common';
import { I18nService, I18nContext } from 'nestjs-i18n';

@Injectable()
export class TranslationService {
  constructor(private readonly i18n: I18nService) {}

  t(key: string): string {
    return this.i18n.t(key, { lang: I18nContext.current()?.lang });
  }
}
