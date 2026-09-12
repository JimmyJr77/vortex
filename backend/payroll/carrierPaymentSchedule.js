import {randomUUID} from 'node:crypto'
import {dispatchCarrierPayment} from './carrierPaymentDispatch.js'
import {previousBankBusinessDay} from './bankCalendar.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const reference=b=>{if(b?.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm the schedule decision and provide its reference.',400);return b.reference.trim()}
export function registerCarrierPaymentSchedules(app,pool,{now=()=>new Date()}={}){
 for(const cancel of [false,true])app.post(`/api/admin/payroll/carrier-payment-authorizations/:id/schedule${cancel?'/cancel':''}`,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},ref=reference(b),facility=req.canonicalAccess.facilityId
   if(!uuid(req.params.id))throw fail('Choose a retained payment authorization.',400)
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const a=(await db.query('SELECT a.*,s.timezone FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id JOIN payroll_settings s ON s.facility_id=i.facility_id WHERE a.id=$1 AND i.facility_id=$2',[req.params.id,facility])).rows[0]
   if(!a)throw fail('Carrier payment authorization was not found.',404)
   if(cancel){
    if(!uuid(b.scheduleId))throw fail('Choose a retained schedule.',400)
    const schedule=(await db.query('SELECT s.id,c.reference AS cancellation FROM payroll_carrier_payment_schedule s LEFT JOIN payroll_carrier_payment_schedule_cancellation c ON c.schedule_id=s.id WHERE s.id=$1 AND s.authorization_id=$2',[b.scheduleId,a.id])).rows[0]
    if(!schedule)throw fail('Carrier schedule was not found.',404)
    if(schedule.cancellation){if(schedule.cancellation!==ref)throw fail('This schedule was already cancelled with a different reference.');await db.query('COMMIT');return res.json({success:true,data:{id:schedule.id,reused:true}})}
    if((await db.query('SELECT authorization_id FROM payroll_carrier_payment_claim WHERE authorization_id=$1',[a.id])).rows.length)throw fail('Dispatch is claimed. Recover the provider outcome.')
    await db.query('INSERT INTO payroll_carrier_payment_schedule_cancellation(schedule_id,reference,created_by) VALUES($1,$2,$3)',[schedule.id,ref,req.adminId])
    await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2",[facility,`carrier-schedule-${schedule.id}`])
    await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id) VALUES($1,$2,'CARRIER_PAYMENT_SCHEDULE_CANCELLED','carrier_payment_schedule',$3)",[facility,req.adminId,schedule.id]);await db.query('COMMIT');return res.json({success:true,data:{id:schedule.id,reused:false}})
   }
   if(typeof b.submitAt!=='string'||!Number.isFinite(new Date(b.submitAt).getTime())||new Date(b.submitAt).toISOString()!==b.submitAt||typeof b.requestKey!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(b.requestKey))throw fail('Choose a valid submission time and request.',400)
   const retry=(await db.query('SELECT s.*,c.schedule_id AS cancelled FROM payroll_carrier_payment_schedule s LEFT JOIN payroll_carrier_payment_schedule_cancellation c ON c.schedule_id=s.id WHERE s.authorization_id=$1 AND s.request_key=$2',[a.id,b.requestKey])).rows[0]
   if(retry){if(retry.cancelled||new Date(retry.submit_at).toISOString()!==b.submitAt||retry.reference!==ref)throw fail('Schedule request was cancelled or has different terms.');await db.query('COMMIT');return res.json({success:true,data:{id:retry.id,reused:true}})}
   const when=new Date(b.submitAt),day=new Intl.DateTimeFormat('en-CA',{timeZone:a.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(when)
   if(when<=now()||day>=a.preview.paymentDate||previousBankBusinessDay(day)!==day)throw fail('Choose a future bank business day before the authorized payment date.',400)
   if((await db.query('SELECT authorization_id FROM payroll_carrier_payment_claim WHERE authorization_id=$1 UNION ALL SELECT authorization_id FROM payroll_carrier_payment_cancellation WHERE authorization_id=$1',[a.id])).rows.length)throw fail('This authorization is cancelled or already claimed.')
   if((await db.query('SELECT s.id FROM payroll_carrier_payment_schedule s WHERE authorization_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_schedule_cancellation c WHERE c.schedule_id=s.id)',[a.id])).rows.length)throw fail('Cancel the current schedule before replacing it.')
   const id=randomUUID();await db.query('INSERT INTO payroll_carrier_payment_schedule(id,authorization_id,submit_at,reference,request_key,created_by) VALUES($1,$2,$3,$4,$5,$6)',[id,a.id,b.submitAt,ref,b.requestKey,req.adminId])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_PAYMENT_SCHEDULED','carrier_payment_schedule',$3,$4)",[facility,req.adminId,id,{authorizationId:a.id,submitAt:b.submitAt}]);await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain carrier payment schedule.'})}finally{db.release()}
 })
}
export async function runCarrierPaymentSubmissionSweep(pool,{prepare,fetcher=fetch,facility=null,now=new Date()}={}){
 const db=await pool.connect();let locked=false
 try{
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended('carrier-payment-submission-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {skipped:true,attempted:0,blocked:0}
  const timestamp=new Date(now).toISOString(),rows=(await db.query(`SELECT s.id,s.authorization_id,i.facility_id FROM payroll_carrier_payment_schedule s JOIN payroll_carrier_payment_authorization a ON a.id=s.authorization_id JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id LEFT JOIN LATERAL(SELECT created_at FROM payroll_carrier_payment_schedule_attempt WHERE schedule_id=s.id ORDER BY id DESC LIMIT 1)x ON true WHERE ($1::bigint IS NULL OR i.facility_id=$1) AND s.submit_at<=$2 AND (x.created_at IS NULL OR x.created_at<=$2::timestamptz-interval '5 minutes') AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_schedule_cancellation c WHERE c.schedule_id=s.id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation c WHERE c.authorization_id=a.id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_claim c WHERE c.authorization_id=a.id) ORDER BY s.submit_at,s.id LIMIT 10`,[facility,timestamp])).rows
  let attempted=0,blocked=0
  for(const row of rows){
   let status='CLAIMED',message='Dispatch claim retained; inspect payment history for the provider outcome.'
   try{const result=await dispatchCarrierPayment(pool,Number(row.facility_id),row.authorization_id,{prepare,fetcher,scheduledRequestId:row.id,now:()=>new Date(timestamp)});if(result.skipped)continue;attempted++}catch(e){status='BLOCKED';message=e.status?e.message:'Scheduled carrier submission requires review.';blocked++}
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[row.facility_id])
   const active=(await db.query('SELECT s.id FROM payroll_carrier_payment_schedule s WHERE s.id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_schedule_cancellation c WHERE c.schedule_id=s.id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation c WHERE c.authorization_id=s.authorization_id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_claim c WHERE c.authorization_id=s.authorization_id)',[row.id])).rows.length>0
   await db.query('INSERT INTO payroll_carrier_payment_schedule_attempt(schedule_id,status,message,created_at) VALUES($1,$2,$3,$4)',[row.id,status,message,timestamp])
   if(status==='BLOCKED'&&active)await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Scheduled carrier payment blocked',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[row.facility_id,`carrier-schedule-${row.id}`,message])
   else await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2",[row.facility_id,`carrier-schedule-${row.id}`])
   await db.query('COMMIT')
  }
  return {skipped:false,attempted,blocked}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtextextended('carrier-payment-submission-sweep',0))")}catch{destroy=true}db.release(destroy)}
}
export function startCarrierPaymentSubmissionScheduler(pool,dependencies){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_CARRIER_PAYMENT_SUBMISSION_ENABLED==='false')return null
 let running=false
 const sweep=async()=>{if(running)return;running=true;try{await runCarrierPaymentSubmissionSweep(pool,dependencies)}catch{console.error('[payroll] Scheduled carrier submission requires review.')}finally{running=false}}
 const timer=setInterval(()=>void sweep(),60000);timer.unref?.();return timer
}
