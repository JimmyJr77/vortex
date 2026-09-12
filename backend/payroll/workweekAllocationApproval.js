import {compensationEvidence} from './employmentCompensation.js'
import {previewWorkweekAllocation} from './workweekAllocation.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const response=row=>({id:Number(row.id),reviewedAt:row.created_at,...row.after_data.result})
export async function revalidateWorkweekAllocations(db,facility,reviews){
 if(!reviews.length)return
 const ids=[...new Set(reviews.map(r=>String(r.employeeId)))]
 const records=(await db.query(`SELECT DISTINCT ON(entity_id,after_data->'input'->>'week') id,entity_id,created_at,after_data
  FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee' AND entity_id=ANY($2::text[])
   AND action='WORKWEEK_ALLOCATION_REVIEWED'
  ORDER BY entity_id,after_data->'input'->>'week',id DESC`,[facility,ids])).rows
 for(const review of reviews){
  const record=records.find(r=>Number(r.entity_id)===review.employeeId&&r.after_data.input.week===review.week)
  if(!record){review.allocationReview={status:'MISSING',issues:['Retain a reviewed salary allocation for this workweek.']};continue}
  const saved=record.after_data.result
  const state={id:Number(record.id),reviewedAt:new Date(record.created_at).toISOString(),status:'STALE',issues:[],paymentApplied:false}
  try{
   if(saved.version!==5)throw fail('Recalculate and retain this earlier-version allocation with current evidence.')
   const current=previewWorkweekAllocation(review,record.after_data.input.salaryAllocations)
   if(current.fingerprint!==saved.fingerprint)throw fail('Hours, agreements or salary allocation evidence changed after this review. Recalculate and retain a new review.')
   state.status='CURRENT';state.fingerprint=current.fingerprint;state.calculation=current.calculation;state.coverage=current.coverage;state.paidLeave=current.paidLeave;state.leaveEarnings=current.leaveEarnings
  }catch(error){state.issues.push(error.message)}
  review.allocationReview=state
 }
}
export function registerWorkweekAllocationApprovalRoutes(app,pool,loadPreview){
 app.post('/api/admin/payroll/employees/:id/workweek-allocations',async(req,res)=>{
  let db
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId
   const input={requestId:b.requestId,payPeriodId:Number(b.payPeriodId),week:b.week,fingerprint:b.fingerprint,salaryAllocations:Array.isArray(b.salaryAllocations)?b.salaryAllocations.map(a=>a&&({employmentStart:a.employmentStart,earningsCents:a.earningsCents,source:String(a.source||'').trim()})):null,reason:String(b.reason||'').trim()}
   if(!/^[a-zA-Z0-9-]{12,100}$/.test(input.requestId||'')||!Number.isSafeInteger(input.payPeriodId)||input.payPeriodId<=0||!/^\d{4}-\d{2}-\d{2}$/.test(input.week||'')||!/^[a-f0-9]{64}$/.test(input.fingerprint||'')||input.reason.length<20||input.reason.length>2000||b.confirmed!==true)throw fail('Confirm the documented allocation with its preview reference and review reason.',400)
   db=await pool.connect();await db.query('BEGIN')
   const settings=(await db.query('SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   const employee=(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!employee)throw fail('Employee not found.',404)
   const prior=(await db.query("SELECT id,created_at,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee' AND entity_id=$2 AND action='WORKWEEK_ALLOCATION_REVIEWED' AND after_data->'input'->>'requestId'=$3 ORDER BY id DESC LIMIT 1",[facility,String(employee.id),input.requestId])).rows[0]
   if(prior){if(JSON.stringify(compensationEvidence(prior.after_data.input))!==JSON.stringify(compensationEvidence(input)))throw fail('This review reference was already used with different inputs.');await db.query('COMMIT');return res.json({success:true,data:response(prior)})}
   const data=await loadPreview(db,facility,input.payPeriodId)
   if(!data)throw fail('Payroll period not found.',404)
   const review=data.preview.employees.find(e=>Number(e.employeeId)===Number(employee.id))?.employmentWeekReviews?.find(w=>w.week===input.week)
   if(!review)throw fail('Reload the current hiring-boundary workweek review.')
   if(review.end>=settings.today)throw fail('Wait until the complete employer workweek has ended before saving its allocation review.')
   const preview=previewWorkweekAllocation(review,input.salaryAllocations)
   if(preview.fingerprint!==input.fingerprint)throw fail('Workweek evidence changed. Recalculate and review the current allocation.')
   const result={...preview,status:'REVIEWED_ALLOCATION',reason:input.reason,paymentApplied:false,requiresRevalidation:true,reviewRequired:'Allocation review is retained. Revalidate current evidence and reconcile paid earnings and premiums before authorizing settlement.'}
   const row=(await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'WORKWEEK_ALLOCATION_REVIEWED','employee',$3,$4) RETURNING id,created_at,after_data",[facility,req.adminId,String(employee.id),{input,review,result}])).rows[0]
   await db.query('COMMIT');res.status(201).json({success:true,data:response(row)})
  }catch(error){if(db)await db.query('ROLLBACK');res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to retain the allocation review.'})}finally{db?.release()}
 })
 app.get('/api/admin/payroll/employees/:id/workweek-allocations',async(req,res)=>{
  try{
   const facility=req.canonicalAccess.facilityId
   if(!(await pool.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,req.params.id])).rows.length)return res.status(404).json({success:false,message:'Employee not found.'})
   const rows=(await pool.query("SELECT id,created_at,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee' AND entity_id=$2 AND action='WORKWEEK_ALLOCATION_REVIEWED' ORDER BY id DESC",[facility,String(req.params.id)])).rows
   res.json({success:true,data:rows.map(response)})
  }catch{res.status(500).json({success:false,message:'Unable to load allocation reviews.'})}
 })
}
