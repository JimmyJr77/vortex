import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useRead, type BillingTarget } from './api'
import BillingDashboard from './BillingDashboard'
import EnrollmentPopulation, { MetricCard } from './EnrollmentPopulation'
import AcquisitionPanel from './AcquisitionPanel'
import { number, monthName, type EnrollmentTrendData } from './enrollmentTypes'
export type { EnrollmentTrendData } from './enrollmentTypes'
import { ErrorNotice, Loading } from './shared'

const VIEWS = ['Timeline', 'Bar graph', 'Table'] as const
const rate = (value: number | null | undefined) => value == null ? 'Unavailable' : `${value.toFixed(1)}%`

export default function EnrollmentDashboard({ revision, canViewBilling, onBilling }: { revision: number; canViewBilling: boolean; onBilling: (target: BillingTarget) => void }) {
  const [retry, setRetry] = useState(0)
  const result = useRead<EnrollmentTrendData>('/api/admin/new-admin/enrollment-trend', revision + retry)
  return <><section aria-label="Enrollment & Loss Data">
    <div className="mb-5"><p className="text-xs font-bold uppercase tracking-widest text-red-700">Family growth & retention</p><h2 className="mt-1 text-2xl font-bold">Enrollment &amp; Loss Data</h2><p className="mt-2 text-sm text-slate-600">Family growth, student enrollment, retention and marketing value.</p></div>
    {result.loading ? <Loading label="Loading family enrollment history…" /> : null}
    <ErrorNotice message={result.error} onRetry={() => setRetry(value => value + 1)} />
    {result.data ? <EnrollmentContent initialData={result.data} /> : null}
  </section>
    {canViewBilling ? <BillingDashboard revision={revision} onBilling={onBilling} /> : null}
  </>
}

function EnrollmentContent({ initialData }: {initialData: EnrollmentTrendData}) {
  const [data, setData] = useState(initialData)
  return <>
    <EnrollmentTrend data={data} />
    {data.current ? <EnrollmentPopulation current={data.current} asOf={data.asOf} /> : null}
    {data.current && data.permissions ? <AcquisitionPanel data={data} onRefresh={setData} /> : null}
  </>
}

