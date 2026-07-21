import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Plus, Receipt, RefreshCw, Repeat, Tag } from 'lucide-react'
import { adminApiRequest } from '../utils/api'

interface MonthlyTotals {
  grossCents: number
  discountCents: number
  netCents: number
}

interface BillingSubscription {
  id: number
  memberId: number | null
  memberName: string | null
  description: string
  monthlyAmountCents: number
  discountAmountCents: number
  netMonthlyCents: number
  status: string
  startDate: string | null
  endDate: string | null
  nextBillDate: string | null
  sourceType: string | null
  sourceId: string | null
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

interface Refund {
  id: number
  paymentId: number | null
  amountCents: number
  reason: string | null
  externalReference: string | null
  stripeRefundId?: string | null
  externalStatus?: string | null
  errorMessage?: string | null
  createdAt: string
}

interface BundlePass {
  id: number
  memberId: number
  memberName: string | null
  programsId: number
  packageLabel: string | null
  classCountPurchased: number
  classesRemaining: number
  priceCents: number
  status: string
  expiresAt: string | null
  purchasedAt: string | null
}

interface BundleUsage {
  id: number
  memberPassId: number
  memberId: number | null
  entryType: string
  classesUsed: number
  creditDelta: number | null
  classesRemainingAfter: number
  reason: string | null
  packageLabel: string | null
  createdAt: string
}

interface BillingCharge {
  id: number
  memberId: number | null
  memberName: string | null
  sourceType: string
  description: string
  amountCents: number
  grossAmountCents?: number
  discountAmountCents?: number
  chargeType?: string
  billingInterval?: string
  subscriptionId?: number | null
  createdAt: string
}

interface BillingPayment {
  id: number
  amountCents: number
  paidAt: string
  method?: string | null
  note?: string | null
  externalReference?: string | null
  externalStatus?: string | null
}

interface BillingAccount {
  id: number
  familyId: number
  payerMemberId: number | null
  billingEmail: string | null
  billingPhone: string | null
  billingStreet: string | null
  billingCity: string | null
  billingState: string | null
  billingZip: string | null
  chargesCents?: number
  paymentsCents?: number
  refundsCents?: number
  balanceCents?: number
  charges?: BillingCharge[]
  payments?: BillingPayment[]
  subscriptions?: BillingSubscription[]
  monthlyTotals?: MonthlyTotals
  refunds?: Refund[]
  ledger?: LedgerEntry[]
  bundlePasses?: BundlePass[]
  bundleUsage?: BundleUsage[]
}

interface FamilyLookupResult {
  familyId: number
  familyName: string
  billingAccountId: number | null
  matchedMembers: Array<{
    id: number
    name: string
    email: string | null
    phone: string | null
    address: string | null
  }>
}

interface BillingStatement {
  id: number
  statementDate: string
  dueDate: string | null
  totalCents: number
  status: string
  lines: Array<{ id?: number; description: string; amount_cents: number }>
}

interface StripeAlert {
  id: number
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  stripe_object_id: string | null
  created_at: string
}

interface StripeOperations {
  stripeEnabled: boolean
  emailDomain: string | null
  emailDomainVerified: boolean
  alerts: StripeAlert[]
  webhookCounts: Record<string, number>
  latestReconciliation: null | {
    status: string
    started_at: string
    completed_at: string | null
    stripe_payments_checked: number
    payments_inserted: number
    mismatches_found: number
    disputes_checked: number
    error_message: string | null
  }
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100)
}

