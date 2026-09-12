import {createHash} from 'node:crypto'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
import {quickbooksRequest} from './quickbooks.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {settlementAccounts} from './paymentAccountingMapping.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function retirementSettlementMappingState(db,facility,planId){
 const qbo=(await db.query('SELECT realm_id,environment FROM payroll_quickbooks_connection WHERE facility_id=$1',[facility])).rows[0]
 const generation=Number((await db.query('SELECT quickbooks_connection_generation FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]?.quickbooks_connection_generation||0)
 const funding=(await db.query('SELECT id,mode,created_at FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC',[facility])).rows.map(r=>({...r,id:Number(r.id)}))
 const rows=(await db.query('SELECT * FROM payroll_retirement_settlement_mapping WHERE facility_id=$1 AND plan_id=$2 ORDER BY id DESC',[facility,planId])).rows,seen=new Set()
 const history=rows.map(r=>{
  const key=`${r.payment_connection_id}:${r.details.liability.id}`,superseded=seen.has(key);seen.add(key)
  const current=!superseded&&r.realm_id===qbo?.realm_id&&r.environment===qbo?.environment&&Number(r.connection_generation)===generation
  return {...r,id:Number(r.id),payment_connection_id:Number(r.payment_connection_id),connection_generation:Number(r.connection_generation),status:superseded?'SUPERSEDED':current?'CURRENT':'CHANGED'}
 })
 return {revision:Number(rows[0]?.id||0),connection:qbo?{realmId:qbo.realm_id,environment:qbo.environment,generation}:null,funding,history}
}
export function registerRetirementSettlementMappingRoutes(app,pool,{fetcher=fetch}={}){
 const path='/api/admin/payroll/retirement-plans/:planId/settlement-mapping'
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await retirementSettlementMappingState(pool,req.canonicalAccess.facilityId,req.params.planId)})}catch{res.status(500).json({success:false,message:'Unable to read retirement settlement mappings.'})}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  const b=req.body||{},facility=req.canonicalAccess.facilityId
  if(!uuid(b.requestKey)||!/^[-a-zA-Z0-9]{1,80}$/.test(req.params.planId)||b.confirmed!==true||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!Number.isSafeInteger(b.fundingRevisionId)||b.fundingRevisionId<=0||!Number.isSafeInteger(b.connectionGeneration)||b.connectionGeneration<0||typeof b.realmId!=='string'||!/^\d+$/.test(b.realmId)||!['sandbox','production'].includes(b.environment)||![b.bankAccountId,b.liabilityAccountId].every(v=>typeof v==='string'&&/^\d+$/.test(v))||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>500||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Review the funding revision, company, retirement liability, bank account and mapping reference.',400)
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
  const fingerprint=createHash('sha256').update(JSON.stringify([req.params.planId,b.expectedRevision,b.fundingRevisionId,b.connectionGeneration,b.realmId,b.environment,b.bankAccountId,b.liabilityAccountId,b.reference])).digest('hex')
  const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_settlement_mapping WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==fingerprint)throw fail('Mapping request identity belongs to different evidence.');await db.query('COMMIT');return res.json({success:true,data:{revision:Number(prior.id),reused:true}})}
  if(!(await db.query('SELECT 1 FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 LIMIT 1',[facility,req.params.planId])).rowCount)throw fail('Retain this employer retirement plan before mapping settlement.',404)
  const state=await retirementSettlementMappingState(db,facility,req.params.planId),qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
  if(!qbo||state.connection.realmId!==b.realmId||state.connection.environment!==b.environment||state.connection.generation!==b.connectionGeneration||state.revision!==b.expectedRevision)throw fail('The company or retirement mapping changed. Refresh before saving.')
  const funding=state.funding.find(r=>r.id===b.fundingRevisionId)
  if(!funding||funding.mode!==(b.environment==='production'?'LIVE':'TEST'))throw fail('Select an employer funding revision in the same environment as QuickBooks.')
  const payment=await readPayrollPaymentConnection(db,facility,b.fundingRevisionId)
  const bank=(await quickbooksRequest(db,qbo,`account/${b.bankAccountId}`,{fetcher})).Account,liability=(await quickbooksRequest(db,qbo,`account/${b.liabilityAccountId}`,{fetcher})).Account,preferences=(await quickbooksRequest(db,qbo,'preferences',{fetcher})).Preferences
  if(String(bank?.Id)!==b.bankAccountId||String(liability?.Id)!==b.liabilityAccountId)throw fail('QuickBooks returned different account identities.')
  const accounts=settlementAccounts(bank,liability,preferences),details={version:1,planId:req.params.planId,convention:'RETIREMENT_LIABILITY',fundingRevisionId:b.fundingRevisionId,fundingAccountId:payment.originatingAccountId,bank:accounts.bank,liability:accounts.clearing}
  const saved=(await db.query('INSERT INTO payroll_retirement_settlement_mapping(facility_id,payment_connection_id,connection_generation,realm_id,environment,details,reference,created_by,plan_id,request_key,request_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',[facility,b.fundingRevisionId,b.connectionGeneration,b.realmId,b.environment,details,b.reference.trim(),req.adminId,req.params.planId,b.requestKey,fingerprint])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_SETTLEMENT_MAPPING_RETAINED','retirement_settlement_mapping',$3,$4)",[facility,req.adminId,String(saved.id),{fundingRevisionId:b.fundingRevisionId,realmId:b.realmId,environment:b.environment,bankAccountId:b.bankAccountId,liabilityAccountId:b.liabilityAccountId}])
  await db.query('COMMIT');res.status(201).json({success:true,data:{revision:Number(saved.id),reused:false}})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to verify and retain retirement settlement mapping.'})}finally{db.release()}})
}
