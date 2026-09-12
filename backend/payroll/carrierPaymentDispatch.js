import {retainCarrierPaymentReceipt} from './carrierPaymentReceipt.js'
import {updateCarrierPaymentAlert} from './carrierPaymentAlerts.js'
import {isDeepStrictEqual} from 'node:util'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {readCarrierPayee} from './carrierPayee.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {modernTreasuryCarrierInstruction,submitModernTreasuryCarrierPayment,readModernTreasuryCarrierPayment} from './modernTreasuryCarrierPayments.js'
import {previousBankBusinessDay} from './bankCalendar.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const context=(facility,id)=>`payroll-carrier-payment:${facility}:${id}`
const fixed=preview=>{const {reservations,fingerprint,status,...basis}=preview;return basis}
export async function dispatchCarrierPayment(pool,facility,id,{prepare,fetcher,actorId=null,recoveryOnly=false,recoveryDueAt=null,scheduledRequestId=null,now=()=>new Date()}={}){
 if(recoveryDueAt!==null&&(!recoveryOnly||!Number.isFinite(new Date(recoveryDueAt).getTime())))throw fail('Automatic recovery requires a valid read-only recovery time.')
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const a=(await db.query('SELECT a.*,c.authorization_id AS cancelled FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id LEFT JOIN payroll_carrier_payment_cancellation c ON c.authorization_id=a.id WHERE a.id=$1 AND i.facility_id=$2',[id,facility])).rows[0]
  if(!a)throw fail('Carrier payment authorization was not found.',404)
  if(a.cancelled)throw fail('This carrier payment authorization was cancelled.')
  const claim=(await db.query('SELECT encrypted_instruction,created_at FROM payroll_carrier_payment_claim WHERE authorization_id=$1',[a.id])).rows[0]
  if(scheduledRequestId!==null&&claim){await db.query('COMMIT');return {skipped:true}}
  if(!claim){
   const schedule=(await db.query('SELECT s.id,s.submit_at FROM payroll_carrier_payment_schedule s WHERE s.authorization_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_schedule_cancellation c WHERE c.schedule_id=s.id) ORDER BY s.created_at DESC LIMIT 1',[a.id])).rows[0]
   if(scheduledRequestId!==null){if(!schedule||schedule.id!==scheduledRequestId||new Date(schedule.submit_at)>now())throw fail('Carrier schedule changed, was cancelled or is not due.')}
   else if(schedule&&!recoveryOnly)throw fail('Cancel the scheduled submission before sending this carrier payment manually.')
  }
  if(recoveryDueAt!==null){
   if(!claim)throw fail('No dispatch claim is available for automatic recovery.')
   const latest=(await db.query('SELECT result,created_at FROM payroll_carrier_payment_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1',[a.id])).rows[0]
   const interval=latest?.result?.settlementStatus==='BANK_POSTED'?86400000:300000
   if(new Date(latest?.created_at||claim.created_at).getTime()>new Date(recoveryDueAt).getTime()-interval){await db.query('COMMIT');return {skipped:true}}
  }
  let connection,intent,recoveryFailure
  try{
  connection=await readPayrollPaymentConnection(db,facility,a.connection_id)
  if(claim)intent=JSON.parse(decryptDocument(claim.encrypted_instruction,context(facility,a.id)).toString())
  else{
   if(recoveryOnly)throw fail('No dispatch has started. Recovery cannot submit this payment.')
   const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].timezone
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
   if(a.preview.paymentDate<=today||previousBankBusinessDay(a.preview.paymentDate)!==a.preview.paymentDate)throw fail('Choose a future bank business day before dispatch. Same-day or past-date carrier submission is not supported.')
   const current=await prepare(db,{canonicalAccess:{facilityId:facility},params:{id:a.invoice_id},body:{amountCents:Number(a.amount_cents),paymentDate:a.preview.paymentDate}},a.id)
   if(!isDeepStrictEqual(fixed(current),fixed(a.preview)))throw fail('Authorized invoice, accounting, payee or funding facts changed. Cancel and review the payment again.')
   const payee=await readCarrierPayee(db,facility,a.payee_id)
   intent={id:a.id,facilityId:Number(facility),invoiceId:a.invoice_id,invoiceRevision:a.preview.invoiceRevision,payeeRevisionId:a.payee_id,fundingRevisionId:Number(a.connection_id),originatingAccountId:connection.originatingAccountId,receivingAccountId:payee.destination.accountId,counterpartyId:payee.destination.counterpartyId,destinationFingerprint:payee.destination.fingerprint,amountCents:Number(a.amount_cents),paymentDate:a.preview.paymentDate,mode:connection.mode}
   modernTreasuryCarrierInstruction(intent)
   await db.query('INSERT INTO payroll_carrier_payment_claim(authorization_id,encrypted_instruction,created_by) VALUES($1,$2,$3)',[a.id,encryptDocument(Buffer.from(JSON.stringify(intent)),context(facility,a.id)),actorId])
  }
  if(intent.id!==a.id||intent.facilityId!==Number(facility)||intent.invoiceId!==a.invoice_id||intent.amountCents!==Number(a.amount_cents)||intent.paymentDate!==a.preview.paymentDate||intent.fundingRevisionId!==Number(a.connection_id)||connection.mode!==intent.mode||connection.originatingAccountId!==intent.originatingAccountId)throw fail('Retained carrier instruction does not match its authorization.')
  }catch(e){if(!claim)throw e;recoveryFailure={status:'RECOVERY_UNAVAILABLE'}}
  await db.query('COMMIT')
  const result=recoveryFailure||await (claim?readModernTreasuryCarrierPayment:submitModernTreasuryCarrierPayment)(intent,{...connection,fetcher})
  // Keep the session connection lock until the observation is retained. Do not
  // reacquire settings here: another action can hold it while awaiting this lock.
  await db.query('BEGIN')
  const observation=(await db.query('INSERT INTO payroll_carrier_payment_observation(authorization_id,source,result,created_at) VALUES($1,$2,$3,COALESCE($4::timestamptz,clock_timestamp())) RETURNING id,created_at',[a.id,claim?'RECOVERY':'SUBMISSION',result,recoveryDueAt])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_PAYMENT_OBSERVED','carrier_payment_authorization',$3,$4)",[facility,actorId,a.id,{source:claim?'RECOVERY':'SUBMISSION',observationId:Number(observation.id),status:result.status}])
  await retainCarrierPaymentReceipt(db,facility,a,intent)
  const needsReview=await updateCarrierPaymentAlert(db,facility,a.id,result,a.preview.paymentDate,recoveryDueAt?new Date(recoveryDueAt):now())
  await db.query('COMMIT');return {result,needsReview,recovery:!!claim,observationId:Number(observation.id)}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerCarrierPaymentDispatch(app,pool,prepare,{fetcher,now}={}){
 app.post('/api/admin/payroll/carrier-payment-authorizations/:id/dispatch',async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{if(!uuid(req.params.id)||!['SUBMIT','RECOVER'].includes(req.body?.action)||req.body.confirmed!==true)throw fail('Confirm submission or recovery of the retained carrier payment.',400)
   const data=await dispatchCarrierPayment(pool,req.canonicalAccess.facilityId,req.params.id,{prepare,fetcher,now,actorId:req.adminId,recoveryOnly:req.body.action==='RECOVER'});res.json({success:true,data})
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Carrier payment outcome needs recovery. Reload its retained authorization before further action.'})}
 })
}
