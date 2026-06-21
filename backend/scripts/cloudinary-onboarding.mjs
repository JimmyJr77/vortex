/**
 * Cloudinary onboarding verification script.
 * Credentials are loaded from backend/.env.local (same vars as coachPortalRoutes).
 */
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { v2 as cloudinary } from 'cloudinary'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: join(root, '.env.local') })

const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

if (!cloudName || !apiKey || !apiSecret) {
  console.error('Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET in .env.local')
  process.exit(1)
}

cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true })

const DEMO_IMAGE_URL = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'

async function main() {
  console.log('Uploading demo image...')
  const upload = await cloudinary.uploader.upload(DEMO_IMAGE_URL, { folder: 'coaching/onboarding-test' })
  console.log('Secure URL:', upload.secure_url)
  console.log('Public ID:', upload.public_id)

  const details = await cloudinary.api.resource(upload.public_id)
  console.log('Width:', details.width)
  console.log('Height:', details.height)
  console.log('Format:', details.format)
  console.log('Bytes:', details.bytes)

  // f_auto: pick best format for the browser (e.g. WebP). q_auto: optimize quality/size.
  const transformedUrl = cloudinary.url(upload.public_id, {
    secure: true,
    transformation: [{ fetch_format: 'auto', quality: 'auto' }],
  })
  console.log('Done! Click link below to see optimized version of the image. Check the size and the format.')
  console.log(transformedUrl)
}

main().catch((err) => {
  console.error('Cloudinary onboarding failed:', err.message || err)
  process.exit(1)
})
