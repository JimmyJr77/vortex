import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {retirementTimingInput,retirementTimingDates,retirementTimingAssessment} from '../retirementTiming.js'
import {refreshRetirementTimingAlerts} from '../retirementTimingAlerts.js'
import {createHarness} from '../testing/harness.js'
import {retirementRemittanceFixture} from '../testing/retirementRemittanceFixture.js'
import {retirementDestinationProvider} from '../testing/retirementDestinationProvider.js'
const input={effectiveOn:'2026-01-01',disposition:'REVIEWED',depositBusinessDays:2,providerLeadBusinessDays:1,cutoffTime:'14:00',reference:'Reviewed actual segregation capacity and recordkeeper receipt lead time',confirmed:true,calendarConfirmed:true,earliestConfirmed:true}
test('reviewed timing applies bank holidays, lead time, DST offsets and exact cutoff boundaries',()=>{
 const p=retirementTimingInput(input),d=retirementTimingDates(p,'2026-09-04',new Date('2026-09-08T17:59:59Z'))
 assert.equal(d.depositDate,'2026-09-09');assert.equal(d.submissionAt,'2026-09-08T18:00:00.000Z');assert.equal(d.status,'SUBMISSION_DUE_TODAY')
 assert.equal(retirementTimingDates(p,'2026-09-04',new Date('2026-09-08T18:00:00Z')).status,'SUBMISSION_CUTOFF_PASSED')
 assert.equal(retirementTimingDates(p,'2026-09-04',new Date('2026-09-10T04:00:00Z')).status,'DEPOSIT_TARGET_PASSED')
 assert.equal(retirementTimingDates(p,'2026-11-06').submissionAt,'2026-11-09T19:00:00.000Z')
 assert.equal(retirementTimingDates(p,'2026-12-31').depositDate,'2027-01-05')
 assert.equal(retirementTimingDates({...p,depositBusinessDays:0},'2026-09-06').status,'CALENDAR_REVIEW_REQUIRED')
 assert.equal(retirementTimingDates({...p,depositBusinessDays:0},'2026-09-04').status,'ADVANCE_SUBMISSION_REVIEW_REQUIRED')
})
test('timing rejects invented defaults, invalid dates and unconfirmed capacity/calendar',()=>{
 for(const change of [{depositBusinessDays:null},{providerLeadBusinessDays:-1},{cutoffTime:'24:00'},{effectiveOn:'2026-02-30'},{confirmed:false},{calendarConfirmed:false},{earliestConfirmed:false}])assert.throws(()=>retirementTimingInput({...input,...change}))
 assert.deepEqual(retirementTimingInput({...input,disposition:'SUSPENDED'}),{effectiveOn:input.effectiveOn,disposition:'SUSPENDED',reference:input.reference})
})
test('timing reviews persist exact retries, invalidate sources and create scoped automatic deadline alerts',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api,run}=await retirementRemittanceFixture(h),path='/retirement-plans/standard/timing',initial=(await api('/retirement-remittance-sources')).items[0],current=await api(path)
 assert.equal(initial.allocations[0].timing.status,'REVIEW_REQUIRED')
 await refreshRetirementTimingAlerts(h.pool,1,{now:new Date('2026-09-18T12:00:00Z')})
 assert.match((await h.pool.query("SELECT message FROM payroll_alert WHERE dedupe_key=$1",[`retirement-timing-${run.id}-standard`])).rows[0].message,/review required/)
 const b={policy:input,planRevisionId:current.planRevisionId,expectedRevision:0,requestKey:randomUUID()},[a,c]=await Promise.all([api(path,b),api(path,b)])
 assert.equal(a.id,c.id);assert.equal((await api(path)).history.length,1)
 await api(path,{...b,policy:{...input,cutoffTime:'13:00'}},'POST',409)
 const changed=(await api('/retirement-remittance-sources')).items[0];assert.notEqual(changed.sourceFingerprint,initial.sourceFingerprint);assert.equal(changed.allocations[0].timing.depositDate,'2026-09-22')
 const before=new Date('2026-09-21T17:00:00Z');assert.equal((await refreshRetirementTimingAlerts(h.pool,2,{now:before})).checked,0)
 assert.equal((await refreshRetirementTimingAlerts(h.pool,1,{now:before})).checked,1)
 const key=`retirement-timing-${run.id}-standard`;assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[key])).rows[0].status,'OPEN')
 assert.equal((await refreshRetirementTimingAlerts(h.pool,1,{now:new Date(+before+60000)})).checked,0)
 const suspend={policy:{...input,disposition:'SUSPENDED'},planRevisionId:b.planRevisionId,expectedRevision:1,requestKey:randomUUID()};await api(path,suspend)
 assert.equal((await retirementTimingAssessment(h.pool,1,'standard','2026-09-18')).status,'SUSPENDED')
 await api(path,b);assert.equal((await api(path)).history.length,2)
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),name:'Renewed plan terms requiring timing review'},expectedRevision:1,requestKey:randomUUID()})
 assert.equal((await retirementTimingAssessment(h.pool,1,'standard','2026-09-18')).status,'PLAN_CHANGED')
 await api(path,{...suspend,expectedRevision:2,requestKey:randomUUID()},'POST',409)
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_timing_review SET revision=4 WHERE id=$1',[a.id]),/immutable|append|cannot|not allowed/i)
 const response=await fetch(`${h.url}/api/admin/payroll/retirement-plans/standard/timing`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(response.status,404)
 assert.equal(provider.posts(),0)
})
