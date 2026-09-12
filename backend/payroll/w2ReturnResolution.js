import {syncW2FurnishingAlert} from './w2FurnishingAlerts.js'
export async function w2ReturnResolutionData(db,packetId){
 const history=(await db.query(`SELECT r.id,r.return_event_id,r.replacement_packet_id,r.replacement_event_id,r.reference,r.created_by,r.created_at,
 CASE WHEN r.return_event_id=(SELECT max(id) FROM payroll_w2_furnishing_event WHERE packet_id=r.packet_id) AND r.replacement_event_id=(SELECT max(id) FROM payroll_w2_furnishing_event WHERE packet_id=r.replacement_packet_id) THEN 'CURRENT' ELSE 'STALE' END AS status
 FROM payroll_w2_return_resolution r WHERE r.packet_id=$1 ORDER BY r.id DESC`,[packetId])).rows
 const candidates=(await db.query(`SELECT p.id AS packet_id,p.approval_id,f.id AS event_id,f.event_type,f.occurred_at FROM payroll_w2_packet original
 JOIN payroll_w2_packet p ON p.employee_id=original.employee_id AND p.facility_id=original.facility_id AND p.payment_year=original.payment_year AND p.approval_id>original.approval_id
 JOIN payroll_w2_furnishing_event f ON f.packet_id=p.id AND f.id=(SELECT max(id) FROM payroll_w2_furnishing_event WHERE packet_id=p.id)
 JOIN payroll_w2_furnishing_event old ON old.packet_id=original.id AND old.id=(SELECT max(id) FROM payroll_w2_furnishing_event WHERE packet_id=original.id)
 WHERE original.id=$1 AND old.event_type='RETURNED_UNDELIVERABLE' AND f.event_type IN ('PAPER_MAILED','HAND_DELIVERED') AND f.occurred_at>=old.occurred_at ORDER BY p.id DESC`,[packetId])).rows
 return {history:history.map((row,index)=>({...row,status:index>0?'SUPERSEDED':row.status})),candidates}
}
export function registerW2ReturnResolution(app,pool){
 app.post('/api/admin/payroll/employees/:employeeId/w2-approval/:approvalId/return-resolution',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId,reference=typeof b.reference==='string'?b.reference.trim():''
   if(![req.params.employeeId,req.params.approvalId].every(id=>/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(Number(id)))||![b.returnEventId,b.replacementPacketId,b.replacementEventId].every(id=>Number.isSafeInteger(id)&&id>0)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||b.confirmed!==true||reference.length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw Object.assign(new Error('Select and confirm current replacement furnishing evidence and its reference.'),{status:400})
   await db.query('BEGIN')
   const packet=(await db.query('SELECT id FROM payroll_w2_packet WHERE facility_id=$1 AND employee_id=$2 AND approval_id=$3',[facility,req.params.employeeId,req.params.approvalId])).rows[0]
   if(!packet)throw Object.assign(new Error('Retained packet not found.'),{status:404})
   for(const id of [Number(packet.id),b.replacementPacketId].sort((a,c)=>a-c))await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-furnishing:${id}`])
   const data=await w2ReturnResolutionData(db,packet.id),prior=data.history[0],candidate=data.candidates.find(c=>Number(c.packet_id)===b.replacementPacketId&&Number(c.event_id)===b.replacementEventId)
   const latest=(await db.query('SELECT id FROM payroll_w2_furnishing_event WHERE packet_id=$1 ORDER BY id DESC LIMIT 1',[packet.id])).rows[0]
   if(!candidate||Number(latest?.id)!==b.returnEventId)throw Object.assign(new Error('Return or replacement furnishing changed. Reload furnishing history.'),{status:409})
   if(prior?.status==='CURRENT'&&Number(prior.return_event_id)===b.returnEventId&&Number(prior.replacement_event_id)===b.replacementEventId&&prior.reference===reference){await syncW2FurnishingAlert(db,facility,packet.id);await db.query('COMMIT');return res.json({success:true,data:{id:Number(prior.id),reused:true}})}
   if(Number(prior?.id||0)!==b.expectedRevision)throw Object.assign(new Error('Return resolution changed. Reload furnishing history.'),{status:409})
   const saved=(await db.query('INSERT INTO payroll_w2_return_resolution(facility_id,employee_id,packet_id,return_event_id,replacement_packet_id,replacement_event_id,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[facility,req.params.employeeId,packet.id,b.returnEventId,b.replacementPacketId,b.replacementEventId,reference,req.adminId])).rows[0]
   await syncW2FurnishingAlert(db,facility,packet.id)
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'W2_RETURN_RESOLVED_WITH_REPLACEMENT','w2_return_resolution',$3,$4)",[facility,req.adminId,String(saved.id),{packetId:Number(packet.id),replacementPacketId:b.replacementPacketId,replacementEventId:b.replacementEventId}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{id:Number(saved.id),reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to link replacement furnishing.'})}finally{db.release()}
 })
}
