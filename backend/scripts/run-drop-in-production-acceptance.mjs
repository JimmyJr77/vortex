#!/usr/bin/env node
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: new URL('../.env.local', import.meta.url) })

if (process.env.RUN_PRODUCTION_ACCEPTANCE !== 'true') {
  console.error('Set RUN_PRODUCTION_ACCEPTANCE=true to run this controlled production acceptance test.')
  process.exit(1)
}

const apiUrl = String(process.env.INTEGRATION_BASE_URL || 'https://vortex-backend-qybl.onrender.com').replace(/\/$/, '')
const connectionString = process.env.DATABASE_URL || process.env.EXTERNAL_DB_URL || process.env.DB_URL
assert.ok(connectionString, 'Production database connection is required.')

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 2,
})

const runId = `qa-dropin-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
const created = {
  families: [],
  members: [],
  users: [],
  registrations: [],
  templates: [],
  fees: [],
}

async function api(path, { token, body } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload = await response.json()
  return { status: response.status, payload }
}

function expectStatus(result, expected, label) {
  assert.equal(
    result.status,
    expected,
    `${label}: ${JSON.stringify(result.payload)}`,
  )
}

async function createMember(client, facilityId, suffix) {
  const family = await client.query(
    `INSERT INTO family (facility_id, family_name)
     VALUES ($1, $2)
     RETURNING id`,
    [facilityId, `${runId}-${suffix}`],
  )
  const familyId = Number(family.rows[0].id)
  created.families.push(familyId)
  const email = `${runId}-${suffix}@example.invalid`
  const password = `${runId}-${suffix}-Password!`
  const passwordHash = await bcrypt.hash(password, 8)
  const user = await client.query(
    `INSERT INTO app_user
      (facility_id, role, email, full_name, password_hash, is_active, email_verified, email_verified_at)
     VALUES ($1, 'MEMBER_ATHLETE', $2, $3, $4, TRUE, TRUE, now())
     RETURNING id`,
    [facilityId, email, `QA${suffix} Acceptance`, passwordHash],
  )
  const userId = Number(user.rows[0].id)
  created.users.push(userId)
  const member = await client.query(
    `INSERT INTO member
      (facility_id, family_id, app_user_id, first_name, last_name, email, status, is_active, family_is_active, signup_source)
     VALUES ($1, $2, $3, $4, 'Acceptance', $5, 'athlete', TRUE, TRUE, 'production_qa')
     RETURNING id, first_name, last_name, email`,
    [facilityId, familyId, userId, `QA${suffix}`, email],
  )
  const row = member.rows[0]
  created.members.push(Number(row.id))
  await client.query(
    `INSERT INTO family_member (family_id, member_id, is_active)
     VALUES ($1, $2, TRUE)`,
    [familyId, row.id],
  )
  await client.query(
    `INSERT INTO family_billing_account (family_id, payer_member_id, billing_email)
     VALUES ($1, $2, $3)`,
    [familyId, row.id, row.email],
  )
  const login = await api('/api/members/login', {
    body: { emailOrUsername: email, password },
  })
  expectStatus(login, 200, `${suffix} member login`)
  return {
    ...row,
    id: Number(row.id),
    token: login.payload.token,
  }
}

function bookingBody(session, identity, extra = {}) {
  return {
    slotGroupId: session.slotGroupId,
    classDate: session.date,
    firstName: identity.first_name,
    lastName: identity.last_name,
    email: identity.email,
    phone: '555-0100',
    ...extra,
  }
}

async function main() {
  const client = await pool.connect()
  try {
    const catalogResponse = await api('/api/public/drop-ins')
    assert.equal(catalogResponse.status, 200)
    const catalog = catalogResponse.payload.data
    assert.ok(Array.isArray(catalog.classes) && catalog.classes.length > 0)
    assert.ok(Array.isArray(catalog.sessions) && catalog.sessions.length >= 7)
    assert.equal(
      catalog.classes.some((row) => row.programName === 'Vortex Gymnastics Team'),
      false,
      'Competitive team program must be excluded.',
    )

    const available = catalog.sessions
      .filter((row) => !row.isFull && row.spotsRemaining > 0)
      .sort((a, b) => a.spotsRemaining - b.spotsRemaining)
    assert.ok(available.length >= 7, 'At least seven open occurrences are required for acceptance testing.')
    const sessions = available.slice(0, 7)

    const facility = await client.query('SELECT id FROM facility ORDER BY id LIMIT 1')
    const facilityId = Number(facility.rows[0].id)

    const annual = await createMember(client, facilityId, 'Annual')
    const admin = await createMember(client, facilityId, 'Admin')
    const pass = await createMember(client, facilityId, 'Pass')
    const paid = await createMember(client, facilityId, 'Paid')

    const annualFee = await client.query(
      `INSERT INTO additional_fee
        (facility_id, name, amount_cents, scope_level, active)
       VALUES ($1, $2, 10000, 'global', TRUE)
       RETURNING id`,
      [facilityId, `${runId} Annual Membership`],
    )
    const annualFeeId = Number(annualFee.rows[0].id)
    created.fees.push(annualFeeId)
    await client.query(
      `INSERT INTO additional_fee_redemption (fee_id, member_id, period_key, amount_cents)
       VALUES ($1, $2, $3, 10000)`,
      [annualFeeId, annual.id, runId],
    )

    await client.query(
      `INSERT INTO member_drop_in_entitlement (member_id, admin_credits_granted)
       VALUES ($1, 1)
       ON CONFLICT (member_id) DO UPDATE
       SET admin_credits_granted = 1, updated_at = now()`,
      [admin.id],
    )

    const memberPassTemplate = await client.query(
      `INSERT INTO free_pass_template
        (facility_id, name, active, benefit_unit, application_method, scope_level, issuance, config)
       VALUES ($1, $2, TRUE, 'day', 'waive_enrollment', 'global', '{"admin_only":true}', '{"qa":true}')
       RETURNING id`,
      [facilityId, `${runId} Admin Pass`],
    )
    const memberPassTemplateId = Number(memberPassTemplate.rows[0].id)
    created.templates.push(memberPassTemplateId)
    await client.query(
      `INSERT INTO member_free_pass
        (member_id, pass_template_id, quantity_granted, quantity_remaining, issued_by, source_ref)
       VALUES ($1, $2, 1, 1, 'admin', $3)`,
      [pass.id, memberPassTemplateId, runId],
    )

    const promoCode = `QA${crypto.randomBytes(4).toString('hex').toUpperCase()}`
    const promoTemplate = await client.query(
      `INSERT INTO free_pass_template
        (facility_id, name, active, benefit_unit, application_method, scope_level, issuance, config)
       VALUES ($1, $2, TRUE, 'day', 'waive_enrollment', 'global', $3::jsonb, $4::jsonb)
       RETURNING id`,
      [
        facilityId,
        `${runId} Promo`,
        JSON.stringify({ promo_code: promoCode, admin_only: false }),
        JSON.stringify({ qa: true, max_redemptions_per_member: 1 }),
      ],
    )
    created.templates.push(Number(promoTemplate.rows[0].id))

    const anonymousTrial = {
      first_name: 'QANew',
      last_name: 'Acceptance',
      email: `${runId}-trial@example.invalid`,
    }
    const trialResult = await api('/api/public/drop-ins/register', {
      body: bookingBody(sessions[0], anonymousTrial, { useFreeTrial: true }),
    })
    expectStatus(trialResult, 201, 'new user trial')
    assert.equal(trialResult.payload.data.benefitType, 'free_trial')
    assert.equal(trialResult.payload.data.accountRequired, true)
    created.registrations.push(Number(trialResult.payload.data.id))

    const duplicateTrial = await api('/api/public/drop-ins/register', {
      body: bookingBody(sessions[1], anonymousTrial, { useFreeTrial: true }),
    })
    expectStatus(duplicateTrial, 409, 'duplicate lifetime trial')

    const anonymousPaid = {
      first_name: 'QANonmember',
      last_name: 'Acceptance',
      email: `${runId}-nonmember@example.invalid`,
    }
    const paidPending = await api('/api/public/drop-ins/register', {
      body: bookingBody(sessions[1], anonymousPaid, { useFreeTrial: false }),
    })
    expectStatus(paidPending, 201, 'nonmember pending price')
    assert.equal(paidPending.payload.data.benefitType, 'paid')
    assert.equal(paidPending.payload.data.accountRequired, true)
    assert.equal(paidPending.payload.data.totalCents, sessions[1].totalCents)
    created.registrations.push(Number(paidPending.payload.data.id))

    const annualResult = await api('/api/public/drop-ins/register', {
      token: annual.token,
      body: bookingBody(sessions[2], annual),
    })
    expectStatus(annualResult, 201, 'annual member credit')
    assert.equal(annualResult.payload.data.benefitType, 'annual_credit')
    assert.equal(annualResult.payload.data.totalCents, 0)
    created.registrations.push(Number(annualResult.payload.data.id))

    const adminResult = await api('/api/public/drop-ins/register', {
      token: admin.token,
      body: bookingBody(sessions[3], admin),
    })
    expectStatus(adminResult, 201, 'admin credit')
    assert.equal(adminResult.payload.data.benefitType, 'admin_credit')
    created.registrations.push(Number(adminResult.payload.data.id))

    const memberPassResult = await api('/api/public/drop-ins/register', {
      token: pass.token,
      body: bookingBody(sessions[4], pass),
    })
    expectStatus(memberPassResult, 201, 'member free pass')
    assert.equal(memberPassResult.payload.data.benefitType, 'free_pass')
    created.registrations.push(Number(memberPassResult.payload.data.id))

    const promoIdentity = {
      first_name: 'QAPromo',
      last_name: 'Acceptance',
      email: `${runId}-promo@example.invalid`,
    }
    const promoResult = await api('/api/public/drop-ins/register', {
      body: bookingBody(sessions[5], promoIdentity, { promoCode }),
    })
    expectStatus(promoResult, 201, 'promo code')
    assert.equal(promoResult.payload.data.benefitType, 'promo_code')
    created.registrations.push(Number(promoResult.payload.data.id))

    const paidMemberResult = await api('/api/public/drop-ins/register', {
      token: paid.token,
      body: bookingBody(sessions[6], paid),
    })
    expectStatus(paidMemberResult, 201, 'paid member')
    assert.equal(paidMemberResult.payload.data.benefitType, 'paid')
    created.registrations.push(Number(paidMemberResult.payload.data.id))
    const charge = await client.query(
      `SELECT amount_cents FROM billing_charge
       WHERE source_type = 'drop_in' AND source_id = $1`,
      [String(paidMemberResult.payload.data.id)],
    )
    assert.equal(Number(charge.rows[0]?.amount_cents), paidMemberResult.payload.data.totalCents)

    const fullSession = sessions[0]
    const baseline = await client.query(
      `SELECT
        sg.max_participants,
        (SELECT COUNT(*) FROM scheduling_signup s WHERE s.slot_group_id = sg.id AND s.status = 'confirmed')::int AS monthly,
        (SELECT COUNT(*) FROM drop_in_registration d
          WHERE d.slot_group_id = sg.id AND d.class_date = $2
            AND d.status IN ('account_required','payment_pending','confirmed','attended'))::int AS drop_ins
       FROM scheduling_slot_group sg WHERE sg.id = $1`,
      [fullSession.slotGroupId, fullSession.date],
    )
    const needed = Math.max(
      0,
      Number(baseline.rows[0].max_participants)
        - Number(baseline.rows[0].monthly)
        - Number(baseline.rows[0].drop_ins),
    )
    for (let index = 0; index < needed; index += 1) {
      const inserted = await client.query(
        `INSERT INTO drop_in_registration
          (form_id, slot_group_id, class_date, first_name, last_name, email,
           benefit_type, base_price_cents, discount_percent, amount_cents, status)
         VALUES ($1, $2, $3, 'QACapacity', 'Acceptance', $4, 'paid', 0, 0, 0, 'confirmed')
         RETURNING id`,
        [
          fullSession.formId,
          fullSession.slotGroupId,
          fullSession.date,
          `${runId}-capacity-${index}@example.invalid`,
        ],
      )
      created.registrations.push(Number(inserted.rows[0].id))
    }
    const fullAttempt = await api('/api/public/drop-ins/register', {
      body: bookingBody(fullSession, {
        first_name: 'QAFull',
        last_name: 'Acceptance',
        email: `${runId}-full@example.invalid`,
      }),
    })
    expectStatus(fullAttempt, 409, 'full class')
    assert.match(fullAttempt.payload.message, /full/i)

    const results = {
      runId,
      catalog: {
        classes: catalog.classes.length,
        sessions: catalog.sessions.length,
        competitiveTeamExcluded: true,
      },
      newUserTrial: 'pass',
      lifetimeTrialDuplicateRejected: 'pass',
      nonmemberPendingPrice: 'pass',
      annualCredit: 'pass',
      adminCredit: 'pass',
      memberFreePass: 'pass',
      promoCode: 'pass',
      paidMemberBillingLedger: 'pass',
      fullClassRejected: 'pass',
    }
    console.log(JSON.stringify(results, null, 2))
  } finally {
    try {
      if (created.registrations.length > 0) {
        await client.query(
          `DELETE FROM billing_charge
           WHERE source_type = 'drop_in' AND source_id = ANY($1::text[])`,
          [created.registrations.map(String)],
        )
        await client.query(
          `DELETE FROM free_pass_redemption
           WHERE context->>'dropInRegistrationId' = ANY($1::text[])`,
          [created.registrations.map(String)],
        )
        await client.query('DELETE FROM drop_in_registration WHERE id = ANY($1::bigint[])', [created.registrations])
      }
      if (created.members.length > 0) {
        await client.query('DELETE FROM additional_fee_redemption WHERE member_id = ANY($1::bigint[])', [created.members])
        await client.query('DELETE FROM family_billing_account WHERE family_id = ANY($1::bigint[])', [created.families])
        await client.query('DELETE FROM member WHERE id = ANY($1::bigint[])', [created.members])
      }
      if (created.families.length > 0) {
        await client.query('DELETE FROM family WHERE id = ANY($1::bigint[])', [created.families])
      }
      if (created.users.length > 0) {
        await client.query('DELETE FROM app_user WHERE id = ANY($1::bigint[])', [created.users])
      }
      if (created.templates.length > 0) {
        await client.query('DELETE FROM free_pass_template WHERE id = ANY($1::bigint[])', [created.templates])
      }
      if (created.fees.length > 0) {
        await client.query('DELETE FROM additional_fee WHERE id = ANY($1::bigint[])', [created.fees])
      }
    } finally {
      client.release()
      await pool.end()
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
