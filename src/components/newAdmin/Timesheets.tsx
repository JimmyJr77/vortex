import { Suspense, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { allowed, request, useRead, type Access } from './api'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import { button, cell, Dialog, Empty, ErrorNotice, input, Loading, primary } from './shared'

type Assignment = { id: number; startTime: string; endTime: string; endDate: string; minutes: number; notes: string }
type Day = { date: string; minutes: number | null; notes: string; version: number; assignments: Assignment[] }
type Person = { id: number; name: string; days: Day[] }
type Week = { week: string; end: string; today: string; timezone: string; userId: number; canAssign: boolean; people: Person[] }
type Options = { userId: number; canViewAll: boolean; people: { id: number; name: string }[]; timezone: string; today: string }
type Draft = { hours: string; notes: string }
const endpoint = '/api/admin/new-admin/timesheets'
const addDays = (date: string, amount: number) => new Date(Date.parse(`${date}T12:00:00Z`) + amount * 86400000).toISOString().slice(0, 10)
function weekOf(date: string) {
  const day = new Date(`${date}T12:00:00Z`)
  return addDays(date, -(day.getUTCDay() + 6) % 7)
}
const dateLabel = (date: string, weekday = false) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', ...(weekday ? { weekday: 'short' as const } : { year: 'numeric' as const }) }).format(new Date(`${date}T12:00:00Z`))
const hours = (minutes: number | null) => minutes == null ? '' : String(Number((minutes / 60).toFixed(2)))
const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`
const timeLabel = (time: string) => { const [h, m] = time.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unable to save. Please try again.'

const CoachAssignments = lazyWithRetry(() => import('../AdminCoaches'))

export default function Timesheets({ revision, access }: { revision: number; access: Access }) {
  const [tab, setTab] = useState<'timesheets' | 'coaches'>('timesheets')
  const canManageCoaches = allowed(access, 'classes.manage')
  const showCoaches = canManageCoaches && tab === 'coaches'
  return <div className="space-y-4">
    {canManageCoaches ? <nav aria-label="Timesheets tabs" className="flex gap-1 border-b border-gray-200">
      {([['timesheets', 'Timesheets'], ['coaches', 'Coach Assignments']] as const).map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)} className={`px-5 py-3 text-sm font-semibold border-b-2 ${tab === id ? 'border-vortex-red text-gray-900' : 'border-transparent text-gray-500'}`}>{label}</button>)}
    </nav> : null}
    <div hidden={showCoaches}><WeeklyTimesheets revision={revision} /></div>
    {showCoaches ? <Suspense fallback={<Loading />}><CoachAssignments key={revision} isMasterAdmin={access.isMasterAdmin} /></Suspense> : null}
  </div>
}

function WeeklyTimesheets({ revision }: { revision: number }) {
  const [version, setVersion] = useState(0)
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null)
  const [person, setPerson] = useState('me')
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)
  const options = useRead<Options>(`${endpoint}/options`, revision + version)
  const week = selectedWeek ?? (options.data ? weekOf(options.data.today) : '')
  const result = useRead<Week>(week ? `${endpoint}/week?${new URLSearchParams({ week, person })}` : null, revision + version)
  const data = result.data, single = data?.people.length === 1 && person !== 'all' ? data.people[0] : null
  const editable = single?.id === data?.userId && Boolean(single)
  const refresh = () => setVersion(value => value + 1)
  const dirty = Object.keys(drafts).length > 0
  const draftFor = (day: Day) => drafts[day.date] ?? { hours: hours(day.minutes), notes: day.notes }
  const update = (day: Day, values: Partial<Draft>) => {
    setNotice(null)
    setDrafts(current => ({ ...current, [day.date]: { ...(current[day.date] ?? { hours: hours(day.minutes), notes: day.notes }), ...values } }))
  }
  const save = async (): Promise<boolean> => {
    if (!dirty) return true
    if (!single || !editable) return false
    setSaving(true); setError(null); setNotice(null)
    try {
      const days = single.days.filter(day => drafts[day.date]).map(day => {
        const draft = drafts[day.date], value = draft.hours.trim() === '' ? null : Number(draft.hours)
        if (value !== null && (!Number.isFinite(value) || value < 0 || value > 24)) throw new Error('Enter between 0 and 24 hours for each day.')
        return { date: day.date, minutes: value === null ? null : Math.round(value * 60), notes: draft.notes, version: day.version }
      })
      await request(`${endpoint}/week`, { method: 'PUT', body: JSON.stringify({ week, days }) })
      setDrafts({}); setNotice('Hours saved.'); refresh()
      return true
    } catch (cause) { setError(errorMessage(cause)); return false }
    finally { setSaving(false) }
  }
  const navigate = async (action: () => void) => { if (await save()) { setDrafts({}); setNotice(null); action() } }
  const removeAssignment = async (assignment: Assignment) => {
    setSaving(true); setError(null)
    try { await request(`${endpoint}/assignments/${assignment.id}`, { method: 'DELETE' }); refresh(); setNotice('Assigned time removed.') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
  }
  const actualTotal = single?.days.reduce((sum, day) => sum + (draftFor(day).hours === '' ? 0 : Math.round(Number(draftFor(day).hours) * 60) || 0), 0) ?? 0
  return <section className="space-y-4" aria-label="Timesheets">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Timesheets</h2><p className="mt-1 text-sm text-slate-500">Enter hours worked for each day of the week.</p></div>{data?.canAssign ? <button className={button} disabled={saving} onClick={() => void navigate(() => setAssigning(true))}><Plus className="h-4 w-4" />Assign time</button> : null}</div>
    <ErrorNotice message={options.error || result.error || error} onRetry={refresh} />
    {notice ? <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p> : null}
    {options.data && week ? <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      {options.data.canViewAll ? <label className="min-w-44 text-sm font-semibold text-slate-700">View timesheets<select className={input} disabled={saving} value={person} onChange={event => { const value = event.target.value; void navigate(() => setPerson(value)) }}><option value="me">My timesheet</option><option value="all">Everyone</option>{options.data.people.filter(item => item.id !== options.data!.userId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
      <div className="flex items-end gap-2"><button type="button" className={button} aria-label="Previous week" disabled={saving} onClick={() => void navigate(() => setSelectedWeek(addDays(week, -7)))}><ChevronLeft className="h-5 w-5" /></button><label className="text-sm font-semibold text-slate-700">Choose week<input className={input} type="date" value={week} disabled={saving} onChange={event => { const value = event.target.value; if (value) void navigate(() => setSelectedWeek(weekOf(value))) }} /></label><button type="button" className={button} aria-label="Next week" disabled={saving} onClick={() => void navigate(() => setSelectedWeek(addDays(week, 7)))}><ChevronRight className="h-5 w-5" /></button></div>
      <button type="button" className={button} disabled={saving} onClick={() => void navigate(() => setSelectedWeek(null))}>This week</button>
    </div> : null}
    {options.loading || result.loading ? <Loading label="Loading this week’s timesheets…" /> : null}
    {data ? <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h3 className="font-bold">{person === 'all' ? 'Everyone’s timesheets' : editable ? 'My timesheet' : single?.name}</h3><p className="text-sm text-slate-500">{dateLabel(data.week)} – {dateLabel(data.end)}</p></div>{single ? <div className="text-right"><p className="text-2xl font-bold">{duration(actualTotal)}</p><p className="text-xs text-slate-500">Hours worked this week</p></div> : null}</div>
      {single ? <form onSubmit={event => { event.preventDefault(); void save() }}>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th scope="col" className={cell}>Day</th><th scope="col" className={cell}>Hours worked</th><th scope="col" className={cell}>Admin-assigned time</th><th scope="col" className={cell}>Notes</th></tr></thead><tbody className="divide-y divide-slate-100">{single.days.map(day => <tr key={day.date}>
          <th scope="row" className={`${cell} sticky left-0 z-10 bg-white whitespace-nowrap font-semibold`}>{dateLabel(day.date, true)}{day.date === data.today ? <span className="block text-xs font-normal text-vortex-red">Today</span> : null}</th>
          <td className={`${cell} w-36`}>{editable ? <input aria-label={`Hours worked ${day.date}`} className={`${input} !mt-0 min-w-24`} type="number" min="0" max="24" step="0.01" placeholder="0" disabled={saving} value={draftFor(day).hours} onChange={event => update(day, { hours: event.target.value })} /> : <span>{day.minutes == null ? '—' : duration(day.minutes)}</span>}</td>
          <td className={`${cell} min-w-44 ${day.assignments.length ? 'bg-amber-50 border-l-2 border-amber-300' : ''}`}><AssignedTimes day={day} canAssign={data.canAssign} busy={saving} onRemove={removeAssignment} /></td>
          <td className={`${cell} min-w-48`}>{editable ? <input aria-label={`Notes ${day.date}`} className={`${input} !mt-0`} maxLength={2000} disabled={saving} placeholder="Optional" value={draftFor(day).notes} onChange={event => update(day, { notes: event.target.value })} /> : day.notes || '—'}</td>
        </tr>)}</tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4"><p className="max-w-xl text-xs text-slate-500">Highlighted times were assigned by an admin. Record all hours worked, including work outside those times. Use decimals, such as 1.5 for 1½ hours.</p>{editable ? <button className={primary} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save hours'}</button> : null}</div>
      </form> : data.people.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th scope="col" className={cell}>Person</th>{data.people[0].days.map(day => <th key={day.date} scope="col" className={`${cell} whitespace-nowrap`}>{dateLabel(day.date, true)}</th>)}<th scope="col" className={cell}>Total</th></tr></thead><tbody className="divide-y">{data.people.map(row => <tr key={row.id}><th scope="row" className={cell}><button className="font-semibold text-left underline decoration-slate-300" onClick={() => setPerson(row.id === data.userId ? 'me' : String(row.id))}>{row.name}</button></th>{row.days.map(day => <td key={day.date} className={`${cell} whitespace-nowrap ${day.assignments.length ? 'bg-amber-50' : ''}`}><div className="font-semibold">{day.minutes == null ? '—' : duration(day.minutes)}</div>{day.assignments.length ? <div className="mt-1 text-xs text-amber-900">Assigned: {duration(day.assignments.reduce((sum, item) => sum + item.minutes, 0))}</div> : null}</td>)}<td className={`${cell} whitespace-nowrap font-bold`}>{duration(row.days.reduce((sum, day) => sum + (day.minutes ?? 0), 0))}</td></tr>)}</tbody></table></div> : <Empty>No staff timesheets to show.</Empty>}
    </div> : null}
    {data ? <p className="text-xs text-slate-500">Weeks run Monday–Sunday. Assigned times use {data.timezone}.</p> : null}
    {assigning && options.data && data ? <AssignmentEditor people={options.data.people} initialUserId={single?.id ?? data.userId} initialDate={data.today >= week && data.today <= data.end ? data.today : week} timezone={data.timezone} onClose={() => setAssigning(false)} onSaved={() => { setAssigning(false); setNotice('Work time assigned.'); refresh() }} /> : null}
  </section>
}

function AssignedTimes({ day, canAssign, busy, onRemove }: { day: Day; canAssign: boolean; busy: boolean; onRemove: (assignment: Assignment) => Promise<void> }) {
  return day.assignments.length ? <div className="space-y-2">{day.assignments.map(item => <div key={item.id}><p className="whitespace-nowrap font-medium text-amber-950">{timeLabel(item.startTime)}–{timeLabel(item.endTime)}{item.endDate !== day.date ? ' (+1 day)' : ''}</p><p className="text-xs text-amber-900">{duration(item.minutes)} assigned{item.notes ? ` · ${item.notes}` : ''}</p>{canAssign ? <button type="button" disabled={busy} className="mt-1 text-xs text-slate-600 underline" aria-label={`Remove assigned time ${day.date} ${item.startTime}`} onClick={() => void onRemove(item)}>Remove</button> : null}</div>)}</div> : <span className="text-slate-400">—</span>
}

function AssignmentEditor({ people, initialUserId, initialDate, timezone, onClose, onSaved }: { people: Options['people']; initialUserId: number; initialDate: string; timezone: string; onClose: () => void; onSaved: () => void }) {
  const [userId, setUserId] = useState(String(initialUserId))
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('12:00')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null)
    try { await request(`${endpoint}/assignments`, { method: 'POST', body: JSON.stringify({ userId: Number(userId), date, startTime, endTime, notes }) }); onSaved() }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
  }
  return <Dialog title="Assign time" onClose={() => { if (!saving) onClose() }}><form onSubmit={event => void save(event)} className="space-y-4"><ErrorNotice message={error} /><label className="block text-sm font-semibold">Person<select className={input} value={userId} onChange={event => setUserId(event.target.value)}>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label className="block text-sm font-semibold">Date<input className={input} type="date" required value={date} onChange={event => setDate(event.target.value)} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Start time<input className={input} type="time" required value={startTime} onChange={event => setStartTime(event.target.value)} /></label><label className="text-sm font-semibold">End time<input className={input} type="time" required value={endTime} onChange={event => setEndTime(event.target.value)} /></label></div><p className="text-xs text-slate-500">Times use {timezone}.{endTime < startTime ? ' Ends the following day.' : ''}</p><label className="block text-sm font-semibold">Assignment note (optional)<input className={input} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} /></label><div className="flex justify-end gap-2"><button type="button" className={button} disabled={saving} onClick={onClose}>Cancel</button><button className={primary} disabled={saving}>{saving ? 'Saving…' : 'Assign hours'}</button></div></form></Dialog>
}
