import {registerW2NoticeReturnRoutes} from './w2NoticeReturnRoutes.js'
import {w2NoticeEvidence,w2PublicationNoticeStatus} from './w2NoticeDispatch.js'
import {queueW2AvailabilityNotice} from './w2NoticeQueue.js'
import {createHash} from 'node:crypto'
import {payrollEmployeeAuth} from './employeeAuth.js'
import {decryptDocument} from './onboarding.js'
import {retainedW2Packet} from './w2Packet.js'
import {electronicTermsFor} from './w2ElectronicAccess.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export function registerW2Publication(app,pool,prepare){
 registerW2NoticeReturnRoutes(app,pool)
 app.get('/api/admin/payroll/employees/:employeeId/w2-approval/:approvalId/publication',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   if(![req.params.employeeId,req.params.approvalId].every(id=>/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(Number(id))))throw fail('Choose a valid employee and approval.')
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const facility=req.canonicalAccess.facilityId,employeeId=Number(req.params.employeeId)
   const approval=(await db.query('SELECT id FROM payroll_w2_approval WHERE facility_id=$1 AND employee_id=$2 AND id=$3',[facility,employeeId,req.params.approvalId])).rows[0];if(!approval)throw fail('W-2 approval not found.',404)
   const published=(await db.query("SELECT u.id,u.published_at,u.reference,p.content_sha256,'AVAILABLE_NOTICE_PENDING' AS status FROM payroll_w2_publication u JOIN payroll_w2_packet p ON p.id=u.packet_id WHERE u.facility_id=$1 AND u.employee_id=$2 AND p.approval_id=$3",[facility,employeeId,approval.id])).rows[0]||null
   if(published){published.notice=await w2NoticeEvidence(db,facility,published.id);published.status=w2PublicationNoticeStatus(published.notice)}
   const reasons=[];let consentId=null
   if(!published){
    const preparation=await prepare(db,facility),employee=preparation.employees.find(e=>e.employeeId===employeeId)
    if(Number(employee?.w2ApprovalHistory[0]?.id)!==Number(approval.id)||employee?.w2ApprovalHistory[0]?.status!=='CURRENT')reasons.push('Refresh annual inputs and retain a current W-2 approval.')
    const consent=(await db.query('SELECT id,decision,terms_fingerprint,encrypted_receipt FROM payroll_w2_consent WHERE facility_id=$1 AND employee_id=$2 AND payment_year=2026 ORDER BY id DESC LIMIT 1',[facility,employeeId])).rows[0],terms=await electronicTermsFor(db,facility)
    if(!consent||consent.decision!=='CONSENT'||!terms.available||consent.terms_fingerprint!==terms.fingerprint)reasons.push('The employee must complete current electronic W-2 consent in the onboarding portal.')
    else{try{const receipt=JSON.parse(decryptDocument(consent.encrypted_receipt,`w2-consent:${facility}:${employeeId}:2026`).toString());if(receipt.termsFingerprint!==terms.fingerprint)throw new Error('Mismatch');consentId=Number(consent.id)}catch{reasons.push('The retained consent receipt cannot currently be verified.')}}
   }
   await db.query('COMMIT');res.json({success:true,data:{publication:published,canPublish:!published&&!reasons.length,consentId,reasons}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review W-2 publication readiness.'})}finally{db.release()}
 })
 app.post('/api/admin/payroll/employees/:employeeId/w2-approval/:approvalId/publication',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect();let consentLock=null
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId,employeeId=Number(req.params.employeeId),reference=typeof b.reference==='string'?b.reference.trim():''
   if(![req.params.employeeId,req.params.approvalId].every(id=>/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(Number(id)))||!Number.isSafeInteger(b.consentId)||b.consentId<=0||b.confirmed!==true||reference.length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw fail('Confirm the approved packet, employee consent revision and publication evidence.')
   consentLock=`w2-consent:${facility}:${employeeId}:2026`;await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[consentLock])
   await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,employeeId]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-approval:${facility}:${employeeId}:2026`])
   const approval=(await db.query('SELECT * FROM payroll_w2_approval WHERE facility_id=$1 AND employee_id=$2 AND id=$3',[facility,employeeId,req.params.approvalId])).rows[0]
   if(!approval)throw fail('W-2 approval not found.',404)
   const prior=(await db.query('SELECT u.* FROM payroll_w2_publication u JOIN payroll_w2_packet p ON p.id=u.packet_id WHERE p.approval_id=$1 AND u.facility_id=$2 AND u.employee_id=$3',[approval.id,facility,employeeId])).rows[0]
   if(prior){if(prior.reference!==reference||Number(prior.consent_id)!==b.consentId)throw fail('This packet is already published. Review its existing publication.',409);const notice=await w2NoticeEvidence(db,facility,prior.id);await db.query('COMMIT');return res.json({success:true,data:{id:Number(prior.id),status:w2PublicationNoticeStatus(notice),reused:true}})}
   const prepared=await prepare(db,facility),employee=prepared.employees.find(e=>e.employeeId===employeeId)
   if(Number(employee?.w2ApprovalHistory[0]?.id)!==Number(approval.id)||employee?.w2ApprovalHistory[0]?.status!=='CURRENT')throw fail('The approved W-2 changed or needs review. Refresh annual preparation.',409)
   const consent=(await db.query('SELECT * FROM payroll_w2_consent WHERE facility_id=$1 AND employee_id=$2 AND payment_year=2026 ORDER BY id DESC LIMIT 1',[facility,employeeId])).rows[0],terms=await electronicTermsFor(db,facility)
   if(!consent||Number(consent.id)!==b.consentId||consent.decision!=='CONSENT'||!terms.available||consent.terms_fingerprint!==terms.fingerprint)throw fail('Current electronic consent is required. The employee must review delivery preferences.',409)
   const receipt=JSON.parse(decryptDocument(consent.encrypted_receipt,`w2-consent:${facility}:${employeeId}:2026`).toString());if(receipt.termsFingerprint!==terms.fingerprint)throw new Error('Consent receipt mismatch')
   const packet=await retainedW2Packet(db,approval,req.adminId)
   const saved=(await db.query('INSERT INTO payroll_w2_publication(facility_id,employee_id,packet_id,consent_id,reference,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[facility,employeeId,packet.id,consent.id,reference,req.adminId])).rows[0]
   await queueW2AvailabilityNotice(db,{publicationId:Number(saved.id),facility,employeeId,contact:receipt.terms.contact})
   await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','W-2 availability notice is pending',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,dismissed_by=NULL,message=EXCLUDED.message",[facility,`w2-notice-${saved.id}`,`W-2 publication ${saved.id} for employee ${employeeId}, packet ${packet.id}, is available in the portal. Complete and retain the required availability notice; posting alone does not complete furnishing.`])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'W2_PACKET_PUBLISHED','w2_publication',$3,$4)",[facility,req.adminId,String(saved.id),{employeeId,packetId:Number(packet.id),consentId:Number(consent.id),sha256:packet.sha256}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{id:Number(saved.id),status:'AVAILABLE_NOTICE_PENDING',reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(['40001','23505'].includes(e.code)?409:e.status||500).json({success:false,message:['40001','23505'].includes(e.code)?'Publication sources changed concurrently. Refresh before retrying.':e.status?e.message:'Unable to publish W-2 packet.'})}finally{let releaseError;try{if(consentLock)await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[consentLock])}catch(e){releaseError=e}db.release(releaseError)}
 })
}
export function registerEmployeeW2Documents(app,pool){
 const auth=payrollEmployeeAuth(pool),path='/api/payroll/employee/w2-documents'
 app.get(path,auth,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const s=req.payrollEmployee;res.json({success:true,data:(await pool.query("SELECT u.id,u.published_at,p.payment_year,p.content_sha256,'AVAILABLE' AS status FROM payroll_w2_publication u JOIN payroll_w2_packet p ON p.id=u.packet_id WHERE u.facility_id=$1 AND u.employee_id=$2 ORDER BY u.id DESC",[s.facility_id,s.employee_id])).rows})}catch{res.status(500).json({success:false,message:'Unable to load your W-2 documents.'})}})
 app.get(`${path}/:publicationId/pdf`,auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff')
  try{
   if(!/^[1-9]\d*$/.test(req.params.publicationId)||!Number.isSafeInteger(Number(req.params.publicationId)))throw fail('Choose a valid tax document.')
   const s=req.payrollEmployee,row=(await pool.query('SELECT p.*,u.id AS publication_id FROM payroll_w2_publication u JOIN payroll_w2_packet p ON p.id=u.packet_id AND p.facility_id=u.facility_id AND p.employee_id=u.employee_id WHERE u.id=$1 AND u.facility_id=$2 AND u.employee_id=$3',[req.params.publicationId,s.facility_id,s.employee_id])).rows[0]
   if(!row)throw fail('Tax document not found.',404)
   const bytes=decryptDocument(row.encrypted_pdf,`payroll-w2-packet:${s.facility_id}:${s.employee_id}:${row.approval_id}:${row.payment_year}`)
   if(createHash('sha256').update(bytes).digest('hex')!==row.content_sha256)throw new Error('Packet integrity mismatch')
   await pool.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,NULL,'EMPLOYEE_W2_DOWNLOADED','w2_publication',$2,$3)",[s.facility_id,String(row.publication_id),{employeeId:Number(s.employee_id),packetId:Number(row.id),sha256:row.content_sha256}])
   res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="w2-${row.payment_year}-${row.publication_id}.pdf"`);res.send(bytes)
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to download your W-2 document.'})}
 })
}
