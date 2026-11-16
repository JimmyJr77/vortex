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
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1.5 block w-fit max-w-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vortex-red">
        <img src={url} alt={label} className="max-h-56 max-w-full rounded-xl border border-slate-200 object-contain" />
      </a>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vortex-red"
    >
      <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
    </a>
  )
}
