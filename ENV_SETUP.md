# 🔐 Environment Variables Setup Guide

## ❌ Error Fix: Missing Supabase Configuration

You're getting this error because the `.env` file is missing. Follow these steps:

---

## 📋 Step-by-Step Setup

### Step 1: Get Supabase Credentials

1. **Go to Supabase Dashboard:**
   - Visit: https://app.supabase.com
   - Select your project (or create one if you haven't)

2. **Get Project URL:**
   - Go to **Settings** → **API**
   - Copy the **Project URL** (looks like: `https://xxxxx.supabase.co`)

3. **Get Service Role Key:**
   - In the same **Settings** → **API** page
   - Scroll down to **Project API keys**
   - Copy the **`service_role`** key (NOT the `anon` key!)
   - ⚠️ **Important:** This key bypasses Row Level Security - keep it secret!

---

### Step 2: Create `.env` File

**Path:** `/Users/user/Desktop/MinServe/minuteservbackend/.env`

**Option A: Copy from template (Recommended)**
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend
cp .env.example .env
```

**Option B: Create manually**
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend
touch .env
```

---

### Step 3: Fill in Supabase Credentials

Open `.env` file and add:

```env
# REQUIRED - Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional - JWT Secret (generate random string)
JWT_SECRET=your-random-secret-key-here

# Optional - Server Config
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Replace:**
- `https://your-project-id.supabase.co` → Your actual Supabase Project URL
- `your-service-role-key-here` → Your actual service_role key

---

### Step 4: Generate JWT Secret (Optional but Recommended)

Generate a random secret for JWT:

```bash
openssl rand -base64 32
```

Copy the output and paste it as `JWT_SECRET` in `.env`

---

## ✅ Minimal `.env` File (Minimum Required)

If you just want to get started quickly, create `.env` with only these:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

---

## 📝 Complete `.env` File Example

Here's a complete example with all optional variables:

```env
# Supabase (REQUIRED)
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjM5MDIyfQ.abcdefghijklmnopqrstuvwxyz1234567890

# JWT (Recommended)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Razorpay (Optional - only if using payments)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# Server (Optional)
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

---

## 🧪 Test Your Setup

After creating `.env`, test it:

```bash
cd /Users/user/Desktop/MinServe/minuteservbackend
npm run test-db
```

**Expected output:**
```
✅ Connection successful
✅ All 10 tables exist
```

---

## 🔍 Where to Find Supabase Credentials

### Visual Guide:

1. **Login to Supabase:** https://app.supabase.com
2. **Select Project:** Click on your project
3. **Settings Icon:** Click ⚙️ (gear icon) in left sidebar
4. **API Section:** Click "API" in settings menu
5. **Copy Values:**
   - **Project URL:** Top section "Project URL"
   - **Service Role Key:** Scroll to "Project API keys" → Copy `service_role` key

---

## ⚠️ Important Notes

1. **Never commit `.env` to git** - It's already in `.gitignore`
2. **Service Role Key is powerful** - It bypasses Row Level Security
3. **Keep keys secret** - Don't share in screenshots or public repos
4. **Use different keys for production** - Don't use dev keys in production

---

## 🚀 Quick Start Commands

After creating `.env`:

```bash
cd /Users/user/Desktop/MinServe/minuteservbackend

# Test connection
npm run test-db

# Seed services
npm run seed-services

# Create admin
npm run create-admin admin@minuteserv.com "YourPassword" "Admin Name"

# Start server
npm run dev
```

---

## ❓ Troubleshooting

**Error: "Missing Supabase configuration"**
- ✅ Check `.env` file exists in `/Users/user/Desktop/MinServe/minuteservbackend/`
- ✅ Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- ✅ No spaces around `=` sign
- ✅ No quotes around values (unless needed)

**Error: "Invalid API key"**
- ✅ Make sure you copied the **service_role** key, not the **anon** key
- ✅ Check for extra spaces or line breaks
- ✅ Key should start with `eyJ...`

**Error: "Connection failed"**
- ✅ Check your Supabase project is active
- ✅ Verify Project URL is correct
- ✅ Make sure database tables are created (run `database.sql`)

---

**✅ Once `.env` is configured, you can run all the setup commands!**

