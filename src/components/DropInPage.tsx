import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Loader2, Ticket } from 'lucide-react'
import { fetchDropIns, registerDropIn, type DropInBenefits, type DropInSession } from '../utils/dropInApi'
import { getLoggedInMemberEmail } from '../utils/portalSession'
import { CLASS_SKILL_LEVEL_FILTER_OPTIONS, formatAgeRange, formatSkillLevel, type ClassSkillLevelFilter } from '../utils/classDisplayUtils'

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
const prettyDate = (date: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
const prettyTime = (time: string) => new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export default function DropInPage() {
  const [sessions, setSessions] = useState<DropInSession[]>([])
  const [benefits, setBenefits] = useState<DropInBenefits | null>(null)
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
    // Identity is intentionally read once on page entry; changing the form email does not expose member benefits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sportOptions = useMemo(() => [...new Set(sessions.map((row) => row.sportName).filter(Boolean) as string[])].sort(), [sessions])
  const programOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const row of sessions) {
      if (sportFilter === 'all' || row.sportName === sportFilter) map.set(row.programId, row.programName ?? 'Program')
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [sessions, sportFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, DropInSession[]>()
    const query = searchQuery.trim().toLowerCase()
    for (const session of sessions.filter((row) =>
      (sportFilter === 'all' || row.sportName === sportFilter) &&
      (programFilter === 'all' || row.programId === programFilter) &&
      (levelFilter === 'all' || row.skillLevel == null || row.skillLevel === levelFilter) &&
      (!query || [row.sportName, row.programName, row.className, row.skillLevel].filter(Boolean).join(' ').toLowerCase().includes(query)),
    )) {
      const key = [session.sportName, session.programName, session.className].filter(Boolean).join(' · ')
      map.set(key, [...(map.get(key) ?? []), session])
    }
    return [...map.entries()]
  }, [levelFilter, programFilter, searchQuery, sessions, sportFilter])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setSubmitting(true); setError(null)
    try {
      const registration = await registerDropIn({ slotGroupId: selected.slotGroupId, classDate: selected.date, ...form })
      setResult(registration)
    } catch (err) { setError(err instanceof Error ? err.message : 'Registration failed') }
    finally { setSubmitting(false) }
  }

  return <div className="min-h-screen bg-gray-50">
    <section className="bg-gradient-to-br from-black via-gray-900 to-black pt-below-site-header pb-14 text-white">
      <div className="container-custom max-w-5xl text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-vortex-red/20 px-4 py-2 text-sm font-bold text-red-200"><Ticket className="h-4 w-4" /> Single-day classes only</div>
        <h1 className="font-display text-4xl font-bold md:text-6xl">Drop in for one class</h1>
        <p className="mx-auto mt-4 max-w-3xl text-lg text-gray-300">Choose one class date without starting a monthly enrollment. Every new athlete gets one lifetime free trial. Annual members also receive four drop-in class credits each membership year.</p>
      </div>
    </section>

    <section className="container-custom max-w-5xl py-10">
      {benefits && <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><div className="text-sm text-gray-500">Your rate</div><div className="font-bold">{benefits.annualMember ? `Member pricing${benefits.discountPercent ? ` · ${benefits.discountPercent.toFixed(0)}% discount` : ''}` : 'Non-member pricing'}</div></div>
        <div className="rounded-xl border bg-white p-4"><div className="text-sm text-gray-500">Free trial</div><div className="font-bold">{benefits.trialAvailable ? 'Available' : 'Already used'}</div></div>
        <div className="rounded-xl border bg-white p-4"><div className="text-sm text-gray-500">Annual member credits</div><div className="font-bold">{benefits.annualCreditsRemaining} remaining</div></div>
      </div>}
      {!loading && sessions.length > 0 && <div className="mb-8 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm font-semibold text-gray-700">Search<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" placeholder="Class or program" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label>
          <label className="text-sm font-semibold text-gray-700">Sport<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={sportFilter} onChange={(event) => { setSportFilter(event.target.value); setProgramFilter('all') }}><option value="all">All sports</option>{sportOptions.map((sport) => <option key={sport} value={sport}>{sport}</option>)}</select></label>
          <label className="text-sm font-semibold text-gray-700">Program<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={programFilter} onChange={(event) => setProgramFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}><option value="all">All programs</option>{programOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className="text-sm font-semibold text-gray-700">Skill level<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as ClassSkillLevelFilter)}><option value="all">All levels</option>{CLASS_SKILL_LEVEL_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
      </div>}
      {loading && <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-vortex-red" /></div>}
      {!loading && grouped.length === 0 && <div className="rounded-xl border bg-white p-10 text-center text-gray-600">No drop-in dates are currently available.</div>}
      <div className="space-y-6">
        {grouped.map(([name, rows]) => <article key={name} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <header className="border-b bg-gray-50 px-5 py-4"><h2 className="font-display text-xl font-bold">{name}</h2><p className="mt-1 text-sm text-gray-600">{[rows[0]?.skillLevel ? formatSkillLevel(rows[0].skillLevel) : null, formatAgeRange(rows[0]?.ageMin ?? null, rows[0]?.ageMax ?? null)].filter(Boolean).join(' · ')}</p></header>
          <div className="divide-y">{rows.map((session) => <div key={`${session.slotGroupId}:${session.date}`} className="grid items-center gap-4 p-5 md:grid-cols-[1fr_auto_auto]">
            <div><div className="flex items-center gap-2 font-bold"><CalendarDays className="h-4 w-4 text-vortex-red" /> {prettyDate(session.date)}</div><div className="mt-1 text-sm text-gray-600">{prettyTime(session.startTime)}–{prettyTime(session.endTime)} · {session.enrolled} of {session.maxParticipants} enrolled</div></div>
            <div className="md:text-right"><div className="text-xl font-bold">{money(session.totalCents)}</div><div className="text-xs text-gray-500">single class{session.discountCents > 0 ? ` · ${money(session.discountCents)} member savings` : ''}</div></div>
            <button disabled={session.isFull} onClick={() => { setSelected(session); setResult(null); setError(null) }} className="rounded-lg bg-vortex-red px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300">{session.isFull ? 'Full' : `${session.spotsRemaining} spots · Select`}</button>
          </div>)}</div>
        </article>)}
      </div>
    </section>

    {selected && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) setSelected(null) }}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        {result ? <div className="text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-green-600" /><h2 className="mt-4 text-2xl font-bold">Drop-in requested</h2><p className="mt-2 text-gray-600">{result.benefitType === 'free_trial' ? 'Your one-time free trial is reserved.' : result.benefitType === 'annual_credit' ? 'One annual member credit was applied.' : result.accountRequired ? 'Create your family account to finish this paid registration.' : 'Your spot is reserved and the one-time charge was added to your family account.'}</p>{result.accountRequired && <Link className="mt-5 inline-flex rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white" to={result.signupUrl ?? '/signup/family'}>Create your family account</Link>}<button className="mt-4 block w-full text-sm font-semibold" onClick={() => setSelected(null)}>Close</button></div> : <>
          <h2 className="text-2xl font-bold">Register for one day</h2><p className="mt-1 text-sm text-gray-600">{selected.className} · {prettyDate(selected.date)} · {prettyTime(selected.startTime)}</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">First name<input required className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label><label className="text-sm font-semibold">Last name<input required className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label></div>
            <label className="block text-sm font-semibold">Email<input required type="email" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="block text-sm font-semibold">Phone<input type="tel" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            {benefits?.trialAvailable && <label className="flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4"><input type="checkbox" checked={form.useFreeTrial} onChange={(e) => setForm({ ...form, useFreeTrial: e.target.checked })} /><span><strong>Use my one-time free trial</strong><span className="block text-sm text-gray-600">No annual membership is required. This trial is available once per athlete, for life.</span></span></label>}
            <div className="rounded-xl bg-gray-50 p-4 text-sm"><div className="flex justify-between"><span>Single-day price</span><strong>{form.useFreeTrial || (benefits?.annualCreditsRemaining ?? 0) > 0 ? '$0.00' : money(selected.totalCents)}</strong></div></div>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex gap-3"><button type="button" onClick={() => setSelected(null)} className="flex-1 rounded-lg border px-4 py-3 font-semibold">Cancel</button><button disabled={submitting} className="flex-1 rounded-lg bg-vortex-red px-4 py-3 font-semibold text-white disabled:opacity-60">{submitting ? 'Registering…' : 'Reserve class'}</button></div>
          </form>
        </>}
      </div>
    </div>}
  </div>
}
