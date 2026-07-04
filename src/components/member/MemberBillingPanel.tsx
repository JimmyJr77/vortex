import { useState } from 'react'
import { ChevronDown, CreditCard } from 'lucide-react'

export interface BillingPaymentRow {
  id: number
  amountCents: number
  paidAt: string
  method?: string | null
  stripePaymentIntentId?: string | null
  stripeCheckoutSessionId?: string | null
}

export interface BillingChargeRow {
  id: number
  memberId: number | null
  memberName: string | null
  sourceType: string
  description: string
  amountCents: number
  chargeType?: string
  displayCategory?: string | null
  createdAt: string
}

export interface BillingSubscriptionSummary {
  id: number
  memberName: string | null
  description: string
  monthlyAmountCents: number
  discountAmountCents: number
  netMonthlyCents: number
  status: string
  nextBillDate: string | null
}

export interface BillingBundlePass {
  id: number
  memberName: string | null
  packageLabel: string | null
  classCountPurchased: number
  classesRemaining: number
  status: string
  expiresAt: string | null
}

export interface BillingBundleUsage {
  id: number
  entryType: string
  creditDelta: number | null
  classesRemainingAfter: number
  reason: string | null
  packageLabel: string | null
  createdAt: string
}

export interface BillingPeriodTotals {
  chargesCents: number
  debitsCents: number
  creditsCents: number
  paymentsCents: number
  balanceDueCents: number
}

export interface BillingMembershipFee {
  description: string
  amountCents: number
  paidAt: string
  stripeCheckoutSessionId?: string | null
  memberName?: string | null
}

export interface BillingPeriodCharge {
  id: number
  description: string
  amountCents: number
  grossCents?: number
  discountCents?: number
  displayCategory?: string
  occurredAt: string
  memberName?: string | null
}

export interface BillingCurrentPeriod {
  key: string
  label: string
  startDate: string
  endDate: string
  totals: BillingPeriodTotals
  membershipFees: BillingMembershipFee[]
  recurringEnrollments: BillingSubscriptionSummary[]
  recurringCharges: BillingPeriodCharge[]
  oneTimePurchases: BillingPeriodCharge[]
  debits: BillingPeriodCharge[]
  credits: BillingPeriodCharge[]
  payments: BillingPaymentRow[]
}

export interface BillingHistoryLine {
  kind: string
  description: string
  grossCents?: number
  discountCents?: number
  netCents: number
  occurredAt: string
  memberName?: string | null
  stripeRef?: string | null
}

export interface BillingHistoryMonth {
  periodKey: string
  label: string
  startDate: string
  endDate: string
  closingBalanceCents?: number
  lines: BillingHistoryLine[]
}

export interface MemberBillingAccountData {
  charges: BillingChargeRow[]
  payments: BillingPaymentRow[]
  chargesCents: number
  paymentsCents: number
  refundsCents?: number
  balanceCents: number
  canSeeFamily: boolean
  stripeEnabled?: boolean
  subscriptions?: BillingSubscriptionSummary[]
  monthlyTotals?: { grossCents: number; discountCents: number; netCents: number }
  bundlePasses?: BillingBundlePass[]
  bundleUsage?: BillingBundleUsage[]
  currentPeriod?: BillingCurrentPeriod | null
  billingHistory?: BillingHistoryMonth[]
}

interface MemberBillingPanelProps {
  billingAccount: MemberBillingAccountData | null
  billingLoading: boolean
  payNowLoading: boolean
  onPayNow: () => void
  formatMoney: (cents: number) => string
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString()
}

const sectionItemsClass = 'mb-4 pl-4 divide-y divide-gray-100'
const sectionEmptyClass = 'text-sm text-gray-500 mb-4 pl-4'

function BillingLineRow({
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
    <div className="py-2 flex items-start justify-between gap-4 text-sm">
      <p className="min-w-0 leading-snug">
        <span className="text-gray-900">{primary}</span>
        {meta ? (
          <>
            <span className="text-gray-400"> · </span>
            <span className="text-gray-500">{meta}</span>
          </>
        ) : null}
      </p>
      <span className={`shrink-0 tabular-nums ${amountClassName}`}>{amount}</span>
    </div>
  )
}

