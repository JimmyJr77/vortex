import {noticeReturnTarget} from './w2NoticeReturnTarget.js'
import {syncW2NoticePaperAlert} from './w2NoticePaper.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export function registerW2ReturnCorrection(app,pool){
 app.post('/api/admin/payroll/employees/:employeeId/w2-approval/:approvalId/notice-return-correction',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId,reference=typeof b.reference==='string'?b.reference.trim():''
   if(![req.params.employeeId,req.params.approvalId].every(id=>/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(Number(id)))||!Number.isSafeInteger(b.returnId)||b.returnId<1||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||b.confirmed!==true||reference.length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw fail('Select retained return evidence and confirm the correction reference.')
   await db.query('BEGIN')
   const publication=(await db.query('SELECT u.id,u.packet_id,u.employee_id FROM payroll_w2_publication u JOIN payroll_w2_packet p ON p.id=u.packet_id WHERE u.facility_id=$1 AND u.employee_id=$2 AND p.approval_id=$3',[facility,req.params.employeeId,req.params.approvalId])).rows[0]
   if(!publication)throw fail('Published W-2 packet not found.',404)
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-consent:${facility}:${publication.employee_id}:2026`])
   const settings=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-furnishing:${publication.packet_id}`])
   const retained=(await db.query('SELECT r.*,(SELECT COALESCE(max(id),0) FROM payroll_w2_return_cycle WHERE return_id=r.id) AS cycle_revision,a.created_at AS attempted_at FROM payroll_w2_current_return r JOIN payroll_w2_notice_attempt a ON a.id=r.attempt_id JOIN payroll_w2_notice_job j ON j.id=a.job_id WHERE r.id=$1 AND j.publication_id=$2',[b.returnId,publication.id])).rows[0]
   if(!retained)throw fail('Retained return not found.',404)
   if(retained.is_retracted)throw fail('This manual return was retracted. Review publication history.',409)
   if(Number(retained.correction_id||0)!==b.expectedRevision||Number(retained.cycle_revision)!==(b.expectedCycleRevision??0))throw fail('Return evidence changed. Reload publication history before correcting it.',409)
   const event=(await db.query('SELECT event_id,returned_at::text FROM payroll_w2_provider_event WHERE attempt_id=$1 ORDER BY returned_at,event_id LIMIT 1',[retained.attempt_id])).rows[0]
   let returnedAt
   if(event){if(b.providerEventId!==event.event_id)throw fail('Review the earliest retained provider return before correcting this evidence.',409);returnedAt=event.returned_at}
   else{
    if(b.providerEventId||typeof b.returnedAt!=='string'||!Number.isFinite(Date.parse(b.returnedAt))||new Date(b.returnedAt).toISOString()!==b.returnedAt)throw fail('Enter the actual corrected return time.')
    returnedAt=b.returnedAt
   }
   const at=(await db.query('SELECT clock_timestamp() AS now')).rows[0].now
   if(Date.parse(returnedAt)<new Date(retained.attempted_at).getTime()||Date.parse(returnedAt)>new Date(at).getTime())throw fail('Corrected return time must follow the notice attempt and cannot be in the future.')
   const target=noticeReturnTarget(returnedAt,retained.followup_timezone||settings.timezone)
   const saved=(await db.query('INSERT INTO payroll_w2_return_correction(return_id,prior_id,provider_event_id,returned_at,followup_timezone,followup_due_on,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[retained.id,retained.correction_id,event?.event_id||null,returnedAt,target.timeZone,target.dueOn,reference,req.adminId])).rows[0]
   await syncW2NoticePaperAlert(db,facility,publication.packet_id)
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'W2_NOTICE_RETURN_CORRECTED','w2_return_correction',$3,$4)",[facility,req.adminId,String(saved.id),{returnId:b.returnId,publicationId:Number(publication.id),returnedAt,dueOn:target.dueOn}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{id:Number(saved.id)}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.code==='23505'?409:e.status||500).json({success:false,message:e.code==='23505'?'Return evidence changed. Reload publication history.':e.status?e.message:'Unable to correct return evidence.'})}finally{db.release()}
 })
}
