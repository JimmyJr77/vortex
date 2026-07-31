import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'

type Registration = {
  id: number
  memberName: string
  className: string
  programName: string | null
  status: string
  registeredAt: string
  schedule: string | null
  grossCents: number
  discountCents: number
  netCents: number
  recurringMonthlyCents: number
}

type Payment = {
  id: number
  payerName: string
  payerEmail: string | null
  amountCents: number
  paidAt: string
  method: string | null
  stripePaymentIntentId: string | null
  stripeCheckoutSessionId: string | null
  stripeInvoiceId: string | null
  registrations: Registration[]
}

type Failure = {
  id: number
  payerName: string
  payerEmail: string | null
  alertType: string
  severity: string
  stripeObjectId: string | null
  message: string
  attemptedAmountCents: number
  attemptCount: number | null
  nextPaymentAttempt: number | null
  failureReason: string | null
  createdAt: string
  registrations: Registration[]
}

type Report = {
  days: number
  startDate: string
  endDate: string
  paymentCount: number
  totalBilledCents: number
  payments: Payment[]
  failureCount: number
  failures: Failure[]
}

const money = (cents: number) => (Number(cents || 0) / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
const dateTime = (value: string) => new Date(value).toLocaleString()

export default function PaymentRegistrationReport({ onBack }: { onBack: () => void }) {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await adminApiRequest('/api/admin/billing/payment-registration-report?days=30')
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Failed to load payment report')
      setReport(body.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <div className="min-h-[70vh] space-y-6 rounded-xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" /> Back to billing
          </button>
          <h2 className="text-2xl font-bold text-gray-900">30-day Stripe payment report</h2>
          <p className="mt-1 text-sm text-gray-600">Settled Stripe payments and the registrations attached to each payer.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && !report && <div className="inline-flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading report…</div>}

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4"><div className="text-xs text-gray-500">Settled Stripe payments</div><div className="mt-1 text-xl font-bold">{report.paymentCount}</div></div>
            <div className="rounded-lg bg-gray-50 p-4"><div className="text-xs text-gray-500">Successfully billed</div><div className="mt-1 text-xl font-bold">{money(report.totalBilledCents)}</div></div>
            <div className="rounded-lg bg-gray-50 p-4"><div className="text-xs text-gray-500">Stripe failures</div><div className="mt-1 text-xl font-bold text-red-700">{report.failureCount}</div></div>
          </div>

          <div className="space-y-4">
            {report.payments.map((payment) => (
              <article key={payment.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{payment.payerName}</h3>
                    <p className="text-sm text-gray-600">{payment.payerEmail || 'No billing email'} · {dateTime(payment.paidAt)}</p>
                    <p className="mt-1 text-xs text-gray-500">{payment.method || 'Stripe'} · {payment.stripePaymentIntentId || payment.stripeCheckoutSessionId || payment.stripeInvoiceId || 'Stripe reference unavailable'}</p>
                  </div>
                  <div className="text-right"><div className="text-xs text-gray-500">Successfully billed in Stripe</div><div className="text-xl font-bold text-green-700">{money(payment.amountCents)}</div></div>
                </div>

                {payment.registrations.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-gray-500"><tr><th className="pb-2 pr-3">Athlete</th><th className="pb-2 pr-3">Registered for</th><th className="pb-2 pr-3">Listed cost</th><th className="pb-2 pr-3">Discount</th><th className="pb-2">Recurring</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {payment.registrations.map((registration) => (
                          <tr key={registration.id}>
                            <td className="py-2 pr-3 font-medium text-gray-900">{registration.memberName}<div className="text-xs font-normal text-gray-500">{registration.status}</div></td>
                            <td className="py-2 pr-3 text-gray-700">{registration.className}{registration.programName ? <div className="text-xs text-gray-500">{registration.programName}</div> : null}{registration.schedule ? <div className="text-xs text-gray-500">{registration.schedule}</div> : null}</td>
                            <td className="py-2 pr-3 text-gray-700">{money(registration.grossCents)}<div className="text-xs text-gray-500">Net {money(registration.netCents)}</div></td>
                            <td className="py-2 pr-3 text-gray-700">{money(registration.discountCents)}</td>
                            <td className="py-2 text-gray-700">{registration.recurringMonthlyCents ? `${money(registration.recurringMonthlyCents)}/mo` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="mt-3 text-sm text-gray-500">No active registration rows were found for this payer.</p>}
              </article>
            ))}
            {!report.payments.length && <div className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">No settled Stripe payments in the last 30 days.</div>}
          </div>

          <section className="rounded-xl border border-red-200 bg-red-50/40 p-4">
            <h3 className="font-bold text-red-900">Stripe failures</h3>
            <p className="mt-1 text-sm text-red-800">Failed payment attempts and exhausted recovery events recorded in the last 30 days.</p>
            <div className="mt-3 space-y-3">
              {report.failures.map((failure) => (
                <div key={failure.id} className="rounded-lg border border-red-200 bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><div className="font-semibold text-gray-900">{failure.payerName}</div><div className="text-xs text-gray-600">{failure.payerEmail || 'No billing email'} · {dateTime(failure.createdAt)}</div></div>
                    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">{failure.alertType.replaceAll('_', ' ')}</span>
                  </div>
                  <p className="mt-2 text-red-800">{failure.message}</p>
                  <div className="mt-2 grid gap-2 text-xs text-gray-700 sm:grid-cols-3">
                    <div><span className="text-gray-500">Attempted:</span> <strong>{money(failure.attemptedAmountCents)}</strong></div>
                    <div><span className="text-gray-500">Attempts:</span> <strong>{failure.attemptCount ?? '—'}</strong></div>
                    <div><span className="text-gray-500">Next retry:</span> <strong>{failure.nextPaymentAttempt ? dateTime(new Date(failure.nextPaymentAttempt * 1000).toISOString()) : '—'}</strong></div>
                  </div>
                  {failure.failureReason && <p className="mt-1 text-xs text-gray-600">Reason: {failure.failureReason}</p>}
                  {failure.stripeObjectId && <p className="mt-1 break-all text-xs text-gray-500">Stripe object: {failure.stripeObjectId}</p>}
                  {failure.registrations.length > 0 && <p className="mt-2 text-xs text-gray-600">Registrations: {failure.registrations.map((registration) => `${registration.memberName} — ${registration.className}`).join('; ')}</p>}
                </div>
              ))}
              {!report.failures.length && <div className="rounded-lg bg-white px-4 py-5 text-sm text-gray-600">No Stripe failures recorded in the last 30 days.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
