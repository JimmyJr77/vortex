import {isDeepStrictEqual} from 'node:util'
import {quickbooksRequest} from './quickbooks.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {settlementAccounts} from './paymentAccountingMapping.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function carrierSettlementMappingState(db,facility){
 const qbo=(await db.query('SELECT realm_id,environment FROM payroll_quickbooks_connection WHERE facility_id=$1',[facility])).rows[0]
 const generation=Number((await db.query('SELECT quickbooks_connection_generation FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]?.quickbooks_connection_generation||0)
 const funding=(await db.query('SELECT id,mode,created_at FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC',[facility])).rows.map(r=>({...r,id:Number(r.id)}))
 const rows=(await db.query('SELECT * FROM payroll_carrier_settlement_mapping WHERE facility_id=$1 ORDER BY id DESC',[facility])).rows,seen=new Set()
 const history=rows.map(r=>{
  const key=`${r.payment_connection_id}:${r.details.liability.id}`,superseded=seen.has(key);seen.add(key)
  const current=!superseded&&r.realm_id===qbo?.realm_id&&r.environment===qbo?.environment&&Number(r.connection_generation)===generation
  return {...r,id:Number(r.id),payment_connection_id:Number(r.payment_connection_id),connection_generation:Number(r.connection_generation),status:superseded?'SUPERSEDED':current?'CURRENT':'CHANGED'}
 })
 return {revision:Number(rows[0]?.id||0),connection:qbo?{realmId:qbo.realm_id,environment:qbo.environment,generation}:null,funding,history}
}
export function registerCarrierSettlementMappingRoutes(app,pool,{fetcher=fetch}={}){
 const path='/api/admin/payroll/quickbooks/carrier-settlement-mapping'
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await carrierSettlementMappingState(pool,req.canonicalAccess.facilityId)})}catch{res.status(500).json({success:false,message:'Unable to read carrier settlement mappings.'})}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  const b=req.body||{},facility=req.canonicalAccess.facilityId
  if(b.confirmed!==true||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!Number.isSafeInteger(b.fundingRevisionId)||b.fundingRevisionId<=0||!Number.isSafeInteger(b.connectionGeneration)||b.connectionGeneration<0||typeof b.realmId!=='string'||!/^\d+$/.test(b.realmId)||!['sandbox','production'].includes(b.environment)||![b.bankAccountId,b.liabilityAccountId].every(v=>typeof v==='string'&&/^\d+$/.test(v))||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>500||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Review the funding revision, company, carrier liability, bank account and mapping reference.',400)
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const state=await carrierSettlementMappingState(db,facility),qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
  if(!qbo||state.connection.realmId!==b.realmId||state.connection.environment!==b.environment||state.connection.generation!==b.connectionGeneration||state.revision!==b.expectedRevision)throw fail('The company or carrier mapping changed. Refresh before saving.')
  const funding=state.funding.find(r=>r.id===b.fundingRevisionId)
  if(!funding||funding.mode!==(b.environment==='production'?'LIVE':'TEST'))throw fail('Select an employer funding revision in the same environment as QuickBooks.')
  const payment=await readPayrollPaymentConnection(db,facility,b.fundingRevisionId)
  const bank=(await quickbooksRequest(db,qbo,`account/${b.bankAccountId}`,{fetcher})).Account,liability=(await quickbooksRequest(db,qbo,`account/${b.liabilityAccountId}`,{fetcher})).Account,preferences=(await quickbooksRequest(db,qbo,'preferences',{fetcher})).Preferences
  if(String(bank?.Id)!==b.bankAccountId||String(liability?.Id)!==b.liabilityAccountId)throw fail('QuickBooks returned different account identities.')
  const accounts=settlementAccounts(bank,liability,preferences),details={version:1,convention:'CARRIER_LIABILITY',fundingRevisionId:b.fundingRevisionId,fundingAccountId:payment.originatingAccountId,bank:accounts.bank,liability:accounts.clearing}
  const previous=state.history.find(r=>r.payment_connection_id===b.fundingRevisionId&&r.details.liability.id===b.liabilityAccountId)
  if(previous?.status==='CURRENT'&&isDeepStrictEqual(previous.details,details)&&previous.reference===b.reference.trim()){await db.query('COMMIT');return res.json({success:true,data:{revision:previous.id,reused:true}})}
  const saved=(await db.query('INSERT INTO payroll_carrier_settlement_mapping(facility_id,payment_connection_id,connection_generation,realm_id,environment,details,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[facility,b.fundingRevisionId,b.connectionGeneration,b.realmId,b.environment,details,b.reference.trim(),req.adminId])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_SETTLEMENT_MAPPING_RETAINED','carrier_settlement_mapping',$3,$4)",[facility,req.adminId,String(saved.id),{fundingRevisionId:b.fundingRevisionId,realmId:b.realmId,environment:b.environment,bankAccountId:b.bankAccountId,liabilityAccountId:b.liabilityAccountId}])
  await db.query('COMMIT');res.status(201).json({success:true,data:{revision:Number(saved.id),reused:false}})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to verify and retain carrier settlement mapping.'})}finally{db.release()}})
}
