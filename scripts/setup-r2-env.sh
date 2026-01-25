#!/bin/bash

# Setup script for R2 environment variables
# This creates a .env.local file with your R2 credentials

echo "🔧 Setting up R2 environment variables..."

# Your R2 credentials (from the information provided)
R2_ACCOUNT_ID="2ba521e445c47efaa275b65fc9d1a196"
R2_ENDPOINT="https://2ba521e445c47efaa275b65fc9d1a196.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="d7bae3a9f7b2dfc5ba2726ba68049bac"
R2_SECRET_ACCESS_KEY="fcaebaa6c223aba359176cdc3c8504916a855aea4339a030bcb7673c9c00fa12"

# Bucket name (you specified it's called "videos")
R2_BUCKET="videos"

# Prompt for CDN base URL (optional)
read -p "Enter your CDN base URL (e.g., 'https://cdn.example.com/videos') or press Enter to skip: " CDN_BASE_URL

# Create .env.local file
cat > .env.local << EOF
# R2 Credentials for upload script
R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
R2_ENDPOINT=${R2_ENDPOINT}
R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
R2_BUCKET=${R2_BUCKET}
${CDN_BASE_URL:+CDN_BASE_URL=${CDN_BASE_URL}}

# Frontend CDN URL (for Vite)
VITE_CDN_BASE_URL=${CDN_BASE_URL:-}
EOF

echo "✅ Created .env.local file"
echo ""
echo "⚠️  SECURITY WARNING:"
echo "   - .env.local contains sensitive credentials"
echo "   - Make sure .env.local is in your .gitignore"
echo "   - Never commit this file to git"
echo ""
echo "📝 Next steps:"
echo "   1. Ensure R2 bucket named '${R2_BUCKET}' exists in Cloudflare dashboard"
echo "   2. Configure custom domain (e.g., cdn.example.com) - see docs/r2-cdn-setup.md"
echo "   3. Install AWS SDK: npm install --save-dev @aws-sdk/client-s3"
echo "   4. Run: node scripts/upload-videos-to-r2.js"
echo "   5. Set VITE_CDN_BASE_URL in Vercel environment variables (e.g., https://cdn.example.com/videos)"

