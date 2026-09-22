import {priorBenefitCoverage} from './monthlyBenefits.js'
import {benefitsReviewCurrent} from './benefitsReview.js'
import {benefitsTerms,benefitPlans} from './benefitCatalog.js'
import {createHash,randomUUID} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {benefitsDeductionProposal} from './benefitsDeductionAuthorization.js'
import {benefitCoverageLedger} from './benefitCoverageLedger.js'
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const validDay=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)

// A dated employer review supplements, never replaces, the signed authorization.
// Current source facts are re-read under the payroll transaction before collection.
export async function benefitContinuationSource(db,facility,employeeId,paymentDate){
 if(!validDay(paymentDate))throw fail('Choose the actual regular payroll payment date.',400)
 const employee=(await db.query('SELECT id,legal_first_name,legal_last_name,employment_status,hire_date::text,termination_date::text FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employeeId])).rows[0]
 if(!employee)throw fail('Employee not found.',404)
 const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]
 const tasks=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='PAY_REVIEW'",[facility,employeeId])).rows
 const today=(await db.query('SELECT (clock_timestamp() AT TIME ZONE $1)::date::text AS today',[settings.timezone])).rows[0].today
 const periods=(await db.query('SELECT id,started_on::text,ended_on::text FROM payroll_employment_period WHERE facility_id=$1 AND employee_id=$2 ORDER BY started_on,id',[facility,employeeId])).rows
 const issues=[],task=tasks.length===1?tasks[0]:null
 let authorization=benefitsDeductionProposal(employee,task,settings,today),datedCoverage=null
 const effective=task?.response?.benefitsReview?.effectiveOn
 if(effective&&paymentDate<effective){
  try{
   if(task.status!=='COMPLETE'||!benefitsReviewCurrent(task.response.benefitsReview,benefitsTerms(settings.onboarding_policy),today,task.response.benefitsElection,benefitPlans(settings.onboarding_policy)))throw new Error('Complete the current future-dated benefits review before using prior coverage.')
   const previous=await priorBenefitCoverage(db,facility,employee,task,paymentDate)
   if(previous){
    authorization=previous.data
    datedCoverage={revisionId:previous.revisionId,changeEffectiveOn:effective,currentReview:task.response.benefitsReview}
    if(task.response.benefitsDeductionWithdrawal?.authorizationRequestKey===authorization.saved?.requestKey&&authorization.saved)authorization={...authorization,status:'WITHDRAWN'}
   }else issues.push('Retain reconciled signed benefit coverage applicable to this earlier payment date.')
  }catch(error){issues.push(error.message)}
 }
 if(employee.employment_status!=='TERMINATED'||!validDay(employee.termination_date)||employee.termination_date>paymentDate||!periods.some(p=>p.started_on===employee.hire_date&&p.ended_on===employee.termination_date))issues.push('Reconcile the recorded separation and employment interval before reviewing final-pay benefit collection.')
 if(tasks.length!==1||!authorization.required||authorization.status!=='CURRENT')issues.push('Retain a current, separate employee-signed benefit deduction authorization for this employment cycle.')
 const proposal=authorization.proposal,month=paymentDate.slice(0,7),coverage=[]
 if(proposal){
  const signedDay=Number.isFinite(Date.parse(authorization.saved?.signedAt))?new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(authorization.saved.signedAt)):null
  if(!signedDay||paymentDate<signedDay||paymentDate<proposal.startOn)issues.push('Payment must follow the signed authorization and its coverage effective date.')
  if(proposal.items.some(i=>i.taxTreatment!=='POSTTAX'))issues.push('This review supports the existing signed posttax monthly contributions only.')
  const ledger=await benefitCoverageLedger(db,facility,month,{contributions:[]})
  for(const item of proposal.items){
   const row=ledger.rows.find(r=>r.employeeId===String(employeeId)&&r.onboardingCycle===task.onboarding_cycle&&r.planId===item.planId),review=row?.current
   if(row?.status!=='REVIEWED'||review?.review.disposition!=='COVERED'||review.review.coverageEnd<proposal.startOn)issues.push(`Retain current carrier coverage evidence for ${item.planName} in ${month}.`)
   coverage.push({planId:item.planId,planName:item.planName,monthlyCents:item.monthlyCents,sourceFingerprint:row?.sourceFingerprint||null,reviewId:review?.id||null,review:review?.review||null})
  }
 }
 const basis={version:1,facilityId:String(facility),employeeId:String(employeeId),paymentDate,month,employeeName:`${employee.legal_first_name} ${employee.legal_last_name}`,employmentStatus:employee.employment_status,hireDate:employee.hire_date,terminationDate:employee.termination_date,employmentPeriods:periods,onboardingCycle:task?.onboarding_cycle||null,authorization:authorization.saved,authorizationStatus:authorization.status,...(datedCoverage?{datedCoverage}:{}),monthlyCents:proposal?.monthlyCents||0,coverage,issues}
 return {...basis,fingerprint:hash(basis)}
}
export async function benefitContinuationState(db,facility,employeeId,paymentDate){
 const source=await benefitContinuationSource(db,facility,employeeId,paymentDate)
 const history=(await db.query('SELECT id,revision,source_fingerprint,review,created_at FROM payroll_benefit_continuation_review WHERE facility_id=$1 AND employee_id=$2 AND payment_date=$3 ORDER BY revision DESC',[facility,employeeId,paymentDate])).rows
 const latest=history[0]
 return {source,history,status:!latest?'NEEDS_REVIEW':latest.source_fingerprint!==source.fingerprint?'STALE':latest.review.disposition==='SUSPENDED'?'SUSPENDED':source.issues.length?'REVIEW_REQUIRED':'CURRENT'}
}
export async function requireBenefitContinuation(db,facility,employeeId,paymentDate,authorization){
 const state=await benefitContinuationState(db,facility,employeeId,paymentDate)
 if(state.status!=='CURRENT'||state.source.authorization?.requestKey!==authorization.requestKey||state.source.authorization?.proposalFingerprint!==authorization.proposalFingerprint)throw fail('Review the separated employee’s signed monthly benefit collection for this payment date in Reports & QuickBooks > Monthly benefit coverage.')
 return {reviewId:state.history[0].id,sourceFingerprint:state.source.fingerprint,paymentDate,monthlyCents:state.source.monthlyCents,coverage:state.source.coverage}
}
export function registerBenefitContinuation(app,pool){
 const base='/api/admin/payroll/employees/:employeeId/benefit-continuation'
 const endpoint=(write,work)=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');if(write)await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId]);const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review separated employee benefit collection.'})}finally{db.release()}}
 app.get(base,endpoint(false,(db,req)=>benefitContinuationState(db,req.canonicalAccess.facilityId,req.params.employeeId,req.query.paymentDate)))
 app.post(base,endpoint(true,async(db,req)=>{
  const b=req.body||{},facility=req.canonicalAccess.facilityId,employeeId=req.params.employeeId
  if(!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!validDay(b.paymentDate)||!['COLLECT_SIGNED_MONTHLY','SUSPENDED'].includes(b.disposition)||b.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<20||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm the dated collection decision, current revision and supporting review reference.',400)
  const review={disposition:b.disposition,reference:b.reference.trim()},digest=hash({employeeId,paymentDate:b.paymentDate,sourceFingerprint:b.sourceFingerprint,expectedRevision:b.expectedRevision,review})
  const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_benefit_continuation_review WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==digest)throw fail('This request key already belongs to different benefit collection evidence.');return {id:prior.id,reused:true}}
  const state=await benefitContinuationState(db,facility,employeeId,b.paymentDate)
  if(state.source.fingerprint!==b.sourceFingerprint||(state.history[0]?.revision||0)!==b.expectedRevision)throw fail('The benefit collection evidence or review changed. Reload before saving.')
  if(b.disposition==='COLLECT_SIGNED_MONTHLY'&&state.source.issues.length)throw fail(state.source.issues.join(' '))
  const id=randomUUID()
  await db.query('INSERT INTO payroll_benefit_continuation_review(id,facility_id,employee_id,payment_date,revision,source_fingerprint,source,review,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,facility,employeeId,b.paymentDate,b.expectedRevision+1,state.source.fingerprint,state.source,review,b.requestKey,digest,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'BENEFIT_CONTINUATION_REVIEWED','benefit_continuation_review',$3,$4)",[facility,req.adminId,id,{employeeId,paymentDate:b.paymentDate,review,sourceFingerprint:state.source.fingerprint}])
  return {id,reused:false}
 }))
}
