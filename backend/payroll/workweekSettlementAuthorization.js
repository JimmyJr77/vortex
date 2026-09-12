import {compensationEvidence} from './employmentCompensation.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const response=row=>({id:Number(row.id),authorizedAt:new Date(row.created_at).toISOString(),...row.after_data.result})

export async function revalidateSettlementAuthorizations(db,facility,reviews){
 if(!reviews.length)return
 const records=(await db.query(`SELECT DISTINCT ON(entity_id,after_data->'input'->>'week') id,entity_id,created_at,after_data FROM payroll_audit_log
 WHERE facility_id=$1 AND entity_type='employee' AND entity_id=ANY($2::text[]) AND action='WORKWEEK_SETTLEMENT_AUTHORIZED'
 ORDER BY entity_id,after_data->'input'->>'week',id DESC`,[facility,[...new Set(reviews.map(r=>String(r.employeeId)))]] )).rows
 for(const review of reviews){
  const row=records.find(r=>String(r.entity_id)===String(review.employeeId)&&r.after_data.input.week===review.week)
  if(!row){review.settlementAuthorization={status:'MISSING'};continue}
  const current=review.paymentReconciliation
  const valid=row.after_data.result.version===1&&current?.status==='EVIDENCE_RECONCILED'&&current.fingerprint===row.after_data.input.fingerprint
  review.settlementAuthorization={...response(row),status:valid?'CURRENT':'STALE',historyCompletenessVerified:valid,requiresRevalidation:true,paymentApplied:false}
 }
}

export function registerWorkweekSettlementAuthorizationRoutes(app,pool,loadPreview){
 app.post('/api/admin/payroll/employees/:id/workweek-settlement-authorizations',async(req,res)=>{
  let db
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId
   const input={requestId:b.requestId,payPeriodId:Number(b.payPeriodId),week:b.week,fingerprint:b.fingerprint,reason:String(b.reason||'').trim(),historyComplete:b.historyComplete===true,confirmed:b.confirmed===true}
   if(!/^[a-zA-Z0-9-]{12,100}$/.test(input.requestId||'')||!Number.isSafeInteger(input.payPeriodId)||input.payPeriodId<=0||!/^\d{4}-\d{2}-\d{2}$/.test(input.week||'')||!/^[a-f0-9]{64}$/.test(input.fingerprint||'')||input.reason.length<20||input.reason.length>2000||!input.historyComplete||!input.confirmed)throw fail('Confirm complete payment history and the reviewed settlement with its current evidence reference and reason.',400)
   db=await pool.connect();await db.query('BEGIN')
   const settings=(await db.query('SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   const employee=(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!employee)throw fail('Employee not found.',404)
   const prior=(await db.query("SELECT id,created_at,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee' AND entity_id=$2 AND action='WORKWEEK_SETTLEMENT_AUTHORIZED' AND after_data->'input'->>'requestId'=$3 ORDER BY id DESC LIMIT 1",[facility,String(employee.id),input.requestId])).rows[0]
   if(prior){if(JSON.stringify(compensationEvidence(prior.after_data.input))!==JSON.stringify(compensationEvidence(input)))throw fail('This settlement reference was already used with different inputs.');await db.query('COMMIT');return res.json({success:true,data:response(prior)})}
   const data=await loadPreview(db,facility,input.payPeriodId)
   if(!data)throw fail('Payroll period not found.',404)
   const review=data.preview.employees.find(e=>Number(e.employeeId)===Number(employee.id))?.employmentWeekReviews?.find(w=>w.week===input.week)
   if(!review)throw fail('Reload the current hiring-boundary workweek review.')
   if(!settings||review.end>=settings.today)throw fail('Wait until the complete employer workweek has ended before authorizing its settlement.')
   const reconciliation=review.paymentReconciliation
   if(reconciliation?.status!=='EVIDENCE_RECONCILED')throw fail('Resolve allocation and payment evidence issues before authorizing settlement.')
   if(reconciliation.fingerprint!==input.fingerprint)throw fail('Allocation or payment evidence changed. Reload and review the current reconciliation.')
   const result={version:1,status:'AUTHORIZED_EVIDENCE',employeeId:Number(employee.id),week:input.week,fingerprint:input.fingerprint,allocationReviewId:review.allocationReview.id,reason:input.reason,historyCompletenessVerified:true,differences:reconciliation.differences,paymentApplied:false,requiresRevalidation:true}
   const row=(await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'WORKWEEK_SETTLEMENT_AUTHORIZED','employee',$3,$4) RETURNING id,created_at,after_data",[facility,req.adminId,String(employee.id),{input,review,result}])).rows[0]
   await db.query('COMMIT');res.status(201).json({success:true,data:response(row)})
  }catch(error){if(db)await db.query('ROLLBACK');res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to retain the settlement authorization.'})}finally{db?.release()}
 })
}
