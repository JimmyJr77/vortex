import {refreshCheckStopCases} from './checkStopCase.js'
import {refreshPaymentReturnCases} from './paymentReturnCase.js'
export async function runPaymentReturnCaseSweep(pool,{limit=25,now=()=>new Date()}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Choose a case review limit from 1 to 100.')
 const checkedAt=now();if(!(checkedAt instanceof Date)||!Number.isFinite(checkedAt.getTime()))throw new Error('Invalid case review time.')
 const db=await pool.connect();let locked=false
 try{
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended('payroll-return-case-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {skipped:true,checked:0,failed:0}
  const due=(await db.query(`SELECT r.id,r.facility_id FROM payroll_run r LEFT JOIN LATERAL(SELECT created_at FROM payroll_payment_return_case_check WHERE payroll_run_id=r.id ORDER BY id DESC LIMIT 1)c ON true WHERE (EXISTS(SELECT 1 FROM payroll_payment_replacement_authorization WHERE payroll_run_id=r.id) OR EXISTS(SELECT 1 FROM payroll_check_replacement_authorization a JOIN payroll_check_issue i ON i.id=a.issue_id WHERE i.payroll_run_id=r.id)) AND (c.created_at IS NULL OR c.created_at<$2::timestamptz-interval '10 minutes') ORDER BY c.created_at NULLS FIRST,r.id LIMIT $1`,[limit,checkedAt])).rows
  let checked=0,failed=0
  for(const run of due){
   await db.query('INSERT INTO payroll_payment_return_case_check(payroll_run_id,created_at) VALUES($1,$2)',[run.id,checkedAt])
   try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${run.facility_id}`]);await refreshPaymentReturnCases(db,Number(run.facility_id),Number(run.id));await refreshCheckStopCases(db,Number(run.facility_id),Number(run.id));await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[run.facility_id,`return-case-review-${run.id}`]);await db.query('COMMIT');checked++}
   catch{await db.query('ROLLBACK').catch(()=>{});failed++;await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Payroll payment case review failed','Automatic case review could not complete. Review the payroll case and connections.') ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[run.facility_id,`return-case-review-${run.id}`])}
  }
  return {skipped:false,checked,failed}
 }finally{let destroy=false;if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtextextended('payroll-return-case-sweep',0))")}catch{destroy=true}db.release(destroy)}
}
export function startPaymentReturnCaseScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_RETURN_CASE_REVIEW_ENABLED==='false')return null
 const execute=()=>runPaymentReturnCaseSweep(pool).catch(error=>console.error('[payroll] payment case review failed:',error))
 const first=setTimeout(execute,60000);first.unref?.();const timer=setInterval(execute,5*60000);timer.unref?.();return timer
}
