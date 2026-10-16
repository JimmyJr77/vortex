import test from 'node:test'
import assert from 'node:assert/strict'
import { completeHouseholdEnrollmentSetup } from '../householdEnrollmentSetup.js'
const environment={BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED:'true'}
test('separate enrollment and membership flows provision household billing without collecting another payment',async()=>{
 const calls=[]
 const db={async query(sql,params){calls.push({sql,params});return {rows:sql.includes('SELECT a.id')?[{id:99,family_id:101}]:[]}}}
 let synced=0,activated=0
 const options={memberId:195,environment,stripeClient:{},syncDiscounts:async(db,familyId)=>{assert.equal(familyId,101);synced++},activate:async(db,args)=>{assert.equal(args.accountId,99);activated++;return {status:'ready'}}}
 for(let i=0;i<2;i++)assert.equal((await completeHouseholdEnrollmentSetup(db,options)).status,'ready')
 assert.equal(synced,2);assert.equal(activated,2)
 assert.equal(calls.filter(c=>c.sql.includes("action_status='resolved'")).length,2)
})
test('setup failures remain visible and a successful retry resolves only its setup alert',async()=>{
 const calls=[]
 const db={async query(sql,params){calls.push({sql,params});return {rows:sql.includes('SELECT a.id')?[{id:99,family_id:101}]:[]}}}
 const options={memberId:195,environment,stripeClient:{},syncDiscounts:async()=>{},activate:async()=>({status:'migration_review_required'})}
 assert.equal((await completeHouseholdEnrollmentSetup(db,options)).status,'setup_pending')
 assert.ok(calls.some(c=>c.sql.includes('INSERT INTO stripe_billing_alert')&&c.params[0]==='enrollment-setup:99'))
 options.activate=async()=>({status:'ready'})
 assert.equal((await completeHouseholdEnrollmentSetup(db,options)).status,'ready')
 assert.equal(calls.at(-1).params[0],'enrollment-setup:99')
})
