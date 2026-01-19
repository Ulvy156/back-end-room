import { PrismaClient } from 'prisma/generated/client';

export async function seedPropetyRules(prisma: PrismaClient) {
  const rules = [
    {
      key: 'pets_allowed',
      label: 'Pets Allowed',
      icon: 'paw',
    },
    {
      key: 'smoking_allowed',
      label: 'Smoking Allowed',
      icon: 'smoking',
    },
    {
      key: 'guests_allowed',
      label: 'Guests Allowed',
      icon: 'users',
    },
    {
      key: 'overnight_guests',
      label: 'Overnight Guests',
      icon: 'moon',
    },
    {
      key: 'parties_allowed',
      label: 'Parties Allowed',
      icon: 'music',
    },
    {
      key: 'cooking_allowed',
      label: 'Cooking Allowed',
      icon: 'chef-hat',
    },
    {
      key: 'parking_available',
      label: 'Parking Available',
      icon: 'car',
    },
    {
      key: 'internet_included',
      label: 'Internet Included',
      icon: 'wifi',
    },
    {
      key: 'water_included',
      label: 'Water Included',
      icon: 'droplet',
    },
    {
      key: 'electricity_included',
      label: 'Electricity Included',
      icon: 'bolt',
    },
    {
      key: 'minimum_stay_required',
      label: 'Minimum Stay Required',
      icon: 'calendar',
    },
  ];

  for (const rule of rules) {
    await prisma.propertyRules.upsert({
      where: { key: rule.key },
      update: {},
      create: rule,
    });
  }

  console.log('✅ Property rules seeded: ', rules.length);
}
