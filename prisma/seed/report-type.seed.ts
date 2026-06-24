import { PrismaClient } from 'prisma/generated/client';

export async function seedReportTypes(prisma: PrismaClient) {
  const types = [
    {
      code: 'scam',
      nameEn: 'Scam / Fake Listing',
      nameKh: 'បោកប្រាស់ / បញ្ជីក្លែងក្លាយ',
      icon: 'alert-triangle',
    },
    {
      code: 'inappropriate',
      nameEn: 'Inappropriate Content',
      nameKh: 'មាតិកាមិនសមរម្យ',
      icon: 'ban',
    },
    {
      code: 'duplicate',
      nameEn: 'Duplicate Listing',
      nameKh: 'បញ្ជីស្ទួន',
      icon: 'copy',
    },
    {
      code: 'wrong_info',
      nameEn: 'Wrong Information',
      nameKh: 'ព័ត៌មានមិនត្រឹមត្រូវ',
      icon: 'info',
    },
  ];

  for (const type of types) {
    await prisma.reportType.upsert({
      where: { code: type.code },
      update: {},
      create: type,
    });
  }

  console.log('✅ Report types seeded: ', types.length);
}
