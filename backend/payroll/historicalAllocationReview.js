import {compensationEvidence} from './employmentCompensation.js'
import {previewHistoricalAllocation} from './historicalAllocationPreview.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const response=row=>({id:Number(row.id),reviewedAt:new Date(row.created_at).toISOString(),...row.after_data.result})
const path='/api/admin/payroll/employees/:id/historical-payments/:paymentId/allocations'
export function registerHistoricalAllocationReviewRoutes(app,pool,loadPreview){
 app.get(path,async(req,res)=>{
  try{
   const facility=req.canonicalAccess.facilityId
   const payment=(await pool.query('SELECT id FROM payroll_historical_payment WHERE facility_id=$1 AND employee_id=$2 AND id=$3',[facility,req.params.id,req.params.paymentId])).rows[0]
   if(!payment)throw fail('Historical payment not found.',404)
   const rows=(await pool.query("SELECT id,created_at,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee' AND entity_id=$2 AND action='HISTORICAL_ALLOCATION_REVIEWED' AND after_data->'input'->>'paymentId'=$3 ORDER BY id DESC",[facility,String(req.params.id),String(payment.id)])).rows
   res.json({success:true,data:rows.map(response)})
  }catch(error){res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to load imported allocation reviews.'})}
 })
 app.post(path,async(req,res)=>{
  let db
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId
   const input={requestId:b.requestId,paymentId:Number(req.params.paymentId),payPeriodId:Number(b.payPeriodId),fingerprint:b.fingerprint,reason:String(b.reason||'').trim(),sourceConfirmed:b.sourceConfirmed===true,confirmed:b.confirmed===true}
   if(!/^[a-zA-Z0-9-]{12,100}$/.test(input.requestId||'')||![input.paymentId,input.payPeriodId].every(n=>Number.isSafeInteger(n)&&n>0)||!/^[a-f0-9]{64}$/.test(input.fingerprint||'')||input.reason.length<20||input.reason.length>2000||!input.sourceConfirmed||!input.confirmed)throw fail('Confirm the wage-only source and dated allocation with a current evidence reference and review reason.',400)
   db=await pool.connect();await db.query('BEGIN')
   const settings=(await db.query('SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   const employee=(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!employee)throw fail('Employee not found.',404)
   const payment=(await db.query('SELECT * FROM payroll_historical_payment WHERE facility_id=$1 AND employee_id=$2 AND id=$3 FOR UPDATE',[facility,employee.id,input.paymentId])).rows[0]
   if(!payment)throw fail('Historical payment not found.',404)
   const prior=(await db.query("SELECT id,created_at,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee' AND entity_id=$2 AND action='HISTORICAL_ALLOCATION_REVIEWED' AND after_data->'input'->>'requestId'=$3 ORDER BY id DESC LIMIT 1",[facility,String(employee.id),input.requestId])).rows[0]
   if(prior){if(JSON.stringify(compensationEvidence(prior.after_data.input))!==JSON.stringify(compensationEvidence(input)))throw fail('This imported allocation reference was already used with different inputs.');await db.query('COMMIT');return res.json({success:true,data:response(prior)})}
   const data=await loadPreview(db,facility,input.payPeriodId)
   if(!data)throw fail('Payroll period not found.',404)
   if(!settings)throw fail('Save employer payroll settings before reviewing imported payments.')
   const reviews=data.preview.employees.find(e=>Number(e.employeeId)===Number(employee.id))?.employmentWeekReviews||[]
   const draft=previewHistoricalAllocation(payment,reviews,data.period,settings.today)
   if(draft.fingerprint!==input.fingerprint)throw fail('Source payment or workweek evidence changed. Calculate and review a fresh imported allocation.')
   const result={...draft,status:'REVIEWED_IMPORTED_ALLOCATION',reason:input.reason,sourceConfirmed:true,requiresRevalidation:true,reviewRequired:'Retained source review. Current evidence must be revalidated before this can count as paid coverage.'}
   const row=(await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'HISTORICAL_ALLOCATION_REVIEWED','employee',$3,$4) RETURNING id,created_at,after_data",[facility,req.adminId,String(employee.id),{input,result}])).rows[0]
   await db.query('COMMIT');res.status(201).json({success:true,data:response(row)})
  }catch(error){if(db)await db.query('ROLLBACK');res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to retain imported allocation review.'})}finally{db?.release()}
 })
}
