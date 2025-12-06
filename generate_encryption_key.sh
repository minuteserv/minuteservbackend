#!/bin/bash

# Generate Encryption Key Script
# This script generates a secure 32-byte encryption key for credentials management

echo "🔐 Generating CREDENTIALS_ENCRYPTION_KEY..."
echo ""

# Generate the key
KEY=$(openssl rand -hex 32)

echo "Generated Key:"
echo "$KEY"
echo ""
echo "✅ Add this to your .env file:"
echo "CREDENTIALS_ENCRYPTION_KEY=$KEY"
echo ""
echo "⚠️  IMPORTANT:"
echo "  - Keep this key secure!"
echo "  - Never commit it to version control"
echo "  - If lost, encrypted credentials cannot be recovered"
echo "  - Use different keys for development and production"

