import {createHash,randomUUID} from 'node:crypto'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export function retirementReceiptLocationInput(directory,fileName,stagingDirectory){
 if(typeof directory!=='string'||directory.length>512||!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(directory)||directory===stagingDirectory||directory.startsWith(stagingDirectory+'/')||stagingDirectory?.startsWith(directory+'/')||typeof fileName!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}\.csv$/.test(fileName)||fileName.includes('..'))throw fail('Review an absolute receipt directory outside staging and a safe CSV filename.',400)
 return {directory,fileName}
}
export async function retirementReceiptBindingState(db,facility,remittanceId,id){
 if(!uuid(remittanceId)||!uuid(id))throw fail('Choose the retained allocation delivery.',400)
 const source=(await db.query(`SELECT d.id,d.configuration_id,d.file_name,a.plan_id,a.plan_revision_id,a.format_id,cl.id AS claim_id,cl.created_at AS claimed_at,c.display_configuration,
 (EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation WHERE authorization_id=d.id) OR EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation WHERE authorization_id=a.id)) AS cancelled
 FROM payroll_retirement_allocation_authorization d JOIN payroll_retirement_remittance_authorization a ON a.id=d.remittance_id JOIN payroll_retirement_sftp_configuration c ON c.id=d.configuration_id LEFT JOIN payroll_retirement_allocation_claim cl ON cl.authorization_id=d.id WHERE d.facility_id=$1 AND d.id=$2 AND d.remittance_id=$3`,[facility,id,remittanceId])).rows[0]
 if(!source)throw fail('Allocation delivery not found.',404)
 const contracts=(await db.query("SELECT id,revision,reference,contract,created_at FROM payroll_retirement_receipt_contract WHERE facility_id=$1 AND plan_id=$2 AND plan_revision_id=$3 AND allocation_format_id=$4 AND disposition='REVIEWED' ORDER BY revision DESC",[facility,source.plan_id,source.plan_revision_id,source.format_id])).rows
 const planDisposition=(await db.query('SELECT disposition FROM payroll_retirement_receipt_contract WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC LIMIT 1',[facility,source.plan_id])).rows[0]?.disposition||null
 const history=(await db.query('SELECT id,claim_id,contract_id,revision,disposition,directory,file_name,reference,created_at FROM payroll_retirement_receipt_binding WHERE facility_id=$1 AND allocation_id=$2 ORDER BY revision DESC',[facility,id])).rows,latest=history[0]
 const status=source.cancelled?'ALLOCATION_CANCELLED':!source.claim_id?'ALLOCATION_NOT_CLAIMED':planDisposition==='SUSPENDED'?'CONTRACT_SUSPENDED':!latest?'REVIEW_REQUIRED':latest.disposition==='SUSPENDED'?'SUSPENDED':'BOUND'
 return {source,contracts,planDisposition,history,status}
}
export function registerRetirementReceiptBindings(app,pool){
 const path='/api/admin/payroll/retirement-remittance-authorizations/:remittanceId/allocation-delivery/:id/receipt-binding'
 const endpoint=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');let db;try{db=await pool.connect();await db.query('BEGIN');const facility=req.canonicalAccess.facilityId;await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);const state=await retirementReceiptBindingState(db,facility,req.params.remittanceId,req.params.id),data=await work(db,req,facility,state);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db?.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain receipt binding.'})}finally{db?.release()}}
 app.get(path,endpoint(async(db,req,facility,state)=>({status:state.status,claimed:!!state.source.claim_id,cancelled:state.source.cancelled,planDisposition:state.planDisposition,originalFileName:state.source.file_name,host:state.source.display_configuration.host,port:state.source.display_configuration.port,contracts:state.contracts,history:state.history})))
 app.post(path,endpoint(async(db,req,facility,state)=>{
  const b=req.body||{},reference=typeof b.reference==='string'?b.reference.trim():''
  if(!['REVIEW','SUSPEND'].includes(b.action)||!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||b.confirmed!==true||reference.length<20||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw fail('Review the receipt location action and current revision.',400)
  const location=b.action==='REVIEW'?retirementReceiptLocationInput(b.directory,b.fileName,state.source.display_configuration.stagingDirectory):null
  if(location&&(!uuid(b.contractId)||b.originalFileReviewed!==true))throw fail('Confirm the receipt contract and its exact original allocation binding.',400)
  const fingerprint=createHash('sha256').update(JSON.stringify({allocationId:state.source.id,action:b.action,expectedRevision:b.expectedRevision,reference,...(location?{...location,contractId:b.contractId}:{})})).digest('hex')
  const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_receipt_binding WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==fingerprint)throw fail('Receipt binding request belongs to different evidence.');return {id:prior.id,reused:true}}
  const latest=state.history[0]
  if((latest?.revision||0)!==b.expectedRevision)throw fail('Receipt binding changed. Reload current history.')
  if(location&&(state.source.cancelled||!state.source.claim_id||state.planDisposition==='SUSPENDED'||!state.contracts.some(c=>c.id===b.contractId)))throw fail('Use a claimed active allocation and a reviewed contract matching its original plan and file format.')
  if(!location&&latest?.disposition!=='REVIEWED')throw fail('Suspend the latest reviewed receipt binding.')
  const id=randomUUID();await db.query('INSERT INTO payroll_retirement_receipt_binding(id,facility_id,allocation_id,claim_id,configuration_id,contract_id,revision,disposition,directory,file_name,reference,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[id,facility,state.source.id,state.source.claim_id,state.source.configuration_id,location?b.contractId:latest.contract_id,b.expectedRevision+1,location?'REVIEWED':'SUSPENDED',location?location.directory:latest.directory,location?location.fileName:latest.file_name,reference,b.requestKey,fingerprint,req.adminId]);await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_RECEIPT_LOCATION_REVIEWED','retirement_receipt_binding',$3,$4)",[facility,req.adminId,id,{allocationId:state.source.id,revision:b.expectedRevision+1,disposition:location?'REVIEWED':'SUSPENDED'}]);return {id,reused:false}
 }))
}
