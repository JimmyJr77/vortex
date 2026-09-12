import {bankEnrollmentSummary} from './bankEnrollment.js'
import {isDeepStrictEqual} from 'node:util'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readModernTreasuryEmployeeAccount} from './modernTreasuryPayments.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const context=(facility,employee)=>`payroll-payment-destination:${facility}:${employee}`
export async function readPayrollPaymentDestination(db,facility,employee,revision){
 const row=(await db.query('SELECT encrypted_destination,connection_id FROM payroll_payment_destination WHERE facility_id=$1 AND employee_id=$2 AND id=$3',[facility,employee,revision])).rows[0]
 if(!row)throw fail('Employee payment destination not found.',404)
 return {...JSON.parse(decryptDocument(row.encrypted_destination,context(facility,employee)).toString()),connectionId:Number(row.connection_id)}
}
export function registerPaymentDestinationRoutes(app,pool,{fetcher=fetch}={}){
 const path='/api/admin/payroll/employees/:employeeId/payment-destination'
 const scope=async(db,req)=>{const employee=Number(req.params.employeeId),facility=req.canonicalAccess.facilityId;if(!Number.isSafeInteger(employee)||employee<=0)throw fail('Choose a valid employee.');if(!(await db.query('SELECT id FROM payroll_employee WHERE id=$1 AND facility_id=$2',[employee,facility])).rowCount)throw fail('Employee not found.',404);return {employee,facility}}
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const {employee,facility}=await scope(pool,req),rows=(await pool.query('SELECT id,connection_id,created_by,created_at FROM payroll_payment_destination WHERE facility_id=$1 AND employee_id=$2 ORDER BY id DESC',[facility,employee])).rows
  const enrollment=await bankEnrollmentSummary(pool,facility,employee)
  if(!rows.length)return res.json({success:true,data:{revision:0,status:'NOT_CONFIGURED',history:[],enrollment}})
  const current=await readPayrollPaymentDestination(pool,facility,employee,rows[0].id),connection=(await pool.query('SELECT id FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[facility])).rows[0]
  const authorization=(await pool.query('SELECT a.decision,a.destination_id FROM payroll_payment_authorization a JOIN payroll_payment_destination d ON d.id=a.destination_id WHERE d.facility_id=$1 AND d.employee_id=$2 ORDER BY a.id DESC LIMIT 1',[facility,employee])).rows[0]
  const recorded=authorization?.decision==='AUTHORIZE'&&Number(authorization.destination_id)===Number(rows[0].id)
  res.json({success:true,data:{enrollment,revision:Number(rows[0].id),status:Number(connection?.id)===current.connectionId?(recorded?'EMPLOYEE_AUTHORIZATION_RECORDED':'EMPLOYEE_AUTHORIZATION_REQUIRED'):'CONNECTION_CHANGED',account:{holderName:current.holderName,accountType:current.accountType,accountLast4:current.accountLast4,mode:current.mode},history:rows}})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read employee payment destination.'})}})
 app.post(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const body=req.body||{}
   if(body.confirmed!==true||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||!Number.isSafeInteger(body.connectionId)||body.connectionId<=0||typeof body.accountId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.accountId)||typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.length>2000||/[\u0000-\u001f\u007f]/.test(body.reference))throw fail('Provide the verified provider account, current connection, evidence reference and confirmation.')
   await db.query('BEGIN');const {employee,facility}=await scope(db,req)
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[context(facility,employee)])
   const connection=(await db.query('SELECT id FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[facility])).rows[0]
   if(Number(connection?.id)!==body.connectionId)throw fail('Payment connection changed. Refresh before linking the employee account.',409)
   const current=(await db.query('SELECT id FROM payroll_payment_destination WHERE facility_id=$1 AND employee_id=$2 ORDER BY id DESC LIMIT 1',[facility,employee])).rows[0]
   if(Number(current?.id||0)!==body.expectedRevision)throw fail('Employee payment destination changed. Refresh before saving.',409)
   const config=await readPayrollPaymentConnection(db,facility,body.connectionId),result=await readModernTreasuryEmployeeAccount({...config,fetcher},body.accountId.toLowerCase())
   if(result.status!=='VERIFIED')throw fail(result.status==='UNAVAILABLE'?'The provider account is unavailable. Retry verification.':'The account needs provider verification or supported individual checking/savings details.',409)
   const retained={version:1,...result.account,reference:body.reference.trim()}
   if(current){const previous=await readPayrollPaymentDestination(db,facility,employee,current.id);const sameConnection=previous.connectionId===body.connectionId;delete previous.connectionId;if(sameConnection&&isDeepStrictEqual(previous,retained)){await db.query('COMMIT');return res.json({success:true,data:{revision:Number(current.id),reused:true}})}}
   const saved=(await db.query('INSERT INTO payroll_payment_destination(facility_id,employee_id,connection_id,encrypted_destination,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',[facility,employee,body.connectionId,encryptDocument(Buffer.from(JSON.stringify(retained)),context(facility,employee)),req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'PAYMENT_DESTINATION_LINKED','payment_destination',$3,$4)",[facility,req.adminId,String(saved.id),{employeeId:employee,connectionId:body.connectionId}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{revision:Number(saved.id),reused:false,status:'EMPLOYEE_AUTHORIZATION_REQUIRED'}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to link employee payment destination.'})}finally{db.release()}
 })
}
