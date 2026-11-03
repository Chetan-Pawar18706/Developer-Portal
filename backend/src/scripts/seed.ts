import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User, hashPassword, type UserRole } from '../models/user.model';

interface SeedUser {
  name: string;
  email: string;
  role: UserRole;
}

const SEED_PASSWORD = 'Password@123';

const seedUsers: SeedUser[] = [
  { name: 'Admin User', email: 'admin@demo.com', role: 'admin' },
  { name: 'Project Manager', email: 'pm@demo.com', role: 'pm' },
  { name: 'Developer One', email: 'dev1@demo.com', role: 'developer' },
  { name: 'Developer Two', email: 'dev2@demo.com', role: 'developer' },
  { name: 'Demo Client', email: 'client@demo.com', role: 'client' },
];

async function seed(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is production.');
    process.exit(1);
  }

  try {
    await connectDatabase();

    await User.deleteMany({});

    const passwordHash = await hashPassword(SEED_PASSWORD);
    const createdUsers = await User.insertMany(
      seedUsers.map((user) => ({ ...user, passwordHash })),
    );

    console.log(`Seeded ${createdUsers.length} users (password: ${SEED_PASSWORD})`);

    for (const user of seedUsers) {
      console.log(`  ${user.role.padEnd(10)} ${user.email}`);
    }
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void seed();
