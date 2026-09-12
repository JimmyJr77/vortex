import {cancelPayrollCheck} from './checkCancellation.js'
import {stopPayrollCheck} from './checkStop.js'
import {processCheckDocument} from './checkDocument.js'
import {issuePayrollCheck} from './checkIssuance.js'

export async function runCheckIssueRecoverySweep(pool,{fetcher=fetch,limit=25,now=()=>new Date()}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Choose a check recovery limit from 1 to 100.')
 const checkedAt=now();if(!(checkedAt instanceof Date)||!Number.isFinite(checkedAt.getTime()))throw new Error('Invalid check recovery time.')
 const db=await pool.connect();let locked=false
 try{
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended('payroll-check-issue-recovery-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {skipped:true,checked:0,failed:0}
  const due=(await db.query(`SELECT i.id,i.facility_id,i.payroll_run_id,i.batch_id,i.employee_id,s.id AS stop_id,k.id AS cancellation_id FROM payroll_check_issue i
   LEFT JOIN payroll_check_stop s ON s.issue_id=i.id
   LEFT JOIN payroll_check_cancellation k ON k.issue_id=i.id
   LEFT JOIN LATERAL(SELECT created_at,result FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1)x ON true
   LEFT JOIN LATERAL(SELECT created_at FROM payroll_check_issue_recovery_check WHERE issue_id=i.id ORDER BY id DESC LIMIT 1)c ON true
   LEFT JOIN LATERAL(SELECT created_at,source,result FROM payroll_check_issue_observation WHERE issue_id=i.id ORDER BY id DESC LIMIT 1)o ON true
   LEFT JOIN payroll_alert a ON a.facility_id=i.facility_id AND a.dedupe_key='check-issue-'||i.id::text
   WHERE NOT EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=i.batch_id) AND GREATEST(i.created_at,s.created_at,c.created_at,o.created_at,x.created_at)<$2::timestamptz-CASE
    WHEN s.id IS NOT NULL THEN CASE WHEN x.result->>'status'='STOP_CONFIRMED' AND o.result->>'status'='STOPPED' AND o.result->>'providerId'=s.provider_id::text AND o.result->>'dateMatches'='true' AND o.result->>'expiryMatches'='true' AND o.result->>'liveMode'='true' THEN interval '1 day' ELSE interval '10 minutes' END
    WHEN o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED'
     AND o.result->>'dateMatches'='true' AND o.result->>'expiryMatches'='true' AND o.result->>'liveMode'='true'
     AND a.status IS DISTINCT FROM 'OPEN' THEN interval '1 day' ELSE interval '10 minutes' END
   ORDER BY GREATEST(i.created_at,s.created_at,c.created_at,o.created_at,x.created_at),i.id LIMIT $1`,[limit,checkedAt])).rows
  let checked=0,failed=0
  for(const row of due){
   await db.query('INSERT INTO payroll_check_issue_recovery_check(issue_id,created_at) VALUES($1,$2)',[row.id,checkedAt])
   try{
    if(row.cancellation_id)await cancelPayrollCheck(pool,Number(row.facility_id),Number(row.payroll_run_id),Number(row.batch_id),Number(row.employee_id),{fetcher,recoveryOnly:true,automatic:true})
    if(row.stop_id)await stopPayrollCheck(pool,Number(row.facility_id),Number(row.payroll_run_id),Number(row.batch_id),Number(row.employee_id),{fetcher,recoveryOnly:true,automatic:true})
    const result=await issuePayrollCheck(pool,Number(row.facility_id),Number(row.payroll_run_id),Number(row.batch_id),Number(row.employee_id),{fetcher,recoveryOnly:true,automatic:true,now})
    if(result.status==='SENT'&&!(await db.query('SELECT payroll_check_stop_blocks($1) AS blocked',[row.id])).rows[0].blocked){
     try{
      const document=await processCheckDocument(pool,Number(row.facility_id),Number(row.payroll_run_id),Number(row.batch_id),Number(row.employee_id),{action:'RETAIN',fetcher,automatic:true,now})
      if(document.status!=='RETAINED'){failed++;continue}
     }catch{
      failed++;await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Check document needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[row.facility_id,`check-document-${row.id}`,`Employee ${row.employee_id}: automatic document preparation could not complete. Review the retained check and document evidence.`]);continue
     }
    }
    checked++
   }catch{
    if(row.stop_id){
     await db.query("INSERT INTO payroll_check_stop_observation(stop_id,source,result,retry_id) VALUES($1,'RECOVERY',$2,(SELECT id FROM payroll_check_stop_retry WHERE stop_id=$1 ORDER BY sequence DESC LIMIT 1))",[row.stop_id,{status:'RECOVERY_UNAVAILABLE'}])
     await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'CHECK_STOP_RECOVERY_FAILED','check_stop',$2,$3)",[row.facility_id,row.stop_id,{automatic:true,employeeId:Number(row.employee_id)}])
    }
    failed++;await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Payroll check needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[row.facility_id,`check-issue-${row.id}`,`Employee ${row.employee_id}: automatic check recovery could not complete. Review the retained connection and check evidence.`])
   }
  }
  return {skipped:false,checked,failed}
 }finally{let destroy=false;if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtextextended('payroll-check-issue-recovery-sweep',0))")}catch{destroy=true}db.release(destroy)}
}
export function startCheckIssueRecoveryScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_CHECK_ISSUE_RECOVERY_ENABLED==='false')return null
 const execute=()=>runCheckIssueRecoverySweep(pool).catch(error=>console.error('[payroll] check recovery sweep failed:',error))
 const first=setTimeout(execute,60000);first.unref?.();const timer=setInterval(execute,5*60000);timer.unref?.();return timer
}
