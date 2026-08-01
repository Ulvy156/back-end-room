import { Injectable } from '@nestjs/common';
import { I18nService, I18nContext } from 'nestjs-i18n';

@Injectable()
export class TranslationService {
  constructor(private readonly i18n: I18nService) {}

  t(key: string, args?: Record<string, string | number>): string {
    const translated: string = this.i18n.t(key, {
      lang: I18nContext.current()?.lang,
    });
    if (!args) return translated;
    return Object.entries(args).reduce(
      (result, [argKey, value]) =>
        result.replaceAll(`{${argKey}}`, String(value)),
      translated,
    );
  }
}
