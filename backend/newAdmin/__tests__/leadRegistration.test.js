import assert from 'node:assert/strict'
import test from 'node:test'
import { invitationSummary, matchReservedInvitationEnrollments, bookLeadInvitationTrial } from '../leadRegistration.js'
import { sendLeadRegistrationEmail } from '../../email/leadRegistrationEmail.js'
import { registerNewAdminRoutes } from '../registerRoutes.js'

test('invitation editing exposes saved details and revision without temporary credentials', () => {
  const guardian = { firstName: 'Test', email: 'test@example.test' }
  const summary = invitationSummary({ id: 1, expires_at: '2099-01-01', delivery_status: 'sent',
    token_hash: 'secret', token_ciphertext: 'secret', temporary_password_hash: 'secret',
    pending_payload: { guardian, children: [], selections: [], instructions: 'Review your classes', passwordCiphertext: 'secret', revision: 2 },
  })
  assert.equal(summary.revision, 2)
  assert.equal(summary.instructions, 'Review your classes')
  assert.equal(summary.purpose, 'registration')
  assert.deepEqual(summary.guardian, guardian)
  assert.ok(!JSON.stringify(summary).includes('secret'))
})

test('trial invitations describe waiver-first free booking without paid enrollment instructions', async () => {
  const invite = { id: 7, facility_id: 1, invitee_email: 'trial@example.test', suggested_username: 'trialparent',
    expires_at: '2099-01-01', delivery_status: 'sent',
    pending_payload: { purpose: 'trial', guardian: { firstName: 'Trial' }, children: [], selections: [] } }
  assert.equal(invitationSummary(invite).purpose, 'trial')
  let mail
  await sendLeadRegistrationEmail({ invite, token: 'test-token', password: 'test-password', send: async value => { mail = value; return { sent: true } } })
  assert.match(mail.subject, /free trial/)
  assert.match(mail.text, /sign the required waivers first/)
  assert.match(mail.html, /Start free trial registration/)
  assert.doesNotMatch(mail.text + mail.html, /Coach suggested enrollment|pay to confirm enrollment/)
})

test('trial date booking requires an authenticated invitation session before touching data', async () => {
  await assert.rejects(() => bookLeadInvitationTrial({ connect: () => assert.fail('Unauthenticated trial must not access data') }, 1,
    { token: 'link-only', freeTrial: { program: 'fit-flip', slotGroupId: 1, classDate: '2099-01-01', memberIndex: 1 } }), /sign in/)
})

test('editing invitation route requires member edit access before loading or writing data', async () => {
  let authorize
  const app = { use() {}, get() {}, post() {}, delete() {}, put() {}, patch(path, ...chain) {
    if (path === '/api/admin/new-admin/lead-registration/:id') authorize = chain[0]
  } }
  registerNewAdminRoutes(app, { query: () => assert.fail('Unauthorized edits must not query data') }, { jwtSecret: 'test-only' })
  assert.equal(typeof authorize, 'function')
  const req = { canonicalAccess: { portalAccess: { admin: true }, facilityId: 1 }, newAdminPermissions: new Map([['members.edit', Promise.resolve(false)]]) }
  const res = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body } }
  await authorize(req, res, () => assert.fail('Unauthorized edits must not reach handler'))
  assert.equal(res.statusCode, 403)
  assert.match(res.body.message, /members.edit/)
})

test('creating a Trial invitation requires member edit access', async () => {
  let authorize
  const app = { use() {}, get() {}, delete() {}, put() {}, patch() {}, post(path, ...chain) {
    if (path === '/api/admin/new-admin/leads/:id/trial') authorize = chain[0]
  } }
  registerNewAdminRoutes(app, { query: () => assert.fail('Unauthorized trial must not query data') }, { jwtSecret: 'test-only' })
  assert.equal(typeof authorize, 'function')
  const req = { canonicalAccess: { portalAccess: { admin: true }, facilityId: 1 }, newAdminPermissions: new Map([['members.edit', Promise.resolve(false)]]) }
  const res = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body } }
  await authorize(req, res, () => assert.fail('Unauthorized trial must not reach handler'))
  assert.equal(res.statusCode, 403)
})

const classTime = { classEventId: 2, schedulingFormId: 3, slotGroupId: 4, timeSlotId: 5 }
const reservation = (holdSignupId, childIndex) => ({ ...classTime, kind: 'reserved', holdSignupId, childIndex })
const enrollment = memberIndex => ({ ...classTime, memberIndex })

test('a reserved class follows a newly assigned family member without losing its hold', () => {
  const selections = [reservation(10, 0)]
  const enrollments = [enrollment(2)]
  const matches = matchReservedInvitationEnrollments(selections, enrollments)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].selection.holdSignupId, 10)
  assert.equal(matches[0].enrollment.memberIndex, 2)
  assert.deepEqual(selections, [reservation(10, 0)])
  assert.deepEqual(enrollments, [enrollment(2)])
})

test('unchanged athletes retain their holds before another hold is reassigned', () => {
  const matches = matchReservedInvitationEnrollments(
    [reservation(10, 0), reservation(11, 1), reservation(12, null)],
    [enrollment(2), enrollment(0), enrollment(3)],
  )
  assert.deepEqual(matches.map(({ selection, enrollment }) => [selection.holdSignupId, enrollment.memberIndex]),
    [[10, 0], [11, 2], [12, 3]])
})

test('removing classes releases excess holds and changing times does not transfer a different hold', () => {
  const matches = matchReservedInvitationEnrollments(
    [reservation(10, 0), reservation(11, 1), { ...reservation(12, 2), timeSlotId: 8 }],
    [enrollment(2), { ...enrollment(3), slotGroupId: 20, timeSlotId: 21 }],
  )
  assert.deepEqual(matches.map(({ selection, enrollment }) => [selection.holdSignupId, enrollment?.memberIndex ?? null]),
    [[10, null], [11, 2], [12, null]])
})

test('additional class choices do not reuse a hold or create holds for nonreserved suggestions', () => {
  const matches = matchReservedInvitationEnrollments(
    [reservation(10, 0), { ...classTime, kind: 'class', childIndex: 1 }],
    [enrollment(0), enrollment(1), enrollment(2)],
  )
  assert.equal(matches.length, 1)
  assert.equal(matches[0].enrollment.memberIndex, 1)
})
