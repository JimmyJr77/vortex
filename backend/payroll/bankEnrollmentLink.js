import {lockPayrollEmployeeSession} from './employeeAuth.js'
import {encryptDocument} from './onboarding.js'
import {readBankEnrollment} from './bankEnrollment.js'
import {bankEnrollmentProgress} from './bankEnrollmentProgress.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function linkBankEnrollment(pool,req){
 const db=await pool.connect(),s=req.payrollEmployee,b=req.body||{}
 try{
  if(typeof b.enrollmentId!=='string'||b.confirmed!==true||!Number.isSafeInteger(b.expectedDestinationRevision)||b.expectedDestinationRevision<0)throw fail('Review the verified account and confirm linking it.',400)
  await db.query('BEGIN');await lockPayrollEmployeeSession(db,s,req)
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${s.facility_id}`])
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-destination:${s.facility_id}:${s.employee_id}`])
  const row=(await db.query('SELECT * FROM payroll_bank_enrollment WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC LIMIT 1',[s.facility_id,s.employee_id])).rows[0]
  const c=(await db.query('SELECT id FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[s.facility_id])).rows[0]
  if(!row||row.id!==b.enrollmentId||Number(c?.id)!==Number(row.connection_id))throw fail('Enrollment or employer connection changed. Refresh before linking.')
  const current=(await db.query('SELECT id FROM payroll_payment_destination WHERE facility_id=$1 AND employee_id=$2 ORDER BY id DESC LIMIT 1',[s.facility_id,s.employee_id])).rows[0]
  const existing=(await db.query('SELECT destination_id FROM payroll_bank_enrollment_link WHERE enrollment_id=$1',[row.id])).rows[0]
  if(existing){if(Number(current?.id)!==Number(existing.destination_id))throw fail('Payroll changed the linked account. Review the current wage authorization.');await db.query('COMMIT');return {destinationId:Number(existing.destination_id),reused:true}}
  if(Number(current?.id||0)!==b.expectedDestinationRevision)throw fail('Payroll changed the linked account. Refresh before replacing it.')
  const progress=await bankEnrollmentProgress(db,row.id)
  if(progress.status!=='VERIFIED')throw fail('Complete account verification before linking.')
  const observation=(await db.query("SELECT id,result FROM payroll_bank_enrollment_observation WHERE id=$1 AND created_at>clock_timestamp()-interval '15 minutes' ORDER BY id DESC LIMIT 1",[progress.observationId])).rows[0]
  if(observation?.result?.verificationStatus!=='verified')throw fail('Refresh verification status before linking this account.')
  const input=readBankEnrollment(row),result=observation.result
  const retained={version:1,accountId:result.accountId,counterpartyId:result.counterpartyId,accountType:input.accountType,accountLast4:result.accountLast4,holderName:input.holderName,mode:input.mode,reference:`Employee bank enrollment ${row.id}`}
  const destination=(await db.query('INSERT INTO payroll_payment_destination(facility_id,employee_id,connection_id,encrypted_destination,created_by_session) VALUES($1,$2,$3,$4,$5) RETURNING id',[s.facility_id,s.employee_id,c.id,encryptDocument(Buffer.from(JSON.stringify(retained)),`payroll-payment-destination:${s.facility_id}:${s.employee_id}`),s.session_id])).rows[0]
  await db.query('INSERT INTO payroll_bank_enrollment_link(enrollment_id,destination_id,observation_id) VALUES($1,$2,$3)',[row.id,destination.id,observation.id])
  await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'EMPLOYEE_VERIFIED_BANK_LINKED','payment_destination',$2,$3)",[s.facility_id,String(destination.id),{employeeId:Number(s.employee_id),enrollmentId:row.id,observationId:Number(observation.id)}])
  await db.query('COMMIT');return {destinationId:Number(destination.id),reused:false}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
