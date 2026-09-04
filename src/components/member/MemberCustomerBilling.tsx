import { useMemo, useState } from 'react'
import { ChevronDown, CreditCard, ExternalLink, Plus, RefreshCw, WalletCards } from 'lucide-react'
import type {
  BillingDiscountComponent,
  CustomerBillingAnnualMembership,
  CustomerBillingEnrollment,
  CustomerBillingOverview,
} from '../customerBilling/types'
import { billingMonthAbbreviation } from '../customerBilling/format'

export interface MemberBillingTransaction {
  entryKind: 'charge' | 'drop_in' | 'payment' | 'refund'
  entryType: string
  refId: number
  memberId: number | null
  memberName: string | null
  description: string
  billingMonths: string[]
  amountCents: number
  occurredAt: string
  status: string
  runningBalanceCents: number
  classCatalogId?: number | null
  classSchedule?: string | null
  transferTag?: 'X-in' | 'X-out' | null
}

export interface MemberCustomerBillingData {
  revision?: string | null
  access: {
    viewerMemberId: number
    canViewHousehold: boolean
    canManagePayments: boolean
    canManagePaymentMethod: boolean
    canManageAnnualMembershipAutoRenewal: boolean
  }
  overview: CustomerBillingOverview | null
  transactions: MemberBillingTransaction[]
  nextTransactionCursor: string | null
}

