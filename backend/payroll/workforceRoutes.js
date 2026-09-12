import {benefitContributionReport} from './benefitContributionReport.js'
import {recordPayrollAutomation} from './automationHistory.js'
import {benefitsDeductionProposal,signedBenefitsDeduction} from './benefitsDeductionAuthorization.js'
import {compensationEvidence} from './employmentCompensation.js'
import {benefitPlans,validateBenefitPlans} from './benefitCatalog.js'
import {benefitsElectionInput} from './benefitsElection.js'
import {validateBenefitsReview,benefitsReviewForEmployee} from './benefitsReview.js'
import {employeePaySetup} from './employeePaySetup.js'
import {employeeAcknowledgments} from './employeeAcknowledgments.js'
import {firstShiftReadiness} from './firstShiftReadiness.js'
import {onboardingDraft,handbookAcknowledgmentCurrent,wageAcknowledgmentCurrent,onboardingReviewIssues} from './onboarding.js'
import {timeCorrectionImpact,registerTimeCorrectionImpactRoutes} from './timeCorrectionImpact.js'
import {leaveAvailabilityAt} from './leaveAvailability.js'
import {assertEmploymentRange,assertEmploymentDateRange} from './employmentPeriods.js'
import {reservedPtoMinutes} from './leavePayout.js'
import {fixedSalaryMinimumCents} from './fixedSalaryAgreement.js'
import {salaryRowsAt} from './salaryChanges.js'
import {hiringPolicy} from './hiringPaySchedule.js'
import { runWorkforceAutomation } from './workforceAutomation.js'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { createPayrollToken, hashPayrollToken } from './employeeAuth.js'
import { payrollEmployeeAuth,lockPayrollEmployeeSession } from './employeeAuth.js'
import { ensureOnboarding, readiness, vaultReady, encryptDocument, decryptDocument, documentInput, validateResponse, wageNoticeTerms } from './onboarding.js'
import { calculateWorkedMinutes } from './payrollEngine.js'

