import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

function tokenFrom(req) {
  const authHeader = req.headers.authorization
  return authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
}

function normalizeRoleKey(role) {
  return String(role || '').trim().toUpperCase()
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
    roles.includes('MASTER_ADMIN') ||
    roles.includes('OWNER_ADMIN')

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

async function activeWaiverTemplateIds(pool, facilityId) {
  const res = await pool.query(
    `
      SELECT id
      FROM waiver_template
      WHERE facility_id = $1
        AND active_from <= now()
        AND (active_to IS NULL OR active_to > now())
      ORDER BY id
    `,
    [facilityId],
  )
  return res.rows.map((r) => Number(r.id))
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
        au.role::text IN ('OWNER_ADMIN', 'MASTER_ADMIN')
        OR aur.role::text IN ('OWNER_ADMIN', 'MASTER_ADMIN')
        OR COALESCE(ap.is_master_admin, false)
      )
  `)
  return Number(result.rows[0]?.count ?? 0)
}

async function ensureCoachOperationalTables(pool) {
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
    const roles = Array.isArray(req.body?.roles) ? req.body.roles.map(normalizeRoleKey).filter(Boolean) : ['MEMBER']
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
      if (roles.some((r) => ['MASTER_ADMIN', 'OWNER_ADMIN', 'ADMIN'].includes(r))) {
        await pool.query(
          `
            INSERT INTO admin_profile (user_id, is_master_admin)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET is_master_admin = EXCLUDED.is_master_admin, updated_at = now()
          `,
          [userId, roles.includes('MASTER_ADMIN') || roles.includes('OWNER_ADMIN')],
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
    const roles = Array.isArray(req.body?.roles) ? req.body.roles.map(normalizeRoleKey).filter(Boolean) : []
    const isMasterAdmin = req.body?.isMasterAdmin === true || roles.includes('MASTER_ADMIN')
    if (!Number.isFinite(userId) || roles.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one role is required.' })
    }

    const primaryRole = roles[0]
    const previousRoles = await loadUserRoles(pool, { id: userId, role: null })
    const wasMaster = previousRoles.some((role) => ['OWNER_ADMIN', 'MASTER_ADMIN'].includes(role))
    const willBeMaster = roles.some((role) => ['OWNER_ADMIN', 'MASTER_ADMIN'].includes(role))
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
      if (roles.some((r) => ['MASTER_ADMIN', 'OWNER_ADMIN', 'ADMIN'].includes(r))) {
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
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' })
    }
    const roles = await loadUserRoles(pool, { id: userId, role: null })
    if (!isActive && roles.some((role) => ['OWNER_ADMIN', 'MASTER_ADMIN'].includes(role)) && (await countMasterAdmins(pool)) <= 1) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate the last master admin.' })
    }
    await pool.query(`UPDATE app_user SET is_active = $2, updated_at = now() WHERE id = $1`, [userId, isActive])
    await pool.query(`UPDATE member SET is_active = $2, status = CASE WHEN $2 THEN status ELSE 'archived' END, updated_at = now() WHERE app_user_id = $1`, [userId, isActive])
    res.json({ success: true })
  })

  app.get('/api/admin/coaches', ...requirePermission(pool, jwtSecret, 'classes.manage'), async (req, res) => {
    const coaches = await pool.query(
      `
        SELECT
          au.id,
          au.full_name,
          au.email,
          au.phone,
          cp.bio,
          COALESCE(cp.is_active, true) as coach_active,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', cca.id,
                'programId', cca.program_id,
                'programName', p.display_name,
                'classIterationId', cca.class_iteration_id,
                'classIterationLabel', CASE WHEN ci.id IS NOT NULL THEN p.display_name || ' - Iteration ' || ci.iteration_number::text ELSE NULL END
              )
            ) FILTER (WHERE cca.id IS NOT NULL),
            '[]'
          ) as assignments
        FROM app_user au
        JOIN coach_profile cp ON cp.user_id = au.id
        LEFT JOIN coach_class_assignment cca ON cca.coach_user_id = au.id
        LEFT JOIN program p ON p.id = cca.program_id
        LEFT JOIN class_iteration ci ON ci.id = cca.class_iteration_id
        WHERE au.facility_id = $1
        GROUP BY au.id, cp.bio, cp.is_active
        ORDER BY au.full_name, au.email
      `,
      [req.platformAuth.user.facility_id],
    )
    res.json({ success: true, data: coaches.rows })
  })

  app.get('/api/admin/coaches/options', ...requirePermission(pool, jwtSecret, 'classes.manage'), async (req, res) => {
    const [users, programs, iterations] = await Promise.all([
      pool.query(
        `
          SELECT DISTINCT au.id, au.full_name, au.email
          FROM app_user au
          LEFT JOIN app_user_role aur ON aur.user_id = au.id
          WHERE au.facility_id = $1
            AND au.is_active = TRUE
            AND (au.role::text = 'COACH' OR aur.role::text = 'COACH')
          ORDER BY au.full_name, au.email
        `,
        [req.platformAuth.user.facility_id],
      ),
      pool.query(
        `SELECT id, display_name FROM program WHERE facility_id = $1 AND COALESCE(archived, false) = FALSE ORDER BY display_name`,
        [req.platformAuth.user.facility_id],
      ),
      pool.query(
        `
          SELECT ci.id, ci.program_id, p.display_name || ' - Iteration ' || ci.iteration_number::text as label
          FROM class_iteration ci
          JOIN program p ON p.id = ci.program_id
          WHERE p.facility_id = $1
          ORDER BY p.display_name, ci.iteration_number
        `,
        [req.platformAuth.user.facility_id],
      ),
    ])
    res.json({
      success: true,
      data: {
        users: users.rows,
        programs: programs.rows,
        iterations: iterations.rows,
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
    const programId = req.body?.programId == null ? null : Number(req.body.programId)
    const classIterationId = req.body?.classIterationId == null ? null : Number(req.body.classIterationId)
    if (!Number.isFinite(userId) || (!Number.isFinite(programId) && !Number.isFinite(classIterationId))) {
      return res.status(400).json({ success: false, message: 'Coach and program or class iteration are required.' })
    }
    await pool.query(`INSERT INTO coach_profile (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET is_active = TRUE, updated_at = now()`, [userId])
    await pool.query(`INSERT INTO app_user_role (user_id, role) VALUES ($1, 'COACH'::user_role) ON CONFLICT DO NOTHING`, [userId])
    const created = await pool.query(
      `
        INSERT INTO coach_class_assignment (coach_user_id, program_id, class_iteration_id)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        RETURNING *
      `,
      [userId, Number.isFinite(programId) ? programId : null, Number.isFinite(classIterationId) ? classIterationId : null],
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
    const ledger = await pool.query(
      `
        SELECT
          COALESCE((SELECT SUM(amount_cents) FROM billing_charge WHERE family_billing_account_id = $1), 0)::int as charges_cents,
          COALESCE((SELECT SUM(amount_cents) FROM billing_payment WHERE family_billing_account_id = $1), 0)::int as payments_cents
      `,
      [account.id],
    )
    const charges = Number(ledger.rows[0]?.charges_cents ?? 0)
    const payments = Number(ledger.rows[0]?.payments_cents ?? 0)
    res.json({ success: true, data: { ...mapBillingAccount(account), chargesCents: charges, paymentsCents: payments, balanceCents: charges - payments } })
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
    const charge = await pool.query(
      `
        INSERT INTO billing_charge (
          family_billing_account_id, member_id, source_type, source_id,
          description, amount_cents, service_period_start, service_period_end
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        account.id,
        req.body?.memberId ?? null,
        req.body?.sourceType ?? 'manual',
        req.body?.sourceId ?? null,
        req.body.description,
        Math.round(amountCents),
        req.body?.servicePeriodStart ?? null,
        req.body?.servicePeriodEnd ?? null,
      ],
    )
    res.json({ success: true, data: charge.rows[0] })
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
    res.json({ success: true, data: mapPayment(payment.rows[0]) })
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
    const created = await pool.query(
      `
        INSERT INTO waiver_template (facility_id, name, version, body, active_from, active_to, requires_resign)
        VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()), $6::timestamptz, COALESCE($7, false))
        RETURNING *
      `,
      [
        facilityId,
        req.body.name,
        req.body.version,
        req.body.body,
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
          mwa.signature_name
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
    const result = await pool.query(
      `
        SELECT
          cca.id,
          cca.program_id,
          cca.class_iteration_id,
          p.display_name as program_name,
          CASE
            WHEN ci.id IS NOT NULL THEN 'Iteration ' || ci.iteration_number::text
            ELSE NULL
          END as class_iteration_label
        FROM coach_class_assignment cca
        LEFT JOIN program p ON p.id = cca.program_id
        LEFT JOIN class_iteration ci ON ci.id = cca.class_iteration_id
        WHERE cca.coach_user_id = $1
        ORDER BY p.display_name, ci.iteration_number
      `,
      [req.platformAuth.user.id],
    )
    res.json({ success: true, data: result.rows })
  })

  app.get('/api/coach/classes/:id/roster', ...requirePermission(pool, jwtSecret, 'coach_portal.access'), async (req, res) => {
    await ensureCoachOperationalTables(pool)
    const assignment = await pool.query(
      `SELECT * FROM coach_class_assignment WHERE id = $1 AND coach_user_id = $2`,
      [Number(req.params.id), req.platformAuth.user.id],
    )
    if (assignment.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assigned class not found.' })
    }
    const a = assignment.rows[0]
    const roster = await pool.query(
      `
        SELECT
          m.id,
          m.first_name,
          m.last_name,
          m.email,
          m.phone,
          m.has_completed_waivers,
          required_waivers.required_count,
          accepted_waivers.accepted_count,
          crn.attendance_status,
          crn.note,
          mp.program_id,
          mp.iteration_id
        FROM member_program mp
        JOIN member m ON m.id = mp.member_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int as required_count
          FROM waiver_template wt
          WHERE wt.facility_id = m.facility_id
            AND wt.active_from <= now()
            AND (wt.active_to IS NULL OR wt.active_to > now())
        ) required_waivers ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT mwa.waiver_template_id)::int as accepted_count
          FROM member_waiver_acceptance mwa
          JOIN waiver_template wt ON wt.id = mwa.waiver_template_id
          WHERE mwa.member_id = m.id
            AND wt.active_from <= now()
            AND (wt.active_to IS NULL OR wt.active_to > now())
        ) accepted_waivers ON TRUE
        LEFT JOIN coach_roster_note crn
          ON crn.assignment_id = $3
         AND crn.member_id = m.id
         AND crn.coach_user_id = $4
         AND crn.note_date = CURRENT_DATE
        WHERE ($1::bigint IS NULL OR mp.program_id = $1)
          AND ($2::bigint IS NULL OR mp.iteration_id = $2)
          AND m.is_active = TRUE
        ORDER BY m.last_name, m.first_name
      `,
      [a.program_id, a.class_iteration_id, Number(req.params.id), req.platformAuth.user.id],
    )
    res.json({ success: true, data: roster.rows })
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

  console.log('✅ Platform access, billing, waiver, and coach routes registered')
}

export { authMiddleware, requirePermission, hasPermission }
