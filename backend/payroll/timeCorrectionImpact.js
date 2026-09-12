import {compensationEvidence} from './employmentCompensation.js'
import {createHash} from 'node:crypto'
import {calculateWorkedMinutes,workweekStartFor} from './payrollEngine.js'
const iso=v=>v?new Date(v).toISOString():null
const weekEnd=w=>new Date(Date.parse(w)+6*86400000).toISOString().slice(0,10)
export async function timeCorrectionImpact(db,facility,employeeId,original,proposed,excludedRunId=null){
 const settings=(await db.query('SELECT timezone,workweek_starts_on FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]
 if(!settings)throw Object.assign(new Error('Complete employer payroll settings before reviewing corrections.'),{status:409})
 const minutes=calculateWorkedMinutes(proposed.clockIn,proposed.clockOut,proposed.unpaidBreakMinutes)
 const intervals=[{clockIn:proposed.clockIn,clockOut:proposed.clockOut},...(original?[{clockIn:original.clock_in,clockOut:original.clock_out||new Date()}]:[])]
 const scopes=[...new Map(intervals.map(i=>{const first=workweekStartFor(i.clockIn,settings.workweek_starts_on,settings.timezone),last=weekEnd(workweekStartFor(new Date(new Date(i.clockOut).valueOf()-1),settings.workweek_starts_on,settings.timezone));return [`${first}/${last}`,{first,last}]})).values()]
 const runs=(await db.query(`SELECT DISTINCT r.id,r.status,r.run_kind,r.pay_period_id,p.period_start,p.period_end,COALESCE(r.payment_date,p.pay_date) AS payment_date,
 to_jsonb(re) AS payment_record,(SELECT e FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.calculation_snapshot->'employees')='array' THEN r.calculation_snapshot->'employees' ELSE '[]'::jsonb END) e WHERE e->>'employeeId'=re.employee_id::text) AS frozen_employee,
 re.regular_pay_cents,re.overtime_pay_cents,re.other_taxable_pay_cents,re.net_pay_cents
 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
 CROSS JOIN jsonb_to_recordset($3::jsonb) AS scope(first text,last text)
 WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.status IN ('APPROVED','FINALIZED') AND r.id<>COALESCE($4::bigint,0) AND
 ((r.run_kind='REGULAR' AND p.period_start<=scope.last::date AND p.period_end>=scope.first::date)
 OR jsonb_path_exists(COALESCE(re.statement_snapshot->'payItems',(SELECT e->'payItems' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.calculation_snapshot->'employees')='array' THEN r.calculation_snapshot->'employees' ELSE '[]'::jsonb END) e WHERE e->>'employeeId'=re.employee_id::text),'[]'::jsonb),'$[*].bonusAllocation.weeks[*] ? (@.week >= $first && @.week <= $last)',jsonb_build_object('first',scope.first,'last',scope.last))) ORDER BY r.id`,[facility,employeeId,JSON.stringify(scopes),excludedRunId])).rows
 const historicalPayments=(await db.query(`SELECT DISTINCT p.id,p.period_start,p.period_end,p.payment_date,p.gross_amount_cents,p.reference,to_jsonb(p) AS payment_record FROM payroll_historical_payment p
 CROSS JOIN jsonb_to_recordset($3::jsonb) AS scope(first text,last text)
 WHERE p.facility_id=$1 AND p.employee_id=$2 AND p.period_start<=scope.last::date AND p.period_end>=scope.first::date ORDER BY p.id`,[facility,employeeId,JSON.stringify(scopes)])).rows
 const source={employeeId:Number(employeeId),timezone:settings.timezone,scopes,original:original?{id:Number(original.id),clockIn:iso(original.clock_in),clockOut:iso(original.clock_out),unpaidBreakMinutes:Number(original.unpaid_break_minutes),status:original.status}:null,proposed:{clockIn:iso(proposed.clockIn),clockOut:iso(proposed.clockOut),unpaidBreakMinutes:Number(proposed.unpaidBreakMinutes||0),workedMinutes:minutes},runs,historicalPayments}
 return {...source,status:runs.length||historicalPayments.length?'PAYROLL_CORRECTION_REQUIRED':'TIMESHEET_REVIEW',fingerprint:createHash('sha256').update(JSON.stringify(compensationEvidence(JSON.parse(JSON.stringify(source))))).digest('hex'),paymentApplied:false}
}
export function registerTimeCorrectionImpactRoutes(app,pool){
 app.get('/api/admin/payroll/requests/:requestId/payroll-impact',async(req,res)=>{
  let db
  try{
   db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   const facility=req.canonicalAccess.facilityId,request=(await db.query("SELECT * FROM payroll_employee_request WHERE facility_id=$1 AND id=$2 AND kind='TIME_CORRECTION'",[facility,req.params.requestId])).rows[0]
   if(!request)throw Object.assign(new Error('Time correction request not found.'),{status:404})
   const p=request.payload,original=p.entryId?(await db.query('SELECT * FROM payroll_effective_time_entry WHERE facility_id=$1 AND employee_id=$2 AND id=$3',[facility,request.employee_id,p.entryId])).rows[0]:null
   if(p.entryId&&!original)throw Object.assign(new Error('Original time entry not found.'),{status:404})
   const data=await timeCorrectionImpact(db,facility,request.employee_id,original,p)
   const reviews=(await db.query("SELECT id,created_at,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee_request' AND entity_id=$2 AND action='TIME_CORRECTION_IMPACT_REVIEWED' ORDER BY id DESC",[facility,String(request.id)])).rows
   data.reviews=reviews.map(r=>({id:Number(r.id),reviewedAt:new Date(r.created_at).toISOString(),reason:r.after_data.input.reason,fingerprint:r.after_data.input.fingerprint,status:r.after_data.result.version===1&&request.status==='PENDING'&&r.after_data.input.fingerprint===data.fingerprint?'CURRENT':'STALE',paymentApplied:false}))
   await db.query('COMMIT');res.json({success:true,data})
  }catch(error){if(db)await db.query('ROLLBACK');res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to review payroll impact.'})}finally{db?.release()}
 })
 app.post('/api/admin/payroll/requests/:requestId/payroll-impact/reviews',async(req,res)=>{
  let db
  const fail=(message,status=409)=>Object.assign(new Error(message),{status})
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId,input={requestKey:b.requestKey,fingerprint:b.fingerprint,reason:String(b.reason||'').trim(),confirmed:b.confirmed===true}
   if(!/^[a-zA-Z0-9-]{12,100}$/.test(input.requestKey||'')||!/^[a-f0-9]{64}$/.test(input.fingerprint||'')||input.reason.length<20||input.reason.length>2000||!input.confirmed)throw fail('Confirm current correction impact and provide a review reason.',400)
   db=await pool.connect();await db.query('BEGIN')
   await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const request=(await db.query("SELECT * FROM payroll_employee_request WHERE facility_id=$1 AND id=$2 AND kind='TIME_CORRECTION' FOR UPDATE",[facility,req.params.requestId])).rows[0]
   if(!request)throw fail('Time correction request not found.',404)
   await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,request.employee_id])
   const prior=(await db.query("SELECT id,created_at,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee_request' AND entity_id=$2 AND action='TIME_CORRECTION_IMPACT_REVIEWED' AND after_data->'input'->>'requestKey'=$3 ORDER BY id DESC LIMIT 1",[facility,String(request.id),input.requestKey])).rows[0]
   const receipt=row=>({id:Number(row.id),reviewedAt:new Date(row.created_at).toISOString(),...row.after_data.result})
   if(prior){if(JSON.stringify(compensationEvidence(prior.after_data.input))!==JSON.stringify(compensationEvidence(input)))throw fail('This correction review reference was already used with different inputs.');await db.query('COMMIT');return res.json({success:true,data:receipt(prior)})}
   if(request.status!=='PENDING')throw fail('Only a pending time correction can retain a new impact review.')
   const p=request.payload,original=p.entryId?(await db.query('SELECT * FROM payroll_effective_time_entry WHERE facility_id=$1 AND employee_id=$2 AND id=$3',[facility,request.employee_id,p.entryId])).rows[0]:null
   if(p.entryId&&!original)throw fail('Original time entry not found.',404)
   const impact=await timeCorrectionImpact(db,facility,request.employee_id,original,p)
   if(impact.status!=='PAYROLL_CORRECTION_REQUIRED')throw fail('This request belongs to normal timesheet review.')
   if(impact.fingerprint!==input.fingerprint)throw fail('Correction or payment evidence changed. Review the current impact before saving.')
   const result={version:1,status:'REVIEWED_IMPACT',fingerprint:impact.fingerprint,reason:input.reason,paymentApplied:false,requiresRevalidation:true}
   const row=(await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'TIME_CORRECTION_IMPACT_REVIEWED','employee_request',$3,$4) RETURNING id,created_at,after_data",[facility,req.adminId,String(request.id),{input,request,impact,result}])).rows[0]
   await db.query('COMMIT');res.status(201).json({success:true,data:receipt(row)})
  }catch(error){if(db)await db.query('ROLLBACK');res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to retain correction impact review.'})}finally{db?.release()}
 })

}
