import { loadEnvFiles } from './lib/load-env';

type SeedUser = {
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
  password?: string;
};

async function main(): Promise<void> {
  loadEnvFiles();

  if (!process.env.DATABASE_URL) {
    console.error(
      '✖ ไม่พบ DATABASE_URL — กรุณาคัดลอก .env.example เป็น .env.local แล้วใส่ connection string ของ Neon',
    );
    process.exitCode = 1;
    return;
  }

  // import หลังโหลด env เพื่อให้ getDb() อ่านค่าได้ถูกต้อง
  const { eq } = await import('drizzle-orm');
  const { closeDb, getDb } = await import('../server/db');
  const { users } = await import('../server/db/schema');
  const { hashPassword } = await import('../server/auth/password');
  const { generateRandomPassword } = await import('../lib/password');

  const db = getDb();

  const seedUsers: SeedUser[] = [
    {
      name: process.env.SEED_ADMIN_NAME?.trim() || 'ผู้ดูแลระบบ',
      email: (process.env.SEED_ADMIN_EMAIL?.trim() || 'admin@tif.local').toLowerCase(),
      role: 'ADMIN',
      password: process.env.SEED_ADMIN_PASSWORD?.trim() || undefined,
    },
    {
      name: process.env.SEED_STAFF_NAME?.trim() || 'พนักงานตัวอย่าง',
      email: (process.env.SEED_STAFF_EMAIL?.trim() || 'staff@tif.local').toLowerCase(),
      role: 'STAFF',
      password: process.env.SEED_STAFF_PASSWORD?.trim() || undefined,
    },
  ];

  console.log('\nTIF Stock — Seed ผู้ใช้งาน');

  try {
    for (const seed of seedUsers) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, seed.email))
        .limit(1);

      if (existing) {
        console.log(`• ${seed.email} มีอยู่แล้ว — ข้าม`);
        continue;
      }

      const password = seed.password ?? generateRandomPassword(12);

      await db.insert(users).values({
        name: seed.name,
        email: seed.email,
        role: seed.role,
        passwordHash: await hashPassword(password),
      });

      const roleLabel = seed.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'พนักงาน';
      const passwordLabel = seed.password ? '(ใช้รหัสผ่านจาก environment)' : password;
      console.log(`✔ ${roleLabel}: ${seed.email} / ${passwordLabel}`);
    }

    console.log(
      '\nบันทึกรหัสผ่านที่แสดงไว้ทันที (ระบบจะไม่แสดงซ้ำ) และควรเปลี่ยนรหัสผ่านภายหลัง\n',
    );
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error('✖ Seed ล้มเหลว:', error);
  process.exitCode = 1;
});
