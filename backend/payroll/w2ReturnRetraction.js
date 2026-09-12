import {syncW2NoticePaperAlert} from './w2NoticePaper.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export function registerW2ReturnRetraction(app,pool){
 app.post('/api/admin/payroll/employees/:employeeId/w2-approval/:approvalId/notice-return-retraction',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId,reference=typeof b.reference==='string'?b.reference.trim():''
   if(![req.params.employeeId,req.params.approvalId].every(id=>/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(Number(id)))||!Number.isSafeInteger(b.returnId)||b.returnId<1||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||b.confirmed!==true||reference.length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw fail('Select retained return evidence and confirm the retraction evidence reference.')
   await db.query('BEGIN')
   const publication=(await db.query('SELECT u.id,u.packet_id,u.employee_id FROM payroll_w2_publication u JOIN payroll_w2_packet p ON p.id=u.packet_id WHERE u.facility_id=$1 AND u.employee_id=$2 AND p.approval_id=$3',[facility,req.params.employeeId,req.params.approvalId])).rows[0]
   if(!publication)throw fail('Published W-2 packet not found.',404)
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-consent:${facility}:${publication.employee_id}:2026`])
   const settings=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-furnishing:${publication.packet_id}`])
   const retained=(await db.query('SELECT r.*,(SELECT COALESCE(max(id),0) FROM payroll_w2_return_cycle WHERE return_id=r.id) AS cycle_revision,original.source_kind AS original_source,a.created_at AS attempted_at FROM payroll_w2_current_return r JOIN payroll_w2_notice_return original ON original.id=r.id JOIN payroll_w2_notice_attempt a ON a.id=r.attempt_id JOIN payroll_w2_notice_job j ON j.id=a.job_id WHERE r.id=$1 AND j.publication_id=$2',[b.returnId,publication.id])).rows[0]
   if(!retained)throw fail('Retained return not found.',404)
   if(retained.is_retracted)throw fail('This manual return was retracted. Review publication history.',409)
   if(Number(retained.correction_id||0)!==b.expectedRevision||Number(retained.cycle_revision)!==(b.expectedCycleRevision??0))throw fail('Return evidence changed. Reload publication history before retracting it.',409)
   if(retained.source_kind!=='ADMIN'||retained.original_source!=='ADMIN'||retained.provider_reinstated)throw fail('Verified mail returns cannot be retracted through manual review.',409)
   if((await db.query('SELECT 1 FROM payroll_w2_provider_event WHERE attempt_id=$1',[retained.attempt_id])).rowCount)throw fail('A verified provider return requires follow-up.',409)
   if((await db.query("SELECT to_regclass('email_delivery') AS relation")).rows[0].relation){
    const deliveries=(await db.query("SELECT d.status FROM email_delivery d JOIN payroll_w2_notice_attempt a ON d.idempotency_key='w2-notice-'||a.dispatch_key::text WHERE a.id=$1 AND d.facility_id=$2 FOR UPDATE OF d",[retained.attempt_id,facility])).rows
    if(deliveries.some(d=>d.status==='bounced'))throw fail('The mail log reports this notice returned. Reconcile its evidence before review.',409)
   }
   let cycle=null
   if(Number(retained.cycle_revision)>0)cycle=(await db.query("INSERT INTO payroll_w2_return_cycle(return_id,prior_id,correction_id,action,reference,created_by) VALUES($1,$2,$3,'RETRACTED',$4,$5) RETURNING id",[retained.id,retained.cycle_revision,retained.correction_id,reference,req.adminId])).rows[0]
   else await db.query('INSERT INTO payroll_w2_return_retraction(return_id,correction_id,followup_timezone,reference,created_by) VALUES($1,$2,$3,$4,$5)',[retained.id,retained.correction_id,retained.followup_timezone||settings.timezone,reference,req.adminId])
   await syncW2NoticePaperAlert(db,facility,publication.packet_id)
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'W2_NOTICE_RETURN_RETRACTED',$3,$4,$5)",[facility,req.adminId,cycle?'w2_return_cycle':'w2_return_retraction',String(cycle?.id||retained.id),{returnId:b.returnId,publicationId:Number(publication.id),correctionId:retained.correction_id}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{returnId:Number(retained.id),cycleRevision:Number(cycle?.id||0)}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.code==='23505'?409:e.status||500).json({success:false,message:e.code==='23505'?'Return evidence changed. Reload publication history.':e.status?e.message:'Unable to retract manual return evidence.'})}finally{db.release()}
 })
}
