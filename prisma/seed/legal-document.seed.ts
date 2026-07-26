import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from 'prisma/generated/client';
import { LegalDocumentSlug } from 'prisma/generated/enums';

const SEED_FILES: Record<LegalDocumentSlug, { en: string; kh: string }> = {
  [LegalDocumentSlug.PRIVACY_POLICY]: {
    en: 'PRIVACY-POLICY.md',
    kh: 'PRIVACY-POLICY.kh.md',
  },
  [LegalDocumentSlug.TERMS_OF_SERVICE]: {
    en: 'TERMS-OF-SERVICE.md',
    kh: 'TERMS-OF-SERVICE.kh.md',
  },
};

export async function seedLegalDocuments(prisma: PrismaClient) {
  for (const [slug, { en, kh }] of Object.entries(SEED_FILES) as [
    LegalDocumentSlug,
    { en: string; kh: string },
  ][]) {
    const contentEn = readFileSync(join(process.cwd(), 'API', en), 'utf-8');
    const khPath = join(process.cwd(), 'API', kh);
    const contentKh = existsSync(khPath)
      ? readFileSync(khPath, 'utf-8')
      : contentEn;

    await prisma.legalDocument.upsert({
      where: { slug },
      update: {},
      create: { slug, contentEn, contentKh },
    });
  }

  console.log('✅ Legal documents seeded');
}
