import test from 'node:test'
import assert from 'node:assert/strict'
import {benefitCoverageCandidates} from '../benefitCoverageLedger.js'
import {benefitsElectionInput} from '../benefitsElection.js'
import {validateBenefitsReview} from '../benefitsReview.js'
const policy='Synthetic published medical and dental coverage.'
const plans=['medical','dental'].map(id=>({id,name:id,description:'Synthetic published plan.',options:[{id:'single',label:'Employee only',employeeCostCents:1000,employerCostCents:5000,taxTreatment:'POSTTAX'}]}))
function decision(effectiveOn,selected,{cycle=1,employee=7,status='COMPLETE',employmentStatus='ACTIVE'}={}){
 const election=benefitsElectionInput({choice:selected.length?'ENROLL':'WAIVE',signature:'Synthetic Employee',confirmed:true,displayedTerms:policy,requestKey:`coverage-${effectiveOn}-${cycle}`,selections:plans.map(plan=>({planId:plan.id,optionId:selected.includes(plan.id)?'single':'WAIVE'}))},policy,plans)
 const review=validateBenefitsReview({disposition:selected.length?'ENROLLED':'WAIVED',effectiveOn,summary:'Synthetic reviewed benefits disposition.',evidenceReference:'Synthetic retained carrier and election evidence.',confirmed:true},policy,'2026-12-31',election,plans)
 return {employee_id:employee,onboarding_cycle:cycle,employee_name:'Synthetic Employee',employment_status:employmentStatus,snapshot:{status,response:{benefitsReview:review,benefitsElection:election,paySetup:{basis:{benefitsPolicy:policy,benefitPlans:plans}}}}}
}
test('coverage keeps both plans when selections change midmonth and excludes future decisions',()=>{
 const history=[decision('2026-08-01',['medical']),decision('2026-09-15',['dental']),decision('2026-10-01',[])]
 const september=benefitCoverageCandidates(history,'2026-09')
 assert.deepEqual(september.map(row=>row.planId),['dental','medical'])
 for(const row of september)assert.deepEqual(row.decisions.map(item=>item.effectiveOn),['2026-08-01','2026-09-15'])
 assert.equal(september.find(row=>row.planId==='medical').decisions[1].selection.optionId,'WAIVE')
 assert.deepEqual(benefitCoverageCandidates(history,'2026-10'),[])
 assert.deepEqual(benefitCoverageCandidates(history,'2026-07'),[])
})
test('same-date corrections replace current coverage candidates while rehire cycles remain distinct',()=>{
 const original=decision('2026-09-01',['medical']),correction=decision('2026-09-01',['dental'])
 assert.deepEqual(benefitCoverageCandidates([original,correction],'2026-09').map(row=>row.planId),['dental'])
 const rehired=decision('2026-09-20',['dental'],{cycle:2})
 const rows=benefitCoverageCandidates([original,correction,rehired],'2026-09')
 assert.deepEqual(rows.map(row=>[row.onboardingCycle,row.planId]),[[1,'dental'],[2,'dental']])
 assert.notEqual(rows[0].sourceFingerprint,rows[1].sourceFingerprint)
})
test('unverified or mismatched enrollment cannot establish coverage and termination remains visible',()=>{
 const original=decision('2026-09-01',['medical']),unsigned=structuredClone(original)
 unsigned.snapshot.response.benefitsElection.signature=''
 assert.deepEqual(benefitCoverageCandidates([unsigned],'2026-09'),[])
 const changed=structuredClone(original);changed.snapshot.response.paySetup.basis.benefitPlans[0].options[0].employeeCostCents=9999
 assert.deepEqual(benefitCoverageCandidates([changed],'2026-09'),[])
 assert.deepEqual(benefitCoverageCandidates([decision('2026-09-01',['medical'],{status:'SUBMITTED'})],'2026-09'),[])
 const terminated=decision('2026-09-01',['medical'],{employmentStatus:'TERMINATED'})
 const before=benefitCoverageCandidates([original],'2026-09')[0],after=benefitCoverageCandidates([terminated],'2026-09')[0]
 assert.equal(after.employmentStatus,'TERMINATED');assert.equal(after.planId,'medical');assert.notEqual(before.sourceFingerprint,after.sourceFingerprint)
})