function EnrollmentTrend({ data }: { data: EnrollmentTrendData }) {
  const [view, setView] = useState<typeof VIEWS[number]>('Timeline')
  const [population, setPopulation] = useState<'Families' | 'Students'>('Families')
  const students = population === 'Students'
  const noun = students ? 'students' : 'families'
  const title = students ? 'Student' : 'Family'
  const months = students ? (data.studentMonths ?? []).map(row => ({...row, openingFamilies: row.openingStudents,
    newFamilies: row.newStudents, canceledFamilies: row.canceledStudents, lostFamilies: row.lostStudents})) : data.months
  const hasData = months.some(row => row.newFamilies != null)
  const latest = data.months.at(-1)
  const summary = data.summary
  // Frontend and backend releases can arrive independently. Older API responses
  // still contain the full timeline; show expanded cards once their data arrives.
  const period = data.rollingMonths?.length ? `${monthName(data.rollingMonths[0].key)} – ${monthName(data.rollingMonths.at(-1)!.key)}` : null
  const coverage = (count: number, expected: number) => count === expected ? `${count} completed months` : `${count} of ${expected} months with recorded data`
  return <>
    {summary && period ? <><p className="mb-3 text-sm text-slate-500">Rolling summary · {period} · Excludes the current month</p>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: 'New Families last 12 months', value: number(summary.newFamilies), detail: coverage(summary.newFamilyMonths, 12), color: 'text-blue-700' },
        { label: 'Avg new families per month', value: number(summary.averageNewFamilies, 1), detail: coverage(summary.newFamilyMonths, 12), color: 'text-blue-700' },
        { label: 'Cancellations last 12 months', value: number(summary.cancellations), detail: coverage(summary.cancellationMonths, 12), color: 'text-amber-700' },
        { label: 'Avg cancellations per month', value: number(summary.averageCancellations, 1), detail: coverage(summary.cancellationMonths, 12), color: 'text-amber-700' },
        { label: 'Last month loss rate', value: rate(summary.lastMonthLossRate), detail: monthName(data.rollingMonths.at(-1)!.key), color: 'text-red-700' },
        { label: 'Previous 3 months avg loss rate', value: rate(summary.threeMonthLossRate), detail: coverage(summary.threeMonthRateMonths, 3), color: 'text-red-700' },
        { label: 'Previous 12 months avg loss rate', value: rate(summary.twelveMonthLossRate), detail: coverage(summary.twelveMonthRateMonths, 12), color: 'text-red-700' },
      ].map(card => <MetricCard key={card.label} {...card} />)}
    </div></> : null}
    <div role="group" aria-label={`${title} enrollment trend`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h3 className="font-bold">{title} enrollment trend · {data.year}</h3><p className="mt-1 text-sm text-slate-500">January – {latest?.label} · As of {data.asOf}{latest?.partial ? ' · Current month is partial' : ''}</p></div>
        <div className="flex flex-wrap gap-2">
        {data.studentMonths ? <div role="group" aria-label="Enrollment population" className="flex rounded-xl bg-slate-100 p-1">
          {(['Families', 'Students'] as const).map(option => <button key={option} type="button" aria-pressed={population === option} onClick={() => setPopulation(option)} className={`rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-red-600 ${population === option ? 'bg-white shadow-sm' : 'text-slate-600'}`}>{option}</button>)}
        </div> : null}
        <div role="group" aria-label="Enrollment trend view" className="flex rounded-xl bg-slate-100 p-1">
          {VIEWS.map(option => <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${view === option ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}>{option}</button>)}
        </div>
        </div>
      </div>
      {!hasData ? <p className="py-12 text-center text-sm text-slate-500">No enrollment history is available for this year.</p> : view === 'Table' ? <div className="mt-5 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <caption className="sr-only">Monthly {noun} enrollment and loss rate for {data.year}. Cancellations include new {noun} who leave in the same month; loss rate uses only the starting cohort.</caption>
          <thead className="border-b border-slate-200 text-xs text-slate-500"><tr>{['Month', `Starting ${noun}`, `New ${noun}`, 'Cancellations', `Starting ${noun} lost`, 'Loss rate'].map(label => <th scope="col" key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{months.map(row => <tr key={row.key}>
            <th scope="row" className="px-3 py-3 font-semibold">{row.label}{row.partial ? ' (partial)' : ''}</th>
            <td className="px-3 py-3 text-slate-600">{row.openingFamilies ?? 'Unavailable'}</td>
            <td className="px-3 py-3 font-semibold text-blue-700">{row.newFamilies ?? 'Unavailable'}</td>
            <td className="px-3 py-3 font-semibold text-amber-700">{row.canceledFamilies ?? 'Unavailable'}</td>
            <td className="px-3 py-3 text-slate-600">{row.lostFamilies ?? 'Unavailable'}</td>
            <td className="px-3 py-3 font-semibold text-red-700">{rate(row.lossRate)}</td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="mt-5">
        <p className="mb-3 text-xs text-slate-500">Left axis: {noun} (count) · Right axis: loss rate (%) · Table shows exact values.</p>
        <div className="h-80 w-full" role="img" aria-label={`${view} of monthly new ${noun}, cancellations and ${title.toLowerCase()} loss percentage. Exact values are available in the Table view.`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={months} margin={{ top: 12, right: 0, bottom: 8, left: 0 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={12} />
              <YAxis yAxisId="families" allowDecimals={false} tick={{ fontSize: 12 }} width={32} domain={[0, 'auto']} />
              <YAxis yAxisId="rate" orientation="right" tickFormatter={value => `${value}%`} domain={[0, 'auto']} tick={{ fontSize: 12, fill: '#b91c1c' }} width={48} />
              <Tooltip formatter={(value, name) => [name === 'Loss rate' ? `${Number(value).toFixed(1)}%` : `${value} ${noun}`, name]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as EnrollmentTrendData['months'][number] | undefined
                  return row ? `${row.label} ${data.year}${row.partial ? ' · Partial month' : ''}` : ''
                }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {view === 'Bar graph' ? <>
                <Bar yAxisId="families" dataKey="newFamilies" name={`New ${noun}`} fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                <Bar yAxisId="families" dataKey="canceledFamilies" name="Cancellations" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </> : <>
                <Line yAxisId="families" dataKey="newFamilies" name={`New ${noun}`} stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
                <Line yAxisId="families" dataKey="canceledFamilies" name="Cancellations" stroke="#d97706" strokeDasharray="6 4" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
              </>}
              <Line yAxisId="rate" dataKey="lossRate" name="Loss rate" stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>}
      <details className="mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">Calculation details</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5">{(students ? data.studentNotes ?? [] : data.notes).map(note => <li key={note}>{note}</li>)}</ul>
      </details>
    </div>
  </>
}
