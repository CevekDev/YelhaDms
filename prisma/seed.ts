import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_SYSTEM_PROMPT = `You are {botName}, an intelligent assistant for {businessName}.
{botPersonality}

LANGUAGE RULES (strict):
1. Detect the language of the incoming message automatically
2. Reply ALWAYS in the exact same language and dialect as the user
3. Supported languages include:
   - Arabic MSA (الفصحى)
   - Algerian Darija: wesh, rabi, nta/nti, khoya, sah, walo, mriguel, 3lach, kifah, la3mar, bessah, daba, mix Arabic/French
   - Moroccan Darija: واخا, مزيان, دابا
   - Tunisian, Egyptian, Levantine dialects
   - French, English, Spanish, and all other languages
4. Match the user's register (formal/informal) automatically
5. Never reveal you are an AI unless directly and explicitly asked
6. Adapt tone per platform: casual WhatsApp/Telegram, slightly formal Facebook

PREDEFINED RESPONSES:
{predefinedResponses}

CUSTOM INSTRUCTIONS:
{customInstructions}`;

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aireply.app' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@aireply.app',
      password: adminPassword,
      emailVerified: new Date(),
      role: 'ADMIN',
      tokenBalance: 10000,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create demo user
  const userPassword = await bcrypt.hash('Demo@123456', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@aireply.app' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@aireply.app',
      password: userPassword,
      emailVerified: new Date(),
      role: 'USER',
      tokenBalance: 100,
    },
  });
  console.log('✅ Demo user created:', demoUser.email);

  // Create global system prompt
  await prisma.systemSetting.upsert({
    where: { key: 'global_system_prompt' },
    update: {},
    create: {
      key: 'global_system_prompt',
      value: DEFAULT_SYSTEM_PROMPT,
    },
  });
  console.log('✅ System prompt configured');

  // Create token packages (prices in DZD)
  const packages = [
    { name: 'Starter',  tokens: 500,   price: 2500,  currency: 'DZD', isActive: true, isFeatured: false },
    { name: 'Business', tokens: 2000,  price: 5000,  currency: 'DZD', isActive: true, isFeatured: true  },
    { name: 'Pro',      tokens: 5000,  price: 10000, currency: 'DZD', isActive: true, isFeatured: false },
    { name: 'Agency',   tokens: 15000, price: 22000, currency: 'DZD', isActive: true, isFeatured: false },
  ];

  for (const pkg of packages) {
    await prisma.tokenPackage.upsert({
      where: { id: pkg.name.toLowerCase() },
      update: {},
      create: { id: pkg.name.toLowerCase(), ...pkg },
    });
  }
  console.log('✅ Token packages created');

  console.log('\n🎉 Seed complete!');
  console.log('\nTest accounts:');
  console.log('  Admin: admin@aireply.app / Admin@123456');
  console.log('  Demo:  demo@aireply.app  / Demo@123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
