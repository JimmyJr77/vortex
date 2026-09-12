import {registerW2ReturnResolution,w2ReturnResolutionData} from './w2ReturnResolution.js'
import {syncW2FurnishingAlert} from './w2FurnishingAlerts.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const validIds=req=>[req.params.employeeId,req.params.approvalId].every(id=>/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(Number(id)))
async function packetFor(db,req){
 const row=(await db.query('SELECT p.id,p.content_sha256,p.created_at FROM payroll_w2_approval a LEFT JOIN payroll_w2_packet p ON p.approval_id=a.id AND p.facility_id=a.facility_id AND p.employee_id=a.employee_id WHERE a.facility_id=$1 AND a.employee_id=$2 AND a.id=$3',[req.canonicalAccess.facilityId,req.params.employeeId,req.params.approvalId])).rows[0]
 if(!row)throw fail('W-2 approval not found.',404)
 return row.id?row:null
}
const historyFor=async(db,id)=>(await db.query('SELECT id,event_type,occurred_at,reference,created_by,created_at FROM payroll_w2_furnishing_event WHERE packet_id=$1 ORDER BY id DESC',[id])).rows
export function registerW2Furnishing(app,pool){
 registerW2ReturnResolution(app,pool)
 const path='/api/admin/payroll/employees/:employeeId/w2-approval/:approvalId/furnishing'
 app.get(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{if(!validIds(req))throw fail('Choose a valid employee and approval.');const packet=await packetFor(pool,req);res.json({success:true,data:{packet,history:packet?await historyFor(pool,packet.id):[],replacement:packet?await w2ReturnResolutionData(pool,packet.id):{history:[],candidates:[]}}})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read W-2 furnishing history.'})}
 })
 app.post(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},reference=typeof b.reference==='string'?b.reference.trim():'',timestamp=typeof b.occurredAt==='string'?Date.parse(b.occurredAt):NaN
   if(!validIds(req)||!['PAPER_MAILED','HAND_DELIVERED','RETURNED_UNDELIVERABLE'].includes(b.eventType)||b.confirmed!==true||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!Number.isFinite(timestamp)||new Date(timestamp).toISOString()!==b.occurredAt||reference.length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw fail('Confirm the actual furnishing event, date/time, evidence reference and current revision.')
   await db.query('BEGIN');const packet=await packetFor(db,req)
   if(!packet)throw fail('Download and retain the approved employee packet first.',409)
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-furnishing:${packet.id}`])
   const history=await historyFor(db,packet.id),prior=history[0],now=(await db.query('SELECT clock_timestamp() AS now')).rows[0].now
   if(timestamp<new Date(packet.created_at).getTime()||timestamp>new Date(now).getTime())throw fail('Event time must be after packet preparation and cannot be in the future.')
   if(prior&&prior.event_type===b.eventType&&new Date(prior.occurred_at).toISOString()===b.occurredAt&&prior.reference===reference){await syncW2FurnishingAlert(db,req.canonicalAccess.facilityId,packet.id);await db.query('COMMIT');return res.json({success:true,data:{id:Number(prior.id),reused:true}})}
   if(Number(prior?.id||0)!==b.expectedRevision)throw fail('Furnishing history changed. Reload before recording another event.',409)
   if(prior&&timestamp<new Date(prior.occurred_at).getTime())throw fail('Event time must not precede the latest furnishing event.')
   if(b.eventType==='RETURNED_UNDELIVERABLE'&&prior?.event_type!=='PAPER_MAILED')throw fail('Record the actual paper mailing before its undeliverable return.')
   const saved=(await db.query('INSERT INTO payroll_w2_furnishing_event(packet_id,facility_id,employee_id,event_type,occurred_at,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[packet.id,req.canonicalAccess.facilityId,req.params.employeeId,b.eventType,b.occurredAt,reference,req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'W2_FURNISHING_RECORDED','w2_furnishing',$3,$4)",[req.canonicalAccess.facilityId,req.adminId,String(saved.id),{packetId:Number(packet.id),employeeId:Number(req.params.employeeId),approvalId:Number(req.params.approvalId),eventType:b.eventType,sha256:packet.content_sha256}])
   await syncW2FurnishingAlert(db,req.canonicalAccess.facilityId,packet.id)
   await db.query('COMMIT');res.status(201).json({success:true,data:{id:Number(saved.id),reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to record W-2 furnishing.'})}finally{db.release()}
 })
}
