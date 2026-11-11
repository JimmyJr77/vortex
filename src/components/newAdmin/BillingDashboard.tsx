import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useRead, type BillingTarget } from './api'
import { ErrorNotice, Loading, button } from './shared'
import { MetricCard } from './EnrollmentPopulation'
import { money, monthName } from './enrollmentTypes'

type Breakdown = 'class' | 'gender' | 'age'
interface RevenueMonth {
  key: string; partial: boolean; receiptsCents: number; refundsCents: number; netCents: number
  breakdowns: Record<Breakdown, Record<string, number>>
}
interface AccountBalance {
  accountId: number; familyId: number; familyName: string; balanceCents: number
  overdueCents: number; currentCents: number; futureCents: number; creditCents: number
}
interface BillingData {
  asOf: string; months: RevenueMonth[]; notes: string[]
  summary: { twelveMonthIncomeCents: number; averageMonthlyIncomeCents: number; threeMonthIncomeCents: number; threeMonthAverageCents: number; lastMonthIncomeCents: number }
  unpaid: AccountBalance[]; credits: AccountBalance[]
}
const VIEWS = ['Timeline', 'Bar graph', 'Table'] as const
const COLORS = ['#2563eb', '#059669', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#4f46e5', '#be185d']
const panel = 'mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'

export default function BillingDashboard({ revision, onBilling }: { revision: number; onBilling: (target: BillingTarget) => void }) {
  const [retry, setRetry] = useState(0)
  const result = useRead<BillingData>('/api/admin/new-admin/billing-dashboard', revision + retry)
  return <section aria-label="Billing & Revenue" className="mt-10 border-t border-slate-200 pt-8">
    <p className="text-xs font-bold uppercase tracking-widest text-red-700">Income &amp; account balances</p>
    <h2 className="mt-1 text-2xl font-bold">Billing &amp; Revenue</h2>
    <p className="mt-2 text-sm text-slate-600">Collected income, outstanding bills and available account credits.</p>
    {result.loading ? <Loading label="Loading revenue and account balances…" /> : null}
    <ErrorNotice message={result.error} onRetry={() => setRetry(value => value + 1)} />
    {result.data ? <BillingContent data={result.data} onBilling={onBilling} /> : null}
  </section>
}

function BillingContent({ data, onBilling }: { data: BillingData; onBilling: (target: BillingTarget) => void }) {
  const completed = data.months.filter(row => !row.partial), summary = data.summary
  const period = `${monthName(completed[0].key)} – ${monthName(completed.at(-1)!.key)}`
  return <>
    <p className="mt-5 text-sm text-slate-500">Net collected income · Payments minus refunds · Completed months</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Income last 12 months" value={money(summary.twelveMonthIncomeCents)} detail={period} />
      <MetricCard label="Avg monthly income last 12 months" value={money(summary.averageMonthlyIncomeCents)} detail="Net income ÷ 12 completed months" />
      <MetricCard label="Income last 3 months" value={money(summary.threeMonthIncomeCents)} detail={`${monthName(completed.at(-3)!.key)} – ${monthName(completed.at(-1)!.key)}`} />
      <MetricCard label="Avg monthly income last 3 months" value={money(summary.threeMonthAverageCents)} detail="Net income ÷ 3 completed months" />
      <MetricCard label="Last month income" value={money(summary.lastMonthIncomeCents)} detail={monthName(completed.at(-1)!.key)} />
    </div>
    <RevenueTrend months={data.months} />
    <AccountBalances data={data} onBilling={onBilling} />
    <details className="mt-5 text-xs leading-relaxed text-slate-600"><summary className="cursor-pointer font-semibold">Revenue and balance calculation details</summary>
      <ul className="mt-3 list-disc space-y-2 pl-5">{data.notes.map(note => <li key={note}>{note}</li>)}</ul>
    </details>
  </>
}

function RevenueTrend({ months }: { months: RevenueMonth[] }) {
  const [view, setView] = useState<typeof VIEWS[number]>('Timeline')
  const [group, setGroup] = useState<'all' | Breakdown>('all')
  const [segment, setSegment] = useState('')
  const labels = group === 'all' ? [] : [...new Set(months.flatMap(row => Object.keys(row.breakdowns[group])))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const series = group === 'all' ? ['All revenue'] : segment && labels.includes(segment) ? [segment] : labels
  const value = (row: RevenueMonth, label: string) => group === 'all' ? row.netCents : row.breakdowns[group][label] ?? 0
  return <div role="group" aria-label="Revenue trend" className={panel}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h3 className="font-bold">Revenue trend</h3><p className="mt-1 text-sm text-slate-500">Previous 12 months plus this month to date</p></div>
      <div role="group" aria-label="Revenue trend view" className="flex rounded-xl bg-slate-100 p-1">
        {VIEWS.map(option => <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)} className={`rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-red-600 ${view === option ? 'bg-white shadow-sm' : 'text-slate-600'}`}>{option}</button>)}
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-3">
      <label className="text-sm font-medium">View revenue<select aria-label="Revenue breakdown" value={group} onChange={event => { setGroup(event.target.value as typeof group); setSegment('') }} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
        <option value="all">All</option><option value="class">By class</option><option value="gender">By gender</option><option value="age">By age</option>
      </select></label>
      {group !== 'all' ? <label className="text-sm font-medium">Show<select aria-label="Revenue segment" value={segment} onChange={event => setSegment(event.target.value)} className="ml-2 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
        <option value="">All {group === 'class' ? 'classes' : group === 'gender' ? 'genders' : 'ages'}</option>{labels.map(label => <option key={label} value={label}>{label}</option>)}
      </select></label> : null}
    </div>
    {view === 'Table' ? <div className="mt-5 overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm">
      <caption className="sr-only">Monthly revenue {group === 'all' ? 'totals' : `by ${group}`}</caption>
      <thead className="border-b text-xs text-slate-500"><tr><th scope="col" className="p-3">Month</th>{group === 'all' ? <><th scope="col" className="p-3">Payments</th><th scope="col" className="p-3">Refunds</th></> : null}{series.map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{months.map(row => <tr key={row.key}><th scope="row" className="p-3">{monthName(row.key)}{row.partial ? ' (month to date)' : ''}</th>
        {group === 'all' ? <><td className="p-3">{money(row.receiptsCents)}</td><td className="p-3">{money(row.refundsCents)}</td></> : null}
        {series.map(label => <td key={label} className="p-3 font-semibold">{money(value(row, label))}</td>)}</tr>)}</tbody>
    </table></div> : <div className="mt-5 h-96" role="img" aria-label={`${view} of monthly revenue ${group === 'all' ? 'for all accounts' : `by ${group}`}. Exact values are available in Table view.`}>
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={months} stackOffset="sign" margin={{ top: 12, right: 8, bottom: 8, left: 0 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="key" tickFormatter={monthName} minTickGap={25} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={cents => `$${Number(cents) / 100}`} width={80} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(cents, label) => [money(Number(cents)), label]} labelFormatter={key => monthName(String(key))} />
        <Legend wrapperStyle={{ fontSize: 12, maxHeight: 72, overflowY: 'auto' }} />
        {series.map((label, index) => view === 'Bar graph'
          ? <Bar key={label} dataKey={row => value(row as RevenueMonth, label)} name={label} stackId="revenue" fill={COLORS[index % COLORS.length]} maxBarSize={36} isAnimationActive={false} />
          : <Line key={label} dataKey={row => value(row as RevenueMonth, label)} name={label} stroke={COLORS[index % COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />)}
      </ComposedChart></ResponsiveContainer>
    </div>}
    <p className="mt-3 text-xs text-slate-500">Breakdowns use recorded allocations. Unassigned amounts stay visible. Age is measured when the payment or refund occurred.</p>
  </div>
}

function AccountBalances({ data, onBilling }: { data: BillingData; onBilling: (target: BillingTarget) => void }) {
  const [period, setPeriod] = useState<'currentCents' | 'overdueCents'>('currentCents')
  const [search, setSearch] = useState('')
  const owing = data.unpaid.filter(row => row[period] > 0)
  const visible = owing.filter(row => row.familyName.toLowerCase().includes(search.trim().toLowerCase()))
  const total = owing.reduce((value, row) => value + row[period], 0)
  const accountLink = (row: AccountBalance) => <button type="button" onClick={() => onBilling({ familyId: row.familyId, memberId: null })} className="text-left font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:decoration-blue-700">{row.familyName}</button>
  return <>
    <section aria-label="Unpaid accounts" className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h3 className="text-lg font-bold">Who still owes</h3><p className="mt-1 text-sm text-slate-500">{owing.length} families · <span className="font-semibold text-red-700">{money(total)}</span> remaining · As of {data.asOf}</p></div>
        <div role="group" aria-label="Unpaid billing period" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={period === 'currentCents'} className={`${button} ${period === 'currentCents' ? '!bg-red-50 !border-red-300 !text-red-800' : ''}`} onClick={() => setPeriod('currentCents')}>This month</button>
          <button type="button" aria-pressed={period === 'overdueCents'} className={`${button} ${period === 'overdueCents' ? '!bg-red-50 !border-red-300 !text-red-800' : ''}`} onClick={() => setPeriod('overdueCents')}>Last month +</button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">{period === 'currentCents' ? `Unpaid bills for ${monthName(data.asOf.slice(0, 7))}.` : 'Unpaid bills from last month and all earlier months.'} Select a family to open its billing account.</p>
      <label className="mt-4 block text-sm font-medium">Find a family<input type="search" value={search} onChange={event => setSearch(event.target.value)} className="ml-3 max-w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      {visible.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Families with unpaid bills {period === 'currentCents' ? 'this month' : 'last month or earlier'}</caption>
        <thead className="border-b text-xs text-slate-500"><tr><th scope="col" className="p-3">Family</th><th scope="col" className="p-3">{period === 'currentCents' ? 'This month owed' : 'Last month + owed'}</th><th scope="col" className="p-3">Total owed through this month</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{visible.map(row => <tr key={row.accountId}><th scope="row" className="p-3">{accountLink(row)}</th><td className="p-3 font-semibold text-red-700">{money(row[period])}</td><td className="p-3">{money(row.overdueCents + row.currentCents)}</td></tr>)}</tbody>
      </table></div> : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{owing.length ? 'No families match your search.' : 'No unpaid bills for this period.'}</p>}
    </section>
    <section aria-label="Account credits" className={panel}>
      <h3 className="text-lg font-bold">Account credits</h3><p className="mt-1 text-sm text-slate-500">{data.credits.length} families · <span className="font-semibold text-emerald-700">{money(data.credits.reduce((value, row) => value + row.creditCents, 0))}</span> in available credit</p>
      {data.credits.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Families with available account credit</caption><thead className="border-b text-xs text-slate-500"><tr><th scope="col" className="p-3">Family</th><th scope="col" className="p-3">Credit balance</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{data.credits.map(row => <tr key={row.accountId}><th scope="row" className="p-3">{accountLink(row)}</th><td className="p-3 font-semibold text-emerald-700">{money(row.creditCents)}</td></tr>)}</tbody>
      </table></div> : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No accounts have an available credit balance.</p>}
    </section>
  </>
}