interface Props {
  data: MemberCustomerBillingData | null
  loading: boolean
  payNowLoading: boolean
  portalLoading: boolean
  annualMembershipRenewalLoading: boolean
  onPayNow: () => void
  onManagePayment: () => void
  onSetAnnualMembershipAutoRenewal: (subscriptionId: number, enabled: boolean) => void
  onRefresh: () => void
  onEnroll: () => void
  onLoadMoreTransactions: () => void
  transactionsLoading: boolean
  transactionsLoadingMore: boolean
  formatMoney: (cents: number) => string
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12).toLocaleDateString(
      'en-US',
      { month: 'short', day: 'numeric', year: 'numeric' },
    )
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function monthLabel(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})/)
  if (!match) return value
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function statusTone(status: string) {
  const value = status.toLowerCase()
  if (['active', 'paid', 'settled', 'succeeded', 'available', 'household_monthly'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }
  if (['unpaid', 'pending', 'partially_paid', 'failed', 'sync_failed', 'autopay_setup_required', 'household_payment_method_required'].includes(value)) {
    return 'bg-amber-50 text-amber-800 ring-amber-200'
  }
  if (['cancelled', 'inactive', 'paused'].includes(value)) return 'bg-red-50 text-red-700 ring-red-200'
  return 'bg-gray-100 text-gray-700 ring-gray-200'
}

function StatusBadge({ value, label }: { value: string | null | undefined; label?: string }) {
  if (!value) return null
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${statusTone(value)}`}>
      {label ?? value.replaceAll('_', ' ')}
    </span>
  )
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string
  value: string
  detail: string
  tone?: 'default' | 'warning' | 'positive'
}) {
  const color = tone === 'positive' ? 'text-emerald-700' : tone === 'warning' ? 'text-amber-700' : 'text-gray-950'
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  )
}

function monthlyInvoiceStatusLabel(status: string) {
  if (status === 'paid') return 'Paid'
  if (status === 'payment_method_required') return 'Payment method needed'
  if (status === 'failed') return 'Payment failed'
  return 'Payment pending'
}

function MonthlyHouseholdInvoiceSection({
  invoices,
  billingMonth,
  formatMoney,
  localBillCents,
  paymentMethodRequired,
  monthlyLedgerBill,
}: {
  invoices: CustomerBillingOverview['monthlyInvoices']
  billingMonth: string | null | undefined
  formatMoney: (cents: number) => string
  localBillCents: number
  paymentMethodRequired: boolean
  monthlyLedgerBill: CustomerBillingOverview['summary']['monthlyLedgerBill']
}) {
  const invoice = billingMonth
    ? invoices.find((item) => item.billingMonth?.slice(0, 7) === billingMonth.slice(0, 7)) ?? null
    : invoices[0] ?? null
  const billingMonthDate = billingMonth ? `${billingMonth.slice(0, 7)}-01` : null
  if (!invoice) {
    const ledgerBill = monthlyLedgerBill?.billingMonth?.slice(0, 7) === billingMonth?.slice(0, 7)
      ? monthlyLedgerBill
      : null
    const hasPostedBill = ledgerBill != null || localBillCents > 0
    const label = ledgerBill?.status === 'paid'
      ? 'Paid'
      : ledgerBill?.status === 'partially_paid'
        ? 'Partially paid'
        : hasPostedBill && paymentMethodRequired
          ? 'Awaiting payment method'
          : hasPostedBill
            ? 'Prepared locally'
            : 'No invoice needed'
    const totalCents = ledgerBill?.totalCents ?? localBillCents
    return (
      <div className="border-t border-gray-200 bg-white px-5 py-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><strong className="text-gray-950">{ledgerBill ? 'Monthly household bill' : 'Monthly household invoice'} · {formatDate(billingMonthDate)}</strong>{ledgerBill ? <span className="ml-2 text-gray-500">{ledgerBill.lineCount} items · {label}</span> : null}</div>
          <div className="flex items-center gap-3">
            {!ledgerBill ? <span className="text-gray-500">{label}</span> : null}
            {hasPostedBill ? <strong className="text-gray-950">{formatMoney(totalCents)}</strong> : null}
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-600">
          {ledgerBill
            ? ledgerBill.status === 'paid'
              ? 'Bill lines and their payment are recorded in Account History. No separate Stripe invoice was required for this settled bill.'
              : ledgerBill.status === 'partially_paid'
                ? `${formatMoney(ledgerBill.remainingCents)} remains after payments recorded in Account History.`
                : 'Bill lines are posted in Account History and remain unpaid.'
            : hasPostedBill
            ? paymentMethodRequired
              ? 'Class charges are posted in Account History. Add a reusable payment method before Stripe can issue the household invoice.'
              : 'Class charges are posted in Account History. Stripe has not issued a household invoice for this billing month yet.'
            : 'No recurring class tuition is due for this billing month. One-time charges and payments, such as annual fees, appear in Account History.'}
        </p>
        {ledgerBill?.lines.length ? <div className="mt-3 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">{ledgerBill.lines.map((line) => <div key={line.id} className="flex items-center justify-between gap-3"><span className="truncate">{line.memberName ? `${line.memberName} · ` : ''}{line.description}</span><span className="font-semibold text-gray-800">{formatMoney(line.amountCents)}</span></div>)}</div> : null}
      </div>
    )
  }
  return (
    <div className="border-t border-gray-200 bg-white px-5 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong className="text-gray-950">Monthly household invoice · {formatDate(invoice.billingMonth)}</strong>
          <span className="ml-2 text-gray-500">{invoice.lineCount} items · {monthlyInvoiceStatusLabel(invoice.status)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <strong className="text-gray-950">{formatMoney(invoice.totalCents)}</strong>
            {invoice.postPaymentCreditCents > 0 ? <div className="text-xs font-medium text-emerald-700">{formatMoney(invoice.postPaymentCreditCents)} moved to account credit</div> : null}
          </div>
          {invoice.hostedInvoiceUrl ? <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700">Open payment link <ExternalLink className="h-3.5 w-3.5" /></a> : null}
        </div>
      </div>
      {invoice.lines.length > 0 ? <div className="mt-3 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">{invoice.lines.map((line) => <div key={line.id} className="flex items-center justify-between gap-3"><span className="truncate">{line.memberName ? `${line.memberName} · ` : ''}{line.description}</span><span className="font-semibold text-gray-800">{formatMoney(line.amountCents)}</span></div>)}</div> : null}
    </div>
  )
}

function DiscountBreakdown({
  totalCents,
  components,
  formatMoney,
}: {
  totalCents: number
  components: BillingDiscountComponent[]
  formatMoney: (cents: number) => string
}) {
  if (totalCents <= 0) return <span className="text-gray-400">—</span>
  return (
    <div className="space-y-1 text-xs text-emerald-700">
      {components.map((item, index) => (
        <div key={`${item.name}-${index}`}>
          <div className="font-semibold">{item.name}</div>
          {item.qualifiedLabel ? <div className="text-gray-500">{item.qualifiedLabel}</div> : null}
          <div>−{formatMoney(item.amountCents)}</div>
        </div>
      ))}
      {components.length === 0 ? <div>−{formatMoney(totalCents)}</div> : null}
    </div>
  )
}

function AnnualMembershipCard({
  membership,
  formatMoney,
  onEnroll,
  canManageAutoRenewal,
  saving,
  onSetAutoRenewal,
}: {
  membership: CustomerBillingAnnualMembership
  formatMoney: (cents: number) => string
  onEnroll?: () => void
  canManageAutoRenewal: boolean
  saving: boolean
  onSetAutoRenewal: (subscriptionId: number, enabled: boolean) => void
}) {
  const lifetimeMember = membership.lifetimeMember === true
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${membership.active ? 'border-gray-700 bg-gray-800 text-white' : 'border-red-800 bg-red-700 text-white'}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-300">{lifetimeMember ? 'Lifetime member' : 'Annual membership'}</div>
      <div className="mt-1 truncate text-xl font-bold">{membership.memberName}</div>
      <div className="mt-1 text-sm text-gray-200">{lifetimeMember ? 'Lifetime access' : membership.active ? `Good through ${formatDate(membership.renewalDate)}` : 'Required before enrolling in classes'}</div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold">{lifetimeMember ? 'Lifetime member' : membership.active ? 'Valid' : `Not purchased · ${formatMoney(membership.outstandingAmountCents)}`}</span>
        {!lifetimeMember && !membership.active && onEnroll ? <button type="button" onClick={onEnroll} className="rounded border border-white/30 px-2 py-1 font-semibold hover:bg-white/10">Enroll now</button> : null}
      </div>
      {membership.active && !lifetimeMember ? <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/20 pt-3 text-xs"><span className="text-gray-200">Auto-renew {membership.autoRenewal ? 'on' : 'off'}</span>{canManageAutoRenewal && membership.canManageAutoRenewal && membership.billingSubscriptionId != null ? <button type="button" disabled={saving} onClick={() => onSetAutoRenewal(membership.billingSubscriptionId!, !membership.autoRenewal)} className="rounded border border-white/30 px-2 py-1 font-semibold hover:bg-white/10 disabled:opacity-50">{saving ? 'Saving…' : membership.autoRenewal ? 'Cancel Auto-Renew' : 'Resume Auto-Renew'}</button> : null}</div> : null}
    </div>
  )
}

function EnrollmentTable({
  enrollments,
  formatMoney,
}: {
  enrollments: CustomerBillingEnrollment[]
  formatMoney: (cents: number) => string
}) {
  return (
    <div className="overflow-x-auto" style={{ contentVisibility: 'auto' }}>
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Class</th>
            <th className="px-4 py-3">Class schedule</th>
            <th className="px-4 py-3 text-right">Class cost</th>
            <th className="px-4 py-3">Discounts</th>
            <th className="px-4 py-3 text-right">Final price</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((enrollment) => (
            <tr key={`${enrollment.source}-${enrollment.id}`} className="border-t border-gray-100 align-top">
              <td className="min-w-[230px] px-4 py-3">
                <div className="font-semibold text-gray-950">{enrollment.class_name || 'Class'}{enrollment.classCatalogId != null ? ` #${enrollment.classCatalogId}` : ''}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {enrollment.sport_name || '—'} · {enrollment.program_name || '—'}
                </div>
                <div className="mt-1 text-xs font-medium text-gray-700">{enrollment.memberName || 'Family member'}</div>
              </td>
              <td className="min-w-[310px] px-4 py-3 text-gray-600">
                <div><span className="font-semibold text-gray-700">Active Class Dates:</span> {enrollment.offering_dates || 'Evergreen'}</div>
                {enrollment.source === 'drop_in' ? <div className="mt-1 font-semibold text-gray-700">Drop-in</div> : <div className="mt-1"><span className="font-semibold text-gray-700">Enrollment Start Date:</span> {formatDate(enrollment.enrollment_start_date || enrollment.created_at)}</div>}
                <div className="mt-1"><span className="font-semibold text-gray-700">Schedule:</span> {enrollment.schedule || '—'}</div>
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-700">{formatMoney(enrollment.classCostCents)}</td>
              <td className="min-w-[190px] px-4 py-3"><DiscountBreakdown totalCents={enrollment.automaticDiscountCents} components={enrollment.automaticDiscountComponents} formatMoney={formatMoney} /></td>
              <td className="px-4 py-3 text-right"><strong className="text-base text-gray-950">{formatMoney(enrollment.adjustedCostCents)}</strong><span className="block text-xs text-gray-400">{enrollment.source === 'drop_in' ? 'one time' : 'per month'}</span></td>
              <td className="min-w-[180px] px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <StatusBadge value={enrollment.status} label={`Class ${enrollment.status.replaceAll('_', ' ')}`} />
                  <StatusBadge value={enrollment.billing_status} label={enrollment.billing_status ? `Billing ${enrollment.billing_status.replaceAll('_', ' ')}` : undefined} />
                  <StatusBadge value={enrollment.collectionMode ?? enrollment.priceSyncStatus} />
                </div>
                <p className="mt-1 text-xs text-gray-500">Next bill {formatDate(enrollment.nextBillDate)}</p>
              </td>
            </tr>
          ))}
          {enrollments.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No current or upcoming billable enrollments.</td></tr> : null}
        </tbody>
      </table>
    </div>
  )
}

