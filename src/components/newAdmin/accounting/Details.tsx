import { ArrowUpRight, ReceiptText } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { button, Empty, ErrorNotice, Loading } from '../shared'
import { useRead, type BillingTarget } from '../api'
import Drawer from './Drawer'
import { AccountingStatus } from './Tables'
import { amount, day, humanize, moment } from './format'
import type { BillAllocation, BillDetail, LinkedRefund, PaymentDetail } from './types'

export type AccountingSelection = { kind: 'line' | 'payment' | 'refund'; id: number }

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3 border-t border-slate-200 pt-5"><h3 className="text-sm font-semibold text-slate-950">{title}</h3>{children}</section>
}
function AmountCard({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return <div className={`rounded-lg border p-3 ${emphasis ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50'}`}><p className={`text-xs ${emphasis ? 'text-slate-300' : 'text-slate-500'}`}>{label}</p><p className="mt-2 text-lg font-semibold tabular-nums">{amount(value)}</p></div>
}

function AllocationRecord({ row, timezone, children }: { row: BillAllocation; timezone: string; children?: ReactNode }) {
  return <div className="rounded-lg border border-slate-200 p-3 text-sm">
    <div className="flex items-start justify-between gap-4"><div><p className="font-medium text-slate-900">Payment #{row.paymentId} · {humanize(row.method)}</p><p className="mt-1 text-xs text-slate-500">Received {moment(row.paidAt, timezone)}</p></div><span className="whitespace-nowrap font-semibold tabular-nums">{amount(row.signedAmountCents)}</span></div>
    {children}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{humanize(row.kind)} · allocated {moment(row.allocatedAt, timezone)}</span><AccountingStatus value={row.paymentStatus} /></div>
  </div>
}

function RefundRecords({ rows, timezone }: { rows: LinkedRefund[]; timezone: string }) {
  return rows.length ? <div className="space-y-2">{rows.map(row => <div className="rounded-lg border border-slate-200 p-3" key={row.id}>
    <div className="flex items-start justify-between gap-3 text-sm"><div><p className="font-medium">Refund #{row.id} · payment #{row.paymentId}</p><p className="mt-1 text-xs text-slate-500">Recorded {moment(row.refundedAt, timezone)}</p></div><p className="font-semibold tabular-nums text-rose-700">{amount(row.amountCents)}</p></div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">{humanize(row.ledgerTreatment)}{row.relatedChargeId ? ` · Line #${row.relatedChargeId}` : ''}</span><AccountingStatus value={row.status} /></div>
  </div>)}</div> : <p className="text-sm text-slate-500">No linked refunds.</p>
}

export default function AccountingDetails({ selected, timezone, revision, onClose, onBilling, onLine }: {
  selected: AccountingSelection
  timezone: string
  revision: number
  onClose: () => void
  onBilling: (target: BillingTarget) => void
  onLine: (id: number) => void
}) {
  return <Drawer title={selected.kind === 'line' ? `Bill line #${selected.id}` : `${humanize(selected.kind)} #${selected.id}`} subtitle={`Amounts in USD · Dates in ${timezone}`} onClose={onClose}>
    {selected.kind === 'line' ? <BillContents id={selected.id} revision={revision} timezone={timezone} onBilling={onBilling} /> : <PaymentContents id={selected.id} kind={selected.kind} revision={revision} timezone={timezone} onBilling={onBilling} onLine={onLine} />}
  </Drawer>
}

function BillContents({ id, revision, timezone, onBilling }: { id: number; revision: number; timezone: string; onBilling: (target: BillingTarget) => void }) {
  const [retry, setRetry] = useState(0)
  const state = useRead<BillDetail>(`/api/admin/accounting/lines/${id}`, revision + retry)
  if (state.loading) return <Loading label="Loading bill history…" />
  if (state.error) return <ErrorNotice message={state.error} onRetry={() => setRetry(value => value + 1)} />
  if (!state.data) return null
  const { line, allocations, refunds, adjustments, creditApplications } = state.data
  return <div className="space-y-6">
    <div><div className="flex items-start justify-between gap-4"><h3 className="text-lg font-semibold leading-6 text-slate-950">{line.description}</h3><AccountingStatus value={line.status} /></div><p className="mt-2 text-sm text-slate-600">{line.memberName || 'Household'} · {line.familyName || `Account #${line.accountId}`}</p>{line.className ? <p className="mt-1 text-sm text-slate-500">{line.className}</p> : null}
      <button type="button" className={`${button} mt-4`} onClick={() => onBilling({ familyId: line.familyId, memberId: line.memberId })}>Account details<ArrowUpRight className="h-4 w-4" /></button>
    </div>
    {line.ledgerRetired ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This line belongs to a historical ledger. Review its recorded activity before taking action in the account.</p> : null}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><AmountCard label="Billed" value={line.amountCents} /><AmountCard label="Paid" value={line.paidCents} /><AmountCard label="Credit applied" value={line.creditAppliedCents} /><AmountCard label="Open" value={line.openCents} emphasis /></div>
    <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
      <div><dt className="text-xs text-slate-500">Posted</dt><dd className="mt-1">{moment(line.billedAt, timezone)}</dd></div>
      <div><dt className="text-xs text-slate-500">Line type</dt><dd className="mt-1">{humanize(line.chargeType)}</dd></div>
      <div><dt className="text-xs text-slate-500">Service period</dt><dd className="mt-1">{line.servicePeriodStart ? `${day(line.servicePeriodStart)}${line.servicePeriodEnd ? ` – ${day(line.servicePeriodEnd)}` : ''}` : 'Not specified'}</dd></div>
      <div><dt className="text-xs text-slate-500">Original / adjustments</dt><dd className="mt-1 tabular-nums">{amount(line.originalCents)} / {amount(line.adjustmentCents)}</dd></div>
    </dl>
    <DetailSection title="Payments allocated to this line">
      <p className="text-xs leading-5 text-slate-500">Complete recorded allocation history, including reversals. Receipt dates and allocation dates can differ.</p>
      {allocations.length ? <div className="space-y-2">{allocations.map(row => <AllocationRecord key={row.id} row={row} timezone={timezone} />)}</div> : <Empty>No payments have been allocated to this line.</Empty>}
    </DetailSection>
    {adjustments.length ? <DetailSection title="Bill adjustments"><div className="space-y-2">{adjustments.map(row => <div className="flex justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm" key={row.id}><div><p>{row.description}</p><p className="mt-1 text-xs text-slate-500">{moment(row.createdAt, timezone)}</p></div><span className="font-medium tabular-nums">{amount(row.amountCents)}</span></div>)}</div></DetailSection> : null}
    {creditApplications.length ? <DetailSection title="Credit applications"><div className="space-y-2">{creditApplications.map(row => <div key={row.id} className="rounded-lg border border-slate-200 p-3 text-sm"><div className="flex justify-between gap-3"><p className="font-medium text-slate-800">Credit charge #{row.sourceChargeId} → charge #{row.targetChargeId}</p><span className="tabular-nums">{amount(row.amountCents)}</span></div><p className="mt-1 text-xs text-slate-500">{moment(row.appliedAt, timezone)}</p></div>)}</div></DetailSection> : null}
    <DetailSection title="Refunds linked to this line"><RefundRecords rows={refunds} timezone={timezone} /></DetailSection>
  </div>
}

function PaymentContents({ id, kind, revision, timezone, onBilling, onLine }: { id: number; kind: 'payment' | 'refund'; revision: number; timezone: string; onBilling: (target: BillingTarget) => void; onLine: (id: number) => void }) {
  const [retry, setRetry] = useState(0)
  const state = useRead<PaymentDetail>(`/api/admin/accounting/payments/${id}?kind=${kind}`, revision + retry)
  if (state.loading) return <Loading label="Loading payment history…" />
  if (state.error) return <ErrorNotice message={state.error} onRetry={() => setRetry(value => value + 1)} />
  if (!state.data) return null
  const { payment, allocations, refunds } = state.data
  return <div className="space-y-6">
    <div><div className="flex justify-between gap-3"><h3 className="text-lg font-semibold text-slate-950">{payment.familyName || `Account #${payment.accountId}`}</h3><AccountingStatus value={payment.status} /></div><p className="mt-2 text-sm text-slate-500">{humanize(payment.method)} · {payment.kind === 'refund' ? 'Recorded' : 'Received'} {moment(payment.occurredAt, timezone)}</p><button type="button" className={`${button} mt-4`} onClick={() => onBilling({ familyId: payment.familyId, memberId: null })}>Account details<ArrowUpRight className="h-4 w-4" /></button></div>
    <div className="grid grid-cols-2 gap-3"><AmountCard label={payment.kind === 'refund' ? 'Refund event' : 'Whole receipt'} value={payment.amountCents} emphasis />{payment.kind === 'refund' ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">Original payment</p><p className="mt-2 text-lg font-semibold">{payment.relatedPaymentId ? `#${payment.relatedPaymentId}` : 'Not linked'}</p></div> : <AmountCard label="Unapplied receipt" value={payment.unappliedCents} />}</div>
    {payment.reference ? <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-medium text-slate-500">Reference</p><p className="mt-1 break-all font-mono text-xs text-slate-700">{payment.reference}</p></div> : null}
    {!payment.settled ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This event is not settled and is excluded from cash summary totals.</p> : null}
    <DetailSection title={kind === 'refund' ? 'Original payment allocation history' : 'Payment allocation history'}>
      <p className="text-xs leading-5 text-slate-500">All allocations for the original household payment are shown here. {kind === 'refund' ? 'An allocation to a bill does not mean this refund belongs to that bill.' : 'Unapplied money belongs to the household and is not assigned to a person or class.'}</p>
      {allocations.length ? <div className="space-y-2">{allocations.map(row => <AllocationRecord row={row} key={row.id} timezone={timezone}><button type="button" className="mt-3 flex items-start gap-2 text-left text-sm font-medium text-slate-800 hover:underline" onClick={() => onLine(row.chargeId)}><ReceiptText className="mt-0.5 h-4 w-4 shrink-0" /><span>{row.description || `Line #${row.chargeId}`}<span className="mt-1 block text-xs font-normal text-slate-500">{[row.memberName, row.className].filter(Boolean).join(' · ') || 'Household line item'}</span></span></button></AllocationRecord>)}</div> : <Empty>No allocations are recorded for this payment.</Empty>}
    </DetailSection>
    <DetailSection title="Refund history for this payment"><RefundRecords rows={refunds} timezone={timezone} /></DetailSection>
  </div>
}
