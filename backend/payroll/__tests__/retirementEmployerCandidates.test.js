import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {retirementCandidatesFor,retirementOffCycleWarnings} from '../regularRetirementPayroll.js'

test('employer-funded plans enter payroll review even without an employee election or deferral eligibility',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHistoricalHarness(t,{retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const preview=async()=> (await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 assert.equal((await preview()).canApprove,true)
 const save=async(plan,expectedRevision=0)=>api('/retirement-plans',{plan,expectedRevision,requestKey:randomUUID()})
 const plan={...retirementPlanFixture(),employerContributions:'NONELECTIVE',employerContributionTerms:'Synthetic reviewed nonelective funding for eligible employees.'}
 await save(plan)
 const candidates=await retirementCandidatesFor(h.pool,1,'2026-09-18',[employee.id])
 assert.deepEqual(candidates.map(c=>[String(c.employee_id),c.plan_id]),[[String(employee.id),'standard']])
 const blocked=await preview()
 assert.equal(blocked.canApprove,false)
 assert.ok(blocked.warnings.some(w=>w.code==='RETIREMENT_PAYROLL_REVIEW'&&w.blocking))
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_election')).rows[0].n,0)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_eligibility')).rows[0].n,0)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH',409)
 assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,'REVIEW')
 assert.equal((await retirementOffCycleWarnings(h.pool,1,employee.id,'2026-09-18'))[0].blocking,true)
 assert.deepEqual(await retirementCandidatesFor(h.pool,2,'2026-09-18',[employee.id]),[])
 assert.deepEqual(await retirementCandidatesFor(h.pool,1,'2026-09-18',[]),[])
 assert.deepEqual(await retirementCandidatesFor(h.pool,1,'2026-09-18',[String(Number(employee.id)+999)]),[])
 // Only applicable terms affect this date: a future no-funding revision
 // cannot erase an earlier employer obligation.
 await save({...retirementPlanFixture(),effectiveOn:'2026-10-01'},1)
 assert.equal((await retirementCandidatesFor(h.pool,1,'2026-09-18',[employee.id])).length,1)
 assert.deepEqual(await retirementCandidatesFor(h.pool,1,'2026-10-01',[employee.id]),[])
 await save({...retirementPlanFixture(),effectiveOn:'2026-09-01'},2)
 assert.deepEqual(await retirementCandidatesFor(h.pool,1,'2026-09-18',[employee.id]),[])
})

test('matching, combined and unresolved employer terms require review for each scoped employee',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHistoricalHarness(t,{retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const {api,employee}=await monthlyBenefitsFixture(h)
 for(const employerContributions of ['MATCH','MATCH_AND_NONELECTIVE','UNRESOLVED']){
  const planId=employerContributions.toLowerCase().replaceAll('_','-')
  await api('/retirement-plans',{plan:{...retirementPlanFixture(),planId,effectiveOn:'2026-09-20',employerContributions,employerContributionTerms:'Synthetic reviewed or unresolved employer funding terms.'},expectedRevision:0,requestKey:randomUUID()})
 }
 assert.deepEqual(await retirementCandidatesFor(h.pool,1,'2026-09-19',[employee.id]),[])
 assert.equal((await retirementCandidatesFor(h.pool,1,'2026-09-20',[employee.id])).length,3)
})
