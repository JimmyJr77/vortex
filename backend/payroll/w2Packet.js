import {createHash} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {renderW2EmployeePacket} from './w2Pdf.js'
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
// Caller owns the transaction. One immutable artifact is retained per approval.
export async function retainedW2Packet(db,row,actor){
 const context=`payroll-w2-packet:${row.facility_id}:${row.employee_id}:${row.id}:${row.payment_year}`
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[context])
 const existing=(await db.query('SELECT * FROM payroll_w2_packet WHERE approval_id=$1 AND facility_id=$2 AND employee_id=$3',[row.id,row.facility_id,row.employee_id])).rows[0]
 if(existing){
  const bytes=decryptDocument(existing.encrypted_pdf,context)
  if(digest(bytes)!==existing.content_sha256)throw new Error('Retained W-2 packet integrity mismatch')
  return {id:existing.id,bytes,sha256:existing.content_sha256}
 }
 const snapshot=JSON.parse(decryptDocument(row.encrypted_form,`payroll-w2-approval:${row.facility_id}:${row.employee_id}:${row.payment_year}`).toString())
 if(snapshot.version!==1||snapshot.year!==row.payment_year||snapshot.employeeId!==Number(row.employee_id)||snapshot.draft?.fingerprint!==row.draft_fingerprint)throw new Error('W-2 approval identity mismatch')
 const bytes=await renderW2EmployeePacket(snapshot),sha256=digest(bytes)
 const saved=(await db.query("INSERT INTO payroll_w2_packet(facility_id,employee_id,approval_id,payment_year,content_sha256,encrypted_pdf,renderer_version,created_by) VALUES($1,$2,$3,$4,$5,$6,'irs-2026-v1',$7) RETURNING id",[row.facility_id,row.employee_id,row.id,row.payment_year,sha256,encryptDocument(bytes,context),actor])).rows[0]
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'W2_PACKET_RETAINED','w2_packet',$3,$4)",[row.facility_id,actor,String(saved.id),{employeeId:Number(row.employee_id),approvalId:Number(row.id),year:row.payment_year,sha256}])
 return {id:saved.id,bytes,sha256}
}
