import {isDeepStrictEqual} from 'node:util'
import {createHash} from 'node:crypto'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const reference=v=>typeof v==='string'&&v.trim().length>=12&&v.length<=1000&&!/[\u0000-\u001f\u007f]/.test(v)
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
export async function checkReplacementPlan(db,facility,runId,batchId,employeeId,{requireFresh=true}={}){
 const row=(await db.query(`SELECT i.*,i.payment_date::text AS original_date,r.status AS run_status,s.id AS stop_id,d.delivery_date::text
  FROM payroll_check_issue i JOIN payroll_run r ON r.id=i.payroll_run_id AND r.facility_id=i.facility_id
  LEFT JOIN payroll_check_stop s ON s.issue_id=i.id LEFT JOIN payroll_check_delivery d ON d.issue_id=i.id
  WHERE i.facility_id=$1 AND i.payroll_run_id=$2 AND i.batch_id=$3 AND i.employee_id=$4`,[facility,runId,batchId,employeeId])).rows[0]
 if(!row)throw fail('Issued check not found.',404)
 const checks=(await db.query("SELECT source,result,created_at>=now()-interval '15 minutes' AS fresh FROM payroll_check_issue_observation WHERE issue_id=$1 ORDER BY id",[row.id])).rows
 const stops=(await db.query("SELECT source,result,created_at>=now()-interval '15 minutes' AS fresh FROM payroll_check_stop_observation WHERE stop_id=$1 ORDER BY id",[row.stop_id])).rows
 const check=checks.at(-1),stop=stops.at(-1),providerId=checks.find(o=>o.result?.providerId)?.result.providerId,actionId=(await db.query('SELECT payroll_check_stop_current_action($1) AS id',[row.stop_id])).rows[0].id,issues=[]
 if(!['APPROVED','FINALIZED'].includes(row.run_status))issues.push('Review the original approved or finalized payroll before replacement.')
 if(!providerId||check?.source!=='RECOVERY'||check.result?.status!=='STOPPED'||check.result.providerId!==providerId||check.result.dateMatches!==true||check.result.expiryMatches!==true||check.result.liveMode!==true)issues.push('Recover matching stopped-check evidence for the original payment.')
 if(!actionId||stop?.source!=='RECOVERY'||stop.result?.status!=='STOP_CONFIRMED'||stop.result.actionId!==actionId||stop.result.providerId!==providerId||stop.result.checkStatus!=='STOPPED')issues.push('Recover the original bank action confirming this check was stopped.')
 if(checks.some(o=>['COMPLETED','RETURNED','REVERSED'].includes(o.result?.status)||o.result?.settlementStatus==='BANK_POSTED'))issues.push('Paid, returned or reversed check history requires bank and wage remediation before replacement.')
 if(requireFresh&&(!check?.fresh||!stop?.fresh))issues.push('Recover the check and stop evidence within fifteen minutes.')
 const election=(await db.query("SELECT status,response FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='PAYMENT' ORDER BY id DESC LIMIT 1",[facility,employeeId])).rows[0]
 const method=election?.status==='COMPLETE'?election.response?.method:null
 if(!['CHECK','DIRECT_DEPOSIT'].includes(method))issues.push('Review the employee’s current payment choice.')
 const basis={issueId:row.id,stopId:row.stop_id,runId,batchId,employeeId,runStatus:row.run_status,amountCents:Number(row.amount_cents),originalPaymentDate:row.original_date,deliveryDate:row.delivery_date,method,check:check?{source:check.source,status:check.result?.status,providerId:check.result?.providerId,dateMatches:check.result?.dateMatches,expiryMatches:check.result?.expiryMatches,liveMode:check.result?.liveMode}:null,stop:stop?{source:stop.source,status:stop.result?.status,actionId:stop.result?.actionId,providerId:stop.result?.providerId,checkStatus:stop.result?.checkStatus}:null,paidHistory:checks.some(o=>['COMPLETED','RETURNED','REVERSED'].includes(o.result?.status)||o.result?.settlementStatus==='BANK_POSTED')}
 const fingerprint=hash(basis),history=(await db.query('SELECT id,basis_fingerprint,review,created_at FROM payroll_check_replacement_review WHERE issue_id=$1 ORDER BY id DESC',[row.id])).rows
 return {basis,issueId:row.id,runStatus:row.run_status,amountCents:basis.amountCents,originalPaymentDate:basis.originalPaymentDate,deliveryDate:basis.deliveryDate,method,issues,fingerprint,revision:Number(history[0]?.id||0),status:!history.length?'REVIEW_REQUIRED':history[0].basis_fingerprint!==fingerprint?'REVIEW_CHANGED':history[0].review.taxTreatment==='CORRECTION_REQUIRED'?'TAX_CORRECTION_REQUIRED':'REVIEW_RETAINED',history:history.map(r=>({id:Number(r.id),review:r.review,createdAt:r.created_at,current:r.basis_fingerprint===fingerprint})),canReview:issues.length===0,executionAvailable:false}
}
export async function retainCheckReplacementReview(pool,facility,runId,batchId,employeeId,body,{actorId,now=()=>new Date()}={}){
 if(body?.confirmed!==true||body.noOtherPaymentConfirmed!==true||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||!date(body.replacementDate)||!['ORIGINAL_PAYROLL_RETAINED','CORRECTION_REQUIRED'].includes(body.taxTreatment)||!reference(body.reference)||!reference(body.taxReference))throw fail('Review the unpaid check amount, replacement date and tax treatment, with both references and confirmations.',400)
 const db=await pool.connect()
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const plan=await checkReplacementPlan(db,facility,runId,batchId,employeeId)
  const review={version:1,replacementDate:body.replacementDate,taxTreatment:body.taxTreatment,reference:body.reference.trim(),taxReference:body.taxReference.trim(),amountCents:plan.amountCents,method:plan.method,noOtherPaymentConfirmed:true}
  if(plan.history[0]?.current&&isDeepStrictEqual(plan.history[0].review,review)){await db.query('COMMIT');return {id:plan.revision,reused:true,executionAvailable:false}}
  if(!plan.canReview||plan.revision!==body.expectedRevision||plan.fingerprint!==body.fingerprint)throw fail('Stopped-check evidence or the replacement review changed. Refresh before saving.')
  const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].timezone,today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
  const retainedPayment=(await db.query('SELECT 1 FROM payroll_check_replacement_authorization a JOIN payroll_check_replacement_claim t ON t.authorization_id=a.id WHERE a.issue_id=$1 AND a.payment_date=$2 AND a.method=$3 AND a.amount_cents=$4 AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_cancellation WHERE authorization_id=a.id)',[plan.issueId,body.replacementDate,plan.method,plan.amountCents])).rowCount>0
  if((body.replacementDate<today&&!retainedPayment)||body.replacementDate<plan.originalPaymentDate)throw fail('Choose a replacement date on or after today and the original pay date, or review the matching already-dispatched replacement.',400)
  const saved=(await db.query('INSERT INTO payroll_check_replacement_review(issue_id,basis,basis_fingerprint,review,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',[plan.issueId,plan.basis,plan.fingerprint,review,actorId])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_REPLACEMENT_REVIEWED','check_replacement_review',$3,$4)",[facility,actorId,String(saved.id),{issueId:plan.issueId,taxTreatment:review.taxTreatment,amountCents:plan.amountCents}])
  await db.query('COMMIT');return {id:Number(saved.id),reused:false,executionAvailable:false}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
export function registerCheckReplacementReviewRoutes(app,pool,dependencies){
 const path='/api/admin/payroll/runs/:id/payment-authorization/:batchId/checks/:employeeId/replacement-review'
 const scope=req=>{const ids=[req.params.id,req.params.batchId,req.params.employeeId].map(Number);if(!ids.every(v=>Number.isSafeInteger(v)&&v>0))throw fail('Choose an issued check.',400);return [req.canonicalAccess.facilityId,...ids]}
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{const ids=scope(req);await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const {basis,...data}=await checkReplacementPlan(db,...ids);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review check replacement.'})}finally{db.release()}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await retainCheckReplacementReview(pool,...scope(req),req.body,{...dependencies,actorId:req.adminId})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain check replacement review.'})}})
}
export async function checkReplacementAnnualEvidence(db,facility){
 const rows=(await db.query(`SELECT i.* FROM payroll_check_issue i JOIN payroll_run r ON r.id=i.payroll_run_id AND r.facility_id=i.facility_id WHERE i.facility_id=$1 AND r.status='FINALIZED' AND (extract(year FROM i.payment_date)=2026 OR (SELECT left(q.review->>'replacementDate',4) FROM payroll_check_replacement_review q WHERE q.issue_id=i.id ORDER BY id DESC LIMIT 1)='2026') AND (payroll_check_stop_blocks(i.id) OR EXISTS(SELECT 1 FROM payroll_check_issue_observation WHERE issue_id=i.id AND result->>'status'='STOPPED')) ORDER BY i.id`,[facility])).rows
 const result=[]
 for(const row of rows){const plan=await checkReplacementPlan(db,facility,Number(row.payroll_run_id),Number(row.batch_id),Number(row.employee_id),{requireFresh:false}),review=plan.history[0]?.review,issues=[...plan.issues]
  if(plan.status!=='REVIEW_RETAINED')issues.push('Stopped check requires a current unpaid-wage and tax-date review before annual approval.')
  if(review?.taxTreatment==='CORRECTION_REQUIRED')issues.push('Stopped check requires wage-date or tax correction before annual approval.')
  result.push({employeeId:Number(row.employee_id),instructionId:row.id,sourceKind:'CHECK',originalPaymentDate:plan.originalPaymentDate,replacementDate:review?.replacementDate||null,taxTreatment:review?.taxTreatment||null,reviewId:plan.revision||null,basisFingerprint:plan.fingerprint,issues})
 }
 return result
}
