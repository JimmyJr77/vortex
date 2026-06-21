/**
 * Create or refresh staging rehearsal admin + member accounts directly in Postgres.
 *
 * Usage (from repo root):
 *   DATABASE_URL='postgresql://...' \
 *   STAGING_BOOTSTRAP_CONFIRM=I_CONFIRM_STAGING_BOOTSTRAP \
 *   npm run bootstrap:staging-rehearsal
 */
import pg from 'pg'
import bcrypt from 'bcryptjs'

const { Pool } = pg

const REQUIRED_CONFIRMATION = 'I_CONFIRM_STAGING_BOOTSTRAP'
const BOOTSTRAP_FLAG = 'staging_rehearsal_bootstrap'

const ADMIN_EMAIL = String(process.env.STAGING_ADMIN_EMAIL || 'rehearsal.admin@staging.vortex.test').trim()
const ADMIN_USERNAME = String(process.env.STAGING_ADMIN_USERNAME || 'rehearsal_admin').trim()
const ADMIN_PASSWORD = String(process.env.STAGING_ADMIN_PASSWORD || 'StagingRehearsal25!')
const ADMIN_FULL_NAME = String(process.env.STAGING_ADMIN_FULL_NAME || 'Rehearsal Admin').trim()

const MEMBER_EMAIL = String(process.env.STAGING_MEMBER_EMAIL || 'rehearsal.guardian@staging.vortex.test').trim()
const MEMBER_USERNAME = String(process.env.STAGING_MEMBER_USERNAME || 'rehearsal_guardian').trim()
const MEMBER_PASSWORD = String(process.env.STAGING_MEMBER_PASSWORD || 'StagingRehearsal25!')
const GUARDIAN_FIRST = String(process.env.STAGING_GUARDIAN_FIRST_NAME || 'Jordan').trim()
const GUARDIAN_LAST = String(process.env.STAGING_GUARDIAN_LAST_NAME || 'Rehearsal').trim()
const ATHLETE_FIRST = String(process.env.STAGING_ATHLETE_FIRST_NAME || 'Alex').trim()
const ATHLETE_LAST = String(process.env.STAGING_ATHLETE_LAST_NAME || 'Rehearsal').trim()
const ATHLETE_DOB = String(process.env.STAGING_ATHLETE_DOB || '2015-06-01').trim()

function fail(message) {
  throw new Error(message)
}

function assertEnv() {
  if (!process.env.DATABASE_URL?.trim()) {
    fail('Missing DATABASE_URL (use the staging Postgres connection string from Render)')
  }
  if (process.env.STAGING_BOOTSTRAP_CONFIRM !== REQUIRED_CONFIRMATION) {
    fail(`Set STAGING_BOOTSTRAP_CONFIRM=${REQUIRED_CONFIRMATION} to write staging accounts`)
  }
  if (ADMIN_PASSWORD.length < 8) fail('Admin password must be at least 8 characters')
  if (MEMBER_PASSWORD.length < 8) fail('Member password must be at least 8 characters')
}

