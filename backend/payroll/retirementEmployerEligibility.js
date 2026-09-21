import {createHash,randomUUID} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {retirementEligibilitySource} from './retirementEligibility.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const day=value=>typeof value==='string'&&/^2026-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
export async function retirementEmployerEligibilitySource(db,facility,employeeId,planId){
 const participant=await retirementEligibilitySource(db,facility,employeeId,planId)
 const employee=(await db.query('SELECT employment_status,termination_date::text FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employeeId])).rows[0]
 const periods=(await db.query('SELECT id,started_on::text,ended_on::text FROM payroll_employment_period WHERE facility_id=$1 AND employee_id=$2 ORDER BY started_on,id',[facility,employeeId])).rows
 const plan=(await db.query('SELECT plan FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND id=$2',[facility,participant.planRevisionId])).rows[0].plan
 const {fingerprint:participantFingerprint,...identity}=participant
 const source={...identity,participantFingerprint,employmentStatus:employee.employment_status,terminationDate:employee.termination_date,employmentPeriods:periods,employerContributions:plan.employerContributions,employerFormula:plan.employerFormula||null}
 return {...source,fingerprint:hash(source)}
}
export function retirementEmployerEligibilityInput(body,source){
 const b=body||{}
 if(b.confirmed!==true||b.sourceFingerprint!==source.fingerprint)throw fail('Confirm the current employer eligibility source evidence.',409)
 if(!source.employerFormula||!['MATCH','NONELECTIVE','MATCH_AND_NONELECTIVE'].includes(source.employerContributions))throw fail('Retain a structured employer funding formula before reviewing participant employer eligibility.')
 if(!day(b.assessedThrough))throw fail('Review the date through which employer eligibility and vesting were assessed.')
 if(typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Retain the employer eligibility and vesting evidence reference.')
 const result={assessedThrough:b.assessedThrough,reference:b.reference.trim()}
 for(const key of ['matching','nonelective']){
  const applicable=key==='matching'?source.employerContributions!=='NONELECTIVE':source.employerContributions!=='MATCH',r=b[key]
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==3||!['status','eligibleOn','vestedBps'].every(field=>Object.hasOwn(r,field))||!['ELIGIBLE','NOT_ELIGIBLE','REVIEW_REQUIRED','NOT_APPLICABLE'].includes(r.status))throw fail('Review employer matching and nonelective eligibility separately.')
  if(applicable?r.status==='NOT_APPLICABLE':r.status!=='NOT_APPLICABLE')throw fail('Employer eligibility must agree with the retained contribution formula.')
  if(r.status==='ELIGIBLE'){
   if(!day(r.eligibleOn)||r.eligibleOn<source.hireDate||r.eligibleOn<source.planEffectiveOn||r.eligibleOn>b.assessedThrough||!Number.isSafeInteger(r.vestedBps)||r.vestedBps<0||r.vestedBps>10000)throw fail('Review each eligible employer contribution’s entry date and vesting percentage.')
  }else if(r.eligibleOn!==null||r.vestedBps!==null)throw fail('Unconfirmed employer eligibility cannot retain an entry date or vesting percentage.')
  result[key]={status:r.status,eligibleOn:r.eligibleOn,vestedBps:r.vestedBps}
 }
 return result
}
export function registerRetirementEmployerEligibility(app,pool){
 const path='/api/admin/payroll/employees/:employeeId/retirement-employer-eligibility/:planId'
 app.get(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   const facility=req.canonicalAccess.facilityId,source=await retirementEmployerEligibilitySource(db,facility,req.params.employeeId,req.params.planId)
   const rows=(await db.query('SELECT id,revision,source_fingerprint,review,created_at FROM payroll_retirement_employer_eligibility WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY revision DESC',[facility,req.params.employeeId,req.params.planId])).rows
   const history=rows.map((row,index)=>({...row,status:row.source_fingerprint!==source.fingerprint?'STALE':index===0?'CURRENT':'SUPERSEDED'}))
   await db.query('COMMIT');res.json({success:true,data:{source,history}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read employer retirement eligibility.'})}finally{db.release()}
 })
 app.post(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId
   if(!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)throw fail('Use the current employer eligibility revision and a valid request key.')
   const digest=hash({employeeId:req.params.employeeId,planId:req.params.planId,body:b})
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_employer_eligibility WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
   if(prior){if(prior.request_fingerprint!==digest)throw fail('This request key belongs to different employer eligibility evidence.',409);await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
   const source=await retirementEmployerEligibilitySource(db,facility,req.params.employeeId,req.params.planId),review=retirementEmployerEligibilityInput(b,source)
   const today=(await db.query('SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].today
   if(review.assessedThrough>today)throw fail('Employer eligibility cannot be assessed through a future date.')
   const latest=(await db.query('SELECT COALESCE(max(revision),0)::int AS revision FROM payroll_retirement_employer_eligibility WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3',[facility,req.params.employeeId,req.params.planId])).rows[0].revision
   if(latest!==b.expectedRevision)throw fail('Another employer eligibility review was retained. Reload history.',409)
   const id=randomUUID()
   await db.query('INSERT INTO payroll_retirement_employer_eligibility(id,facility_id,employee_id,plan_id,plan_revision_id,revision,source_fingerprint,source,review,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id,facility,req.params.employeeId,req.params.planId,source.planRevisionId,latest+1,source.fingerprint,source,review,b.requestKey,digest,req.adminId])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_EMPLOYER_ELIGIBILITY_REVIEWED','retirement_employer_eligibility',$3,$4)",[facility,req.adminId,id,{employeeId:req.params.employeeId,planId:req.params.planId,revision:latest+1,sourceFingerprint:source.fingerprint}])
   await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain employer retirement eligibility.'})}finally{db.release()}
 })
}
