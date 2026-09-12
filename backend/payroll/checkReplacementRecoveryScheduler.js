import {processCheckReplacementDocument} from './checkReplacementDocument.js'
import {dispatchCheckReplacement} from './checkReplacementDispatch.js'

export async function runCheckReplacementRecoverySweep(pool,{fetcher=fetch,limit=25,now=()=>new Date()}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Choose a replacement recovery limit from 1 to 100.')
 const checkedAt=now();if(!(checkedAt instanceof Date)||!Number.isFinite(checkedAt.getTime()))throw new Error('Invalid replacement recovery time.')
 const db=await pool.connect();let locked=false
 try{
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended('payroll-check-replacement-recovery-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {skipped:true,checked:0,failed:0}
  const due=(await db.query(`SELECT a.id,a.method,i.facility_id,i.payroll_run_id,i.batch_id,i.employee_id FROM payroll_check_replacement_authorization a JOIN payroll_check_issue i ON i.id=a.issue_id
   JOIN payroll_check_replacement_claim t ON t.authorization_id=a.id
   LEFT JOIN payroll_check_replacement_cancellation cancelled ON cancelled.authorization_id=a.id
   LEFT JOIN LATERAL(SELECT created_at FROM payroll_check_replacement_recovery_check WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1)c ON true
   LEFT JOIN LATERAL(SELECT created_at,source,result FROM payroll_check_replacement_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1)o ON true
   LEFT JOIN payroll_alert alert ON alert.facility_id=i.facility_id AND alert.dedupe_key='check-replacement-'||a.id::text
   WHERE cancelled.authorization_id IS NULL
   AND GREATEST(t.created_at,c.created_at,o.created_at)<$2::timestamptz-CASE WHEN o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED' AND o.result->>'dateMatches'='true' AND o.result->>'liveMode'='true' AND (a.method<>'CHECK' OR o.result->>'expiryMatches'='true') AND alert.status IS DISTINCT FROM 'OPEN' THEN interval '1 day' ELSE interval '10 minutes' END
   ORDER BY GREATEST(t.created_at,c.created_at,o.created_at),a.id LIMIT $1`,[limit,checkedAt])).rows
  let checked=0,failed=0
  for(const row of due){
   await db.query('INSERT INTO payroll_check_replacement_recovery_check(authorization_id,created_at) VALUES($1,$2)',[row.id,checkedAt])
   let stage='payment'
   try{
    const result=await dispatchCheckReplacement(pool,Number(row.facility_id),Number(row.payroll_run_id),Number(row.batch_id),Number(row.employee_id),row.id,{fetcher,recoveryOnly:true,automatic:true,now})
    if(row.method==='CHECK'&&result.status==='SENT'){
     stage='document'
     const document=await processCheckReplacementDocument(pool,Number(row.facility_id),Number(row.payroll_run_id),Number(row.batch_id),Number(row.employee_id),row.id,{action:'RETAIN',fetcher,automatic:true,now})
     if(document.status!=='RETAINED'){failed++;continue}
    }
    checked++
   }
   catch{failed++;await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Replacement payment needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[row.facility_id,stage==='document'?`check-replacement-document-${row.id}`:`check-replacement-${row.id}`,`Run ${row.payroll_run_id}: automatic replacement recovery could not complete. Review the retained connection and payment evidence.`])}
  }
  return {skipped:false,checked,failed}
 }finally{let destroy=false;if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtextextended('payroll-check-replacement-recovery-sweep',0))")}catch{destroy=true}db.release(destroy)}
}
export function startCheckReplacementRecoveryScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_CHECK_REPLACEMENT_RECOVERY_ENABLED==='false')return null
 const execute=()=>runCheckReplacementRecoverySweep(pool).catch(error=>console.error('[payroll] replacement recovery sweep failed:',error))
 const first=setTimeout(execute,60000);first.unref?.();const timer=setInterval(execute,5*60000);timer.unref?.();return timer
}
