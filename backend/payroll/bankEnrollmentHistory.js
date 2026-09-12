import {enrollmentCompletionState} from './bankEnrollmentState.js'
export {enrollmentCompletionState} from './bankEnrollmentState.js'
import {refreshBankEnrollmentAlert} from './bankEnrollmentAlerts.js'
import {lockPayrollEmployeeSession} from './employeeAuth.js'
import {readBankEnrollment} from './bankEnrollment.js'
import {bankEnrollmentProgress} from './bankEnrollmentProgress.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {provisionPayrollCounterparty,provisionPayrollBankAccount,verifyPayrollBankAccount} from './modernTreasuryEnrollment.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
export async function bankEnrollmentHistory(db,facility,employee,before){
 if(before!==undefined&&(!/^\d+$/.test(String(before))||!Number.isSafeInteger(Number(before))||Number(before)<=0))throw fail('Choose a valid history cursor.',400)
 const rows=(await db.query('SELECT * FROM payroll_bank_enrollment WHERE facility_id=$1 AND employee_id=$2 AND ($3::bigint IS NULL OR revision<$3) ORDER BY revision DESC LIMIT 21',[facility,employee,before||null])).rows
 const current=(await db.query('SELECT id FROM payroll_bank_enrollment WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC LIMIT 1',[facility,employee])).rows[0]
 const items=[]
 for(const row of rows.slice(0,20)){
  const input=readBankEnrollment(row),progress=await bankEnrollmentProgress(db,row.id)
  items.push({id:row.id,revision:Number(row.revision),current:row.id===current?.id,createdAt:row.created_at,holderName:input.holderName,accountType:input.accountType,accountLast4:input.accountNumber.slice(-4),mode:input.mode,status:progress.status,attempts:progress.attempts,...enrollmentCompletionState(progress),operations:progress.rows.map(o=>({id:o.id,stage:o.stage,attempt:o.attempt,status:o.result?.status||'UNCERTAIN',verificationStatus:o.result?.verificationStatus||null,observedAt:o.observed_at||null}))})
 }
 return {items,nextCursor:rows.length>20?Number(rows[19].revision):null}
}
// Historical recovery uses the original retained connection and never creates
// claims, accounts, micro-deposits, completion attempts, or wage elections.
export async function recoverBankEnrollment(pool,{facility,employee,enrollmentId,operationId,actorId,employeeRequest},{fetcher=fetch,automatic=false}={}){
 if(!uuid(enrollmentId)||!uuid(operationId))throw fail('Choose a retained enrollment operation.',400)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('BEGIN')
  if(employeeRequest)await lockPayrollEmployeeSession(db,employeeRequest.payrollEmployee,employeeRequest)
  else if(!(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,employee])).rowCount)throw fail('Employee not found.',404)
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const row=(await db.query('SELECT * FROM payroll_bank_enrollment WHERE facility_id=$1 AND employee_id=$2 AND id=$3',[facility,employee,enrollmentId])).rows[0]
  if(!row)throw fail('Enrollment not found.',404)
  const progress=await bankEnrollmentProgress(db,row.id),operation=progress.rows.find(o=>o.id===operationId)
  if(!operation)throw fail('Enrollment operation not found.',404)
  const input=readBankEnrollment(row),config={...await readPayrollPaymentConnection(db,facility,row.connection_id),fetcher}
  const cp=progress.rows.find(o=>o.stage==='COUNTERPARTY'),account=progress.rows.find(o=>o.stage==='ACCOUNT')
  if(operation.stage!=='COUNTERPARTY'&&!cp?.result?.counterpartyId)throw fail('Recover the account holder operation first.')
  if(['START','COMPLETE'].includes(operation.stage)&&!account?.result?.accountId)throw fail('Recover the bank account operation first.')
  await db.query('COMMIT')
  let result
  if(operation.stage==='COUNTERPARTY')result=await provisionPayrollCounterparty(input,config)
  else if(operation.stage==='ACCOUNT')result=await provisionPayrollBankAccount(input,cp.result.counterpartyId,config)
  else result=await verifyPayrollBankAccount(input,cp.result.counterpartyId,account.result.accountId,config)
  await db.query('BEGIN')
  await db.query("INSERT INTO payroll_bank_enrollment_observation(operation_id,source,result) VALUES($1,'RECOVERY',$2)",[operation.id,result])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'BANK_ENROLLMENT_RECOVERED','bank_enrollment',$3,$4)",[facility,actorId||null,row.id,{employeeId:Number(employee),operationId:operation.id,stage:operation.stage,status:result.status,employeeSessionId:employeeRequest?.payrollEmployee.session_id||null,automatic}])
  await refreshBankEnrollmentAlert(db,facility,employee,row.id,await bankEnrollmentProgress(db,row.id))
  await db.query('COMMIT')
  return {status:result.status,verificationStatus:result.verificationStatus||null}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerAdminBankEnrollmentHistory(app,pool,{fetcher=fetch}={}){
 const path='/api/admin/payroll/employees/:employeeId/bank-enrollment'
 const scope=async req=>{const facility=req.canonicalAccess.facilityId,employee=Number(req.params.employeeId);if(!Number.isSafeInteger(employee)||employee<=0)throw fail('Choose a valid employee.',400);if(!(await pool.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employee])).rowCount)throw fail('Employee not found.',404);return {facility,employee}}
 app.get(`${path}/history`,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const {facility,employee}=await scope(req);res.json({success:true,data:await bankEnrollmentHistory(pool,facility,employee,req.query.beforeRevision)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read bank enrollment history.'})}})
 app.post(`${path}/recover`,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const scoped=await scope(req);res.json({success:true,data:await recoverBankEnrollment(pool,{...scoped,enrollmentId:req.body?.enrollmentId,operationId:req.body?.operationId,actorId:req.adminId},{fetcher})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to recover bank enrollment. Review the retained employer connection.'})}})
}
