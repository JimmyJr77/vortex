import { verifyCanonicalBillingAccount } from './canonicalBillingMigration.js'
import { recordBillingCycleVerificationEvidence } from './billingLegacyRetirement.js'

const LINE_PARITY_ISSUES = new Set([
  'household_invoice_line_mismatch',
  'household_invoice_total_mismatch',
  'remote_household_invoice_amount_mismatch',
  'remote_household_invoice_extra_item',
  'remote_household_invoice_duplicate_item',
  'remote_household_invoice_item_amount_mismatch',
  'remote_household_invoice_item_charge_mismatch',
  'remote_household_invoice_item_link_mismatch',
  'remote_household_invoice_item_missing',
])

export function billingCycleEvidenceFromCanonicalVerification(verification) {
  const snapshot = verification?.snapshot ?? {}
  const invoices = Array.isArray(snapshot.targetInvoices) ? snapshot.targetInvoices : []
  const collectorInventory = snapshot.collectorInventory ?? {}
  const issues = Array.isArray(verification?.issues) ? verification.issues : []
  const activeRemoteLegacyCollectors = issues.filter((issue) => issue?.code === 'remote_legacy_subscription_active').length
  const attachedLocalLegacyCollectors = Array.isArray(snapshot.attachedLocalSubscriptionIds)
    ? snapshot.attachedLocalSubscriptionIds.length
    : 0
  const inventoryLegacyCollectors = Number(collectorInventory.legacyCollectorCount ?? 0)
  const legacyCollectorCount = inventoryLegacyCollectors
    + attachedLocalLegacyCollectors
    + activeRemoteLegacyCollectors
  const localInvoiceLineTotalCents = invoices.reduce(
    (total, invoice) => total + Number(invoice.lineTotalCents ?? 0),
    0,
  )
  const localInvoiceLineSubtotalCents = invoices.reduce(
    (total, invoice) => total + Number(invoice.lineSubtotalCents ?? invoice.subtotalCents ?? 0),
    0,
  )
  const localInvoiceLineCreditCents = invoices.reduce(
    (total, invoice) => total + Number(invoice.lineCreditCents ?? 0),
    0,
  )
  const localInvoiceSubtotalCents = invoices.reduce(
    (total, invoice) => total + Number(invoice.subtotalCents ?? 0),
    0,
  )
  const localInvoiceCreditCents = invoices.reduce(
    (total, invoice) => total + Number(invoice.creditCents ?? 0),
    0,
  )
  const localInvoiceTotalCents = invoices.reduce(
    (total, invoice) => total + Number(invoice.totalCents ?? invoice.lineTotalCents ?? 0),
    0,
  )
  const lineParity = localInvoiceLineSubtotalCents === localInvoiceSubtotalCents
    && localInvoiceLineCreditCents === localInvoiceCreditCents
    && localInvoiceLineTotalCents === localInvoiceTotalCents
    && localInvoiceTotalCents === Math.max(0, localInvoiceSubtotalCents - localInvoiceCreditCents)
    && !issues.some((issue) => LINE_PARITY_ISSUES.has(issue?.code))
  return {
    legacyCollectorCount,
    collectorCount: Number(collectorInventory.collectorCount ?? 0)
      + attachedLocalLegacyCollectors
      + activeRemoteLegacyCollectors,
    householdInvoiceCount: invoices.length,
    remoteHouseholdInvoiceCount: Number(collectorInventory.householdInvoiceCount ?? 0),
    unexpectedStripeInvoiceCount: Number(collectorInventory.unexpectedStripeInvoiceCount ?? 0),
    localInvoiceLineTotalCents,
    localInvoiceLineSubtotalCents,
    localInvoiceLineCreditCents,
    localInvoiceSubtotalCents,
    localInvoiceCreditCents,
    localInvoiceTotalCents,
    lineParity,
    issues,
    evidence: snapshot,
  }
}

export async function verifyAndRecordBillingRetirementCycle(pool, {
  migration,
  stripe,
  billingMonth,
  now = new Date(),
  verifierVersion = 'canonical-cycle-v1',
  apply = false,
} = {}) {
  if (!migration || migration.state !== 'verified') {
    throw new Error('Billing-cycle retirement evidence requires a verified account migration.')
  }
  const verification = await verifyCanonicalBillingAccount(pool, {
    migration,
    stripe,
    now,
    billingMonth,
    inspectCollectorInventory: true,
  })
  const structural = billingCycleEvidenceFromCanonicalVerification(verification)
  const result = {
    accountId: Number(migration.family_billing_account_id),
    migrationId: Number(migration.id),
    billingMonth: String(billingMonth).slice(0, 10),
    verified: verification.verified === true,
    structural,
    recorded: false,
    evidenceId: null,
  }
  if (!apply) return result
  let paritySnapshot = migration.parity_snapshot ?? {}
  if (typeof paritySnapshot === 'string') {
    try {
      paritySnapshot = JSON.parse(paritySnapshot)
    } catch {
      paritySnapshot = {}
    }
  }
  const evidence = await recordBillingCycleVerificationEvidence(pool, {
    accountId: result.accountId,
    migrationId: result.migrationId,
    billingMonth: result.billingMonth,
    verification: structural,
    facilityTimezone: paritySnapshot.timezone ?? 'UTC',
    verifiedAt: now,
    verifierVersion,
  })
  return {
    ...result,
    recorded: true,
    evidenceId: evidence?.id == null ? null : Number(evidence.id),
    status: evidence?.status ?? (verification.verified ? 'verified' : 'failed'),
  }
}
