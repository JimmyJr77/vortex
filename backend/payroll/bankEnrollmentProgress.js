import {refreshBankEnrollmentAlert} from './bankEnrollmentAlerts.js'
import {randomUUID} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {lockPayrollEmployeeSession} from './employeeAuth.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readBankEnrollment,bankEnrollmentDisclosure} from './bankEnrollment.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {provisionPayrollCounterparty,provisionPayrollBankAccount,verifyPayrollBankAccount} from './modernTreasuryEnrollment.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function bankEnrollmentProgress(db,enrollmentId){
 const rows=(await db.query(`SELECT o.*,v.result,v.id AS observation_id,v.created_at AS observed_at FROM payroll_bank_enrollment_operation o LEFT JOIN LATERAL(SELECT id,result,created_at FROM payroll_bank_enrollment_observation WHERE operation_id=o.id ORDER BY id DESC LIMIT 1)v ON true WHERE o.enrollment_id=$1 ORDER BY o.created_at,o.id`,[enrollmentId])).rows
 // A successful holder lookup carries no bank-verification state. Preserve
 // newer account evidence when an admin reviews that prerequisite afterward.
 const hasAccountEvidence=rows.some(r=>r.stage!=='COUNTERPARTY'&&r.observation_id)
 const observed=rows.filter(r=>r.observation_id&&!(hasAccountEvidence&&r.stage==='COUNTERPARTY'&&r.result?.status==='RECORDED')).sort((a,b)=>Number(a.observation_id)-Number(b.observation_id)).at(-1),pending=rows.find(r=>!r.result),latest=pending||observed||rows.at(-1),result=pending?null:latest?.result
 return {rows,observationId:pending?null:observed?.observation_id,status:pending?'UNCERTAIN':result?.verificationStatus==='verified'?'VERIFIED':result?.verificationStatus==='pending_verification'?'AWAITING_AMOUNTS':result?.status||'SAVED',stage:latest?.stage||null,attempts:rows.filter(r=>r.stage==='COMPLETE').length}
}
export async function advanceBankEnrollment(pool,req,{fetcher=fetch}={}){
 const db=await pool.connect(),s=req.payrollEmployee,b=req.body||{},lock=`payroll-payment-connection:${s.facility_id}`;let locked=false
 try{
  if(!['CONTINUE','COMPLETE','RECOVER'].includes(b.action)||typeof b.enrollmentId!=='string')throw fail('Choose the current enrollment and an action.',400)
  await db.query('BEGIN');await lockPayrollEmployeeSession(db,s,req)
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const row=(await db.query('SELECT * FROM payroll_bank_enrollment WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC LIMIT 1',[s.facility_id,s.employee_id])).rows[0]
  if(!row||row.id!==b.enrollmentId)throw fail('Bank enrollment changed. Refresh before continuing.')
  const c=(await db.query('SELECT id,mode FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[s.facility_id])).rows[0]
  if(Number(c?.id)!==Number(row.connection_id))throw fail('The employer payment connection changed. Save a new enrollment.')
  const input=readBankEnrollment(row),disclosure=await bankEnrollmentDisclosure(db,s,c)
  if(input.disclosure.fingerprint!==disclosure.fingerprint)throw fail('Verification consent changed. Save a new enrollment after reviewing the terms.')
  const config={...await readPayrollPaymentConnection(db,s.facility_id,c.id),fetcher}
  const progress=await bankEnrollmentProgress(db,row.id),rows=progress.rows
  const cp=rows.find(r=>r.stage==='COUNTERPARTY'),account=rows.find(r=>r.stage==='ACCOUNT'),start=rows.find(r=>r.stage==='START'),completions=rows.filter(r=>r.stage==='COMPLETE')
  let stage,operation,amounts
  if(b.action==='COMPLETE'){
   if(!Array.isArray(b.amounts)||b.amounts.length!==2||!b.amounts.every(n=>Number.isInteger(n)&&n>=1&&n<=99)||typeof b.operationId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(b.operationId))throw fail('Enter both deposit amounts in whole cents.',400)
   stage='COMPLETE';amounts=b.amounts
   operation=rows.find(r=>r.id===b.operationId)
   if(operation&&(operation.stage!=='COMPLETE'||!isDeepStrictEqual(JSON.parse(decryptDocument(operation.encrypted_input,`payroll-bank-operation:${row.id}`).toString()),amounts)))throw fail('This verification attempt has different amounts. Refresh before continuing.')
   if(!operation){
    if(progress.status!=='AWAITING_AMOUNTS'||!start||completions.length>=5)throw fail('Verification is not ready for another attempt. Recover the current status or contact payroll.')
    if(new Date(start.created_at).getTime()<=Date.now()-56*86400000)throw fail('Verification has expired. Contact payroll before starting again.')
    const previous=completions.at(-1)
    if(previous){const submitted=(await db.query("SELECT result FROM payroll_bank_enrollment_observation WHERE operation_id=$1 AND source='SUBMISSION' ORDER BY id DESC LIMIT 1",[previous.id])).rows[0];if(submitted?.result?.status!=='VERIFICATION_REJECTED')throw fail('The previous attempt is unresolved. Recover its status before continuing.')}
   }
  }else if(b.action==='RECOVER'){
   operation=rows.at(-1);if(!operation)throw fail('Verification has not started. Continue enrollment first.');stage=operation.stage
  }else{
   if(!cp||cp.result?.status!=='RECORDED'){stage='COUNTERPARTY';operation=cp}
   else if(!account||account.result?.status!=='RECORDED'){stage='ACCOUNT';operation=account}
   else{stage='START';operation=start}
  }
  const isNew=!operation
  if(isNew){
   operation=(await db.query('INSERT INTO payroll_bank_enrollment_operation(id,enrollment_id,stage,attempt,encrypted_input,session_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[stage==='COMPLETE'?b.operationId:randomUUID(),row.id,stage,stage==='COMPLETE'?completions.length+1:1,stage==='COMPLETE'?encryptDocument(Buffer.from(JSON.stringify(amounts)),`payroll-bank-operation:${row.id}`):null,s.session_id])).rows[0]
  }
  await db.query('COMMIT')
  let result
  if(stage==='COUNTERPARTY')result=await provisionPayrollCounterparty(input,config,{allowCreate:isNew})
  else if(stage==='ACCOUNT')result=await provisionPayrollBankAccount(input,cp.result.counterpartyId,config,{allowCreate:isNew})
  else result=await verifyPayrollBankAccount(input,cp.result.counterpartyId,account.result.accountId,config,{action:isNew?stage:'READ',operationId:operation.id,amounts,verificationConsent:input.verificationConsent})
  await db.query('INSERT INTO payroll_bank_enrollment_observation(operation_id,source,result) VALUES($1,$2,$3)',[operation.id,isNew?'SUBMISSION':'RECOVERY',result])
  const updated=await bankEnrollmentProgress(db,row.id)
  await refreshBankEnrollmentAlert(db,s.facility_id,s.employee_id,row.id,updated)
  return {status:updated.status,stage:updated.stage,attempts:updated.attempts}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{if(locked)await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock]).catch(()=>{});db.release()}
}
