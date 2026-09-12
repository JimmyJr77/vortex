import {createHash} from 'node:crypto'
import {payrollPaymentPlan} from './paymentPlan.js'
import {payrollCheckConfiguration} from './checkConfiguration.js'
import {readCheckPayee} from './checkPayee.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
// This read-only plan is the exact source for the future issuance claim. It
// deliberately cannot create a payment or replace a delivered manual check.
export async function checkIssuancePlan(db,facility,runId,batchId,employeeId,{loadRunPreview,payrollFingerprint,now=()=>new Date()}={}){
 const batch=(await db.query('SELECT b.*,c.batch_id AS cancelled,r.status AS run_status FROM payroll_payment_batch b JOIN payroll_run r ON r.id=b.payroll_run_id AND r.facility_id=b.facility_id LEFT JOIN payroll_payment_batch_cancellation c ON c.batch_id=b.id WHERE b.id=$1 AND b.facility_id=$2 AND b.payroll_run_id=$3',[batchId,facility,runId])).rows[0]
 if(!batch)throw fail('Payment authorization not found.',404)
 if(batch.cancelled||batch.run_status!=='APPROVED')throw fail('Only an active approved payment authorization can prepare a check.')
 const payment=batch.plan.payments.find(p=>p.employeeId===employeeId&&p.method==='CHECK'&&p.amountCents>0)
 if(!payment)throw fail('This authorization has no payable check for this employee.',404)
 const current=await payrollPaymentPlan(db,facility,runId,{loadRunPreview,payrollFingerprint})
 if(current.status!=='READY_FOR_PAYMENT_REVIEW'||current.fingerprint!==batch.fingerprint)throw fail('Payroll or payment election changed. Review the approved payment plan again.')
 const issues=[]
 if((await db.query('SELECT id FROM payroll_check_issue WHERE facility_id=$1 AND payroll_run_id=$2 AND employee_id=$3',[facility,runId,employeeId])).rowCount)issues.push('A check issuance claim already exists. Recover that check instead of issuing another.')
 const setup=await checkPaymentSetup(db,facility,employeeId);issues.push(...setup.issues)
 const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]?.timezone
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
 if(batch.plan.paymentDate<today)issues.push('The approved check payment date has passed. Review a current payroll payment date.')
 if((await db.query('SELECT batch_id FROM payroll_payment_closeout WHERE batch_id=$1',[batchId])).rowCount)issues.push('Payment delivery is already retained for this authorization.')
 if((await db.query("SELECT batch_id FROM payroll_automatic_closeout WHERE batch_id=$1 AND EXISTS(SELECT 1 FROM jsonb_array_elements(body->'checkPayments') c WHERE (c->>'employeeId')::bigint=$2)",[batchId,employeeId])).rowCount)issues.push('A check delivery was confirmed in an automatic closeout request. Review that delivery before another check can be prepared.')
 const basis={facilityId:facility,runId,batchId,employeeId,amountCents:payment.amountCents,paymentDate:batch.plan.paymentDate,payrollFingerprint:batch.fingerprint,...setup.basis}
 return {status:issues.length?'NEEDS_REVIEW':'READY_FOR_CHECK_REVIEW',issues,fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex'),basis}
}
export function registerCheckIssuancePlanRoutes(app,pool,dependencies){
 app.get('/api/admin/payroll/runs/:id/payment-authorization/:batchId/checks/:employeeId/plan',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const [runId,batchId,employeeId]=[req.params.id,req.params.batchId,req.params.employeeId].map(Number)
   if(![runId,batchId,employeeId].every(n=>Number.isSafeInteger(n)&&n>0))throw fail('Choose a valid payroll authorization and employee.',400)
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
   const plan=await checkIssuancePlan(db,req.canonicalAccess.facilityId,runId,batchId,employeeId,dependencies),b=plan.basis
   await db.query('ROLLBACK')
   res.json({success:true,data:{status:plan.status,issues:plan.issues,fingerprint:plan.fingerprint,employeeId,amountCents:b.amountCents,paymentDate:b.paymentDate,payeeName:b.payeeName,expiryDays:b.expiryDays,executionAvailable:plan.status==='READY_FOR_CHECK_REVIEW'}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to prepare check issuance.'})}finally{db.release()}
 })
}

export async function checkPaymentSetup(db,facility,employeeId){
 const issues=[]
 const setup=await payrollCheckConfiguration(db,facility)
 if(setup.status!=='ACTIVATION_RECORDED')issues.push('Record digital-check activation for the current employer funding connection.')
 if(setup.mode!=='LIVE')issues.push('Use a verified live funding connection for wage checks.')
 const funding=setup.connectionId?(await db.query("SELECT status,created_at>=now()-interval '15 minutes' AS fresh FROM payroll_payment_connection_check WHERE connection_id=$1 ORDER BY id DESC LIMIT 1",[setup.connectionId])).rows[0]:null
 if(funding?.status!=='VERIFIED'||!funding.fresh)issues.push('Verify the current employer funding account within fifteen minutes.')
 const payee=(await db.query('SELECT * FROM payroll_check_payee WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC LIMIT 1',[facility,employeeId])).rows[0]
 const progress=payee?(await db.query("SELECT o.stage,x.result,x.created_at>=now()-interval '15 minutes' AS fresh FROM payroll_check_payee_operation o LEFT JOIN LATERAL(SELECT result,created_at FROM payroll_check_payee_observation WHERE operation_id=o.id ORDER BY id DESC LIMIT 1)x ON true WHERE o.payee_id=$1",[payee.id])).rows:[]
 const holder=progress.find(p=>p.stage==='COUNTERPARTY'),account=progress.find(p=>p.stage==='ACCOUNT')
 if(!payee||Number(payee.connection_id)!==setup.connectionId)issues.push('Save a reviewed employee check recipient for this funding connection.')
 if(holder?.result?.status!=='RECORDED'||account?.result?.status!=='RECORDED'||!holder?.fresh||!account?.fresh||holder.result.counterpartyId!==account.result.counterpartyId)issues.push('Recover matching recipient identity and check account evidence within fifteen minutes.')
 const recipient=payee?readCheckPayee(payee):null
 if(recipient&&recipient.mode!==setup.mode)issues.push('The retained recipient environment differs from the current funding connection.')
 const connection=setup.connectionId?await readPayrollPaymentConnection(db,facility,setup.connectionId):null
 return {issues,basis:{configurationId:setup.revision,connectionId:setup.connectionId,payeeId:payee?.id||null,payeeName:recipient?.payeeName||null,mode:setup.mode,originatingAccountId:connection?.originatingAccountId||null,receivingAccountId:account?.result?.accountId||null,counterpartyId:holder?.result?.counterpartyId||null,expiryDays:setup.current?.expiry_days||90}}
}
