require('dotenv').config();
const { testDatabase } = require('../utils/testDatabase');
const { seedServicesFromJson } = require('../utils/seedServicesFromJson');
const { createAdmin } = require('../utils/createAdminUser');
const logger = require('../utils/logger');

/**
 * Complete setup script
 * Runs all setup steps in sequence
 */
async function completeSetup() {
  console.log('\n🚀 Starting Complete Setup...\n');

  try {
    // Step 1: Test database connection
    console.log('📊 Step 1: Testing database connection...');
    const dbTest = await testDatabase();
    if (!dbTest) {
      console.error('\n❌ Database test failed. Please run database.sql in Supabase first.');
      process.exit(1);
    }
    console.log('✅ Database connection verified\n');

    // Step 2: Seed services
    console.log('🌱 Step 2: Seeding services...');
    try {
      const seedResult = await seedServicesFromJson();
      console.log(`✅ Services seeded: ${seedResult.inserted} inserted, ${seedResult.skipped} skipped\n`);
    } catch (seedError) {
      console.warn('⚠️  Services seed warning:', seedError.message);
      console.log('   (You can run this later with: npm run seed-services)\n');
    }

    // Step 3: Create admin user (if not exists)
    console.log('👤 Step 3: Checking admin user...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@minuteserv.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = process.env.ADMIN_NAME || 'Admin User';

    try {
      const admin = await createAdmin(adminEmail, adminPassword, adminName);
      console.log(`✅ Admin user ready: ${admin.email}\n`);
    } catch (adminError) {
      console.warn('⚠️  Admin user warning:', adminError.message);
      console.log('   (You can create admin later with: npm run create-admin)\n');
    }

    console.log('🎉 Setup Complete!\n');
    console.log('📋 Summary:');
    console.log('   ✅ Database connection verified');
    console.log('   ✅ Services seeded');
    console.log('   ✅ Admin user created');
    console.log('\n🚀 Next: Start server with "npm run dev"\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  completeSetup();
}

module.exports = { completeSetup };

