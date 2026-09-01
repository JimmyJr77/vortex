import {
  billingMigrationSnapshotHash,
  sanitizeBillingMigrationSnapshot,
} from './canonicalBillingMigrationState.js'

const SAFE_ROUTE_KEY = /^[a-z0-9_]{1,100}$/
const SAFE_EVIDENCE_LABEL = /^[A-Za-z0-9_.:-]{1,100}$/

export const LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS = 30
export const LEGACY_RETIREMENT_MIN_BILLING_CYCLES = 2

/**
 * Static route contracts are intentionally kept here instead of deriving keys
 * from req.path. This prevents family/member/account ids or other request data
 * from entering either structured logs or the aggregate telemetry table.
 */
export const LEGACY_BILLING_ENDPOINTS = Object.freeze([
  {
    method: 'GET',
    pattern: /^\/api\/admin\/billing\/family-lookup\/?$/,
    routeKey: 'admin_family_lookup',
    replacement: { method: 'GET', path: '/api/admin/customer-billing/search' },
  },
  {
    method: 'GET',
    pattern: /^\/api\/admin\/families\/[^/]+\/billing-account\/?$/,
    routeKey: 'admin_family_billing_account_read',
    replacement: { method: 'GET', path: '/api/admin/customer-billing/families/:familyId/overview' },
  },
  {
    method: 'PUT',
    pattern: /^\/api\/admin\/families\/[^/]+\/billing-account\/?$/,
    routeKey: 'admin_family_billing_account_write',
    replacement: { method: 'PATCH', path: '/api/admin/customer-billing/families/:familyId/account' },
  },
  {
    method: 'POST',
    pattern: /^\/api\/admin\/families\/[^/]+\/charges\/?$/,
    routeKey: 'admin_family_charge_create',
    replacement: { method: 'POST', path: '/api/admin/customer-billing/families/:familyId/custom-charges' },
  },
  {
    method: 'GET',
    pattern: /^\/api\/admin\/families\/[^/]+\/charges\/?$/,
    routeKey: 'admin_family_charges_read',
    replacement: { method: 'GET', path: '/api/admin/customer-billing/families/:familyId/transactions' },
  },
  {
    method: 'GET',
    pattern: /^\/api\/admin\/families\/[^/]+\/payments\/?$/,
    routeKey: 'admin_family_payments_read',
    replacement: { method: 'GET', path: '/api/admin/customer-billing/families/:familyId/transactions' },
  },
  {
    method: 'POST',
    pattern: /^\/api\/admin\/families\/[^/]+\/payments\/?$/,
    routeKey: 'admin_family_payment_create',
    replacement: { method: 'POST', path: '/api/admin/customer-billing/families/:familyId/payments' },
  },
  {
    method: 'GET',
    pattern: /^\/api\/admin\/families\/[^/]+\/billing-actions\/?$/,
    routeKey: 'admin_family_billing_actions_read',
    replacement: { method: 'GET', path: '/api/admin/customer-billing/families/:familyId/activity' },
  },
  {
    method: 'POST',
    pattern: /^\/api\/admin\/families\/[^/]+\/payment-link\/?$/,
    routeKey: 'admin_family_payment_link_create',
    replacement: { method: 'POST', path: '/api/admin/customer-billing/families/:familyId/process-outstanding-balance' },
  },
  {
    method: 'POST',
    pattern: /^\/api\/admin\/families\/[^/]+\/payments\/[^/]+\/resend-receipt\/?$/,
    routeKey: 'admin_payment_receipt_resend',
    replacement: { method: 'POST', path: '/api/admin/customer-billing/families/:familyId/payments/:paymentId/resend-receipt' },
  },
  {
    method: 'POST',
    pattern: /^\/api\/admin\/families\/[^/]+\/refunds\/[^/]+\/resend-receipt\/?$/,
    routeKey: 'admin_refund_receipt_resend',
    replacement: { method: 'POST', path: '/api/admin/customer-billing/families/:familyId/refunds/:refundId/resend-receipt' },
  },
  {
    method: 'POST',
    pattern: /^\/api\/admin\/families\/[^/]+\/refunds\/?$/,
    routeKey: 'admin_family_refund_create',
    replacement: { method: 'POST', path: '/api/admin/customer-billing/families/:familyId/refunds' },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/admin\/subscriptions\/[^/]+\/status\/?$/,
    routeKey: 'admin_subscription_status_write',
    replacement: {
      method: 'POST',
      path: '/api/admin/customer-billing/enrollments/:signupId/cancellation',
      note: 'Enrollment lifecycle operations are authoritative; direct subscription status writes are retired.',
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/admin\/members\/[^/]+\/passes\/[^/]+\/adjust\/?$/,
    routeKey: 'admin_pass_adjustment_create',
    replacement: { method: 'POST', path: '/api/admin/entitlements/multi-class-passes/:passId/adjustments' },
  },
  {
    method: 'POST',
    pattern: /^\/api\/admin\/families\/[^/]+\/statements\/?$/,
    routeKey: 'admin_statement_create',
    replacement: {
      method: 'GET',
      path: '/api/admin/customer-billing/families/:familyId/transactions',
      note: 'Legacy statements are retained as read-only history; new statements are not created.',
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/admin\/statements\/[^/]+\/status\/?$/,
    routeKey: 'admin_statement_status_write',
    replacement: {
      method: 'GET',
      path: '/api/admin/customer-billing/families/:familyId/transactions',
      note: 'Legacy statements are retained as read-only history.',
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/members\/billing\/account\/?$/,
    routeKey: 'member_billing_account_read',
    replacement: { method: 'GET', path: '/api/members/billing/customer-account' },
  },
  {
    method: 'POST',
    pattern: /^\/api\/members\/billing\/checkout-session\/?$/,
    routeKey: 'member_billing_checkout_alias',
    replacement: { method: 'POST', path: '/api/members/billing/payments/checkout' },
  },
  {
    method: 'POST',
    pattern: /^\/api\/members\/billing\/customer-portal\/?$/,
    routeKey: 'member_billing_portal_alias',
    replacement: { method: 'POST', path: '/api/members/billing/payment-method-session' },
  },
])

export function legacyBillingEndpointsMode(environment = process.env) {
  const value = String(environment.BILLING_LEGACY_ENDPOINTS_MODE ?? 'enabled').trim().toLowerCase()
  if (!['enabled', 'gone'].includes(value)) {
    throw new Error('BILLING_LEGACY_ENDPOINTS_MODE must be enabled or gone.')
  }
  return value
}

export function resolveLegacyBillingEndpoint(method, path) {
  const normalizedMethod = String(method ?? '').toUpperCase()
  const normalizedPath = String(path ?? '').split('?')[0]
  return LEGACY_BILLING_ENDPOINTS.find((entry) => (
    entry.method === normalizedMethod && entry.pattern.test(normalizedPath)
  )) ?? null
}

export async function recordLegacyBillingEndpointTraffic(pool, {
  routeKey,
  method,
  observedAt = new Date(),
}) {
  if (!SAFE_ROUTE_KEY.test(String(routeKey ?? ''))) throw new Error('Legacy billing route key is invalid.')
  const normalizedMethod = String(method ?? '').toUpperCase()
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
    throw new Error('Legacy billing HTTP method is invalid.')
  }
  const timestamp = observedAt instanceof Date ? observedAt : new Date(observedAt)
  if (Number.isNaN(timestamp.getTime())) throw new Error('Legacy billing observation timestamp is invalid.')

  await pool.query(
    `WITH recorded_traffic AS (
       INSERT INTO billing_legacy_endpoint_traffic (
       route_key, http_method, observed_on, request_count, first_seen_at, last_seen_at
       )
       VALUES ($1, $2, ($3::timestamptz AT TIME ZONE 'UTC')::date, 1, $3::timestamptz, $3::timestamptz)
       ON CONFLICT (route_key, http_method, observed_on)
       DO UPDATE SET
         request_count = billing_legacy_endpoint_traffic.request_count + 1,
         first_seen_at = LEAST(billing_legacy_endpoint_traffic.first_seen_at, EXCLUDED.first_seen_at),
         last_seen_at = GREATEST(billing_legacy_endpoint_traffic.last_seen_at, EXCLUDED.last_seen_at)
       RETURNING observed_on
     )
     INSERT INTO billing_legacy_telemetry_heartbeat (
       observed_on, status, successful_check_count, error_count,
       expected_route_count, first_checked_at, last_checked_at, checker_version
     )
     SELECT observed_on, 'healthy', 1, 0, $4, $3::timestamptz, $3::timestamptz,
            'request-telemetry-v1'
       FROM recorded_traffic
     ON CONFLICT (observed_on)
     DO UPDATE SET
       successful_check_count = billing_legacy_telemetry_heartbeat.successful_check_count + 1,
       expected_route_count = EXCLUDED.expected_route_count,
       first_checked_at = LEAST(billing_legacy_telemetry_heartbeat.first_checked_at, EXCLUDED.first_checked_at),
       last_checked_at = GREATEST(billing_legacy_telemetry_heartbeat.last_checked_at, EXCLUDED.last_checked_at),
       checker_version = EXCLUDED.checker_version,
       status = CASE
         WHEN billing_legacy_telemetry_heartbeat.error_count > 0 THEN 'error'
         ELSE 'healthy'
       END,
       updated_at = now()`,
    [routeKey, normalizedMethod, timestamp.toISOString(), LEGACY_BILLING_ENDPOINTS.length],
  )
}

export async function recordLegacyBillingTelemetryHeartbeat(pool, {
  status = 'healthy',
  observedAt = new Date(),
  errorCode = null,
  checkerVersion = 'scheduled-canary-v1',
  expectedRouteCount = LEGACY_BILLING_ENDPOINTS.length,
} = {}) {
  if (!['healthy', 'error'].includes(status)) throw new Error('Legacy billing telemetry heartbeat status is invalid.')
  const timestamp = observedAt instanceof Date ? observedAt : new Date(observedAt)
  if (Number.isNaN(timestamp.getTime())) throw new Error('Legacy billing heartbeat timestamp is invalid.')
  const routeCount = Number(expectedRouteCount)
  if (!Number.isSafeInteger(routeCount) || routeCount < 1) {
    throw new Error('Legacy billing heartbeat expected route count is invalid.')
  }
  const version = String(checkerVersion ?? '').trim()
  if (!SAFE_EVIDENCE_LABEL.test(version)) throw new Error('Legacy billing heartbeat checker version is invalid.')
  const normalizedError = errorCode == null ? null : String(errorCode).slice(0, 80)
  if (status === 'error' && !SAFE_EVIDENCE_LABEL.test(normalizedError ?? '')) {
    throw new Error('Legacy billing heartbeat error code is invalid.')
  }
  if (status === 'healthy' && normalizedError != null) {
    throw new Error('A healthy legacy billing heartbeat cannot contain an error code.')
  }

  const result = await pool.query(
    `INSERT INTO billing_legacy_telemetry_heartbeat (
       observed_on, status, successful_check_count, error_count,
       expected_route_count, first_checked_at, last_checked_at,
       last_error_code, checker_version
     ) VALUES (
       ($1::timestamptz AT TIME ZONE 'UTC')::date,
       $2,
       CASE WHEN $2 = 'healthy' THEN 1 ELSE 0 END,
       CASE WHEN $2 = 'error' THEN 1 ELSE 0 END,
       $3,
       $1::timestamptz,
       $1::timestamptz,
       $4,
       $5
     )
     ON CONFLICT (observed_on)
     DO UPDATE SET
       successful_check_count = billing_legacy_telemetry_heartbeat.successful_check_count
         + CASE WHEN EXCLUDED.status = 'healthy' THEN 1 ELSE 0 END,
       error_count = billing_legacy_telemetry_heartbeat.error_count
         + CASE WHEN EXCLUDED.status = 'error' THEN 1 ELSE 0 END,
       expected_route_count = EXCLUDED.expected_route_count,
       first_checked_at = LEAST(billing_legacy_telemetry_heartbeat.first_checked_at, EXCLUDED.first_checked_at),
       last_checked_at = GREATEST(billing_legacy_telemetry_heartbeat.last_checked_at, EXCLUDED.last_checked_at),
       last_error_code = CASE
         WHEN EXCLUDED.status = 'error' THEN EXCLUDED.last_error_code
         ELSE billing_legacy_telemetry_heartbeat.last_error_code
       END,
       checker_version = EXCLUDED.checker_version,
       status = CASE
         WHEN billing_legacy_telemetry_heartbeat.error_count
              + CASE WHEN EXCLUDED.status = 'error' THEN 1 ELSE 0 END > 0
           THEN 'error'
         ELSE 'healthy'
       END,
       updated_at = now()
     RETURNING *`,
    [timestamp.toISOString(), status, routeCount, normalizedError, version],
  )
  return result.rows[0] ?? null
}

export async function recordBillingCycleVerificationEvidence(pool, {
  accountId,
  migrationId = null,
  billingMonth,
  verification,
  facilityTimezone = 'UTC',
  verifiedAt = new Date(),
  verifierVersion,
  status: requestedStatus = null,
} = {}) {
  const normalizedAccountId = Number(accountId)
  if (!Number.isSafeInteger(normalizedAccountId) || normalizedAccountId < 1) {
    throw new Error('Billing-cycle evidence requires a valid billing account ID.')
  }
  const normalizedMigrationId = migrationId == null ? null : Number(migrationId)
  if (normalizedMigrationId != null && (!Number.isSafeInteger(normalizedMigrationId) || normalizedMigrationId < 1)) {
    throw new Error('Billing-cycle evidence migration ID is invalid.')
  }
  const month = String(billingMonth ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-01$/.test(month)) throw new Error('Billing-cycle evidence month must use YYYY-MM-01.')
  const timestamp = verifiedAt instanceof Date ? verifiedAt : new Date(verifiedAt)
  if (Number.isNaN(timestamp.getTime())) throw new Error('Billing-cycle evidence timestamp is invalid.')
  let currentMonth
  const normalizedFacilityTimezone = facilityTimezone || 'UTC'
  try {
    currentMonth = monthStartInTimeZone(timestamp, normalizedFacilityTimezone)
  } catch {
    throw new Error('Billing-cycle evidence facility timezone is invalid.')
  }
  const completedAtMonth = addUtcMonths(month, 1)
  if (currentMonth < completedAtMonth) {
    throw new Error('Billing-cycle evidence cannot be recorded until its facility billing month is complete.')
  }
  const version = String(verifierVersion ?? '').trim()
  if (!SAFE_EVIDENCE_LABEL.test(version)) throw new Error('Billing-cycle evidence verifier version is invalid.')
  if (!verification || typeof verification !== 'object' || Array.isArray(verification)) {
    throw new Error('Billing-cycle structural verification is required.')
  }

  const count = (name) => {
    const value = Number(verification[name] ?? 0)
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer.`)
    return value
  }
  const optionalCents = (name) => {
    if (verification[name] == null) return null
    const value = Number(verification[name])
    if (!Number.isSafeInteger(value)) throw new Error(`${name} must be an integer.`)
    return value
  }
  const legacyCollectorCount = count('legacyCollectorCount')
  const collectorCount = count('collectorCount')
  const householdInvoiceCount = count('householdInvoiceCount')
  const remoteHouseholdInvoiceCount = count('remoteHouseholdInvoiceCount')
  const unexpectedStripeInvoiceCount = count('unexpectedStripeInvoiceCount')
  const providedLocalInvoiceLineTotalCents = optionalCents('localInvoiceLineTotalCents')
  const providedLocalInvoiceSubtotalCents = optionalCents('localInvoiceSubtotalCents')
  const localInvoiceLineSubtotalCents = optionalCents('localInvoiceLineSubtotalCents')
  const localInvoiceLineCreditCents = optionalCents('localInvoiceLineCreditCents')
  const localInvoiceCreditCents = optionalCents('localInvoiceCreditCents')
  const localInvoiceTotalCents = optionalCents('localInvoiceTotalCents')
  // The original evidence columns are NOT NULL. Error/failed observations may
  // omit financial totals, but a verified observation must explicitly provide
  // every gross, credit, and net dimension below.
  const localInvoiceLineTotalCents = providedLocalInvoiceLineTotalCents ?? 0
  const localInvoiceSubtotalCents = providedLocalInvoiceSubtotalCents ?? 0
  for (const [name, value] of Object.entries({
    localInvoiceLineTotalCents,
    localInvoiceLineSubtotalCents,
    localInvoiceLineCreditCents,
    localInvoiceSubtotalCents,
    localInvoiceCreditCents,
    localInvoiceTotalCents,
  })) {
    if (value != null && value < 0) throw new Error(`${name} must be a non-negative integer.`)
  }
  const collectorUnique = legacyCollectorCount === 0 && collectorCount <= 1
  const householdInvoiceUnique = householdInvoiceCount <= 1
  const remoteHouseholdInvoiceUnique = remoteHouseholdInvoiceCount <= 1
  const lineParity = verification.lineParity === true
    && providedLocalInvoiceLineTotalCents != null
    && providedLocalInvoiceSubtotalCents != null
    && localInvoiceLineSubtotalCents != null
    && localInvoiceLineCreditCents != null
    && localInvoiceCreditCents != null
    && localInvoiceTotalCents != null
    && localInvoiceLineSubtotalCents === localInvoiceSubtotalCents
    && localInvoiceLineCreditCents === localInvoiceCreditCents
    && localInvoiceLineTotalCents === localInvoiceTotalCents
    && localInvoiceTotalCents === Math.max(0, localInvoiceSubtotalCents - localInvoiceCreditCents)
  const noUnexpectedStripeInvoice = unexpectedStripeInvoiceCount === 0
  const safeIssues = sanitizeBillingMigrationSnapshot(Array.isArray(verification.issues) ? verification.issues : [])
  const safeEvidence = sanitizeBillingMigrationSnapshot(
    verification.evidence && typeof verification.evidence === 'object' && !Array.isArray(verification.evidence)
      ? verification.evidence
      : {},
  )
  const structurallyVerified = legacyCollectorCount === 0
    && collectorUnique
    && householdInvoiceUnique
    && remoteHouseholdInvoiceUnique
    && lineParity
    && noUnexpectedStripeInvoice
    && safeIssues.length === 0
  const status = requestedStatus === 'error' ? 'error' : structurallyVerified ? 'verified' : 'failed'
  if (status === 'error' && safeIssues.length === 0) {
    throw new Error('An error billing-cycle evidence record must include a safe issue.')
  }
  const evidenceDocument = {
    accountId: normalizedAccountId,
    migrationId: normalizedMigrationId,
    billingMonth: month,
    facilityTimezone: normalizedFacilityTimezone,
    status,
    legacyCollectorCount,
    collectorCount,
    householdInvoiceCount,
    remoteHouseholdInvoiceCount,
    unexpectedStripeInvoiceCount,
    localInvoiceLineTotalCents,
    localInvoiceLineSubtotalCents,
    localInvoiceLineCreditCents,
    localInvoiceSubtotalCents,
    localInvoiceCreditCents,
    localInvoiceTotalCents,
    collectorUnique,
    householdInvoiceUnique,
    remoteHouseholdInvoiceUnique,
    lineParity,
    noUnexpectedStripeInvoice,
    issues: safeIssues,
    evidence: safeEvidence,
    verifierVersion: version,
    verifiedAt: timestamp.toISOString(),
  }
  const evidenceHash = billingMigrationSnapshotHash(evidenceDocument)
  const result = await pool.query(
    `WITH inserted AS (
       INSERT INTO billing_cycle_verification_evidence (
         family_billing_account_id, billing_account_migration_id, billing_month, status,
         legacy_collector_count, collector_count, household_invoice_count,
         remote_household_invoice_count, unexpected_stripe_invoice_count,
         local_invoice_line_total_cents, local_invoice_subtotal_cents,
         local_invoice_line_subtotal_cents, local_invoice_line_credit_cents,
         local_invoice_credit_cents, local_invoice_total_cents,
         collector_unique, household_invoice_unique, remote_household_invoice_unique,
         line_parity, no_unexpected_stripe_invoice, issues, evidence,
         evidence_hash, verifier_version, facility_timezone, verified_at
       ) VALUES (
         $1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, $17, $18, $19, $20,
         $21::jsonb, $22::jsonb, $23, $24, $25, $26::timestamptz
       )
       ON CONFLICT (family_billing_account_id, billing_month, evidence_hash) DO NOTHING
       RETURNING *
     )
     SELECT * FROM inserted
     UNION ALL
     SELECT existing.*
       FROM billing_cycle_verification_evidence existing
      WHERE existing.family_billing_account_id = $1
        AND existing.billing_month = $3::date
        AND existing.evidence_hash = $23
        AND NOT EXISTS (SELECT 1 FROM inserted)
     LIMIT 1`,
    [
      normalizedAccountId, normalizedMigrationId, month, status,
      legacyCollectorCount, collectorCount, householdInvoiceCount,
      remoteHouseholdInvoiceCount, unexpectedStripeInvoiceCount,
      localInvoiceLineTotalCents, localInvoiceSubtotalCents,
      localInvoiceLineSubtotalCents, localInvoiceLineCreditCents,
      localInvoiceCreditCents, localInvoiceTotalCents,
      collectorUnique, householdInvoiceUnique, remoteHouseholdInvoiceUnique,
      lineParity, noUnexpectedStripeInvoice, JSON.stringify(safeIssues),
      JSON.stringify(safeEvidence), evidenceHash, version,
      normalizedFacilityTimezone, timestamp.toISOString(),
    ],
  )
  return result.rows[0] ?? null
}

function safeTelemetryError(error) {
  return {
    event: 'billing_legacy_endpoint_telemetry_failed',
    errorCode: typeof error?.code === 'string' ? error.code.slice(0, 20) : 'unknown',
  }
}

export function createLegacyBillingEndpointMiddleware(pool, {
  environment = process.env,
  logger = console,
  now = () => new Date(),
} = {}) {
  const mode = legacyBillingEndpointsMode(environment)
  return async (req, res, next) => {
    const endpoint = resolveLegacyBillingEndpoint(req.method, req.path ?? req.url)
    if (!endpoint) return next()

    const observation = {
      event: 'billing_legacy_endpoint_traffic',
      routeKey: endpoint.routeKey,
      method: endpoint.method,
      mode,
    }
    logger.warn?.('[billing] legacy endpoint traffic', observation)
    const observedAt = now()
    try {
      await recordLegacyBillingEndpointTraffic(pool, {
        routeKey: endpoint.routeKey,
        method: endpoint.method,
        observedAt,
      })
    } catch (error) {
      const safeError = safeTelemetryError(error)
      await recordLegacyBillingTelemetryHeartbeat(pool, {
        status: 'error',
        observedAt,
        errorCode: safeError.errorCode,
        checkerVersion: 'request-telemetry-v1',
      }).catch(() => {})
      logger.error?.('[billing] legacy endpoint telemetry failed', safeError)
    }

    if (mode !== 'gone') return next()

    res.setHeader?.('Deprecation', 'true')
    return res.status(410).json({
      success: false,
      code: 'BILLING_LEGACY_ENDPOINT_RETIRED',
      message: 'This legacy billing endpoint has been retired.',
      replacement: endpoint.replacement,
    })
  }
}

function monthStartInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-01`
}

function addUtcMonths(dateText, count) {
  const [year, month] = String(dateText).slice(0, 7).split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1 + count, 1))
  return result.toISOString().slice(0, 10)
}

function addUtcDays(dateText, count) {
  const [year, month, day] = String(dateText).slice(0, 10).split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + count))
  return result.toISOString().slice(0, 10)
}

