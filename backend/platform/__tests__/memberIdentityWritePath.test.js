import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

const serverSourceUrl = new URL('../../server.js', import.meta.url)

function block(source, startText, endText) {
  const start = source.indexOf(startText)
  const end = source.indexOf(endText, start + startText.length)
  assert.notEqual(start, -1, `missing block start: ${startText}`)
  assert.notEqual(end, -1, `missing block end: ${endText}`)
  return source.slice(start, end)
}

test('member identity is linked explicitly and portal suspension is independent', async () => {
  const source = await fs.readFile(serverSourceUrl, 'utf8')
  const memberLookup = block(source, 'const getMemberForAppUser', 'const ensureMemberForAppUser')
  const portalRead = block(
    source,
    "app.get('/api/admin/members/:id/portal-access'",
    "app.patch('/api/admin/members/:id/portal-access'",
  )
  const portalMutation = block(
    source,
    "app.patch('/api/admin/members/:id/portal-access'",
    '// Create member (admin endpoint)',
  )
  const profileMutation = block(
    source,
    "app.put('/api/members/me'",
    '// Get family members',
  )

  assert.match(memberLookup, /WHERE m\.app_user_id = \$1/)
  assert.doesNotMatch(memberLookup, /m\.id = \$1/)
  assert.doesNotMatch(memberLookup, /m\.email\s*=/)
  assert.match(portalMutation, /SET member_portal_access_active = \$3/)
  assert.doesNotMatch(portalMutation, /SET is_active = \$3/)
  assert.match(portalRead, /memberIsActive:/)
  assert.match(portalRead, /accountIsActive:/)
  assert.match(portalRead, /memberPortalAccessActive:/)
  assert.match(portalRead, /suspensionReasons/)
  assert.match(portalMutation, /MEMBER_RECORD_ARCHIVED/)
  assert.match(portalMutation, /LOGIN_ACCOUNT_INACTIVE/)
  assert.match(portalMutation, /LOGIN_SETUP_REQUIRED/)
  assert.match(portalMutation, /has_usable_login/)
  assert.match(profileMutation, /member\.app_user_id = account\.id/)
  assert.match(profileMutation, /member\.id = \$2/)
  assert.doesNotMatch(profileMutation, /LOWER\(TRIM\(m\.email\)\)/)
  assert.match(profileMutation, /await client\.query\('COMMIT'\)/)
})

test('member profile read uses canonical identity and household facts only', async () => {
  const source = await fs.readFile(serverSourceUrl, 'utf8')
  const profileRead = block(
    source,
    "app.get('/api/members/me'",
    '// Update current member profile',
  )

  assert.match(profileRead, /m\.app_user_id = \$1/)
  assert.match(profileRead, /LEFT JOIN family_member membership/)
  assert.match(profileRead, /membership\.is_active = TRUE/)
  assert.doesNotMatch(profileRead, /m\.family_id = \$1/)
  assert.doesNotMatch(profileRead, /m\.status/)
  assert.doesNotMatch(profileRead, /app_user_role/)
  assert.doesNotMatch(profileRead, /m\.internal_flags/)
  assert.doesNotMatch(profileRead, /internalFlags:/)
  assert.match(profileRead, /const canViewSensitiveProfile/)
  assert.match(profileRead, /delete familyMember\.medicalNotes/)
})

test('admin member detail does not expose retired status, role, or waiver-cache labels', async () => {
  const source = await fs.readFile(serverSourceUrl, 'utf8')
  const memberDetail = block(
    source,
    "app.get('/api/admin/members/:id'",
    "app.get('/api/admin/members/:id/portal-access'",
  )
  const response = memberDetail.slice(memberDetail.indexOf('// Format response'))

  assert.doesNotMatch(response, /status:\s*member\.status/)
  assert.doesNotMatch(response, /roles:/)
  assert.doesNotMatch(response, /hasCompletedWaivers:/)
  assert.doesNotMatch(response, /waiverCompletionDate:/)

  const familyDetail = block(
    source,
    "app.get('/api/admin/families/:id'",
    '// Update family',
  )
  assert.doesNotMatch(familyDetail, /m\.status/)
  assert.doesNotMatch(familyDetail, /has_completed_waivers/)
  assert.doesNotMatch(familyDetail, /parent_guardian_ids/)
})

