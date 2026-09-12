import {createHash,createHmac,randomUUID} from 'node:crypto'
import {encryptDocument,decryptDocument,vaultReady} from './onboarding.js'
import {retirementEligibilitySource} from './retirementEligibility.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const context=(facility,id)=>`payroll-retirement-participant:${facility}:${id}`
const digest=v=>{if(!vaultReady())throw fail('Configure encrypted document storage before participant mapping.',503);return createHmac('sha256',Buffer.from(process.env.PAYROLL_DOCUMENT_KEY,'hex')).update(JSON.stringify(v)).digest('hex')}
const identifier=(v,label)=>{if(typeof v!=='string'||v.trim().length<1||v.length>200||/[\u0000-\u001f\u007f]/.test(v))throw fail(`Review the recordkeeper ${label}.`);return v.trim()}
const mask=v=>`••••${v.length>4?v.slice(-4):''}`
export async function retirementParticipantSource(db,facility,employeeId,planId){
 const source=await retirementEligibilitySource(db,facility,employeeId,planId)
 const employee=(await db.query('SELECT legal_first_name,legal_last_name,employee_number FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employeeId])).rows[0]
 const plan=(await db.query('SELECT plan FROM payroll_retirement_plan_revision WHERE id=$1',[source.planRevisionId])).rows[0].plan
 const facts={...source,employeeName:`${employee.legal_first_name} ${employee.legal_last_name}`,employeeNumber:employee.employee_number,providerName:plan.providerName,planName:plan.name}
 return {...facts,fingerprint:createHash('sha256').update(JSON.stringify(facts)).digest('hex')}
}
export async function readRetirementParticipantMapping(db,facility,employeeId,planId){
 const source=await retirementParticipantSource(db,facility,employeeId,planId)
 const row=(await db.query('SELECT * FROM payroll_retirement_participant_mapping WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY revision DESC LIMIT 1',[facility,employeeId,planId])).rows[0]
 if(!row||row.disposition!=='VERIFIED'||row.source_fingerprint!==source.fingerprint)throw fail('Review the current employee, plan and recordkeeper participant mapping before remittance.',409)
 return {...row,source,identifiers:JSON.parse(decryptDocument(row.encrypted_identifiers,context(facility,row.id)).toString())}
}
export function registerRetirementParticipantMappingRoutes(app,pool){
 const path='/api/admin/payroll/employees/:employeeId/retirement-participant/:planId'
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const facility=req.canonicalAccess.facilityId,source=await retirementParticipantSource(db,facility,req.params.employeeId,req.params.planId)
  const history=(await db.query('SELECT id,revision,disposition,source_fingerprint,masked_identifiers,reference,created_at FROM payroll_retirement_participant_mapping WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY revision DESC',[facility,req.params.employeeId,req.params.planId])).rows
  await db.query('COMMIT');res.json({success:true,data:{source,vaultReady:vaultReady(),status:history[0]?.disposition==='SUSPENDED'?'SUSPENDED':history[0]?.source_fingerprint===source.fingerprint?'VERIFIED':'REVIEW_REQUIRED',history}})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read retirement participant mapping.'})}finally{db.release()}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  const b=req.body||{},facility=req.canonicalAccess.facilityId
  if(!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||b.confirmed!==true||!['VERIFIED','SUSPENDED'].includes(b.disposition)||typeof b.reference!=='string'||b.reference.trim().length<20||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm the participant mapping disposition and retain the recordkeeper review reference.')
  const identifiers=b.disposition==='VERIFIED'?{providerPlanId:identifier(b.providerPlanId,'plan identifier'),participantId:identifier(b.participantId,'participant identifier')}:null
  const requestFingerprint=digest({kind:'retirement-participant-request',facility:String(facility),employeeId:String(req.params.employeeId),planId:req.params.planId,sourceFingerprint:b.sourceFingerprint,expectedRevision:b.expectedRevision,disposition:b.disposition,identifiers,reference:b.reference.trim()})
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_participant_mapping WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==requestFingerprint)throw fail('This request key belongs to different participant evidence.',409);await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
  const source=await retirementParticipantSource(db,facility,req.params.employeeId,req.params.planId)
  if(source.fingerprint!==b.sourceFingerprint)throw fail('Employee or plan evidence changed. Review current participant details.',409)
  const latest=(await db.query('SELECT revision FROM payroll_retirement_participant_mapping WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY revision DESC LIMIT 1',[facility,req.params.employeeId,req.params.planId])).rows[0]
  if((latest?.revision||0)!==b.expectedRevision)throw fail('Another participant mapping was saved. Reload current history.',409)
  const id=randomUUID(),lookup=identifiers?digest({kind:'retirement-participant-identity',facility:String(facility),planId:req.params.planId,identifiers}):null
  const encrypted=identifiers?encryptDocument(Buffer.from(JSON.stringify(identifiers)),context(facility,id)):null,masked=identifiers?{providerPlanId:mask(identifiers.providerPlanId),participantId:mask(identifiers.participantId)}:null
  await db.query('INSERT INTO payroll_retirement_participant_mapping(id,facility_id,employee_id,plan_id,plan_revision_id,revision,source_fingerprint,source,disposition,encrypted_identifiers,masked_identifiers,identity_fingerprint,reference,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',[id,facility,req.params.employeeId,req.params.planId,source.planRevisionId,b.expectedRevision+1,source.fingerprint,source,b.disposition,encrypted,masked,lookup,b.reference.trim(),b.requestKey,requestFingerprint,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_PARTICIPANT_REVIEWED','retirement_participant_mapping',$3,$4)",[facility,req.adminId,id,{employeeId:req.params.employeeId,planId:req.params.planId,revision:b.expectedRevision+1,disposition:b.disposition}])
  await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});const duplicate=e.message?.includes('Participant identifier already belongs');res.status(duplicate?409:e.status||500).json({success:false,message:duplicate?'This recordkeeper participant identifier is already mapped to another employee. Reconcile that mapping first.':e.status?e.message:'Unable to retain retirement participant mapping.'})}finally{db.release()}})
}
