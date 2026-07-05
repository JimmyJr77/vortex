import crypto from 'crypto'

export function cloudinaryMessageAttachmentSignature() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) return { configured: false }
  const timestamp = Math.floor(Date.now() / 1000)
  const folder = 'coaching/message-attachments'
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

export function parseMessageAttachmentPayload(body) {
  const url = body?.attachment_url ? String(body.attachment_url).trim() : null
  if (!url) return null
  return {
    url,
    name: body?.attachment_name ? String(body.attachment_name).trim() || 'Attachment' : 'Attachment',
    mime: body?.attachment_mime ? String(body.attachment_mime).trim() : null,
  }
}

export function messageHasContent(body, attachment) {
  return Boolean(String(body || '').trim() || attachment?.url)
}
