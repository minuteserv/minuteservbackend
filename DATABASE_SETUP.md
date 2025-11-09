# Database Setup Guide - Complete Instructions

## ✅ Step-by-Step Database Setup

### Step 1: Open Supabase Dashboard

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Login to your account
3. Select your project (or create a new one)

### Step 2: Run Database Schema

1. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

2. **Copy the SQL Script**
   - Open `src/config/database.sql` in your project
   - Copy the entire contents

3. **Paste and Run**
   - Paste the SQL into Supabase SQL Editor
   - Click "Run" or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
   - Wait for execution to complete

4. **Verify Tables Created**
   - You should see: `✅ Database schema created successfully!`
   - Check the "Table Editor" in Supabase to see all 10 tables

### Step 3: Verify Tables

Run this query in SQL Editor to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- users
- user_addresses
- services
- partners
- bookings
- payments
- otp_verifications
- promo_codes
- contact_submissions
- admin_users

### Step 4: Seed Services Data

**Option A: Using Node Script (Recommended)**

```bash
cd minuteservbackend
node -e "require('./src/utils/seedServices').seedServices()"
```

**Option B: Manual Insert via SQL**

Copy services from `../src/data/services.json` and insert manually, or use the seed script above.

### Step 5: Create Admin User Password Hash

The default admin user is created with a placeholder hash. **You MUST change this!**

**Generate a new password hash:**

```bash
# Install bcrypt globally if needed
npm install -g bcryptjs

# Or use Node.js
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-secure-password', 10).then(hash => console.log(hash))"
```

**Update admin password in Supabase:**

```sql
UPDATE admin_users 
SET password_hash = 'your-generated-hash-here'
WHERE email = 'admin@minuteserv.com';
```

### Step 6: Test Database Connection

Create a test file `test-db.js`:

```javascript
require('dotenv').config();
const supabase = require('./src/config/supabase');

async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Connection failed:', error);
    } else {
      console.log('✅ Database connection successful!');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testConnection();
```

Run: `node test-db.js`

### Step 7: Verify Indexes

Check that indexes are created:

```sql
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## 🔧 Troubleshooting

### Error: "relation already exists"
- Tables already exist, this is fine
- The script uses `CREATE TABLE IF NOT EXISTS`

### Error: "permission denied"
- Make sure you're using the SQL Editor with proper permissions
- Check that you're logged into the correct Supabase project

### Error: "extension uuid-ossp does not exist"
- Run: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
- This is usually enabled by default in Supabase

### Tables not showing in Table Editor
- Refresh the page
- Check if tables are in the `public` schema
- Verify SQL execution was successful

## ✅ Verification Checklist

- [ ] All 10 tables created
- [ ] Indexes created (check with verification query)
- [ ] Triggers created (updated_at triggers)
- [ ] Promo codes seeded (3 default codes)
- [ ] Admin user created
- [ ] Services data seeded
- [ ] Database connection test successful

## 📊 Quick Verification Queries

```sql
-- Count tables
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check promo codes
SELECT * FROM promo_codes;

-- Check admin user
SELECT email, role, is_active FROM admin_users;

-- Check services count
SELECT COUNT(*) FROM services;
```

## 🚀 Next Steps After Database Setup

1. ✅ Database tables created
2. ✅ Services seeded
3. ✅ Admin user password updated
4. ✅ Test database connection
5. ✅ Start backend server: `npm run dev`
6. ✅ Test API endpoints

---

**Your database is now ready! 🎉**

