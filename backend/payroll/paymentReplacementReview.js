import {isDeepStrictEqual} from 'node:util'
import {replacementPredecessor} from './paymentReplacementPredecessor.js'
import {createHash} from 'node:crypto'
import {paymentAccountingEvidence} from './paymentAccounting.js'
import {employeePaymentReadiness} from './paymentReadiness.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
const reference=v=>typeof v==='string'&&v.trim().length>=12&&v.length<=1000&&!/[\u0000-\u001f\u007f]/.test(v)
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export async function paymentReplacementPlan(db,facility,runId){
 if(!Number.isSafeInteger(runId)||runId<=0)throw fail('Choose a payroll run.',400)
 const run=(await db.query('SELECT id,status FROM payroll_run WHERE facility_id=$1 AND id=$2',[facility,runId])).rows[0]
 if(!run)throw fail('Payroll run not found.',404)
 const rows=(await db.query(`SELECT i.*,i.payment_date::text AS original_payment_date,a.id AS attempt_id,e.legal_first_name,e.legal_last_name
  FROM payroll_payment_instruction i JOIN payroll_payment_dispatch_attempt a ON a.instruction_id=i.id
  JOIN payroll_employee e ON e.id=i.employee_id AND e.facility_id=i.facility_id
  WHERE i.facility_id=$1 AND i.payroll_run_id=$2 ORDER BY i.employee_id`,[facility,runId])).rows
 const items=[]
 for(const row of rows){
  const observations=(await db.query('SELECT id,source,result,created_at FROM payroll_payment_observation WHERE attempt_id=$1 ORDER BY id',[row.attempt_id])).rows
  if(!observations.some(o=>o.result?.status==='RETURNED'))continue
  const evidence=paymentAccountingEvidence(row,observations),latest=observations.at(-1),returned=evidence.events.find(e=>e.kind==='RETURN'),issues=[...evidence.issues]
  if(run.status!=='FINALIZED')issues.push('Finalize and reconcile the original payroll before this replacement review.')
  if(!returned||latest?.result?.status!=='RETURNED'||latest.result.returnEvidenceStatus!=='BANK_CREDIT_POSTED')issues.push('Recover the original payment and confirm its full returned bank credit.')
  if(Number(row.amount_cents)!==returned?.amountCents)issues.push('Returned funds do not match the full original net payment.')
  const prior=await replacementPredecessor(db,facility,row.id);issues.push(...prior.issues)
  const election=(await db.query("SELECT status,response FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='PAYMENT' ORDER BY id DESC LIMIT 1",[facility,row.employee_id])).rows[0]
  const method=election?.status==='COMPLETE'?election.response?.method:null
  if(!['CHECK','DIRECT_DEPOSIT'].includes(method))issues.push('Review the employee’s current payment choice.')
  const readiness=method==='DIRECT_DEPOSIT'?await employeePaymentReadiness(db,facility,Number(row.employee_id)):null
  const paymentIssues=readiness?.issue?[readiness.issue]:[]
  const history=(await db.query('SELECT id,review,basis_fingerprint,created_at,created_by FROM payroll_payment_replacement_review WHERE instruction_id=$1 AND facility_id=$2 ORDER BY id DESC',[row.id,facility])).rows
  const basis={...(prior.predecessor?{predecessor:prior.predecessor}:{}),instructionId:row.id,runId,employeeId:Number(row.employee_id),amountCents:Number(row.amount_cents),originalPaymentDate:row.original_payment_date,returnEvent:returned||null,returnCode:latest?.result?.returnEvidence?.code||null,bankEvidence:evidence.events,latestObservationId:Number(latest?.id||0),method,readiness,issues,paymentIssues}
  const hash=fingerprint(basis)
  items.push({...basis,employeeName:`${row.legal_first_name} ${row.legal_last_name}`,returnCode:latest?.result?.returnEvidence?.code||null,fingerprint:hash,revision:Number(history[0]?.id||0),history:history.map(h=>({id:Number(h.id),review:h.review,createdAt:h.created_at,createdBy:Number(h.created_by),current:h.basis_fingerprint===hash})),reviewStatus:history[0]?(history[0].basis_fingerprint===hash?history[0].review.taxTreatment==='CORRECTION_REQUIRED'?'TAX_CORRECTION_REQUIRED':'REVIEW_RETAINED':'REVIEW_CHANGED'):'REVIEW_REQUIRED',canReview:!issues.length,executionAvailable:false})
 }
 return {runId,items,executionAvailable:false}
}
export async function retainPaymentReplacementReview(pool,facility,runId,body,actorId){
 const db=await pool.connect()
 try{
  if(!uuid(body?.instructionId)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||body.confirmed!==true||body.noOtherPaymentConfirmed!==true||!date(body.replacementDate)||!['ORIGINAL_PAYROLL_RETAINED','CORRECTION_REQUIRED'].includes(body.taxTreatment)||!reference(body.reference)||!reference(body.taxReference))throw fail('Review the replacement date, unpaid amount and tax treatment; retain both references and confirmations.',400)
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const plan=await paymentReplacementPlan(db,facility,runId),item=plan.items.find(i=>i.instructionId===body.instructionId)
  if(!item)throw fail('Returned payment not found in this payroll run.',404)
  if(item.revision!==body.expectedRevision||item.fingerprint!==body.fingerprint||!item.canReview)throw fail('Payment evidence or the replacement review changed. Refresh before saving.')
  if(body.replacementDate<item.originalPaymentDate||body.replacementDate<item.returnEvent.postedDate||(item.predecessor?.returnEvent&&body.replacementDate<item.predecessor.returnEvent.postedDate))throw fail('Choose a replacement date on or after the original payment and posted return.',400)
  const review={version:1,replacementDate:body.replacementDate,method:item.method,amountCents:item.amountCents,taxTreatment:body.taxTreatment,reference:body.reference.trim(),taxReference:body.taxReference.trim(),noOtherPaymentConfirmed:true,confirmed:true}
  const basis={...(item.predecessor?{predecessor:item.predecessor}:{}),instructionId:item.instructionId,runId,employeeId:item.employeeId,amountCents:item.amountCents,originalPaymentDate:item.originalPaymentDate,returnEvent:item.returnEvent,returnCode:item.returnCode,bankEvidence:item.bankEvidence,latestObservationId:item.latestObservationId,method:item.method,readiness:item.readiness,issues:item.issues,paymentIssues:item.paymentIssues}
  const row=(await db.query('INSERT INTO payroll_payment_replacement_review(facility_id,payroll_run_id,employee_id,instruction_id,return_observation_id,basis,basis_fingerprint,review,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[facility,runId,item.employeeId,item.instructionId,item.returnEvent.observationId,basis,item.fingerprint,review,actorId])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'PAYMENT_REPLACEMENT_REVIEWED','payment_replacement_review',$3,$4)",[facility,actorId,String(row.id),{instructionId:item.instructionId,taxTreatment:review.taxTreatment,amountCents:item.amountCents}])
  await db.query('COMMIT');return {id:Number(row.id),status:review.taxTreatment==='CORRECTION_REQUIRED'?'TAX_CORRECTION_REQUIRED':'REVIEW_RETAINED',executionAvailable:false}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
export function registerPaymentReplacementReviewRoutes(app,pool){
 const path='/api/admin/payroll/runs/:id/payment-replacements'
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await paymentReplacementPlan(db,req.canonicalAccess.facilityId,Number(req.params.id));await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review returned payments.'})}finally{db.release()}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await retainPaymentReplacementReview(pool,req.canonicalAccess.facilityId,Number(req.params.id),req.body,req.adminId)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain replacement review.'})}})
}

