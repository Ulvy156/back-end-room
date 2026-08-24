import { PrismaClient } from 'prisma/generated/client';

export async function seedProperties(prisma: PrismaClient) {
  const landlordEmail = process.env.LANDLORD_SEED_EMAIL;
  if (!landlordEmail) {
    console.warn('⚠️  LANDLORD_SEED_EMAIL not set – skipping property seed.');
    return;
  }

  const landlord = await prisma.user.findUnique({
    where: { email: landlordEmail },
  });

  if (!landlord) {
    console.warn('⚠️  Landlord user not found – skipping property seed.');
    return;
  }

  const base = {
    userId: landlord.id,
    districtId: 314,
    lat: null,
    lng: null,
    nearby_location: '',
    deposit: 2000,
    floor: 1,
    totalFloors: 5,
    isAvailable: true,
    availableFrom: new Date('2026-06-24T02:54:05.790Z'),
    isFeatured: false,
    totalViews: 0,
    propertyTypeId: 4,
    furnished: true,
    isPublished: true,
    minimumStayLength: 3,
    openTime: null,
    closeTime: null,
  };

  const properties = [
    {
      id: 'd1f460bd-6787-40a6-8b28-ce6b5f5bb911',
      ...base,
      title: 'Condo For Rent - Romdoul City Condo',
      description:
      '𝐅𝐨𝐫 𝐑𝐞𝐧𝐭: 2BR Apartment – Close to Aeon 2, Sensok Area',
      address: 'Sk Tuek Thla, Sensok – Close to Royal Hospital',
      monthly_price: 1000,
      bedroom: 2,
      bathroom: 1,
      sizeSqm: 70,
      sizeWidthM: 7,
      sizeLengthM: 10,
    },
    {
      id: 'a1b2c3d4-1111-4000-8000-000000000002',
      ...base,
      title: 'Studio Apartment For Rent – Sensok Area',
      description: 'Cozy studio unit, fully furnished, near Aeon 2 Mall.',
      address: 'Sk Tuek Thla, Sensok – Near Aeon 2 Mall',
      monthly_price: 500,
      deposit: 500,
      bedroom: 1,
      bathroom: 1,
      // No width/length on file for this one — total area only, to exercise
      // the "dimensions unknown" display case. Explicit nulls so re-seeding
      // clears any previously-set dimensions (upsert only touches given keys).
      sizeSqm: 40,
      sizeWidthM: null,
      sizeLengthM: null,
    },
    {
      id: 'a1b2c3d4-2222-4000-8000-000000000003',
      ...base,
      title: '1 Bedroom Apartment For Rent – Sensok',
      description:
        'Bright 1-bedroom unit on the 3rd floor. Walking distance to Royal Hospital.',
      address: 'Sk Tuek Thla, Sensok – Opposite Royal Hospital',
      monthly_price: 650,
      deposit: 650,
      bedroom: 1,
      bathroom: 1,
      floor: 3,
      sizeSqm: 55,
      sizeWidthM: 5,
      sizeLengthM: 11,
    },
    {
      id: 'a1b2c3d4-3333-4000-8000-000000000004',
      ...base,
      title: '2 Bedroom Condo For Rent – Romdoul City',
      description:
        'Spacious 2BR unit with city view. Gym and pool access included.',
      address: 'Romdoul City, Sk Tuek Thla, Sensok',
      monthly_price: 850,
      bedroom: 2,
      bathroom: 2,
      floor: 7,
      sizeSqm: 75,
      sizeWidthM: 5,
      sizeLengthM: 15,
    },
    {
      id: 'a1b2c3d4-4444-4000-8000-000000000005',
      ...base,
      title: '3 Bedroom Apartment – Sensok District',
      description:
        'Family-sized 3BR apartment, 2 bathrooms, near international schools.',
      address: 'Tuek Thla Village, Sensok, Phnom Penh',
      monthly_price: 1100,
      bedroom: 3,
      bathroom: 2,
      floor: 2,
      sizeSqm: 90,
      sizeWidthM: 6,
      sizeLengthM: 15,
    },
    {
      id: 'a1b2c3d4-5555-4000-8000-000000000006',
      ...base,
      title: 'Penthouse For Rent – Sensok Romdoul City',
      description:
        '𝐏𝐞𝐧𝐭𝐡𝐨𝐮𝐬𝐞: 4BR luxury unit, panoramic view, 2 parking spaces.',
      address: 'Romdoul City Condo, Tuek Thla, Sensok',
      monthly_price: 2000,
      deposit: 4000,
      bedroom: 4,
      bathroom: 3,
      floor: 12,
      totalFloors: 12,
      // Total area exceeds width x length — extra balcony/terrace space not
      // captured by the simple rectangle, demonstrating sizeSqm's independence.
      sizeSqm: 150,
      sizeWidthM: 10,
      sizeLengthM: 10,
      minimumStayLength: 6,
    },
    {
      id: 'a1b2c3d4-6666-4000-8000-000000000007',
      ...base,
      title: 'Affordable Studio Near Royal Hospital – Sensok',
      description: 'Budget studio unit. Utilities not included.',
      address: 'Street 5, Sk Tuek Thla, Sensok',
      monthly_price: 350,
      deposit: 350,
      bedroom: 1,
      bathroom: 1,
      floor: 1,
      sizeSqm: 30,
      sizeWidthM: 5,
      sizeLengthM: 6,
      minimumStayLength: 1,
    },
    {
      id: 'a1b2c3d4-7777-4000-8000-000000000008',
      ...base,
      title: '2BR Furnished Condo – Close to Aeon 2, Sensok',
      description:
        'Modern 2BR condo with full kitchen. Short walk to Aeon 2 and local markets.',
      address: 'Tuek Thla, Sensok – Near Aeon 2',
      monthly_price: 900,
      bedroom: 2,
      bathroom: 1,
      floor: 5,
      sizeSqm: 68,
      sizeWidthM: 4,
      sizeLengthM: 17,
    },
    {
      id: 'a1b2c3d4-8888-4000-8000-000000000009',
      ...base,
      title: '3 Bedroom Family Flat For Rent – Sensok',
      description:
        'Well-maintained 3BR flat suitable for families. Balcony with garden view.',
      address: 'Boeng Kok, Sk Tuek Thla, Sensok',
      monthly_price: 1250,
      deposit: 2500,
      bedroom: 3,
      bathroom: 2,
      floor: 4,
      sizeSqm: 100,
      sizeWidthM: 10,
      sizeLengthM: 10,
    },
    {
      id: 'a1b2c3d4-9999-4000-8000-000000000010',
      ...base,
      title: 'Executive 2BR Condo – Romdoul City Sensok',
      description:
        'High-floor 2BR executive unit with modern furnishings. Close to embassies and BKK.',
      address: 'Romdoul City Condo, Sk Tuek Thla, Sensok',
      monthly_price: 1500,
      deposit: 3000,
      bedroom: 2,
      bathroom: 2,
      floor: 10,
      sizeSqm: 85,
      sizeWidthM: 5,
      sizeLengthM: 17,
      minimumStayLength: 6,
    },
  ];

  for (const property of properties) {
    await prisma.property.upsert({
      where: { id: property.id },
      create: property,
      update: property,
    });
  }

  console.log('✅ Property seed: ', properties.length);
}
