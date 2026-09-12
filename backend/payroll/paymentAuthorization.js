import {createHash} from 'node:crypto'
import {payrollEmployeeAuth,lockPayrollEmployeeSession} from './employeeAuth.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {readPayrollPaymentDestination} from './paymentDestination.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const latest=async(db,s)=>(await db.query('SELECT id,connection_id FROM payroll_payment_destination WHERE facility_id=$1 AND employee_id=$2 ORDER BY id DESC LIMIT 1',[s.facility_id,s.employee_id])).rows[0]
const history=async(db,s)=>(await db.query('SELECT a.id,a.destination_id,a.decision,a.created_at FROM payroll_payment_authorization a JOIN payroll_payment_destination d ON d.id=a.destination_id WHERE d.facility_id=$1 AND d.employee_id=$2 ORDER BY a.id DESC',[s.facility_id,s.employee_id])).rows
export async function paymentAuthorizationDisclosure(db,s,d){
 const destination=await readPayrollPaymentDestination(db,s.facility_id,s.employee_id,d.id)
 const employer=(await db.query('SELECT legal_business_name FROM payroll_settings WHERE facility_id=$1',[s.facility_id])).rows[0]?.legal_business_name
 if(!employer)throw fail('Payroll must complete the employer name before authorization.',409)
 const terms={version:1,employer,account:{holderName:destination.holderName,accountType:destination.accountType,accountLast4:destination.accountLast4,mode:destination.mode},authorization:'I authorize this employer to credit my wages to the displayed account. I confirm that I own or am authorized to use this account. This authorization does not permit debits.',choice:'I may choose check payment instead and am not required to use a particular bank.',withdrawal:'I may withdraw here for payments not yet submitted. Withdrawal does not reverse payments already submitted. Contact payroll to arrange another payment method.'}
 return {terms,fingerprint:createHash('sha256').update(JSON.stringify({destinationId:Number(d.id),connectionId:Number(d.connection_id),terms})).digest('hex')}
}
export function registerPaymentAuthorizationRoutes(app,pool){
 const auth=payrollEmployeeAuth(pool),path='/api/payroll/employee/payment-authorization'
 app.get(path,auth,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const s=req.payrollEmployee,d=await latest(pool,s),records=await history(pool,s)
  if(!d)return res.json({success:true,data:{destinationId:0,status:'NOT_CONFIGURED',history:records}})
  const current=(await pool.query('SELECT id FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[s.facility_id])).rows[0],details=await paymentAuthorizationDisclosure(pool,s,d)
  const receipts=[]
  for(const record of records){const row=(await pool.query('SELECT encrypted_receipt FROM payroll_payment_authorization WHERE id=$1',[record.id])).rows[0];receipts.push({...record,receipt:row.encrypted_receipt?JSON.parse(decryptDocument(row.encrypted_receipt,`payroll-payment-authorization:${s.facility_id}:${s.employee_id}:${record.destination_id}`).toString()):null})}
  const validConnection=Number(current?.id)===Number(d.connection_id),authorized=Number(records[0]?.destination_id)===Number(d.id)&&records[0]?.decision==='AUTHORIZE'&&receipts[0]?.receipt?.fingerprint===details.fingerprint
  res.json({success:true,data:{destinationId:Number(d.id),status:!validConnection?'CONNECTION_CHANGED':authorized?'AUTHORIZED':'AUTHORIZATION_REQUIRED',canAuthorize:validConnection&&s.employment_status!=='TERMINATED',...details,history:receipts}})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read direct-deposit authorization.'})}})
 app.post(path,auth,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  const b=req.body||{},s=req.payrollEmployee
  if(b.confirmed!==true||!['AUTHORIZE','WITHDRAW'].includes(b.decision)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!Number.isSafeInteger(b.destinationId)||b.destinationId<=0)throw fail('Review the current account and confirm your decision.')
  await db.query('BEGIN');const employee=await lockPayrollEmployeeSession(db,s,req)
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${s.facility_id}`]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-destination:${s.facility_id}:${s.employee_id}`])
  const d=await latest(db,s),records=await history(db,s)
  if(Number(d?.id)!==b.destinationId||Number(records[0]?.id||0)!==b.expectedRevision)throw fail('Account or authorization changed. Refresh before confirming.',409)
  let receipt=null
  if(b.decision==='AUTHORIZE'){
   if(employee.employment_status==='TERMINATED')throw fail('Former employees may withdraw authorization but cannot authorize a new account.',403)
   const current=(await db.query('SELECT id FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[s.facility_id])).rows[0]
   if(Number(current?.id)!==Number(d.connection_id))throw fail('The employer connection changed. Contact payroll to review the account.',409)
   const details=await paymentAuthorizationDisclosure(db,s,d)
   if(b.fingerprint!==details.fingerprint||typeof b.signature!=='string'||b.signature.trim().length<2||b.signature.length>200||/[\u0000-\u001f\u007f]/.test(b.signature))throw fail('Review the current terms and enter your name as your signature.',409)
   receipt=encryptDocument(Buffer.from(JSON.stringify({...details,signature:b.signature.trim(),destinationId:Number(d.id)})),`payroll-payment-authorization:${s.facility_id}:${s.employee_id}:${d.id}`)
  }
  const saved=(await db.query('INSERT INTO payroll_payment_authorization(destination_id,decision,session_id,encrypted_receipt) VALUES($1,$2,$3,$4) RETURNING id,decision,created_at',[d.id,b.decision,s.session_id,receipt])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'EMPLOYEE_PAYMENT_AUTHORIZATION','payment_destination',$2,$3)",[s.facility_id,String(d.id),{employeeId:Number(s.employee_id),authorizationId:Number(saved.id),decision:b.decision}])
  await db.query('COMMIT');res.status(201).json({success:true,data:saved})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to record payment authorization.'})}finally{db.release()}})
}