function LineList({
  items,
  emptyMessage,
  formatMoney,
}: {
  items: BillingPeriodCharge[]
  emptyMessage: string
  formatMoney: (cents: number) => string
}) {
  if (items.length === 0) {
    return <div className={sectionEmptyClass}>{emptyMessage}</div>
  }
  return (
    <div className={sectionItemsClass}>
      {items.map((item) => {
        const metaParts = [
          item.memberName ?? null,
          formatShortDate(item.occurredAt),
          (item.discountCents ?? 0) > 0 && item.grossCents != null
            ? `${formatMoney(item.grossCents)} − ${formatMoney(item.discountCents ?? 0)}`
            : null,
        ].filter(Boolean)
        return (
          <BillingLineRow
            key={item.id}
            primary={item.description}
            meta={metaParts.join(' · ')}
            amount={formatMoney(item.amountCents)}
            amountClassName={item.amountCents < 0 ? 'text-green-700' : 'text-gray-900'}
          />
        )
      })}
    </div>
  )
}

function PaymentList({
  payments,
  formatMoney,
}: {
  payments: BillingPaymentRow[]
  formatMoney: (cents: number) => string
}) {
  if (payments.length === 0) {
    return <div className={sectionEmptyClass}>No payments this month.</div>
  }
  return (
    <div className={sectionItemsClass}>
      {payments.map((payment) => (
        <BillingLineRow
          key={payment.id}
          primary={payment.method || 'Payment'}
          meta={`Paid ${formatShortDate(payment.paidAt)}`}
          amount={formatMoney(payment.amountCents)}
          amountClassName="text-green-700"
        />
      ))}
    </div>
  )
}

