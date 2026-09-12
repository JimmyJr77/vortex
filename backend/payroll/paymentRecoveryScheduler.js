import {dispatchPayrollInstruction} from './paymentDispatch.js'
import {runAutomaticCloseouts} from './automaticCloseout.js'
import {loadRunPreview,payrollFingerprint,finalizePayrollRun} from './registerRoutes.js'

export async function runPaymentRecoverySweep(pool,{fetcher=fetch,limit=25,now=()=>new Date()}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Choose a payment recovery limit from 1 to 100.')
 const db=await pool.connect();let locked=false
 try{
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended('payroll-payment-recovery-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {skipped:true,checked:0,failed:0}
  const due=(await db.query(`SELECT a.id,a.batch_id,a.instruction_id,b.facility_id FROM payroll_payment_dispatch_attempt a
   JOIN payroll_payment_batch b ON b.id=a.batch_id JOIN payroll_run r ON r.id=b.payroll_run_id
   LEFT JOIN LATERAL(SELECT created_at FROM payroll_payment_recovery_check WHERE attempt_id=a.id ORDER BY id DESC LIMIT 1)c ON true
   WHERE r.status IN ('APPROVED','FINALIZED') AND NOT EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=b.id)
   AND (c.created_at IS NULL OR c.created_at<clock_timestamp()-CASE WHEN r.status='FINALIZED' THEN interval '1 day' ELSE interval '10 minutes' END)
   ORDER BY c.created_at NULLS FIRST,a.id LIMIT $1`,[limit])).rows
  let checked=0,failed=0
  for(const row of due){
   // Commit scheduling evidence before work. Failed credentials and crashed
   // workers get a retry delay rather than starving every newer instruction.
   await db.query('INSERT INTO payroll_payment_recovery_check(attempt_id) VALUES($1)',[row.id])
   try{
    await dispatchPayrollInstruction(pool,Number(row.facility_id),Number(row.batch_id),row.instruction_id,{fetcher,loadRunPreview,payrollFingerprint,recoveryOnly:true})
    checked++
   }catch{
    if((await db.query('SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=$1',[row.batch_id])).rowCount)continue
    failed++
    await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message)
     VALUES($1,$2,'CRITICAL','Payment recovery needs attention',$3)
     ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[row.facility_id,`payment-recovery-${row.instruction_id}`,`Unable to recover payment status for authorization ${row.batch_id}. Review its connection and retained instruction in Payroll runs.`])
   }
  }
  const closeout=await runAutomaticCloseouts(pool,{finalize:finalizePayrollRun,now,limit})
  return {skipped:false,checked,failed,closeout}
 }finally{
  let destroy=false
  if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtextextended('payroll-payment-recovery-sweep',0))")}catch{destroy=true}
  db.release(destroy)
 }
}
export function startPaymentRecoveryScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_PAYMENT_RECOVERY_ENABLED==='false')return null
 const execute=()=>runPaymentRecoverySweep(pool).catch(error=>console.error('[payroll] payment recovery sweep failed:',error))
 const first=setTimeout(execute,60000);first.unref?.()
 const timer=setInterval(execute,5*60000);timer.unref?.()
 return timer
}
