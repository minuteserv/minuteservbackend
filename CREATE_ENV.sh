#!/bin/bash

echo "🔐 Creating .env file for Minuteserv Backend"
echo ""

# Check if .env already exists
if [ -f .env ]; then
  echo "⚠️  .env file already exists!"
  read -p "Do you want to overwrite it? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled. Keeping existing .env"
    exit 1
  fi
fi

# Create .env from example
if [ -f .env.example ]; then
  cp .env.example .env
  echo "✅ Created .env from .env.example"
else
  # Create minimal .env
  cat > .env << 'ENVFILE'
# Supabase (REQUIRED - Fill these in!)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# JWT (Optional but recommended)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Server (Optional)
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ENVFILE
  echo "✅ Created minimal .env file"
fi

echo ""
echo "📝 Next steps:"
echo "   1. Open .env file"
echo "   2. Get Supabase credentials from: https://app.supabase.com"
echo "   3. Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
echo "   4. Generate JWT_SECRET: openssl rand -base64 32"
echo ""
echo "📖 See ENV_SETUP.md for detailed instructions"
