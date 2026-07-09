import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from 'prisma/generated/client';
import { LegalDocumentSlug } from 'prisma/generated/enums';

const SEED_FILES: Record<LegalDocumentSlug, string> = {
  [LegalDocumentSlug.PRIVACY_POLICY]: 'PRIVACY-POLICY.md',
  [LegalDocumentSlug.TERMS_OF_SERVICE]: 'TERMS-OF-SERVICE.md',
};

export async function seedLegalDocuments(prisma: PrismaClient) {
  for (const [slug, fileName] of Object.entries(SEED_FILES) as [
    LegalDocumentSlug,
    string,
  ][]) {
    const content = readFileSync(join(process.cwd(), 'API', fileName), 'utf-8');
    await prisma.legalDocument.upsert({
      where: { slug },
      update: {},
      create: { slug, content },
    });
  }

  console.log('✅ Legal documents seeded');
}
