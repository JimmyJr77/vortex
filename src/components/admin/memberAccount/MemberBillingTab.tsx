import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { adminApiRequest } from '../../../utils/api'
import {
  adminFetchMemberEnrollments,
  adminFetchMemberPricingSummary,
  type AdminEnrollmentRow,
  type MemberPricingSummary,
} from '../../../utils/schedulingApi'

interface BillingSubscription {
  id: number
  memberId: number | null
  memberName: string | null
  description: string
  monthlyAmountCents: number
  discountAmountCents: number
  netMonthlyCents: number
  status: string
  startDate?: string | null
  endDate?: string | null
  nextBillDate: string | null
}

interface LedgerEntry {
  entryKind: string
  entryType: string
  refId: number | null
  memberId: number | null
  description: string
  amountCents: number
  occurredAt: string
  runningBalanceCents: number
}

interface BillingCharge {
  id: number
  memberId: number | null
  memberName: string | null
  description: string
  amountCents: number
  grossAmountCents?: number
  discountAmountCents?: number
  chargeType?: string
  createdAt: string
}

interface Refund {
  id: number
  paymentId: number | null
  amountCents: number
  reason: string | null
  externalReference: string | null
  createdAt: string
}

interface BundlePass {
  id: number
  memberId: number
  memberName: string | null
  packageLabel: string | null
  classCountPurchased: number
  classesRemaining: number
  status: string
  expiresAt: string | null
  purchasedAt: string | null
}

interface BundleUsage {
  id: number
  memberId: number | null
  entryType: string
  creditDelta: number | null
  classesRemainingAfter: number
  reason: string | null
  createdAt: string
}

interface BillingAccount {
  id: number
  familyId: number
  payerMemberId: number | null
  billingEmail: string | null
  billingPhone: string | null
  chargesCents?: number
  paymentsCents?: number
  refundsCents?: number
  balanceCents?: number
  charges?: BillingCharge[]
  subscriptions?: BillingSubscription[]
  subscriptionHistory?: BillingSubscription[]
  monthlyTotals?: { grossCents: number; discountCents: number; netCents: number }
  refunds?: Refund[]
  ledger?: LedgerEntry[]
  bundlePasses?: BundlePass[]
  bundleUsage?: BundleUsage[]
}

interface BillingStatement {
  id: number
  statementDate: string
  dueDate: string | null
  totalCents: number
  status: string
  lines: Array<{
    id?: number
    member_id?: number | null
    description: string
    amount_cents: number
  }>
}

interface BillingPayment {
  id: number
  amountCents: number
  paidAt: string
  method?: string | null
  note?: string | null
  externalReference?: string | null
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return value
  }
}

function enrollmentStatusLabel(row: AdminEnrollmentRow) {
  if (row.status === 'paused' && row.pause_effective_date) {
    return `Paused effective ${formatDate(row.pause_effective_date)}`
  }
  if (row.status === 'completed' && row.completed_at) {
    return `Completed ${formatDate(row.completed_at)}`
  }
  const billing = row.billing_status ? ` · billing ${row.billing_status}` : ''
  return `${row.status.replace(/_/g, ' ')}${billing}`
}

