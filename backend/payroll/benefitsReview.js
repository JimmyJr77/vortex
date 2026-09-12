import {benefitsTerms,benefitPlans} from './benefitCatalog.js'
import {benefitsElectionMatches} from './benefitsElection.js'
const decisions=['NOT_OFFERED','NOT_ELIGIBLE','WAIVED','ENROLLED','ENROLLED_EMPLOYER_FUNDED','WAITING_PERIOD']
export function validateBenefitsReview(input,policy,today,election=null,plans=[]){
 const fail=message=>{throw Object.assign(new Error(message),{status:400})}
 if(!input||!decisions.includes(input.disposition))fail('Record the employee benefits disposition before completing hiring pay review.')
 const text=(key,min)=>{if(typeof input[key]!=='string'||input[key].trim().length<min||input[key].length>2000)fail(`Provide ${key==='summary'?'an employee-facing benefits explanation':'benefits eligibility, waiver or enrollment evidence'} (${min}–2000 characters).`);return input[key].trim()}
 if(input.confirmed!==true)fail('Confirm the benefits eligibility and supporting evidence review.')
 const effectiveOn=input.effectiveOn
 if(typeof effectiveOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn)||!Number.isFinite(Date.parse(effectiveOn))||new Date(effectiveOn).toISOString().slice(0,10)!==effectiveOn)fail('Enter the effective or eligibility date for this benefits decision.')
 if(input.disposition==='WAITING_PERIOD'&&effectiveOn<=today)fail('The benefits eligibility date has arrived. Review enrollment or another current disposition.')
 const requiredChoice={ENROLLED:'ENROLL',ENROLLED_EMPLOYER_FUNDED:'ENROLL',WAIVED:'WAIVE'}[input.disposition]
 if(requiredChoice&&(!benefitsElectionMatches(election,String(policy||''),plans)||election.choice!==requiredChoice))fail('Collect the employee’s signed current benefits choice before recording enrollment or waiver.')
 if(input.disposition==='ENROLLED_EMPLOYER_FUNDED'&&(input.employerFundingConfirmed!==true||input.fundingTreatment!=='EXCLUDED_GROUP_HEALTH_PREMIUM'||!election?.selections?.some(s=>s.optionId!=='WAIVE'&&s.employeeCostCents>0)))fail('Confirm the employer assumes the published employee contributions for excluded group medical, dental or vision premiums, with no taxable owner, reimbursement or other benefit treatment.')
 return {...(input.disposition==='ENROLLED_EMPLOYER_FUNDED'?{employerFundingConfirmed:true,fundingTreatment:'EXCLUDED_GROUP_HEALTH_PREMIUM'}:{}),version:1,disposition:input.disposition,effectiveOn,summary:text('summary',10),evidenceReference:text('evidenceReference',12),confirmed:true,employeeElectionId:election?.submissionId||null,policyTerms:String(policy||'')}
}
export function benefitsReviewCurrent(review,policy,today,election=null,plans=[]){
 try{return review?.version===1&&review.policyTerms===String(policy||'')&&(review.employeeElectionId||null)===(election?.submissionId||null)&&!!validateBenefitsReview(review,policy,today,election,plans)}catch{return false}
}
export function benefitsReviewForEmployee(review){
 if(!review||!decisions.includes(review.disposition))return null
 return {disposition:review.disposition,effectiveOn:review.effectiveOn,summary:review.summary}
}
export async function automateBenefitsReviews(db,facility,today){
 const rows=(await db.query(`SELECT e.id,e.legal_first_name,e.legal_last_name,t.response,t.status,s.onboarding_policy
 FROM payroll_employee e JOIN payroll_settings s ON s.facility_id=e.facility_id
 JOIN payroll_onboarding_task t ON t.facility_id=e.facility_id AND t.employee_id=e.id AND t.task_key='PAY_REVIEW'
 WHERE e.facility_id=$1 AND e.employment_status IN ('ONBOARDING','ACTIVE') AND (t.status='COMPLETE' OR e.employment_status='ACTIVE')`,[facility])).rows
 const active=[]
 for(const e of rows){
  if(e.status==='COMPLETE'&&benefitsReviewCurrent(e.response.benefitsReview,benefitsTerms(e.onboarding_policy),today,e.response.benefitsElection,benefitPlans(e.onboarding_policy)))continue
  const key=`benefits-review-${e.id}`;active.push(key)
  await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Employee benefits review required',$3)
  ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facility,key,`${e.legal_first_name} ${e.legal_last_name}: review the current benefits policy, eligibility date and enrollment disposition in People & onboarding.`])
 }
 await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key LIKE 'benefits-review-%' AND NOT(dedupe_key=ANY($2::text[])) AND status='OPEN'",[facility,active])
}
