# 🚀 Quick Start Guide - 5 Minutes Setup

## Step-by-Step Setup (100% Complete)

### 1️⃣ Install Dependencies
```bash
cd minuteservbackend
npm install
```

### 2️⃣ Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- Supabase URL & Service Role Key
- Razorpay Key ID & Secret
- JWT Secret (generate random string)

### 3️⃣ Setup Database in Supabase

**A. Open Supabase SQL Editor:**
1. Go to https://app.supabase.com
2. Select your project
3. Click "SQL Editor" → "New Query"

**B. Run Database Schema:**
1. Open `src/config/database.sql`
2. Copy **ALL** content
3. Paste in Supabase SQL Editor
4. Click **"Run"**
5. Wait for: `✅ Database schema created successfully!`

### 4️⃣ Run Setup Script
```bash
npm run setup
```

This will:
- ✅ Test database connection
- ✅ Seed all services from JSON
- ✅ Create admin user

### 5️⃣ Start Server
```bash
npm run dev
```

You should see:
```
✅ Supabase connection successful
🚀 Minuteserv API Server running on port 3000
```

### 6️⃣ Test API
```bash
# Health check
curl http://localhost:3000/health

# Send OTP (check console for OTP in dev mode)
curl -X POST http://localhost:3000/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+911234567890"}'
```

---

## ✅ Verification Checklist

- [ ] `npm install` completed
- [ ] `.env` file configured
- [ ] Database tables created (10 tables)
- [ ] Services seeded (check with: `SELECT COUNT(*) FROM services;`)
- [ ] Admin user created
- [ ] Server starts without errors
- [ ] Health check returns 200

---

## 🎯 That's It!

Your backend is now **100% ready** with:
- ✅ Complete database
- ✅ All API endpoints
- ✅ Payment integration
- ✅ Booking system
- ✅ Admin panel

**Next:** Connect your frontend!

---

## 📚 Additional Commands

```bash
# Test database connection
npm run test-db

# Seed services manually
npm run seed-services

# Create admin user
npm run create-admin admin@example.com password123

# Start production server
npm start
```

---

**Status: ✅ Ready for Production**

