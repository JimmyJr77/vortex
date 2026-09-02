import bcrypt from 'bcryptjs'
import { isMemberProfileComplete } from './profileComplete.js'

export async function getDefaultFacilityId(db) {
  const check = await db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'facility'
    ) AS exists
  `)
  if (!check.rows[0]?.exists) return null

  let result = await db.query('SELECT id FROM facility LIMIT 1')
  if (result.rows.length > 0) return result.rows[0].id

  result = await db.query(`
    INSERT INTO facility (name, timezone)
    VALUES ('Vortex Athletics', 'America/New_York')
    RETURNING id
  `)
  return result.rows[0].id
}

export async function findMemberByEmail(db, email) {
  if (!email?.trim()) return null
  const normalized = String(email).trim().toLowerCase()
  const facilityId = await getDefaultFacilityId(db)

  const res = await db.query(
    `
    SELECT m.*,
      (au.password_hash IS NOT NULL AND au.password_hash <> '') AS has_password,
      au.password_hash AS app_user_password_hash
    FROM member m
    LEFT JOIN app_user au
      ON au.id = m.app_user_id
     AND au.facility_id = m.facility_id
     AND au.is_active = TRUE
    WHERE m.is_active = TRUE
      AND (
        LOWER(TRIM(m.email)) = $1
        OR LOWER(TRIM(au.email)) = $1
      )
      AND m.facility_id = $2
    ORDER BY
      CASE WHEN LOWER(TRIM(m.email)) = $1 THEN 0 ELSE 1 END,
      CASE WHEN m.app_user_id IS NOT NULL THEN 0 ELSE 1 END
    LIMIT 1
    `,
    [normalized, facilityId],
  )
  return res.rows[0] || null
}

export async function findMemberById(db, memberId) {
  const res = await db.query('SELECT * FROM member WHERE id = $1 AND is_active = TRUE', [memberId])
  return res.rows[0] || null
}

export async function findMemberForAppUser(db, userId) {
  const res = await db.query(
    `
    SELECT m.*,
      (au.password_hash IS NOT NULL AND au.password_hash <> '') AS has_password
    FROM member m
    JOIN app_user au
      ON au.id = m.app_user_id
     AND au.facility_id = m.facility_id
    WHERE m.is_active = TRUE
      AND m.app_user_id = $1
    LIMIT 1
    `,
    [userId],
  )
  return res.rows[0] || null
}

async function syncAppUser(client, member, passwordHash) {
  const fullName = `${member.first_name} ${member.last_name}`.trim()
  const facilityId = member.facility_id
  if (member.app_user_id) {
    const updated = await client.query(
      `
      UPDATE app_user
      SET full_name = $1, email = $2, phone = $3, username = $4,
          password_hash = $5, updated_at = NOW()
      WHERE id = $6
        AND facility_id = $7
      RETURNING id
      `,
      [
        fullName,
        member.email,
        member.phone,
        member.username,
        passwordHash,
        member.app_user_id,
        facilityId,
      ],
    )
    if (updated.rows.length === 0) {
      throw new Error('The linked Member Portal login is missing or belongs to another facility.')
    }
    return Number(updated.rows[0].id)
  }

  if (!member.email && !member.username) {
    throw new Error('Email or username is required to create a Member Portal login.')
  }
  const conflict = await client.query(
    `SELECT id
       FROM app_user
      WHERE (
          ($1::text IS NOT NULL AND LOWER(BTRIM(email)) = LOWER(BTRIM($1)))
          OR ($2::text IS NOT NULL AND LOWER(BTRIM(username)) = LOWER(BTRIM($2)))
        )
      LIMIT 1`,
    [member.email || null, member.username || null],
  )
  if (conflict.rows.length > 0) {
    throw new Error('A login with this email or username already exists. Link it explicitly instead of creating another identity.')
  }

  const created = await client.query(
    `INSERT INTO app_user (
       full_name, email, phone, username, password_hash,
       role, is_active, facility_id, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, 'MEMBER_ATHLETE'::user_role, TRUE, $6, NOW(), NOW())
     RETURNING id`,
    [fullName, member.email, member.phone, member.username, passwordHash, facilityId],
  )
  const userId = Number(created.rows[0].id)
  await client.query(
    `INSERT INTO app_user_role (user_id, role)
     VALUES ($1, 'MEMBER_ATHLETE'::user_role)
     ON CONFLICT DO NOTHING`,
    [userId],
  )
  await client.query(
    `UPDATE member
        SET app_user_id = $2,
            password_hash = NULL,
            updated_at = NOW()
      WHERE id = $1`,
    [member.id, userId],
  )
  member.app_user_id = userId
  member.password_hash = null
  return userId
}

function generateUsernameFromEmail(email) {
  const base = String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'
  return `${base}_${Date.now().toString(36).slice(-4)}`
}

/**
 * Create an orphan scheduling member stub with login credentials.
 */
export async function createMemberStub(
  client,
  { firstName, lastName, email, password, phone = null },
) {
  const facilityId = await getDefaultFacilityId(client)
  if (!facilityId) {
    throw new Error('Facility not configured')
  }

  const existing = await findMemberByEmail(client, email)
  if (existing) {
    throw new Error('An account with this email already exists. Please sign in.')
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const username = generateUsernameFromEmail(email)

  const insert = await client.query(
    `
    INSERT INTO member (
      facility_id, family_id, first_name, last_name, email, phone,
      username, password_hash, is_active, profile_complete, signup_source
    ) VALUES ($1, NULL, $2, $3, $4, $5, $6, NULL, TRUE, FALSE, 'scheduling')
    RETURNING *
    `,
    [facilityId, firstName, lastName, email.trim(), phone, username],
  )
  const member = insert.rows[0]

  await syncAppUser(client, member, passwordHash)

  return member.id
}

export async function updateMemberPassword(client, memberId, password, { mustChangePassword = false } = {}) {
  const passwordHash = await bcrypt.hash(password, 10)
  const res = await client.query(
    `
    SELECT *
    FROM member
    WHERE id = $1
      AND is_active = TRUE
    FOR UPDATE
    `,
    [memberId],
  )
  if (res.rows.length === 0) {
    throw new Error('Member not found')
  }
  const member = res.rows[0]
  await syncAppUser(client, member, passwordHash)
  await client.query(
    `UPDATE member
        SET password_hash = NULL,
            must_change_password = $2,
            updated_at = NOW()
      WHERE id = $1`,
    [memberId, Boolean(mustChangePassword)],
  )
  member.password_hash = null
  member.must_change_password = Boolean(mustChangePassword)
  return member
}

export async function refreshMemberProfileComplete(client, memberId) {
  const res = await client.query('SELECT * FROM member WHERE id = $1', [memberId])
  if (res.rows.length === 0) return
  const complete = isMemberProfileComplete(res.rows[0])
  await client.query(
    'UPDATE member SET profile_complete = $1, updated_at = NOW() WHERE id = $2',
    [complete, memberId],
  )
}

export async function countActiveSignupsForMember(db, formId, memberId) {
  const res = await db.query(
    `
    SELECT COUNT(*)::int AS cnt
    FROM scheduling_signup
    WHERE form_id = $1
      AND member_id = $2
      AND orphaned_at IS NULL
      AND status IN ('confirmed', 'waitlisted')
    `,
    [formId, memberId],
  )
  return Number(res.rows[0]?.cnt ?? 0)
}

/** Count active signups for pricing limits/discounts (per-form or whole program). */
export async function countActiveSignupsForPricingScope(db, formRow, memberId) {
  if (!memberId || !formRow) return 0

  const programsId = formRow.programs_id != null ? Number(formRow.programs_id) : null
  const overrides = Boolean(formRow.pricing_overrides_program)

  if (!overrides && programsId != null) {
    const res = await db.query(
      `
      SELECT COUNT(*)::int AS cnt
      FROM scheduling_signup s
      JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
      WHERE s.member_id = $1
        AND sf.programs_id = $2
        AND s.orphaned_at IS NULL
        AND s.status IN ('confirmed', 'waitlisted')
      `,
      [memberId, programsId],
    )
    return Number(res.rows[0]?.cnt ?? 0)
  }

  return countActiveSignupsForMember(db, Number(formRow.id), memberId)
}
