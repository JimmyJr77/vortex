import {finalPayStatus} from './finalPay.js'
import {reservedPtoMinutes} from './leavePayout.js'
import {createHash} from 'node:crypto'
const day=value=>value instanceof Date?value.toISOString().slice(0,10):value?String(value).slice(0,10):null
const fail=(message,status=400)=>Object.assign(new Error(message),{status})

// Read-only preparation. This does not certify that every historical wage is paid.
export async function rehireReview(db,facility,employeeId,startDate){
 if(typeof startDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!Number.isFinite(Date.parse(startDate))||day(new Date(startDate))!==startDate)throw fail('Choose a valid proposed rehire date.')
 const employee=(await db.query('SELECT e.*,(now() AT TIME ZONE s.timezone)::date::text AS today FROM payroll_employee e JOIN payroll_settings s ON s.facility_id=e.facility_id WHERE e.facility_id=$1 AND e.id=$2',[facility,employeeId])).rows[0]
 if(!employee)throw fail('Employee not found.',404)
 if(employee.employment_status!=='TERMINATED')throw fail('Rehire review is available for former employees.',409)
 const periods=(await db.query('SELECT id,started_on,ended_on FROM payroll_employment_period WHERE facility_id=$1 AND employee_id=$2 ORDER BY started_on',[facility,employeeId])).rows
 const finalPay=await finalPayStatus(db,facility,employeeId)
 const issues=[...finalPay.issues]
 const latest=periods.at(-1)
 if(!latest||day(latest.started_on)!==day(employee.hire_date)||day(latest.ended_on)!==day(employee.termination_date)||periods.some(p=>!p.ended_on))issues.push('Reconcile the employee profile with all recorded employment periods before opening another period.')
 if(periods.some(p=>!p.ended_on||startDate<=day(p.ended_on))||!employee.termination_date||startDate<=day(employee.termination_date))issues.push('The proposed rehire date must follow every recorded separation date.')
 if(startDate<employee.today)issues.push('The proposed date is in the past. Historical work and payroll need reconciliation before recording a backdated rehire.')
 if(!['PAYROLL_FINALIZED','NO_WORK_CLOSED'].includes(finalPay.status))issues.push('The prior final-period payroll has not been finalized.')
 const pendingRuns=(await db.query(`SELECT r.id,r.run_kind,r.status,p.period_start,p.period_end FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.status IN ('DRAFT','REVIEW','APPROVED') ORDER BY r.id`,[facility,employeeId])).rows
 if(pendingRuns.length)issues.push(`${pendingRuns.length} saved payroll runs for this employee still need completion or cancellation.`)
 const rates=(await db.query(`SELECT id,effective_on,hourly_rate_cents FROM payroll_pay_rate WHERE facility_id=$1 AND employee_id=$2 AND cancelled_at IS NULL ORDER BY effective_on`,[facility,employeeId])).rows
 const salaries=(await db.query(`SELECT id,effective_on,annual_salary_cents,salary_review FROM payroll_salary_change WHERE facility_id=$1 AND employee_id=$2 AND cancelled_at IS NULL ORDER BY effective_on`,[facility,employeeId])).rows
 const terms=employee.pay_type==='SALARY'?salaries:rates
 const applicable=terms.filter(row=>day(row.effective_on)<=startDate).at(-1)
 const later=terms.filter(row=>day(row.effective_on)>startDate)
 if(later.length)issues.push(`${later.length} compensation changes take effect after the proposed rehire date. Review those scheduled terms before setting new hiring pay.`)
 const balances=(await db.query(`SELECT leave_type,COALESCE(SUM(minutes),0)::int AS minutes FROM payroll_leave_transaction WHERE facility_id=$1 AND employee_id=$2 AND transaction_date<=$3::date GROUP BY leave_type ORDER BY leave_type`,[facility,employeeId,employee.today])).rows
 const reserved=await reservedPtoMinutes(db,facility,employeeId)
 const tasks=(await db.query('SELECT task_key,onboarding_cycle,status FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 ORDER BY id',[facility,employeeId])).rows
 const adjustments=(await db.query("SELECT id FROM payroll_recurring_adjustment WHERE facility_id=$1 AND employee_id=$2 AND status='ACTIVE' AND (active_to IS NULL OR active_to>=$3::date)",[facility,employeeId,startDate])).rows
 if(adjustments.length)issues.push(`${adjustments.length} active pay adjustments extend into the proposed rehire. Review and end or pause those agreements before reopening onboarding.`)
 const futureShifts=(await db.query("SELECT id FROM payroll_shift WHERE facility_id=$1 AND employee_id=$2 AND status='SCHEDULED' AND scheduled_start>=($3::date::timestamp AT TIME ZONE (SELECT timezone FROM payroll_settings WHERE facility_id=$1))",[facility,employeeId,startDate])).rows
 if(futureShifts.length)issues.push(`${futureShifts.length} existing shifts extend into the proposed rehire. Reconcile those shifts before preparing the new first shift.`)
 const result={
  employeeId:Number(employeeId),employeeNumber:employee.employee_number,proposedStartDate:startDate,asOfDate:employee.today,
  previousHireDate:day(employee.hire_date),previousSeparationDate:day(employee.termination_date),
  employmentPeriods:periods.map(p=>({id:Number(p.id),start:day(p.started_on),end:day(p.ended_on)})),
  issues:[...new Set(issues)],finalPay,pendingRuns:pendingRuns.map(r=>({id:Number(r.id),kind:r.run_kind,status:r.status,start:day(r.period_start),end:day(r.period_end)})),
  compensation:{payType:employee.pay_type,hourlyRateCents:employee.pay_type==='HOURLY'?Number(applicable?.hourly_rate_cents??employee.hourly_rate_cents):null,annualSalaryCents:employee.pay_type==='SALARY'?Number(applicable?.annual_salary_cents??employee.annual_salary_cents):null,source:applicable?'DATED_RECORD':'EMPLOYEE_PROFILE',effectiveOn:day(applicable?.effective_on),laterChanges:later.map(r=>({id:Number(r.id),effectiveOn:day(r.effective_on)}))},
  leaveBalances:balances.map(row=>({type:row.leave_type,minutes:row.minutes,reservedMinutes:row.leave_type==='PTO'?reserved:0})),
  onboarding:tasks.map(t=>({key:t.task_key,cycle:t.onboarding_cycle,status:t.status})),
  employmentTerms:{jobTitle:applicable?.salary_review?.jobTitle||employee.job_title,workState:employee.work_state,residenceState:employee.residence_state,location:employee.primary_work_location,workerClassification:employee.worker_classification,sickLeavePolicy:employee.sick_leave_policy,overtimeClassification:applicable?.salary_review?.classification||employee.overtime_classification,salaryReview:employee.pay_type==='SALARY'?applicable?.salary_review||employee.salary_review:null},
 }
 return {...result,fingerprint:createHash('sha256').update(JSON.stringify(result)).digest('hex')}
}
export function registerRehireReviewRoutes(app,pool){
 app.get('/api/admin/payroll/employees/:id/rehire-review',async(req,res)=>{
  let db
  try{
   db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   const data=await rehireReview(db,req.canonicalAccess.facilityId,req.params.id,req.query.startDate)
   await db.query('COMMIT');res.json({success:true,data})
  }catch(e){if(db)await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to prepare rehire review.'})}finally{db?.release()}
 })
}
