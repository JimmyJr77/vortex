import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Search } from 'lucide-react'
import { adminApiRequest } from '../utils/api'
import { billingMonthAbbreviation, money } from './customerBilling/format'

export interface BillingOverviewFamily {
  familyId: number
  familyName: string
  billingAccountId: number | null
  payerMemberId: number | null
  memberId: number | null
  yearToDatePaidCents: number
  months: Record<string, { billedCents: number; paidCents: number; source: string }>
  outstandingBalanceCents: number
  monthlyRecurringCents: number
  upcomingPaidCents: number
  futureCreditsCents: number
  accountBalanceCents: number
  enrolled: boolean
  currentMonthRecurring: boolean
  upcomingMonthRecurring: boolean
  autopay: boolean
  autopayStatus: 'ready' | 'payment_method_required' | 'migration_required' | 'scheduled_later' | 'legacy_collector_conflict' | 'not_applicable'
  autopayEffectiveMonth: string | null
  cardOnFile: { last4: string | null; brand: string | null }
}

interface BillingOverviewPayload {
  generatedAt: string
  year: string
  months: string[]
  upcomingMonth: string
  families: BillingOverviewFamily[]
}

interface AdminBillingOverviewProps {
  onOpenFamily: (familyId: number, memberId: number | null) => void
}

function billPaid(value: { billedCents: number; paidCents: number } | undefined) {
  if (!value) return `${money(0)} / ${money(0)}`
  return `${money(value.billedCents)} / ${money(value.paidCents)}`
}

function cardLabel(card: BillingOverviewFamily['cardOnFile']) {
  if (card.last4) {
    const brand = card.brand
      ? `${card.brand.charAt(0).toUpperCase()}${card.brand.slice(1)}`
      : 'Card'
    return `${brand} •••• ${card.last4}`
  }
  if (card.brand === 'link') return 'Link'
  return 'None'
}

function autopayPresentation(family: BillingOverviewFamily) {
  return {
    label: family.autopay ? 'Autopay' : 'Not Enrolled',
    className: family.autopay ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-700',
    title: family.autopay ? 'Actively enrolled in autopay.' : 'Not actively enrolled in autopay.',
  }
}

