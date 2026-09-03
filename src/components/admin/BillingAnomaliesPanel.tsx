import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownUp, BanknoteX, CheckCircle2, CircleDollarSign, Copy, Loader2, RefreshCw, Search, Tags } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'

type AnomalyType = 'unpaid_account' | 'duplicate_payment' | 'excessive_discount' | 'failed_collection' | 'account_credit'
type ViewId = 'all' | AnomalyType
type SortId = 'priority' | 'amount' | 'recent' | 'family'

interface BillingAnomaly {
  id: string
  type: AnomalyType
  severity: 'high' | 'medium' | 'low'
  familyId: number
  billingAccountId: number
  familyName: string
  payerName: string | null
  amountCents: number
  itemCount: number
  occurredAt: string | null
  summary: string
  detail: string | null
}

interface AnomalySummary {
  total: number
  totalAmountCents: number
  byType: Record<AnomalyType, number>
  bySeverity: Record<'high' | 'medium' | 'low', number>
}

interface AnomalyResponse {
  anomalies: BillingAnomaly[]
  summary: AnomalySummary
}

const VIEWS: Array<{ id: ViewId; label: string; description: string; icon: typeof AlertTriangle }> = [
  { id: 'all', label: 'All findings', description: 'Every account review item', icon: AlertTriangle },
  { id: 'unpaid_account', label: 'Unpaid', description: 'Outstanding balances', icon: CircleDollarSign },
  { id: 'duplicate_payment', label: 'Duplicate payments', description: 'Repeated or same-day payment signals', icon: Copy },
  { id: 'excessive_discount', label: 'Large discounts', description: 'Discounts of at least 50%', icon: Tags },
  { id: 'failed_collection', label: 'Failed collections', description: 'Charges that still need collection', icon: BanknoteX },
  { id: 'account_credit', label: 'Account credits', description: 'Unapplied settled payment credit', icon: CircleDollarSign },
]

const TYPE_LABEL: Record<AnomalyType, string> = {
  unpaid_account: 'Unpaid account',
  duplicate_payment: 'Duplicate payment',
  excessive_discount: 'Large discount',
  failed_collection: 'Failed collection',
  account_credit: 'Account credit',
}

