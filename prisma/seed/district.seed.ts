import districts from '../data/cambodia-districts-2025.json';
import { PrismaClient } from 'prisma/generated/client';


export async function seedDistricts(prisma: PrismaClient) {
  await prisma.district.createMany({
    data: districts,
    skipDuplicates: true,
  });

  console.log('✅ Districts seeded:')
}
