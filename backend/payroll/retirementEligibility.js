import {createHash,randomUUID} from 'node:crypto'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const day=value=>typeof value==='string'&&/^2026-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
export function retirementEligibilityInput(body,source){
 const b=body||{}
 if(b.confirmed!==true||!['ELIGIBLE','NOT_ELIGIBLE','REVIEW_REQUIRED'].includes(b.disposition))throw fail('Review participant eligibility explicitly.')
 if(b.sourceFingerprint!==source.fingerprint)throw fail('Plan or employment evidence changed. Reload the eligibility review.',409)
 for(const field of ['reference','employeeExplanation'])if(typeof b[field]!=='string'||b[field].trim().length<12||b[field].length>2000||/[\u0000-\u001f\u007f]/.test(b[field]))throw fail('Provide eligibility evidence and an explanation for the employee.')
 if(!Array.isArray(b.methods)||new Set(b.methods).size!==b.methods.length||b.methods.some(m=>!['PERCENTAGE','FIXED_PER_REGULAR_PAY'].includes(m)))throw fail('Review permitted election methods.')
 if(b.disposition==='ELIGIBLE'){
  if(!day(b.eligibleOn)||b.eligibleOn<source.planEffectiveOn||b.eligibleOn<source.hireDate||!b.methods.length)throw fail('Use an eligible entry date after the plan and employment start, with permitted election methods.')
 }else if(b.eligibleOn!==null||b.methods.length)throw fail('Unconfirmed eligibility cannot offer election methods or an entry date.')
 return {disposition:b.disposition,eligibleOn:b.eligibleOn,methods:[...b.methods].sort(),reference:b.reference.trim(),employeeExplanation:b.employeeExplanation.trim()}
}
export async function retirementEligibilitySource(db,facility,employeeId,planId){
 const employee=(await db.query('SELECT id,hire_date::text FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employeeId])).rows[0]
 if(!employee)throw fail('Employee not found.',404)
 const cycles=(await db.query('SELECT DISTINCT onboarding_cycle FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2',[facility,employeeId])).rows
 if(cycles.length!==1)throw fail('Review the current employee onboarding cycle before retirement eligibility.',409)
 const plan=(await db.query('SELECT id,revision,plan_fingerprint,effective_on::text FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]
 if(!plan)throw fail('Retirement plan not found.',404)
 const source={facilityId:String(facility),employeeId:String(employeeId),onboardingCycle:cycles[0].onboarding_cycle,hireDate:employee.hire_date,planId,planRevisionId:plan.id,planRevision:plan.revision,planFingerprint:plan.plan_fingerprint,planEffectiveOn:plan.effective_on}
 return {...source,fingerprint:hash(source)}
}
export function registerRetirementEligibilityRoutes(app,pool){
 const path='/api/admin/payroll/employees/:employeeId/retirement-eligibility/:planId'
 app.get(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   const facility=req.canonicalAccess.facilityId,source=await retirementEligibilitySource(db,facility,req.params.employeeId,req.params.planId)
   const history=(await db.query('SELECT id,revision,onboarding_cycle,source_fingerprint,review,created_at FROM payroll_retirement_eligibility WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY revision DESC',[facility,req.params.employeeId,req.params.planId])).rows
   const current=history[0]||null
   await db.query('COMMIT');res.json({success:true,data:{source,history,currentStatus:current?.source_fingerprint===source.fingerprint?current.review.disposition:'REVIEW_REQUIRED'}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read retirement eligibility.'})}finally{db.release()}
 })
 app.post(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId
   if(!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)throw fail('Use the current eligibility revision and a valid request key.')
   const digest=hash({employeeId:req.params.employeeId,planId:req.params.planId,body:b})
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_eligibility WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
   if(prior){if(prior.request_fingerprint!==digest)throw fail('This request key belongs to different eligibility evidence.',409);await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
   const source=await retirementEligibilitySource(db,facility,req.params.employeeId,req.params.planId),review=retirementEligibilityInput(b,source)
   const latest=(await db.query('SELECT revision FROM payroll_retirement_eligibility WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY revision DESC LIMIT 1',[facility,req.params.employeeId,req.params.planId])).rows[0]
   if((latest?.revision||0)!==b.expectedRevision)throw fail('Another eligibility review was retained. Reload current history.',409)
   const id=randomUUID()
   await db.query('INSERT INTO payroll_retirement_eligibility(id,facility_id,employee_id,plan_id,onboarding_cycle,revision,plan_revision_id,source_fingerprint,source,review,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,facility,req.params.employeeId,req.params.planId,source.onboardingCycle,b.expectedRevision+1,source.planRevisionId,source.fingerprint,source,review,b.requestKey,digest,req.adminId])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_ELIGIBILITY_REVIEWED','retirement_eligibility',$3,$4)",[facility,req.adminId,id,{employeeId:req.params.employeeId,planId:req.params.planId,revision:b.expectedRevision+1,disposition:review.disposition}])
   await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain retirement eligibility.'})}finally{db.release()}
 })
}
