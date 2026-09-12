import {createHash,randomUUID} from 'node:crypto'
import {payrollEmployeeAuth,lockPayrollEmployeeSession} from './employeeAuth.js'
import {retirementEligibilitySource} from './retirementEligibility.js'
import {retirementElectionProposal,retirementElectionInput} from './retirementElectionInput.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
export async function retirementEmployeePlan(db,facility,employeeId,planId,now=new Date()){
 const source=await retirementEligibilitySource(db,facility,employeeId,planId)
 const eligibility=(await db.query('SELECT id,source_fingerprint,review FROM payroll_retirement_eligibility WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY revision DESC LIMIT 1',[facility,employeeId,planId])).rows[0]
 const plan=(await db.query('SELECT plan FROM payroll_retirement_plan_revision WHERE id=$1',[source.planRevisionId])).rows[0].plan
 const dates=(await db.query(`SELECT (($3::timestamptz AT TIME ZONE s.timezone)::date+1)::text AS tomorrow,
 (SELECT (max(COALESCE(r.payment_date,p.pay_date))+1)::text FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee e ON e.payroll_run_id=r.id WHERE r.facility_id=$1 AND e.employee_id=$2 AND r.status IN ('APPROVED','FINALIZED')) AS after_committed,
 (SELECT employment_status FROM payroll_employee WHERE facility_id=$1 AND id=$2) AS employment_status FROM payroll_settings s WHERE s.facility_id=$1`,[facility,employeeId,now])).rows[0]
 let proposal=null,status='REVIEW_REQUIRED',explanation='Your hiring administrator must review current plan eligibility.'
 if(eligibility?.source_fingerprint===source.fingerprint){
  status=eligibility.review.disposition;explanation=eligibility.review.employeeExplanation
  if(status==='ELIGIBLE'&&dates.employment_status!=='TERMINATED'){
   const earliest=[eligibility.review.eligibleOn,dates.tomorrow,dates.after_committed].filter(Boolean).sort().at(-1)
   if(earliest.startsWith('2026-'))proposal=retirementElectionProposal(plan,{facilityId:Number(facility),employeeId:Number(employeeId),onboardingCycle:source.onboardingCycle,planRevision:source.planRevision,eligibilityRevisionId:eligibility.id,employeeExplanation:explanation,earliestEffectiveOn:earliest,methods:eligibility.review.methods})
   else{status='YEAR_REVIEW_REQUIRED';explanation='The next available election date needs a reviewed retirement tax year.'}
  }
 }
 if(dates.employment_status==='TERMINATED'){status='RECORDS_ONLY';explanation='Retained elections remain available. Contact payroll about changes after separation.'}
 const history=(await db.query('SELECT id,revision,onboarding_cycle,election,created_at FROM payroll_retirement_election WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY revision DESC',[facility,employeeId,planId])).rows
 return {planId,planName:plan.name,status,explanation,proposal,history:history.map(row=>({id:row.id,revision:row.revision,onboardingCycle:row.onboarding_cycle,election:row.election,createdAt:new Date(row.created_at).toISOString(),processingStatus:'PAYROLL_SOURCE_REVIEW_REQUIRED'}))}
}
export async function retirementEmployeePlans(db,facility,employeeId,now=new Date()){
 const ids=(await db.query('SELECT DISTINCT plan_id FROM payroll_retirement_eligibility WHERE facility_id=$1 AND employee_id=$2 ORDER BY plan_id',[facility,employeeId])).rows
 const plans=[];for(const row of ids)plans.push(await retirementEmployeePlan(db,facility,employeeId,row.plan_id,now));return {plans}
}
export function registerRetirementElectionRoutes(app,pool,{now=()=>new Date()}={}){
 const auth=payrollEmployeeAuth(pool)
 app.get('/api/payroll/employee/retirement',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await retirementEmployeePlans(db,req.payrollEmployee.facility_id,req.payrollEmployee.employee_id,now());await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load your retirement elections.'})}finally{db.release()}
 })
 app.post('/api/payroll/employee/retirement/:planId/elections',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},s=req.payrollEmployee
   if(!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)throw fail('Use the current election revision and a valid request key.')
   const digest=hash({planId:req.params.planId,body:b})
   await db.query('BEGIN');await lockPayrollEmployeeSession(db,s)
   const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_election WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[s.facility_id,s.employee_id,b.requestKey])).rows[0]
   if(prior){if(prior.request_fingerprint!==digest)throw fail('This request key belongs to another signed election.',409);await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
   const current=await retirementEmployeePlan(db,s.facility_id,s.employee_id,req.params.planId,now())
   if(!current.proposal)throw fail('Current eligibility and election terms require an administrator review.',409)
   if((current.history[0]?.revision||0)!==b.expectedRevision)throw fail('Another election was retained. Review current history before signing.',409)
   const election=retirementElectionInput(b,current.proposal),id=randomUUID()
   await db.query('INSERT INTO payroll_retirement_election(id,facility_id,employee_id,plan_id,onboarding_cycle,revision,eligibility_id,election,request_key,request_fingerprint,employee_session_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,s.facility_id,s.employee_id,req.params.planId,current.proposal.onboardingCycle,b.expectedRevision+1,current.proposal.eligibilityRevisionId,election,b.requestKey,digest,s.session_id])
   await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'RETIREMENT_ELECTION_SIGNED','retirement_election',$2,$3)",[s.facility_id,id,{employeeId:String(s.employee_id),planId:req.params.planId,revision:b.expectedRevision+1,action:election.action}])
   await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain your retirement election.'})}finally{db.release()}
 })
}
export function registerAdminRetirementElectionRoutes(app,pool){
 app.get('/api/admin/payroll/employees/:employeeId/retirement-elections',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const facility=req.canonicalAccess.facilityId;if(!(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,req.params.employeeId])).rowCount)throw fail('Employee not found.',404);const data=await retirementEmployeePlans(db,facility,req.params.employeeId);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read participant elections.'})}finally{db.release()}
 })
}
