#!/bin/bash

# Minuteserv Backend - Complete Setup Commands
# Run these commands in order after database.sql is executed

echo "🚀 Starting Backend Setup..."
echo ""

# Navigate to backend directory
cd /Users/user/Desktop/MinServe/minuteservbackend

echo "📦 Step 1: Seeding services from JSON..."
npm run seed-services

echo ""
echo "👤 Step 2: Creating admin user..."
echo "⚠️  IMPORTANT: Replace 'your-secure-password' with actual password!"
npm run create-admin admin@minuteserv.com your-secure-password "Admin User"

echo ""
echo "🧪 Step 3: Testing database connection..."
npm run test-db

echo ""
echo "🚀 Step 4: Starting development server..."
echo "   (Server will run in foreground - press Ctrl+C to stop)"
npm run dev
