import {createHash} from 'node:crypto'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const day=value=>value instanceof Date?value.toISOString().slice(0,10):value?String(value).slice(0,10):null
export async function noWorkCloseoutReview(db,facility,employeeId){
 const e=(await db.query('SELECT id,employment_status,pay_type,hire_date,termination_date FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employeeId])).rows[0]
 if(!e)throw fail('Employee not found.',404)
 const counts=(await db.query(`SELECT
  (SELECT COUNT(*)::int FROM payroll_employment_period WHERE facility_id=$1 AND employee_id=$2) AS employment_periods,
  (SELECT COUNT(*)::int FROM payroll_effective_time_entry WHERE facility_id=$1 AND employee_id=$2 AND status<>'REJECTED') AS time_records,
  (SELECT COUNT(*)::int FROM payroll_paid_leave WHERE facility_id=$1 AND employee_id=$2) AS paid_leave_records,
  (SELECT COUNT(*)::int FROM payroll_leave_transaction WHERE facility_id=$1 AND employee_id=$2) AS leave_records,
  (SELECT COUNT(*)::int FROM payroll_recurring_adjustment WHERE facility_id=$1 AND employee_id=$2) AS pay_adjustments,
  (SELECT COUNT(*)::int FROM payroll_employee_request WHERE facility_id=$1 AND employee_id=$2 AND status IN ('PENDING','APPROVED')) AS unresolved_requests,
  (SELECT COUNT(*)::int FROM payroll_shift WHERE facility_id=$1 AND employee_id=$2 AND status='SCHEDULED') AS scheduled_shifts,
  (SELECT COUNT(*)::int FROM payroll_leave_payout WHERE facility_id=$1 AND employee_id=$2) AS payouts,
  (SELECT COUNT(*)::int FROM payroll_historical_payment WHERE facility_id=$1 AND employee_id=$2) AS historical_payments,
  (SELECT COUNT(*)::int FROM payroll_salary_change WHERE facility_id=$1 AND employee_id=$2) AS salary_agreements,
  (SELECT COUNT(*)::int FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id WHERE r.facility_id=$1 AND re.employee_id=$2) AS payroll_records`,[facility,employeeId])).rows[0]
 const issues=[]
 if(e.employment_status!=='TERMINATED'||!e.termination_date)issues.push('Record the cancelled hire’s employment end date first.')
 if(e.pay_type!=='HOURLY')issues.push('Salary agreements require a separate final-pay review.')
 if(counts.employment_periods!==1)issues.push('This closeout requires one initial hiring period without prior employment.')
 for(const [key,label] of Object.entries({time_records:'work records',paid_leave_records:'paid-leave records',leave_records:'leave ledger records',pay_adjustments:'pay adjustments',unresolved_requests:'pending or approved employee requests',scheduled_shifts:'scheduled shifts',payouts:'PTO payout records',payroll_records:'payroll records',historical_payments:'historical payments',salary_agreements:'salary agreements'}))if(counts[key])issues.push(`Review ${counts[key]} ${label}; this record cannot use no-work closeout.`)
 const evidence={employeeId:Number(e.id),hireDate:day(e.hire_date),terminationDate:day(e.termination_date),payType:e.pay_type,employmentStatus:e.employment_status,counts}
 const fingerprint=createHash('sha256').update(JSON.stringify(evidence)).digest('hex')
 const saved=(await db.query("SELECT id,created_at,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee' AND entity_id=$2 AND action='NO_WORK_HIRE_CLOSED' ORDER BY id DESC LIMIT 1",[facility,String(employeeId)])).rows[0]
 return {evidence,fingerprint,issues,eligible:issues.length===0,closeout:saved&&saved.after_data.fingerprint===fingerprint&&!issues.length?{id:Number(saved.id),recordedAt:saved.created_at,reason:saved.after_data.reason,reference:saved.after_data.reference}:null}
}
export function registerNoWorkCloseoutRoutes(app,pool){
 app.get('/api/admin/payroll/employees/:id/no-work-closeout',async(req,res)=>{
  let db
  try{db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await noWorkCloseoutReview(db,req.canonicalAccess.facilityId,req.params.id);await db.query('COMMIT');res.json({success:true,data})}
  catch(e){if(db)await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review no-work closeout.'})}finally{db?.release()}
 })
 app.post('/api/admin/payroll/employees/:id/no-work-closeout',async(req,res)=>{
  let db
  try{
   const reason=String(req.body?.reason||'').trim(),reference=String(req.body?.reference||'').trim()
   if(reason.length<12||reason.length>2000||reference.length<20||reference.length>2000||req.body?.noWorkConfirmed!==true||req.body?.noObligationsConfirmed!==true)throw fail('Document the review and confirm that no work was performed and no payment obligation remains.',400)
   db=await pool.connect();await db.query('BEGIN')
   const facility=req.canonicalAccess.facilityId
   await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])
   const review=await noWorkCloseoutReview(db,facility,req.params.id)
   if(!review.eligible)throw fail('Resolve the recorded work/pay obligations before no-work closeout.')
   if(review.fingerprint!==req.body?.fingerprint)throw fail('The hiring record changed. Refresh the no-work review before closing it.')
   if(review.closeout){
    if(review.closeout.reason!==reason||review.closeout.reference!==reference)throw fail('A closeout is already recorded with different review evidence.')
    await db.query('COMMIT');return res.json({success:true,data:review})
   }
   await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data)
    VALUES($1,$2,'NO_WORK_HIRE_CLOSED','employee',$3,$4)`,[facility,req.adminId,String(req.params.id),{fingerprint:review.fingerprint,evidence:review.evidence,reason,reference,noWorkConfirmed:true,noObligationsConfirmed:true}])
   const data=await noWorkCloseoutReview(db,facility,req.params.id)
   await db.query('COMMIT');res.status(201).json({success:true,data})
  }catch(e){if(db)await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to record no-work closeout.'})}finally{db?.release()}
 })

}
