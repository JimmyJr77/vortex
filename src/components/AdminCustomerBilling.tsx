import { Fragment, type FormEvent, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  Mail,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Users,
  WalletCards,
} from 'lucide-react'
import { adminApiRequest } from '../utils/api'
import { CustomChargeModal, ModifyChargeModal, PriceAdjustmentModal, RefundModal } from './customerBilling/CustomerBillingModals'
import NewBillingEnrollmentModal from './customerBilling/NewBillingEnrollmentModal'
import { billingMonthAbbreviation, billingMonthLabel, calendarDate, localDate, money, monthLabel, statusTone } from './customerBilling/format'
import type {
  BillingActivity,
  BillingDiscountComponent,
  BillingTransaction,
  CustomerBillingAnnualMembership,
  CustomerBillingEnrollment,
  CustomerBillingOverview,
  CustomerBillingSearchResult,
  PriceAdjustment,
} from './customerBilling/types'

interface AccessState {
  isMasterAdmin: boolean
  permissions: string[]
}

interface BillingMigrationStatus {
  accountId: number
  migrationId?: number
  state: string
  parityStatus: string
  parity: Record<string, unknown>
  targetMonth: string | null
  attempts: number
  lastError: string | null
  updatedAt: string | null
  run: null | {
    id: number
    key: string
    mode: string
    status: string
    codeVersion: string | null
  }
  exceptions: Array<{
    id: number
    type: string
    severity: string
    status: string
    message: string
    detectedAt: string
  }>
}

interface ContactDraft {
  payerMemberId: number | null
  billingEmail: string
  billingPhone: string
  billingStreet: string
  billingCity: string
  billingState: string
  billingZip: string
}

const EMPTY_CONTACT: ContactDraft = {
  payerMemberId: null,
  billingEmail: '',
  billingPhone: '',
  billingStreet: '',
  billingCity: '',
  billingState: '',
  billingZip: '',
}

async function jsonBody(response: Response) {
  return response.json().catch(() => ({}))
}

function uniqueRequestKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${suffix}`
}

function localDateTimeInputValue(date = new Date()) {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localTime.toISOString().slice(0, 16)
}

function Badge({ value, label }: { value: string; label?: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${statusTone(value)}`}>{label ?? value.replaceAll('_', ' ')}</span>
}

