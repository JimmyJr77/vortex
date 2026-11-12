import { useState, type FormEvent } from 'react'
import { notesApi, type Note } from '../../utils/adminFeaturesApi'
import { useRead } from './api'
import { Empty, ErrorNotice, input, Loading, primary } from './shared'

interface NoteSubject { subjectType: 'member' | 'registration'; subjectId: number; label: string }

export default function AccountNotes({ endpoint, canManage, subjects, revision = 0 }: {
  endpoint: string; canManage: boolean; subjects: NoteSubject[]; revision?: number
}) {
  const [version, setVersion] = useState(0)
  const notes = useRead<Note[]>(endpoint, revision + version)
  const [subjectId, setSubjectId] = useState(subjects[0]?.subjectId)
  const subject = subjects.find(value => value.subjectId === subjectId) ?? subjects[0]
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || !subject) return
    setBusy(true); setError(null)
    try {
      await notesApi.add({ subjectType: subject.subjectType, subjectId: subject.subjectId, noteType: 'staff_note', body: draft.trim() })
      setDraft(''); setVersion(value => value + 1)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to add note.') }
    finally { setBusy(false) }
  }
  return <section className="max-w-3xl space-y-4" aria-label="Account notes and correspondence">
    <div><h3 className="font-semibold">Account notes & correspondence</h3><p className="mt-1 text-sm text-slate-500">Shared inquiry and family notes, with their original dates and authors.</p></div>
    <ErrorNotice message={error || notes.error} onRetry={() => setVersion(value => value + 1)} />
    {canManage && subject && <form onSubmit={add} className="space-y-2">
      {subjects.length > 1 && <label className="block text-sm font-medium">Note for<select aria-label="Note for" className={input} value={subject.subjectId} disabled={busy} onChange={event => setSubjectId(Number(event.target.value))}>{subjects.map(value => <option key={`${value.subjectType}:${value.subjectId}`} value={value.subjectId}>{value.label}</option>)}</select></label>}
      <label className="block text-sm font-medium">Add a note<textarea className={input} rows={3} value={draft} maxLength={10000} disabled={busy} onChange={event => setDraft(event.target.value)} /></label>
      <button className={primary} disabled={busy || !draft.trim()}>{busy ? 'Adding…' : 'Add note'}</button>
    </form>}
    {notes.loading ? <Loading label="Loading account notes…" /> : notes.data?.length ? <div className="space-y-3">{notes.data.map(note => <article key={note.id} className="rounded-lg border border-slate-200 p-4"><p className="whitespace-pre-wrap break-words text-sm">{note.body}</p><p className="mt-2 text-xs text-slate-500">{note.authorName || (note.noteType === 'user_comment' ? 'Family' : 'Staff')} · {new Date(note.createdAt).toLocaleString()} · {note.subjectType === 'registration' ? 'Inquiry' : 'Member'} #{note.subjectId}</p></article>)}</div> : <Empty>No notes yet.</Empty>}
  </section>
}
