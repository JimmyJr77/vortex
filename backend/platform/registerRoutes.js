import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import {
  getCoachClassAssignment,
  queryCoachRosterMembers,
  queryCoachMemberPickerList,
  ensureCoachClassAssignmentSchema,
  queryCoachAssignmentDrilldown,
  resolveCoachAssignmentPayload,
} from './coachRoster.js'
import { resolveProgramsSchema } from '../programs/schema.js'
import { queryAssignDrilldown } from './assignmentTargets.js'
import { sendWaiverRequestEmail } from '../email/waiverRequestEmail.js'
import {
  getEmailConfigSummary,
  isEmailConfigured,
  verifySmtpConnection,
  sendEmail,
  formatEmailError,
} from '../email/sendEmail.js'
import { composeEmailHtml, emailButtonHtml, EMAIL_LAYOUT_VERSION, escapeHtml } from '../email/emailHtml.js'
import { publicAppUrl } from '../email/publicAppUrl.js'
import { API_BUILD_ID } from '../buildInfo.js'
import { loadPortalConfig, savePortalConfig } from './portalSettings.js'
import {
  stripeEnabled as isStripeEnabled,
  completePaymentMethodSetupSession,
  createPaymentMethodSetupSession,
  parseWebhookEvent,
  recordStripePayment,
  recordEnrollmentStripePayment,
  getStripeClient,
  stripeWebhookRawBody,
  logWebhookVerificationFailure,
} from '../billing/stripeBilling.js'
import { stripeWebhookRawParser } from '../billing/stripeWebhookMiddleware.js'
import {
  invoiceSubscriptionId,
  resolveStripeWebhookAccountId,
  syncStripeSubscriptionStatus,
} from '../billing/stripeWebhookLifecycle.js'
import { recordAuthoritativeStripeInvoicePayment } from '../billing/stripeInvoicePayments.js'
import { completeStoreStripeCheckout, registerStoreRoutes } from '../store/registerRoutes.js'
import {
  createCustomerBalanceCheckoutSession,
  validateAnnualMembershipRenewalDiscount,
} from '../billing/customerBillingPayments.js'
import {
  createEnrollmentCheckoutSession,
  commitPendingEnrollment,
  confirmEnrollmentCheckoutSession,
} from '../billing/stripeEnrollmentCheckout.js'
import {
  getAnnualMembershipOffer,
  createAnnualMembershipCheckoutSession,
  previewAnnualMembershipCheckout,
  commitAnnualMembershipCheckout,
} from '../billing/annualMembershipCheckout.js'
import {
  FORBIDDEN_SUBSCRIPTION_CHECKOUT_CODE,
  rejectForbiddenSubscriptionCheckoutCompletion,
} from '../billing/checkoutSessionCollectionPolicy.js'
import { syncAllCatalog, getCatalogSyncStatus } from '../billing/stripeCatalogSync.js'
import { emitStripePurchaseEvent, emitStripePaymentFailedEvent } from '../analytics/ga4Measurement.js'
import { buildBillingAccountView } from '../billing/billingAccountView.js'
import {
  buildCustomerBillingOverview,
  ensureCustomerBillingAccount,
  listMemberCustomerBillingTransactions,
} from '../billing/customerBillingQueries.js'
import { chargeDisplayCategory } from '../billing/billingPeriodView.js'
import { loadCustomerBillingBundles } from '../billing/customerBillingBundles.js'
import { buildMemberBillingOverviewDto } from '../billing/memberBillingDto.js'
import {
  notifyPaymentReceipt,
  notifyPaymentFailed,
  notifyRefundReceipt,
  notifyPaymentRequest,
} from '../email/memberNotifications.js'
import {
  beginStripeWebhookEvent,
  completeStripeWebhookEvent,
  createBillingRefund,
  failStripeWebhookEvent,
  recordStripeBillingAlert,
  resolveStripeBillingAlert,
  syncStripeRefund,
} from '../billing/stripeOperations.js'
import {
  applyBillingAccessAction,
  recordPaymentRecoveryExhaustedAlert,
} from '../billing/billingAccessRecovery.js'
import { listCancellationRequests, reviewCancellationRequest } from '../billing/cancellationReview.js'
import { listDisputeCases, syncDisputeCase, updateDisputeEvidence } from '../billing/disputeOperations.js'
import { getStripeOperationsDashboard, runStripeReconciliation } from '../billing/stripeReconciliation.js'
import { buildPaymentRegistrationReport } from '../billing/paymentRegistrationReport.js'
import {
  beginBillingAdminAction,
  finishBillingAdminAction,
  listBillingAdminActions,
} from '../billing/billingAdminActions.js'
import {
  validateManualChargeInput,
  validateManualPaymentInput,
} from '../billing/billingManualControls.js'
import { registerCustomerBillingRoutes } from '../billing/customerBillingRoutes.js'
import { createLegacyBillingEndpointMiddleware } from '../billing/billingLegacyRetirement.js'
import { getAdminDashboard } from './adminDashboard.js'
import { registerAccountDirectoryRoutes } from '../accounts/accountDirectory.js'
import { listActiveFamilyMemberIds } from './familyMembers.js'
import { recordBillingActivityBestEffort } from '../billing/billingActivity.js'
import {
  finalizeRefundLedgerTreatment,
  linkCustomerBillingPayment,
} from '../billing/customerBillingPayments.js'
import {
  findBillingPaymentAttemptForStripeObject,
  recordAndCompleteBillingPaymentAttempt,
  releaseBillingPaymentAttempt,
} from '../billing/paymentAttemptReservations.js'
import { allocateHouseholdPayments } from '../billing/paymentAllocation.js'
import {
  withHouseholdMonthlyInvoiceAccountLock,
} from '../billing/householdMonthlyInvoice.js'
import { requireAdminFacilityScope } from '../billing/adminFacilityScope.js'
import {
  loadCanonicalAccessContext,
  platformUserFromAccessContext,
  resolveCanonicalTokenUserId,
} from './accessContext.js'

function tokenFrom(req) {
  const authHeader = req.headers.authorization
  return authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
}

/** GA4 client/session ids captured at checkout creation for server-side purchase attribution. */
function sanitizeCheckoutAnalytics(raw) {
  if (!raw || typeof raw !== 'object') return null
  const gaClientId = typeof raw.gaClientId === 'string' && raw.gaClientId ? raw.gaClientId.slice(0, 100) : null
  const gaSessionId = typeof raw.gaSessionId === 'string' && raw.gaSessionId ? raw.gaSessionId.slice(0, 100) : null
  if (!gaClientId && !gaSessionId) return null
  return { ...(gaClientId ? { gaClientId } : {}), ...(gaSessionId ? { gaSessionId } : {}) }
}

function normalizeRoleKey(role) {
  return String(role || '').trim().toUpperCase()
}

export function buildMemberCustomerBillingAccess(account, memberId, canViewHousehold = false) {
  const viewerMemberId = Number(memberId)
  const canView =
    account?.is_active === true &&
    Boolean(canViewHousehold) &&
    Number.isFinite(viewerMemberId)
  const isPayer = canView && Number(account.payer_member_id) === viewerMemberId
  return {
    viewerMemberId,
    canViewHousehold: canView,
    canManagePayments: isPayer,
    canManagePaymentMethod: isPayer,
  }
}

async function isActiveMemberOfFamily(pool, memberId, familyId) {
  const normalizedMemberId = Number(memberId)
  const normalizedFamilyId = Number(familyId)
  if (!Number.isFinite(normalizedMemberId) || !Number.isFinite(normalizedFamilyId)) return false
  const result = await pool.query(
    `SELECT 1
     FROM member m
     WHERE m.id = $1
       AND m.is_active = TRUE
       AND (
         EXISTS (
           SELECT 1
           FROM family_member fm
           WHERE fm.member_id = m.id
             AND fm.family_id = $2
             AND fm.is_active = TRUE
         )
         OR (
           m.family_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM family_member existing_membership
             WHERE existing_membership.member_id = m.id
           )
         )
       )
     LIMIT 1`,
    [normalizedMemberId, normalizedFamilyId],
  )
  return result.rows.length > 0
}

export async function resolveActiveMemberBillingFamilyId(pool, {
  memberId,
  facilityId = null,
}) {
  const normalizedMemberId = Number(memberId)
  const normalizedFacilityId = facilityId == null ? null : Number(facilityId)
  if (!Number.isFinite(normalizedMemberId) || normalizedMemberId <= 0) return null
  if (normalizedFacilityId != null && (!Number.isFinite(normalizedFacilityId) || normalizedFacilityId <= 0)) {
    return null
  }

  const result = await pool.query(
    `WITH viewer AS (
       SELECT m.id, m.family_id
       FROM member m
       WHERE m.id = $1
         AND m.is_active = TRUE
         AND ($2::bigint IS NULL OR m.facility_id = $2)
     ), candidate_families AS (
       SELECT fm.family_id
       FROM viewer v
       JOIN family_member fm ON fm.member_id = v.id
       WHERE fm.is_active = TRUE

       UNION

       SELECT v.family_id
       FROM viewer v
       WHERE v.family_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM family_member historical_membership
           WHERE historical_membership.member_id = v.id
         )
     )
     SELECT DISTINCT family.id AS family_id
     FROM candidate_families candidate
     JOIN family ON family.id = candidate.family_id
     WHERE ($2::bigint IS NULL OR family.facility_id = $2)
     ORDER BY family.id
     LIMIT 2`,
    [normalizedMemberId, normalizedFacilityId],
  )

  // A member portal session represents one household. Multiple active links are
  // ambiguous, so fail closed instead of selecting a billing account arbitrarily.
  if (result.rows.length !== 1) return null
  const familyId = Number(result.rows[0].family_id)
  return Number.isFinite(familyId) && familyId > 0 ? familyId : null
}

export function normalizeMemberBillingIdempotencyKey(value) {
  const raw = String(value ?? '').trim()
  if (!raw) throw new Error('An Idempotency-Key header is required.')
  if (!/^[A-Za-z0-9_.:-]{8,120}$/.test(raw)) {
    throw new Error('Idempotency-Key must be 8–120 URL-safe characters.')
  }
  return `member-balance-checkout:${raw}`
}

const TERMINAL_STRIPE_CHECKOUT_COMMIT_STATUSES = Object.freeze({
  enrollment: new Set(['completed', 'already_completed']),
  annual_membership: new Set(['completed', 'already_active']),
})

/**
 * A paid Checkout event is not safe to acknowledge until its local entitlement
 * commit is terminal. Nonterminal results must leave the webhook retryable;
 * otherwise a concurrent or interrupted worker can strand a paid enrollment or
 * annual membership after Stripe stops delivering the event.
 */
export function requireTerminalStripeCheckoutCommit(result, checkoutKind) {
  const allowedStatuses = TERMINAL_STRIPE_CHECKOUT_COMMIT_STATUSES[checkoutKind]
  if (!allowedStatuses) throw new Error(`Unknown Stripe checkout kind: ${checkoutKind}`)

  const status = String(result?.status ?? 'missing')
  if (allowedStatuses.has(status)) return result

  const reason = result?.reason == null ? '' : `: ${String(result.reason)}`
  const error = new Error(
    `Stripe ${checkoutKind.replaceAll('_', ' ')} checkout fulfillment is not complete (${status}${reason}).`,
  )
  error.code = 'STRIPE_CHECKOUT_FULFILLMENT_INCOMPLETE'
  error.checkoutKind = checkoutKind
  error.commitStatus = status
  throw error
}

const MEMBER_BILLING_TRANSACTION_CURSOR_KIND = 'member-customer-billing-transactions-v1'

export function encodeMemberBillingTransactionCursor(cursor, { accountId, jwtSecret }) {
  if (!cursor) return null
  const normalizedAccountId = Number(accountId)
  if (!Number.isFinite(normalizedAccountId) || normalizedAccountId <= 0 || !jwtSecret) {
    throw new Error('Member billing cursor context is invalid.')
  }
  return jwt.sign(
    {
      kind: MEMBER_BILLING_TRANSACTION_CURSOR_KIND,
      accountId: normalizedAccountId,
      cursor: String(cursor),
    },
    jwtSecret,
    { algorithm: 'HS256', noTimestamp: true },
  )
}

export function decodeMemberBillingTransactionCursor(value, { accountId, jwtSecret }) {
  if (!value) return null
  const token = String(value)
  const normalizedAccountId = Number(accountId)
  if (token.length > 4096 || !Number.isFinite(normalizedAccountId) || normalizedAccountId <= 0 || !jwtSecret) {
    throw new Error('Billing transaction cursor is invalid.')
  }
  try {
    const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] })
    if (
      !decoded
      || typeof decoded !== 'object'
      || decoded.kind !== MEMBER_BILLING_TRANSACTION_CURSOR_KIND
      || Number(decoded.accountId) !== normalizedAccountId
      || typeof decoded.cursor !== 'string'
      || !decoded.cursor
    ) {
      throw new Error('invalid cursor payload')
    }
    return decoded.cursor
  } catch {
    throw new Error('Billing transaction cursor is invalid.')
  }
}

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim())

/**
 * Resolve who should receive a member's waiver-request email.
 * An adult receives their own request. A minor's request goes only to an active
 * legal guardian in the same active household. Missing DOB grants no signing
 * authority, and billing payer status alone is not authority.
 * Returns { email, guardianName } or null when no usable recipient exists.
 */
export async function resolveWaiverRecipient(pool, memberRow) {
  const memberId = Number(memberRow?.id)
  const facilityId = Number(memberRow?.facility_id)
  if (!Number.isSafeInteger(memberId) || memberId <= 0 || !Number.isSafeInteger(facilityId) || facilityId <= 0) {
    return null
  }

  const recipients = await pool.query(
    `WITH target AS (
       SELECT child.id,
              child.facility_id,
              facility.timezone AS facility_timezone,
              child.date_of_birth IS NOT NULL
                AND child.date_of_birth <= (
                  (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(facility.timezone, 'America/New_York'))::date
                  - INTERVAL '18 years'
                )::date AS is_adult,
              child.date_of_birth IS NOT NULL
                AND child.date_of_birth > (
                  (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(facility.timezone, 'America/New_York'))::date
                  - INTERVAL '18 years'
                )::date AS is_minor,
              COALESCE(
                NULLIF(TRIM(child.email), ''),
                NULLIF(TRIM(child_user.email), '')
              ) AS email
         FROM member child
         JOIN facility ON facility.id = child.facility_id
         LEFT JOIN app_user child_user
           ON child_user.id = child.app_user_id
          AND child_user.facility_id = child.facility_id
        WHERE child.id = $1
          AND child.facility_id = $2
          AND child.is_active = TRUE
     )
     SELECT recipient.email, recipient.first_name, recipient.is_guardian
       FROM (
         SELECT target.email,
                NULL::text AS first_name,
                FALSE AS is_guardian,
                0 AS priority,
                target.id AS recipient_id
           FROM target
          WHERE target.is_adult = TRUE
         UNION ALL
         SELECT COALESCE(
                  NULLIF(TRIM(guardian.email), ''),
                  NULLIF(TRIM(guardian_user.email), '')
                ) AS email,
                guardian.first_name,
                TRUE AS is_guardian,
                1 AS priority,
                guardian.id AS recipient_id
           FROM target
           JOIN parent_guardian_authority authority
             ON authority.child_member_id = target.id
            AND authority.has_legal_authority = TRUE
           JOIN family_member child_membership
             ON child_membership.member_id = target.id
            AND child_membership.is_active = TRUE
           JOIN member guardian
             ON guardian.id = authority.parent_member_id
            AND guardian.facility_id = target.facility_id
            AND guardian.is_active = TRUE
            AND guardian.date_of_birth IS NOT NULL
           JOIN family_member guardian_membership
             ON guardian_membership.member_id = guardian.id
            AND guardian_membership.family_id = child_membership.family_id
            AND guardian_membership.is_active = TRUE
           LEFT JOIN app_user guardian_user
             ON guardian_user.id = guardian.app_user_id
            AND guardian_user.facility_id = guardian.facility_id
          WHERE target.is_minor = TRUE
            AND guardian.date_of_birth <= (
              (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(target.facility_timezone, 'America/New_York'))::date
              - INTERVAL '18 years'
            )::date
       ) recipient
      ORDER BY recipient.priority, recipient.recipient_id`,
    [memberId, facilityId],
  )
  const recipient = recipients.rows.find((row) => isValidEmail(row.email))
  if (recipient) {
    return {
      email: String(recipient.email).trim(),
      guardianName: recipient.is_guardian === true ? recipient.first_name || null : null,
    }
  }

  return null
}

function reconcileAdminRoles(roles) {
  const normalized = [...new Set(roles.map(normalizeRoleKey).filter(Boolean))]
  if (normalized.includes('MASTER_ADMIN') && normalized.includes('ADMIN')) {
    return normalized.filter((role) => role !== 'ADMIN')
  }
  return normalized
}

const STAFF_STORAGE_ROLES = new Set(['MASTER_ADMIN', 'ADMIN', 'COACH'])

function normalizeStaffStorageRoles(roles) {
  return reconcileAdminRoles(roles).filter((role) => STAFF_STORAGE_ROLES.has(role))
}

