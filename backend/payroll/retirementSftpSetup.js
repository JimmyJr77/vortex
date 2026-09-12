import {createHash,createHmac,randomUUID} from 'node:crypto'
import {encryptDocument,decryptDocument,vaultReady} from './onboarding.js'
import {retirementSftpConfiguration,verifyRetirementSftpConnection} from './retirementSftpTransport.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x)
const context=(facility,id)=>`payroll-retirement-sftp:${facility}:${id}`
const reviewed=['acceptsCsv','stagingExcluded','nonOverwritingRename','noAutomaticDebit']
export async function retirementSftpHistory(db,facility,planId){
 const plan=(await db.query('SELECT id FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]
 if(!plan)throw fail('Retirement plan not found.',404)
 const format=(await db.query('SELECT id,plan_revision_id,format FROM payroll_retirement_allocation_format WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]
 const history=(await db.query(`SELECT c.id,c.revision,c.disposition,c.plan_revision_id,c.format_id,c.display_configuration,c.reference,c.created_at,
 (SELECT jsonb_build_object('status',k.status,'createdAt',k.created_at) FROM payroll_retirement_sftp_check k WHERE k.configuration_id=c.id ORDER BY k.id DESC LIMIT 1) AS verification
 FROM payroll_retirement_sftp_configuration c WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC`,[facility,planId])).rows
 const currentFormat=format?.plan_revision_id===plan.id&&format?.format.disposition==='VERIFIED'?format.id:null
 const current=history[0],bindingCurrent=!!current&&current.plan_revision_id===plan.id&&current.format_id===currentFormat
 return {planRevisionId:plan.id,formatId:currentFormat,vaultReady:vaultReady(),status:!current?'REVIEW_REQUIRED':current.disposition==='SUSPENDED'?'SUSPENDED':!bindingCurrent?'CONFIGURATION_CHANGED':current.verification?.status==='VERIFIED'?'VERIFIED':'CHECK_REQUIRED',history}
}
export async function readRetirementSftpConfiguration(db,facility,id){
 const row=(await db.query('SELECT * FROM payroll_retirement_sftp_configuration WHERE id=$1 AND facility_id=$2',[id,facility])).rows[0]
 if(!row||row.disposition!=='REVIEWED')throw fail('Reviewed SFTP configuration not found.',404)
 return {row,configuration:JSON.parse(decryptDocument(row.encrypted_configuration,context(facility,id)).toString())}
}
export function registerRetirementSftpSetup(app,pool,{verify=verifyRetirementSftpConnection}={}){
 const path='/api/admin/payroll/retirement-plans/:planId/allocation-delivery'
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await retirementSftpHistory(pool,req.canonicalAccess.facilityId,req.params.planId)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load allocation delivery setup.'})}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');let db;try{db=await pool.connect();
  const b=req.body||{},facility=req.canonicalAccess.facilityId,planId=req.params.planId
  if(!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!['REVIEW','SUSPEND'].includes(b.action)||b.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<20||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm the delivery action, current revision and supporting reference.')
  let configuration
  if(b.action==='REVIEW'){
   if(!vaultReady())throw fail('Configure encrypted storage before saving SFTP credentials.',503)
   if(!uuid(b.planRevisionId)||!uuid(b.formatId)||reviewed.some(k=>b[k]!==true))throw fail('Review the current format, staging, rename and no-additional-debit contract.')
   configuration=retirementSftpConfiguration(b.configuration)
   // Retain only the normalized connection fields, never arbitrary submitted keys.
   configuration=Object.fromEntries(['host','port','username','privateKey','passphrase','hostKeySha256','stagingDirectory','deliveryDirectory'].filter(k=>configuration[k]!==undefined).map(k=>[k,configuration[k]]))
  }
  const input={planId,action:b.action,expectedRevision:b.expectedRevision,reference:b.reference.trim(),...(configuration?{configuration,planRevisionId:b.planRevisionId,formatId:b.formatId}:{} )}
  const fingerprint=(configuration?createHmac('sha256',Buffer.from(process.env.PAYROLL_DOCUMENT_KEY,'hex')):createHash('sha256')).update(JSON.stringify(input)).digest('hex')
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_sftp_configuration WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==fingerprint)throw fail('Request key belongs to different delivery evidence.',409);await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
  const state=await retirementSftpHistory(db,facility,planId),latest=state.history[0]
  if((latest?.revision||0)!==b.expectedRevision)throw fail('Delivery configuration changed. Reload the current review.',409)
  if(configuration&&(state.planRevisionId!==b.planRevisionId||state.formatId!==b.formatId))throw fail('Plan or allocation format changed. Review current evidence.',409)
  if(!configuration&&latest?.disposition!=='REVIEWED')throw fail('Suspend the current reviewed delivery configuration.',409)
  const id=randomUUID(),display=configuration?Object.fromEntries(['host','port','hostKeySha256','stagingDirectory','deliveryDirectory'].map(k=>[k,configuration[k]])):latest.display_configuration
  await db.query('INSERT INTO payroll_retirement_sftp_configuration(id,facility_id,plan_id,plan_revision_id,format_id,revision,disposition,encrypted_configuration,display_configuration,reference,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,facility,planId,configuration?b.planRevisionId:latest.plan_revision_id,configuration?b.formatId:latest.format_id,b.expectedRevision+1,configuration?'REVIEWED':'SUSPENDED',configuration?encryptDocument(Buffer.from(JSON.stringify(configuration)),context(facility,id)):null,display,b.reference.trim(),b.requestKey,fingerprint,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_SFTP_SETUP_REVIEWED','retirement_sftp_configuration',$3,$4)",[facility,req.adminId,id,{planId,revision:b.expectedRevision+1,disposition:configuration?'REVIEWED':'SUSPENDED'}])
  await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
 }catch(e){await db?.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain allocation delivery setup.'})}finally{db?.release()}})
 app.post(`${path}/:id/check`,async(req,res)=>{res.setHeader('Cache-Control','no-store');let db;try{db=await pool.connect();
  if(!uuid(req.params.id))throw fail('Select a retained delivery configuration.')
  const facility=req.canonicalAccess.facilityId,planId=req.params.planId,id=req.params.id,state=await retirementSftpHistory(db,facility,planId)
  if(state.history[0]?.id!==id||['SUSPENDED','CONFIGURATION_CHANGED'].includes(state.status))throw fail('Check the current reviewed delivery configuration.',409)
  let status='UNAVAILABLE'
  try{const {configuration}=await readRetirementSftpConfiguration(db,facility,id);const r=await verify(configuration);if(r?.status==='VERIFIED')status='VERIFIED'}catch{status='UNAVAILABLE'}
  // No database transaction is held while contacting the remote server.
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const current=await retirementSftpHistory(db,facility,planId)
  if(current.history[0]?.id!==id||['SUSPENDED','CONFIGURATION_CHANGED'].includes(current.status))status='CONFIGURATION_CHANGED'
  const check=(await db.query('INSERT INTO payroll_retirement_sftp_check(configuration_id,status,created_by) VALUES($1,$2,$3) RETURNING id,status,created_at',[id,status,req.adminId])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_SFTP_CONNECTION_CHECKED','retirement_sftp_configuration',$3,$4)",[facility,req.adminId,id,{status}])
  await db.query('COMMIT');res.json({success:true,data:check})
 }catch(e){await db?.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to check allocation delivery connection.'})}finally{db?.release()}})
}
