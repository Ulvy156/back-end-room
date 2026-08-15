import { Prisma, PrismaClient } from 'prisma/generated/client';

// Values below match what was live in `app_settings` at the time of the
// category/key migration — captured via a direct read before the schema
// changed, so the cutover doesn't silently reset them to defaults.
// `update: {}` is a no-op on existing rows, so it never clobbers a later
// live edit; only the very first run for a given (category, key) writes these.
const SETTINGS: Array<{
  category: string;
  key: string;
  value: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  description: string;
  isPublic: boolean;
}> = [
  {
    category: 'system',
    key: 'maintenanceMode',
    value: false,
    description:
      'When true, all non-ADMIN requests receive 503 except POST /auth/login and POST /auth/refresh-token.',
    isPublic: true,
  },
  {
    category: 'auth',
    key: 'registrationEnabled',
    value: true,
    description:
      'When false, new-account registration (email, Telegram auto-register, Google OAuth auto-register) is rejected with 403.',
    isPublic: true,
  },
  {
    category: 'auth',
    key: 'limitAddPhoneNumber',
    value: 3,
    description: 'Max phone numbers a user may add to their account.',
    isPublic: false,
  },
  {
    category: 'property',
    key: 'maxPropertiesPerLandlord',
    value: 3,
    description:
      'Max properties a landlord may create within a rolling 30-day window (or since their last admin-triggered reset).',
    isPublic: true,
  },
  {
    category: 'property',
    key: 'maxImagesPerProperty',
    value: 5,
    description: 'Max images allowed per property.',
    isPublic: true,
  },
  {
    category: 'property',
    key: 'maxDraftsPerLandlord',
    value: 5,
    description: 'Max unpublished property drafts a landlord may hold at once.',
    isPublic: false,
  },
  {
    category: 'property',
    key: 'minPropertyPrice',
    value: 30,
    description:
      'Lower bound on monthly_price for property create/update. Null means no bound.',
    isPublic: true,
  },
  {
    category: 'property',
    key: 'maxPropertyPrice',
    value: 2000,
    description:
      'Upper bound on monthly_price for property create/update. Null means no bound; must be >= minPropertyPrice.',
    isPublic: true,
  },
];

export async function seedAppSettings(prisma: PrismaClient) {
  for (const setting of SETTINGS) {
    await prisma.appSetting.upsert({
      where: { category_key: { category: setting.category, key: setting.key } },
      update: {},
      create: setting,
    });
  }

  console.log('✅ App settings seeded:', SETTINGS.length);
}
