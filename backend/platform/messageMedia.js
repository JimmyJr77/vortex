import crypto from 'crypto'
import { v2 as cloudinary } from 'cloudinary'
import {
  messageHasContent,
  normalizeMessageBodyForInsert,
  parseMessageAttachmentPayload,
} from './messageContent.js'

export { messageHasContent, normalizeMessageBodyForInsert, parseMessageAttachmentPayload } from './messageContent.js'

const MESSAGE_ATTACHMENT_FOLDER = 'coaching/message-attachments'
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET,
  )
}

function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
}

export function cloudinaryMessageAttachmentSignature() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    return {
      configured: false,
      message:
        'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the backend service.',
    }
  }
  const timestamp = Math.floor(Date.now() / 1000)
  const folder = MESSAGE_ATTACHMENT_FOLDER
  const toSign = `folder=${folder}&timestamp=${timestamp}`
  const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex')
  return {
    configured: true,
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
  }
}

export async function uploadMessageAttachmentFromBase64({ dataBase64, fileName, mimeType }) {
  if (!isCloudinaryConfigured()) {
    const err = new Error('File upload is not configured on the server.')
    err.code = 'CLOUDINARY_NOT_CONFIGURED'
    throw err
  }
  const buffer = Buffer.from(String(dataBase64), 'base64')
  if (!buffer.length) {
    const err = new Error('Empty file upload.')
    err.code = 'INVALID_FILE'
    throw err
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    const err = new Error('File must be 8MB or smaller.')
    err.code = 'FILE_TOO_LARGE'
    throw err
  }

  configureCloudinary()
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: MESSAGE_ATTACHMENT_FOLDER, resource_type: 'auto' },
      (error, uploadResult) => {
        if (error) reject(error)
        else resolve(uploadResult)
      },
    )
    stream.end(buffer)
  })

  return {
    attachment_url: result.secure_url,
    attachment_name: String(fileName).trim() || 'Attachment',
    attachment_mime: mimeType ? String(mimeType).trim() : null,
  }
}

