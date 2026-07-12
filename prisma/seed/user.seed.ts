import bcrypt from 'bcrypt';
import { UserRole } from '../generated/enums';
import { PrismaClient } from 'prisma/generated/client';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var "${name}" for user seeding`);
  }
  return value;
}

export async function seedUser(prisma: PrismaClient) {
  const users = [
    {
      name: process.env.ADMIN_SEED_NAME ?? 'Admin',
      email: requireEnv('ADMIN_SEED_EMAIL'),
      password: await bcrypt.hash(requireEnv('ADMIN_SEED_PASSWORD'), 10),
      role: UserRole.ADMIN,
      isVerified: true,
    },
    {
      name: process.env.LANDLORD_SEED_NAME ?? 'Landlord',
      email: requireEnv('LANDLORD_SEED_EMAIL'),
      password: await bcrypt.hash(requireEnv('LANDLORD_SEED_PASSWORD'), 10),
      role: UserRole.LANDLORD,
      isVerified: true,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: user,
      update: {
        password: user.password,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  }

  console.log('✅ Admin & user seed: ', users.length);
}
