require('dotenv').config();
const supabase = require('../config/supabase');
const logger = require('./logger');

/**
 * Test database connection and verify tables
 */
async function testDatabase() {
  try {
    console.log('\n🔍 Testing database connection...\n');

    // Test 1: Connection
    console.log('1. Testing connection...');
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('   ❌ Connection failed:', testError.message);
      return false;
    }
    console.log('   ✅ Connection successful');

    // Test 2: Check all tables exist
    console.log('\n2. Verifying tables...');
    const tables = [
      'users',
      'user_addresses',
      'services',
      'partners',
      'bookings',
      'payments',
      'otp_verifications',
      'promo_codes',
      'contact_submissions',
      'admin_users'
    ];

    let allTablesExist = true;
    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        console.log(`   ❌ Table "${table}" missing or inaccessible`);
        allTablesExist = false;
      } else {
        console.log(`   ✅ Table "${table}" exists`);
      }
    }

    if (!allTablesExist) {
      console.log('\n   ⚠️  Some tables are missing. Run database.sql in Supabase.');
      return false;
    }

    // Test 3: Check promo codes
    console.log('\n3. Checking seed data...');
    const { data: promoCodes, error: promoError } = await supabase
      .from('promo_codes')
      .select('code, is_active')
      .limit(5);

    if (promoError) {
      console.log('   ❌ Promo codes check failed');
    } else {
      console.log(`   ✅ Found ${promoCodes?.length || 0} promo codes`);
      if (promoCodes && promoCodes.length > 0) {
        promoCodes.forEach(pc => {
          console.log(`      - ${pc.code} (${pc.is_active ? 'active' : 'inactive'})`);
        });
      }
    }

    // Test 4: Check admin user
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('email, role, is_active')
      .limit(1);

    if (adminError) {
      console.log('   ❌ Admin users check failed');
    } else {
      console.log(`   ✅ Found ${adminUsers?.length || 0} admin user(s)`);
      if (adminUsers && adminUsers.length > 0) {
        adminUsers.forEach(admin => {
          console.log(`      - ${admin.email} (${admin.role})`);
        });
      }
    }

    // Test 5: Check services
    const { count: serviceCount } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true });

    console.log(`   ✅ Found ${serviceCount || 0} services`);
    if ((serviceCount || 0) === 0) {
      console.log('      ⚠️  No services found. Run seed script to populate.');
    }

    console.log('\n✅ Database test completed successfully!\n');
    return true;
  } catch (error) {
    console.error('\n❌ Database test failed:', error.message);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  testDatabase()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = { testDatabase };

