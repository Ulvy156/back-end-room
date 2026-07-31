import { Prisma, PrismaClient } from 'prisma/generated/client';

// Values below match what was live in `app_settings` (id: 1) at the time of
// this migration — captured via a direct read before `db push` restructured
// the table, so the cutover doesn't silently reset them to schema defaults.
// `update: {}` is a no-op on existing rows, so it never clobbers a later
// live edit; only the very first run after `db push` writes these.
const SETTINGS: Array<{
  key: string;
  group: string;
  value: Prisma.InputJsonValue | typeof Prisma.JsonNull;
}> = [
  { key: 'maintenanceMode', group: 'system', value: false },
  { key: 'registrationEnabled', group: 'auth', value: true },
  { key: 'maxPropertiesPerLandlord', group: 'property', value: 3 },
  { key: 'maxImagesPerProperty', group: 'property', value: 5 },
  { key: 'minPropertyPrice', group: 'property', value: 30 },
  { key: 'maxPropertyPrice', group: 'property', value: 2000 },
  { key: 'limitAddPhoneNumber', group: 'user', value: 3 },
];

export async function seedAppSettings(prisma: PrismaClient) {
  for (const setting of SETTINGS) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ App settings seeded:', SETTINGS.length);
}
