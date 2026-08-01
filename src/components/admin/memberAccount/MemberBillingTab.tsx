import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, CreditCard, Loader2 } from 'lucide-react'
import { adminApiRequest } from '../../../utils/api'
import type {
  BillingCurrentPeriod,
  BillingBundlePass,
  BillingBundleUsage,
  BillingHistoryMonth,
  BillingPaymentRow,
  BillingPeriodCharge,
  BillingSubscriptionSummary,
} from '../../member/MemberBillingPanel'

interface AdminBillingAccount {
  monthlyTotals?: { grossCents: number; discountCents: number; netCents: number }
  membershipRenewsOn?: string | null
  currentPeriod?: BillingCurrentPeriod | null
  billingHistory?: BillingHistoryMonth[]
  bundlePasses?: BillingBundlePass[]
  bundleUsage?: BillingBundleUsage[]
}

function money(cents: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number(cents ?? 0) / 100,
  )
}

function shortDate(value: string) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString()
  return new Date(value).toLocaleDateString()
}

function BillingLine({
  primary,
  meta,
  amount,
  amountClassName = 'text-gray-900',
}: {
  primary: string
  meta?: string | null
  amount: string
  amountClassName?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <p className="min-w-0 leading-snug">
        <span className="text-gray-900">{primary}</span>
        {meta ? <span className="text-gray-500"> · {meta}</span> : null}
      </p>
      <span className={`shrink-0 font-medium ${amountClassName}`}>{amount}</span>
    </div>
  )
}

function ChargeList({ items, empty }: { items: BillingPeriodCharge[]; empty: string }) {
  if (items.length === 0) return <p className="mb-4 pl-4 text-sm text-gray-500">{empty}</p>
  return (
    <div className="mb-4 divide-y divide-gray-100 pl-4">
      {items.map((item) => (
        <BillingLine
          key={`${item.id}-${item.occurredAt}`}
          primary={item.description}
          meta={[item.memberName, shortDate(item.occurredAt)].filter(Boolean).join(' · ')}
          amount={money(item.amountCents)}
          amountClassName={item.amountCents < 0 ? 'text-green-700' : 'text-gray-900'}
        />
      ))}
    </div>
  )
}

function PaymentList({ payments }: { payments: BillingPaymentRow[] }) {
  if (payments.length === 0) return <p className="mb-4 pl-4 text-sm text-gray-500">No payments this month.</p>
  return (
    <div className="mb-4 divide-y divide-gray-100 pl-4">
      {payments.map((payment) => (
        <BillingLine
          key={payment.id}
          primary={payment.method || 'Payment'}
          meta={shortDate(payment.paidAt)}
          amount={money(payment.amountCents)}
          amountClassName="text-green-700"
        />
      ))}
    </div>
  )
}

