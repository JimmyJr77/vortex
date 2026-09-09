/** Shared accounting predicates. Presentation visibility never decides value. */
export function settledRefundPredicate(alias = 'refund') {
  return `(COALESCE(${alias}.external_status, 'succeeded') = 'succeeded'
    OR (${alias}.external_status = 'reconciliation_required'
      AND ${alias}.stripe_refund_id IS NOT NULL
      AND ${alias}.error_message LIKE '[stripe-refund-ledger-finalization-pending:%'))`
}

// Only a reviewed or explicitly verified reversal group with zero net value may be retired from
// allocation. The rows remain in the immutable financial totals and history.
export function activeLedgerChargePredicate(alias = 'charge') {
  return `COALESCE(${alias}.metadata->>'allocationRetired', 'false') <> 'true'`
}

export function chargeCreditApplicationSql(chargeReference) {
  return `SELECT COALESCE(SUM(credit_application.amount_cents), 0)::bigint AS applied_cents
    FROM billing_charge_credit_application credit_application
    JOIN billing_monthly_invoice_line target_line ON target_line.id = credit_application.target_invoice_line_id
    JOIN billing_monthly_invoice_line credit_line ON credit_line.id = credit_application.credit_invoice_line_id
    JOIN billing_charge credit_source ON credit_source.id = credit_line.billing_charge_id
    WHERE target_line.billing_charge_id = ${chargeReference}
      AND ${activeLedgerChargePredicate('credit_source')}
      AND NOT (credit_source.related_charge_id IS NOT DISTINCT FROM ${chargeReference}
        AND credit_source.source_type IN ('charge_adjustment', 'refund_offset'))`
}
