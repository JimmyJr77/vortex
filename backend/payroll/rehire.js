import {isDeepStrictEqual} from 'node:util'
import {rehireReview} from './rehireReview.js'
import {ensureOnboarding,dueDate} from './onboarding.js'
import {salaryRowsAt} from './salaryChanges.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const clean=value=>String(value||'').trim().slice(0,2000)

export function registerRehireRoutes(app,pool){
 app.post('/api/admin/payroll/employees/:id/rehire',async(req,res)=>{
  const facility=req.canonicalAccess.facilityId,b=req.body||{}
  const input={requestId:clean(b.requestId),startDate:b.startDate,reviewFingerprint:b.reviewFingerprint,reason:clean(b.reason),reviewReference:clean(b.reviewReference)}
  if(!/^[a-zA-Z0-9-]{12,100}$/.test(input.requestId)||input.reason.length<12||input.reviewReference.length<20||b.termsConfirmed!==true||b.priorObligationsReviewed!==true)return res.status(400).json({success:false,message:'Confirm the displayed hiring terms and prior obligations, and provide a rehire reason and detailed review reference.'})
  let db
  try{
   db=await pool.connect();await db.query('BEGIN')
   await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const employee=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!employee)throw fail('Employee not found.',404)
   const previous=(await db.query("SELECT after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_id=$2 AND action='EMPLOYEE_REHIRED' AND after_data->'input'->>'requestId'=$3 ORDER BY id DESC LIMIT 1",[facility,String(employee.id),input.requestId])).rows[0]
   if(previous){
    if(!isDeepStrictEqual(previous.after_data.input,input))throw fail('This rehire reference was already used with different terms.')
    await db.query('COMMIT');return res.json({success:true,data:previous.after_data.result})
   }
   const review=await rehireReview(db,facility,employee.id,input.startDate)
   if(review.fingerprint!==input.reviewFingerprint)throw fail('The rehire records changed. Refresh the review and confirm the current terms.')
   if(review.issues.length)throw fail(`Resolve the rehire review first: ${review.issues.join(' ')}`)
   if(employee.worker_classification!=='EMPLOYEE')throw fail('Complete the employee classification review before rehiring.')
   const effective=(await salaryRowsAt(db,facility,[employee],input.startDate))[0]
   if(employee.pay_type==='SALARY'&&!effective.salary_review?.verifiedAt)throw fail('Reconcile the prior salary classification agreement before rehiring.')
   await ensureOnboarding(db,employee)
   const documents=(await db.query('SELECT * FROM payroll_employee_document WHERE facility_id=$1 AND employee_id=$2',[facility,employee.id])).rows
   const taxElection=(await db.query('SELECT * FROM payroll_tax_election WHERE facility_id=$1 AND employee_id=$2',[facility,employee.id])).rows[0]||null
   if(employee.pay_type==='SALARY'&&!(await db.query('SELECT id FROM payroll_salary_change WHERE facility_id=$1 AND employee_id=$2',[facility,employee.id])).rows.length){
    await db.query("INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason,created_by) VALUES($1,$2,$3,$4,$5,'Prior employment salary retained at rehire',$6)",[facility,employee.id,employee.hire_date,employee.annual_salary_cents,employee.salary_review,req.adminId])
   }
   if(employee.pay_type==='HOURLY')await db.query("INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason,created_by) VALUES($1,$2,$3,$4,'Rehire opening rate confirmed',$5) ON CONFLICT(employee_id,effective_on) WHERE cancelled_at IS NULL DO NOTHING",[facility,employee.id,input.startDate,review.compensation.hourlyRateCents,req.adminId])
   await db.query(`UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date=$3,termination_date=NULL,onboarding_completed_at=NULL,w4_status='MISSING',state_withholding_status='MISSING',i9_status='MISSING',direct_deposit_status='NOT_CONFIGURED',hourly_rate_cents=$4,annual_salary_cents=$5,salary_review=$6,overtime_classification=$7,job_title=$8,updated_at=now() WHERE facility_id=$1 AND id=$2`,[facility,employee.id,input.startDate,review.compensation.hourlyRateCents,review.compensation.annualSalaryCents,effective.salary_review,effective.overtime_classification,effective.job_title])
   const tasks=(await db.query('SELECT id,task_key FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 ORDER BY id FOR UPDATE',[facility,employee.id])).rows
   for(const task of tasks)await db.query("UPDATE payroll_onboarding_task SET onboarding_cycle=onboarding_cycle+1,status='OPEN',required=true,response='{}',review_note=NULL,reviewed_by=NULL,submitted_at=NULL,completed_at=NULL,due_date=$2,updated_at=now() WHERE id=$1",[task.id,dueDate(input.startDate,task.task_key)])
   await db.query("UPDATE payroll_employee_document SET status='MISSING',completed_at=NULL,expires_on=NULL,secure_reference=NULL,notes=NULL,updated_at=now() WHERE facility_id=$1 AND employee_id=$2",[facility,employee.id])
   await db.query('DELETE FROM payroll_tax_election WHERE facility_id=$1 AND employee_id=$2',[facility,employee.id])
   await db.query('UPDATE payroll_employee_session SET revoked_at=now() WHERE facility_id=$1 AND employee_id=$2 AND revoked_at IS NULL',[facility,employee.id])
   await db.query('UPDATE payroll_employee_invitation SET revoked_at=now() WHERE facility_id=$1 AND employee_id=$2 AND revoked_at IS NULL AND redeemed_at IS NULL',[facility,employee.id])
   const result={employeeId:Number(employee.id),startDate:input.startDate,employmentStatus:'ONBOARDING'}
   const {portal_password_hash:passwordHash,...priorEmployee}=employee
   void passwordHash
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'EMPLOYEE_REHIRED','employee',$3,$4,$5)",[facility,req.adminId,String(employee.id),{employee:priorEmployee,documents,taxElection},{input,result,review}])
   await db.query('COMMIT');res.status(201).json({success:true,data:result})
  }catch(e){if(db)await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to reopen onboarding.'})}finally{db?.release()}
 })
}
