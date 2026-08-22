import { PrismaClient } from 'prisma/generated/client';

export async function seedPropertyTypes(prisma: PrismaClient) {
  const data = [
    {
      code: 'room',
      nameEn: 'Room',
      nameKh: 'បន្ទប់ជួល',
      slug: 'room',
      icon: 'door-open',
    },
    {
      code: 'studio',
      nameEn: 'Studio',
      nameKh: 'បន្ទប់ស្ទូឌីយោ',
      slug: 'studio',
      icon: 'panels-top-left',
    },
    {
      code: 'apartment',
      nameEn: 'Apartment',
      nameKh: 'អាផាតមិន',
      slug: 'apartment',
      icon: 'building',
    },
    {
      code: 'house',
      nameEn: 'House',
      nameKh: 'ផ្ទះល្វែង/ផ្ទះជួល',
      slug: 'house',
      icon: 'house',
    },
    {
      code: 'villa',
      nameEn: 'Villa',
      nameKh: 'វីឡា',
      slug: 'villa',
      icon: 'hotel',
    },
    {
      code: 'single_room',
      nameEn: 'Single Room',
      nameKh: 'បន្ទប់សម្រាប់ម្នាក់',
      slug: 'single_room',
      icon: 'user',
    },
  ];

  for (const item of data) {
    await prisma.propertyType.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
  }

  console.log(`✅ property types seed: `, data.length);
}
