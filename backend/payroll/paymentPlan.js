import {createHash} from 'node:crypto'
import {employeePaymentReadiness} from './paymentReadiness.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export async function payrollPaymentPlan(db,facility,runId,{loadRunPreview,payrollFingerprint}){
 const run=(await db.query('SELECT r.*,COALESCE(r.payment_date,p.pay_date)::text AS payment_day FROM payroll_run r LEFT JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.id=$1 AND r.facility_id=$2',[runId,facility])).rows[0]
 if(!run)throw fail('Payroll run not found.',404)
 if(run.status!=='APPROVED')throw fail('Approve the payroll calculation before reviewing payment instructions.',409)
 const employees=(await db.query('SELECT re.*,e.legal_first_name,e.legal_last_name FROM payroll_run_employee re JOIN payroll_employee e ON e.id=re.employee_id AND e.facility_id=$2 WHERE re.payroll_run_id=$1 ORDER BY re.employee_id',[runId,facility])).rows
 const current=await loadRunPreview(db,facility,run),verified=new Set(employees.filter(e=>e.withholding_verified_at&&e.net_pay_cents!==null).map(e=>Number(e.employee_id)))
 if(!current||payrollFingerprint(current.preview)!==payrollFingerprint(run.calculation_snapshot)||current.preview.warnings.some(w=>w.blocking&&!(w.code==='WITHHOLDING_ENGINE_NOT_CONFIGURED'&&verified.has(Number(w.employeeId)))))throw fail('Payroll inputs changed after approval. Rebuild and approve the current calculation.',409)
 const payments=[],issues=[]
 if(!employees.length)issues.push('This run has no employee payment lines.')
 for(const row of employees){
  const amountCents=row.net_pay_cents===null?null:Number(row.net_pay_cents),employeeId=Number(row.employee_id)
  if(!Number.isSafeInteger(amountCents)||amountCents<0){issues.push(`Employee ${employeeId} needs a valid nonnegative net payment.`);continue}
  const payment={employeeId,employeeName:`${row.legal_first_name} ${row.legal_last_name}`,amountCents,method:'ZERO_NET',readiness:null}
  if(amountCents>0){
   const election=(await db.query("SELECT status,response FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='PAYMENT' ORDER BY id DESC LIMIT 1",[facility,employeeId])).rows[0]
   if(election?.status!=='COMPLETE'||!['CHECK','DIRECT_DEPOSIT'].includes(election?.response?.method)){payment.method='UNRESOLVED';issues.push(`Review employee ${employeeId}'s payment election.`)}
   else{payment.method=election.response.method;if(payment.method==='DIRECT_DEPOSIT'){payment.readiness=await employeePaymentReadiness(db,facility,employeeId);if(payment.readiness.issue)issues.push(`Employee ${employeeId}: ${payment.readiness.issue}`)}}
  }
  payments.push(payment)
 }
 const totals={directDepositCents:0,checkCents:0,zeroNetEmployees:0,totalCents:0}
 for(const payment of payments){totals.totalCents+=payment.amountCents;if(payment.method==='DIRECT_DEPOSIT')totals.directDepositCents+=payment.amountCents;if(payment.method==='CHECK')totals.checkCents+=payment.amountCents;if(payment.method==='ZERO_NET')totals.zeroNetEmployees++}
 if(!Object.values(totals).every(Number.isSafeInteger)||totals.totalCents!==Number(run.net_pay_cents))issues.push('Employee net payments do not reconcile to the approved run total.')
 const basis={runId:Number(run.id),paymentDate:run.payment_day,calculation:payrollFingerprint(run.calculation_snapshot),payments,totals}
 return {runId:Number(run.id),paymentDate:run.payment_day,status:issues.length?'NEEDS_REVIEW':'READY_FOR_PAYMENT_REVIEW',executionAvailable:false,payments,totals,issues,fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex')}
}
export function registerPaymentPlanRoutes(app,pool,dependencies){
 app.get('/api/admin/payroll/runs/:id/payment-plan',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0)throw fail('Choose a valid payroll run.')
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
   const result=await payrollPaymentPlan(db,req.canonicalAccess.facilityId,id,dependencies)
   await db.query('ROLLBACK');res.json({success:true,data:result})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to prepare payroll payment instructions.'})}finally{db.release()}
 })
}