export function completedBillingCycleGate({
  finalVerifiedAt,
  targetMonth,
  facilityTimezone = 'UTC',
  now = new Date(),
  requiredCycles = 2,
}) {
  const verified = finalVerifiedAt == null ? null : new Date(finalVerifiedAt)
  const current = now instanceof Date ? now : new Date(now)
  const safeCycles = Number(requiredCycles)
  if (!verified || Number.isNaN(verified.getTime()) || Number.isNaN(current.getTime())) {
    return { passed: false, cyclesCompleted: 0, eligibleOn: null }
  }
  if (!Number.isInteger(safeCycles) || safeCycles < 1) {
    throw new Error('requiredCycles must be a positive integer.')
  }
  let verifiedMonth
  let currentMonth
  try {
    verifiedMonth = monthStartInTimeZone(verified, facilityTimezone || 'UTC')
    currentMonth = monthStartInTimeZone(current, facilityTimezone || 'UTC')
  } catch {
    return { passed: false, cyclesCompleted: 0, eligibleOn: null }
  }
  const normalizedTarget = /^\d{4}-\d{2}-01$/.test(String(targetMonth ?? '').slice(0, 10))
    ? String(targetMonth).slice(0, 10)
    : verifiedMonth
  const baseMonth = normalizedTarget > verifiedMonth ? normalizedTarget : verifiedMonth
  // The required evidence months begin after the baseline month. A cycle is
  // complete only when the following facility month has started.
  const eligibleOn = addUtcMonths(baseMonth, safeCycles + 1)
  const yearDelta = Number(currentMonth.slice(0, 4)) - Number(baseMonth.slice(0, 4))
  const monthDelta = Number(currentMonth.slice(5, 7)) - Number(baseMonth.slice(5, 7))
  const cyclesCompleted = Math.max(0, yearDelta * 12 + monthDelta - 1)
  return { passed: currentMonth >= eligibleOn, cyclesCompleted, eligibleOn }
}

