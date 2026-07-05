import { Paperclip } from 'lucide-react'
import { isImageAttachment } from './messageAttachmentUpload'

interface MessageAttachmentDisplayProps {
  url: string
  name?: string | null
  mime?: string | null
}

export default function MessageAttachmentDisplay({ url, name, mime }: MessageAttachmentDisplayProps) {
  const label = name || 'Attachment'
  if (isImageAttachment(mime, url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img src={url} alt={label} className="max-w-full max-h-48 rounded-md border border-black/10" />
      </a>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold underline underline-offset-2"
    >
      <Paperclip className="w-3.5 h-3.5" />
      {label}
    </a>
  )
}
