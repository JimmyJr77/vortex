function numberOrNull(value) {
  return value == null || !Number.isFinite(Number(value)) ? null : Number(value)
}

function memberDiscountComponent(component = {}) {
  return {
    name: component.name ?? 'Discount',
    amountCents: Number(component.amountCents ?? 0),
    source: component.source ?? null,
    amountType: component.amountType ?? null,
    amountValue: component.amountValue == null ? null : Number(component.amountValue),
    promoCode: component.promoCode ?? null,
    expiresOn: component.expiresOn ?? null,
    qualifiedLabel: component.qualifiedLabel ?? null,
    qualifiedClassCount: component.qualifiedClassCount == null
      ? null
      : Number(component.qualifiedClassCount),
    qualifyingSubtotalCents: component.qualifyingSubtotalCents == null
      ? null
      : Number(component.qualifyingSubtotalCents),
  }
}

function memberEnrollment(enrollment = {}) {
  return {
    id: Number(enrollment.id),
    classCatalogId: numberOrNull(enrollment.classCatalogId ?? enrollment.class_catalog_id),
    source: enrollment.source ?? 'signup',
    memberId: Number(enrollment.memberId),
    memberName: enrollment.memberName ?? null,
    sport_name: enrollment.sport_name ?? null,
    program_name: enrollment.program_name ?? null,
    class_name: enrollment.class_name ?? null,
    offering_dates: enrollment.offering_dates ?? null,
    enrollment_start_date: enrollment.enrollment_start_date ?? null,
    created_at: enrollment.created_at ?? null,
    schedule: enrollment.schedule ?? null,
    status: enrollment.status ?? 'unknown',
    billing_status: enrollment.billing_status ?? null,
    billingType: enrollment.billingType ?? enrollment.billing_type ?? null,
    classCostCents: Number(enrollment.classCostCents ?? 0),
    automaticDiscountCents: Number(enrollment.automaticDiscountCents ?? 0),
    automaticDiscountComponents: Array.isArray(enrollment.automaticDiscountComponents)
      ? enrollment.automaticDiscountComponents.map(memberDiscountComponent)
      : [],
    automaticAdjustedCostCents: Number(enrollment.automaticAdjustedCostCents ?? 0),
    manualAdjustmentCents: Number(enrollment.manualAdjustmentCents ?? 0),
    adjustedCostCents: Number(enrollment.adjustedCostCents ?? 0),
    nextBillDate: enrollment.nextBillDate ?? null,
    priceSyncStatus: enrollment.priceSyncStatus ?? 'not_required',
    collectionMode: enrollment.collectionMode ?? null,
    pricingMonth: enrollment.pricingMonth ?? null,
  }
}

function memberAnnualMembership(membership = {}) {
  return {
    memberId: Number(membership.memberId),
    memberName: membership.memberName ?? null,
    billingSubscriptionId: numberOrNull(membership.billingSubscriptionId),
    active: membership.active === true,
    membershipDate: membership.membershipDate ?? null,
    renewalDate: membership.renewalDate ?? null,
    autoRenewal: membership.autoRenewal === true,
    canManageAutoRenewal: membership.canManageAutoRenewal === true,
    outstandingAmountCents: Number(membership.outstandingAmountCents ?? 0),
  }
}

function memberBundlePass(pass = {}) {
  return {
    id: Number(pass.id),
    memberId: Number(pass.memberId),
    memberName: pass.memberName ?? null,
    packageLabel: pass.packageLabel ?? null,
    classCountPurchased: Number(pass.classCountPurchased ?? 0),
    classesRemaining: Number(pass.classesRemaining ?? 0),
    status: pass.status ?? 'active',
    expiresAt: pass.expiresAt ?? null,
    purchasedAt: pass.purchasedAt ?? null,
  }
}

function memberBundleUsage(usage = {}) {
  return {
    id: Number(usage.id),
    memberId: numberOrNull(usage.memberId),
    memberName: usage.memberName ?? null,
    entryType: usage.entryType ?? 'use',
    creditDelta: usage.creditDelta == null ? null : Number(usage.creditDelta),
    classesRemainingAfter: Number(usage.classesRemainingAfter ?? 0),
    reason: usage.reason ?? null,
    packageLabel: usage.packageLabel ?? null,
    createdAt: usage.createdAt ?? null,
  }
}

function memberMonthlyInvoice(invoice = {}, { includeHostedInvoiceUrl = false } = {}) {
  return {
    id: Number(invoice.id),
    billingMonth: invoice.billingMonth ?? null,
    status: invoice.status ?? 'unknown',
    subtotalCents: Number(invoice.subtotalCents ?? 0),
    creditCents: Number(invoice.creditCents ?? 0),
    totalCents: Number(invoice.totalCents ?? 0),
    postPaymentCreditCents: Number(invoice.postPaymentCreditCents ?? 0),
    automaticAttemptCount: Number(invoice.automaticAttemptCount ?? 0),
    lastAutomaticAttemptAt: invoice.lastAutomaticAttemptAt ?? null,
    paidAt: invoice.paidAt ?? null,
    lineCount: Number(invoice.lineCount ?? 0),
    hostedInvoiceUrl: includeHostedInvoiceUrl && typeof invoice.hostedInvoiceUrl === 'string'
      ? invoice.hostedInvoiceUrl
      : null,
    lines: Array.isArray(invoice.lines)
      ? invoice.lines.map((line) => ({
          id: Number(line.id),
          memberName: line.memberName ?? null,
          description: line.description ?? '',
          lineType: line.lineType ?? 'charge',
          amountCents: Number(line.amountCents ?? 0),
        }))
      : [],
  }
}