export default function AdminFamilyBilling() {
  const [familyId, setFamilyId] = useState('')
  const [lookupResults, setLookupResults] = useState<FamilyLookupResult[]>([])
  const [account, setAccount] = useState<BillingAccount | null>(null)
  const [statements, setStatements] = useState<BillingStatement[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [charge, setCharge] = useState({ memberId: '', description: '', amount: '', chargeType: 'one_time' })
  const [paymentProviderName, setPaymentProviderName] = useState('External Payment Processor')
  const [stripeEnabled, setStripeEnabled] = useState(false)
  const [payment, setPayment] = useState({ amount: '', method: '', note: '', externalReference: '', externalStatus: 'recorded' })
  const [refund, setRefund] = useState({ amount: '', reason: '', paymentId: '', externalReference: '' })
  const [operations, setOperations] = useState<StripeOperations | null>(null)
  const [operationsLoading, setOperationsLoading] = useState(false)

  const loadOperations = useCallback(async () => {
    setOperationsLoading(true)
    try {
      const res = await adminApiRequest('/api/admin/stripe/operations')
      if (!res.ok) throw new Error('Failed to load Stripe operations')
      setOperations((await res.json()).data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Stripe operations')
    } finally {
      setOperationsLoading(false)
    }
  }, [])

  useEffect(() => { void loadOperations() }, [loadOperations])

  const reconcileNow = () =>
    withSaving(async () => {
      const res = await adminApiRequest('/api/admin/stripe/reconcile', {
        method: 'POST',
        body: JSON.stringify({ lookbackHours: 48 }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Reconciliation failed')
      await loadOperations()
    })

  const resolveAlert = (id: number) =>
    withSaving(async () => {
      const res = await adminApiRequest(`/api/admin/stripe/billing-alerts/${id}/resolve`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Failed to resolve billing alert')
      await loadOperations()
    })

  const loadFamily = async (resolvedFamilyId: number | string) => {
    setLoading(true)
    setError(null)
    try {
      const [accountRes, statementsRes, providerRes] = await Promise.all([
        adminApiRequest(`/api/admin/families/${resolvedFamilyId}/billing-account`),
        adminApiRequest(`/api/admin/families/${resolvedFamilyId}/statements`),
        adminApiRequest('/api/admin/billing/provider-config'),
      ])
      if (!accountRes.ok) throw new Error(`Billing account request failed: ${accountRes.status}`)
      if (!statementsRes.ok) throw new Error(`Statements request failed: ${statementsRes.status}`)
      if (!providerRes.ok) throw new Error(`Provider request failed: ${providerRes.status}`)
      const accountJson = await accountRes.json()
      const statementsJson = await statementsRes.json()
      const providerJson = await providerRes.json()
      setAccount(accountJson.data)
      setStatements(statementsJson.data ?? [])
      setPaymentProviderName(providerJson.data?.externalProcessorName || 'External Payment Processor')
      setStripeEnabled(providerJson.data?.stripeEnabled === true)
      setFamilyId(String(resolvedFamilyId))
      setLookupResults([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing account')
    } finally {
      setLoading(false)
    }
  }

  const load = async () => {
    const query = familyId.trim()
    if (!query) return
    setLoading(true)
    setError(null)
    setAccount(null)
    setStatements([])
    try {
      const response = await adminApiRequest(`/api/admin/billing/family-lookup?q=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Family lookup failed')
      const results = ((await response.json()).data ?? []) as FamilyLookupResult[]
      const exactId = /^\d+$/.test(query) ? results.find((item) => item.familyId === Number(query)) : undefined
      if (exactId || results.length === 1) {
        await loadFamily((exactId ?? results[0]).familyId)
        return
      }
      setLookupResults(results)
      if (results.length === 0) setError('No family member or family ID matched that search.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search family billing accounts')
    } finally {
      setLoading(false)
    }
  }

  const withSaving = async (fn: () => Promise<void>) => {
    setSaving(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setSaving(false)
    }
  }

  const saveAccount = () =>
    withSaving(async () => {
      if (!account) return
      const res = await adminApiRequest(`/api/admin/families/${account.familyId}/billing-account`, {
        method: 'PUT',
        body: JSON.stringify(account),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to save billing account')
      await loadFamily(account.familyId)
    })

  const addCharge = () =>
    withSaving(async () => {
      if (!account || !charge.description.trim() || !charge.amount.trim()) return
      const res = await adminApiRequest(`/api/admin/families/${account.familyId}/charges`, {
        method: 'POST',
        body: JSON.stringify({
          memberId: charge.memberId ? Number(charge.memberId) : null,
          description: charge.description,
          amountCents: Math.round(Number(charge.amount) * 100),
          chargeType: charge.chargeType,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to add charge')
      setCharge({ memberId: '', description: '', amount: '', chargeType: 'one_time' })
      await loadFamily(account.familyId)
    })

  const addPayment = () =>
    withSaving(async () => {
      if (!account || !payment.amount.trim()) return
      const res = await adminApiRequest(`/api/admin/families/${account.familyId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amountCents: Math.round(Number(payment.amount) * 100),
          method: payment.method || null,
          note: payment.note || null,
          externalProcessor: paymentProviderName,
          externalReference: payment.externalReference || null,
          externalStatus: payment.externalStatus || 'recorded',
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to record payment')
      setPayment({ amount: '', method: '', note: '', externalReference: '', externalStatus: 'recorded' })
      await loadFamily(account.familyId)
    })

  const [refundExceptionCategory, setRefundExceptionCategory] = useState('')
  const [refundEvidenceNote, setRefundEvidenceNote] = useState('')

  const addRefund = () =>
    withSaving(async () => {
      if (!account || !refund.amount.trim()) return
      const res = await adminApiRequest(`/api/admin/families/${account.familyId}/refunds`, {
        method: 'POST',
        body: JSON.stringify({
          amountCents: Math.round(Number(refund.amount) * 100),
          reason: refund.reason || null,
          paymentId: refund.paymentId ? Number(refund.paymentId) : null,
          externalReference: refund.externalReference || null,
          exceptionCategory: refundExceptionCategory || null,
          evidenceNote: refundEvidenceNote || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to record refund')
      setRefund({ amount: '', reason: '', paymentId: '', externalReference: '' })
      setRefundExceptionCategory('')
      setRefundEvidenceNote('')
      await loadFamily(account.familyId)
    })

  const setSubscriptionStatus = (id: number, status: string) =>
    withSaving(async () => {
      const res = await adminApiRequest(`/api/admin/subscriptions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to update subscription')
      await load()
    })

  const adjustPass = (memberId: number, passId: number, delta: number) =>
    withSaving(async () => {
      const reason = window.prompt(`Reason for ${delta > 0 ? 'adding' : 'removing'} ${Math.abs(delta)} credit(s)?`) || undefined
      const res = await adminApiRequest(`/api/admin/members/${memberId}/passes/${passId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ delta, reason }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to adjust pass')
      await load()
    })

  const generateStatement = () =>
    withSaving(async () => {
      if (!account) return
      const res = await adminApiRequest(`/api/admin/families/${account.familyId}/statements`, {
        method: 'POST',
        body: JSON.stringify({ status: 'issued' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to generate statement')
      await load()
    })

  const updateStatementStatus = (statementId: number, status: string) =>
    withSaving(async () => {
      const res = await adminApiRequest(`/api/admin/statements/${statementId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update statement status')
      await load()
    })

  const subscriptions = account?.subscriptions ?? []
  const monthlyTotals = account?.monthlyTotals ?? { grossCents: 0, discountCents: 0, netCents: 0 }
  const charges = account?.charges ?? []
  const oneTimeCharges = charges.filter((c) => c.chargeType !== 'recurring')
  const recurringCharges = charges.filter((c) => c.chargeType === 'recurring')
  const payments = account?.payments ?? []
  const refunds = account?.refunds ?? []
  const ledger = account?.ledger ?? []
  const bundles = account?.bundlePasses ?? []
  const bundleUsage = account?.bundleUsage ?? []

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-50 text-green-700',
      paused: 'bg-amber-50 text-amber-700',
      cancelled: 'bg-gray-100 text-gray-500',
    }
    return map[status] || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Family Billing</h2>
        <p className="text-sm text-gray-600">
          Statement-style account: recurring enrollments, one-time charges, payments, refunds, and class bundles.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900">Stripe operations</h3>
            <p className="text-xs text-gray-500">Daily reconciliation, webhook health, disputes, and customer email identity.</p>
          </div>
          <button type="button" onClick={() => void reconcileNow()} disabled={saving || operationsLoading || !operations?.stripeEnabled} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} /> Reconcile now
          </button>
        </div>
        {operationsLoading && !operations ? (
          <div className="p-4 text-sm text-gray-500 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading operations…</div>
        ) : operations && (
          <div className="p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="text-xs text-gray-500">Sending domain</div>
                <div className="font-semibold text-gray-900">{operations.emailDomain || 'Not configured'}</div>
                <div className={`text-xs ${operations.emailDomainVerified ? 'text-green-700' : 'text-amber-700'}`}>
                  {operations.emailDomainVerified ? 'Verified in Stripe' : 'Verification required'}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="text-xs text-gray-500">Latest reconciliation</div>
                <div className="font-semibold text-gray-900">{operations.latestReconciliation?.status || 'Never run'}</div>
                <div className="text-xs text-gray-500">{operations.latestReconciliation ? `${operations.latestReconciliation.stripe_payments_checked} checked · ${operations.latestReconciliation.payments_inserted} recovered` : 'Scheduled daily at 07:15 UTC'}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="text-xs text-gray-500">Webhooks · last 7 days</div>
                <div className="font-semibold text-gray-900">{operations.webhookCounts.processed ?? 0} processed</div>
                <div className={(operations.webhookCounts.failed ?? 0) > 0 ? 'text-xs text-red-700' : 'text-xs text-gray-500'}>{operations.webhookCounts.failed ?? 0} failed</div>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
                {operations.alerts.length ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                Open billing alerts ({operations.alerts.length})
              </div>
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {operations.alerts.map((alert) => (
                  <div key={alert.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className={alert.severity === 'critical' ? 'font-semibold text-red-700' : 'font-semibold text-amber-700'}>{alert.message}</div>
                      <div className="text-xs text-gray-500">{alert.alert_type.replaceAll('_', ' ')} · {new Date(alert.created_at).toLocaleString()}{alert.stripe_object_id ? ` · ${alert.stripe_object_id}` : ''}</div>
                    </div>
                    <button type="button" onClick={() => void resolveAlert(alert.id)} disabled={saving} className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-50">Mark resolved</button>
                  </div>
                ))}
                {operations.alerts.length === 0 && <div className="p-3 text-sm text-gray-500">No unresolved Stripe alerts.</div>}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Find family billing</label>
          <input
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
            value={familyId}
            onChange={(e) => {
              setFamilyId(e.target.value)
              setLookupResults([])
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') void load() }}
            placeholder="Family ID, member name, phone, address, or email"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || !familyId.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-vortex-red text-white rounded-lg disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Search Billing
        </button>
        </div>
        {lookupResults.length > 0 && (
          <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
            {lookupResults.map((result) => (
              <button
                key={result.familyId}
                type="button"
                onClick={() => void loadFamily(result.familyId)}
                className="block w-full px-4 py-3 text-left hover:bg-gray-50"
              >
                <div className="font-semibold text-gray-900">{result.familyName} <span className="font-normal text-gray-500">· Family #{result.familyId}</span></div>
                {result.matchedMembers.map((member) => (
                  <div key={member.id} className="mt-1 text-xs text-gray-600">
                    {member.name || `Member #${member.id}`}
                    {member.email ? ` · ${member.email}` : ''}
                    {member.phone ? ` · ${member.phone}` : ''}
                    {member.address ? ` · ${member.address}` : ''}
                  </div>
                ))}
              </button>
            ))}
          </div>
        )}
      </div>

      {account && (
        <>
          {/* Account summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-900 mb-3">Account summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Net monthly (recurring)</div>
                <div className="text-lg font-bold text-gray-900">{money(monthlyTotals.netCents)}</div>
                {monthlyTotals.discountCents > 0 && (
                  <div className="text-xs text-gray-500">
                    {money(monthlyTotals.grossCents)} gross · {money(monthlyTotals.discountCents)} disc.
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Total charges</div>
                <div className="text-lg font-bold text-gray-900">{money(account.chargesCents ?? 0)}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Payments / Refunds</div>
                <div className="text-lg font-bold text-gray-900">
                  {money(account.paymentsCents ?? 0)}
                  <span className="text-xs text-gray-500"> / {money(account.refundsCents ?? 0)}</span>
                </div>
              </div>
              <div className="rounded-lg border-2 border-black p-3">
                <div className="text-xs text-gray-500">Balance due</div>
                <div className="text-lg font-bold text-black">{money(account.balanceCents ?? 0)}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(320px,400px)_1fr]">
            <div className="space-y-5">
              {/* Billing owner */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-gray-900">Billing Owner</h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Payer Member ID</label>
                  <input
                    type="number"
                    className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                    value={account.payerMemberId ?? ''}
                    onChange={(e) =>
                      setAccount((prev) => (prev ? { ...prev, payerMemberId: e.target.value ? Number(e.target.value) : null } : prev))
                    }
                  />
                </div>
                {(['billingEmail', 'billingPhone', 'billingStreet', 'billingCity', 'billingState', 'billingZip'] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{field.replace('billing', 'Billing ')}</label>
                    <input
                      className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                      value={account[field] ?? ''}
                      onChange={(e) => setAccount((prev) => (prev ? { ...prev, [field]: e.target.value } : prev))}
                    />
                  </div>
                ))}
                <button type="button" onClick={() => void saveAccount()} disabled={saving} className="px-4 py-2 bg-vortex-red text-white rounded-lg disabled:opacity-60">
                  Save Billing Owner
                </button>
              </div>

              {/* Manual charge / adjustment / credit */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-gray-900">Add Charge / Adjustment / Credit</h3>
                <select
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                  value={charge.chargeType}
                  onChange={(e) => setCharge((prev) => ({ ...prev, chargeType: e.target.value }))}
                >
                  <option value="one_time">One-time charge</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="credit">Credit / waiver (use negative amount)</option>
                </select>
                <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Athlete member ID (optional)" value={charge.memberId} onChange={(e) => setCharge((prev) => ({ ...prev, memberId: e.target.value }))} />
                <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Description" value={charge.description} onChange={(e) => setCharge((prev) => ({ ...prev, description: e.target.value }))} />
                <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Amount dollars (negative for credit)" value={charge.amount} onChange={(e) => setCharge((prev) => ({ ...prev, amount: e.target.value }))} />
                <button type="button" onClick={() => void addCharge()} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-60">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {/* Record payment */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-gray-900">Record Payment</h3>
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900">
                  Card collection is handled by <strong>{paymentProviderName}</strong>. Record reconciled payments here.
                  {!stripeEnabled && ' Stripe wiring exists but is disabled.'}
                </div>
                <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Amount dollars" value={payment.amount} onChange={(e) => setPayment((prev) => ({ ...prev, amount: e.target.value }))} />
                <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Method" value={payment.method} onChange={(e) => setPayment((prev) => ({ ...prev, method: e.target.value }))} />
                <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Note" value={payment.note} onChange={(e) => setPayment((prev) => ({ ...prev, note: e.target.value }))} />
                <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="External payment reference" value={payment.externalReference} onChange={(e) => setPayment((prev) => ({ ...prev, externalReference: e.target.value }))} />
                <button type="button" onClick={() => void addPayment()} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-60">
                  Record Payment
                </button>
              </div>

              {/* Refund */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-gray-900">Issue Refund</h3>
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                  Select a Stripe payment ID to return funds through Stripe. The refund is recorded only once and synchronized by webhook.
                </div>
                <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Amount dollars" value={refund.amount} onChange={(e) => setRefund((prev) => ({ ...prev, amount: e.target.value }))} />
                <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Reason" value={refund.reason} onChange={(e) => setRefund((prev) => ({ ...prev, reason: e.target.value }))} />
                <select required className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" value={refundExceptionCategory} onChange={(e) => setRefundExceptionCategory(e.target.value)}>
                  <option value="">Select approved exception</option>
                  <option value="duplicate_charge">Duplicate charge</option>
                  <option value="vortex_cancellation">Vortex cancellation</option>
                  <option value="medical">Documented medical issue</option>
                  <option value="relocation">Relocation</option>
                  <option value="owner_discretion">Owner discretion</option>
                </select>
                <textarea required rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Supporting evidence or Owner/Admin approval note" value={refundEvidenceNote} onChange={(e) => setRefundEvidenceNote(e.target.value)} />
                <select className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" value={refund.paymentId} onChange={(e) => setRefund((prev) => ({ ...prev, paymentId: e.target.value }))}>
                  <option value="">Local ledger refund (no Stripe payment)</option>
                  {(account.payments ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      Payment #{p.id} · {money(p.amountCents)} · {new Date(p.paidAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => void addRefund()} disabled={saving || !refundExceptionCategory || !refundEvidenceNote.trim()} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-60">
                  Issue Refund
                </button>
                <div className="divide-y divide-gray-100">
                  {refunds.map((r) => (
                    <div key={r.id} className="py-2 text-sm flex justify-between gap-3">
                      <span>{new Date(r.createdAt).toLocaleDateString()} {r.reason ? `· ${r.reason}` : ''}{r.externalStatus ? ` · ${r.externalStatus}` : ''}</span>
                      <span className={`font-semibold ${r.externalStatus === 'failed' ? 'text-red-700' : ''}`}>{money(r.amountCents)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {/* Recurring enrollments */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-semibold flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-vortex-red" /> Recurring enrollments ({subscriptions.length})
                </div>
                <div className="divide-y divide-gray-100">
                  {subscriptions.map((s) => (
                    <div key={s.id} className="px-4 py-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{s.description}</div>
                          <div className="text-xs text-gray-500">
                            {s.memberName ? `${s.memberName} · ` : ''}
                            <span className={`inline-flex px-2 py-0.5 rounded ${statusBadge(s.status)}`}>{s.status}</span>
                            {s.nextBillDate ? ` · next ${new Date(s.nextBillDate).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-gray-900">{money(s.netMonthlyCents)}/mo</div>
                          {s.discountAmountCents > 0 && (
                            <div className="text-xs text-gray-500">{money(s.monthlyAmountCents)} − {money(s.discountAmountCents)}</div>
                          )}
                        </div>
                      </div>
                      {s.status !== 'cancelled' && (
                        <div className="flex gap-2 mt-2">
                          {s.status === 'active' ? (
                            <button type="button" onClick={() => void setSubscriptionStatus(s.id, 'paused')} disabled={saving} className="rounded-lg border border-gray-300 px-3 py-1 text-xs disabled:opacity-50">Pause</button>
                          ) : (
                            <button type="button" onClick={() => void setSubscriptionStatus(s.id, 'active')} disabled={saving} className="rounded-lg border border-gray-300 px-3 py-1 text-xs disabled:opacity-50">Resume</button>
                          )}
                          <button type="button" onClick={() => void setSubscriptionStatus(s.id, 'cancelled')} disabled={saving} className="rounded-lg border border-red-300 text-red-700 px-3 py-1 text-xs disabled:opacity-50">Cancel</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {subscriptions.length === 0 && <div className="p-4 text-sm text-gray-500">No recurring enrollments.</div>}
                </div>
              </div>

              {/* One-time charges */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-semibold flex items-center gap-2">
                  <Tag className="w-4 h-4 text-gray-500" /> One-time charges ({oneTimeCharges.length})
                </div>
                <div className="divide-y divide-gray-100">
                  {oneTimeCharges.map((item) => (
                    <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900">{item.description}</div>
                        <div className="text-xs text-gray-500">
                          {item.memberName ? `${item.memberName} · ` : ''}
                          {new Date(item.createdAt).toLocaleDateString()}
                          {item.chargeType && item.chargeType !== 'one_time' ? ` · ${item.chargeType}` : ''}
                          {(item.discountAmountCents ?? 0) > 0 ? ` · disc ${money(item.discountAmountCents ?? 0)}` : ''}
                        </div>
                      </div>
                      <span className="shrink-0 font-semibold text-gray-900">{money(item.amountCents)}</span>
                    </div>
                  ))}
                  {oneTimeCharges.length === 0 && <div className="p-4 text-sm text-gray-500">No one-time charges.</div>}
                </div>
              </div>

              {/* Recurring charge postings */}
              {recurringCharges.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 font-semibold">Recurring charge history ({recurringCharges.length})</div>
                  <div className="divide-y divide-gray-100">
                    {recurringCharges.map((item) => (
                      <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{item.description}</div>
                          <div className="text-xs text-gray-500">{item.memberName ? `${item.memberName} · ` : ''}{new Date(item.createdAt).toLocaleDateString()}</div>
                        </div>
                        <span className="shrink-0 font-semibold text-gray-900">{money(item.amountCents)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unified ledger */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-semibold">Account ledger</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="text-left text-gray-600 bg-gray-50 border-b border-gray-200">
                        <th className="py-2 px-4 font-semibold">Date</th>
                        <th className="py-2 px-4 font-semibold">Description</th>
                        <th className="py-2 px-4 font-semibold">Type</th>
                        <th className="py-2 px-4 font-semibold text-right">Amount</th>
                        <th className="py-2 px-4 font-semibold text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((row, idx) => (
                        <tr key={`${row.entryKind}-${row.refId}-${idx}`} className="border-b border-gray-100">
                          <td className="py-2 px-4 whitespace-nowrap text-gray-600">{new Date(row.occurredAt).toLocaleDateString()}</td>
                          <td className="py-2 px-4 text-gray-900">{row.description}</td>
                          <td className="py-2 px-4 text-gray-500 capitalize">{row.entryType.replace(/_/g, ' ')}</td>
                          <td className={`py-2 px-4 text-right font-medium ${row.amountCents < 0 ? 'text-green-700' : 'text-gray-900'}`}>{money(row.amountCents)}</td>
                          <td className="py-2 px-4 text-right font-semibold text-gray-900">{money(row.runningBalanceCents)}</td>
                        </tr>
                      ))}
                      {ledger.length === 0 && (
                        <tr><td colSpan={5} className="p-4 text-gray-500">No ledger entries.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bundles */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-semibold">Class bundles ({bundles.length})</div>
                <div className="divide-y divide-gray-100">
                  {bundles.map((b) => (
                    <div key={b.id} className="px-4 py-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{b.packageLabel || `Pass #${b.id}`}</div>
                          <div className="text-xs text-gray-500">
                            {b.memberName ? `${b.memberName} · ` : ''}
                            <span className={`inline-flex px-2 py-0.5 rounded ${statusBadge(b.status)}`}>{b.status}</span>
                            {b.expiresAt ? ` · expires ${new Date(b.expiresAt).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-gray-900">{b.classesRemaining} / {b.classCountPurchased} left</div>
                          <div className="flex gap-1 mt-1 justify-end">
                            <button type="button" onClick={() => void adjustPass(b.memberId, b.id, 1)} disabled={saving} className="rounded border border-gray-300 px-2 text-xs disabled:opacity-50">+1</button>
                            <button type="button" onClick={() => void adjustPass(b.memberId, b.id, -1)} disabled={saving} className="rounded border border-gray-300 px-2 text-xs disabled:opacity-50">−1</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {bundles.length === 0 && <div className="p-4 text-sm text-gray-500">No class bundles.</div>}
                </div>
                {bundleUsage.length > 0 && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    <div className="text-xs font-semibold text-gray-500 mb-2">Usage history</div>
                    <div className="space-y-1">
                      {bundleUsage.slice(0, 15).map((u) => (
                        <div key={u.id} className="flex justify-between gap-3 text-xs text-gray-600">
                          <span>
                            {new Date(u.createdAt).toLocaleDateString()} · {u.entryType}
                            {u.reason ? ` · ${u.reason}` : ''}
                          </span>
                          <span className={u.creditDelta != null && u.creditDelta > 0 ? 'text-green-700' : 'text-gray-700'}>
                            {u.creditDelta != null ? (u.creditDelta > 0 ? `+${u.creditDelta}` : u.creditDelta) : ''} → {u.classesRemainingAfter} left
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Statements */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div className="font-semibold">Statements</div>
                  <button type="button" onClick={() => void generateStatement()} disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 bg-vortex-red text-white rounded-lg text-sm disabled:opacity-60">
                    <Receipt className="w-4 h-4" /> Generate
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {statements.map((statement) => (
                    <div key={statement.id} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">Statement #{statement.id} · {statement.status}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(statement.statementDate).toLocaleDateString()}
                            {statement.dueDate ? ` · due ${new Date(statement.dueDate).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                        <div className="font-bold text-gray-900">{money(statement.totalCents)}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {['issued', 'paid', 'void'].map((status) => (
                          <button key={status} type="button" onClick={() => void updateStatementStatus(statement.id, status)} disabled={saving || statement.status === status} className="rounded-lg border border-gray-300 px-3 py-1 text-xs disabled:opacity-50">
                            Mark {status}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 space-y-2">
                        {statement.lines.map((line, idx) => (
                          <div key={line.id ?? idx} className="flex justify-between gap-3 text-sm text-gray-600">
                            <span>{line.description}</span>
                            <span>{money(Number(line.amount_cents ?? 0))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {statements.length === 0 && <div className="p-4 text-sm text-gray-500">No statements yet.</div>}
                </div>
              </div>

              {/* Payments list */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-semibold">Payments ({payments.length})</div>
                <div className="divide-y divide-gray-100">
                  {payments.map((item) => (
                    <div key={item.id} className="px-4 py-3 text-sm flex justify-between gap-3">
                      <span className="text-gray-600">
                        {new Date(item.paidAt).toLocaleDateString()} {item.method ? `· ${item.method}` : ''}
                        {item.externalReference ? ` · Ref ${item.externalReference}` : ''}
                        {item.externalStatus ? ` · ${item.externalStatus}` : ''}
                      </span>
                      <span className="font-semibold">{money(item.amountCents)}</span>
                    </div>
                  ))}
                  {payments.length === 0 && <div className="p-4 text-sm text-gray-500">No payments recorded.</div>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
