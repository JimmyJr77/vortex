import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import {
  activeWaiverTemplateIds,
  canSignWaiversForMembers,
} from '../registerRoutes.js'

function block(source, startText, endText) {
  const start = source.indexOf(startText)
  const end = source.indexOf(endText, start + startText.length)
  assert.notEqual(start, -1, `missing block start: ${startText}`)
  assert.notEqual(end, -1, `missing block end: ${endText}`)
  return source.slice(start, end)
}

function sequentialPool(rowSets) {
  const calls = []
  return {
    calls,
    pool: {
      async query(sql, params) {
        calls.push({ sql: String(sql), params })
        const rows = rowSets[calls.length - 1]
        assert.notEqual(rows, undefined, `unexpected query ${calls.length}: ${sql}`)
        return { rows }
      },
    },
  }
}

test('waiver signing permits only an adult self or canonical same-household minor guardian', async () => {
  const fixture = sequentialPool([
    [{ id: '10', facility_id: '7', is_adult: true }],
    [
      { id: '10', family_id: '90', is_minor: false, signer_is_guardian: false },
      { id: '20', family_id: '90', is_minor: true, signer_is_guardian: true },
    ],
    [{ family_id: '90' }],
  ])

  assert.deepEqual(
    await canSignWaiversForMembers(fixture.pool, 10, [10, 20, 20]),
    { ok: true, facilityId: '7', targetMemberIds: [10, 20] },
  )
  assert.deepEqual(fixture.calls[1].params, [[10, 20], '7', 10])
  assert.match(fixture.calls[0].sql, /facility\.timezone/)
  assert.match(fixture.calls[1].sql, /parent_guardian_authority authority/)
  assert.match(fixture.calls[1].sql, /authority\.has_legal_authority = TRUE/)
  assert.match(fixture.calls[1].sql, /m\.facility_id = \$2/)
  assert.match(fixture.calls[2].sql, /fm\.is_active = TRUE/)
})

test('missing DOB, another adult, and cross-facility targets grant no waiver authority', async () => {
  const missingDob = sequentialPool([
    [{ id: '10', facility_id: '7', is_adult: false }],
  ])
  const missingDobResult = await canSignWaiversForMembers(missingDob.pool, 10, [10])
  assert.equal(missingDobResult.ok, false)
  assert.match(missingDobResult.message, /verified adult/)
  assert.equal(missingDob.calls.length, 1)

  const adultTarget = sequentialPool([
    [{ id: '10', facility_id: '7', is_adult: true }],
    [{ id: '30', family_id: '90', is_minor: false, signer_is_guardian: true }],
    [{ family_id: '90' }],
  ])
  const adultTargetResult = await canSignWaiversForMembers(adultTarget.pool, 10, [30])
  assert.equal(adultTargetResult.ok, false)
  assert.match(adultTargetResult.message, /Another adult must sign their own waivers/)

  const crossFacility = sequentialPool([
    [{ id: '10', facility_id: '7', is_adult: true }],
    [],
  ])
  const crossFacilityResult = await canSignWaiversForMembers(crossFacility.pool, 10, [40])
  assert.equal(crossFacilityResult.ok, false)
  assert.match(crossFacilityResult.message, /not found/)
})

test('active required waiver lookup is facility scoped', async () => {
  const fixture = sequentialPool([[{ id: '4' }, { id: '9' }]])
  assert.deepEqual(await activeWaiverTemplateIds(fixture.pool, 7), [4, 9])
  assert.deepEqual(fixture.calls[0].params, [7, true])
  assert.match(fixture.calls[0].sql, /facility_id = \$1/)
  assert.match(fixture.calls[0].sql, /active_from <= now\(\)/)
  assert.match(fixture.calls[0].sql, /active_to IS NULL OR active_to > now\(\)/)
  assert.match(fixture.calls[0].sql, /is_required = TRUE/)
})

