export interface CustomerBillingMember {
  id: number
  firstName: string
  lastName: string
  name: string
  email: string | null
  phone: string | null
  isActive: boolean
}

export interface CustomerBillingSearchResult {
  familyId: number
  familyName: string
  billingAccountId: number | null
  memberId: number
  name: string
  email: string | null
  phone: string | null
  isActive: boolean
}

export interface BillingDiscountComponent {
  ruleId?: number | null
  name: string
  type?: string | null
  amountCents: number
  source: string | null
  amountType?: string | null
  amountValue?: number | null
  promoCode?: string | null
  qualifiedLabel?: string | null
  qualifiedClassCount?: number | null
  qualifyingSubtotalCents?: number | null
}

export interface PriceAdjustment {
  id: number
  signupId: number
  kind: 'fixed_final_price' | 'promo_code' | 'legacy_discount'
  finalPriceCents: number | null
  promoCode: string | null
  effectiveFromMonth: string
  effectiveThroughMonth: string | null
  reason: string
  status: 'pending_sync' | 'active' | 'sync_failed' | 'revoked'
  stripeSyncError: string | null
  createdAt: string
}

export interface CustomerBillingEnrollment {
  id: number
  source: string
  memberId: number
  memberName: string
  sport_name: string | null
  program_name: string | null
  class_name: string | null
  offering_dates: string | null
  enrollment_start_date: string | null
  created_at: string | null
  schedule: string | null
  status: string
  billing_status: string | null
  billingType?: string
  classCostCents: number
  automaticDiscountCents: number
  automaticDiscountComponents: BillingDiscountComponent[]
  automaticAdjustedCostCents: number
  manualAdjustmentCents: number
  adjustedCostCents: number
  activePriceAdjustment: PriceAdjustment | null
  priceAdjustments: PriceAdjustment[]
  nextBillDate: string | null
  priceSyncStatus: string
  priceSyncError: string | null
  stripeSubscriptionScheduleId: string | null
}

export interface CustomerBillingSubscription {
  id: number
  memberId: number | null
  memberName: string | null
  signupId: number | null
  description: string
  status: string
  monthlyAmountCents: number
  automaticDiscountCents: number
  automaticDiscountComponents: BillingDiscountComponent[]
  manualAdjustmentCents: number
  discountAmountCents: number
  netMonthlyCents: number
  nextBillDate: string | null
  startDate: string | null
  endDate: string | null
  stripeSubscriptionId: string | null
  stripeSubscriptionScheduleId: string | null
  priceSyncStatus: string
  priceSyncError: string | null
  activePriceAdjustment: PriceAdjustment | null
  scheduledPriceAdjustments: PriceAdjustment[]
}

export interface CustomerBillingOverview {
  account: {
    id: number
    familyId: number
    familyName: string | null
    payerMemberId: number | null
    billingEmail: string | null
    billingPhone: string | null
    billingStreet: string | null
    billingCity: string | null
    billingState: string | null
    billingZip: string | null
    stripeCustomerId: string | null
    isActive: boolean
  }
  selectedMemberId: number | null
  members: CustomerBillingMember[]
  summary: {
    chargesCents: number
    paymentsCents: number
    refundsCents: number
    balanceCents: number
    monthlyTotals: { grossCents: number; discountCents: number; netCents: number }
    nextBillDate: string | null
    latestPayment: null | { id: number; amountCents: number; paidAt: string; method: string | null }
    stripeSync: { status: string; message: string }
  }
  paymentMethod: {
    available: boolean
    stripeEnabled: boolean
    paymentMethod: null | {
      id: string
      brand: string
      last4: string | null
      expMonth: number | null
      expYear: number | null
    }
    error?: string
  }
  alerts: Array<{
    id: number
    type: string
    severity: string
    message: string
    stripeObjectId: string | null
    createdAt: string
  }>
  enrollments: CustomerBillingEnrollment[]
  waitlists: CustomerBillingEnrollment[]
  subscriptions: CustomerBillingSubscription[]
  adjustments: PriceAdjustment[]
}

export interface BillingTransaction {
  entryKind: 'charge' | 'payment' | 'refund'
  entryType: string
  refId: number
  memberId: number | null
  memberName: string | null
  description: string
  amountCents: number
  occurredAt: string
  status: string
  runningBalanceCents: number
  details: Record<string, unknown>
}

export interface BillingActivity {
  id: number
  eventType: string
  summary: string
  memberId: number | null
  signupId: number | null
  relatedChargeId: number | null
  relatedPaymentId: number | null
  relatedRefundId: number | null
  beforeValue: unknown
  afterValue: unknown
  details: Record<string, unknown>
  stripeObjectId: string | null
  actorUserId: number | null
  actorName: string | null
  actorType: string
  occurredAt: string
}

export interface BillingStatement {
  id: number
  statementDate: string
  dueDate: string | null
  totalCents: number
  status: string
  lines: Array<{ id?: number; description: string; amount_cents: number }>
}

export interface PriceAdjustmentPreview {
  signupId: number
  billingSubscriptionId: number
  memberName: string
  className: string
  kind: string
  finalPriceCents: number | null
  promoCode: string | null
  effectiveFromMonth: string
  effectiveThroughMonth: string | null
  reason: string
  standardPriceCents: number
  aboveList: boolean
  months: Array<{
    periodKey: string
    standardPriceCents: number
    automaticDiscountCents: number
    automaticNetCents: number
    manualAdjustmentCents: number
    adjustedCostCents: number
    householdNetCents: number
    postedAmountCents: number | null
    retroactive: boolean
    retroactiveDifferenceCents: number
  }>
  retroactiveDifferenceCents: number
  currentBalanceCents: number
  resultingBalanceCents: number
  stripePlan: {
    mode: string
    prorationBehavior: string
    revertsAfter: string | null
  }
}
