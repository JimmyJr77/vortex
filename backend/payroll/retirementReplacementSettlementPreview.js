import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {retirementReplacementAssessment} from './retirementReplacementAssessment.js'
import {prepareRetirementReturn} from './retirementReturnPreview.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readModernTreasuryRetirementPayment} from './modernTreasuryRetirementPayments.js'
import {retirementSettlementEvents} from './retirementSettlementEvents.js'
import {retirementSettlementJournalPayload} from './retirementSettlementJournal.js'
import {retirementSettlementMappingState} from './retirementSettlementMapping.js'
import {quickbooksRequest} from './quickbooks.js'
import {journalMatches} from './settlementJournal.js'
import {settlementAccounts} from './paymentAccountingMapping.js'
import {carrierAccountingPeriod} from './carrierAccountingPeriod.js'
import {decryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const returnBasis=p=>{const {fingerprint,status,period,...basis}=p;return basis}
export const replacementSettlementBasis=p=>{const {fingerprint,status,...basis}=p;return {...basis,journals:basis.journals.map(({period,...journal})=>journal)}}
export async function prepareRetirementReplacementSettlement(db,facility,id,{fetcher=fetch,paymentFetcher=fetch,postedReview=false}={}){
 const assessment=await retirementReplacementAssessment(db,facility,id)
 if(assessment.deliveryStatus!=='MATCHED')throw fail('Reconcile original returned funds, replacement bank settlement and every replacement participant receipt before accounting.')
 const a=(await db.query("SELECT a.*,c.encrypted_instruction FROM payroll_retirement_replacement_authorization a JOIN payroll_retirement_replacement_claim c ON c.authorization_id=a.id AND c.kind='BANK' WHERE a.id=$1 AND a.facility_id=$2",[id,facility])).rows[0]
 const p=a.preview,intent=JSON.parse(decryptDocument(a.encrypted_instruction,`payroll-retirement-replacement-bank:${facility}:${id}`).toString()),funding=await readPayrollPaymentConnection(db,facility,intent.fundingRevisionId)
 if(intent.originatingAccountId!==funding.originatingAccountId||intent.mode!==funding.mode)throw fail('Reconcile the retained replacement funding account.')
 const bank=await readModernTreasuryRetirementPayment(intent,{...funding,fetcher:paymentFetcher})
 let events;try{events=retirementSettlementEvents(intent,bank)}catch{throw fail('Reverify the exact replacement bank withdrawals before accounting.')}
 const returned=await prepareRetirementReturn(db,facility,a.original_authorization_id,{fetcher,paymentFetcher,postedReview:true}),approval=(await db.query('SELECT * FROM payroll_retirement_return_authorization WHERE id=$1 AND facility_id=$2',[a.return_authorization_id,facility])).rows[0]
 if(!approval||approval.fingerprint!==p.returnFingerprint||!isDeepStrictEqual(returnBasis(returned),returnBasis(approval.preview)))throw fail('Original return accounting changed. Recover its evidence before replacement accounting.')
 const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])).rows[0]
 const job=(await db.query('SELECT j.*,(SELECT result FROM payroll_retirement_return_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS result FROM payroll_retirement_return_journal j WHERE authorization_id=$1 AND facility_id=$2',[approval.id,facility])).rows
 if(job.length!==1||job[0].realm_id!==qbo.realm_id||job[0].environment!==qbo.environment||job[0].result?.status!=='SYNCED'||!isDeepStrictEqual(job[0].payload,returned.payload)||job[0].event_key!==returned.event.key)throw fail('Reconcile the exact original return journal.')
 const request=path=>quickbooksRequest(db,qbo,path,{fetcher}),returnJournal=(await request(`journalentry/${job[0].result.journalId}`)).JournalEntry
 if(String(returnJournal?.Id)!==String(job[0].result.journalId)||!journalMatches(returnJournal,returned.payload))throw fail('The original return journal is missing or changed in QuickBooks.')
 const state=await retirementSettlementMappingState(db,facility,p.planId),mapping=state.history.find(m=>m.payment_connection_id===intent.fundingRevisionId&&m.details.liability.id===returned.source.mapping.liability.id)
 if(!mapping||mapping.status!=='CURRENT'||mapping.details.fundingAccountId!==intent.originatingAccountId)throw fail('Review the replacement bank mapping to the restored original retirement liability.')
 const bankAccount=(await request(`account/${mapping.details.bank.id}`)).Account,liability=(await request(`account/${mapping.details.liability.id}`)).Account,preferences=(await request('preferences')).Preferences
 if(String(bankAccount?.Id)!==mapping.details.bank.id||String(liability?.Id)!==mapping.details.liability.id)throw fail('QuickBooks returned different replacement settlement accounts.')
 const accounts=settlementAccounts(bankAccount,liability,preferences)
 if(!isDeepStrictEqual(accounts.bank,mapping.details.bank)||!isDeepStrictEqual(accounts.clearing,mapping.details.liability))throw fail('Review changed replacement bank or liability accounts.')
 const journals=events.map(event=>{
  if(event.postedDate<returned.event.postedDate)throw fail('Replacement withdrawal precedes the returned funds.')
  return {event,period:postedReview?{postedDate:event.postedDate}:carrierAccountingPeriod(preferences,event.postedDate),payload:retirementSettlementJournalPayload(event,mapping.details,{facilityId:Number(facility),realmId:qbo.realm_id,environment:qbo.environment})}
 })
 const basis={authorizationId:id,originalAuthorizationId:a.original_authorization_id,returnAuthorizationId:approval.id,returnFingerprint:approval.fingerprint,returnJournalId:String(returnJournal.Id),returnPayload:returned.payload,runId:p.runId,planId:p.planId,amountCents:p.amountCents,sourceJournalId:returned.source.sourceJournalId,sourceSyncId:returned.source.sourceSyncId,sourcePayload:returned.source.sourcePayload,mappingId:mapping.id,connectionGeneration:state.connection.generation,realmId:qbo.realm_id,environment:qbo.environment,accounts:{bank:accounts.bank,liability:accounts.clearing},journals}
 return {...basis,status:'PREVIEW_ONLY',fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex')}
}
export function registerRetirementReplacementSettlementPreview(app,pool,options){
 app.post('/api/admin/payroll/retirement-replacement-authorizations/:id/settlement-preview',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{const facility=req.canonicalAccess.facilityId;await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility]);const data=await prepareRetirementReplacementSettlement(db,facility,req.params.id,options);await db.query('COMMIT');res.json({success:true,data})}
  catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to verify replacement settlement accounting.'})}finally{db.release()}
 })
}
