import { recordAndApplyHouseholdMonthlyInvoicePayment } from './householdMonthlyInvoice.js'
import {
  invoiceSubscriptionId,
  recordPaidStripeInvoice,
  StripeInvoiceQuarantineError,
} from './stripeWebhookLifecycle.js'
import {
  classifyLegacyStripeSubscriptionOwnership,
  resolvePaidLegacyStripeSubscriptionOwnership,
} from './stripeSubscriptionOwnership.js'
import { recordStripeBillingAlert } from './stripeOperations.js'

function objectId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

function householdInvoiceMarkers(invoice) {
  return {
    marked: String(invoice?.metadata?.householdMonthlyInvoice ?? '') === 'true'
      || String(invoice?.metadata?.monthlyInvoiceId ?? '').trim() !== '',
    monthlyInvoiceId: String(invoice?.metadata?.monthlyInvoiceId ?? '').trim() || null,
    accountId: String(invoice?.metadata?.familyBillingAccountId ?? '').trim() || null,
  }
}

/**
 * One fail-closed classifier shared by webhook and reconciliation paths.  A
 * Stripe invoice is collectable only when it is linked to an immutable local
 * household invoice or affirmatively backed by a Stripe subscription.
 */
export async function classifyStripeInvoicePayment(pool, invoice) {
  const stripeInvoiceId = objectId(invoice)
  const subscriptionId = invoiceSubscriptionId(invoice)
  const markers = householdInvoiceMarkers(invoice)
  const local = stripeInvoiceId
    ? await pool.query(
      `SELECT id, family_billing_account_id
         FROM billing_monthly_invoice
        WHERE stripe_invoice_id = $1
        LIMIT 1`,
      [stripeInvoiceId],
    ).then((result) => result.rows[0] ?? null)
    : null

  if (subscriptionId && (local || markers.marked)) {
    return {
      kind: 'conflict',
      code: 'invoice_collection_classification_conflict',
      reason: `Stripe invoice ${stripeInvoiceId ?? '(missing)'} identifies both household and subscription collection.`,
      localInvoice: local,
      subscriptionId,
    }
  }
  if (local) {
    if (
      (markers.monthlyInvoiceId && markers.monthlyInvoiceId !== String(local.id))
      || (markers.accountId && markers.accountId !== String(local.family_billing_account_id))
    ) {
      return {
        kind: 'conflict',
        code: 'household_invoice_metadata_conflict',
        reason: `Stripe household invoice ${stripeInvoiceId} metadata conflicts with its immutable local owner.`,
        localInvoice: local,
        subscriptionId: null,
      }
    }
    return { kind: 'household', code: null, reason: null, localInvoice: local, subscriptionId: null }
  }
  if (markers.marked) {
    return {
      kind: 'orphan_household',
      code: 'household_invoice_missing',
      reason: `Stripe household invoice ${stripeInvoiceId ?? '(missing)'} has no matching local monthly invoice.`,
      localInvoice: null,
      subscriptionId: null,
    }
  }
  if (subscriptionId) {
    const subscriptionOwnership = await classifyLegacyStripeSubscriptionOwnership(pool, {
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: invoice?.customer,
      metadataAccountId: invoice?.metadata?.familyBillingAccountId ?? null,
    })
    if (!subscriptionOwnership.expectedLegacy) {
      return {
        kind: 'conflict',
        code: subscriptionOwnership.code,
        reason: subscriptionOwnership.reason,
        localInvoice: null,
        subscriptionId,
        subscriptionOwnership,
      }
    }
    return {
      kind: 'subscription',
      code: null,
      reason: null,
      localInvoice: null,
      subscriptionId,
      subscriptionOwnership,
    }
  }
  return {
    kind: 'unclassified',
    code: 'invoice_unclassified',
    reason: `Stripe invoice ${stripeInvoiceId ?? '(missing)'} is not a recognized household or subscription invoice.`,
    localInvoice: null,
    subscriptionId: null,
  }
}

