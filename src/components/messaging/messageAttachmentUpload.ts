export type MessagePortal = 'coach' | 'member' | 'admin'

export interface UploadedAttachment {
  attachment_url: string
  attachment_name: string
  attachment_mime: string | null
}

export interface MessageUploadStatus {
  configured: boolean
  message?: string
}

export const MESSAGE_ATTACHMENT_ACCEPT = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt'
export const MESSAGE_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024

const UPLOAD_PATH: Record<MessagePortal, string> = {
  coach: '/api/coach/messages/upload-attachment',
  member: '/api/member/messages/upload-attachment',
  admin: '/api/admin/messages/upload-attachment',
}

const STATUS_PATH: Record<MessagePortal, string> = {
  coach: '/api/coach/messages/upload-signature',
  member: '/api/member/messages/upload-signature',
  admin: '/api/admin/messages/upload-signature',
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Could not read file.'))
        return
      }
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Could not read file.'))
    reader.readAsDataURL(file)
  })
}

export async function fetchMessageUploadStatus(
  portal: MessagePortal,
  fetcher: (endpoint: string, options?: RequestInit) => Promise<unknown>,
): Promise<MessageUploadStatus> {
  const status = await fetcher(STATUS_PATH[portal]) as MessageUploadStatus
  return {
    configured: Boolean(status?.configured),
    message: status?.message,
  }
}

export async function uploadMessageAttachment(
  file: File,
  portal: MessagePortal,
  fetcher: (endpoint: string, options?: RequestInit) => Promise<unknown>,
): Promise<UploadedAttachment> {
  if (file.size > MESSAGE_ATTACHMENT_MAX_BYTES) {
    throw new Error('File must be 8MB or smaller.')
  }
  const dataBase64 = await fileToBase64(file)
  return fetcher(UPLOAD_PATH[portal], {
    method: 'POST',
    body: JSON.stringify({
      dataBase64,
      fileName: file.name,
      mimeType: file.type || null,
    }),
  }) as Promise<UploadedAttachment>
}

export function isImageAttachment(mime?: string | null, url?: string | null) {
  if (mime?.startsWith('image/')) return true
  return Boolean(url && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url))
}