const severityRank = { high: 3, medium: 2, low: 1 }
const money = (cents: number) => (Number(cents || 0) / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
const time = (value: string | null) => value ? new Date(value).toLocaleString() : 'No recorded date'

function severityClass(severity: BillingAnomaly['severity']) {
  if (severity === 'high') return 'border-red-200 bg-red-50 text-red-800'
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-sky-200 bg-sky-50 text-sky-800'
}

export default function BillingAnomaliesPanel({
  onOpenAccount,
}: {
  onOpenAccount: (familyId: number) => void
}) {
  const [data, setData] = useState<AnomalyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewId>('all')
  const [sort, setSort] = useState<SortId>('priority')
  const [query, setQuery] = useState('')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const response = await adminApiRequest('/api/admin/customer-billing/anomalies')
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.success === false) throw new Error(body.message || 'Billing anomalies could not be loaded.')
      setData(body.data ?? { anomalies: [], summary: { total: 0, totalAmountCents: 0, byType: {}, bySeverity: {} } })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Billing anomalies could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return (data?.anomalies ?? [])
      .filter((row) => view === 'all' || row.type === view)
      .filter((row) => !normalizedQuery || [row.familyName, row.payerName, row.summary, row.detail, row.familyId]
        .filter((value) => value != null)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)))
      .sort((left, right) => {
        if (sort === 'amount') return right.amountCents - left.amountCents || severityRank[right.severity] - severityRank[left.severity]
        if (sort === 'recent') return new Date(right.occurredAt ?? 0).getTime() - new Date(left.occurredAt ?? 0).getTime()
        if (sort === 'family') return left.familyName.localeCompare(right.familyName) || left.summary.localeCompare(right.summary)
        return severityRank[right.severity] - severityRank[left.severity]
          || right.amountCents - left.amountCents
          || new Date(right.occurredAt ?? 0).getTime() - new Date(left.occurredAt ?? 0).getTime()
      })
  }, [data?.anomalies, query, sort, view])

  const countForView = (id: ViewId) => id === 'all'
    ? data?.summary.total ?? 0
    : data?.summary.byType?.[id] ?? 0

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-vortex-red"><AlertTriangle className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Accounts</span></div>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">Billing anomalies</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">Review account-level ledger signals before they become support issues. This queue is read-only and always scoped to your facility.</p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-red-100 bg-red-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-red-700">High priority</p><p className="mt-1 text-2xl font-bold text-red-950">{data?.summary.bySeverity?.high ?? 0}</p><p className="mt-1 text-xs text-red-700">Payment or collection issues needing prompt review</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">All findings</p><p className="mt-1 text-2xl font-bold text-gray-950">{data?.summary.total ?? 0}</p><p className="mt-1 text-xs text-gray-500">Across active family billing accounts</p></div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Review amount</p><p className="mt-1 text-2xl font-bold text-amber-950">{money(data?.summary.totalAmountCents ?? 0)}</p><p className="mt-1 text-xs text-amber-700">Sum of flagged ledger amounts; some findings overlap</p></div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {VIEWS.map((option) => {
              const Icon = option.icon
              const active = view === option.id
              return <button key={option.id} type="button" onClick={() => setView(option.id)} className={`min-w-max rounded-lg border px-3 py-2 text-left text-sm transition ${active ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                <span className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4" />{option.label}<span className={`rounded-full px-1.5 py-0.5 text-xs ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>{countForView(option.id)}</span></span>
                <span className={`mt-0.5 block text-xs ${active ? 'text-gray-300' : 'text-gray-500'}`}>{option.description}</span>
              </button>
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-52"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><span className="sr-only">Search findings</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search family or finding" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-gray-950" /></label>
            <label className="relative"><ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" /><span className="sr-only">Sort findings</span><select value={sort} onChange={(event) => setSort(event.target.value as SortId)} className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-8 text-sm font-medium text-gray-700 outline-none focus:border-gray-950"><option value="priority">Priority</option><option value="amount">Amount</option><option value="recent">Most recent</option><option value="family">Family name</option></select></label>
          </div>
        </div>

        {loading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /> Scanning account billing…</div> : null}
        {!loading && rows.length === 0 ? <div className="py-14 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-green-600" /><p className="mt-3 font-semibold text-gray-900">No matching billing anomalies</p><p className="mt-1 text-sm text-gray-500">Try another view or search, or refresh the account ledger scan.</p></div> : null}
        {!loading && rows.length > 0 ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[840px] text-left text-sm"><thead className="border-y border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-3">Finding</th><th className="px-3 py-3">Account</th><th className="px-3 py-3">Priority</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Detected</th><th className="px-3 py-3"><span className="sr-only">Open account</span></th></tr></thead><tbody className="divide-y divide-gray-100">{rows.map((row) => <tr key={row.id} className="align-top hover:bg-gray-50/70"><td className="px-3 py-4"><span className="font-semibold text-gray-950">{row.summary}</span><p className="mt-1 max-w-lg text-xs leading-5 text-gray-500">{row.detail}</p><span className="mt-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{TYPE_LABEL[row.type]}</span></td><td className="px-3 py-4"><p className="font-medium text-gray-950">{row.familyName}</p><p className="mt-1 text-xs text-gray-500">{row.payerName || 'No billing payer'} · Account #{row.billingAccountId}</p></td><td className="px-3 py-4"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold capitalize ${severityClass(row.severity)}`}>{row.severity}</span></td><td className="px-3 py-4 text-right font-semibold text-gray-950">{money(row.amountCents)}<p className="mt-1 text-xs font-normal text-gray-500">{row.itemCount} item{row.itemCount === 1 ? '' : 's'}</p></td><td className="px-3 py-4 text-xs text-gray-500">{time(row.occurredAt)}</td><td className="px-3 py-4 text-right"><button type="button" onClick={() => onOpenAccount(row.familyId)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-gray-950 hover:text-gray-950">Open account</button></td></tr>)}</tbody></table></div> : null}
      </div>
      <p className="text-xs leading-5 text-gray-500">Detection rules: unpaid balances are unallocated collectible charges; duplicate-payment signals are repeated settled references or same-method, same-amount payments on one day; large discounts are at least 50% and $25; account credits are settled payments not yet allocated to a charge.</p>
    </section>
  )
}
