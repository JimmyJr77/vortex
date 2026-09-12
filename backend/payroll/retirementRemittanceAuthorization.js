import {createHash,randomUUID} from 'node:crypto'
import {retirementAllocationFile} from './retirementAllocationFile.js'
import {retirementRemittanceSources} from './retirementRemittanceSources.js'
import {encryptDocument} from './onboarding.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x)
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
const reference=b=>{if(b?.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<20||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm the exact contribution action and retain its review reference.');return b.reference.trim()}
const scopedRun=async(db,facility,runId)=>{if(!/^[1-9]\d*$/.test(String(runId))||BigInt(runId)>9223372036854775807n)throw fail('Choose a payroll.');if(!(await db.query('SELECT id FROM payroll_run WHERE id=$1 AND facility_id=$2',[runId,facility])).rows.length)throw fail('Payroll not found.',404)}
export function registerRetirementRemittanceAuthorizations(app,pool,{fetcher=fetch,now=()=>new Date()}={}){
 const endpoint=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  await db.query('BEGIN');const facility=req.canonicalAccess.facilityId
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const data=await work(db,req,facility);await db.query('COMMIT');res.json({success:true,data})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain retirement remittance authorization.'})}finally{db.release()}}
 const base='/api/admin/payroll/runs/:id/retirement-remittance-authorizations'
 app.get(base,endpoint(async(db,req,facility)=>{
  await scopedRun(db,facility,req.params.id)
  const rows=(await db.query(`SELECT a.id,a.plan_id,a.amount_cents,a.basis,a.reference,a.created_at,
  (SELECT jsonb_build_object('id',r.id,'reference',r.reference,'createdAt',r.created_at) FROM payroll_retirement_bank_unsent_release r WHERE r.authorization_id=a.id) AS bank_unsent_release,
  (SELECT o.result FROM payroll_retirement_remittance_observation o WHERE o.authorization_id=a.id ORDER BY o.id DESC LIMIT 1) AS bank_result,
  c.created_at AS cancelled_at,c.reference AS cancellation_reference,EXISTS(SELECT 1 FROM payroll_retirement_remittance_claim cl WHERE cl.authorization_id=a.id) AS claimed,EXISTS(SELECT 1 FROM payroll_retirement_allocation_authorization d JOIN payroll_retirement_allocation_claim cl ON cl.authorization_id=d.id WHERE d.remittance_id=a.id AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_unsent_release r WHERE r.authorization_id=d.id)) AS allocation_claimed
  FROM payroll_retirement_remittance_authorization a LEFT JOIN payroll_retirement_remittance_cancellation c ON c.authorization_id=a.id WHERE a.facility_id=$1 AND a.run_id=$2 ORDER BY a.created_at DESC,a.id DESC`,[facility,req.params.id])).rows
  const source=(await retirementRemittanceSources(db,facility,{runId:req.params.id,limit:1,now:now()})).items[0]
  return {history:rows.map(a=>({...a,amount_cents:Number(a.amount_cents),sourceCurrent:!!source?.sourceFingerprint&&a.basis.sourceFingerprint===source.sourceFingerprint,dispatchAvailable:!a.cancelled_at,status:a.cancelled_at?'CANCELLED':a.claimed?'CLAIMED':a.allocation_claimed?'ALLOCATION_CLAIMED':'RESERVED_NOT_SENT'}))}
 }))
 app.post(base,endpoint(async(db,req,facility)=>{
  const b=req.body||{},ref=reference(b);await scopedRun(db,facility,req.params.id)
  if(!uuid(b.requestKey)||typeof b.planId!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(b.planId)||!Number.isSafeInteger(b.amountCents)||b.amountCents<=0||!['sourceFingerprint','fileFingerprint'].every(k=>typeof b[k]==='string'&&/^[a-f0-9]{64}$/.test(b[k]))||b.outsideActivityReviewed!==true)throw fail('Review the exact allocation file and amount, and verify no outside contributions, pending instructions or duplicate allocation submissions exist for these deductions.')
  const requestFingerprint=hash({runId:String(req.params.id),planId:b.planId,amountCents:b.amountCents,sourceFingerprint:b.sourceFingerprint,fileFingerprint:b.fileFingerprint,reference:ref,outsideActivityReviewed:true})
  const prior=(await db.query('SELECT a.id,a.request_fingerprint,EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation c WHERE c.authorization_id=a.id) AS cancelled FROM payroll_retirement_remittance_authorization a WHERE a.facility_id=$1 AND a.request_key=$2',[facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==requestFingerprint)throw fail('Request key belongs to different remittance evidence.',409);return {id:prior.id,reused:true,cancelled:prior.cancelled}}
  if((await db.query('SELECT a.id FROM payroll_retirement_remittance_authorization a WHERE a.facility_id=$1 AND a.run_id=$2 AND a.plan_id=$3 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation c WHERE c.authorization_id=a.id)',[facility,req.params.id,b.planId])).rows.length)throw fail('These payroll contributions are already reserved. Review the existing authorization before any replacement.',409)
  const checkedAt=now(),file=await retirementAllocationFile(db,facility,req.params.id,{planId:b.planId,sourceFingerprint:b.sourceFingerprint},{fetcher,now:checkedAt}),summary=file.summary
  if(summary.fingerprint!==b.fileFingerprint||summary.amountCents!==b.amountCents)throw fail('Allocation file or amount changed. Prepare and review it again.',409)
  if(!summary.authorizationWindowOpen||now()>=new Date(summary.timing.submissionAt))throw fail('The reviewed submission window is unavailable. Reconcile timing and any late or outside activity before authorizing.',409)
  const id=randomUUID(),basis={...summary,sourceFingerprint:b.sourceFingerprint,status:'RESERVED_NOT_SENT',outsideActivityReviewed:true}
  const encrypted=encryptDocument(Buffer.from(file.csv,'utf8'),`payroll-retirement-remittance:${facility}:${id}`)
  await db.query('INSERT INTO payroll_retirement_remittance_authorization(id,facility_id,run_id,plan_id,plan_revision_id,destination_id,format_id,timing_id,amount_cents,basis,encrypted_allocation,request_key,request_fingerprint,reference,outside_activity_reviewed,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,$15)',[id,facility,req.params.id,b.planId,summary.planRevisionId,summary.destinationRevisionId,summary.formatId,summary.timing.reviewId,summary.amountCents,basis,encrypted,b.requestKey,requestFingerprint,ref,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_REMITTANCE_AUTHORIZED','retirement_remittance_authorization',$3,$4)",[facility,req.adminId,id,{runId:req.params.id,planId:b.planId,amountCents:summary.amountCents,fileFingerprint:summary.fingerprint}])
  return {id,reused:false,cancelled:false}
 }))
 app.post('/api/admin/payroll/retirement-remittance-authorizations/:id/cancel',endpoint(async(db,req,facility)=>{
  if(!uuid(req.params.id)||!uuid(req.body?.requestKey))throw fail('Choose an authorization and valid cancellation request key.')
  const ref=reference(req.body),a=(await db.query('SELECT id FROM payroll_retirement_remittance_authorization WHERE id=$1 AND facility_id=$2',[req.params.id,facility])).rows[0]
  if(!a)throw fail('Remittance authorization not found.',404)
  const fingerprint=hash({authorizationId:a.id,reference:ref}),prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_remittance_cancellation WHERE facility_id=$1 AND request_key=$2',[facility,req.body.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==fingerprint)throw fail('Cancellation key belongs to different evidence.',409);return {id:prior.id,reused:true}}
  if((await db.query('SELECT id FROM payroll_retirement_remittance_cancellation WHERE authorization_id=$1',[a.id])).rows.length)throw fail('This authorization is already cancelled. Review its retained history.',409)
  if((await db.query('SELECT id FROM payroll_retirement_remittance_claim WHERE authorization_id=$1',[a.id])).rows.length)throw fail('Dispatch has been claimed. Resolve the provider outcome before cancellation or replacement.',409)
  if((await db.query('SELECT d.id FROM payroll_retirement_allocation_authorization d JOIN payroll_retirement_allocation_claim c ON c.authorization_id=d.id WHERE d.remittance_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_unsent_release r WHERE r.authorization_id=d.id)',[a.id])).rows.length)throw fail('Allocation file dispatch is claimed. Resolve its outcome before cancelling contributions.',409)
  const id=randomUUID();await db.query('INSERT INTO payroll_retirement_remittance_cancellation(id,facility_id,authorization_id,reference,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,facility,a.id,ref,req.body.requestKey,fingerprint,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_REMITTANCE_CANCELLED','retirement_remittance_authorization',$3,$4)",[facility,req.adminId,a.id,{cancellationId:id}]);return {id,reused:false}
 }))
}
