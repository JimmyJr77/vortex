import {createHash,randomUUID} from 'node:crypto'
import {retirementScheduleTarget,retirementScheduleUuid} from './retirementDispatchScheduleState.js'
import {dispatchRetirementRemittance} from './retirementRemittanceDispatch.js'
import {dispatchRetirementAllocation} from './retirementAllocationDelivery.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const reference=b=>{if(b?.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<20||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm the scheduled action and retain its reviewed reference.',400);return b.reference.trim()}
export function registerRetirementDispatchSchedules(app,pool,{now=()=>new Date()}={}){
 const path='/api/admin/payroll/retirement-dispatch-schedules/:kind/:targetId'
 const endpoint=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');let db;try{db=await pool.connect();await db.query('BEGIN');const facility=req.canonicalAccess.facilityId;await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);const target=await retirementScheduleTarget(db,facility,req.params.kind,req.params.targetId),data=await work(db,req,facility,target);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db?.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain retirement dispatch schedule.'})}finally{db?.release()}}
 app.get(path,endpoint(async(db,req,facility,target)=>({target,history:(await db.query(`SELECT s.id,s.submit_at,s.cutoff,s.reference,s.created_at,c.created_at AS cancelled_at,c.reference AS cancellation_reference,(SELECT jsonb_build_object('status',a.status,'at',a.created_at) FROM payroll_retirement_dispatch_schedule_attempt a WHERE a.schedule_id=s.id ORDER BY a.id DESC LIMIT 1) AS attempt FROM payroll_retirement_dispatch_schedule s LEFT JOIN payroll_retirement_dispatch_schedule_cancellation c ON c.schedule_id=s.id WHERE s.facility_id=$1 AND s.kind=$2 AND s.target_id=$3 ORDER BY s.created_at DESC,s.id DESC`,[facility,req.params.kind,target.id])).rows})))
 app.post(path,endpoint(async(db,req,facility,target)=>{
  const b=req.body||{},ref=reference(b),kind=req.params.kind
  if(!retirementScheduleUuid(b.requestKey)||typeof b.submitAt!=='string'||!Number.isFinite(Date.parse(b.submitAt))||new Date(b.submitAt).toISOString()!==b.submitAt||b.outsideActivityReviewed!==true||kind==='BANK'&&b.bankInstructionsReviewed!==true)throw fail('Review a precise submission time and the outside-activity and delivery instructions.',400)
  const fingerprint=createHash('sha256').update(JSON.stringify({targetId:target.id,kind,submitAt:b.submitAt,reference:ref})).digest('hex')
  const prior=(await db.query('SELECT s.id,s.request_fingerprint,EXISTS(SELECT 1 FROM payroll_retirement_dispatch_schedule_cancellation c WHERE c.schedule_id=s.id) AS cancelled FROM payroll_retirement_dispatch_schedule s WHERE s.facility_id=$1 AND s.request_key=$2',[facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==fingerprint)throw fail('Request key belongs to a different dispatch schedule.');return {id:prior.id,reused:true,cancelled:prior.cancelled}}
  if(target.claimed||target.cancelled)throw fail('This authorization is cancelled or already claimed.')
  if(!Number.isFinite(Date.parse(target.cutoff))||Date.parse(b.submitAt)<+now()+60000||Date.parse(b.submitAt)>Date.parse(target.cutoff)-300000)throw fail('Schedule at least one minute ahead and five minutes before the retained cutoff.',400)
  if(kind==='BANK'&&new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(b.submitAt))>=target.payment_date)throw fail('Schedule the bank instruction before its authorized payment date.',400)
  if((await db.query('SELECT s.id FROM payroll_retirement_dispatch_schedule s WHERE facility_id=$1 AND kind=$2 AND target_id=$3 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_dispatch_schedule_cancellation c WHERE c.schedule_id=s.id)',[facility,kind,target.id])).rows.length)throw fail('Cancel the current schedule before replacing it.')
  const id=randomUUID();await db.query('INSERT INTO payroll_retirement_dispatch_schedule(id,facility_id,kind,target_id,submit_at,cutoff,reference,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,facility,kind,target.id,b.submitAt,target.cutoff,ref,b.requestKey,fingerprint,req.adminId]);await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_DISPATCH_SCHEDULED','retirement_dispatch_schedule',$3,$4)",[facility,req.adminId,id,{kind,targetId:target.id,submitAt:b.submitAt}]);return {id,reused:false,cancelled:false}
 }))
 app.post(`${path}/:scheduleId/cancel`,endpoint(async(db,req,facility,target)=>{
  const ref=reference(req.body);if(!retirementScheduleUuid(req.params.scheduleId))throw fail('Choose the retained schedule.',400)
  const s=(await db.query('SELECT s.id,c.reference AS cancellation FROM payroll_retirement_dispatch_schedule s LEFT JOIN payroll_retirement_dispatch_schedule_cancellation c ON c.schedule_id=s.id WHERE s.id=$1 AND s.facility_id=$2 AND s.kind=$3 AND s.target_id=$4',[req.params.scheduleId,facility,req.params.kind,target.id])).rows[0]
  if(!s)throw fail('Schedule not found.',404);if(s.cancellation){if(s.cancellation!==ref)throw fail('Schedule was cancelled with different evidence.');return {reused:true}}
  if(target.claimed)throw fail('Dispatch is claimed. Recover the existing outcome.')
  await db.query('INSERT INTO payroll_retirement_dispatch_schedule_cancellation(schedule_id,reference,created_by) VALUES($1,$2,$3)',[s.id,ref,req.adminId]);await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=clock_timestamp() WHERE facility_id=$1 AND dedupe_key=$2",[facility,`retirement-schedule-${s.id}`]);await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id) VALUES($1,$2,'RETIREMENT_DISPATCH_SCHEDULE_CANCELLED','retirement_dispatch_schedule',$3)",[facility,req.adminId,s.id]);return {reused:false}
 }))
}
export async function runRetirementScheduledDispatches(pool,{facility=null,bankFetcher,allocationTransfer,now=()=>new Date()}={}){
 const db=await pool.connect();let locked=false
 try{
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended('retirement-scheduled-dispatch',0)) AS locked")).rows[0].locked
  if(!locked)return {skipped:true,claimed:0,blocked:0}
  const rows=(await db.query(`SELECT s.* FROM payroll_retirement_dispatch_schedule s LEFT JOIN LATERAL(SELECT status,created_at FROM payroll_retirement_dispatch_schedule_attempt WHERE schedule_id=s.id ORDER BY id DESC LIMIT 1)a ON true
 WHERE ($1::bigint IS NULL OR s.facility_id=$1) AND s.submit_at<=$2 AND (a.created_at IS NULL OR a.created_at<=$2::timestamptz-interval '1 minute') AND COALESCE(a.status,'')<>'EXPIRED'
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_dispatch_schedule_cancellation c WHERE c.schedule_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_claim c WHERE s.kind='BANK' AND c.authorization_id=s.target_id)
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_claim c WHERE s.kind='FILE' AND c.authorization_id=s.target_id)
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation c WHERE s.kind='BANK' AND c.authorization_id=s.target_id)
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation c WHERE s.kind='FILE' AND c.authorization_id=s.target_id)
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_authorization d JOIN payroll_retirement_remittance_cancellation c ON c.authorization_id=d.remittance_id WHERE s.kind='FILE' AND d.id=s.target_id)
 ORDER BY s.submit_at,s.id LIMIT 10`,[facility,now().toISOString()])).rows
  let claimed=0,blocked=0
  for(const s of rows){
   let status='CLAIMED'
   try{
    const target=await retirementScheduleTarget(db,Number(s.facility_id),s.kind,s.target_id)
    if(target.cancelled||target.claimed)continue
    if(now()>=new Date(s.cutoff))status='EXPIRED'
    else{
     const options={scheduledId:s.id,now,actorId:null},r=s.kind==='BANK'?await dispatchRetirementRemittance(pool,Number(s.facility_id),s.target_id,{...options,fetcher:bankFetcher}):await dispatchRetirementAllocation(pool,Number(s.facility_id),target.remittance_id,s.target_id,{...options,transfer:allocationTransfer,fetcher:bankFetcher})
     if(r.skipped)continue
    }
   }catch{status=now()>=new Date(s.cutoff)?'EXPIRED':'BLOCKED'}
   if(status==='CLAIMED')claimed++;else blocked++
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[s.facility_id])
   const target=await retirementScheduleTarget(db,Number(s.facility_id),s.kind,s.target_id),cancelled=(await db.query('SELECT 1 FROM payroll_retirement_dispatch_schedule_cancellation WHERE schedule_id=$1',[s.id])).rows.length>0
   await db.query('INSERT INTO payroll_retirement_dispatch_schedule_attempt(schedule_id,status,created_at) VALUES($1,$2,$3)',[s.id,status,now().toISOString()])
   if(status!=='CLAIMED'&&!target.claimed&&!target.cancelled&&!cancelled)await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Scheduled retirement dispatch needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[s.facility_id,`retirement-schedule-${s.id}`,status==='EXPIRED'?'The retained cutoff passed. Reconcile timing and outside activity before a replacement.':'Current evidence prevented scheduled dispatch. Review the authorization and delivery setup.'])
   else await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=clock_timestamp() WHERE facility_id=$1 AND dedupe_key=$2",[s.facility_id,`retirement-schedule-${s.id}`])
   await db.query('COMMIT')
  }
  return {skipped:false,claimed,blocked}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtextextended('retirement-scheduled-dispatch',0))")}catch{destroy=true}db.release(destroy)}
}
export function startRetirementDispatchScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_RETIREMENT_SCHEDULED_DISPATCH_ENABLED==='false')return null
 let running=false;const timer=setInterval(async()=>{if(running)return;running=true;try{await runRetirementScheduledDispatches(pool)}catch{console.error('[payroll] Scheduled retirement dispatch requires review.')}finally{running=false}},60000);timer.unref?.();return timer
}
