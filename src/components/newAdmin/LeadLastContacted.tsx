import { useState, type FormEvent } from 'react'
import { request } from './api'
import { button, ErrorNotice, input } from './shared'
import type { Lead } from './leadTypes'

export default function LeadLastContacted({ lead, canManage, onSaved }: { lead: Lead; canManage: boolean; onSaved: (date: string | null) => void }) {
  const currentDate = lead.lastContactedAt?.slice(0, 10) || ''
  const [date, setDate] = useState(currentDate)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError(null); setSaved(false)
    try {
      const result = await request<Lead>(`/api/admin/new-admin/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ lastContactedAt: date || null }) })
      onSaved(result.lastContactedAt ?? null)
      setSaved(true)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save last contacted date.') }
    finally { setBusy(false) }
  }
  return <form onSubmit={save} className="mb-4 rounded-lg border bg-white p-3">
    <label className="block text-sm font-semibold">Last contacted<input className={input} type="date" value={date} disabled={!canManage || busy} onChange={event => { setDate(event.target.value); setSaved(false) }} /></label>
    {canManage ? <button className={`${button} mt-2`} disabled={busy || date === currentDate}>{busy ? 'Saving…' : 'Save last contacted'}</button> : null}
    {saved ? <p role="status" className="mt-2 text-xs text-green-700">Last contacted saved.</p> : null}
    <ErrorNotice message={error} />
  </form>
}
