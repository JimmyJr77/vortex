import {advanceCheckPayee} from './checkPayee.js'
export async function runCheckPayeeRecoverySweep(pool,{fetcher=fetch,limit=25,now=()=>new Date()}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Choose a check-recipient recovery limit from 1 to 100.')
 const checkedAt=now();if(!(checkedAt instanceof Date)||!Number.isFinite(checkedAt.getTime()))throw new Error('Invalid check-recipient recovery time.')
 const db=await pool.connect();let locked=false
 try{
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended('payroll-check-payee-recovery-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {skipped:true,checked:0,failed:0}
  const due=(await db.query(`SELECT p.id,p.facility_id,p.employee_id,o.id AS operation_id,o.stage FROM payroll_check_payee p
   JOIN payroll_check_payee_operation o ON o.payee_id=p.id
   LEFT JOIN LATERAL(SELECT created_at FROM payroll_check_payee_recovery_check WHERE operation_id=o.id ORDER BY id DESC LIMIT 1)c ON true
   LEFT JOIN LATERAL(SELECT created_at,result FROM payroll_check_payee_observation WHERE operation_id=o.id ORDER BY id DESC LIMIT 1)x ON true
   LEFT JOIN payroll_alert a ON a.facility_id=p.facility_id AND a.dedupe_key='check-payee-'||p.id::text||'-'||o.stage
   WHERE GREATEST(o.created_at,c.created_at,x.created_at)<$2::timestamptz-CASE WHEN x.result->>'status'='RECORDED' AND a.status IS DISTINCT FROM 'OPEN' THEN interval '1 day' ELSE interval '10 minutes' END
   ORDER BY GREATEST(o.created_at,c.created_at,x.created_at),CASE o.stage WHEN 'COUNTERPARTY' THEN 0 ELSE 1 END,o.id LIMIT $1`,[limit,checkedAt])).rows
  let checked=0,failed=0
  for(const row of due){
   await db.query('INSERT INTO payroll_check_payee_recovery_check(operation_id,created_at) VALUES($1,$2)',[row.operation_id,checkedAt])
   try{await advanceCheckPayee(pool,Number(row.facility_id),Number(row.employee_id),row.id,{stage:row.stage,fetcher,recoveryOnly:true,automatic:true});checked++}
   catch{failed++;await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Check recipient needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[row.facility_id,`check-payee-${row.id}-${row.stage}`,`Employee ${row.employee_id}: automatic recipient recovery could not complete. Review the retained connection and recipient evidence.`])}
  }
  return {skipped:false,checked,failed}
 }finally{let destroy=false;if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtextextended('payroll-check-payee-recovery-sweep',0))")}catch{destroy=true}db.release(destroy)}
}
export function startCheckPayeeRecoveryScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_CHECK_PAYEE_RECOVERY_ENABLED==='false')return null
 const execute=()=>runCheckPayeeRecoverySweep(pool).catch(error=>console.error('[payroll] check recipient recovery sweep failed:',error))
 const first=setTimeout(execute,60000);first.unref?.();const timer=setInterval(execute,5*60000);timer.unref?.();return timer
}
