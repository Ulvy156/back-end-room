import { PrismaClient } from 'prisma/generated/client';

export async function seedProvinces(prisma: PrismaClient) {
  const provinces = [
    { id: 1, nameKh: 'បន្ទាយមានជ័យ', nameEn: 'Banteay Meanchey' },
    { id: 2, nameKh: 'បាត់ដំបង', nameEn: 'Battambang' },
    { id: 3, nameKh: 'កំពង់ចាម', nameEn: 'Kampong Cham' },
    { id: 4, nameKh: 'កំពង់ឆ្នាំង', nameEn: 'Kampong Chhnang' },
    { id: 5, nameKh: 'កំពង់ស្ពឺ', nameEn: 'Kampong Speu' },
    { id: 6, nameKh: 'កំពង់ធំ', nameEn: 'Kampong Thom' },
    { id: 7, nameKh: 'កំពត', nameEn: 'Kampot' },
    { id: 8, nameKh: 'កណ្ដាល', nameEn: 'Kandal' },
    { id: 9, nameKh: 'កោះកុង', nameEn: 'Koh Kong' },
    { id: 10, nameKh: 'ក្រចេះ', nameEn: 'Kratie' },
    { id: 11, nameKh: 'មណ្ឌលគីរី', nameEn: 'Mondulkiri' },
    { id: 12, nameKh: 'ភ្នំពេញ', nameEn: 'Phnom Penh' },
    { id: 13, nameKh: 'ព្រះវិហារ', nameEn: 'Preah Vihear' },
    { id: 14, nameKh: 'ព្រៃវែង', nameEn: 'Prey Veng' },
    { id: 15, nameKh: 'ពោធិ៍សាត់', nameEn: 'Pursat' },
    { id: 16, nameKh: 'រតនគីរី', nameEn: 'Ratanakiri' },
    { id: 17, nameKh: 'សៀមរាប', nameEn: 'Siem Reap' },
    { id: 18, nameKh: 'ព្រះសីហនុ', nameEn: 'Preah Sihanouk' },
    { id: 19, nameKh: 'ស្ទឹងត្រែង', nameEn: 'Stung Treng' },
    { id: 20, nameKh: 'ស្វាយរៀង', nameEn: 'Svay Rieng' },
    { id: 21, nameKh: 'តាកែវ', nameEn: 'Takeo' },
    { id: 22, nameKh: 'ឧត្តរមានជ័យ', nameEn: 'Oddar Meanchey' },
    { id: 23, nameKh: 'កែប', nameEn: 'Kep' },
    { id: 24, nameKh: 'ប៉ៃលិន', nameEn: 'Pailin' },
    { id: 25, nameKh: 'ត្បូងឃ្មុំ', nameEn: 'Tboung Khmum' },
  ];

  await prisma.province.createMany({
    data: provinces,
    skipDuplicates: true,
  });

  console.log('✅ Provinces seeded');
}
