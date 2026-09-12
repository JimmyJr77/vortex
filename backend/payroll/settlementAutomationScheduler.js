import {settlementAutomationState} from './settlementAutomation.js'
import {postSettlementJournal,settlementPostingPlan} from './settlementPosting.js'
export async function runSettlementAutomationSweep(pool,{fetcher=fetch,limit=25,now=()=>new Date()}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Choose a settlement automation limit from 1 to 100.')
 const checkedAt=now();if(!(checkedAt instanceof Date)||!Number.isFinite(checkedAt.getTime()))throw new Error('Invalid settlement automation time.')
 const db=await pool.connect();let locked=false
 try{
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended('payroll-settlement-automation-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {skipped:true,checked:0,posted:0,failed:0}
  const due=(await db.query(`SELECT a.* FROM payroll_settlement_automation a LEFT JOIN LATERAL(SELECT created_at FROM payroll_settlement_automation_check WHERE automation_id=a.id ORDER BY id DESC LIMIT 1)c ON true WHERE a.enabled AND a.id=(SELECT max(id) FROM payroll_settlement_automation WHERE facility_id=a.facility_id AND payroll_run_id=a.payroll_run_id) AND (c.created_at IS NULL OR c.created_at<$2::timestamptz-interval '10 minutes') ORDER BY c.created_at NULLS FIRST,a.id LIMIT $1`,[limit,checkedAt])).rows
  let checked=0,posted=0,failed=0
  for(const row of due){
   const attempt=(await db.query('INSERT INTO payroll_settlement_automation_check(automation_id,created_at) VALUES($1,$2) RETURNING id',[row.id,checkedAt])).rows[0]
   try{
    for(let index=0;index<10;index++){
     const state=await settlementAutomationState(db,Number(row.facility_id),Number(row.payroll_run_id))
     if(state.status!=='ENABLED'||state.revision!==Number(row.id))throw new Error('Automation changed or needs review.')
     const plan=await settlementPostingPlan(db,Number(row.facility_id),Number(row.payroll_run_id)),item=plan.items.find(i=>i.canPost)
     if(!item)break
     const result=await postSettlementJournal(pool,Number(row.facility_id),Number(row.payroll_run_id),{action:'SUBMIT',eventKey:item.key,fingerprint:plan.fingerprint,reference:row.reference,confirmed:true,noOtherPostingConfirmed:true},{fetcher,automationId:Number(row.id),automationCheckId:Number(attempt.id)})
     if(!result.recovery)posted++
    }
    await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[row.facility_id,`settlement-automation-${row.payroll_run_id}`])
    await db.query("INSERT INTO payroll_settlement_automation_result(check_id,status) VALUES($1,'COMPLETED')",[attempt.id])
    checked++
   }catch{failed++;await db.query("INSERT INTO payroll_settlement_automation_result(check_id,status) VALUES($1,'FAILED') ON CONFLICT(check_id) DO NOTHING",[attempt.id]);await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Automatic settlement posting needs review','Review the retained payroll authorization, bank evidence and QuickBooks account mapping. Recover saved journals before further posting.') ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[row.facility_id,`settlement-automation-${row.payroll_run_id}`])}
  }
  return {skipped:false,checked,posted,failed}
 }finally{let destroy=false;if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtextextended('payroll-settlement-automation-sweep',0))")}catch{destroy=true}db.release(destroy)}
}
export function startSettlementAutomationScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_SETTLEMENT_AUTOMATION_ENABLED==='false')return null
 const execute=()=>runSettlementAutomationSweep(pool).catch(error=>console.error('[payroll] settlement automation failed:',error))
 const first=setTimeout(execute,60000);first.unref?.();const timer=setInterval(execute,5*60000);timer.unref?.();return timer
}
