import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {retirementAnnualFixture} from '../testing/retirementAnnualFixture.js'
import {retirementEmployerCompensationPreview} from '../retirementEmployerCompensation.js'
import {loadRunPreview} from '../registerRoutes.js'

test('normal payroll previews capped employer compensation before approval without employee deferral enrollment',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHistoricalHarness(t,{retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const raw=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview.employees[0]
 const plan={...retirementPlanFixture(),employerContributions:'NONELECTIVE',employerContributionTerms:'Synthetic reviewed employer contribution formula.',employerFormula:{period:'PER_PAYROLL',matchCatchUp:false,matchTiers:[],nonelectiveBps:200,compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},eligibilityTerms:'Synthetic reviewed eligibility conditions.',vestingTerms:'Synthetic reviewed vesting terms.'}}
 await api('/retirement-plans',{plan,expectedRevision:0,requestKey:randomUUID()})
 const annualPath=`/employees/${employee.id}/retirement-annual-sources/standard`,source=await api(annualPath)
 await api(annualPath,{planRevisionId:source.planRevisionId,expectedRevision:0,requestKey:randomUUID(),facts:{...retirementAnnualFixture(),employerFunding:{compensationCents:35990000,matchingCents:0,nonelectiveCents:0,reference:'Synthetic external employer compensation excluding application payroll.'}}})
 const request={payPeriodId:periods[0].id,eligibleCompensationCents:99999999,payrollPreview:{grossPayCents:99999999},plan:{employerContributions:'NONE'},annual:{employerFunding:{compensationCents:0}}}
 const preview=(await api('/runs/preview',request)).preview,c=preview.employees[0].employerCompensationPreview
 assert.equal(c.status,'COMPENSATION_PREVIEW');assert.equal(c.eligibleCompensationCents,10000)
 assert.equal(c.records[0].compensationCents,20000);assert.equal(c.records[0].proposed,true);assert.equal(c.runId,'PREVIEW')
 assert.equal(c.requiresApprovalReservation,true);assert.equal(c.requiresPayrollIntegration,true)
 assert.equal(preview.canApprove,false);assert.match(preview.warnings.find(w=>w.code==='RETIREMENT_PAYROLL_REVIEW').message,/\$100\.00.*No employer contribution has been reserved/)
 assert.equal(preview.employees[0].netPayCents,raw.netPayCents)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_election')).rows[0].n,0)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_run_ledger')).rows[0].n,0)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 const refreshed=await loadRunPreview(h.pool,1,run)
 assert.equal(refreshed.preview.employees[0].employerCompensationPreview.runId,String(run.id))
 assert.equal(refreshed.preview.employees[0].employerCompensationPreview.eligibleCompensationCents,10000)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH',409)
 const args={facility:1,employeeId:employee.id,planId:'standard',payDate:'2026-09-18',payrollPreview:raw,runId:run.id}
 for(const patch of [{facility:2},{employeeId:Number(employee.id)+1},{payDate:'2026-09-19'},{payDate:'2026-02-30'},{runId:Number(run.id)+1},{payrollPreview:{...raw,warnings:[{blocking:true}]}}])await assert.rejects(retirementEmployerCompensationPreview(h.pool,{...args,...patch}),{status:409})
 await api(`/runs/${run.id}/status`,{status:'VOID'},'PATCH')
 await assert.rejects(retirementEmployerCompensationPreview(h.pool,args),/unapproved payroll/)
})
