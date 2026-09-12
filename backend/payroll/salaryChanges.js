import {fixedSalaryMinimumCents,fixedSalaryRateDecreased} from './fixedSalaryAgreement.js'
import {validateSalaryReview} from './salaryReview.js'
import {effectiveScheduleSettings} from './payCalendar.js'
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v||'').slice(0,10)
const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&day(new Date(v))===v
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export async function salaryRowsAt(db,facility,rows,asOf){
 if(!rows.some(e=>e.pay_type==='SALARY'))return rows
 const requested=rows.map(e=>({employee_id:Number(e.id),as_of:asOf?(day(e.hire_date)>day(asOf)?day(e.hire_date):day(asOf)):null}))
 const changes=(await db.query(`SELECT DISTINCT ON(c.employee_id) c.* FROM payroll_salary_change c JOIN payroll_employee e ON e.id=c.employee_id AND e.facility_id=c.facility_id JOIN payroll_settings s ON s.facility_id=c.facility_id JOIN jsonb_to_recordset($2::jsonb) AS target(employee_id bigint,as_of date) ON target.employee_id=c.employee_id WHERE c.facility_id=$1 AND c.cancelled_at IS NULL AND c.effective_on<=COALESCE(target.as_of,GREATEST(e.hire_date,(now() AT TIME ZONE s.timezone)::date)) ORDER BY c.employee_id,c.effective_on DESC`,[facility,JSON.stringify(requested)])).rows
 return rows.map(e=>{if(e.pay_type!=='SALARY')return e;const c=changes.find(c=>Number(c.employee_id)===Number(e.id));return c?{...e,annual_salary_cents:c.annual_salary_cents,salary_review:c.salary_review,job_title:c.salary_review.jobTitle,overtime_classification:c.salary_review.classification,salary_change_id:Number(c.id)}:e})
}
export function registerSalaryChangeRoutes(app,pool){
 app.get('/api/admin/payroll/employees/:id/salary-changes',async(req,res)=>{
  try{
   const facility=req.canonicalAccess.facilityId
   const e=(await pool.query('SELECT id,hire_date FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,req.params.id])).rows[0]
   if(!e)return res.status(404).json({success:false,message:'Employee not found.'})
   const rows=(await pool.query('SELECT * FROM payroll_salary_change WHERE facility_id=$1 AND employee_id=$2 ORDER BY effective_on DESC,id DESC',[facility,e.id])).rows
   const today=(await pool.query('SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].today
   const active=rows.filter(row=>!row.cancelled_at)
   res.json({success:true,data:rows.map(row=>({...row,canCancel:active.length>1&&row.id===active[0].id&&day(row.effective_on)>today&&day(row.effective_on)>day(e.hire_date)}))})
  }catch{res.status(500).json({success:false,message:'Unable to load salary history.'})}
 })
 app.post('/api/admin/payroll/employees/:id/salary-changes',async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,b=req.body||{}
  try{
   await db.query('BEGIN')
   const settings=(await db.query('SELECT *,(now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   const e=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!e)throw fail('Employee not found.',404)
   if(e.pay_type!=='SALARY'||!['ACTIVE','LEAVE'].includes(e.employment_status)||!e.salary_review)throw fail('Complete salary onboarding before scheduling a compensation change.',409)
   if(!valid(b.effectiveOn)||b.effectiveOn<=settings.today||!valid(b.noticeDeliveredOn)||b.noticeDeliveredOn>settings.today||b.noticeConfirmed!==true||String(b.noticeReference||'').trim().length<12||String(b.reason||'').trim().length<12)throw fail('Provide a future effective date, delivered written-notice date, confirmation, notice reference and change reason.')
   const latest=(await db.query('SELECT * FROM payroll_salary_change WHERE facility_id=$1 AND employee_id=$2 AND cancelled_at IS NULL ORDER BY effective_on DESC LIMIT 1',[facility,e.id])).rows[0]
   if(b.effectiveOn<=day(latest?.effective_on||e.hire_date))throw fail('Append the change after the latest salary record.',409)
   const period=(await db.query("SELECT * FROM payroll_pay_period WHERE facility_id=$1 AND period_start=$2 AND status='OPEN'",[facility,b.effectiveOn])).rows[0]
   if(!period)throw fail('Generate the future payroll calendar and choose the start of an open pay period.',409)
   const title=String(b.jobTitle||latest?.salary_review?.jobTitle||e.job_title).trim().slice(0,160)
   const review=validateSalaryReview({...e,salary_review:latest?.salary_review||e.salary_review,job_title:title,annual_salary_cents:b.annualSalaryCents},b)
   if(!Number.isSafeInteger(b.annualSalaryCents))throw fail('Provide annual salary in whole cents.')
   const priorClassification=latest?.salary_review?.classification||e.overtime_classification
   if((priorClassification==='NONEXEMPT'||review.classification==='NONEXEMPT')&&new Date(`${b.effectiveOn}T00:00:00Z`).getUTCDay()!==settings.workweek_starts_on)throw fail('A nonexempt salary change must begin both a pay period and a workweek.',409)
   if(review.classification==='NONEXEMPT'&&b.annualSalaryCents<fixedSalaryMinimumCents(review))throw fail('Salary must cover the agreed weekly hours at the verified minimum wage.')
   const schedule=await effectiveScheduleSettings(db,facility,settings,b.effectiveOn)
   const noticeDays={WEEKLY:7,BIWEEKLY:14,SEMIMONTHLY:16,MONTHLY:31}[schedule.pay_frequency]
   if((b.annualSalaryCents<Number(latest?.annual_salary_cents||e.annual_salary_cents)||fixedSalaryRateDecreased(Number(latest?.annual_salary_cents||e.annual_salary_cents),latest?.salary_review||e.salary_review,b.annualSalaryCents,review))&&(Date.parse(b.effectiveOn)-Date.parse(b.noticeDeliveredOn))/86400000<noticeDays)throw fail(`A salary decrease requires ${noticeDays} days of advance written notice.`)
   if((await db.query("SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND r.run_kind='REGULAR' AND r.status IN ('APPROVED','FINALIZED') AND p.period_end>=$2 LIMIT 1",[facility,b.effectiveOn])).rows.length)throw fail('Approved or finalized payroll depends on this salary period.',409)
   if(!latest)await db.query(`INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason,created_by) VALUES($1,$2,$3,$4,$5,'Opening salary review',$6)`,[facility,e.id,e.hire_date,e.annual_salary_cents,e.salary_review,req.adminId])
   review.verifiedAt=new Date().toISOString();review.verifiedBy=req.adminId
   const row=(await db.query(`INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason,notice_delivered_on,notice_reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[facility,e.id,b.effectiveOn,b.annualSalaryCents,review,String(b.reason).trim().slice(0,2000),b.noticeDeliveredOn,String(b.noticeReference).trim().slice(0,2000),req.adminId])).rows[0]
   await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'SALARY_CHANGE_SCHEDULED','salary_change',$3,$4)`,[facility,req.adminId,String(row.id),row])
   await db.query('COMMIT');res.status(201).json({success:true,data:row})
  }catch(e){await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to schedule salary change.'})}finally{db.release()}
 })
 app.post('/api/admin/payroll/employees/:id/salary-changes/:changeId/cancel',async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,b=req.body||{}
  try{
   await db.query('BEGIN')
   const settings=(await db.query('SELECT *,(now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   const employee=(await db.query('SELECT id,hire_date FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!employee)throw fail('Employee not found.',404)
   const rows=(await db.query('SELECT * FROM payroll_salary_change WHERE facility_id=$1 AND employee_id=$2 AND cancelled_at IS NULL ORDER BY effective_on DESC,id DESC FOR UPDATE',[facility,employee.id])).rows
   const change=rows.find(row=>String(row.id)===req.params.changeId)
   if(!change)throw fail('Active salary change not found.',404)
   if(rows.length<2||change!==rows[0]||day(change.effective_on)<=settings.today||day(change.effective_on)<=day(employee.hire_date))throw fail('Only the latest future salary change can be cancelled. Opening and effective agreements are preserved.',409)
   if(!valid(b.noticeDeliveredOn)||b.noticeDeliveredOn>settings.today||b.noticeDeliveredOn<day(change.notice_delivered_on)||b.noticeConfirmed!==true||String(b.noticeReference||'').trim().length<12||String(b.reason||'').trim().length<12)throw fail('Confirm cancellation notice delivery and provide its date, reference and reason.')
   const previous=rows[1],schedule=await effectiveScheduleSettings(db,facility,settings,day(change.effective_on))
   const noticeDays={WEEKLY:7,BIWEEKLY:14,SEMIMONTHLY:16,MONTHLY:31}[schedule.pay_frequency]
   if(!noticeDays)throw fail('Configure a supported pay frequency before cancelling salary changes.',409)
   if((Number(previous.annual_salary_cents)<Number(change.annual_salary_cents)||fixedSalaryRateDecreased(Number(change.annual_salary_cents),change.salary_review,Number(previous.annual_salary_cents),previous.salary_review)||(previous.salary_review.classification==='EXEMPT'&&change.salary_review.classification==='NONEXEMPT'))&&(Date.parse(day(change.effective_on))-Date.parse(b.noticeDeliveredOn))/86400000<noticeDays)throw fail(`Restoring the preceding salary requires ${noticeDays} days of advance written notice.`)
   if((await db.query("SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND r.run_kind='REGULAR' AND r.status IN ('APPROVED','FINALIZED') AND p.period_end>=$2 LIMIT 1",[facility,change.effective_on])).rows.length)throw fail('Approved or finalized payroll depends on this salary change.',409)
   const saved=(await db.query('UPDATE payroll_salary_change SET cancelled_at=now(),cancelled_by=$2,cancellation_reason=$3,cancellation_notice_delivered_on=$4,cancellation_notice_reference=$5 WHERE id=$1 RETURNING *',[change.id,req.adminId,String(b.reason).trim().slice(0,2000),b.noticeDeliveredOn,String(b.noticeReference).trim().slice(0,2000)])).rows[0]
   await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'SALARY_CHANGE_CANCELLED','salary_change',$3,$4,$5)`,[facility,req.adminId,String(change.id),change,saved])
   await db.query('COMMIT');res.json({success:true,data:saved})
  }catch(e){await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to cancel salary change.'})}finally{db.release()}
 })

}
