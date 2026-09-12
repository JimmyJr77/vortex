import {createHash,randomUUID} from 'node:crypto'
import {decryptDocument} from './onboarding.js'
import {readRetirementSftpConfiguration} from './retirementSftpSetup.js'
import {transferRetirementAllocation} from './retirementSftpTransport.js'
import {retirementAllocationUnsentProof} from './retirementAllocationUnsentProof.js'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export function registerRetirementAllocationUnsentRelease(app,pool,{transfer=transferRetirementAllocation}={}){
 const base='/api/admin/payroll/retirement-remittance-authorizations/:remittanceId/allocation-delivery/:id/release-unsent'
 const endpoint=commit=>async(req,res)=>{
  res.setHeader('Cache-Control','no-store');let db,locked=false;const facility=req.canonicalAccess.facilityId,lock=`payroll-payment-connection:${facility}`
  try{
   if(!uuid(req.params.id)||!uuid(req.params.remittanceId))throw fail('Choose a retained allocation authorization.',400)
   const b=req.body||{},reference=typeof b.reference==='string'?b.reference.trim():''
   if(commit&&(!uuid(b.requestKey)||!/^[a-f0-9]{64}$/.test(b.fingerprint||'')||b.confirmed!==true||b.outsideActivityReviewed!==true||reference.length<20||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference)))throw fail('Preview retained non-write evidence and confirm outside activity and release.',400)
   db=await pool.connect();await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true;await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
   const row=(await db.query('SELECT d.*,a.encrypted_allocation FROM payroll_retirement_allocation_authorization d JOIN payroll_retirement_remittance_authorization a ON a.id=d.remittance_id WHERE d.facility_id=$1 AND d.id=$2 AND d.remittance_id=$3',[facility,req.params.id,req.params.remittanceId])).rows[0]
   if(!row)throw fail('Allocation authorization not found.',404)
   const requestFingerprint=commit?createHash('sha256').update(JSON.stringify({id:row.id,fingerprint:b.fingerprint,reference})).digest('hex'):null
   const prior=commit?(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_allocation_unsent_release WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]:null
   if(prior){if(prior.request_fingerprint!==requestFingerprint)throw fail('Release request belongs to different retained evidence.');await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
   if((await db.query('SELECT 1 FROM payroll_retirement_allocation_cancellation WHERE authorization_id=$1',[row.id])).rowCount)throw fail('This allocation is already cancelled. Review its history.')
   const proof=await retirementAllocationUnsentProof(db,facility,row.id)
   if(commit&&(!proof.eligible||b.fingerprint!==proof.fingerprint))throw fail(proof.eligible?'Evidence changed. Preview the current non-send evidence again.':proof.reasons.join(' '))
   let remoteStatus='NOT_CHECKED'
   if(proof.eligible){
    const configuration=(await readRetirementSftpConfiguration(db,facility,row.configuration_id)).configuration,bytes=decryptDocument(row.encrypted_allocation,`payroll-retirement-remittance:${facility}:${row.remittance_id}`)
    await db.query('COMMIT')
    try{remoteStatus=(await transfer(configuration,{name:row.file_name,bytes},{mode:'VERIFY_ABSENCE'})).status}catch{remoteStatus='UNAVAILABLE'}
    await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
    const fresh=await retirementAllocationUnsentProof(db,facility,row.id)
    if(fresh.fingerprint!==proof.fingerprint)throw fail('Evidence changed during the remote check. Preview again.')
    if(remoteStatus!=='REMOTE_PATHS_ABSENT')proof.reasons.push('Both original delivery and staging paths must be verified absent. Existing files or unavailable checks require reconciliation.')
   }
   const eligible=proof.eligible&&remoteStatus==='REMOTE_PATHS_ABSENT'
   if(!commit){await db.query('COMMIT');return res.json({success:true,data:{eligible,reasons:proof.reasons,fingerprint:proof.fingerprint,remoteStatus,submissionId:proof.submissionId,observationCount:proof.snapshot.observations.length}})}
   if(!eligible)throw fail(proof.reasons.join(' '))
   const id=randomUUID();await db.query('INSERT INTO payroll_retirement_allocation_unsent_release(id,authorization_id,facility_id,submission_observation_id,evidence,reference,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,row.id,facility,proof.submissionId,{...proof.snapshot,remoteStatus,checkedAt:new Date().toISOString()},reference,b.requestKey,requestFingerprint,req.adminId])
   await db.query('INSERT INTO payroll_retirement_allocation_cancellation(id,authorization_id,request_key,request_fingerprint,reference,created_by) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),row.id,b.requestKey,requestFingerprint,reference,req.adminId])
   await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=clock_timestamp(),dismissed_by=$3 WHERE facility_id=$1 AND dedupe_key=$2",[facility,`retirement-allocation-${row.id}`,req.adminId])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_ALLOCATION_UNSENT_RELEASED','retirement_allocation_authorization',$3,$4)",[facility,req.adminId,row.id,{releaseId:id,submissionId:String(proof.submissionId)}]);await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db?.query('ROLLBACK').catch(()=>{});res.status(e.status|| (e.code==='55P03'?409:500)).json({success:false,message:e.status?e.message:e.code==='55P03'?'Employer setup is busy. Retry the release review.':'Unable to verify non-send evidence. The file remains reserved.'})}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db?.release(destroy)}
 }
 app.post(`${base}/preview`,endpoint(false));app.post(base,endpoint(true))
}
