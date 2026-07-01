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
import {
  stripeEnabled as isStripeEnabled,
  createCheckoutSession,
  parseWebhookEvent,
  recordStripePayment,
} from '../billing/stripeBilling.js'
import { buildBillingAccountView } from '../billing/billingAccountView.js'
import { notifyPaymentReceipt, notifyPaymentFailed } from '../email/memberNotifications.js'

function tokenFrom(req) {
  const authHeader = req.headers.authorization
  return authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
}

function normalizeRoleKey(role) {
  return String(role || '').trim().toUpperCase()
}

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim())

/**
 * Resolve who should receive a member's waiver-request email.
 * Prefers the member's own email; for minors falls back to a guardian's email
 * (from parent_guardian_ids), then any adult in the family.
 * Returns { email, guardianName } or null when no usable recipient exists.
 */
async function resolveWaiverRecipient(pool, memberRow) {
  if (isValidEmail(memberRow?.email)) {
    return { email: String(memberRow.email).trim(), guardianName: null }
  }

  const guardianIds = Array.isArray(memberRow?.parent_guardian_ids) ? memberRow.parent_guardian_ids : []
  if (guardianIds.length > 0) {
    const guardians = await pool.query(
      `SELECT email, first_name FROM member
       WHERE id = ANY($1::bigint[]) AND email IS NOT NULL AND email <> ''
       ORDER BY id ASC`,
      [guardianIds],
    )
    const guardian = guardians.rows.find((row) => isValidEmail(row.email))
    if (guardian) return { email: String(guardian.email).trim(), guardianName: guardian.first_name || null }
  }

  if (memberRow?.family_id) {
    const adults = await pool.query(
      `SELECT email, first_name FROM member
       WHERE family_id = $1 AND email IS NOT NULL AND email <> ''
         AND (parent_guardian_ids IS NULL OR array_length(parent_guardian_ids, 1) IS NULL)
       ORDER BY id ASC LIMIT 1`,
      [memberRow.family_id],
    )
    const adult = adults.rows.find((row) => isValidEmail(row.email))
    if (adult) return { email: String(adult.email).trim(), guardianName: adult.first_name || null }
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

// The default master admin account is permanent: it can never lose its
// MASTER_ADMIN role, be deactivated, or be deleted. Override via env if the
// owner account email ever changes.
const DEFAULT_MASTER_EMAIL = (process.env.DEFAULT_MASTER_EMAIL || 'team.vortexathletics@gmail.com')
  .trim()
  .toLowerCase()

async function isDefaultMasterUser(pool, userId) {
  const result = await pool.query(`SELECT LOWER(email) AS email FROM app_user WHERE id = $1`, [userId])
  return result.rows[0]?.email === DEFAULT_MASTER_EMAIL
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
  const masterAdmin =
    user.is_master_admin === true ||
    roles.includes('MASTER_ADMIN')

  if (masterAdmin) {
    const all = await pool.query(`SELECT key FROM permission ORDER BY key`)
    return {
      isMasterAdmin: true,
      permissions: all.rows.map((r) => r.key),
    }
  }

  const base = await pool.query(
    `
      SELECT DISTINCT p.key
      FROM role r
      JOIN role_permission rp ON rp.role_id = r.id
      JOIN permission p ON p.id = rp.permission_id
      WHERE r.key = ANY($1::text[])
    `,
    [roles],
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

async function loadAuthContext(pool, jwtSecret, req) {
  const token = tokenFrom(req)
  if (!token) return null
  const decoded = jwt.verify(token, jwtSecret)
  const userId = decoded.userId || decoded.adminId || decoded.memberId
  if (!userId) return null

  const userRes = await pool.query(
    `
      SELECT
        au.id,
        au.facility_id,
        au.email,
        au.full_name,
        au.phone,
        au.username,
        au.role::text as role,
        au.is_active,
        COALESCE(ap.is_master_admin, false) as is_master_admin,
        m.id as member_id,
        m.family_id
      FROM app_user au
      LEFT JOIN admin_profile ap ON ap.user_id = au.id
      LEFT JOIN member m ON m.app_user_id = au.id OR (m.app_user_id IS NULL AND m.id = au.id)
      WHERE au.id = $1
      LIMIT 1
    `,
    [userId],
  )

  if (userRes.rows.length === 0 || userRes.rows[0].is_active === false) return null
  const user = userRes.rows[0]
  const roles = await loadUserRoles(pool, user)
  const permissionState = await loadUserPermissions(pool, user, roles)
  return {
    user,
    roles,
    permissions: permissionState.permissions,
    isMasterAdmin: permissionState.isMasterAdmin,
  }
}

function hasPermission(ctx, permission) {
  return ctx?.isMasterAdmin === true || ctx?.permissions?.includes(permission)
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

function requirePermission(pool, jwtSecret, permission) {
  const auth = authMiddleware(pool, jwtSecret)
  return [
    auth,
    (req, res, next) => {
      if (!hasPermission(req.platformAuth, permission)) {
        return res.status(403).json({ success: false, message: `Missing permission: ${permission}` })
      }
      next()
    },
  ]
}

function requireAnyPermission(pool, jwtSecret, permissions) {
  const auth = authMiddleware(pool, jwtSecret)
  return [
    auth,
    (req, res, next) => {
      if (permissions.some((permission) => hasPermission(req.platformAuth, permission))) {
        next()
        return
      }
      return res.status(403).json({ success: false, message: 'Insufficient permissions' })
    },
  ]
}

function requireMasterAdmin(pool, jwtSecret) {
  const auth = authMiddleware(pool, jwtSecret)
  return [
    auth,
    (req, res, next) => {
      if (req.platformAuth?.isMasterAdmin !== true) {
        return res.status(403).json({ success: false, message: 'Only master admins can perform this action.' })
      }
      next()
    },
  ]
}

async function deleteAppUserCompletely(client, userId, facilityId) {
  await client.query('DELETE FROM coach_class_assignment WHERE coach_user_id = $1', [userId])

  const members = await client.query(
    `SELECT id FROM member WHERE app_user_id = $1 AND facility_id = $2`,
    [userId, facilityId],
  )
  const memberIds = members.rows.map((row) => Number(row.id))
  if (memberIds.length > 0) {
    await client.query('DELETE FROM member WHERE id = ANY($1::bigint[])', [memberIds])
  }

  await client.query('DELETE FROM app_user WHERE id = $1 AND facility_id = $2', [userId, facilityId])
}

async function ensureBillingAccount(pool, familyId) {
  const existing = await pool.query(
    `SELECT * FROM family_billing_account WHERE family_id = $1`,
    [familyId],
  )
  if (existing.rows.length > 0) return existing.rows[0]

  const created = await pool.query(
    `
      INSERT INTO family_billing_account (
        family_id, payer_member_id, billing_email, billing_phone,
        billing_street, billing_city, billing_state, billing_zip
      )
      SELECT
        f.id,
        m.id,
        m.email,
        m.phone,
        m.billing_street,
        m.billing_city,
        m.billing_state,
        m.billing_zip
      FROM family f
      LEFT JOIN LATERAL (
        SELECT *
        FROM member
        WHERE family_id = f.id AND is_active = TRUE
        ORDER BY (email IS NULL), id
        LIMIT 1
      ) m ON TRUE
      WHERE f.id = $1
      RETURNING *
    `,
    [familyId],
  )
  return created.rows[0] ?? null
}

async function memberBelongsToFamily(pool, memberId, familyId) {
  if (!memberId) return true
  const res = await pool.query(
    `
      SELECT 1
      FROM family_member
      WHERE member_id = $1
        AND family_id = $2
        AND is_active = TRUE
    `,
    [memberId, familyId],
  )
  return res.rows.length > 0
}

async function activeWaiverTemplateIds(pool, facilityId, { requiredOnly = true } = {}) {
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

async function canSignWaiversForMembers(pool, signerMemberId, targetMemberIds) {
  const uniqueTargets = [...new Set(targetMemberIds.map(Number).filter(Number.isFinite))]
  if (uniqueTargets.length === 0) return { ok: false, message: 'No members specified.' }

  const signerRes = await pool.query(
    `SELECT id, facility_id FROM member WHERE id = $1 AND is_active = TRUE`,
    [signerMemberId],
  )
  if (signerRes.rows.length === 0) return { ok: false, message: 'Signer member not found.' }
  const facilityId = signerRes.rows[0].facility_id

  const targetsRes = await pool.query(
    `
      SELECT m.id, m.parent_guardian_ids, fm.family_id
      FROM member m
      LEFT JOIN family_member fm ON fm.member_id = m.id AND fm.is_active = TRUE
      WHERE m.id = ANY($1::bigint[]) AND m.facility_id = $2 AND m.is_active = TRUE
    `,
    [uniqueTargets, facilityId],
  )
  if (targetsRes.rows.length !== uniqueTargets.length) {
    return { ok: false, message: 'One or more members were not found.' }
  }

  const signerFamily = await pool.query(
    `
      SELECT fm.family_id, fba.payer_member_id
      FROM family_member fm
      LEFT JOIN family_billing_account fba ON fba.family_id = fm.family_id
      WHERE fm.member_id = $1 AND fm.is_active = TRUE
      LIMIT 1
    `,
    [signerMemberId],
  )
  const signerFamilyId = signerFamily.rows[0]?.family_id ?? null
  const payerMemberId = signerFamily.rows[0]?.payer_member_id != null
    ? Number(signerFamily.rows[0].payer_member_id)
    : null

  for (const row of targetsRes.rows) {
    const targetId = Number(row.id)
    if (targetId === signerMemberId) continue
    if (signerFamilyId == null || Number(row.family_id) !== Number(signerFamilyId)) {
      return { ok: false, message: 'You can only sign waivers for members in your family.' }
    }
    const guardians = (row.parent_guardian_ids ?? []).map(Number)
    const isGuardian = guardians.includes(signerMemberId)
    const isPayer = payerMemberId === signerMemberId
    if (!isGuardian && !isPayer) {
      return { ok: false, message: 'Only a parent, guardian, or billing contact can sign for another member.' }
    }
  }

  return { ok: true, facilityId, targetMemberIds: uniqueTargets }
}

async function updateMemberWaiverCompatibility(pool, memberId) {
  const member = await pool.query(
    `SELECT facility_id FROM member WHERE id = $1`,
    [memberId],
  )
  if (member.rows.length === 0) return
  const requiredIds = await activeWaiverTemplateIds(pool, member.rows[0].facility_id)
  if (requiredIds.length === 0) return
  const accepted = await pool.query(
    `
      SELECT COUNT(DISTINCT waiver_template_id)::int as count
      FROM member_waiver_acceptance
      WHERE member_id = $1 AND waiver_template_id = ANY($2::bigint[])
    `,
    [memberId, requiredIds],
  )
  const complete = Number(accepted.rows[0]?.count ?? 0) >= requiredIds.length
  await pool.query(
    `
      UPDATE member
      SET has_completed_waivers = $2,
          waiver_completion_date = CASE WHEN $2 THEN COALESCE(waiver_completion_date, now()) ELSE waiver_completion_date END,
          updated_at = now()
      WHERE id = $1
    `,
    [memberId, complete],
  )
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
    createdAt: row.created_at,
  }
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
    createdAt: row.created_at,
  }
}

function nameParts(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  }
}

async function ensureMemberForUser(pool, userId) {
  const userRes = await pool.query(
    `SELECT id, facility_id, email, phone, full_name, username FROM app_user WHERE id = $1`,
    [userId],
  )
  const user = userRes.rows[0]
  if (!user) return null

  const existing = await pool.query(
    `SELECT * FROM member WHERE app_user_id = $1 OR (app_user_id IS NULL AND email = $2 AND facility_id = $3) LIMIT 1`,
    [userId, user.email, user.facility_id],
  )
  const parts = nameParts(user.full_name)
  if (existing.rows.length > 0) {
    const updated = await pool.query(
      `
        UPDATE member
        SET app_user_id = COALESCE(app_user_id, $1),
            first_name = COALESCE(NULLIF(first_name, ''), $2),
            last_name = COALESCE(NULLIF(last_name, ''), $3),
            email = COALESCE(email, $4),
            phone = COALESCE(phone, $5),
            username = COALESCE(username, $6),
            updated_at = now()
        WHERE id = $7
        RETURNING *
      `,
      [userId, parts.firstName || 'Member', parts.lastName || 'User', user.email, user.phone, user.username, existing.rows[0].id],
    )
    return updated.rows[0]
  }

  const created = await pool.query(
    `
      INSERT INTO member (facility_id, app_user_id, first_name, last_name, email, phone, username, status, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'legacy', TRUE)
      RETURNING *
    `,
    [user.facility_id, userId, parts.firstName || 'Member', parts.lastName || 'User', user.email, user.phone, user.username],
  )
  return created.rows[0]
}

async function countMasterAdmins(pool) {
  const result = await pool.query(`
    SELECT COUNT(DISTINCT au.id)::int as count
    FROM app_user au
    LEFT JOIN app_user_role aur ON aur.user_id = au.id
    LEFT JOIN admin_profile ap ON ap.user_id = au.id
    WHERE au.is_active = TRUE
      AND (
        au.role::text = 'MASTER_ADMIN'
        OR aur.role::text = 'MASTER_ADMIN'
        OR COALESCE(ap.is_master_admin, false)
      )
  `)
  return Number(result.rows[0]?.count ?? 0)
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
  app.get('/api/admin/access/me', authMiddleware(pool, jwtSecret), async (req, res) => {
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
        permissions: ctx.permissions,
        isMasterAdmin: ctx.isMasterAdmin,
      },
    })
  })

  app.get('/api/admin/access/users', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    const users = await pool.query(
      `
        SELECT
          au.id,
          au.email,
          au.full_name,
          au.phone,
          au.username,
          au.role::text as role,
          au.is_active,
          m.id as member_id,
          COALESCE(ap.is_master_admin, false) as is_master_admin,
          COALESCE(array_agg(DISTINCT aur.role::text) FILTER (WHERE aur.role IS NOT NULL), '{}') as roles
        FROM app_user au
        LEFT JOIN member m ON m.app_user_id = au.id
        LEFT JOIN admin_profile ap ON ap.user_id = au.id
        LEFT JOIN app_user_role aur ON aur.user_id = au.id
        WHERE au.facility_id = $1
        GROUP BY au.id, m.id, ap.is_master_admin
        ORDER BY au.full_name, au.email
      `,
      [req.platformAuth.user.facility_id],
    )
    res.json({
      success: true,
      data: users.rows.map((u) => ({
        id: Number(u.id),
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
        username: u.username,
        role: u.role,
        memberId: u.member_id != null ? Number(u.member_id) : null,
        roles: [...new Set([u.role, ...(u.roles ?? [])].map(normalizeRoleKey))].filter(Boolean),
        isActive: u.is_active !== false,
        isMasterAdmin: u.is_master_admin === true,
      })),
    })
  })

  app.post('/api/admin/access/users', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    const fullName = String(req.body?.fullName || '').trim()
    const email = req.body?.email ? String(req.body.email).trim() : null
    const username = req.body?.username ? String(req.body.username).trim() : null
    const phone = req.body?.phone ? String(req.body.phone).trim() : null
    const password = String(req.body?.password || '')
    const roles = reconcileAdminRoles(Array.isArray(req.body?.roles) ? req.body.roles : ['MEMBER_ATHLETE'])
    if (!fullName || !password || roles.length === 0) {
      return res.status(400).json({ success: false, message: 'Full name, password, and at least one role are required.' })
    }
    if (!email && !username) {
      return res.status(400).json({ success: false, message: 'Email or username is required.' })
    }

    const existing = await pool.query(
      `SELECT id FROM app_user WHERE facility_id = $1 AND (($2::text IS NOT NULL AND email = $2) OR ($3::text IS NOT NULL AND LOWER(username) = LOWER($3)))`,
      [req.platformAuth.user.facility_id, email, username],
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email or username already exists.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await pool.query('BEGIN')
    try {
      const created = await pool.query(
        `
          INSERT INTO app_user (facility_id, role, email, phone, full_name, username, password_hash, is_active)
          VALUES ($1, $2::user_role, $3, $4, $5, $6, $7, TRUE)
          RETURNING id
        `,
        [req.platformAuth.user.facility_id, roles[0], email, phone, fullName, username, passwordHash],
      )
      const userId = Number(created.rows[0].id)
      for (const role of roles) {
        await pool.query(`INSERT INTO app_user_role (user_id, role) VALUES ($1, $2::user_role) ON CONFLICT DO NOTHING`, [userId, role])
      }
      if (roles.some((r) => ['MASTER_ADMIN', 'ADMIN'].includes(r))) {
        await pool.query(
          `
            INSERT INTO admin_profile (user_id, is_master_admin)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET is_master_admin = EXCLUDED.is_master_admin, updated_at = now()
          `,
          [userId, roles.includes('MASTER_ADMIN')],
        )
      }
      if (roles.includes('COACH')) {
        await pool.query(`INSERT INTO coach_profile (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET is_active = TRUE, updated_at = now()`, [userId])
      }
      await ensureMemberForUser(pool, userId)
      await pool.query('COMMIT')
      res.json({ success: true, data: { id: userId } })
    } catch (error) {
      await pool.query('ROLLBACK')
      res.status(400).json({ success: false, message: error.message })
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
    const roles = reconcileAdminRoles(Array.isArray(req.body?.roles) ? req.body.roles : [])
    const isMasterAdmin = req.body?.isMasterAdmin === true || roles.includes('MASTER_ADMIN')
    if (!Number.isFinite(userId) || roles.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one role is required.' })
    }

    if (await isDefaultMasterUser(pool, userId)) {
      return res.status(400).json({ success: false, message: 'The default master admin account roles cannot be changed.' })
    }

    const primaryRole = roles[0]
    const previousRoles = await loadUserRoles(pool, { id: userId, role: null })
    const wasMaster = previousRoles.some((role) => role === 'MASTER_ADMIN')
    const willBeMaster = roles.some((role) => role === 'MASTER_ADMIN')
    if (wasMaster && !willBeMaster && (await isDefaultMasterUser(pool, userId))) {
      return res.status(400).json({ success: false, message: 'The default master admin account must keep master admin access.' })
    }
    if (wasMaster && !willBeMaster && (await countMasterAdmins(pool)) <= 1) {
      return res.status(400).json({ success: false, message: 'Cannot remove the last master admin.' })
    }
    if (userId === Number(req.platformAuth.user.id) && wasMaster && !willBeMaster) {
      return res.status(400).json({ success: false, message: 'You cannot remove your own master admin access.' })
    }

    await pool.query('BEGIN')
    try {
      await pool.query(`UPDATE app_user SET role = $2::user_role, updated_at = now() WHERE id = $1`, [userId, primaryRole])
      await pool.query(`DELETE FROM app_user_role WHERE user_id = $1`, [userId])
      for (const role of roles) {
        await pool.query(
          `INSERT INTO app_user_role (user_id, role) VALUES ($1, $2::user_role) ON CONFLICT DO NOTHING`,
          [userId, role],
        )
      }
      if (roles.some((r) => ['MASTER_ADMIN', 'ADMIN'].includes(r))) {
        await pool.query(
          `
            INSERT INTO admin_profile (user_id, is_master_admin)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET
              is_master_admin = EXCLUDED.is_master_admin,
              updated_at = now()
          `,
          [userId, isMasterAdmin],
        )
      } else {
        await pool.query(`DELETE FROM admin_profile WHERE user_id = $1`, [userId])
      }
      if (roles.includes('COACH')) {
        await pool.query(
          `INSERT INTO coach_profile (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET is_active = TRUE, updated_at = now()`,
          [userId],
        )
      } else {
        await pool.query(`UPDATE coach_profile SET is_active = FALSE, updated_at = now() WHERE user_id = $1`, [userId])
      }
      await ensureMemberForUser(pool, userId)
      await pool.query('COMMIT')
      res.json({ success: true })
    } catch (error) {
      await pool.query('ROLLBACK')
      res.status(400).json({ success: false, message: error.message })
    }
  })

  app.put('/api/admin/access/users/:userId/permissions', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    const userId = Number(req.params.userId)
    const allow = Array.isArray(req.body?.allow) ? req.body.allow.map(String) : []
    const deny = Array.isArray(req.body?.deny) ? req.body.deny.map(String) : []
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id.' })
    if (await isDefaultMasterUser(pool, userId)) {
      return res.status(400).json({ success: false, message: 'The default master admin account permissions cannot be changed.' })
    }

    await pool.query('BEGIN')
    try {
      await pool.query(`DELETE FROM app_user_permission_override WHERE user_id = $1`, [userId])
      for (const [effect, keys] of [['allow', allow], ['deny', deny]]) {
        for (const key of keys) {
          await pool.query(
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
      await pool.query('COMMIT')
      res.json({ success: true })
    } catch (error) {
      await pool.query('ROLLBACK')
      res.status(400).json({ success: false, message: error.message })
    }
  })

  app.patch('/api/admin/access/users/:userId/active', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    const userId = Number(req.params.userId)
    const isActive = req.body?.isActive === true
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id.' })
    if (userId === Number(req.platformAuth.user.id) && !isActive) {
      return res.status(400).json({ success: false, message: 'You cannot archive your own account.' })
    }
    if (!isActive && (await isDefaultMasterUser(pool, userId))) {
      return res.status(400).json({ success: false, message: 'The default master admin account cannot be archived.' })
    }
    const roles = await loadUserRoles(pool, { id: userId, role: null })
    if (!isActive && roles.some((role) => role === 'MASTER_ADMIN') && (await countMasterAdmins(pool)) <= 1) {
      return res.status(400).json({ success: false, message: 'Cannot archive the last master admin.' })
    }
    await pool.query(`UPDATE app_user SET is_active = $2, updated_at = now() WHERE id = $1`, [userId, isActive])
    await pool.query(`UPDATE member SET is_active = $2, status = CASE WHEN $2 THEN status ELSE 'archived' END, updated_at = now() WHERE app_user_id = $1`, [userId, isActive])
    await pool.query(
      `UPDATE coach_profile SET is_active = $2, updated_at = now() WHERE user_id = $1`,
      [userId, isActive],
    )
    res.json({ success: true })
  })

  app.put('/api/admin/access/users/:userId', ...requirePermission(pool, jwtSecret, 'admin_access.manage'), async (req, res) => {
    const userId = Number(req.params.userId)
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id.' })

    const existing = await pool.query(
      `SELECT id, full_name, email, username FROM app_user WHERE id = $1 AND facility_id = $2`,
      [userId, req.platformAuth.user.facility_id],
    )
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found.' })
    }

    const fullName = req.body?.fullName != null ? String(req.body.fullName).trim() : null
    const email = req.body?.email != null ? String(req.body.email).trim() : null
    const phone = req.body?.phone != null ? String(req.body.phone).trim() : null
    const username = req.body?.username != null ? String(req.body.username).trim() : null
    const password = req.body?.password ? String(req.body.password) : null

    if (await isDefaultMasterUser(pool, userId)) {
      if (fullName !== null || username !== null || password) {
        return res.status(400).json({
          success: false,
          message: 'The default master admin account can only update email and phone.',
        })
      }
    }

    if (fullName !== null && !fullName) {
      return res.status(400).json({ success: false, message: 'Full name cannot be empty.' })
    }
    if (email !== null && !email) {
      return res.status(400).json({ success: false, message: 'Email cannot be empty.' })
    }

    if (email || username) {
      const conflict = await pool.query(
        `
          SELECT id FROM app_user
          WHERE facility_id = $1
            AND id <> $2
            AND (
              ($3::text IS NOT NULL AND LOWER(email) = LOWER($3))
              OR ($4::text IS NOT NULL AND LOWER(username) = LOWER($4))
            )
        `,
        [req.platformAuth.user.facility_id, userId, email, username],
      )
      if (conflict.rows.length > 0) {
        return res.status(409).json({ success: false, message: 'Email or username already in use.' })
      }
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
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10)
      updates.push(`password_hash = $${paramCount++}`)
      values.push(passwordHash)
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No changes provided.' })
    }

    updates.push('updated_at = now()')
    values.push(userId)
    await pool.query(`UPDATE app_user SET ${updates.join(', ')} WHERE id = $${paramCount}`, values)

    if (fullName !== null || email !== null || phone !== null || username !== null) {
      const nameParts = (fullName ?? existing.rows[0].full_name ?? '').trim().split(/\s+/).filter(Boolean)
      const firstName = nameParts[0] || 'Member'
      const lastName = nameParts.slice(1).join(' ') || 'User'
      await pool.query(
        `
          UPDATE member
          SET
            first_name = $2,
            last_name = $3,
            email = COALESCE($4, email),
            phone = COALESCE($5, phone),
            username = COALESCE($6, username),
            updated_at = now()
          WHERE app_user_id = $1
        `,
        [userId, firstName, lastName, email, phone || null, username || null],
      )
    }

    res.json({ success: true })
  })

  app.delete('/api/admin/access/users/:userId', ...requireMasterAdmin(pool, jwtSecret), async (req, res) => {
    const userId = Number(req.params.userId)
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id.' })
    if (userId === Number(req.platformAuth.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' })
    }
    if (await isDefaultMasterUser(pool, userId)) {
      return res.status(400).json({ success: false, message: 'The default master admin account cannot be deleted.' })
    }
    const roles = await loadUserRoles(pool, { id: userId, role: null })
    if (roles.some((role) => role === 'MASTER_ADMIN') && (await countMasterAdmins(pool)) <= 1) {
      return res.status(400).json({ success: false, message: 'Cannot delete the last master admin.' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await deleteAppUserCompletely(client, userId, req.platformAuth.user.facility_id)
      await client.query('COMMIT')
      res.json({ success: true, message: 'Account deleted permanently.' })
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Delete access user error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
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
          scheduling_time_slot_id,
          class_iteration_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
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
        payload.class_iteration_id,
      ],
    )
    res.json({ success: true, data: created.rows[0] ?? null })
  })

  app.delete('/api/admin/coaches/assignments/:assignmentId', ...requirePermission(pool, jwtSecret, 'classes.manage'), async (req, res) => {
    await pool.query(`DELETE FROM coach_class_assignment WHERE id = $1`, [Number(req.params.assignmentId)])
    res.json({ success: true })
  })

  app.get('/api/admin/families/:familyId/billing-account', ...requirePermission(pool, jwtSecret, 'billing.view'), async (req, res) => {
    const familyId = Number(req.params.familyId)
    const account = await ensureBillingAccount(pool, familyId)
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
        monthlyTotals: view.monthlyTotals,
        refunds: view.refunds,
        ledger: view.ledger,
        bundlePasses: view.bundlePasses,
        bundleUsage: view.bundleUsage,
      },
    })
  })

  app.put('/api/admin/families/:familyId/billing-account', ...requirePermission(pool, jwtSecret, 'family_billing.manage'), async (req, res) => {
    const familyId = Number(req.params.familyId)
    const payerMemberId = req.body?.payerMemberId == null ? null : Number(req.body.payerMemberId)
    if (!(await memberBelongsToFamily(pool, payerMemberId, familyId))) {
      return res.status(400).json({ success: false, message: 'Payer must belong to this family.' })
    }
    await ensureBillingAccount(pool, familyId)
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
    res.json({ success: true, data: mapBillingAccount(updated.rows[0]) })
  })

  app.post('/api/admin/families/:familyId/charges', ...requirePermission(pool, jwtSecret, 'billing.manage'), async (req, res) => {
    const familyId = Number(req.params.familyId)
    const account = await ensureBillingAccount(pool, familyId)
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    const amountCents = Number(req.body?.amountCents)
    if (!Number.isFinite(amountCents) || !req.body?.description) {
      return res.status(400).json({ success: false, message: 'description and amountCents are required.' })
    }
    const allowedChargeTypes = ['one_time', 'recurring', 'adjustment', 'refund', 'credit']
    const chargeType = allowedChargeTypes.includes(req.body?.chargeType) ? req.body.chargeType : 'one_time'
    const billingInterval = req.body?.billingInterval === 'month' ? 'month' : 'one_time'
    const roundedAmount = Math.round(amountCents)
    const grossAmount = req.body?.grossAmountCents != null ? Math.round(Number(req.body.grossAmountCents)) : roundedAmount
    const discountAmount = req.body?.discountAmountCents != null ? Math.round(Number(req.body.discountAmountCents)) : 0
    const charge = await pool.query(
      `
        INSERT INTO billing_charge (
          family_billing_account_id, member_id, source_type, source_id,
          description, amount_cents, gross_amount_cents, discount_amount_cents,
          charge_type, billing_interval, service_period_start, service_period_end
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `,
      [
        account.id,
        req.body?.memberId ?? null,
        req.body?.sourceType ?? 'manual',
        req.body?.sourceId ?? null,
        req.body.description,
        roundedAmount,
        grossAmount,
        discountAmount,
        chargeType,
        billingInterval,
        req.body?.servicePeriodStart ?? null,
        req.body?.servicePeriodEnd ?? null,
      ],
    )
    res.json({ success: true, data: mapCharge(charge.rows[0]) })
  })

  app.get('/api/admin/families/:familyId/charges', ...requirePermission(pool, jwtSecret, 'billing.view'), async (req, res) => {
    const account = await ensureBillingAccount(pool, Number(req.params.familyId))
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

  app.get('/api/admin/families/:familyId/payments', ...requirePermission(pool, jwtSecret, 'billing.view'), async (req, res) => {
    const account = await ensureBillingAccount(pool, Number(req.params.familyId))
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    const payments = await pool.query(
      `SELECT * FROM billing_payment WHERE family_billing_account_id = $1 ORDER BY paid_at DESC, id DESC`,
      [account.id],
    )
    res.json({ success: true, data: payments.rows.map(mapPayment) })
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

  app.post('/api/admin/families/:familyId/payments', ...requirePermission(pool, jwtSecret, 'billing.manage'), async (req, res) => {
    const account = await ensureBillingAccount(pool, Number(req.params.familyId))
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    const amountCents = Number(req.body?.amountCents)
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({ success: false, message: 'Positive amountCents is required.' })
    }
    const payment = await pool.query(
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
          stripe_payment_intent_id
        )
        VALUES ($1, $2, COALESCE($3::timestamptz, now()), $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        account.id,
        amountCents,
        req.body?.paidAt ?? req.body?.paymentDate ?? null,
        req.body?.method ?? null,
        req.body?.note ?? req.body?.notes ?? null,
        req.body?.externalProcessor ?? process.env.PAYMENTS_PROVIDER ?? 'external',
        req.body?.externalReference ?? null,
        req.body?.externalStatus ?? 'recorded',
        req.body?.stripeCustomerId ?? null,
        req.body?.stripePaymentIntentId ?? null,
      ],
    )
    const paymentRow = payment.rows[0]
    res.json({ success: true, data: mapPayment(paymentRow) })
    notifyPaymentReceipt(pool, { account, payment: paymentRow }).catch(() => {})
  })

  app.post('/api/admin/families/:familyId/refunds', ...requirePermission(pool, jwtSecret, 'billing.manage'), async (req, res) => {
    const account = await ensureBillingAccount(pool, Number(req.params.familyId))
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    const amountCents = Number(req.body?.amountCents)
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({ success: false, message: 'Positive amountCents is required.' })
    }
    let paymentId = req.body?.paymentId != null ? Number(req.body.paymentId) : null
    if (paymentId != null) {
      const owns = await pool.query(
        `SELECT 1 FROM billing_payment WHERE id = $1 AND family_billing_account_id = $2`,
        [paymentId, account.id],
      )
      if (owns.rows.length === 0) paymentId = null
    }
    const createdBy = req.platformAuth?.user?.id ?? null
    const refund = await pool.query(
      `
        INSERT INTO billing_refund (
          family_billing_account_id, payment_id, amount_cents, reason, external_reference, created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [account.id, paymentId, Math.round(amountCents), req.body?.reason ?? null, req.body?.externalReference ?? null, createdBy],
    )
    res.json({ success: true, data: refund.rows[0] })
  })

  app.patch('/api/admin/subscriptions/:id/status', ...requirePermission(pool, jwtSecret, 'billing.manage'), async (req, res) => {
    const id = Number(req.params.id)
    const status = req.body?.status
    if (!['active', 'paused', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be active, paused, or cancelled.' })
    }
    let sql
    let params
    if (status === 'cancelled') {
      sql = `UPDATE billing_subscription SET status = 'cancelled', end_date = CURRENT_DATE, next_bill_date = NULL, updated_at = now() WHERE id = $1 RETURNING *`
      params = [id]
    } else if (status === 'paused') {
      sql = `UPDATE billing_subscription SET status = 'paused', updated_at = now() WHERE id = $1 AND status <> 'cancelled' RETURNING *`
      params = [id]
    } else {
      // Reactivate: if next_bill_date is null, set to today so the next run picks it up.
      sql = `UPDATE billing_subscription SET status = 'active', end_date = NULL, next_bill_date = COALESCE(next_bill_date, CURRENT_DATE), updated_at = now() WHERE id = $1 AND status <> 'cancelled' RETURNING *`
      params = [id]
    }
    const updated = await pool.query(sql, params)
    if (updated.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription not found or already cancelled.' })
    }
    res.json({ success: true, data: updated.rows[0] })
  })

  app.post('/api/admin/members/:memberId/passes/:passId/adjust', ...requirePermission(pool, jwtSecret, 'billing.manage'), async (req, res) => {
    const memberId = Number(req.params.memberId)
    const passId = Number(req.params.passId)
    const delta = Math.round(Number(req.body?.delta))
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ success: false, message: 'Non-zero integer delta is required.' })
    }
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const passRes = await client.query(
        `SELECT id, member_id, programs_id, classes_remaining FROM member_multi_class_pass WHERE id = $1 AND member_id = $2 FOR UPDATE`,
        [passId, memberId],
      )
      if (passRes.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ success: false, message: 'Pass not found for member.' })
      }
      const pass = passRes.rows[0]
      const newRemaining = Math.max(0, Number(pass.classes_remaining) + delta)
      const appliedDelta = newRemaining - Number(pass.classes_remaining)
      await client.query(
        `UPDATE member_multi_class_pass
         SET classes_remaining = $2,
             status = CASE WHEN $2 > 0 AND status = 'expired' THEN 'active' ELSE status END,
             updated_at = now()
         WHERE id = $1`,
        [passId, newRemaining],
      )
      await client.query(
        `INSERT INTO multi_class_pass_redemption
           (member_pass_id, signup_id, member_id, programs_id, classes_used, classes_remaining_after, entry_type, credit_delta, reason)
         VALUES ($1, NULL, $2, $3, $4, $5, 'adjust', $6, $7)`,
        [passId, memberId, pass.programs_id, Math.abs(appliedDelta), newRemaining, appliedDelta, req.body?.reason ?? 'Manual adjustment'],
      )
      await client.query('COMMIT')
      res.json({ success: true, data: { passId, classesRemaining: newRemaining, appliedDelta } })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('[billing] pass adjust failed:', err.message)
      res.status(500).json({ success: false, message: 'Failed to adjust pass.' })
    } finally {
      client.release()
    }
  })

  app.get('/api/admin/families/:familyId/statements', ...requirePermission(pool, jwtSecret, 'billing.view'), async (req, res) => {
    const account = await ensureBillingAccount(pool, Number(req.params.familyId))
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    const statements = await pool.query(
      `SELECT * FROM billing_statement WHERE family_billing_account_id = $1 ORDER BY statement_date DESC, id DESC`,
      [account.id],
    )
    const lines = await pool.query(
      `
        SELECT *
        FROM billing_statement_line
        WHERE statement_id = ANY($1::bigint[])
        ORDER BY id
      `,
      [statements.rows.map((s) => s.id)],
    )
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
  })

  app.post('/api/admin/families/:familyId/statements', ...requirePermission(pool, jwtSecret, 'billing.statements.manage'), async (req, res) => {
    const account = await ensureBillingAccount(pool, Number(req.params.familyId))
    if (!account) return res.status(404).json({ success: false, message: 'Family not found.' })
    const charges = await pool.query(
      `
        SELECT c.*
        FROM billing_charge c
        WHERE c.family_billing_account_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM billing_statement_line l WHERE l.charge_id = c.id
          )
        ORDER BY c.created_at, c.id
      `,
      [account.id],
    )
    const total = charges.rows.reduce((sum, c) => sum + Number(c.amount_cents ?? 0), 0)
    await pool.query('BEGIN')
    try {
      const statement = await pool.query(
        `
          INSERT INTO billing_statement (family_billing_account_id, statement_date, due_date, total_cents, status)
          VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3::date, $4, $5)
          RETURNING *
        `,
        [account.id, req.body?.statementDate ?? null, req.body?.dueDate ?? null, total, req.body?.status ?? 'issued'],
      )
      for (const charge of charges.rows) {
        await pool.query(
          `
            INSERT INTO billing_statement_line (statement_id, charge_id, member_id, description, amount_cents)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [statement.rows[0].id, charge.id, charge.member_id, charge.description, charge.amount_cents],
        )
      }
      await pool.query('COMMIT')
      res.json({ success: true, data: mapStatement(statement.rows[0], charges.rows) })
    } catch (error) {
      await pool.query('ROLLBACK')
      res.status(400).json({ success: false, message: error.message })
    }
  })

  app.patch('/api/admin/statements/:statementId/status', ...requirePermission(pool, jwtSecret, 'billing.statements.manage'), async (req, res) => {
    const statementId = Number(req.params.statementId)
    const status = String(req.body?.status || '').trim()
    if (!['draft', 'issued', 'paid', 'void'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid statement status.' })
    }
    const updated = await pool.query(
      `UPDATE billing_statement SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [statementId, status],
    )
    if (updated.rows.length === 0) return res.status(404).json({ success: false, message: 'Statement not found.' })
    res.json({ success: true, data: mapStatement(updated.rows[0]) })
  })

  app.get('/api/admin/waivers/templates', ...requirePermission(pool, jwtSecret, 'waivers.view'), async (_req, res) => {
    const templates = await pool.query(
      `SELECT * FROM waiver_template ORDER BY active_from DESC, id DESC`,
    )
    res.json({ success: true, data: templates.rows })
  })

  app.post('/api/admin/waivers/templates', ...requirePermission(pool, jwtSecret, 'waivers.manage'), async (req, res) => {
    const facility = await pool.query(`SELECT id FROM facility ORDER BY id LIMIT 1`)
    const facilityId = req.body?.facilityId ?? facility.rows[0]?.id
    if (!facilityId || !req.body?.name || !req.body?.version || !req.body?.body) {
      return res.status(400).json({ success: false, message: 'name, version, and body are required.' })
    }
    const waiverType = req.body?.waiverType ?? req.body?.waiver_type ?? null
    const isRequired = req.body?.isRequired !== false && req.body?.is_required !== false
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
      `UPDATE waiver_template SET active_to = COALESCE($2::timestamptz, now()), updated_at = now() WHERE id = $1 RETURNING *`,
      [Number(req.params.templateId), req.body?.activeTo ?? null],
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
      `SELECT id, first_name, last_name, email, family_id, parent_guardian_ids, facility_id
       FROM member WHERE id = $1 AND facility_id = $2`,
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
          m.id, m.first_name, m.last_name, m.email, m.family_id, m.parent_guardian_ids,
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
          AND wt.active_from <= now()
          AND (wt.active_to IS NULL OR wt.active_to > now())
        ORDER BY wt.name, wt.version
      `,
      [memberId],
    )
    res.json({ success: true, data: result.rows })
  })

  app.post('/api/admin/members/:memberId/waivers/acceptance', ...requirePermission(pool, jwtSecret, 'waivers.manage'), async (req, res) => {
    const memberId = Number(req.params.memberId)
    const waiverTemplateId = Number(req.body?.waiverTemplateId)
    if (!Number.isFinite(memberId) || !Number.isFinite(waiverTemplateId)) {
      return res.status(400).json({ success: false, message: 'memberId and waiverTemplateId are required.' })
    }
    const created = await pool.query(
      `
        INSERT INTO member_waiver_acceptance (
          member_id, waiver_template_id, accepted_by_member_id,
          signature_name, ip_address, user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6)
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
        req.body?.acceptedByMemberId ?? null,
        req.body?.signatureName ?? null,
        req.ip,
        req.get('user-agent') ?? null,
      ],
    )
    await updateMemberWaiverCompatibility(pool, memberId)
    res.json({ success: true, data: created.rows[0] })
  })

  app.get('/api/members/multi-class-passes', authMiddleware(pool, jwtSecret), async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = Number(ctx.user.member_id ?? ctx.user.id)
      const familyId = ctx.user.family_id
      const { loadMemberPassBalances } = await import('../programs/multiClassPass.js')
      const canSeeFamily = ctx.roles.includes('PARENT_GUARDIAN')

      let memberIds = [memberId]
      if (canSeeFamily && familyId) {
        const fam = await pool.query(
          `SELECT id FROM member WHERE family_id = $1 AND is_active = TRUE`,
          [familyId],
        )
        memberIds = fam.rows.map((r) => Number(r.id))
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

  app.get('/api/members/billing/account', authMiddleware(pool, jwtSecret), async (req, res) => {
    const ctx = req.platformAuth
    const memberId = Number(ctx.user.member_id ?? ctx.user.id)
    const familyId = ctx.user.family_id
    if (!familyId) {
      return res.json({
        success: true,
        data: { account: null, charges: [], payments: [], chargesCents: 0, paymentsCents: 0, balanceCents: 0, canSeeFamily: false },
      })
    }
    const account = await ensureBillingAccount(pool, familyId)
    if (!account) {
      return res.json({
        success: true,
        data: { account: null, charges: [], payments: [], chargesCents: 0, paymentsCents: 0, balanceCents: 0, canSeeFamily: false },
      })
    }
    const canSeeFamily =
      Number(account.payer_member_id) === memberId || ctx.roles.includes('PARENT_GUARDIAN')

    const view = await buildBillingAccountView(pool, account, {
      memberScopeId: canSeeFamily ? null : memberId,
    })

    res.json({
      success: true,
      data: {
        account: mapBillingAccount(account),
        charges: view.charges.map(mapCharge),
        payments: view.payments.map(mapPayment),
        subscriptions: view.subscriptions,
        monthlyTotals: view.monthlyTotals,
        refunds: view.refunds,
        ledger: view.ledger,
        bundlePasses: view.bundlePasses,
        bundleUsage: view.bundleUsage,
        chargesCents: view.chargesCents,
        paymentsCents: view.paymentsCents,
        refundsCents: view.refundsCents,
        balanceCents: view.balanceCents,
        canSeeFamily,
        stripeEnabled: process.env.STRIPE_ENABLED === 'true',
      },
    })
  })

  app.post('/api/members/billing/checkout-session', authMiddleware(pool, jwtSecret), async (req, res) => {
    if (!isStripeEnabled()) {
      return res.status(503).json({ success: false, message: 'Online payments are not enabled yet.', stripeEnabled: false })
    }
    const ctx = req.platformAuth
    const memberId = Number(ctx.user.member_id ?? ctx.user.id)
    const familyId = ctx.user.family_id
    if (!familyId) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const account = await ensureBillingAccount(pool, familyId)
    if (!account) return res.status(400).json({ success: false, message: 'No family billing account.' })
    const canPay = Number(account.payer_member_id) === memberId || ctx.roles.includes('PARENT_GUARDIAN')
    if (!canPay) return res.status(403).json({ success: false, message: 'Only the family payer can make a payment.' })

    const ledger = await pool.query(
      `
        SELECT
          COALESCE((SELECT SUM(amount_cents) FROM billing_charge WHERE family_billing_account_id = $1), 0)::int as charges_cents,
          COALESCE((SELECT SUM(amount_cents) FROM billing_payment WHERE family_billing_account_id = $1), 0)::int as payments_cents
      `,
      [account.id],
    )
    const balanceCents = Number(ledger.rows[0]?.charges_cents ?? 0) - Number(ledger.rows[0]?.payments_cents ?? 0)
    if (balanceCents <= 0) {
      return res.status(400).json({ success: false, message: 'No outstanding balance to pay.' })
    }
    try {
      const base = publicAppUrl()
      const session = await createCheckoutSession(pool, {
        account,
        balanceCents,
        successUrl: `${base}/?billing=paid`,
        cancelUrl: `${base}/?billing=cancelled`,
      })
      if (!session) return res.status(503).json({ success: false, message: 'Online payments are not available right now.' })
      res.json({ success: true, data: session })
    } catch (err) {
      console.error('[stripe] checkout-session:', err)
      res.status(500).json({ success: false, message: 'Failed to start checkout.' })
    }
  })

  app.post('/api/stripe/webhook', async (req, res) => {
    if (!isStripeEnabled()) return res.status(503).json({ success: false })
    try {
      const rawBody = req.rawBody ?? req.body
      const event = await parseWebhookEvent(rawBody, req.headers['stripe-signature'])
      if (!event) return res.status(400).json({ success: false })
      if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
        const obj = event.data?.object ?? {}
        const accountId = obj.metadata?.familyBillingAccountId
          ? Number(obj.metadata.familyBillingAccountId)
          : null
        const insertedPayment = await recordStripePayment(pool, {
          paymentIntentId: obj.payment_intent || obj.id,
          amountCents: obj.amount_total ?? obj.amount_received ?? obj.amount ?? 0,
          accountId,
          customerId: obj.customer ?? null,
        })
        if (insertedPayment && accountId) {
          const acct = await pool.query(`SELECT * FROM family_billing_account WHERE id = $1`, [accountId])
          if (acct.rows[0]) {
            notifyPaymentReceipt(pool, { account: acct.rows[0], payment: insertedPayment }).catch(() => {})
          }
        }
      } else if (event.type === 'payment_intent.payment_failed' || event.type === 'invoice.payment_failed') {
        const obj = event.data?.object ?? {}
        const accountId = obj.metadata?.familyBillingAccountId
          ? Number(obj.metadata.familyBillingAccountId)
          : null
        if (accountId) {
          const acct = await pool.query(`SELECT * FROM family_billing_account WHERE id = $1`, [accountId])
          if (acct.rows[0]) {
            const amountCents = obj.amount_due ?? obj.amount ?? obj.amount_total ?? 0
            const failureReason =
              obj.last_payment_error?.message ||
              obj.charges?.data?.[0]?.failure_message ||
              null
            notifyPaymentFailed(pool, {
              account: acct.rows[0],
              amountCents,
              reason: failureReason,
              updatePaymentUrl: `${publicAppUrl()}/?billing=update`,
            }).catch(() => {})
          }
        }
      }
      res.json({ received: true })
    } catch (err) {
      console.error('[stripe] webhook:', err)
      res.status(400).json({ success: false, message: err.message })
    }
  })

  app.get('/api/members/billing/statements', authMiddleware(pool, jwtSecret), async (req, res) => {
    const ctx = req.platformAuth
    const memberId = Number(ctx.user.member_id ?? ctx.user.id)
    const familyId = ctx.user.family_id
    if (!familyId) return res.json({ success: true, data: [] })
    const account = await ensureBillingAccount(pool, familyId)
    if (!account) return res.json({ success: true, data: [] })
    const canSeeFamily = Number(account.payer_member_id) === memberId || ctx.roles.includes('PARENT_GUARDIAN')
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

  app.get('/api/members/billing/payments', authMiddleware(pool, jwtSecret), async (req, res) => {
    const ctx = req.platformAuth
    const memberId = Number(ctx.user.member_id ?? ctx.user.id)
    const familyId = ctx.user.family_id
    if (!familyId) return res.json({ success: true, data: [] })
    const account = await ensureBillingAccount(pool, familyId)
    if (!account) return res.json({ success: true, data: [] })
    const canSeeFamily = Number(account.payer_member_id) === memberId || ctx.roles.includes('PARENT_GUARDIAN')
    if (!canSeeFamily) return res.json({ success: true, data: [] })
    const payments = await pool.query(
      `SELECT * FROM billing_payment WHERE family_billing_account_id = $1 ORDER BY paid_at DESC, id DESC`,
      [account.id],
    )
    res.json({ success: true, data: payments.rows.map(mapPayment) })
  })

  app.get('/api/members/waivers', authMiddleware(pool, jwtSecret), async (req, res) => {
    const memberId = Number(req.platformAuth.user.member_id ?? req.platformAuth.user.id)
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
          AND wt.active_from <= now()
          AND (wt.active_to IS NULL OR wt.active_to > now())
        ORDER BY
          CASE wt.waiver_type
            WHEN 'ASSUMPTION_OF_RISK' THEN 1
            WHEN 'RELEASE_OF_LIABILITY' THEN 2
            WHEN 'MEDICAL_EMERGENCY' THEN 3
            WHEN 'PAYMENT_POLICY' THEN 4
            ELSE 99
          END,
          wt.name,
          wt.version
      `,
      [memberId],
    )
    res.json({ success: true, data: result.rows })
  })

  app.post('/api/members/waivers/accept-all', authMiddleware(pool, jwtSecret), async (req, res) => {
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

    const hasPaymentPolicy = templatesRes.rows.some((row) => row.waiver_type === 'PAYMENT_POLICY')
    if (hasPaymentPolicy && !paymentPolicyAcknowledged) {
      return res.status(400).json({
        success: false,
        message: 'Payment policy and auto-draft authorization must be acknowledged.',
      })
    }

    const ipAddress = req.ip
    const userAgent = req.get('user-agent') ?? null

    await pool.query('BEGIN')
    try {
      const rows = []
      for (const memberId of authz.targetMemberIds) {
        for (const templateId of acceptedTemplateIds) {
          const isPaymentTemplate = templatesRes.rows.some(
            (row) => Number(row.id) === templateId && row.waiver_type === 'PAYMENT_POLICY',
          )
          const inserted = await pool.query(
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
        await updateMemberWaiverCompatibility(pool, memberId)
      }
      await pool.query('COMMIT')
      res.json({ success: true, data: { acceptances: rows, memberIds: authz.targetMemberIds } })
    } catch (error) {
      await pool.query('ROLLBACK')
      res.status(400).json({ success: false, message: error.message })
    }
  })

  app.post('/api/members/waivers/:templateId/accept', authMiddleware(pool, jwtSecret), async (req, res) => {
    const memberId = Number(req.platformAuth.user.member_id ?? req.platformAuth.user.id)
    const templateId = Number(req.params.templateId)
    const signatureName = req.body?.signatureName || req.platformAuth.user.full_name
    const created = await pool.query(
      `
        INSERT INTO member_waiver_acceptance (
          member_id, waiver_template_id, accepted_by_member_id,
          signature_name, ip_address, user_agent
        )
        VALUES ($1, $2, $1, $3, $4, $5)
        ON CONFLICT (member_id, waiver_template_id) DO UPDATE SET
          accepted_at = now(),
          signature_name = EXCLUDED.signature_name,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent
        RETURNING *
      `,
      [memberId, templateId, signatureName, req.ip, req.get('user-agent') ?? null],
    )
    await updateMemberWaiverCompatibility(pool, memberId)
    res.json({ success: true, data: created.rows[0] })
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
      classIterationId: a.class_iteration_id,
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
    if (req.isMasterAdmin !== true && req.platformAuth?.isMasterAdmin !== true) {
      return res.status(403).json({ success: false, message: 'Master admin access required' })
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
