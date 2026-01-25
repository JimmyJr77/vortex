#!/usr/bin/env node

/**
 * Upload videos to Cloudflare R2
 * 
 * This script uploads video files and poster images to Cloudflare R2 bucket.
 * It requires AWS SDK v3 (S3-compatible) and R2 credentials.
 * 
 * Usage:
 *   node scripts/upload-videos-to-r2.js
 * 
 * Environment variables can be set in:
 *   - .env.local file (for local development)
 *   - Environment variables (for CI/CD)
 * 
 * Required environment variables:
 *   - R2_ACCOUNT_ID: Cloudflare account ID
 *   - R2_ACCESS_KEY_ID: R2 access key ID
 *   - R2_SECRET_ACCESS_KEY: R2 secret access key
 *   - R2_BUCKET: R2 bucket name
 *   - R2_ENDPOINT: R2 endpoint URL (e.g., https://<account-id>.r2.cloudflarestorage.com)
 *   - CDN_BASE_URL: (optional) CDN base URL for verification
 * 
 * Optional: Set VERSION environment variable for versioned filenames
 * 
 * Quick setup:
 *   1. Run: ./scripts/setup-r2-env.sh (or create .env.local manually)
 *   2. Install: npm install --save-dev @aws-sdk/client-s3
 *   3. Run: node scripts/upload-videos-to-r2.js
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Try to load .env.local if dotenv is available
// Note: If dotenv is not installed, set environment variables directly or use the setup script
async function loadEnv() {
  try {
    const dotenv = await import('dotenv')
    // Try .env.local first, then .env
    if (existsSync('.env.local')) {
      dotenv.config({ path: '.env.local' })
      console.log('✅ Loaded .env.local')
    } else if (existsSync('.env')) {
      dotenv.config({ path: '.env' })
      console.log('✅ Loaded .env')
    }
  } catch (error) {
    // dotenv not installed, that's okay - use environment variables directly
    // Users can set env vars manually or use the setup script
  }
}

// Load environment variables before proceeding
await loadEnv()

// Get environment variables
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET = process.env.R2_BUCKET
const R2_ENDPOINT = process.env.R2_ENDPOINT
const CDN_BASE_URL = process.env.CDN_BASE_URL
const VERSION = process.env.VERSION // Optional version for immutable caching

// Validate required environment variables
const requiredEnvVars = {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_ENDPOINT,
}

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key)

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:')
  missingVars.forEach((varName) => console.error(`   - ${varName}`))
  console.error('\nPlease set these in your .env file or environment.')
  process.exit(1)
}

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

// Files to upload
// Note: Bucket name is "videos", files are organized in a "videos/" prefix for CDN structure
// This allows CDN URLs like: https://cdn.example.com/videos/landing_page_hero.mp4
const filesToUpload = [
  {
    localPath: join(__dirname, '..', 'public', 'landing_page_hero.mp4'),
    remotePath: 'videos/landing_page_hero.mp4', // Organized in videos/ prefix
    contentType: 'video/mp4',
    description: 'Hero background video',
  },
  {
    localPath: join(__dirname, '..', 'public', 'vald_sprints.mp4'),
    remotePath: 'videos/vald_sprints.mp4', // Organized in videos/ prefix
    contentType: 'video/mp4',
    description: 'Vald sprints video',
  },
  // Optional poster image
  {
    localPath: join(__dirname, '..', 'public', 'landing_page_hero.webp'),
    remotePath: 'videos/landing_page_hero.webp', // Organized in videos/ prefix
    contentType: 'image/webp',
    description: 'Hero poster image (WebP)',
    optional: true,
  },
  {
    localPath: join(__dirname, '..', 'public', 'landing_page_hero.jpg'),
    remotePath: 'videos/landing_page_hero.jpg', // Organized in videos/ prefix
    contentType: 'image/jpeg',
    description: 'Hero poster image (JPEG)',
    optional: true,
  },
  {
    localPath: join(__dirname, '..', 'public', 'landing_page_hero.png'),
    remotePath: 'videos/landing_page_hero.png', // Organized in videos/ prefix
    contentType: 'image/png',
    description: 'Hero poster image (PNG)',
    optional: true,
  },
]

/**
 * Determine Cache-Control header based on versioning strategy
 */
