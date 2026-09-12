import {postSettlementJournal} from './settlementPosting.js'

export async function runSettlementRecoverySweep(pool,{fetcher=fetch,limit=25,now=()=>new Date()}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Choose a settlement recovery limit from 1 to 100.')
 const checkedAt=now();if(!(checkedAt instanceof Date)||!Number.isFinite(checkedAt.getTime()))throw new Error('Invalid settlement recovery time.')
 const db=await pool.connect();let locked=false
 try{
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended('payroll-settlement-recovery-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {skipped:true,checked:0,failed:0}
  const due=(await db.query(`SELECT j.id,j.facility_id,j.payroll_run_id FROM payroll_settlement_journal j
   JOIN payroll_settlement_journal_claim claim ON claim.journal_id=j.id
   LEFT JOIN LATERAL(SELECT created_at FROM payroll_settlement_recovery_check WHERE journal_id=j.id ORDER BY id DESC LIMIT 1)c ON true
   LEFT JOIN LATERAL(SELECT created_at,result FROM payroll_settlement_journal_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1)o ON true
   WHERE GREATEST(claim.created_at,c.created_at,o.created_at)<$2::timestamptz-CASE WHEN o.result->>'status'='SYNCED' THEN interval '1 day' ELSE interval '10 minutes' END
   ORDER BY GREATEST(claim.created_at,c.created_at,o.created_at),j.id LIMIT $1`,[limit,checkedAt])).rows
  let checked=0,failed=0
  for(const row of due){
   // Persist fairness and retry delay even if credentials fail or work crashes.
   await db.query('INSERT INTO payroll_settlement_recovery_check(journal_id,created_at) VALUES($1,$2)',[row.id,checkedAt])
   try{
    await postSettlementJournal(pool,Number(row.facility_id),Number(row.payroll_run_id),{action:'RECOVER',jobId:row.id},{fetcher})
    checked++
   }catch{
    failed++
    await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message)
     VALUES($1,$2,'WARNING','QuickBooks settlement needs review',$3)
     ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[row.facility_id,`settlement-journal-${row.id}`,`Run ${row.payroll_run_id}: automatic settlement recovery could not complete. Review the QuickBooks connection and recover the saved journal in Payroll runs.`])
   }
  }
  return {skipped:false,checked,failed}
 }finally{
  let destroy=false
  if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtextextended('payroll-settlement-recovery-sweep',0))")}catch{destroy=true}
  db.release(destroy)
 }
}
export function startSettlementRecoveryScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_SETTLEMENT_RECOVERY_ENABLED==='false')return null
 const execute=()=>runSettlementRecoverySweep(pool).catch(error=>console.error('[payroll] settlement recovery sweep failed:',error))
 const first=setTimeout(execute,60000);first.unref?.()
 const timer=setInterval(execute,5*60000);timer.unref?.()
 return timer
}
