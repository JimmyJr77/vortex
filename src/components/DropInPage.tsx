import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, LayoutGrid, Loader2, Search, Ticket, X } from 'lucide-react'
import { fetchDropIns, registerDropIn, type DropInBenefits, type DropInSession } from '../utils/dropInApi'
import { getLoggedInMemberEmail } from '../utils/portalSession'
import { CLASS_SKILL_LEVEL_FILTER_OPTIONS, formatAgeRange, formatSkillLevel, type ClassSkillLevelFilter } from '../utils/classDisplayUtils'

const UNSPECIFIED_SPORT = '__unspecified_sport__'
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
const prettyDate = (date: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
const prettyTime = (time: string) => new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export default function DropInPage() {
  const [sessions, setSessions] = useState<DropInSession[]>([])
  const [benefits, setBenefits] = useState<DropInBenefits | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [selected, setSelected] = useState<DropInSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sportFilter, setSportFilter] = useState('all')
  const [programFilter, setProgramFilter] = useState<number | 'all'>('all')
  const [levelFilter, setLevelFilter] = useState<ClassSkillLevelFilter>('all')
  const [result, setResult] = useState<Awaited<ReturnType<typeof registerDropIn>> | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: getLoggedInMemberEmail() ?? '', phone: '', useFreeTrial: true })

  useEffect(() => {
    fetchDropIns(form.email || undefined).then((data) => {
      setSessions(data.sessions)
      setBenefits(data.benefits)
      setForm((current) => ({ ...current, useFreeTrial: data.benefits.trialAvailable }))
    }).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load classes')).finally(() => setLoading(false))
    // Read the authenticated identity once on entry; typed emails must not expose another member's benefits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const classes = useMemo(() => {
    const unique = new Map<number, DropInSession>()
    for (const row of sessions) if (!unique.has(row.classId)) unique.set(row.classId, row)
    return [...unique.values()]
  }, [sessions])

  const sportOptions = useMemo(() => {
    const names = new Set<string>()
    let hasUnspecified = false
    for (const row of classes) {
      if (row.sportName) names.add(row.sportName)
      else hasUnspecified = true
    }
    return { named: [...names].sort(), hasUnspecified }
  }, [classes])

  const programOptions = useMemo(() => {
    const unique = new Map<number, DropInSession>()
    for (const row of classes) {
      if (sportFilter === 'all' || (row.sportName ?? UNSPECIFIED_SPORT) === sportFilter) unique.set(row.programId, row)
    }
    return [...unique.values()].sort((a, b) => (a.programName ?? '').localeCompare(b.programName ?? ''))
  }, [classes, sportFilter])

  const programSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = classes.filter((row) =>
      (sportFilter === 'all' || (row.sportName ?? UNSPECIFIED_SPORT) === sportFilter) &&
      (programFilter === 'all' || row.programId === programFilter) &&
      (levelFilter === 'all' || row.skillLevel == null || row.skillLevel === levelFilter) &&
      (!query || [row.sportName, row.programName, row.className, row.skillLevel, row.classDescription].filter(Boolean).join(' ').toLowerCase().includes(query)),
    )
    const grouped = new Map<number, DropInSession[]>()
    for (const row of filtered) grouped.set(row.programId, [...(grouped.get(row.programId) ?? []), row])
    return [...grouped.values()].sort((a, b) => (a[0]?.programName ?? '').localeCompare(b[0]?.programName ?? ''))
  }, [classes, levelFilter, programFilter, searchQuery, sportFilter])

  const upcoming = useMemo(() => sessions
    .filter((row) => row.classId === selectedClassId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)), [selectedClassId, sessions])

  const selectedClass = classes.find((row) => row.classId === selectedClassId) ?? null
  const hasFilters = searchQuery !== '' || sportFilter !== 'all' || programFilter !== 'all' || levelFilter !== 'all'
  const clearFilters = () => { setSearchQuery(''); setSportFilter('all'); setProgramFilter('all'); setLevelFilter('all') }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setSubmitting(true); setError(null)
    try { setResult(await registerDropIn({ slotGroupId: selected.slotGroupId, classDate: selected.date, ...form })) }
    catch (err) { setError(err instanceof Error ? err.message : 'Registration failed') }
    finally { setSubmitting(false) }
  }

  return <div className="min-h-screen bg-gray-50">
    <section className="bg-gradient-to-br from-black via-gray-900 to-black pt-below-site-header pb-14 text-white">
      <div className="container-custom max-w-5xl text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-vortex-red/20 px-4 py-2 text-sm font-bold text-red-200"><Ticket className="h-4 w-4" /> Single-day classes only</div>
        <h1 className="font-display text-4xl font-bold md:text-6xl">Drop in for one class</h1>
        <p className="mx-auto mt-4 max-w-3xl text-lg text-gray-300">Browse the same class catalog, then choose one upcoming day without starting a monthly enrollment.</p>
      </div>
    </section>

    <section className="container-custom max-w-6xl py-10">
      {benefits && <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><div className="text-sm text-gray-500">Your rate</div><div className="font-bold">{benefits.annualMember ? `Member pricing${benefits.discountPercent ? ` · ${benefits.discountPercent.toFixed(0)}% discount` : ''}` : 'Non-member pricing'}</div></div>
        <div className="rounded-xl border bg-white p-4"><div className="text-sm text-gray-500">Free trial</div><div className="font-bold">{benefits.trialAvailable ? 'Available' : 'Already used'}</div></div>
        <div className="rounded-xl border bg-white p-4"><div className="text-sm text-gray-500">Annual member credits</div><div className="font-bold">{benefits.annualCreditsRemaining} remaining</div></div>
      </div>}

      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-vortex-red" /></div> : <div className={`grid items-start gap-6 ${selectedClassId ? 'lg:grid-cols-[minmax(0,1fr)_24rem]' : ''}`}>
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 space-y-4 shadow-sm">
            <div className="flex items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><LayoutGrid className="h-7 w-7 text-vortex-red" /> Browse classes</h2><p className="mt-1 text-sm text-gray-600">Select a class to see its upcoming single-day openings.</p></div>{hasFilters && <button type="button" onClick={clearFilters} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-vortex-red"><X className="h-4 w-4" /> Clear</button>}</div>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search classes…" className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm" /></div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 sm:max-w-[14rem]"><span className="text-xs font-semibold text-gray-600">Sport</span><select value={sportFilter} onChange={(event) => { setSportFilter(event.target.value); setProgramFilter('all') }} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="all">All sports</option>{sportOptions.named.map((sport) => <option key={sport} value={sport}>{sport}</option>)}{sportOptions.hasUnspecified && <option value={UNSPECIFIED_SPORT}>Unspecified sport</option>}</select></label>
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 sm:max-w-[14rem]"><span className="text-xs font-semibold text-gray-600">Program</span><select value={programFilter} onChange={(event) => setProgramFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="all">All programs</option>{programOptions.map((row) => <option key={row.programId} value={row.programId}>{row.programName}</option>)}</select></label>
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 sm:max-w-[14rem]"><span className="text-xs font-semibold text-gray-600">Experience level</span><select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as ClassSkillLevelFilter)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm">{CLASS_SKILL_LEVEL_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
          </div>

          {programSections.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">{error || 'No classes match your search or filters.'}</div>}
          {programSections.map((rows) => <div key={rows[0].programId} className="space-y-4 rounded-xl border border-vortex-red bg-white p-4 shadow-sm md:p-5">
            <div><h2 className="text-lg font-bold text-vortex-red">{rows[0].programName}</h2>{rows[0].programDescription && <p className="mt-1 text-sm text-gray-600">{rows[0].programDescription}</p>}</div>
            {rows.map((row) => <button type="button" key={row.classId} onClick={() => setSelectedClassId(row.classId)} className={`block w-full rounded-xl border p-4 text-left transition-colors ${selectedClassId === row.classId ? 'border-vortex-red bg-red-50 ring-1 ring-red-200' : 'border-gray-100 bg-gray-50 hover:border-gray-300'}`}>
              <h3 className="text-base font-bold text-gray-900">{row.className}</h3><div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span>Age: {formatAgeRange(row.ageMin, row.ageMax)}</span><span>Level: {formatSkillLevel(row.skillLevel)}</span></div>{row.classDescription && <p className="mt-1 text-sm text-gray-600">{row.classDescription}</p>}<p className="mt-3 text-sm font-semibold text-vortex-red">View upcoming drop-in dates →</p>
            </button>)}
          </div>)}
        </div>

        {selectedClassId && <button type="button" aria-label="Close upcoming classes" onClick={() => setSelectedClassId(null)} className="fixed inset-0 z-40 bg-black/45 lg:hidden" />}
        {selectedClassId && <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-hidden rounded-t-2xl border border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl md:p-5 lg:sticky lg:inset-auto lg:top-[calc(var(--site-header-height,0px)+1rem)] lg:z-auto lg:max-h-none lg:rounded-xl lg:pb-5 lg:shadow-sm">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-300 lg:hidden" />
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-vortex-red">Upcoming classes</p><h2 className="mt-1 text-xl font-bold text-gray-900">{selectedClass?.className}</h2><p className="mt-1 text-sm text-gray-600">Choose one day, date, and time.</p></div><button type="button" onClick={() => setSelectedClassId(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close upcoming classes"><X className="h-5 w-5" /></button></div>
          <div className="mt-5 max-h-[58dvh] space-y-3 overflow-y-auto overscroll-contain pr-1 lg:max-h-[65vh]">{upcoming.map((session) => <button key={`${session.slotGroupId}:${session.date}:${session.startTime}`} type="button" disabled={session.isFull} onClick={() => { setSelected(session); setResult(null); setError(null) }} className="min-h-24 w-full touch-manipulation rounded-xl border border-gray-200 p-4 text-left hover:border-vortex-red disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-bold"><CalendarDays className="h-4 w-4 text-vortex-red" /> {prettyDate(session.date)}</div><p className="mt-1 text-sm text-gray-600">{prettyTime(session.startTime)}–{prettyTime(session.endTime)}</p></div><strong className="text-vortex-red">{money(session.totalCents)}</strong></div><p className="mt-3 text-xs font-semibold text-gray-600">{session.isFull ? 'Class full' : `${session.spotsRemaining} spots available · ${session.enrolled} of ${session.maxParticipants} enrolled`}</p></button>)}{upcoming.length === 0 && <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">No upcoming dates are open for this class.</p>}</div>
        </aside>}
      </div>}
    </section>

    {selected && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null) }}><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      {result ? <div className="text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-green-600" /><h2 className="mt-4 text-2xl font-bold">Drop-in requested</h2><p className="mt-2 text-gray-600">{result.benefitType === 'free_trial' ? 'Your one-time free trial is reserved.' : result.benefitType === 'annual_credit' ? 'One annual member credit was applied.' : result.accountRequired ? 'Create your family account to finish this paid registration.' : 'Your spot is reserved and the one-time charge was added to your family account.'}</p>{result.accountRequired && <Link className="mt-5 inline-flex rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white" to={result.signupUrl ?? '/signup/family'}>Create your family account</Link>}<button className="mt-4 block w-full text-sm font-semibold" onClick={() => setSelected(null)}>Close</button></div> : <><h2 className="text-2xl font-bold">Register for one day</h2><p className="mt-1 text-sm text-gray-600">{selected.className} · {prettyDate(selected.date)} · {prettyTime(selected.startTime)}</p><form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">First name<input required className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label><label className="text-sm font-semibold">Last name<input required className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label></div>
        <label className="block text-sm font-semibold">Email<input required type="email" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="block text-sm font-semibold">Phone<input type="tel" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        {benefits?.trialAvailable && <label className="flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4"><input type="checkbox" checked={form.useFreeTrial} onChange={(event) => setForm({ ...form, useFreeTrial: event.target.checked })} /><span><strong>Use my one-time free trial</strong><span className="block text-sm text-gray-600">No annual membership is required. Available once per athlete, for life.</span></span></label>}
        <div className="rounded-xl bg-gray-50 p-4 text-sm"><div className="flex justify-between"><span>Single-day price</span><strong>{form.useFreeTrial || (benefits?.annualCreditsRemaining ?? 0) > 0 ? '$0.00' : money(selected.totalCents)}</strong></div></div>{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="flex gap-3"><button type="button" onClick={() => setSelected(null)} className="flex-1 rounded-lg border px-4 py-3 font-semibold">Cancel</button><button disabled={submitting} className="flex-1 rounded-lg bg-vortex-red px-4 py-3 font-semibold text-white disabled:opacity-60">{submitting ? 'Registering…' : 'Reserve class'}</button></div>
      </form></>}
    </div></div>}
  </div>
}
