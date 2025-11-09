# 📋 Commands with Full Paths

## ✅ Database Setup Complete!

You've successfully run the database schema. Now execute these commands:

---

## Commands (Run in Terminal)

### 1️⃣ Seed Services Data

**Full Path:**
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend && npm run seed-services
```

**What it does:**
- Reads `../src/data/services.json`
- Inserts all services into database
- Skips duplicates and services without productCost

**Expected output:**
```
✅ Services JSON loaded
📦 Found X services to seed
✅ Services seeded: X inserted, Y skipped
```

---

### 2️⃣ Create Admin User

**Full Path:**
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend && npm run create-admin admin@minuteserv.com "YourSecurePassword123" "Admin Name"
```

**⚠️ Replace "YourSecurePassword123" with your actual password!**

**Example:**
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend && npm run create-admin admin@minuteserv.com MyPassword123 "Admin User"
```

**What it does:**
- Creates/updates admin user
- Hashes password securely
- Sets role to super_admin

**Expected output:**
```
✅ Admin user ready!
   Email: admin@minuteserv.com
   Role: super_admin
   ID: uuid-here
```

---

### 3️⃣ Test Database Connection

**Full Path:**
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend && npm run test-db
```

**What it does:**
- Tests Supabase connection
- Verifies all tables exist
- Checks seed data

**Expected output:**
```
✅ Connection successful
✅ All 10 tables exist
✅ Promo codes found (3)
✅ Admin user found (1)
✅ Services count: X
```

---

### 4️⃣ Start Development Server

**Full Path:**
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend && npm run dev
```

**What it does:**
- Starts Express server
- Listens on port 3000
- Auto-reloads on changes

**Expected output:**
```
✅ Supabase connection successful
🚀 Minuteserv API Server running on port 3000
📝 Environment: development
🌐 Health check: http://localhost:3000/health
```

**Keep this terminal open** - server runs in foreground.

---

## 🎯 Complete Sequence (Copy & Paste)

```bash
# Navigate to backend
cd /Users/user/Desktop/MinServe/minuteservbackend

# Seed services
npm run seed-services

# Create admin (CHANGE PASSWORD!)
npm run create-admin admin@minuteserv.com YourPassword123 "Admin User"

# Test database
npm run test-db

# Start server (runs in foreground)
npm run dev
```

---

## 🧪 Test API (In New Terminal)

Once server is running, open a **new terminal** and test:

```bash
# Health check
curl http://localhost:3000/health

# Should return:
# {"status":"ok","timestamp":"...","service":"Minuteserv API"}
```

---

## 📝 Notes

1. **Seed Services:** This reads from `../src/data/services.json` and inserts all services
2. **Create Admin:** Password is hashed with bcrypt - use a strong password!
3. **Test DB:** Verifies everything is working correctly
4. **Start Server:** Runs in foreground - press `Ctrl+C` to stop

---

## ✅ Verification

After all commands:

1. Check Supabase Table Editor:
   - `services` table should have many rows
   - `admin_users` table should have 1 user
   - `promo_codes` table should have 3 codes

2. Check server logs:
   - Should show "✅ Supabase connection successful"
   - No error messages

3. Test health endpoint:
   - `curl http://localhost:3000/health` should return 200

---

**🎉 Your backend is now 100% ready!**

