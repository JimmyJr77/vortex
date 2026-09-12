import {createHash,randomUUID} from 'node:crypto'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
export const retirementProcessingPolicies={compensation415:'RECONCILED_STANDARD_GROSS_WAGES',allocation:'PROPORTIONAL_LARGEST_REMAINDER_PRETAX_TIE',bonusAllocation:'PROPORTIONAL_INCLUDED_WAGES_HALF_UP',affordability:'RECALCULATE_TAXES_EXCLUDE_REIMBURSEMENTS',fixedElection:'REGULAR_PAY_ONLY'}
export function retirementProcessingInput(body){
 const b=body||{}
 if(b.confirmed!==true||!['REVIEWED','SUSPENDED'].includes(b.disposition)||typeof b.catchUpAuthorized!=='boolean')throw fail('Confirm processing disposition and catch-up treatment explicitly.')
 if(b.disposition==='SUSPENDED'&&b.catchUpAuthorized)throw fail('Suspended processing cannot authorize catch-up.')
 if(typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Retain the processing policy review reference.')
 if(!b.policies||Object.keys(b.policies).length!==Object.keys(retirementProcessingPolicies).length||Object.entries(retirementProcessingPolicies).some(([key,value])=>b.policies[key]!==value))throw fail('Review the current payroll processing policies.')
 return {version:1,disposition:b.disposition,catchUpAuthorized:b.catchUpAuthorized,reference:b.reference.trim(),policies:{...retirementProcessingPolicies}}
}
export function registerRetirementProcessingReview(app,pool){
 const path='/api/admin/payroll/retirement-plans/:planId/processing-review'
 const plan=async(db,facility,id)=>{const row=(await db.query('SELECT id,plan FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,id])).rows[0];if(!row)throw fail('Retirement plan not found.',404);return row}
 app.get(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const facility=req.canonicalAccess.facilityId,p=await plan(db,facility,req.params.planId),history=(await db.query('SELECT id,revision,plan_revision_id,review,created_at FROM payroll_retirement_processing_review WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC',[facility,req.params.planId])).rows;await db.query('COMMIT');res.json({success:true,data:{planRevisionId:p.id,planName:p.plan.name,policies:retirementProcessingPolicies,history,status:history[0]?.plan_revision_id===p.id?history[0].review.disposition:'REVIEW_REQUIRED',executionStatus:'REGULAR_PAYROLL_SOURCE_REVIEW_REQUIRED'}})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read retirement processing review.'})}finally{db.release()}
 })
 app.post(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId,review=retirementProcessingInput(b.review)
   if(!uuid(b.requestKey)||!uuid(b.planRevisionId)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)throw fail('Use current processing revisions and a valid request key.')
   const digest=createHash('sha256').update(JSON.stringify({planId:req.params.planId,planRevisionId:b.planRevisionId,expectedRevision:b.expectedRevision,review})).digest('hex')
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_processing_review WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
   if(prior){if(prior.request_fingerprint!==digest)throw fail('This request key belongs to another processing review.',409);await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
   const p=await plan(db,facility,req.params.planId)
   if(p.id!==b.planRevisionId)throw fail('Plan terms changed. Review current processing policies.',409)
   if(review.catchUpAuthorized&&!p.plan.allowsCatchUp)throw fail('This plan does not permit catch-up contributions.')
   const latest=(await db.query('SELECT revision FROM payroll_retirement_processing_review WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC LIMIT 1',[facility,req.params.planId])).rows[0]
   if((latest?.revision||0)!==b.expectedRevision)throw fail('Another processing review was saved. Reload history.',409)
   const id=randomUUID()
   await db.query('INSERT INTO payroll_retirement_processing_review(id,facility_id,plan_id,plan_revision_id,revision,review,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,facility,req.params.planId,p.id,b.expectedRevision+1,review,b.requestKey,digest,req.adminId])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_PROCESSING_REVIEWED','retirement_processing_review',$3,$4)",[facility,req.adminId,id,{planId:req.params.planId,revision:b.expectedRevision+1,disposition:review.disposition}])
   await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain processing review.'})}finally{db.release()}
 })
}
