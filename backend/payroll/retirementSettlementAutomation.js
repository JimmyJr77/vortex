import {postRetirementSettlement} from './retirementSettlementPosting.js'
export async function runRetirementSettlementSweep(pool,{facility=null,fetcher=fetch,paymentFetcher=fetch,now=new Date()}={}){
 const lock=await pool.connect();let locked=false
 try{
  locked=(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('retirement-settlement-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {attempted:0,synced:0,skipped:true}
  const candidates=(await pool.query(`SELECT a.id,p.facility_id FROM payroll_retirement_settlement_authorization a JOIN payroll_retirement_remittance_authorization p ON p.id=a.payment_authorization_id LEFT JOIN LATERAL(SELECT status,created_at FROM payroll_retirement_settlement_attempt WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1)x ON true WHERE ($1::bigint IS NULL OR p.facility_id=$1) AND a.auto_post AND NOT EXISTS(SELECT 1 FROM payroll_retirement_settlement_cancellation c WHERE c.authorization_id=a.id) AND (x.created_at IS NULL OR x.created_at<=$2::timestamptz-CASE WHEN x.status='SYNCED' THEN interval '24 hours' ELSE interval '5 minutes' END) ORDER BY COALESCE(x.created_at,a.created_at),a.id LIMIT 10`,[facility,new Date(now).toISOString()])).rows
  let attempted=0,synced=0
  for(const row of candidates){
   let status,message
   try{const result=await postRetirementSettlement(pool,Number(row.facility_id),row.id,{fetcher,paymentFetcher});status=result.status;message=result.status==='SYNCED'?'All retained settlement journals match QuickBooks.':'Recover or review the retained settlement journal outcomes.';if(status==='SYNCED')synced++}
   catch(e){status='BLOCKED';message=e.status?e.message:'Retirement settlement configuration or evidence needs review.'}
   const db=await pool.connect()
   try{
    await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[row.facility_id])
    await db.query('INSERT INTO payroll_retirement_settlement_attempt(authorization_id,status,message,created_at) VALUES($1,$2,$3,$4)',[row.id,status,message,new Date(now).toISOString()])
    const cancelled=(await db.query('SELECT authorization_id FROM payroll_retirement_settlement_cancellation WHERE authorization_id=$1',[row.id])).rows.length
    const journals=(await db.query("SELECT (SELECT result->>'status' FROM payroll_retirement_settlement_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS status FROM payroll_retirement_settlement_journal j WHERE authorization_id=$1",[row.id])).rows
    const alreadyRecovered=journals.length>0&&journals.every(j=>j.status==='SYNCED')
    if(status==='BLOCKED'&&!cancelled&&!alreadyRecovered)await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Retirement settlement posting is blocked',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[row.facility_id,`retirement-settlement-${row.id}`,message])
    await db.query('COMMIT');attempted++
   }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
  }
  return {attempted,synced}
 }finally{let destroy=false;if(locked)try{await lock.query("SELECT pg_advisory_unlock(hashtextextended('retirement-settlement-sweep',0))")}catch{destroy=true}lock.release(destroy)}
}
export function startRetirementSettlementScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_RETIREMENT_SETTLEMENT_ENABLED==='false')return null
 let running=false;const timer=setInterval(()=>{if(running)return;running=true;void runRetirementSettlementSweep(pool).catch(()=>console.error('[payroll] Retirement settlement posting requires review.')).finally(()=>{running=false})},60000);timer.unref?.();return timer
}