async function isFacilityOwnerUser(pool, userId, facilityId) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1
         FROM facility f
        WHERE f.owner_user_id = $1
          AND f.id = $2
     ) AS is_owner`,
    [userId, facilityId],
  )
  return result.rows[0]?.is_owner === true
}

async function loadUserRoles(pool, user) {
  const roleSet = new Set([normalizeRoleKey(user.role)])
  const res = await pool.query(
    `SELECT role::text as role FROM app_user_role WHERE user_id = $1`,
    [user.id],
  )
  for (const row of res.rows) roleSet.add(normalizeRoleKey(row.role))
  return [...roleSet].filter(Boolean)
}

async function loadUserPermissions(pool, user, roles) {
  const masterAdmin = user.is_owner === true

  if (masterAdmin) {
    const all = await pool.query(`SELECT key FROM permission ORDER BY key`)
    return {
      isMasterAdmin: true,
      permissions: all.rows.map((r) => r.key),
    }
  }

  const effectiveRoles = [...new Set(roles.map((role) => (
    role === 'MASTER_ADMIN' ? 'ADMIN' : role
  )))]

  const base = await pool.query(
    `
      SELECT DISTINCT p.key
      FROM role r
      JOIN role_permission rp ON rp.role_id = r.id
      JOIN permission p ON p.id = rp.permission_id
      WHERE r.key = ANY($1::text[])
    `,
    [effectiveRoles],
  )
  const permissions = new Set(base.rows.map((r) => r.key))

  const overrides = await pool.query(
    `
      SELECT p.key, o.effect
      FROM app_user_permission_override o
      JOIN permission p ON p.id = o.permission_id
      WHERE o.user_id = $1
    `,
    [user.id],
  )

  for (const row of overrides.rows) {
    if (row.effect === 'deny') permissions.delete(row.key)
    if (row.effect === 'allow') permissions.add(row.key)
  }

  return {
    isMasterAdmin: false,
    permissions: [...permissions].sort(),
  }
}

export async function loadAuthenticatedPlatformUser(pool, userId) {
  const access = await loadCanonicalAccessContext(pool, userId)
  return platformUserFromAccessContext(access)
}

async function loadAuthContext(pool, jwtSecret, req) {
  const token = tokenFrom(req)
  if (!token) return null
  const decoded = jwt.verify(token, jwtSecret)
  const userId = await resolveCanonicalTokenUserId(pool, decoded)
  if (!userId) return null

  const access = await loadCanonicalAccessContext(pool, userId)
  const user = platformUserFromAccessContext(access)
  if (!user || user.is_active === false) return null
  const roles = access.storageRoles
  const permissionState = await loadUserPermissions(pool, user, roles)
  return {
    user,
    roles,
    permissions: permissionState.permissions,
    isMasterAdmin: permissionState.isMasterAdmin,
    isOwner: access.isOwner,
    staffRoles: access.staffRoles,
    memberPortalStatus: access.memberPortalStatus,
    portalAccess: access.portalAccess,
  }
}

function hasPermission(ctx, permission) {
  return ctx?.isMasterAdmin === true || ctx?.permissions?.includes(permission)
}

function errorStatus(error, fallback) {
  const status = Number(error?.statusCode)
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : fallback
}

export function authenticatedAdminBillingScope(platformAuth) {
  return {
    facilityId: requireAdminFacilityScope({ facilityId: platformAuth?.user?.facility_id }),
    allowGlobal: false,
  }
}

function authMiddleware(pool, jwtSecret) {
  return async (req, res, next) => {
    try {
      const ctx = await loadAuthContext(pool, jwtSecret, req)
      if (!ctx) return res.status(401).json({ success: false, message: 'Authentication required' })
      req.platformAuth = ctx
      next()
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' })
    }
  }
}

function requireAdminPortalAccess(req, res, next) {
  if (req.platformAuth?.portalAccess?.admin !== true) {
    return res.status(403).json({ success: false, message: 'Admin Portal access required.' })
  }
  return next()
}

function adminPortalAuthMiddleware(pool, jwtSecret) {
  return [authMiddleware(pool, jwtSecret), requireAdminPortalAccess]
}

export function linkedPlatformMemberId(platformAuth) {
  const memberId = Number(platformAuth?.user?.member_id)
  return Number.isSafeInteger(memberId) && memberId > 0 ? memberId : null
}

function requireLinkedMemberBillingIdentity(req, res, next) {
  if (
    linkedPlatformMemberId(req.platformAuth) == null
    || req.platformAuth?.portalAccess?.member !== true
  ) {
    return res.status(403).json({
      success: false,
      code: 'MEMBER_ACCOUNT_LINK_REQUIRED',
      message: req.platformAuth?.memberPortalStatus === 'setup_required'
        ? 'Member Portal login setup is required for member billing.'
        : 'An active linked Member Portal login is required for member billing.',
    })
  }
  next()
}

function memberBillingAuthMiddleware(pool, jwtSecret) {
  return [authMiddleware(pool, jwtSecret), requireLinkedMemberBillingIdentity]
}

const memberPortalAuthMiddleware = memberBillingAuthMiddleware

function requirePermission(pool, jwtSecret, permission) {
  return [
    ...adminPortalAuthMiddleware(pool, jwtSecret),
    (req, res, next) => {
      if (!hasPermission(req.platformAuth, permission)) {
        return res.status(403).json({ success: false, message: `Missing permission: ${permission}` })
      }
      next()
    },
  ]
}

function requireAnyPermission(pool, jwtSecret, permissions) {
  return [
    ...adminPortalAuthMiddleware(pool, jwtSecret),
    (req, res, next) => {
      if (permissions.some((permission) => hasPermission(req.platformAuth, permission))) {
        next()
        return
      }
      return res.status(403).json({ success: false, message: 'Insufficient permissions' })
    },
  ]
}

function requireFacilityOwner(pool, jwtSecret) {
  return [
    ...adminPortalAuthMiddleware(pool, jwtSecret),
    (req, res, next) => {
      if (req.platformAuth?.isMasterAdmin !== true) {
        return res.status(403).json({ success: false, message: 'Only the facility Owner can perform this action.' })
      }
      next()
    },
  ]
}

async function deleteAppUserCompletely(client, userId, facilityId) {
  const target = await client.query(
    `SELECT id
       FROM app_user
      WHERE id = $1
        AND facility_id = $2
      FOR UPDATE`,
    [userId, facilityId],
  )
  if (target.rows.length === 0) {
    throw accessMutationError('Staff account not found.', 404)
  }

  const linkedMember = await client.query(
    `SELECT id
       FROM member
      WHERE app_user_id = $1
        AND facility_id = $2
      LIMIT 1`,
    [userId, facilityId],
  )
  if (linkedMember.rows.length > 0) {
    throw accessMutationError(
      'This staff login is linked to a member. Suspend staff access instead so the member record and Member Portal login are preserved.',
      409,
    )
  }

  await client.query('DELETE FROM coach_class_assignment WHERE coach_user_id = $1', [userId])
  await client.query('DELETE FROM app_user WHERE id = $1 AND facility_id = $2', [userId, facilityId])
}

export async function loadBillingAccountForFacility(pool, { familyId, facilityId }) {
  const normalizedFamilyId = Number(familyId)
  const normalizedFacilityId = Number(facilityId)
  if (
    !Number.isFinite(normalizedFamilyId)
    || normalizedFamilyId <= 0
    || !Number.isFinite(normalizedFacilityId)
    || normalizedFacilityId <= 0
  ) {
    return null
  }

  const result = await pool.query(
    `SELECT account.*
       FROM family
       JOIN family_billing_account account ON account.family_id = family.id
      WHERE family.id = $1
        AND family.facility_id = $2`,
    [normalizedFamilyId, normalizedFacilityId],
  )
  return result.rows[0] ?? null
}

async function memberBelongsToFamily(pool, memberId, familyId, facilityId) {
  if (memberId == null) return true
  const normalizedMemberId = Number(memberId)
  const normalizedFamilyId = Number(familyId)
  const normalizedFacilityId = Number(facilityId)
  if (
    !Number.isFinite(normalizedMemberId)
    || normalizedMemberId <= 0
    || !Number.isFinite(normalizedFamilyId)
    || normalizedFamilyId <= 0
    || !Number.isFinite(normalizedFacilityId)
    || normalizedFacilityId <= 0
  ) {
    return false
  }
  const res = await pool.query(
    `
      SELECT 1
      FROM member m
      JOIN family f ON f.id = $2 AND f.facility_id = $3
      WHERE m.id = $1
        AND m.facility_id = $3
        AND m.is_active = TRUE
        AND (
        EXISTS (
          SELECT 1 FROM family_member fm
          WHERE fm.member_id = m.id AND fm.family_id = $2 AND fm.is_active = TRUE
        )
        OR (
          m.family_id = $2
          AND NOT EXISTS (
            SELECT 1
            FROM family_member historical_membership
            WHERE historical_membership.member_id = m.id
          )
        )
      )
    `,
    [normalizedMemberId, normalizedFamilyId, normalizedFacilityId],
  )
  return res.rows.length > 0
}

export async function activeWaiverTemplateIds(pool, facilityId, { requiredOnly = true } = {}) {
  const res = await pool.query(
    `
      SELECT id
      FROM waiver_template
      WHERE facility_id = $1
        AND active_from <= now()
        AND (active_to IS NULL OR active_to > now())
        AND ($2::boolean = FALSE OR is_required = TRUE)
      ORDER BY id
    `,
    [facilityId, requiredOnly],
  )
  return res.rows.map((r) => Number(r.id))
}

export async function canSignWaiversForMembers(pool, signerMemberId, targetMemberIds) {
  const uniqueTargets = [...new Set(targetMemberIds.map(Number).filter(Number.isFinite))]
  if (uniqueTargets.length === 0) return { ok: false, message: 'No members specified.' }

  const signerRes = await pool.query(
    `SELECT
       signer.id,
       signer.facility_id,
       signer.date_of_birth IS NOT NULL
         AND signer.date_of_birth <= (
           (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(facility.timezone, 'America/New_York'))::date
           - INTERVAL '18 years'
         )::date AS is_adult
     FROM member signer
     JOIN facility ON facility.id = signer.facility_id
     WHERE signer.id = $1 AND signer.is_active = TRUE`,
    [signerMemberId],
  )
  if (signerRes.rows.length === 0) return { ok: false, message: 'Signer member not found.' }
  if (signerRes.rows[0].is_adult !== true) {
    return { ok: false, message: 'Only a verified adult may sign waivers. An authorized guardian must sign for youth members.' }
  }
  const facilityId = signerRes.rows[0].facility_id

  const targetsRes = await pool.query(
    `
      SELECT
        m.id,
        fm.family_id,
        m.date_of_birth IS NOT NULL
          AND m.date_of_birth > (
            (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(facility.timezone, 'America/New_York'))::date
            - INTERVAL '18 years'
          )::date AS is_minor,
        EXISTS (
          SELECT 1
          FROM parent_guardian_authority authority
          WHERE authority.child_member_id = m.id
            AND authority.parent_member_id = $3
            AND authority.has_legal_authority = TRUE
        ) AS signer_is_guardian
      FROM member m
      JOIN facility ON facility.id = m.facility_id
      LEFT JOIN family_member fm ON fm.member_id = m.id AND fm.is_active = TRUE
      WHERE m.id = ANY($1::bigint[]) AND m.facility_id = $2 AND m.is_active = TRUE
    `,
    [uniqueTargets, facilityId, signerMemberId],
  )
  if (targetsRes.rows.length !== uniqueTargets.length) {
    return { ok: false, message: 'One or more members were not found.' }
  }

  const signerFamily = await pool.query(
    `
      SELECT fm.family_id
      FROM family_member fm
      WHERE fm.member_id = $1 AND fm.is_active = TRUE
      LIMIT 1
    `,
    [signerMemberId],
  )
  const signerFamilyId = signerFamily.rows[0]?.family_id ?? null

  for (const row of targetsRes.rows) {
    const targetId = Number(row.id)
    if (targetId === signerMemberId) continue
    if (signerFamilyId == null || Number(row.family_id) !== Number(signerFamilyId)) {
      return { ok: false, message: 'You can only sign waivers for members in your family.' }
    }
    const isGuardian = row.signer_is_guardian === true
    if (row.is_minor !== true || !isGuardian) {
      return { ok: false, message: 'Another adult must sign their own waivers. Only an authorized parent or guardian may sign for a youth member.' }
    }
  }

  return { ok: true, facilityId, targetMemberIds: uniqueTargets }
}

function mapBillingAccount(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    familyId: Number(row.family_id),
    payerMemberId: row.payer_member_id != null ? Number(row.payer_member_id) : null,
    billingEmail: row.billing_email ?? null,
    billingPhone: row.billing_phone ?? null,
    billingStreet: row.billing_street ?? null,
    billingCity: row.billing_city ?? null,
    billingState: row.billing_state ?? null,
    billingZip: row.billing_zip ?? null,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapStatement(row, lines = []) {
  return {
    id: Number(row.id),
    familyBillingAccountId: Number(row.family_billing_account_id),
    statementDate: row.statement_date,
    dueDate: row.due_date ?? null,
    totalCents: Number(row.total_cents ?? 0),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines,
  }
}

function mapPayment(row) {
  return {
    id: Number(row.id),
    familyBillingAccountId: Number(row.family_billing_account_id),
    amountCents: Number(row.amount_cents ?? 0),
    paidAt: row.paid_at,
    method: row.method ?? null,
    note: row.note ?? null,
    externalProcessor: row.external_processor ?? null,
    externalReference: row.external_reference ?? null,
    externalStatus: row.external_status ?? null,
    stripeCustomerId: row.stripe_customer_id ?? null,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? null,
    stripeInvoiceId: row.stripe_invoice_id ?? null,
    createdAt: row.created_at,
  }
}

function normalizeLegacyManualPaymentStatus(value) {
  const status = String(value ?? '').trim().toLowerCase()
  if (!status || status === 'recorded' || status === 'settled') return 'settled'
  if (status === 'succeeded') return 'succeeded'
  throw new Error('externalStatus must identify a completed payment (settled or succeeded).')
}

function mapCharge(row) {
  return {
    id: Number(row.id),
    familyBillingAccountId: Number(row.family_billing_account_id),
    memberId: row.member_id != null ? Number(row.member_id) : null,
    memberName: row.member_name ?? null,
    sourceType: row.source_type ?? 'manual',
    sourceId: row.source_id ?? null,
    description: row.description,
    amountCents: Number(row.amount_cents ?? 0),
    grossAmountCents: row.gross_amount_cents != null ? Number(row.gross_amount_cents) : Number(row.amount_cents ?? 0),
    discountAmountCents: Number(row.discount_amount_cents ?? 0),
    chargeType: row.charge_type ?? 'one_time',
    billingInterval: row.billing_interval ?? 'one_time',
    subscriptionId: row.subscription_id != null ? Number(row.subscription_id) : null,
    servicePeriodStart: row.service_period_start ?? null,
    servicePeriodEnd: row.service_period_end ?? null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? null,
    displayCategory: row.displayCategory ?? null,
    createdAt: row.created_at,
  }
}

function accessMutationError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

export async function updateAccessUserRoles(pool, {
  userId,
  facilityId,
  actorUserId,
  roles,
}) {
  const normalizedRoles = normalizeStaffStorageRoles(Array.isArray(roles) ? roles : [])
  if (!Number.isSafeInteger(Number(userId)) || normalizedRoles.length === 0) {
    throw accessMutationError('At least one staff role is required.')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const targetResult = await client.query(
      `SELECT
         au.id,
         au.role::text AS role,
         au.facility_id,
         f.owner_user_id
       FROM app_user au
       JOIN facility f ON f.id = au.facility_id
       WHERE au.id = $1
         AND au.facility_id = $2
       FOR UPDATE OF au, f`,
      [userId, facilityId],
    )
    const target = targetResult.rows[0]
    if (!target) throw accessMutationError('Staff account not found.', 404)

    const isOwner = Number(target.owner_user_id) === Number(userId)
    if (isOwner && !normalizedRoles.includes('MASTER_ADMIN')) {
      throw accessMutationError('The facility Owner must keep the Owner role.')
    }
    if (!isOwner && normalizedRoles.includes('MASTER_ADMIN')) {
      throw accessMutationError('The facility Owner is immutable; use the Administrator role for other staff.')
    }
    if (Number(actorUserId) === Number(userId) && isOwner && !normalizedRoles.includes('MASTER_ADMIN')) {
      throw accessMutationError('You cannot remove your own Owner access.')
    }

    const primaryRole = normalizedRoles[0]
    await client.query(
      `UPDATE app_user
          SET role = $2::user_role,
              updated_at = now()
        WHERE id = $1
          AND facility_id = $3`,
      [userId, primaryRole, facilityId],
    )
    await client.query('DELETE FROM app_user_role WHERE user_id = $1', [userId])
    for (const role of normalizedRoles) {
      await client.query(
        `INSERT INTO app_user_role (user_id, role)
         VALUES ($1, $2::user_role)
         ON CONFLICT DO NOTHING`,
        [userId, role],
      )
    }

    if (normalizedRoles.some((role) => ['MASTER_ADMIN', 'ADMIN'].includes(role))) {
      await client.query(
        `INSERT INTO admin_profile (user_id, is_master_admin)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET
           is_master_admin = EXCLUDED.is_master_admin,
           updated_at = now()`,
        [userId, isOwner],
      )
    } else {
      await client.query('DELETE FROM admin_profile WHERE user_id = $1', [userId])
    }

    if (normalizedRoles.includes('COACH')) {
      await client.query(
        `INSERT INTO coach_profile (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET
           is_active = TRUE,
           updated_at = now()`,
        [userId],
      )
    } else {
      await client.query(
        `UPDATE coach_profile
            SET is_active = FALSE,
                updated_at = now()
          WHERE user_id = $1`,
        [userId],
      )
    }

    await client.query('COMMIT')
    return { roles: normalizedRoles, isOwner }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function ensureCoachOperationalTables(pool) {
  await ensureCoachClassAssignmentSchema(pool)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coach_roster_note (
      id BIGSERIAL PRIMARY KEY,
      coach_user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      assignment_id BIGINT NOT NULL REFERENCES coach_class_assignment(id) ON DELETE CASCADE,
      member_id BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
      attendance_status TEXT,
      note TEXT,
      note_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (coach_user_id, assignment_id, member_id, note_date)
    )
  `)
}

