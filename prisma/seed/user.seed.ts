import bcrypt from 'bcrypt';
import { UserRole } from '../generated/enums';
import { PrismaClient } from 'prisma/generated/client';

export async function seedUser(prisma: PrismaClient) {
  const password = await bcrypt.hash('Admin@156', 10);
  const users = [
    {
      name: 'Admin',
      email: 'ulvyromy156@gmail.com',
      password,
      role: UserRole.ADMIN,
      isVerified: true,
    },
    {
      name: 'land lord',
      email: 'landlord@gmail.com',
      password,
      role: UserRole.LANDLORD,
      isVerified: true,
    },
  ];

  await prisma.user.createMany({
    data: users,
    skipDuplicates: true,
  });

  console.log('✅ Admin & user seed: ', users.length);
}