async function getDefaultFacilityId(client) {
  const check = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'facility'
    ) AS exists
  `)
  if (!check.rows[0]?.exists) {
    fail('facility table is missing. Run backend migrations first: npm run migrate:all')
  }

  let result = await client.query('SELECT id FROM facility ORDER BY id LIMIT 1')
  if (result.rows.length > 0) return Number(result.rows[0].id)

  result = await client.query(`
    INSERT INTO facility (name, timezone)
    VALUES ('Vortex Athletics', 'America/New_York')
    RETURNING id
  `)
  return Number(result.rows[0].id)
}

async function upsertAdmin(client, facilityId, passwordHash) {
  const existing = await client.query(
    `SELECT id FROM app_user WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2) LIMIT 1`,
    [ADMIN_EMAIL, ADMIN_USERNAME],
  )

  let userId
  if (existing.rows.length > 0) {
    userId = Number(existing.rows[0].id)
    await client.query(
      `
        UPDATE app_user
        SET full_name = $1,
            email = $2,
            username = $3,
            password_hash = $4,
            role = 'MASTER_ADMIN'::user_role,
            facility_id = $5,
            is_active = TRUE,
            updated_at = NOW()
        WHERE id = $6
      `,
      [ADMIN_FULL_NAME, ADMIN_EMAIL, ADMIN_USERNAME, passwordHash, facilityId, userId],
    )
  } else {
    const created = await client.query(
      `
        INSERT INTO app_user (facility_id, role, email, full_name, username, password_hash, is_active)
        VALUES ($1, 'MASTER_ADMIN'::user_role, $2, $3, $4, $5, TRUE)
        RETURNING id
      `,
      [facilityId, ADMIN_EMAIL, ADMIN_FULL_NAME, ADMIN_USERNAME, passwordHash],
    )
    userId = Number(created.rows[0].id)
  }

  await client.query(
    `INSERT INTO app_user_role (user_id, role) VALUES ($1, 'MASTER_ADMIN'::user_role) ON CONFLICT DO NOTHING`,
    [userId],
  )
  await client.query(
    `INSERT INTO app_user_role (user_id, role) VALUES ($1, 'OWNER_ADMIN'::user_role) ON CONFLICT DO NOTHING`,
    [userId],
  )
  await client.query(
    `
      INSERT INTO admin_profile (user_id, is_master_admin)
      VALUES ($1, TRUE)
      ON CONFLICT (user_id) DO UPDATE
      SET is_master_admin = TRUE, updated_at = NOW()
    `,
    [userId],
  )

  return userId
}

async function moveMemberToFamily(client, memberId, familyId) {
  await client.query(
    `
      UPDATE family_member
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE member_id = $1 AND family_id <> $2 AND is_active = TRUE
    `,
    [memberId, familyId],
  )
  await client.query(
    `
      INSERT INTO family_member (family_id, member_id, is_active)
      VALUES ($1, $2, TRUE)
      ON CONFLICT (family_id, member_id) DO UPDATE
      SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
    `,
    [familyId, memberId],
  )
  await client.query(
    `UPDATE member SET family_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [familyId, memberId],
  )
}

