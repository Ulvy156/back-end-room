import { PrismaClient } from 'prisma/generated/client';

export async function seedAppSettings(prisma: PrismaClient) {
  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  console.log('✅ App settings seeded');
}
