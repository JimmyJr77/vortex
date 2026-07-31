import { resolveProgramsSchema } from '../programs/schema.js'
import { ensureStripeOperationsSchema } from './stripeOperations.js'

function number(value) {
  return Number(value ?? 0) || 0
}

/** Settled Stripe payments and the active/current registrations attached to each payer family. */
export async function buildPaymentRegistrationReport(pool, { days = 30 } = {}) {
  const lookbackDays = Math.min(365, Math.max(1, Math.round(Number(days) || 30)))
  await ensureStripeOperationsSchema(pool)
  const schema = await resolveProgramsSchema(pool)
  const paymentsResult = await pool.query(
    `
      SELECT
        bp.id,
        bp.family_billing_account_id,
        fba.family_id,
        bp.amount_cents,
        bp.paid_at,
        bp.method,
        bp.external_status,
        bp.stripe_payment_intent_id,
        bp.stripe_checkout_session_id,
        bp.stripe_invoice_id,
        COALESCE(NULLIF(TRIM(fba.billing_email), ''), NULLIF(TRIM(payer.email), '')) AS payer_email,
        NULLIF(TRIM(CONCAT_WS(' ', payer.first_name, payer.last_name)), '') AS payer_name
      FROM billing_payment bp
      JOIN family_billing_account fba ON fba.id = bp.family_billing_account_id
      LEFT JOIN member payer ON payer.id = fba.payer_member_id
      WHERE bp.external_processor = 'stripe'
        AND bp.external_status = 'settled'
        AND bp.paid_at >= now() - ($1::int * interval '1 day')
      ORDER BY bp.paid_at DESC, bp.id DESC
    `,
    [lookbackDays],
  )

  const familyIds = [...new Set(paymentsResult.rows.map((row) => Number(row.family_id)).filter(Number.isFinite))]
  const registrationsResult = familyIds.length
    ? await pool.query(
        `
          SELECT
            s.id,
            m.family_id,
            s.member_id,
            NULLIF(TRIM(CONCAT_WS(' ', m.first_name, m.last_name)), '') AS member_name,
            COALESCE(NULLIF(TRIM(p.display_name), ''), NULLIF(TRIM(sf.title), ''), 'Class') AS class_name,
            COALESCE(NULLIF(TRIM(pr.display_name), ''), NULLIF(TRIM(pr.name), '')) AS program_name,
            s.status,
            s.created_at AS registered_at,
            ts.schedule_mode,
            ts.specific_date,
            ts.day_of_week,
            ts.start_time,
            ts.end_time,
            COALESCE(ch.gross_cents, 0)::int AS gross_cents,
            COALESCE(ch.discount_cents, 0)::int AS discount_cents,
            COALESCE(ch.net_cents, 0)::int AS net_cents,
            COALESCE(sub.monthly_cents, 0)::int AS recurring_monthly_cents
          FROM scheduling_signup s
          JOIN member m ON m.id = s.member_id
          JOIN scheduling_form sf ON sf.id = s.form_id
          LEFT JOIN program p ON p.id = sf.program_id
          LEFT JOIN ${schema.programsTable} pr ON pr.id = COALESCE(sf.programs_id, p.${schema.programFkColumn})
          LEFT JOIN scheduling_time_slot ts ON ts.id = s.time_slot_id
          LEFT JOIN LATERAL (
            SELECT
              COALESCE(SUM(c.gross_amount_cents), SUM(c.amount_cents), 0)::int AS gross_cents,
              COALESCE(SUM(c.discount_amount_cents), 0)::int AS discount_cents,
              COALESCE(SUM(c.amount_cents), 0)::int AS net_cents
            FROM billing_charge c
            WHERE c.source_type = 'scheduling_signup' AND c.source_id = s.id::text
          ) ch ON TRUE
          LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(bs.net_monthly_cents), 0)::int AS monthly_cents
            FROM billing_subscription bs
            WHERE bs.source_type = 'scheduling_signup'
              AND bs.source_id = s.id::text
              AND bs.status IN ('active', 'paused')
          ) sub ON TRUE
          WHERE m.family_id = ANY($1::bigint[])
            AND s.orphaned_at IS NULL
            AND s.archived_at IS NULL
            AND s.status IN ('confirmed', 'paused', 'waitlisted')
          ORDER BY m.family_id, s.created_at DESC, s.id DESC
        `,
        [familyIds],
      )
    : { rows: [] }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const registrationsByFamily = new Map()
  for (const row of registrationsResult.rows) {
    const time = row.start_time
      ? `${String(row.start_time).slice(0, 5)}${row.end_time ? `–${String(row.end_time).slice(0, 5)}` : ''}`
      : null
    const date = row.schedule_mode === 'date' && row.specific_date
      ? String(row.specific_date).slice(0, 10)
      : row.day_of_week != null ? dayNames[Number(row.day_of_week)] : null
    const registration = {
      id: Number(row.id),
      memberId: row.member_id == null ? null : Number(row.member_id),
      memberName: row.member_name || 'Unnamed athlete',
      className: row.class_name,
      programName: row.program_name || null,
      status: row.status,
      registeredAt: row.registered_at,
      schedule: [date, time].filter(Boolean).join(' · ') || null,
      grossCents: number(row.gross_cents),
      discountCents: number(row.discount_cents),
      netCents: number(row.net_cents),
      recurringMonthlyCents: number(row.recurring_monthly_cents),
    }
    const familyId = Number(row.family_id)
    if (!registrationsByFamily.has(familyId)) registrationsByFamily.set(familyId, [])
    registrationsByFamily.get(familyId).push(registration)
  }

  const payments = paymentsResult.rows.map((row) => ({
    id: Number(row.id),
    familyId: Number(row.family_id),
    familyBillingAccountId: Number(row.family_billing_account_id),
    payerName: row.payer_name || 'Unknown payer',
    payerEmail: row.payer_email || null,
    amountCents: number(row.amount_cents),
    paidAt: row.paid_at,
    method: row.method || null,
    externalStatus: row.external_status,
    stripePaymentIntentId: row.stripe_payment_intent_id || null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id || null,
    stripeInvoiceId: row.stripe_invoice_id || null,
    registrations: registrationsByFamily.get(Number(row.family_id)) || [],
  }))

  const failuresResult = await pool.query(
    `
      SELECT a.id, a.family_billing_account_id, fba.family_id, a.alert_type, a.severity,
             a.stripe_object_id, a.message, a.details, a.created_at,
             COALESCE(NULLIF(TRIM(fba.billing_email), ''), NULLIF(TRIM(payer.email), '')) AS payer_email,
             NULLIF(TRIM(CONCAT_WS(' ', payer.first_name, payer.last_name)), '') AS payer_name
      FROM stripe_billing_alert a
      LEFT JOIN family_billing_account fba ON fba.id = a.family_billing_account_id
      LEFT JOIN member payer ON payer.id = fba.payer_member_id
      WHERE a.alert_type IN ('payment_failed', 'payment_recovery_exhausted')
        AND a.created_at >= now() - ($1::int * interval '1 day')
      ORDER BY a.created_at DESC, a.id DESC
    `,
    [lookbackDays],
  )

  const failures = failuresResult.rows.map((row) => ({
    id: Number(row.id),
    familyId: row.family_id == null ? null : Number(row.family_id),
    familyBillingAccountId: row.family_billing_account_id == null ? null : Number(row.family_billing_account_id),
    payerName: row.payer_name || 'Unknown payer',
    payerEmail: row.payer_email || null,
    alertType: row.alert_type,
    severity: row.severity,
    stripeObjectId: row.stripe_object_id || null,
    message: row.message,
    details: row.details || {},
    createdAt: row.created_at,
    registrations: row.family_id == null ? [] : registrationsByFamily.get(Number(row.family_id)) || [],
  }))

  return {
    days: lookbackDays,
    startDate: new Date(Date.now() - lookbackDays * 86400000).toISOString(),
    endDate: new Date().toISOString(),
    paymentCount: payments.length,
    totalBilledCents: payments.reduce((sum, payment) => sum + payment.amountCents, 0),
    payments,
    failureCount: failures.length,
    failures,
  }
}
