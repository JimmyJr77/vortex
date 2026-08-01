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
  subscriptions?: AdminSubscription[]
  charges?: AdminCharge[]
  payments?: BillingPaymentRow[]
  recurringBreakpoints?: RecurringBreakpoint[]
}

interface RecurringBreakpoint {
  periodKey: string
  grossCents: number
  discountCents: number
  netCents: number
  lines: Array<{ subscriptionId: number; grossCents: number; discountCents: number; netCents: number }>
}

type AdminSubscription = BillingSubscriptionSummary & { memberId?: number | null; startDate?: string | null }

interface AdminCharge {
  id: number
  memberId?: number | null
  memberName?: string | null
  sourceType?: string | null
  sourceId?: string | null
  subscriptionId?: number | null
  description: string
  amountCents: number
  grossAmountCents?: number
  discountAmountCents?: number
  chargeType?: string
  servicePeriodStart?: string | null
  createdAt: string
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

function monthKey(value: string | Date) {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}`
  }
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function chargeOccurredAt(charge: AdminCharge) {
  if (charge.sourceType === 'scheduling_signup' && charge.chargeType === 'recurring') return charge.createdAt
  return charge.servicePeriodStart || charge.createdAt
}

function chargeCategory(charge: AdminCharge) {
  if (charge.sourceType === 'additional_fee') return 'membership_fee'
  if (charge.chargeType === 'credit' || charge.amountCents < 0) return 'credit'
  if (charge.chargeType === 'adjustment' && charge.amountCents > 0) return 'debit'
  if (charge.sourceType === 'billing_subscription' || charge.chargeType === 'recurring') return 'recurring'
  return 'one_time'
}

function toPeriodCharge(charge: AdminCharge): BillingPeriodCharge {
  return {
    id: charge.id,
    description: charge.description,
    amountCents: charge.amountCents,
    grossCents: charge.grossAmountCents ?? charge.amountCents,
    discountCents: charge.discountAmountCents ?? 0,
    occurredAt: chargeOccurredAt(charge),
    memberName: charge.memberName,
  }
}

function buildCurrentPeriodFallback(account: AdminBillingAccount, asOf = new Date()): BillingCurrentPeriod {
  const key = monthKey(asOf)
  const charges = (account.charges ?? []).filter((charge) => monthKey(chargeOccurredAt(charge)) === key)
  const payments = (account.payments ?? []).filter((payment) => monthKey(payment.paidAt) === key)
  const byCategory = (category: string) => charges.filter((charge) => chargeCategory(charge) === category)
  const ordinaryCharges = charges.filter((charge) => !['credit', 'debit'].includes(chargeCategory(charge)))
  const chargesCents = ordinaryCharges.reduce((sum, charge) => sum + charge.amountCents, 0)
  const debitsCents = byCategory('debit').reduce((sum, charge) => sum + charge.amountCents, 0)
  const creditsCents = byCategory('credit').reduce((sum, charge) => sum + Math.abs(charge.amountCents), 0)
  const paymentsCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0)
  const [year, month] = key.split('-').map(Number)
  return {
    key,
    label: monthLabel(key),
    startDate: `${key}-01`,
    endDate: `${key}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`,
    totals: { chargesCents, debitsCents, creditsCents, paymentsCents, balanceDueCents: chargesCents + debitsCents - creditsCents - paymentsCents },
    membershipFees: byCategory('membership_fee').map((charge) => ({ description: charge.description, amountCents: charge.amountCents, paidAt: charge.createdAt, memberName: charge.memberName })),
    recurringEnrollments: (account.subscriptions ?? []).filter((subscription) => subscription.status === 'active'),
    recurringCharges: byCategory('recurring').map(toPeriodCharge),
    oneTimePurchases: byCategory('one_time').map(toPeriodCharge),
    debits: byCategory('debit').map(toPeriodCharge),
    credits: byCategory('credit').map(toPeriodCharge),
    payments,
  }
}

function buildBillingHistoryFallback(account: AdminBillingAccount, asOf = new Date()): BillingHistoryMonth[] {
  const cursor = new Date(asOf.getFullYear(), asOf.getMonth(), 1)
  return Array.from({ length: 12 }, () => {
    const key = monthKey(cursor)
    const monthCharges = (account.charges ?? []).filter((charge) => monthKey(chargeOccurredAt(charge)) === key)
    const monthPayments = (account.payments ?? []).filter((payment) => monthKey(payment.paidAt) === key)
    const lines = [
      ...monthCharges.map((charge) => ({ kind: chargeCategory(charge), description: charge.description, grossCents: charge.grossAmountCents ?? charge.amountCents, discountCents: charge.discountAmountCents ?? 0, netCents: charge.amountCents, occurredAt: chargeOccurredAt(charge), memberName: charge.memberName })),
      ...monthPayments.map((payment) => ({ kind: 'payment', description: payment.method || 'Payment', netCents: -payment.amountCents, occurredAt: payment.paidAt })),
    ].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
    const [year, month] = key.split('-').map(Number)
    const result: BillingHistoryMonth = {
      periodKey: key,
      label: monthLabel(key),
      startDate: `${key}-01`,
      endDate: `${key}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`,
      closingBalanceCents: lines.reduce((sum, line) => sum + line.netCents, 0),
      lines,
    }
    cursor.setMonth(cursor.getMonth() - 1)
    return result
  })
}

function uncoveredRecurringCents(account: AdminBillingAccount, period: BillingCurrentPeriod) {
  const expected = account.recurringBreakpoints?.find((item) => item.periodKey === period.key)?.netCents
  if (expected == null) return 0
  const posted = (account.charges ?? []).filter((charge) =>
    monthKey(chargeOccurredAt(charge)) === period.key && chargeCategory(charge) === 'recurring',
  ).reduce((sum, charge) => sum + charge.amountCents, 0)
  return Math.max(0, expected - posted)
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
  const period = account.currentPeriod ?? buildCurrentPeriodFallback(account)
  const totals = period.totals
  const unpostedRecurringCents = uncoveredRecurringCents(account, period)
  const cards = [
    ['New charges', totals.chargesCents + unpostedRecurringCents],
    ['Outstanding balance', totals.debitsCents],
    ['Credits', totals.creditsCents],
    ['Payments', totals.paymentsCents],
    ['Balance due', totals.balanceDueCents + unpostedRecurringCents],
  ] as const
  const recurringSummary = account.recurringBreakpoints?.length
    ? account.recurringBreakpoints.map((item) => `${money(item.netCents)}/mo (${monthLabel(item.periodKey).split(' ')[0]})`).join(' | ')
    : `${money(account.monthlyTotals?.netCents)}/mo`

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
      <div className="mb-6">
        <h4 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <CreditCard className="h-6 w-6 text-vortex-red" />
          {period.label}
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
        <p>Recurring monthly total: <span className="text-gray-900">{recurringSummary}</span></p>
        {unpostedRecurringCents > 0 ? <p className="text-amber-700">Includes {money(unpostedRecurringCents)} in expected recurring tuition not yet posted to this month's ledger.</p> : null}
        {account.membershipRenewsOn ? <p>Membership Renews on: <span className="text-gray-900">{shortDate(account.membershipRenewsOn)}</span></p> : null}
      </div>

      {period.membershipFees.length > 0 ? (
        <>
          <h5 className="mb-2 text-sm font-semibold text-gray-900">Membership fee</h5>
          <div className="mb-4 divide-y divide-gray-100 pl-4">
            {period.membershipFees.map((fee, index) => (
              <BillingLine key={`${fee.description}-${index}`} primary={fee.description} meta={[fee.memberName, `Paid ${shortDate(fee.paidAt)}`].filter(Boolean).join(' · ')} amount={money(fee.amountCents)} />
            ))}
          </div>
        </>
      ) : null}

      <h5 className="mb-2 text-sm font-semibold text-gray-900">Recurring enrollments</h5>
      {period.recurringEnrollments.length === 0 ? (
        <p className="mb-4 pl-4 text-sm text-gray-500">No recurring enrollments on the billing account.</p>
      ) : (
        <div className="mb-4 divide-y divide-gray-100 pl-4">
          {period.recurringEnrollments.map((sub: BillingSubscriptionSummary) => (
            <BillingLine key={sub.id} primary={sub.description} meta={[sub.memberName, sub.status, sub.nextBillDate ? `next ${shortDate(sub.nextBillDate)}` : null].filter(Boolean).join(' · ')} amount={money(sub.netMonthlyCents)} />
          ))}
        </div>
      )}

      <h5 className="mb-2 text-sm font-semibold text-gray-900">One-time purchases</h5>
      <ChargeList items={period.oneTimePurchases} empty="No one-time purchases this month." />
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
      <ChargeList items={period.debits} empty="No outstanding balance items." />
      <h5 className="mb-2 text-sm font-semibold text-gray-900">Credits</h5>
      <ChargeList items={period.credits} empty="No credits." />
      <h5 className="mb-2 text-sm font-semibold text-gray-900">Payments this month</h5>
      <PaymentList payments={period.payments} />
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
  const history = (account.billingHistory?.length ?? 0) > 0
    ? account.billingHistory!
    : buildBillingHistoryFallback(account)
  return view === 'current' ? <CurrentBill account={account} /> : <BillingHistory months={history} />
}
