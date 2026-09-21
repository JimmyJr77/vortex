import {retirementEmployerEligibilityForPeriod} from '../retirementEmployerEligibilityPeriod.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {retirementEmployerEligibilityInput} from '../retirementEmployerEligibility.js'
import {hashPayrollToken} from '../employeeAuth.js'
const formula={period:'PER_PAYROLL',matchCatchUp:true,matchTiers:[{upToBps:300,matchBps:10000}],nonelectiveBps:200,compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},eligibilityTerms:'Reviewed employer entry date and service requirements.',vestingTerms:'Reviewed employer vesting schedule and credited service.'}
const source={fingerprint:'a'.repeat(64),employerContributions:'MATCH_AND_NONELECTIVE',employerFormula:formula,hireDate:'2026-09-01',planEffectiveOn:'2026-01-01'}
const review=()=>({sourceFingerprint:source.fingerprint,confirmed:true,assessedFrom:'2026-09-01',assessedThrough:'2026-09-11',reference:'Retained reviewed matching and nonelective eligibility.',matching:{status:'ELIGIBLE',eligibleOn:'2026-09-01',vestedBps:0},nonelective:{status:'ELIGIBLE',eligibleOn:'2026-09-01',vestedBps:10000}})
test('employer eligibility requires separate explicit findings without reducing an obligation by vesting',()=>{
 assert.equal(retirementEmployerEligibilityInput(review(),source).matching.vestedBps,0)
 for(const status of ['NOT_ELIGIBLE','REVIEW_REQUIRED'])assert.equal(retirementEmployerEligibilityInput({...review(),matching:{status,eligibleOn:null,vestedBps:null}},source).matching.status,status)
 for(const patch of [{confirmed:false},{sourceFingerprint:'b'.repeat(64)},{assessedThrough:'2026-02-30'},{reference:'short'},{matching:{status:'ELIGIBLE',eligibleOn:'2026-08-31',vestedBps:0}},{matching:{status:'ELIGIBLE',eligibleOn:'2026-09-12',vestedBps:0}},{matching:{status:'ELIGIBLE',eligibleOn:'2026-09-01',vestedBps:10001}},{matching:{status:'NOT_ELIGIBLE',eligibleOn:null,vestedBps:0}},{matching:{status:'NOT_APPLICABLE',eligibleOn:null,vestedBps:null}}])assert.throws(()=>retirementEmployerEligibilityInput({...review(),...patch},source))
 assert.throws(()=>retirementEmployerEligibilityInput(review(),{...source,employerFormula:null}),/structured employer/)
 assert.equal(retirementEmployerEligibilityInput({...review(),nonelective:{status:'NOT_APPLICABLE',eligibleOn:null,vestedBps:null}},{...source,employerContributions:'MATCH'}).nonelective.status,'NOT_APPLICABLE')
})
test('independent employer reviews retain retries, isolate scope, stale on employment changes and preserve signed employee elections',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness({retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const api=async(path,body,{status=200,facility=1,employee=false}={})=>{
  const r=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${employee?'employer-eligibility-session':'payroll-test-admin'}`,'Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined})
  const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data
 }
 const e=await api('/employees',{employeeNumber:'EMPLOYER-ELIGIBILITY',legalFirstName:'Synthetic',legalLastName:'Participant',hireDate:'2026-09-01',hourlyRateCents:2500},{status:201})
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),employerContributions:'MATCH_AND_NONELECTIVE',employerContributionTerms:'Reviewed employer funding plan clauses.',employerFormula:formula},expectedRevision:0,requestKey:randomUUID()})
 const deferralPath=`/employees/${e.id}/retirement-eligibility/standard`,deferral=(await api(deferralPath)).source
 await api(deferralPath,{sourceFingerprint:deferral.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,disposition:'ELIGIBLE',eligibleOn:'2026-09-01',methods:['PERCENTAGE'],reference:'Reviewed employee deferral eligibility evidence.',employeeExplanation:'Eligible to choose employee deferrals under current plan.'})
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,clock_timestamp()+interval '1 day')",[e.id,hashPayrollToken('employer-eligibility-session')])
 const proposal=(await api('/retirement',undefined,{employee:true})).plans[0].proposal
 await api('/retirement/standard/elections',{action:'DECLINE',method:'PERCENTAGE',pretax:0,roth:0,signature:'Synthetic Participant',confirmed:true,effectiveOn:'2026-09-12',expectedRevision:0,requestKey:randomUUID(),proposalFingerprint:proposal.fingerprint},{employee:true})
 const employeeBefore=await api('/retirement',undefined,{employee:true}),path=`/employees/${e.id}/retirement-employer-eligibility/standard`,current=await api(path)
 const body={...review(),sourceFingerprint:current.source.fingerprint,expectedRevision:0,requestKey:randomUUID()}
 const saved=await api(path,body);
 const periodArgs={facility:1,employeeId:e.id,planId:'standard',periodStart:'2026-09-01',periodEnd:'2026-09-11'}
 const period=await retirementEmployerEligibilityForPeriod(h.pool,periodArgs);assert.equal(period.components.nonelective.eligible,true);assert.equal(period.components.matching.vestedBps,0)
 await assert.rejects(retirementEmployerEligibilityForPeriod(h.pool,{...periodArgs,periodEnd:'2026-09-12'}),/full contribution period/)
assert.equal((await api(path,body)).id,saved.id)
 await api(path,{...body,reference:'Different employer evidence for same key.'},{status:409})
 assert.deepEqual(await api('/retirement',undefined,{employee:true}),employeeBefore)
 const after=await api(path);assert.equal(after.history.length,1);assert.equal(after.history[0].status,'CURRENT');assert.equal(after.history[0].review.nonelective.status,'ELIGIBLE')
 await api(path,undefined,{facility:2,status:404})
 const next={...body,expectedRevision:1,requestKey:randomUUID(),matching:{status:'NOT_ELIGIBLE',eligibleOn:null,vestedBps:null}}
 const responses=await Promise.all([next,{...next,requestKey:randomUUID()}].map(b=>fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(b)})))
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409])
 assert.deepEqual(await api('/retirement',undefined,{employee:true}),employeeBefore)
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_employer_eligibility SET revision=99'),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_employer_eligibility'),/append-only/)
 await h.pool.query("UPDATE payroll_employee SET employment_status='LEAVE' WHERE id=$1",[e.id])
 await assert.rejects(retirementEmployerEligibilityForPeriod(h.pool,periodArgs),/current employer eligibility/)
 const changed=await api(path);assert.notEqual(changed.source.fingerprint,current.source.fingerprint);assert.equal(changed.history[0].status,'STALE')
 await api(path,{...body,requestKey:randomUUID(),expectedRevision:2},{status:409})
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_retirement_employer_eligibility')).rows[0].n,2)
 assert.equal((await h.pool.query("SELECT count(*)::int AS n FROM payroll_audit_log WHERE action='RETIREMENT_EMPLOYER_ELIGIBILITY_REVIEWED'")).rows[0].n,2)
})
