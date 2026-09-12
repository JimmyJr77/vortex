import {exemptLeaveWorkweek} from './exemptWorkweek.js'
import {payrollEmployeeAuth,lockPayrollEmployeeSession} from './employeeAuth.js'
const day=value=>value instanceof Date?value.toISOString().slice(0,10):value?String(value).slice(0,10):null
const publicNotice=row=>({...((row.salary_review.classification==='NONEXEMPT')?{salaryWeeklyHours:row.salary_review.standardWeeklyHours??40}:{}),...((row.salary_review.classification==='EXEMPT')?{normalWorkweekMinutes:exemptLeaveWorkweek(row.salary_review.normalWorkweekMinutes??undefined)}:{}),id:Number(row.id),effectiveOn:day(row.effective_on),annualSalaryCents:Number(row.annual_salary_cents),jobTitle:row.salary_review.jobTitle,classification:row.salary_review.classification,noticeDeliveredOn:day(row.notice_delivered_on),cancelledAt:row.cancelled_at,cancellationNoticeDeliveredOn:day(row.cancellation_notice_delivered_on)})
export function registerSalaryNoticeRoutes(app,pool){
 app.get('/api/payroll/employee/salary-changes',payrollEmployeeAuth(pool),async(req,res)=>{
  try{
   const rows=(await pool.query('SELECT * FROM payroll_salary_change WHERE facility_id=$1 AND employee_id=$2 AND notice_delivered_on IS NOT NULL ORDER BY effective_on DESC,id DESC',[req.payrollEmployee.facility_id,req.payrollEmployee.employee_id])).rows
   res.json({success:true,data:rows.map(row=>({...publicNotice(row),acknowledgedAt:row.acknowledged_at,cancellationAcknowledgedAt:row.cancellation_acknowledged_at}))})
  }catch{res.status(500).json({success:false,message:'Unable to load salary notices.'})}
 })
 app.post('/api/payroll/employee/salary-changes/:id/acknowledge',payrollEmployeeAuth(pool),async(req,res)=>{
  if(req.body?.acknowledged!==true)return res.status(400).json({success:false,message:'Confirm receipt of this salary notice.'})
  const db=await pool.connect(),{facility_id:facility,employee_id:employee}=req.payrollEmployee,cancellation=req.body?.cancellation===true
  try{
   await db.query('BEGIN');await lockPayrollEmployeeSession(db,req.payrollEmployee,req);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const row=(await db.query('SELECT * FROM payroll_salary_change WHERE facility_id=$1 AND employee_id=$2 AND id=$3 AND notice_delivered_on IS NOT NULL FOR UPDATE',[facility,employee,req.params.id])).rows[0]
   if(!row||(cancellation?(!row.cancelled_at||!row.cancellation_notice_delivered_on):!!row.cancelled_at)){await db.query('ROLLBACK');return res.status(404).json({success:false,message:'Current salary notice not found. Refresh the notice list.'})}
   let acknowledgedAt=cancellation?row.cancellation_acknowledged_at:row.acknowledged_at
   if(!acknowledgedAt){
    const statement=cancellation?'UPDATE payroll_salary_change SET cancellation_acknowledged_at=now(),cancellation_acknowledged_notice=$2 WHERE id=$1 RETURNING cancellation_acknowledged_at AS acknowledged_at':'UPDATE payroll_salary_change SET acknowledged_at=now(),acknowledged_notice=$2 WHERE id=$1 RETURNING acknowledged_at'
    acknowledgedAt=(await db.query(statement,[row.id,publicNotice(row)])).rows[0].acknowledged_at
    await db.query(`INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'SALARY_NOTICE_ACKNOWLEDGED','salary_change',$2,$3)`,[facility,String(row.id),{employeeId:employee,cancellation,acknowledgedAt}])
   }
   await db.query('COMMIT');res.json({success:true,data:{acknowledgedAt}})
  }catch(e){await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to acknowledge salary notice.'})}finally{db.release()}
 })
}
