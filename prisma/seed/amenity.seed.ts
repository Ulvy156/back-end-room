import { PrismaClient } from 'prisma/generated/client';

export async function seedAmenities(prisma: PrismaClient) {
  const amenities = [
    {
      code: 'wifi',
      nameEn: 'Wi-Fi',
      nameKh: 'អ៊ីនធឺណិត (Wi-Fi)', // Added Khmer script for Internet + Wi-Fi
      icon: 'wifi',
    },
    {
      code: 'parking',
      nameEn: 'Parking',
      nameKh: 'កន្លែងចតយានយន្ត', // "Vehicle parking space" (covers cars/motors)
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
      nameKh: 'ទឹកស្អាត (រដ្ឋ)', // "Clean Water (State)" - standard for rentals
      icon: 'droplets',
    },
    {
      code: 'electricity',
      nameEn: 'Electricity',
      nameKh: 'ភ្លើង (រដ្ឋ)', // "Electricity (State)" - more common than "អគ្គិសនី" in daily talk
      icon: 'cable',
    },
    {
      code: 'security',
      nameEn: 'Security',
      nameKh: 'សន្តិសុខ ២៤ម៉ោង', // Added "24h" because that's what people look for
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
      nameKh: 'គ្រែគេង', // "Sleeping bed"
      icon: 'bed',
    },
    {
      code: 'wardrobe',
      nameEn: 'Wardrobe',
      nameKh: 'ទូខោអាវ',
      icon: 'shirt',
    },
    {
      code: 'desk',
      nameEn: 'Desk',
      nameKh: 'តុធ្វើការ',
      icon: 'table-2',
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
      icon: 'washing-machine',
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
      nameKh: 'ម៉ាស៊ីនទឹកក្តៅ', // "Hot water machine" sounds more like a feature
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
      nameKh: 'ឡម៉ៃក្រូវ៉េវ', // Added "Oven/Stove" prefix for clarity
      icon: 'microwave',
    },

    // 🌿 Outdoor / Building
    {
      code: 'balcony',
      nameEn: 'Balcony',
      nameKh: 'យ៉រ/រានហាល', // "Yor" is the common term for balcony
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
      nameKh: 'អនុញ្ញាតឱ្យមានសត្វចិញ្ចឹម',
      icon: 'paw-print',
    },
  ];

  for (const amenity of amenities) {
    await prisma.amenity.upsert({
      where: { code: amenity.code },
      update: amenity,
      create: amenity,
    });
  }

  console.log('✅ Amenities seeded: ', amenities.length);
}
