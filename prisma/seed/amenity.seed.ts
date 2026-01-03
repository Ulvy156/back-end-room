import { PrismaClient } from 'prisma/generated/client';

export async function seedAmenities(prisma: PrismaClient) {
  const amenities = [
    {
      code: 'wifi',
      nameEn: 'Wi-Fi',
      nameKh: 'វ៉ាយហ្វាយ',
      icon: 'wifi',
    },
    {
      code: 'parking',
      nameEn: 'Parking',
      nameKh: 'ចំណតរថយន្ត',
      icon: 'square-parking',
    },
    {
      code: 'air_conditioner',
      nameEn: 'Air Conditioner',
      nameKh: 'ម៉ាស៊ីនត្រជាក់',
      icon: 'sun-snow',
    },
    {
      code: 'water',
      nameEn: 'Water',
      nameKh: 'ទឹក',
      icon: 'droplets',
    },
    {
      code: 'electricity',
      nameEn: 'Electricity',
      nameKh: 'អគ្គិសនី',
      icon: 'cable',
    },
    {
      code: 'security',
      nameEn: 'Security',
      nameKh: 'សន្តិសុខ',
      icon: 'shield-check',
    },
    {
      code: 'elevator',
      nameEn: 'Elevator',
      nameKh: 'ជណ្តើរយន្ត',
      icon: 'arrow-up-down',
    },
  ];

  for (const amenity of amenities) {
    await prisma.amenity.upsert({
      where: { code: amenity.code },
      update: {},
      create: amenity,
    });
  }

  console.log('✅ Amenities seeded');
}
