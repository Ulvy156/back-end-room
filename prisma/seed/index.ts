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
const seeds = {
  province: seedProvinces,
  district: seedDistricts,
  'property-type': seedPropertyTypes,
  'property-rules': seedPropetyRules,
  'report-type': seedReportTypes,
  user: seedUser,
  amenity: seedAmenities,
  property: seedProperties,
  'app-settings': seedAppSettings,
  'legal-document': seedLegalDocuments,
} as const;

export async function runSeeds() {
  const only = process.argv.slice(2);

  try {
    const names = only.length > 0 ? only : (Object.keys(seeds) as (keyof typeof seeds)[]);

    for (const name of names) {
      const seed = seeds[name as keyof typeof seeds];
      if (!seed) throw new Error(`Unknown seed: ${name}`);
      await seed(prisma);
    }

    console.log(only.length > 0 ? `🌱 Seed(s) done: ${only.join(', ')}` : '🌱 All seeds done');
  } finally {
    await prisma.$disconnect();
  }
}

runSeeds().catch((e) => {
  console.error(e);
  process.exit(1);
});
