import {reconcileRetirementObservation} from './retirementContributionReconciliation.js'
import {checkRetirementDispatchSchedule} from './retirementDispatchScheduleState.js'
import {randomUUID} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readRetirementDestination} from './retirementDestination.js'
import {retirementRemittanceSources} from './retirementRemittanceSources.js'
import {retirementAllocationFile} from './retirementAllocationFile.js'
import {previousBankBusinessDay} from './bankCalendar.js'
import {modernTreasuryRetirementInstruction,submitModernTreasuryRetirementPayment,readModernTreasuryRetirementPayment} from './modernTreasuryRetirementPayments.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x)
const context=(facility,id)=>`payroll-retirement-instruction:${facility}:${id}`
const timingBinding=timing=>{const {status,...basis}=timing;return basis}
// Deadline status changes with time; retained dates, review identity, exact file
// bytes and every substantive source/configuration fact still have to match.
export function retirementAuthorizationBinding(summary){
 const {fingerprint,sourceFingerprint,authorizationWindowOpen,status,outsideActivityReviewed,...basis}=summary
 return {...basis,timing:timingBinding(basis.timing),allocations:basis.allocations.map(a=>({...a,timing:timingBinding(a.timing)}))}
}
export async function dispatchRetirementRemittance(pool,facility,id,{fetcher=fetch,now=()=>new Date(),actorId=null,recoveryOnly=false,bankInstructionReference=null,outsideActivityReviewed=false,recoveryDueAt=null,scheduledId=null}={}){
 if(recoveryDueAt!==null&&(!recoveryOnly||!Number.isFinite(Date.parse(recoveryDueAt))))throw fail('Automatic recovery requires a valid observation time.',400)
 if(!uuid(id))throw fail('Choose a retirement remittance authorization.',400)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  await db.query('BEGIN')
  // Avoid waiting on a settings holder that itself awaits the connection lock.
  await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
  const a=(await db.query('SELECT a.*,EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation c WHERE c.authorization_id=a.id) AS cancelled FROM payroll_retirement_remittance_authorization a WHERE a.id=$1 AND a.facility_id=$2',[id,facility])).rows[0]
  if(!a)throw fail('Retirement authorization not found.',404);if(a.cancelled)throw fail('This retirement authorization is cancelled.')
  const claim=(await db.query('SELECT * FROM payroll_retirement_remittance_claim WHERE authorization_id=$1',[id])).rows[0]
  if(recoveryDueAt){
   if(!claim||!recoveryOnly)throw fail('Automatic recovery requires a retained claim.')
   const last=(await db.query('SELECT result,created_at FROM payroll_retirement_remittance_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1',[id])).rows[0]
   const interval=last?.result?.settlementStatus==='BANK_POSTED'?86400000:300000
   if(+new Date(last?.created_at||claim.created_at)>+new Date(recoveryDueAt)-interval){await db.query('COMMIT');return {skipped:true}}
  }
  if(scheduledId&&claim){await db.query('COMMIT');return {skipped:true}}
  if(!claim){const scheduled=await checkRetirementDispatchSchedule(db,facility,'BANK',id,scheduledId,now);if(scheduled?.skipped){await db.query('COMMIT');return {skipped:true}}if(scheduled){bankInstructionReference=scheduled.reference;outsideActivityReviewed=true}}
  let intent,connection,recoveryFailure
  try{
   connection=await readPayrollPaymentConnection(db,facility,Number(a.basis.fundingRevisionId))
   if(claim){if(!claim.encrypted_instruction)throw fail('Retained claim requires instruction recovery.');intent=JSON.parse(decryptDocument(claim.encrypted_instruction,context(facility,id)).toString())}
   else{
    if(recoveryOnly)throw fail('No dispatch claim exists. Recovery cannot submit a payment.')
    if(outsideActivityReviewed!==true)throw fail('Recheck outside payments and duplicate allocation instructions before submission.',400)
    if(typeof bankInstructionReference!=='string'||bankInstructionReference.trim().length<20||bankInstructionReference.length>2000)throw fail('Retain the verified trustee credit and separate allocation instructions.',400)
    const checkedAt=now(),source=(await retirementRemittanceSources(db,facility,{runId:a.run_id,limit:1,now:checkedAt})).items[0]
    if(!source?.sourceFingerprint)throw fail('Reconcile retained payroll contributions before dispatch.')
    const file=await retirementAllocationFile(db,facility,a.run_id,{planId:a.plan_id,sourceFingerprint:source.sourceFingerprint},{fetcher,now:checkedAt})
    if(!isDeepStrictEqual(retirementAuthorizationBinding(file.summary),retirementAuthorizationBinding(a.basis))||file.csv!==decryptDocument(a.encrypted_allocation,`payroll-retirement-remittance:${facility}:${id}`).toString())throw fail('Authorized allocation or setup evidence changed. Cancel and review the authorization again.')
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(checkedAt),paymentDate=a.basis.timing.depositDate
    if(!file.summary.authorizationWindowOpen||now()>=new Date(a.basis.timing.submissionAt)||paymentDate<=today||previousBankBusinessDay(paymentDate)!==paymentDate)throw fail('A current submission window and future bank business date are required.')
    const destination=await readRetirementDestination(db,facility,a.destination_id)
    intent={id,facilityId:Number(facility),runId:Number(a.run_id),planId:a.plan_id,destinationId:a.destination_id,fundingRevisionId:Number(a.basis.fundingRevisionId),originatingAccountId:connection.originatingAccountId,receivingAccountId:destination.destination.accountId,counterpartyId:destination.destination.counterpartyId,destinationFingerprint:destination.destination.fingerprint,amountCents:Number(a.amount_cents),paymentDate,submitBefore:a.basis.timing.submissionAt,mode:connection.mode}
    modernTreasuryRetirementInstruction(intent)
    await db.query('INSERT INTO payroll_retirement_remittance_claim(id,authorization_id,encrypted_instruction,created_by,bank_instruction_reference,outside_activity_reviewed,scheduled_id) VALUES($1,$2,$3,$4,$5,true,$6)',[randomUUID(),id,encryptDocument(Buffer.from(JSON.stringify(intent)),context(facility,id)),actorId,bankInstructionReference.trim(),scheduledId])
   }
   if(intent.id!==id||intent.facilityId!==Number(facility)||intent.runId!==Number(a.run_id)||intent.planId!==a.plan_id||intent.destinationId!==a.destination_id||intent.amountCents!==Number(a.amount_cents)||intent.paymentDate!==a.basis.timing.depositDate||intent.submitBefore!==a.basis.timing.submissionAt||intent.fundingRevisionId!==Number(a.basis.fundingRevisionId)||intent.originatingAccountId!==connection.originatingAccountId||intent.mode!==connection.mode)throw fail('Retained instruction does not match the authorization.')
  }catch(e){if(!claim)throw e;recoveryFailure={status:'RECOVERY_UNAVAILABLE'}}
  await db.query('COMMIT')
  const result=recoveryFailure||await (claim?readModernTreasuryRetirementPayment(intent,{...connection,fetcher}):submitModernTreasuryRetirementPayment(intent,{...connection,fetcher},{now}))
  await db.query('BEGIN')
  const observation=(await db.query('INSERT INTO payroll_retirement_remittance_observation(authorization_id,source,result,created_by,created_at) VALUES($1,$2,$3,$4,COALESCE($5::timestamptz,clock_timestamp())) RETURNING id',[id,claim?'RECOVERY':'SUBMISSION',result,actorId,recoveryDueAt])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_BANK_PAYMENT_OBSERVED','retirement_remittance_authorization',$3,$4)",[facility,actorId,id,{observationId:String(observation.id),status:result.status,settlementStatus:result.settlementStatus||'UNVERIFIED'}])
  const key=`retirement-bank-${id}`,bankPosted=result.settlementStatus==='BANK_POSTED'
  await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING',$3,$4) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,title=EXCLUDED.title,message=EXCLUDED.message",[facility,key,bankPosted?'Retirement allocation receipt still required':'Retirement bank payment needs follow-up',`Payroll ${a.run_id}, plan ${a.plan_id}: ${bankPosted?'matching bank withdrawal retained':result.status.replaceAll('_',' ').toLowerCase()}. Recordkeeper receipt and participant allocation remain unverified.`])
  await reconcileRetirementObservation(db,facility,id,{actorId});await db.query('COMMIT');return {result,recovery:!!claim,observationId:String(observation.id)}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(e.code==='55P03')throw fail('Employer payroll setup is busy. Retry after its current update finishes.');throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerRetirementRemittanceDispatch(app,pool,{fetcher=fetch,now=()=>new Date()}={}){
 app.post('/api/admin/payroll/retirement-remittance-authorizations/:id/dispatch',async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const b=req.body||{};if(!['SUBMIT','RECOVER'].includes(b.action)||b.confirmed!==true||b.action==='SUBMIT'&&(b.bankInstructionsReviewed!==true||b.outsideActivityReviewed!==true))throw fail('Confirm the bank action and independently reviewed trustee instructions.',400)
  const data=await dispatchRetirementRemittance(pool,req.canonicalAccess.facilityId,req.params.id,{fetcher,now,actorId:req.adminId,recoveryOnly:b.action==='RECOVER',bankInstructionReference:b.reference,outsideActivityReviewed:b.outsideActivityReviewed});res.json({success:true,data})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Retirement bank outcome requires recovery. Do not create a replacement instruction.'})}})
}
