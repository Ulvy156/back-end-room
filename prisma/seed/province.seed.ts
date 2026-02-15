import { PrismaClient } from 'prisma/generated/client';

export async function seedProvinces(prisma: PrismaClient) {
  const provinces = [
    {
      id: 1,
      nameKh: 'បន្ទាយមានជ័យ',
      nameEn: 'Banteay Meanchey',
      latitude: 13.58588,
      longitude: 102.97369,
    },
    {
      id: 2,
      nameKh: 'បាត់ដំបង',
      nameEn: 'Battambang',
      latitude: 13.10271,
      longitude: 103.19822,
    },
    {
      id: 3,
      nameKh: 'កំពង់ចាម',
      nameEn: 'Kampong Cham',
      latitude: 11.99339,
      longitude: 105.4635,
    },
    {
      id: 4,
      nameKh: 'កំពង់ឆ្នាំង',
      nameEn: 'Kampong Chhnang',
      latitude: 12.25,
      longitude: 104.66667,
    },
    {
      id: 5,
      nameKh: 'កំពង់ស្ពឺ',
      nameEn: 'Kampong Speu',
      latitude: 11.45332,
      longitude: 104.52085,
    },
    {
      id: 6,
      nameKh: 'កំពង់ធំ',
      nameEn: 'Kampong Thom',
      latitude: 12.71121,
      longitude: 104.89108,
    },
    {
      id: 7,
      nameKh: 'កំពត',
      nameEn: 'Kampot',
      latitude: 10.61041,
      longitude: 104.18145,
    },
    {
      id: 8,
      nameKh: 'កណ្ដាល',
      nameEn: 'Kandal',
      latitude: 11.22374,
      longitude: 105.1259,
    },
    {
      id: 9,
      nameKh: 'កោះកុង',
      nameEn: 'Koh Kong',
      latitude: 11.61531,
      longitude: 102.9838,
    },
    {
      id: 10,
      nameKh: 'ក្រចេះ',
      nameEn: 'Kratie',
      latitude: 12.35367,
      longitude: 106.03562,
    },
    {
      id: 11,
      nameKh: 'មណ្ឌលគីរី',
      nameEn: 'Mondulkiri',
      latitude: 12.45583,
      longitude: 107.18811,
    },
    {
      id: 12,
      nameKh: 'ភ្នំពេញ',
      nameEn: 'Phnom Penh',
      latitude: 11.56245,
      longitude: 104.91601,
    },
    {
      id: 13,
      nameKh: 'ព្រះវិហារ',
      nameEn: 'Preah Vihear',
      latitude: 13.79256,
      longitude: 104.98046,
    },
    {
      id: 14,
      nameKh: 'ព្រៃវែង',
      nameEn: 'Prey Veng',
      latitude: 11.48682,
      longitude: 105.32533,
    },
    {
      id: 15,
      nameKh: 'ពោធិ៍សាត់',
      nameEn: 'Pursat',
      latitude: 12.53878,
      longitude: 103.9192,
    },
    {
      id: 16,
      nameKh: 'រតនគីរី',
      nameEn: 'Ratanakiri',
      latitude: 13.73939,
      longitude: 106.98727,
    },
    {
      id: 17,
      nameKh: 'សៀមរាប',
      nameEn: 'Siem Reap',
      latitude: 13.36179,
      longitude: 103.86056,
    },
    {
      id: 18,
      nameKh: 'ព្រះសីហនុ',
      nameEn: 'Preah Sihanouk',
      latitude: 10.60932,
      longitude: 103.52958,
    },
    {
      id: 19,
      nameKh: 'ស្ទឹងត្រែង',
      nameEn: 'Stung Treng',
      latitude: 13.52586,
      longitude: 105.9683,
    },
    {
      id: 20,
      nameKh: 'ស្វាយរៀង',
      nameEn: 'Svay Rieng',
      latitude: 11.08785,
      longitude: 105.79935,
    },
    {
      id: 21,
      nameKh: 'តាកែវ',
      nameEn: 'Takeo',
      latitude: 10.99081,
      longitude: 104.78498,
    },
    {
      id: 22,
      nameKh: 'ឧត្តរមានជ័យ',
      nameEn: 'Oddar Meanchey',
      latitude: 14.18175,
      longitude: 103.51761,
    },
    {
      id: 23,
      nameKh: 'កែប',
      nameEn: 'Kep',
      latitude: 10.48291,
      longitude: 104.31672,
    },
    {
      id: 24,
      nameKh: 'ប៉ៃលិន',
      nameEn: 'Pailin',
      latitude: 12.84895,
      longitude: 102.60928,
    },
    {
      id: 25,
      nameKh: 'ត្បូងឃ្មុំ',
      nameEn: 'Tboung Khmum',
      latitude: 11.81327,
      longitude: 105.76829,
    },
  ];

  for (const province of provinces) {
    await prisma.province.upsert({
      where: { id: province.id },
      update: {
        nameKh: province.nameKh,
        nameEn: province.nameEn,
        latitude: province.latitude,
        longitude: province.longitude,
      },
      create: province,
    });
  }

  console.log('✅ Provinces seeded: ', provinces.length);
}
