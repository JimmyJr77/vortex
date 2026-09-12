import {isDeepStrictEqual} from 'node:util'
import {quickbooksRequest} from './quickbooks.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export function settlementAccounts(bank,clearing,preferences){
 const selected=(account,type)=>{
  if(!account||!/^\d+$/.test(String(account.Id))||account.Active!==true||account.AccountType!==type||typeof account.Name!=='string'||!account.Name.trim()||account.CurrencyRef?.value&&account.CurrencyRef.value!=='USD')throw fail('Choose active USD bank and Other Current Liability clearing accounts.')
  return {id:String(account.Id),name:account.Name,type:account.AccountType,currency:'USD'}
 }
 if(preferences?.CurrencyPrefs?.HomeCurrency?.value!=='USD')throw fail('Settlement posting requires a verified USD home currency in QuickBooks.')
 const result={bank:selected(bank,'Bank'),clearing:selected(clearing,'Other Current Liability')}
 if(result.bank.id===result.clearing.id)throw fail('Bank and clearing accounts must be different.')
 return result
}
export async function paymentAccountingMappingState(db,facility){
 const connection=(await db.query('SELECT realm_id,environment,account_ids FROM payroll_quickbooks_connection WHERE facility_id=$1',[facility])).rows[0]
 const generation=Number((await db.query('SELECT quickbooks_connection_generation FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]?.quickbooks_connection_generation||0)
 const payment=(await db.query('SELECT id,mode FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[facility])).rows[0]
 const history=(await db.query('SELECT id,payment_connection_id,connection_generation,realm_id,environment,details,reference,created_at,created_by FROM payroll_payment_accounting_mapping WHERE facility_id=$1 ORDER BY id DESC',[facility])).rows
 const current=history[0],valid=!!current&&Number(current.payment_connection_id)===Number(payment?.id)&&Number(current.connection_generation)===generation&&current.realm_id===connection?.realm_id&&current.environment===connection?.environment&&current.details.clearing.id===connection?.account_ids?.clearing
 return {revision:Number(current?.id||0),status:!current?'NOT_CONFIGURED':valid?'CURRENT':'CHANGED',connection:connection?{realmId:connection.realm_id,environment:connection.environment,generation,clearingAccountId:connection.account_ids?.clearing||null}:null,paymentConnectionId:Number(payment?.id||0),paymentMode:payment?.mode||null,history}
}
export function registerPaymentAccountingMappingRoutes(app,pool,{fetcher=fetch}={}){
 const path='/api/admin/payroll/quickbooks/payment-mapping'
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await paymentAccountingMappingState(pool,req.canonicalAccess.facilityId)})}catch{res.status(500).json({success:false,message:'Unable to read settlement mapping.'})}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  const b=req.body||{},facility=req.canonicalAccess.facilityId
  if(b.confirmed!==true||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!Number.isSafeInteger(b.paymentConnectionId)||b.paymentConnectionId<=0||!Number.isSafeInteger(b.connectionGeneration)||b.connectionGeneration<0||typeof b.realmId!=='string'||!['sandbox','production'].includes(b.environment)||typeof b.bankAccountId!=='string'||!/^\d+$/.test(b.bankAccountId)||typeof b.clearingAccountId!=='string'||!/^\d+$/.test(b.clearingAccountId)||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>500||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Review the company, funding account, bank/clearing accounts and mapping reference.',400)
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0],current=await paymentAccountingMappingState(db,facility)
  if(!qbo||qbo.realm_id!==b.realmId||qbo.environment!==b.environment||current.connection.generation!==b.connectionGeneration||current.paymentConnectionId!==b.paymentConnectionId)throw fail('The payment connection or QuickBooks company changed. Refresh before saving.')
  if(current.revision!==b.expectedRevision)throw fail('Settlement mapping changed. Refresh before saving.')
  if(current.paymentMode!=='LIVE')throw fail('Select a live employer payment connection before mapping real bank movements.')
  if(qbo.account_ids?.clearing!==b.clearingAccountId)throw fail('Use the same clearing account as the payroll journal. Save the payroll mapping first.')
  const bank=await quickbooksRequest(db,qbo,`account/${b.bankAccountId}`,{fetcher}),clearing=await quickbooksRequest(db,qbo,`account/${b.clearingAccountId}`,{fetcher}),preferences=await quickbooksRequest(db,qbo,'preferences',{fetcher})
  if(String(bank.Account?.Id)!==b.bankAccountId||String(clearing.Account?.Id)!==b.clearingAccountId)throw fail('QuickBooks returned different account identities. Review the mapping.')
  const accounts=settlementAccounts(bank.Account,clearing.Account,preferences.Preferences),payment=await readPayrollPaymentConnection(db,facility,b.paymentConnectionId)
  const details={version:1,convention:'CLEARING_LIABILITY',fundingAccountId:payment.originatingAccountId,...accounts},previous=current.history[0]
  if(previous&&current.status==='CURRENT'&&isDeepStrictEqual(previous.details,details)&&previous.reference===b.reference.trim()){await db.query('COMMIT');return res.json({success:true,data:{revision:Number(previous.id),reused:true}})}
  const saved=(await db.query('INSERT INTO payroll_payment_accounting_mapping(facility_id,payment_connection_id,connection_generation,realm_id,environment,details,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[facility,b.paymentConnectionId,b.connectionGeneration,b.realmId,b.environment,details,b.reference.trim(),req.adminId])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'PAYMENT_ACCOUNTING_MAPPING_RETAINED','payment_accounting_mapping',$3,$4)",[facility,req.adminId,String(saved.id),{paymentConnectionId:b.paymentConnectionId,realmId:b.realmId,environment:b.environment,bankAccountId:accounts.bank.id,clearingAccountId:accounts.clearing.id}])
  await db.query('COMMIT');res.status(201).json({success:true,data:{revision:Number(saved.id),reused:false}})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to verify and save settlement mapping.'})}finally{db.release()}})
}
