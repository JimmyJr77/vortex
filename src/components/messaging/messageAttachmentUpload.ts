export type MessagePortal = 'coach' | 'member' | 'admin'

export interface UploadedAttachment {
  attachment_url: string
  attachment_name: string
  attachment_mime: string | null
}

interface UploadSignature {
  configured: boolean
  uploadUrl?: string
  apiKey?: string
  timestamp?: number
  folder?: string
  signature?: string
  error?: { message?: string }
}

export const MESSAGE_ATTACHMENT_ACCEPT = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt'

export async function uploadMessageAttachment(
  file: File,
  fetchSignature: () => Promise<UploadSignature>,
): Promise<UploadedAttachment> {
  const sig = await fetchSignature()
  if (!sig.configured || !sig.uploadUrl) {
    throw new Error('File upload is not configured. Contact your administrator.')
  }
  const fd = new FormData()
  fd.append('file', file)
  fd.append('api_key', sig.apiKey!)
  fd.append('timestamp', String(sig.timestamp))
  fd.append('folder', sig.folder!)
  fd.append('signature', sig.signature!)
  const resp = await fetch(sig.uploadUrl, { method: 'POST', body: fd })
  const data = (await resp.json()) as { secure_url?: string; error?: { message?: string } }
  if (!data.secure_url) {
    throw new Error(data.error?.message || 'Upload failed.')
  }
  return {
    attachment_url: data.secure_url,
    attachment_name: file.name,
    attachment_mime: file.type || null,
  }
}

export function isImageAttachment(mime?: string | null, url?: string | null) {
  if (mime?.startsWith('image/')) return true
  return Boolean(url && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url))
}
