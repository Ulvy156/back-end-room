import { PrismaClient } from 'prisma/generated/client';

export async function seedPropertyTypes(prisma: PrismaClient) {
  const data = [
    {
      code: 'room',
      nameEn: 'Room',
      nameKh: 'បន្ទប់ជួល', // "Rental Room" - sounds more like a listing
      slug: 'room',
    },
    {
      code: 'studio',
      nameEn: 'Studio',
      nameKh: 'បន្ទប់ស្ទូឌីយោ', // Added "Room" prefix for clarity
      slug: 'studio',
    },
    {
      code: 'apartment',
      nameEn: 'Apartment',
      nameKh: 'អាផាតមិន',
      slug: 'apartment',
    },
    {
      code: 'house',
      nameEn: 'House',
      nameKh: 'ផ្ទះល្វែង/ផ្ទះជួល', // "Flat/Rental House" is more specific for KH
      slug: 'house',
    },
    {
      code: 'villa',
      nameEn: 'Villa',
      nameKh: 'វីឡា',
      slug: 'villa',
    },
    {
      code: 'single_room',
      nameEn: 'Single Room',
      nameKh: 'បន្ទប់សម្រាប់ម្នាក់', // "Room for one person" - much more natural than "Single Room" literally
      slug: 'single_room',
    },
  ];

  for (const item of data) {
    await prisma.propertyType.upsert({
      where: { code: item.code },
      update: {},
      create: item,
    });
  }

  console.log(`✅ property types seed: `, data.length);
}
