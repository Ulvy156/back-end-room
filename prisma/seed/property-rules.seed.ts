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
      nameKh: 'អនុញ្ញាតឱ្យភ្ញៀវស្នាក់នៅយប់',
      icon: 'moon',
    },
    {
      key: 'parties_allowed',
      nameEn: 'Parties ',
      nameKh: 'អនុញ្ញាតឱ្យរៀបចំកម្មវិធី', // "Organize programs/parties" sounds better
      icon: 'music',
    },
    {
      key: 'parking_available_for_guess',
      nameEn: 'Parking Available For Guess',
      nameKh: 'មានចំណតរថយន្តសម្រាប់ភ្ញៀវ', // "Parking space" is more professional
      icon: 'car',
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
