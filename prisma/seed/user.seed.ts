import bcrypt from 'bcrypt';
import { UserRole } from '../generated/enums';
import { PrismaClient } from 'prisma/generated/client';

export async function seedUser(prisma: PrismaClient) {
  const password = await bcrypt.hash('Admin@156', 10);

  await prisma.user.upsert({
    where: { email: 'ulvyromy156@gmail.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'ulvyromy156@gmail.com',
      password,
      role: UserRole.ADMIN,
    },
  });

  console.log('✅ Admin user seeded');
}
