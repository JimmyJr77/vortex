import {dispatchRetirementReplacementAllocation} from './retirementReplacementAllocation.js'
import {replacementAllocationCandidates} from './retirementReplacementAutomationState.js'
export async function runRetirementReplacementAllocationSweep(pool,{facility=null,fetcher=fetch,paymentFetcher=fetch,reader,transfer,now=new Date(),dispatchNow=()=>new Date()}={}){
 const timestamp=new Date(now).toISOString(),lock=await pool.connect();let locked=false
 try{
  locked=(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('retirement-replacement-allocation-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {attempted:0,verified:0,skipped:true}
  const candidates=(await pool.query(`WITH candidates AS (${replacementAllocationCandidates}) SELECT * FROM candidates WHERE ($1::bigint IS NULL OR facility_id=$1) AND auto_process AND NOT cancelled AND (checked_at IS NULL OR checked_at<=$2::timestamptz-CASE WHEN status='REMOTE_FILE_VERIFIED' THEN interval '24 hours' ELSE interval '5 minutes' END) ORDER BY checked_at NULLS FIRST,id LIMIT 10`,[facility,timestamp])).rows
  let attempted=0,verified=0
  for(const row of candidates){
   let status,message
   try{
    const outcome=await dispatchRetirementReplacementAllocation(pool,Number(row.facility_id),row.id,{fetcher,paymentFetcher,reader,transfer,now:dispatchNow,automaticAt:timestamp})
    if(outcome.skipped)continue
    status=outcome.result.status;message=status==='REMOTE_FILE_VERIFIED'?'Replacement file bytes match the remote file. Participant credit and replacement funding require separate evidence.':'Recover or review the retained replacement file outcome.'
    if(status==='REMOTE_FILE_VERIFIED')verified++
   }catch(e){status='BLOCKED';message=e.status?e.message:'Replacement allocation configuration or evidence requires review.'}
   const db=await pool.connect()
   try{
    await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[row.facility_id])
    await db.query("INSERT INTO payroll_retirement_replacement_attempt(authorization_id,kind,status,message,created_at) VALUES($1,'ALLOCATION',$2,$3,$4)",[row.id,status,message,timestamp])
    const cancelled=(await db.query('SELECT authorization_id FROM payroll_retirement_replacement_cancellation WHERE authorization_id=$1',[row.id])).rowCount
    if(status==='BLOCKED'&&!cancelled)await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Replacement allocation processing is blocked',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,title=EXCLUDED.title,message=EXCLUDED.message",[row.facility_id,`retirement-replacement-file-${row.id}`,message])
    await db.query('COMMIT');attempted++
   }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
  }
  return {attempted,verified}
 }finally{let destroy=false;if(locked)try{await lock.query("SELECT pg_advisory_unlock(hashtextextended('retirement-replacement-allocation-sweep',0))")}catch{destroy=true}lock.release(destroy)}
}
export function startRetirementReplacementAllocationScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_RETIREMENT_REPLACEMENT_ENABLED==='false')return null
 let running=false;const timer=setInterval(()=>{if(running)return;running=true;void runRetirementReplacementAllocationSweep(pool).catch(()=>console.error('[payroll] Replacement allocation automation requires review.')).finally(()=>{running=false})},60000);timer.unref?.();return timer
}
