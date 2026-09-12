import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {decryptDocument} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {modernTreasuryTransport,readBankSettlement} from './modernTreasuryPayments.js'
import {readModernTreasuryRetirementPayment} from './modernTreasuryRetirementPayments.js'
import {retirementReturnSettlementEvent,retirementReturnSettlementJournalPayload} from './retirementReturnSettlement.js'
import {verifyRetirementReturnAccountingSource} from './retirementReturnAccountingSource.js'
import {quickbooksRequest} from './quickbooks.js'
import {settlementAccounts} from './paymentAccountingMapping.js'
import {carrierAccountingPeriod} from './carrierAccountingPeriod.js'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function prepareRetirementReturn(db,facility,id,{fetcher=fetch,paymentFetcher=fetch,postedReview=false}={}){
 if(!uuid(id))throw fail('Choose a retirement contribution.',400)
 const a=(await db.query('SELECT a.*,c.encrypted_instruction FROM payroll_retirement_remittance_authorization a JOIN payroll_retirement_remittance_claim c ON c.authorization_id=a.id WHERE a.id=$1 AND a.facility_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation x WHERE x.authorization_id=a.id)',[id,facility])).rows[0]
 if(!a)throw fail('A claimed active retirement contribution was not found.',404)
 const intent=JSON.parse(decryptDocument(a.encrypted_instruction,`payroll-retirement-instruction:${facility}:${id}`).toString()),funding=await readPayrollPaymentConnection(db,facility,Number(a.basis.fundingRevisionId))
 if(intent.id!==id||intent.facilityId!==Number(facility)||intent.runId!==Number(a.run_id)||intent.planId!==a.plan_id||intent.destinationId!==a.destination_id||intent.amountCents!==Number(a.amount_cents)||intent.fundingRevisionId!==Number(a.basis.fundingRevisionId)||intent.originatingAccountId!==funding.originatingAccountId||intent.mode!==funding.mode||intent.paymentDate!==a.basis.timing.depositDate)throw fail('Reconcile the original contribution instruction and funding.')
 const retained=(await db.query("SELECT result FROM payroll_retirement_remittance_observation WHERE authorization_id=$1 AND result->>'status'='COMPLETED' AND result->>'settlementStatus'='BANK_POSTED' ORDER BY id DESC LIMIT 1",[id])).rows[0]?.result
 if(!retained)throw fail('Retain verified original bank withdrawals before return accounting.')
 const config={...funding,fetcher:paymentFetcher},bank=await readBankSettlement({id:retained.providerId,transaction_ids:retained.transactionIds,effective_date:retained.effectiveDate},intent,modernTreasuryTransport(config))
 if(bank.settlementStatus!=='BANK_POSTED')throw fail('The original bank withdrawals could not be reverified.')
 const withdrawal={...retained,...bank},returned=await readModernTreasuryRetirementPayment(intent,config)
 let event;try{event=retirementReturnSettlementEvent(intent,withdrawal,returned)}catch{throw fail('Verify the exact full returned bank credit and original withdrawals.')}
 const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])).rows[0]
 if(!qbo)throw fail('Connect the original payroll accounting company.')
 let source;try{source=await verifyRetirementReturnAccountingSource(db,facility,id,intent,withdrawal,qbo,{fetcher})}catch{throw fail('Reconcile the original payroll and withdrawal journals in QuickBooks.')}
 const request=path=>quickbooksRequest(db,qbo,path,{fetcher}),bankAccount=(await request(`account/${source.mapping.bank.id}`)).Account,liability=(await request(`account/${source.mapping.liability.id}`)).Account,preferences=(await request('preferences')).Preferences
 if(String(bankAccount?.Id)!==source.mapping.bank.id||String(liability?.Id)!==source.mapping.liability.id)throw fail('QuickBooks returned different original bank or liability accounts.')
 const accounts=settlementAccounts(bankAccount,liability,preferences)
 if(!isDeepStrictEqual(accounts.bank,source.mapping.bank)||!isDeepStrictEqual(accounts.clearing,source.mapping.liability))throw fail('Review changed original settlement accounts before return accounting.')
 const period=postedReview?{postedDate:event.postedDate}:carrierAccountingPeriod(preferences,event.postedDate),payload=retirementReturnSettlementJournalPayload(event,source.mapping,{facilityId:Number(facility),realmId:qbo.realm_id,environment:qbo.environment})
 const after=await readModernTreasuryRetirementPayment(intent,config)
 if(!isDeepStrictEqual(after,returned))throw fail('Returned-credit evidence changed during review. Retry with current evidence.')
 const basis={paymentAuthorizationId:id,amountCents:event.amountCents,realmId:qbo.realm_id,environment:qbo.environment,source,event,period,payload}
 return {...basis,status:'RETURN_PREVIEW_ONLY',fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex')}
}
export function registerRetirementReturnPreview(app,pool,options){
 app.post('/api/admin/payroll/retirement-remittance-authorizations/:id/return-preview',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{const facility=req.canonicalAccess.facilityId;await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility]);const data=await prepareRetirementReturn(db,facility,req.params.id,options);await db.query('COMMIT');res.json({success:true,data})}
  catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to prepare retirement return accounting.'})}finally{db.release()}
 })
}
