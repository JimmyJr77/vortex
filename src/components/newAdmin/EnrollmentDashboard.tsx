import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useRead } from './api'
import { ErrorNotice, Loading } from './shared'

export interface EnrollmentTrendData {
  year: number
  asOf: string
  coverageStart: string | null
  months: Array<{
    key: string; label: string; openingFamilies: number | null; newFamilies: number | null
    canceledFamilies: number | null; lostFamilies: number | null; lossRate: number | null
    partial: boolean; provisional: boolean
  }>
  notes: string[]
}
const VIEWS = ['Timeline', 'Bar graph', 'Table'] as const
const rate = (value: number | null | undefined) => value == null ? 'Unavailable' : `${value.toFixed(1)}%`

export default function EnrollmentDashboard({ revision }: { revision: number }) {
  const [retry, setRetry] = useState(0)
  const result = useRead<EnrollmentTrendData>('/api/admin/new-admin/enrollment-trend', revision + retry)
  return <section aria-label="Monthly family loss dashboard">
    <div className="mb-5"><p className="text-xs font-bold uppercase tracking-widest text-red-700">Family growth & retention</p><h2 className="mt-1 text-2xl font-bold">Monthly loss rate</h2><p className="mt-2 text-sm text-slate-600">New families, cancellations and retention from January onward.</p></div>
    {result.loading ? <Loading label="Loading family enrollment history…" /> : null}
    <ErrorNotice message={result.error} onRetry={() => setRetry(value => value + 1)} />
    {result.data ? <EnrollmentTrend data={result.data} /> : null}
  </section>
}

function EnrollmentTrend({ data }: { data: EnrollmentTrendData }) {
  const [view, setView] = useState<typeof VIEWS[number]>('Timeline')
  const hasData = data.months.some(row => row.newFamilies != null)
  const latest = data.months.at(-1)
  const provisional = data.months.some(row => row.provisional)
  const newTotal = hasData ? data.months.reduce((sum, row) => sum + (row.newFamilies ?? 0), 0) : 'Unavailable'
  const cancelTotal = hasData ? data.months.reduce((sum, row) => sum + (row.canceledFamilies ?? 0), 0) : 'Unavailable'
  return <>
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      {[
        { label: `New families · ${data.year}`, value: newTotal, detail: 'First recorded enrollment per family', color: 'text-blue-700' },
        { label: `Cancellations · ${data.year}`, value: cancelTotal, detail: 'Sum of monthly family cancellations', color: 'text-amber-700' },
        { label: `${latest?.label ?? ''} loss rate${latest?.partial ? ' · Month to date' : ''}`, value: rate(latest?.lossRate), detail: `${latest?.lostFamilies ?? '—'} starting families lost / ${latest?.openingFamilies ?? '—'} starting families${latest?.provisional ? ' · Provisional' : ''}`, color: 'text-red-700' },
      ].map(card => <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm font-medium text-slate-600">{card.label}</p><p className={`mt-2 text-3xl font-bold ${card.color}`}>{card.value}</p><p className="mt-2 text-xs text-slate-500">{card.detail}</p></div>)}
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h3 className="font-bold">Family enrollment trend · {data.year}</h3><p className="mt-1 text-sm text-slate-500">January – {latest?.label} · As of {data.asOf}{latest?.partial ? ' · Current month is partial' : ''}</p></div>
        <div role="group" aria-label="Enrollment trend view" className="flex rounded-xl bg-slate-100 p-1">
          {VIEWS.map(option => <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${view === option ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}>{option}</button>)}
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">Loss rate = starting families lost ÷ starting enrolled families × 100.</p>
      {hasData && (provisional || data.coverageStart) ? <p role="note" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
        {data.coverageStart ? `Recorded history begins ${data.coverageStart}. ` : ''}{provisional ? 'Months marked * are provisional because enrollment history has gaps. ' : ''}Unavailable means the starting population cannot be established. See calculation details below.
      </p> : null}
      {!hasData ? <p className="py-12 text-center text-sm text-slate-500">No enrollment history is available for this year.</p> : view === 'Table' ? <div className="mt-5 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <caption className="sr-only">Monthly family enrollment and loss rate for {data.year}. Cancellations include new families who leave in the same month; loss rate uses only the starting cohort.</caption>
          <thead className="border-b border-slate-200 text-xs text-slate-500"><tr>{['Month', 'Starting families', 'New families', 'Cancellations', 'Starting families lost', 'Loss rate'].map(label => <th scope="col" key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{data.months.map(row => <tr key={row.key}>
            <th scope="row" className="px-3 py-3 font-semibold">{row.label}{row.provisional ? '*' : ''}{row.partial ? ' (partial)' : ''}</th>
            <td className="px-3 py-3 text-slate-600">{row.openingFamilies ?? 'Unavailable'}</td>
            <td className="px-3 py-3 font-semibold text-blue-700">{row.newFamilies ?? 'Unavailable'}</td>
            <td className="px-3 py-3 font-semibold text-amber-700">{row.canceledFamilies ?? 'Unavailable'}</td>
            <td className="px-3 py-3 text-slate-600">{row.lostFamilies ?? 'Unavailable'}</td>
            <td className="px-3 py-3 font-semibold text-red-700">{rate(row.lossRate)}</td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="mt-5">
        <p className="mb-3 text-xs text-slate-500">Left axis: families (count) · Right axis: loss rate (%) · Table shows exact values.</p>
        <div className="h-80 w-full" role="img" aria-label={`${view} of monthly new families, cancellations and family loss percentage. Exact values are available in the Table view.`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.months} margin={{ top: 12, right: 0, bottom: 8, left: 0 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tickFormatter={(label, index) => `${label}${data.months[index]?.provisional ? '*' : ''}`} tick={{ fontSize: 12 }} minTickGap={12} />
              <YAxis yAxisId="families" allowDecimals={false} tick={{ fontSize: 12 }} width={32} domain={[0, 'auto']} />
              <YAxis yAxisId="rate" orientation="right" tickFormatter={value => `${value}%`} domain={[0, 'auto']} tick={{ fontSize: 12, fill: '#b91c1c' }} width={48} />
              <Tooltip formatter={(value, name) => [name === 'Loss rate' ? `${Number(value).toFixed(1)}%` : `${value} families`, name]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as EnrollmentTrendData['months'][number] | undefined
                  return row ? `${row.label} ${data.year}${row.partial ? ' · Partial month' : ''}${row.provisional ? ' · Provisional' : ''}` : ''
                }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {view === 'Bar graph' ? <>
                <Bar yAxisId="families" dataKey="newFamilies" name="New families" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                <Bar yAxisId="families" dataKey="canceledFamilies" name="Cancellations" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </> : <>
                <Line yAxisId="families" dataKey="newFamilies" name="New families" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
                <Line yAxisId="families" dataKey="canceledFamilies" name="Cancellations" stroke="#d97706" strokeDasharray="6 4" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
              </>}
              <Line yAxisId="rate" dataKey="lossRate" name="Loss rate" stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>}
      <details className="mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">Calculation details & data coverage</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5">{data.notes.map(note => <li key={note}>{note}</li>)}</ul>
      </details>
    </div>
  </>
}
