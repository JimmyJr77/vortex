import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {decryptDocument} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readModernTreasuryRetirementPayment} from './modernTreasuryRetirementPayments.js'
import {retirementSettlementEvents} from './retirementSettlementEvents.js'
import {retirementSettlementJournalPayload} from './retirementSettlementJournal.js'
import {retirementSettlementMappingState} from './retirementSettlementMapping.js'
import {verifyRetirementSettlementSource} from './retirementSettlementSource.js'
import {quickbooksRequest} from './quickbooks.js'
import {settlementAccounts} from './paymentAccountingMapping.js'
import {carrierAccountingPeriod} from './carrierAccountingPeriod.js'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function prepareRetirementSettlement(db,facility,id,{fetcher=fetch,paymentFetcher=fetch,postedReview=false}={}){
 if(!uuid(id))throw fail('Choose a retirement contribution.',400)
 const a=(await db.query('SELECT a.*,c.encrypted_instruction FROM payroll_retirement_remittance_authorization a JOIN payroll_retirement_remittance_claim c ON c.authorization_id=a.id WHERE a.id=$1 AND a.facility_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation x WHERE x.authorization_id=a.id)',[id,facility])).rows[0]
 if(!a)throw fail('A claimed active retirement contribution was not found.',404)
 const intent=JSON.parse(decryptDocument(a.encrypted_instruction,`payroll-retirement-instruction:${facility}:${id}`).toString()),connection=await readPayrollPaymentConnection(db,facility,Number(a.basis.fundingRevisionId))
 if(intent.id!==id||intent.facilityId!==Number(facility)||intent.runId!==Number(a.run_id)||intent.planId!==a.plan_id||intent.destinationId!==a.destination_id||intent.amountCents!==Number(a.amount_cents)||intent.fundingRevisionId!==Number(a.basis.fundingRevisionId)||intent.originatingAccountId!==connection.originatingAccountId||intent.mode!==connection.mode||intent.paymentDate!==a.basis.timing.depositDate)throw fail('Retained contribution instruction and funding do not reconcile.')
 const result=await readModernTreasuryRetirementPayment(intent,{...connection,fetcher:paymentFetcher})
 let events;try{events=retirementSettlementEvents(intent,result)}catch{throw fail('Recover matching bank withdrawals before settlement accounting.')}
 const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
 if(!qbo)throw fail('Connect the original payroll QuickBooks company.')
 const source=await verifyRetirementSettlementSource(db,facility,a.run_id,a.plan_id,qbo,{fetcher})
 if(source.amountCents!==Number(a.amount_cents))throw fail('The original payroll retirement liability does not equal this contribution authorization.')
 const state=await retirementSettlementMappingState(db,facility,a.plan_id),mapping=state.history.find(m=>m.payment_connection_id===intent.fundingRevisionId&&m.details.liability.id===source.liabilityAccountId)
 if(!mapping||mapping.status!=='CURRENT'||mapping.details.fundingAccountId!==intent.originatingAccountId)throw fail('Review the settlement mapping for the original funding and payroll retirement liability.')
 const request=(path)=>quickbooksRequest(db,qbo,path,{fetcher}),bank=(await request(`account/${mapping.details.bank.id}`)).Account,liability=(await request(`account/${source.liabilityAccountId}`)).Account,preferences=(await request('preferences')).Preferences
 if(String(bank?.Id)!==mapping.details.bank.id||String(liability?.Id)!==source.liabilityAccountId)throw fail('QuickBooks returned different settlement account identities.')
 const accounts=settlementAccounts(bank,liability,preferences)
 if(!isDeepStrictEqual(accounts.bank,mapping.details.bank)||!isDeepStrictEqual(accounts.clearing,mapping.details.liability))throw fail('Settlement accounts changed. Review the mapping again.')
 const journals=events.map(event=>{
  if(event.postedDate<source.payrollDate)throw fail('Bank withdrawal precedes original payroll accounting. Reconcile the dates before posting.')
  return {event,period:postedReview?{postedDate:event.postedDate}:carrierAccountingPeriod(preferences,event.postedDate),payload:retirementSettlementJournalPayload(event,mapping.details,{facilityId:Number(facility),realmId:qbo.realm_id,environment:qbo.environment})}
 })
 const basis={authorizationId:id,runId:String(a.run_id),planId:a.plan_id,amountCents:Number(a.amount_cents),sourceSyncId:source.syncId,sourceJournalId:source.journalId,sourcePayload:source.payload,mappingId:mapping.id,connectionGeneration:state.connection.generation,realmId:qbo.realm_id,environment:qbo.environment,accounts:{bank:accounts.bank,liability:accounts.clearing},journals}
 return {...basis,status:'PREVIEW_ONLY',fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex')}
}
export function registerRetirementSettlementPreview(app,pool,options){
 app.post('/api/admin/payroll/retirement-remittance-authorizations/:id/settlement-preview',async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  const facility=req.canonicalAccess.facilityId;await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility]);const data=await prepareRetirementSettlement(db,facility,req.params.id,options);await db.query('COMMIT');res.json({success:true,data})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to verify retirement settlement evidence.'})}finally{db.release()}})
}
