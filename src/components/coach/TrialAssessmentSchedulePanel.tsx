import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, Loader2, Pencil, Plus, RefreshCw } from 'lucide-react'
import { coachFetch } from '../../coach/api'

interface AssessmentTime {
  slotGroupId: number
  timeSlotId: number
  scheduleMode: 'day' | 'date'
  dayOfWeek: number | null
  specificDate: string | null
  startTime: string
  endTime: string
  maxParticipants: number
  activeStart: string | null
  activeEnd: string | null
  datesTbd: boolean
}
interface AssessmentClass {
  id: number
  name: string
  timeZone: string
  today: string
  schedules: AssessmentTime[]
}
interface TimeDraft {
  scheduleMode: 'day' | 'date'
  dayOfWeek: string
  specificDate: string
  startTime: string
  endTime: string
  maxParticipants: string
  activeStart: string
  activeEnd: string
}
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const inputClass = 'block w-full min-h-12 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900'
const blank = (today: string): TimeDraft => ({ scheduleMode: 'day', dayOfWeek: '6', specificDate: '', startTime: '12:00', endTime: '13:00', maxParticipants: '8', activeStart: today, activeEnd: '' })
const displayTime = (value: string) => {
  const [hour, minute] = value.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}
const displayDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

export default function TrialAssessmentSchedulePanel() {
  const [classes, setClasses] = useState<AssessmentClass[]>([])
  const [formId, setFormId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<TimeDraft | null>(null)
  const selected = classes.find(item => item.id === formId) ?? classes[0]
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setClasses(await coachFetch<AssessmentClass[]>('/api/coach/trial-assessments', { cache: 'no-store' })) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to load assessment times.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const edit = (schedule: AssessmentTime) => {
    setEditingId(schedule.slotGroupId)
    setDraft({ scheduleMode: schedule.scheduleMode, dayOfWeek: String(schedule.dayOfWeek ?? 6), specificDate: schedule.specificDate ?? '',
      startTime: schedule.startTime, endTime: schedule.endTime, maxParticipants: String(schedule.maxParticipants),
      activeStart: schedule.activeStart ?? selected.today, activeEnd: schedule.activeEnd ?? '' })
    setError(''); setSuccess('')
  }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected || !draft) return
    setSaving(true); setError(''); setSuccess('')
    try {
      await coachFetch(`/api/coach/trial-assessments/${selected.id}/times${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...draft, dayOfWeek: Number(draft.dayOfWeek), maxParticipants: Number(draft.maxParticipants),
          specificDate: draft.specificDate || null, activeStart: draft.activeStart || null, activeEnd: draft.activeEnd || null }),
      })
      setDraft(null); setEditingId(null)
      await load()
      setSuccess('Assessment time saved. Families will see the updated schedule when they open or refresh free trial availability.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save assessment time.') }
    finally { setSaving(false) }
  }
  const change = (field: keyof TimeDraft, value: string) => setDraft(current => current ? { ...current, [field]: value } : current)

  return <section className="space-y-5 pb-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-2xl font-bold text-gray-900">Trial Assessment times</h2><p className="mt-1 max-w-2xl text-sm text-gray-600">Manage the free assessment schedule for experienced gymnasts. Each day and time is offered separately in the website’s free trial signup.</p></div>
      <button type="button" disabled={loading || saving} onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16} /> Refresh</button>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {success && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{success}</div>}
    {loading ? <p role="status" className="flex items-center gap-2 py-6 text-gray-600"><Loader2 className="animate-spin" size={20} /> Loading assessment times…</p> : !selected ? <div className="rounded-xl border border-gray-200 bg-white p-6"><p>No Trial Assessment class is available for this facility. Ask an administrator to set up the class.</p></div> : <>
      {classes.length > 1 && <label className="block max-w-lg space-y-1 text-sm font-semibold">Assessment class<select className={inputClass} value={selected.id} disabled={saving} onChange={event => { setFormId(Number(event.target.value)); setDraft(null); setEditingId(null) }}>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <p className="text-sm text-gray-600">All times use {selected.timeZone.replaceAll('_', ' ')}. Booked assessments keep their original time; add a separate time to offer another option.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {selected.schedules.map(schedule => <article key={schedule.timeSlotId} className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 font-semibold text-gray-900"><CalendarDays size={18} />{schedule.scheduleMode === 'date' && schedule.specificDate ? displayDate(schedule.specificDate) : days[schedule.dayOfWeek ?? 0]}</h3><p className="mt-2 text-lg font-semibold">{displayTime(schedule.startTime)}–{displayTime(schedule.endTime)}</p></div><button type="button" disabled={saving} onClick={() => edit(schedule)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"><Pencil size={15} /> Edit</button></div>
          <p className="mt-2 text-sm text-gray-600">Capacity: {schedule.maxParticipants} athletes</p>
          <p className="mt-1 text-xs text-gray-500">{schedule.datesTbd ? 'Dates to be announced' : `${schedule.activeStart ? `From ${displayDate(schedule.activeStart)}` : 'Open start date'}${schedule.activeEnd ? ` · Through ${displayDate(schedule.activeEnd)}` : ' · No end date'}`}</p>
        </article>)}
        {selected.schedules.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">No assessment times are published. Add a time to make it available for free trials.</p>}
      </div>
      {!draft && <button type="button" onClick={() => { setEditingId(null); setDraft(blank(selected.today)); setError(''); setSuccess('') }} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-vortex-red px-4 py-3 font-semibold text-white"><Plus size={18} /> Add assessment time</button>}
      {draft && <form onSubmit={event => void save(event)} className="max-w-3xl space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h3 className="text-lg font-bold">{editingId ? 'Edit assessment time' : 'Add assessment time'}</h3>
        <fieldset disabled={saving} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold">Schedule<select className={inputClass} value={draft.scheduleMode} onChange={event => change('scheduleMode', event.target.value)}><option value="day">Every week</option><option value="date">One date</option></select></label>
          {draft.scheduleMode === 'day' ? <label className="space-y-1 text-sm font-semibold">Day<select className={inputClass} value={draft.dayOfWeek} onChange={event => change('dayOfWeek', event.target.value)}>{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label> : <label className="space-y-1 text-sm font-semibold">Assessment date<input className={inputClass} type="date" required min={selected.today} value={draft.specificDate} onChange={event => change('specificDate', event.target.value)} /></label>}
          <label className="space-y-1 text-sm font-semibold">Start time<input className={inputClass} type="time" required value={draft.startTime} onChange={event => change('startTime', event.target.value)} /></label>
          <label className="space-y-1 text-sm font-semibold">End time<input className={inputClass} type="time" required value={draft.endTime} onChange={event => change('endTime', event.target.value)} /></label>
          <label className="space-y-1 text-sm font-semibold">Capacity<input className={inputClass} type="number" inputMode="numeric" min="1" max="1000" step="1" required value={draft.maxParticipants} onChange={event => change('maxParticipants', event.target.value)} /></label>
          <label className="space-y-1 text-sm font-semibold">Available from<input className={inputClass} type="date" required value={draft.activeStart} onChange={event => change('activeStart', event.target.value)} /></label>
          <label className="space-y-1 text-sm font-semibold">Available through (optional)<input className={inputClass} type="date" min={draft.activeStart || undefined} value={draft.activeEnd} onChange={event => change('activeEnd', event.target.value)} /><span className="block text-xs font-normal text-gray-500">Leave blank to continue offering this time.</span></label>
        </fieldset>
        <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white disabled:opacity-50">{saving && <Loader2 className="animate-spin" size={18} />}{saving ? 'Saving…' : 'Save assessment time'}</button><button type="button" disabled={saving} onClick={() => { setDraft(null); setEditingId(null) }} className="min-h-12 rounded-lg border border-gray-300 px-4 py-3 font-semibold">Cancel</button></div>
      </form>}
    </>}
  </section>
}