function memberMonthlyLedgerBill(bill = null) {
  if (!bill || typeof bill !== 'object') return null
  return {
    billingMonth: bill.billingMonth ?? null,
    totalCents: Number(bill.totalCents ?? 0),
    paidCents: Number(bill.paidCents ?? 0),
    remainingCents: Number(bill.remainingCents ?? 0),
    status: bill.status ?? 'unpaid',
    lineCount: Number(bill.lineCount ?? 0),
    lines: Array.isArray(bill.lines)
      ? bill.lines.map((line) => ({
          id: Number(line.id),
          memberName: line.memberName ?? null,
          description: line.description ?? '',
          lineType: line.lineType ?? 'charge',
          amountCents: Number(line.amountCents ?? 0),
        }))
      : [],
  }
}

/**
 * Explicit member-facing allowlist. The admin overview intentionally contains
 * provider identifiers, adjustment audit snapshots, sync diagnostics, and
 * actor ids that must never drift into the member portal response.
 */
export function buildMemberBillingOverviewDto(overview = {}, { canManagePayments = false } = {}) {
  const account = overview.account ?? {}
  const paymentMethod = overview.paymentMethod?.paymentMethod ?? null
  const summary = overview.summary ?? {}
  return {
    revision: overview.revision ?? null,
    account: {
      id: Number(account.id),
      familyId: Number(account.familyId),
      familyName: account.familyName ?? null,
      payerMemberId: numberOrNull(account.payerMemberId),
      billingEmail: account.billingEmail ?? null,
      billingPhone: account.billingPhone ?? null,
      billingStreet: account.billingStreet ?? null,
      billingCity: account.billingCity ?? null,
      billingState: account.billingState ?? null,
      billingZip: account.billingZip ?? null,
      householdMonthlyBillingEnabled: account.householdMonthlyBillingEnabled === true,
      isActive: account.isActive !== false,
    },
    selectedMemberId: numberOrNull(overview.selectedMemberId),
    members: Array.isArray(overview.members)
      ? overview.members.map((member) => ({
          id: Number(member.id),
          firstName: member.firstName ?? null,
          lastName: member.lastName ?? null,
          name: member.name ?? null,
          email: null,
          phone: null,
          isActive: member.isActive !== false,
        }))
      : [],
    summary: {
      chargesCents: Number(summary.chargesCents ?? 0),
      paymentsCents: Number(summary.paymentsCents ?? 0),
      refundsCents: Number(summary.refundsCents ?? 0),
      balanceCents: Number(summary.balanceCents ?? 0),
      collectibleBalanceCents: Number(summary.collectibleBalanceCents ?? 0),
      outstandingBalanceCents: Number(summary.outstandingBalanceCents ?? 0),
      monthlyRecurringCents: Number(summary.monthlyRecurringCents ?? 0),
      monthlyRecurringDiscountCents: Number(summary.monthlyRecurringDiscountCents ?? 0),
      monthlyRecurringPeriod: summary.monthlyRecurringPeriod ?? null,
      futureCreditsCents: Number(summary.futureCreditsCents ?? 0),
      paidThisMonthCents: Number(summary.paidThisMonthCents ?? 0),
      monthlyTotals: {
        grossCents: Number(summary.monthlyTotals?.grossCents ?? 0),
        discountCents: Number(summary.monthlyTotals?.discountCents ?? 0),
        netCents: Number(summary.monthlyTotals?.netCents ?? 0),
      },
      monthlyLedgerBill: memberMonthlyLedgerBill(summary.monthlyLedgerBill),
      nextBillDate: summary.nextBillDate ?? null,
      latestPayment: summary.latestPayment
        ? {
            amountCents: Number(summary.latestPayment.amountCents ?? 0),
            paidAt: summary.latestPayment.paidAt ?? null,
            method: summary.latestPayment.method ?? null,
          }
        : null,
    },
    paymentMethod: {
      available: overview.paymentMethod?.available === true,
      stripeEnabled: overview.paymentMethod?.stripeEnabled === true,
      paymentMethod: paymentMethod
        ? {
            brand: paymentMethod.brand ?? 'card',
            last4: paymentMethod.last4 ?? null,
            expMonth: numberOrNull(paymentMethod.expMonth),
            expYear: numberOrNull(paymentMethod.expYear),
          }
        : null,
    },
    alerts: [],
    enrollments: Array.isArray(overview.enrollments) ? overview.enrollments.map(memberEnrollment) : [],
    waitlists: Array.isArray(overview.waitlists) ? overview.waitlists.map(memberEnrollment) : [],
    annualMemberships: Array.isArray(overview.annualMemberships)
      ? overview.annualMemberships.map(memberAnnualMembership)
      : [],
    monthlyInvoices: Array.isArray(overview.monthlyInvoices)
      ? overview.monthlyInvoices.map((invoice) => memberMonthlyInvoice(invoice, {
          includeHostedInvoiceUrl: canManagePayments === true,
        }))
      : [],
    bundlePasses: Array.isArray(overview.bundlePasses)
      ? overview.bundlePasses.map(memberBundlePass)
      : [],
    bundleUsage: Array.isArray(overview.bundleUsage)
      ? overview.bundleUsage.map(memberBundleUsage)
      : [],
    subscriptions: [],
    adjustments: [],
    statements: [],
  }
}