export default function MemberBillingTab({
  memberId,
  familyId,
}: {
  memberId: number
  familyId: number | null | undefined
}) {
  const [account, setAccount] = useState<BillingAccount | null>(null)
  const [statements, setStatements] = useState<BillingStatement[]>([])
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [pricing, setPricing] = useState<MemberPricingSummary | null>(null)
  const [enrollments, setEnrollments] = useState<AdminEnrollmentRow[]>([])
  const [memberOnly, setMemberOnly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [partialErrors, setPartialErrors] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPartialErrors([])

    const warnings: string[] = []
    const pricingPromise = adminFetchMemberPricingSummary(memberId).catch(() => {
      warnings.push('Could not load pricing preview')
      return null
    })
    const enrollmentsPromise = adminFetchMemberEnrollments(memberId).catch(() => {
      warnings.push('Could not load enrollment history')
      return { member: null, rows: [] as AdminEnrollmentRow[] }
    })

    if (!familyId) {
      const [pricingSummary, enrollmentData] = await Promise.all([pricingPromise, enrollmentsPromise])
      setAccount(null)
      setStatements([])
      setPayments([])
      setPricing(pricingSummary)
      setEnrollments(enrollmentData.rows ?? [])
      setPartialErrors(warnings)
      setLoading(false)
      return
    }

    const [accountRes, statementsRes, pricingSummary, enrollmentData] = await Promise.all([
      adminApiRequest(`/api/admin/families/${familyId}/billing-account`),
      adminApiRequest(`/api/admin/families/${familyId}/statements`),
      pricingPromise,
      enrollmentsPromise,
    ])

    if (!accountRes.ok) {
      warnings.push(`Billing account request failed (${accountRes.status})`)
      setAccount(null)
      setPayments([])
    } else {
      const accountJson = await accountRes.json()
      setAccount(accountJson.data ?? null)
      setPayments(accountJson.data?.payments ?? [])
    }

    if (!statementsRes.ok) {
      warnings.push(`Statements request failed (${statementsRes.status})`)
      setStatements([])
    } else {
      const statementsJson = await statementsRes.json()
      setStatements(statementsJson.data ?? [])
    }

    setPricing(pricingSummary)
    setEnrollments(enrollmentData.rows ?? [])
    setPartialErrors(warnings)

    if (!accountRes.ok && !statementsRes.ok && !pricingSummary && (enrollmentData.rows?.length ?? 0) === 0) {
      setError('Failed to load billing data')
    }

    setLoading(false)
  }, [familyId, memberId])

  useEffect(() => {
    void load()
  }, [load])

  const filterByMember = useCallback(
    <T extends { memberId?: number | null }>(rows: T[]) =>
      memberOnly ? rows.filter((r) => r.memberId == null || r.memberId === memberId) : rows,
    [memberId, memberOnly],
  )

  const charges = useMemo(() => filterByMember(account?.charges ?? []), [account?.charges, filterByMember])
  const oneTimeCharges = useMemo(
    () => charges.filter((c) => c.chargeType !== 'recurring'),
    [charges],
  )
  const recurringCharges = useMemo(
    () => charges.filter((c) => c.chargeType === 'recurring'),
    [charges],
  )
  const ledger = useMemo(() => filterByMember(account?.ledger ?? []), [account?.ledger, filterByMember])
  const subscriptions = useMemo(
    () => filterByMember(account?.subscriptions ?? []),
    [account?.subscriptions, filterByMember],
  )
  const subscriptionHistory = useMemo(
    () => filterByMember(account?.subscriptionHistory ?? []),
    [account?.subscriptionHistory, filterByMember],
  )
  const bundlePasses = useMemo(
    () => (memberOnly ? (account?.bundlePasses ?? []).filter((b) => b.memberId === memberId) : (account?.bundlePasses ?? [])),
    [account?.bundlePasses, memberId, memberOnly],
  )
  const bundleUsage = useMemo(
    () => (memberOnly ? (account?.bundleUsage ?? []).filter((u) => u.memberId === memberId || u.memberId == null) : (account?.bundleUsage ?? [])),
    [account?.bundleUsage, memberId, memberOnly],
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading billing…
      </div>
    )
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
  }

  const hasAnyData =
    account ||
    statements.length > 0 ||
    payments.length > 0 ||
    enrollments.length > 0 ||
    (pricing?.preview?.formSummaries?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      {partialErrors.length > 0 && (
        <div className="rounded-lg bg-amber-50 text-amber-800 px-3 py-2 text-sm space-y-0.5">
          {partialErrors.map((msg) => (
            <div key={msg}>{msg}</div>
          ))}
        </div>
      )}

      {familyId && (
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={memberOnly}
            onChange={(e) => setMemberOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show this member only
        </label>
      )}

      {!familyId && (
        <p className="text-sm text-gray-500">This account is not linked to a family billing account.</p>
      )}

      {account && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Family billing summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Net monthly</span>
              <div className="font-semibold text-gray-900">{money(account.monthlyTotals?.netCents ?? 0)}</div>
            </div>
            <div>
              <span className="text-gray-600">Total charges</span>
              <div className="font-semibold text-gray-900">{money(account.chargesCents ?? 0)}</div>
            </div>
            <div>
              <span className="text-gray-600">Payments / Refunds</span>
              <div className="font-semibold text-green-700">
                {money(account.paymentsCents ?? 0)}
                <span className="text-gray-500 text-xs"> / {money(account.refundsCents ?? 0)}</span>
              </div>
            </div>
            <div>
              <span className="text-gray-600">Balance</span>
              <div className="font-semibold text-gray-900">{money(account.balanceCents ?? 0)}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Billing contact: {[account.billingEmail, account.billingPhone].filter(Boolean).join(' · ') || '—'}
          </div>
        </section>
      )}

      {enrollments.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Enrollment history</h4>
          <div className="space-y-2">
            {enrollments.map((row) => (
              <div key={row.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <div className="font-medium text-gray-900">{row.class_name || row.program_name || 'Class'}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {row.schedule}
                  {row.offering_label ? ` · ${row.offering_label}` : ''}
                </div>
                <div className="text-xs mt-1 capitalize text-gray-600">{enrollmentStatusLabel(row)}</div>
                {row.created_at && (
                  <div className="text-xs text-gray-400 mt-0.5">Enrolled {formatDate(row.created_at)}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {subscriptions.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Active recurring enrollments</h4>
          <div className="space-y-2">
            {subscriptions.map((s) => (
              <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{s.description}</div>
                  <div className="text-xs text-gray-500">
                    {s.memberName ? `${s.memberName} · ` : ''}
                    <span className="capitalize">{s.status}</span>
                    {s.nextBillDate ? ` · next ${formatDate(s.nextBillDate)}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-gray-900">{money(s.netMonthlyCents)}/mo</div>
                  {s.discountAmountCents > 0 && (
                    <div className="text-xs text-gray-500">{money(s.monthlyAmountCents)} − {money(s.discountAmountCents)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {subscriptionHistory.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Cancelled / past subscriptions</h4>
          <div className="space-y-2">
            {subscriptionHistory.map((s) => (
              <div key={s.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{s.description}</div>
                  <div className="text-xs text-gray-500">
                    {s.memberName ? `${s.memberName} · ` : ''}
                    cancelled{s.endDate ? ` ${formatDate(s.endDate)}` : ''}
                    {s.startDate ? ` · started ${formatDate(s.startDate)}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0 text-xs text-gray-500">
                  was {money(s.netMonthlyCents)}/mo
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(oneTimeCharges.length > 0 || recurringCharges.length > 0) && (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">Charges</h4>
          {oneTimeCharges.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-600">
                One-time ({oneTimeCharges.length})
              </div>
              <div className="divide-y divide-gray-100">
                {oneTimeCharges.map((c) => (
                  <div key={c.id} className="px-3 py-2 text-sm flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-gray-900">{c.description}</div>
                      <div className="text-xs text-gray-500">
                        {c.memberName ? `${c.memberName} · ` : ''}{formatDate(c.createdAt)}
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold">{money(c.amountCents)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {recurringCharges.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-600">
                Recurring charges ({recurringCharges.length})
              </div>
              <div className="divide-y divide-gray-100">
                {recurringCharges.map((c) => (
                  <div key={c.id} className="px-3 py-2 text-sm flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-gray-900">{c.description}</div>
                      <div className="text-xs text-gray-500">
                        {c.memberName ? `${c.memberName} · ` : ''}{formatDate(c.createdAt)}
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold">{money(c.amountCents)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {ledger.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Account ledger</h4>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-gray-600 bg-gray-50 border-b border-gray-200">
                  <th className="py-2 px-3 font-semibold">Date</th>
                  <th className="py-2 px-3 font-semibold">Description</th>
                  <th className="py-2 px-3 font-semibold">Type</th>
                  <th className="py-2 px-3 font-semibold text-right">Amount</th>
                  <th className="py-2 px-3 font-semibold text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row, idx) => (
                  <tr
                    key={`${row.entryKind}-${row.refId}-${idx}`}
                    className={`border-b border-gray-100 ${row.memberId === memberId ? 'bg-blue-50/40' : ''}`}
                  >
                    <td className="py-2 px-3 whitespace-nowrap text-gray-600">{formatDate(row.occurredAt)}</td>
                    <td className="py-2 px-3 text-gray-900">{row.description}</td>
                    <td className="py-2 px-3 text-gray-500 capitalize">{row.entryType.replace(/_/g, ' ')}</td>
                    <td className={`py-2 px-3 text-right font-medium ${row.amountCents < 0 ? 'text-green-700' : 'text-gray-900'}`}>
                      {money(row.amountCents)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-900">{money(row.runningBalanceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(account?.refunds?.length ?? 0) > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Refunds</h4>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Reason</th>
                  <th className="px-3 py-2 font-semibold">Reference</th>
                </tr>
              </thead>
              <tbody>
                {(account?.refunds ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{formatDate(r.createdAt)}</td>
                    <td className="px-3 py-2 font-medium">{money(r.amountCents)}</td>
                    <td className="px-3 py-2 text-gray-600">{r.reason || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{r.externalReference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {bundlePasses.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Class bundles</h4>
          <div className="space-y-2">
            {bundlePasses.map((b) => (
              <div key={b.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900">{b.packageLabel || `Pass #${b.id}`}</div>
                    <div className="text-xs text-gray-500">
                      {b.memberName ? `${b.memberName} · ` : ''}
                      <span className="capitalize">{b.status}</span>
                      {b.expiresAt ? ` · expires ${formatDate(b.expiresAt)}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-semibold">
                    {b.classesRemaining} / {b.classCountPurchased} left
                  </div>
                </div>
              </div>
            ))}
          </div>
          {bundleUsage.length > 0 && (
            <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">Bundle usage</div>
              <div className="space-y-1">
                {bundleUsage.slice(0, 15).map((u) => (
                  <div key={u.id} className="flex justify-between gap-3 text-xs text-gray-600">
                    <span>
                      {formatDate(u.createdAt)} · {u.entryType}
                      {u.reason ? ` · ${u.reason}` : ''}
                    </span>
                    <span>
                      {u.creditDelta != null ? (u.creditDelta > 0 ? `+${u.creditDelta}` : u.creditDelta) : ''} → {u.classesRemainingAfter} left
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {pricing?.preview?.formSummaries && pricing.preview.formSummaries.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Registered classes &amp; estimated costs</h4>
          <div className="space-y-2">
            {pricing.preview.formSummaries.map((summary) => (
              <div key={summary.formId} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <div className="font-medium text-gray-900">{summary.formTitle}</div>
                {summary.pricingAfter ? (
                  <ul className="mt-1 text-gray-600 space-y-0.5">
                    <li>{summary.totalSlotCount} slot{summary.totalSlotCount === 1 ? '' : 's'} enrolled</li>
                    <li>List: {money(summary.pricingAfter.nonDiscountedMonthly)}/mo</li>
                    {summary.pricingAfter.discountMonthly > 0 && (
                      <li className="text-green-700">Discount: -{money(summary.pricingAfter.discountMonthly)}/mo</li>
                    )}
                    <li className="font-semibold text-gray-900">
                      Estimated: {money(summary.pricingAfter.discountedMonthly)}/mo
                    </li>
                  </ul>
                ) : (
                  <p className="text-gray-500 mt-1">No pricing configured</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {statements.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Statements</h4>
          <div className="space-y-3">
            {statements.map((stmt) => (
              <div key={stmt.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="font-medium text-gray-900">Statement {formatDate(stmt.statementDate)}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 capitalize">{stmt.status}</span>
                </div>
                <div className="text-gray-600 text-xs mb-2">
                  Due {formatDate(stmt.dueDate)} · Total {money(stmt.totalCents)}
                </div>
                {stmt.lines?.length > 0 && (
                  <ul className="border-t border-gray-100 pt-2 space-y-1">
                    {stmt.lines.map((line, idx) => (
                      <li key={line.id ?? idx} className="flex justify-between gap-2 text-xs">
                        <span className="text-gray-700">{line.description}</span>
                        <span className="text-gray-900 shrink-0">{money(line.amount_cents)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {payments.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Payments</h4>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Method</th>
                  <th className="px-3 py-2 font-semibold">Reference / note</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{formatDate(p.paidAt)}</td>
                    <td className="px-3 py-2 font-medium">{money(p.amountCents)}</td>
                    <td className="px-3 py-2 text-gray-600">{p.method || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">
                      {[p.externalReference, p.note].filter(Boolean).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!hasAnyData && (
        <p className="text-sm text-gray-400">No billing activity on record for this member.</p>
      )}
    </div>
  )
}
