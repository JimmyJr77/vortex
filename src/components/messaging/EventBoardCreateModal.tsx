import { useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  fetchHighlightEvents,
  provisionAdditionalEventBoard,
  provisionEventMessageThreads,
  type HighlightEventOption,
} from './messagingApi'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface EventBoardCreateModalProps {
  open: boolean
  onClose: () => void
  fetcher: Fetcher
  onCreated: (threadId: number) => void
  allowAdditionalBoard?: boolean
}

export default function EventBoardCreateModal({
  open,
  onClose,
  fetcher,
  onCreated,
  allowAdditionalBoard = true,
}: EventBoardCreateModalProps) {
  const [events, setEvents] = useState<HighlightEventOption[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [subject, setSubject] = useState('')
  const [createAdditional, setCreateAdditional] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    void fetchHighlightEvents('admin', fetcher)
      .then((rows) => {
        setEvents(rows)
        setSelectedId(rows[0]?.id != null ? Number(rows[0].id) : null)
      })
      .catch((err) => {
        setEvents([])
        setError(err instanceof Error ? err.message : 'Could not load events')
      })
      .finally(() => setLoading(false))
  }, [open, fetcher])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return events
    return events.filter((e) => {
      const name = String(e.event_name ?? e.eventName ?? '').toLowerCase()
      return name.includes(q)
    })
  }, [events, query])

  if (!open) return null

  const handleCreate = async () => {
    if (selectedId == null) return
    setSaving(true)
    setError(null)
    try {
      if (createAdditional && allowAdditionalBoard) {
        const result = await provisionAdditionalEventBoard(selectedId, fetcher, {
          subject: subject.trim() || undefined,
        })
        const threadId = result.discussion?.id
        if (threadId == null) throw new Error('Could not create event board')
        onCreated(threadId)
      } else {
        const result = await provisionEventMessageThreads(selectedId, fetcher, {
          subject: subject.trim() || undefined,
        }) as { discussion?: { id: number }; canonical?: { id: number } }
        const threadId = result.discussion?.id ?? result.canonical?.id
        if (threadId == null) throw new Error('Could not create event board')
        onCreated(threadId)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create event board')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">New event board</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        {error && <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading events…
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
            {filtered.map((event) => {
              const id = Number(event.id)
              const name = event.event_name ?? event.eventName ?? `Event ${id}`
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedId(id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                    selectedId === id ? 'bg-red-50 text-vortex-red font-semibold' : ''
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        )}
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Board title (optional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        {allowAdditionalBoard && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={createAdditional}
              onChange={(e) => setCreateAdditional(e.target.checked)}
            />
            Add another board (event already has a chat)
          </label>
        )}
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
            {saving ? 'Creating…' : 'Create board'}
          </button>
        </div>
      </div>
    </div>
  )
}
