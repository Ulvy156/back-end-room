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

    // 🛋️ Indoor
    {
      code: 'bed',
      nameEn: 'Bed',
      nameKh: 'គ្រែ',
      icon: 'bed',
    },
    {
      code: 'wardrobe',
      nameEn: 'Wardrobe',
      nameKh: 'ទូខោអាវ',
      icon: 'cabinet',
    },
    {
      code: 'desk',
      nameEn: 'Desk',
      nameKh: 'តុធ្វើការ',
      icon: 'desk',
    },
    {
      code: 'tv',
      nameEn: 'Television',
      nameKh: 'ទូរទស្សន៍',
      icon: 'tv',
    },
    {
      code: 'refrigerator',
      nameEn: 'Refrigerator',
      nameKh: 'ទូទឹកកក',
      icon: 'refrigerator',
    },
    {
      code: 'washing_machine',
      nameEn: 'Washing Machine',
      nameKh: 'ម៉ាស៊ីនបោកខោអាវ',
      icon: 'washer',
    },

    // 🚿 Bathroom
    {
      code: 'private_bathroom',
      nameEn: 'Private Bathroom',
      nameKh: 'បន្ទប់ទឹកផ្ទាល់ខ្លួន',
      icon: 'bath',
    },
    {
      code: 'hot_water',
      nameEn: 'Hot Water',
      nameKh: 'ទឹកក្តៅ',
      icon: 'thermometer-sun',
    },

    // 🏠 Kitchen
    {
      code: 'kitchen',
      nameEn: 'Kitchen',
      nameKh: 'ផ្ទះបាយ',
      icon: 'utensils',
    },
    {
      code: 'microwave',
      nameEn: 'Microwave',
      nameKh: 'មីក្រូវ៉េវ',
      icon: 'microwave',
    },

    // 🌿 Outdoor / Building
    {
      code: 'balcony',
      nameEn: 'Balcony',
      nameKh: 'រានហាល',
      icon: 'sun',
    },
    {
      code: 'generator',
      nameEn: 'Backup Generator',
      nameKh: 'ម៉ាស៊ីនភ្លើងបម្រុង',
      icon: 'zap',
    },
    {
      code: 'cctv',
      nameEn: 'CCTV',
      nameKh: 'កាមេរ៉ាសុវត្ថិភាព',
      icon: 'camera',
    },

    // 🐶 Rules
    {
      code: 'pet_friendly',
      nameEn: 'Pet Friendly',
      nameKh: 'អនុញ្ញាតសត្វចិញ្ចឹម',
      icon: 'paw-print',
    },
  ];

  for (const amenity of amenities) {
    await prisma.amenity.upsert({
      where: { code: amenity.code },
      update: {},
      create: amenity,
    });
  }

  console.log('✅ Amenities seeded: ', amenities.length);
}