async function upsertRehearsalFamily(client, facilityId, passwordHash) {
  const existingGuardian = await client.query(
    `
      SELECT m.id, m.family_id
      FROM member m
      WHERE LOWER(m.email) = LOWER($1)
        AND m.facility_id = $2
      LIMIT 1
    `,
    [MEMBER_EMAIL, facilityId],
  )

  let familyId
  let guardianMemberId
  let athleteMemberId

  if (existingGuardian.rows.length > 0) {
    guardianMemberId = Number(existingGuardian.rows[0].id)
    familyId = existingGuardian.rows[0].family_id != null
      ? Number(existingGuardian.rows[0].family_id)
      : null

    await client.query(
      `
        UPDATE member
        SET first_name = $1,
            last_name = $2,
            username = $3,
            password_hash = $4,
            phone = COALESCE(phone, '555-0199'),
            is_active = TRUE,
            family_is_active = TRUE,
            internal_flags = $5,
            profile_complete = TRUE,
            updated_at = NOW()
        WHERE id = $6
      `,
      [GUARDIAN_FIRST, GUARDIAN_LAST, MEMBER_USERNAME, passwordHash, BOOTSTRAP_FLAG, guardianMemberId],
    )
  } else {
    const familyRes = await client.query(
      `
        INSERT INTO family (facility_id, family_name)
        VALUES ($1, $2)
        RETURNING id
      `,
      [facilityId, `${GUARDIAN_LAST} Rehearsal Family`],
    )
    familyId = Number(familyRes.rows[0].id)

    const guardianRes = await client.query(
      `
        INSERT INTO member (
          facility_id, family_id, first_name, last_name, email, phone, username, password_hash,
          status, is_active, family_is_active, internal_flags, profile_complete, signup_source
        ) VALUES ($1, $2, $3, $4, $5, '555-0199', $6, $7, 'legacy', TRUE, TRUE, $8, TRUE, 'staging_bootstrap')
        RETURNING id
      `,
      [facilityId, familyId, GUARDIAN_FIRST, GUARDIAN_LAST, MEMBER_EMAIL, MEMBER_USERNAME, passwordHash, BOOTSTRAP_FLAG],
    )
    guardianMemberId = Number(guardianRes.rows[0].id)
  }

  if (!familyId) {
    const familyRes = await client.query(
      `
        INSERT INTO family (facility_id, family_name)
        VALUES ($1, $2)
        RETURNING id
      `,
      [facilityId, `${GUARDIAN_LAST} Rehearsal Family`],
    )
    familyId = Number(familyRes.rows[0].id)
  }

  await moveMemberToFamily(client, guardianMemberId, familyId)

  const athleteExisting = await client.query(
    `
      SELECT m.id
      FROM member m
      JOIN family_member fm ON fm.member_id = m.id AND fm.family_id = $1 AND fm.is_active = TRUE
      WHERE m.first_name = $2 AND m.last_name = $3 AND m.facility_id = $4
      LIMIT 1
    `,
    [familyId, ATHLETE_FIRST, ATHLETE_LAST, facilityId],
  )

  if (athleteExisting.rows.length > 0) {
    athleteMemberId = Number(athleteExisting.rows[0].id)
    await client.query(
      `
        UPDATE member
        SET date_of_birth = $1,
            parent_guardian_ids = $2,
            is_active = TRUE,
            internal_flags = $3,
            updated_at = NOW()
        WHERE id = $4
      `,
      [ATHLETE_DOB, [guardianMemberId], BOOTSTRAP_FLAG, athleteMemberId],
    )
  } else {
    const athleteRes = await client.query(
      `
        INSERT INTO member (
          facility_id, family_id, first_name, last_name, date_of_birth, phone,
          parent_guardian_ids, status, is_active, family_is_active, internal_flags, profile_complete, signup_source
        ) VALUES ($1, $2, $3, $4, $5, '555-0199', $6, 'legacy', TRUE, TRUE, $7, TRUE, 'staging_bootstrap')
        RETURNING id
      `,
      [facilityId, familyId, ATHLETE_FIRST, ATHLETE_LAST, ATHLETE_DOB, [guardianMemberId], BOOTSTRAP_FLAG],
    )
    athleteMemberId = Number(athleteRes.rows[0].id)
  }

  await moveMemberToFamily(client, athleteMemberId, familyId)

  const guardianAppUserId = await syncGuardianAppUser(
    client,
    facilityId,
    guardianMemberId,
    passwordHash,
  )
  await client.query(
    `INSERT INTO app_user_role (user_id, role) VALUES ($1, 'PARENT_GUARDIAN'::user_role) ON CONFLICT DO NOTHING`,
    [guardianAppUserId],
  )

  await client.query(
    `
      INSERT INTO family_billing_account (
        family_id, payer_member_id, billing_email, billing_phone, is_active
      ) VALUES ($1, $2, $3, '555-0199', TRUE)
      ON CONFLICT (family_id) DO UPDATE
      SET payer_member_id = EXCLUDED.payer_member_id,
          billing_email = EXCLUDED.billing_email,
          billing_phone = EXCLUDED.billing_phone,
          is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP
    `,
    [familyId, guardianMemberId, MEMBER_EMAIL],
  )

  return { familyId, guardianMemberId, athleteMemberId, appUserId: guardianAppUserId }
}