test('legacy identity and waiver writes fail closed', async () => {
  const source = await fs.readFile(serverSourceUrl, 'utf8')

  assert.match(source, /app\.post\('\/api\/admin\/users'.*?LEGACY_IDENTITY_WRITE_RETIRED/s)
  assert.match(source, /app\.post\('\/api\/admin\/athletes'.*?LEGACY_MEMBER_WRITE_RETIRED/s)
  assert.match(source, /app\.put\('\/api\/admin\/athletes\/:id'.*?LEGACY_MEMBER_WRITE_RETIRED/s)
  assert.match(source, /app\.post\('\/api\/admin\/members\/fix-missing-app-users'.*?LEGACY_IDENTITY_REPAIR_RETIRED/s)
  assert.match(source, /app\.delete\('\/api\/admin\/families\/:id'.*?FAMILY_DELETION_RETIRED/s)
  assert.match(source, /app\.patch\('\/api\/admin\/members\/:id\/waivers'.*?WAIVER_EVIDENCE_REQUIRED/s)
  assert.match(source, /app\.post\('\/api\/admin\/members\/:memberId\/join-family'.*?LEGACY_FAMILY_PASSWORD_JOIN_RETIRED/s)
  assert.match(source, /app\.post\('\/api\/admin\/families\/verify'.*?LEGACY_FAMILY_PASSWORD_VERIFY_RETIRED/s)
  assert.match(source, /app\.post\('\/api\/admin\/families'.*?LEGACY_FAMILY_CREATE_RETIRED/s)
  assert.match(source, /app\.post\('\/api\/admin\/members'.*?LEGACY_MEMBER_CREATE_RETIRED/s)
  assert.doesNotMatch(source, /CREATE TABLE IF NOT EXISTS admins/)
  assert.doesNotMatch(source, /INSERT INTO admins/)
})

test('legacy admin access endpoints point to canonical replacements while self-read remains', async () => {
  const source = await fs.readFile(serverSourceUrl, 'utf8')
  const adminList = block(source, "app.get('/api/admin/admins'", '// Get current admin info')
  const adminSelfRead = block(source, "app.get('/api/admin/admins/me'", "app.post('/api/admin/admins'")
  const adminCreate = block(source, "app.post('/api/admin/admins'", '/** Ensures program_categories')
  const adminUpdate = block(source, "app.put('/api/admin/admins/:id'", '// Global error handler middleware')

  for (const retired of [adminList, adminCreate, adminUpdate]) {
    assert.match(retired, /status\(410\)/)
    assert.match(retired, /LEGACY_ADMIN_ACCESS_ENDPOINT_RETIRED/)
    assert.doesNotMatch(retired, /(?:INSERT INTO|UPDATE) app_user/)
  }
  assert.match(adminList, /replacement: \{ method: 'GET', path: '\/api\/admin\/access\/users' \}/)
  assert.match(adminCreate, /replacement: \{ method: 'POST', path: '\/api\/admin\/access\/users' \}/)
  assert.match(adminUpdate, /replacement: \{ method: 'PUT', path: '\/api\/admin\/access\/users\/:userId' \}/)

  assert.doesNotMatch(adminSelfRead, /status\(410\)/)
  assert.match(adminSelfRead, /WHERE au\.id = \$1\s+AND au\.facility_id = \$2/)
})

test('active admin and member identity routes are facility and household scoped', async () => {
  const source = await fs.readFile(serverSourceUrl, 'utf8')
  const memberList = block(source, "app.get('/api/admin/members'", '// Fix missing app_user records')
  const userList = block(source, "app.get('/api/admin/users'", "app.post('/api/admin/users'")
  const userRead = block(source, "app.get('/api/admin/users/:id'", "app.put('/api/admin/users/:id'")
  const memberUpdate = block(source, "app.put('/api/admin/members/:id'", '// Update member waiver status')
  const memberDelete = block(source, "app.delete('/api/admin/members/:id'", '// Create emergency contact')
  const familyMemberUpdate = block(source, "app.put('/api/members/family/:id'", '// Mark family member for removal')
  const familyMemberCreate = block(source, "app.post('/api/members/family'", '// Update family member')
  const removalRequest = block(source, "app.post('/api/members/family/:id/mark-for-removal'", '// Get family enrollments')
  const memberLogin = block(source, "app.post('/api/members/login'", "app.post('/api/members/request-password-reset'")
  const legacySearch = block(source, "app.get('/api/admin/search-users'", '// Get single member')
  const familyRemoval = block(source, "app.delete('/api/admin/families/:familyId/members/:memberId'", '// Delete member (admin endpoint)')

  assert.match(memberList, /const facilityId = req\.canonicalAccess\.facilityId/)
  assert.match(memberList, /AND m\.facility_id = \$\$\{paramCount\}/)
  assert.doesNotMatch(memberList, /SELECT id FROM facility LIMIT 1/)
  assert.match(userList, /WHERE u\.facility_id = \$1/)
  assert.match(userRead, /u\.id = \$1 AND u\.facility_id = \$2/)
  assert.match(memberUpdate, /AND facility_id = \$2/)
  assert.match(memberUpdate, /Unarchive the member record before enabling or changing Member Portal credentials/)
  assert.match(memberUpdate, /if \(updates\.length === 0 && !portalPasswordHash && !guardianRelationshipsChanged\)/)
  assert.match(memberUpdate, /if \(guardianRelationshipsChanged && !isChild\)/)
  assert.match(memberUpdate, /Parent\/guardian relationships can only be set for children/)
  assert.match(memberUpdate, /syncMemberPortalIdentity\(client, Number\(id\), \{[\s\S]*passwordHash: portalPasswordHash,[\s\S]*identityFieldsChanged/)
  assert.match(memberUpdate, /identityFieldsChanged/)
  assert.doesNotMatch(memberUpdate, /updates\.push\(`password_hash/)
  assert.doesNotMatch(memberUpdate, /updates\.push\(`parent_guardian_ids/)
  assert.match(memberDelete, /WHERE id = \$1\s+AND facility_id = \$2\s+FOR UPDATE/)
  assert.doesNotMatch(memberDelete, /memberOnly \|\| req\.isMasterAdmin/)
  assert.match(familyMemberUpdate, /membership\.family_id = \$(?:3|9)/)
  assert.match(familyMemberUpdate, /getHouseholdAccessForUser\(userId, client\)/)
  assert.match(familyMemberUpdate, /canEditHouseholdMember\(access, familyMemberId\)/)
  assert.match(familyMemberUpdate, /syncMemberPortalIdentity\(client, familyMemberId, \{[\s\S]*actorUserId: userId,[\s\S]*allowStaffSelfEdit: true/)
  assert.match(familyMemberCreate, /household\.access\.canAddFamilyMembers/)
  assert.match(familyMemberCreate, /if \(!youthMember && !household\.access\.isPayer\)/)
  assert.match(familyMemberCreate, /Only the household payer can add an adult family member\./)
  assert.match(familyMemberCreate, /req\.body\?\.hasLegalAuthority !== true/)
  assert.doesNotMatch(familyMemberCreate, /ensureUserFamilyContext/)
  assert.doesNotMatch(familyMemberCreate, /userIsAdult/)
  assert.match(removalRequest, /status\(410\)/)
  assert.match(removalRequest, /LEGACY_HOUSEHOLD_REMOVAL_REQUEST_RETIRED/)
  assert.match(memberLogin, /LIMIT 2/)
  assert.match(memberLogin, /result\.rows\.length !== 1/)
  assert.doesNotMatch(memberLogin, /SELECT id FROM facility LIMIT 1/)
  assert.match(legacySearch, /m\.facility_id = \$1/)
  assert.match(legacySearch, /m\.app_user_id AS user_id/)
  assert.doesNotMatch(legacySearch, /FULL OUTER JOIN member m ON m\.id = u\.id/)
  assert.match(familyRemoval, /const facilityId = req\.canonicalAccess\.facilityId/)
  assert.doesNotMatch(familyRemoval, /SELECT id FROM facility LIMIT 1/)
})

test('household profile edits preserve canonical linked-login identity transactionally', async () => {
  const source = await fs.readFile(serverSourceUrl, 'utf8')
  const familyMemberUpdate = block(
    source,
    "app.put('/api/members/family/:id'",
    '// Mark family member for removal',
  )
  const familyMemberRead = block(
    source,
    "app.get('/api/members/family'",
    '// Add a family member from the member portal.',
  )
  const identitySync = block(
    source,
    'const syncMemberPortalIdentity',
    'const getFamilyForMember',
  )

  assert.match(familyMemberUpdate, /const client = await pool\.connect\(\)/)
  assert.match(familyMemberUpdate, /await client\.query\('BEGIN'\)/)
  assert.match(familyMemberUpdate, /getHouseholdAccessForUser\(userId, client\)/)
  assert.match(familyMemberUpdate, /member_row\.app_user_id/)
  assert.match(familyMemberUpdate, /FOR UPDATE OF member_row/)
  assert.match(familyMemberUpdate, /FROM app_user[\s\S]*FOR UPDATE/)
  assert.match(familyMemberUpdate, /Number\(linkedAccount\.id\) !== Number\(userId\)/)
  assert.match(familyMemberUpdate, /LINKED_LOGIN_SELF_EDIT_REQUIRED/)
  assert.match(familyMemberUpdate, /WHERE id <> \$1[\s\S]*LOWER\(BTRIM\(email\)\)[\s\S]*LOWER\(BTRIM\(username\)\)/)
  assert.match(familyMemberUpdate, /\[linkedAccount\.id, nextEmail, nextUsername\]/)
  assert.match(familyMemberUpdate, /syncMemberPortalIdentity\(client, familyMemberId, \{[\s\S]*actorUserId: userId,[\s\S]*allowStaffSelfEdit: true/)
  assert.match(familyMemberUpdate, /refreshMemberProfileComplete\(client, familyMemberId\)/)
  assert.match(familyMemberUpdate, /await client\.query\('COMMIT'\)/)
  assert.match(familyMemberUpdate, /await client\.query\('ROLLBACK'\)/)
  assert.doesNotMatch(familyMemberUpdate, /await pool\.query/)
  assert.match(familyMemberRead, /row\.app_user_id == null \|\| Number\(row\.app_user_id\) === Number\(userId\)/)

  assert.match(identitySync, /UPDATE app_user/)
  assert.match(identitySync, /is_staff_identity/)
  assert.match(identitySync, /STAFF_IDENTITY_REQUIRES_STAFF_ACCESS/)
  assert.match(identitySync, /SET full_name = \$2,[\s\S]*email = \$3,[\s\S]*phone = \$4,[\s\S]*username = \$5,[\s\S]*address = \$7/)
  assert.match(identitySync, /WHERE id = \$1[\s\S]*AND facility_id = \$8/)
})

test('member archive changes lifecycle without rewriting portal or derived status', async () => {
  const source = await fs.readFile(
    new URL('../../members/memberArchive.js', import.meta.url),
    'utf8',
  )
  const mutation = source.slice(source.indexOf('export async function setMemberArchived'))

  assert.match(mutation, /SET is_active = \$1/)
  assert.doesNotMatch(mutation, /UPDATE app_user/)
  assert.doesNotMatch(mutation, /status\s*=/)
})
