import {fixedSalaryWeeklyHours} from './fixedSalaryAgreement.js'
import {exemptLeaveWorkweek} from './exemptWorkweek.js'
import {assertCompensationUnlocked} from './compensation.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export function validateSalaryReview(employee,body){
 if(employee.pay_type!=='SALARY')throw fail('Salary review is available for salaried employees.',409)
 const annual=Number(employee.annual_salary_cents)
 if(!Number.isSafeInteger(annual)||annual<=0)throw fail('Record a valid annual salary before classification review.',409)
 if(!['EXEMPT','NONEXEMPT'].includes(body.classification))throw fail('Select exempt or nonexempt classification.')
 if(body.confirmed!==true||String(body.source||'').trim().length<20)throw fail('Confirm the classification review and provide its evidence reference.')
 if(body.classification==='EXEMPT'){
  if(employee.work_state!=='MD')throw fail('Verify state-specific salary exemption rules before enabling exempt payroll outside Maryland.',409)
  if(!['EXECUTIVE','ADMINISTRATIVE','LEARNED_PROFESSIONAL','CREATIVE_PROFESSIONAL'].includes(body.category))throw fail('Select a supported standard exemption category.')
  if(annual<3556800)throw fail('The standard exemption requires at least $684 per week ($35,568 annual salary).')
  if(body.salaryBasisVerified!==true||body.dutiesVerified!==true||body.stateRulesVerified!==true||String(body.dutiesEvidence||'').trim().length<40)throw fail('Verify salary basis, the actual job duties and Maryland rules, with a detailed duties assessment.')
 }
 const standardWeeklyHours=body.classification==='NONEXEMPT'?(body.standardWeeklyHours??(employee.salary_review?.classification==='NONEXEMPT'?employee.salary_review.standardWeeklyHours:40)??40):40
 if(body.classification==='NONEXEMPT'){try{fixedSalaryWeeklyHours({...body,standardWeeklyHours})}catch(e){throw fail(e.message)}
 if(body.minimumWageVerified!==true||!Number.isSafeInteger(body.minimumWageCents)||body.minimumWageCents<1500)throw fail('Verify the applicable state/local minimum wage (at least $15/hour).')
 }
 const normalWorkweekMinutes=body.classification==='EXEMPT'?exemptLeaveWorkweek(body.normalWorkweekMinutes===undefined?employee.salary_review?.normalWorkweekMinutes??undefined:body.normalWorkweekMinutes):null
 return {version:1,normalWorkweekMinutes,classification:body.classification,category:body.classification==='EXEMPT'?body.category:'NONE',annualSalaryCents:annual,standardWeeklyHours:normalWorkweekMinutes?normalWorkweekMinutes.reduce((a,b)=>a+b,0)/60:standardWeeklyHours,fixedHoursVerified:body.fixedHoursVerified===true,fixed40Verified:body.fixed40Verified===true,minimumWageVerified:body.minimumWageVerified===true,minimumWageCents:body.classification==='NONEXEMPT'?body.minimumWageCents:null,workState:employee.work_state,jobTitle:employee.job_title,source:String(body.source).trim().slice(0,2000),dutiesEvidence:String(body.dutiesEvidence||'').trim().slice(0,4000),salaryBasisVerified:body.salaryBasisVerified===true,dutiesVerified:body.dutiesVerified===true,stateRulesVerified:body.stateRulesVerified===true}
}
export function registerSalaryReviewRoutes(app,pool){
 app.get('/api/admin/payroll/employees/:id/salary-review',async(req,res)=>{
  try{
   const e=(await pool.query('SELECT job_title,pay_type,annual_salary_cents,overtime_classification,salary_review FROM payroll_employee WHERE facility_id=$1 AND id=$2',[req.canonicalAccess.facilityId,req.params.id])).rows[0]
   if(!e)return res.status(404).json({success:false,message:'Employee not found.'})
   res.json({success:true,data:{jobTitle:e.job_title,payType:e.pay_type,annualSalaryCents:e.annual_salary_cents==null?null:Number(e.annual_salary_cents),classification:e.overtime_classification,review:e.salary_review}})
  }catch{res.status(500).json({success:false,message:'Unable to load salary review.'})}
 })
 app.post('/api/admin/payroll/employees/:id/salary-review',async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId
  try{
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const e=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!e)throw fail('Employee not found.',404)
   const rehire=e.employment_status==='ONBOARDING'&&(await db.query('SELECT id FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND onboarding_cycle>1 LIMIT 1',[facility,e.id])).rows.length>0
   const history=(await db.query('SELECT * FROM payroll_salary_change WHERE facility_id=$1 AND employee_id=$2 ORDER BY effective_on,id FOR UPDATE',[facility,e.id])).rows
   const opening=e.employment_status==='ONBOARDING'&&(rehire||history.length>0)
   if(history.length&&!opening)throw fail('Salary history exists. Use a dated compensation change to preserve earlier terms.',409)
   if(opening){
    const day=v=>new Date(v).toISOString().slice(0,10)
    if(req.body?.employmentStart!==day(e.hire_date))throw fail('The hiring period changed. Reload the salary review before saving rehire terms.',409)
    const priorSalary=(await db.query("SELECT id FROM payroll_employment_period WHERE facility_id=$1 AND employee_id=$2 AND started_on<$3 AND pay_type='SALARY' LIMIT 1",[facility,e.id,e.hire_date])).rows.length>0
    if(priorSalary&&!history.some(row=>!row.cancelled_at&&day(row.effective_on)<day(e.hire_date)))throw fail('Reconcile the prior salary agreement before reviewing rehire pay.',409)
    if(history.some(row=>!row.cancelled_at&&day(row.effective_on)>day(e.hire_date)))throw fail('Reconcile later scheduled salary changes before reviewing rehire pay.',409)
    await assertCompensationUnlocked(db,facility,e.id,e.hire_date)
    if((await db.query("SELECT t.id FROM payroll_effective_time_entry t JOIN payroll_settings s ON s.facility_id=t.facility_id WHERE t.facility_id=$1 AND t.employee_id=$2 AND t.status<>'REJECTED' AND COALESCE(t.clock_out,'infinity'::timestamptz)>($3::date::timestamp AT TIME ZONE s.timezone) LIMIT 1",[facility,e.id,e.hire_date])).rows.length)throw fail('Rehire salary cannot change after work has been recorded in the new employment period.',409)
   }
   if(e.employment_status==='TERMINATED')throw fail('Use the hiring workflow for a returning employee.',409)
   const proposedTitle=req.body?.jobTitle===undefined?e.job_title:String(req.body.jobTitle).trim().slice(0,160)
   if(!proposedTitle)throw fail('Provide the reviewed job title.')
   const proposedAnnual=req.body?.annualSalaryCents===undefined?Number(e.annual_salary_cents):req.body.annualSalaryCents
   if(!Number.isSafeInteger(proposedAnnual)||proposedAnnual<=0)throw fail('Provide a positive annual salary in whole cents.')
   if(proposedAnnual!==Number(e.annual_salary_cents)&&e.employment_status!=='ONBOARDING')throw fail('Use a dated compensation change for an employee who has completed onboarding.',409)
   const review=validateSalaryReview({...e,annual_salary_cents:proposedAnnual,job_title:proposedTitle},req.body||{})
   const used=(await db.query("SELECT r.id FROM payroll_run r JOIN payroll_run_employee re ON re.payroll_run_id=r.id WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.run_kind='REGULAR' AND r.status IN ('APPROVED','FINALIZED') LIMIT 1",[facility,e.id])).rows.length
   if(used&&!opening)throw fail('Approved or finalized payroll uses this classification. Use a dated compensation change before replacing it.',409)
   review.verifiedAt=new Date().toISOString();review.verifiedBy=req.adminId
   if(opening){
    await db.query("UPDATE payroll_salary_change SET cancelled_at=now(),cancelled_by=$3,cancellation_reason='Replaced during rehire onboarding; retained for history' WHERE facility_id=$1 AND employee_id=$2 AND effective_on=$4 AND cancelled_at IS NULL",[facility,e.id,req.adminId,e.hire_date])
    await db.query("INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason,created_by) VALUES($1,$2,$3,$4,$5,'Rehire salary agreement reviewed',$6)",[facility,e.id,e.hire_date,proposedAnnual,review,req.adminId])
   }
   await db.query('UPDATE payroll_employee SET overtime_classification=$3,salary_review=$4,job_title=$5,annual_salary_cents=$6,updated_at=now() WHERE facility_id=$1 AND id=$2',[facility,e.id,review.classification,review,proposedTitle,proposedAnnual])
   await db.query("UPDATE payroll_onboarding_task SET status='OPEN',completed_at=NULL,reviewed_by=NULL,review_note='Salary classification reviewed; verify remaining pay and benefits setup.',updated_at=now() WHERE facility_id=$1 AND employee_id=$2 AND task_key='PAY_REVIEW'",[facility,e.id])
   if(proposedAnnual!==Number(e.annual_salary_cents)||proposedTitle!==e.job_title||review.classification!==e.overtime_classification||(review.classification==='NONEXEMPT'&&review.standardWeeklyHours!==(e.salary_review?.standardWeeklyHours??40))||(review.classification==='EXEMPT'&&JSON.stringify(review.normalWorkweekMinutes)!==JSON.stringify(exemptLeaveWorkweek(e.salary_review?.normalWorkweekMinutes??undefined)))){
    const priorNotice=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='WAGE_NOTICE' FOR UPDATE",[facility,e.id])).rows[0]
    if(priorNotice){
     await db.query("UPDATE payroll_onboarding_task SET status='OPEN',response='{}',submitted_at=NULL,completed_at=NULL,reviewed_by=NULL,review_note='Hiring terms changed; employee must acknowledge the revised offer.',updated_at=now() WHERE id=$1",[priorNotice.id])
     await db.query("UPDATE payroll_employee_document SET status='REVERIFY',completed_at=NULL,notes='Hiring terms changed; revised acknowledgment required.',updated_at=now() WHERE facility_id=$1 AND employee_id=$2 AND document_type='WAGE_NOTICE'",[facility,e.id])
     await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'WAGE_NOTICE_REOPENED','onboarding_task',$3,$4,$5)`,[facility,req.adminId,String(priorNotice.id),priorNotice,{reason:'Hiring terms changed',annualSalaryCents:proposedAnnual,jobTitle:proposedTitle,classification:review.classification}])
    }
   }
   await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'SALARY_CLASSIFICATION_REVIEWED','employee',$3,$4,$5)`,[facility,req.adminId,String(e.id),{annualSalaryCents:Number(e.annual_salary_cents),jobTitle:e.job_title,classification:e.overtime_classification,review:e.salary_review},review])
   await db.query('COMMIT');res.json({success:true,data:review})
  }catch(e){await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to save salary review.'})}finally{db.release()}
 })
}
