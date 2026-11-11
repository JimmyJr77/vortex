import type { Page } from '../api'

export type AccountingView = 'lines' | 'payments'
export type SortDirection = 'asc' | 'desc'
export interface BillLine {
  id: number
  accountId: number
  familyId: number
  familyName: string | null
  memberId: number | null
  memberName: string | null
  classId: number | null
  className: string | null
  description: string
  chargeType: string
  billedAt: string
  billedDate: string
  servicePeriodStart: string | null
  servicePeriodEnd: string | null
  originalCents: number
  adjustmentCents: number
  amountCents: number
  paidCents: number
  creditAppliedCents: number
  openCents: number
  remainingCents?: number
  accountFundsCents?: number
  balancePeriod?: 'current' | 'upcoming' | 'historical'
  status: string
  lastPaidAt: string | null
  lastPaidDate: string | null
  paymentCount: number
  currency: string
  ledgerRetired?: boolean
}
export interface BillSummary {
  billedCents: number
  paidCents: number
  creditAppliedCents: number
  openCents: number
  creditCents: number
  openCount: number
  comparableCount?: number
  comparableBilledCents?: number
  comparablePaidCents?: number
  comparableCreditAppliedCents?: number
  accountFundsCents?: number
  remainingCents?: number
  currentRemainingCents?: number
  upcomingRemainingCents?: number
  excessAppliedCents?: number
  historicalCount?: number
  historicalBilledCents?: number
}
export interface AccountBalances {
  currentCents: number; currentFamilies: number; upcomingCents: number; upcomingFamilies: number
  creditCents: number; creditFamilies: number; reviewCents: number
}
export interface PaymentEvent {
  id: number
  kind: 'payment' | 'refund'
  accountId: number
  familyId: number
  familyName: string | null
  occurredAt: string
  occurredDate: string
  method: string | null
  status: string
  amountCents: number
  signedAmountCents: number
  settled: boolean
  appliedCents: number
  filteredAppliedCents: number
  unappliedCents: number
  relatedPaymentId: number | null
  reference: string | null
  currency: string
}
export interface PaymentSummary {
  receiptsCents: number
  refundsCents: number
  netCashCents: number
  filteredAppliedCents: number
  unappliedCents: number
  paymentCount: number
  refundCount: number
}
export interface AccountingPage<T, S> extends Page<T> {
  timezone: string
  generatedAt: string
  summary: S
  currency: string
}
export type BillPage = AccountingPage<BillLine, BillSummary> & {asOf?: string; balances?: AccountBalances}
export type PaymentPage = AccountingPage<PaymentEvent, PaymentSummary>
export interface FilterOptions {
  members: Array<{ id: number; name: string }>
  classes: Array<{ id: number; name: string }>
  limit: number
}
export interface BillAllocation {
  id: number
  paymentId: number
  chargeId: number
  kind: string
  amountCents: number
  signedAmountCents: number
  allocatedAt: string
  paidAt: string
  method: string
  paymentStatus: string
}
export interface BillDetail {
  line: BillLine
  allocations: BillAllocation[]
  adjustments: Array<{ id: number; description: string; amountCents: number; createdAt: string }>
  refunds: LinkedRefund[]
  creditApplications: Array<{ id: number; sourceChargeId: number; targetChargeId: number; amountCents: number; appliedAt: string }>
}
export interface PaymentDetail {
  payment: PaymentEvent
  allocations: Array<BillAllocation & { memberId: number | null; memberName: string | null; classId: number | null; className: string | null; description: string }>
  refunds: LinkedRefund[]
}
export interface LinkedRefund {
  id: number
  paymentId: number
  amountCents: number
  refundedAt: string
  status: string
  ledgerTreatment: string
  relatedChargeId: number | null
}