export default function MemberBillingPanel({
  billingAccount,
  billingLoading,
  payNowLoading,
  onPayNow,
  formatMoney,
}: MemberBillingPanelProps) {
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)
  const period = billingAccount?.currentPeriod
  const totals = period?.totals

  if (billingLoading) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="text-center py-12 text-gray-600">Loading your account…</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-vortex-red" />
            {period?.label ?? 'Current billing cycle'}
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Your account uses calendar-month billing. Charges and payments for the current month appear below;
            the balance due resets on the 1st. Mid-month enrollments are included immediately.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">New charges</p>
            <p className="text-xl font-bold text-gray-900">{formatMoney(totals?.chargesCents ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Outstanding balance</p>
            <p className="text-xl font-bold text-gray-900">{formatMoney(totals?.debitsCents ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Credits</p>
            <p className="text-xl font-bold text-green-700">{formatMoney(totals?.creditsCents ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Payments</p>
            <p className="text-xl font-bold text-green-700">{formatMoney(totals?.paymentsCents ?? 0)}</p>
          </div>
          <div className="rounded-xl border-2 border-black p-4 col-span-2 sm:col-span-1">
            <p className="text-xs uppercase tracking-wide text-gray-500">Balance due</p>
            <p className="text-xl font-bold text-black">{formatMoney(totals?.balanceDueCents ?? 0)}</p>
          </div>
        </div>

        {(billingAccount?.monthlyTotals?.netCents ?? 0) > 0 && (
          <p className="text-sm text-gray-500 mb-6">
            Recurring monthly total:{' '}
            <span className="text-gray-900">{formatMoney(billingAccount!.monthlyTotals!.netCents)}/mo</span>
          </p>
        )}

        {billingAccount?.stripeEnabled && billingAccount.canSeeFamily && (totals?.balanceDueCents ?? 0) > 0 && (
          <div className="mb-6">
            <button
              type="button"
              onClick={onPayNow}
              disabled={payNowLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {payNowLoading ? 'Starting checkout…' : 'Pay now'}
            </button>
          </div>
        )}

        {(period?.membershipFees?.length ?? 0) > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Membership fee</h3>
            <div className={sectionItemsClass}>
              {period!.membershipFees.map((fee, idx) => {
                const meta = [fee.memberName ?? null, `Paid ${formatShortDate(fee.paidAt)}`]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <BillingLineRow
                    key={`${fee.description}-${idx}`}
                    primary={fee.description}
                    meta={meta}
                    amount={formatMoney(fee.amountCents)}
                  />
                )
              })}
            </div>
          </>
        )}

        {(period?.recurringEnrollments?.length ?? 0) > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Recurring enrollments</h3>
            <div className={sectionItemsClass}>
              {period!.recurringEnrollments.map((sub) => {
                const metaParts = [
                  sub.memberName ?? null,
                  sub.status,
                  sub.nextBillDate ? `next ${formatShortDate(sub.nextBillDate)}` : null,
                ].filter(Boolean)
                return (
                  <BillingLineRow
                    key={sub.id}
                    primary={sub.description}
                    meta={metaParts.join(' · ')}
                    amount={formatMoney(sub.netMonthlyCents)}
                  />
                )
              })}
            </div>
          </>
        )}

        {(() => {
          const oneTimeLifetime = (billingAccount?.charges ?? []).filter(
            (c) => c.chargeType !== 'recurring' && c.displayCategory !== 'membership_fee' && c.chargeType !== 'credit',
          )
          const showLifetimeOneTime = oneTimeLifetime.length > 0 && (period?.oneTimePurchases?.length ?? 0) === 0
          return (
            <>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">One-time purchases</h3>
              {showLifetimeOneTime ? (
                <div className={sectionItemsClass}>
                  {oneTimeLifetime.slice(0, 10).map((charge) => (
                    <BillingLineRow
                      key={charge.id}
                      primary={charge.description}
                      meta={[charge.memberName, formatShortDate(charge.createdAt)].filter(Boolean).join(' · ')}
                      amount={formatMoney(charge.amountCents)}
                    />
                  ))}
                </div>
              ) : (
                <LineList
                  items={period?.oneTimePurchases ?? []}
                  emptyMessage="No one-time purchases this month."
                  formatMoney={formatMoney}
                />
              )}
            </>
          )
        })()}

        {(billingAccount?.bundlePasses?.length ?? 0) > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Class bundles</h3>
            <div className={sectionItemsClass}>
              {billingAccount!.bundlePasses!.map((b) => {
                const metaParts = [
                  b.memberName ?? null,
                  b.status,
                  b.expiresAt ? `expires ${formatShortDate(b.expiresAt)}` : null,
                ].filter(Boolean)
                return (
                  <BillingLineRow
                    key={b.id}
                    primary={b.packageLabel || `Pass #${b.id}`}
                    meta={metaParts.join(' · ')}
                    amount={`${b.classesRemaining} / ${b.classCountPurchased} left`}
                  />
                )
              })}
            </div>
            {(billingAccount?.bundleUsage?.length ?? 0) > 0 && (
              <details className="mb-4 pl-4">
                <summary className="text-xs font-semibold text-gray-500 cursor-pointer">Bundle usage history</summary>
                <div className="mt-2 space-y-1">
                  {billingAccount!.bundleUsage!.slice(0, 20).map((u) => (
                    <div key={u.id} className="flex justify-between gap-3 text-xs text-gray-600">
                      <span>
                        {formatShortDate(u.createdAt)} · {u.entryType}
                        {u.reason ? ` · ${u.reason}` : ''}
                      </span>
                      <span className={u.creditDelta != null && u.creditDelta > 0 ? 'text-green-700' : 'text-gray-700'}>
                        {u.creditDelta != null ? (u.creditDelta > 0 ? `+${u.creditDelta}` : u.creditDelta) : ''} →{' '}
                        {u.classesRemainingAfter} left
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}

        <h3 className="text-sm font-semibold text-gray-900 mb-2">Outstanding balance</h3>
        <LineList
          items={period?.debits ?? []}
          emptyMessage="No outstanding balance items."
          formatMoney={formatMoney}
        />

        <h3 className="text-sm font-semibold text-gray-900 mb-2">Credits</h3>
        <LineList items={period?.credits ?? []} emptyMessage="No credits." formatMoney={formatMoney} />

        {billingAccount?.canSeeFamily && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Payments this month</h3>
            <PaymentList payments={period?.payments ?? []} formatMoney={formatMoney} />
          </>
        )}
      </div>

      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-vortex-red" />
            Billing history
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Month-by-month ledger computed from charges and payments — no admin statement required.
          </p>
        </div>
        {(billingAccount?.billingHistory?.length ?? 0) === 0 ? (
          <div className="text-center py-12 text-gray-500">No billing history yet.</div>
        ) : (
          <div className="space-y-3">
            {billingAccount!.billingHistory!.map((month) => {
              const isOpen = expandedHistory === month.periodKey
              return (
                <div key={month.periodKey} className="rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedHistory(isOpen ? null : month.periodKey)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-bold text-gray-900">{month.label}</p>
                      <p className="text-xs text-gray-500">
                        {month.lines.length} line{month.lines.length !== 1 ? 's' : ''}
                        {month.closingBalanceCents != null
                          ? ` · month net ${formatMoney(month.closingBalanceCents)}`
                          : ''}
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-100">
                      {month.lines.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">No activity this month.</div>
                      ) : (
                        month.lines.map((line, idx) => (
                          <div key={`${line.kind}-${line.occurredAt}-${idx}`} className="pl-4 py-2">
                            <BillingLineRow
                              primary={line.description}
                              meta={[
                                line.memberName ?? null,
                                formatShortDate(line.occurredAt),
                                (line.discountCents ?? 0) > 0 && line.grossCents != null
                                  ? `${formatMoney(line.grossCents)} − ${formatMoney(line.discountCents ?? 0)}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                              amount={`${formatMoney(Math.abs(line.netCents))}${line.netCents < 0 ? ' paid' : ''}`}
                              amountClassName={line.netCents < 0 ? 'text-green-700' : 'text-gray-900'}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
