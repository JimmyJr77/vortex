import {restartBankEnrollment} from './bankEnrollmentRestart.js'
import {bankEnrollmentHistory,recoverBankEnrollment,enrollmentCompletionState} from './bankEnrollmentHistory.js'
import {linkBankEnrollment} from './bankEnrollmentLink.js'
import {advanceBankEnrollment,bankEnrollmentProgress} from './bankEnrollmentProgress.js'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {payrollEmployeeAuth,lockPayrollEmployeeSession} from './employeeAuth.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {bankEnrollmentInput} from './modernTreasuryEnrollment.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const context=s=>`payroll-bank-enrollment:${s.facility_id}:${s.employee_id}`
const currentConnection=async(db,s)=>(await db.query('SELECT id,mode FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[s.facility_id])).rows[0]
const currentRequest=async(db,s)=>(await db.query('SELECT * FROM payroll_bank_enrollment WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC LIMIT 1',[s.facility_id,s.employee_id])).rows[0]
export async function bankEnrollmentDisclosure(db,s,connection){
 const employer=(await db.query('SELECT legal_business_name FROM payroll_settings WHERE facility_id=$1',[s.facility_id])).rows[0]?.legal_business_name
 if(!employer)throw fail('Payroll must complete the employer name before bank enrollment.',409)
 const terms={version:1,employer,mode:connection.mode,verification:'I authorize small verification deposits to this account and debits that recover only those verification deposits. I own or am authorized to use this account.',wages:'This consent is only for account verification. After verification, I will separately review and authorize wage deposits.',choice:'I may choose check payment instead. Bank enrollment does not change my current payment method.'}
 return {terms,fingerprint:createHash('sha256').update(JSON.stringify({connectionId:Number(connection.id),terms})).digest('hex')}
}
export function readBankEnrollment(row){
 return JSON.parse(decryptDocument(row.encrypted_request,context(row)).toString())
}
const masked=row=>{if(!row)return null;const input=readBankEnrollment(row);return {id:row.id,revision:Number(row.revision),connectionId:Number(row.connection_id),createdAt:row.created_at,holderName:input.holderName,accountType:input.accountType,accountLast4:input.accountNumber.slice(-4),mode:input.mode,status:'SAVED',consent:{signature:input.signature,...input.disclosure}}}
export function registerBankEnrollmentRoutes(app,pool,{fetcher=fetch}={}){
 const path='/api/payroll/employee/bank-enrollment',auth=payrollEmployeeAuth(pool)
 app.post(`${path}/restart`,auth,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await restartBankEnrollment(pool,req,{fetcher})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to prepare new verification. Refresh the saved enrollment.'})}})
 app.get(`${path}/history`,auth,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const s=req.payrollEmployee;res.json({success:true,data:await bankEnrollmentHistory(pool,s.facility_id,s.employee_id,req.query.beforeRevision)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read bank enrollment history.'})}})
 app.post(`${path}/recover`,auth,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const s=req.payrollEmployee;res.json({success:true,data:await recoverBankEnrollment(pool,{facility:s.facility_id,employee:s.employee_id,enrollmentId:req.body?.enrollmentId,operationId:req.body?.operationId,employeeRequest:req},{fetcher})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to recover bank enrollment. Payroll can review the retained employer connection.'})}})

 app.post(`${path}/advance`,auth,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await advanceBankEnrollment(pool,req,{fetcher})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to advance bank verification. Recover status before trying again.'})}})
 app.post(`${path}/link`,auth,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await linkBankEnrollment(pool,req)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to link verified account.'})}})
 app.get(path,auth,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const s=req.payrollEmployee,c=await currentConnection(pool,s),row=await currentRequest(pool,s)
  res.json({success:true,data:{connectionId:Number(c?.id||0),canEnroll:Boolean(c)&&s.employment_status!=='TERMINATED',...(c?await bankEnrollmentDisclosure(pool,s,c):{}),destinationRevision:Number((await pool.query('SELECT id FROM payroll_payment_destination WHERE facility_id=$1 AND employee_id=$2 ORDER BY id DESC LIMIT 1',[s.facility_id,s.employee_id])).rows[0]?.id||0),request:row?{...masked(row),...await publicProgress(pool,row.id)}:null}})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read bank enrollment.'})}})
 app.post(path,auth,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  const s=req.payrollEmployee,b=req.body||{}
  if(b.verificationConsent!==true||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!Number.isSafeInteger(b.connectionId)||b.connectionId<=0||typeof b.signature!=='string'||b.signature.trim().length<2||b.signature.length>200||/[\u0000-\u001f\u007f]/.test(b.signature))throw fail('Review verification consent and sign with your name.')
  await db.query('BEGIN');await lockPayrollEmployeeSession(db,s,req)
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${s.facility_id}`])
  const c=await currentConnection(db,s)
  if(Number(c?.id)!==b.connectionId)throw fail('The employer payment connection changed. Refresh bank enrollment.',409)
  const disclosure=await bankEnrollmentDisclosure(db,s,c)
  if(b.fingerprint!==disclosure.fingerprint)throw fail('Verification terms changed. Review them again.',409)
  let bank
  try{bank=bankEnrollmentInput({id:b.id,mode:c.mode,holderName:b.holderName,accountType:b.accountType,accountNumber:b.accountNumber,routingNumber:b.routingNumber})}catch{throw fail('Enter a valid US routing number, account number, account type and account holder name.')}
  const input={...bank,signature:b.signature.trim(),verificationConsent:true,disclosure},row=await currentRequest(db,s)
  const existing=(await db.query('SELECT * FROM payroll_bank_enrollment WHERE id=$1',[bank.id])).rows[0]
  if(existing){
   if(existing.id!==row?.id||Number(existing.facility_id)!==Number(s.facility_id)||Number(existing.employee_id)!==Number(s.employee_id)||Number(existing.connection_id)!==Number(c.id)||!isDeepStrictEqual(readBankEnrollment(existing),input))throw fail('This enrollment request has changed. Refresh before saving.',409)
   await db.query('COMMIT');return res.json({success:true,data:{...masked(existing),reused:true}})
  }
  if(Number(row?.revision||0)!==b.expectedRevision)throw fail('Bank enrollment changed. Refresh before saving.',409)
  const encrypted=encryptDocument(Buffer.from(JSON.stringify(input)),context(s))
  const saved=(await db.query('INSERT INTO payroll_bank_enrollment(id,facility_id,employee_id,connection_id,session_id,encrypted_request) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[bank.id,s.facility_id,s.employee_id,c.id,s.session_id,encrypted])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'EMPLOYEE_BANK_ENROLLMENT_SAVED','bank_enrollment',$2,$3)",[s.facility_id,saved.id,{employeeId:Number(s.employee_id),revision:Number(saved.revision),connectionId:Number(c.id)}])
  await db.query('COMMIT');res.status(201).json({success:true,data:masked(saved)})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to save bank enrollment.'})}finally{db.release()}})
}

async function publicProgress(db,id){const progress=await bankEnrollmentProgress(db,id),{status,stage,attempts}=progress;const link=(await db.query('SELECT destination_id FROM payroll_bank_enrollment_link WHERE enrollment_id=$1',[id])).rows[0];return {status,stage,attempts,...enrollmentCompletionState(progress),linkedDestinationId:Number(link?.destination_id||0)}}

export async function bankEnrollmentSummary(db,facilityId,employeeId){const row=await currentRequest(db,{facility_id:facilityId,employee_id:employeeId});if(!row)return null;const safe=masked(row);delete safe.consent;return {...safe,...await publicProgress(db,row.id)}}
