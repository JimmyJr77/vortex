import {registerW2ReturnRecordAgain} from './w2ReturnRecordAgain.js'
import {registerW2ReturnRetraction} from './w2ReturnRetraction.js'
import {registerW2ReturnCorrection} from './w2ReturnCorrection.js'
import {noticeReturnTarget} from './w2NoticeReturnTarget.js'
import {syncW2NoticePaperAlert} from './w2NoticePaper.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export function registerW2NoticeReturnRoutes(app,pool){
 registerW2ReturnCorrection(app,pool)
 registerW2ReturnRetraction(app,pool)
 registerW2ReturnRecordAgain(app,pool)
 app.post('/api/admin/payroll/employees/:employeeId/w2-approval/:approvalId/notice-return',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId,reference=typeof b.reference==='string'?b.reference.trim():''
   if(![req.params.employeeId,req.params.approvalId].every(id=>/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(Number(id)))||!Number.isSafeInteger(b.attemptId)||b.attemptId<1||b.confirmed!==true||b.expectedRevision!==0||reference.length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference)||typeof b.returnedAt!=='string'||!Number.isFinite(Date.parse(b.returnedAt))||new Date(b.returnedAt).toISOString()!==b.returnedAt)throw fail('Select the notice attempt, actual return time and evidence, then confirm the return.')
   await db.query('BEGIN')
   const publication=(await db.query('SELECT u.id,u.packet_id,u.employee_id FROM payroll_w2_publication u JOIN payroll_w2_packet p ON p.id=u.packet_id WHERE u.facility_id=$1 AND u.employee_id=$2 AND p.approval_id=$3',[facility,req.params.employeeId,req.params.approvalId])).rows[0]
   if(!publication)throw fail('Published W-2 packet not found.',404)
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-consent:${facility}:${publication.employee_id}:2026`])
   const settings=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-furnishing:${publication.packet_id}`])
   const attempt=(await db.query('SELECT a.id,a.created_at,r.outcome FROM payroll_w2_notice_attempt a JOIN payroll_w2_notice_job j ON j.id=a.job_id LEFT JOIN payroll_w2_notice_effective_result r ON r.attempt_id=a.id WHERE j.publication_id=$1 AND a.id=$2',[publication.id,b.attemptId])).rows[0]
   if(!attempt)throw fail('Notice attempt not found.',404)
   const prior=(await db.query('SELECT * FROM payroll_w2_current_return WHERE attempt_id=$1',[attempt.id])).rows[0]
   if(prior){if(prior.is_retracted||prior.correction_id||prior.provider_reinstated)throw fail('This return evidence was corrected or retracted. Reload publication history before further review.',409);if(prior.source_kind==='ADMIN'&&prior.reference===reference&&new Date(prior.returned_at).toISOString()===b.returnedAt){await syncW2NoticePaperAlert(db,facility,publication.packet_id);await db.query('COMMIT');return res.json({success:true,data:{id:Number(prior.id),reused:true}})}throw fail('This attempt already has retained return evidence. Reload publication history.',409)}
   if(![null,'UNCERTAIN','SMTP_ACCEPTED'].includes(attempt.outcome))throw fail('This attempt is not eligible for a returned-notice record. Reload its evidence.',409)
   const databaseNow=(await db.query('SELECT clock_timestamp() AS now')).rows[0].now
   if(Date.parse(b.returnedAt)<new Date(attempt.created_at).getTime()||Date.parse(b.returnedAt)>new Date(databaseNow).getTime())throw fail('Return time must follow the attempt and cannot be in the future.')
   const target=noticeReturnTarget(b.returnedAt,settings.timezone)
   const saved=(await db.query("INSERT INTO payroll_w2_notice_return(attempt_id,source_delivery_id,returned_at,source_snapshot,followup_timezone,followup_due_on,source_kind,created_by,reference) VALUES($1,NULL,$2,$3,$4,$5,'ADMIN',$6,$7) RETURNING id",[attempt.id,b.returnedAt,{source:'ADMIN',reference,actorId:req.adminId},target.timeZone,target.dueOn,req.adminId,reference])).rows[0]
   await syncW2NoticePaperAlert(db,facility,publication.packet_id)
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'W2_NOTICE_RETURN_RECORDED','w2_notice_return',$3,$4)",[facility,req.adminId,String(saved.id),{publicationId:Number(publication.id),attemptId:Number(attempt.id),returnedAt:b.returnedAt,dueOn:target.dueOn}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{id:Number(saved.id),reused:false}})
  }catch(error){await db.query('ROLLBACK').catch(()=>{});res.status(error.code==='23505'?409:error.status||500).json({success:false,message:error.code==='23505'?'Return evidence changed. Reload publication history.':error.status?error.message:'Unable to record the electronic return.'})}finally{db.release()}
 })
}
