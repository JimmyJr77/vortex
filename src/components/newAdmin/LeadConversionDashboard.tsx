import { useState, type FormEvent } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useRead } from './api'
import { ErrorNotice, Loading } from './shared'

const SERIES = [
  { key: 'inquiries', label: 'Inquiries', color: '#2563eb' },
  { key: 'freeTrials', label: 'Free trials', color: '#9333ea' },
  { key: 'dropIns', label: 'Non-member drop-ins', color: '#d97706' },
  { key: 'directSignups', label: 'Direct sign-ups', color: '#0891b2' },
  { key: 'conversions', label: 'Conversions', color: '#047857' },
] as const
type Measure = typeof SERIES[number]['key']
type Counts = Record<Measure, number>
interface ConversionTrend {
  start: string; end: string; today: string; timezone: string; interval: string; totals: Counts
  buckets: (Counts & { key: string; start: string; end: string })[]
}
const VIEWS = ['Timeline', 'Bar graph', 'Table'] as const
const dayLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export default function LeadConversionDashboard({ revision }: { revision: number }) {
  const [retry, setRetry] = useState(0)
  const [range, setRange] = useState({ start: '', end: '', interval: 'month' })
  const [view, setView] = useState<typeof VIEWS[number]>('Timeline')
  const [selected, setSelected] = useState<Measure[]>(SERIES.map(series => series.key))
  const params = new URLSearchParams({ interval: range.interval })
  if (range.start) params.set('start', range.start)
  if (range.end) params.set('end', range.end)
  const result = useRead<ConversionTrend>(`/api/admin/new-admin/lead-conversion-trend?${params}`, revision + retry)
  const data = result.data
  const visible = SERIES.filter(series => selected.includes(series.key))
  function applyDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setRange({ start: String(fields.get('start')), end: String(fields.get('end')), interval: String(fields.get('interval')) })
  }
  return <section aria-label="Leads & conversions" className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-red-700">Lead activity & membership growth</p><h2 className="mt-1 text-2xl font-bold">Leads &amp; conversions</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Track inquiries and bookings alongside each family’s first annual membership purchase. Direct sign-ups are included in conversions.</p></div>
      <div role="group" aria-label="Lead conversion view" className="flex flex-wrap rounded-xl bg-slate-100 p-1">
        {VIEWS.map(option => <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-red-600 ${view === option ? 'bg-white shadow-sm' : 'text-slate-600'}`}>{option}</button>)}
      </div>
    </div>
    {result.loading ? <Loading label="Loading lead and conversion history…" /> : null}
    <ErrorNotice message={result.error} onRetry={() => setRetry(value => value + 1)} />
    {(data || range.start) ? <form key={`${data?.start ?? range.start}:${data?.end ?? range.end}:${range.interval}`} onSubmit={applyDates} className="mt-5 flex flex-wrap items-end gap-3" aria-label="Lead conversion dates">
      <label className="text-sm font-semibold">From<input name="start" type="date" required max={data?.today} defaultValue={data?.start ?? range.start} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" /></label>
      <label className="text-sm font-semibold">Through<input name="end" type="date" required max={data?.today} defaultValue={data?.end ?? range.end} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" /></label>
      <label className="text-sm font-semibold">Group by<select aria-label="Group by" name="interval" defaultValue={range.interval} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
      <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Apply dates</button>
      <button type="button" onClick={() => setRange({ start: '', end: '', interval: 'month' })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Last 12 months</button>
    </form> : null}
    {data ? <>
      <p className="mt-3 text-xs text-slate-500">{dayLabel(data.start)} – {dayLabel(data.end)} · {data.timezone} · Weeks start Monday</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {SERIES.map(series => <div key={series.key} className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-600">{series.label}</p><p className="mt-1 text-3xl font-bold tabular-nums" style={{ color: series.color }}>{data.totals[series.key].toLocaleString()}</p>{series.key === 'directSignups' ? <p className="mt-1 text-xs text-slate-500">Included in conversions</p> : null}</div>)}
      </div>
      <fieldset className="mt-5"><legend className="mb-2 text-sm font-semibold">Show on chart or table</legend><div className="flex flex-wrap gap-x-5 gap-y-3">
        {SERIES.map(series => <label key={series.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(series.key)} onChange={event => setSelected(current => event.target.checked ? [...current, series.key] : current.filter(key => key !== series.key))} className="h-4 w-4 accent-red-700" /><span style={{ color: series.color }}>{series.label}</span></label>)}
      </div></fieldset>
      {!visible.length ? <p className="py-12 text-center text-sm text-slate-500">Select at least one series to display.</p> : view === 'Table' ? <div className="mt-5 overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm">
        <caption className="sr-only">Lead activity and first annual membership purchases by period</caption>
        <thead className="border-b text-xs text-slate-500"><tr><th scope="col" className="px-3 py-3">Period</th>{visible.map(series => <th scope="col" className="px-3 py-3 text-right" key={series.key}>{series.label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{data.buckets.map(row => <tr key={row.key}><th scope="row" className="px-3 py-3 font-semibold">{dayLabel(row.start)}{row.end !== row.start ? ` – ${dayLabel(row.end)}` : ''}</th>{visible.map(series => <td key={series.key} className="px-3 py-3 text-right tabular-nums">{row[series.key].toLocaleString()}</td>)}</tr>)}</tbody>
        <tfoot className="border-t font-bold"><tr><th scope="row" className="px-3 py-3">Total</th>{visible.map(series => <td key={series.key} className="px-3 py-3 text-right">{data.totals[series.key].toLocaleString()}</td>)}</tr></tfoot>
      </table></div> : <div className="mt-5 h-80 w-full" role="img" aria-label={`${view} of lead activity and conversions. Exact values are available in Table view.`}>
        <ResponsiveContainer width="100%" height={320} minWidth={0}><ComposedChart data={data.buckets} accessibilityLayer margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="start" tickFormatter={dayLabel} tick={{ fontSize: 11 }} minTickGap={30} /><YAxis allowDecimals={false} width={32} />
          <Tooltip labelFormatter={(_, payload) => { const row = payload?.[0]?.payload as ConversionTrend['buckets'][number] | undefined; return row ? `${dayLabel(row.start)} – ${dayLabel(row.end)}` : '' }} /><Legend wrapperStyle={{ fontSize: 12 }} />
          {visible.map(series => view === 'Bar graph' ? <Bar key={series.key} dataKey={series.key} name={series.label} fill={series.color} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            : <Line key={series.key} dataKey={series.key} name={series.label} stroke={series.color} strokeWidth={series.key === 'conversions' ? 3 : 2} strokeDasharray={series.key === 'directSignups' ? '5 3' : undefined} dot={false} isAnimationActive={false} />)}
        </ComposedChart></ResponsiveContainer>
      </div>}
      {Object.values(data.totals).every(value => value === 0) ? <p className="mt-4 text-sm text-slate-500">No recorded lead or conversion activity in this date range.</p> : null}
      <details className="mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-600"><summary className="cursor-pointer font-semibold">How these numbers are counted</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5"><li>Conversions count each family’s first recorded annual membership purchase once. Renewals and additional siblings do not add conversions. Expired memberships remain in history.</li>
          <li>Inquiries use the submission date. Generated free-trial history is folded into the original lead; separate inquiry submissions remain separate.</li>
          <li>Free trials and non-member drop-ins count confirmed or attended bookings on the date booked. Cancelled and pending bookings are excluded. Non-member status is checked for the class date.</li>
          <li>Direct sign-ups are conversions without an earlier linked lead or qualifying booking through the purchase date. They are a subset of conversions. Activity series can overlap and count different events; adding them together does not give a unique lead total.</li>
          <li>Dates use the facility’s timezone. Only recorded history and verified family links are used; missing historical records can limit attribution.</li></ul>
      </details>
    </> : null}
  </section>
}
