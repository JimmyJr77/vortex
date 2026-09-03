import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'

type StripePayment = {
  id: string
  createdAt: string | null
  amountMinor: number
  amountReceivedMinor: number
  amountRefundedMinor: number
  currency: string
  status: string
  description: string | null
  customerId: string | null
  customerName: string | null
  customerEmail: string | null
  paymentMethod: string | null
  latestChargeId: string | null
  liveMode: boolean
}

type StripePaymentsPayload = {
  retrievedAt: string
  payments: StripePayment[]
}

const zeroDecimalCurrencies = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
])

function money(amountMinor: number, currency: string) {
  const normalizedCurrency = currency.toUpperCase()
  const divisor = zeroDecimalCurrencies.has(currency.toLowerCase()) ? 1 : 100
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: normalizedCurrency,
  }).format((Number(amountMinor) || 0) / divisor)
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Date unavailable'
}

function statusClass(status: string) {
  if (status === 'succeeded') return 'bg-emerald-50 text-emerald-800'
  if (status === 'canceled') return 'bg-gray-100 text-gray-700'
  if (status === 'processing') return 'bg-blue-50 text-blue-800'
  return 'bg-amber-50 text-amber-800'
}

export default function StripePaymentsPanel() {
  const [payload, setPayload] = useState<StripePaymentsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await adminApiRequest('/api/admin/stripe/payments', {
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body?.success === false) {
        throw new Error(body?.message || 'Stripe payments failed to load.')
      }
      setPayload(body.data as StripePaymentsPayload)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Stripe payments failed to load.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const mode = useMemo(() => {
    if (!payload?.payments.length) return null
    return payload.payments.every((payment) => payment.liveMode) ? 'Live mode' : 'Test mode'
  }, [payload])

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold text-gray-950">Stripe Payments</h2>
            {mode ? <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{mode}</span> : null}
          </div>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Every PaymentIntent in the configured Stripe account. This view is pulled directly from Stripe and does not use local billing or accounting records.
          </p>
          {payload ? <p className="mt-2 text-xs text-gray-500">Last pulled from Stripe: {dateTime(payload.retrievedAt)}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh from Stripe
        </button>
      </div>

      {error ? <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3">Payment</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Method</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-right">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && !payload ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-500"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading payments from Stripe…</span></td></tr>
            ) : payload?.payments.length ? payload.payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 whitespace-nowrap text-gray-700">{dateTime(payment.createdAt)}</td>
                <td className="px-5 py-3">
                  <p className="font-mono text-xs font-semibold text-gray-900">{payment.id}</p>
                  {payment.latestChargeId ? <p className="mt-1 font-mono text-xs text-gray-500">{payment.latestChargeId}</p> : null}
                </td>
                <td className="px-5 py-3">
                  <p className="font-semibold text-gray-900">{payment.customerName || 'No customer name'}</p>
                  <p className="mt-1 text-xs text-gray-500">{payment.customerEmail || payment.customerId || 'No customer details'}</p>
                </td>
                <td className="max-w-64 px-5 py-3 text-gray-700">{payment.description || '—'}</td>
                <td className="px-5 py-3 capitalize text-gray-700">{payment.paymentMethod || '—'}</td>
                <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(payment.status)}`}>{payment.status.replaceAll('_', ' ')}</span></td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900">
                  {money(payment.amountMinor, payment.currency)}
                  {payment.amountRefundedMinor > 0 ? <p className="mt-1 text-xs font-medium text-amber-800">Refunded {money(payment.amountRefundedMinor, payment.currency)}</p> : null}
                </td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900">{money(payment.amountReceivedMinor, payment.currency)}</td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-500">No payments were returned by Stripe.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
