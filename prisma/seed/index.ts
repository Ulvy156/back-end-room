import 'dotenv/config';
import { prisma } from 'src/prisma/prisma.client';
import { seedPropertyTypes } from './property-type.seed';
import { seedUser } from './user.seed';
import { seedAmenities } from './amenity.seed';
export async function runSeeds() {
  try {
    await seedPropertyTypes(prisma);
    await seedUser(prisma);
    await seedAmenities(prisma);

    console.log('🌱 All seeds done');
  } finally {
    await prisma.$disconnect();
  }
}

runSeeds().catch((e) => {
  console.error(e);
  process.exit(1);
});
