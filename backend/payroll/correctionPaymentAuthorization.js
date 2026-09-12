import {correctionPaymentInput,correctionPaymentPreview} from './correctionPaymentPreview.js'
import {compensationEvidence} from './employmentCompensation.js'
const canonical=v=>JSON.stringify(compensationEvidence(JSON.parse(JSON.stringify(v))))
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const receipt=(row,settlement=null)=>({id:Number(row.id),authorizedAt:new Date(row.created_at).toISOString(),...row.after_data,paymentApplied:!!settlement,settlement})
async function settlements(db,facility,requestId){
 return (await db.query(`SELECT c.id,c.authorization_id,c.run_employee_id,c.effective_entry_id,c.plan->>'paymentDate' AS payment_date,r.id AS run_id,COALESCE(r.finalized_at,c.created_at) AS settled_at
  FROM payroll_correction_settlement c JOIN payroll_run_employee re ON re.id=c.run_employee_id JOIN payroll_run r ON r.id=re.payroll_run_id
  WHERE c.facility_id=$1 AND c.request_id=$2 AND r.status='FINALIZED'`,[facility,requestId])).rows.map(r=>({id:Number(r.id),authorizationId:Number(r.authorization_id),runId:Number(r.run_id),runEmployeeId:Number(r.run_employee_id),effectiveEntryId:Number(r.effective_entry_id),paymentDate:r.payment_date,settledAt:new Date(r.settled_at).toISOString()}))
}
export function registerCorrectionPaymentAuthorizationRoutes(app,pool,loadPreview){
 const path='/api/admin/payroll/requests/:requestId/payroll-correction-authorizations'
 app.post(path,async(req,res)=>{
  let db
  try{
   const b=req.body||{},payment=correctionPaymentInput(b),input={payment,requestKey:b.requestKey,fingerprint:b.fingerprint,reason:String(b.reason||'').trim(),confirmed:b.confirmed===true}
   if(typeof input.requestKey!=='string'||typeof input.fingerprint!=='string'||!/^[a-zA-Z0-9-]{12,100}$/.test(input.requestKey||'')||!/^[a-f0-9]{64}$/.test(input.fingerprint||'')||!input.confirmed||input.reason.length<20||input.reason.length>2000)throw fail('Confirm the reviewed payment and provide an authorization reason.',400)
   db=await pool.connect();await db.query('BEGIN')
   const facility=req.canonicalAccess.facilityId
   await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const request=(await db.query("SELECT * FROM payroll_employee_request WHERE facility_id=$1 AND id=$2 AND kind='TIME_CORRECTION' FOR UPDATE",[facility,req.params.requestId])).rows[0]
   if(!request)throw fail('Time correction request not found.',404)
   await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,request.employee_id])
   const previous=(await db.query("SELECT id,created_at,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee_request' AND entity_id=$2 AND action='CORRECTION_PAYMENT_AUTHORIZED' ORDER BY id DESC",[facility,String(request.id)])).rows
   const prior=previous.find(r=>r.after_data.input.requestKey===input.requestKey)
   if(prior){if(canonical(prior.after_data.input)!==canonical(input))throw fail('This authorization reference was already used with different inputs.');const settled=(await settlements(db,facility,request.id)).find(s=>s.authorizationId===Number(prior.id));await db.query('COMMIT');return res.json({success:true,data:receipt(prior,settled)})}
   await db.query('SAVEPOINT authorization_preview')
   const preview=await correctionPaymentPreview(db,facility,request,payment,loadPreview)
   await db.query('ROLLBACK TO SAVEPOINT authorization_preview')
   if(preview.fingerprint!==input.fingerprint)throw fail('Payment evidence changed. Review the current tax and leave preview before authorizing.')
   const data={version:1,input,preview,supersedesId:previous.length?Number(previous[0].id):null}
   const row=(await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CORRECTION_PAYMENT_AUTHORIZED','employee_request',$3,$4) RETURNING id,created_at,after_data",[facility,req.adminId,String(request.id),data])).rows[0]
   await db.query('COMMIT');res.status(201).json({success:true,data:receipt(row)})
  }catch(e){if(db)await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to authorize correction payment.'})}finally{db?.release()}
 })
 app.get(path,async(req,res)=>{
  let db
  try{
   db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
   const facility=req.canonicalAccess.facilityId,request=(await db.query("SELECT * FROM payroll_employee_request WHERE facility_id=$1 AND id=$2 AND kind='TIME_CORRECTION'",[facility,req.params.requestId])).rows[0]
   if(!request)throw fail('Time correction request not found.',404)
   const rows=(await db.query("SELECT id,created_at,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee_request' AND entity_id=$2 AND action='CORRECTION_PAYMENT_AUTHORIZED' ORDER BY id DESC",[facility,String(request.id)])).rows
   let current=null,issue=null,boundRun=null
   const paid=await settlements(db,facility,request.id)
   if(rows.length)boundRun=(await db.query("SELECT id,status FROM payroll_run WHERE facility_id=$1 AND pay_period_id=$2 AND run_kind='REGULAR' AND status='APPROVED' AND calculation_snapshot->'employees' @> $3::jsonb ORDER BY id DESC LIMIT 1",[facility,rows[0].after_data.input.payment.payPeriodId,JSON.stringify([{employeeId:Number(request.employee_id),correctionAuthorizations:[{authorizationId:Number(rows[0].id)}]}])])).rows[0]||null
   if(rows.length&&!paid.some(s=>s.authorizationId===Number(rows[0].id)))try{current=await correctionPaymentPreview(db,facility,request,rows[0].after_data.input.payment,loadPreview,boundRun?.id??null)}catch(e){if(!e.status)throw e;issue=e.message}
   const data=rows.map((row,index)=>{const settlement=paid.find(s=>s.authorizationId===Number(row.id));return {...receipt(row,settlement),status:settlement?'SETTLED':index?'SUPERSEDED':row.after_data.version===1&&current?.fingerprint===row.after_data.preview.fingerprint?'CURRENT':'STALE',issue:index||settlement?null:issue,payrollRun:settlement?{id:settlement.runId,status:'FINALIZED'}:index?null:boundRun}})
   await db.query('ROLLBACK');res.json({success:true,data})
  }catch(e){if(db)await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load correction authorizations.'})}finally{db?.release()}
 })
}
