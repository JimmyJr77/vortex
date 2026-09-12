import {correctionLeaveEffects} from './correctionLeaveEffects.js'
import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {assertEmploymentRange} from './employmentPeriods.js'
import {timeCorrectionImpact} from './timeCorrectionImpact.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const canonical=v=>JSON.stringify(compensationEvidence(JSON.parse(JSON.stringify(v))))
const date=v=>new Date(v).toISOString().slice(0,10)
const fields={regularMinutes:'regular_minutes',overtimeMinutes:'overtime_minutes',regularPayCents:'regular_pay_cents',overtimePayCents:'overtime_pay_cents'}
const wages=e=>Object.fromEntries(Object.keys(fields).map(k=>[k,e[k]]))
const clocks=e=>e.entries.map(t=>({id:Number(t.id),workDate:t.workDate,clockIn:new Date(t.clockIn).toISOString(),clockOut:new Date(t.clockOut).toISOString(),hourlyRateCents:Number(t.hourlyRateCents),workweekStart:t.workweekStart,minutes:t.minutes,regularMinutes:t.regularMinutes,overtimeMinutes:t.overtimeMinutes})).sort((a,b)=>a.clockIn.localeCompare(b.clockIn)||a.id-b.id)

// Recalculate hypothetical source time in the ordinary payroll reader. No paid
// time or run is edited; settlement taxes and leave are deliberately separate.
export async function calculateTimeCorrection(db,facility,request,loadPreview,excludedRunId=null){
 if(request.status!=='PENDING')throw fail('Only pending time corrections can be calculated.')
 const p=request.payload,employeeId=Number(request.employee_id)
 const original=p.entryId?(await db.query('SELECT * FROM payroll_effective_time_entry WHERE facility_id=$1 AND employee_id=$2 AND id=$3',[facility,employeeId,p.entryId])).rows[0]:null
 if(p.entryId&&!original)throw fail('Original time entry not found.')
 const impact=await timeCorrectionImpact(db,facility,employeeId,original,p,excludedRunId)
 if(impact.status!=='PAYROLL_CORRECTION_REQUIRED')throw fail('Use normal timesheet review for unpaid work.')
 if(impact.historicalPayments.length)throw fail('Imported payments require dated correction coverage before calculating their wage differences.')
 if(impact.runs.some(r=>r.run_kind!=='REGULAR'))throw fail('An earned-bonus payment also depends on this time. Its premium correction must be reconciled with wages.')
 const retained=(await db.query("SELECT id FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee_request' AND entity_id=$2 AND action='TIME_CORRECTION_IMPACT_REVIEWED' AND after_data->'result'->>'version'='1' AND after_data->'input'->>'fingerprint'=$3 ORDER BY id DESC LIMIT 1",[facility,String(request.id),impact.fingerprint])).rows[0]
 if(!retained)throw fail('Retain a review of the current payment impact before calculating the correction.')
 await assertEmploymentRange(db,facility,employeeId,p.clockIn,p.clockOut)
 const overlap=(await db.query("SELECT id FROM payroll_effective_time_entry WHERE facility_id=$1 AND employee_id=$2 AND id<>COALESCE($3::bigint,0) AND status<>'REJECTED' AND clock_in<$5 AND COALESCE(clock_out,'infinity'::timestamptz)>$4 LIMIT 1",[facility,employeeId,p.entryId??null,p.clockIn,p.clockOut])).rows[0]
 if(overlap)throw fail('The proposed correction overlaps another time entry.')
 const local=new Intl.DateTimeFormat('en-CA',{timeZone:impact.timezone,year:'numeric',month:'2-digit',day:'2-digit'})
 for(const interval of [impact.original,impact.proposed].filter(Boolean)){
  if(!interval.clockOut)throw fail('Complete the original open clock before calculating a paid-time correction.')
  for(let d=local.format(new Date(interval.clockIn)),last=local.format(new Date(new Date(interval.clockOut).valueOf()-1));d<=last;d=new Date(Date.parse(d)+86400000).toISOString().slice(0,10))
   if(!impact.runs.some(r=>d>=date(r.period_start)&&d<=date(r.period_end)))throw fail('The correction crosses work dates without native payment coverage. Reconcile those dates with the affected payments first.')
 }
 const runs=[]
 for(const run of impact.runs){
  const frozen=run.frozen_employee
  if(frozen?.payType!=='HOURLY'||!Array.isArray(frozen.entries)||frozen.authorizedSettlement)throw fail(`Run ${run.id} requires its salary or allocated wage correction method.`)
  if((frozen.payItems||[]).some(i=>i.bonusAllocation||i.kind==='BONUS_OVERTIME'||i.bonusReview?.classification==='NONDISCRETIONARY'))throw fail(`Run ${run.id} includes an earned bonus requiring a linked premium correction.`)
  const before=(await loadPreview(db,facility,run.pay_period_id,date(run.payment_date),run.id)).preview.employees.find(e=>Number(e.employeeId)===employeeId)
  const after=(await loadPreview(db,facility,run.pay_period_id,date(run.payment_date),run.id,false,{...p,employeeId})).preview.employees.find(e=>Number(e.employeeId)===employeeId)
  if(!before||!after||before.payType!=='HOURLY'||after.payType!=='HOURLY')throw fail(`Run ${run.id} no longer has matching hourly employment evidence.`)
  for(const e of [before,after])if(e.warnings.some(w=>w.blocking))throw fail(`Run ${run.id} needs payroll input reconciliation: ${e.warnings.filter(w=>w.blocking).map(w=>w.message).join(' ')}`)
  for(const [key,column] of Object.entries(fields))if(!Number.isSafeInteger(frozen[key])||frozen[key]!==Number(run.payment_record[column])||frozen[key]!==before[key])throw fail(`Run ${run.id} no longer reconciles to its original wages. Review historical compensation and time first.`)
  if(canonical(clocks(frozen))!==canonical(clocks(before)))throw fail(`Run ${run.id} no longer matches its frozen paid time.`)
  const delta=Object.fromEntries(Object.keys(fields).map(k=>[k,after[k]-before[k]]))
  delta.workedWagesCents=delta.regularPayCents+delta.overtimePayCents
  runs.push({runId:Number(run.id),status:run.status,periodStart:date(run.period_start),periodEnd:date(run.period_end),before:wages(before),after:wages(after),delta,originalEntries:clocks(before),proposedEntries:clocks(after),originalWorkweekPayments:before.workweekPayments,proposedWorkweekPayments:after.workweekPayments,workweekPaymentVersion:after.workweekPaymentVersion,calculationVersion:after.calculationVersion})
 }
 const leave=await correctionLeaveEffects(db,facility,employeeId,runs)
 const result={version:3,status:'WAGE_DIFFERENCE_CALCULATED',requestId:Number(request.id),employeeId,impactReviewId:Number(retained.id),impactFingerprint:impact.fingerprint,runs,workedWagesDifferenceCents:runs.reduce((n,r)=>n+r.delta.workedWagesCents,0),paymentApplied:false,taxesCalculated:false,leaveCalculated:leave.status==='LEAVE_DIFFERENCE_CALCULATED',leave}
 return {...result,fingerprint:createHash('sha256').update(canonical(result)).digest('hex')}
}
export function registerTimeCorrectionCalculationRoutes(app,pool,loadPreview){
 const receipt=row=>({id:Number(row.id),retainedAt:new Date(row.created_at).toISOString(),reason:row.after_data.input.reason,calculation:row.after_data.calculation,paymentApplied:false})
 app.get('/api/admin/payroll/requests/:requestId/payroll-corrections',async(req,res)=>{
  let db
  try{
   db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
   const facility=req.canonicalAccess.facilityId,request=(await db.query("SELECT * FROM payroll_employee_request WHERE facility_id=$1 AND id=$2 AND kind='TIME_CORRECTION'",[facility,req.params.requestId])).rows[0]
   if(!request)throw Object.assign(new Error('Time correction request not found.'),{status:404})
   const rows=(await db.query("SELECT id,created_at,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee_request' AND entity_id=$2 AND action='TIME_CORRECTION_CALCULATION_RETAINED' ORDER BY id DESC",[facility,String(request.id)])).rows
   let current=null,issue=null
   if(rows.length)try{current=await calculateTimeCorrection(db,facility,request,loadPreview)}catch(e){if(e.status!==409)throw e;issue=e.message}
   const data=rows.map(row=>({...receipt(row),status:current&&row.after_data.calculation.version===current.version&&row.after_data.calculation.fingerprint===current.fingerprint?'CURRENT':'STALE',issue}))
   await db.query('ROLLBACK');res.json({success:true,data})
  }catch(e){if(db)await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load correction calculations.'})}finally{db?.release()}
 })
 app.post('/api/admin/payroll/requests/:requestId/payroll-corrections',async(req,res)=>{
  let db
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId,input={requestKey:b.requestKey,fingerprint:b.fingerprint,reason:String(b.reason||'').trim(),confirmed:b.confirmed===true}
   if(!/^[a-zA-Z0-9-]{12,100}$/.test(input.requestKey||'')||!/^[a-f0-9]{64}$/.test(input.fingerprint||'')||input.reason.length<20||input.reason.length>2000||!input.confirmed)throw Object.assign(new Error('Confirm the calculation and provide a reason between 20 and 2000 characters.'),{status:400})
   db=await pool.connect();await db.query('BEGIN')
   await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const request=(await db.query("SELECT * FROM payroll_employee_request WHERE facility_id=$1 AND id=$2 AND kind='TIME_CORRECTION' FOR UPDATE",[facility,req.params.requestId])).rows[0]
   if(!request)throw Object.assign(new Error('Time correction request not found.'),{status:404})
   await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,request.employee_id])
   const prior=(await db.query("SELECT id,created_at,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee_request' AND entity_id=$2 AND action='TIME_CORRECTION_CALCULATION_RETAINED' AND after_data->'input'->>'requestKey'=$3 ORDER BY id DESC LIMIT 1",[facility,String(request.id),input.requestKey])).rows[0]
   if(prior){if(canonical(prior.after_data.input)!==canonical(input))throw fail('This calculation reference was already used with different inputs.');await db.query('COMMIT');return res.json({success:true,data:receipt(prior)})}
   await db.query('SAVEPOINT correction_reader')
   const calculation=await calculateTimeCorrection(db,facility,request,loadPreview)
   await db.query('ROLLBACK TO SAVEPOINT correction_reader')
   if(calculation.fingerprint!==input.fingerprint)throw fail('Correction evidence changed. Recalculate the current wage difference before retaining it.')
   const row=(await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'TIME_CORRECTION_CALCULATION_RETAINED','employee_request',$3,$4) RETURNING id,created_at,after_data",[facility,req.adminId,String(request.id),{input,request,calculation}])).rows[0]
   await db.query('COMMIT');res.status(201).json({success:true,data:receipt(row)})
  }catch(e){if(db)await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain this correction calculation.'})}finally{db?.release()}
 })
 app.post('/api/admin/payroll/requests/:requestId/payroll-correction-preview',async(req,res)=>{
  let db
  try{
   db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
   const facility=req.canonicalAccess.facilityId,request=(await db.query("SELECT * FROM payroll_employee_request WHERE facility_id=$1 AND id=$2 AND kind='TIME_CORRECTION'",[facility,req.params.requestId])).rows[0]
   if(!request)throw Object.assign(new Error('Time correction request not found.'),{status:404})
   const data=await calculateTimeCorrection(db,facility,request,loadPreview)
   // The payroll reader can initialize setup rows. Discard even those here.
   await db.query('ROLLBACK');res.json({success:true,data})
  }catch(e){if(db)await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to calculate this payroll correction.'})}finally{db?.release()}
 })
}
