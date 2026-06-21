import bcrypt from 'bcryptjs'
import { getDefaultFacilityId } from './createMemberStub.js'

export const DEV_TEST_FLAG = 'dev_test_seed'
export const DEV_TEST_PASSWORD = 'Vortex25!'

export function isDevEnvironment() {
  return process.env.NODE_ENV !== 'production'
}

function isAdult(dateOfBirth) {
  if (!dateOfBirth) return true
  const today = new Date()
  const birth = new Date(dateOfBirth)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1
  return age >= 18
}

async function syncAppUser(client, member, passwordHash, role) {
  const fullName = `${member.first_name} ${member.last_name}`.trim()
  const existing = await client.query('SELECT id FROM app_user WHERE id = $1', [member.id])
  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE app_user SET full_name=$1, email=$2, phone=$3, username=$4, password_hash=$5,
       role=$6, is_active=TRUE, facility_id=$7, updated_at=NOW() WHERE id=$8`,
      [
        fullName,
        member.email,
        member.phone,
        member.username,
        passwordHash,
        role,
        member.facility_id,
        member.id,
      ],
    )
  } else {
    await client.query(
      `INSERT INTO app_user (id, full_name, email, phone, username, password_hash, role, is_active, facility_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,NOW(),NOW())`,
      [
        member.id,
        fullName,
        member.email,
        member.phone,
        member.username,
        passwordHash,
        role,
        member.facility_id,
      ],
    )
  }
}

const SEED_FAMILIES = [
  {
    familyName: '[DEV] Martinez Family',
    familyUsername: 'devseed_martinez',
    members: [
      { firstName: 'Maria', lastName: 'Martinez', dateOfBirth: '1984-03-15', email: 'maria.martinez@test.vortex.dev', username: 'dev_maria_martinez' },
      { firstName: 'Carlos', lastName: 'Martinez', dateOfBirth: '1982-07-22', email: 'carlos.martinez@test.vortex.dev', username: 'dev_carlos_martinez' },
      { firstName: 'Sofia', lastName: 'Martinez', dateOfBirth: '2014-05-10' },
      { firstName: 'Lucas', lastName: 'Martinez', dateOfBirth: '2017-09-03' },
      { firstName: 'Emma', lastName: 'Martinez', dateOfBirth: '2019-11-28' },
    ],
  },
  {
    familyName: '[DEV] Chen Family',
    familyUsername: 'devseed_chen',
    members: [
      { firstName: 'Wei', lastName: 'Chen', dateOfBirth: '1988-01-20', email: 'wei.chen@test.vortex.dev', username: 'dev_wei_chen' },
      { firstName: 'Alex', lastName: 'Chen', dateOfBirth: '2012-08-14' },
      { firstName: 'Maya', lastName: 'Chen', dateOfBirth: '2015-04-07' },
    ],
  },
  {
    familyName: '[DEV] Williams Family',
    familyUsername: 'devseed_williams',
    members: [
      { firstName: 'Diane', lastName: 'Williams', dateOfBirth: '1981-12-05', email: 'diane.williams@test.vortex.dev', username: 'dev_diane_williams' },
      { firstName: 'Jordan', lastName: 'Williams', dateOfBirth: '2010-02-18' },
    ],
  },
  {
    familyName: '[DEV] Patel Family',
    familyUsername: 'devseed_patel',
    members: [
      { firstName: 'Raj', lastName: 'Patel', dateOfBirth: '1986-04-25', email: 'raj.patel@test.vortex.dev', username: 'dev_raj_patel' },
      { firstName: 'Priya', lastName: 'Patel', dateOfBirth: '2013-07-19' },
      { firstName: 'Arjun', lastName: 'Patel', dateOfBirth: '2016-01-08' },
    ],
  },
]

const SEED_SOLO_MEMBERS = [
  { firstName: 'Taylor', lastName: 'Johnson', dateOfBirth: '1998-06-30', email: 'taylor.johnson@test.vortex.dev', username: 'dev_taylor_johnson' },
  { firstName: 'Marcus', lastName: 'Reed', dateOfBirth: '2004-10-12', email: 'marcus.reed@test.vortex.dev', username: 'dev_marcus_reed' },
]

async function insertMember(client, facilityId, familyId, spec, passwordHash, parentGuardianIds = []) {
  const adult = isAdult(spec.dateOfBirth)
  const email = adult ? spec.email ?? null : null
  const username = adult ? spec.username ?? null : null
  const memberPasswordHash = adult && (email || username) ? passwordHash : null
  const role = 'MEMBER_ATHLETE'

  const insert = await client.query(
    `INSERT INTO member (
      facility_id, family_id, first_name, last_name, email, phone, date_of_birth,
      username, password_hash, parent_guardian_ids, status, is_active, family_is_active,
      internal_flags, profile_complete, signup_source
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'legacy',TRUE,$11,$12,TRUE,'dev_seed')
    RETURNING *`,
    [
      facilityId,
      familyId,
      spec.firstName,
      spec.lastName,
      email,
      spec.phone ?? '555-0100',
      spec.dateOfBirth,
      username,
      memberPasswordHash,
      parentGuardianIds.length > 0 ? parentGuardianIds : null,
      familyId != null,
      DEV_TEST_FLAG,
    ],
  )
  const member = insert.rows[0]

  if (memberPasswordHash) {
    try {
      await syncAppUser(client, member, memberPasswordHash, role)
    } catch (err) {
      console.warn('[seedDevTestMembers] app_user sync failed:', err.message)
    }
  }

  return member
}

export async function clearDevTestMembers(pool) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const idsRes = await client.query(
      `SELECT id FROM member WHERE internal_flags = $1`,
      [DEV_TEST_FLAG],
    )
    const memberIds = idsRes.rows.map((r) => Number(r.id))
    if (memberIds.length > 0) {
      await client.query('DELETE FROM app_user WHERE id = ANY($1::bigint[])', [memberIds])
      await client.query('DELETE FROM member WHERE id = ANY($1::bigint[])', [memberIds])
    }
    await client.query(`DELETE FROM family WHERE family_username LIKE 'devseed_%'`)
    await client.query('COMMIT')
    return { removed: memberIds.length }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function seedDevTestMembers(pool, { replace = true } = {}) {
  if (!isDevEnvironment()) {
    throw new Error('Dev test members are only available in non-production environments')
  }

  const facilityId = await getDefaultFacilityId(pool)
  if (!facilityId) throw new Error('Facility not configured')

  if (replace) {
    await clearDevTestMembers(pool)
  } else {
    const existing = await pool.query(
      `SELECT COUNT(*)::int AS c FROM member WHERE internal_flags = $1`,
      [DEV_TEST_FLAG],
    )
    if (Number(existing.rows[0]?.c ?? 0) > 0) {
      return { created: 0, skipped: true, message: 'Dev test members already exist' }
    }
  }

  const passwordHash = await bcrypt.hash(DEV_TEST_PASSWORD, 10)
  const familyPasswordHash = await bcrypt.hash(DEV_TEST_PASSWORD, 10)
  const created = []

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const familySpec of SEED_FAMILIES) {
      const familyRes = await client.query(
        `INSERT INTO family (facility_id, family_name, family_username, family_password_hash)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [facilityId, familySpec.familyName, familySpec.familyUsername, familyPasswordHash],
      )
      const familyId = Number(familyRes.rows[0].id)
      const parentIds = []

      for (const spec of familySpec.members) {
        const adult = isAdult(spec.dateOfBirth)
        const parentGuardianIds = adult ? [] : [...parentIds]
        const member = await insertMember(
          client,
          facilityId,
          familyId,
          spec,
          passwordHash,
          parentGuardianIds,
        )
        created.push(member)
        if (adult) parentIds.push(Number(member.id))
      }
    }

    for (const spec of SEED_SOLO_MEMBERS) {
      const member = await insertMember(client, facilityId, null, spec, passwordHash)
      created.push(member)
    }

    await client.query('COMMIT')
    return {
      created: created.length,
      password: DEV_TEST_PASSWORD,
      members: created.map((m) => ({
        id: Number(m.id),
        firstName: m.first_name,
        lastName: m.last_name,
        email: m.email,
        familyId: m.family_id != null ? Number(m.family_id) : null,
      })),
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
