import { useState, type FormEvent } from 'react'
import { notesApi, type Note } from '../../utils/adminFeaturesApi'
import { useRead } from './api'
import { Empty, ErrorNotice, input, Loading, primary } from './shared'

const subjectLabels: Record<Note['subjectType'], string> = { family: 'Family', member: 'Member', registration: 'Inquiry' }

export default function AccountNotes({ endpoint, canManage, subjectType, subjectId, revision = 0 }: {
  endpoint: string; canManage: boolean; subjectType: 'family' | 'registration'; subjectId: number; revision?: number
}) {
  const [version, setVersion] = useState(0)
  const notes = useRead<Note[]>(endpoint, revision + version)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const refresh = () => setVersion(value => value + 1)
  const add = async (event: FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    setSaveError(null)
    try {
      await notesApi.add({ subjectType, subjectId, noteType: 'staff_note', body })
      setDraft('')
      refresh()
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Unable to add note.')
    } finally {
      setBusy(false)
    }
  }

  const search = query.trim().toLowerCase()
  const matchingNotes = (notes.data ?? []).filter(note => !search || note.body.toLowerCase().includes(search) || note.authorName?.toLowerCase().includes(search))
  const form = canManage && <form onSubmit={add} className="space-y-2">
    <ErrorNotice message={saveError} />
    <label className="block text-sm font-medium">
      Add a note
      <textarea className={input} rows={3} value={draft} maxLength={10000} disabled={busy} onChange={event => setDraft(event.target.value)} />
    </label>
    <button type="submit" className={primary} disabled={busy || !draft.trim()}>{busy ? 'Adding…' : 'Add note'}</button>
  </form>
  const results = <>
    <ErrorNotice message={notes.error} onRetry={refresh} />
    {notes.loading ? <Loading label="Loading account notes…" /> : notes.error ? null : matchingNotes.length ? (
      <div className="space-y-3">
        {matchingNotes.map(note => <article key={note.id} className="rounded-lg border border-slate-200 p-4">
          <p className="whitespace-pre-wrap break-words text-sm">{note.body}</p>
          <p className="mt-2 break-words text-xs text-slate-500">
            {note.authorName || (note.noteType === 'user_comment' ? 'Family' : 'Staff')} · {new Date(note.createdAt).toLocaleString()} · {subjectLabels[note.subjectType]} #{note.subjectId}
          </p>
        </article>)}
      </div>
    ) : <Empty>{search ? 'No notes match your search.' : 'No notes yet.'}</Empty>}
  </>

  if (subjectType === 'family') return <div className="space-y-4">
    <label className="block text-sm font-medium">
      Search notes
      <input type="search" className={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by note text or author" />
    </label>
    <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <section className="space-y-4" aria-label="Account notes and correspondence">
        <h3 className="font-semibold">Account notes &amp; correspondence</h3>
        {form}
      </section>
      <section className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Notes">
        <h3 className="font-semibold">Notes</h3>
        {results}
      </section>
    </div>
  </div>

  return <section className="max-w-3xl space-y-4" aria-label="Account notes and correspondence">
    <div>
      <h3 className="font-semibold">Account notes &amp; correspondence</h3>
      <p className="mt-1 text-sm text-slate-500">Shared inquiry and family notes, with their original dates and authors.</p>
    </div>
    {form}
    {results}
  </section>
}
