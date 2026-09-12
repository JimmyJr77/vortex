import {readNoticeReturnTarget} from './w2NoticeReturnTarget.js'
// Preserve original notice evidence while accepting an explicitly verified,
// current replacement link. Both event revisions must still be current.
export async function readW2PaperFallback(db,facility,publicationId){
 const row=(await db.query(`SELECT f.id,f.event_type,f.occurred_at,u.packet_id,
 r.id AS resolution_id,r.replacement_packet_id,replacement.id AS replacement_event_id,
 replacement.event_type AS replacement_event_type,replacement.occurred_at AS replacement_occurred_at
 FROM payroll_w2_publication u
 JOIN LATERAL(SELECT id,event_type,occurred_at FROM payroll_w2_furnishing_event WHERE packet_id=u.packet_id ORDER BY id DESC LIMIT 1)f ON true
 LEFT JOIN payroll_w2_return_resolution r ON r.packet_id=u.packet_id AND r.facility_id=u.facility_id AND r.employee_id=u.employee_id
 AND r.id=(SELECT max(id) FROM payroll_w2_return_resolution WHERE packet_id=u.packet_id) AND r.return_event_id=f.id
 LEFT JOIN payroll_w2_furnishing_event replacement ON replacement.id=r.replacement_event_id AND replacement.packet_id=r.replacement_packet_id
 AND replacement.id=(SELECT max(id) FROM payroll_w2_furnishing_event WHERE packet_id=r.replacement_packet_id)
 AND replacement.event_type IN ('PAPER_MAILED','HAND_DELIVERED') AND replacement.occurred_at>=f.occurred_at
 WHERE u.facility_id=$1 AND u.id=$2 AND f.occurred_at>=u.published_at`,[facility,publicationId])).rows[0]
 if(!row)return null
 if(row.event_type==='RETURNED_UNDELIVERABLE'&&row.replacement_event_id)return {eventId:Number(row.replacement_event_id),eventType:row.replacement_event_type,occurredAt:row.replacement_occurred_at,status:'PAPER_RECORDED',packetId:Number(row.replacement_packet_id),resolutionId:Number(row.resolution_id),originalReturnEventId:Number(row.id)}
 return {eventId:Number(row.id),eventType:row.event_type,occurredAt:row.occurred_at,status:row.event_type==='RETURNED_UNDELIVERABLE'?'PAPER_RETURNED':'PAPER_RECORDED',packetId:Number(row.packet_id),resolutionId:null}
}
export async function syncW2NoticePaperAlert(db,facility,packetId){
 const publications=(await db.query('SELECT id FROM payroll_w2_publication WHERE facility_id=$1 AND packet_id=$2',[facility,packetId])).rows
 for(const publication of publications){
  const paper=await readW2PaperFallback(db,facility,publication.id)
  const target=await readNoticeReturnTarget(db,facility,publication.id,new Date(),paper)
  const accepted=(await db.query(`SELECT r.id FROM payroll_w2_notice_job j JOIN payroll_w2_notice_attempt a ON a.job_id=j.id JOIN payroll_w2_notice_effective_result r ON r.attempt_id=a.id WHERE j.publication_id=$1 AND r.outcome='SMTP_ACCEPTED' LIMIT 1`,[publication.id])).rows[0]
  if(paper?.status==='PAPER_RECORDED'||accepted)await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now(),dismissed_by=NULL WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`w2-notice-${publication.id}`])
  else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','W-2 availability notice needs attention',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,dismissed_by=NULL,title=EXCLUDED.title,message=EXCLUDED.message",[facility,`w2-notice-${publication.id}`,`Publication ${publication.id}: ${target?`Paper follow-up target ${target.dueOn} (${target.status}). `:''}No accepted electronic notice or current paper furnishing after publication. Review the notice evidence and record the actual follow-up mailing or hand delivery.`])
 }
}