async function syncGuardianAppUser(client, facilityId, guardianMemberId, passwordHash) {
  const fullName = `${GUARDIAN_FIRST} ${GUARDIAN_LAST}`
  const adminRoles = ['MASTER_ADMIN', 'OWNER_ADMIN', 'ADMIN']

  const byEmail = await client.query(
    `SELECT id, role::text AS role FROM app_user WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [MEMBER_EMAIL],
  )
  if (byEmail.rows.length > 0) {
    if (adminRoles.includes(byEmail.rows[0].role)) {
      fail(`Member email ${MEMBER_EMAIL} conflicts with an existing admin account`)
    }
    const appUserId = Number(byEmail.rows[0].id)
    await client.query(
      `
        UPDATE app_user
        SET full_name = $1,
            email = $2,
            username = $3,
            password_hash = $4,
            role = 'PARENT_GUARDIAN'::user_role,
            facility_id = $5,
            is_active = TRUE,
            updated_at = NOW()
        WHERE id = $6
      `,
      [fullName, MEMBER_EMAIL, MEMBER_USERNAME, passwordHash, facilityId, appUserId],
    )
    await client.query(
      `UPDATE member SET app_user_id = $1, updated_at = NOW() WHERE id = $2`,
      [appUserId, guardianMemberId],
    )
    return appUserId
  }

  const slot = await client.query(`SELECT id, role::text AS role FROM app_user WHERE id = $1`, [guardianMemberId])
  if (slot.rows.length === 0) {
    await client.query(
      `
        INSERT INTO app_user (
          id, full_name, email, phone, username, password_hash, role, is_active, facility_id, created_at, updated_at
        ) VALUES ($1, $2, $3, '555-0199', $4, $5, 'PARENT_GUARDIAN'::user_role, TRUE, $6, NOW(), NOW())
      `,
      [guardianMemberId, fullName, MEMBER_EMAIL, MEMBER_USERNAME, passwordHash, facilityId],
    )
    await client.query(
      `UPDATE member SET app_user_id = $1, updated_at = NOW() WHERE id = $1`,
      [guardianMemberId],
    )
    return guardianMemberId
  }

  if (adminRoles.includes(slot.rows[0].role)) {
    const created = await client.query(
      `
        INSERT INTO app_user (facility_id, role, email, phone, full_name, username, password_hash, is_active)
        VALUES ($1, 'PARENT_GUARDIAN'::user_role, $2, '555-0199', $3, $4, $5, TRUE)
        RETURNING id
      `,
      [facilityId, MEMBER_EMAIL, fullName, MEMBER_USERNAME, passwordHash],
    )
    const appUserId = Number(created.rows[0].id)
    await client.query(
      `UPDATE member SET app_user_id = $1, updated_at = NOW() WHERE id = $2`,
      [appUserId, guardianMemberId],
    )
    return appUserId
  }

  await client.query(
    `
      UPDATE app_user
      SET full_name = $1,
          email = $2,
          username = $3,
          password_hash = $4,
          role = 'PARENT_GUARDIAN'::user_role,
          facility_id = $5,
          is_active = TRUE,
          updated_at = NOW()
      WHERE id = $6
    `,
    [fullName, MEMBER_EMAIL, MEMBER_USERNAME, passwordHash, facilityId, guardianMemberId],
  )
  await client.query(
    `UPDATE member SET app_user_id = $1, updated_at = NOW() WHERE id = $1`,
    [guardianMemberId],
  )
  return guardianMemberId
}

async function ensureRehearsalProgram(client, facilityId) {
  const programRes = await client.query(
    `
      SELECT p.id
      FROM program p
      WHERE p.facility_id = $1
        AND COALESCE(p.archived, FALSE) = FALSE
        AND COALESCE(p.is_active, TRUE) = TRUE
      ORDER BY p.id
      LIMIT 1
    `,
    [facilityId],
  )

  let programId
  if (programRes.rows.length > 0) {
    programId = Number(programRes.rows[0].id)
  } else {
    const created = await client.query(
      `
        INSERT INTO program (
          facility_id, category, name, display_name, skill_level, age_min, age_max,
          description, skill_requirements, is_active, archived
        ) VALUES (
          $1, 'GYMNASTICS'::program_category, 'rehearsal_program', 'Rehearsal Program — Beginner',
          'BEGINNER'::skill_level, 5, 18, 'Staging rehearsal program', 'No Experience Required', TRUE, FALSE
        )
        RETURNING id
      `,
      [facilityId],
    )
    programId = Number(created.rows[0].id)
  }

  const iterationRes = await client.query(
    `SELECT id FROM class_iteration WHERE program_id = $1 ORDER BY iteration_number LIMIT 1`,
    [programId],
  )

  let iterationId
  if (iterationRes.rows.length > 0) {
    iterationId = Number(iterationRes.rows[0].id)
  } else {
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'class_iteration'
      ) AS exists
    `)
    if (!tableExists.rows[0]?.exists) {
      return { programId, iterationId: null, warning: 'class_iteration table missing; create an iteration in admin UI' }
    }

    const created = await client.query(
      `
        INSERT INTO class_iteration (
          program_id, iteration_number, days_of_week, start_time, end_time, duration_type
        ) VALUES ($1, 1, ARRAY[1,3,5], '18:00:00', '19:30:00', 'indefinite')
        RETURNING id
      `,
      [programId],
    )
    iterationId = Number(created.rows[0].id)
  }

  return { programId, iterationId, warning: null }
}

