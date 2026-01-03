import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from 'src/prisma/prisma.client';
import { UserRole } from './generated/enums';

async function main() {
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
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
