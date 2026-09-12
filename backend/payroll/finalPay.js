import {noWorkCloseoutReview} from './noWorkCloseout.js'
import {unpaidExpenseCount} from './offCycleReimbursement.js'
import {reservedPtoMinutes} from './leavePayout.js'
const day=value=>value instanceof Date?value.toISOString().slice(0,10):value?String(value).slice(0,10):null
export async function finalPayStatus(db,facility,employeeId,now=new Date()){
 const employee=(await db.query('SELECT e.*,s.timezone FROM payroll_employee e JOIN payroll_settings s ON s.facility_id=e.facility_id WHERE e.facility_id=$1 AND e.id=$2',[facility,employeeId])).rows[0]
 if(!employee)throw Object.assign(new Error('Employee not found.'),{status:404})
 if(employee.employment_status!=='TERMINATED')throw Object.assign(new Error('Final-pay tracking is available after employment ends.'),{status:409})
 const terminationDate=day(employee.termination_date),today=new Intl.DateTimeFormat('en-CA',{timeZone:employee.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now),issues=[]
 const noWork=await noWorkCloseoutReview(db,facility,employeeId)
 if(noWork.closeout)return {employeeId:Number(employeeId),employeeName:`${employee.legal_first_name} ${employee.legal_last_name}`,terminationDate,today,dueOn:null,period:null,run:null,status:'NO_WORK_CLOSED',paymentTiming:null,issues:[],unresolvedTimeEntries:0,pendingRequests:0,noWorkCloseout:noWork.closeout}
 if(!terminationDate)issues.push('Record the employment end date before reviewing final payroll.')
 if(employee.work_state!=='MD')issues.push('Verify the final-pay deadline for this work state; automatic deadline tracking is currently Maryland-specific.')
 const periods=terminationDate?(await db.query("SELECT id,period_start,period_end,pay_date,status FROM payroll_pay_period WHERE facility_id=$1 AND status<>'VOID' AND period_start<=$2::date AND period_end>=$2::date ORDER BY id",[facility,terminationDate])).rows:[]
 if(periods.length!==1)issues.push('Generate or reconcile the payroll calendar so exactly one period covers the employment end date.')
 const period=periods.length===1?periods[0]:null
 const runs=period?(await db.query("SELECT r.id,r.status,r.payment_confirmation_reference,COALESCE(r.payment_date,p.pay_date) AS payment_date,re.net_pay_cents FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id WHERE r.facility_id=$1 AND r.run_kind='REGULAR' AND r.pay_period_id=$2 AND re.employee_id=$3 AND r.status<>'VOID' ORDER BY CASE r.status WHEN 'FINALIZED' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END,r.id DESC",[facility,period.id,employeeId])).rows:[]
 if(runs.filter(r=>r.status==='FINALIZED').length>1)issues.push('Multiple finalized payments cover the final payroll period; reconcile their payment records.')
 const run=runs[0]||null,dueOn=employee.work_state==='MD'?day(period?.pay_date):null,paid=run?.status==='FINALIZED'
 if(paid&&(run.net_pay_cents===null||String(run.payment_confirmation_reference||'').trim().length<4))issues.push('The finalized payroll lacks a complete net amount or recorded payment confirmation; reconcile its payment evidence.')
 const unresolved=(await db.query("SELECT COUNT(*)::int n FROM payroll_effective_time_entry WHERE facility_id=$1 AND employee_id=$2 AND status<>'REJECTED' AND (clock_out IS NULL OR status<>'APPROVED')",[facility,employeeId])).rows[0].n
 const pending=(await db.query("SELECT COUNT(*)::int n FROM payroll_employee_request WHERE facility_id=$1 AND employee_id=$2 AND status='PENDING'",[facility,employeeId])).rows[0].n
 const pendingBonuses=(await db.query("SELECT COUNT(*)::int n FROM payroll_run r JOIN payroll_run_employee re ON re.payroll_run_id=r.id WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.run_kind='OFF_CYCLE_BONUS' AND r.status IN ('DRAFT','REVIEW','APPROVED')",[facility,employeeId])).rows[0].n
 if(pendingBonuses)issues.push(`${pendingBonuses} standalone bonus payments still need completion.`)
 const expenses=await unpaidExpenseCount(db,facility,employeeId)
 if(expenses)issues.push(`${expenses} approved expense reimbursements still need payment.`)
 const reserved=await reservedPtoMinutes(db,facility,employeeId)
 if(reserved)issues.push(`${reserved} PTO minutes are reserved for an unpaid payout.`)
 if(unresolved)issues.push(`${unresolved} time records still need completion or approval.`)
 if(pending)issues.push(`${pending} employee requests still need review.`)
 return {employeeId:Number(employeeId),employeeName:`${employee.legal_first_name} ${employee.legal_last_name}`,terminationDate,today,dueOn,period:period?{id:Number(period.id),start:day(period.period_start),end:day(period.period_end)}:null,run:run?{id:Number(run.id),status:run.status,paymentDate:day(run.payment_date),netPayCents:run.net_pay_cents===null?null:Number(run.net_pay_cents)}:null,status:paid?'PAYROLL_FINALIZED':dueOn&&dueOn<today?'PAYROLL_OVERDUE':'PAYROLL_PENDING',paymentTiming:paid&&dueOn?(day(run.payment_date)>dueOn?'LATE':'ON_TIME'):null,issues,unresolvedTimeEntries:unresolved,pendingRequests:pending}
}
export async function refreshFinalPayAlerts(db,facility,now=new Date()){
 const employees=(await db.query("SELECT id FROM payroll_employee WHERE facility_id=$1 AND employment_status='TERMINATED'",[facility])).rows
 for(const e of employees){
  const state=await finalPayStatus(db,facility,e.id,now),key=`final-pay-${e.id}`,soon=new Date(Date.parse(`${state.today}T00:00:00Z`)+7*86400000).toISOString().slice(0,10)
  if(state.issues.length||!['PAYROLL_FINALIZED','NO_WORK_CLOSED'].includes(state.status)&&(!state.dueOn||state.dueOn<=soon))await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Final payroll needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facility,key,`${state.employeeName}: ${state.status==='PAYROLL_FINALIZED'?'final-period payroll is finalized':state.dueOn?`regular final-period payday ${state.dueOn}`:'final-period payroll date is unverified'}. ${state.issues.join(' ')} Open People & onboarding to review.`])
  else await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key])
 }
}
export function registerFinalPayRoutes(app,pool){
 app.get('/api/admin/payroll/employees/:id/final-pay',async(req,res)=>{try{res.json({success:true,data:await finalPayStatus(pool,req.canonicalAccess.facilityId,req.params.id)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load final-pay tracking.'})}})
}
