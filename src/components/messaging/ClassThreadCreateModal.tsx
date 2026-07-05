import { useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { createClassMessageThread, fetchClassMessageOptions, type ClassMessageOption } from './messagingApi'
import type { MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface ClassThreadCreateModalProps {
  open: boolean
  onClose: () => void
  role: MessagingRole
  fetcher: Fetcher
  onCreated: (threadId: number) => void
}

export default function ClassThreadCreateModal({
  open,
  onClose,
  role,
  fetcher,
  onCreated,
}: ClassThreadCreateModalProps) {
  const [options, setOptions] = useState<ClassMessageOption[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [subject, setSubject] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    void fetchClassMessageOptions(role, fetcher)
      .then((rows) => {
        setOptions(rows)
        setSelectedId(rows[0]?.id ?? null)
      })
      .catch((err) => {
        setOptions([])
        setError(err instanceof Error ? err.message : 'Could not load classes')
      })
      .finally(() => setLoading(false))
  }, [open, role, fetcher])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.name.toLowerCase().includes(q))
  }, [options, query])

  if (!open) return null

  const handleCreate = async () => {
    if (selectedId == null) return
    setSaving(true)
    setError(null)
    try {
      const result = await createClassMessageThread(role, fetcher, {
        form_id: selectedId,
        subject: subject.trim() || null,
      })
      onCreated(result.thread_id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create class thread')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">New class thread</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Creates or opens a message thread for everyone enrolled in the selected class.
        </p>
        {error && <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search classes…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading classes…
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No classes found.</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedId(option.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                    selectedId === option.id ? 'bg-red-50 text-vortex-red font-semibold' : ''
                  }`}
                >
                  {option.is_assigned && (
                    <span className="text-[10px] uppercase tracking-wide text-teal-700 font-bold mr-1.5">Assigned</span>
                  )}
                  {option.name}
                  {option.member_count != null && (
                    <span className="text-gray-400 font-normal ml-1">({option.member_count})</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Thread name (optional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || selectedId == null}
            onClick={() => void handleCreate()}
            className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg font-semibold disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create thread'}
          </button>
        </div>
      </div>
    </div>
  )
}
