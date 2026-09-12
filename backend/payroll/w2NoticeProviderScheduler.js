import {refreshW2NoticeDispatch} from './w2NoticeDispatch.js'
export async function runW2ProviderEventSweep(pool,{now=()=>new Date(),limit=25}={}){
 const at=now();if(!(at instanceof Date)||!Number.isFinite(at.getTime())||!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid W-2 provider sweep options.')
 const db=await pool.connect();let locked=false
 try{
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended('payroll-w2-provider-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {skipped:true,checked:0,failed:0}
  const due=(await db.query(`SELECT DISTINCT e.publication_id,e.facility_id,c.created_at FROM payroll_w2_provider_event e LEFT JOIN payroll_w2_provider_processed p ON p.event_id=e.event_id LEFT JOIN LATERAL(SELECT created_at FROM payroll_w2_provider_check WHERE publication_id=e.publication_id ORDER BY id DESC LIMIT 1)c ON true WHERE p.event_id IS NULL AND (c.created_at IS NULL OR c.created_at<$1::timestamptz-interval '10 minutes') ORDER BY c.created_at NULLS FIRST,e.publication_id LIMIT $2`,[at,limit])).rows
  let checked=0,failed=0
  for(const row of due){
   await db.query('INSERT INTO payroll_w2_provider_check(publication_id,created_at) VALUES($1,$2)',[row.publication_id,at])
   try{
    await refreshW2NoticeDispatch(pool,Number(row.facility_id),{publicationId:Number(row.publication_id)})
    const pending=(await db.query('SELECT e.event_id,e.delivery_id,e.returned_at AS provider_returned_at,r.id AS return_id,r.source_kind,r.source_delivery_id,r.returned_at FROM payroll_w2_provider_event e LEFT JOIN payroll_w2_current_return r ON r.attempt_id=e.attempt_id LEFT JOIN payroll_w2_provider_processed p ON p.event_id=e.event_id WHERE e.publication_id=$1 AND e.facility_id=$2 AND p.event_id IS NULL',[row.publication_id,row.facility_id])).rows
    if(pending.some(e=>!e.return_id||e.source_kind!=='MAIL_LOG'||Number(e.source_delivery_id)!==Number(e.delivery_id)||new Date(e.returned_at)>new Date(e.provider_returned_at)))throw new Error('Return evidence is not reconciled.')
    for(const event of pending)await db.query('INSERT INTO payroll_w2_provider_processed(event_id) VALUES($1) ON CONFLICT DO NOTHING',[event.event_id])
    await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[row.facility_id,`w2-provider-${row.publication_id}`]);checked++
   }catch{failed++;await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','W-2 provider return needs reconciliation','A verified provider event is retained. Review the notice and paper follow-up evidence.') ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[row.facility_id,`w2-provider-${row.publication_id}`])}
  }
  return {skipped:false,checked,failed}
 }finally{let destroy=false;if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtextextended('payroll-w2-provider-sweep',0))")}catch{destroy=true}db.release(destroy)}
}
export function startW2ProviderEventScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_W2_PROVIDER_INTAKE_ENABLED==='false')return null
 const execute=()=>runW2ProviderEventSweep(pool).catch(e=>console.error('[payroll] W-2 provider reconciliation failed:',e))
 const first=setTimeout(execute,60000);first.unref?.();const timer=setInterval(execute,5*60000);timer.unref?.();return timer
}
