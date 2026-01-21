import { PrismaClient } from 'prisma/generated/client';

export async function seedPropetyRules(prisma: PrismaClient) {
  const rules = [
    {
      key: 'pets_allowed',
      nameEn: 'Pets ',
      nameKh: 'អនុញ្ញាតឱ្យមានសត្វចិញ្ចឹម', // Added "have" for better flow
      icon: 'paw-print',
    },
    {
      key: 'smoking_allowed',
      nameEn: 'Smoking ',
      nameKh: 'អនុញ្ញាតឱ្យជក់បារី',
      icon: 'cigarette',
    },
    {
      key: 'guests_allowed',
      nameEn: 'Guests ',
      nameKh: 'អនុញ្ញាតឱ្យមានភ្ញៀវ', // More natural than just "allow guests"
      icon: 'users',
    },
    {
      key: 'overnight_guests',
      nameEn: 'Overnight Guests',
      nameKh: 'អនុញ្ញាតឱ្យស្នាក់នៅយប់',
      icon: 'moon',
    },
    {
      key: 'parties_allowed',
      nameEn: 'Parties ',
      nameKh: 'អនុញ្ញាតឱ្យរៀបចំកម្មវិធី', // "Organize programs/parties" sounds better
      icon: 'music',
    },
    {
      key: 'cooking_allowed',
      nameEn: 'Cooking ',
      nameKh: 'អនុញ្ញាតឱ្យចម្អិនអាហារ',
      icon: 'chef-hat',
    },
    {
      key: 'parking_available',
      nameEn: 'Parking Available',
      nameKh: 'មានកន្លែងចតយានយន្ត', // "Parking space" is more professional
      icon: 'car',
    },
    {
      key: 'internet_included',
      nameEn: 'Internet Included',
      nameKh: 'រួមបញ្ចូលសេវាអ៊ីនធឺណិត',
      icon: 'wifi',
    },
    {
      key: 'water_included',
      nameEn: 'Water Included',
      nameKh: 'រួមបញ្ចូលថ្លៃទឹក', // Specifically "water fee"
      icon: 'droplet',
    },
    {
      key: 'electricity_included',
      nameEn: 'Electricity Included',
      nameKh: 'រួមបញ្ចូលថ្លៃអគ្គិសនី', // Specifically "electricity fee"
      icon: 'bolt',
    },
    {
      key: 'minimum_stay_required',
      nameEn: 'Minimum Stay Required',
      nameKh: 'តម្រូវឱ្យស្នាក់នៅអប្បបរមា',
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
