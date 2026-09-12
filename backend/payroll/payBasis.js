import {isDeepStrictEqual} from 'node:util'
import {assertCompensationUnlocked} from './compensation.js'
import {validateSalaryReview} from './salaryReview.js'
import {fixedSalaryMinimumCents} from './fixedSalaryAgreement.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const day=value=>new Date(value).toISOString().slice(0,10)
export function registerPayBasisRoutes(app,pool){
 app.post('/api/admin/payroll/employees/:id/pay-basis',async(req,res)=>{
  let db
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId
   const input={requestId:b.requestId,employmentStart:b.employmentStart,fromPayType:b.fromPayType,payType:b.payType,hourlyRateCents:b.payType==='HOURLY'?b.hourlyRateCents:null,annualSalaryCents:b.payType==='SALARY'?b.annualSalaryCents:null,salaryReview:b.payType==='SALARY'?b.salaryReview:null,reason:String(b.reason||'').trim()}
   if(!/^[a-zA-Z0-9-]{12,100}$/.test(input.requestId||'')||!['HOURLY','SALARY'].includes(input.payType)||!['HOURLY','SALARY'].includes(input.fromPayType)||input.fromPayType===input.payType||input.reason.length<20||input.reason.length>2000||b.confirmed!==true)throw fail('Confirm the changed offer, its prior basis and a detailed review reason.',400)
   const amount=input.payType==='HOURLY'?input.hourlyRateCents:input.annualSalaryCents
   if(!Number.isSafeInteger(amount)||amount<=0||input.payType==='HOURLY'&&amount>2147483647)throw fail('Provide positive compensation in whole cents.',400)
   db=await pool.connect();await db.query('BEGIN')
   await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const e=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!e)throw fail('Employee not found.',404)
   const prior=(await db.query("SELECT after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee' AND entity_id=$2 AND action='PAY_BASIS_CHANGED' AND after_data->'input'->>'requestId'=$3 ORDER BY id DESC LIMIT 1",[facility,String(e.id),input.requestId])).rows[0]
   if(prior){if(!isDeepStrictEqual(prior.after_data.input,input))throw fail('This offer change reference was used for different terms.');await db.query('COMMIT');return res.json({success:true,data:prior.after_data.result})}
   if(e.employment_status!=='ONBOARDING'||day(e.hire_date)!==input.employmentStart||e.pay_type!==input.fromPayType)throw fail('Reload the current onboarding offer before changing its pay basis.')
   if(e.worker_classification!=='EMPLOYEE')throw fail('Resolve worker classification before changing the pay basis.')
   await assertCompensationUnlocked(db,facility,e.id,e.hire_date)
   const conflicts=(await db.query(`SELECT
    EXISTS(SELECT 1 FROM payroll_effective_time_entry t JOIN payroll_settings s ON s.facility_id=t.facility_id WHERE t.facility_id=$1 AND t.employee_id=$2 AND t.status<>'REJECTED' AND COALESCE(t.clock_out,'infinity'::timestamptz)>($3::date::timestamp AT TIME ZONE s.timezone)) AS work,
    EXISTS(SELECT 1 FROM payroll_paid_leave l JOIN payroll_employee_request q ON q.id=l.request_id WHERE l.facility_id=$1 AND l.employee_id=$2 AND l.leave_date>=$3 AND q.status<>'CANCELLED') AS leave,
    EXISTS(SELECT 1 FROM payroll_recurring_adjustment WHERE facility_id=$1 AND employee_id=$2 AND status='ACTIVE' AND (active_to IS NULL OR active_to>=$3)) AS adjustments,
    EXISTS(SELECT 1 FROM payroll_pay_rate WHERE facility_id=$1 AND employee_id=$2 AND cancelled_at IS NULL AND effective_on>$3) OR EXISTS(SELECT 1 FROM payroll_salary_change WHERE facility_id=$1 AND employee_id=$2 AND cancelled_at IS NULL AND effective_on>$3) AS later_terms`,[facility,e.id,e.hire_date])).rows[0]
   if(Object.values(conflicts).some(Boolean))throw fail('Reconcile new-period work, paid leave, active adjustments and later compensation before changing the offer.')
   const review=input.payType==='SALARY'?validateSalaryReview({...e,pay_type:'SALARY',annual_salary_cents:amount,salary_review:null},input.salaryReview||{}):null
   if(review?.classification==='NONEXEMPT'&&amount<fixedSalaryMinimumCents(review))throw fail('Salary must cover the reviewed weekly hours at the verified minimum wage.',400)
   if(review){review.verifiedAt=new Date().toISOString();review.verifiedBy=req.adminId}
   if(e.pay_type==='SALARY'&&e.salary_review){
    if(!(await db.query('SELECT id FROM payroll_salary_change WHERE facility_id=$1 AND employee_id=$2 AND effective_on=$3 AND cancelled_at IS NULL',[facility,e.id,e.hire_date])).rows.length)await db.query("INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason,created_by) VALUES($1,$2,$3,$4,$5,'Hiring salary offer retained before basis change',$6)",[facility,e.id,e.hire_date,e.annual_salary_cents,e.salary_review,req.adminId])
   }
   await db.query("UPDATE payroll_pay_rate SET cancelled_at=now(),cancelled_by=$3,cancellation_reason=$5 WHERE facility_id=$1 AND employee_id=$2 AND effective_on=$4 AND cancelled_at IS NULL",[facility,e.id,req.adminId,e.hire_date,input.reason])
   await db.query("UPDATE payroll_salary_change SET cancelled_at=now(),cancelled_by=$3,cancellation_reason=$5 WHERE facility_id=$1 AND employee_id=$2 AND effective_on=$4 AND cancelled_at IS NULL",[facility,e.id,req.adminId,e.hire_date,input.reason])
   if(input.payType==='HOURLY')await db.query('INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason,created_by) VALUES($1,$2,$3,$4,$5,$6)',[facility,e.id,e.hire_date,amount,input.reason,req.adminId])
   else await db.query('INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[facility,e.id,e.hire_date,amount,review,input.reason,req.adminId])
   await db.query('UPDATE payroll_employee SET pay_type=$3,hourly_rate_cents=$4,annual_salary_cents=$5,overtime_classification=$6,salary_review=$7,updated_at=now() WHERE facility_id=$1 AND id=$2',[facility,e.id,input.payType,input.payType==='HOURLY'?amount:0,input.payType==='SALARY'?amount:null,review?.classification||'NONEXEMPT',review])
   await db.query("UPDATE payroll_onboarding_task SET status='OPEN',response='{}',submitted_at=NULL,completed_at=NULL,reviewed_by=NULL,review_note='Offer pay basis changed; fresh review and acknowledgment required.',updated_at=now() WHERE facility_id=$1 AND employee_id=$2 AND task_key IN ('PAY_REVIEW','WAGE_NOTICE')",[facility,e.id])
   await db.query("UPDATE payroll_employee_document SET status='REVERIFY',completed_at=NULL,notes='Offer pay basis changed; revised wage acknowledgment required.',updated_at=now() WHERE facility_id=$1 AND employee_id=$2 AND document_type='WAGE_NOTICE'",[facility,e.id])
   const result={employeeId:Number(e.id),payType:input.payType,employmentStart:input.employmentStart}
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'PAY_BASIS_CHANGED','employee',$3,$4,$5)",[facility,req.adminId,String(e.id),{payType:e.pay_type,hourlyRateCents:e.hourly_rate_cents,annualSalaryCents:e.annual_salary_cents,salaryReview:e.salary_review},{input,result}])
   await db.query('COMMIT');res.status(201).json({success:true,data:result})
  }catch(e){if(db)await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to change the hiring pay basis.'})}finally{db?.release()}
 })
}
