import {refreshBankEnrollmentAlert} from './bankEnrollmentAlerts.js'
import {randomUUID} from 'node:crypto'
import {lockPayrollEmployeeSession} from './employeeAuth.js'
import {readBankEnrollment,bankEnrollmentDisclosure} from './bankEnrollment.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {bankEnrollmentProgress} from './bankEnrollmentProgress.js'
import {provisionPayrollCounterparty,verifyPayrollBankAccount} from './modernTreasuryEnrollment.js'
import {encryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
export async function restartBankEnrollment(pool,req,{fetcher=fetch}={}){
 const s=req.payrollEmployee,b=req.body||{},db=await pool.connect()
 try{
  if(!uuid(b.id)||!uuid(b.enrollmentId)||b.confirmed!==true||typeof b.signature!=='string'||b.signature.trim().length<2||b.signature.length>200||/[\u0000-\u001f\u007f]/.test(b.signature))throw fail('Review the saved account and verification consent, then sign to prepare a new verification.',400)
  await db.query('BEGIN');await lockPayrollEmployeeSession(db,s,req)
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${s.facility_id}`])
  const current=(await db.query('SELECT * FROM payroll_bank_enrollment WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC LIMIT 1',[s.facility_id,s.employee_id])).rows[0]
  const existing=(await db.query('SELECT * FROM payroll_bank_enrollment_restart WHERE parent_id=$1',[b.enrollmentId])).rows[0]
  if(existing){
   if(current?.id!==b.id||existing.child_id!==b.id)throw fail('Enrollment changed. Refresh before restarting.')
   const input=readBankEnrollment(current)
   if(input.signature!==b.signature.trim()||input.disclosure.fingerprint!==b.fingerprint)throw fail('Restart consent differs from the saved request.')
   await db.query('COMMIT');return {enrollmentId:current.id,reused:true}
  }
  if(!current||current.id!==b.enrollmentId)throw fail('Choose the current enrollment to restart verification.')
  if((await db.query('SELECT 1 FROM payroll_bank_enrollment_link WHERE enrollment_id=$1',[current.id])).rowCount)throw fail('This account was already linked. Review its wage authorization and use a replacement enrollment if needed.')
  const c=(await db.query('SELECT id,mode FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[s.facility_id])).rows[0]
  if(Number(c?.id)!==Number(current.connection_id))throw fail('The employer connection changed. Review a replacement enrollment.')
  const disclosure=await bankEnrollmentDisclosure(db,s,c)
  if(disclosure.fingerprint!==b.fingerprint)throw fail('Verification terms changed. Review them again.')
  const progress=await bankEnrollmentProgress(db,current.id),cp=progress.rows.find(o=>o.stage==='COUNTERPARTY'),account=progress.rows.find(o=>o.stage==='ACCOUNT'),start=progress.rows.find(o=>o.stage==='START')
  const pending=start&&(await db.query("SELECT 1 FROM payroll_bank_enrollment_observation WHERE operation_id=$1 AND result->>'status'='RECORDED' AND result->>'verificationStatus'='pending_verification'",[start.id])).rowCount
  if(!pending||!cp?.result?.counterpartyId||!account?.result?.accountId)throw fail('Recover the previous verification first. A confirmed earlier verification is required.')
  const old=readBankEnrollment(current),config={...await readPayrollPaymentConnection(db,s.facility_id,c.id),fetcher}
  const holder=await provisionPayrollCounterparty(old,config)
  if(holder.status!=='RECORDED'||holder.counterpartyId!==cp.result.counterpartyId)throw fail('The saved account holder needs recovery before restarting.')
  const verified=await verifyPayrollBankAccount(old,holder.counterpartyId,account.result.accountId,config)
  if(verified.status!=='RECORDED'||verified.verificationStatus!=='unverified')throw fail('The provider has not confirmed this account is eligible for a new verification. Refresh its status.')
  const observation=(await db.query("INSERT INTO payroll_bank_enrollment_observation(operation_id,source,result) VALUES($1,'RECOVERY',$2) RETURNING id",[start.id,verified])).rows[0]
  const input={...old,id:b.id,providerEnrollmentId:old.providerEnrollmentId||old.id,signature:b.signature.trim(),verificationConsent:true,disclosure}
  const child=(await db.query('INSERT INTO payroll_bank_enrollment(id,facility_id,employee_id,connection_id,session_id,encrypted_request) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[b.id,s.facility_id,s.employee_id,c.id,s.session_id,encryptDocument(Buffer.from(JSON.stringify(input)),`payroll-bank-enrollment:${s.facility_id}:${s.employee_id}`)])).rows[0]
  for(const [stage,result] of [['COUNTERPARTY',holder],['ACCOUNT',verified]]){
   const op=randomUUID()
   await db.query('INSERT INTO payroll_bank_enrollment_operation(id,enrollment_id,stage,attempt,session_id) VALUES($1,$2,$3,1,$4)',[op,child.id,stage,s.session_id])
   await db.query("INSERT INTO payroll_bank_enrollment_observation(operation_id,source,result) VALUES($1,'RECOVERY',$2)",[op,result])
  }
  await db.query('INSERT INTO payroll_bank_enrollment_restart(parent_id,child_id,observation_id,session_id) VALUES($1,$2,$3,$4)',[current.id,child.id,observation.id,s.session_id])
  await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'EMPLOYEE_BANK_VERIFICATION_RESTART_PREPARED','bank_enrollment',$2,$3)",[s.facility_id,child.id,{parentId:current.id,employeeId:Number(s.employee_id),observationId:Number(observation.id)}])
  await refreshBankEnrollmentAlert(db,s.facility_id,s.employee_id,current.id,await bankEnrollmentProgress(db,current.id))
  await db.query('COMMIT');return {enrollmentId:child.id,reused:false}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
