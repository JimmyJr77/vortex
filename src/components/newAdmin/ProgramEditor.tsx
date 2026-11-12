import { confirmArchive } from '../../utils/confirmArchive'
import { useState, type FormEvent } from 'react'
import { type TopProgram } from '../../utils/programsApi'
import { request, useRead } from './api'
import { button, Dialog, ErrorNotice, input, Loading, primary } from './shared'

const path = '/api/admin/programs-top'

export default function ProgramEditor({ mode, onClose, onSaved }: {
  mode: 'create' | 'edit'
  onClose: () => void
  onSaved: () => void
}) {
  const programs = useRead<TopProgram[]>(mode === 'edit' ? path : null)
  const [selectedId, setSelectedId] = useState('')
  const selected = programs.data?.find(program => String(program.id) === selectedId)

  return <Dialog title={mode === 'create' ? 'Create program' : 'Edit program'} onClose={onClose}>
    {mode === 'edit' && (programs.loading ? <Loading label="Loading programs…" /> : programs.error ? <ErrorNotice message={programs.error} /> :
      programs.data?.length ? <label className="block text-sm font-medium">Program
        <select className={input} value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          <option value="">Choose a program</option>
          {programs.data.map(program => <option key={program.id} value={program.id}>{program.displayName}{program.archived ? ' (archived)' : ''}</option>)}
        </select>
      </label> : <p className="text-sm text-slate-500">No programs yet. Use Create program to add one.</p>)}
    {(mode === 'create' || selected) && <ProgramForm key={selected?.id ?? 'new'} program={selected} onClose={onClose} onSaved={() => { onSaved(); onClose() }} />}
  </Dialog>
}

function ProgramForm({ program, onClose, onSaved }: { program?: TopProgram; onClose: () => void; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(program?.displayName ?? '')
  const [abridgedName, setAbridgedName] = useState(program?.abridgedName ?? '')
  const [description, setDescription] = useState(program?.description ?? '')
  const [excludeFromDropIns, setExcludeFromDropIns] = useState(program?.excludeFromDropIns ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    const name = displayName.trim()
    if (!name) { setError('Enter a program name.'); return }
    setBusy(true)
    setError(null)
    try {
      const details = { displayName: name, abridgedName: abridgedName.trim(), description: description.trim(), excludeFromDropIns }
      await request(program ? `${path}/${program.id}` : path, {
        method: program ? 'PUT' : 'POST',
        body: JSON.stringify(program ? details : { ...details, name }),
      })
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the program.')
    } finally {
      setBusy(false)
    }
  }

  async function archive() {
    if (!program) return
    if (!program.archived && !await confirmArchive(program.displayName)) return
    setBusy(true); setError(null)
    try { await request(`${path}/${program.id}/archive`, {method:'PATCH',body:JSON.stringify({archived:!program.archived})}); onSaved() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to archive the program.') }
    finally { setBusy(false) }
  }

  return <form className="mt-4" onSubmit={save}>
    <fieldset disabled={busy} className="space-y-4">
      <label className="block text-sm font-medium">Program name<input className={input} required maxLength={program ? 255 : 100} value={displayName} onChange={event => setDisplayName(event.target.value)} /></label>
      <label className="block text-sm font-medium">Short name<input className={input} maxLength={255} value={abridgedName} onChange={event => setAbridgedName(event.target.value)} /></label>
      <label className="block text-sm font-medium">Description<textarea className={input} rows={4} maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={excludeFromDropIns} onChange={event => setExcludeFromDropIns(event.target.checked)} />Exclude from drop-ins</label>
      <ErrorNotice message={error} />
      <div className="flex justify-end gap-2">{program && <button type="button" className={`${button} mr-auto text-red-700`} onClick={() => void archive()}>{program.archived ? 'Restore program' : 'Archive program'}</button>}<button type="button" className={button} onClick={onClose}>Cancel</button><button className={primary}>{busy ? 'Saving…' : program ? 'Save program' : 'Create program'}</button></div>
    </fieldset>
  </form>
}
