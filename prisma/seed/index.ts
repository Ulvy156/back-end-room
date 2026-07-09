import 'dotenv/config';
import { prisma } from 'src/prisma/prisma.client';
import { seedPropertyTypes } from './property-type.seed';
import { seedUser } from './user.seed';
import { seedAmenities } from './amenity.seed';
import { seedProvinces } from './province.seed';
import { seedDistricts } from './district.seed';
import { seedPropetyRules } from './property-rules.seed';
import { seedReportTypes } from './report-type.seed';
import { seedProperties } from './property.seed';
import { seedAppSettings } from './app-settings.seed';
import { seedLegalDocuments } from './legal-document.seed';
export async function runSeeds() {
  try {
    await seedProvinces(prisma);
    await seedDistricts(prisma);
    await seedPropertyTypes(prisma);
    await seedPropetyRules(prisma);
    await seedReportTypes(prisma);
    await seedUser(prisma);
    await seedAmenities(prisma);
    await seedProperties(prisma);
    await seedAppSettings(prisma);
    await seedLegalDocuments(prisma);

    console.log('🌱 All seeds done');
  } finally {
    await prisma.$disconnect();
  }
}

runSeeds().catch((e) => {
  console.error(e);
  process.exit(1);
});
