import {refreshRetirementContribution} from './retirementContributionReconciliation.js'
export async function runRetirementContributionSweep(pool,{facility=null,now=new Date()}={}){
 const lock=await pool.connect();let locked=false
 try{
  locked=(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('retirement-contribution-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {attempted:0,changed:0,failed:0,skipped:true}
  const candidates=(await pool.query(`SELECT a.id,a.facility_id FROM payroll_retirement_remittance_authorization a
   LEFT JOIN payroll_retirement_contribution_checkpoint c ON c.authorization_id=a.id
   LEFT JOIN payroll_retirement_contribution_assessment h ON h.id=c.assessment_id
   LEFT JOIN LATERAL(SELECT max(created_at) at FROM payroll_retirement_contribution_failure WHERE authorization_id=a.id) f ON true
   WHERE ($1::bigint IS NULL OR a.facility_id=$1) AND (h.summary->>'status' IS DISTINCT FROM 'CANCELLED')
   AND (GREATEST(c.checked_at,f.at) IS NULL OR GREATEST(c.checked_at,f.at)<=$2::timestamptz-interval '5 minutes')
   ORDER BY COALESCE(GREATEST(c.checked_at,f.at),a.created_at),a.id LIMIT 10`,[facility,new Date(now).toISOString()])).rows
  let attempted=0,changed=0,failed=0
  for(const row of candidates){
   try{const result=await refreshRetirementContribution(pool,Number(row.facility_id),row.id,{now,automatic:true});if(!result.skipped){attempted++;if(result.changed)changed++}}
   catch{
    const db=await pool.connect()
    try{
     await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${row.facility_id}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[row.facility_id])
     const current=(await db.query('SELECT checked_at FROM payroll_retirement_contribution_checkpoint WHERE facility_id=$1 AND authorization_id=$2',[row.facility_id,row.id])).rows[0]
     if(current&&+new Date(current.checked_at)>=+new Date(now)){await db.query('COMMIT');continue}
     const message='Automatic contribution reconciliation could not read or retain its evidence. The next scheduled check will retry; review contribution history if this persists.'
     await db.query('INSERT INTO payroll_retirement_contribution_failure(facility_id,authorization_id,message,created_at) VALUES($1,$2,$3,$4)',[row.facility_id,row.id,message,new Date(now).toISOString()])
     await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Retirement contribution check needs recovery',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[row.facility_id,`retirement-contribution-check-${row.id}`,message])
     await db.query('COMMIT');attempted++;failed++
    }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
   }
  }
  return {attempted,changed,failed}
 }finally{let destroy=false;if(locked)try{await lock.query("SELECT pg_advisory_unlock(hashtextextended('retirement-contribution-sweep',0))")}catch{destroy=true}lock.release(destroy)}
}
export function startRetirementContributionScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_RETIREMENT_RECONCILIATION_ENABLED==='false')return null
 let running=false;const timer=setInterval(()=>{if(running)return;running=true;void runRetirementContributionSweep(pool).catch(()=>console.error('[payroll] Retirement contribution reconciliation needs recovery.')).finally(()=>{running=false})},60000);timer.unref?.();return timer
}