// Wage-date review is required for returned payments even before a replacement
// review has been saved. Bank observation timestamps are excluded from the
// annual fingerprint so repeated identical provider checks remain stable.
export async function replacementAnnualEvidence(db,facility){
 const rows=(await db.query(`SELECT i.id,i.employee_id,i.payment_date::text AS original_date,v.result,q.id AS review_id,q.basis,q.review
  FROM payroll_payment_instruction i JOIN payroll_run r ON r.id=i.payroll_run_id AND r.facility_id=i.facility_id
  JOIN payroll_payment_dispatch_attempt a ON a.instruction_id=i.id
  JOIN LATERAL(SELECT result FROM payroll_payment_observation WHERE attempt_id=a.id ORDER BY id DESC LIMIT 1)v ON true
  LEFT JOIN LATERAL(SELECT id,basis,review FROM payroll_payment_replacement_review WHERE instruction_id=i.id AND facility_id=i.facility_id ORDER BY id DESC LIMIT 1)q ON true
  WHERE i.facility_id=$1 AND r.status='FINALIZED'
  AND (extract(year FROM i.payment_date)=2026 OR left(q.review->>'replacementDate',4)='2026')
  AND EXISTS(SELECT 1 FROM payroll_payment_observation WHERE attempt_id=a.id AND result->>'status'='RETURNED') ORDER BY i.employee_id,i.id`,[facility])).rows
 return Promise.all(rows.map(async row=>{
  const prior=await replacementPredecessor(db,facility,row.id)
  const returned=row.result?.returnEvidence,original=row.basis?.returnEvent,issues=[]
  if(!row.review)issues.push('Returned employee payment requires an unpaid-wage and tax-date review before annual approval.')
  if(prior.issues.length||!isDeepStrictEqual(prior.predecessor,row.basis?.predecessor||null))issues.push('Returned replacement requires a current unpaid-wage and tax-date review before annual approval.')
  if(row.review?.taxTreatment==='CORRECTION_REQUIRED')issues.push('Returned-payment replacement requires wage-date or tax-reporting correction review before annual approval.')
  if(row.result?.status!=='RETURNED'||row.result?.returnEvidenceStatus!=='BANK_CREDIT_POSTED'||row.result?.liveMode!==true||row.result?.dateMatches!==true||row.result?.externalId!==`vortex_payroll_${row.id}`)issues.push('Returned employee payment needs current bank reconciliation before annual approval.')
  else if(row.review&&(!original||original.transactionId!==returned?.transactionId||original.returnId!==returned?.returnId||original.postedDate!==returned?.postedDate||original.amountCents!==returned?.amountCents||original.providerId!==row.result.providerId||(row.basis.returnCode||null)!==(returned?.code||null)||!Array.isArray(original.lineItemIds)||original.lineItemIds.length!==1||original.lineItemIds[0]!==returned?.lineItemId))issues.push('Returned payment evidence changed after its tax-date review. Reconcile it before annual approval.')
  return {employeeId:Number(row.employee_id),instructionId:row.id,reviewId:row.review_id?Number(row.review_id):null,originalPaymentDate:row.original_date,replacementDate:row.review?.replacementDate||null,taxTreatment:row.review?.taxTreatment||null,bankState:{...(prior.predecessor?{predecessor:prior.predecessor}:{}),status:row.result?.status||null,returnEvidenceStatus:row.result?.returnEvidenceStatus||null,providerId:row.result?.providerId||null,returnEvidence:returned||null},issues}
 }))
}
