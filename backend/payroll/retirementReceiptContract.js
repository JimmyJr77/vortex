import {createHash,randomUUID} from 'node:crypto'
import {retirementReceiptContractInput} from './retirementAllocationReceipt.js'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function retirementReceiptContractHistory(db,facility,planId){
 const plan=(await db.query('SELECT id FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]
 if(!plan)throw fail('Retirement plan not found.',404)
 const format=(await db.query('SELECT id,plan_revision_id,format FROM payroll_retirement_allocation_format WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]
 const history=(await db.query('SELECT id,plan_revision_id,allocation_format_id,revision,disposition,contract,reference,created_at FROM payroll_retirement_receipt_contract WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC',[facility,planId])).rows,latest=history[0]
 const sourceReady=!!format&&format.plan_revision_id===plan.id&&format.format.disposition==='VERIFIED'
 return {planRevisionId:plan.id,allocationFormatId:format?.id||null,sourceReady,status:!latest?'REVIEW_REQUIRED':latest.disposition==='SUSPENDED'?'SUSPENDED':!sourceReady||latest.plan_revision_id!==plan.id||latest.allocation_format_id!==format.id?'SOURCE_CHANGED':'CURRENT',history}
}
export function registerRetirementReceiptContracts(app,pool){
 const path='/api/admin/payroll/retirement-plans/:planId/receipt-contract'
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await retirementReceiptContractHistory(pool,req.canonicalAccess.facilityId,req.params.planId)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load receipt contract.'})}})
 app.post(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');let db
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId,planId=req.params.planId
   if(!['REVIEW','SUSPEND'].includes(b.action)||!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)throw fail('Choose a receipt action and current revision.',400)
   let contract=null,reference
   if(b.action==='REVIEW'){if(!uuid(b.planRevisionId)||!uuid(b.allocationFormatId))throw fail('Review the current plan and allocation format.',400);contract=retirementReceiptContractInput(b.contract);reference=contract.reference}
   else{reference=typeof b.reference==='string'?b.reference.trim():'';if(b.confirmed!==true||reference.length<20||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw fail('Confirm receipt suspension and retain its reviewed reference.',400)}
   const fingerprint=createHash('sha256').update(JSON.stringify({planId,action:b.action,expectedRevision:b.expectedRevision,reference,contract,...(contract?{planRevisionId:b.planRevisionId,allocationFormatId:b.allocationFormatId}:{})})).digest('hex')
   db=await pool.connect();await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_receipt_contract WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
   if(prior){if(prior.request_fingerprint!==fingerprint)throw fail('Request key belongs to a different receipt review.');await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
   const state=await retirementReceiptContractHistory(db,facility,planId),latest=state.history[0]
   if((latest?.revision||0)!==b.expectedRevision)throw fail('Receipt contract changed. Reload its current revision.')
   if(contract&&(!state.sourceReady||state.planRevisionId!==b.planRevisionId||state.allocationFormatId!==b.allocationFormatId))throw fail('Plan or allocation format changed. Review the current receipt contract.')
   if(!contract&&latest?.disposition!=='REVIEWED')throw fail('Suspend the latest reviewed receipt contract.')
   const id=randomUUID(),planRevisionId=contract?b.planRevisionId:latest.plan_revision_id,formatId=contract?b.allocationFormatId:latest.allocation_format_id
   await db.query('INSERT INTO payroll_retirement_receipt_contract(id,facility_id,plan_id,plan_revision_id,allocation_format_id,revision,disposition,contract,reference,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id,facility,planId,planRevisionId,formatId,b.expectedRevision+1,contract?'REVIEWED':'SUSPENDED',contract||latest.contract,reference,b.requestKey,fingerprint,req.adminId])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_RECEIPT_CONTRACT_REVIEWED','retirement_receipt_contract',$3,$4)",[facility,req.adminId,id,{planId,revision:b.expectedRevision+1,disposition:contract?'REVIEWED':'SUSPENDED'}]);await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db?.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain receipt contract.'})}finally{db?.release()}
 })
}
