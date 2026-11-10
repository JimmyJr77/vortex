import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface EnrollmentTrendData {
  year: number
  asOf: string
  months: Array<{
    key: string
    label: string
    openingFamilies: number | null
    newFamilies: number | null
    lostFamilies: number | null
    lossRate: number | null
    partial: boolean
    provisional: boolean
  }>
  notes: string[]
}

const VIEWS = ['Timeline', 'Bars', 'Table'] as const
const rate = (value: number | null) => value == null ? 'Unavailable' : `${value.toFixed(1)}%`

export default function EnrollmentTrend({ data }: { data: EnrollmentTrendData }) {
  const [view, setView] = useState<typeof VIEWS[number]>('Timeline')
  const hasData = data.months.some(row => row.newFamilies != null || row.lossRate != null)
  const latest = data.months.at(-1)
  return (
    <section aria-label="Family enrollment trend" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-950">Family enrollment trend · {data.year}</h3>
          <p className="mt-1 text-sm text-gray-500">Monthly family loss rate and new family enrollments, since January.</p>
          <p className="mt-1 text-xs text-gray-500">As of {data.asOf}{latest?.partial ? ' · Current month is partial' : ''}{data.months.some(row => row.provisional) ? ' · Provisional months marked *' : ''}</p>
        </div>
        <div role="group" aria-label="Enrollment trend view" className="flex rounded-xl bg-gray-100 p-1">
          {VIEWS.map(option => <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${view === option ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-600 hover:text-gray-950'}`}>{option}</button>)}
        </div>
      </div>
      {!hasData ? <p className="py-12 text-center text-sm text-gray-500">No enrollment history is available for this year.</p> : view === 'Table' ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <caption className="sr-only">Monthly family enrollment and loss rate for {data.year}. Unavailable rates have no verified opening population.</caption>
            <thead className="border-b border-gray-200 text-xs text-gray-500"><tr>
              {['Month', 'Opening families', 'New families', 'Families lost', 'Loss rate'].map(label => <th scope="col" key={label} className="px-3 py-3 font-semibold">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">{data.months.map(row => <tr key={row.key}>
              <th scope="row" className="px-3 py-3 font-semibold text-gray-900">{row.label}{row.provisional ? '*' : ''}{row.partial ? ' (partial)' : ''}</th>
              <td className="px-3 py-3 text-gray-600">{row.openingFamilies ?? 'Unavailable'}</td>
              <td className="px-3 py-3 font-semibold text-blue-700">{row.newFamilies ?? 'Unavailable'}</td>
              <td className="px-3 py-3 text-gray-600">{row.lostFamilies ?? 'Unavailable'}</td>
              <td className="px-3 py-3 font-semibold text-red-700">{rate(row.lossRate)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5">
          <p className="mb-3 text-xs text-gray-500">Left axis: family loss rate (%) · Right axis: new families (count). Use Table for exact values.</p>
          <div className="h-80 w-full" role="img" aria-label={`${view} of monthly family loss percentage and new family counts. Exact values are available in the Table view.`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.months} margin={{ top: 12, right: 12, bottom: 8, left: 0 }} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tickFormatter={(label, index) => `${label}${data.months[index]?.provisional ? '*' : ''}`} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="rate" tickFormatter={value => `${value}%`} domain={[0, 'auto']} tick={{ fontSize: 12, fill: '#b91c1c' }} width={52} />
                <YAxis yAxisId="families" orientation="right" allowDecimals={false} tick={{ fontSize: 12, fill: '#1d4ed8' }} width={40} />
                <Tooltip formatter={(value, name) => [name === 'Family loss rate' ? `${Number(value).toFixed(1)}%` : `${value} families`, name]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as EnrollmentTrendData['months'][number] | undefined
                    return row ? `${row.label} ${data.year}${row.partial ? ' · Partial month' : ''}${row.provisional ? ' · Provisional' : ''}` : ''
                  }} />
                <Legend />
                {view === 'Bars' ? <>
                  <Bar yAxisId="rate" dataKey="lossRate" name="Family loss rate" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                  <Bar yAxisId="families" dataKey="newFamilies" name="New families" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                </> : <>
                  <Line yAxisId="rate" dataKey="lossRate" name="Family loss rate" stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
                  <Line yAxisId="families" dataKey="newFamilies" name="New families" stroke="#2563eb" strokeDasharray="5 3" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
                </>}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <details className="mt-4 border-t border-gray-100 pt-4 text-xs text-gray-600">
        <summary className="cursor-pointer font-semibold text-gray-700">How these figures are calculated and data coverage</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5">{data.notes.map(note => <li key={note}>{note}</li>)}</ul>
      </details>
    </section>
  )
}
