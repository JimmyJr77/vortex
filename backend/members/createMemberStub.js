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
  const facilityId = await getDefaultFacilityId(db)
  if (!facilityId) return null

  const res = await db.query(
    `
    SELECT m.*,
      (m.password_hash IS NOT NULL AND m.password_hash <> '') AS has_password
    FROM member m
    WHERE LOWER(TRIM(m.email)) = LOWER(TRIM($1))
      AND m.facility_id = $2
      AND m.is_active = TRUE
    LIMIT 1
    `,
    [email, facilityId],
  )
  return res.rows[0] || null
}

export async function findMemberById(db, memberId) {
  const res = await db.query('SELECT * FROM member WHERE id = $1 AND is_active = TRUE', [memberId])
  return res.rows[0] || null
}

async function syncAppUser(client, member, passwordHash) {
  const fullName = `${member.first_name} ${member.last_name}`.trim()
  const facilityId = member.facility_id
  const role = 'PARENT_GUARDIAN'

  const existing = await client.query('SELECT id FROM app_user WHERE id = $1', [member.id])
  if (existing.rows.length > 0) {
    await client.query(
      `
      UPDATE app_user
      SET full_name = $1, email = $2, phone = $3, username = $4,
          password_hash = $5, role = $6, is_active = TRUE, facility_id = $7, updated_at = NOW()
      WHERE id = $8
      `,
      [
        fullName,
        member.email,
        member.phone,
        member.username,
        passwordHash,
        role,
        facilityId,
        member.id,
      ],
    )
  } else {
    await client.query(
      `
      INSERT INTO app_user (
        id, full_name, email, phone, username, password_hash,
        role, is_active, facility_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, NOW(), NOW())
      `,
      [
        member.id,
        fullName,
        member.email,
        member.phone,
        member.username,
        passwordHash,
        role,
        facilityId,
      ],
    )
  }
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
      username, password_hash, status, is_active, profile_complete, signup_source
    ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 'legacy', TRUE, FALSE, 'scheduling')
    RETURNING *
    `,
    [facilityId, firstName, lastName, email.trim(), phone, username, passwordHash],
  )
  const member = insert.rows[0]

  try {
    await syncAppUser(client, member, passwordHash)
  } catch (err) {
    console.error('[createMemberStub] app_user sync failed:', err.message)
  }

  return member.id
}

export async function updateMemberPassword(client, memberId, password) {
  const passwordHash = await bcrypt.hash(password, 10)
  const res = await client.query(
    `
    UPDATE member SET password_hash = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [passwordHash, memberId],
  )
  if (res.rows.length === 0) {
    throw new Error('Member not found')
  }
  const member = res.rows[0]
  if (member.email || member.username) {
    await syncAppUser(client, member, passwordHash)
  }
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
