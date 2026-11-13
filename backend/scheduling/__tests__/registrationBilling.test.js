import test from 'node:test'
import assert from 'node:assert/strict'
import { billConfirmedRegistration } from '../registrationBilling.js'
import { requiredRegistrationFees, registrationRequiresMembership, billRegistrationMembership } from '../registrationMembership.js'
import { loadMemberFeeRedemptionKeys } from '../additionalFeesEngine.js'

const annual = { id: 7, amountCents: 8500, applyBasis: 'per_year', triggerType: 'new_member', scopeLevel: 'class', scopeRefId: 4 }
const other = { id: 8, amountCents: 1000, applyBasis: 'per_order' }
const signup = { id: 19, member_id: 42, form_id: 5, slot_group_id: 6, time_slot_id: 7, status: 'confirmed', enrollment_start_date: '2026-11-01' }
const monthly = { slotKey: '5:6:7', billingType: 'recurring', incrementalMonthly: 150 }

for (const [label, input, required] of [
  ['paid monthly', { newSignupItems: [monthly] }, true],
  ['paid one-time class', { oneTimeTuition: { totalCents: 2500 } }, true],
  ['waived one-time class', { oneTimeTuition: { totalCents: 0 } }, false],
  ['free monthly', { newSignupItems: [{ ...monthly, incrementalMonthly: 0 }] }, false],
  ['prepaid pass', { newSignupItems: [{ ...monthly, multiClassPassApplied: true }] }, false],
  ['100% line discount', { newSignupItems: [monthly], discounts: { lines: [{ key: monthly.slotKey, baseCents: 15000, applied: [{ amountCents: 15000 }] }] } }, false],
  ['100% order discount', { newSignupItems: [monthly], discounts: { enabled: true, totalCents: 0 } }, false],
  ['free initial period', { firstMonth: { enabled: true, items: [{ proratedCents: 0, prepaidFirstMonthCents: 0 }] } }, false],
  ['paid future month', { firstMonth: { enabled: true, items: [{ proratedCents: 0, prepaidFirstMonthCents: 15000 }] } }, true],
]) test(`membership requirement: ${label}`, () => assert.equal(registrationRequiresMembership(input), required))

