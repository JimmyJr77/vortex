import { FileText, Image as ImageIcon, Paperclip } from 'lucide-react'
import type { MessageFile } from './types'

interface MessagingFileChipProps {
  file: MessageFile
  compact?: boolean
}

function fileIcon(mime?: string | null) {
  if (mime?.startsWith('image/')) return ImageIcon
  if (mime?.includes('pdf') || mime?.includes('document') || mime?.includes('text')) return FileText
  return Paperclip
}

function formatSize(bytes?: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes)) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MessagingFileChip({ file, compact = false }: MessagingFileChipProps) {
  const Icon = fileIcon(file.mime)
  const sizeLabel = formatSize(file.size_bytes)

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 max-w-full rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 ${
        compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'
      }`}
    >
      <Icon className={`shrink-0 text-gray-500 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} aria-hidden />
      <span className="truncate font-medium">{file.name}</span>
      {sizeLabel && <span className="shrink-0 text-gray-400 text-[10px]">{sizeLabel}</span>}
      {file.tag_slug && (
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-400">{file.tag_slug}</span>
      )}
    </a>
  )
}
