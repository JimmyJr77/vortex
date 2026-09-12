import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {benefitsReviewCurrent} from './benefitsReview.js'
import {benefitPlans,benefitsTerms} from './benefitCatalog.js'
export function benefitsDeductionProposal(employee,task,settings,today){
 const review=task?.response?.benefitsReview,election=task?.response?.benefitsElection,saved=task?.response?.benefitsDeductionAuthorization||null
 const items=(election?.selections||[]).filter(s=>s.optionId!=='WAIVE'&&s.employeeCostCents>0).map(s=>({planId:s.planId,planName:s.planName,optionId:s.optionId,optionLabel:s.optionLabel,monthlyCents:s.employeeCostCents,taxTreatment:s.taxTreatment}))
 const required=review?.disposition==='ENROLLED'&&items.length>0
 if(!required)return {required:false,status:'NOT_REQUIRED',proposal:null,saved}
 if(task.status!=='COMPLETE'||!benefitsReviewCurrent(review,benefitsTerms(settings.onboarding_policy),today,election,benefitPlans(settings.onboarding_policy)))return {required:true,status:'REVIEW_REQUIRED',proposal:null,saved}
 const monthlyCents=items.reduce((sum,item)=>sum+item.monthlyCents,0)
 if(!Number.isSafeInteger(monthlyCents)||monthlyCents<=0)return {required:true,status:'REVIEW_REQUIRED',proposal:null,saved}
 const employer=String(settings.legal_business_name||'').trim()
 if(!employer)return {required:true,status:'REVIEW_REQUIRED',proposal:null,saved}
 const timing='FIRST_REGULAR_PAYMENT_MONTHLY'
 const terms=`I authorize ${employer} to deduct the following benefit contributions from my wages:\n${items.map(i=>`${i.planName} — ${i.optionLabel}: $${(i.monthlyCents/100).toFixed(2)} per month (${i.taxTreatment.toLowerCase().replaceAll('_',' ')}).`).join('\n')}\nTotal authorized monthly deduction: $${(monthlyCents/100).toFixed(2)}.\nCoverage effective date: ${review.effectiveOn}.\nCollect the full monthly amount once, from the first eligible regular payroll payment in each coverage month after this authorization is signed. Do not prorate the first month, collect prior-month arrears, or add a second charge for the same month under this authorization. Changes to these amounts or terms require a new authorization. This statement concerns wage deductions only.`
 const basis={version:1,employeeId:Number(employee.id),onboardingCycle:task.onboarding_cycle,electionId:election.submissionId,employer,items,monthlyCents,startOn:review.effectiveOn,timing,terms}
 const fingerprint=createHash('sha256').update(JSON.stringify(compensationEvidence(basis))).digest('hex')
 const withdrawn=task.response?.benefitsDeductionWithdrawal?.authorizationRequestKey===saved?.requestKey&&!!saved
 const current=!withdrawn&&task.response?.benefitsDeductionSupersededByFunding?.authorizationRequestKey!==saved?.requestKey&&saved?.version===1&&saved.proposalFingerprint===fingerprint&&JSON.stringify(compensationEvidence(saved.proposal))===JSON.stringify(compensationEvidence({...basis,fingerprint}))&&typeof saved.signature==='string'&&saved.signature.trim().length>=2&&Number.isFinite(Date.parse(saved.signedAt))
 return {required:true,status:withdrawn?'WITHDRAWN':current?'CURRENT':saved?'STALE':'PENDING',withdrawal:task.response?.benefitsDeductionWithdrawal||null,proposal:{...basis,fingerprint},saved}
}
export function signedBenefitsDeduction(body,proposal){
 const fail=message=>{throw Object.assign(new Error(message),{status:400})}
 if(!proposal||body.proposalFingerprint!==proposal.fingerprint)fail('The benefit deduction terms changed. Refresh and read the current authorization.')
 if(body.confirmed!==true||typeof body.signature!=='string'||body.signature.trim().length<2||body.signature.length>200)fail('Sign and confirm the separate benefit deduction authorization.')
 if(typeof body.requestKey!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(body.requestKey))fail('Refresh the deduction authorization before signing.')
 return {version:1,requestKey:body.requestKey,proposalFingerprint:proposal.fingerprint,proposal,signature:body.signature.trim(),signedAt:new Date().toISOString()}
}
export async function automateBenefitsDeductionAuthorization(db,facility,today){
 const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]
 const rows=(await db.query("SELECT e.*,row_to_json(t) AS task FROM payroll_employee e JOIN payroll_onboarding_task t ON t.employee_id=e.id AND t.facility_id=e.facility_id AND t.task_key='PAY_REVIEW' WHERE e.facility_id=$1 AND e.employment_status IN ('ONBOARDING','ACTIVE')",[facility])).rows
 const active=[]
 for(const employee of rows){const data=benefitsDeductionProposal(employee,employee.task,settings,today);if(!data.required||data.status==='CURRENT')continue
  const key=`benefit-deduction-authorization-${employee.id}`;active.push(key)
  await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Benefit deduction authorization required',$3)
  ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facility,key,`${employee.legal_first_name} ${employee.legal_last_name}: complete benefits review and collect the separate signed deduction authorization in onboarding.`])
 }
 await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key LIKE 'benefit-deduction-authorization-%' AND NOT(dedupe_key=ANY($2::text[])) AND status='OPEN'",[facility,active])
}
