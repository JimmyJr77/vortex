import {syncW2NoticePaperAlert} from './w2NoticePaper.js'
// Caller holds the packet furnishing lock; alerts follow evidence, not manual dismissal.
export async function syncW2FurnishingAlert(db,facility,packetId){
 const row=(await db.query(`SELECT p.id,p.employee_id,p.approval_id,p.payment_year,e.employee_number,
 (SELECT f.event_type FROM payroll_w2_furnishing_event f WHERE f.packet_id=p.id ORDER BY f.id DESC LIMIT 1) AS event_type
 FROM payroll_w2_packet p JOIN payroll_employee e ON e.id=p.employee_id AND e.facility_id=p.facility_id WHERE p.facility_id=$1 AND p.id=$2`,[facility,packetId])).rows[0]
 if(!row)return
 const key=`w2-undeliverable-${packetId}`
 const resolved=(await db.query(`SELECT r.id FROM payroll_w2_return_resolution r WHERE r.packet_id=$1 AND r.id=(SELECT max(id) FROM payroll_w2_return_resolution WHERE packet_id=$1) AND r.return_event_id=(SELECT max(id) FROM payroll_w2_furnishing_event WHERE packet_id=r.packet_id) AND r.replacement_event_id=(SELECT max(id) FROM payroll_w2_furnishing_event WHERE packet_id=r.replacement_packet_id)`,[packetId])).rows[0]
 if(row.event_type==='RETURNED_UNDELIVERABLE'&&!resolved)await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','W-2 delivery needs follow-up',$3)
 ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,dismissed_by=NULL,message=EXCLUDED.message`,[facility,key,`Employee ${row.employee_number}: the ${row.payment_year} W-2 packet ${row.id} (approval ${row.approval_id}) was returned undeliverable. Open Reports & QuickBooks, prepare annual inputs, and inspect this approval's furnishing history. Verify the recipient securely and record the actual follow-up mailing or hand delivery, or link a newer packet’s furnishing evidence. Review any stale approval before using its copies.`])
 else await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now(),dismissed_by=NULL WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key])
 await syncW2NoticePaperAlert(db,facility,packetId)
}
export async function refreshW2FurnishingAlerts(pool,facility){
 const packets=(await pool.query('SELECT id FROM payroll_w2_packet WHERE facility_id=$1 ORDER BY id',[facility])).rows
 for(const packet of packets){const db=await pool.connect();try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-furnishing:${packet.id}`]);await syncW2FurnishingAlert(db,facility,packet.id);await db.query('COMMIT')
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}}
}
