import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from 'src/cache/cache.service';
import { CACHE_KEYS } from 'src/cache/cache.key';
import { prismaError } from 'src/utils/prismaError';
import { LegalDocumentSlug } from 'prisma/generated/enums';
import { LegalDocument } from 'prisma/generated/client';

const SLUG_MAP: Record<string, LegalDocumentSlug> = {
  'privacy-policy': LegalDocumentSlug.PRIVACY_POLICY,
  'terms-of-service': LegalDocumentSlug.TERMS_OF_SERVICE,
};

const CACHE_KEY_MAP: Record<LegalDocumentSlug, CACHE_KEYS> = {
  [LegalDocumentSlug.PRIVACY_POLICY]: CACHE_KEYS.LEGAL_PRIVACY_POLICY,
  [LegalDocumentSlug.TERMS_OF_SERVICE]: CACHE_KEYS.LEGAL_TERMS_OF_SERVICE,
};

@Injectable()
export class LegalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private resolveSlug(slug: string): LegalDocumentSlug {
    const resolved = SLUG_MAP[slug];
    if (!resolved) throw new NotFoundException();
    return resolved;
  }

  async getDocument(slug: string) {
    const documentSlug = this.resolveSlug(slug);
    const cacheKey = CACHE_KEY_MAP[documentSlug];

    const cached = await this.cache.get<LegalDocument>(cacheKey);
    if (cached) return cached;

    const document = await this.prisma.legalDocument.findUniqueOrThrow({
      where: { slug: documentSlug },
    });
    await this.cache.set(cacheKey, document);
    return document;
  }

  async updateDocument(slug: string, contentEn: string, contentKh: string) {
    const documentSlug = this.resolveSlug(slug);

    try {
      const document = await this.prisma.legalDocument.update({
        where: { slug: documentSlug },
        data: { contentEn, contentKh },
      });
      await this.cache.del(CACHE_KEY_MAP[documentSlug]);
      return document;
    } catch (error) {
      prismaError(error);
    }
  }
}
