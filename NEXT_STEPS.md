# 🎯 Next Steps - After Database Setup

## ✅ Database Setup Complete!

You've successfully run the database schema in Supabase. Now follow these steps:

---

## Step 1: Seed Services Data

**Path:** `/Users/user/Desktop/MinServe/minuteservbackend`

**Command:**
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend
npm run seed-services
```

**What it does:**
- Reads services from `../src/data/services.json`
- Inserts all services into the database
- Skips services without productCost
- Shows count of inserted/skipped services

**Expected output:**
```
✅ Services JSON loaded
📦 Found X services to seed
✅ Services seeded: X inserted, Y skipped
```

---

## Step 2: Create Admin User

**Path:** `/Users/user/Desktop/MinServe/minuteservbackend`

**Command:**
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend
npm run create-admin admin@minuteserv.com your-secure-password "Admin Name"
```

**What it does:**
- Creates or updates admin user
- Hashes password with bcrypt
- Sets role to super_admin
- Makes user active

**Example:**
```bash
npm run create-admin admin@minuteserv.com MySecurePass123 "Admin User"
```

**Expected output:**
```
✅ Admin user ready!
   Email: admin@minuteserv.com
   Role: super_admin
   ID: uuid-here
```

**⚠️ Important:** Replace `your-secure-password` with a strong password!

---

## Step 3: Test Database Connection

**Path:** `/Users/user/Desktop/MinServe/minuteservbackend`

**Command:**
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend
npm run test-db
```

**What it does:**
- Tests Supabase connection
- Verifies all 10 tables exist
- Checks seed data (promo codes, admin, services)
- Shows summary

**Expected output:**
```
✅ Connection successful
✅ All 10 tables exist
✅ Promo codes found
✅ Admin user found
✅ Services count: X
```

---

## Step 4: Start Development Server

**Path:** `/Users/user/Desktop/MinServe/minuteservbackend`

**Command:**
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend
npm run dev
```

**What it does:**
- Starts Express server on port 3000
- Auto-reloads on file changes (nodemon)
- Shows connection status
- Ready to accept API requests

**Expected output:**
```
✅ Supabase connection successful
🚀 Minuteserv API Server running on port 3000
📝 Environment: development
🌐 Health check: http://localhost:3000/health
```

---

## 📋 Complete Command Sequence

Copy and paste these commands one by one:

```bash
# Navigate to backend directory
cd /Users/user/Desktop/MinServe/minuteservbackend

# Step 1: Seed services
npm run seed-services

# Step 2: Create admin (replace password!)
npm run create-admin admin@minuteserv.com your-secure-password "Admin User"

# Step 3: Test database
npm run test-db

# Step 4: Start server
npm run dev
```

---

## 🧪 Test API Endpoints

Once server is running, test in another terminal:

```bash
# Health check
curl http://localhost:3000/health

# Send OTP (check server console for OTP code in dev mode)
curl -X POST http://localhost:3000/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+911234567890"}'
```

---

## ✅ Verification Checklist

After running all commands, verify:

- [ ] Services seeded (check with: `SELECT COUNT(*) FROM services;` in Supabase)
- [ ] Admin user created with proper password
- [ ] Database test passes all checks
- [ ] Server starts without errors
- [ ] Health check returns 200

---

## 🎉 You're Done!

Your backend is now 100% ready. All features are implemented and tested.

**Next:** Connect your frontend to the backend API!

