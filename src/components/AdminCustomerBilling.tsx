import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
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
import { CustomChargeModal, PriceAdjustmentModal, RefundModal } from './customerBilling/CustomerBillingModals'
import { billingMonthLabel, calendarDate, localDate, money, monthLabel, statusTone } from './customerBilling/format'
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

function YesNoBadge({ value }: { value: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
      value
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-gray-200 bg-gray-50 text-gray-600'
    }`}>
      {value ? 'Yes' : 'No'}
    </span>
  )
}

function AnnualMembershipSection({
  memberships,
  canManage,
  saving,
  onSetAutoRenewal,
}: {
  memberships: CustomerBillingAnnualMembership[]
  canManage: boolean
  saving: boolean
  onSetAutoRenewal: (membership: CustomerBillingAnnualMembership, enabled: boolean) => void
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-lg font-bold text-gray-950">Annual Memberships</h2>
        <p className="text-sm text-gray-500">Paid-through membership dates and yearly renewal status for each family member.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-3">Active Membership</th>
              <th className="px-5 py-3">Membership Date</th>
              <th className="px-5 py-3">Renewal Date</th>
              <th className="px-5 py-3">Auto-renewal</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((membership) => (
              <tr key={membership.memberId} className="border-t border-gray-100">
                <td className="px-5 py-4">
                  <YesNoBadge value={membership.active} />
                  <span className="ml-2 font-semibold text-gray-900">{membership.memberName}</span>
                </td>
                <td className="px-5 py-4 text-gray-700">{localDate(membership.membershipDate)}</td>
                <td className="px-5 py-4 text-gray-700">{calendarDate(membership.renewalDate)}</td>
                <td className="px-5 py-4"><YesNoBadge value={membership.autoRenewal} /></td>
                <td className="px-5 py-4 text-right">
                  {canManage && membership.canManageAutoRenewal && membership.billingSubscriptionId != null ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onSetAutoRenewal(membership, !membership.autoRenewal)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
                    >
                      {membership.autoRenewal ? 'Cancel auto-renewal' : 'Resume auto-renewal'}
                    </button>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>
              </tr>
            ))}
            {memberships.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No family members are available.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
}: {
  enrollments: CustomerBillingEnrollment[]
  waitlists: CustomerBillingEnrollment[]
  canManage: boolean
  onChangePrice: (enrollment: CustomerBillingEnrollment) => void
  onRetrySync: (adjustment: PriceAdjustment) => void
  onRevoke: (adjustment: PriceAdjustment) => void
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <details open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Current & upcoming enrollments</h2>
            <p className="text-sm text-gray-500">Every billable class, effective price, and scheduled change.</p>
          </div>
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-600">{enrollments.length} enrollments <ChevronDown className="h-4 w-4" /></span>
        </summary>
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
                            value={enrollment.priceSyncStatus}
                            label={
                              enrollment.priceSyncStatus === 'synced'
                                ? 'Stripe pricing synced'
                                : enrollment.priceSyncStatus === 'failed'
                                  ? 'Stripe pricing sync failed'
                                  : `Stripe pricing ${enrollment.priceSyncStatus.replaceAll('_', ' ')}`
                            }
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
                            <button type="button" onClick={() => onChangePrice(enrollment)} className="inline-flex items-center gap-1 rounded-lg bg-gray-950 px-3 py-1.5 text-xs font-semibold text-white"><PencilLine className="h-3.5 w-3.5" /> Change price</button>
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
      </details>
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
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">{canRefund ? <button type="button" onClick={() => onRefund(row)} className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700">Refund</button> : null}{canManage && ['payment', 'refund'].includes(row.entryKind) && ['settled', 'succeeded'].includes(row.status) ? <button type="button" onClick={() => onResendReceipt(row)} className="rounded border border-gray-300 p-1.5 text-gray-600" aria-label={`Resend ${row.entryKind} receipt`}><Mail className="h-3.5 w-3.5" /></button> : null}</div></td>
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

export default function AdminCustomerBilling() {
  const [access, setAccess] = useState<AccessState>({ isMasterAdmin: false, permissions: [] })
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())
  const [searchResults, setSearchResults] = useState<CustomerBillingSearchResult[]>([])
  const [directFamilyId, setDirectFamilyId] = useState<number | null>(null)
  const [searching, setSearching] = useState(false)
  const [overview, setOverview] = useState<CustomerBillingOverview | null>(null)
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
  const [customChargeOpen, setCustomChargeOpen] = useState(false)
  const [refundPayment, setRefundPayment] = useState<BillingTransaction | null>(null)
  const [contactDraft, setContactDraft] = useState<ContactDraft>(EMPTY_CONTACT)

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
    setError(null)
    setSuccess(null)
    setLastActionUrl(null)
    try {
      const overviewParams = memberId == null ? '' : `?memberId=${memberId}`
      const overviewResponse = await adminApiRequest(`/api/admin/customer-billing/families/${familyId}/overview${overviewParams}`)
      const overviewBody = await jsonBody(overviewResponse)
      if (!overviewResponse.ok) throw new Error(overviewBody.message || 'Billing account failed to load.')
      const nextOverview = overviewBody.data as CustomerBillingOverview
      setOverview(nextOverview)
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
      const response = await adminApiRequest(
        `/api/admin/customer-billing/families/${overview.account.familyId}/refresh`,
        { method: 'POST' },
      )
      const body = await jsonBody(response)
      if (!response.ok) throw new Error(body.message || 'Stripe account refresh failed.')
      await loadFamily(overview.account.familyId, selectedMemberId)
      const resolved = Number(body.data?.alertsResolved ?? 0)
      setSuccess(resolved > 0
        ? `Account refreshed. ${resolved} stale ${resolved === 1 ? 'alert was' : 'alerts were'} resolved.`
        : 'Account refreshed. No stale alerts were found.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Stripe account refresh failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaved = (message: string) => {
    const url = message.match(/https?:\/\/\S+/)?.[0] ?? null
    setLastActionUrl(url)
    setPriceEnrollment(null)
    setCustomChargeOpen(false)
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

  const visibleEnrollments = useMemo(
    () => overview?.enrollments.filter((row) => selectedMemberId == null || row.memberId === selectedMemberId) ?? [],
    [overview, selectedMemberId],
  )
  const visibleAnnualMemberships = useMemo(
    () => (overview?.annualMemberships ?? []).filter(
      (row) => selectedMemberId == null || row.memberId === selectedMemberId,
    ),
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
  const refundableCharges = useMemo(
    () => transactions.filter((row) => row.entryKind === 'charge' && row.amountCents > 0),
    [transactions],
  )

  const saveContact = async () => {
    if (!overview) return
    setSaving(true)
    setError(null)
    try {
      const response = await adminApiRequest(`/api/admin/families/${overview.account.familyId}/billing-account`, {
        method: 'PUT',
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
        ? `/api/admin/families/${overview.account.familyId}/payments/${row.refId}/resend-receipt`
        : `/api/admin/families/${overview.account.familyId}/refunds/${row.refId}/resend-receipt`
      const response = await adminApiRequest(endpoint, { method: 'POST' })
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
          <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red-200"><WalletCards className="h-4 w-4" /> Pricing & Billing</div><h1 className="text-3xl font-black tracking-tight">Customer Billing</h1><p className="mt-2 max-w-2xl text-sm text-gray-300">Search an individual, then see their household’s enrollment pricing, recurring charges, transactions, refunds, and complete account activity in one place.</p></div>
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
              <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setCustomChargeOpen(true)} disabled={!canManage || saving} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Plus className="h-4 w-4" /> Custom charge</button><button type="button" onClick={() => void openPaymentMethodLink()} disabled={!canManage || saving || !overview.paymentMethod.stripeEnabled} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"><CreditCard className="h-4 w-4" /> Update payment method</button><button type="button" onClick={() => void refreshAccountFromStripe()} disabled={loading || saving} className="rounded-lg border border-gray-300 p-2 text-gray-600" aria-label="Refresh account from Stripe" title="Refresh from Stripe and clear verified stale alerts"><RefreshCw className={`h-4 w-4 ${(loading || saving) ? 'animate-spin' : ''}`} /></button></div>
            </div>
            <div className="grid gap-3 border-t border-gray-200 bg-gray-50 p-5 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Account balance" value={money(overview.summary.balanceCents)} tone={overview.summary.balanceCents < 0 ? 'positive' : overview.summary.balanceCents > 0 ? 'warning' : 'default'} detail={overview.summary.balanceCents < 0 ? 'Credit balance' : overview.summary.balanceCents > 0 ? 'Amount due' : 'Paid in full'} />
              <MetricCard label="Monthly recurring" value={money(overview.summary.monthlyTotals.netCents)} detail={`${money(overview.summary.monthlyTotals.discountCents)} in discounts`} />
              <MetricCard label="Next billing" value={calendarDate(overview.summary.nextBillDate)} detail="Calendar-month billing" />
              <MetricCard label="Latest payment" value={overview.summary.latestPayment ? money(overview.summary.latestPayment.amountCents) : 'None'} detail={overview.summary.latestPayment ? `${localDate(overview.summary.latestPayment.paidAt)} · ${overview.summary.latestPayment.method || 'Payment'}` : 'No payment history'} />
              <MetricCard label="Stripe pricing" value={overview.summary.stripeSync.status === 'healthy' ? 'Healthy' : 'Sync required'} tone={overview.summary.stripeSync.status === 'healthy' ? 'positive' : 'warning'} detail={overview.summary.stripeSync.message} />
            </div>
            {overview.summary.stripeSync.status !== 'healthy' ? (
              <div className="flex flex-col gap-3 border-t border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <strong>Stripe has not confirmed the recurring prices shown on this account.</strong>
                    <p className="mt-1 text-amber-800">The Customer Billing total is calculated locally. Until synchronization succeeds, Stripe may retain an older amount. Errors shown below are technical details from the last attempt.</p>
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

          <AnnualMembershipSection
            memberships={visibleAnnualMemberships}
            canManage={canManage}
            saving={saving}
            onSetAutoRenewal={(membership, enabled) => {
              void setAnnualMembershipAutoRenewal(membership, enabled)
            }}
          />
          <EnrollmentSection enrollments={visibleEnrollments} waitlists={visibleWaitlists} canManage={canManage} onChangePrice={setPriceEnrollment} onRetrySync={(adjustment) => void retryAdjustmentSync(adjustment)} onRevoke={(adjustment) => void revokeAdjustment(adjustment)} />

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4"><div><h2 className="text-lg font-bold text-gray-950">Complete account audit</h2><p className="text-sm text-gray-500">Financial line items and administrative history remain separate but linked.</p></div><div className="flex rounded-lg bg-gray-100 p-1"><button type="button" onClick={() => setAuditTab('transactions')} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${auditTab === 'transactions' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'}`}>Transactions</button><button type="button" onClick={() => setAuditTab('activity')} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${auditTab === 'activity' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'}`}>Activity</button></div></div>
            {auditTab === 'transactions' ? <TransactionsPanel rows={transactions} members={overview.members} filters={transactionFilters} hasMore={Boolean(transactionCursor)} loading={auditLoading} canManage={canManage} onFilterChange={(key, value) => setTransactionFilters((current) => ({ ...current, [key]: value }))} onApplyFilters={() => { setTransactionCursor(null); setActivityCursor(null); void loadAudits(overview.account.familyId, selectedMemberId, false).catch((caught) => setError(caught instanceof Error ? caught.message : 'Filters failed.')) }} onLoadMore={() => void loadAudits(overview.account.familyId, selectedMemberId, 'transactions').catch((caught) => setError(caught instanceof Error ? caught.message : 'More transactions failed to load.'))} onExport={() => void exportTransactions()} onRefund={setRefundPayment} onResendReceipt={(row) => void resendReceipt(row)} /> : <ActivityPanel rows={activityRows} hasMore={Boolean(activityCursor)} loading={auditLoading} onLoadMore={() => void loadAudits(overview.account.familyId, selectedMemberId, 'activity').catch((caught) => setError(caught instanceof Error ? caught.message : 'More activity failed to load.'))} />}
          </section>

        </>
      ) : null}

      {priceEnrollment ? <PriceAdjustmentModal enrollment={priceEnrollment} onClose={() => setPriceEnrollment(null)} onSaved={handleSaved} /> : null}
      {customChargeOpen && overview ? <CustomChargeModal familyId={overview.account.familyId} members={overview.members} selectedMemberId={selectedMemberId} savedCardAvailable={overview.paymentMethod.available} onClose={() => setCustomChargeOpen(false)} onSaved={handleSaved} /> : null}
      {refundPayment && overview ? <RefundModal familyId={overview.account.familyId} payment={refundPayment} charges={refundableCharges} onClose={() => setRefundPayment(null)} onSaved={handleSaved} /> : null}

      {saving ? <div className="fixed bottom-5 right-5 z-[210] inline-flex items-center gap-2 rounded-full bg-gray-950 px-4 py-2 text-sm font-semibold text-white shadow-xl"><Loader2 className="h-4 w-4 animate-spin" /> Updating billing account…</div> : null}
    </div>
  )
}