function auditDetailLabel(label: string) {
  return label
    .replace(/Cents$/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
}

function auditDetailValue(label: string, value: unknown) {
  if (/Cents$/.test(label) && Number.isFinite(Number(value))) return money(Number(value))
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function AuditDetailValue({ label, value }: { label: string; value: unknown }) {
  if (Array.isArray(value)) {
    return value.length ? (
      <div className="mt-1 space-y-1.5">
        {value.map((item, index) => {
          const record = item && typeof item === 'object' ? item as Record<string, unknown> : { value: item }
          return (
            <div key={String('applicationId' in record ? record.applicationId ?? index : index)} className="rounded-md border border-gray-200 bg-white p-2 text-gray-700">
              {Object.entries(record).filter(([, entry]) => entry != null && entry !== '').map(([entryLabel, entry]) => (
                <div key={entryLabel}><span className="font-semibold">{auditDetailLabel(entryLabel)}:</span> {auditDetailValue(entryLabel, entry)}</div>
              ))}
            </div>
          )
        })}
      </div>
    ) : <span className="text-gray-500">None</span>
  }
  return <span className="break-all text-gray-700">{auditDetailValue(label, value)}</span>
}

function retryableAdjustmentForEnrollment(enrollment: CustomerBillingEnrollment): PriceAdjustment | null {
  const liveAdjustments = enrollment.priceAdjustments.filter((adjustment) => adjustment.status !== 'revoked')
  const failedAdjustment = liveAdjustments.find((adjustment) => adjustment.status === 'sync_failed')
  if (failedAdjustment) return failedAdjustment
  if (enrollment.priceSyncStatus !== 'failed') return null
  const activeAdjustments = enrollment.activePriceAdjustments ?? (
    enrollment.activePriceAdjustment ? [enrollment.activePriceAdjustment] : []
  )
  return activeAdjustments.find((adjustment) => adjustment.status === 'active')
    ?? liveAdjustments.find((adjustment) => adjustment.status === 'active')
    ?? null
}

function enrollmentPriceSyncLabel(enrollment: CustomerBillingEnrollment): string {
  if (enrollment.collectionMode === 'household_monthly') return 'Household monthly billing'
  if (enrollment.collectionMode === 'household_payment_method_required') return 'Household billing needs card'
  if (enrollment.collectionMode === 'legacy_stripe_subscription') return 'Legacy Stripe subscription'
  if (enrollment.collectionMode === 'autopay_setup_required') return 'Autopay setup required'
  if (enrollment.priceSyncStatus === 'synced') return 'Stripe pricing synced'
  if (enrollment.priceSyncStatus === 'failed') return 'Stripe pricing sync failed'
  if (enrollment.priceSyncStatus !== 'not_required') {
    return `Stripe pricing ${enrollment.priceSyncStatus.replaceAll('_', ' ')}`
  }

  const noAutopayNeeded = enrollment.source === 'drop_in'
    || enrollment.billingType === 'one_time'
    || enrollment.billing_status === 'one_time'
    || ['waitlist', 'waitlisted'].includes(enrollment.status)
    || enrollment.adjustedCostCents <= 0
  return noAutopayNeeded ? 'No autopay needed' : 'Autopay not set'
}

function StripeSyncFailure({ error }: { error: string }) {
  const previousRequestFormat = /metadata.*from_subscription/i.test(error)
  return (
    <div className="mt-2 max-w-[260px] rounded-lg border border-red-200 bg-red-50 p-2 text-left text-xs text-red-800">
      <strong className="block">
        {previousRequestFormat ? 'Previous Stripe attempt used the old schedule request.' : 'Stripe has not confirmed this recurring price.'}
      </strong>
      <span className="mt-1 block">
        {previousRequestFormat ? 'Retry Stripe sync now that the server fix is deployed.' : 'Retry Stripe sync. Until it succeeds, Stripe may retain an older price.'}
      </span>
      <details className="mt-1 text-[11px] text-red-700">
        <summary className="cursor-pointer font-semibold">Technical detail from last attempt</summary>
        <p className="mt-1 break-words">{error}</p>
      </details>
    </div>
  )
}

function MetricCard({ label, value, detail, tone = 'default' }: { label: string; value: string; detail?: string; tone?: 'default' | 'positive' | 'warning' }) {
  const valueClass = tone === 'positive' ? 'text-emerald-700' : tone === 'warning' ? 'text-amber-700' : 'text-gray-950'
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</div>
      {detail ? <div className="mt-1 text-xs text-gray-500">{detail}</div> : null}
    </div>
  )
}

function MigrationStatusCard({ status }: { status: BillingMigrationStatus }) {
  const openExceptions = status.exceptions.filter((exception) => !['resolved', 'waived'].includes(exception.status))
  const verified = status.state === 'verified' && status.parityStatus === 'matched'
  return (
    <section className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${openExceptions.length > 0 || status.lastError ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-gray-950">Canonical billing migration</h2>
            <Badge value={status.state} />
            <Badge value={status.parityStatus} label={`Parity: ${status.parityStatus.replaceAll('_', ' ')}`} />
          </div>
          <p className="mt-1 text-sm text-gray-500">Read-only rollout status. Migration controls remain restricted to the deployment CLI.</p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>{status.targetMonth ? `Target: ${billingMonthLabel(status.targetMonth)}` : 'No cutover month assigned'}</div>
          {status.updatedAt ? <div className="mt-1">Updated {localDate(status.updatedAt, true)}</div> : null}
        </div>
      </div>
      <div className="grid gap-3 border-t border-gray-200 bg-gray-50 p-5 sm:grid-cols-3">
        <div><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Run</div><div className="mt-1 text-sm font-bold text-gray-900">{status.run ? `#${status.run.id} · ${status.run.mode}` : 'Not assigned'}</div>{status.run ? <div className="mt-1 text-xs text-gray-500">{status.run.status} · {status.run.key}</div> : null}</div>
        <div><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Verification</div><div className={`mt-1 text-sm font-bold ${verified ? 'text-emerald-700' : 'text-gray-900'}`}>{verified ? 'Canonical account verified' : status.parityStatus.replaceAll('_', ' ')}</div><div className="mt-1 text-xs text-gray-500">{status.attempts} worker attempt{status.attempts === 1 ? '' : 's'}</div></div>
        <div><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Exceptions</div><div className={`mt-1 text-sm font-bold ${openExceptions.length > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>{openExceptions.length > 0 ? `${openExceptions.length} unresolved` : 'None unresolved'}</div></div>
      </div>
      {status.lastError ? <div className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800"><strong>Last migration error:</strong> {status.lastError}</div> : null}
      {openExceptions.length > 0 ? (
        <div className="space-y-2 border-t border-amber-200 bg-amber-50 p-5">
          {openExceptions.slice(0, 5).map((exception) => (
            <div key={exception.id} className="flex items-start justify-between gap-3 text-sm text-amber-950">
              <div><span className="font-bold capitalize">{exception.severity}</span> · {exception.message}<div className="mt-0.5 text-xs text-amber-700">{exception.type.replaceAll('_', ' ')}</div></div>
              <span className="shrink-0 text-xs text-amber-700">{localDate(exception.detectedAt)}</span>
            </div>
          ))}
          {openExceptions.length > 5 ? <div className="text-xs font-semibold text-amber-800">+ {openExceptions.length - 5} more unresolved exceptions</div> : null}
        </div>
      ) : null}
    </section>
  )
}

function BalanceCollectionModal({
  familyId,
  balanceCents,
  paymentMethod,
  onClose,
  onSaved,
}: {
  familyId: number
  balanceCents: number
  paymentMethod: NonNullable<CustomerBillingOverview['paymentMethod']['paymentMethod']>
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [mode, setMode] = useState<'balance' | 'custom'>('balance')
  const [customAmount, setCustomAmount] = useState('')
  const [authorizationSource, setAuthorizationSource] = useState('')
  const [authorizationNote, setAuthorizationNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const amountCents = mode === 'balance' ? balanceCents : Math.round(Number(customAmount) * 100)
  const validAmount = Number.isInteger(amountCents) && amountCents > 0 && amountCents <= balanceCents
  const submit = async () => {
    if (!validAmount || !authorizationSource.trim() || !authorizationNote.trim() || !confirmed) return
    setWorking(true); setError(null)
    try {
      const response = await adminApiRequest(`/api/admin/customer-billing/families/${familyId}/process-outstanding-balance`, {
        method: 'POST',
        body: JSON.stringify({
          requestKey: `balance-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
          amountCents,
          authorization: { source: authorizationSource.trim(), note: authorizationNote.trim(), date: new Date().toISOString().slice(0, 10), confirmed: true, confirmedAmountCents: amountCents },
        }),
      })
      const body = await jsonBody(response)
      if (!response.ok) throw new Error(body.message || 'Account balance could not be collected.')
      onSaved(`Saved card charged ${money(amountCents)} and applied to the account balance.`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Account balance could not be collected.') } finally { setWorking(false) }
  }
  return <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-gray-200 px-6 py-5"><div><h2 className="text-xl font-bold text-gray-950">Process monthly balance</h2><p className="mt-1 text-sm text-gray-500">Choose how much of the current account balance to collect.</p></div><button type="button" onClick={onClose} className="text-xl text-gray-500">×</button></div><div className="space-y-4 p-6"><label className="flex gap-3 rounded-xl border border-gray-200 p-3"><input type="radio" checked={mode === 'balance'} onChange={() => setMode('balance')} /><span><strong className="block">Current account balance · {money(balanceCents)}</strong><span className="text-xs text-gray-500">Apply the full outstanding account balance.</span></span></label><label className="flex gap-3 rounded-xl border border-gray-200 p-3"><input type="radio" checked={mode === 'custom'} onChange={() => setMode('custom')} /><span className="flex-1"><strong className="block">Custom amount</strong><input type="number" min="0.01" max={(balanceCents / 100).toFixed(2)} step="0.01" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="0.00" /></span></label><div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"><strong className="block text-gray-900">Payment method</strong><label className="mt-2 flex items-center gap-2"><input type="radio" checked readOnly /><span className="capitalize">{paymentMethod.brand} •••• {paymentMethod.last4}</span></label></div><label className="block text-sm font-semibold text-gray-700">Authorization source<input value={authorizationSource} onChange={(event) => setAuthorizationSource(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label><label className="block text-sm font-semibold text-gray-700">Authorization note<input value={authorizationNote} onChange={(event) => setAuthorizationNote(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label><label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />I confirm the exact amount of {money(validAmount ? amountCents : 0)} for this saved-card charge.</label>{!validAmount && mode === 'custom' ? <p className="text-sm text-red-700">Enter an amount from $0.01 through {money(balanceCents)}.</p> : null}{error ? <p className="text-sm text-red-700">{error}</p> : null}<button type="button" disabled={working || !validAmount || !authorizationSource.trim() || !authorizationNote.trim() || !confirmed} onClick={() => void submit()} className="w-full rounded-lg bg-gray-950 px-4 py-3 font-semibold text-white disabled:opacity-40">{working ? 'Processing…' : `Charge ${money(validAmount ? amountCents : 0)}`}</button></div></div></div>
}

const EXTERNAL_PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other external payment' },
] as const

function ExternalPaymentModal({
  familyId,
  collectibleBalanceCents,
  onClose,
  onSaved,
}: {
  familyId: number
  collectibleBalanceCents: number
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<(typeof EXTERNAL_PAYMENT_METHODS)[number]['value']>('cash')
  const [paidAt, setPaidAt] = useState(() => localDateTimeInputValue())
  const [externalReference, setExternalReference] = useState('')
  const [note, setNote] = useState('')
  const [requestKey] = useState(() => uniqueRequestKey('external-payment'))
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const amountCents = Math.round(Number(amount) * 100)
  const parsedPaidAt = new Date(paidAt)
  const validAmount = Number.isInteger(amountCents)
    && amountCents > 0
    && amountCents <= collectibleBalanceCents
  const validPaidAt = paidAt !== '' && !Number.isNaN(parsedPaidAt.getTime())
  const methodLabel = EXTERNAL_PAYMENT_METHODS.find((option) => option.value === method)?.label ?? 'External'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validAmount || !validPaidAt) return
    setWorking(true)
    setError(null)
    try {
      const response = await adminApiRequest(
        `/api/admin/customer-billing/families/${familyId}/payments`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': requestKey },
          body: JSON.stringify({
            amountCents,
            method,
            paidAt: parsedPaidAt.toISOString(),
            externalReference: externalReference.trim() || null,
            note: note.trim() || null,
          }),
        },
      )
      const body = await jsonBody(response)
      if (!response.ok) throw new Error(body.message || 'External payment could not be recorded.')
      onSaved(`${methodLabel} payment of ${money(amountCents)} recorded and applied to the account.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'External payment could not be recorded.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="external-payment-title" className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 id="external-payment-title" className="text-xl font-bold text-gray-950">Record cash/check/external payment</h2>
            <p className="mt-1 text-sm text-gray-500">This creates an append-only payment and allocates it against the household balance.</p>
          </div>
          <button type="button" onClick={onClose} disabled={working} aria-label="Close payment form" className="rounded p-1 text-xl text-gray-500 hover:bg-gray-100 disabled:opacity-40">×</button>
        </div>
        <form onSubmit={(event) => void submit(event)} className="space-y-4 p-6">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            Available collectible balance: <strong className="text-gray-950">{money(collectibleBalanceCents)}</strong>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">
              Payment amount
              <input type="number" min="0.01" max={(collectibleBalanceCents / 100).toFixed(2)} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" placeholder="0.00" />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Payment method
              <select required value={method} onChange={(event) => setMethod(event.target.value as typeof method)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal">
                {EXTERNAL_PAYMENT_METHODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm font-semibold text-gray-700">
            Payment date and time
            <input type="datetime-local" required value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-gray-700">
            Check or external reference <span className="font-normal text-gray-400">(optional)</span>
            <input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" placeholder="Check number, bank reference, or receipt ID" />
          </label>
          <label className="block text-sm font-semibold text-gray-700">
            Note <span className="font-normal text-gray-400">(optional)</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" placeholder="Administrative context for this payment" />
          </label>
          {!validAmount && amount ? <p className="text-sm text-red-700">Enter an amount from $0.01 through {money(collectibleBalanceCents)}.</p> : null}
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} disabled={working} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40">Cancel</button>
            <button type="submit" disabled={working || !validAmount || !validPaidAt} className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
              {working ? 'Recording…' : `Record ${money(validAmount ? amountCents : 0)} payment`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PassAdjustmentModal({
  pass,
  onClose,
  onSaved,
}: {
  pass: CustomerBillingOverview['bundlePasses'][number]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [direction, setDirection] = useState<'add' | 'remove'>('add')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [requestKey] = useState(() => uniqueRequestKey('pass-adjustment'))
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const parsedQuantity = Number(quantity)
  const validQuantity = Number.isInteger(parsedQuantity)
    && parsedQuantity > 0
    && (direction === 'add' || parsedQuantity <= pass.classesRemaining)
  const delta = direction === 'add' ? parsedQuantity : -parsedQuantity
  const resultingBalance = validQuantity ? pass.classesRemaining + delta : pass.classesRemaining

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validQuantity || !reason.trim()) return
    setWorking(true)
    setError(null)
    try {
      const response = await adminApiRequest(
        `/api/admin/entitlements/multi-class-passes/${pass.id}/adjustments`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': requestKey },
          body: JSON.stringify({ delta, reason: reason.trim() }),
        },
      )
      const body = await jsonBody(response)
      if (!response.ok) throw new Error(body.message || 'Pass balance could not be adjusted.')
      const remaining = Number(body.data?.classesRemaining ?? resultingBalance)
      onSaved(`${pass.packageLabel || `Pass #${pass.id}`} adjusted by ${delta > 0 ? '+' : ''}${delta}; ${remaining} classes remain.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pass balance could not be adjusted.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="pass-adjustment-title" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 id="pass-adjustment-title" className="text-xl font-bold text-gray-950">Adjust class bundle balance</h2>
            <p className="mt-1 text-sm text-gray-500">{pass.packageLabel || `Pass #${pass.id}`} · {pass.memberName || 'Family member'}</p>
          </div>
          <button type="button" onClick={onClose} disabled={working} aria-label="Close pass adjustment form" className="rounded p-1 text-xl text-gray-500 hover:bg-gray-100 disabled:opacity-40">×</button>
        </div>
        <form onSubmit={(event) => void submit(event)} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
            <div><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current</div><div className="mt-1 text-xl font-black text-gray-950">{pass.classesRemaining}</div></div>
            <div><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">After adjustment</div><div className="mt-1 text-xl font-black text-gray-950">{resultingBalance}</div></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">
              Adjustment
              <select value={direction} onChange={(event) => setDirection(event.target.value as 'add' | 'remove')} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal">
                <option value="add">Add credits</option>
                <option value="remove" disabled={pass.classesRemaining <= 0}>Remove credits</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Number of classes
              <input type="number" min="1" max={direction === 'remove' ? pass.classesRemaining : undefined} step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
            </label>
          </div>
          <label className="block text-sm font-semibold text-gray-700">
            Reason
            <textarea required value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" placeholder="Why this append-only adjustment is needed" />
          </label>
          {!validQuantity && quantity ? <p className="text-sm text-red-700">Enter a whole number that does not remove more than the current balance.</p> : null}
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} disabled={working} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40">Cancel</button>
            <button type="submit" disabled={working || !validQuantity || !reason.trim()} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {working ? 'Saving…' : 'Record adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function discountPercent(amountValue: number | null | undefined) {
  if (amountValue == null || !Number.isFinite(Number(amountValue))) return null
  const percent = Number(amountValue) / 100
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`
}

function discountComponentDetail(component: BillingDiscountComponent) {
  const details: string[] = []
  const percent = component.amountType === 'percent'
    ? discountPercent(component.amountValue)
    : null

  if (component.type === 'promo_code') {
    if (component.promoCode) details.push(component.promoCode)
  } else if (component.source === 'automatic') {
    details.push(component.type === 'spend_volume' ? 'Automatic household tier' : 'Automatic discount')
  } else if (component.source === 'manual') {
    details.push('Enrollment discount')
  }
  if (
    component.qualifiedClassCount != null &&
    component.qualifyingSubtotalCents != null
  ) {
    details.push(
      `${component.qualifiedClassCount} classes · ${money(component.qualifyingSubtotalCents)} qualifying tuition`,
    )
  } else if (component.qualifiedLabel && !percent) {
    details.push(component.qualifiedLabel)
  }
  return details.join(' · ')
}

function discountComponentLabel(component: BillingDiscountComponent) {
  const percent = component.amountType === 'percent'
    ? discountPercent(component.amountValue)
    : null
  if (component.type === 'promo_code') {
    const expiration = component.expiresOn || component.endsAt?.slice(0, 10)
    return `${percent ? `${percent} Discount` : component.name}${expiration ? ` until ${expiration}` : ''}`
  }
  if (percent && component.type === 'spend_volume' && !component.name.startsWith(percent)) {
    return `${percent} ${component.name}`
  }
  return component.name
}

function DiscountBreakdown({
  totalCents,
  components,
}: {
  totalCents: number
  components: BillingDiscountComponent[]
}) {
  if (totalCents <= 0) return <span className="text-gray-400">—</span>
  const itemized = components.filter((component) => component.amountCents > 0)
  const itemizedTotal = itemized.reduce((sum, component) => sum + component.amountCents, 0)
  const unitemizedCents = Math.max(0, totalCents - itemizedTotal)
  const rows: BillingDiscountComponent[] = unitemizedCents > 0
    ? [...itemized, { name: 'Other discount', amountCents: unitemizedCents, source: null }]
    : itemized

  if (rows.length === 0) {
    return <div className="text-emerald-700">Discount −{money(totalCents)}</div>
  }

  return (
    <div className="space-y-1 text-sm font-medium">
      {rows.map((component, index) => {
        const detail = discountComponentDetail(component)
        return (
          <div key={`${component.ruleId ?? component.name}-${index}`}>
            <div className="flex items-baseline gap-1.5 text-gray-700">
              <span>{discountComponentLabel(component)}</span>
              <span className="shrink-0 text-emerald-700">−{money(component.amountCents)}</span>
            </div>
            {detail ? <div className="text-left text-[11px] text-gray-400">{detail}</div> : null}
          </div>
        )
      })}
      {rows.length > 1 ? (
        <div className="flex items-baseline gap-1.5 border-t border-gray-200 pt-1 font-semibold text-emerald-700">
          <span>Total discounts</span>
          <span>−{money(totalCents)}</span>
        </div>
      ) : null}
    </div>
  )
}

function SearchResults({
  results,
  onSelect,
}: {
  results: CustomerBillingSearchResult[]
  onSelect: (result: CustomerBillingSearchResult) => void
}) {
  if (results.length === 0) return null
  return (
    <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[420px] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
      {results.map((result) => (
        <button
          key={`${result.familyId}-${result.memberId}`}
          type="button"
          onClick={() => onSelect(result)}
          className="flex w-full items-start justify-between gap-4 rounded-lg px-3 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
        >
          <span className="min-w-0">
            <strong className="block truncate text-sm text-gray-950">{result.name}</strong>
            <span className="block truncate text-xs text-gray-500">{result.email || 'No email'} · {result.phone || 'No phone'}</span>
          </span>
          <span className="shrink-0 text-right text-xs text-gray-500">
            <span className="block font-medium text-gray-700">{result.familyName}</span>
            Family #{result.familyId}
          </span>
        </button>
      ))}
    </div>
  )
}

function MembershipMetricCard({
  membership,
  canManage,
  saving,
  onSetAutoRenewal,
  onBillNow,
}: {
  membership: CustomerBillingAnnualMembership
  canManage: boolean
  saving: boolean
  onSetAutoRenewal: (membership: CustomerBillingAnnualMembership, enabled: boolean) => void
  onBillNow: (membership: CustomerBillingAnnualMembership) => void
}) {
  const hasOutstandingBill = membership.outstandingChargeId != null
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${membership.active ? 'border-gray-700 bg-gray-800 text-white' : 'border-red-800 bg-red-700 text-white'}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-300">Annual membership</div>
      <div className="mt-1 truncate text-xl font-bold">{membership.memberName}</div>
      <div className="mt-1 text-sm text-gray-200">Good through {calendarDate(membership.renewalDate)}</div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold">{membership.active ? 'Valid' : 'Not valid'} · Auto-renewal {membership.autoRenewal ? 'Yes' : 'No'}</span><span className="flex gap-2">{canManage && !membership.active ? <button type="button" disabled={saving || hasOutstandingBill} onClick={() => onBillNow(membership)} title={hasOutstandingBill ? `An annual membership bill of ${money(membership.outstandingAmountCents)} is already outstanding.` : `Add this athlete's annual membership fee to the ledger.`} className="rounded border border-white/30 px-2 py-1 font-semibold disabled:cursor-not-allowed disabled:bg-black/20 disabled:opacity-45">Bill now</button> : null}{canManage && membership.canManageAutoRenewal && membership.billingSubscriptionId != null ? <button type="button" disabled={saving} onClick={() => onSetAutoRenewal(membership, !membership.autoRenewal)} className="rounded border border-white/30 px-2 py-1 font-semibold disabled:opacity-40">{membership.autoRenewal ? 'Cancel' : 'Resume'}</button> : null}</span></div>
    </div>
  )
}

function MonthlyInvoiceSummary({ invoices }: { invoices: CustomerBillingOverview['monthlyInvoices'] }) {
  const invoice = invoices[0]
  if (!invoice) return null
  const label = invoice.status === 'paid'
    ? 'Paid'
    : invoice.status === 'payment_method_required'
      ? 'Payment method needed'
      : invoice.status === 'failed'
        ? 'Payment failed'
        : 'Payment pending'
  return (
    <div className="border-t border-gray-200 bg-white px-5 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><strong className="text-gray-950">Monthly household invoice · {calendarDate(invoice.billingMonth)}</strong><span className="ml-2 text-gray-500">{invoice.lineCount} items · {label}</span>{invoice.failureMessage ? <p className="mt-1 text-xs text-red-700">{invoice.failureMessage}</p> : null}</div>
        <div className="flex items-center gap-3"><div className="text-right"><strong className="text-gray-950">{money(invoice.totalCents)}</strong>{invoice.postPaymentCreditCents > 0 ? <div className="text-xs font-medium text-emerald-700">{money(invoice.postPaymentCreditCents)} moved to account credit</div> : null}</div>{invoice.hostedInvoiceUrl ? <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700">Open payment link</a> : null}</div>
      </div>
      <div className="mt-3 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">{invoice.lines.map((line) => <div key={line.id} className="flex items-center justify-between gap-3"><span className="truncate">{line.memberName ? `${line.memberName} · ` : ''}{line.description}</span><span className="font-semibold text-gray-800">{money(line.amountCents)}</span></div>)}</div>
    </div>
  )
}

function ClassBundlesSection({
  passes,
  usage,
  canManage,
  onAdjust,
}: {
  passes: CustomerBillingOverview['bundlePasses']
  usage: CustomerBillingOverview['bundleUsage']
  canManage: boolean
  onAdjust: (pass: CustomerBillingOverview['bundlePasses'][number]) => void
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-lg font-bold text-gray-950">Class bundles</h2>
        <p className="text-sm text-gray-500">Household pass balances and append-only credit adjustments.</p>
      </div>
      {passes.length > 0 ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {passes.map((pass) => (
            <div key={pass.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-bold text-gray-950">{pass.packageLabel || `Pass #${pass.id}`}</div>
                  <div className="mt-1 text-sm text-gray-500">{pass.memberName || 'Family member'}</div>
                </div>
                <Badge value={pass.status} />
              </div>
              <div className="mt-4 text-2xl font-black text-gray-950">{pass.classesRemaining} / {pass.classCountPurchased}</div>
              <div className="text-xs text-gray-500">classes left · purchased for {money(pass.priceCents)}</div>
              {pass.expiresAt ? <div className="mt-1 text-xs text-gray-500">Expires {calendarDate(pass.expiresAt)}</div> : null}
              {canManage ? (
                <button type="button" onClick={() => onAdjust(pass)} aria-label={`Adjust ${pass.packageLabel || `pass ${pass.id}`} balance`} className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Adjust balance
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : <div className="px-5 py-6 text-sm text-gray-500">No class bundles on this account.</div>}
      {usage.length > 0 ? (
        <details className="border-t border-gray-200">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 marker:hidden">
            <span>Recent bundle usage and adjustments</span>
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="divide-y divide-gray-100 border-t border-gray-100 px-5">
            {usage.slice(0, 20).map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <strong className="text-gray-900">{entry.memberName || entry.packageLabel || 'Class bundle'}</strong>
                  <span className="ml-2 text-gray-500">{localDate(entry.createdAt)} · {entry.entryType.replaceAll('_', ' ')}</span>
                  {entry.reason ? <div className="text-xs text-gray-500">{entry.reason}</div> : null}
                </div>
                <div className="font-semibold text-gray-800">
                  {entry.creditDelta == null ? '' : `${entry.creditDelta > 0 ? '+' : ''}${entry.creditDelta} → `}{entry.classesRemainingAfter} left
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  )
}

function EnrollmentSection({
  enrollments,
  waitlists,
  canManage,
  onChangePrice,
  onRetrySync,
  onRevoke,
  onNewEnrollment,
}: {
  enrollments: CustomerBillingEnrollment[]
  waitlists: CustomerBillingEnrollment[]
  canManage: boolean
  onChangePrice: (enrollment: CustomerBillingEnrollment) => void
  onRetrySync: (adjustment: PriceAdjustment) => void
  onRevoke: (adjustment: PriceAdjustment) => void
  onNewEnrollment: () => void
}) {
  const [enrollmentsOpen, setEnrollmentsOpen] = useState(true)

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Current & upcoming enrollments</h2>
            <p className="text-sm text-gray-500">Every billable class, effective price, and scheduled change.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onNewEnrollment} disabled={!canManage} title={canManage ? 'Add a family enrollment' : 'Billing management permission is required'} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> New Enrollment</button>
            <button type="button" onClick={() => setEnrollmentsOpen((open) => !open)} aria-expanded={enrollmentsOpen} aria-label={`${enrollmentsOpen ? 'Collapse' : 'Expand'} current and upcoming enrollments`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><ChevronDown className={`h-4 w-4 transition-transform ${enrollmentsOpen ? '' : '-rotate-90'}`} /></button>
          </div>
      </div>
      {enrollmentsOpen ? (
        <div className="border-t border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Class Schedule</th>
                  <th className="px-4 py-3 text-right">Class cost</th>
                  <th className="px-4 py-3">Discounts</th>
                  <th className="px-4 py-3 text-right">Final price</th>
                  <th className="px-4 py-3">Status / sync</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => {
                  const liveAdjustments = enrollment.priceAdjustments.filter((item) => item.status !== 'revoked')
                  const activeAdjustments = enrollment.activePriceAdjustments ?? (
                    enrollment.activePriceAdjustment ? [enrollment.activePriceAdjustment] : []
                  )
                  const activeAdjustmentIds = new Set(activeAdjustments.map((adjustment) => adjustment.id))
                  const currentAdjustment = activeAdjustments.find(
                    (adjustment) => adjustment.kind === 'fixed_final_price',
                  ) ?? null
                  const failedAdjustment = liveAdjustments.find((item) => item.status === 'sync_failed') ?? null
                  const retryAdjustment = retryableAdjustmentForEnrollment(enrollment)
                  const syncError = failedAdjustment?.stripeSyncError || enrollment.priceSyncError
                  const scheduledAdjustments = liveAdjustments.filter(
                    (item) =>
                      !activeAdjustmentIds.has(item.id) &&
                      (
                        ['pending_sync', 'sync_failed'].includes(item.status) ||
                        item.effectiveFromMonth.slice(0, 7) > enrollment.pricingMonth.slice(0, 7)
                      ),
                  )
                  return (
                    <tr key={`${enrollment.source}-${enrollment.id}`} className="border-t border-gray-100 align-top">
                      <td className="min-w-[250px] px-4 py-3">
                        <div className="font-semibold text-gray-950">
                          {enrollment.class_name || 'Class'}
                          <span className="ml-1 text-xs font-normal text-gray-500">#{enrollment.id}</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {enrollment.sport_name || '—'} · {enrollment.program_name || '—'}
                        </div>
                      </td>
                      <td className="min-w-[320px] px-4 py-3 text-gray-600">
                        <div><span className="font-semibold text-gray-700">Active Class Dates:</span> {enrollment.offering_dates || 'Evergreen'}</div>
                        {enrollment.source === 'drop_in' ? (
                          <div className="mt-1 font-semibold text-gray-700">Drop-in</div>
                        ) : (
                          <div className="mt-1"><span className="font-semibold text-gray-700">Enrollment Start Date:</span> {localDate(enrollment.enrollment_start_date || enrollment.created_at)}</div>
                        )}
                        <div className="mt-1"><span className="font-semibold text-gray-700">Schedule:</span> {enrollment.schedule || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{money(enrollment.classCostCents)}</td>
                      <td className="px-4 py-3 text-left">
                        <DiscountBreakdown totalCents={enrollment.automaticDiscountCents} components={enrollment.automaticDiscountComponents} />
                        {currentAdjustment?.kind === 'fixed_final_price' && enrollment.status === 'paused' ? <div className="text-blue-700">Stored final price {money(currentAdjustment.finalPriceCents)} · resumes with billing</div> : null}
                        {currentAdjustment?.kind === 'fixed_final_price' && enrollment.status !== 'paused' ? <div className={enrollment.manualAdjustmentCents < 0 ? 'text-amber-700' : 'text-blue-700'}>Manual final {enrollment.manualAdjustmentCents >= 0 ? '−' : '+'}{money(Math.abs(enrollment.manualAdjustmentCents))}</div> : null}
                        {currentAdjustment?.kind === 'fixed_final_price' ? <div className="mt-1 text-gray-400">{monthLabel(currentAdjustment.effectiveFromMonth)} – {monthLabel(currentAdjustment.effectiveThroughMonth)} · current</div> : null}
                        {scheduledAdjustments.map((adjustment) => <div key={adjustment.id} className="mt-1 text-blue-700">{['promo_code', 'legacy_discount'].includes(adjustment.kind) ? `Code ${adjustment.promoCode}` : `Final ${money(adjustment.finalPriceCents)}`} · {monthLabel(adjustment.effectiveFromMonth)} – {monthLabel(adjustment.effectiveThroughMonth)} · {adjustment.status.replaceAll('_', ' ')}</div>)}
                      </td>
                      <td className="px-4 py-3 text-right"><strong className="text-base text-gray-950">{money(enrollment.adjustedCostCents)}</strong><span className="block text-xs text-gray-400">{enrollment.source === 'drop_in' ? 'one time' : 'per month'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            value={enrollment.status}
                            label={`Class ${enrollment.status.replaceAll('_', ' ')}`}
                          />
                          {enrollment.billing_status ? (
                            <Badge
                              value={enrollment.billing_status}
                              label={`Billing ${enrollment.billing_status.replaceAll('_', ' ')}`}
                            />
                          ) : null}
                          <Badge
                            value={enrollment.collectionMode ?? enrollment.priceSyncStatus}
                            label={enrollmentPriceSyncLabel(enrollment)}
                          />
                          {failedAdjustment && enrollment.priceSyncStatus !== 'failed' ? <Badge value="sync_failed" label="Price change sync failed" /> : null}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Next bill {calendarDate(enrollment.nextBillDate)}
                        </p>
                        {syncError ? <StripeSyncFailure error={syncError} /> : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && enrollment.source === 'scheduling' && enrollment.billingType !== 'one_time' ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            {retryAdjustment ? <button type="button" onClick={() => onRetrySync(retryAdjustment)} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"><RefreshCw className="h-3.5 w-3.5" /> Retry Stripe sync</button> : null}
                            {liveAdjustments.filter((adjustment) => adjustment.kind === 'fixed_final_price').map((adjustment) => <button key={adjustment.id} type="button" onClick={() => onRevoke(adjustment)} className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50" aria-label={`Revoke price change beginning ${monthLabel(adjustment.effectiveFromMonth)}`}>Revoke</button>)}
                            <button type="button" onClick={() => onChangePrice(enrollment)} className="rounded bg-gray-950 px-2 py-1 text-xs font-semibold text-white">Modify</button>
                          </div>
                        ) : <span className="text-xs text-gray-400">Read only</span>}
                      </td>
                    </tr>
                  )
                })}
                {enrollments.length === 0 ? <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">No current or upcoming billable enrollments.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {waitlists.length > 0 ? (
        <details className="border-t border-gray-200">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 marker:hidden"><span>Waitlists · non-billable</span><span className="flex items-center gap-2">{waitlists.length}<ChevronDown className="h-4 w-4" /></span></summary>
          <div className="grid gap-2 border-t border-gray-100 p-4 sm:grid-cols-2 xl:grid-cols-3">{waitlists.map((row) => <div key={row.id} className="rounded-lg border border-gray-200 p-3 text-sm"><strong>{row.memberName}</strong><div className="text-gray-600">{row.class_name}</div><div className="mt-1 text-xs text-gray-500">{row.schedule} · Enrollment #{row.id}</div></div>)}</div>
        </details>
      ) : null}
    </section>
  )
}

function TransactionsPanel({
  rows,
  members,
  filters,
  hasMore,
  loading,
  canManage,
  onFilterChange,
  onApplyFilters,
  onLoadMore,
  onExport,
  onRefund,
  onResendReceipt,
  onSendPaymentRequest,
  onModifyBill,
}: {
  rows: BillingTransaction[]
  members: CustomerBillingOverview['members']
  filters: { search: string; type: string; status: string; from: string; through: string }
  hasMore: boolean
  loading: boolean
  canManage: boolean
  onFilterChange: (key: keyof typeof filters, value: string) => void
  onApplyFilters: () => void
  onLoadMore: () => void
  onExport: () => void
  onRefund: (row: BillingTransaction) => void
  onResendReceipt: (row: BillingTransaction) => void
  onSendPaymentRequest: (row: BillingTransaction) => void
  onModifyBill: (row: BillingTransaction) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div>
      <div className="grid gap-2 border-b border-gray-200 bg-gray-50 p-4 md:grid-cols-[minmax(180px,1fr)_repeat(4,minmax(120px,auto))_auto]">
        <input value={filters.search} onChange={(event) => onFilterChange('search', event.target.value)} placeholder="Description or reference" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
        <select value={filters.type} onChange={(event) => onFilterChange('type', event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">All types</option><option value="charge">All charges</option><option value="recurring">Recurring</option><option value="one_time">One-time</option><option value="adjustment">Adjustments</option><option value="credit">Credits</option><option value="payment">Payments</option><option value="refund">Refunds</option></select>
        <select value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">All statuses</option><option value="paid">Paid</option><option value="partially_paid">Partially paid</option><option value="settled">Settled</option><option value="succeeded">Succeeded</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="unpaid">Unpaid</option></select>
        <input type="date" value={filters.from} onChange={(event) => onFilterChange('from', event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" aria-label="Transactions from date" />
        <input type="date" value={filters.through} onChange={(event) => onFilterChange('through', event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" aria-label="Transactions through date" />
        <div className="flex gap-2"><button type="button" onClick={onApplyFilters} className="inline-flex items-center gap-1 rounded-lg bg-gray-950 px-3 py-2 text-sm font-semibold text-white"><Filter className="h-4 w-4" /> Apply</button><button type="button" onClick={onExport} className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700" aria-label="Export filtered transactions"><Download className="h-4 w-4" /></button></div>
      </div>
      <div className="overflow-x-auto" style={{ contentVisibility: 'auto' }}>
        <table className="w-full min-w-[1060px] text-sm">
          <thead className="bg-white text-left text-xs font-semibold uppercase tracking-wide text-gray-500"><tr><th className="w-10 px-4 py-3" /><th className="px-4 py-3">Date</th><th className="px-4 py-3">Member</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const key = `${row.entryKind}-${row.refId}`
              const isExpanded = expanded === key
              const canRefund = canManage && row.entryKind === 'payment' && Boolean(row.details.stripePaymentIntentId)
              const canModifyBill = canManage && row.entryKind === 'charge' && row.amountCents > 0 && (
                (row.entryType === 'recurring' && Boolean(row.details.subscriptionId)) ||
                row.details.sourceType === 'additional_fee'
              )
              const canSendPaymentRequest = canModifyBill && row.remainingAmountCents > 0
              const discountCode = row.entryType === 'one_time' && typeof row.details.discountCode === 'string'
                ? row.details.discountCode.trim()
                : ''
              const discountBenefit = row.entryType === 'one_time' && typeof row.details.discountBenefit === 'string'
                ? row.details.discountBenefit.trim()
                : ''
              const billingMonths = row.billingMonths ?? []
              const billingPeriod = billingMonths.length > 1
                ? 'Multiple billing months'
                : billingMonths.length === 1
                  ? billingMonthLabel(billingMonths[0])
                  : null
              return (
                <Fragment key={key}>
                  <tr className="border-t border-gray-100">
                    <td className="px-4 py-3"><button type="button" onClick={() => setExpanded(isExpanded ? null : key)} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} transaction ${row.refId}`}>{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{localDate(row.occurredAt)}</td>
                    <td className="px-4 py-3 text-gray-600">{row.memberName || 'Household'}</td>
                    <td className="max-w-[300px] px-4 py-3"><strong className="block truncate text-gray-900">{row.description}</strong>{billingPeriod ? <span className="text-xs text-gray-500">{billingPeriod}</span> : null}</td>
                    <td className="px-4 py-3 capitalize text-gray-600">{row.entryType.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3"><Badge value={row.status} /></td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">{discountCode ? <code>{discountCode}</code> : discountBenefit || '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${row.amountCents < 0 ? 'text-emerald-700' : 'text-gray-950'}`}>{money(row.amountCents)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-950">{money(row.runningBalanceCents)}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">{canModifyBill ? <button type="button" onClick={() => onModifyBill(row)} className="rounded bg-gray-950 px-2 py-1 text-xs font-semibold text-white">Modify</button> : null}{canModifyBill ? <button type="button" onClick={() => onSendPaymentRequest(row)} disabled={!canSendPaymentRequest} className="rounded bg-gray-950 p-1.5 text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500" aria-label={canSendPaymentRequest ? `Send payment request for ${row.description}` : `Payment request unavailable because ${row.description} is paid`} title={canSendPaymentRequest ? 'Send payment request' : 'Paid in full'}><Mail className="h-3.5 w-3.5" /></button> : null}{canRefund ? <button type="button" onClick={() => onRefund(row)} className="rounded bg-gray-950 px-2 py-1 text-xs font-semibold text-white">Refund</button> : null}{canManage && ['payment', 'refund'].includes(row.entryKind) && ['settled', 'succeeded'].includes(row.status) ? <button type="button" onClick={() => onResendReceipt(row)} className="rounded bg-gray-950 p-1.5 text-white" aria-label={`Resend ${row.entryKind} receipt`}><Mail className="h-3.5 w-3.5" /></button> : null}</div></td>
                  </tr>
                  {isExpanded ? <tr className="border-t border-gray-100 bg-gray-50"><td /><td colSpan={9} className="px-4 py-4"><div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">{Object.entries(row.details).filter(([, value]) => value != null && value !== '').map(([label, value]) => <div key={label} className={Array.isArray(value) ? 'sm:col-span-2 lg:col-span-4' : ''}><span className="block font-semibold uppercase tracking-wide text-gray-400">{auditDetailLabel(label)}</span><AuditDetailValue label={label} value={value} /></div>)}</div></td></tr> : null}
                </Fragment>
              )
            })}
            {rows.length === 0 && !loading ? <tr><td colSpan={10} className="px-5 py-10 text-center text-gray-500">No transactions match these filters.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {loading ? <div className="flex items-center justify-center gap-2 p-5 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading transactions…</div> : null}
      {hasMore && !loading ? <div className="border-t border-gray-200 p-4 text-center"><button type="button" onClick={onLoadMore} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Load 100 more</button></div> : null}
      <span className="sr-only">{members.length} household members available as account filters.</span>
    </div>
  )
}

function ActivityPanel({ rows, hasMore, loading, onLoadMore }: { rows: BillingActivity[]; hasMore: boolean; loading: boolean; onLoadMore: () => void }) {
  return (
    <div className="divide-y divide-gray-100" style={{ contentVisibility: 'auto' }}>
      {rows.map((item) => (
        <details key={item.id} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 marker:hidden">
            <div className="flex min-w-0 gap-3"><div className="mt-0.5 rounded-full bg-gray-100 p-2 text-gray-600"><Activity className="h-4 w-4" /></div><div><strong className="block text-sm text-gray-950">{item.summary}</strong><span className="text-xs text-gray-500">{item.actorName || item.actorType} · {localDate(item.occurredAt, true)}</span></div></div>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          </summary>
          <div className="ml-11 mt-3 grid gap-3 rounded-lg bg-gray-50 p-3 text-xs sm:grid-cols-2 lg:grid-cols-3"><div><span className="block font-semibold uppercase text-gray-400">Event</span>{item.eventType.replaceAll('_', ' ')}</div>{item.signupId ? <div><span className="block font-semibold uppercase text-gray-400">Enrollment</span>#{item.signupId}</div> : null}{item.stripeObjectId ? <div><span className="block font-semibold uppercase text-gray-400">Stripe object</span><span className="break-all">{item.stripeObjectId}</span></div> : null}{item.beforeValue ? <div className="sm:col-span-2 lg:col-span-3"><span className="block font-semibold uppercase text-gray-400">Before</span><code className="break-all">{JSON.stringify(item.beforeValue)}</code></div> : null}{item.afterValue ? <div className="sm:col-span-2 lg:col-span-3"><span className="block font-semibold uppercase text-gray-400">After</span><code className="break-all">{JSON.stringify(item.afterValue)}</code></div> : null}</div>
        </details>
      ))}
      {rows.length === 0 && !loading ? <div className="px-5 py-10 text-center text-gray-500">No billing activity has been recorded yet.</div> : null}
      {loading ? <div className="flex items-center justify-center gap-2 p-5 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading activity…</div> : null}
      {hasMore && !loading ? <div className="p-4 text-center"><button type="button" onClick={onLoadMore} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold">Load more activity</button></div> : null}
    </div>
  )
}

interface BillingAccountTarget {
  familyId: number
  memberId: number
}

interface AdminCustomerBillingProps {
  accountTarget?: BillingAccountTarget | null
  onAccountTargetConsumed?: () => void
}

export default function AdminCustomerBilling({
  accountTarget = null,
  onAccountTargetConsumed,
}: AdminCustomerBillingProps) {
  const [access, setAccess] = useState<AccessState>({ isMasterAdmin: false, permissions: [] })
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())
  const [searchResults, setSearchResults] = useState<CustomerBillingSearchResult[]>([])
  const [directFamilyId, setDirectFamilyId] = useState<number | null>(null)
  const [searching, setSearching] = useState(false)
  const [overview, setOverview] = useState<CustomerBillingOverview | null>(null)
  const [migrationStatus, setMigrationStatus] = useState<BillingMigrationStatus | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<BillingTransaction[]>([])
  const [transactionCursor, setTransactionCursor] = useState<string | null>(null)
  const [activityRows, setActivityRows] = useState<BillingActivity[]>([])
  const [activityCursor, setActivityCursor] = useState<string | null>(null)
  const [auditTab, setAuditTab] = useState<'transactions' | 'activity'>('transactions')
  const [transactionFilters, setTransactionFilters] = useState({ search: '', type: '', status: '', from: '', through: '' })
  const [loading, setLoading] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastActionUrl, setLastActionUrl] = useState<string | null>(null)
  const [priceEnrollment, setPriceEnrollment] = useState<CustomerBillingEnrollment | null>(null)
  const [chargeToModify, setChargeToModify] = useState<BillingTransaction | null>(null)
  const [customChargeOpen, setCustomChargeOpen] = useState(false)
  const [balanceCollectionOpen, setBalanceCollectionOpen] = useState(false)
  const [externalPaymentOpen, setExternalPaymentOpen] = useState(false)
  const [passToAdjust, setPassToAdjust] = useState<CustomerBillingOverview['bundlePasses'][number] | null>(null)
  const [refundPayment, setRefundPayment] = useState<BillingTransaction | null>(null)
  const [contactDraft, setContactDraft] = useState<ContactDraft>(EMPTY_CONTACT)
  const [newEnrollmentOpen, setNewEnrollmentOpen] = useState(false)

  const canManage = access.isMasterAdmin || access.permissions.includes('billing.manage')
  const canManageContact = access.isMasterAdmin || access.permissions.includes('family_billing.manage')

  useEffect(() => {
    adminApiRequest('/api/admin/access/me')
      .then(async (response) => response.ok ? response.json() : null)
      .then((body) => {
        if (!body?.data) return
        setAccess({
          isMasterAdmin: Boolean(body.data.isMasterAdmin),
          permissions: body.data.permissions ?? [],
        })
      })
      .catch(() => {})
  }, [])

  const performSearch = useCallback(async (value: string) => {
    if (value.length < 2 && !/^\d+$/.test(value)) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const response = await adminApiRequest(`/api/admin/customer-billing/search?q=${encodeURIComponent(value)}`)
      const body = await jsonBody(response)
      if (!response.ok) throw new Error(body.message || 'Search failed.')
      const results = (body.data ?? []) as CustomerBillingSearchResult[]
      const exactFamilyId = /^\d+$/.test(value) ? Number(value) : null
      if (exactFamilyId != null && results.some((result) => result.familyId === exactFamilyId)) {
        setQuery('')
        setSearchResults([])
        setDirectFamilyId(exactFamilyId)
      } else {
        setSearchResults(results)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Search failed.')
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!deferredQuery) {
      setSearchResults([])
      return
    }
    const timer = window.setTimeout(() => void performSearch(deferredQuery), 300)
    return () => window.clearTimeout(timer)
  }, [deferredQuery, performSearch])

  const auditParams = useCallback((memberId: number | null) => {
    const params = new URLSearchParams()
    if (memberId != null) params.set('memberId', String(memberId))
    if (transactionFilters.search.trim()) params.set('search', transactionFilters.search.trim())
    if (transactionFilters.type) params.set('type', transactionFilters.type)
    if (transactionFilters.status) params.set('status', transactionFilters.status)
    if (transactionFilters.from) params.set('from', transactionFilters.from)
    if (transactionFilters.through) params.set('through', transactionFilters.through)
    return params
  }, [transactionFilters])

  const loadAudits = useCallback(async (
    familyId: number,
    memberId: number | null,
    append: false | 'transactions' | 'activity' = false,
  ) => {
    setAuditLoading(true)
    try {
      const loadTransactions = append !== 'activity'
      const loadActivity = append !== 'transactions'
      const transactionPromise = loadTransactions
        ? (() => {
            const params = auditParams(memberId)
            params.set('limit', '100')
            if (append === 'transactions' && transactionCursor) params.set('cursor', transactionCursor)
            return adminApiRequest(`/api/admin/customer-billing/families/${familyId}/transactions?${params}`)
          })()
        : null
      const activityPromise = loadActivity
        ? (() => {
            const params = new URLSearchParams()
            if (memberId != null) params.set('memberId', String(memberId))
            params.set('limit', '100')
            if (append === 'activity' && activityCursor) params.set('cursor', activityCursor)
            return adminApiRequest(`/api/admin/customer-billing/families/${familyId}/activity?${params}`)
          })()
        : null
      const [transactionResponse, activityResponse] = await Promise.all([transactionPromise, activityPromise])
      if (transactionResponse) {
        const body = await jsonBody(transactionResponse)
        if (!transactionResponse.ok) throw new Error(body.message || 'Transactions failed to load.')
        setTransactions((current) => append === 'transactions' ? [...current, ...(body.data?.rows ?? [])] : (body.data?.rows ?? []))
        setTransactionCursor(body.data?.nextCursor ?? null)
      }
      if (activityResponse) {
        const body = await jsonBody(activityResponse)
        if (!activityResponse.ok) throw new Error(body.message || 'Activity failed to load.')
        setActivityRows((current) => append === 'activity' ? [...current, ...(body.data?.rows ?? [])] : (body.data?.rows ?? []))
        setActivityCursor(body.data?.nextCursor ?? null)
      }
    } finally {
      setAuditLoading(false)
    }
  }, [activityCursor, auditParams, transactionCursor])

  const loadFamily = useCallback(async (familyId: number, memberId: number | null) => {
    setLoading(true)
    setMigrationStatus(null)
    setError(null)
    setSuccess(null)
    setLastActionUrl(null)
    try {
      const overviewParams = memberId == null ? '' : `?memberId=${memberId}`
      const [overviewResponse, migrationResponse] = await Promise.all([
        adminApiRequest(`/api/admin/customer-billing/families/${familyId}/overview${overviewParams}`),
        adminApiRequest(`/api/admin/customer-billing/families/${familyId}/migration-status`),
      ])
      const [overviewBody, migrationBody] = await Promise.all([
        jsonBody(overviewResponse),
        jsonBody(migrationResponse),
      ])
      if (!overviewResponse.ok) throw new Error(overviewBody.message || 'Billing account failed to load.')
      if (!migrationResponse.ok) throw new Error(migrationBody.message || 'Billing migration status failed to load.')
      const nextOverview = overviewBody.data as CustomerBillingOverview
      setOverview(nextOverview)
      setMigrationStatus(migrationBody.data as BillingMigrationStatus)
      setSelectedMemberId(memberId)
      setContactDraft({
        payerMemberId: nextOverview.account.payerMemberId,
        billingEmail: nextOverview.account.billingEmail || '',
        billingPhone: nextOverview.account.billingPhone || '',
        billingStreet: nextOverview.account.billingStreet || '',
        billingCity: nextOverview.account.billingCity || '',
        billingState: nextOverview.account.billingState || '',
        billingZip: nextOverview.account.billingZip || '',
      })
      setSearchResults([])
      await loadAudits(familyId, memberId, false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Billing account failed to load.')
    } finally {
      setLoading(false)
    }
  }, [loadAudits])

  useEffect(() => {
    if (directFamilyId == null) return
    setDirectFamilyId(null)
    void loadFamily(directFamilyId, null)
  }, [directFamilyId, loadFamily])

  useEffect(() => {
    if (accountTarget == null) return
    onAccountTargetConsumed?.()
    void loadFamily(accountTarget.familyId, accountTarget.memberId)
  }, [accountTarget, loadFamily, onAccountTargetConsumed])

  const selectSearchResult = (result: CustomerBillingSearchResult) => {
    setQuery('')
    void loadFamily(result.familyId, result.memberId)
  }

  const chooseMember = (memberId: number | null) => {
    if (!overview || selectedMemberId === memberId) return
    setSelectedMemberId(memberId)
    setTransactionCursor(null)
    setActivityCursor(null)
    void loadAudits(overview.account.familyId, memberId, false).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Account filter failed.')
    })
  }

  const refresh = async (message?: string) => {
    if (!overview) return
    await loadFamily(overview.account.familyId, selectedMemberId)
    if (message) setSuccess(message)
  }

  const refreshAccountFromStripe = async () => {
    if (!overview) return
    setSaving(true)
    setError(null)
    try {
      await loadFamily(overview.account.familyId, selectedMemberId)
      setSuccess('Account refreshed.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Billing account refresh failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaved = (message: string) => {
    const url = message.match(/https?:\/\/\S+/)?.[0] ?? null
    setLastActionUrl(url)
    setPriceEnrollment(null)
    setCustomChargeOpen(false)
    setBalanceCollectionOpen(false)
    setExternalPaymentOpen(false)
    setPassToAdjust(null)
    setRefundPayment(null)
    void refresh(message.replace(url ?? '__no_url__', '').trim())
  }

  const setAnnualMembershipAutoRenewal = async (
    membership: CustomerBillingAnnualMembership,
    enabled: boolean,
  ) => {
    if (!overview || membership.billingSubscriptionId == null) return
    if (
      !enabled &&
      !window.confirm(
        `Cancel annual membership auto-renewal for ${membership.memberName}? Their paid-through membership remains active until ${calendarDate(membership.renewalDate)}.`,
      )
    ) return
    setSaving(true)
    setError(null)
    try {
      const response = await adminApiRequest(
        `/api/admin/customer-billing/families/${overview.account.familyId}/annual-memberships/${membership.billingSubscriptionId}/auto-renewal`,
        {
          method: 'PATCH',
          body: JSON.stringify({ enabled }),
        },
      )
      const body = await jsonBody(response)
      if (!response.ok) throw new Error(body.message || 'Annual membership auto-renewal could not be changed.')
      await refresh(
        `${membership.memberName}'s annual membership auto-renewal was ${enabled ? 'resumed' : 'cancelled'}.`,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Annual membership auto-renewal could not be changed.')
    } finally {
      setSaving(false)
    }
  }

  const billAnnualMembershipNow = async (membership: CustomerBillingAnnualMembership) => {
    if (!overview || membership.active || membership.outstandingChargeId != null) return
    setSaving(true)
    setError(null)
    try {
      const response = await adminApiRequest(
        `/api/admin/customer-billing/families/${overview.account.familyId}/annual-memberships/${membership.memberId}/bill-now`,
        { method: 'POST', headers: { 'Idempotency-Key': `annual-membership-${membership.memberId}-${Date.now()}` } },
      )
      const body = await jsonBody(response)
      if (!response.ok) throw new Error(body.message || 'Annual membership bill could not be created.')
      await refresh(`Annual membership fee added to ${membership.memberName}'s account ledger.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Annual membership bill could not be created.')
    } finally {
      setSaving(false)
    }
  }

  const visibleEnrollments = useMemo(
    () => overview?.enrollments.filter((row) => selectedMemberId == null || row.memberId === selectedMemberId) ?? [],
    [overview, selectedMemberId],
  )
  const retryableSyncAdjustments = useMemo(() => {
    const seen = new Set<number>()
    return (overview?.enrollments ?? []).flatMap((enrollment) => {
      const adjustment = retryableAdjustmentForEnrollment(enrollment)
      if (!adjustment || seen.has(adjustment.id)) return []
      seen.add(adjustment.id)
      return [adjustment]
    })
  }, [overview])
  const visibleWaitlists = useMemo(
    () => overview?.waitlists.filter((row) => selectedMemberId == null || row.memberId === selectedMemberId) ?? [],
    [overview, selectedMemberId],
  )
  const visibleBundlePasses = useMemo(
    () => (overview?.bundlePasses ?? []).filter((row) => selectedMemberId == null || row.memberId === selectedMemberId),
    [overview, selectedMemberId],
  )
  const visibleBundleUsage = useMemo(
    () => (overview?.bundleUsage ?? []).filter((row) => selectedMemberId == null || row.memberId === selectedMemberId),
    [overview, selectedMemberId],
  )
  const refundableCharges = useMemo(
    () => transactions.filter((row) => row.entryKind === 'charge' && row.amountCents > 0),
    [transactions],
  )

  const modifyCourseCharge = (row: BillingTransaction) => {
    if (!overview) return
    if (row.details.sourceType === 'additional_fee') {
      setChargeToModify(row)
      return
    }
    const subscriptionId = Number(row.details.subscriptionId)
    const subscription = overview.subscriptions.find((item) => item.id === subscriptionId)
    const enrollment = subscription?.signupId == null
      ? null
      : overview.enrollments.find((item) => item.id === subscription.signupId)
    if (!enrollment) {
      setError('This historical course is no longer an active enrollment. Its existing charge remains immutable; reopen the enrollment before changing its recurring price.')
      return
    }
    setPriceEnrollment(enrollment)
  }

  const saveContact = async () => {
    if (!overview) return
    setSaving(true)
    setError(null)
    try {
      const response = await adminApiRequest(`/api/admin/customer-billing/families/${overview.account.familyId}/account`, {
        method: 'PATCH',
        body: JSON.stringify(contactDraft),
      })
      const body = await jsonBody(response)
      if (!response.ok) throw new Error(body.message || 'Billing contact failed to save.')
      await refresh('Billing contact updated.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Billing contact failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const openPaymentMethodLink = async () => {
    if (!overview) return
    setSaving(true)
    setError(null)
    try {
      const response = await adminApiRequest(`/api/admin/customer-billing/families/${overview.account.familyId}/payment-method-link`, { method: 'POST' })
      const body = await jsonBody(response)
      if (!response.ok) throw new Error(body.message || 'Payment-method link failed.')
      setLastActionUrl(body.data.url)
      window.open(body.data.url, '_blank', 'noopener,noreferrer')
      setSuccess('Secure payment-method update link created.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Payment-method link failed.')
    } finally {
      setSaving(false)
    }
  }

  const revokeAdjustment = async (adjustment: PriceAdjustment) => {
    const reason = window.prompt('Reason for revoking this price change:')?.trim()
    if (!reason) return
    setSaving(true)
    setError(null)
    try {
      const response = await adminApiRequest(`/api/admin/customer-billing/price-adjustments/${adjustment.id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) })
      const body = await jsonBody(response)
      if (!response.ok) throw new Error(body.message || 'Price change could not be revoked.')
      await refresh('Enrollment price change revoked; posted periods received compensating entries where required.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Price change could not be revoked.')
    } finally {
      setSaving(false)
    }
  }

  const requestAdjustmentSync = async (adjustment: PriceAdjustment) => {
    const response = await adminApiRequest(`/api/admin/customer-billing/price-adjustments/${adjustment.id}/retry-sync`, { method: 'POST' })
    const body = await jsonBody(response)
    if (!response.ok) throw new Error(body.message || 'Stripe synchronization retry failed.')
    return body
  }

  const retryAdjustmentSync = async (adjustment: PriceAdjustment) => {
    setSaving(true)
    setError(null)
    try {
      const body = await requestAdjustmentSync(adjustment)
      await refresh()
      if (body.data?.syncStatus === 'failed' || body.data?.adjustment?.status === 'sync_failed') {
        setError(body.data?.adjustment?.stripeSyncError || 'Stripe synchronization still needs attention. Retry remains available.')
      } else {
        setSuccess('Stripe price schedule synchronized successfully.')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Stripe synchronization retry failed.')
    } finally {
      setSaving(false)
    }
  }

  const retryAllAdjustmentSyncs = async () => {
    if (retryableSyncAdjustments.length === 0) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    let synchronized = 0
    const failures: string[] = []
    try {
      for (const adjustment of retryableSyncAdjustments) {
        try {
          const body = await requestAdjustmentSync(adjustment)
          if (body.data?.syncStatus === 'failed' || body.data?.adjustment?.status === 'sync_failed') {
            failures.push(body.data?.adjustment?.stripeSyncError || `Adjustment #${adjustment.id} still needs attention.`)
          } else {
            synchronized += 1
          }
        } catch (caught) {
          failures.push(caught instanceof Error ? caught.message : `Adjustment #${adjustment.id} could not be synchronized.`)
        }
      }
      await refresh()
      if (failures.length > 0) {
        setError(`${synchronized} synchronized; ${failures.length} still need attention. ${failures[0]}`)
      } else {
        setSuccess(`${synchronized} Stripe price schedule${synchronized === 1 ? '' : 's'} synchronized successfully.`)
      }
    } finally {
      setSaving(false)
    }
  }

  const resendReceipt = async (row: BillingTransaction) => {
    if (!overview) return
    setSaving(true)
    setError(null)
    try {
      const endpoint = row.entryKind === 'payment'
        ? `/api/admin/customer-billing/families/${overview.account.familyId}/payments/${row.refId}/resend-receipt`
        : `/api/admin/customer-billing/families/${overview.account.familyId}/refunds/${row.refId}/resend-receipt`
      const response = await adminApiRequest(endpoint, {
        method: 'POST',
        headers: { 'Idempotency-Key': `receipt-${row.entryKind}-${row.refId}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` },
      })
      const body = await jsonBody(response)
      if (!response.ok) throw new Error(body.message || 'Receipt could not be resent.')
      setSuccess(`Receipt resent to ${body.data.recipientEmail}.`)
      await loadAudits(overview.account.familyId, selectedMemberId, false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Receipt could not be resent.')
    } finally {
      setSaving(false)
    }
  }

  const sendBillPaymentRequest = async (row: BillingTransaction) => {
    if (!overview) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const requestKey = `billing-charge-payment-request-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`
      const response = await adminApiRequest(
        `/api/admin/customer-billing/families/${overview.account.familyId}/charges/${row.refId}/payment-request`,
        { method: 'POST', headers: { 'Idempotency-Key': requestKey } },
      )
      const body = await jsonBody(response)
      if (body.data?.url) setLastActionUrl(body.data.url)
      if (!response.ok) throw new Error(body.message || 'Payment request could not be sent.')
      setSuccess(`Secure ${money(body.data.amountCents)} payment request sent to ${body.data.recipientEmail}.`)
      await loadAudits(overview.account.familyId, selectedMemberId, false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Payment request could not be sent.')
    } finally {
      setSaving(false)
    }
  }

  const exportTransactions = async () => {
    if (!overview) return
    setSaving(true)
    setError(null)
    try {
      const params = auditParams(selectedMemberId)
      const response = await adminApiRequest(`/api/admin/customer-billing/families/${overview.account.familyId}/transactions.csv?${params}`)
      if (!response.ok) throw new Error((await jsonBody(response)).message || 'CSV export failed.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `customer-billing-family-${overview.account.familyId}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'CSV export failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-2xl bg-gradient-to-br from-gray-950 via-gray-900 to-red-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red-200"><WalletCards className="h-4 w-4" /> Pricing & Billing</div><h1 className="text-3xl font-black tracking-tight">Account Billing &amp; Enrollments</h1><p className="mt-2 max-w-2xl text-sm text-gray-300">Search an individual, then see their household’s enrollment pricing, recurring charges, transactions, refunds, and complete account activity in one place.</p></div>
          <div className="relative w-full max-w-2xl">
            <label htmlFor="customer-billing-search" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-300">Find a customer or family</label>
            <div className="flex rounded-xl bg-white shadow-lg focus-within:ring-4 focus-within:ring-red-500/30"><Search className="ml-4 mt-3.5 h-5 w-5 text-gray-400" /><input id="customer-billing-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void performSearch(query.trim()) }} className="min-w-0 flex-1 rounded-xl px-3 py-3 text-gray-950 outline-none" placeholder="Name, email, phone, or family ID" autoComplete="off" />{searching ? <Loader2 className="mr-4 mt-3.5 h-5 w-5 animate-spin text-gray-400" /> : null}</div>
            <SearchResults results={searchResults} onSelect={selectSearchResult} />
          </div>
        </div>
      </div>

      {error ? <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span><button type="button" onClick={() => setError(null)} className="ml-auto font-bold" aria-label="Dismiss error">×</button></div> : null}
      {success ? <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><span>{success}</span>{lastActionUrl ? <span className="ml-auto flex gap-2"><button type="button" onClick={() => void navigator.clipboard.writeText(lastActionUrl)} className="inline-flex items-center gap-1 font-semibold"><Copy className="h-4 w-4" /> Copy link</button><a href={lastActionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold">Open <ExternalLink className="h-4 w-4" /></a></span> : null}</div> : null}

      {loading && !overview ? <div className="flex min-h-[420px] items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white text-gray-500"><Loader2 className="h-6 w-6 animate-spin" /> Loading complete billing account…</div> : null}

      {!overview && !loading ? (
        <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-vortex-red"><Users className="h-8 w-8" /></div><h2 className="mt-4 text-xl font-bold text-gray-900">Search for an individual</h2><p className="mx-auto mt-2 max-w-md text-sm text-gray-500">Phone numbers can include or omit dashes and punctuation. Selecting a person opens their full household account with that person highlighted.</p></div></div>
      ) : null}

      {overview ? (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-start xl:justify-between">
              <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black text-gray-950">{overview.account.familyName || 'Family account'}</h2><Badge value={overview.account.isActive ? 'active' : 'inactive'} /></div><p className="mt-1 text-sm text-gray-500">Family #{overview.account.familyId} · Billing account #{overview.account.id}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => chooseMember(null)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${selectedMemberId == null ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-300 text-gray-600'}`}>All family</button>{overview.members.map((member) => <button key={member.id} type="button" onClick={() => chooseMember(member.id)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${selectedMemberId === member.id ? 'border-vortex-red bg-red-50 text-vortex-red' : 'border-gray-300 text-gray-600'}`}>{member.name}</button>)}</div></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setBalanceCollectionOpen(true)} disabled={!canManage || saving || overview.summary.collectibleBalanceCents <= 0 || !overview.paymentMethod.available} className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" title={!overview.paymentMethod.available ? 'A saved card is required.' : 'Choose an amount and payment method.'}><CreditCard className="h-4 w-4" /> Process monthly balance</button>
                <button type="button" onClick={() => setCustomChargeOpen(true)} disabled={!canManage || saving} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Plus className="h-4 w-4" /> Custom charge</button>
                <button type="button" onClick={() => setExternalPaymentOpen(true)} disabled={!canManage || saving || overview.summary.collectibleBalanceCents <= 0} title="Record cash, check, bank transfer, or another external payment" className="inline-flex items-center gap-2 rounded-lg border border-gray-900 px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-40"><Banknote className="h-4 w-4" /> Record cash/check/external payment</button>
                <button type="button" onClick={() => void openPaymentMethodLink()} disabled={!canManage || saving || !overview.paymentMethod.stripeEnabled} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"><CreditCard className="h-4 w-4" /> Update payment method</button>
                <button type="button" onClick={() => void refreshAccountFromStripe()} disabled={loading || saving} className="rounded-lg border border-gray-300 p-2 text-gray-600" aria-label="Refresh account" title="Reload account billing data"><RefreshCw className={`h-4 w-4 ${(loading || saving) ? 'animate-spin' : ''}`} /></button>
              </div>
            </div>
            <div className="grid gap-3 border-t border-gray-200 bg-gray-50 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Outstanding balance" value={money(overview.summary.outstandingBalanceCents)} tone={overview.summary.outstandingBalanceCents > 0 ? 'warning' : 'default'} detail="Unpaid charges" />
              <MetricCard label={`Monthly recurring fee${billingMonthAbbreviation(overview.summary.monthlyRecurringPeriod) ? ` (${billingMonthAbbreviation(overview.summary.monthlyRecurringPeriod)})` : ''}`} value={money(overview.summary.monthlyRecurringCents)} detail={`${money(overview.summary.monthlyRecurringDiscountCents)} in discounts`} />
              <MetricCard label="Future credits" value={money(overview.summary.futureCreditsCents)} tone={overview.summary.futureCreditsCents > 0 ? 'positive' : 'default'} detail="Applied against the next bill" />
              <MetricCard label="Account balance" value={money(overview.summary.balanceCents)} tone={overview.summary.balanceCents < 0 ? 'positive' : overview.summary.balanceCents > 0 ? 'warning' : 'default'} detail={overview.summary.balanceCents < 0 ? 'Credit balance' : overview.summary.balanceCents > 0 ? `Amount due on ${calendarDate(overview.summary.nextBillDate)}` : 'Paid in full'} />
              <MetricCard label="Stripe pricing" value={overview.summary.stripeSync.status === 'healthy' ? 'Healthy' : 'Sync required'} tone={overview.summary.stripeSync.status === 'healthy' ? 'positive' : 'warning'} detail={overview.summary.stripeSync.message} />
              {overview.annualMemberships.map((membership) => <MembershipMetricCard key={membership.memberId} membership={membership} canManage={canManage} saving={saving} onSetAutoRenewal={(item, enabled) => void setAnnualMembershipAutoRenewal(item, enabled)} onBillNow={(item) => void billAnnualMembershipNow(item)} />)}
            </div>
            <MonthlyInvoiceSummary invoices={overview.monthlyInvoices} />
            {overview.summary.stripeSync.status !== 'healthy' ? (
              <div className="flex flex-col gap-3 border-t border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <strong>Stripe has not confirmed the recurring prices shown on this account.</strong>
                    <p className="mt-1 text-amber-800">The account billing total is calculated locally. Until synchronization succeeds, Stripe may retain an older amount. Errors shown below are technical details from the last attempt.</p>
                  </div>
                </div>
                {canManage && retryableSyncAdjustments.length > 0 ? (
                  <button type="button" onClick={() => void retryAllAdjustmentSyncs()} disabled={saving} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
                    <RefreshCw className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
                    Retry all Stripe syncs ({retryableSyncAdjustments.length})
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-5 border-t border-gray-200 p-5 lg:grid-cols-2">
              <details open>
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg text-sm font-bold text-gray-800 marker:hidden"><span className="flex items-center gap-2"><PencilLine className="h-4 w-4" /> Billing contact & payer</span><ChevronDown className="h-4 w-4" /></summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-gray-600">Payer<select disabled={!canManageContact} value={contactDraft.payerMemberId ?? ''} onChange={(event) => setContactDraft((current) => ({ ...current, payerMemberId: event.target.value ? Number(event.target.value) : null }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"><option value="">No payer selected</option>{overview.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
                  <label className="text-xs font-semibold text-gray-600">Billing email<input disabled={!canManageContact} value={contactDraft.billingEmail} onChange={(event) => setContactDraft((current) => ({ ...current, billingEmail: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" /></label>
                  <label className="text-xs font-semibold text-gray-600">Billing phone<input disabled={!canManageContact} value={contactDraft.billingPhone} onChange={(event) => setContactDraft((current) => ({ ...current, billingPhone: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" /></label>
                  <label className="text-xs font-semibold text-gray-600">Street<input disabled={!canManageContact} value={contactDraft.billingStreet} onChange={(event) => setContactDraft((current) => ({ ...current, billingStreet: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" /></label>
                  <label className="text-xs font-semibold text-gray-600">City<input disabled={!canManageContact} value={contactDraft.billingCity} onChange={(event) => setContactDraft((current) => ({ ...current, billingCity: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" /></label>
                  <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-gray-600">State<input disabled={!canManageContact} value={contactDraft.billingState} onChange={(event) => setContactDraft((current) => ({ ...current, billingState: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" /></label><label className="text-xs font-semibold text-gray-600">ZIP<input disabled={!canManageContact} value={contactDraft.billingZip} onChange={(event) => setContactDraft((current) => ({ ...current, billingZip: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" /></label></div>
                  {canManageContact ? <button type="button" onClick={() => void saveContact()} disabled={saving} className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white sm:col-span-2 disabled:opacity-50">Save billing contact</button> : null}
                </div>
              </details>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-bold text-gray-900"><CreditCard className="h-4 w-4" /> Saved payment method</div>{overview.paymentMethod.paymentMethod ? <p className="mt-2 text-sm text-gray-700"><span className="capitalize">{overview.paymentMethod.paymentMethod.brand}</span> •••• {overview.paymentMethod.paymentMethod.last4}<span className="text-gray-400"> · expires {overview.paymentMethod.paymentMethod.expMonth}/{overview.paymentMethod.paymentMethod.expYear}</span></p> : <p className="mt-2 text-sm text-gray-500">No reusable default card found.</p>}</div><Badge value={overview.paymentMethod.available ? 'available' : 'unavailable'} /></div>{overview.paymentMethod.error ? <p className="mt-2 text-xs text-amber-700">{overview.paymentMethod.error}</p> : null}</div>
            </div>
            {overview.alerts.length > 0 ? <div className="border-t border-amber-200 bg-amber-50 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900"><AlertTriangle className="h-4 w-4" /> Open account alerts ({overview.alerts.length})</div><div className="space-y-1">{overview.alerts.map((alert) => <div key={alert.id} className="flex items-start justify-between gap-3 text-sm text-amber-800"><span>{alert.message}</span><span className="shrink-0 text-xs">{localDate(alert.createdAt)}</span></div>)}</div></div> : null}
          </section>

          {migrationStatus ? <MigrationStatusCard status={migrationStatus} /> : null}

          <EnrollmentSection enrollments={visibleEnrollments} waitlists={visibleWaitlists} canManage={canManage} onChangePrice={setPriceEnrollment} onRetrySync={(adjustment) => void retryAdjustmentSync(adjustment)} onRevoke={(adjustment) => void revokeAdjustment(adjustment)} onNewEnrollment={() => setNewEnrollmentOpen(true)} />

          <ClassBundlesSection passes={visibleBundlePasses} usage={visibleBundleUsage} canManage={canManage} onAdjust={setPassToAdjust} />

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4"><div><h2 className="text-lg font-bold text-gray-950">Complete account audit</h2><p className="text-sm text-gray-500">Financial line items and administrative history remain separate but linked.</p></div><div className="flex rounded-lg bg-gray-100 p-1"><button type="button" onClick={() => setAuditTab('transactions')} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${auditTab === 'transactions' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'}`}>Transactions</button><button type="button" onClick={() => setAuditTab('activity')} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${auditTab === 'activity' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'}`}>Activity</button></div></div>
            {auditTab === 'transactions' ? <TransactionsPanel rows={transactions} members={overview.members} filters={transactionFilters} hasMore={Boolean(transactionCursor)} loading={auditLoading} canManage={canManage} onFilterChange={(key, value) => setTransactionFilters((current) => ({ ...current, [key]: value }))} onApplyFilters={() => { setTransactionCursor(null); setActivityCursor(null); void loadAudits(overview.account.familyId, selectedMemberId, false).catch((caught) => setError(caught instanceof Error ? caught.message : 'Filters failed.')) }} onLoadMore={() => void loadAudits(overview.account.familyId, selectedMemberId, 'transactions').catch((caught) => setError(caught instanceof Error ? caught.message : 'More transactions failed to load.'))} onExport={() => void exportTransactions()} onRefund={setRefundPayment} onResendReceipt={(row) => void resendReceipt(row)} onSendPaymentRequest={(row) => void sendBillPaymentRequest(row)} onModifyBill={modifyCourseCharge} /> : <ActivityPanel rows={activityRows} hasMore={Boolean(activityCursor)} loading={auditLoading} onLoadMore={() => void loadAudits(overview.account.familyId, selectedMemberId, 'activity').catch((caught) => setError(caught instanceof Error ? caught.message : 'More activity failed to load.'))} />}
          </section>

        </>
      ) : null}

      {priceEnrollment ? <PriceAdjustmentModal enrollment={priceEnrollment} onClose={() => setPriceEnrollment(null)} onSaved={handleSaved} /> : null}
      {chargeToModify && overview ? <ModifyChargeModal familyId={overview.account.familyId} charge={chargeToModify} onClose={() => setChargeToModify(null)} onSaved={(message) => { setChargeToModify(null); handleSaved(message) }} /> : null}
      {balanceCollectionOpen && overview && overview.paymentMethod.paymentMethod ? <BalanceCollectionModal familyId={overview.account.familyId} balanceCents={overview.summary.collectibleBalanceCents} paymentMethod={overview.paymentMethod.paymentMethod} onClose={() => setBalanceCollectionOpen(false)} onSaved={handleSaved} /> : null}
      {customChargeOpen && overview ? <CustomChargeModal familyId={overview.account.familyId} members={overview.members} selectedMemberId={selectedMemberId} savedCardAvailable={overview.paymentMethod.available} onClose={() => setCustomChargeOpen(false)} onSaved={handleSaved} /> : null}
      {externalPaymentOpen && overview ? <ExternalPaymentModal familyId={overview.account.familyId} collectibleBalanceCents={overview.summary.collectibleBalanceCents} onClose={() => setExternalPaymentOpen(false)} onSaved={handleSaved} /> : null}
      {passToAdjust ? <PassAdjustmentModal pass={passToAdjust} onClose={() => setPassToAdjust(null)} onSaved={handleSaved} /> : null}
      {newEnrollmentOpen && overview ? <NewBillingEnrollmentModal members={overview.members} initialMemberId={selectedMemberId ?? overview.account.payerMemberId} onClose={() => setNewEnrollmentOpen(false)} onCreated={(message) => { setNewEnrollmentOpen(false); void refresh(message) }} /> : null}
      {refundPayment && overview ? <RefundModal familyId={overview.account.familyId} payment={refundPayment} charges={refundableCharges} onClose={() => setRefundPayment(null)} onSaved={handleSaved} /> : null}

      {saving ? <div className="fixed bottom-5 right-5 z-[210] inline-flex items-center gap-2 rounded-full bg-gray-950 px-4 py-2 text-sm font-semibold text-white shadow-xl"><Loader2 className="h-4 w-4 animate-spin" /> Updating billing account…</div> : null}
    </div>
  )
}
