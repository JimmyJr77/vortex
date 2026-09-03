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
  futureCreditsCents: number
  accountBalanceCents: number
  autopay: boolean
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
  return card.last4 ? card.last4 : 'Link'
}

export default function AdminBillingOverview({ onOpenFamily }: AdminBillingOverviewProps) {
  const [payload, setPayload] = useState<BillingOverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

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
    if (!search) return rows
    return rows.filter((family) => family.familyName.toLocaleLowerCase().includes(search))
  }, [payload, query])

  const months = payload?.months ?? []
  const upcomingLabel = billingMonthAbbreviation(payload?.upcomingMonth) ?? 'Upcoming'

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-100 p-5">
        <div>
          <h2 className="font-display text-2xl font-bold text-gray-950">Billing Overview</h2>
          <p className="mt-1 text-sm text-gray-600">
            All member families with year-to-date collections, last three months billed vs paid, balances, upcoming recurring, autopay, and card on file.
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
      <div className="overflow-x-auto">
        <table className="min-w-[1280px] w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-3">Family</th>
              <th className="px-5 py-3">YTD {payload?.year ?? ''}</th>
              {months.map((month) => (
                <th key={month} className="px-5 py-3">{billingMonthAbbreviation(month)} bill / paid</th>
              ))}
              <th className="px-5 py-3">Outstanding</th>
              <th className="px-5 py-3">{upcomingLabel} recurring</th>
              <th className="px-5 py-3">Future credits</th>
              <th className="px-5 py-3">Account balance</th>
              <th className="px-5 py-3">Autopay</th>
              <th className="px-5 py-3">CC on file</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && !payload ? (
              <tr>
                <td colSpan={11} className="px-5 py-10 text-center text-sm text-gray-500">
                  <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading billing overview…</span>
                </td>
              </tr>
            ) : families.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-10 text-center text-sm text-gray-500">No member families match this view.</td>
              </tr>
            ) : families.map((family) => (
              <tr key={family.familyId} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <button
                    type="button"
                    onClick={() => onOpenFamily(family.familyId, family.memberId)}
                    className="text-left font-semibold text-gray-950 hover:text-vortex-red hover:underline"
                  >
                    {family.familyName}
                  </button>
                </td>
                <td className="px-5 py-3 font-semibold text-gray-900">{money(family.yearToDatePaidCents)}</td>
                {months.map((month) => (
                  <td key={month} className="px-5 py-3 tabular-nums text-gray-800">{billPaid(family.months[month])}</td>
                ))}
                <td className={`px-5 py-3 font-semibold ${family.outstandingBalanceCents > 0 ? 'text-amber-800' : 'text-gray-900'}`}>
                  {money(family.outstandingBalanceCents)}
                </td>
                <td className="px-5 py-3 font-semibold text-gray-900">{money(family.monthlyRecurringCents)}</td>
                <td className="px-5 py-3 text-gray-800">{money(family.futureCreditsCents)}</td>
                <td className={`px-5 py-3 font-semibold ${family.accountBalanceCents > 0 ? 'text-red-700' : family.accountBalanceCents < 0 ? 'text-emerald-700' : 'text-gray-900'}`}>
                  {money(family.accountBalanceCents)}
                </td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${family.autopay ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                    {family.autopay ? 'Yes' : 'No'}
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
