import {reconcileRetirementObservation} from './retirementContributionReconciliation.js'
import {checkRetirementDispatchSchedule} from './retirementDispatchScheduleState.js'
import {createHash,randomUUID} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {decryptDocument} from './onboarding.js'
import {retirementSftpHistory,readRetirementSftpConfiguration} from './retirementSftpSetup.js'
import {retirementRemittanceSources} from './retirementRemittanceSources.js'
import {retirementAllocationFile} from './retirementAllocationFile.js'
import {retirementAuthorizationBinding} from './retirementRemittanceDispatch.js'
import {transferRetirementAllocation} from './retirementSftpTransport.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x)
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
const reference=b=>{if(b?.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<20||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm the allocation action and retain its independently reviewed reference.',400);return b.reference.trim()}
async function parent(db,facility,id){
 if(!uuid(id))throw fail('Select a retained contribution authorization.',400)
 const row=(await db.query('SELECT a.*,EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation c WHERE c.authorization_id=a.id) AS cancelled FROM payroll_retirement_remittance_authorization a WHERE a.id=$1 AND a.facility_id=$2',[id,facility])).rows[0]
 if(!row)throw fail('Contribution authorization not found.',404);return row
}
const retainedFile=(a,facility)=>decryptDocument(a.encrypted_allocation,`payroll-retirement-remittance:${facility}:${a.id}`)
async function currentFile(db,facility,a,configurationId,{fetcher,now}){
 if(a.cancelled)throw fail('The contribution authorization was cancelled.')
 const state=await retirementSftpHistory(db,facility,a.plan_id),c=state.history[0]
 if(state.status!=='VERIFIED'||c?.id!==configurationId||c.plan_revision_id!==a.plan_revision_id||c.format_id!==a.format_id)throw fail('Review the current verified SFTP configuration and allocation format.')
 const checkedAt=now(),source=(await retirementRemittanceSources(db,facility,{runId:a.run_id,limit:1,now:checkedAt})).items[0]
 if(!source?.sourceFingerprint)throw fail('Reconcile finalized contribution sources before file delivery.')
 const fresh=await retirementAllocationFile(db,facility,a.run_id,{planId:a.plan_id,sourceFingerprint:source.sourceFingerprint},{fetcher,now:checkedAt}),bytes=retainedFile(a,facility)
 if(!isDeepStrictEqual(retirementAuthorizationBinding(fresh.summary),retirementAuthorizationBinding(a.basis))||!bytes.equals(Buffer.from(fresh.csv)))throw fail('Authorized allocation evidence changed. Resolve the retained contribution authorization before file delivery.')
 if(!fresh.summary.authorizationWindowOpen||now()>=new Date(a.basis.timing.submissionAt))throw fail('The reviewed file submission window is unavailable. Resolve timing and outside activity.')
 return bytes
}
export async function dispatchRetirementAllocation(pool,facility,remittanceId,id,{transfer=transferRetirementAllocation,fetcher=fetch,now=()=>new Date(),actorId=null,recoveryOnly=false,review=null,recoveryDueAt=null,scheduledId=null}={}){
 if(recoveryDueAt!==null&&(!recoveryOnly||!Number.isFinite(Date.parse(recoveryDueAt))))throw fail('Automatic recovery requires a valid observation time.',400)
 if(!uuid(id))throw fail('Select a retained allocation delivery authorization.',400)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true;await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
  const a=await parent(db,facility,remittanceId),delivery=(await db.query('SELECT d.*,EXISTS(SELECT 1 FROM payroll_retirement_allocation_claim c WHERE c.authorization_id=d.id) AS claimed,EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation x WHERE x.authorization_id=d.id) AS cancelled FROM payroll_retirement_allocation_authorization d WHERE d.id=$1 AND d.facility_id=$2 AND d.remittance_id=$3',[id,facility,a.id])).rows[0]
  if(!delivery)throw fail('Allocation authorization not found.',404)
  if(delivery.cancelled||a.cancelled)throw fail('This allocation or contribution authorization is cancelled.')
  if(recoveryDueAt){
   if(!delivery.claimed)throw fail('Automatic recovery cannot submit an unclaimed allocation.')
   const last=(await db.query('SELECT result,created_at FROM payroll_retirement_allocation_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1',[id])).rows[0]
   const created=last?.created_at||(await db.query('SELECT created_at FROM payroll_retirement_allocation_claim WHERE authorization_id=$1',[id])).rows[0].created_at
   const interval=last?.result?.status==='REMOTE_FILE_VERIFIED'?86400000:300000
   if(+new Date(created)>+new Date(recoveryDueAt)-interval){await db.query('COMMIT');return {skipped:true}}
  }
  if(scheduledId&&delivery.claimed){await db.query('COMMIT');return {skipped:true}}
  if(!delivery.claimed){const scheduled=await checkRetirementDispatchSchedule(db,facility,'FILE',id,scheduledId,now);if(scheduled?.skipped){await db.query('COMMIT');return {skipped:true}}if(scheduled)review={confirmed:true,outsideActivityReviewed:true,reference:scheduled.reference}}
  let configuration,bytes,result
  try{
   if(!delivery.claimed){
    if(recoveryOnly)throw fail('Recovery cannot submit an unclaimed file.')
    const ref=reference(review);if(review.outsideActivityReviewed!==true)throw fail('Recheck external allocation submissions and pending duplicate instructions.',400)
    bytes=await currentFile(db,facility,a,delivery.configuration_id,{fetcher,now})
    configuration=(await readRetirementSftpConfiguration(db,facility,delivery.configuration_id)).configuration
    await db.query('INSERT INTO payroll_retirement_allocation_claim(id,authorization_id,reference,created_by,scheduled_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),id,ref,actorId,scheduledId])
   }else{bytes=retainedFile(a,facility);configuration=(await readRetirementSftpConfiguration(db,facility,delivery.configuration_id)).configuration}
  }catch(e){if(!delivery.claimed)throw e;result={status:'RECOVERY_UNAVAILABLE',recordkeeperAcceptance:'UNVERIFIED'}}
  await db.query('COMMIT')
  // Existing claims always use read-only recovery, even when SUBMIT is repeated.
  if(!result)try{result=await transfer(configuration,{name:delivery.file_name,bytes},{mode:delivery.claimed?'RECOVER':'SUBMIT',beforeWrite:async()=>now()<new Date(a.basis.timing.submissionAt)})}catch{result={status:'TRANSPORT_UNCERTAIN',recordkeeperAcceptance:'UNVERIFIED'}}
  const allowed=['REMOTE_FILE_VERIFIED','REMOTE_FILE_CONFLICT','REMOTE_FILE_NOT_FOUND','STAGED_FILE_REQUIRES_REVIEW','CLAIM_NOT_CONFIRMED','STAGED_FILE_CONFLICT','TRANSPORT_UNCERTAIN','RECOVERY_UNAVAILABLE']
  const noWriteProof=!delivery.claimed&&result?.noWriteProof===true&&result?.writeAttempted===false&&result?.promotionAttempted===false&&['CLAIM_NOT_CONFIRMED','TRANSPORT_UNCERTAIN'].includes(result?.status)
  result={noWriteProof,status:allowed.includes(result?.status)?result.status:'TRANSPORT_UNCERTAIN',recordkeeperAcceptance:'UNVERIFIED',writeAttempted:result?.writeAttempted===true,promotionAttempted:result?.promotionAttempted===true}
  await db.query('BEGIN')
  await db.query('INSERT INTO payroll_retirement_allocation_observation(authorization_id,source,result,created_by,created_at,automatic) VALUES($1,$2,$3,$4,COALESCE($5::timestamptz,clock_timestamp()),$6)',[id,delivery.claimed?'RECOVERY':'SUBMISSION',result,actorId,recoveryDueAt,!!recoveryDueAt||!!scheduledId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_ALLOCATION_DELIVERY_OBSERVED','retirement_allocation_authorization',$3,$4)",[facility,actorId,id,result])
  await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Retirement allocation requires receipt review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,`retirement-allocation-${id}`,`Payroll ${a.run_id}, plan ${a.plan_id}: ${result.status.replaceAll('_',' ').toLowerCase()}. Recordkeeper acceptance and participant posting remain unverified.`])
  await reconcileRetirementObservation(db,facility,remittanceId,{actorId});await db.query('COMMIT');return {result,recovery:delivery.claimed}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(e.code==='55P03')throw fail('Employer setup is busy. Retry when its current update finishes.');throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerRetirementAllocationDelivery(app,pool,{transfer=transferRetirementAllocation,fetcher=fetch,now=()=>new Date()}={}){
 const base='/api/admin/payroll/retirement-remittance-authorizations/:remittanceId/allocation-delivery'
 const endpoint=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');let db;try{db=await pool.connect();await db.query('BEGIN');const facility=req.canonicalAccess.facilityId;await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);const a=await parent(db,facility,req.params.remittanceId),data=await work(db,req,facility,a);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db?.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain allocation delivery action.'})}finally{db?.release()}}
 app.get(base,endpoint(async(db,req,facility,a)=>{
  const setup=await retirementSftpHistory(db,facility,a.plan_id),history=(await db.query(`SELECT d.id,d.configuration_id,d.file_name,d.reference,d.created_at,c.display_configuration,
 EXISTS(SELECT 1 FROM payroll_retirement_allocation_claim cl WHERE cl.authorization_id=d.id) AS claimed,
 (SELECT jsonb_build_object('id',r.id,'reference',r.reference,'createdAt',r.created_at) FROM payroll_retirement_allocation_unsent_release r WHERE r.authorization_id=d.id) AS unsent_release,
 EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation x WHERE x.authorization_id=d.id) AS cancelled,
 (SELECT o.result || jsonb_build_object('automatic',o.automatic,'observedAt',o.created_at,'source',o.source) FROM payroll_retirement_allocation_observation o WHERE o.authorization_id=d.id ORDER BY o.id DESC LIMIT 1) AS result
 FROM payroll_retirement_allocation_authorization d JOIN payroll_retirement_sftp_configuration c ON c.id=d.configuration_id WHERE d.remittance_id=$1 AND d.facility_id=$2 ORDER BY d.created_at DESC,d.id DESC`,[a.id,facility])).rows
  return {setupStatus:setup.status,configurationId:setup.history[0]?.id||null,destination:setup.history[0]?.display_configuration||null,parentCancelled:a.cancelled,amountCents:Number(a.amount_cents),history}
 }))
 app.post(base,endpoint(async(db,req,facility,a)=>{
  const b=req.body||{},ref=reference(b)
  if(!uuid(b.requestKey)||!uuid(b.configurationId)||typeof b.fileName!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}\.csv$/.test(b.fileName)||b.fileName.includes('..')||b.outsideActivityReviewed!==true)throw fail('Review the exact filename, destination and absence of duplicate external allocation submissions.',400)
  const fingerprint=hash({remittanceId:a.id,configurationId:b.configurationId,fileName:b.fileName,reference:ref}),prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_allocation_authorization WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==fingerprint)throw fail('Request key belongs to a different allocation authorization.');return {id:prior.id,reused:true}}
  if((await db.query('SELECT d.id FROM payroll_retirement_allocation_authorization d WHERE remittance_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation c WHERE c.authorization_id=d.id)',[a.id])).rows.length)throw fail('Allocation delivery is already authorized. Review its retained history.')
  if((await db.query('SELECT id FROM payroll_retirement_allocation_authorization WHERE facility_id=$1 AND file_name=$2',[facility,b.fileName])).rows.length)throw fail('This filename is already retained. Review a new unique filename.')
  await currentFile(db,facility,a,b.configurationId,{fetcher,now})
  const id=randomUUID();await db.query('INSERT INTO payroll_retirement_allocation_authorization(id,facility_id,remittance_id,configuration_id,file_name,reference,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,facility,a.id,b.configurationId,b.fileName,ref,b.requestKey,fingerprint,req.adminId]);await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_ALLOCATION_DELIVERY_AUTHORIZED','retirement_allocation_authorization',$3,$4)",[facility,req.adminId,id,{remittanceId:a.id,configurationId:b.configurationId}]);return {id,reused:false}
 }))
 app.post(`${base}/:id/cancel`,endpoint(async(db,req,facility,a)=>{
  const b=req.body||{},ref=reference(b);if(!uuid(b.requestKey)||!uuid(req.params.id))throw fail('Select the allocation authorization and a cancellation key.',400)
  const row=(await db.query('SELECT id FROM payroll_retirement_allocation_authorization WHERE id=$1 AND facility_id=$2 AND remittance_id=$3',[req.params.id,facility,a.id])).rows[0];if(!row)throw fail('Allocation authorization not found.',404)
  const fingerprint=hash({id:row.id,reference:ref}),prior=(await db.query('SELECT request_fingerprint FROM payroll_retirement_allocation_cancellation WHERE authorization_id=$1',[row.id])).rows[0]
  if(prior){if(prior.request_fingerprint!==fingerprint)throw fail('Cancellation belongs to a different retained review.');return {reused:true}}
  if((await db.query('SELECT id FROM payroll_retirement_allocation_claim WHERE authorization_id=$1',[row.id])).rows.length)throw fail('File dispatch is claimed. Recover its outcome before any replacement.')
  await db.query('INSERT INTO payroll_retirement_allocation_cancellation(id,authorization_id,request_key,request_fingerprint,reference,created_by) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),row.id,b.requestKey,fingerprint,ref,req.adminId]);await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_ALLOCATION_DELIVERY_CANCELLED','retirement_allocation_authorization',$3,$4)",[facility,req.adminId,row.id,{remittanceId:a.id}]);return {reused:false}
 }))
 app.post(`${base}/:id/dispatch`,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const b=req.body||{};if(!['SUBMIT','RECOVER'].includes(b.action)||b.confirmed!==true)throw fail('Confirm the file delivery action.',400);res.json({success:true,data:await dispatchRetirementAllocation(pool,req.canonicalAccess.facilityId,req.params.remittanceId,req.params.id,{transfer,fetcher,now,actorId:req.adminId,recoveryOnly:b.action==='RECOVER',review:b})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'File outcome requires recovery. Do not send another allocation.'})}})
}