test('membership uses the athlete, not a payer or sibling, and is required across class scopes', async () => {
  const members = []
  const db = { query: async (sql, params) => { members.push(params[0]); return { rows: [] } } }
  const fees = await requiredRegistrationFees(db, { memberId: 42, fees: [annual, other] })
  assert.deepEqual(members, [42])
  assert.equal(fees[1].scopeLevel, 'global')
  assert.equal(fees[1].triggerType, 'once_per_year')
})
test('active participant membership suppresses every annual fee, even a replaced fee id', async () => {
  const db = { query: async () => ({ rows: [{ fee_id: 1, satisfied_at: '2026-01-01', period_key: '2099-01-01' }] }) }
  assert.deepEqual(await requiredRegistrationFees(db, { memberId: 42, fees: [annual, other] }), [other])
})
test('exempt registrations need no membership lookup or configuration', async () => {
  const db = { query() { throw new Error('must not query') } }
  assert.deepEqual(await requiredRegistrationFees(db, { memberId: 42, fees: [annual, other], required: false }), [other])
})
test('missing membership pricing and status lookup errors fail closed', async () => {
  await assert.rejects(requiredRegistrationFees({ query: async () => ({ rows: [] }) }, { memberId: 42, fees: [] }), /pricing is unavailable/)
  await assert.rejects(requiredRegistrationFees({ query: async () => { throw new Error('database unavailable') } }, { memberId: 42, fees: [annual] }), /database unavailable/)
})
test('ended membership cannot be revived by the legacy creation-date fallback', async () => {
  const db = { query: async () => ({ rows: [{ fee_id: 7, created_at: '2026-10-01', period_key: '2027-10-01', ended_at: '2026-10-02' }] }) }
  assert.deepEqual([...await loadMemberFeeRedemptionKeys(db, 42, [7], new Date('2026-10-27'))], [])
})
test('unpaid membership bill is reused instead of creating another charge', async () => {
  const db = { async query(sql) {
    if (sql.includes('FROM additional_fee_redemption')) return { rows: [] }
    if (sql.includes('SELECT member.family_id')) return { rows: [{ family_id: 3, facility_id: 1, account_id: 9 }] }
    if (sql.includes('pg_advisory')) return { rows: [] }
    if (sql.includes('SELECT * FROM additional_fee')) return { rows: [{ id: 7, amount_cents: 8500, apply_basis: 'per_year', trigger_type: 'once_per_year' }] }
    if (sql.includes('annual-membership:outstanding-charge')) return { rows: [{ id: 100 }] }
    throw new Error(`Unexpected write: ${sql}`)
  } }
  await billRegistrationMembership(db, 42)
})
test('admission bills the exact athlete and slot using a preview that excludes its own row', async () => {
  const db = { query: async () => ({ rows: [] }) }
  const preview = { newSignups: [monthly] }
  let billed = false
  await billConfirmedRegistration(db, signup, {
    previewBuilder: async (connection, args) => {
      assert.equal(connection, db); assert.equal(args.memberId, 42)
      assert.deepEqual(args.excludeSignupIds, [19]); assert.equal(args.newSignups[0].timeSlotId, 7)
      return preview
    },
    persist: async (connection, args) => { billed = true; assert.equal(connection, db); assert.equal(args.preview, preview); assert.equal(args.memberId, 42) },
  })
  assert.equal(billed, true)
})
test('admission propagates billing failure so its enclosing transaction rolls back', async () => {
  await assert.rejects(billConfirmedRegistration({ query: async () => ({ rows: [] }) }, signup, {
    previewBuilder: async () => ({}), persist: async () => { throw new Error('ledger unavailable') },
  }), /ledger unavailable/)
})
test('waitlisted athletes are not charged before admission', async () => {
  await billConfirmedRegistration({ query() { throw new Error('must not query') } }, { ...signup, status: 'waitlisted' })
})

test('waitlist promotion bills each admitted athlete on the same transaction connection', async () => {
  const { promoteFromWaitlist } = await import('../waitlist.js')
  const billed = []
  const db = { async query(sql, params) {
    if (sql.includes('AS available')) return { rows: [{available:2}] }
    if (sql.includes('SELECT id')) return { rows: [{ id: 19 }, { id: 20 }] }
    return { rows: [{ ...signup, id: params[0], member_id: params[0] + 100 }] }
  } }
  const promoted = await promoteFromWaitlist(db, 6, 2, { prepareActivation: async () => null, billRegistration: async (connection, row) => {
    assert.equal(connection, db); billed.push(row.member_id)
  } })
  assert.deepEqual(billed, [119, 120]); assert.equal(promoted.length, 2)
})
test('failed waitlist billing prevents a successful promotion result', async () => {
  const { promoteFromWaitlist } = await import('../waitlist.js')
  const db = { query: async (sql) => ({ rows: sql.includes('AS available') ? [{available:1}] : sql.includes('SELECT id') ? [{ id: 19 }] : [signup] }) }
  await assert.rejects(promoteFromWaitlist(db, 6, 1, { prepareActivation: async () => null, billRegistration: async () => { throw new Error('membership pricing unavailable') } }), /membership pricing unavailable/)
})

test('resuming a billed registration preserves its existing price and discounts', async () => {
  await billConfirmedRegistration({ query: async () => ({ rows: [{ net_monthly_cents: 0 }] }) }, signup, {
    previewBuilder() { throw new Error('must not reprice an existing billed registration') },
    persist() { throw new Error('must not bill an existing registration twice') },
  })
})

test('pending registration holds leave no capacity for waitlist promotion',async()=>{
  const {promoteFromWaitlist}=await import('../waitlist.js')
  const db={query:async sql=>{assert.match(sql,/pending_registration_holds/);return {rows:[{available:0}]}}}
  assert.deepEqual(await promoteFromWaitlist(db,6,2,{billRegistration(){throw Error('Must not bill a waiting athlete')}}),[])
})
