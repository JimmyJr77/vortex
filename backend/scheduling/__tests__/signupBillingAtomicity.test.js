import test from 'node:test'
import assert from 'node:assert/strict'
import { createSchedulingHandlers } from '../handlers.js'

// Guard the two public entry points: neither may confirm an enrollment before
// its billing writes, or swallow a tuition persistence error after committing.
for (const name of ['createSignup','createSignupBatch']) test(`${name} commits tuition with enrollment before running collection setup`,()=>{
 const source=String(createSchedulingHandlers({})[name])
 const bill=source.indexOf('await persistSignupCharges(client,')
 const commit=source.indexOf("await client.query('COMMIT')")
 const setup=source.indexOf('await completeHouseholdEnrollmentSetup(')
 assert.ok(bill>=0 && bill<commit)
 assert.ok(setup>commit)
 assert.ok(source.includes('await buildSignupOrderPreview(client,'))
 assert.ok(!source.includes("console.warn('[scheduling] persistSignupCharges:'"))
})
