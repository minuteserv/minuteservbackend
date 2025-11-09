# 🔑 Get Service Role Key for Backend

## ⚠️ Important Notice

You provided the **ANON key**, but the **backend requires the SERVICE_ROLE key** for server-side operations.

---

## 📋 How to Get Service Role Key

### Step 1: Go to Supabase Dashboard
Visit: **https://app.supabase.com/project/vebpynukjfxlwnipuanp/settings/api**

Or:
1. Go to https://app.supabase.com
2. Select your project: `vebpynukjfxlwnipuanp`
3. Click **Settings** (⚙️ icon) in left sidebar
4. Click **API** in settings menu

### Step 2: Find Project API Keys
Scroll down to the **"Project API keys"** section.

You'll see two keys:
- **`anon` `public`** - This is what you provided (for frontend/client-side)
- **`service_role` `secret`** - This is what you need (for backend/server-side)

### Step 3: Copy Service Role Key
1. Click the **👁️ eye icon** next to `service_role` key to reveal it
2. Click **Copy** button
3. Replace `SUPABASE_SERVICE_ROLE_KEY` in `.env` file

---

## 🔄 Update .env File

**Path:** `/Users/user/Desktop/MinServe/minuteservbackend/.env`

**Current (has anon key - won't work for backend):**
```env
SUPABASE_URL=https://vebpynukjfxlwnipuanp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlYnB5bnVramZ4bHduaXB1YW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxOTkwNjgsImV4cCI6MjA3Nzc3NTA2OH0.nrrPhgWms8MbJDpWV9DajfIIpiuQYwzAX49_PX9AJEQ
```

**Update to (with service_role key):**
```env
SUPABASE_URL=https://vebpynukjfxlwnipuanp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlYnB5bnVramZ4bHduaXB1YW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjE5OTA2OCwiZXhwIjoyMDc3Nzc1MDY4fQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Note:** The service_role key will have `"role":"service_role"` in the JWT payload (you can decode it at jwt.io to verify).

---

## 🔍 Why Service Role Key?

- **Anon Key:** Subject to Row Level Security (RLS) policies, limited permissions
- **Service Role Key:** Bypasses RLS, full database access (required for backend operations)

**⚠️ Security:** Never expose service_role key in frontend code! It's only for backend.

---

## ✅ After Updating

Test the connection:
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend
npm run test-db
```

Expected output:
```
✅ Connection successful
✅ All 10 tables exist
```

---

## 🎯 Quick Fix Command

After copying service_role key, run:
```bash
cd /Users/user/Desktop/MinServe/minuteservbackend
# Edit .env and replace SUPABASE_SERVICE_ROLE_KEY value
npm run test-db
```

