import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import {
  initializeSignupBillingAccount,
  isAdultOnDate,
  recordSignupWaiverAcceptances,
  resolveSignupWaiverTargetMemberIds,
  validateSignupUsername,
  validateSignupWaiverTemplateIds,
} from '../familySignup.js'

test('date-only age checks use the supplied facility date without timezone drift', () => {
  assert.equal(isAdultOnDate('2008-09-02', '2026-09-01'), false)
  assert.equal(isAdultOnDate('2008-09-01', '2026-09-01'), true)
  assert.equal(isAdultOnDate('not-a-date', '2026-09-01'), false)
})

test('signup usernames cannot enter the email namespace', async () => {
  assert.equal(validateSignupUsername('  familylogin  '), 'familylogin')
  assert.throws(
    () => validateSignupUsername('parent@example.com'),
    /cannot contain @/,
  )

  const source = await fs.readFile(new URL('../familySignup.js', import.meta.url), 'utf8')
  const conflictStart = source.indexOf('const loginConflict = await client.query')
  const conflictEnd = source.indexOf("if (loginConflict.rows.length > 0)", conflictStart)
  const conflictQuery = source.slice(conflictStart, conflictEnd)
  assert.match(conflictQuery, /LOWER\(BTRIM\(email\)\) = LOWER\(BTRIM\(\$1\)\)/)
  assert.match(conflictQuery, /LOWER\(BTRIM\(username\)\) = LOWER\(BTRIM\(\$1\)\)/)
  assert.match(conflictQuery, /LOWER\(BTRIM\(email\)\) = LOWER\(BTRIM\(\$2\)\)/)
  assert.match(conflictQuery, /LOWER\(BTRIM\(username\)\) = LOWER\(BTRIM\(\$2\)\)/)
})

test('existing-family signup preserves billing while new or pending families are populated', async () => {
  let queries = 0
  const client = {
    async query() {
      queries += 1
      return { rows: [] }
    },
  }

  assert.equal(await initializeSignupBillingAccount(client, {
    enabled: false,
    familyId: 20,
    payerMemberId: 30,
    billingEmail: 'new-adult@example.com',
  }), false)
  assert.equal(queries, 0)

  let statement = ''
  let values = null
  const pendingClient = {
    async query(sql, params) {
      statement = sql
      values = params
      return { rows: [{ id: 99 }] }
    },
  }
  assert.equal(await initializeSignupBillingAccount(pendingClient, {
    enabled: true,
    populateExisting: true,
    familyId: 20,
    payerMemberId: 30,
    billingEmail: 'new-adult@example.com',
    billingPhone: '5555555555',
    billingStreet: '1 Main St',
    billingCity: 'Town',
    billingState: 'NY',
    billingZip: '10001',
  }), true)
  assert.match(statement, /ON CONFLICT \(family_id\) DO UPDATE SET/)
  assert.match(statement, /payer_member_id = EXCLUDED\.payer_member_id/)
  assert.match(statement, /billing_email = EXCLUDED\.billing_email/)
  assert.deepEqual(values, [
    20,
    30,
    'new-adult@example.com',
    '5555555555',
    '1 Main St',
    'Town',
    'NY',
    '10001',
  ])

  const source = await fs.readFile(new URL('../familySignup.js', import.meta.url), 'utf8')
  assert.match(source, /enabled: createdNewFamily \|\| initializePendingFamilyBilling === true/)
  assert.match(source, /populateExisting: createdNewFamily \|\| initializePendingFamilyBilling === true/)
  assert.match(source, /initializePendingFamilyBilling: true/)
})

test('signup waiver template selection is exact, active, and facility-scoped', async () => {
  let statement = ''
  const client = {
    async query(sql, params) {
      statement = sql
      assert.deepEqual(params, [7])
      return {
        rows: [
          { id: 101, waiver_type: 'ASSUMPTION_OF_RISK', is_required: true },
          { id: 102, waiver_type: 'MEDIA_RELEASE', is_required: false },
        ],
      }
    },
  }

  const selection = await validateSignupWaiverTemplateIds(client, {
    facilityId: 7,
    acceptedTemplateIds: ['101', 102],
  })
  assert.deepEqual(selection.acceptedTemplateIds, [101, 102])
  assert.deepEqual(selection.acceptedTemplates.map((row) => Number(row.id)), [101, 102])
  assert.match(statement, /WHERE facility_id = \$1/)
  assert.match(statement, /active_from <= now\(\)/)
  assert.match(statement, /active_to IS NULL OR active_to > now\(\)/)
})

