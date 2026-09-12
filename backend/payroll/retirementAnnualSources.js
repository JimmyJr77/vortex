import {createHash,randomUUID} from 'node:crypto'
import {retirementAnnualInput} from './retirementAnnualInput.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
async function scope(db,facility,employeeId,planId){
 if(!(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employeeId])).rowCount)throw fail('Employee not found.',404)
 const plan=(await db.query('SELECT id,revision,plan,plan_fingerprint FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]
 if(!plan)throw fail('Retirement plan not found.',404);return plan
}
export function registerRetirementAnnualSources(app,pool,{now=()=>new Date()}={}){
 const path='/api/admin/payroll/employees/:employeeId/retirement-annual-sources/:planId'
 app.get(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const facility=req.canonicalAccess.facilityId,plan=await scope(db,facility,req.params.employeeId,req.params.planId),history=(await db.query('SELECT id,revision,plan_revision_id,facts,created_at FROM payroll_retirement_annual_source WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 AND tax_year=2026 ORDER BY revision DESC',[facility,req.params.employeeId,req.params.planId])).rows;await db.query('COMMIT');res.json({success:true,data:{planRevisionId:plan.id,planName:plan.plan.name,history,status:history[0]?.plan_revision_id===plan.id?'REVIEW_RETAINED':'REVIEW_REQUIRED'}})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read annual retirement sources.'})}finally{db.release()}
 })
 app.post(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId,facts=retirementAnnualInput(b.facts)
   if(!uuid(b.requestKey)||!uuid(b.planRevisionId)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)throw fail('Use the current plan/source revisions and a valid request key.')
   const digest=hash({employeeId:req.params.employeeId,planId:req.params.planId,facts,planRevisionId:b.planRevisionId,expectedRevision:b.expectedRevision})
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_annual_source WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
   if(prior){if(prior.request_fingerprint!==digest)throw fail('This request key belongs to different annual evidence.',409);await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
   const plan=await scope(db,facility,req.params.employeeId,req.params.planId)
   if(plan.id!==b.planRevisionId)throw fail('Plan terms changed. Review current annual evidence.',409)
   const today=(await db.query('SELECT ($2::timestamptz AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[facility,now()])).rows[0].today
   if(facts.asOfDate>today)throw fail('Annual source evidence cannot be dated in the future.')
   const latest=(await db.query('SELECT revision FROM payroll_retirement_annual_source WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,req.params.employeeId,req.params.planId])).rows[0]
   if((latest?.revision||0)!==b.expectedRevision)throw fail('Another annual review was retained. Reload current history.',409)
   const id=randomUUID()
   await db.query('INSERT INTO payroll_retirement_annual_source(id,facility_id,employee_id,plan_id,tax_year,revision,plan_revision_id,facts,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,2026,$5,$6,$7,$8,$9,$10)',[id,facility,req.params.employeeId,req.params.planId,b.expectedRevision+1,plan.id,facts,b.requestKey,digest,req.adminId])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_ANNUAL_SOURCES_REVIEWED','retirement_annual_source',$3,$4)",[facility,req.adminId,id,{employeeId:req.params.employeeId,planId:req.params.planId,revision:b.expectedRevision+1,factsFingerprint:facts.fingerprint}])
   await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain annual retirement sources.'})}finally{db.release()}
 })
}
