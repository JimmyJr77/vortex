import {preparePaymentCloseout} from './paymentCloseout.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export function registerAutomaticCloseoutRoutes(app,pool,{now=()=>new Date()}={}){
 for(const cancel of [false,true])app.post(`/api/admin/payroll/runs/:id/payment-closeout/automatic${cancel?'/cancel':''}`,async(req,res)=>{
  const db=await pool.connect();res.setHeader('Cache-Control','no-store')
  try{
   const facility=req.canonicalAccess.facilityId,body=req.body||{}
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
   const run=(await db.query('SELECT * FROM payroll_run WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!run)throw fail('Payroll run not found.',404)
   if(run.status!=='APPROVED')throw fail('Only approved payroll can schedule or cancel automatic closeout.')
   const {batch,checks}=await preparePaymentCloseout(db,facility,run,body)
   if(body.paymentDate!==batch.plan.paymentDate)throw fail('Use the retained approved payment date.',400)
   if(cancel){
    if(!(await db.query('SELECT 1 FROM payroll_automatic_closeout WHERE batch_id=$1',[batch.id])).rowCount)throw fail('Automatic closeout request not found.',404)
    await db.query('INSERT INTO payroll_automatic_closeout_cancellation(batch_id,created_by) VALUES($1,$2) ON CONFLICT DO NOTHING',[batch.id,req.adminId])
   }else{
    const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].timezone
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
    if(checks.length&&body.paymentDate>today)throw fail('Check delivery cannot be confirmed for a future payment date.',400)
    if((await db.query('SELECT 1 FROM payroll_automatic_closeout_cancellation WHERE batch_id=$1',[batch.id])).rowCount)throw fail('This automatic request was cancelled. Close payroll manually when payments are ready.')
    const retained={batchId:Number(batch.id),fingerprint:batch.fingerprint,paymentDate:batch.plan.paymentDate,reference:body.reference.trim(),checkPayments:checks,confirmed:true}
    const prior=(await db.query('SELECT body=$2::jsonb AS same FROM payroll_automatic_closeout WHERE batch_id=$1',[batch.id,JSON.stringify(retained)])).rows[0]
    if(prior&&!prior.same)throw fail('A different automatic closeout request is retained.')
    if(!prior)await db.query('INSERT INTO payroll_automatic_closeout(batch_id,body,created_by) VALUES($1,$2,$3)',[batch.id,JSON.stringify(retained),req.adminId])
   }
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id) VALUES($1,$2,$3,'payment_batch',$4)",[facility,req.adminId,cancel?'AUTOMATIC_CLOSEOUT_CANCELLED':'AUTOMATIC_CLOSEOUT_REQUESTED',String(batch.id)])
   await db.query('COMMIT');res.json({success:true,data:{status:cancel?'CANCELLED':'SCHEDULED'}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain automatic closeout.'})}finally{db.release()}
 })
}
export async function runAutomaticCloseouts(pool,{finalize,now=()=>new Date(),limit=25}){
 const due=(await pool.query(`SELECT q.*,b.facility_id,b.payroll_run_id FROM payroll_automatic_closeout q
  JOIN payroll_payment_batch b ON b.id=q.batch_id JOIN payroll_run r ON r.id=b.payroll_run_id JOIN payroll_settings s ON s.facility_id=b.facility_id
  LEFT JOIN LATERAL(SELECT created_at FROM payroll_automatic_closeout_check WHERE batch_id=b.id ORDER BY id DESC LIMIT 1)c ON true
  WHERE r.status='APPROVED' AND NOT EXISTS(SELECT 1 FROM payroll_automatic_closeout_cancellation WHERE batch_id=b.id)
  AND NOT EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=b.id)
  AND (b.plan->>'paymentDate')::date<=($1::timestamptz AT TIME ZONE s.timezone)::date
  AND (c.created_at IS NULL OR c.created_at<clock_timestamp()-interval '10 minutes')
  AND payroll_payment_closeout_ready(b.id,q.body->'checkPayments')
  ORDER BY c.created_at NULLS FIRST,b.id LIMIT $2`,[now().toISOString(),limit])).rows
 let finalized=0,failed=0
 for(const row of due){
  await pool.query('INSERT INTO payroll_automatic_closeout_check(batch_id) VALUES($1)',[row.batch_id])
  try{
   await finalize(pool,{facilityId:Number(row.facility_id),actorId:Number(row.created_by),runId:Number(row.payroll_run_id),body:row.body},{closeout:true,now,automaticBatchId:Number(row.batch_id)});finalized++
  }catch{
   if((await pool.query('SELECT 1 FROM payroll_automatic_closeout_cancellation WHERE batch_id=$1',[row.batch_id])).rowCount)continue
   failed++
   await pool.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Automatic payroll closeout needs review',$3)
    ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[row.facility_id,`automatic-closeout-${row.batch_id}`,`Authorization ${row.batch_id} could not close automatically. Review payroll inputs and payment evidence in Payroll runs.`])
  }
 }
 return {finalized,failed}
}