test('signup waiver template validation rejects missing, foreign, retired, malformed, or duplicate IDs', async () => {
  let queryCount = 0
  const client = {
    async query() {
      queryCount += 1
      return {
        rows: [
          { id: 101, waiver_type: 'ASSUMPTION_OF_RISK', is_required: true },
          { id: 102, waiver_type: 'MEDIA_RELEASE', is_required: false },
        ],
      }
    },
  }

  await assert.rejects(
    validateSignupWaiverTemplateIds(client, {
      facilityId: 7,
      acceptedTemplateIds: [102],
    }),
    /All required waivers must be accepted/,
  )
  await assert.rejects(
    validateSignupWaiverTemplateIds(client, {
      facilityId: 7,
      acceptedTemplateIds: [101, 999],
    }),
    /invalid or unavailable/,
  )
  const beforeStrictInputChecks = queryCount
  await assert.rejects(
    validateSignupWaiverTemplateIds(client, {
      facilityId: 7,
      acceptedTemplateIds: [101, 101],
    }),
    /must be unique/,
  )
  await assert.rejects(
    validateSignupWaiverTemplateIds(client, {
      facilityId: 7,
      acceptedTemplateIds: [101, 'not-an-id'],
    }),
    /invalid or unavailable/,
  )
  assert.equal(queryCount, beforeStrictInputChecks)
})

test('signup waiver targets are limited to self and canonical minor dependents in the active household', async () => {
  let statement = ''
  const client = {
    async query(sql, params) {
      statement = sql
      assert.deepEqual(params, [10, 7, [10, 11, 12], '2026-09-01'])
      return { rows: [{ id: 10 }, { id: 11 }] }
    },
  }

  assert.deepEqual(
    await resolveSignupWaiverTargetMemberIds(client, {
      facilityId: 7,
      signerMemberId: 10,
      candidateMemberIds: [10, 11, 12],
      asOfDate: '2026-09-01',
    }),
    [10, 11],
  )
  assert.match(statement, /signer_membership\.is_active = TRUE/)
  assert.match(statement, /target_membership\.family_id = signer_membership\.family_id/)
  assert.match(statement, /target_membership\.is_active = TRUE/)
  assert.match(statement, /target\.facility_id = signer\.facility_id/)
  assert.match(statement, /signer\.date_of_birth <= \(\$4::date - INTERVAL '18 years'\)::date/)
  assert.match(statement, /target\.date_of_birth > \(\$4::date - INTERVAL '18 years'\)::date/)
  assert.match(statement, /parent_guardian_authority authority/)
  assert.match(statement, /authority\.has_legal_authority = TRUE/)
  assert.doesNotMatch(statement, /family_billing_account|parent_guardian_ids/)
})

test('signup waiver writes omit an unrelated adult and recheck template facility at insertion', async () => {
  const acceptanceMemberIds = []
  const client = {
    async query(sql, params) {
      if (sql.includes('SELECT id, waiver_type, is_required')) {
        return {
          rows: [{ id: 101, waiver_type: 'PAYMENT_POLICY', is_required: true }],
        }
      }
      if (sql.includes('SELECT DISTINCT target.id')) {
        return { rows: [{ id: 10 }, { id: 11 }] }
      }
      if (sql.includes('INSERT INTO member_waiver_acceptance')) {
        acceptanceMemberIds.push(Number(params[0]))
        assert.equal(params[1], 101)
        assert.equal(params[2], 10)
        assert.equal(params[7], true)
        assert.equal(params[8], 7)
        assert.match(sql, /template\.facility_id = \$9/)
        assert.match(sql, /RETURNING member_id, waiver_template_id/)
        return { rows: [{ member_id: params[0], waiver_template_id: params[1] }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  await recordSignupWaiverAcceptances(client, {
    candidateMemberIds: [10, 11, 12],
    acceptedTemplateIds: [101],
    facilityId: 7,
    signerMemberId: 10,
    signatureName: 'Primary Payer',
    comments: null,
    paymentPolicyAcknowledged: true,
    ipAddress: '127.0.0.1',
    userAgent: 'test',
    asOfDate: '2026-09-01',
  })

  assert.deepEqual(acceptanceMemberIds, [10, 11])
  assert.equal(acceptanceMemberIds.includes(12), false)
})

test('family signup writes canonical acceptance evidence without waiver cache fields', async () => {
  const source = await fs.readFile(
    new URL('../familySignup.js', import.meta.url),
    'utf8',
  )

  assert.match(source, /INSERT INTO member_waiver_acceptance/)
  assert.doesNotMatch(source, /syncMemberWaiverFlag/)
  assert.doesNotMatch(source, /has_completed_waivers|waiver_completion_date/)
})
