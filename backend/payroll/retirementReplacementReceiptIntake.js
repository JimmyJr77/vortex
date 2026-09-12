import {reconcileRetirementObservation} from './retirementContributionReconciliation.js'
import {createHash,randomUUID} from 'node:crypto'
import {retirementReplacementReceiptBindingState} from './retirementReplacementReceiptBinding.js'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
import {readRetirementSftpConfiguration} from './retirementSftpSetup.js'
import {readRetirementSftpReceipt} from './retirementSftpTransport.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {reconcileRetirementAllocationReceipt} from './retirementAllocationReceipt.js'
import {retirementReceiptEvolution} from './retirementReceiptEvolution.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const context=(facility,id,kind)=>`payroll-retirement-replacement-receipt:${facility}:${id}:${kind}`
export async function checkRetirementReplacementReceipt(pool,facility,allocationId,{bindingId,requestKey,actorId,automaticDueAt,reader=readRetirementSftpReceipt,now=()=>new Date()}={}){
 if(!uuid(bindingId)||!uuid(requestKey))throw fail('Use the reviewed receipt binding and a valid check identity.',400)
 const fingerprint=createHash('sha256').update(JSON.stringify({allocationId,bindingId})).digest('hex'),db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true;await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
  const state=await retirementReplacementReceiptBindingState(db,facility,allocationId),binding=state.history[0]
  const prior=(await db.query('SELECT id,summary,request_fingerprint FROM payroll_retirement_replacement_receipt_observation WHERE facility_id=$1 AND request_key=$2',[facility,requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==fingerprint)throw fail('Receipt check identity belongs to different evidence.');await db.query('COMMIT');return {id:prior.id,summary:prior.summary,reused:true}}
  if(automaticDueAt){
   if(actorId!=null)throw fail('Automatic receipt checks cannot name a human actor.',400)
   const recent=(await db.query("SELECT 1 FROM payroll_retirement_replacement_receipt_observation WHERE allocation_id=$1 AND sequence=(SELECT max(sequence) FROM payroll_retirement_replacement_receipt_observation WHERE allocation_id=$1) AND created_at>$2::timestamptz-CASE WHEN summary->>'status'='POSTED' THEN interval '24 hours' ELSE interval '5 minutes' END",[allocationId,automaticDueAt])).rowCount
   if(recent||state.status!=='BOUND'||binding?.id!==bindingId){await db.query('COMMIT');return {skipped:true}}
  }
  if(state.status!=='BOUND'||binding.id!==bindingId)throw fail('Review the active receipt binding before checking its outcome.')
  const contract=state.contracts.find(c=>c.id===binding.contract_id)?.contract
  if(!contract)throw fail('Original receipt interpretation contract is unavailable.')
  const source=(await db.query("SELECT preview->'allocation' AS basis,encrypted_allocation,original_authorization_id FROM payroll_retirement_replacement_authorization WHERE id=$1 AND facility_id=$2",[allocationId,facility])).rows[0]
  let configuration,allocationBytes,credentialFailure=false
  try{configuration=(await readRetirementSftpConfiguration(db,facility,state.source.configuration_id)).configuration;allocationBytes=decryptDocument(source.encrypted_allocation,`payroll-retirement-replacement:${facility}:${allocationId}`)}catch{credentialFailure=true}
  await db.query('COMMIT')
  let remote={status:'UNAVAILABLE'}
  if(!credentialFailure)try{remote=await reader(configuration,{directory:binding.directory,fileName:binding.file_name})}catch{remote={status:'UNAVAILABLE'}}
  if(!['READ','NOT_FOUND','CHANGED','UNSUPPORTED','UNAVAILABLE'].includes(remote?.status))remote={status:'UNAVAILABLE'}
  if(remote.status==='READ'&&(!Buffer.isBuffer(remote.bytes)||!remote.bytes.length||remote.bytes.length>10*1024*1024||remote.sha256!==createHash('sha256').update(remote.bytes).digest('hex')))remote={status:'CHANGED'}
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
  const current=await retirementReplacementReceiptBindingState(db,facility,allocationId)
  let result=null,decision='NOT_EVALUATED',summary={status:credentialFailure?'CREDENTIALS_UNAVAILABLE':`RECEIPT_${remote.status}`,decision}
  if(current.status!=='BOUND'||current.history[0]?.id!==bindingId)summary={status:'BINDING_CHANGED',decision}
  else if(remote.status==='READ'){
   try{
    result=reconcileRetirementAllocationReceipt({receiptBytes:remote.bytes,contract,allocationBytes,basis:source.basis,fileName:state.source.file_name,claimedAt:state.source.claimed_at,now:now()})
    const last=(await db.query("SELECT id,encrypted_result FROM payroll_retirement_replacement_receipt_observation WHERE facility_id=$1 AND allocation_id=$2 AND decision='RECONCILED' ORDER BY sequence DESC LIMIT 1",[facility,allocationId])).rows[0]
    const previous=last?JSON.parse(decryptDocument(last.encrypted_result,context(facility,last.id,'result')).toString()):null
    if(result.participants.some(p=>p.status==='REVERSED'))throw fail('A replacement reversal requires separate returned-funding reconciliation.')
    const evolution=retirementReceiptEvolution(previous,result)
    decision=['CURRENT','UNCHANGED'].includes(evolution)?'RECONCILED':evolution
    summary={status:decision==='RECONCILED'?result.status:decision,decision,evolution,authorizedCents:result.authorizedCents,reportedCents:result.reportedCents,postedCents:result.postedCents,rejectedCents:result.rejectedCents,unreportedCents:result.unreportedCents,participantCount:result.participants.length,...(result.reversedAllocationCents!==undefined?{reversedAllocationCents:result.reversedAllocationCents}:{})}
   }catch{decision='RECONCILIATION_REQUIRED';summary={status:'RECONCILIATION_REQUIRED',decision};result=null}
  }
  const id=randomUUID(),encryptedReceipt=remote.status==='READ'?encryptDocument(remote.bytes,context(facility,id,'file')):null,encryptedResult=result?encryptDocument(Buffer.from(JSON.stringify(result)),context(facility,id,'result')):null
  await db.query('INSERT INTO payroll_retirement_replacement_receipt_observation(id,facility_id,allocation_id,binding_id,request_key,request_fingerprint,transport_status,decision,summary,encrypted_receipt,encrypted_result,created_by,automatic,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14::timestamptz,clock_timestamp()))',[id,facility,allocationId,bindingId,requestKey,fingerprint,remote.status,decision,summary,encryptedReceipt,encryptedResult,actorId??null,!!automaticDueAt,automaticDueAt??null])
  await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Retirement receipt requires reconciliation',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,`retirement-replacement-receipt-${allocationId}`,`Receipt outcome: ${summary.status.replaceAll('_',' ')}. Bank settlement and full contribution reconciliation remain separate.`])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_REPLACEMENT_RECEIPT_CHECKED','retirement_replacement_receipt_observation',$3,$4)",[facility,actorId,id,{allocationId,bindingId,status:summary.status,automatic:!!automaticDueAt}]);await reconcileRetirementObservation(db,facility,source.original_authorization_id,{actorId});await db.query('COMMIT');return {id,summary,reused:false}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(e.code==='55P03')throw fail('Employer setup is busy. Retry receipt review.');throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerRetirementReplacementReceiptIntake(app,pool,{reader=readRetirementSftpReceipt,now=()=>new Date()}={}){
 const base='/api/admin/payroll/retirement-replacement-authorizations/:id/receipts'
 app.get(base,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const facility=req.canonicalAccess.facilityId,state=await retirementReplacementReceiptBindingState(pool,facility,req.params.id),history=(await pool.query('SELECT id,binding_id,transport_status,decision,summary,automatic,created_at FROM payroll_retirement_replacement_receipt_observation WHERE facility_id=$1 AND allocation_id=$2 ORDER BY sequence DESC',[facility,req.params.id])).rows;res.json({success:true,data:{bindingStatus:state.status,bindingId:state.history[0]?.id||null,history}})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load receipt outcomes.'})}})
 app.post(base,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{if(req.body?.confirmed!==true)throw fail('Confirm the receipt check.',400);res.json({success:true,data:await checkRetirementReplacementReceipt(pool,req.canonicalAccess.facilityId,req.params.id,{bindingId:req.body.bindingId,requestKey:req.body.requestKey,actorId:req.adminId,reader,now})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Receipt check was not retained. Retry the original check.'})}})
}