export function registerPlatformRoutes(app, pool, { jwtSecret }) {
  const legacyBillingEndpoint = createLegacyBillingEndpointMiddleware(pool)
  const rejectLegacyStatementWrite = (_req, res) => res.status(410).json({
    success: false,
    code: 'BILLING_LEGACY_STATEMENTS_READ_ONLY',
    message: 'Legacy billing statements are retained as read-only history.',
    replacement: {
      method: 'GET',
      path: '/api/admin/customer-billing/families/:familyId/transactions',
    },
  })
  const rejectDirectSubscriptionStatusWrite = (_req, res) => res.status(410).json({
    success: false,
    code: 'BILLING_SUBSCRIPTION_STATUS_WRITE_RETIRED',
    message: 'Enrollment lifecycle operations are authoritative; direct subscription status changes are retired.',
    replacement: {
      method: 'POST',
      path: '/api/admin/customer-billing/enrollments/:signupId/cancellation',
    },
  })
  const rejectLegacyPassAdjustmentWrite = (_req, res) => res.status(410).json({
    success: false,
    code: 'BILLING_LEGACY_PASS_ADJUSTMENT_RETIRED',
    message: 'Use the audited entitlement adjustment endpoint for multi-class passes.',
    replacement: {
      method: 'POST',
      path: '/api/admin/entitlements/multi-class-passes/:passId/adjustments',
    },
  })
  registerCustomerBillingRoutes(app, pool, { jwtSecret, requirePermission })
  registerAccountDirectoryRoutes(app, pool, { jwtSecret, requirePermission })
  registerStoreRoutes(app, pool, {
    memberAuth: memberBillingAuthMiddleware(pool, jwtSecret),
    requirePermission: (permission) => requirePermission(pool, jwtSecret, permission),
  })

  app.get('/api/admin/dashboard', ...adminPortalAuthMiddleware(pool, jwtSecret), async (req, res) => {
    try {
      const ctx = req.platformAuth
      const canViewEnrollment = ctx.isMasterAdmin || [
        'members.view',
        'classes.view',
        'scheduling.view',
      ].some((permission) => ctx.permissions.includes(permission))
      const canViewBilling = ctx.isMasterAdmin || ctx.permissions.includes('billing.view')
      const canViewWaivers = ctx.isMasterAdmin || ctx.permissions.includes('waivers.view')
      const data = await getAdminDashboard(pool, {
        facilityId: ctx.user.facility_id,
        canViewEnrollment,
        canViewBilling,
        canViewWaivers,
      })
      res.json({ success: true, data })
    } catch (error) {
      console.error('[admin-dashboard] overview:', error)
      res.status(500).json({ success: false, message: 'Unable to load the Admin Dashboard.' })
    }
  })

  app.get('/api/admin/access/me', ...adminPortalAuthMiddleware(pool, jwtSecret), async (req, res) => {
    const ctx = req.platformAuth
    res.json({
      success: true,
      data: {
        user: {
          id: Number(ctx.user.id),
          email: ctx.user.email,
          fullName: ctx.user.full_name,
          role: ctx.user.role,
          memberId: ctx.user.member_id != null ? Number(ctx.user.member_id) : null,
          familyId: ctx.user.family_id != null ? Number(ctx.user.family_id) : null,
        },
        roles: ctx.roles,
        staffRoles: ctx.staffRoles,
        permissions: ctx.permissions,
        isMasterAdmin: ctx.isMasterAdmin,
        isOwner: ctx.isOwner,
        staffAccessActive: ctx.user.staff_access_active !== false,
        memberPortalAccessActive: ctx.user.member_portal_access_active !== false,
        portalAccess: ctx.portalAccess,
      },
    })
  })

  app.get('/api/member/access/me', authMiddleware(pool, jwtSecret), async (req, res) => {
    const ctx = req.platformAuth
    res.json({
      success: true,
      data: {
        permissions: ctx.permissions,
        isMasterAdmin: ctx.isMasterAdmin,
        memberPortalStatus: ctx.memberPortalStatus,
        portalAccess: ctx.portalAccess,
      },
    })
  })

  app.get('/api/admin/access/users', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    const includeNonStaff = String(req.query?.scope || '').toLowerCase() === 'all'
    const users = await pool.query(
      `
        SELECT
          access.*
        FROM v_app_user_access_context access
        WHERE access.facility_id = $1
          AND ($2::boolean = TRUE OR cardinality(access.staff_roles) > 0)
        ORDER BY access.full_name, access.email
      `,
      [req.platformAuth.user.facility_id, includeNonStaff],
    )
    res.json({
      success: true,
      data: users.rows.map((u) => ({
        id: Number(u.user_id),
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
        username: u.username,
        role: u.primary_storage_role,
        memberId: u.member_id != null ? Number(u.member_id) : null,
        roles: u.storage_roles ?? [],
        staffRoles: u.staff_roles ?? [],
        // Staff suspension is independent from the global credential and any
        // Member Portal capability on the same identity.
        isActive: u.staff_access_active !== false && u.is_active !== false,
        accountActive: u.is_active !== false,
        isMasterAdmin: u.is_owner === true,
        isOwner: u.is_owner === true,
        portalAccess: {
          admin: u.can_access_admin_portal === true,
          coach: u.can_access_coach_portal === true,
          member: u.can_access_member_portal === true,
          memberStatus: u.member_portal_status,
        },
      })),
    })
  })

  app.post('/api/admin/access/users', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    const fullName = String(req.body?.fullName || '').trim()
    const email = req.body?.email ? String(req.body.email).trim() : null
    const username = req.body?.username ? String(req.body.username).trim() : null
    const phone = req.body?.phone ? String(req.body.phone).trim() : null
    const password = String(req.body?.password || '')
    const roles = normalizeStaffStorageRoles(Array.isArray(req.body?.roles) ? req.body.roles : ['ADMIN'])
    if (!fullName || !password || roles.length === 0) {
      return res.status(400).json({ success: false, message: 'Full name, password, and at least one role are required.' })
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' })
    }
    if (!email && !username) {
      return res.status(400).json({ success: false, message: 'Email or username is required.' })
    }
    if ((email && !email.includes('@')) || (username && username.includes('@'))) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email. Usernames cannot contain @.',
      })
    }
    if (roles.includes('MASTER_ADMIN')) {
      return res.status(400).json({
        success: false,
        message: 'The facility Owner is immutable. Create this staff account as Administrator or Coach.',
      })
    }

    const existing = await pool.query(
      `SELECT id
         FROM app_user
        WHERE ($1::text IS NOT NULL AND LOWER(BTRIM(email)) = LOWER(BTRIM($1)))
           OR ($2::text IS NOT NULL AND LOWER(BTRIM(username)) = LOWER(BTRIM($2)))`,
      [email, username],
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email or username already exists.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const created = await client.query(
        `
          INSERT INTO app_user (facility_id, role, email, phone, full_name, username, password_hash, is_active)
          VALUES ($1, $2::user_role, $3, $4, $5, $6, $7, TRUE)
          RETURNING id
        `,
        [req.platformAuth.user.facility_id, roles[0], email, phone, fullName, username, passwordHash],
      )
      const userId = Number(created.rows[0].id)
      for (const role of roles) {
        await client.query(`INSERT INTO app_user_role (user_id, role) VALUES ($1, $2::user_role) ON CONFLICT DO NOTHING`, [userId, role])
      }
      if (roles.some((r) => ['MASTER_ADMIN', 'ADMIN'].includes(r))) {
        await client.query(
          `
            INSERT INTO admin_profile (user_id, is_master_admin)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET is_master_admin = EXCLUDED.is_master_admin, updated_at = now()
          `,
          [userId, roles.includes('MASTER_ADMIN')],
        )
      }
      if (roles.includes('COACH')) {
        await client.query(`INSERT INTO coach_profile (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET is_active = TRUE, updated_at = now()`, [userId])
      }
      await client.query('COMMIT')
      res.json({ success: true, data: { id: userId } })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      const status = error?.code === '23505' ? 409 : 400
      res.status(status).json({
        success: false,
        message: status === 409
          ? 'Email or username already exists.'
          : error?.code === '23514'
            ? 'Enter a valid email. Usernames cannot contain @.'
            : error.message,
      })
    } finally {
      client.release()
    }
  })

  app.get('/api/admin/access/roles', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (_req, res) => {
    const roles = await pool.query(
      `
        SELECT
          r.id,
          r.key,
          r.name,
          r.description,
          r.is_system,
          COALESCE(array_agg(p.key ORDER BY p.key) FILTER (WHERE p.key IS NOT NULL), '{}') as permissions
        FROM role r
        LEFT JOIN role_permission rp ON rp.role_id = r.id
        LEFT JOIN permission p ON p.id = rp.permission_id
        WHERE r.key IN ('MASTER_ADMIN', 'ADMIN', 'COACH')
        GROUP BY r.id
        ORDER BY r.name
      `,
    )
    const permissions = await pool.query(`SELECT id, key, description FROM permission ORDER BY key`)
    res.json({
      success: true,
      data: {
        roles: roles.rows.map((r) => ({
          id: Number(r.id),
          key: r.key,
          name: r.name,
          description: r.description,
          isSystem: r.is_system === true,
          permissions: r.permissions ?? [],
        })),
        permissions: permissions.rows.map((p) => ({
          id: Number(p.id),
          key: p.key,
          description: p.description,
        })),
      },
    })
  })

  app.get('/api/admin/access/users/:userId/permissions', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    const userId = Number(req.params.userId)
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id.' })
    const target = await pool.query(
      'SELECT is_active FROM app_user WHERE id = $1 AND facility_id = $2',
      [userId, req.platformAuth.user.facility_id],
    )
    if (target.rows.length === 0) return res.status(404).json({ success: false, message: 'Staff account not found.' })
    const overrides = await pool.query(
      `
        SELECT p.key, apo.effect
        FROM app_user_permission_override apo
        JOIN permission p ON p.id = apo.permission_id
        WHERE apo.user_id = $1
      `,
      [userId],
    )
    res.json({
      success: true,
      data: {
        allow: overrides.rows.filter((row) => row.effect === 'allow').map((row) => row.key),
        deny: overrides.rows.filter((row) => row.effect === 'deny').map((row) => row.key),
      },
    })
  })

  app.put('/api/admin/access/users/:userId/roles', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    const userId = Number(req.params.userId)
    const roles = normalizeStaffStorageRoles(Array.isArray(req.body?.roles) ? req.body.roles : [])
    if (!Number.isFinite(userId) || roles.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one staff role is required.' })
    }

    try {
      const updated = await updateAccessUserRoles(pool, {
        userId,
        facilityId: Number(req.platformAuth.user.facility_id),
        actorUserId: Number(req.platformAuth.user.id),
        roles,
      })
      res.json({ success: true, data: updated })
    } catch (error) {
      res.status(errorStatus(error, 400)).json({ success: false, message: error.message })
    }
  })

  app.put('/api/admin/access/users/:userId/permissions', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    const userId = Number(req.params.userId)
    const allow = Array.isArray(req.body?.allow) ? req.body.allow.map(String) : []
    const deny = Array.isArray(req.body?.deny) ? req.body.deny.map(String) : []
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id.' })
    const target = await pool.query(
      'SELECT is_active FROM app_user WHERE id = $1 AND facility_id = $2',
      [userId, req.platformAuth.user.facility_id],
    )
    if (target.rows.length === 0) return res.status(404).json({ success: false, message: 'Staff account not found.' })
    if (await isFacilityOwnerUser(pool, userId, req.platformAuth.user.facility_id)) {
      return res.status(400).json({ success: false, message: 'The facility Owner account permissions cannot be changed.' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`DELETE FROM app_user_permission_override WHERE user_id = $1`, [userId])
      for (const [effect, keys] of [['allow', allow], ['deny', deny]]) {
        for (const key of keys) {
          await client.query(
            `
              INSERT INTO app_user_permission_override (user_id, permission_id, effect)
              SELECT $1, id, $3
              FROM permission
              WHERE key = $2
              ON CONFLICT (user_id, permission_id) DO UPDATE SET effect = EXCLUDED.effect, updated_at = now()
            `,
            [userId, key, effect],
          )
        }
      }
      await client.query('COMMIT')
      res.json({ success: true })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      res.status(400).json({ success: false, message: error.message })
    } finally {
      client.release()
    }
  })

  app.patch('/api/admin/access/users/:userId/active', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    const userId = Number(req.params.userId)
    const isActive = req.body?.isActive === true
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id.' })
    const target = await pool.query(
      'SELECT is_active FROM app_user WHERE id = $1 AND facility_id = $2',
      [userId, req.platformAuth.user.facility_id],
    )
    if (target.rows.length === 0) return res.status(404).json({ success: false, message: 'Staff account not found.' })
    if (userId === Number(req.platformAuth.user.id) && !isActive) {
      return res.status(400).json({ success: false, message: 'You cannot suspend your own account.' })
    }
    if (!isActive && (await isFacilityOwnerUser(pool, userId, req.platformAuth.user.facility_id))) {
      return res.status(400).json({ success: false, message: 'The facility Owner account cannot be suspended.' })
    }
    if (isActive && target.rows[0].is_active !== true) {
      return res.status(409).json({
        success: false,
        code: 'LOGIN_ACCOUNT_INACTIVE',
        message: 'The global login account is inactive and must be repaired before staff access can be restored.',
      })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const updated = await client.query(
        `UPDATE app_user
            SET staff_access_active = $3,
                updated_at = now()
          WHERE id = $1
            AND facility_id = $2
          RETURNING staff_access_active`,
        [userId, req.platformAuth.user.facility_id, isActive],
      )
      if (updated.rows.length === 0) {
        const error = new Error('Staff account not found.')
        error.statusCode = 404
        throw error
      }
      await client.query(
        `UPDATE coach_profile profile
            SET is_active = $2, updated_at = now()
           FROM app_user account
          WHERE profile.user_id = $1
            AND account.id = profile.user_id
            AND account.facility_id = $3`,
        [userId, isActive, req.platformAuth.user.facility_id],
      )
      await client.query('COMMIT')
      res.json({ success: true, data: { staffAccessActive: isActive } })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      res.status(errorStatus(error, 500)).json({
        success: false,
        message: errorStatus(error, 500) < 500 ? error.message : 'Internal server error',
      })
    } finally {
      client.release()
    }
  })

  app.put('/api/admin/access/users/:userId', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    const userId = Number(req.params.userId)
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id.' })

    const fullName = req.body?.fullName != null
      ? String(req.body.fullName).trim().replace(/\s+/g, ' ')
      : null
    const email = req.body?.email != null ? String(req.body.email).trim() : null
    const phone = req.body?.phone != null ? String(req.body.phone).trim() : null
    const username = req.body?.username != null ? String(req.body.username).trim() : null
    const address = req.body?.address != null ? String(req.body.address).trim() : null
    const password = req.body?.password ? String(req.body.password) : null

    if (fullName !== null && !fullName) {
      return res.status(400).json({ success: false, message: 'Full name cannot be empty.' })
    }
    if (email !== null && !email) {
      return res.status(400).json({ success: false, message: 'Email cannot be empty.' })
    }
    if (password !== null && password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' })
    }
    if ((email && !email.includes('@')) || (username && username.includes('@'))) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email. Usernames cannot contain @.',
      })
    }

    const updates = []
    const values = []
    let paramCount = 1
    if (fullName !== null) {
      updates.push(`full_name = $${paramCount++}`)
      values.push(fullName)
    }
    if (email !== null) {
      updates.push(`email = $${paramCount++}`)
      values.push(email)
    }
    if (phone !== null) {
      updates.push(`phone = $${paramCount++}`)
      values.push(phone || null)
    }
    if (username !== null) {
      updates.push(`username = $${paramCount++}`)
      values.push(username || null)
    }
    if (address !== null) {
      updates.push(`address = $${paramCount++}`)
      values.push(address || null)
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10)
      updates.push(`password_hash = $${paramCount++}`)
      values.push(passwordHash)
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No changes provided.' })
    }

    const facilityId = Number(req.platformAuth.user.facility_id)
    const actorUserId = Number(req.platformAuth.user.id)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query(
        `SELECT
           account.id,
           account.full_name,
           account.email,
           account.phone,
           account.username,
           account.address,
           (facility.owner_user_id = account.id) AS is_owner
         FROM app_user account
         JOIN facility ON facility.id = account.facility_id
         WHERE account.id = $1
           AND account.facility_id = $2
         FOR UPDATE OF account`,
        [userId, facilityId],
      )
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ success: false, message: 'Account not found.' })
      }
      if (existing.rows[0].is_owner === true && userId !== actorUserId) {
        await client.query('ROLLBACK')
        return res.status(403).json({
          success: false,
          code: 'OWNER_SELF_EDIT_REQUIRED',
          message: 'Only the facility Owner can update their own profile or password.',
        })
      }

      const current = existing.rows[0]
      const nextFullName = fullName ?? current.full_name
      const nextEmail = email ?? current.email
      const nextPhone = phone === null ? current.phone : phone || null
      const nextUsername = username === null ? current.username : username || null
      const nextAddress = address === null ? current.address : address || null
      if (!nextEmail && !nextUsername) {
        await client.query('ROLLBACK')
        return res.status(400).json({ success: false, message: 'Email or username is required.' })
      }

      const conflict = await client.query(
        `SELECT id
           FROM app_user
          WHERE id <> $1
            AND (
              ($2::text IS NOT NULL AND LOWER(BTRIM(email)) = LOWER(BTRIM($2)))
              OR ($3::text IS NOT NULL AND LOWER(BTRIM(username)) = LOWER(BTRIM($3)))
            )
          LIMIT 1`,
        [userId, nextEmail, nextUsername],
      )
      if (conflict.rows.length > 0) {
        await client.query('ROLLBACK')
        return res.status(409).json({ success: false, message: 'Email or username already in use.' })
      }

      const linkedMembers = await client.query(
        `SELECT id
           FROM member
          WHERE app_user_id = $1
            AND facility_id = $2
          ORDER BY id
          FOR UPDATE`,
        [userId, facilityId],
      )
      if (linkedMembers.rows.length > 1) {
        await client.query('ROLLBACK')
        return res.status(409).json({
          success: false,
          code: 'MULTIPLE_LINKED_MEMBER_PROFILES',
          message: 'This staff login is linked to multiple member profiles. Correct the links before editing identity fields.',
        })
      }

      updates.push('updated_at = now()')
      const userIdParam = paramCount++
      values.push(userId)
      const facilityIdParam = paramCount
      values.push(facilityId)
      const updatedAccount = await client.query(
        `UPDATE app_user
            SET ${updates.join(', ')}
          WHERE id = $${userIdParam}
            AND facility_id = $${facilityIdParam}
          RETURNING id`,
        values,
      )
      if (updatedAccount.rowCount !== 1) {
        const error = new Error('Account not found.')
        error.statusCode = 404
        throw error
      }

      if (linkedMembers.rows.length === 1) {
        const nameParts = String(nextFullName || '').trim().split(/\s+/)
        const firstName = nameParts.shift() || ''
        const lastName = nameParts.join(' ')
        await client.query(
          `UPDATE member
              SET first_name = $2,
                  last_name = $3,
                  email = $4,
                  phone = $5,
                  username = $6,
                  address = $7,
                  updated_at = now()
            WHERE id = $1
              AND app_user_id = $8
              AND facility_id = $9`,
          [
            linkedMembers.rows[0].id,
            firstName,
            lastName,
            nextEmail,
            nextPhone,
            nextUsername,
            nextAddress,
            userId,
            facilityId,
          ],
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      if (error?.code === '23505') {
        return res.status(409).json({ success: false, message: 'Email or username already in use.' })
      }
      if (error?.code === '23514') {
        return res.status(400).json({ success: false, message: 'Enter a valid email. Usernames cannot contain @.' })
      }
      const status = errorStatus(error, 500)
      return res.status(status).json({
        success: false,
        message: status < 500 ? error.message : 'Internal server error',
      })
    } finally {
      client.release()
    }

    res.json({ success: true })
  })

  app.delete('/api/admin/access/users/:userId', ...requireFacilityOwner(pool, jwtSecret), async (req, res) => {
    const userId = Number(req.params.userId)
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id.' })
    if (userId === Number(req.platformAuth.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' })
    }
    if (await isFacilityOwnerUser(pool, userId, req.platformAuth.user.facility_id)) {
      return res.status(400).json({ success: false, message: 'The facility Owner account cannot be deleted.' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await deleteAppUserCompletely(client, userId, req.platformAuth.user.facility_id)
      await client.query('COMMIT')
      res.json({ success: true, message: 'Account deleted permanently.' })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      console.error('Delete access user error:', error)
      const status = errorStatus(error, 500)
      res.status(status).json({
        success: false,
        message: status < 500 ? error.message : 'Internal server error',
      })
    } finally {
      client.release()
    }
  })

  app.get('/api/admin/coaches', ...requirePermission(pool, jwtSecret, 'classes.manage'), async (req, res) => {
    await ensureCoachClassAssignmentSchema(pool)
    const schema = await resolveProgramsSchema(pool)
    const coaches = await pool.query(
      `
        SELECT
          au.id,
          au.full_name,
          au.email,
          au.phone,
          au.is_active as account_active,
          cp.bio,
          COALESCE(cp.is_active, true) as coach_active,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', cca.id,
                'programsId', cca.programs_id,
                'programsName', prog_top.display_name,
                'programId', cca.program_id,
                'programName', p.display_name,
                'schedulingFormId', cca.scheduling_form_id,
                'className', sf.title,
                'schedulingOfferingId', cca.scheduling_offering_id,
                'offeringName', so.label,
                'schedulingTimeSlotId', cca.scheduling_time_slot_id,
                'assignmentLabel', trim(both ' — ' from concat_ws(' — ',
                  prog_top.display_name,
                  p.display_name,
                  sf.title,
                  so.label,
                  CASE
                    WHEN sts.id IS NOT NULL THEN concat_ws(' ',
                      CASE sts.day_of_week
                        WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue'
                        WHEN 3 THEN 'Wed' WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri' WHEN 6 THEN 'Sat'
                        ELSE NULL
                      END,
                      COALESCE(sts.specific_date::text, NULL),
                      to_char(sts.start_time, 'HH24:MI'),
                      to_char(sts.end_time, 'HH24:MI')
                    )
                    ELSE NULL
                  END
                ))
              )
            ) FILTER (WHERE cca.id IS NOT NULL),
            '[]'
          ) as assignments
        FROM app_user au
        JOIN coach_profile cp ON cp.user_id = au.id
        LEFT JOIN coach_class_assignment cca ON cca.coach_user_id = au.id
        LEFT JOIN ${schema.programsTable} prog_top ON prog_top.id = cca.programs_id
        LEFT JOIN program p ON p.id = cca.program_id
        LEFT JOIN scheduling_form sf ON sf.id = cca.scheduling_form_id AND sf.deleted_at IS NULL
        LEFT JOIN scheduling_offering so ON so.id = cca.scheduling_offering_id
        LEFT JOIN scheduling_time_slot sts ON sts.id = cca.scheduling_time_slot_id
        WHERE au.facility_id = $1
        GROUP BY au.id, au.is_active, cp.bio, cp.is_active
        ORDER BY au.full_name, au.email
      `,
      [req.platformAuth.user.facility_id],
    )
    res.json({ success: true, data: coaches.rows })
  })

  app.get('/api/admin/coaches/assign-drilldown', ...requirePermission(pool, jwtSecret, 'classes.manage'), async (req, res) => {
    try {
      const data = await queryCoachAssignmentDrilldown(pool, req.platformAuth.user.facility_id, {
        programsId: req.query.programsId,
        classEventId: req.query.classEventId,
        formId: req.query.formId,
        offeringId: req.query.offeringId,
      })
      res.json({ success: true, data })
    } catch (err) {
      res.status(500).json({ success: false, message: err.message || 'Failed to load assignment options.' })
    }
  })

  app.get('/api/admin/coaches/options', ...requirePermission(pool, jwtSecret, 'classes.manage'), async (req, res) => {
    const facilityId = req.platformAuth.user.facility_id
    const usersRes = await pool.query(
      `
        SELECT DISTINCT au.id, au.full_name, au.email
        FROM app_user au
        LEFT JOIN app_user_role aur ON aur.user_id = au.id
        WHERE au.facility_id = $1
          AND au.is_active = TRUE
          AND (au.role::text = 'COACH' OR aur.role::text = 'COACH')
        ORDER BY au.full_name, au.email
      `,
      [facilityId],
    )
    res.json({
      success: true,
      data: {
        users: usersRes.rows,
      },
    })
  })

  app.put('/api/admin/coaches/:userId/profile', ...requirePermission(pool, jwtSecret, 'classes.manage'), async (req, res) => {
    const userId = Number(req.params.userId)
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid coach user id.' })
    const target = await pool.query(
      'SELECT 1 FROM app_user WHERE id = $1 AND facility_id = $2',
      [userId, req.platformAuth.user.facility_id],
    )
    if (target.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Coach account not found.' })
    }
    const updated = await pool.query(
      `
        INSERT INTO coach_profile (user_id, bio, is_active)
        VALUES ($1, $2, COALESCE($3, true))
        ON CONFLICT (user_id) DO UPDATE SET
          bio = EXCLUDED.bio,
          is_active = EXCLUDED.is_active,
          updated_at = now()
        RETURNING *
      `,
      [userId, req.body?.bio || null, req.body?.isActive !== false],
    )
    await pool.query(`INSERT INTO app_user_role (user_id, role) VALUES ($1, 'COACH'::user_role) ON CONFLICT DO NOTHING`, [userId])
    res.json({ success: true, data: updated.rows[0] })
  })

  app.post('/api/admin/coaches/:userId/assignments', ...requirePermission(pool, jwtSecret, 'classes.manage'), async (req, res) => {
    const userId = Number(req.params.userId)
    const facilityId = req.platformAuth.user.facility_id
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid coach user id.' })
    }
    const target = await pool.query(
      'SELECT 1 FROM app_user WHERE id = $1 AND facility_id = $2',
      [userId, facilityId],
    )
    if (target.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Coach account not found.' })
    }
    let payload
    try {
      payload = await resolveCoachAssignmentPayload(pool, facilityId, req.body)
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message || 'Invalid assignment.' })
    }
    await pool.query(`INSERT INTO coach_profile (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET is_active = TRUE, updated_at = now()`, [userId])
    await pool.query(`INSERT INTO app_user_role (user_id, role) VALUES ($1, 'COACH'::user_role) ON CONFLICT DO NOTHING`, [userId])
    const created = await pool.query(
      `
        INSERT INTO coach_class_assignment (
          coach_user_id,
          programs_id,
          program_id,
          scheduling_form_id,
          scheduling_offering_id,
          scheduling_time_slot_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
        RETURNING *
      `,
      [
        userId,
        payload.programs_id,
        payload.program_id,
        payload.scheduling_form_id,
        payload.scheduling_offering_id,
        payload.scheduling_time_slot_id,
      ],
    )
    res.json({ success: true, data: created.rows[0] ?? null })
  })

  app.delete('/api/admin/coaches/assignments/:assignmentId', ...requirePermission(pool, jwtSecret, 'classes.manage'), async (req, res) => {
    const deleted = await pool.query(
      `DELETE FROM coach_class_assignment assignment
       USING app_user coach
       WHERE assignment.id = $1
         AND coach.id = assignment.coach_user_id
         AND coach.facility_id = $2
       RETURNING assignment.id`,
      [Number(req.params.assignmentId), req.platformAuth.user.facility_id],
    )
    if (deleted.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Coach assignment not found.' })
    }
    res.json({ success: true })
  })

  app.get('/api/admin/billing/family-lookup', ...requirePermission(pool, jwtSecret, 'billing.view'), legacyBillingEndpoint, async (req, res) => {
    const query = String(req.query?.q || '').trim()
    if (!query) return res.json({ success: true, data: [] })

    const facilityId = req.platformAuth.user.facility_id
    const numericFamilyId = /^\d+$/.test(query) ? Number(query) : null
    const searchPattern = `%${query}%`

    try {
      const result = await pool.query(
        `
          SELECT DISTINCT
            f.id AS family_id,
            f.family_name,
            fba.id AS billing_account_id,
            m.id AS member_id,
            m.first_name,
            m.last_name,
            m.email,
            m.phone,
            m.address,
            m.billing_street,
            m.billing_city,
            m.billing_state,
            m.billing_zip
          FROM family f
          JOIN member m ON
            m.family_id = f.id
            OR EXISTS (
              SELECT 1
              FROM family_member fm
              WHERE fm.family_id = f.id
                AND fm.member_id = m.id
                AND fm.is_active = TRUE
            )
          LEFT JOIN family_billing_account fba
            ON fba.family_id = f.id
            AND fba.is_active = TRUE
          WHERE f.facility_id = $1
            AND (
              ($2::bigint IS NOT NULL AND f.id = $2)
              OR CONCAT_WS(' ', m.first_name, m.last_name) ILIKE $3
              OR COALESCE(m.email, '') ILIKE $3
              OR COALESCE(m.phone, '') ILIKE $3
              OR (
                regexp_replace($4, '\\D', '', 'g') <> ''
                AND regexp_replace(COALESCE(m.phone, ''), '\\D', '', 'g')
                  LIKE '%' || regexp_replace($4, '\\D', '', 'g') || '%'
              )
              OR COALESCE(m.address, '') ILIKE $3
              OR CONCAT_WS(' ', m.billing_street, m.billing_city, m.billing_state, m.billing_zip) ILIKE $3
            )
          ORDER BY f.id, m.last_name, m.first_name, m.id
          LIMIT 100
        `,
        [facilityId, numericFamilyId, searchPattern, query],
      )

      const families = new Map()
      for (const row of result.rows) {
        const familyId = Number(row.family_id)
        let family = families.get(familyId)
        if (!family) {
          family = {
            familyId,
            familyName: row.family_name,
            billingAccountId: row.billing_account_id == null ? null : Number(row.billing_account_id),
            matchedMembers: [],
          }
          families.set(familyId, family)
        }
        family.matchedMembers.push({
          id: Number(row.member_id),
          name: [row.first_name, row.last_name].filter(Boolean).join(' '),
          email: row.email,
          phone: row.phone,
          address: row.address || [row.billing_street, row.billing_city, row.billing_state, row.billing_zip].filter(Boolean).join(', '),
        })
      }

      res.json({ success: true, data: [...families.values()].slice(0, 25) })
    } catch (err) {
      console.error('[billing] family-lookup:', err)
      res.status(500).json({ success: false, message: 'Failed to search family billing accounts' })
    }
  })

  app.get('/api/admin/billing/payment-registration-report', ...requirePermission(pool, jwtSecret, 'billing.view'), async (req, res) => {
    try {
      const billingScope = authenticatedAdminBillingScope(req.platformAuth)
      const days = req.query.days == null ? 30 : Number(req.query.days)
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return res.status(400).json({ success: false, message: 'days must be an integer from 1 to 365' })
      }
      const data = await buildPaymentRegistrationReport(pool, { days, ...billingScope })
      res.json({ success: true, data })
    } catch (err) {
      console.error('[billing] payment-registration-report:', err)
      res.status(errorStatus(err, 500)).json({ success: false, message: 'Failed to build payment registration report' })
    }
  })

  app.get('/api/admin/families/:familyId/billing-account', ...requirePermission(pool, jwtSecret, 'billing.view'), legacyBillingEndpoint, async (req, res) => {
    try {
      const familyId = Number(req.params.familyId)
      const account = await loadBillingAccountForFacility(pool, {
        familyId,
        facilityId: req.platformAuth?.user?.facility_id ?? null,
      })
      if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
      const view = await buildBillingAccountView(pool, account, { memberScopeId: null })
      res.json({
        success: true,
        data: {
          ...mapBillingAccount(account),
          chargesCents: view.chargesCents,
          paymentsCents: view.paymentsCents,
          refundsCents: view.refundsCents,
          balanceCents: view.balanceCents,
          charges: view.charges.map(mapCharge),
          payments: view.payments.map(mapPayment),
          subscriptions: view.subscriptions,
          subscriptionHistory: view.subscriptionHistory,
          monthlyTotals: view.monthlyTotals,
          membershipRenewsOn: view.membershipRenewsOn ?? null,
          hasActiveMembership: Boolean(view.hasActiveMembership),
          refunds: view.refunds,
          ledger: view.ledger,
          bundlePasses: view.bundlePasses,
          bundleUsage: view.bundleUsage,
          currentPeriod: view.currentPeriod,
          billingHistory: view.billingHistory,
        },
      })
    } catch (err) {
      console.error('[billing] billing-account:', err)
      res.status(500).json({ success: false, message: 'Failed to load billing account' })
    }
  })

  app.get('/api/admin/members/:memberId/missed-classes', ...requirePermission(pool, jwtSecret, 'classes.manage'), async (req, res) => {
    const result = await pool.query(
      `SELECT mc.*, COALESCE(p.display_name, p.name, sf.title) AS class_name
       FROM member_missed_class mc
       JOIN member m ON m.id = mc.member_id
       LEFT JOIN scheduling_signup s ON s.id = mc.scheduling_signup_id
       LEFT JOIN scheduling_form sf ON sf.id = s.form_id
       LEFT JOIN program p ON p.id = sf.program_id
       WHERE mc.member_id = $1
         AND m.facility_id = $2
       ORDER BY mc.missed_on DESC, mc.id DESC`,
      [Number(req.params.memberId), req.platformAuth.user.facility_id],
    )
    res.json({ success: true, data: result.rows })
  })

  app.post('/api/admin/members/:memberId/missed-classes', ...requirePermission(pool, jwtSecret, 'classes.manage'), async (req, res) => {
    const missedOn = String(req.body?.missedOn || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(missedOn)) return res.status(400).json({ success: false, message: 'A missed class date is required.' })
    const status = req.body?.approvalStatus || 'pending'
    if (!['pending', 'approved', 'declined'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid approval status.' })
    const actor = req.platformAuth?.user?.id ?? null
    const result = await pool.query(
      `INSERT INTO member_missed_class
       (member_id, scheduling_signup_id, missed_on, reason, approval_status, approval_note,
        recorded_by_user_id, reviewed_by_user_id, reviewed_at)
       SELECT member_row.id,$2,$3,$4,$5,$6,$7,
              CASE WHEN $5='pending' THEN NULL ELSE $7 END,
              CASE WHEN $5='pending' THEN NULL ELSE now() END
       FROM member member_row
       WHERE member_row.id = $1
         AND member_row.facility_id = $8
         AND (
           $2::bigint IS NULL
           OR EXISTS (
             SELECT 1 FROM scheduling_signup signup
             WHERE signup.id = $2 AND signup.member_id = member_row.id
           )
         )
       RETURNING *`,
      [Number(req.params.memberId), req.body?.signupId || null, missedOn, req.body?.reason || null, status, req.body?.approvalNote || null, actor, req.platformAuth.user.facility_id],
    )
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Member or signup not found.' })
    res.json({ success: true, data: result.rows[0] })
  })

  app.patch('/api/admin/members/:memberId/missed-classes/:id', ...requirePermission(pool, jwtSecret, 'classes.manage'), async (req, res) => {
    const status = req.body?.approvalStatus
    if (!['approved', 'declined'].includes(status)) return res.status(400).json({ success: false, message: 'Approval must be approved or declined.' })
    if (!String(req.body?.approvalNote || '').trim()) return res.status(400).json({ success: false, message: 'An approval note is required.' })
    const result = await pool.query(
      `UPDATE member_missed_class record SET approval_status=$3, approval_note=$4,
       reviewed_by_user_id=$5, reviewed_at=now(), updated_at=now()
       FROM member member_row
       WHERE record.id=$1
         AND record.member_id=$2
         AND member_row.id=record.member_id
         AND member_row.facility_id=$6
       RETURNING record.*`,
      [Number(req.params.id), Number(req.params.memberId), status, String(req.body.approvalNote).trim(), req.platformAuth?.user?.id ?? null, req.platformAuth.user.facility_id],
    )
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Missed-class record not found.' })
    res.json({ success: true, data: result.rows[0] })
  })

  app.put('/api/admin/families/:familyId/billing-account', ...requirePermission(pool, jwtSecret, 'family_billing.manage'), legacyBillingEndpoint, async (req, res) => {
    const familyId = Number(req.params.familyId)
    const facilityId = req.platformAuth?.user?.facility_id ?? null
    const beforeAccount = await loadBillingAccountForFacility(pool, {
      familyId,
      facilityId,
    })
    if (!beforeAccount) return res.status(404).json({ success: false, message: 'Family not found.' })
    const payerMemberId = req.body?.payerMemberId == null ? null : Number(req.body.payerMemberId)
    if (!(await memberBelongsToFamily(pool, payerMemberId, familyId, facilityId))) {
      return res.status(400).json({ success: false, message: 'Payer must belong to this family.' })
    }
    const updated = await pool.query(
      `
        UPDATE family_billing_account
        SET payer_member_id = $2,
            billing_email = $3,
            billing_phone = $4,
            billing_street = $5,
            billing_city = $6,
            billing_state = $7,
            billing_zip = $8,
            is_active = COALESCE($9, is_active),
            updated_at = now()
        WHERE family_id = $1
        RETURNING *
      `,
      [
        familyId,
        payerMemberId,
        req.body?.billingEmail ?? null,
        req.body?.billingPhone ?? null,
        req.body?.billingStreet ?? null,
        req.body?.billingCity ?? null,
        req.body?.billingState ?? null,
        req.body?.billingZip ?? null,
        typeof req.body?.isActive === 'boolean' ? req.body.isActive : null,
      ],
    )
    await recordBillingActivityBestEffort(pool, {
      eventKey: `billing-contact-updated:${updated.rows[0].id}:${new Date(updated.rows[0].updated_at).getTime()}`,
      accountId: updated.rows[0].id,
      eventType: 'billing_contact_updated',
      summary: 'Household billing contact was updated.',
      beforeValue: mapBillingAccount(beforeAccount),
      afterValue: mapBillingAccount(updated.rows[0]),
      actorUserId: req.platformAuth?.user?.id ?? null,
    })
    res.json({ success: true, data: mapBillingAccount(updated.rows[0]) })
  })

  app.post('/api/admin/families/:familyId/charges', ...requirePermission(pool, jwtSecret, 'billing.manage'), legacyBillingEndpoint, async (req, res) => {
    const familyId = Number(req.params.familyId)
    const facilityId = req.platformAuth?.user?.facility_id ?? null
    const account = await loadBillingAccountForFacility(pool, { familyId, facilityId })
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    const memberId = req.body?.memberId == null ? null : Number(req.body.memberId)
    if (!(await memberBelongsToFamily(pool, memberId, familyId, facilityId))) {
      return res.status(400).json({ success: false, message: 'Charge member must belong to this family.' })
    }
    let validated
    try {
      validated = validateManualChargeInput({
        description: req.body?.description,
        amountCents: req.body?.amountCents,
        chargeType: req.body?.chargeType,
        grossAmountCents: req.body?.grossAmountCents,
        discountAmountCents: req.body?.discountAmountCents,
        createdByUserId: req.platformAuth?.user?.id ?? null,
      })
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message })
    }
    const billingInterval = validated.chargeType === 'recurring' ? 'month' : 'one_time'
    const charge = await pool.query(
      `
        INSERT INTO billing_charge (
          family_billing_account_id, member_id, source_type, source_id,
          description, amount_cents, gross_amount_cents, discount_amount_cents,
          charge_type, billing_interval, service_period_start, service_period_end,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `,
      [
        account.id,
        memberId,
        req.body?.sourceType ?? 'manual',
        req.body?.sourceId ?? null,
        validated.description,
        validated.amount,
        validated.gross,
        validated.discount,
        validated.chargeType,
        billingInterval,
        req.body?.servicePeriodStart ?? null,
        req.body?.servicePeriodEnd ?? null,
        validated.createdByUserId,
      ],
    )
    await recordBillingActivityBestEffort(pool, {
      eventKey: `legacy-charge-created:${charge.rows[0].id}`,
      accountId: account.id,
      memberId: charge.rows[0].member_id,
      chargeId: charge.rows[0].id,
      eventType: 'ledger_charge_created',
      summary: `Ledger charge created: ${charge.rows[0].description}.`,
      afterValue: mapCharge(charge.rows[0]),
      actorUserId: req.platformAuth?.user?.id ?? null,
    })
    res.json({ success: true, data: mapCharge(charge.rows[0]) })
  })

  app.get('/api/admin/families/:familyId/charges', ...requirePermission(pool, jwtSecret, 'billing.view'), legacyBillingEndpoint, async (req, res) => {
    const account = await loadBillingAccountForFacility(pool, {
      familyId: Number(req.params.familyId),
      facilityId: req.platformAuth?.user?.facility_id ?? null,
    })
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    const charges = await pool.query(
      `
        SELECT c.*, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name
        FROM billing_charge c
        LEFT JOIN member m ON m.id = c.member_id
        WHERE c.family_billing_account_id = $1
        ORDER BY c.created_at DESC, c.id DESC
      `,
      [account.id],
    )
    res.json({ success: true, data: charges.rows.map(mapCharge) })
  })

  app.get('/api/admin/families/:familyId/payments', ...requirePermission(pool, jwtSecret, 'billing.view'), legacyBillingEndpoint, async (req, res) => {
    const account = await loadBillingAccountForFacility(pool, {
      familyId: Number(req.params.familyId),
      facilityId: req.platformAuth?.user?.facility_id ?? null,
    })
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    const payments = await pool.query(
      `SELECT * FROM billing_payment WHERE family_billing_account_id = $1 ORDER BY paid_at DESC, id DESC`,
      [account.id],
    )
    res.json({ success: true, data: payments.rows.map(mapPayment) })
  })

  app.get('/api/admin/families/:familyId/billing-actions', ...requirePermission(pool, jwtSecret, 'billing.view'), legacyBillingEndpoint, async (req, res) => {
    const account = await loadBillingAccountForFacility(pool, {
      familyId: Number(req.params.familyId),
      facilityId: req.platformAuth?.user?.facility_id ?? null,
    })
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    res.json({ success: true, data: await listBillingAdminActions(pool, account.id) })
  })

  app.post('/api/admin/families/:familyId/payment-link', ...requirePermission(pool, jwtSecret, 'billing.manage'), legacyBillingEndpoint, async (req, res) => {
    if (!isStripeEnabled()) {
      return res.status(503).json({ success: false, message: 'Stripe is not enabled.' })
    }
    const account = await loadBillingAccountForFacility(pool, {
      familyId: Number(req.params.familyId),
      facilityId: req.platformAuth?.user?.facility_id ?? null,
    })
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    let action = null
    try {
      const base = publicAppUrl()
      const session = await createCustomerBalanceCheckoutSession(pool, {
        account,
        successUrl: `${base}/?billing=paid`,
        cancelUrl: `${base}/?billing=cancelled`,
        idempotencyKey: req.get('Idempotency-Key')
          ? `legacy-admin-balance-checkout:${String(req.get('Idempotency-Key')).slice(0, 120)}`
          : null,
        attemptType: 'admin_balance_checkout',
      })
      if (!session?.url) throw new Error('Stripe did not return a checkout URL.')
      action = await beginBillingAdminAction(pool, {
        accountId: account.id,
        actionType: 'payment_link_sent',
        amountCents: session.amountCents,
        stripeObjectId: session.id ?? null,
        initiatedByUserId: req.platformAuth?.user?.id ?? null,
        details: { expiresAt: session.expiresAt },
      })
      const delivery = await notifyPaymentRequest(pool, {
        account,
        amountCents: session.amountCents,
        checkoutUrl: session.url,
        expiresAt: session.expiresAt,
        idempotencyKey: `admin-payment-request-${action.id}`,
        bestEffort: false,
      })
      if (!delivery.sent) {
        await finishBillingAdminAction(pool, action.id, {
          status: 'failed',
          errorMessage: delivery.reason || 'No billing recipient was available.',
        })
        return res.status(422).json({
          success: false,
          message: 'The secure link was created, but no billing email could receive it.',
          data: { url: session.url, expiresAt: session.expiresAt },
        })
      }
      const completed = await finishBillingAdminAction(pool, action.id, {
        status: 'succeeded',
        recipientEmail: delivery.email,
        details: { recipientEmail: delivery.email },
      })
      await recordBillingActivityBestEffort(pool, {
        eventKey: `payment-link-sent:${action.id}`,
        accountId: account.id,
        eventType: 'payment_link_sent',
        summary: `Secure ${balanceCents}-cent account-balance payment link sent.`,
        details: { amountCents: balanceCents, recipientEmail: delivery.email, expiresAt: session.expiresAt },
        stripeObjectId: session.id,
        actorUserId: req.platformAuth?.user?.id ?? null,
      })
      res.json({
        success: true,
        data: {
          url: session.url,
          expiresAt: session.expiresAt,
          amountCents: balanceCents,
          recipientEmail: delivery.email,
          action: completed,
        },
      })
    } catch (error) {
      if (action?.id) {
        await finishBillingAdminAction(pool, action.id, {
          status: 'failed',
          errorMessage: String(error?.message ?? error).slice(0, 1000),
        }).catch(() => {})
      }
      console.error('[stripe] admin payment link:', error)
      res.status(500).json({ success: false, message: error?.message || 'Failed to send payment link.' })
    }
  })

  app.post('/api/admin/families/:familyId/payments/:paymentId/resend-receipt', ...requirePermission(pool, jwtSecret, 'billing.manage'), legacyBillingEndpoint, async (req, res) => {
    const account = await loadBillingAccountForFacility(pool, {
      familyId: Number(req.params.familyId),
      facilityId: req.platformAuth?.user?.facility_id ?? null,
    })
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    const paymentResult = await pool.query(
      `SELECT * FROM billing_payment WHERE id = $1 AND family_billing_account_id = $2`,
      [Number(req.params.paymentId), account.id],
    )
    const payment = paymentResult.rows[0]
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' })
    const action = await beginBillingAdminAction(pool, {
      accountId: account.id,
      actionType: 'payment_receipt_resent',
      amountCents: Number(payment.amount_cents),
      paymentId: payment.id,
      initiatedByUserId: req.platformAuth?.user?.id ?? null,
    })
    try {
      const delivery = await notifyPaymentReceipt(pool, {
        account,
        payment,
        billingUrl: `${publicAppUrl()}/?billing=portal-return`,
        bestEffort: false,
        idempotencyKey: `admin-payment-receipt-${action.id}`,
      })
      if (!delivery.sent) throw new Error(delivery.reason || 'No billing recipient was available.')
      await finishBillingAdminAction(pool, action.id, {
        status: 'succeeded',
        recipientEmail: delivery.email,
        details: { recipientEmail: delivery.email },
      })
      await recordBillingActivityBestEffort(pool, {
        eventKey: `payment-receipt-resent:${action.id}`,
        accountId: account.id,
        paymentId: payment.id,
        eventType: 'payment_receipt_resent',
        summary: `Payment #${payment.id} receipt was resent.`,
        details: { recipientEmail: delivery.email },
        actorUserId: req.platformAuth?.user?.id ?? null,
      })
      res.json({ success: true, data: { recipientEmail: delivery.email } })
    } catch (error) {
      await finishBillingAdminAction(pool, action.id, {
        status: 'failed',
        errorMessage: String(error?.message ?? error).slice(0, 1000),
      }).catch(() => {})
      res.status(422).json({ success: false, message: error?.message || 'Failed to resend receipt.' })
    }
  })

  app.post('/api/admin/families/:familyId/refunds/:refundId/resend-receipt', ...requirePermission(pool, jwtSecret, 'billing.manage'), legacyBillingEndpoint, async (req, res) => {
    const account = await loadBillingAccountForFacility(pool, {
      familyId: Number(req.params.familyId),
      facilityId: req.platformAuth?.user?.facility_id ?? null,
    })
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    const refundResult = await pool.query(
      `SELECT * FROM billing_refund WHERE id = $1 AND family_billing_account_id = $2`,
      [Number(req.params.refundId), account.id],
    )
    const refund = refundResult.rows[0]
    if (!refund) return res.status(404).json({ success: false, message: 'Refund not found.' })
    if (refund.external_status !== 'succeeded') {
      return res.status(409).json({ success: false, message: 'Only completed refunds can receive a receipt.' })
    }
    const action = await beginBillingAdminAction(pool, {
      accountId: account.id,
      actionType: 'refund_receipt_resent',
      amountCents: Number(refund.amount_cents),
      refundId: refund.id,
      initiatedByUserId: req.platformAuth?.user?.id ?? null,
    })
    try {
      const delivery = await notifyRefundReceipt(pool, {
        account,
        refund,
        billingUrl: `${publicAppUrl()}/?billing=portal-return`,
        idempotencyKey: `admin-refund-receipt-${action.id}`,
        bestEffort: false,
      })
      if (!delivery.sent) throw new Error(delivery.reason || 'No billing recipient was available.')
      await finishBillingAdminAction(pool, action.id, {
        status: 'succeeded',
        recipientEmail: delivery.email,
        details: { recipientEmail: delivery.email },
      })
      await recordBillingActivityBestEffort(pool, {
        eventKey: `refund-receipt-resent:${action.id}`,
        accountId: account.id,
        refundId: refund.id,
        eventType: 'refund_receipt_resent',
        summary: `Refund #${refund.id} receipt was resent.`,
        details: { recipientEmail: delivery.email },
        actorUserId: req.platformAuth?.user?.id ?? null,
      })
      res.json({ success: true, data: { recipientEmail: delivery.email } })
    } catch (error) {
      await finishBillingAdminAction(pool, action.id, {
        status: 'failed',
        errorMessage: String(error?.message ?? error).slice(0, 1000),
      }).catch(() => {})
      res.status(422).json({ success: false, message: error?.message || 'Failed to resend receipt.' })
    }
  })

  app.get('/api/admin/billing/provider-config', ...requirePermission(pool, jwtSecret, 'billing.view'), async (_req, res) => {
    const provider = process.env.PAYMENTS_PROVIDER || 'external'
    const stripeEnabled = process.env.STRIPE_ENABLED === 'true'
    res.json({
      success: true,
      data: {
        provider,
        stripeEnabled,
        externalProcessorName: process.env.EXTERNAL_PAYMENT_PROCESSOR_NAME || 'External Payment Processor',
      },
    })
  })

  app.post('/api/admin/families/:familyId/payments', ...requirePermission(pool, jwtSecret, 'billing.manage'), legacyBillingEndpoint, async (req, res) => {
    const account = await loadBillingAccountForFacility(pool, {
      familyId: Number(req.params.familyId),
      facilityId: req.platformAuth?.user?.facility_id ?? null,
    })
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    let validated
    try {
      validated = validateManualPaymentInput({
        amountCents: req.body?.amountCents,
        method: req.body?.method,
        note: req.body?.note ?? req.body?.notes,
        recordedByUserId: req.platformAuth?.user?.id ?? null,
      })
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message })
    }
    let externalStatus
    try {
      externalStatus = normalizeLegacyManualPaymentStatus(req.body?.externalStatus)
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message })
    }
    let paymentRow
    await withHouseholdMonthlyInvoiceAccountLock(pool, account.id, async (client) => {
      const payment = await client.query(
        `
          INSERT INTO billing_payment (
            family_billing_account_id,
            amount_cents,
            paid_at,
            method,
            note,
            external_processor,
            external_reference,
            external_status,
            stripe_customer_id,
            stripe_payment_intent_id,
            recorded_by_user_id
          )
          VALUES ($1, $2, COALESCE($3::timestamptz, now()), $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `,
        [
          account.id,
          validated.amount,
          req.body?.paidAt ?? req.body?.paymentDate ?? null,
          validated.method,
          validated.note,
          req.body?.externalProcessor ?? process.env.PAYMENTS_PROVIDER ?? 'external',
          req.body?.externalReference ?? null,
          externalStatus,
          req.body?.stripeCustomerId ?? null,
          req.body?.stripePaymentIntentId ?? null,
          validated.recordedByUserId,
        ],
      )
      paymentRow = payment.rows[0]
      await allocateHouseholdPayments(client, { accountId: account.id, actorType: 'admin' })
      await recordBillingActivityBestEffort(client, {
        eventKey: `manual-payment-recorded:${paymentRow.id}`,
        accountId: account.id,
        paymentId: paymentRow.id,
        eventType: 'manual_payment_recorded',
        summary: 'External or manual payment was recorded.',
        afterValue: mapPayment(paymentRow),
        actorUserId: req.platformAuth?.user?.id ?? null,
      })
    })
    res.json({ success: true, data: mapPayment(paymentRow) })
    notifyPaymentReceipt(pool, {
      account,
      payment: paymentRow,
      billingUrl: `${publicAppUrl()}/?billing=portal-return`,
    }).catch(() => {})
  })

  app.post('/api/admin/families/:familyId/refunds', ...requirePermission(pool, jwtSecret, 'billing.manage'), legacyBillingEndpoint, async (req, res) => {
    const account = await loadBillingAccountForFacility(pool, {
      familyId: Number(req.params.familyId),
      facilityId: req.platformAuth?.user?.facility_id ?? null,
    })
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    const amountCents = Number(req.body?.amountCents)
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({ success: false, message: 'Positive amountCents is required.' })
    }
    const paymentId = req.body?.paymentId != null ? Number(req.body.paymentId) : null
    const createdBy = req.platformAuth?.user?.id ?? null
    try {
      const refund = await createBillingRefund(pool, {
        accountId: account.id,
        paymentId,
        amountCents,
        reason: req.body?.reason ?? null,
        externalReference: req.body?.externalReference ?? null,
        createdByUserId: createdBy,
        exceptionCategory: req.body?.exceptionCategory ?? null,
        evidenceNote: req.body?.evidenceNote ?? null,
      })
      await recordBillingActivityBestEffort(pool, {
        eventKey: `legacy-refund-created:${refund.id}`,
        accountId: account.id,
        paymentId,
        refundId: refund.id,
        eventType: refund.external_status === 'succeeded' ? 'refund_succeeded' : 'refund_created',
        summary: `Refund #${refund.id} was created.`,
        afterValue: { amountCents, status: refund.external_status },
        stripeObjectId: refund.stripe_refund_id ?? null,
        actorUserId: createdBy,
      })
      res.json({ success: true, data: refund })
      notifyRefundReceipt(pool, {
        account,
        refund,
        billingUrl: `${publicAppUrl()}/?billing=portal-return`,
      }).catch(() => {})
    } catch (error) {
      console.error('[stripe] refund:', error)
      res.status(400).json({ success: false, message: error?.message ?? 'Refund failed.' })
    }
  })

  app.patch(
    '/api/admin/subscriptions/:id/status',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    legacyBillingEndpoint,
    rejectDirectSubscriptionStatusWrite,
  )

  app.post(
    '/api/admin/members/:memberId/passes/:passId/adjust',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    legacyBillingEndpoint,
    rejectLegacyPassAdjustmentWrite,
  )

  app.get('/api/admin/families/:familyId/statements', ...requirePermission(pool, jwtSecret, 'billing.view'), async (req, res) => {
    try {
      const account = await loadBillingAccountForFacility(pool, {
        familyId: Number(req.params.familyId),
        facilityId: req.platformAuth?.user?.facility_id ?? null,
      })
      if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
      const statements = await pool.query(
        `SELECT * FROM billing_statement WHERE family_billing_account_id = $1 ORDER BY statement_date DESC, id DESC`,
        [account.id],
      )
      const statementIds = statements.rows.map((s) => s.id)
      let lines = { rows: [] }
      if (statementIds.length > 0) {
        lines = await pool.query(
          `
            SELECT *
            FROM billing_statement_line
            WHERE statement_id = ANY($1::bigint[])
            ORDER BY id
          `,
          [statementIds],
        )
      }
      const byStatement = new Map()
      for (const line of lines.rows) {
        const list = byStatement.get(String(line.statement_id)) ?? []
        list.push(line)
        byStatement.set(String(line.statement_id), list)
      }
      res.json({
        success: true,
        data: statements.rows.map((s) => mapStatement(s, byStatement.get(String(s.id)) ?? [])),
      })
    } catch (err) {
      console.error('[billing] statements:', err)
      res.status(500).json({ success: false, message: 'Failed to load statements' })
    }
  })

  app.post(
    '/api/admin/families/:familyId/statements',
    ...requirePermission(pool, jwtSecret, 'billing.statements.manage'),
    legacyBillingEndpoint,
    rejectLegacyStatementWrite,
  )

  app.patch(
    '/api/admin/statements/:statementId/status',
    ...requirePermission(pool, jwtSecret, 'billing.statements.manage'),
    legacyBillingEndpoint,
    rejectLegacyStatementWrite,
  )

  app.get('/api/admin/waivers/templates', ...requirePermission(pool, jwtSecret, 'waivers.view'), async (req, res) => {
    const templates = await pool.query(
      `SELECT *
         FROM waiver_template
        WHERE facility_id = $1
        ORDER BY active_from DESC, id DESC`,
      [req.platformAuth.user.facility_id],
    )
    res.json({ success: true, data: templates.rows })
  })

  app.post('/api/admin/waivers/templates', ...requirePermission(pool, jwtSecret, 'waivers.manage'), async (req, res) => {
    const facilityId = req.platformAuth.user.facility_id
    if (!req.body?.name || !req.body?.version || !req.body?.body) {
      return res.status(400).json({ success: false, message: 'name, version, and body are required.' })
    }
    const waiverType = req.body?.waiverType ?? req.body?.waiver_type ?? null
    const isRequired = waiverType === 'MEDIA_RELEASE'
      ? false
      : req.body?.isRequired !== false && req.body?.is_required !== false
    const created = await pool.query(
      `
        INSERT INTO waiver_template (
          facility_id, name, version, body, waiver_type, is_required,
          active_from, active_to, requires_resign
        )
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now()), $8::timestamptz, COALESCE($9, false))
        RETURNING *
      `,
      [
        facilityId,
        req.body.name,
        req.body.version,
        req.body.body,
        waiverType || null,
        isRequired,
        req.body?.activeFrom ?? null,
        req.body?.activeTo ?? null,
        req.body?.requiresResign === true,
      ],
    )
    res.json({ success: true, data: created.rows[0] })
  })

  app.patch('/api/admin/waivers/templates/:templateId/retire', ...requirePermission(pool, jwtSecret, 'waivers.manage'), async (req, res) => {
    const updated = await pool.query(
      `UPDATE waiver_template
          SET active_to = COALESCE($2::timestamptz, now()), updated_at = now()
        WHERE id = $1
          AND facility_id = $3
        RETURNING *`,
      [
        Number(req.params.templateId),
        req.body?.activeTo ?? null,
        req.platformAuth.user.facility_id,
      ],
    )
    if (updated.rows.length === 0) return res.status(404).json({ success: false, message: 'Waiver template not found.' })
    res.json({ success: true, data: updated.rows[0] })
  })

  app.get('/api/admin/waivers/compliance', ...requirePermission(pool, jwtSecret, 'waivers.view'), async (req, res) => {
    const result = await pool.query(
      `
        WITH active_templates AS (
          SELECT id, facility_id
          FROM waiver_template
          WHERE active_from <= now()
            AND (active_to IS NULL OR active_to > now())
            AND is_required = TRUE
        )
        SELECT
          m.id,
          m.first_name,
          m.last_name,
          m.email,
          f.id as family_id,
          f.family_name,
          COUNT(DISTINCT at.id)::int as required_count,
          COUNT(DISTINCT mwa.waiver_template_id)::int as accepted_count,
          MAX(mwa.accepted_at) as last_accepted_at
        FROM member m
        LEFT JOIN family_member fm ON fm.member_id = m.id AND fm.is_active = TRUE
        LEFT JOIN family f ON f.id = fm.family_id
        LEFT JOIN active_templates at ON at.facility_id = m.facility_id
        LEFT JOIN member_waiver_acceptance mwa
          ON mwa.member_id = m.id
         AND mwa.waiver_template_id = at.id
        WHERE m.facility_id = $1
          AND m.is_active = TRUE
        GROUP BY m.id, f.id
        ORDER BY (COUNT(DISTINCT at.id) = COUNT(DISTINCT mwa.waiver_template_id)), m.last_name, m.first_name
      `,
      [req.platformAuth.user.facility_id],
    )
    res.json({ success: true, data: result.rows })
  })

  // Email a single member (or their guardian) asking them to sign in-app waivers.
  app.post('/api/admin/members/:memberId/waivers/request', ...requirePermission(pool, jwtSecret, 'waivers.manage'), async (req, res) => {
    const memberId = Number(req.params.memberId)
    if (!Number.isFinite(memberId)) {
      return res.status(400).json({ success: false, message: 'Invalid member id.' })
    }
    const memberRes = await pool.query(
      `SELECT
         member_row.id,
         member_row.first_name,
         member_row.last_name,
         member_row.facility_id
       FROM member member_row
       WHERE member_row.id = $1
         AND member_row.facility_id = $2
         AND member_row.is_active = TRUE`,
      [memberId, req.platformAuth.user.facility_id],
    )
    if (memberRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found.' })
    }
    const member = memberRes.rows[0]
    const recipient = await resolveWaiverRecipient(pool, member)
    if (!recipient) {
      return res.status(422).json({ success: false, message: 'No email on file for this member or their guardians.' })
    }

    try {
      await sendWaiverRequestEmail({
        to: recipient.email,
        athleteName: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
        guardianName: recipient.guardianName,
        outstandingCount: Number(req.body?.outstandingCount) || 0,
      })
      res.json({ success: true, message: `Waiver request sent to ${recipient.email}` })
    } catch (err) {
      console.error('[waivers] request email failed:', err?.message || err)
      res.status(502).json({ success: false, message: err?.message || 'Failed to send waiver request.' })
    }
  })

  // Email all non-compliant members in the facility (best-effort, batched).
  app.post('/api/admin/waivers/request-all', ...requirePermission(pool, jwtSecret, 'waivers.manage'), async (req, res) => {
    const facilityId = req.platformAuth.user.facility_id
    const nonCompliant = await pool.query(
      `
        WITH active_templates AS (
          SELECT id, facility_id
          FROM waiver_template
          WHERE active_from <= now()
            AND (active_to IS NULL OR active_to > now())
            AND is_required = TRUE
        )
        SELECT
          m.id,
          m.first_name,
          m.last_name,
          m.facility_id,
          COUNT(DISTINCT at.id)::int AS required_count,
          COUNT(DISTINCT mwa.waiver_template_id)::int AS accepted_count
        FROM member m
        LEFT JOIN active_templates at ON at.facility_id = m.facility_id
        LEFT JOIN member_waiver_acceptance mwa
          ON mwa.member_id = m.id AND mwa.waiver_template_id = at.id
        WHERE m.facility_id = $1 AND m.is_active = TRUE
        GROUP BY m.id
        HAVING COUNT(DISTINCT at.id) > COUNT(DISTINCT mwa.waiver_template_id)
      `,
      [facilityId],
    )

    let sent = 0
    let skipped = 0
    let failed = 0
    for (const member of nonCompliant.rows) {
      const recipient = await resolveWaiverRecipient(pool, member)
      if (!recipient) {
        skipped += 1
        continue
      }
      try {
        await sendWaiverRequestEmail({
          to: recipient.email,
          athleteName: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
          guardianName: recipient.guardianName,
          outstandingCount: Number(member.required_count) - Number(member.accepted_count),
        })
        sent += 1
      } catch (err) {
        console.warn('[waivers] bulk request email failed for member', member.id, err?.message || err)
        failed += 1
      }
    }

    res.json({
      success: true,
      message: `Sent ${sent}, skipped ${skipped} (no email), failed ${failed}.`,
      data: { sent, skipped, failed, total: nonCompliant.rows.length },
    })
  })

  app.get('/api/admin/members/:memberId/waivers', ...requirePermission(pool, jwtSecret, 'waivers.view'), async (req, res) => {
    const memberId = Number(req.params.memberId)
    const result = await pool.query(
      `
        SELECT
          wt.*,
          mwa.id as acceptance_id,
          mwa.accepted_at,
          mwa.signature_name,
          mwa.accepted_by_member_id
        FROM member m
        JOIN waiver_template wt ON wt.facility_id = m.facility_id
        LEFT JOIN member_waiver_acceptance mwa
          ON mwa.waiver_template_id = wt.id AND mwa.member_id = m.id
        WHERE m.id = $1
          AND m.facility_id = $2
          AND wt.active_from <= now()
          AND (wt.active_to IS NULL OR wt.active_to > now())
        ORDER BY wt.name, wt.version
      `,
      [memberId, req.platformAuth.user.facility_id],
    )
    res.json({ success: true, data: result.rows })
  })

  app.post('/api/admin/members/:memberId/waivers/acceptance', ...requirePermission(pool, jwtSecret, 'waivers.manage'), async (req, res) => {
    const memberId = Number(req.params.memberId)
    const waiverTemplateId = Number(req.body?.waiverTemplateId)
    const acceptedByMemberId = Number(req.body?.acceptedByMemberId)
    const signatureName = String(req.body?.signatureName || '').trim()
    if (!Number.isSafeInteger(memberId) || memberId <= 0
      || !Number.isSafeInteger(waiverTemplateId) || waiverTemplateId <= 0
      || !Number.isSafeInteger(acceptedByMemberId) || acceptedByMemberId <= 0
      || !signatureName) {
      return res.status(400).json({
        success: false,
        message: 'A member, active waiver, adult signer, and signature name are required.',
      })
    }
    const authorization = await canSignWaiversForMembers(pool, acceptedByMemberId, [memberId])
    if (!authorization.ok || Number(authorization.facilityId) !== Number(req.platformAuth.user.facility_id)) {
      return res.status(403).json({
        success: false,
        message: authorization.ok
          ? 'The signer does not belong to this facility.'
          : authorization.message,
      })
    }
    const created = await pool.query(
      `
        INSERT INTO member_waiver_acceptance (
          member_id, waiver_template_id, accepted_by_member_id,
          signature_name, ip_address, user_agent
        )
        SELECT target.id, template.id, $3, $4, $5, $6
        FROM member target
        JOIN waiver_template template
          ON template.id = $2
         AND template.facility_id = target.facility_id
         AND template.active_from <= now()
         AND (template.active_to IS NULL OR template.active_to > now())
        WHERE target.id = $1
          AND target.facility_id = $7
          AND target.is_active = TRUE
        ON CONFLICT (member_id, waiver_template_id) DO UPDATE SET
          accepted_by_member_id = EXCLUDED.accepted_by_member_id,
          accepted_at = now(),
          signature_name = EXCLUDED.signature_name,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent
        RETURNING *
      `,
      [
        memberId,
        waiverTemplateId,
        acceptedByMemberId,
        signatureName,
        req.ip,
        req.get('user-agent') ?? null,
        req.platformAuth.user.facility_id,
      ],
    )
    if (!created.rows[0]) {
      return res.status(404).json({ success: false, message: 'Member or waiver template not found.' })
    }
    res.json({ success: true, data: created.rows[0] })
  })

  app.get('/api/members/multi-class-passes', ...memberBillingAuthMiddleware(pool, jwtSecret), async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = linkedPlatformMemberId(ctx)
      const familyId = await resolveActiveMemberBillingFamilyId(pool, {
        memberId,
        facilityId: ctx.user.facility_id ?? null,
      })
      const { loadMemberPassBalances } = await import('../programs/multiClassPass.js')

      let canSeeFamily = false
      if (familyId) {
        const account = await ensureCustomerBillingAccount(pool, familyId, ctx.user.facility_id ?? null)
        canSeeFamily = Boolean(account) && Number(account.payer_member_id) === memberId
      }

      let memberIds = [memberId]
      if (canSeeFamily && familyId) {
        memberIds = await listActiveFamilyMemberIds(pool, familyId, { fallbackMemberId: memberId })
      }

      const all = []
      for (const mid of memberIds) {
        const rows = await loadMemberPassBalances(pool, mid)
        all.push(...rows.map((r) => ({ ...r, memberId: mid })))
      }

      res.json({ success: true, data: all })
    } catch (err) {
      console.error('[members] multi-class passes:', err)
      res.status(500).json({ success: false, message: 'Failed to load multi-class passes' })
    }
  })

  app.get('/api/members/billing/account', ...memberBillingAuthMiddleware(pool, jwtSecret), legacyBillingEndpoint, async (req, res) => {
    const ctx = req.platformAuth
    const memberId = linkedPlatformMemberId(ctx)
    const familyId = await resolveActiveMemberBillingFamilyId(pool, {
      memberId,
      facilityId: ctx.user.facility_id ?? null,
    })
    if (!familyId) {
      return res.json({
        success: true,
        data: { account: null, charges: [], payments: [], chargesCents: 0, paymentsCents: 0, balanceCents: 0, canSeeFamily: false },
      })
    }
    const account = await ensureCustomerBillingAccount(pool, familyId, ctx.user.facility_id ?? null)
    if (!account) {
      return res.json({
        success: true,
        data: { account: null, charges: [], payments: [], chargesCents: 0, paymentsCents: 0, balanceCents: 0, canSeeFamily: false },
      })
    }
    const canSeeFamily = Number(account.payer_member_id) === memberId

    const view = await buildBillingAccountView(pool, account, {
      memberScopeId: canSeeFamily ? null : memberId,
    })

    res.json({
      success: true,
      data: {
        account: mapBillingAccount(account),
        charges: view.charges.map((c) =>
          mapCharge({ ...c, displayCategory: chargeDisplayCategory(c) }),
        ),
        payments: view.payments.map(mapPayment),
        subscriptions: view.subscriptions,
        monthlyTotals: view.monthlyTotals,
        membershipRenewsOn: view.membershipRenewsOn ?? null,
        hasActiveMembership: Boolean(view.hasActiveMembership),
        refunds: view.refunds,
        ledger: view.ledger,
        bundlePasses: view.bundlePasses,
        bundleUsage: view.bundleUsage,
        chargesCents: view.chargesCents,
        paymentsCents: view.paymentsCents,
        refundsCents: view.refundsCents,
        balanceCents: view.balanceCents,
        currentPeriod: view.currentPeriod,
        billingHistory: view.billingHistory,
        canSeeFamily,
        stripeEnabled: process.env.STRIPE_ENABLED === 'true',
      },
    })
  })

  app.get('/api/members/billing/customer-account', ...memberBillingAuthMiddleware(pool, jwtSecret), async (req, res) => {
    try {
      const startedAt = Date.now()
      const ctx = req.platformAuth
      const memberId = linkedPlatformMemberId(ctx)
      const familyId = await resolveActiveMemberBillingFamilyId(pool, {
        memberId,
        facilityId: ctx.user.facility_id ?? null,
      })
      if (!familyId) {
        return res.status(404).json({ success: false, message: 'Family billing account not found.' })
      }
      const account = await ensureCustomerBillingAccount(pool, familyId, ctx.user.facility_id ?? null)
      if (!account) return res.status(404).json({ success: false, message: 'Family billing account not found.' })
      const access = buildMemberCustomerBillingAccess(account, memberId, true)

      const [overview, bundles] = await Promise.all([
        buildCustomerBillingOverview(pool, {
          familyId,
          facilityId: ctx.user.facility_id ?? null,
          readMode: 'member',
        }),
        loadCustomerBillingBundles(pool, { familyId, usageLimit: 100 }),
      ])
      if (overview?.revision) {
        res.setHeader('ETag', `W/"billing-${overview.revision}"`)
      }
      res.json({
        success: true,
        data: {
          access,
          revision: overview?.revision ?? null,
          overview: overview
            ? buildMemberBillingOverviewDto({ ...overview, ...bundles, alerts: [] })
            : null,
          transactions: [],
          nextTransactionCursor: null,
        },
      })
      console.info('[members] customer billing overview loaded', {
        memberId,
        accountId: Number(account.id),
        durationMs: Date.now() - startedAt,
      })
    } catch (err) {
      console.error('[members] customer billing account:', err)
      res.status(500).json({ success: false, message: 'Failed to load the family billing account.' })
    }
  })

  app.get('/api/members/billing/customer-account/transactions', ...memberBillingAuthMiddleware(pool, jwtSecret), async (req, res) => {
    try {
      const startedAt = Date.now()
      const ctx = req.platformAuth
      const memberId = linkedPlatformMemberId(ctx)
      const familyId = await resolveActiveMemberBillingFamilyId(pool, {
        memberId,
        facilityId: ctx.user.facility_id ?? null,
      })
      if (!familyId) return res.status(404).json({ success: false, message: 'Family billing account not found.' })
      const account = await ensureCustomerBillingAccount(pool, familyId, ctx.user.facility_id ?? null)
      if (!account) return res.status(404).json({ success: false, message: 'Family billing account not found.' })
      const access = buildMemberCustomerBillingAccess(account, memberId, true)

      let transactionCursor = null
      try {
        transactionCursor = decodeMemberBillingTransactionCursor(
          typeof req.query.cursor === 'string' ? req.query.cursor : null,
          { accountId: account.id, jwtSecret },
        )
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message })
      }

      const page = await listMemberCustomerBillingTransactions(pool, {
        accountId: account.id,
        cursor: transactionCursor,
        limit: Math.min(50, Math.max(1, Number(req.query.limit) || 50)),
      })
      const rows = page.rows.map((row) => ({
        entryKind: row.entryKind,
        entryType: row.entryType,
        refId: row.refId,
        memberId: row.memberId,
        memberName: row.memberName,
        description: row.description,
        billingMonths: row.billingMonths,
        amountCents: row.amountCents,
        occurredAt: row.occurredAt,
        status: row.status,
        runningBalanceCents: row.runningBalanceCents,
      }))
      res.json({
        success: true,
        data: {
          access,
          rows,
          nextCursor: encodeMemberBillingTransactionCursor(page.nextCursor, {
            accountId: account.id,
            jwtSecret,
          }),
        },
      })
      console.info('[members] customer billing transactions loaded', {
        memberId,
        accountId: Number(account.id),
        rowCount: rows.length,
        durationMs: Date.now() - startedAt,
      })
    } catch (err) {
      console.error('[members] customer billing transactions:', err)
      res.status(500).json({ success: false, message: 'Failed to load billing transactions.' })
    }
  })

  const createMemberBalanceCheckout = async (req, res) => {
    let idempotencyKey
    try {
      idempotencyKey = normalizeMemberBillingIdempotencyKey(req.get('Idempotency-Key'))
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message })
    }
    if (!isStripeEnabled()) {
      return res.status(503).json({ success: false, message: 'Online payments are not enabled yet.', stripeEnabled: false })
    }
    const ctx = req.platformAuth
    const memberId = linkedPlatformMemberId(ctx)
    const familyId = await resolveActiveMemberBillingFamilyId(pool, {
      memberId,
      facilityId: ctx.user.facility_id ?? null,
    })
    if (!familyId) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const account = await ensureCustomerBillingAccount(pool, familyId, ctx.user.facility_id ?? null)
    if (!account) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const access = buildMemberCustomerBillingAccess(account, memberId, true)
    if (!access.canManagePayments) {
      return res.status(403).json({ success: false, message: 'Only the family payer can make a payment.' })
    }

    try {
      const base = publicAppUrl()
      const session = await createCustomerBalanceCheckoutSession(pool, {
        account,
        successUrl: `${base}/?billing=paid`,
        cancelUrl: `${base}/?billing=cancelled`,
        analytics: sanitizeCheckoutAnalytics(req.body?.analytics),
        // Stripe idempotency keys are account-wide. Add the server-owned account
        // id so a key replay after a household reassignment cannot collide with
        // another family's checkout.
        idempotencyKey: `${idempotencyKey}:account-${Number(account.id)}`,
      })
      if (!session) return res.status(503).json({ success: false, message: 'Online payments are not available right now.' })
      res.json({ success: true, data: session })
    } catch (err) {
      console.error('[stripe] member balance checkout:', err)
      const noBalance = /no unpaid balance|no outstanding balance/i.test(String(err?.message ?? ''))
      res.status(noBalance ? 400 : 500).json({
        success: false,
        message: noBalance ? 'No outstanding balance to pay.' : 'Failed to start checkout.',
      })
    }
  }

  app.post('/api/members/billing/payments/checkout', ...memberBillingAuthMiddleware(pool, jwtSecret), createMemberBalanceCheckout)
  app.post('/api/members/billing/checkout-session', ...memberBillingAuthMiddleware(pool, jwtSecret), legacyBillingEndpoint, createMemberBalanceCheckout)

  const createMemberPaymentMethodSession = async (req, res) => {
    if (!isStripeEnabled()) {
      return res.status(503).json({ success: false, message: 'Online billing is not enabled yet.' })
    }
    const ctx = req.platformAuth
    const memberId = linkedPlatformMemberId(ctx)
    const familyId = await resolveActiveMemberBillingFamilyId(pool, {
      memberId,
      facilityId: ctx.user.facility_id ?? null,
    })
    if (!familyId) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const account = await ensureCustomerBillingAccount(pool, familyId, ctx.user.facility_id ?? null)
    if (!account) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const access = buildMemberCustomerBillingAccess(account, memberId, true)
    if (!access.canManagePaymentMethod) {
      return res.status(403).json({ success: false, message: 'Only the family payer can manage payment methods.' })
    }
    try {
      const session = await createPaymentMethodSetupSession(pool, {
        account,
        returnUrl: `${publicAppUrl()}/?billing=portal-return`,
      })
      if (!session?.url) throw new Error('Stripe did not return a portal URL.')
      res.json({ success: true, data: { url: session.url } })
    } catch (err) {
      console.error('[stripe] member payment method session:', err)
      res.status(500).json({ success: false, message: 'Failed to open payment settings.' })
    }
  }

  app.post('/api/members/billing/payment-method-session', ...memberBillingAuthMiddleware(pool, jwtSecret), createMemberPaymentMethodSession)
  app.post('/api/members/billing/customer-portal', ...memberBillingAuthMiddleware(pool, jwtSecret), legacyBillingEndpoint, createMemberPaymentMethodSession)

  app.get('/api/members/billing/annual-membership', ...memberBillingAuthMiddleware(pool, jwtSecret), async (req, res) => {
    const ctx = req.platformAuth
    const viewerMemberId = linkedPlatformMemberId(ctx)
    const familyId = await resolveActiveMemberBillingFamilyId(pool, {
      memberId: viewerMemberId,
      facilityId: ctx.user.facility_id ?? null,
    })
    if (!familyId) {
      return res.json({
        success: true,
        data: {
          available: false,
          active: false,
          fee: null,
          renewsOn: null,
          amountCents: 0,
          sportName: 'Membership',
          programName: 'Annual Membership',
        },
      })
    }
    const athleteMemberId = Number(req.query.memberId ?? viewerMemberId)
    if (!(await isActiveMemberOfFamily(pool, athleteMemberId, familyId))) {
      return res.status(404).json({ success: false, message: 'Athlete not found.' })
    }
    try {
      const offer = await getAnnualMembershipOffer(
        pool,
        athleteMemberId,
        ctx.user.facility_id ?? null,
      )
      res.json({ success: true, data: offer })
    } catch (err) {
      console.error('[billing] annual-membership offer:', err)
      res.status(500).json({ success: false, message: 'Failed to load membership offer.' })
    }
  })

  app.post('/api/members/billing/annual-membership-checkout', ...memberBillingAuthMiddleware(pool, jwtSecret), async (req, res) => {
    if (!isStripeEnabled()) {
      return res.status(503).json({
        success: false,
        message: 'Online payments are not enabled yet.',
        stripeEnabled: false,
      })
    }
    const ctx = req.platformAuth
    const payerMemberId = linkedPlatformMemberId(ctx)
    const familyId = await resolveActiveMemberBillingFamilyId(pool, {
      memberId: payerMemberId,
      facilityId: ctx.user.facility_id ?? null,
    })
    if (!familyId) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const account = await ensureCustomerBillingAccount(pool, familyId, ctx.user.facility_id ?? null)
    if (!account) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const canPay = Number(account.payer_member_id) === payerMemberId
    if (!canPay) {
      return res.status(403).json({
        success: false,
        message: 'Only the family payer can purchase annual membership.',
      })
    }

    const athleteMemberId = Number(req.body?.memberId ?? payerMemberId)
    const memberIds = Array.isArray(req.body?.memberIds)
      ? req.body.memberIds.map(Number).filter((id) => Number.isFinite(id) && id > 0)
      : null
    try {
      const base = publicAppUrl()
      const successUrl =
        typeof req.body?.successUrl === 'string' && req.body.successUrl.trim()
          ? String(req.body.successUrl).trim()
          : `${base}/?billing=membership-paid&session_id={CHECKOUT_SESSION_ID}`
      const cancelUrl =
        typeof req.body?.cancelUrl === 'string' && req.body.cancelUrl.trim()
          ? String(req.body.cancelUrl).trim()
          : `${base}/?billing=membership-cancelled`
      const promoCode =
        typeof req.body?.promoCode === 'string' && req.body.promoCode.trim()
          ? req.body.promoCode.trim()
          : null
      const promoCodesByMemberId =
        req.body?.promoCodesByMemberId &&
        typeof req.body.promoCodesByMemberId === 'object' &&
        !Array.isArray(req.body.promoCodesByMemberId)
          ? req.body.promoCodesByMemberId
          : null
      const result = await createAnnualMembershipCheckoutSession(pool, {
        account,
        athleteMemberId,
        memberIds,
        payerMemberId,
        promoCode,
        promoCodesByMemberId,
        successUrl,
        cancelUrl,
        idempotencyKey: req.get('Idempotency-Key'),
      })
      // A 100%-waived promo activates memberships immediately with no Stripe session.
      if (result?.free) {
        return res.json({ success: true, data: result })
      }
      if (!result?.url) {
        return res.status(503).json({ success: false, message: 'Online payments are not available right now.' })
      }
      res.json({ success: true, data: result })
    } catch (err) {
      console.error('[stripe] annual-membership-checkout:', err)
      const status = err.status && Number.isFinite(err.status) ? err.status : 500
      res.status(status).json({
        success: false,
        message: err.message || 'Failed to start membership checkout.',
      })
    }
  })

  app.post('/api/members/billing/annual-membership-preview', ...memberBillingAuthMiddleware(pool, jwtSecret), async (req, res) => {
    const ctx = req.platformAuth
    const payerMemberId = linkedPlatformMemberId(ctx)
    const familyId = await resolveActiveMemberBillingFamilyId(pool, {
      memberId: payerMemberId,
      facilityId: ctx.user.facility_id ?? null,
    })
    if (!familyId) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const account = await ensureCustomerBillingAccount(pool, familyId, ctx.user.facility_id ?? null)
    if (!account) return res.status(400).json({ success: false, message: 'No family billing account.' })
    if (Number(account.payer_member_id) !== payerMemberId) {
      return res.status(403).json({ success: false, message: 'Only the family payer can preview annual membership pricing.' })
    }

    const athleteMemberId = Number(req.body?.memberId ?? payerMemberId)
    const memberIds = Array.isArray(req.body?.memberIds)
      ? req.body.memberIds.map(Number).filter((id) => Number.isFinite(id) && id > 0)
      : null
    const promoCode =
      typeof req.body?.promoCode === 'string' && req.body.promoCode.trim()
        ? req.body.promoCode.trim()
        : null
    const promoCodesByMemberId =
      req.body?.promoCodesByMemberId &&
      typeof req.body.promoCodesByMemberId === 'object' &&
      !Array.isArray(req.body.promoCodesByMemberId)
        ? req.body.promoCodesByMemberId
        : null
    try {
      const preview = await previewAnnualMembershipCheckout(pool, {
        account,
        athleteMemberId,
        memberIds,
        payerMemberId,
        promoCode,
        promoCodesByMemberId,
      })
      res.json({ success: true, data: preview })
    } catch (err) {
      console.error('[billing] annual-membership-preview:', err)
      const status = err.status && Number.isFinite(err.status) ? err.status : 500
      res.status(status).json({
        success: false,
        message: err.message || 'Failed to preview membership pricing.',
      })
    }
  })

  app.post('/api/members/billing/confirm-annual-membership-checkout', ...memberBillingAuthMiddleware(pool, jwtSecret), async (req, res) => {
    if (!isStripeEnabled()) {
      return res.status(503).json({ success: false, message: 'Online payments are not enabled yet.' })
    }
    const ctx = req.platformAuth
    const payerMemberId = linkedPlatformMemberId(ctx)
    const familyId = await resolveActiveMemberBillingFamilyId(pool, {
      memberId: payerMemberId,
      facilityId: ctx.user.facility_id ?? null,
    })
    if (!familyId) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const account = await ensureCustomerBillingAccount(pool, familyId, ctx.user.facility_id ?? null)
    if (!account) return res.status(400).json({ success: false, message: 'No family billing account.' })
    if (Number(account.payer_member_id) !== payerMemberId) {
      return res.status(403).json({ success: false, message: 'Only the family payer can confirm annual membership checkout.' })
    }

    const checkoutSessionId = req.body?.checkoutSessionId ?? req.body?.sessionId ?? null
    if (!checkoutSessionId) {
      return res.status(400).json({ success: false, message: 'Missing checkout session.' })
    }
    try {
      const stripe = await getStripeClient()
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId)
      if (Number(session.metadata?.familyBillingAccountId) !== Number(account.id)) {
        return res.status(403).json({ success: false, message: 'Checkout does not belong to this account.' })
      }
      const result = await commitAnnualMembershipCheckout(pool, {
        stripeSession: session,
        accountId: account.id,
      })
      requireTerminalStripeCheckoutCommit(result, 'annual_membership')
      res.json({ success: true, data: result })
    } catch (err) {
      console.error('[stripe] confirm-annual-membership-checkout:', err)
      const status = [
        'STRIPE_CHECKOUT_FULFILLMENT_INCOMPLETE',
        FORBIDDEN_SUBSCRIPTION_CHECKOUT_CODE,
      ].includes(err?.code) ? 409 : 500
      res.status(status).json({ success: false, message: err.message || 'Failed to confirm membership.' })
    }
  })

  app.post('/api/members/billing/enrollment-checkout-session', ...memberBillingAuthMiddleware(pool, jwtSecret), async (req, res) => {
    if (!isStripeEnabled()) {
      return res.status(503).json({ success: false, message: 'Online payments are not enabled yet.', stripeEnabled: false })
    }
    const ctx = req.platformAuth
    const memberId = linkedPlatformMemberId(ctx)
    const familyId = await resolveActiveMemberBillingFamilyId(pool, {
      memberId,
      facilityId: ctx.user.facility_id ?? null,
    })
    if (!familyId) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const account = await ensureCustomerBillingAccount(pool, familyId, ctx.user.facility_id ?? null)
    if (!account) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const canPay = Number(account.payer_member_id) === memberId
    if (!canPay) {
      return res.status(403).json({ success: false, message: 'Only the family payer can complete enrollment checkout.' })
    }

    const { signups, promoCodes, signupAuthToken, responses, analytics } = req.body ?? {}
    if (!Array.isArray(signups) || signups.length === 0) {
      return res.status(400).json({ success: false, message: 'No enrollment items provided.' })
    }
    if (!signupAuthToken) {
      return res.status(400).json({ success: false, message: 'Enrollment session expired. Please try again.' })
    }

    try {
      const base = publicAppUrl()
      const analyticsContext = sanitizeCheckoutAnalytics(analytics)
      const result = await createEnrollmentCheckoutSession(pool, {
        account,
        memberId,
        batchPayload: {
          signups,
          promoCodes: promoCodes ?? [],
          signupAuthToken,
          responses: responses ?? {},
          // Stored in stripe_pending_enrollment.payload; read by the webhook-side
          // GA4 purchase emitter. Ignored by executeSignupBatch.
          ...(analyticsContext ? { analytics: analyticsContext } : {}),
        },
        successUrl: `${base}/?enrollment=paid&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${base}/?enrollment=cancelled`,
        idempotencyKey: req.get('Idempotency-Key'),
      })
      if (!result) {
        return res.status(503).json({ success: false, message: 'Online payments are not available right now.' })
      }
      if (result.skipCheckout) {
        return res.json({ success: true, data: { skipCheckout: true } })
      }
      res.json({ success: true, data: { url: result.url, pendingEnrollmentId: result.pendingEnrollmentId } })
    } catch (err) {
      console.error('[stripe] enrollment-checkout-session:', err)
      const status = err?.statusCode ?? (err?.code === 'ENROLLMENT_START_DATE_REQUIRED' ? 400 : 500)
      res.status(status).json({ success: false, message: err.message || 'Failed to start enrollment checkout.' })
    }
  })

  app.post('/api/members/billing/confirm-enrollment-checkout', ...memberBillingAuthMiddleware(pool, jwtSecret), async (req, res) => {
    if (!isStripeEnabled()) {
      return res.status(503).json({ success: false, message: 'Online payments are not enabled yet.', stripeEnabled: false })
    }
    const ctx = req.platformAuth
    const memberId = linkedPlatformMemberId(ctx)
    const familyId = await resolveActiveMemberBillingFamilyId(pool, {
      memberId,
      facilityId: ctx.user.facility_id ?? null,
    })
    if (!familyId) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const account = await ensureCustomerBillingAccount(pool, familyId, ctx.user.facility_id ?? null)
    if (!account) return res.status(400).json({ success: false, message: 'No family billing account.' })
    if (Number(account.payer_member_id) !== memberId) {
      return res.status(403).json({ success: false, message: 'Only the family payer can confirm enrollment checkout.' })
    }

    const checkoutSessionId = req.body?.checkoutSessionId ?? req.body?.sessionId ?? null
    const pendingEnrollmentId = req.body?.pendingEnrollmentId ?? null

    try {
      const result = await confirmEnrollmentCheckoutSession(pool, {
        checkoutSessionId,
        pendingEnrollmentId,
        memberId,
        familyId,
        roles: ctx.roles ?? [],
      })
      res.json({ success: true, data: result })
    } catch (err) {
      console.error('[stripe] confirm-enrollment-checkout:', err)
      res.status(err?.statusCode ?? 400).json({ success: false, message: err.message || 'Failed to confirm enrollment.' })
    }
  })

  app.get('/api/admin/stripe/catalog-status', ...requirePermission(pool, jwtSecret, 'pricing.manage'), async (_req, res) => {
    try {
      const status = await getCatalogSyncStatus(pool)
      res.json({ success: true, data: status })
    } catch (err) {
      console.error('[stripe] catalog-status:', err)
      res.status(500).json({ success: false, message: 'Failed to load Stripe catalog status.' })
    }
  })

  app.post('/api/admin/stripe/sync-catalog', ...requirePermission(pool, jwtSecret, 'pricing.manage'), async (_req, res) => {
    try {
      const result = await syncAllCatalog(pool)
      res.json({ success: true, data: result })
    } catch (err) {
      console.error('[stripe] sync-catalog:', err)
      res.status(500).json({ success: false, message: err.message || 'Catalog sync failed.' })
    }
  })

  app.post('/api/stripe/webhook', stripeWebhookRawParser, async (req, res) => {
    if (!isStripeEnabled()) return res.status(503).json({ success: false })
    const rawBody = stripeWebhookRawBody(req)
    const signature = req.headers['stripe-signature']
    let event = null
    let webhookClaim = null
    try {
      event = await parseWebhookEvent(rawBody, signature)
      if (!event) return res.status(400).json({ success: false })
      webhookClaim = await beginStripeWebhookEvent(pool, event)
      if (webhookClaim.replayed) return res.json({ received: true, replayed: true })
      if (!webhookClaim.claimed) {
        // Do not run the same event concurrently, and do not acknowledge it as
        // delivered. Stripe will retry; a later delivery can reclaim the lease
        // if the current worker never completes.
        return res.status(409).json({ received: false, processing: true })
      }
      if (
        event.type === 'checkout.session.completed'
        || event.type === 'checkout.session.async_payment_succeeded'
        || event.type === 'payment_intent.succeeded'
      ) {
        const obj = event.data?.object ?? {}
        const isCheckoutFulfillmentEvent =
          event.type === 'checkout.session.completed'
          || event.type === 'checkout.session.async_payment_succeeded'
        const checkoutKind = obj.metadata?.checkoutType === 'enrollment'
          ? 'enrollment'
          : obj.metadata?.checkoutType === 'annual_membership'
            ? 'annual_membership'
            : null
        const isPaymentMethodSetup =
          event.type === 'checkout.session.completed'
          && obj.mode === 'setup'
          && obj.status === 'complete'
          && obj.metadata?.checkoutType === 'payment_method_update'
        if (isPaymentMethodSetup) {
          const stripe = await getStripeClient()
          await completePaymentMethodSetupSession(pool, { session: obj, stripe })
          await completeStripeWebhookEvent(pool, event, webhookClaim)
          return res.json({ received: true, paymentMethodUpdated: true })
        }
        if (isCheckoutFulfillmentEvent && checkoutKind) {
          await rejectForbiddenSubscriptionCheckoutCompletion(pool, {
            session: obj,
            checkoutKind,
            pendingEnrollmentId: checkoutKind === 'enrollment'
              ? obj.metadata?.pendingEnrollmentId
              : null,
            accountId: obj.metadata?.familyBillingAccountId,
          })
        }
        const isCompletedSetupSession =
          event.type === 'checkout.session.completed'
          && obj.mode === 'setup'
          && obj.status === 'complete'
        if (
          event.type === 'checkout.session.completed'
          && obj.payment_status
          && obj.payment_status !== 'paid'
          && !isCompletedSetupSession
        ) {
          await completeStripeWebhookEvent(pool, event, webhookClaim)
          return res.json({ received: true, paymentPending: true })
        }
        const isStoreCheckout =
          isCheckoutFulfillmentEvent
          && obj.metadata?.checkoutType === 'store'
          && obj.metadata?.storeOrderId
        if (isStoreCheckout) {
          const outcome = await completeStoreStripeCheckout(pool, obj)
          await completeStripeWebhookEvent(pool, event, webhookClaim)
          return res.json({ received: true, storeOrder: outcome.handled === true })
        }
        const isEnrollmentCheckout =
          isCheckoutFulfillmentEvent &&
          obj.metadata?.checkoutType === 'enrollment' &&
          obj.metadata?.pendingEnrollmentId
        const isAnnualMembershipCheckout =
          isCheckoutFulfillmentEvent &&
          obj.metadata?.checkoutType === 'annual_membership'
        if (isEnrollmentCheckout) {
          const commitResult = await commitPendingEnrollment(pool, {
            pendingEnrollmentId: Number(obj.metadata.pendingEnrollmentId),
            stripeSession: obj,
          })
          requireTerminalStripeCheckoutCommit(commitResult, 'enrollment')
        }
        if (isAnnualMembershipCheckout) {
          const commitResult = await commitAnnualMembershipCheckout(pool, {
            stripeSession: obj,
            accountId: obj.metadata?.familyBillingAccountId
              ? Number(obj.metadata.familyBillingAccountId)
              : null,
          })
          requireTerminalStripeCheckoutCommit(commitResult, 'annual_membership')
        }
        let accountId = obj.metadata?.familyBillingAccountId
          ? Number(obj.metadata.familyBillingAccountId)
          : null
        let insertedPayment = null
        let reservedAttempt = null
        let reservedAttemptConflict = null
        let invoiceOutcome = null
        if (event.type === 'payment_intent.succeeded' && obj.invoice) {
          const stripe = await getStripeClient()
          const invoice = typeof obj.invoice === 'object'
            ? obj.invoice
            : await stripe.invoices.retrieve(obj.invoice)
          invoiceOutcome = await recordAuthoritativeStripeInvoicePayment(pool, { invoice, stripe })
          insertedPayment = invoiceOutcome.payment
          accountId = insertedPayment?.family_billing_account_id ?? accountId
          if (invoiceOutcome.classification.kind === 'household') {
            reservedAttemptConflict = invoiceOutcome.householdSettlement?.conflicted
              ? invoiceOutcome.householdSettlement
              : null
          } else if (invoiceOutcome.classification.kind === 'subscription' && insertedPayment) {
            await allocateHouseholdPayments(pool, {
              accountId: insertedPayment.family_billing_account_id,
              actorType: 'stripe',
            })
          } else if (invoiceOutcome.classification.kind !== 'subscription') {
            await recordStripeBillingAlert(pool, {
              event,
              object: invoice,
              alertType: invoiceOutcome.classification.code,
              severity: 'critical',
              message: invoiceOutcome.classification.reason,
            })
          }
        } else if ((isEnrollmentCheckout || isAnnualMembershipCheckout) && accountId) {
          const stripe = await getStripeClient()
          insertedPayment = await recordEnrollmentStripePayment(pool, stripe, {
            session: obj,
            accountId,
          })
        } else {
          reservedAttempt = await findBillingPaymentAttemptForStripeObject(pool, obj)
          const paymentIntentId = typeof obj.payment_intent === 'string'
            ? obj.payment_intent
            : obj.payment_intent?.id ?? (event.type === 'payment_intent.succeeded' ? obj.id : null)
          if (reservedAttempt) {
            const settlement = await recordAndCompleteBillingPaymentAttempt(pool, {
              stripeObject: obj,
              paymentIntentId,
              amountCents: obj.amount_total ?? obj.amount_received ?? obj.amount ?? 0,
              customerId: typeof obj.customer === 'string' ? obj.customer : obj.customer?.id ?? null,
            })
            insertedPayment = settlement?.payment ?? null
            reservedAttemptConflict = settlement?.conflicted ? settlement : null
          } else {
            insertedPayment = await recordStripePayment(pool, {
              paymentIntentId,
              amountCents: obj.amount_total ?? obj.amount_received ?? obj.amount ?? 0,
              accountId,
              customerId: typeof obj.customer === 'string' ? obj.customer : obj.customer?.id ?? null,
            })
          }
        }
        const customChargeId = Number(obj.metadata?.billingChargeId)
        if (insertedPayment && invoiceOutcome?.householdSettlement?.conflicted) {
          await recordStripeBillingAlert(pool, {
            event,
            object: obj,
            alertType: 'monthly_invoice_payment_reconciliation',
            severity: 'critical',
            message: `Stripe invoice payment was quarantined: ${invoiceOutcome.householdSettlement.reason}`,
          })
        } else if (insertedPayment && reservedAttempt && reservedAttemptConflict) {
          await recordStripeBillingAlert(pool, {
            event,
            object: obj,
            alertType: 'payment_attempt_reconciliation',
            severity: 'critical',
            message: `Stripe payment ${insertedPayment.stripe_payment_intent_id ?? obj.id ?? ''} was quarantined: ${reservedAttemptConflict.reason}`,
          })
        } else if (insertedPayment && reservedAttempt) {
          await allocateHouseholdPayments(pool, {
            accountId: reservedAttempt.family_billing_account_id,
            actorType: 'stripe',
          })
        } else if (insertedPayment && accountId && Number.isFinite(customChargeId) && customChargeId > 0) {
          await linkCustomerBillingPayment(pool, {
            payment: insertedPayment,
            chargeId: customChargeId,
            accountId,
            stripeObjectId: insertedPayment.stripe_payment_intent_id ?? obj.id,
            actorType: 'stripe',
          })
        } else if (insertedPayment && accountId) {
          await allocateHouseholdPayments(pool, { accountId, actorType: 'stripe' })
        }
        // Emits only when this call inserted the payment row (newly_inserted);
        // the enrollment path usually emits inside commitPendingEnrollment instead.
        void emitStripePurchaseEvent(pool, {
          payment: insertedPayment,
          session: obj,
          paymentType: isEnrollmentCheckout
            ? 'initial_enrollment'
            : isAnnualMembershipCheckout
              ? 'annual_membership'
              : 'outstanding_balance',
        })
        if (insertedPayment && accountId) {
          await recordBillingActivityBestEffort(pool, {
            eventKey: `stripe-payment-received:${insertedPayment.id}`,
            accountId,
            paymentId: insertedPayment.id,
            eventType: 'payment_received',
            summary: `Stripe payment #${insertedPayment.id} was received.`,
            afterValue: mapPayment(insertedPayment),
            stripeObjectId: insertedPayment.stripe_payment_intent_id ?? obj.id,
            actorType: 'stripe',
          })
          const acct = await pool.query(`SELECT * FROM family_billing_account WHERE id = $1`, [accountId])
          if (acct.rows[0]) {
            notifyPaymentReceipt(pool, {
              account: acct.rows[0],
              payment: insertedPayment,
              billingUrl: `${publicAppUrl()}/?billing=portal-return`,
            }).catch(() => {})
          }
        }
      } else if (event.type === 'invoice.upcoming') {
        const invoice = event.data?.object ?? {}
        const subscriptionId = invoiceSubscriptionId(invoice)
        if (subscriptionId) {
          const stripe = await getStripeClient()
          await validateAnnualMembershipRenewalDiscount(pool, {
            stripeSubscriptionId: subscriptionId,
            stripe,
            now: new Date(),
          })
        }
      } else if (event.type === 'invoice.paid') {
        const invoice = event.data?.object ?? {}
        const stripe = await getStripeClient()
        const invoiceOutcome = await recordAuthoritativeStripeInvoicePayment(pool, { invoice, stripe })
        const householdSettlement = invoiceOutcome.householdSettlement
        const payment = invoiceOutcome.payment
        if (!payment && invoiceOutcome.classification.kind !== 'subscription') {
          await recordStripeBillingAlert(pool, {
            event,
            object: invoice,
            alertType: invoiceOutcome.classification.code,
            severity: 'critical',
            message: invoiceOutcome.classification.reason,
          })
        }
        if (payment) {
          const householdInvoice = householdSettlement?.invoice ?? null
          if (householdSettlement?.conflicted) {
            await recordStripeBillingAlert(pool, {
              event,
              object: invoice,
              alertType: 'monthly_invoice_payment_reconciliation',
              severity: 'critical',
              message: `Stripe invoice ${invoice.id ?? ''} payment was quarantined: ${householdSettlement.reason}`,
            })
          } else if (!householdInvoice) {
            await allocateHouseholdPayments(pool, {
              accountId: payment.family_billing_account_id,
              actorType: 'stripe',
            })
          }
          await recordBillingActivityBestEffort(pool, {
            eventKey: `stripe-invoice-payment:${payment.id}`,
            accountId: payment.family_billing_account_id,
            paymentId: payment.id,
            eventType: householdInvoice ? 'monthly_invoice_payment_received' : 'recurring_payment_received',
            summary: householdInvoice
              ? `Household monthly Stripe invoice payment #${payment.id} was received.`
              : `Recurring Stripe invoice payment #${payment.id} was received.`,
            afterValue: mapPayment(payment),
            stripeObjectId: payment.stripe_invoice_id ?? invoice.id,
            actorType: 'stripe',
          })
          const acct = await pool.query(`SELECT * FROM family_billing_account WHERE id = $1`, [payment.family_billing_account_id])
          if (acct.rows[0]) {
            notifyPaymentReceipt(pool, {
              account: acct.rows[0],
              payment,
              billingUrl: `${publicAppUrl()}/?billing=portal-return`,
            }).catch(() => {})
          }
        }
      } else if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted' ||
        event.type === 'customer.subscription.paused' ||
        event.type === 'customer.subscription.resumed'
      ) {
        await syncStripeSubscriptionStatus(pool, event.data?.object ?? {}, event.type)
      } else if (
        event.type === 'refund.created' ||
        event.type === 'refund.updated' ||
        event.type === 'refund.failed'
      ) {
        let refund = await syncStripeRefund(pool, event.data?.object ?? {})
        if (refund?.external_status === 'succeeded') {
          refund = await finalizeRefundLedgerTreatment(pool, refund, { actorType: 'stripe' })
          if (!refund.ledger_treatment) {
            await recordBillingActivityBestEffort(pool, {
              eventKey: `stripe-refund-succeeded:${refund.id}`,
              accountId: refund.family_billing_account_id,
              paymentId: refund.payment_id,
              refundId: refund.id,
              eventType: 'refund_succeeded',
              summary: `Stripe refund #${refund.id} completed.`,
              afterValue: { amountCents: Number(refund.amount_cents), status: refund.external_status },
              stripeObjectId: refund.stripe_refund_id,
              actorType: 'stripe',
            })
          }
        }
        if (refund?.external_status === 'failed') {
          await recordBillingActivityBestEffort(pool, {
            eventKey: `stripe-refund-failed:${refund.id}:${event.id}`,
            accountId: refund.family_billing_account_id,
            paymentId: refund.payment_id,
            refundId: refund.id,
            eventType: 'refund_failed',
            summary: `Stripe refund #${refund.id} failed.`,
            afterValue: { amountCents: Number(refund.amount_cents), status: refund.external_status },
            details: { reason: refund.error_message ?? event.data?.object?.failure_reason ?? null },
            stripeObjectId: refund.stripe_refund_id,
            actorType: 'stripe',
          })
        }
        // The notification layer keys receipts by refund id, so an immediate
        // success and a later webhook replay cannot send duplicate receipts.
        if (refund?.external_status === 'succeeded') {
          const acct = await pool.query(
            `SELECT * FROM family_billing_account WHERE id = $1`,
            [refund.family_billing_account_id],
          )
          if (acct.rows[0]) {
            notifyRefundReceipt(pool, {
              account: acct.rows[0],
              refund,
              billingUrl: `${publicAppUrl()}/?billing=portal-return`,
            }).catch(() => {})
          }
        }
      } else if (
        event.type === 'charge.dispute.created' ||
        event.type === 'charge.dispute.updated' ||
        event.type === 'charge.dispute.closed'
      ) {
        const dispute = event.data?.object ?? {}
        await syncDisputeCase(pool, dispute)
        if (event.type === 'charge.dispute.closed' || ['won', 'lost'].includes(dispute.status)) {
          await pool.query(
            `UPDATE stripe_billing_alert SET resolved_at = now(), updated_at = now()
             WHERE alert_type = 'dispute' AND stripe_object_id = $1 AND resolved_at IS NULL`,
            [dispute.id],
          )
        } else {
          await recordStripeBillingAlert(pool, {
            event,
            object: dispute,
            alertType: 'dispute',
            severity: 'critical',
            message: `Stripe dispute ${dispute.status ?? 'updated'} (${dispute.reason ?? 'reason unavailable'})`,
          })
        }
      } else if (event.type === 'invoice.finalization_failed') {
        const invoice = event.data?.object ?? {}
        await recordStripeBillingAlert(pool, {
          event,
          object: invoice,
          alertType: 'invoice_finalization_failed',
          severity: 'critical',
          message: `Stripe could not finalize invoice ${invoice.id ?? ''}`.trim(),
        })
      } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
        const session = event.data?.object ?? {}
        await releaseBillingPaymentAttempt(pool, {
          stripeObject: session,
          status: event.type === 'checkout.session.expired' ? 'expired' : 'failed',
          reason: event.type === 'checkout.session.expired'
            ? 'Stripe Checkout Session expired.'
            : 'Stripe Checkout asynchronous payment failed.',
          checkoutTerminal: true,
        })
        if (session.metadata?.pendingEnrollmentId) {
          await pool.query(
            `UPDATE stripe_pending_enrollment SET status = 'expired', updated_at = now()
             WHERE id = $1 AND status = 'pending'`,
            [Number(session.metadata.pendingEnrollmentId)],
          )
        }
      } else if (
        event.type === 'payment_intent.payment_failed'
        || event.type === 'payment_intent.canceled'
        || event.type === 'invoice.payment_failed'
      ) {
        const obj = event.data?.object ?? {}
        // payment_intent.payment_failed commonly transitions back to
        // requires_payment_method and may later be reconfirmed successfully.
        // Only the signed canceled lifecycle proves the remote collector is
        // terminal and permits its exact reservation to be released.
        if (event.type === 'payment_intent.canceled') {
          await releaseBillingPaymentAttempt(pool, {
            stripeObject: obj,
            status: 'canceled',
            reason: obj.last_payment_error?.message || `Stripe ${event.type}.`,
          })
        }
        void emitStripePaymentFailedEvent(pool, { object: obj })
        const accountId = await resolveStripeWebhookAccountId(pool, obj)
        const failureReason =
          obj.last_payment_error?.message ||
          obj.charges?.data?.[0]?.failure_message ||
          obj.failure_message ||
          null
        await recordStripeBillingAlert(pool, {
          event,
          object: { ...obj, reason: failureReason, metadata: { ...(obj.metadata ?? {}), familyBillingAccountId: accountId ? String(accountId) : undefined } },
          alertType: 'payment_failed',
          severity: 'warning',
          message: `Stripe payment failed${obj.id ? ` (${obj.id})` : ''}${failureReason ? `: ${failureReason}` : ''}`,
        })
        if (accountId) {
          await recordBillingActivityBestEffort(pool, {
            eventKey: `stripe-payment-failed:${event.id}`,
            accountId,
            eventType: 'payment_failed',
            summary: 'Stripe payment attempt failed.',
            details: {
              amountCents: obj.amount_due ?? obj.amount ?? obj.amount_total ?? 0,
              reason: failureReason,
            },
            stripeObjectId: obj.id,
            actorType: 'stripe',
          })
        }
        const shouldNotifyCustomer = event.type === 'invoice.payment_failed' || !obj.invoice
        if (accountId && shouldNotifyCustomer) {
          const acct = await pool.query(`SELECT * FROM family_billing_account WHERE id = $1`, [accountId])
          if (acct.rows[0]) {
            const amountCents = obj.amount_due ?? obj.amount ?? obj.amount_total ?? 0
            notifyPaymentFailed(pool, {
              account: acct.rows[0],
              amountCents,
              reason: failureReason,
              updatePaymentUrl: `${publicAppUrl()}/?billing=update`,
              idempotencyKey: `stripe-payment-failed-${event.id}`,
            }).catch(() => {})
          }
        }
        if (event.type === 'invoice.payment_failed' && accountId) {
          await recordPaymentRecoveryExhaustedAlert(pool, { event, invoice: obj, accountId, failureReason })
        }
      }
      await completeStripeWebhookEvent(pool, event, webhookClaim)
      res.json({ received: true })
    } catch (err) {
      if (err?.code === FORBIDDEN_SUBSCRIPTION_CHECKOUT_CODE && webhookClaim?.claimed) {
        try {
          await completeStripeWebhookEvent(pool, event, webhookClaim)
          return res.json({ received: true, quarantined: true })
        } catch (completionError) {
          err = completionError
        }
      }
      await failStripeWebhookEvent(pool, event, err, webhookClaim ?? {})
      const deliveryTimestamp = String(signature ?? '').match(/(?:^|,)t=(\d+)/)?.[1] ?? Date.now()
      await recordStripeBillingAlert(pool, {
        event: event ?? { id: `webhook-delivery:${deliveryTimestamp}` },
        object: event?.data?.object ?? { id: event?.id ?? null },
        alertType: 'webhook_failure',
        severity: 'critical',
        message: `Stripe webhook delivery failed: ${String(err?.message ?? err).slice(0, 300)}`,
      }).catch(() => {})
      const signatureFailure = String(err?.message ?? '').includes('signature')
      if (signatureFailure) {
        logWebhookVerificationFailure(err, { rawBody, signature })
      } else {
        console.error('[stripe] webhook:', err)
      }
      res.status(webhookClaim?.claimed && !signatureFailure ? 500 : 400).json({
        success: false,
        message: err.message,
      })
    }
  })

  app.get('/api/admin/stripe/billing-alerts', ...requirePermission(pool, jwtSecret, 'billing.view'), async (req, res) => {
    try {
      const billingScope = authenticatedAdminBillingScope(req.platformAuth)
      const result = await pool.query(
        `SELECT a.*,
                COALESCE(
                  (SELECT SUM(c.amount_cents) FROM billing_charge c WHERE c.family_billing_account_id = a.family_billing_account_id), 0
                ) - COALESCE(
                  (SELECT SUM(p.amount_cents) FROM billing_payment p WHERE p.family_billing_account_id = a.family_billing_account_id), 0
                ) + COALESCE(
                  (SELECT SUM(r.amount_cents) FROM billing_refund r WHERE r.family_billing_account_id = a.family_billing_account_id), 0
                ) AS balance_cents,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'subscriptionId', bs.id,
                    'description', bs.description,
                    'status', bs.status,
                    'memberId', bs.member_id,
                    'memberName', NULLIF(TRIM(CONCAT(m.first_name, ' ', m.last_name)), '')
                  ) ORDER BY bs.id)
                  FROM billing_subscription bs
                  LEFT JOIN member m ON m.id = bs.member_id
                  WHERE bs.family_billing_account_id = a.family_billing_account_id
                    AND bs.status IN ('active', 'paused')
                ), '[]'::jsonb) AS affected_enrollments
         FROM stripe_billing_alert a
         LEFT JOIN family_billing_account scoped_account
           ON scoped_account.id = a.family_billing_account_id
         LEFT JOIN family scoped_family ON scoped_family.id = scoped_account.family_id
         WHERE a.resolved_at IS NULL
           AND ($1::bigint IS NULL OR scoped_family.facility_id = $1)
         ORDER BY a.created_at DESC LIMIT 100`,
        [billingScope.facilityId],
      )
      res.json({ success: true, data: result.rows })
    } catch (error) {
      res.status(errorStatus(error, 500)).json({ success: false, message: 'Failed to load Stripe billing alerts.' })
    }
  })

  app.get('/api/admin/billing/cancellation-requests', ...requirePermission(pool, jwtSecret, 'billing.view'), async (req, res) => {
    try {
      const billingScope = authenticatedAdminBillingScope(req.platformAuth)
      const data = await listCancellationRequests(pool, { status: req.query.status || 'pending', ...billingScope })
      res.json({ success: true, data })
    } catch (error) {
      res.status(errorStatus(error, 500)).json({ success: false, message: error?.message || 'Failed to load cancellation requests.' })
    }
  })

  app.post('/api/admin/billing/cancellation-requests/:id/review', ...requirePermission(pool, jwtSecret, 'billing.manage'), async (req, res) => {
    try {
      const billingScope = authenticatedAdminBillingScope(req.platformAuth)
      const data = await reviewCancellationRequest(pool, {
        requestId: Number(req.params.id),
        decision: req.body?.decision,
        effectiveDate: req.body?.effectiveDate || null,
        reviewNote: req.body?.reviewNote,
        reviewedByUserId: req.platformAuth?.user?.id ?? null,
        ...billingScope,
      })
      res.json({ success: true, data })
    } catch (error) {
      const message = error?.message || 'Failed to review cancellation request.'
      res.status(errorStatus(error, /not found/i.test(message) ? 404 : 400)).json({ success: false, message })
    }
  })

  app.get('/api/admin/billing/disputes', ...requirePermission(pool, jwtSecret, 'billing.view'), async (req, res) => {
    try {
      const billingScope = authenticatedAdminBillingScope(req.platformAuth)
      res.json({ success: true, data: await listDisputeCases(pool, billingScope) })
    } catch (error) {
      res.status(errorStatus(error, 500)).json({ success: false, message: error?.message || 'Failed to load disputes.' })
    }
  })

  app.patch('/api/admin/billing/disputes/:id/evidence', ...requirePermission(pool, jwtSecret, 'billing.manage'), async (req, res) => {
    try {
      const billingScope = authenticatedAdminBillingScope(req.platformAuth)
      const data = await updateDisputeEvidence(pool, {
        id: Number(req.params.id), evidenceStatus: req.body?.evidenceStatus,
        evidenceNote: req.body?.evidenceNote, userId: req.platformAuth?.user?.id ?? null,
        ...billingScope,
      })
      res.json({ success: true, data })
    } catch (error) {
      res.status(errorStatus(error, /not found/i.test(error?.message || '') ? 404 : 400)).json({ success: false, message: error?.message || 'Failed to update dispute evidence.' })
    }
  })

  app.get('/api/admin/stripe/operations', ...requirePermission(pool, jwtSecret, 'billing.view'), async (req, res) => {
    try {
      const billingScope = authenticatedAdminBillingScope(req.platformAuth)
      res.json({ success: true, data: await getStripeOperationsDashboard(pool, billingScope) })
    } catch (error) {
      console.error('[stripe] operations dashboard:', error)
      res.status(errorStatus(error, 500)).json({ success: false, message: 'Failed to load Stripe operations.' })
    }
  })

  app.post('/api/admin/stripe/reconcile', ...requirePermission(pool, jwtSecret, 'billing.manage'), async (req, res) => {
    try {
      if (req.platformAuth?.isMasterAdmin !== true) {
        return res.status(403).json({ success: false, message: 'Facility Owner access is required.' })
      }
      const lookbackHours = Math.min(168, Math.max(1, Number(req.body?.lookbackHours ?? 48)))
      res.json({ success: true, data: await runStripeReconciliation(pool, { lookbackHours }) })
    } catch (error) {
      console.error('[stripe] manual reconciliation:', error)
      res.status(500).json({ success: false, message: error.message || 'Stripe reconciliation failed.' })
    }
  })

  app.post('/api/admin/stripe/billing-alerts/:id/access', ...requirePermission(pool, jwtSecret, 'billing.manage'), async (req, res) => {
    try {
      const billingScope = authenticatedAdminBillingScope(req.platformAuth)
      const data = await applyBillingAccessAction(pool, {
        alertId: Number(req.params.id),
        action: req.body?.action,
        reason: req.body?.reason,
        actedByUserId: req.platformAuth?.user?.id ?? null,
        ...billingScope,
      })
      res.json({ success: true, data })
    } catch (error) {
      const message = error?.message || 'Failed to update billing access.'
      const status = /not found/i.test(message) ? 404 : 400
      res.status(errorStatus(error, status)).json({ success: false, message })
    }
  })

  app.patch('/api/admin/stripe/billing-alerts/:id/resolve', ...requirePermission(pool, jwtSecret, 'billing.manage'), async (req, res) => {
    try {
      const billingScope = authenticatedAdminBillingScope(req.platformAuth)
      const data = await resolveStripeBillingAlert(pool, {
        alertId: Number(req.params.id),
        resolutionNote: req.body?.resolutionNote,
        resolvedByUserId: req.platformAuth?.user?.id ?? null,
        ...billingScope,
      })
      res.json({ success: true, data })
    } catch (error) {
      const message = error?.message || 'Failed to resolve billing alert.'
      const status = /not found/i.test(message) ? 404 : /restore access/i.test(message) ? 409 : 400
      res.status(errorStatus(error, status)).json({ success: false, message })
    }
  })

  app.get('/api/members/billing/statements', ...memberBillingAuthMiddleware(pool, jwtSecret), async (req, res) => {
    const ctx = req.platformAuth
    const memberId = linkedPlatformMemberId(ctx)
    const facilityId = ctx.user.facility_id ?? null
    const familyId = await resolveActiveMemberBillingFamilyId(pool, { memberId, facilityId })
    if (!familyId) return res.json({ success: true, data: [] })
    const account = await loadBillingAccountForFacility(pool, { familyId, facilityId })
    if (!account) return res.json({ success: true, data: [] })
    const canSeeFamily = Number(account.payer_member_id) === memberId
    const linesFilter = canSeeFamily ? '' : 'AND l.member_id = $2'
    const params = canSeeFamily ? [account.id] : [account.id, memberId]
    const result = await pool.query(
      `
        SELECT
          s.*,
          COALESCE(json_agg(l.* ORDER BY l.id) FILTER (WHERE l.id IS NOT NULL), '[]') as lines
        FROM billing_statement s
        LEFT JOIN billing_statement_line l ON l.statement_id = s.id ${linesFilter}
        WHERE s.family_billing_account_id = $1
        GROUP BY s.id
        ORDER BY s.statement_date DESC, s.id DESC
      `,
      params,
    )
    res.json({ success: true, data: result.rows.map((s) => mapStatement(s, s.lines ?? [])) })
  })

  app.get('/api/members/billing/payments', ...memberBillingAuthMiddleware(pool, jwtSecret), async (req, res) => {
    const ctx = req.platformAuth
    const memberId = linkedPlatformMemberId(ctx)
    const facilityId = ctx.user.facility_id ?? null
    const familyId = await resolveActiveMemberBillingFamilyId(pool, { memberId, facilityId })
    if (!familyId) return res.json({ success: true, data: [] })
    const account = await loadBillingAccountForFacility(pool, { familyId, facilityId })
    if (!account) return res.json({ success: true, data: [] })
    const canSeeFamily = Number(account.payer_member_id) === memberId
    if (!canSeeFamily) return res.json({ success: true, data: [] })
    const payments = await pool.query(
      `SELECT * FROM billing_payment WHERE family_billing_account_id = $1 ORDER BY paid_at DESC, id DESC`,
      [account.id],
    )
    res.json({ success: true, data: payments.rows.map(mapPayment) })
  })

  app.get('/api/members/waivers', ...memberPortalAuthMiddleware(pool, jwtSecret), async (req, res) => {
    const memberId = linkedPlatformMemberId(req.platformAuth)
    const result = await pool.query(
      `
        SELECT
          wt.*,
          mwa.id as acceptance_id,
          mwa.accepted_at,
          mwa.signature_name,
          mwa.comments,
          mwa.payment_policy_acknowledged
        FROM member m
        JOIN waiver_template wt ON wt.facility_id = m.facility_id
        LEFT JOIN member_waiver_acceptance mwa
          ON mwa.waiver_template_id = wt.id AND mwa.member_id = m.id
        WHERE m.id = $1
          AND m.facility_id = $2
          AND m.is_active = TRUE
          AND wt.active_from <= now()
          AND (wt.active_to IS NULL OR wt.active_to > now())
        ORDER BY
          CASE wt.waiver_type
            WHEN 'ASSUMPTION_OF_RISK' THEN 1
            WHEN 'RELEASE_OF_LIABILITY' THEN 2
            WHEN 'MEDICAL_EMERGENCY' THEN 3
            WHEN 'PAYMENT_POLICY' THEN 4
            WHEN 'MEDIA_RELEASE' THEN 5
            ELSE 99
          END,
          wt.name,
          wt.version
      `,
      [memberId, req.platformAuth.user.facility_id],
    )
    res.json({ success: true, data: result.rows })
  })

  app.post('/api/members/waivers/accept-all', ...memberPortalAuthMiddleware(pool, jwtSecret), async (req, res) => {
    const signerMemberId = Number(req.platformAuth.user.member_id ?? req.platformAuth.user.id)
    const signatureName = String(req.body?.signatureName || req.body?.signature_name || '').trim()
    const comments = req.body?.comments != null ? String(req.body.comments).trim() : null
    const paymentPolicyAcknowledged = req.body?.paymentPolicyAcknowledged === true
      || req.body?.payment_policy_acknowledged === true
    const requestedMemberIds = Array.isArray(req.body?.memberIds)
      ? req.body.memberIds.map(Number).filter(Number.isFinite)
      : [signerMemberId]
    const acceptedTemplateIds = Array.isArray(req.body?.acceptedTemplateIds)
      ? req.body.acceptedTemplateIds.map(Number).filter(Number.isFinite)
      : []

    if (!signatureName) {
      return res.status(400).json({ success: false, message: 'Signature name is required.' })
    }
    if (acceptedTemplateIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one waiver template must be accepted.' })
    }

    const authz = await canSignWaiversForMembers(pool, signerMemberId, requestedMemberIds)
    if (!authz.ok) {
      return res.status(403).json({ success: false, message: authz.message })
    }

    const requiredIds = await activeWaiverTemplateIds(pool, authz.facilityId, { requiredOnly: true })
    const missingRequired = requiredIds.filter((id) => !acceptedTemplateIds.includes(id))
    if (missingRequired.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'All required waivers must be accepted.',
        missingTemplateIds: missingRequired,
      })
    }

    const templatesRes = await pool.query(
      `
        SELECT id, waiver_type
        FROM waiver_template
        WHERE id = ANY($1::bigint[])
          AND facility_id = $2
          AND active_from <= now()
          AND (active_to IS NULL OR active_to > now())
      `,
      [acceptedTemplateIds, authz.facilityId],
    )
    if (templatesRes.rows.length !== acceptedTemplateIds.length) {
      return res.status(400).json({ success: false, message: 'One or more waiver templates are invalid.' })
    }
    if (templatesRes.rows.some((row) => row.waiver_type === 'PAYMENT_POLICY') && !paymentPolicyAcknowledged) {
      return res.status(400).json({
        success: false,
        message: 'The payment policy acknowledgement is required.',
      })
    }

    const ipAddress = req.ip
    const userAgent = req.get('user-agent') ?? null

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const rows = []
      for (const memberId of authz.targetMemberIds) {
        for (const templateId of acceptedTemplateIds) {
          const isPaymentTemplate = templatesRes.rows.some(
            (row) => Number(row.id) === templateId && row.waiver_type === 'PAYMENT_POLICY',
          )
          const inserted = await client.query(
            `
              INSERT INTO member_waiver_acceptance (
                member_id, waiver_template_id, accepted_by_member_id,
                signature_name, ip_address, user_agent, comments, payment_policy_acknowledged
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (member_id, waiver_template_id) DO UPDATE SET
                accepted_by_member_id = EXCLUDED.accepted_by_member_id,
                accepted_at = now(),
                signature_name = EXCLUDED.signature_name,
                ip_address = EXCLUDED.ip_address,
                user_agent = EXCLUDED.user_agent,
                comments = EXCLUDED.comments,
                payment_policy_acknowledged = EXCLUDED.payment_policy_acknowledged
              RETURNING *
            `,
            [
              memberId,
              templateId,
              signerMemberId,
              signatureName,
              ipAddress,
              userAgent,
              comments,
              isPaymentTemplate ? paymentPolicyAcknowledged : false,
            ],
          )
          rows.push(inserted.rows[0])
        }
      }
      await client.query('COMMIT')
      res.json({ success: true, data: { acceptances: rows, memberIds: authz.targetMemberIds } })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      res.status(400).json({ success: false, message: error.message })
    } finally {
      client.release()
    }
  })

  app.post('/api/members/waivers/:templateId/accept', ...memberPortalAuthMiddleware(pool, jwtSecret), async (req, res) => {
    return res.status(410).json({
      success: false,
      code: 'SINGLE_WAIVER_ACCEPTANCE_RETIRED',
      message: 'Use the validated all-waivers acceptance workflow.',
      replacement: { method: 'POST', path: '/api/members/waivers/accept-all' },
    })
  })

  app.get('/api/coach/me', ...requirePermission(pool, jwtSecret, 'coach_portal.access'), async (req, res) => {
    const ctx = req.platformAuth
    res.json({
      success: true,
      data: {
        id: Number(ctx.user.id),
        email: ctx.user.email,
        fullName: ctx.user.full_name,
        roles: ctx.roles,
        permissions: ctx.permissions,
      },
    })
  })

  app.get('/api/coach/classes', ...requirePermission(pool, jwtSecret, 'coach_portal.access'), async (req, res) => {
    await ensureCoachClassAssignmentSchema(pool)
    const schema = await resolveProgramsSchema(pool)
    const result = await pool.query(
      `
        SELECT
          cca.id,
          cca.programs_id,
          cca.program_id,
          cca.scheduling_form_id,
          cca.scheduling_offering_id,
          cca.scheduling_time_slot_id,
          prog_top.display_name as programs_name,
          p.display_name as program_name,
          sf.title as class_name,
          trim(both ' — ' from concat_ws(' — ',
            prog_top.display_name,
            p.display_name,
            sf.title,
            so.label,
            CASE
              WHEN sts.id IS NOT NULL THEN concat_ws(' ',
                CASE sts.day_of_week
                  WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue'
                  WHEN 3 THEN 'Wed' WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri' WHEN 6 THEN 'Sat'
                  ELSE NULL
                END,
                COALESCE(sts.specific_date::text, NULL),
                to_char(sts.start_time, 'HH24:MI'),
                to_char(sts.end_time, 'HH24:MI')
              )
              ELSE NULL
            END
          )) as assignment_label
        FROM coach_class_assignment cca
        LEFT JOIN ${schema.programsTable} prog_top ON prog_top.id = cca.programs_id
        LEFT JOIN program p ON p.id = cca.program_id
        LEFT JOIN scheduling_form sf ON sf.id = cca.scheduling_form_id AND sf.deleted_at IS NULL
        LEFT JOIN scheduling_offering so ON so.id = cca.scheduling_offering_id
        LEFT JOIN scheduling_time_slot sts ON sts.id = cca.scheduling_time_slot_id
        WHERE cca.coach_user_id = $1
        ORDER BY assignment_label
      `,
      [req.platformAuth.user.id],
    )
    res.json({ success: true, data: result.rows })
  })

  app.get('/api/coach/members', ...requireAnyPermission(pool, jwtSecret, ['coach_portal.access', 'plans.assign']), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const scope = String(req.query.scope || 'my_classes') === 'all' ? 'all' : 'my_classes'
      const members = await queryCoachMemberPickerList(pool, {
        coachUserId,
        facilityId,
        scope,
      })
      res.json({ success: true, data: members })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.get('/api/coach/assign/drilldown', ...requirePermission(pool, jwtSecret, 'plans.assign'), async (req, res) => {
    try {
      const sportId = req.query.sportId != null ? Number(req.query.sportId) : null
      const programId = req.query.programId != null ? Number(req.query.programId) : null
      const formId = req.query.formId != null ? Number(req.query.formId) : null
      const data = await queryAssignDrilldown(pool, req.platformAuth.user.facility_id, {
        sportId: Number.isFinite(sportId) ? sportId : null,
        programId: Number.isFinite(programId) ? programId : null,
        formId: Number.isFinite(formId) ? formId : null,
      })
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.get('/api/coach/classes/:id/roster', ...requirePermission(pool, jwtSecret, 'coach_portal.access'), async (req, res) => {
    await ensureCoachOperationalTables(pool)
    const assignmentId = Number(req.params.id)
    const coachUserId = req.platformAuth.user.id
    const facilityId = req.platformAuth.user.facility_id
    const a = await getCoachClassAssignment(pool, assignmentId, coachUserId)
    if (!a) {
      return res.status(404).json({ success: false, message: 'Assigned class not found.' })
    }
    const roster = await queryCoachRosterMembers(pool, {
      programsId: a.programs_id,
      programId: a.program_id,
      schedulingFormId: a.scheduling_form_id,
      schedulingOfferingId: a.scheduling_offering_id,
      schedulingTimeSlotId: a.scheduling_time_slot_id,
      facilityId,
      assignmentId,
      coachUserId,
    })
    res.json({ success: true, data: roster })
  })

  app.put('/api/coach/classes/:id/roster/:memberId/note', ...requirePermission(pool, jwtSecret, 'coach_portal.access'), async (req, res) => {
    await ensureCoachOperationalTables(pool)
    const assignmentId = Number(req.params.id)
    const memberId = Number(req.params.memberId)
    const assignment = await pool.query(
      `SELECT id FROM coach_class_assignment WHERE id = $1 AND coach_user_id = $2`,
      [assignmentId, req.platformAuth.user.id],
    )
    if (assignment.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assigned class not found.' })
    }
    const updated = await pool.query(
      `
        INSERT INTO coach_roster_note (coach_user_id, assignment_id, member_id, attendance_status, note, note_date)
        VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE))
        ON CONFLICT (coach_user_id, assignment_id, member_id, note_date) DO UPDATE SET
          attendance_status = EXCLUDED.attendance_status,
          note = EXCLUDED.note,
          updated_at = now()
        RETURNING *
      `,
      [
        req.platformAuth.user.id,
        assignmentId,
        memberId,
        req.body?.attendanceStatus || null,
        req.body?.note || null,
        req.body?.noteDate || null,
      ],
    )
    res.json({ success: true, data: updated.rows[0] })
  })

  app.get('/api/admin/portal-settings', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (_req, res) => {
    try {
      const config = await loadPortalConfig(pool)
      res.json({ success: true, data: config })
    } catch (err) {
      console.error('[admin] portal-settings get:', err)
      res.status(500).json({ success: false, message: 'Failed to load portal settings' })
    }
  })

  app.put('/api/admin/portal-settings', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    try {
      const config = await savePortalConfig(pool, {
        member: req.body?.member,
        coach: req.body?.coach,
      })
      res.json({ success: true, data: config })
    } catch (err) {
      console.error('[admin] portal-settings put:', err)
      res.status(500).json({ success: false, message: 'Failed to save portal settings' })
    }
  })

  app.get('/api/members/portal-config', ...memberPortalAuthMiddleware(pool, jwtSecret), async (req, res) => {
    try {
      const facilityId = req.platformAuth?.user?.facility_id ?? null
      const config = await loadPortalConfig(pool, facilityId)
      res.json({
        success: true,
        data: {
          hiddenTabs: config.member.hiddenTabs,
          tabOrder: config.member.tabOrder,
          navLayout: config.member.navLayout,
          stripeEnabled: isStripeEnabled(),
        },
      })
    } catch (err) {
      console.error('[members] portal-config:', err)
      res.status(500).json({ success: false, message: 'Failed to load portal config' })
    }
  })

  app.get('/api/coach/portal-config', ...requirePermission(pool, jwtSecret, 'coach_portal.access'), async (req, res) => {
    try {
      const facilityId = req.platformAuth?.user?.facility_id ?? null
      const config = await loadPortalConfig(pool, facilityId)
      res.json({
        success: true,
        data: {
          hiddenTabs: config.coach.hiddenTabs,
          tabOrder: config.coach.tabOrder,
          navLayout: config.coach.navLayout,
        },
      })
    } catch (err) {
      console.error('[coach] portal-config:', err)
      res.status(500).json({ success: false, message: 'Failed to load portal config' })
    }
  })

  app.get('/api/admin/email/status', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (_req, res) => {
    try {
      const config = getEmailConfigSummary()
      const verify = config.configured ? await verifySmtpConnection() : { ok: false, error: null }
      res.json({
        success: true,
        data: {
          ...config,
          smtpVerified: verify.ok,
          smtpError: verify.error,
          buildId: API_BUILD_ID,
          emailLayoutVersion: EMAIL_LAYOUT_VERSION,
        },
      })
    } catch (err) {
      console.error('[admin] email status:', err)
      res.status(500).json({ success: false, message: 'Failed to check email status' })
    }
  })

  app.post('/api/admin/email/test', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    if (req.platformAuth?.isMasterAdmin !== true) {
      return res.status(403).json({ success: false, message: 'Facility Owner access is required' })
    }
    const to = String(req.body?.to || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ success: false, message: 'A valid recipient email is required' })
    }
    if (!isEmailConfigured()) {
      return res.status(400).json({
        success: false,
        message: formatEmailError(new Error('not configured')),
      })
    }

    const subject = 'Vortex Athletics email test'
    const text = [
      'This is a test email from Vortex Athletics.',
      '',
      'If you received this, transactional email is configured correctly.',
      '',
      `Layout version: ${EMAIL_LAYOUT_VERSION}`,
      '',
      '— Vortex Athletics',
    ].join('\n')
    const html = composeEmailHtml(`
      <p>This is a test email from <strong>Vortex Athletics</strong>.</p>
      <p>If you received this, transactional email is configured correctly.</p>
      ${emailButtonHtml('Visit Vortex Athletics', publicAppUrl())}
      <p style="color:#666;font-size:13px;">Sent ${escapeHtml(new Date().toISOString())}</p>
      <p style="color:#666;font-size:13px;">Template: ${escapeHtml(EMAIL_LAYOUT_VERSION)}</p>
    `)

    try {
      await sendEmail({ to, subject, text, html })
      res.json({
        success: true,
        message: `Test email sent to ${to}`,
        buildId: API_BUILD_ID,
        emailLayoutVersion: EMAIL_LAYOUT_VERSION,
      })
    } catch (err) {
      console.error('[admin] email test send failed:', err?.message || err)
      res.status(502).json({ success: false, message: err?.message || 'Failed to send test email' })
    }
  })

  console.log('✅ Platform access, billing, waiver, and coach routes registered')
}

export { authMiddleware, requirePermission, requireAnyPermission, hasPermission }
