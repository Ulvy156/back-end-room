import fs from 'fs';
import path from 'path';
import { Prisma, PrismaClient } from 'prisma/generated/client';

export async function seedDistricts(prisma: PrismaClient) {
  const filePath = path.join(
    process.cwd(),
    'prisma',
    'data',
    'cambodia-districts-2025.json',
  );

  const districts = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  ) as Prisma.DistrictCreateManyInput[];

  await prisma.district.createMany({
    data: districts,
    skipDuplicates: true,
  });

  console.log(`✅ Districts seeded: `, districts.length);
}
