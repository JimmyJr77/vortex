import {createHash,randomUUID} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {benefitsDeductionProposal} from './benefitsDeductionAuthorization.js'
import {healthPlanQualificationState} from './healthPlanQualification.js'
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const validDay=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const confirmations=['commonLawEmployeeConfirmed','ownershipEligibleConfirmed','coverageEligibleConfirmed','electionRulesConfirmed','nondiscriminationConfirmed']
export async function healthParticipantSource(db,facility,employeeId,planId,paymentDate){
 if(!validDay(paymentDate))throw fail('Choose the payment date for employee health qualification.')
 if(!/^[1-9]\d{0,18}$/.test(String(employeeId))||BigInt(employeeId)>9223372036854775807n)throw fail('Choose an employee.')
 const employee=(await db.query('SELECT id,legal_first_name,legal_last_name,employment_status,hire_date::text,termination_date::text FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employeeId])).rows[0]
 if(!employee)throw fail('Employee not found.',404)
 const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]
 const tasks=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='PAY_REVIEW'",[facility,employeeId])).rows
 const today=(await db.query('SELECT (clock_timestamp() AT TIME ZONE $1)::date::text AS today',[settings.timezone])).rows[0].today
 const task=tasks.length===1?tasks[0]:null,authorization=benefitsDeductionProposal(employee,task,settings,today),issues=[]
 const plan=await healthPlanQualificationState(db,facility,planId,paymentDate)
 if(plan.status!=='QUALIFIED')issues.push('Retain current written-plan qualification covering this payment date.')
 const selection=authorization.proposal?.items.find(item=>item.planId===planId)||null
 if(!task||authorization.status!=='CURRENT'||!selection||selection.taxTreatment!=='PRETAX')issues.push('Retain the current signed pretax benefit election and separate deduction authorization.')
 const signedDay=Number.isFinite(Date.parse(authorization.saved?.signedAt))?new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(authorization.saved.signedAt)):null
 if(!signedDay||paymentDate<signedDay||paymentDate<authorization.proposal?.startOn)issues.push('The deduction must follow the signed authorization and its effective date.')
 const basis={version:1,facilityId:String(facility),employeeId:String(employeeId),onboardingCycle:task?.onboarding_cycle||null,planId,employeeName:`${employee.legal_first_name} ${employee.legal_last_name}`,employmentStatus:employee.employment_status,hireDate:employee.hire_date,terminationDate:employee.termination_date,selection,authorization:authorization.saved,authorizationStatus:authorization.status,planQualification:plan.current?{id:plan.current.id,sourceFingerprint:plan.current.source_fingerprint,review:plan.current.review,documentSha256:plan.current.document_sha256}:null,issues}
 return {...basis,fingerprint:hash(basis)}
}
export async function healthParticipantState(db,facility,employeeId,planId,paymentDate){
 const source=await healthParticipantSource(db,facility,employeeId,planId,paymentDate)
 const history=(await db.query('SELECT id,revision,effective_on::text,effective_through::text,source_fingerprint,review,created_at FROM payroll_health_participant_qualification WHERE facility_id=$1 AND employee_id=$2 AND onboarding_cycle=$3 AND plan_id=$4 ORDER BY revision DESC',[facility,employeeId,source.onboardingCycle,planId])).rows
 const current=history.find(row=>row.effective_on<=paymentDate&&row.effective_through>=paymentDate)
 return {source,history,current:current||null,status:!current?'NEEDS_REVIEW':current.review.disposition==='SUSPENDED'?'SUSPENDED':current.source_fingerprint!==source.fingerprint?'STALE':source.issues.length?'REVIEW_REQUIRED':'ELIGIBLE'}
}
export async function requireHealthParticipantQualification(db,facility,employeeId,planId,paymentDate){
 const state=await healthParticipantState(db,facility,employeeId,planId,paymentDate)
 if(state.status!=='ELIGIBLE')throw fail('Review the employee’s current Section 125 eligibility, covered persons and election rules before collecting pretax health premiums.',409)
 return {reviewId:state.current.id,sourceFingerprint:state.source.fingerprint,fingerprint:hash({reviewId:state.current.id,sourceFingerprint:state.source.fingerprint,review:state.current.review}),authorizationFingerprint:state.source.authorization.proposalFingerprint,selection:state.source.selection}
}
export function registerHealthParticipantQualification(app,pool){
 const base='/api/admin/payroll/employees/:employeeId/health-qualification/:planId'
 const endpoint=(write,work)=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');if(write)await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId]);const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain employee health qualification.'})}finally{db.release()}}
 app.get(base,endpoint(false,(db,req)=>healthParticipantState(db,req.canonicalAccess.facilityId,req.params.employeeId,req.params.planId,req.query.paymentDate)))
 app.post(base,endpoint(true,async(db,req)=>{
  const b=req.body||{},facility=req.canonicalAccess.facilityId,employeeId=req.params.employeeId,planId=req.params.planId
  if(!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!['ELIGIBLE','SUSPENDED'].includes(b.disposition)||!validDay(b.effectiveOn)||!validDay(b.effectiveThrough)||b.effectiveThrough<b.effectiveOn||b.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<20||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm the dated employee qualification, current revision and supporting review reference.')
  if(b.disposition==='ELIGIBLE'&&confirmations.some(key=>b[key]!==true))throw fail('Confirm employee/ownership eligibility, qualified covered persons, election rules and applicable nondiscrimination findings.')
  if(b.disposition==='ELIGIBLE'&&(!['INITIAL_ENROLLMENT','OPEN_ENROLLMENT','PERMITTED_CHANGE'].includes(b.electionBasis)||!validDay(b.electionDeadline)||b.electionDeadline>b.effectiveOn||typeof b.employeeElectionExplanation!=='string'||b.employeeElectionExplanation.trim().length<20||b.employeeElectionExplanation.length>2000))throw fail('Retain the permitted election basis, prospective signing deadline and employee-facing explanation.')
  const review={disposition:b.disposition,effectiveOn:b.effectiveOn,effectiveThrough:b.effectiveThrough,reference:b.reference.trim(),...(b.disposition==='ELIGIBLE'?{...Object.fromEntries(confirmations.map(key=>[key,true])),electionBasis:b.electionBasis,electionDeadline:b.electionDeadline,employeeElectionExplanation:b.employeeElectionExplanation.trim()}:{})},digest=hash({employeeId,planId,sourceFingerprint:b.sourceFingerprint,expectedRevision:b.expectedRevision,review})
  const old=(await db.query('SELECT id,request_fingerprint FROM payroll_health_participant_qualification WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(old){if(old.request_fingerprint!==digest)throw fail('This request key belongs to a different employee qualification.',409);return {id:old.id,reused:true}}
  const state=await healthParticipantState(db,facility,employeeId,planId,b.effectiveOn)
  if(state.source.fingerprint!==b.sourceFingerprint||(state.history[0]?.revision||0)!==b.expectedRevision)throw fail('The employee election, plan qualification or review changed. Reload before saving.',409)
  if(!state.source.onboardingCycle)throw fail('Reconcile the employee onboarding cycle before saving qualification.',409)
  if(b.disposition==='ELIGIBLE'&&state.source.issues.length)throw fail(state.source.issues.join(' '),409)
  const id=randomUUID()
  await db.query('INSERT INTO payroll_health_participant_qualification(id,facility_id,employee_id,onboarding_cycle,plan_id,revision,effective_on,effective_through,source_fingerprint,source,review,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[id,facility,employeeId,state.source.onboardingCycle,planId,b.expectedRevision+1,b.effectiveOn,b.effectiveThrough,state.source.fingerprint,state.source,review,b.requestKey,digest,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'HEALTH_PARTICIPANT_QUALIFICATION_REVIEWED','health_participant_qualification',$3,$4)",[facility,req.adminId,id,{employeeId,planId,onboardingCycle:state.source.onboardingCycle,review,sourceFingerprint:state.source.fingerprint}])
  return {id,reused:false}
 }))
}
