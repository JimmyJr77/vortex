import { useEffect, useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { schoolsApi, notesApi, type School, type Note } from '../utils/adminFeaturesApi'

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

const LEVEL_ORDER = ['high', 'middle', 'elementary', 'other']
const LEVEL_LABEL: Record<string, string> = {
  high: 'High Schools',
  middle: 'Middle Schools',
  elementary: 'Elementary Schools',
  other: 'Other',
}

export default function MemberSchoolsNotes({ memberId }: { memberId: number }) {
  const [allSchools, setAllSchools] = useState<School[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [writeIn, setWriteIn] = useState('')
  const [savingSchools, setSavingSchools] = useState(false)
  const [schoolsSaved, setSchoolsSaved] = useState(false)

  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [all, mine, noteList] = await Promise.all([
          schoolsApi.list({ active: true }),
          schoolsApi.forMember(memberId),
          notesApi.list('member', memberId, 'staff_note'),
        ])
        setAllSchools(all)
        setSelectedIds(new Set(mine.map((s) => s.id)))
        setNotes(noteList)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
  }, [memberId])

  const toggle = (id: number) => {
    setSchoolsSaved(false)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveSchools = async () => {
    try {
      setSavingSchools(true)
      setError(null)
      await schoolsApi.setForMember(memberId, [...selectedIds], writeIn.trim() || null)
      setWriteIn('')
      // reload to pick up any newly created write-in
      const [all, mine] = await Promise.all([schoolsApi.list({ active: true }), schoolsApi.forMember(memberId)])
      setAllSchools(all)
      setSelectedIds(new Set(mine.map((s) => s.id)))
      setSchoolsSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save schools')
    } finally {
      setSavingSchools(false)
    }
  }

  const addNote = async () => {
    if (!newNote.trim()) return
    try {
      setAddingNote(true)
      setError(null)
      const created = await notesApi.add({ subjectType: 'member', subjectId: memberId, noteType: 'staff_note', body: newNote.trim() })
      setNotes((prev) => [created, ...prev])
      setNewNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add note')
    } finally {
      setAddingNote(false)
    }
  }

  const byLevel = LEVEL_ORDER.map((lvl) => ({
    level: lvl,
    schools: allSchools.filter((s) => (s.level || 'other') === lvl),
  })).filter((g) => g.schools.length > 0)

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-3 py-2 rounded bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>
      )}

      {/* Schools */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-gray-800">Schools</h4>
          <button
            onClick={saveSchools}
            disabled={savingSchools}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-50"
          >
            {schoolsSaved ? <Check size={14} /> : null}
            {savingSchools ? 'Saving…' : schoolsSaved ? 'Saved' : 'Save schools'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">A student may be linked to more than one school.</p>
        <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-3">
          {byLevel.map((group) => (
            <div key={group.level}>
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">{LEVEL_LABEL[group.level]}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {group.schools.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 cursor-pointer text-sm">
                    <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggle(s.id)} />
                    <span className="text-gray-800">
                      {s.name}
                      {!s.isVerified && <span className="ml-1 text-amber-600 text-xs">(write-in)</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Other (type a school not listed)</label>
          <input
            value={writeIn}
            onChange={(e) => { setWriteIn(e.target.value); setSchoolsSaved(false) }}
            placeholder="School name…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Staff notes thread */}
      <div>
        <h4 className="font-semibold text-gray-800 mb-1">Staff notes — follow-up &amp; conversations</h4>
        <p className="text-xs text-gray-500 mb-2">Add-only. Each note is dated and attributed.</p>
        <div className="flex gap-2 mb-3">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
            placeholder="Add a note…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={addNote}
            disabled={addingNote || !newNote.trim()}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold self-start disabled:opacity-50"
          >
            <Plus size={14} /> Add
          </button>
        </div>
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="text-sm text-gray-400">No staff notes yet.</div>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{n.body}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {n.authorName || 'Staff'} · {formatDate(n.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
