const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export function registerPaymentSubmissionScheduleRoutes(app,pool,{now=()=>new Date()}={}){
 for(const cancel of [false,true])app.post(`/api/admin/payroll/runs/:id/payment-authorization/:batchId/instructions/:instructionId/schedule${cancel?'/cancel':''}`,async(req,res)=>{
  const db=await pool.connect();res.setHeader('Cache-Control','no-store')
  try{
   const facility=req.canonicalAccess.facilityId,body=req.body||{}
   if(body.confirmed!==true)throw fail('Confirm the scheduled payment decision.',400)
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
   const batch=(await db.query(`SELECT b.*,s.timezone FROM payroll_payment_batch b JOIN payroll_run r ON r.id=b.payroll_run_id JOIN payroll_settings s ON s.facility_id=b.facility_id
    JOIN payroll_payment_batch_instruction i ON i.batch_id=b.id WHERE b.facility_id=$1 AND b.payroll_run_id=$2 AND b.id=$3 AND i.instruction_id::text=$4 AND r.status='APPROVED'
    AND NOT EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=b.id) FOR UPDATE OF r`,[facility,req.params.id,req.params.batchId,req.params.instructionId])).rows[0]
   if(!batch)throw fail('Active payment instruction not found.',404)
   if(batch.fingerprint!==body.fingerprint)throw fail('Refresh the retained payment plan before scheduling.')
   if((await db.query('SELECT 1 FROM payroll_payment_dispatch_attempt WHERE instruction_id=$1',[req.params.instructionId])).rowCount)throw fail('Dispatch already started. Use provider recovery.')
   const prior=(await db.query('SELECT * FROM payroll_payment_submission_schedule WHERE instruction_id=$1',[req.params.instructionId])).rows[0]
   if(cancel){
    if(!prior)throw fail('Payment schedule not found.',404)
    await db.query('INSERT INTO payroll_payment_submission_cancellation(schedule_id,created_by) VALUES($1,$2) ON CONFLICT DO NOTHING',[prior.id,req.adminId])
   }else{
    const when=new Date(body.submitAt)
    if(typeof body.submitAt!=='string'||!Number.isFinite(when.getTime())||when.toISOString()!==body.submitAt||when<=now())throw fail('Choose a future submission time.',400)
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:batch.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(when)
    if(day>batch.plan.paymentDate)throw fail('Submission must occur no later than the approved payment date.',400)
    if(typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.length>500||/[\u0000-\u001f\u007f]/.test(body.reference))throw fail('Retain a payment scheduling reference.',400)
    if(prior){
     if((await db.query('SELECT 1 FROM payroll_payment_submission_cancellation WHERE schedule_id=$1',[prior.id])).rowCount||new Date(prior.submit_at).toISOString()!==body.submitAt||prior.reference!==body.reference.trim())throw fail('A different or cancelled schedule is retained. Review it before submitting manually.')
    }else await db.query('INSERT INTO payroll_payment_submission_schedule(batch_id,instruction_id,submit_at,reference,created_by) VALUES($1,$2,$3,$4,$5)',[batch.id,req.params.instructionId,body.submitAt,body.reference.trim(),req.adminId])
   }
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id) VALUES($1,$2,$3,'payment_instruction',$4)",[facility,req.adminId,cancel?'PAYMENT_SCHEDULE_CANCELLED':'PAYMENT_SCHEDULED',req.params.instructionId])
   await db.query('COMMIT');res.json({success:true,data:{status:cancel?'CANCELLED':'SCHEDULED'}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain payment schedule.'})}finally{db.release()}
 })
}
export async function runPaymentSubmissionSweep(pool,{dispatch,fetcher,loadRunPreview,payrollFingerprint,now=()=>new Date(),limit=25}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Choose a submission limit from 1 to 100.')
 const db=await pool.connect();let locked=false
 try{
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended('payroll-payment-submission-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {skipped:true,attempted:0,failed:0}
  const due=(await db.query(`SELECT q.*,b.facility_id,b.payroll_run_id,b.fingerprint FROM payroll_payment_submission_schedule q JOIN payroll_payment_batch b ON b.id=q.batch_id JOIN payroll_run r ON r.id=b.payroll_run_id
   LEFT JOIN LATERAL(SELECT created_at FROM payroll_payment_submission_check WHERE schedule_id=q.id ORDER BY id DESC LIMIT 1)c ON true
   WHERE q.submit_at<=$1 AND r.status='APPROVED' AND NOT EXISTS(SELECT 1 FROM payroll_payment_submission_cancellation WHERE schedule_id=q.id)
   AND NOT EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=b.id)
   AND NOT EXISTS(SELECT 1 FROM payroll_payment_dispatch_attempt WHERE instruction_id=q.instruction_id)
   AND (c.created_at IS NULL OR c.created_at<clock_timestamp()-interval '10 minutes') ORDER BY c.created_at NULLS FIRST,q.submit_at,q.id LIMIT $2`,[now(),limit])).rows
  let attempted=0,failed=0
  for(const row of due){
   await db.query('INSERT INTO payroll_payment_submission_check(schedule_id) VALUES($1)',[row.id])
   try{
    await dispatch(pool,Number(row.facility_id),Number(row.batch_id),row.instruction_id,{fetcher,loadRunPreview,payrollFingerprint,actorId:Number(row.created_by),expectedRunId:Number(row.payroll_run_id),expectedFingerprint:row.fingerprint,scheduledRequestId:Number(row.id),now});attempted++
   }catch{
    if((await db.query('SELECT 1 FROM payroll_payment_submission_cancellation WHERE schedule_id=$1',[row.id])).rowCount)continue
    failed++
    await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Scheduled payroll payment needs review',$3)
     ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[row.facility_id,`payment-schedule-${row.id}`,`Authorization ${row.batch_id} could not submit its scheduled instruction. Review current payroll and employee payment authorization.`])
   }
  }
  return {skipped:false,attempted,failed}
 }finally{let destroy=false;if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtextextended('payroll-payment-submission-sweep',0))")}catch{destroy=true}db.release(destroy)}
}
export function startPaymentSubmissionScheduler(pool,dependencies){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_PAYMENT_SUBMISSION_ENABLED==='false')return null
 const execute=()=>runPaymentSubmissionSweep(pool,{fetcher:fetch,...dependencies}).catch(error=>console.error('[payroll] payment submission sweep failed:',error))
 const first=setTimeout(execute,60000);first.unref?.()
 const timer=setInterval(execute,60000);timer.unref?.()
 return timer
}
