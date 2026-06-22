import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { notesApi, type Note } from '../../../utils/adminFeaturesApi'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function MemberStaffNotesTab({ memberId }: { memberId: number }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await notesApi.list('member', memberId, 'staff_note')
      setNotes(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    void load()
  }, [load])

  const addNote = async () => {
    const body = draft.trim()
    if (!body) return
    setAdding(true)
    setError(null)
    try {
      const created = await notesApi.add({
        subjectType: 'member',
        subjectId: memberId,
        noteType: 'staff_note',
        body,
      })
      setNotes((prev) => [created, ...prev])
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note')
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading notes…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-gray-900">Staff notes — follow-up &amp; conversations</h4>
        <p className="text-xs text-gray-500 mt-1">Add-only. Each note is dated and attributed.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
      )}

      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Add a note…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void addNote()}
          disabled={adding || !draft.trim()}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold self-start disabled:opacity-50"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add note
        </button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-sm text-gray-400">No staff notes yet.</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="border border-gray-200 rounded-lg p-3 bg-white">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.body}</p>
              <p className="text-xs text-gray-500 mt-1">
                {note.authorName || 'Staff'} · {formatDate(note.createdAt)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
