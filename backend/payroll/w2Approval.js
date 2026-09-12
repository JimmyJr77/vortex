import {encryptDocument} from './onboarding.js'
import {readFilingIdentity} from './filingIdentity.js'
import {retainedW2Packet} from './w2Packet.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export async function w2ApprovalHistory(db,facility,employee,fingerprint){
 const rows=(await db.query('SELECT id,draft_fingerprint,reference,created_by,created_at FROM payroll_w2_approval WHERE facility_id=$1 AND employee_id=$2 AND payment_year=2026 ORDER BY id DESC',[facility,employee])).rows
 return rows.map((row,index)=>({...row,status:row.draft_fingerprint!==fingerprint?'STALE':index===0?'CURRENT':'SUPERSEDED'}))
}
export function registerW2Approval(app,pool,prepare){
 app.get('/api/admin/payroll/employees/:employeeId/w2-approval/:approvalId/pdf',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff')
  if([req.params.employeeId,req.params.approvalId].some(id=>! /^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id))))return res.status(400).json({success:false,message:'Choose a valid employee and W-2 approval.'})
  const db=await pool.connect()
  try{
   await db.query('BEGIN')
   const facility=req.canonicalAccess.facilityId,employeeId=Number(req.params.employeeId)
   const row=(await db.query('SELECT a.* FROM payroll_w2_approval a JOIN payroll_employee e ON e.id=a.employee_id AND e.facility_id=a.facility_id WHERE a.facility_id=$1 AND a.employee_id=$2 AND a.id=$3',[facility,employeeId,req.params.approvalId])).rows[0]
   if(!row)throw fail('W-2 approval not found.',404)
   const packet=await retainedW2Packet(db,row,req.adminId)
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'W2_APPROVAL_PDF_DOWNLOADED','w2_approval',$3,$4)",[facility,req.adminId,String(row.id),{employeeId,year:row.payment_year,draftFingerprint:row.draft_fingerprint,packetId:Number(packet.id),sha256:packet.sha256}])
   await db.query('COMMIT')
   res.setHeader('X-Payroll-Packet-Id',String(packet.id));res.setHeader('X-Payroll-Packet-SHA256',packet.sha256)
   res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="w2-2026-employee-${employeeId}-approval-${row.id}.pdf"`);res.send(packet.bytes)
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to generate the retained W-2 employee copies.'})}finally{db.release()}
 })
 app.post('/api/admin/payroll/employees/:employeeId/w2-approval',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const body=req.body||{},employeeId=Number(req.params.employeeId),facility=req.canonicalAccess.facilityId,reference=typeof body.reference==='string'?body.reference.trim():''
   if(!/^[1-9]\d*$/.test(req.params.employeeId)||!Number.isSafeInteger(employeeId)||body.year!==2026||body.confirmed!==true||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||typeof body.draftFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(body.draftFingerprint)||reference.length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw fail('Review and confirm the current 2026 W-2 draft with its approval revision and evidence reference.')
   await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-approval:${facility}:${employeeId}:2026`])
   const data=await prepare(db,facility),employee=data.employees.find(e=>e.employeeId===employeeId)
   if(!employee)throw fail('Employee annual payment inputs not found.',404)
   const draft=employee.w2Draft
   if(draft.status!=='DRAFT_REVIEW_REQUIRED'||!draft.boxes||draft.fingerprint!==body.draftFingerprint)throw fail('W-2 draft changed or requires additional review. Refresh annual preparation.',409)
   const prior=employee.w2ApprovalHistory[0]
   if(prior?.status==='CURRENT'&&prior.reference===reference){await db.query('COMMIT');return res.json({success:true,data:{revision:Number(prior.id),reused:true}})}
   if(Number(prior?.id||0)!==body.expectedRevision)throw fail('W-2 approval changed. Refresh annual preparation.',409)
   const employer=await readFilingIdentity(db,facility,draft.basis.employerIdentityRevision),identity=await readFilingIdentity(db,facility,draft.basis.employeeIdentityRevision)
   if(employer.kind!=='EMPLOYER'||identity.kind!=='EMPLOYEE')throw new Error('Unexpected filing identity type')
   const snapshot={version:1,year:2026,employeeId,draft,employer,employee:identity}
   const encrypted=encryptDocument(Buffer.from(JSON.stringify(snapshot)),`payroll-w2-approval:${facility}:${employeeId}:2026`)
   const saved=(await db.query('INSERT INTO payroll_w2_approval(facility_id,employee_id,payment_year,draft_fingerprint,encrypted_form,reference,created_by) VALUES($1,$2,2026,$3,$4,$5,$6) RETURNING id',[facility,employeeId,draft.fingerprint,encrypted,reference,req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'W2_DRAFT_APPROVED','w2_approval',$3,$4)",[facility,req.adminId,String(saved.id),{employeeId,year:2026,draftFingerprint:draft.fingerprint}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{revision:Number(saved.id),reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.code==='40001'?409:e.status||500).json({success:false,message:e.code==='40001'?'W-2 sources changed concurrently. Refresh annual preparation.':e.status?e.message:'Unable to retain W-2 approval.'})}finally{db.release()}
 })
}
