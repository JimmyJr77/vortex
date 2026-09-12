import {carrierDeliveryState} from './carrierRemittanceDeliveryState.js'
import {sendEmail,isEmailConfigured} from '../email/sendEmail.js'
import {processCarrierRemittance} from './carrierRemittanceDispatch.js'
export const carrierRemittanceSender=()=>process.env.PAYROLL_CARRIER_REMITTANCE_ENABLED==='false'||!isEmailConfigured()?undefined:sendEmail
export async function runCarrierRemittanceSweep(pool,{facility=null,now=new Date(),sender=carrierRemittanceSender()}={}){
 const lock=await pool.connect();let locked=false
 try{
  locked=(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('carrier-remittance-sweep:'||current_schema(),0)) AS locked")).rows[0].locked
  if(!locked)return {checked:0,skipped:true}
  const rows=(await pool.query(`SELECT n.id,n.facility_id,i.invoice->>'carrier' AS carrier,i.invoice->>'invoiceNumber' AS invoice_number,i.coverage_month FROM payroll_carrier_remittance_notice n JOIN payroll_carrier_payment_authorization a ON a.id=n.payment_id JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id LEFT JOIN LATERAL(SELECT checked_at,status,provider_event_count FROM payroll_carrier_remittance_check WHERE notice_id=n.id ORDER BY checked_at DESC,id DESC LIMIT 1) last_check ON true WHERE ($1::bigint IS NULL OR n.facility_id=$1) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_cancellation c WHERE c.notice_id=n.id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_return_review r WHERE r.notice_id=n.id) AND ((SELECT count(*) FROM payroll_carrier_remittance_provider_event e WHERE e.notice_id=n.id)>COALESCE(last_check.provider_event_count,0) OR COALESCE(last_check.checked_at,'epoch'::timestamptz)<=$2::timestamptz-CASE WHEN last_check.status='SMTP_ACCEPTED' THEN interval '24 hours' ELSE interval '5 minutes' END) ORDER BY last_check.checked_at ASC NULLS FIRST,n.created_at,n.id LIMIT 10`,[facility,now])).rows
  for(const row of rows){let result
   try{result=await processCarrierRemittance(pool,row.facility_id,row.id,{sender,now})}catch{result={status:'CHECK_FAILED',message:'Remittance processing could not read or retain its evidence. Recovery will retry without assuming the notice was sent.'}}
   const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[row.facility_id]);const current=await carrierDeliveryState(db,row.id,{now});if(['UNSENT_RELEASED','RELEASE_NEEDS_REVIEW'].includes(current.status))result={status:current.status,message:current.releaseIssue};if(current.status==='REPLACEMENT_REVIEWED')result={status:'REPLACEMENT_REVIEWED'};if(current.status==='RETURNED')result={status:'RETURNED',message:'Signed provider return evidence is retained. Review the carrier contact and delivery history before any further notice.'};await db.query('INSERT INTO payroll_carrier_remittance_check(notice_id,status,message,checked_at,provider_event_count) VALUES($1,$2,$3,$4,$5)',[row.id,result.status,result.message||null,now,current.returns.length])
    const key=`carrier-remittance-${row.id}`
    if(['SMTP_ACCEPTED','CANCELLED','REPLACEMENT_REVIEWED','UNSENT_RELEASED'].includes(result.status))await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now(),dismissed_by=NULL WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[row.facility_id,key])
    else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Carrier remittance delivery needs attention',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,dismissed_by=NULL,title=EXCLUDED.title,message=EXCLUDED.message",[row.facility_id,key,`Carrier ${row.carrier} · Invoice ${row.invoice_number} · Coverage ${row.coverage_month}: ${result.status}. ${result.message||'Review retained delivery history. SMTP acceptance is not carrier acknowledgment. Uncertain attempts are not automatically resent.'}`])
    await db.query('COMMIT')
   }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
  }
  return {checked:rows.length}
 }finally{let destroy=false;if(locked)try{await lock.query("SELECT pg_advisory_unlock(hashtextextended('carrier-remittance-sweep:'||current_schema(),0))")}catch{destroy=true}lock.release(destroy)}
}
export function startCarrierRemittanceScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_CARRIER_REMITTANCE_ENABLED==='false')return null
 let running=false;const timer=setInterval(()=>{if(running)return;running=true;void runCarrierRemittanceSweep(pool).catch(()=>console.error('[payroll] Carrier remittance processing requires recovery.')).finally(()=>{running=false})},60000);timer.unref?.();return timer
}
