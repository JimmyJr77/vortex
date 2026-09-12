import {replacementAllocationCandidates,replacementAllocationDue} from './retirementReplacementAutomationState.js'
import {isDeepStrictEqual} from 'node:util'
import {prepareRetirementReplacement} from './retirementReplacementPreview.js'
import {retirementAuthorizationBinding} from './retirementRemittanceDispatch.js'
import {readRetirementSftpConfiguration} from './retirementSftpSetup.js'
import {transferRetirementAllocation} from './retirementSftpTransport.js'
import {decryptDocument} from './onboarding.js'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
import {reconcileRetirementObservation} from './retirementContributionReconciliation.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export function retirementReplacementBinding(summary){const {fingerprint,status,receiptId,...basis}=summary;return {...basis,allocation:retirementAuthorizationBinding(basis.allocation)}}
export async function dispatchRetirementReplacementAllocation(pool,facility,id,{fetcher=fetch,paymentFetcher=fetch,reader,transfer=transferRetirementAllocation,now=()=>new Date(),actorId=null,recoveryOnly=false,review=null,automaticAt=null}={}){
 if(!uuid(id))throw fail('Choose a replacement authorization.',400)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true;await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
  const a=(await db.query("SELECT a.*,EXISTS(SELECT 1 FROM payroll_retirement_replacement_claim c WHERE c.authorization_id=a.id AND c.kind='ALLOCATION') AS claimed,EXISTS(SELECT 1 FROM payroll_retirement_replacement_cancellation c WHERE c.authorization_id=a.id) AS cancelled FROM payroll_retirement_replacement_authorization a WHERE a.id=$1 AND a.facility_id=$2",[id,facility])).rows[0]
  if(!a)throw fail('Replacement authorization not found.',404)
  if(a.cancelled)throw fail('Replacement authorization is cancelled.')
  if(automaticAt){
   const current=(await db.query(`${replacementAllocationCandidates} WHERE a.id=$1`,[id])).rows[0]
   if(!replacementAllocationDue(current,automaticAt)){await db.query('COMMIT');return {skipped:true}}
   if(actorId!==null)throw fail('Automatic processing cannot use an admin identity.',400)
   review={confirmed:true,outsideActivityReviewed:a.preview.outsideActivityReviewed,reference:a.preview.reference}
  }
  let bytes,configuration,result
  try{
   if(!a.claimed){
    if(recoveryOnly)throw fail('Recovery cannot upload an unclaimed replacement file.')
    if(review?.confirmed!==true||review.outsideActivityReviewed!==true||typeof review.reference!=='string'||review.reference.trim().length<20||review.reference.length>2000||/[\u0000-\u001f\u007f]/.test(review.reference))throw fail('Recheck outside allocation activity and confirm first replacement submission.',400)
    const fresh=await prepareRetirementReplacement(db,facility,a.original_authorization_id,a.inputs,{fetcher,paymentFetcher,reader,transfer,now,reservationId:a.id})
    bytes=decryptDocument(a.encrypted_allocation,`payroll-retirement-replacement:${facility}:${id}`)
    if(!bytes.equals(Buffer.from(fresh.csv))||!isDeepStrictEqual(retirementReplacementBinding(fresh.summary),retirementReplacementBinding(a.preview)))throw fail('Replacement instructions or source evidence changed. Review the retained authorization.')
    configuration=(await readRetirementSftpConfiguration(db,facility,a.preview.configurationId)).configuration
    await db.query("INSERT INTO payroll_retirement_replacement_claim(authorization_id,kind,created_by,review_reference,automatic) VALUES($1,'ALLOCATION',$2,$3,$4)",[id,actorId,review.reference.trim(),!!automaticAt])
   }else{bytes=decryptDocument(a.encrypted_allocation,`payroll-retirement-replacement:${facility}:${id}`);configuration=(await readRetirementSftpConfiguration(db,facility,a.preview.configurationId)).configuration}
  }catch(e){if(!a.claimed)throw e;result={status:'RECOVERY_UNAVAILABLE'}}
  await db.query('COMMIT')
  if(!result)try{result=await transfer(configuration,{name:a.file_name,bytes},{mode:a.claimed?'RECOVER':'SUBMIT',beforeWrite:async()=>now()<new Date(a.preview.timing.submissionAt)})}catch{result={status:'TRANSPORT_UNCERTAIN'}}
  const allowed=['REMOTE_FILE_VERIFIED','REMOTE_FILE_CONFLICT','REMOTE_FILE_NOT_FOUND','STAGED_FILE_REQUIRES_REVIEW','CLAIM_NOT_CONFIRMED','STAGED_FILE_CONFLICT','TRANSPORT_UNCERTAIN','RECOVERY_UNAVAILABLE']
  result={status:allowed.includes(result?.status)?result.status:'TRANSPORT_UNCERTAIN',recordkeeperAcceptance:'UNVERIFIED',noWriteProof:!a.claimed&&result?.noWriteProof===true&&result?.writeAttempted===false&&result?.promotionAttempted===false&&['CLAIM_NOT_CONFIRMED','TRANSPORT_UNCERTAIN'].includes(result?.status),writeAttempted:result?.writeAttempted===true,promotionAttempted:result?.promotionAttempted===true}
  await db.query('BEGIN')
  await db.query("INSERT INTO payroll_retirement_replacement_observation(authorization_id,kind,source,result,created_by,automatic) VALUES($1,'ALLOCATION',$2,$3,$4,$5)",[id,a.claimed?'RECOVERY':'SUBMISSION',result,actorId,!!automaticAt])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_REPLACEMENT_FILE_OBSERVED','retirement_replacement_authorization',$3,$4)",[facility,actorId,id,result])
  await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Replacement allocation requires receipt review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,title=EXCLUDED.title,message=EXCLUDED.message",[facility,`retirement-replacement-file-${id}`,`Replacement allocation: ${result.status.replaceAll('_',' ')}. Replacement funding and participant acceptance remain unverified.`])
  await reconcileRetirementObservation(db,facility,a.original_authorization_id,{actorId});await db.query('COMMIT');return {result,recovery:a.claimed}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(e.code==='55P03')throw fail('Employer setup is busy. Retry replacement delivery.');throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerRetirementReplacementAllocation(app,pool,options){
 app.post('/api/admin/payroll/retirement-replacement-authorizations/:id/allocation-dispatch',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');try{const b=req.body;if(b?.confirmed!==true||!['SUBMIT','RECOVER'].includes(b.action))throw fail('Confirm replacement file submission or recovery.',400);res.json({success:true,data:await dispatchRetirementReplacementAllocation(pool,req.canonicalAccess.facilityId,req.params.id,{...options,actorId:req.adminId,recoveryOnly:b.action==='RECOVER',review:b})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Replacement file outcome needs recovery. Do not upload another copy.'})}
 })
}
