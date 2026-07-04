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
    return <div className="text-sm text-gray-500 mb-6">{emptyMessage}</div>
  }
  return (
    <div className="mb-6 divide-y divide-gray-100 rounded-xl border border-gray-200">
      {items.map((item) => (
        <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-gray-900">{item.description}</p>
            <p className="text-xs text-gray-500">
              {item.memberName ? `${item.memberName} · ` : ''}
              {new Date(item.occurredAt).toLocaleDateString()}
              {(item.discountCents ?? 0) > 0 && item.grossCents != null && (
                <> · {formatMoney(item.grossCents)} − {formatMoney(item.discountCents ?? 0)}</>
              )}
            </p>
          </div>
          <span
            className={`shrink-0 font-semibold ${item.amountCents < 0 ? 'text-green-700' : 'text-gray-900'}`}
          >
            {formatMoney(item.amountCents)}
          </span>
        </div>
      ))}
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
    return <div className="text-sm text-gray-500 mb-6">No payments this month.</div>
  }
  return (
    <div className="mb-6 divide-y divide-gray-100 rounded-xl border border-gray-200">
      {payments.map((payment) => (
        <div key={payment.id} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-gray-900">{payment.method || 'Payment'}</p>
            <p className="text-xs text-gray-500">{new Date(payment.paidAt).toLocaleDateString()}</p>
          </div>
          <span className="shrink-0 font-semibold text-green-700">{formatMoney(payment.amountCents)}</span>
        </div>
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
            <p className="text-xs uppercase tracking-wide text-gray-500">Total charges</p>
            <p className="text-xl font-bold text-gray-900">{formatMoney(totals?.chargesCents ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Debits</p>
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
          <p className="text-xs text-gray-500 mb-6">
            Recurring monthly total (active enrollments):{' '}
            <span className="font-semibold text-gray-800">
              {formatMoney(billingAccount!.monthlyTotals!.netCents)}/mo
            </span>
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
            <div className="mb-6 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {period!.membershipFees.map((fee, idx) => (
                <div key={`${fee.description}-${idx}`} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{fee.description}</p>
                    <p className="text-xs text-gray-500">
                      {fee.memberName ? `${fee.memberName} · ` : ''}
                      Paid {new Date(fee.paidAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-gray-900">{formatMoney(fee.amountCents)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {(period?.recurringEnrollments?.length ?? 0) > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Recurring enrollments</h3>
            <p className="text-xs text-gray-500 mb-2">Active subscriptions contributing to your monthly total.</p>
            <div className="mb-6 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {period!.recurringEnrollments.map((sub) => (
                <div key={sub.id} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{sub.description}</p>
                    <p className="text-xs text-gray-500">
                      {sub.memberName ? `${sub.memberName} · ` : ''}
                      <span className="capitalize">{sub.status}</span>
                      {sub.nextBillDate ? ` · next ${new Date(sub.nextBillDate).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-semibold text-gray-900">{formatMoney(sub.netMonthlyCents)}/mo</span>
                    {sub.discountAmountCents > 0 && (
                      <p className="text-xs text-gray-500">
                        {formatMoney(sub.monthlyAmountCents)} − {formatMoney(sub.discountAmountCents)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
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
                <div className="mb-6 divide-y divide-gray-100 rounded-xl border border-gray-200">
                  {oneTimeLifetime.slice(0, 10).map((charge) => (
                    <div key={charge.id} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{charge.description}</p>
                        <p className="text-xs text-gray-500">
                          {charge.memberName ? `${charge.memberName} · ` : ''}
                          {new Date(charge.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-gray-900">{formatMoney(charge.amountCents)}</span>
                    </div>
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
            <div className="mb-6 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {billingAccount!.bundlePasses!.map((b) => (
                <div key={b.id} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{b.packageLabel || `Pass #${b.id}`}</p>
                    <p className="text-xs text-gray-500">
                      {b.memberName ? `${b.memberName} · ` : ''}
                      <span className="capitalize">{b.status}</span>
                      {b.expiresAt ? ` · expires ${new Date(b.expiresAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-gray-900">
                    {b.classesRemaining} / {b.classCountPurchased} left
                  </span>
                </div>
              ))}
            </div>
            {(billingAccount?.bundleUsage?.length ?? 0) > 0 && (
              <details className="mb-6">
                <summary className="text-xs font-semibold text-gray-500 cursor-pointer">Bundle usage history</summary>
                <div className="mt-2 space-y-1">
                  {billingAccount!.bundleUsage!.slice(0, 20).map((u) => (
                    <div key={u.id} className="flex justify-between gap-3 text-xs text-gray-600">
                      <span>
                        {new Date(u.createdAt).toLocaleDateString()} · {u.entryType}
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

        <h3 className="text-sm font-semibold text-gray-900 mb-2">This month — recurring charges</h3>
        <LineList
          items={period?.recurringCharges ?? []}
          emptyMessage="No recurring charges posted this month."
          formatMoney={formatMoney}
        />

        <h3 className="text-sm font-semibold text-gray-900 mb-2">This month — debits &amp; credits</h3>
        {(period?.debits?.length ?? 0) === 0 && (period?.credits?.length ?? 0) === 0 ? (
          <div className="text-sm text-gray-500 mb-6">No debits or credits this month.</div>
        ) : (
          <>
            <LineList items={period?.debits ?? []} emptyMessage="" formatMoney={formatMoney} />
            <LineList items={period?.credits ?? []} emptyMessage="" formatMoney={formatMoney} />
          </>
        )}

        {billingAccount?.canSeeFamily && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Payments this month</h3>
            <PaymentList payments={period?.payments ?? []} formatMoney={formatMoney} />
          </>
        )}
      </div>

      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-2">Billing history</h2>
        <p className="text-gray-600 text-sm mb-6">
          Month-by-month ledger computed from charges and payments — no admin statement required.
        </p>
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
                          <div key={`${line.kind}-${line.occurredAt}-${idx}`} className="px-4 py-2 flex justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="text-gray-800">{line.description}</p>
                              <p className="text-xs text-gray-500">
                                {line.memberName ? `${line.memberName} · ` : ''}
                                {new Date(line.occurredAt).toLocaleDateString()}
                                {(line.discountCents ?? 0) > 0 && line.grossCents != null && (
                                  <> · {formatMoney(line.grossCents)} − {formatMoney(line.discountCents ?? 0)}</>
                                )}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 font-semibold ${line.netCents < 0 ? 'text-green-700' : 'text-gray-900'}`}
                            >
                              {formatMoney(Math.abs(line.netCents))}
                              {line.netCents < 0 ? ' paid' : ''}
                            </span>
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
