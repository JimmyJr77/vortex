import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { adminApiRequest } from '../../../utils/api'
import { adminFetchMemberPricingSummary, type MemberPricingSummary } from '../../../utils/schedulingApi'

interface BillingSubscription {
  id: number
  memberName: string | null
  description: string
  monthlyAmountCents: number
  discountAmountCents: number
  netMonthlyCents: number
  status: string
  nextBillDate: string | null
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
  subscriptions?: BillingSubscription[]
  monthlyTotals?: { grossCents: number; discountCents: number; netCents: number }
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const pricingPromise = adminFetchMemberPricingSummary(memberId).catch(() => null)
      if (!familyId) {
        setAccount(null)
        setStatements([])
        setPayments([])
        setPricing(await pricingPromise)
        return
      }

      const [accountRes, statementsRes, pricingSummary] = await Promise.all([
        adminApiRequest(`/api/admin/families/${familyId}/billing-account`),
        adminApiRequest(`/api/admin/families/${familyId}/statements`),
        pricingPromise,
      ])

      if (!accountRes.ok) throw new Error(`Billing account request failed (${accountRes.status})`)
      if (!statementsRes.ok) throw new Error(`Statements request failed (${statementsRes.status})`)

      const accountJson = await accountRes.json()
      const statementsJson = await statementsRes.json()

      setAccount(accountJson.data ?? null)
      setStatements(statementsJson.data ?? [])
      setPayments(accountJson.data?.payments ?? [])
      setPricing(pricingSummary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }, [familyId, memberId])

  useEffect(() => {
    void load()
  }, [load])

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

  return (
    <div className="space-y-6">
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
            <div>
              <span className="text-gray-600">Billing contact</span>
              <div className="text-gray-900 text-xs mt-0.5">
                {[account.billingEmail, account.billingPhone].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
          </div>
        </section>
      )}

      {account && (account.subscriptions?.length ?? 0) > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Recurring enrollments</h4>
          <div className="space-y-2">
            {account.subscriptions!.map((s) => (
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
                      <li className="text-green-700">
                        Discount: -{money(summary.pricingAfter.discountMonthly)}/mo
                      </li>
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
                  <span className="font-medium text-gray-900">
                    Statement {formatDate(stmt.statementDate)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 capitalize">
                    {stmt.status}
                  </span>
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

      {familyId && !account && statements.length === 0 && payments.length === 0 && !pricing?.preview?.formSummaries?.length && (
        <p className="text-sm text-gray-400">No billing activity on record for this family.</p>
      )}
    </div>
  )
}
