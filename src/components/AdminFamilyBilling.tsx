import { useState } from 'react'
import { Loader2, Plus, Receipt } from 'lucide-react'
import { adminApiRequest } from '../utils/api'

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
  balanceCents?: number
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
  externalProcessor?: string | null
  externalReference?: string | null
  externalStatus?: string | null
  stripeCustomerId?: string | null
  stripePaymentIntentId?: string | null
}

interface BillingCharge {
  id: number
  memberId: number | null
  memberName: string | null
  sourceType: string
  description: string
  amountCents: number
  createdAt: string
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default function AdminFamilyBilling() {
  const [familyId, setFamilyId] = useState('')
  const [account, setAccount] = useState<BillingAccount | null>(null)
  const [statements, setStatements] = useState<BillingStatement[]>([])
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [charges, setCharges] = useState<BillingCharge[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [charge, setCharge] = useState({ memberId: '', description: '', amount: '' })
  const [paymentProviderName, setPaymentProviderName] = useState('External Payment Processor')
  const [stripeEnabled, setStripeEnabled] = useState(false)
  const [payment, setPayment] = useState({
    amount: '',
    method: '',
    note: '',
    externalReference: '',
    externalStatus: 'recorded',
  })

  const load = async () => {
    if (!familyId.trim()) return
    setLoading(true)
    setError(null)
    try {
      const [accountRes, statementsRes, paymentsRes, chargesRes, providerRes] = await Promise.all([
        adminApiRequest(`/api/admin/families/${familyId}/billing-account`),
        adminApiRequest(`/api/admin/families/${familyId}/statements`),
        adminApiRequest(`/api/admin/families/${familyId}/payments`),
        adminApiRequest(`/api/admin/families/${familyId}/charges`),
        adminApiRequest('/api/admin/billing/provider-config'),
      ])
      if (!accountRes.ok) throw new Error(`Billing account request failed: ${accountRes.status}`)
      if (!statementsRes.ok) throw new Error(`Statements request failed: ${statementsRes.status}`)
      if (!paymentsRes.ok) throw new Error(`Payments request failed: ${paymentsRes.status}`)
      if (!chargesRes.ok) throw new Error(`Charges request failed: ${chargesRes.status}`)
      if (!providerRes.ok) throw new Error(`Provider request failed: ${providerRes.status}`)
      const accountJson = await accountRes.json()
      const statementsJson = await statementsRes.json()
      const paymentsJson = await paymentsRes.json()
      const chargesJson = await chargesRes.json()
      const providerJson = await providerRes.json()
      setAccount(accountJson.data)
      setStatements(statementsJson.data ?? [])
      setPayments(paymentsJson.data ?? [])
      setCharges(chargesJson.data ?? [])
      setPaymentProviderName(providerJson.data?.externalProcessorName || 'External Payment Processor')
      setStripeEnabled(providerJson.data?.stripeEnabled === true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing account')
    } finally {
      setLoading(false)
    }
  }

  const saveAccount = async () => {
    if (!account) return
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest(`/api/admin/families/${account.familyId}/billing-account`, {
        method: 'PUT',
        body: JSON.stringify(account),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to save billing account')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save billing account')
    } finally {
      setSaving(false)
    }
  }

  const addCharge = async () => {
    if (!account || !charge.description.trim() || !charge.amount.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest(`/api/admin/families/${account.familyId}/charges`, {
        method: 'POST',
        body: JSON.stringify({
          memberId: charge.memberId ? Number(charge.memberId) : null,
          description: charge.description,
          amountCents: Math.round(Number(charge.amount) * 100),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to add charge')
      }
      setCharge({ memberId: '', description: '', amount: '' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add charge')
    } finally {
      setSaving(false)
    }
  }

  const generateStatement = async () => {
    if (!account) return
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest(`/api/admin/families/${account.familyId}/statements`, {
        method: 'POST',
        body: JSON.stringify({ status: 'issued' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to generate statement')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate statement')
    } finally {
      setSaving(false)
    }
  }

  const addPayment = async () => {
    if (!account || !payment.amount.trim()) return
    setSaving(true)
    setError(null)
    try {
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to record payment')
      }
      setPayment({ amount: '', method: '', note: '', externalReference: '', externalStatus: 'recorded' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  const updateStatementStatus = async (statementId: number, status: string) => {
    setSaving(true)
    try {
      const res = await adminApiRequest(`/api/admin/statements/${statementId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update statement status')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update statement status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Family Billing</h2>
        <p className="text-sm text-gray-600">
          Manage the single payer and internal statements for each family billing account.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Family ID</label>
          <input
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
            value={familyId}
            onChange={(e) => setFamilyId(e.target.value)}
            placeholder="Enter family ID"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || !familyId.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-vortex-red text-white rounded-lg disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Load Billing
        </button>
      </div>

      {account && (
        <div className="grid gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="font-bold text-gray-900">Billing Owner</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg bg-gray-50 p-2">
                  <div className="text-xs text-gray-500">Charges</div>
                  <div className="font-bold">{money(account.chargesCents ?? 0)}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <div className="text-xs text-gray-500">Payments</div>
                  <div className="font-bold">{money(account.paymentsCents ?? 0)}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <div className="text-xs text-gray-500">Balance</div>
                  <div className="font-bold">{money(account.balanceCents ?? 0)}</div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Payer Member ID</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                  value={account.payerMemberId ?? ''}
                  onChange={(e) =>
                    setAccount((prev) =>
                      prev ? { ...prev, payerMemberId: e.target.value ? Number(e.target.value) : null } : prev,
                    )
                  }
                />
              </div>
              {(['billingEmail', 'billingPhone', 'billingStreet', 'billingCity', 'billingState', 'billingZip'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {field.replace('billing', 'Billing ')}
                  </label>
                  <input
                    className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                    value={account[field] ?? ''}
                    onChange={(e) => setAccount((prev) => (prev ? { ...prev, [field]: e.target.value } : prev))}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => void saveAccount()}
                disabled={saving}
                className="px-4 py-2 bg-vortex-red text-white rounded-lg disabled:opacity-60"
              >
                Save Billing Owner
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="font-bold text-gray-900">Add Manual Charge</h3>
              <input
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                placeholder="Athlete member ID (optional)"
                value={charge.memberId}
                onChange={(e) => setCharge((prev) => ({ ...prev, memberId: e.target.value }))}
              />
              <input
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                placeholder="Description"
                value={charge.description}
                onChange={(e) => setCharge((prev) => ({ ...prev, description: e.target.value }))}
              />
              <input
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                placeholder="Amount dollars"
                value={charge.amount}
                onChange={(e) => setCharge((prev) => ({ ...prev, amount: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => void addCharge()}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                Add Charge
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="font-bold text-gray-900">Record Payment</h3>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900">
                Launch mode: card collection is handled by <strong>{paymentProviderName}</strong>. Record reconciled payments here.
                {!stripeEnabled && ' Stripe wiring exists but is disabled.'}
              </div>
              <input
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                placeholder="Amount dollars"
                value={payment.amount}
                onChange={(e) => setPayment((prev) => ({ ...prev, amount: e.target.value }))}
              />
              <input
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                placeholder="Method"
                value={payment.method}
                onChange={(e) => setPayment((prev) => ({ ...prev, method: e.target.value }))}
              />
              <input
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                placeholder="Note"
                value={payment.note}
                onChange={(e) => setPayment((prev) => ({ ...prev, note: e.target.value }))}
              />
              <input
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                placeholder="External payment reference"
                value={payment.externalReference}
                onChange={(e) => setPayment((prev) => ({ ...prev, externalReference: e.target.value }))}
              />
              <select
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                value={payment.externalStatus}
                onChange={(e) => setPayment((prev) => ({ ...prev, externalStatus: e.target.value }))}
              >
                <option value="recorded">Recorded</option>
                <option value="pending">Pending</option>
                <option value="settled">Settled</option>
                <option value="void">Void</option>
              </select>
              <button
                type="button"
                onClick={() => void addPayment()}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-60"
              >
                Record Payment
              </button>
              <div className="divide-y divide-gray-100">
                {payments.map((item) => (
                  <div key={item.id} className="py-2 text-sm flex justify-between gap-3">
                    <span>
                      {new Date(item.paidAt).toLocaleDateString()} {item.method ? `· ${item.method}` : ''}
                      {item.externalReference ? ` · Ref ${item.externalReference}` : ''}
                      {item.externalStatus ? ` · ${item.externalStatus}` : ''}
                    </span>
                    <span className="font-semibold">{money(item.amountCents)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 font-semibold">
              Charge ledger ({charges.length})
            </div>
            <div className="divide-y divide-gray-100">
              {charges.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{item.description}</div>
                    <div className="text-xs text-gray-500">
                      {item.memberName ? `${item.memberName} · ` : ''}
                      {new Date(item.createdAt).toLocaleDateString()}
                      {item.sourceType && item.sourceType !== 'manual'
                        ? ` · ${item.sourceType.replace(/_/g, ' ')}`
                        : ' · manual'}
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold text-gray-900">{money(item.amountCents)}</span>
                </div>
              ))}
              {charges.length === 0 && <div className="p-4 text-sm text-gray-500">No charges yet.</div>}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="font-semibold">Statements</div>
              <button
                type="button"
                onClick={() => void generateStatement()}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-2 bg-vortex-red text-white rounded-lg text-sm disabled:opacity-60"
              >
                <Receipt className="w-4 h-4" />
                Generate
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {statements.map((statement) => (
                <div key={statement.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">
                        Statement #{statement.id} · {statement.status}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(statement.statementDate).toLocaleDateString()}
                        {statement.dueDate ? ` · due ${new Date(statement.dueDate).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                    <div className="font-bold text-gray-900">{money(statement.totalCents)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {['issued', 'paid', 'void'].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => void updateStatementStatus(statement.id, status)}
                        disabled={saving || statement.status === status}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-xs disabled:opacity-50"
                      >
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
          </div>
        </div>
      )}
    </div>
  )
}