const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const clean=(v,max=2000)=>String(v??'').trim().slice(0,max)
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const assertTaskCycle=(task,body)=>{if((task.onboarding_cycle>1||body?.onboardingCycle!==undefined)&&body?.onboardingCycle!==task.onboarding_cycle)throw fail('This onboarding cycle changed. Reload the checklist before submitting or reviewing this step.',409)}
function validateExpense(p) {
 if(!Number.isSafeInteger(p.amountCents)||p.amountCents<=0)throw fail('Enter a positive expense amount in whole cents.')
 if(typeof p.receiptReference!=='string'||p.receiptReference.trim().length<4||p.receiptReference.length>1000)throw fail('Provide a receipt reference between 4 and 1000 characters.')
 return {amountCents:p.amountCents,receiptReference:clean(p.receiptReference,1000)}
}
const scopedEmployee=async(db,facility,id)=>{const {rows}=await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,id]); if(!rows[0]) throw fail('Employee not found.',404); return rows[0]}
const log=async(db,ctx,action,type,id,data={})=>db.query(`INSERT INTO payroll_audit_log (facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES ($1,$2,$3,$4,$5,$6)`,[ctx.facility,ctx.admin||null,action,type,String(id),{employeeId:ctx.employee,...data}])
async function transaction(pool,res,work) {
 let db
 try { db=await pool.connect(); await db.query('BEGIN'); const data=await work(db); await db.query('COMMIT'); res.json({success:true,data}) }
 catch(e) { if(e.code==='23514'&&e.constraint?.startsWith('payroll_time_'))e.status=409; if(db) await db.query('ROLLBACK').catch(()=>{}); if(!e.status) console.error('[payroll-workforce]',e.code||e.message); res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to save payroll changes.'}) }
 finally {db?.release()}
}
async function leavePreview(db,ctx,query){
 await scopedEmployee(db,ctx.facility,ctx.employee)
 const {startDate,endDate,leaveType}=query
 if(!['PTO','MD_SICK_SAFE'].includes(leaveType))throw fail('Choose a paid leave bank.')
 await assertEmploymentDateRange(db,ctx.facility,ctx.employee,startDate,endDate)
 const reservedMinutes=leaveType==='PTO'?await reservedPtoMinutes(db,ctx.facility,ctx.employee):0
 const availableMinutes=await leaveAvailabilityAt(db,ctx.facility,ctx.employee,leaveType,startDate)-reservedMinutes
 return {startDate,endDate,leaveType,availableMinutes,reservedMinutes}
}
async function packet(db,facility,employeeId,admin=false) {
 const employee=(await salaryRowsAt(db,facility,[await scopedEmployee(db,facility,employeeId)]))[0]
 await ensureOnboarding(db,employee)
 const tasks=(await db.query(`SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 ORDER BY id`,[facility,employeeId])).rows
 const docs=(await db.query(`SELECT d.id,d.task_id,d.filename,d.mime_type,d.uploaded_at FROM payroll_private_document d JOIN payroll_onboarding_task t ON t.id=d.task_id AND t.onboarding_cycle=d.onboarding_cycle WHERE d.facility_id=$1 AND d.employee_id=$2 ORDER BY d.uploaded_at DESC`,[facility,employeeId])).rows
 const policy=await hiringPolicy(db,facility,employee)
 const asOfDate=(await db.query('SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].today
 const leaveBalances=(await db.query('SELECT DISTINCT leave_type FROM payroll_leave_transaction WHERE facility_id=$1 AND employee_id=$2 ORDER BY leave_type',[facility,employeeId])).rows
 const reserved=await reservedPtoMinutes(db,facility,employeeId)
 for(const row of leaveBalances){
  row.asOfDate=asOfDate
  row.minutes=await leaveAvailabilityAt(db,facility,employeeId,row.leave_type,asOfDate)
  if(row.leave_type==='PTO'){row.reservedMinutes=reserved;row.minutes-=reserved}
 }
 const requests=(await db.query(`SELECT * FROM payroll_employee_request WHERE facility_id=$1 AND employee_id=$2 ORDER BY created_at DESC LIMIT 100`,[facility,employeeId])).rows
 const firstShift=await firstShiftReadiness(db,facility,employee,tasks)
 const paySetup=await employeePaySetup(db,facility,employee,tasks)
 const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]
 const benefitsDeduction=benefitsDeductionProposal(employee,tasks.find(t=>t.task_key==='PAY_REVIEW'),settings,asOfDate)
 const ready=readiness(employee,tasks,policy)
 if(employee.employment_status==='ONBOARDING'&&firstShift.status==='NEEDS_REVIEW'){ready.ready=false;ready.complete=Math.max(0,ready.complete-1);ready.blockers.push('Review the current first shift and arrival details')}
 if(employee.employment_status==='ONBOARDING'&&paySetup.status==='NEEDS_REVIEW'){ready.ready=false;ready.complete=Math.max(0,ready.complete-1);ready.blockers.push('Review the current employee pay setup')}
 if(employee.employment_status==='ONBOARDING'&&benefitsDeduction.required&&benefitsDeduction.status!=='CURRENT'){ready.ready=false;ready.blockers.push('Sign the current benefit deduction authorization');if(paySetup.status==='CURRENT')ready.complete=Math.max(0,ready.complete-1)}
 return {benefitsDeduction,benefitPlans:benefitPlans(policy),benefitsElection:tasks.find(t=>t.task_key==='PAY_REVIEW')?.response?.benefitsElection||null,benefitsReview:admin?tasks.find(t=>t.task_key==='PAY_REVIEW')?.response?.benefitsReview||null:benefitsReviewForEmployee(tasks.find(t=>t.task_key==='PAY_REVIEW')?.response?.benefitsReview),paySetup:{paymentReadiness:paySetup.paymentReadiness?{status:paySetup.paymentReadiness.status,issue:paySetup.paymentReadiness.issue}:null,benefitsCurrent:paySetup.benefitsCurrent,status:paySetup.status,issues:paySetup.issues,fingerprint:paySetup.fingerprint,taxYear:paySetup.taxYear,paymentMethod:paySetup.paymentMethod},reviewIssues:onboardingReviewIssues(employee,tasks,policy),firstShift,wageTerms:wageNoticeTerms(employee,policy),leaveBalances,tasks:admin?tasks:tasks.map(t=>t.owner==='ADMIN'?{...t,response:{},reviewed_by:null}:t),documents:docs,requests,readiness:ready,policy,vaultReady:vaultReady()}
}
export function registerWorkforceAdminRoutes(app,pool) {
 registerTimeCorrectionImpactRoutes(app,pool)
 const context=req=>({facility:req.canonicalAccess.facilityId,admin:req.adminId,employee:Number(req.params.id)})
 app.post('/api/admin/payroll/automation/run',async(req,res)=>{try{res.json({success:true,data:await recordPayrollAutomation(pool,req.canonicalAccess.facilityId,'MANUAL',()=>runWorkforceAutomation(pool,req.canonicalAccess.facilityId))})}catch{res.status(500).json({success:false,message:'Workforce automation could not complete. Review the alerts and retry.'})}})
 app.get('/api/admin/payroll/employees/:id/leave-availability',(req,res)=>transaction(pool,res,async db=>{
  const ctx=context(req)
  await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility])
  return leavePreview(db,ctx,req.query)
 }))
 app.get('/api/admin/payroll/employees/:id/onboarding/:taskId/history',(req,res)=>transaction(pool,res,async db=>{
  const ctx=context(req)
  const task=(await db.query('SELECT id FROM payroll_onboarding_task WHERE id=$1 AND employee_id=$2 AND facility_id=$3',[req.params.taskId,ctx.employee,ctx.facility])).rows[0]
  if(!task)throw fail('Onboarding step not found.',404)
  return (await db.query('SELECT id,onboarding_cycle,event,snapshot,documents,recorded_at FROM payroll_onboarding_revision WHERE task_id=$1 AND employee_id=$2 AND facility_id=$3 ORDER BY id DESC',[task.id,ctx.employee,ctx.facility])).rows
 }))
 app.get('/api/admin/payroll/employees/:id/onboarding',(req,res)=>transaction(pool,res,db=>packet(db,context(req).facility,req.params.id,true)))
 app.get('/api/admin/payroll/workforce', (req,res)=>transaction(pool,res,async db=>{
  const f=context(req).facility
  const requests=(await db.query(`SELECT r.*,e.legal_first_name,e.legal_last_name FROM payroll_employee_request r JOIN payroll_employee e ON e.id=r.employee_id WHERE r.facility_id=$1 ORDER BY r.created_at DESC LIMIT 200`,[f])).rows
  const tasks=(await db.query(`SELECT t.*,e.legal_first_name,e.legal_last_name FROM payroll_onboarding_task t JOIN payroll_employee e ON e.id=t.employee_id WHERE t.facility_id=$1 ORDER BY t.due_date,t.id`,[f])).rows
  const audit=(await db.query(`SELECT id,action,entity_type,entity_id,actor_user_id,created_at FROM payroll_audit_log WHERE facility_id=$1 ORDER BY id DESC LIMIT 100`,[f])).rows
  return {requests,tasks,audit}
 }))
 app.patch('/api/admin/payroll/settings',(req,res)=>transaction(pool,res,async db=>{
  const f=context(req).facility, b=req.body||{}
  const before=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[f])).rows[0]
  if(!before) throw fail('Payroll settings not found.',404)
  const policy={...before.onboarding_policy}
  for(const k of ['businessPhone','handbookText','benefitsText','firstDayInstructions','paySchedule','payrollProviderUrl','sickLeavePay']) if(b[k]!==undefined) policy[k]=clean(b[k],20000)
  if(b.benefitPlans!==undefined){if(b.expectedBenefitCatalog!==(before.onboarding_policy?.benefitCatalog||''))throw fail('The benefit catalog changed. Reload employer setup before publishing.',409);if(typeof b.benefitsCatalogEvidence!=='string'||b.benefitsCatalogEvidence.trim().length<12||b.benefitsCatalogEvidence.length>2000)throw fail('Provide the reviewed plan and rate source.');if(b.benefitsCatalogConfirmed!==true)throw fail('Confirm the published plan terms, monthly contributions and tax treatment.');policy.benefitCatalog=JSON.stringify(validateBenefitPlans(b.benefitPlans))}
  if(policy.payrollProviderUrl) { let u; try{u=new URL(policy.payrollProviderUrl)}catch{throw fail('Use a valid HTTPS payroll provider URL.')}; if(u.protocol!=='https:'||u.username||u.password) throw fail('Use a valid HTTPS payroll provider URL.') }
  const values={}
  for(const [field,choices] of Object.entries({einStatus:['MISSING','OWNER_CONFIRMED','VERIFIED'],mdCrnStatus:['MISSING','APPLIED','ACTIVE'],mdUiStatus:['MISSING','APPLIED','ACTIVE'],workersCompStatus:['MISSING','QUOTING','ACTIVE']})) {
   const column=field.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()); values[field]=b[field]??before[column]; if(!choices.includes(values[field]))throw fail('Invalid employer registration status.')
  }
  const legal=clean(b.legalBusinessName??before.legal_business_name,200), address=clean(b.businessAddress??before.business_address,1000)
  if(!legal||!address)throw fail('Business name and address are required.')
  await db.query(`UPDATE payroll_settings SET legal_business_name=$2,business_address=$3,ein_status=$4,md_crn_status=$5,md_ui_status=$6,workers_comp_status=$7,onboarding_policy=$8,updated_at=now() WHERE facility_id=$1`,[f,legal,address,values.einStatus,values.mdCrnStatus,values.mdUiStatus,values.workersCompStatus,policy])
  await log(db,context(req),'SETTINGS_UPDATED','settings',f)
  if(b.benefitPlans!==undefined)await log(db,context(req),'BENEFIT_CATALOG_UPDATED','settings',f,{priorCatalog:before.onboarding_policy?.benefitCatalog||'',catalog:policy.benefitCatalog,evidence:b.benefitsCatalogEvidence.trim()})
  return {saved:true,benefitCatalog:policy.benefitCatalog||''}
 }))
 app.post('/api/admin/payroll/employees/:id/onboarding/:taskId/review',(req,res)=>transaction(pool,res,async db=>{
  const ctx=context(req); await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility]); const employee=await scopedEmployee(db,ctx.facility,ctx.employee)
  const task=(await db.query('SELECT * FROM payroll_onboarding_task WHERE id=$1 AND employee_id=$2 AND facility_id=$3 FOR UPDATE',[req.params.taskId,ctx.employee,ctx.facility])).rows[0]
  if(!task)throw fail('Onboarding step not found.',404)
  const status=req.body?.status, note=clean(req.body?.note,4000)
  assertTaskCycle(task,req.body)
  if(!['COMPLETE','CHANGES_REQUESTED','NOT_APPLICABLE'].includes(status)||!note)throw fail('A review decision and supporting note are required.')
  if(status==='COMPLETE'&&task.owner==='EMPLOYEE'&&task.status!=='SUBMITTED')throw fail('The employee must submit this step before approval.',409)
  if(status==='NOT_APPLICABLE'&&['PROFILE','W4','I9','I9_REVIEW','WAGE_NOTICE','PAYMENT','PAY_REVIEW'].includes(task.task_key))throw fail('This required onboarding step cannot be waived.')
  if(status==='COMPLETE'&&task.task_key==='WAGE_NOTICE'&&!wageAcknowledgmentCurrent(task.response,(await salaryRowsAt(db,ctx.facility,[employee]))[0],await hiringPolicy(db,ctx.facility,employee)))throw fail('Ask the employee to review and acknowledge the current hiring pay terms before completing this step.',409)
  if(status==='COMPLETE'&&task.task_key==='HANDBOOK'&&!handbookAcknowledgmentCurrent(task.response,await hiringPolicy(db,ctx.facility,employee)))throw fail('Ask the employee to review and acknowledge the current handbook and benefits terms before completing this step.',409)
  if(status==='COMPLETE'&&task.task_key==='PAY_REVIEW'&&employee.pay_type==='SALARY'&&(!employee.salary_review||employee.overtime_classification==='EXEMPT_REVIEW'))throw fail('Complete salary classification review before verifying pay setup.',409)
  if(status==='COMPLETE'&&task.task_key==='PAY_REVIEW'&&employee.pay_type==='SALARY'&&employee.overtime_classification==='NONEXEMPT'){try{if(Number(employee.annual_salary_cents)<fixedSalaryMinimumCents(employee.salary_review||{}))throw new Error('Raise salary to cover the applicable minimum wage before completing pay setup.')}catch(e){throw fail(e.message,409)}}
  let response=task.response
  if(status==='COMPLETE'&&task.task_key==='PAY_REVIEW'){
   const tasks=(await db.query('SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2',[ctx.facility,ctx.employee])).rows
   const setup=await employeePaySetup(db,ctx.facility,(await salaryRowsAt(db,ctx.facility,[employee]))[0],tasks)
   if(setup.issues.length)throw fail(setup.issues.join(' '),409)
   if(req.body.paySetupFingerprint!==setup.fingerprint)throw fail('Employee pay setup changed or was not reviewed. Reload the checklist before completing pay review.',409)
   response={...response,benefitsReview:validateBenefitsReview(req.body.benefitsReview,setup.basis.benefitsPolicy,setup.today,setup.basis.benefitsElection,setup.basis.benefitPlans),paySetup:{version:1,fingerprint:setup.fingerprint,basis:setup.basis}}
   if(response.benefitsReview.disposition==='ENROLLED_EMPLOYER_FUNDED'&&response.benefitsDeductionAuthorization)response.benefitsDeductionSupersededByFunding={authorizationRequestKey:response.benefitsDeductionAuthorization.requestKey,recordedAt:new Date().toISOString()}
  }
  if(status==='COMPLETE'&&task.task_key==='FIRST_SHIFT') {
   const firstShift=await firstShiftReadiness(db,ctx.facility,employee,[task])
   if(!firstShift.current)throw fail('Schedule the first shift before completing this step.',409)
   response={...response,firstShift:firstShift.current}
  }
  await db.query(`UPDATE payroll_onboarding_task SET status=$1,review_note=$2,reviewed_by=$3,completed_at=CASE WHEN $1 IN ('COMPLETE','NOT_APPLICABLE') THEN now() ELSE NULL END,updated_at=now(),response=$5 WHERE id=$4`,[status,note,ctx.admin,task.id,response])
  const column={W4:'w4_status',STATE_WITHHOLDING:'state_withholding_status',I9_REVIEW:'i9_status',PAYMENT:'direct_deposit_status'}[task.task_key]
  if(column) {
   const value=task.task_key==='PAYMENT'?(status==='COMPLETE'&&task.response.method==='DIRECT_DEPOSIT'?'INVITED':'NOT_CONFIGURED'):(status==='COMPLETE'?'COMPLETE':'MISSING')
   await db.query(`UPDATE payroll_employee SET ${column}=$1,updated_at=now() WHERE id=$2 AND facility_id=$3`,[value,ctx.employee,ctx.facility])
  }
  const docType={W4:'W4',STATE_WITHHOLDING:'STATE_WITHHOLDING',I9_REVIEW:'I9',PAYMENT:'DIRECT_DEPOSIT',WAGE_NOTICE:'WAGE_NOTICE'}[task.task_key]
  if(docType)await db.query(`UPDATE payroll_employee_document SET status=$1,notes=$2,completed_at=CASE WHEN $1='VERIFIED' THEN now() ELSE NULL END,updated_at=now() WHERE employee_id=$3 AND facility_id=$4 AND document_type=$5`,[status==='COMPLETE'?'VERIFIED':'REVERIFY',note,ctx.employee,ctx.facility,docType])
  await log(db,ctx,'ONBOARDING_REVIEW','onboarding_task',task.id,{status})
  return packet(db,ctx.facility,ctx.employee,true)
 }))
 app.post('/api/admin/payroll/employees/:id/activate',(req,res)=>transaction(pool,res,async db=>{
  const ctx=context(req); await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility]); const employee=await scopedEmployee(db,ctx.facility,ctx.employee)
  const data=await packet(db,ctx.facility,ctx.employee,true)
  if(employee.employment_status!=='ONBOARDING')throw fail('Only an onboarding employee can be activated.',409)
  if(!data.readiness.ready)throw fail(`Complete onboarding first: ${data.readiness.blockers.join(', ')}`,409)
  await db.query(`UPDATE payroll_employee SET employment_status='ACTIVE',onboarding_completed_at=now(),updated_at=now() WHERE id=$1 AND facility_id=$2`,[ctx.employee,ctx.facility])
  await log(db,ctx,'ONBOARDING_COMPLETED','employee',ctx.employee)
  return {activated:true}
 }))
 app.post('/api/admin/payroll/requests/:requestId/cancel-approved-leave',(req,res)=>transaction(pool,res,async db=>{
  const ctx=context(req),reason=clean(req.body?.reason)
  if(reason.length<12)throw fail('Provide a detailed reason for cancelling approved leave.')
  await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility])
  const request=(await db.query('SELECT * FROM payroll_employee_request WHERE facility_id=$1 AND id=$2 FOR UPDATE',[ctx.facility,req.params.requestId])).rows[0]
  if(!request)throw fail('Request not found.',404)
  ctx.employee=request.employee_id;await scopedEmployee(db,ctx.facility,ctx.employee)
  if(request.kind!=='LEAVE')throw fail('Select an approved leave request.',409)
  if(request.status==='CANCELLED'&&request.payload.cancellation?.reason===reason)return {cancelled:true,restoredMinutes:request.payload.cancellation.restoredMinutes}
  if(request.status!=='APPROVED')throw fail('Only approved leave can be cancelled here.',409)
  const today=(await db.query('SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0].today
  if(!validDate(request.payload.startDate)||request.payload.startDate<=today)throw fail('Leave starting today or earlier needs a payroll correction review because its start time is not recorded.',409)
  const locked=(await db.query(`SELECT id FROM payroll_run WHERE facility_id=$1 AND status IN ('APPROVED','FINALIZED') AND run_kind='REGULAR'
   AND pay_period_id IN(SELECT id FROM payroll_pay_period WHERE facility_id=$1 AND period_end>=$2::date) LIMIT 1`,[ctx.facility,request.payload.startDate])).rows
  if(locked.length)throw fail('Approved or finalized payroll may depend on this leave. Resolve that payroll before cancellation.',409)
  const debits=(await db.query('SELECT * FROM payroll_leave_transaction WHERE facility_id=$1 AND employee_id=$2 AND source_request_id=$3',[ctx.facility,ctx.employee,request.id])).rows
  const bank=['PTO','MD_SICK_SAFE'].includes(request.payload.leaveType)
  if(bank&&(debits.length!==1||Number(debits[0].minutes)!==-Number(request.payload.minutes)||debits[0].leave_type!==request.payload.leaveType||new Date(debits[0].transaction_date).toISOString().slice(0,10)!==request.payload.startDate))throw fail('Reconcile the approved leave debit before cancellation.',409)
  if(!bank&&debits.length)throw fail('Reconcile the unexpected leave debit before cancellation.',409)
  const paid=(await db.query('SELECT leave_date::text AS date,minutes FROM payroll_paid_leave WHERE facility_id=$1 AND employee_id=$2 AND request_id=$3',[ctx.facility,ctx.employee,request.id])).rows
  if(paid.some(row=>row.date<request.payload.startDate||row.date>request.payload.endDate)||paid.length&&paid.reduce((sum,row)=>sum+Number(row.minutes),0)!==Number(request.payload.minutes))throw fail('Reconcile the paid-leave allocation before cancellation.',409)
  let restoredMinutes=0,restorationId=null
  if(bank){
   const debit=debits[0]
   if(debit.leave_type==='MD_SICK_SAFE'&&(await db.query('SELECT id FROM payroll_leave_year_close WHERE facility_id=$1 AND make_date(opening_year,1,1)>$2::date LIMIT 1',[ctx.facility,debit.transaction_date])).rows.length)throw fail('The leave belongs to a closed leave year. Use a documented current-year correction.',409)
   restoredMinutes=-Number(debit.minutes)
   restorationId=(await db.query(`INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason,created_by,transaction_kind)
    VALUES($1,$2,$3,$4,$5,$6,$7,'RESTORATION') RETURNING id`,[ctx.facility,ctx.employee,debit.leave_type,debit.transaction_date,restoredMinutes,`Cancelled approved leave request ${request.id}: ${reason}`,ctx.admin])).rows[0].id
  }
  const cancellation={reason,restoredMinutes,restorationId,cancelledAt:new Date().toISOString()}
  await db.query("UPDATE payroll_employee_request SET status='CANCELLED',payload=payload||$1::jsonb WHERE id=$2",[{cancellation},request.id])
  await log(db,ctx,'APPROVED_LEAVE_CANCELLED','employee_request',request.id,{...cancellation,priorReview:{note:request.review_note,reviewedBy:request.reviewed_by,reviewedAt:request.reviewed_at}})
  return {cancelled:true,restoredMinutes}
 }))
 app.post('/api/admin/payroll/requests/:requestId/review',(req,res)=>transaction(pool,res,async db=>{
  const ctx=context(req), status=req.body?.status, note=clean(req.body?.note)
  if(!['APPROVED','DECLINED'].includes(status)||!note)throw fail('Choose a decision and provide a review note.')
  await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility])
  const request=(await db.query('SELECT * FROM payroll_employee_request WHERE id=$1 AND facility_id=$2 FOR UPDATE',[req.params.requestId,ctx.facility])).rows[0]
  if(!request)throw fail('Request not found.',404)
  if(request.status!=='PENDING')throw fail('This request has already been decided.',409)
  ctx.employee=request.employee_id
  const employee=await scopedEmployee(db,ctx.facility,ctx.employee)
  const p=request.payload
  if(status==='APPROVED'&&request.kind==='LEAVE')await assertEmploymentDateRange(db,ctx.facility,ctx.employee,p.startDate,p.endDate)
  if(status==='APPROVED'&&request.kind==='LEAVE'&&['MD_SICK_SAFE','PTO'].includes(p.leaveType)) {
   const balance=await leaveAvailabilityAt(db,ctx.facility,ctx.employee,p.leaveType,p.startDate)
   const reserved=p.leaveType==='PTO'?await reservedPtoMinutes(db,ctx.facility,ctx.employee):0
   if(Number(balance)-reserved<p.minutes)throw fail('Insufficient leave balance on the requested start date or after existing leave commitments. Review dated credits and approved leave, adjust the ledger with a reason, or decline this request.',409)
   await db.query(`INSERT INTO payroll_leave_transaction (facility_id,employee_id,leave_type,transaction_date,minutes,reason,created_by,source_request_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[ctx.facility,ctx.employee,p.leaveType,p.startDate,-p.minutes,`Approved request ${request.id}: ${note}`,ctx.admin,request.id])
   const policy=(await db.query('SELECT onboarding_policy FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0]?.onboarding_policy||{}
   if(p.leaveType==='PTO'||policy.sickLeavePay==='PAID') {
    const days=p.days?.length?p.days:p.startDate===p.endDate?[{date:p.startDate,minutes:p.minutes}]:[]
    if(!days.length)throw fail('Provide hours for each date of paid leave before approval.')
    const employee=await scopedEmployee(db,ctx.facility,ctx.employee)
    const salary=employee.pay_type==='SALARY'&&['EXEMPT','NONEXEMPT'].includes(employee.overtime_classification)&&employee.salary_review?.classification===employee.overtime_classification
    if(!salary&&(employee.pay_type!=='HOURLY'||Number(employee.hourly_rate_cents)<=0))throw fail('Paid leave needs verified hourly or salary pay configuration.')
    for(const day of days){
    const locked=await db.query(`SELECT r.id FROM payroll_run r JOIN payroll_pay_period pp ON pp.id=r.pay_period_id WHERE r.facility_id=$1 AND r.run_kind='REGULAR' AND r.status IN ('APPROVED','FINALIZED') AND $2::date BETWEEN pp.period_start AND pp.period_end LIMIT 1`,[ctx.facility,day.date])
    if(locked.rows.length)throw fail('Paid leave belongs to locked payroll. Handle it as a payroll correction.',409)
    await db.query(`INSERT INTO payroll_paid_leave (facility_id,employee_id,request_id,leave_date,minutes,hourly_rate_cents,included_in_salary) VALUES ($1,$2,$3,$4,$5,$6,$7)`,[ctx.facility,ctx.employee,request.id,day.date,day.minutes,salary?null:employee.hourly_rate_cents,salary])
    }
   }

  }
  if(status==='APPROVED'&&request.kind==='LEAVE') {
   const conflicts=(await db.query(`SELECT s.id FROM payroll_shift s JOIN payroll_settings ps ON ps.facility_id=s.facility_id WHERE s.facility_id=$1 AND s.employee_id=$2 AND s.status='SCHEDULED' AND (s.scheduled_start AT TIME ZONE ps.timezone)::date <= $4::date AND ((s.scheduled_end-interval '1 microsecond') AT TIME ZONE ps.timezone)::date >= $3::date`,[ctx.facility,ctx.employee,p.startDate,p.endDate])).rows
   if(conflicts.length && req.body?.cancelConflictingShifts!==true)throw fail('Scheduled shifts overlap this leave. Confirm cancellation of those shifts or update the schedule first.',409)
   if(conflicts.length) {
    await db.query(`UPDATE payroll_shift SET status='CANCELLED',updated_at=now() WHERE facility_id=$1 AND id=ANY($2::bigint[])`,[ctx.facility,conflicts.map(s=>s.id)])
    await log(db,ctx,'SHIFTS_CANCELLED_FOR_LEAVE','employee_request',request.id,{shiftIds:conflicts.map(s=>s.id)})
   }
  }
  if(status==='APPROVED'&&request.kind==='TIME_CORRECTION') {
   await assertEmploymentRange(db,ctx.facility,ctx.employee,p.clockIn,p.clockOut)
   const entry=(await db.query('SELECT * FROM payroll_time_entry WHERE id=$1 AND facility_id=$2 AND employee_id=$3 FOR UPDATE',[p.entryId,ctx.facility,ctx.employee])).rows[0]
   if(p.entryId&&!entry)throw fail('Time entry not found.',404)
   const impact=await timeCorrectionImpact(db,ctx.facility,ctx.employee,entry,p)
   if(impact.status==='PAYROLL_CORRECTION_REQUIRED')throw fail('This change affects committed payroll or imported wages. Review payroll impact and resolve it through a payroll correction.',409)
   const overlap=await db.query(`SELECT id FROM payroll_effective_time_entry WHERE facility_id=$1 AND employee_id=$2 AND ($3::bigint IS NULL OR id<>$3) AND status<>'REJECTED' AND clock_in<$5::timestamptz AND COALESCE(clock_out,'infinity'::timestamptz)>$4::timestamptz LIMIT 1`,[ctx.facility,ctx.employee,entry?.id||null,p.clockIn,p.clockOut])
   if(overlap.rows.length)throw fail('The requested time overlaps another time entry. Correct that entry first.',409)
   const evidence=`Employee correction request ${request.id}: ${p.reason}`
   if(entry)await db.query(`UPDATE payroll_time_entry SET clock_in=$1,clock_out=$2,unpaid_break_minutes=$3,status='EMPLOYEE_ATTESTED',employee_attested_at=now(),approved_by=NULL,approved_at=NULL,evidence_note=$4,updated_at=now() WHERE id=$5`,[p.clockIn,p.clockOut,p.unpaidBreakMinutes,evidence,entry.id])
   else await db.query(`INSERT INTO payroll_time_entry (facility_id,employee_id,clock_in,clock_out,unpaid_break_minutes,source,status,employee_attested_at,evidence_note,created_by) VALUES ($1,$2,$3,$4,$5,'RECONSTRUCTION','EMPLOYEE_ATTESTED',now(),$6,$7)`,[ctx.facility,ctx.employee,p.clockIn,p.clockOut,p.unpaidBreakMinutes,evidence,ctx.admin])
  }
  if(status==='APPROVED'&&request.kind==='EXPENSE') {
   validateExpense(p)
   if(req.body?.taxTreatmentVerified!==true)throw fail('Confirm reimbursement tax treatment before approval.')
   const period=(await db.query(`SELECT pp.*,pp.period_start::text AS start_date,pp.period_end::text AS end_date,pp.pay_date::text AS payment_date
    FROM payroll_pay_period pp JOIN payroll_settings s ON s.facility_id=pp.facility_id
    WHERE pp.facility_id=$1 AND pp.period_end >= GREATEST((now() AT TIME ZONE s.timezone)::date,$2::date) AND pp.status='OPEN'
    AND NOT EXISTS (SELECT 1 FROM payroll_run r WHERE r.facility_id=pp.facility_id AND r.pay_period_id=pp.id AND r.run_kind='REGULAR' AND r.status IN ('APPROVED','FINALIZED'))
    ORDER BY pp.period_end,pp.id LIMIT 1`,[ctx.facility,employee.hire_date])).rows[0]
   if(!period)throw fail('Generate an open upcoming pay period ending on or after the hire date, without approved or finalized payroll, before approving this expense.',409)
   await db.query(`INSERT INTO payroll_recurring_adjustment (facility_id,employee_id,kind,name,amount_cents,active_from,active_to,status,authorization_reference,tax_treatment_verified,created_by,source_request_id)
    VALUES ($1,$2,'REIMBURSEMENT',$3,$4,$5,$6,'ACTIVE',$7,true,$8,$9)`,[ctx.facility,ctx.employee,`Expense request ${request.id}`,p.amountCents,period.period_start,period.period_end,`${p.receiptReference}: ${note}`,ctx.admin,request.id])
   p.reimbursementPeriod={id:period.id,start:period.start_date,end:period.end_date,payDate:period.payment_date}
   await db.query('UPDATE payroll_employee_request SET payload=$1 WHERE id=$2',[p,request.id])
  }
  await db.query(`UPDATE payroll_employee_request SET status=$1,review_note=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4`,[status,note,ctx.admin,request.id])
  await log(db,ctx,'REQUEST_REVIEW','employee_request',request.id,{status,kind:request.kind,...(p.reimbursementPeriod?{reimbursementPeriod:p.reimbursementPeriod}:{})})
  return {saved:true}
 }))
 registerDownload(app,pool,'/api/admin/payroll/documents/:documentId',[],req=>({facility:req.canonicalAccess.facilityId,admin:req.adminId}))
}

export function registerWorkforceEmployeeRoutes(app,pool) {
 const auth=payrollEmployeeAuth(pool), context=req=>({facility:req.payrollEmployee.facility_id,employee:req.payrollEmployee.employee_id})
 const employeeTransaction=(req,res,work)=>transaction(pool,res,async db=>{const employee=await lockPayrollEmployeeSession(db,req.payrollEmployee,req);req.payrollEmployee.employment_status=employee.employment_status;return work(db)})
 const loginLimiter=rateLimit({windowMs:15*60*1000,max:20,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'Too many sign-in attempts. Try again in 15 minutes.'}})
 app.post('/api/payroll/employee/login',loginLimiter,(req,res)=>transaction(pool,res,async db=>{
  const email=clean(req.body?.email,320).toLowerCase(),password=String(req.body?.password||''),facility=Number(req.body?.facilityId||1)
  await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const employee=(await db.query(`SELECT id,facility_id,portal_password_hash FROM payroll_employee WHERE facility_id=$1 AND lower(personal_email)=$2 AND employment_status IN ('ONBOARDING','ACTIVE','LEAVE','TERMINATED') FOR UPDATE`,[facility,email])).rows[0]
  if(!employee?.portal_password_hash||!(await bcrypt.compare(password,employee.portal_password_hash)))throw fail('Email, password, or workplace number is incorrect.',401)
  const sessionToken=createPayrollToken()
  await db.query(`INSERT INTO payroll_employee_session (facility_id,employee_id,token_hash,expires_at) VALUES ($1,$2,$3,now()+interval '30 days')`,[facility,employee.id,hashPayrollToken(sessionToken)])
  await log(db,{facility,employee:employee.id},'EMPLOYEE_SIGNED_IN','employee',employee.id)
  return {sessionToken}
 }))
 app.post('/api/payroll/employee/access',auth,(req,res)=>employeeTransaction(req,res,async db=>{
  const ctx=context(req),password=String(req.body?.password||'')
  if(password.length<12||Buffer.byteLength(password,'utf8')>72)throw fail('Use a password with at least 12 characters and no more than 72 bytes.')
  await scopedEmployee(db,ctx.facility,ctx.employee)
  const hash=await bcrypt.hash(password,12)
  await db.query('UPDATE payroll_employee SET portal_password_hash=$1,updated_at=now() WHERE id=$2 AND facility_id=$3',[hash,ctx.employee,ctx.facility])
  await db.query('UPDATE payroll_employee_session SET revoked_at=now() WHERE employee_id=$1 AND facility_id=$2 AND id<>$3',[ctx.employee,ctx.facility,req.payrollEmployee.session_id])
  await log(db,ctx,'PORTAL_PASSWORD_SET','employee',ctx.employee)
  return {saved:true,facilityId:ctx.facility}
 }))

 app.get('/api/payroll/employee/benefit-contributions',auth,(req,res)=>employeeTransaction(req,res,async db=>{
  const {start,end}=req.query,ctx=context(req)
  if(!validDate(start)||!validDate(end)||end<start)throw fail('Valid start and end dates are required.')
  let rows
  try{rows=await benefitContributionReport(db,ctx.facility,start,end,ctx.employee)}catch(error){if(error.status===409)throw fail('Your benefit contributions need payroll review. Contact your hiring administrator.',409);throw error}
  res.setHeader('Cache-Control','no-store')
  return {start,end,contributions:rows.slice(1).map(row=>({paymentDate:row[0],month:row[1],planName:row[5],optionLabel:row[7],amountCents:Math.round(Number(row[8])*100),taxTreatment:row[9],runId:row[10]}))}
 }))
 app.get('/api/payroll/employee/leave-availability',auth,(req,res)=>employeeTransaction(req,res,db=>leavePreview(db,context(req),req.query)))
 app.get('/api/payroll/employee/onboarding/:taskId/acknowledgments',auth,(req,res)=>employeeTransaction(req,res,db=>employeeAcknowledgments(db,context(req).facility,context(req).employee,req.params.taskId,req.query.beforeId)))
 app.post('/api/payroll/employee/benefits-deduction-authorization/withdraw',auth,(req,res)=>employeeTransaction(req,res,async db=>{
  const ctx=context(req),b=req.body||{}
  await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility]);await scopedEmployee(db,ctx.facility,ctx.employee)
  const task=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='PAY_REVIEW' FOR UPDATE",[ctx.facility,ctx.employee])).rows[0]
  if(!task)throw fail('The deduction authorization was not found.',404)
  assertTaskCycle(task,b)
  if(b.confirmed!==true||typeof b.requestKey!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(b.requestKey))throw fail('Confirm withdrawal of the displayed deduction authorization.')
  const prior=task.response?.benefitsDeductionAuthorization,old=task.response?.benefitsDeductionWithdrawal
  if(!prior||b.authorizationRequestKey!==prior.requestKey)throw fail('The signed authorization changed. Refresh before withdrawing it.',409)
  if(old?.authorizationRequestKey===prior.requestKey)return packet(db,ctx.facility,ctx.employee)
  const withdrawal={requestKey:b.requestKey,authorizationRequestKey:prior.requestKey,recordedAt:(await db.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString()}
  await db.query('UPDATE payroll_onboarding_task SET response=response||$2::jsonb,updated_at=now() WHERE id=$1',[task.id,{benefitsDeductionWithdrawal:withdrawal}])
  await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Benefit deduction authorization withdrawn',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[ctx.facility,`benefit-deduction-authorization-${ctx.employee}`,`Employee ${ctx.employee} withdrew the signed benefit deduction authorization. Review benefit funding and any approved payroll in People & onboarding. Already submitted payments and completed deductions are not reversed.`])
  await log(db,ctx,'BENEFIT_DEDUCTION_WITHDRAWN','onboarding_task',task.id,withdrawal)
  return packet(db,ctx.facility,ctx.employee)
 }))
 app.post('/api/payroll/employee/benefits-deduction-authorization',auth,(req,res)=>employeeTransaction(req,res,async db=>{
  const ctx=context(req)
  const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility])).rows[0]
  const employee=await scopedEmployee(db,ctx.facility,ctx.employee)
  if(!['ONBOARDING','ACTIVE'].includes(employee.employment_status))throw fail('Benefit deduction changes require active employment or hiring.',409)
  const task=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='PAY_REVIEW' FOR UPDATE",[ctx.facility,ctx.employee])).rows[0]
  if(!task)throw fail('Hiring pay review is required.',409)
  assertTaskCycle(task,req.body)
  const today=(await db.query('SELECT (now() AT TIME ZONE $1)::date::text AS today',[settings.timezone])).rows[0].today
  const data=benefitsDeductionProposal(employee,task,settings,today)
  if(!data.required||!data.proposal)throw fail('Complete the current benefits enrollment review before signing a deduction authorization.',409)
  const signed=signedBenefitsDeduction(req.body||{},data.proposal),prior=task.response.benefitsDeductionAuthorization
  if(prior?.requestKey===signed.requestKey){if(task.response?.benefitsDeductionSupersededByFunding?.authorizationRequestKey===prior.requestKey)throw fail('Employer funding superseded this authorization. Refresh and sign the current terms again before employee deductions resume.',409);if(task.response?.benefitsDeductionWithdrawal?.authorizationRequestKey===prior.requestKey)throw fail('This authorization was withdrawn. Refresh and use a new signature request to authorize deductions again.',409);if(prior.proposalFingerprint!==signed.proposalFingerprint||prior.signature!==signed.signature)throw fail('This authorization request was already used with different details.',409);return packet(db,ctx.facility,ctx.employee)}
  if((await db.query("SELECT id FROM payroll_onboarding_revision WHERE task_id=$1 AND employee_id=$2 AND facility_id=$3 AND onboarding_cycle=$4 AND snapshot->'response'->'benefitsDeductionAuthorization'->>'requestKey'=$5 LIMIT 1",[task.id,ctx.employee,ctx.facility,task.onboarding_cycle,signed.requestKey])).rows.length)throw fail('This authorization was superseded. Refresh before signing again.',409)
  await db.query('UPDATE payroll_onboarding_task SET response=response||$2::jsonb,updated_at=now() WHERE id=$1',[task.id,{benefitsDeductionAuthorization:signed}])
  await log(db,ctx,'BENEFIT_DEDUCTION_AUTHORIZED','onboarding_task',task.id,{requestKey:signed.requestKey,proposalFingerprint:signed.proposalFingerprint})
  return packet(db,ctx.facility,ctx.employee)
 }))
 app.post('/api/payroll/employee/benefits-election',auth,(req,res)=>employeeTransaction(req,res,async db=>{
  const ctx=context(req)
  await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility])
  const employee=await scopedEmployee(db,ctx.facility,ctx.employee)
  if(!['ONBOARDING','ACTIVE'].includes(employee.employment_status))throw fail('Benefits changes require current employment or an active hiring record.',409)
  await ensureOnboarding(db,employee)
  const task=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='PAY_REVIEW' FOR UPDATE",[ctx.facility,ctx.employee])).rows[0]
  assertTaskCycle(task,req.body)
  const hiring=await hiringPolicy(db,ctx.facility,employee),policy=hiring.benefitsText||''
  const election=benefitsElectionInput(req.body||{},policy,benefitPlans(hiring)),prior=task.response?.benefitsElection
  if(prior?.submissionId===election.submissionId){
   if(Object.keys(election).some(key=>JSON.stringify(compensationEvidence(prior[key]))!==JSON.stringify(compensationEvidence(election[key]))))throw fail('This benefits submission was already used with different details.',409)
   return packet(db,ctx.facility,ctx.employee)
  }
  if((await db.query("SELECT id FROM payroll_onboarding_revision WHERE task_id=$1 AND employee_id=$2 AND facility_id=$3 AND onboarding_cycle=$4 AND snapshot->'response'->'benefitsElection'->>'submissionId'=$5 LIMIT 1",[task.id,ctx.employee,ctx.facility,task.onboarding_cycle,election.submissionId])).rows.length)throw fail('This benefits submission was superseded. Refresh before submitting a new choice.',409)
  election.submittedAt=new Date().toISOString()
  await db.query("UPDATE payroll_onboarding_task SET response=response||$2::jsonb,updated_at=now() WHERE id=$1",[task.id,{benefitsElection:election}])
  await log(db,ctx,'EMPLOYEE_BENEFITS_CHOICE_SUBMITTED','onboarding_task',task.id,{submissionId:election.submissionId,choice:election.choice})
  return packet(db,ctx.facility,ctx.employee)
 }))
 app.get('/api/payroll/employee/onboarding',auth,(req,res)=>employeeTransaction(req,res,db=>packet(db,context(req).facility,context(req).employee)))
 app.post('/api/payroll/employee/onboarding/:taskId/draft',auth,(req,res)=>employeeTransaction(req,res,async db=>{
  const ctx=context(req)
  await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility])
  await scopedEmployee(db,ctx.facility,ctx.employee)
  const task=(await db.query('SELECT * FROM payroll_onboarding_task WHERE id=$1 AND facility_id=$2 AND employee_id=$3 FOR UPDATE',[req.params.taskId,ctx.facility,ctx.employee])).rows[0]
  if(!task||task.owner!=='EMPLOYEE')throw fail('Employee onboarding step not found.',404)
  assertTaskCycle(task,req.body)
  if(!['OPEN','CHANGES_REQUESTED'].includes(task.status))throw fail('This step is already submitted or completed. Ask your hiring admin to reopen it before saving a draft.',409)
  let response;try{response=onboardingDraft(task.task_key,req.body||{})}catch(e){throw fail(e.message)}
  await db.query('UPDATE payroll_onboarding_task SET response=$1,updated_at=now() WHERE id=$2',[response,task.id])
  await log(db,ctx,'ONBOARDING_DRAFT_SAVED','onboarding_task',task.id)
  return packet(db,ctx.facility,ctx.employee)
 }))
 app.post('/api/payroll/employee/onboarding/:taskId',auth,(req,res)=>employeeTransaction(req,res,async db=>{
  const ctx=context(req); await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility]); const employee=await scopedEmployee(db,ctx.facility,ctx.employee)
  const task=(await db.query('SELECT * FROM payroll_onboarding_task WHERE id=$1 AND facility_id=$2 AND employee_id=$3 FOR UPDATE',[req.params.taskId,ctx.facility,ctx.employee])).rows[0]
  if(!task||task.owner!=='EMPLOYEE')throw fail('Employee onboarding step not found.',404)
  assertTaskCycle(task,req.body)
  if(['COMPLETE','NOT_APPLICABLE'].includes(task.status))throw fail('Ask your hiring admin to reopen this completed step.',409)
  const policy=await hiringPolicy(db,ctx.facility,employee)
  let response; try {response=validateResponse(task.task_key,req.body||{},(await salaryRowsAt(db,ctx.facility,[employee]))[0],policy)}catch(e){throw fail(e.message)}
  if(['W4','STATE_WITHHOLDING','I9'].includes(task.task_key)) {
   const docs=await db.query('SELECT id FROM payroll_private_document WHERE task_id=$1 AND employee_id=$2 AND facility_id=$3 AND onboarding_cycle=$4',[task.id,ctx.employee,ctx.facility,task.onboarding_cycle])
   if(!docs.rows.length&&!response.reference)throw fail('Upload the signed form or enter a secure provider receipt.')
  }
  if(task.task_key==='AVAILABILITY'&&!response.note)throw fail('Provide your availability and first-day questions.')
  if(task.task_key==='PROFILE')await db.query(`UPDATE payroll_employee SET legal_first_name=$1,legal_last_name=$2,phone=$3,updated_at=now() WHERE id=$4 AND facility_id=$5`,[response.legalFirstName,response.legalLastName,response.phone,ctx.employee,ctx.facility])
  await db.query(`UPDATE payroll_onboarding_task SET response=$1,status='SUBMITTED',submitted_at=now(),completed_at=NULL,updated_at=now() WHERE id=$2`,[response,task.id])
  await log(db,ctx,'ONBOARDING_SUBMITTED','onboarding_task',task.id)
  return packet(db,ctx.facility,ctx.employee)
 }))
 app.post('/api/payroll/employee/onboarding/:taskId/documents',auth,(req,res)=>employeeTransaction(req,res,async db=>{
  const ctx=context(req); await scopedEmployee(db,ctx.facility,ctx.employee)
  const task=(await db.query(`SELECT * FROM payroll_onboarding_task WHERE id=$1 AND facility_id=$2 AND employee_id=$3 FOR UPDATE`,[req.params.taskId,ctx.facility,ctx.employee])).rows[0]
  if(!task||task.owner!=='EMPLOYEE'||!['OPEN','SUBMITTED','CHANGES_REQUESTED'].includes(task.status))throw fail('This step cannot accept uploads.',409)
  assertTaskCycle(task,req.body)
  const input=documentInput(req.body||{}), encrypted=encryptDocument(input.bytes,`${ctx.facility}:${ctx.employee}:${task.id}`)
  const result=await db.query(`INSERT INTO payroll_private_document (facility_id,employee_id,task_id,filename,mime_type,encrypted_content,content_sha256,onboarding_cycle) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,filename`,[ctx.facility,ctx.employee,task.id,input.filename,input.mime,encrypted,input.hash,task.onboarding_cycle])
  await log(db,ctx,'DOCUMENT_UPLOADED','private_document',result.rows[0].id)
  return result.rows[0]
 }))
 app.post('/api/payroll/employee/requests',auth,(req,res)=>employeeTransaction(req,res,async db=>{
  const ctx=context(req),kind=req.body?.kind,p=req.body?.payload||{},payload={reason:clean(p.reason,4000)}
  await scopedEmployee(db,ctx.facility,ctx.employee)
  const requestKey=req.body?.requestKey
  if(requestKey!==undefined&&(typeof requestKey!=='string'||!/^[a-zA-Z0-9-]{12,100}$/.test(requestKey)))throw fail('Use a valid request submission key.')
  if(req.payrollEmployee.employment_status==='TERMINATED' && ['LEAVE','AVAILABILITY'].includes(kind))throw fail('Former employees can submit pay corrections, expenses, or general payroll questions.',403)
  if(!['LEAVE','TIME_CORRECTION','AVAILABILITY','EXPENSE','GENERAL'].includes(kind)||!payload.reason)throw fail('Choose a request type and provide details.')
  if(kind==='LEAVE') {
   if(!validDate(p.startDate)||!validDate(p.endDate)||p.endDate<p.startDate||!Number.isInteger(p.minutes)||p.minutes<=0||p.minutes>525600||!['MD_SICK_SAFE','UNPAID','PTO'].includes(p.leaveType))throw fail('Enter valid leave dates, type, and total minutes.')
   await assertEmploymentDateRange(db,ctx.facility,ctx.employee,p.startDate,p.endDate)
   const availableMinutes=(Math.round((Date.parse(p.endDate)-Date.parse(p.startDate))/86400000)+1)*1440
   if(p.minutes>availableMinutes)throw fail('Requested hours exceed the selected calendar dates.')
   Object.assign(payload,{startDate:p.startDate,endDate:p.endDate,minutes:p.minutes,leaveType:p.leaveType})
   if(p.days!==undefined){
    if(!Array.isArray(p.days)||!p.days.length||p.days.length>366||p.days.some(d=>!d||typeof d!=='object')||new Set(p.days.map(d=>d.date)).size!==p.days.length||p.days.some(d=>!validDate(d.date)||d.date<p.startDate||d.date>p.endDate||!Number.isInteger(d.minutes)||d.minutes<=0||d.minutes>1440)||p.days.reduce((n,d)=>n+d.minutes,0)!==p.minutes)throw fail('Daily leave hours must use distinct dates within the request and add up to the total hours.')
    payload.days=p.days.map(d=>({date:d.date,minutes:d.minutes}))
   }
  }
  if(kind==='TIME_CORRECTION') {
   const entry=(await db.query('SELECT id FROM payroll_effective_time_entry WHERE id=$1 AND facility_id=$2 AND employee_id=$3',[p.entryId,ctx.facility,ctx.employee])).rows[0]
   if(p.entryId&&!entry)throw fail('Choose one of your time entries.',404)
   try {calculateWorkedMinutes(p.clockIn,p.clockOut,p.unpaidBreakMinutes)} catch(e) {throw fail(e.message)}
   Object.assign(payload,{entryId:entry?.id||null,clockIn:new Date(p.clockIn).toISOString(),clockOut:new Date(p.clockOut).toISOString(),unpaidBreakMinutes:Number(p.unpaidBreakMinutes??0)})
  }
  if(kind==='EXPENSE')Object.assign(payload,validateExpense(p))
  if(requestKey){
   const prior=(await db.query(`SELECT r.*,a.after_data->'payload'=$4::jsonb AND a.after_data->>'kind'=$5 AS same_submission
    FROM payroll_audit_log a JOIN payroll_employee_request r ON r.id::text=a.entity_id AND r.facility_id=a.facility_id
    WHERE a.facility_id=$1 AND r.employee_id=$2 AND a.action='REQUEST_SUBMITTED' AND a.entity_type='employee_request'
    AND a.after_data->>'requestKey'=$3 ORDER BY a.id LIMIT 1`,[ctx.facility,ctx.employee,requestKey,payload,kind])).rows[0]
   if(prior){if(!prior.same_submission)throw fail('This submission key was already used for different request details.',409);delete prior.same_submission;return prior}
  }
  const result=await db.query(`INSERT INTO payroll_employee_request (facility_id,employee_id,kind,payload) VALUES ($1,$2,$3,$4) RETURNING *`,[ctx.facility,ctx.employee,kind,payload])
  await log(db,ctx,'REQUEST_SUBMITTED','employee_request',result.rows[0].id,{kind,...(requestKey?{requestKey,payload}:{})})
  return result.rows[0]
 }))
 app.post('/api/payroll/employee/requests/:requestId/cancel',auth,(req,res)=>employeeTransaction(req,res,async db=>{
  const ctx=context(req),result=await db.query(`UPDATE payroll_employee_request SET status='CANCELLED' WHERE id=$1 AND facility_id=$2 AND employee_id=$3 AND status='PENDING' RETURNING id`,[req.params.requestId,ctx.facility,ctx.employee])
  if(!result.rows.length)throw fail('Only your pending request can be cancelled.',409)
  await log(db,ctx,'REQUEST_CANCELLED','employee_request',req.params.requestId)
  return {cancelled:true}
 }))
 registerDownload(app,pool,'/api/payroll/employee/documents/:documentId',[auth],context)
}
function registerDownload(app,pool,path,middleware,context) {
 app.get(path,...middleware,async(req,res)=>{
  const ctx=context(req)
  try {
   const params=[req.params.documentId,ctx.facility]; if(ctx.employee)params.push(ctx.employee)
   const row=(await pool.query(`SELECT * FROM payroll_private_document WHERE id=$1 AND facility_id=$2${ctx.employee?' AND employee_id=$3':''}`,params)).rows[0]
   if(!row)return res.status(404).json({success:false,message:'Document not found.'})
   const bytes=decryptDocument(row.encrypted_content,`${row.facility_id}:${row.employee_id}:${row.task_id}`)
   await log(pool,ctx,'DOCUMENT_DOWNLOADED','private_document',row.id)
   res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type',row.mime_type);res.setHeader('Content-Disposition',`attachment; filename="${row.filename}"`);res.send(bytes)
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retrieve document.'})}
 })
}