export default function AdminBillingOverview({ onOpenFamily }: AdminBillingOverviewProps) {
  const [payload, setPayload] = useState<BillingOverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [recurringFilter, setRecurringFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'familyName', direction: 'asc' as 'asc' | 'desc' })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await adminApiRequest('/api/admin/customer-billing/overview')
      const json = await response.json().catch(() => ({}))
      if (!response.ok || json?.success === false) {
        throw new Error(json?.message || 'Billing overview failed to load.')
      }
      setPayload(json.data as BillingOverviewPayload)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Billing overview failed to load.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const families = useMemo(() => {
    const rows = payload?.families ?? []
    const search = query.trim().toLocaleLowerCase()
    const value = (family: BillingOverviewFamily, key: string): string | number => {
      if (key.startsWith('month:')) return family.months[key.slice(6)]?.billedCents ?? 0
      if (key === 'autopay') return autopayPresentation(family).label
      if (key === 'enrolled') return family.enrolled ? 'Yes' : 'No'
      if (key === 'cardOnFile') return cardLabel(family.cardOnFile)
      const field = family[key as keyof BillingOverviewFamily]
      return typeof field === 'number' || typeof field === 'string' ? field : ''
    }
    return rows.filter((family) =>
      family.familyName.toLocaleLowerCase().includes(search)
      && (recurringFilter === 'all'
        || (recurringFilter === 'current' ? family.currentMonthRecurring : family.upcomingMonthRecurring)),
    ).sort((left, right) => {
      const a = value(left, sort.key)
      const b = value(right, sort.key)
      let comparison = typeof a === 'number' && typeof b === 'number'
        ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
      if (!comparison && sort.key.startsWith('month:')) {
        const month = sort.key.slice(6)
        comparison = (left.months[month]?.paidCents ?? 0) - (right.months[month]?.paidCents ?? 0)
      }
      return comparison * (sort.direction === 'asc' ? 1 : -1) || left.familyId - right.familyId
    })
  }, [payload, query, recurringFilter, sort])

  const months = payload?.months ?? []
  const columnCount = 10 + months.length
  const header = (key: string, label: string, sticky = false) => (
    <th key={key} scope="col" aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`whitespace-nowrap px-5 py-3 ${sticky ? 'sticky left-0 z-20 bg-gray-50' : ''}`}>
      <button type="button" className="inline-flex items-center gap-2 text-left uppercase hover:text-gray-950"
        title={key.startsWith('month:') ? 'Sort by bill amount, then paid amount' : `Sort by ${label}`}
        onClick={() => setSort((previous) => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))}>
        {label}<span aria-hidden="true">{sort.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  )
  const upcomingLabel = billingMonthAbbreviation(payload?.upcomingMonth) ?? 'Upcoming'

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-100 p-5">
        <div>
          <h2 className="font-display text-2xl font-bold text-gray-950">Billing Overview</h2>
          <p className="mt-1 text-sm text-gray-600">
            Monthly billing and payments, upcoming balances, class enrollment, and autopay status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Search families</span>
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search family"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-black"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="sr-only">Active recurring classes</span>
            <select aria-label="Active recurring classes" value={recurringFilter} onChange={(event) => setRecurringFilter(event.target.value)}
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2">
              <option value="all">All families</option>
              <option value="current">Active recurring — {billingMonthAbbreviation(months[1]) ?? 'current month'}</option>
              <option value="upcoming">Active recurring — {upcomingLabel}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      {error && <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <div className="overflow-x-auto" role="region" aria-label="Billing overview table" tabIndex={0}>
        <table className="min-w-[1280px] w-full text-sm whitespace-nowrap">
          <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
              {header('familyName', 'Family', true)}
              {header('enrolled', 'Enrolled')}
              {header('yearToDatePaidCents', `YTD ${payload?.year ?? ''}`)}
              {months.map((month) => header(`month:${month}`, `${billingMonthAbbreviation(month)} bill / paid`))}
              {header('outstandingBalanceCents', `${upcomingLabel} outstanding`)}
              {header('monthlyRecurringCents', `${upcomingLabel} recurring`)}
              {header('futureCreditsCents', 'Credits')}
              {header('upcomingPaidCents', `${upcomingLabel} paid`)}
              {header('accountBalanceCents', `${upcomingLabel} balance`)}
              {header('autopay', 'Autopay')}
              {header('cardOnFile', 'Payment method')}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && !payload ? (
              <tr>
                <td colSpan={columnCount} className="px-5 py-10 text-center text-sm text-gray-500">
                  <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading billing overview…</span>
                </td>
              </tr>
            ) : families.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-5 py-10 text-center text-sm text-gray-500">No member families match this view.</td>
              </tr>
            ) : families.map((family) => (
              <tr key={family.familyId} className="group hover:bg-gray-50">
                <td className="sticky left-0 z-10 max-w-64 whitespace-normal bg-white px-5 py-3 shadow-[1px_0_0_0_#e5e7eb] group-hover:bg-gray-50">
                  <button
                    type="button"
                    onClick={() => onOpenFamily(family.familyId, family.memberId)}
                    className="text-left font-semibold text-gray-950 hover:text-vortex-red hover:underline"
                  >
                    {family.familyName}
                  </button>
                </td>
                <td className="px-5 py-3">{family.enrolled ? 'Yes' : 'No'}</td>
                <td className="px-5 py-3 font-semibold text-gray-900">{money(family.yearToDatePaidCents)}</td>
                {months.map((month) => (
                  <td key={month} className="px-5 py-3 tabular-nums text-gray-800">{billPaid(family.months[month])}</td>
                ))}
                <td className={`px-5 py-3 font-semibold ${family.outstandingBalanceCents > 0 ? 'text-amber-800' : 'text-gray-900'}`}>
                  {money(family.outstandingBalanceCents)}
                </td>
                <td className="px-5 py-3 font-semibold text-gray-900">{money(family.monthlyRecurringCents)}</td>
                <td className="px-5 py-3 text-gray-800">{money(family.futureCreditsCents)}</td>
                <td className="px-5 py-3 font-semibold tabular-nums text-gray-900">{money(family.upcomingPaidCents ?? 0)}</td>
                <td className={`px-5 py-3 font-semibold ${family.accountBalanceCents > 0 ? 'text-red-700' : family.accountBalanceCents < 0 ? 'text-emerald-700' : 'text-gray-900'}`}>
                  {money(family.accountBalanceCents)}
                </td>
                <td className="px-5 py-3">
                  <span
                    title={autopayPresentation(family).title}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${autopayPresentation(family).className}`}
                  >
                    {autopayPresentation(family).label}
                  </span>
                </td>
                <td className="px-5 py-3 font-semibold text-gray-900">{cardLabel(family.cardOnFile)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
