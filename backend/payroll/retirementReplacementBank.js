import {replacementBankCandidates,replacementBankDue} from './retirementReplacementBankAutomationState.js'
import {isDeepStrictEqual} from 'node:util'
import {prepareRetirementReplacement} from './retirementReplacementPreview.js'
import {retirementReplacementBinding} from './retirementReplacementAllocation.js'
import {retirementReplacementBankInstruction} from './retirementReplacementBankInstruction.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readRetirementDestination} from './retirementDestination.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {modernTreasuryRetirementInstruction,submitModernTreasuryRetirementPayment,readModernTreasuryRetirementPayment} from './modernTreasuryRetirementPayments.js'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
import {reconcileRetirementObservation} from './retirementContributionReconciliation.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const context=(facility,id)=>`payroll-retirement-replacement-bank:${facility}:${id}`
export async function dispatchRetirementReplacementBank(pool,facility,id,{fetcher=fetch,paymentFetcher=fetch,reader,transfer,now=()=>new Date(),actorId=null,recoveryOnly=false,review=null,automaticAt=null}={}){
 if(!uuid(id))throw fail('Choose a replacement authorization.',400)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true;await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
  const a=(await db.query('SELECT a.*,EXISTS(SELECT 1 FROM payroll_retirement_replacement_cancellation c WHERE c.authorization_id=a.id) AS cancelled FROM payroll_retirement_replacement_authorization a WHERE a.id=$1 AND a.facility_id=$2',[id,facility])).rows[0]
  if(!a)throw fail('Replacement authorization not found.',404)
  if(a.cancelled)throw fail('Replacement authorization is cancelled.')
  const claim=(await db.query("SELECT * FROM payroll_retirement_replacement_claim WHERE authorization_id=$1 AND kind='BANK'",[id])).rows[0]
  if(automaticAt){
   const current=(await db.query(`${replacementBankCandidates} WHERE a.id=$1`,[id])).rows[0]
   if(!replacementBankDue(current,automaticAt)){await db.query('COMMIT');return {skipped:true}}
   if(actorId!==null)throw fail('Automatic funding cannot use an admin identity.',400)
   review={confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:a.preview.outsideActivityReviewed,reference:a.preview.reference}
  }
  let intent,connection,result
  try{
   const fundingRevision=Number(a.preview.allocation.fundingRevisionId)
   connection=await readPayrollPaymentConnection(db,facility,fundingRevision)
   if(claim){
    if(!claim.encrypted_instruction)throw fail('The retained bank claim requires instruction recovery.')
    intent=JSON.parse(decryptDocument(claim.encrypted_instruction,context(facility,id)).toString())
   }else{
    if(recoveryOnly)throw fail('Recovery cannot submit an unclaimed replacement payment.')
    if(review?.confirmed!==true||review.bankInstructionsReviewed!==true||review.outsideActivityReviewed!==true||typeof review.reference!=='string'||review.reference.trim().length<20||review.reference.length>2000||/[\u0000-\u001f\u007f]/.test(review.reference))throw fail('Review separate replacement bank funding and outside payment activity.',400)
    const file=(await db.query("SELECT o.result FROM payroll_retirement_replacement_claim c JOIN payroll_retirement_replacement_observation o ON o.authorization_id=c.authorization_id AND o.kind=c.kind WHERE c.authorization_id=$1 AND c.kind='ALLOCATION' ORDER BY o.id DESC LIMIT 1",[id])).rows[0]
    if(file?.result?.status!=='REMOTE_FILE_VERIFIED')throw fail('Recover the delivered replacement allocation file before bank funding.')
    const fresh=await prepareRetirementReplacement(db,facility,a.original_authorization_id,a.inputs,{fetcher,paymentFetcher,reader,transfer,now,reservationId:a.id,requireDelivered:true})
    if(!isDeepStrictEqual(retirementReplacementBinding(fresh.summary),retirementReplacementBinding(a.preview))||fresh.csv!==decryptDocument(a.encrypted_allocation,`payroll-retirement-replacement:${facility}:${id}`).toString())throw fail('Replacement instructions or source evidence changed before bank funding.')
    const destination=await readRetirementDestination(db,facility,a.preview.allocation.destinationRevisionId)
    intent=retirementReplacementBankInstruction(a,{id:fundingRevision,configuration:connection},destination,{now:now()})
    await db.query("INSERT INTO payroll_retirement_replacement_claim(authorization_id,kind,created_by,review_reference,encrypted_instruction,automatic) VALUES($1,'BANK',$2,$3,$4,$5)",[id,actorId,review.reference.trim(),encryptDocument(Buffer.from(JSON.stringify(intent)),context(facility,id)),!!automaticAt])
   }
   modernTreasuryRetirementInstruction(intent)
   const p=a.preview
   if(intent.id!==id||intent.replacementAuthorizationId!==id||intent.originalAuthorizationId!==a.original_authorization_id||intent.returnAuthorizationId!==a.return_authorization_id||intent.facilityId!==Number(facility)||intent.runId!==Number(p.runId)||intent.planId!==p.planId||intent.destinationId!==p.allocation.destinationRevisionId||intent.fundingRevisionId!==fundingRevision||intent.amountCents!==p.amountCents||intent.paymentDate!==p.timing.depositDate||intent.submitBefore!==p.timing.submissionAt||intent.originalWithheldDate!==p.originalWithheldDate||intent.originatingAccountId!==connection.originatingAccountId||intent.mode!==connection.mode)throw fail('Retained replacement bank instruction does not match its authorization.')
  }catch(e){if(!claim)throw e;result={status:'RECOVERY_UNAVAILABLE'}}
  await db.query('COMMIT')
  result=result||await(claim?readModernTreasuryRetirementPayment(intent,{...connection,fetcher:paymentFetcher}):submitModernTreasuryRetirementPayment(intent,{...connection,fetcher:paymentFetcher},{now}))
  await db.query('BEGIN')
  const observation=(await db.query("INSERT INTO payroll_retirement_replacement_observation(authorization_id,kind,source,result,created_by,automatic) VALUES($1,'BANK',$2,$3,$4,$5) RETURNING id",[id,claim?'RECOVERY':'SUBMISSION',result,actorId,!!automaticAt])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_REPLACEMENT_BANK_OBSERVED','retirement_replacement_authorization',$3,$4)",[facility,actorId,id,{observationId:String(observation.id),status:result.status,settlementStatus:result.settlementStatus||'UNVERIFIED'}])
  await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Replacement contribution requires reconciliation',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,title=EXCLUDED.title,message=EXCLUDED.message",[facility,`retirement-replacement-bank-${id}`,`Replacement funding: ${result.status.replaceAll('_',' ')}. Participant receipt, accounting and original return-case closure require separate evidence.`])
  await reconcileRetirementObservation(db,facility,a.original_authorization_id,{actorId});await db.query('COMMIT');return {result,recovery:!!claim,observationId:String(observation.id)}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(e.code==='55P03')throw fail('Employer setup is busy. Retry replacement funding.');throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerRetirementReplacementBank(app,pool,options){
 app.post('/api/admin/payroll/retirement-replacement-authorizations/:id/bank-dispatch',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');try{const b=req.body;if(b?.confirmed!==true||!['SUBMIT','RECOVER'].includes(b.action))throw fail('Confirm replacement bank submission or recovery.',400);res.json({success:true,data:await dispatchRetirementReplacementBank(pool,req.canonicalAccess.facilityId,req.params.id,{...options,actorId:req.adminId,recoveryOnly:b.action==='RECOVER',review:b})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Replacement bank outcome needs recovery. Do not create another payment.'})}
 })
}
