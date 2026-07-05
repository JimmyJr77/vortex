import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import {
  MESSAGE_ATTACHMENT_ACCEPT,
  uploadMessageAttachment,
  type MessagePortal,
} from './messageAttachmentUpload'
import type { MessageThread } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface FileUploadComposeModalProps {
  open: boolean
  onClose: () => void
  portal: MessagePortal
  fetcher: Fetcher
  threads: MessageThread[]
  onUploaded: (threadId: number) => void
}

export default function FileUploadComposeModal({
  open,
  onClose,
  portal,
  fetcher,
  threads,
  onUploaded,
}: FileUploadComposeModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [threadId, setThreadId] = useState<number | null>(null)
  const [body, setBody] = useState('')
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return threads
      .filter((t) => t.id > 0 && !t.is_calendar_inbox_row && !t.is_schedule_inbox_row)
      .filter((t) => !q || (t.subject || '').toLowerCase().includes(q))
  }, [threads, query])

  useEffect(() => {
    if (!open) return
    setFile(null)
    setBody('')
    setQuery('')
    setError(null)
    setThreadId(candidates[0]?.id ?? null)
  }, [open, candidates])

  if (!open) return null

  const sendPath = `/api/${portal}/messages/${threadId}`

  const handleUpload = async () => {
    if (!file || threadId == null) return
    setSaving(true)
    setError(null)
    try {
      const attachment = await uploadMessageAttachment(file, portal, fetcher)
      await fetcher(sendPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim() || `Attached ${file.name}`,
          attachment_url: attachment.attachment_url,
          attachment_name: attachment.attachment_name,
          attachment_mime: attachment.attachment_mime,
        }),
      })
      onUploaded(threadId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">Add a file</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        {error && <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <input
          type="file"
          accept={MESSAGE_ATTACHMENT_ACCEPT}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search threads…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={threadId ?? ''}
          onChange={(e) => setThreadId(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {candidates.map((t) => (
            <option key={t.id} value={t.id}>{t.subject || `Thread ${t.id}`}</option>
          ))}
        </select>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Optional message…"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !file || threadId == null}
            onClick={() => void handleUpload()}
            className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg font-semibold disabled:opacity-60"
          >
            {saving ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}
