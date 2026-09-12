import {retainCheckReplacementCloseout} from './checkReplacementCloseout.js'
import {isDeepStrictEqual} from 'node:util'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
// Caller holds settings, payment-connection and run locks in that order.
export async function preparePaymentCloseout(db,facility,run,body){
 const batch=(await db.query('SELECT b.*,c.batch_id AS cancelled FROM payroll_payment_batch b LEFT JOIN payroll_payment_batch_cancellation c ON c.batch_id=b.id WHERE b.facility_id=$1 AND b.payroll_run_id=$2',[facility,run.id])).rows[0]
 if(!batch||Number(batch.id)!==body.batchId||batch.fingerprint!==body.fingerprint||batch.cancelled)throw fail('Refresh the active payment authorization before closing payroll.')
 await retainCheckReplacementCloseout(db,facility,Number(run.id))
 if(run.status!=='FINALIZED'&&(await db.query('SELECT id FROM payroll_check_issue WHERE batch_id=$1 AND NOT payroll_check_closeout_ready(id)',[batch.id])).rowCount)throw fail('An issued digital check requires verified document delivery before payroll can close. Recover the retained check; do not record a second manual payment.')
 if(body.confirmed!==true||typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.length>500||/[\u0000-\u001f\u007f]/.test(body.reference)||(!Array.isArray(body.checkPayments)||body.checkPayments.some(c=>!c||typeof c!=='object')))throw fail('Confirm payment closeout and retain its reference.',400)
 const checks=body.checkPayments.map(check=>({employeeId:check.employeeId,amountCents:check.amountCents,paymentDate:check.paymentDate,reference:typeof check.reference==='string'?check.reference.trim():''})).sort((a,b)=>a.employeeId-b.employeeId)
 const required=batch.plan.payments.filter(p=>p.method==='CHECK')
 if(checks.length!==required.length||new Set(checks.map(c=>c.employeeId)).size!==checks.length||checks.some(c=>!required.some(p=>p.employeeId===c.employeeId&&p.amountCents===c.amountCents)||c.paymentDate!==batch.plan.paymentDate||c.reference.length<4||c.reference.length>200||/[\u0000-\u001f\u007f]/.test(c.reference)))throw fail('Record each check employee’s exact amount, payment date and check delivery reference.',400)
 const deliveries=(await db.query('SELECT i.employee_id,d.reference FROM payroll_check_issue i LEFT JOIN payroll_check_delivery d ON d.issue_id=i.id WHERE i.batch_id=$1',[batch.id])).rows
 if(deliveries.some(d=>!checks.some(c=>c.employeeId===Number(d.employee_id)&&c.reference===d.reference)))throw fail('Use the retained handoff reference for each issued digital check.')
 return {batch,checks}
}
export async function retainPaymentCloseout(db,facility,run,body,actorId,{today}={}){
 const {batch,checks}=await preparePaymentCloseout(db,facility,run,body)
 if(today&&(await db.query('SELECT p.evidence FROM payroll_check_replacement_closeout p JOIN payroll_check_issue i ON i.id=p.issue_id WHERE i.batch_id=$1 AND payroll_check_replacement_closeout_proof_ready(p.id)',[batch.id])).rows.some(p=>p.evidence.replacementDate>today))throw fail('The replacement payment date has not arrived. Close payroll on or after its actual replacement date.')
 const existing=(await db.query('SELECT * FROM payroll_payment_closeout WHERE batch_id=$1',[batch.id])).rows[0]
 if(existing){
  if(existing.reference!==body.reference.trim()||!isDeepStrictEqual(existing.check_payments,checks))throw fail('A different closeout is already retained.')
  return {id:Number(batch.id),reused:true}
 }
 if(run.status!=='APPROVED')throw fail('Only approved payroll can be closed.')
 if(!(await db.query('SELECT payroll_payment_closeout_ready($1,$2) AS ready',[batch.id,JSON.stringify(checks)])).rows[0].ready)throw fail('Recover current posted bank evidence for every direct deposit and resolve payment exceptions before closeout.')
 await db.query('INSERT INTO payroll_payment_closeout(batch_id,reference,check_payments,created_by) VALUES($1,$2,$3,$4)',[batch.id,body.reference.trim(),JSON.stringify(checks),actorId])
 return {id:Number(batch.id),reused:false}
}