export async function auditLegacyBillingRetirementReadiness(pool, {
  now = new Date(),
  observationDays = LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS,
  requiredBillingCycles = LEGACY_RETIREMENT_MIN_BILLING_CYCLES,
} = {}) {
  const current = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(current.getTime())) throw new Error('now must be a valid date.')
  if (
    !Number.isInteger(observationDays)
    || observationDays < LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS
  ) {
    throw new Error(
      `observationDays must be at least ${LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS}.`,
    )
  }
  if (
    !Number.isInteger(requiredBillingCycles)
    || requiredBillingCycles < LEGACY_RETIREMENT_MIN_BILLING_CYCLES
  ) {
    throw new Error(
      `requiredBillingCycles must be at least ${LEGACY_RETIREMENT_MIN_BILLING_CYCLES}.`,
    )
  }

  const currentUtcDate = current.toISOString().slice(0, 10)
  const observationStartDate = addUtcDays(currentUtcDate, -observationDays)
  const observationEndDate = addUtcDays(currentUtcDate, -1)
  const observationStart = new Date(`${observationStartDate}T00:00:00.000Z`)
  const [
    accounts,
    trafficMonitor,
    telemetryHeartbeats,
    recentTraffic,
    billingCycleEvidence,
    stripeLinks,
    compatibility,
  ] = await Promise.all([
    pool.query(
      `WITH latest_migration AS (
         SELECT DISTINCT ON (migration.family_billing_account_id)
                migration.family_billing_account_id,
                migration.state,
                migration.verified_at,
                run.target_month,
                COALESCE(NULLIF(run.facility_timezone, ''), 'UTC') AS facility_timezone
           FROM billing_account_migration migration
          JOIN billing_migration_run run ON run.id = migration.billing_migration_run_id
          ORDER BY migration.family_billing_account_id, migration.created_at DESC, migration.id DESC
       ), active_family AS (
         SELECT family.id
           FROM family
          WHERE COALESCE(family.archived, FALSE) = FALSE
            AND EXISTS (
              SELECT 1
                FROM member
               WHERE member.is_active = TRUE
                 AND (
                   EXISTS (
                     SELECT 1
                       FROM family_member membership
                      WHERE membership.family_id = family.id
                        AND membership.member_id = member.id
                        AND membership.is_active = TRUE
                   )
                   OR (
                     member.family_id = family.id
                     AND NOT EXISTS (
                       SELECT 1
                         FROM family_member historical_membership
                        WHERE historical_membership.member_id = member.id
                     )
                   )
                 )
            )
       )
       SELECT COUNT(*)::int AS active_account_count,
              COUNT(*) FILTER (
                WHERE account.id IS NOT NULL
                  AND account.is_active = TRUE
                  AND latest.state = 'verified'
                  AND account.payer_member_id IS NOT NULL
                  AND EXISTS (
                    SELECT 1
                      FROM member payer
                     WHERE payer.id = account.payer_member_id
                       AND payer.is_active = TRUE
                       AND (
                         EXISTS (
                           SELECT 1
                             FROM family_member payer_membership
                            WHERE payer_membership.family_id = active_family.id
                              AND payer_membership.member_id = payer.id
                              AND payer_membership.is_active = TRUE
                         )
                         OR (
                           payer.family_id = active_family.id
                           AND NOT EXISTS (
                             SELECT 1
                               FROM family_member historical_membership
                              WHERE historical_membership.member_id = payer.id
                           )
                         )
                       )
                  )
              )::int AS verified_account_count,
              COUNT(*) FILTER (
                WHERE account.id IS NULL
                   OR account.is_active IS DISTINCT FROM TRUE
                   OR latest.state IS DISTINCT FROM 'verified'
                   OR account.payer_member_id IS NULL
                   OR NOT EXISTS (
                     SELECT 1
                       FROM member payer
                      WHERE payer.id = account.payer_member_id
                        AND payer.is_active = TRUE
                        AND (
                          EXISTS (
                            SELECT 1
                              FROM family_member payer_membership
                             WHERE payer_membership.family_id = active_family.id
                               AND payer_membership.member_id = payer.id
                               AND payer_membership.is_active = TRUE
                          )
                          OR (
                            payer.family_id = active_family.id
                            AND NOT EXISTS (
                              SELECT 1
                                FROM family_member historical_membership
                               WHERE historical_membership.member_id = payer.id
                            )
                          )
                        )
                   )
              )::int AS unverified_account_count,
              COUNT(*) FILTER (WHERE account.id IS NULL)::int AS missing_billing_account_count,
              COUNT(*) FILTER (
                WHERE account.id IS NOT NULL
                  AND (
                    account.payer_member_id IS NULL
                    OR NOT EXISTS (
                      SELECT 1
                        FROM member payer
                       WHERE payer.id = account.payer_member_id
                         AND payer.is_active = TRUE
                         AND (
                           EXISTS (
                             SELECT 1
                               FROM family_member payer_membership
                              WHERE payer_membership.family_id = active_family.id
                                AND payer_membership.member_id = payer.id
                                AND payer_membership.is_active = TRUE
                           )
                           OR (
                             payer.family_id = active_family.id
                             AND NOT EXISTS (
                               SELECT 1
                                 FROM family_member historical_membership
                                WHERE historical_membership.member_id = payer.id
                             )
                           )
                         )
                    )
                  )
              )::int AS invalid_payer_count,
              MAX(latest.verified_at) AS final_verified_at,
              (ARRAY_AGG(latest.target_month ORDER BY latest.verified_at DESC NULLS LAST))[1] AS final_target_month,
              (ARRAY_AGG(latest.facility_timezone ORDER BY latest.verified_at DESC NULLS LAST))[1] AS final_facility_timezone
         FROM active_family
         LEFT JOIN family_billing_account account ON account.family_id = active_family.id
         LEFT JOIN latest_migration latest ON latest.family_billing_account_id = account.id
       `,
    ),
    pool.query(
      `SELECT monitoring_started_at
         FROM billing_legacy_endpoint_monitor
        WHERE singleton_id = TRUE
        LIMIT 1`,
    ),
    pool.query(
      `WITH expected_day AS (
         SELECT day::date AS observed_on
           FROM generate_series($1::date, $2::date, INTERVAL '1 day') day
       )
       SELECT COUNT(*)::int AS expected_day_count,
              COUNT(heartbeat.observed_on)::int AS recorded_day_count,
              COUNT(*) FILTER (
                WHERE heartbeat.status = 'healthy'
                  AND heartbeat.successful_check_count > 0
                  AND heartbeat.error_count = 0
                  AND heartbeat.expected_route_count = $3
              )::int AS healthy_day_count,
              COUNT(*) FILTER (WHERE heartbeat.observed_on IS NULL)::int AS missing_day_count,
              COUNT(*) FILTER (
                WHERE heartbeat.observed_on IS NOT NULL
                  AND (
                    heartbeat.status <> 'healthy'
                    OR heartbeat.successful_check_count <= 0
                    OR heartbeat.error_count <> 0
                    OR heartbeat.expected_route_count <> $3
                  )
              )::int AS unhealthy_day_count,
              MIN(heartbeat.observed_on) AS first_observed_on,
              MAX(heartbeat.observed_on) AS last_observed_on
         FROM expected_day
         LEFT JOIN billing_legacy_telemetry_heartbeat heartbeat
           ON heartbeat.observed_on = expected_day.observed_on`,
      [observationStartDate, observationEndDate, LEGACY_BILLING_ENDPOINTS.length],
    ),
    pool.query(
      `SELECT COALESCE(SUM(request_count), 0)::bigint AS request_count,
              MAX(last_seen_at) AS last_seen_at
         FROM billing_legacy_endpoint_traffic
        WHERE observed_on >= $1::date
          AND observed_on <= $2::date`,
      [observationStartDate, currentUtcDate],
    ),
    pool.query(
      `WITH latest_migration AS (
         SELECT DISTINCT ON (migration.family_billing_account_id)
                migration.id AS billing_account_migration_id,
                migration.family_billing_account_id,
                migration.state,
                migration.verified_at,
                run.target_month,
                COALESCE(NULLIF(run.facility_timezone, ''), 'UTC') AS facility_timezone
           FROM billing_account_migration migration
          JOIN billing_migration_run run ON run.id = migration.billing_migration_run_id
          ORDER BY migration.family_billing_account_id, migration.created_at DESC, migration.id DESC
       ), active_family AS (
         SELECT family.id
           FROM family
          WHERE COALESCE(family.archived, FALSE) = FALSE
            AND EXISTS (
              SELECT 1
                FROM member
               WHERE member.is_active = TRUE
                 AND (
                   EXISTS (
                     SELECT 1
                       FROM family_member membership
                      WHERE membership.family_id = family.id
                        AND membership.member_id = member.id
                        AND membership.is_active = TRUE
                   )
                   OR (
                     member.family_id = family.id
                     AND NOT EXISTS (
                       SELECT 1
                         FROM family_member historical_membership
                        WHERE historical_membership.member_id = member.id
                     )
                   )
                 )
            )
       ), verified_account AS (
         SELECT account.id AS family_billing_account_id,
                latest.billing_account_migration_id,
                latest.facility_timezone,
                GREATEST(
                  date_trunc('month', latest.target_month)::date,
                  date_trunc(
                    'month',
                    latest.verified_at AT TIME ZONE latest.facility_timezone
                  )::date
                ) AS evidence_base_month
           FROM active_family
           JOIN family_billing_account account
             ON account.family_id = active_family.id
            AND account.is_active = TRUE
           JOIN latest_migration latest
             ON latest.family_billing_account_id = account.id
            AND latest.state = 'verified'
          WHERE latest.target_month IS NOT NULL
            AND latest.verified_at IS NOT NULL
       ), required_cycle AS (
         SELECT account.family_billing_account_id,
                account.billing_account_migration_id,
                account.facility_timezone,
                (account.evidence_base_month
                  + make_interval(months => cycle_number))::date AS billing_month
           FROM verified_account account
          CROSS JOIN generate_series(1, $1::int) cycle_number
       ), latest_evidence AS (
         SELECT required.family_billing_account_id,
                required.billing_month,
                required.facility_timezone,
                evidence.id,
                evidence.status,
                evidence.legacy_collector_count,
                evidence.collector_count,
                evidence.household_invoice_count,
                evidence.remote_household_invoice_count,
                evidence.unexpected_stripe_invoice_count,
                evidence.collector_unique,
                evidence.household_invoice_unique,
                evidence.remote_household_invoice_unique,
                evidence.line_parity,
                evidence.no_unexpected_stripe_invoice,
                evidence.local_invoice_line_total_cents,
                evidence.local_invoice_subtotal_cents,
                evidence.local_invoice_line_subtotal_cents,
                evidence.local_invoice_line_credit_cents,
                evidence.local_invoice_credit_cents,
                evidence.local_invoice_total_cents,
                evidence.facility_timezone AS evidence_facility_timezone,
                evidence.verified_at,
                CASE
                  WHEN evidence.id IS NULL THEN FALSE
                  ELSE date_trunc(
                    'month',
                    evidence.verified_at AT TIME ZONE evidence.facility_timezone
                  )::date > required.billing_month
                END AS certified_after_cycle,
                evidence.issues
           FROM required_cycle required
           LEFT JOIN LATERAL (
             SELECT candidate.*
               FROM billing_cycle_verification_evidence candidate
              WHERE candidate.family_billing_account_id = required.family_billing_account_id
                AND candidate.billing_account_migration_id = required.billing_account_migration_id
                AND candidate.billing_month = required.billing_month
              ORDER BY candidate.created_at DESC, candidate.id DESC
              LIMIT 1
           ) evidence ON TRUE
       )
       SELECT COUNT(*)::int AS expected_evidence_count,
              COUNT(id)::int AS recorded_evidence_count,
              COUNT(*) FILTER (
                WHERE status = 'verified'
                  AND legacy_collector_count = 0
                  AND collector_count <= 1
                  AND household_invoice_count <= 1
                  AND remote_household_invoice_count <= 1
                  AND unexpected_stripe_invoice_count = 0
                  AND collector_unique = TRUE
                  AND household_invoice_unique = TRUE
                  AND remote_household_invoice_unique = TRUE
                  AND line_parity = TRUE
                  AND local_invoice_line_subtotal_cents = local_invoice_subtotal_cents
                  AND local_invoice_line_credit_cents = local_invoice_credit_cents
                  AND local_invoice_line_total_cents = local_invoice_total_cents
                  AND local_invoice_total_cents = GREATEST(
                    0,
                    local_invoice_subtotal_cents - local_invoice_credit_cents
                  )
                  AND certified_after_cycle = TRUE
                  AND evidence_facility_timezone = facility_timezone
                  AND no_unexpected_stripe_invoice = TRUE
                  AND jsonb_array_length(issues) = 0
              )::int AS verified_evidence_count,
              COUNT(*) FILTER (WHERE id IS NULL)::int AS missing_evidence_count,
              COUNT(*) FILTER (
                WHERE id IS NOT NULL
                  AND NOT (
                    status = 'verified'
                    AND legacy_collector_count = 0
                    AND collector_count <= 1
                    AND household_invoice_count <= 1
                    AND remote_household_invoice_count <= 1
                    AND unexpected_stripe_invoice_count = 0
                    AND collector_unique = TRUE
                    AND household_invoice_unique = TRUE
                    AND remote_household_invoice_unique = TRUE
                    AND line_parity = TRUE
                    AND local_invoice_line_subtotal_cents = local_invoice_subtotal_cents
                    AND local_invoice_line_credit_cents = local_invoice_credit_cents
                    AND local_invoice_line_total_cents = local_invoice_total_cents
                    AND local_invoice_total_cents = GREATEST(
                      0,
                      local_invoice_subtotal_cents - local_invoice_credit_cents
                    )
                    AND certified_after_cycle = TRUE
                    AND evidence_facility_timezone = facility_timezone
                    AND no_unexpected_stripe_invoice = TRUE
                    AND jsonb_array_length(issues) = 0
                  )
              )::int AS invalid_evidence_count,
              MIN(billing_month) AS first_required_month,
              MAX(billing_month) AS last_required_month
         FROM latest_evidence`,
      [requiredBillingCycles],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS linked_subscription_count
         FROM billing_subscription subscription
        WHERE (
          subscription.stripe_subscription_id IS NOT NULL
          OR subscription.stripe_subscription_item_id IS NOT NULL
          OR subscription.stripe_subscription_schedule_id IS NOT NULL
        )
          AND NOT (
            subscription.source_type = 'annual_membership'
            OR subscription.pricing_option_key = 'annual_membership'
          )`,
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int
            FROM enrollment_price_adjustment adjustment
           WHERE adjustment.kind = 'legacy_discount'
             AND adjustment.status <> 'revoked') AS active_legacy_adjustment_count,
         (SELECT COUNT(*)::int
            FROM scheduling_signup signup
           WHERE (
             signup.manual_discount_cents IS NOT NULL
             OR signup.manual_discount_pct IS NOT NULL
             OR signup.manual_discount_rule_id IS NOT NULL
             OR NULLIF(BTRIM(signup.manual_discount_reason), '') IS NOT NULL
           )
             AND NOT EXISTS (
               SELECT 1
                 FROM enrollment_price_adjustment adjustment
                WHERE adjustment.signup_id = signup.id
                  AND adjustment.status <> 'revoked'
                  AND adjustment.kind IN ('fixed_final_price', 'promo_code')
             )) AS manual_discount_blocker_count`,
    ),
  ])

  const accountRow = accounts.rows[0] ?? {}
  const activeAccountCount = Number(accountRow.active_account_count ?? 0)
  const verifiedAccountCount = Number(accountRow.verified_account_count ?? 0)
  const unverifiedAccountCount = Number(accountRow.unverified_account_count ?? activeAccountCount)
  const missingBillingAccountCount = Number(accountRow.missing_billing_account_count ?? 0)
  const invalidPayerCount = Number(accountRow.invalid_payer_count ?? 0)
  const monitorStartedAt = trafficMonitor.rows[0]?.monitoring_started_at ?? null
  const monitorStart = monitorStartedAt == null ? null : new Date(monitorStartedAt)
  const heartbeatRow = telemetryHeartbeats.rows[0] ?? {}
  const expectedHeartbeatDayCount = Number(heartbeatRow.expected_day_count ?? observationDays)
  const recordedHeartbeatDayCount = Number(heartbeatRow.recorded_day_count ?? 0)
  const healthyHeartbeatDayCount = Number(heartbeatRow.healthy_day_count ?? 0)
  const missingHeartbeatDayCount = Number(heartbeatRow.missing_day_count ?? expectedHeartbeatDayCount)
  const unhealthyHeartbeatDayCount = Number(heartbeatRow.unhealthy_day_count ?? 0)
  const recentRequestCount = Number(recentTraffic.rows[0]?.request_count ?? 0)
  const cycleEvidenceRow = billingCycleEvidence.rows[0] ?? {}
  const expectedCycleEvidenceCount = Number(cycleEvidenceRow.expected_evidence_count ?? 0)
  const recordedCycleEvidenceCount = Number(cycleEvidenceRow.recorded_evidence_count ?? 0)
  const verifiedCycleEvidenceCount = Number(cycleEvidenceRow.verified_evidence_count ?? 0)
  const missingCycleEvidenceCount = Number(cycleEvidenceRow.missing_evidence_count ?? expectedCycleEvidenceCount)
  const invalidCycleEvidenceCount = Number(cycleEvidenceRow.invalid_evidence_count ?? 0)
  const linkedSubscriptionCount = Number(stripeLinks.rows[0]?.linked_subscription_count ?? 0)
  const activeLegacyAdjustmentCount = Number(compatibility.rows[0]?.active_legacy_adjustment_count ?? 0)
  const manualDiscountBlockerCount = Number(compatibility.rows[0]?.manual_discount_blocker_count ?? 0)
  const cycleGate = completedBillingCycleGate({
    finalVerifiedAt: accountRow.final_verified_at,
    targetMonth: accountRow.final_target_month,
    facilityTimezone: accountRow.final_facility_timezone || 'UTC',
    now: current,
    requiredCycles: requiredBillingCycles,
  })

  const gates = {
    allActiveAccountsVerified: {
      passed: activeAccountCount > 0 && unverifiedAccountCount === 0 && verifiedAccountCount === activeAccountCount,
      activeAccountCount,
      verifiedAccountCount,
      unverifiedAccountCount,
      missingBillingAccountCount,
      invalidPayerCount,
    },
    billingCyclesComplete: {
      ...cycleGate,
      passed: cycleGate.passed
        && expectedCycleEvidenceCount > 0
        && verifiedCycleEvidenceCount === expectedCycleEvidenceCount
        && missingCycleEvidenceCount === 0
        && invalidCycleEvidenceCount === 0,
      requiredCycles: requiredBillingCycles,
      finalVerifiedAt: accountRow.final_verified_at ?? null,
      targetMonth: accountRow.final_target_month ?? null,
      facilityTimezone: accountRow.final_facility_timezone || null,
      expectedEvidenceCount: expectedCycleEvidenceCount,
      recordedEvidenceCount: recordedCycleEvidenceCount,
      verifiedEvidenceCount: verifiedCycleEvidenceCount,
      missingEvidenceCount: missingCycleEvidenceCount,
      invalidEvidenceCount: invalidCycleEvidenceCount,
      firstRequiredMonth: cycleEvidenceRow.first_required_month ?? null,
      lastRequiredMonth: cycleEvidenceRow.last_required_month ?? null,
      cycleMonthPolicy: 'months_after_later_of_cutover_or_verification',
    },
    zeroLegacyTraffic: {
      passed: Boolean(
        monitorStart
        && !Number.isNaN(monitorStart.getTime())
        && monitorStart <= observationStart
        && expectedHeartbeatDayCount === observationDays
        && recordedHeartbeatDayCount === observationDays
        && healthyHeartbeatDayCount === observationDays
        && missingHeartbeatDayCount === 0
        && unhealthyHeartbeatDayCount === 0
        && recentRequestCount === 0
      ),
      observationDays,
      monitoringStartedAt: monitorStartedAt,
      observedSince: observationStart.toISOString(),
      observedThrough: `${observationEndDate}T23:59:59.999Z`,
      requestCount: recentRequestCount,
      lastSeenAt: recentTraffic.rows[0]?.last_seen_at ?? null,
      expectedHeartbeatDayCount,
      recordedHeartbeatDayCount,
      healthyHeartbeatDayCount,
      missingHeartbeatDayCount,
      unhealthyHeartbeatDayCount,
      firstHeartbeatOn: heartbeatRow.first_observed_on ?? null,
      lastHeartbeatOn: heartbeatRow.last_observed_on ?? null,
    },
    noNonAnnualStripeLinks: {
      passed: linkedSubscriptionCount === 0,
      linkedSubscriptionCount,
    },
    compatibilityDataCanonical: {
      passed: activeLegacyAdjustmentCount === 0 && manualDiscountBlockerCount === 0,
      activeLegacyAdjustmentCount,
      manualDiscountBlockerCount,
    },
  }
  const blockers = Object.entries(gates)
    .filter(([, gate]) => !gate.passed)
    .map(([gate]) => gate)
  return {
    ready: blockers.length === 0,
    destructiveChangesPerformed: false,
    checkedAt: current.toISOString(),
    blockers,
    gates,
  }
}

/**
 * Deployment gate for the one-release 410 phase. The evidence queried by the
 * readiness audit is append-only billing-cycle certification plus daily legacy
 * traffic heartbeats. A deployment may always roll back to `enabled`; only the
 * transition to `gone` is gated.
 */
export async function assertLegacyBillingRetirementDeploymentReady(pool, {
  environment = process.env,
  now = new Date(),
} = {}) {
  if (legacyBillingEndpointsMode(environment) !== 'gone') {
    return { enforced: false, ready: true }
  }

  const report = await auditLegacyBillingRetirementReadiness(pool, {
    now,
    observationDays: LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS,
    requiredBillingCycles: LEGACY_RETIREMENT_MIN_BILLING_CYCLES,
  })
  if (!report.ready) {
    const error = new Error(
      `BILLING_LEGACY_ENDPOINTS_MODE=gone is blocked until legacy retirement readiness passes: ${report.blockers.join(', ') || 'unknown blocker'}.`,
    )
    error.code = 'BILLING_LEGACY_RETIREMENT_NOT_READY'
    error.retirementReadiness = report
    throw error
  }
  return { ...report, enforced: true }
}
