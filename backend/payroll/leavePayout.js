import {leaveAvailabilityFromEvidence} from './leaveAvailability.js'
import {payrollEmploymentOverlaps} from './employmentPeriods.js'
import {createHash} from 'node:crypto'
export function calculateLeavePayout(body,availableMinutes){
 const fail=message=>{throw Object.assign(new Error(message),{status:400})}
 if(!Number.isSafeInteger(availableMinutes)||availableMinutes<0)fail('Reconcile the available PTO balance before calculating a payout.')
 if(body.leaveType!=='PTO')fail('Select accrued vacation/PTO for this payout; statutory sick leave requires a separate policy review.')
 if(!Number.isSafeInteger(body.minutes)||body.minutes<=0||body.minutes>availableMinutes)fail('Payout minutes must be positive and no greater than the available PTO balance.')
 if(!Number.isSafeInteger(body.hourlyRateCents)||body.hourlyRateCents<=0)fail('Verify the positive hourly payout rate in whole cents.')
 if(body.policyVerified!==true||body.unusedVacationVerified!==true||String(body.policyReference||'').trim().length<20)fail('Verify the communicated leave payout policy, the applicable rate, and that this is unused vacation rather than an attendance bonus.')
 const numerator=BigInt(body.minutes)*BigInt(body.hourlyRateCents)
 const amountCents=Number((numerator*2n+60n)/(120n))
 if(!Number.isSafeInteger(amountCents)||amountCents<=0)fail('The calculated payout must be a positive amount within supported cent precision.')
 return {version:1,leaveType:'PTO',minutes:body.minutes,hourlyRateCents:body.hourlyRateCents,amountCents,availableMinutes,remainingMinutes:availableMinutes-body.minutes}
}
export async function previewLeavePayout(db,facility,employeeId,body){
 const e=(await db.query('SELECT e.id,e.employment_status,EXISTS(SELECT 1 FROM payroll_employment_period ep WHERE ep.facility_id=e.facility_id AND ep.employee_id=e.id AND ep.started_on<e.hire_date AND ep.ended_on IS NOT NULL) AS has_prior_employment,(now() AT TIME ZONE s.timezone)::date::text AS today FROM payroll_employee e JOIN payroll_settings s ON s.facility_id=e.facility_id WHERE e.facility_id=$1 AND e.id=$2',[facility,employeeId])).rows[0]
 if(!e)throw Object.assign(new Error('Employee not found.'),{status:404})
 if(e.employment_status==='ONBOARDING'&&!e.has_prior_employment)throw Object.assign(new Error('Complete hiring or review the separation before calculating a leave payout.'),{status:409})
 const evidence=(await db.query("SELECT id,transaction_date::text AS date,minutes,transaction_kind AS kind FROM payroll_leave_transaction WHERE facility_id=$1 AND employee_id=$2 AND leave_type='PTO' ORDER BY transaction_date,id",[facility,employeeId])).rows.map(row=>({...row,id:Number(row.id)}))
 const reservations=(await db.query("SELECT id,minutes,pay_period_id FROM payroll_leave_payout WHERE facility_id=$1 AND employee_id=$2 AND status='RESERVED' ORDER BY id",[facility,employeeId])).rows.map(row=>({id:Number(row.id),minutes:Number(row.minutes),payPeriodId:Number(row.pay_period_id)}))
 const reservedMinutes=reservations.reduce((sum,row)=>sum+row.minutes,0)
 const balance=leaveAvailabilityFromEvidence(evidence,e.today)-reservedMinutes
 if(!Number.isSafeInteger(balance)||balance<0)throw Object.assign(new Error('Reconcile the PTO ledger before calculating a payout.'),{status:409})
 const calculation={...calculateLeavePayout(body,balance),asOfDate:e.today,evidence,reservations,reservedMinutes}
 return {...calculation,fingerprint:createHash('sha256').update(JSON.stringify(calculation)).digest('hex')}
}
export function registerLeavePayoutRoutes(app,pool){
 registerLeavePayoutReservationRoutes(app,pool)
 app.post('/api/admin/payroll/employees/:id/leave-payout/preview',async(req,res)=>{try{res.json({success:true,data:await previewLeavePayout(pool,req.canonicalAccess.facilityId,req.params.id,req.body||{})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to calculate leave payout.'})}})
}

const fail=(message,status=409)=>Object.assign(new Error(message),{status})
function registerLeavePayoutReservationRoutes(app,pool){
 app.get('/api/admin/payroll/employees/:id/leave-payouts',async(req,res)=>{
  try{
   const facility=req.canonicalAccess.facilityId
   if(!(await pool.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,req.params.id])).rows.length)throw fail('Employee not found.',404)
   const rows=(await pool.query('SELECT * FROM payroll_leave_payout WHERE facility_id=$1 AND employee_id=$2 ORDER BY id DESC',[facility,req.params.id])).rows
   res.json({success:true,data:rows})
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to list PTO payouts.'})}
 })
 app.post('/api/admin/payroll/employees/:id/leave-payouts',async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,b=req.body||{}
  try{
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const e=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!e)throw fail('Employee not found.',404)
   calculateLeavePayout(b,Number.MAX_SAFE_INTEGER)
   const mode=b.paymentMode??'REGULAR'
   if(!['REGULAR','STANDALONE'].includes(mode))throw fail('Select regular or standalone PTO payment.',400)
   if(!/^[a-zA-Z0-9-]{16,80}$/.test(String(b.requestKey||''))||!Number.isSafeInteger(Number(b.payPeriodId))||!/^([a-f0-9]{64})$/.test(String(b.fingerprint||'')))throw fail('Select a payroll period and calculate a fresh payout before reserving PTO.',400)
   const existing=(await db.query('SELECT * FROM payroll_leave_payout WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
   if(existing){
    if(existing.payment_mode!==mode||Number(existing.employee_id)!==Number(e.id)||Number(existing.pay_period_id)!==Number(b.payPeriodId)||Number(existing.minutes)!==b.minutes||Number(existing.hourly_rate_cents)!==b.hourlyRateCents||existing.review.fingerprint!==b.fingerprint||existing.review.policyReference!==String(b.policyReference).trim().slice(0,2000))throw fail('This payout request was already used with different details.')
    await db.query('COMMIT');return res.json({success:true,data:existing})
   }
   const period=(await db.query("SELECT * FROM payroll_pay_period WHERE facility_id=$1 AND id=$2 AND status<>'VOID'",[facility,b.payPeriodId])).rows[0]
   if(!period||mode==='STANDALONE'&&e.employment_status==='ONBOARDING'||mode==='REGULAR'&&(period.status!=='OPEN'||!await payrollEmploymentOverlaps(db,facility,e.id,period.period_start,period.period_end)))throw fail('Select an open payroll period covering eligible employment. Activate the current hiring period first; later payments require an off-cycle payroll.')
   if(mode==='REGULAR'&&(await db.query("SELECT id FROM payroll_run WHERE facility_id=$1 AND pay_period_id=$2 AND run_kind='REGULAR' AND status IN ('APPROVED','FINALIZED')",[facility,period.id])).rows.length)throw fail('This payroll is locked. Resolve it before reserving another payout.')
   const preview=await previewLeavePayout(db,facility,e.id,b)
   if(preview.fingerprint!==b.fingerprint)throw fail('The PTO balance changed after preview. Recalculate before reserving the payout.')
   const review={...preview,policyReference:String(b.policyReference).trim().slice(0,2000),policyVerified:true,unusedVacationVerified:true,verifiedBy:req.adminId,verifiedAt:new Date().toISOString()}
   const row=(await db.query('INSERT INTO payroll_leave_payout(facility_id,employee_id,pay_period_id,minutes,hourly_rate_cents,amount_cents,request_key,review,reserved_on,created_by,payment_mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',[facility,e.id,period.id,b.minutes,b.hourlyRateCents,preview.amountCents,b.requestKey,review,preview.asOfDate,req.adminId,mode])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'PTO_PAYOUT_RESERVED','leave_payout',$3,$4)",[facility,req.adminId,String(row.id),row])
   await db.query('COMMIT');res.status(201).json({success:true,data:row})
  }catch(e){await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to reserve PTO payout.'})}finally{db.release()}
 })
 app.post('/api/admin/payroll/employees/:id/leave-payouts/:payoutId/cancel',async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,reason=String(req.body?.reason||'').trim().slice(0,2000)
  try{
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   if(reason.length<12)throw fail('Provide the reason for cancelling this payout reservation.',400)
   const row=(await db.query('SELECT * FROM payroll_leave_payout WHERE facility_id=$1 AND employee_id=$2 AND id=$3 FOR UPDATE',[facility,req.params.id,req.params.payoutId])).rows[0]
   if(!row)throw fail('Payout not found.',404)
   if(row.status==='CANCELLED'){await db.query('COMMIT');return res.json({success:true,data:row})}
   if(row.status!=='RESERVED'||(await db.query("SELECT id FROM payroll_run WHERE facility_id=$1 AND ((pay_period_id=$2 AND run_kind='REGULAR' AND $3='REGULAR') OR id=$4) AND status IN ('APPROVED','FINALIZED')",[facility,row.pay_period_id,row.payment_mode,row.offcycle_run_id])).rows.length)throw fail('Paid or approved payroll prevents cancellation. Resolve the payroll before changing its payout.')
   const saved=(await db.query("UPDATE payroll_leave_payout SET status='CANCELLED',cancelled_by=$2,cancelled_at=now(),cancellation_reason=$3 WHERE id=$1 RETURNING *",[row.id,req.adminId,reason])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'PTO_PAYOUT_CANCELLED','leave_payout',$3,$4,$5)",[facility,req.adminId,String(row.id),row,saved])
   await db.query('COMMIT');res.json({success:true,data:saved})
  }catch(e){await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to cancel PTO payout.'})}finally{db.release()}
 })
}

export async function reservedPtoMinutes(db,facility,employeeId){return Number((await db.query("SELECT COALESCE(SUM(minutes),0) AS minutes FROM payroll_leave_payout WHERE facility_id=$1 AND employee_id=$2 AND status='RESERVED'",[facility,employeeId])).rows[0].minutes)}
