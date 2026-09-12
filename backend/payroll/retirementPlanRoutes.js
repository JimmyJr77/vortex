import {retirementRemittanceSources} from './retirementRemittanceSources.js'
import {createHash,randomUUID} from 'node:crypto'
import {retirementPlanInput} from './retirementPlanInput.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
export async function retirementPlanHistory(db,facility){
 const rows=(await db.query('SELECT id,plan_id,revision,effective_on::text,plan,created_at FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND tax_year=2026 ORDER BY plan_id,revision DESC',[facility])).rows
 return rows.map(row=>({id:row.id,planId:row.plan_id,revision:row.revision,effectiveOn:row.effective_on,plan:row.plan,createdAt:new Date(row.created_at).toISOString()}))
}
// A retained plan review is not an executable deduction setup.
export function registerRetirementPlanRoutes(app,pool,{now=()=>new Date()}={}){
 const base='/api/admin/payroll/retirement-plans'
 app.get('/api/admin/payroll/retirement-remittance-sources',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   const data=await retirementRemittanceSources(db,req.canonicalAccess.facilityId,{now:now(),beforeRunId:req.query.beforeRunId??null,limit:req.query.limit===undefined?20:Number(req.query.limit)})
   await db.query('COMMIT');res.json({success:true,data})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to reconcile retirement remittance sources.'})}finally{db.release()}
 })
 app.get(base,async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{res.json({success:true,data:{taxYear:2026,history:await retirementPlanHistory(pool,req.canonicalAccess.facilityId)}})}catch{res.status(500).json({success:false,message:'Unable to read retirement plan review history.'})}
 })
 app.post(base,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},plan=retirementPlanInput(b.plan),facility=req.canonicalAccess.facilityId
   if(!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)throw fail('Use the current plan revision and a valid review request key.')
   const digest=hash({plan,expectedRevision:b.expectedRevision})
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
   if(prior){if(prior.request_fingerprint!==digest)throw fail('This request key already belongs to different plan evidence.',409);await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
   const latest=(await db.query('SELECT revision FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND tax_year=2026 AND plan_id=$2 ORDER BY revision DESC LIMIT 1',[facility,plan.planId])).rows[0]
   if((latest?.revision||0)!==b.expectedRevision)throw fail('Another retirement plan review was saved. Reload the latest revision.',409)
   const id=randomUUID()
   await db.query('INSERT INTO payroll_retirement_plan_revision(id,facility_id,tax_year,plan_id,revision,effective_on,plan,plan_fingerprint,request_key,request_fingerprint,created_by) VALUES($1,$2,2026,$3,$4,$5,$6,$7,$8,$9,$10)',[id,facility,plan.planId,b.expectedRevision+1,plan.effectiveOn,plan,plan.fingerprint,b.requestKey,digest,req.adminId])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_PLAN_REVIEWED','retirement_plan_revision',$3,$4)",[facility,req.adminId,id,{planId:plan.planId,revision:b.expectedRevision+1,planFingerprint:plan.fingerprint}])
   await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain retirement plan review.'})}finally{db.release()}
 })
}