function CurrentBill({ account }: { account: AdminBillingAccount }) {
  const period = account.currentPeriod
  const totals = period?.totals
  const cards = [
    ['New charges', totals?.chargesCents],
    ['Outstanding balance', totals?.debitsCents],
    ['Credits', totals?.creditsCents],
    ['Payments', totals?.paymentsCents],
    ['Balance due', totals?.balanceDueCents],
  ] as const

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
      <div className="mb-6">
        <h4 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <CreditCard className="h-6 w-6 text-vortex-red" />
          {period?.label ?? 'Current billing cycle'}
        </h4>
        <p className="mt-1 text-sm text-gray-600">
          This account uses calendar-month billing. Charges and payments for the current month appear
          below; the balance due resets on the 1st. Mid-month enrollments are included immediately.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(([label, value], index) => (
          <div key={label} className={`rounded-xl p-4 ${index === 4 ? 'border-2 border-black' : 'border border-gray-200'}`}>
            <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
            <p className={`text-xl font-bold ${index === 2 || index === 3 ? 'text-green-700' : 'text-gray-900'}`}>
              {money(value)}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-6 space-y-1 text-sm text-gray-500">
        <p>Recurring monthly total: <span className="text-gray-900">{money(account.monthlyTotals?.netCents)}/mo</span></p>
        {account.membershipRenewsOn ? <p>Membership Renews on: <span className="text-gray-900">{shortDate(account.membershipRenewsOn)}</span></p> : null}
      </div>

      {(period?.membershipFees.length ?? 0) > 0 ? (
        <>
          <h5 className="mb-2 text-sm font-semibold text-gray-900">Membership fee</h5>
          <div className="mb-4 divide-y divide-gray-100 pl-4">
            {period!.membershipFees.map((fee, index) => (
              <BillingLine key={`${fee.description}-${index}`} primary={fee.description} meta={[fee.memberName, `Paid ${shortDate(fee.paidAt)}`].filter(Boolean).join(' · ')} amount={money(fee.amountCents)} />
            ))}
          </div>
        </>
      ) : null}

      <h5 className="mb-2 text-sm font-semibold text-gray-900">Recurring enrollments</h5>
      {(period?.recurringEnrollments.length ?? 0) === 0 ? (
        <p className="mb-4 pl-4 text-sm text-gray-500">No recurring enrollments on the billing account.</p>
      ) : (
        <div className="mb-4 divide-y divide-gray-100 pl-4">
          {period!.recurringEnrollments.map((sub: BillingSubscriptionSummary) => (
            <BillingLine key={sub.id} primary={sub.description} meta={[sub.memberName, sub.status, sub.nextBillDate ? `next ${shortDate(sub.nextBillDate)}` : null].filter(Boolean).join(' · ')} amount={money(sub.netMonthlyCents)} />
          ))}
        </div>
      )}

      <h5 className="mb-2 text-sm font-semibold text-gray-900">One-time purchases</h5>
      <ChargeList items={period?.oneTimePurchases ?? []} empty="No one-time purchases this month." />
      {(account.bundlePasses?.length ?? 0) > 0 ? (
        <>
          <h5 className="mb-2 text-sm font-semibold text-gray-900">Class bundles</h5>
          <div className="mb-4 divide-y divide-gray-100 pl-4">
            {account.bundlePasses!.map((bundle) => (
              <BillingLine key={bundle.id} primary={bundle.packageLabel || `Pass #${bundle.id}`} meta={[bundle.memberName, bundle.status, bundle.expiresAt ? `expires ${shortDate(bundle.expiresAt)}` : null].filter(Boolean).join(' · ')} amount={`${bundle.classesRemaining} / ${bundle.classCountPurchased} left`} />
            ))}
          </div>
        </>
      ) : null}
      <h5 className="mb-2 text-sm font-semibold text-gray-900">Outstanding balance</h5>
      <ChargeList items={period?.debits ?? []} empty="No outstanding balance items." />
      <h5 className="mb-2 text-sm font-semibold text-gray-900">Credits</h5>
      <ChargeList items={period?.credits ?? []} empty="No credits." />
      <h5 className="mb-2 text-sm font-semibold text-gray-900">Payments this month</h5>
      <PaymentList payments={period?.payments ?? []} />
    </section>
  )
}

function BillingHistory({ months }: { months: BillingHistoryMonth[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (months.length === 0) return <p className="py-8 text-center text-sm text-gray-500">No billing history yet.</p>
  return (
    <section className="space-y-3">
      <p className="text-sm text-gray-600">Month-by-month ledger computed from charges and payments.</p>
      {months.map((month) => {
        const open = expanded === month.periodKey
        return (
          <div key={month.periodKey} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <button type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : month.periodKey)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50">
              <div><p className="font-bold text-gray-900">{month.label}</p><p className="text-xs text-gray-500">{month.lines.length} line{month.lines.length === 1 ? '' : 's'}{month.closingBalanceCents != null ? ` · month net ${money(month.closingBalanceCents)}` : ''}</p></div>
              <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? <div className="divide-y divide-gray-100 border-t border-gray-100 px-4">{month.lines.length === 0 ? <p className="py-3 text-sm text-gray-500">No activity this month.</p> : month.lines.map((line, index) => <BillingLine key={`${line.kind}-${line.occurredAt}-${index}`} primary={line.description} meta={[line.memberName, shortDate(line.occurredAt), (line.discountCents ?? 0) > 0 && line.grossCents != null ? `${money(line.grossCents)} − ${money(line.discountCents)}` : null].filter(Boolean).join(' · ')} amount={`${money(Math.abs(line.netCents))}${line.netCents < 0 ? ' paid' : ''}`} amountClassName={line.netCents < 0 ? 'text-green-700' : 'text-gray-900'} />)}</div> : null}
          </div>
        )
      })}
    </section>
  )
}

export default function MemberBillingTab({ familyId, view }: { familyId: number | null | undefined; view: 'current' | 'history' }) {
  const [account, setAccount] = useState<AdminBillingAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!familyId) { setAccount(null); setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const response = await adminApiRequest(`/api/admin/families/${familyId}/billing-account`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || 'Failed to load billing account')
      setAccount(body.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing account')
    } finally { setLoading(false) }
  }, [familyId])

  useEffect(() => { void load() }, [load])
  if (loading) return <div className="flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading billing…</div>
  if (error) return <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
  if (!account) return <p className="text-sm text-gray-500">This account is not linked to a family billing account.</p>
  return view === 'current' ? <CurrentBill account={account} /> : <BillingHistory months={account.billingHistory ?? []} />
}