function TransactionTable({
  transactions,
  formatMoney,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
}: {
  transactions: MemberBillingTransaction[]
  formatMoney: (cents: number) => string
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
}) {
  return (
    <div className="overflow-x-auto" style={{ contentVisibility: 'auto' }}>
      <table className="w-full min-w-[880px] text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Member</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={`${transaction.entryKind}-${transaction.refId}`} className="border-t border-gray-100">
              <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(transaction.occurredAt)}</td>
              <td className="px-4 py-3 text-gray-600">{transaction.memberName || 'Household'}</td>
              <td className="max-w-[320px] px-4 py-3"><div className="flex items-center gap-1.5"><strong className="min-w-0 truncate text-gray-900">{transaction.description}</strong>{transaction.transferTag ? <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${transaction.transferTag === 'X-out' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'}`}>({transaction.transferTag})</span> : null}</div>{transaction.billingMonths.length > 0 ? <span className="text-xs text-gray-500">{transaction.billingMonths.map(monthLabel).join(', ')}</span> : null}</td>
              <td className="px-4 py-3 capitalize text-gray-600">{transaction.entryType.replaceAll('_', ' ')}</td>
              <td className="px-4 py-3"><StatusBadge value={transaction.status} /></td>
              <td className={`px-4 py-3 text-right font-semibold ${transaction.amountCents < 0 ? 'text-emerald-700' : 'text-gray-950'}`}>{formatMoney(transaction.amountCents)}</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-950">{formatMoney(transaction.runningBalanceCents)}</td>
            </tr>
          ))}
          {loading ? <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-500">Loading transactions…</td></tr> : null}
          {!loading && transactions.length === 0 ? <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-500">No transactions have been recorded yet.</td></tr> : null}
        </tbody>
      </table>
      {hasMore ? <div className="border-t border-gray-200 p-4 text-center"><button type="button" onClick={onLoadMore} disabled={loadingMore} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more'}</button></div> : null}
    </div>
  )
}

export default function MemberCustomerBilling({
  data,
  loading,
  payNowLoading,
  portalLoading,
  annualMembershipRenewalLoading,
  onPayNow,
  onManagePayment,
  onSetAnnualMembershipAutoRenewal,
  onRefresh,
  onEnroll,
  onLoadMoreTransactions,
  transactionsLoading,
  transactionsLoadingMore,
  formatMoney,
}: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const overview = data?.overview ?? null
  const visibleEnrollments = useMemo(() => overview?.enrollments.filter((row) => selectedMemberId == null || row.memberId === selectedMemberId) ?? [], [overview, selectedMemberId])
  const visibleWaitlists = useMemo(() => overview?.waitlists.filter((row) => selectedMemberId == null || row.memberId === selectedMemberId) ?? [], [overview, selectedMemberId])
  const visibleMemberships = useMemo(() => overview?.annualMemberships.filter((row) => selectedMemberId == null || row.memberId === selectedMemberId) ?? [], [overview, selectedMemberId])
  const visibleBundlePasses = useMemo(() => (overview?.bundlePasses ?? []).filter((row) => selectedMemberId == null || row.memberId === selectedMemberId), [overview, selectedMemberId])
  const visibleBundleUsage = useMemo(() => (overview?.bundleUsage ?? []).filter((row) => selectedMemberId == null || row.memberId === selectedMemberId), [overview, selectedMemberId])
  const visibleTransactions = useMemo(() => data?.transactions.filter((row) => selectedMemberId == null || row.memberId === selectedMemberId) ?? [], [data, selectedMemberId])

  if (loading) {
    return <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-500">Loading family billing account…</div>
  }

  if (!overview) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Family billing details are unavailable.</div>
  }

  const balanceDue = overview.summary.collectibleBalanceCents
  const canManageBilling = data?.access.canManagePayments === true
  const payableHostedInvoice = overview.monthlyInvoices.find((invoice) => (
    ['open', 'failed', 'payment_method_required'].includes(invoice.status)
    && Boolean(invoice.hostedInvoiceUrl)
  )) ?? null
  const canPay = canManageBilling
    && overview.paymentMethod.stripeEnabled
    && (balanceDue > 0 || Boolean(payableHostedInvoice?.hostedInvoiceUrl))
  const canManagePaymentMethod = data?.access.canManagePaymentMethod === true
  const processMonthlyBalance = () => {
    if (balanceDue <= 0 && payableHostedInvoice?.hostedInvoiceUrl) {
      window.location.assign(payableHostedInvoice.hostedInvoiceUrl)
      return
    }
    onPayNow()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black text-gray-950">{overview.account.familyName || 'Family account'}</h1><StatusBadge value={overview.account.accountStatus} /></div>
            <p className="mt-1 text-sm text-gray-500">Family #{overview.account.familyId}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedMemberId(null)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${selectedMemberId == null ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-300 text-gray-600'}`}>All family</button>
              {overview.members.map((member) => <button key={member.id} type="button" onClick={() => setSelectedMemberId(member.id)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${selectedMemberId === member.id ? 'border-vortex-red bg-red-50 text-vortex-red' : 'border-gray-300 text-gray-600'}`}>{member.name}</button>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data?.access.canManagePayments ? <button type="button" onClick={processMonthlyBalance} disabled={!canPay || payNowLoading} title={canPay ? 'Pay the current household balance.' : 'There is no balance ready for online payment.'} className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><CreditCard className="h-4 w-4" /> {payNowLoading ? 'Starting checkout…' : 'Process monthly balance'}</button> : null}
            {canManagePaymentMethod ? <button type="button" onClick={onManagePayment} disabled={!overview.paymentMethod.stripeEnabled || portalLoading} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"><CreditCard className="h-4 w-4" /> {portalLoading ? 'Opening settings…' : 'Update payment method'}</button> : null}
            <button type="button" onClick={onRefresh} disabled={loading || transactionsLoading || transactionsLoadingMore || payNowLoading || portalLoading} className="rounded-lg border border-gray-300 p-2 text-gray-600 disabled:opacity-40" aria-label="Refresh billing account" title="Refresh billing account"><RefreshCw className={`h-4 w-4 ${(loading || transactionsLoading || transactionsLoadingMore || payNowLoading || portalLoading) ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        <div className="grid gap-3 border-t border-gray-200 bg-gray-50 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Outstanding balance" value={formatMoney(overview.summary.outstandingBalanceCents)} tone={overview.summary.outstandingBalanceCents > 0 ? 'warning' : 'default'} detail="Unpaid charges" />
          <MetricCard label={`Monthly recurring fee${billingMonthAbbreviation(overview.summary.monthlyRecurringPeriod) ? ` (${billingMonthAbbreviation(overview.summary.monthlyRecurringPeriod)})` : ''}`} value={formatMoney(overview.summary.monthlyRecurringCents)} detail={overview.summary.monthlyRecurringDiscountCents < 0 ? `${formatMoney(Math.abs(overview.summary.monthlyRecurringDiscountCents))} surcharge` : `${formatMoney(overview.summary.monthlyRecurringDiscountCents)} in discounts`} />
          <MetricCard label="Future credits" value={formatMoney(overview.summary.futureCreditsCents)} tone={overview.summary.futureCreditsCents > 0 ? 'positive' : 'default'} detail="Applied against the next bill" />
          <MetricCard label="Account balance" value={formatMoney(overview.summary.balanceCents)} tone={overview.summary.balanceCents < 0 ? 'positive' : overview.summary.balanceCents > 0 ? 'warning' : 'default'} detail={overview.summary.balanceCents < 0 ? 'Credit balance' : overview.summary.balanceCents > 0 ? `Amount due on ${formatDate(overview.summary.nextBillDate)}` : 'Paid in full'} />
          {visibleMemberships.map((membership) => <AnnualMembershipCard key={membership.memberId} membership={membership} formatMoney={formatMoney} onEnroll={canManageBilling ? onEnroll : undefined} canManageAutoRenewal={data?.access.canManageAnnualMembershipAutoRenewal === true} saving={annualMembershipRenewalLoading} onSetAutoRenewal={onSetAnnualMembershipAutoRenewal} />)}
        </div>

        <MonthlyHouseholdInvoiceSection
          invoices={overview.monthlyInvoices}
          billingMonth={overview.summary.monthlyRecurringPeriod}
          formatMoney={formatMoney}
          localBillCents={overview.summary.monthlyRecurringCents}
          paymentMethodRequired={overview.account.householdMonthlyBillingEnabled && !overview.paymentMethod.available}
          monthlyLedgerBill={overview.summary.monthlyLedgerBill}
        />

        <div className="border-t border-gray-200 p-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="flex items-start gap-3"><WalletCards className="mt-0.5 h-4 w-4 text-gray-700" /><div><div className="text-sm font-bold text-gray-900">Saved payment method</div>{overview.paymentMethod.paymentMethod ? <p className="mt-1 text-sm text-gray-700"><span className="capitalize">{overview.paymentMethod.paymentMethod.brand}</span> •••• {overview.paymentMethod.paymentMethod.last4}<span className="text-gray-400"> · expires {overview.paymentMethod.paymentMethod.expMonth}/{overview.paymentMethod.paymentMethod.expYear}</span></p> : <p className="mt-1 text-sm text-gray-500">No reusable default card found.</p>}</div></div></div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div><h2 className="text-lg font-bold text-gray-950">Current &amp; upcoming enrollments</h2><p className="text-sm text-gray-500">Every billable class, effective price, and scheduled change.</p></div>
          {canManageBilling ? <button type="button" onClick={onEnroll} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-vortex-red px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"><Plus className="h-4 w-4" /> New Enrollment</button> : null}
        </div>
        <div className="border-t border-gray-200"><EnrollmentTable enrollments={visibleEnrollments} formatMoney={formatMoney} /></div>
        {visibleWaitlists.length > 0 ? <details className="border-t border-gray-200"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 marker:hidden"><span>Waitlists · non-billable</span><span className="flex items-center gap-2">{visibleWaitlists.length}<ChevronDown className="h-4 w-4" /></span></summary><div className="grid gap-2 border-t border-gray-100 p-4 sm:grid-cols-2 xl:grid-cols-3">{visibleWaitlists.map((row) => <div key={row.id} className="rounded-lg border border-gray-200 p-3 text-sm"><strong>{row.memberName}</strong><div className="text-gray-600">{row.class_name}{row.classCatalogId != null ? ` #${row.classCatalogId}` : ''}</div><div className="mt-1 text-xs text-gray-500">{row.schedule}</div></div>)}</div></details> : null}
      </section>

      {visibleBundlePasses.length > 0 ? (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4"><h2 className="text-lg font-bold text-gray-950">Class bundles</h2><p className="text-sm text-gray-500">Household pass balances and recent credit usage.</p></div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleBundlePasses.map((pass) => (
              <div key={pass.id} className="rounded-xl border border-gray-200 p-4">
                <div className="font-bold text-gray-950">{pass.packageLabel || `Pass #${pass.id}`}</div>
                <div className="mt-1 text-sm text-gray-500">{pass.memberName || 'Family member'} · {pass.status}</div>
                <div className="mt-3 text-lg font-black text-gray-950">{pass.classesRemaining} / {pass.classCountPurchased} classes left</div>
                {pass.expiresAt ? <div className="mt-1 text-xs text-gray-500">Expires {formatDate(pass.expiresAt)}</div> : null}
              </div>
            ))}
          </div>
          {visibleBundleUsage.length > 0 ? (
            <details className="border-t border-gray-200">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 marker:hidden"><span>Recent bundle usage</span><ChevronDown className="h-4 w-4" /></summary>
              <div className="divide-y divide-gray-100 border-t border-gray-100 px-5">
                {visibleBundleUsage.slice(0, 20).map((usage) => (
                  <div key={usage.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div><strong className="text-gray-900">{usage.memberName || usage.packageLabel || 'Class bundle'}</strong><span className="ml-2 text-gray-500">{formatDate(usage.createdAt)} · {usage.entryType.replaceAll('_', ' ')}</span>{usage.reason ? <div className="text-xs text-gray-500">{usage.reason}</div> : null}</div>
                    <div className="font-semibold text-gray-800">{usage.creditDelta == null ? '' : `${usage.creditDelta > 0 ? '+' : ''}${usage.creditDelta} → `}{usage.classesRemainingAfter} left</div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4"><h2 className="text-lg font-bold text-gray-950">Account History</h2><p className="text-sm text-gray-500">Transactions for this family billing account.</p></div>
        <TransactionTable transactions={visibleTransactions} formatMoney={formatMoney} loading={transactionsLoading} loadingMore={transactionsLoadingMore} hasMore={data?.nextTransactionCursor != null} onLoadMore={onLoadMoreTransactions} />
      </section>
    </div>
  )
}
