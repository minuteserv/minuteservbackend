require('dotenv').config();
const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

/**
 * Create or update admin user
 * Usage: node -e "require('./src/utils/createAdminUser').createAdmin('admin@example.com', 'password123')"
 */
async function createAdmin(email, password, name = 'Admin User') {
  try {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    logger.info(`Creating admin user: ${email}`);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    logger.debug('Password hashed');

    // Check if admin exists
    const { data: existing } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single();

    if (existing) {
      // Update existing admin
      const { data: admin, error } = await supabase
        .from('admin_users')
        .update({
          password_hash: passwordHash,
          name,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('email', email)
        .select()
        .single();

      if (error) {
        logger.error('Update admin error:', error);
        throw new Error('Failed to update admin user');
      }

      logger.info('✅ Admin user updated successfully');
      return admin;
    } else {
      // Create new admin
      const { data: admin, error } = await supabase
        .from('admin_users')
        .insert({
          email,
          password_hash: passwordHash,
          name,
          role: 'super_admin',
          is_active: true
        })
        .select()
        .single();

      if (error) {
        logger.error('Create admin error:', error);
        throw new Error('Failed to create admin user');
      }

      logger.info('✅ Admin user created successfully');
      return admin;
    }
  } catch (error) {
    logger.error('Create admin error:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config();
  
  const email = process.argv[2] || 'admin@minuteserv.com';
  const password = process.argv[3] || 'admin123';
  const name = process.argv[4] || 'Admin User';

  createAdmin(email, password, name)
    .then((admin) => {
      console.log('\n✅ Admin user ready!');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   ID: ${admin.id}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed to create admin:', error.message);
      process.exit(1);
    });
}

module.exports = { createAdmin };