async function verifyLogins(baseUrl, adminLogin, adminPassword, memberLogin, memberPassword) {
  if (!baseUrl) return null

  const adminRes = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: adminLogin, password: adminPassword }),
  })
  const adminJson = await adminRes.json().catch(() => ({}))

  const memberRes = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/members/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername: memberLogin, password: memberPassword }),
  })
  const memberJson = await memberRes.json().catch(() => ({}))

  return {
    adminOk: adminRes.ok && adminJson.success !== false,
    memberOk: memberRes.ok && memberJson.success !== false,
    adminMessage: adminJson.message || `${adminRes.status}`,
    memberMessage: memberJson.message || `${memberRes.status}`,
  }
}

async function run() {
  assertEnv()

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const facilityId = await getDefaultFacilityId(client)
    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
    const memberHash = await bcrypt.hash(MEMBER_PASSWORD, 10)

    const family = await upsertRehearsalFamily(client, facilityId, memberHash)
    const adminUserId = await upsertAdmin(client, facilityId, adminHash)
    const program = await ensureRehearsalProgram(client, facilityId)

    await client.query('COMMIT')

    const baseUrl = process.env.BUSINESS_BASE_URL || process.env.STAGING_BASE_URL || ''
    const verification = await verifyLogins(baseUrl, ADMIN_EMAIL, ADMIN_PASSWORD, MEMBER_EMAIL, MEMBER_PASSWORD)

    const output = {
      success: true,
      facilityId,
      admin: {
        userId: adminUserId,
        login: ADMIN_EMAIL,
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
      },
      member: {
        appUserId: family.appUserId,
        guardianMemberId: family.guardianMemberId,
        athleteMemberId: family.athleteMemberId,
        familyId: family.familyId,
        login: MEMBER_EMAIL,
        username: MEMBER_USERNAME,
        password: MEMBER_PASSWORD,
      },
      rehearsal: {
        REHEARSAL_ADMIN_LOGIN: ADMIN_EMAIL,
        REHEARSAL_ADMIN_PASSWORD: ADMIN_PASSWORD,
        REHEARSAL_MEMBER_LOGIN: MEMBER_EMAIL,
        REHEARSAL_MEMBER_PASSWORD: MEMBER_PASSWORD,
        REHEARSAL_FAMILY_ID: String(family.familyId),
        REHEARSAL_MEMBER_ID: String(family.athleteMemberId),
        ...(program.programId ? { REHEARSAL_PROGRAM_ID: String(program.programId) } : {}),
        ...(program.iterationId ? { REHEARSAL_ITERATION_ID: String(program.iterationId) } : {}),
        BUSINESS_BASE_URL: baseUrl || 'https://ortex-backend-staging.onrender.com',
        BUSINESS_REHEARSAL_CONFIRM: 'I_UNDERSTAND_REHEARSAL_WRITES_DATA',
      },
      program,
      verification,
    }

    console.log(JSON.stringify(output, null, 2))

    if (program.warning) {
      console.warn(`\nWarning: ${program.warning}`)
    }
    if (verification && (!verification.adminOk || !verification.memberOk)) {
      console.warn('\nAPI verification against staging backend did not pass yet.')
      console.warn(`Admin: ${verification.adminOk ? 'OK' : verification.adminMessage}`)
      console.warn(`Member: ${verification.memberOk ? 'OK' : verification.memberMessage}`)
      console.warn('If DATABASE_URL points at staging DB, wait for Render to finish redeploying or confirm JWT/DB wiring.')
    }

    console.log('\nNext: copy the rehearsal env block above and run:')
    console.log('npm run rehearsal:signoff')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((error) => {
  console.error(`Bootstrap failed: ${error.message}`)
  process.exit(1)
})
