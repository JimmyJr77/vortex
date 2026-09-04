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
  startsAt?: string | null
  endsAt?: string | null
  expiresOn?: string | null
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
  discountRuleSnapshot: Record<string, unknown>
  effectiveFromMonth: string
  effectiveThroughMonth: string | null
  reason: string
  status: 'pending_sync' | 'active' | 'sync_failed' | 'revoked'
  stripeSyncError: string | null
  createdAt: string
}

export interface CustomerBillingEnrollment {
  id: number
  classCatalogId: number | null
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
  activePriceAdjustments: PriceAdjustment[]
  priceAdjustments: PriceAdjustment[]
  nextBillDate: string | null
  priceSyncStatus: string
  priceSyncError: string | null
  collectionMode?: 'not_applicable' | 'household_monthly' | 'household_payment_method_required' | 'legacy_stripe_subscription' | 'autopay_setup_required'
  stripeSubscriptionScheduleId: string | null
  pricingMonth: string
}

export interface CustomerBillingAnnualMembership {
  memberId: number
  memberName: string
  billingSubscriptionId: number | null
  active: boolean
  membershipDate: string | null
  renewalDate: string | null
  lifetimeMember: boolean
  autoRenewal: boolean
  canManageAutoRenewal: boolean
  outstandingChargeId: number | null
  outstandingAmountCents: number
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
  activePriceAdjustments: PriceAdjustment[]
  scheduledPriceAdjustments: PriceAdjustment[]
  pricingMonth: string
}

export interface CustomerBillingBundlePass {
  id: number
  memberId: number
  memberName: string | null
  programsId: number
  packageId: string
  packageLabel: string | null
  classCountPurchased: number
  classesRemaining: number
  priceCents: number
  status: string
  expiresAt: string | null
  purchasedAt: string | null
}

export interface CustomerBillingBundleUsage {
  id: number
  memberPassId: number
  signupId: number | null
  memberId: number | null
  memberName: string | null
  programsId: number
  entryType: string
  classesUsed: number
  creditDelta: number | null
  classesRemainingAfter: number
  reason: string | null
  packageLabel: string | null
  createdAt: string
}

export interface CustomerBillingOverview {
  revision: string | null
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
    householdMonthlyBillingEnabled: boolean
    isActive: boolean
    accountStatus: 'active' | 'inactive'
  }
  selectedMemberId: number | null
  members: CustomerBillingMember[]
  summary: {
    chargesCents: number
    paymentsCents: number
    refundsCents: number
    balanceCents: number
    collectibleBalanceCents: number
    outstandingBalanceCents: number
    monthlyRecurringCents: number
    monthlyRecurringDiscountCents: number
    monthlyRecurringPeriod: string
    futureCreditsCents: number
    paidThisMonthCents: number
    monthlyTotals: { grossCents: number; discountCents: number; netCents: number }
    monthlyLedgerBill: null | {
      billingMonth: string
      totalCents: number
      paidCents: number
      remainingCents: number
      status: 'paid' | 'partially_paid' | 'unpaid'
      lineCount: number
      lines: Array<{ id: number; memberName: string | null; description: string; lineType: string; amountCents: number }>
    }
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
  annualMemberships: CustomerBillingAnnualMembership[]
  monthlyInvoices: Array<{
    id: number
    billingMonth: string
    status: string
    subtotalCents: number
    creditCents: number
    totalCents: number
    postPaymentCreditCents: number
    stripeInvoiceId: string | null
    hostedInvoiceUrl: string | null
    paymentAttemptedAt: string | null
    automaticAttemptCount: number
    lastAutomaticAttemptAt: string | null
    paidAt: string | null
    failureMessage: string | null
    lineCount: number
    lines: Array<{ id: number; memberName: string | null; description: string; lineType: string; amountCents: number }>
  }>
  bundlePasses: CustomerBillingBundlePass[]
  bundleUsage: CustomerBillingBundleUsage[]
  subscriptions: CustomerBillingSubscription[]
  adjustments: PriceAdjustment[]
}

export interface BillingTransaction {
  entryKind: 'charge' | 'drop_in' | 'payment' | 'refund'
  entryType: string
  refId: number
  memberId: number | null
  memberName: string | null
  description: string
  billingMonths: string[]
  amountCents: number
  originalAmountCents?: number
  effectiveAmountCents?: number
  classCatalogId?: number | null
  classSchedule?: string | null
  transferTag?: 'X-in' | 'X-out' | null
  discountAnnotations?: Array<{ kind: 'automatic' | 'coupon' | 'manual'; label: string; amountCents: number; code?: string | null }>
  occurredAt: string
  status: string
  runningBalanceCents: number
  appliedAmountCents: number
  remainingAmountCents: number
  applications: Array<Record<string, unknown>>
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
  promoRule: Record<string, unknown> | null
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
    discountComponents: BillingDiscountComponent[]
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