function getCacheControl() {
  if (VERSION) {
    // Versioned files can be cached for 1 year (immutable)
    return 'public, max-age=31536000, immutable'
  } else {
    // Non-versioned files: 1 day cache (allows faster updates)
    return 'public, max-age=86400'
  }
}

/**
 * Upload a file to R2
 */
async function uploadFile(fileConfig) {
  const { localPath, remotePath, contentType, description, optional } = fileConfig

  // Check if file exists
  if (!existsSync(localPath)) {
    if (optional) {
      console.log(`⏭️  Skipping optional file: ${description}`)
      return { skipped: true }
    } else {
      console.error(`❌ File not found: ${localPath}`)
      return { error: 'File not found' }
    }
  }

  try {
    // Read file
    const fileContent = readFileSync(localPath)
    const fileSize = fileContent.length
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2)

    console.log(`\n📤 Uploading: ${description}`)
    console.log(`   Local: ${localPath}`)
    console.log(`   Remote: ${remotePath}`)
    console.log(`   Size: ${fileSizeMB} MB`)

    // Check if file already exists
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: R2_BUCKET,
          Key: remotePath,
        })
      )
      console.log(`   ⚠️  File already exists. Overwriting...`)
    } catch (error) {
      if (error.name !== 'NotFound') {
        throw error
      }
      // File doesn't exist, which is fine
    }

    // Upload file
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: remotePath,
      Body: fileContent,
      ContentType: contentType,
      CacheControl: getCacheControl(),
      // Enable CORS and Range requests
      Metadata: {
        'x-amz-acl': 'public-read', // Not used by R2, but good documentation
      },
    })

    await s3Client.send(command)

    console.log(`   ✅ Uploaded successfully`)

    // Verify CDN URL if provided
    if (CDN_BASE_URL) {
      const cdnUrl = `${CDN_BASE_URL}/${remotePath}`
      console.log(`   🔗 CDN URL: ${cdnUrl}`)
    }

    return { success: true }
  } catch (error) {
    console.error(`   ❌ Upload failed:`, error.message)
    return { error: error.message }
  }
}

/**
 * Main upload function
 */
async function main() {
  console.log('🚀 Starting R2 upload...')
  console.log(`   Bucket: ${R2_BUCKET}`)
  console.log(`   Endpoint: ${R2_ENDPOINT}`)
  if (VERSION) {
    console.log(`   Version: ${VERSION} (immutable caching)`)
  } else {
    console.log(`   Cache: 1 day (non-versioned)`)
  }
  if (CDN_BASE_URL) {
    console.log(`   CDN Base: ${CDN_BASE_URL}`)
  }

  const results = []

  for (const fileConfig of filesToUpload) {
    const result = await uploadFile(fileConfig)
    results.push({ ...fileConfig, ...result })
  }

  // Summary
  console.log('\n📊 Upload Summary:')
  const successful = results.filter((r) => r.success).length
  const skipped = results.filter((r) => r.skipped).length
  const errors = results.filter((r) => r.error).length

  console.log(`   ✅ Successful: ${successful}`)
  if (skipped > 0) {
    console.log(`   ⏭️  Skipped: ${skipped}`)
  }
  if (errors > 0) {
    console.log(`   ❌ Errors: ${errors}`)
  }

  if (errors > 0) {
    console.error('\n❌ Some uploads failed. Please check the errors above.')
    process.exit(1)
  } else {
    console.log('\n✅ All uploads completed successfully!')
    console.log('\n📝 Next steps:')
    console.log('   1. Verify files in Cloudflare R2 dashboard')
    if (CDN_BASE_URL) {
      console.log(`   2. Test CDN URLs (e.g., ${CDN_BASE_URL}/videos/landing_page_hero.mp4)`)
    }
    console.log('   3. Update VITE_CDN_BASE_URL in Vercel environment variables')
    console.log('   4. Deploy and verify videos load from CDN')
  }
}

// Run main function
main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

