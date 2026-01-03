import { PrismaClient } from 'prisma/generated/client';

export async function seedPropertyTypes(prisma: PrismaClient) {
  const data = [
    { code: 'room', nameEn: 'Room', nameKh: 'បន្ទប់', slug: 'room' },
    {
      code: 'apartment',
      nameEn: 'Apartment',
      nameKh: 'អាផាតមិន',
      slug: 'apartment',
    },
    { code: 'house', nameEn: 'House', nameKh: 'ផ្ទះ', slug: 'house' },
    { code: 'villa', nameEn: 'Villa', nameKh: 'វីឡា', slug: 'villa' },
  ];

  for (const item of data) {
    await prisma.propertyType.upsert({
      where: { code: item.code },
      update: {},
      create: item,
    });
  }
}