test('admin and member waiver routes enforce facility and active-template boundaries', async () => {
  const source = await fs.readFile(new URL('../registerRoutes.js', import.meta.url), 'utf8')
  const adminList = block(
    source,
    "app.get('/api/admin/waivers/templates'",
    "app.post('/api/admin/waivers/templates'",
  )
  const adminCreate = block(
    source,
    "app.post('/api/admin/waivers/templates'",
    "app.patch('/api/admin/waivers/templates/:templateId/retire'",
  )
  const adminRetire = block(
    source,
    "app.patch('/api/admin/waivers/templates/:templateId/retire'",
    "app.get('/api/admin/waivers/compliance'",
  )
  const adminAcceptance = block(
    source,
    "app.post('/api/admin/members/:memberId/waivers/acceptance'",
    "app.get('/api/members/multi-class-passes'",
  )
  const memberRead = block(
    source,
    "app.get('/api/members/waivers'",
    "app.post('/api/members/waivers/accept-all'",
  )
  const memberAcceptance = block(
    source,
    "app.post('/api/members/waivers/accept-all'",
    "app.post('/api/members/waivers/:templateId/accept'",
  )

  assert.match(adminList, /WHERE facility_id = \$1/)
  assert.match(adminList, /req\.platformAuth\.user\.facility_id/)
  assert.match(adminCreate, /const facilityId = req\.platformAuth\.user\.facility_id/)
  assert.doesNotMatch(adminCreate, /req\.body\?\.facilityId|SELECT id FROM facility/)
  assert.match(adminRetire, /AND facility_id = \$3/)
  assert.match(adminRetire, /req\.platformAuth\.user\.facility_id/)

  assert.match(adminAcceptance, /canSignWaiversForMembers\(pool, acceptedByMemberId, \[memberId\]\)/)
  assert.match(adminAcceptance, /template\.facility_id = target\.facility_id/)
  assert.match(adminAcceptance, /template\.active_from <= now\(\)/)
  assert.match(adminAcceptance, /template\.active_to IS NULL OR template\.active_to > now\(\)/)
  assert.match(adminAcceptance, /target\.facility_id = \$7/)

  assert.match(memberRead, /linkedPlatformMemberId\(req\.platformAuth\)/)
  assert.match(memberRead, /m\.facility_id = \$2/)
  assert.match(memberRead, /m\.is_active = TRUE/)
  assert.match(memberAcceptance, /canSignWaiversForMembers\(pool, signerMemberId, requestedMemberIds\)/)
  assert.match(memberAcceptance, /activeWaiverTemplateIds\(pool, authz\.facilityId, \{ requiredOnly: true \}\)/)
  assert.match(memberAcceptance, /facility_id = \$2/)
  assert.match(memberAcceptance, /active_from <= now\(\)/)
  assert.match(memberAcceptance, /active_to IS NULL OR active_to > now\(\)/)
})

test('unsafe single-waiver mutation is a pure 410 tombstone and UI uses accept-all', async () => {
  const source = await fs.readFile(new URL('../registerRoutes.js', import.meta.url), 'utf8')
  const retired = block(
    source,
    "app.post('/api/members/waivers/:templateId/accept'",
    "app.get('/api/coach/me'",
  )
  assert.match(retired, /status\(410\)/)
  assert.match(retired, /SINGLE_WAIVER_ACCEPTANCE_RETIRED/)
  assert.match(retired, /\/api\/members\/waivers\/accept-all/)
  assert.doesNotMatch(retired, /INSERT INTO member_waiver_acceptance|UPDATE member_waiver_acceptance/)

  const uiSource = await fs.readFile(
    new URL('../../../src/components/waiversMemberships/WaiversMembershipsPage.tsx', import.meta.url),
    'utf8',
  )
  assert.match(uiSource, /\/api\/members\/waivers\/accept-all/)
  assert.doesNotMatch(uiSource, /\/api\/members\/waivers\/\$\{[^}]+\}\/accept/)
  assert.match(uiSource, /familyMembers\.filter\(\(member\) => member\.canSignWaiver\)/)
  assert.doesNotMatch(uiSource, /One parent signature covers all family members/)

  const serverSource = await fs.readFile(new URL('../../server.js', import.meta.url), 'utf8')
  const familyRead = block(
    serverSource,
    "app.get('/api/members/family'",
    '// Add a family member from the member portal.',
  )
  assert.match(familyRead, /viewerCanSignWaivers/)
  assert.match(familyRead, /canSignWaiver: viewerCanSignWaivers/)
  assert.match(familyRead, /access\.managedMemberIds\.includes\(Number\(row\.id\)\)/)
  assert.match(familyRead, /familyContext\.facility_timezone/)
})

test('coach roster waiver status uses only active required templates in the member facility', async () => {
  const source = await fs.readFile(new URL('../coachRoster.js', import.meta.url), 'utf8')
  const roster = block(
    source,
    'export async function queryCoachRosterMembers',
    '/** Members for plan_assignment',
  )

  assert.match(roster, /wt\.facility_id = m\.facility_id/)
  assert.match(roster, /wt\.is_required = TRUE/g)
  assert.match(roster, /wt\.active_from <= now\(\)/g)
  assert.match(roster, /wt\.active_to IS NULL OR wt\.active_to > now\(\)/g)
  assert.match(roster, /mwa\.member_id = m\.id/)
  assert.match(roster, /COUNT\(DISTINCT mwa\.waiver_template_id\)/)
  assert.match(roster, /WHEN required_waivers\.required_count = 0 THEN 'not_required'/)
  assert.match(roster, /WHEN accepted_waivers\.accepted_count >= required_waivers\.required_count THEN 'current'/)
})