/** Record a paid invoice only after authoritative classification. */
export async function recordAuthoritativeStripeInvoicePayment(pool, {
  invoice,
  stripe,
} = {}) {
  const classification = await classifyStripeInvoicePayment(pool, invoice)
  if (classification.kind === 'household') {
    const settlement = await recordAndApplyHouseholdMonthlyInvoicePayment(pool, { invoice, stripe })
    if (!settlement) {
      return {
        classification: {
          ...classification,
          kind: 'conflict',
          code: 'household_invoice_mapping_lost',
          reason: `Stripe household invoice ${objectId(invoice)} lost its local mapping during settlement.`,
        },
        payment: null,
        householdSettlement: null,
      }
    }
    return { classification, payment: settlement.payment ?? null, householdSettlement: settlement }
  }
  const subscriptionId = invoiceSubscriptionId(invoice)
  const markers = householdInvoiceMarkers(invoice)
  const paidLegacyCandidate = Boolean(
    subscriptionId
    && !classification.localInvoice
    && !markers.marked,
  )
  if (classification.kind === 'subscription' || paidLegacyCandidate) {
    const paidOwnership = await resolvePaidLegacyStripeSubscriptionOwnership(pool, {
      stripe,
      invoice,
    })
    if (!paidOwnership.paidSettlementVerified) {
      return {
        classification: {
          ...classification,
          kind: 'conflict',
          code: paidOwnership.code,
          reason: paidOwnership.reason,
          subscriptionId,
          subscriptionOwnership: paidOwnership,
        },
        payment: null,
        householdSettlement: null,
      }
    }
    const paidClassification = {
      kind: 'subscription',
      code: null,
      reason: null,
      localInvoice: null,
      subscriptionId,
      subscriptionOwnership: paidOwnership,
    }
    let payment = null
    try {
      payment = await recordPaidStripeInvoice(pool, paidOwnership.invoice, {
        stripe,
        expectedLegacySubscriptionOwnership: paidOwnership,
      })
    } catch (error) {
      if (!(error instanceof StripeInvoiceQuarantineError)) throw error
      return {
        classification: {
          ...paidClassification,
          kind: 'conflict',
          code: error.reasonCode,
          reason: error.message,
        },
        payment: null,
        householdSettlement: null,
      }
    }
    if (!payment) {
      return {
        classification: {
          ...paidClassification,
          kind: 'conflict',
          code: 'subscription_invoice_unmapped',
          reason: `Stripe subscription invoice ${objectId(paidOwnership.invoice)} could not be mapped to a canonical billing account.`,
        },
        payment: null,
        householdSettlement: null,
      }
    }
    if (paidOwnership.driftReasons.length > 0) {
      const verifiedInvoice = paidOwnership.invoice
      await recordStripeBillingAlert(pool, {
        event: { id: `paid-legacy-subscription-drift:${verifiedInvoice.id}` },
        // Ownership comes from the exact current subscription link and/or the
        // immutable migration claim, not a mutable Customer or an existing
        // PaymentIntent row. Keep the alert resolver on that same identity.
        object: {
          id: verifiedInvoice.id,
          status: verifiedInvoice.status,
          amount_due: verifiedInvoice.amount_due,
          currency: verifiedInvoice.currency,
          metadata: { familyBillingAccountId: String(paidOwnership.accountId) },
        },
        alertType: 'paid_legacy_subscription_current_authority_drift',
        severity: 'critical',
        message: `Stripe collected legacy subscription ${paidOwnership.subscription.id} after its current collection authority drifted (${paidOwnership.driftReasons.join(', ')}). The exact payment was preserved and future legacy collection requires review.`,
      }).catch(() => {})
    }
    return { classification: paidClassification, payment, householdSettlement: null }
  }
  return { classification, payment: null, householdSettlement: null }
}
