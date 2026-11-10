import { useState, type FormEvent } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { request } from './api'
import { button, ErrorNotice } from './shared'
import { MetricCard } from './EnrollmentPopulation'
import { money, number, monthName, type AcquisitionMonth, type EnrollmentTrendData } from './enrollmentTypes'

function SpendEditor({ row, onSaved }: {row: AcquisitionMonth; onSaved: () => Promise<void>}) {
  const [amount, setAmount] = useState(row.spendCents == null ? '' : (row.spendCents / 100).toFixed(2))
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const value = amount.trim()
    if (value && !/^\d+(\.\d{1,2})?$/.test(value)) { setError('Enter dollars with up to two decimal places.'); return }
    const amountCents = value ? Math.round(Number(value) * 100) : null
    if (amountCents != null && (!Number.isSafeInteger(amountCents) || amountCents > 100000000000)) { setError('The amount is too large.'); return }
    setSaving(true); setError(null)
    try {
      await request(`/api/admin/new-admin/marketing-spend/${row.key}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({amountCents, version:row.version})})
      setSaved(true)
      await onSaved()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save marketing spending.') }
    finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="mt-4" aria-label="Monthly marketing spending">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm font-medium">Marketing spend ($)<input aria-label="Marketing spend in dollars" inputMode="decimal" value={amount} onChange={event => {setAmount(event.target.value); setSaved(false)}} disabled={saving || saved} placeholder="Not entered" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      <button type="submit" disabled={saving || saved} className={button}>{saving ? 'Saving…' : 'Save spending'}</button>
    </div>
    <p className="mt-2 text-xs text-slate-500">Enter 0 for a month with no spend. Leave blank to clear an entry.</p>
    <ErrorNotice message={error} onRetry={saved ? () => {void onSaved().catch(() => setError('Saved. Refresh the dashboard to load the updated calculations.'))} : undefined} />
  </form>
}

export default function AcquisitionPanel({ data, onRefresh }: {data: EnrollmentTrendData; onRefresh: (data: EnrollmentTrendData) => void}) {
  const [selectedMonth, setSelectedMonth] = useState(data.asOf.slice(0, 7))
  const [status, setStatus] = useState('')
  const acquisition = data.acquisition
  if (!acquisition) return <p className="mt-6 text-sm text-slate-500">Billing access is required to view membership costs and marketing value.</p>
  const row = acquisition.rows.find(item => item.key === selectedMonth) ?? acquisition.rows.at(-1)!
  const chart = acquisition.rows.map(item => ({...item, label:monthName(item.key), spend: item.spendCents == null ? null : item.spendCents / 100, cac: item.cacCents == null ? null : item.cacCents / 100}))
  const onSaved = async () => {
    const refreshed = await request<EnrollmentTrendData>('/api/admin/new-admin/enrollment-trend')
    onRefresh(refreshed); setStatus(`Marketing spending for ${monthName(row.key)} saved.`)
  }
  return <section className="mt-8" aria-label="Marketing acquisition and value">
    <h3 className="text-xl font-bold">Marketing acquisition &amp; membership value</h3>
    <p className="mt-1 text-sm text-slate-500">Estimated revenue from enrollment and the marketing spending you record.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Average membership cost per student" value={money(data.current.membership?.averageMembershipCents)} detail={`Per month · Net recurring tuition ÷ ${number(data.current.students)} current students. Excludes annual fees and one-time purchases.`} />
      <MetricCard label="Average acquisition cost per family" value={money(acquisition.cacCents)} detail={`${acquisition.includedMonths} completed months with spend entered · ${money(acquisition.totalSpendCents)} ÷ ${number(acquisition.newFamilies)} new families`} />
      <MetricCard label="Estimated family retention" value={acquisition.retentionMonths == null ? 'Unavailable' : `${number(acquisition.retentionMonths, 1)} months`} detail="1 ÷ average monthly family loss rate over the previous 12 months" />
      <MetricCard label="Value per marketing dollar" value={acquisition.revenuePerDollar == null ? 'Unavailable' : `$${number(acquisition.revenuePerDollar, 2)} per $1`} color="text-emerald-700" detail={<>Expected lifetime revenue · {money(acquisition.familyLifetimeRevenueCents)} per family ÷ acquisition cost. Revenue before expenses.</>} />
    </div>
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <h3 className="font-bold">Cost of acquisition</h3>
          <p className="mt-1 text-xs text-slate-500">Monthly marketing spend (left axis) and cost per new family (right axis)</p>
          {!acquisition.rows.some(item => item.spendCents != null) ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Add your monthly marketing spend to calculate acquisition costs.</p> : null}
          <div className="mt-4 h-72" role="img" aria-label="Marketing spending and acquisition cost by month. Exact values follow in the table.">
            <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart} margin={{top:10,right:0,left:0,bottom:8}} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{fontSize:11}} minTickGap={20} />
              <YAxis yAxisId="spend" tickFormatter={value => `$${value}`} width={65} tick={{fontSize:11}} />
              <YAxis yAxisId="cac" orientation="right" tickFormatter={value => `$${value}`} width={60} tick={{fontSize:11}} />
              <Tooltip formatter={(value, name) => [money(Number(value) * 100), name]} />
              <Legend wrapperStyle={{fontSize:12}} />
              <Bar yAxisId="spend" dataKey="spend" name="Marketing spend" fill="#2563eb" radius={[4,4,0,0]} isAnimationActive={false} maxBarSize={35} />
              <Line yAxisId="cac" dataKey="cac" name="Cost per new family" stroke="#059669" strokeWidth={3} connectNulls={false} isAnimationActive={false} />
            </ComposedChart></ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <h4 className="font-semibold">Monthly marketing spend</h4>
          {data.permissions.canEditMarketing ? <>
            <label className="mt-4 block text-sm font-medium">Month<select aria-label="Marketing spend month" value={row.key} onChange={event => {setSelectedMonth(event.target.value); setStatus('')}} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              {acquisition.rows.map(item => <option key={item.key} value={item.key}>{monthName(item.key)}{item.partial ? ' · Month to date' : ''}</option>)}
            </select></label>
            <SpendEditor key={`${row.key}:${row.version}`} row={row} onSaved={onSaved} />
          </> : <p className="mt-3 text-sm text-slate-500">Marketing management access is required to edit spending.</p>}
          <p className="mt-3 text-xs text-slate-600" role="status">{status}</p>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">Current-month spending appears in the chart. Summary acquisition costs use completed months only.</p>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm">
        <caption className="sr-only">Monthly marketing spend and acquisition cost</caption>
        <thead className="border-b text-xs text-slate-500"><tr>{['Month','Marketing spend','New families','Cost per new family'].map(label => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{acquisition.rows.map(item => <tr key={item.key}>
          <th scope="row" className="px-3 py-3">{monthName(item.key)}{item.partial ? ' (month to date)' : ''}</th>
          <td className="px-3 py-3">{item.spendCents == null ? 'Not entered' : money(item.spendCents)}</td>
          <td className="px-3 py-3">{number(item.newFamilies)}</td><td className="px-3 py-3 font-semibold text-emerald-700">{money(item.cacCents)}</td>
        </tr>)}</tbody>
      </table></div>
      <details className="mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-600"><summary className="cursor-pointer font-semibold">Marketing value calculations</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Monthly acquisition cost = marketing spend ÷ new families. The average is total spending ÷ total new families in the same completed months; months without spend entered are excluded.</li>
          <li>Monthly membership cost per student = net active recurring enrollment tuition ÷ current students. Paused subscriptions contribute $0. {data.current.membership?.pricedStudents ?? 0} students have a matching recurring subscription.</li>
          <li>Estimated family lifetime revenue = monthly membership cost per student × average students per family × estimated retention months.</li>
          <li>Value per marketing dollar = estimated family lifetime revenue ÷ average cost to acquire a family. This estimate assumes the current student mix and loss rate continue; it is revenue before operating expenses, not profit or a guarantee.</li>
          <li>All new families are used, including referrals and organic enrollment. This is a blended acquisition estimate, not campaign attribution. Zero or unknown loss rates cannot produce a finite retention estimate; zero acquisition cost cannot produce a return ratio.</li>
        </ul>
      </details>
    </div>
  </section>
}
