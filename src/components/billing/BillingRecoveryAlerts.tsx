import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, PauseCircle, PlayCircle, RefreshCw } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'

interface RecoveryAlert {
  id: number
  family_billing_account_id: number | null
  message: string
  action_status: 'open' | 'processing' | 'suspended' | 'resolved'
  stripe_object_id: string | null
  details: Record<string, unknown>
  balance_cents: number
  affected_enrollments: Array<{
    subscriptionId: number
    description: string
    status: string
    memberId: number | null
    memberName: string | null
  }>
  created_at: string
}

export default function BillingRecoveryAlerts() {
  const [alerts, setAlerts] = useState<RecoveryAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await adminApiRequest('/api/admin/stripe/billing-alerts')
      if (!response.ok) throw new Error('Failed to load payment-recovery alerts.')
      const body = await response.json()
      setAlerts((body.data ?? []).filter((alert: { alert_type?: string }) => alert.alert_type === 'payment_recovery_exhausted'))
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load payment-recovery alerts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const applyAction = async (alert: RecoveryAlert, action: 'suspend' | 'restore') => {
    const reason = window.prompt(
      action === 'suspend'
        ? 'Reason for suspending access after payment recovery was exhausted:'
        : 'Reason for restoring access:',
      action === 'suspend' ? 'Stripe Smart Retries exhausted' : 'Payment issue resolved',
    )
    if (!reason?.trim()) return
    if (!window.confirm(`${action === 'suspend' ? 'Suspend' : 'Restore'} affected enrollments for family billing account ${alert.family_billing_account_id}?`)) return
    setActingId(alert.id)
    setError(null)
    try {
      const response = await adminApiRequest(`/api/admin/stripe/billing-alerts/${alert.id}/access`, {
        method: 'POST',
        body: JSON.stringify({ action, reason: reason.trim() }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || `Failed to ${action} access.`)
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Failed to ${action} access.`)
    } finally {
      setActingId(null)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div>
          <h3 className="font-bold text-gray-900">Payment recovery review</h3>
          <p className="text-xs text-gray-500">Access is never suspended automatically. Review each family after Stripe completes Smart Retries.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      {error && <div className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading && alerts.length === 0 ? (
        <div className="inline-flex items-center gap-2 p-4 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading recovery reviews…</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {alerts.map((alert) => {
            const suspended = alert.action_status === 'suspended'
            const processing = alert.action_status === 'processing'
            return (
              <div key={alert.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-red-700"><AlertTriangle className="h-4 w-4" /> {alert.message}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Family billing account {alert.family_billing_account_id ?? 'unresolved'} · {new Date(alert.created_at).toLocaleString()}
                    {alert.stripe_object_id ? ` · ${alert.stripe_object_id}` : ''}
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    Balance due: <strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(alert.balance_cents ?? 0) / 100)}</strong>
                    {alert.details?.reason ? ` · Last failure: ${String(alert.details.reason)}` : ''}
                  </div>
                  {alert.affected_enrollments?.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-gray-600">
                      {alert.affected_enrollments.map((enrollment) => (
                        <li key={enrollment.subscriptionId}>{enrollment.memberName || 'Athlete'} · {enrollment.description} · {enrollment.status}</li>
                      ))}
                    </ul>
                  )}
                  <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${suspended ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                    {processing ? 'Staff action processing' : suspended ? 'Access suspended — staff restoration required' : 'Awaiting staff review — access remains active'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void applyAction(alert, suspended ? 'restore' : 'suspend')}
                  disabled={actingId === alert.id || processing || !alert.family_billing_account_id}
                  className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${suspended ? 'bg-green-700' : 'bg-red-700'}`}
                >
                  {actingId === alert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : suspended ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                  {suspended ? 'Restore access' : 'Suspend access'}
                </button>
              </div>
            )
          })}
          {alerts.length === 0 && <div className="p-4 text-sm text-gray-500">No families are awaiting failed-payment access review.</div>}
        </div>
      )}
    </section>
  )
}
