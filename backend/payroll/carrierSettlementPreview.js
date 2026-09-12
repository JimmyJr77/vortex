import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {decryptDocument} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readModernTreasuryCarrierPayment} from './modernTreasuryCarrierPayments.js'
import {carrierSettlementEvents,carrierSettlementJournalPayload} from './carrierSettlementJournal.js'
import {carrierSettlementMappingState} from './carrierSettlementMapping.js'
import {prepareCarrierAccounting} from './benefitCarrierInvoice.js'
import {quickbooksRequest} from './quickbooks.js'
import {resolveCarrierPremiumJournal} from './carrierPremiumDispatch.js'
import {carrierPremiumJournal} from './carrierPremiumJournal.js'
import {journalMatches} from './settlementJournal.js'
import {settlementAccounts} from './paymentAccountingMapping.js'
import {carrierAccountingPeriod} from './carrierAccountingPeriod.js'
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})}
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
// Caller owns the transaction and employer settings lock. This operation only
// reads provider evidence; a preview is never authorization to post a journal.
export async function prepareCarrierSettlement(db,facility,id,{fetcher=fetch,paymentFetcher=fetch}={}){
 if(!uuid(id))fail('Choose a retained carrier payment authorization.',400)
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
 const a=(await db.query('SELECT a.*,c.encrypted_instruction FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id JOIN payroll_carrier_payment_claim c ON c.authorization_id=a.id WHERE a.id=$1 AND i.facility_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation x WHERE x.authorization_id=a.id)',[id,facility])).rows[0]
 if(!a)fail('A retained, dispatched carrier payment was not found.',404)
 const intent=JSON.parse(decryptDocument(a.encrypted_instruction,`payroll-carrier-payment:${facility}:${a.id}`).toString()),connection=await readPayrollPaymentConnection(db,facility,a.connection_id)
 if(intent.id!==a.id||intent.facilityId!==Number(facility)||intent.invoiceId!==a.invoice_id||intent.invoiceRevision!==a.preview.invoiceRevision||intent.payeeRevisionId!==a.payee_id||intent.fundingRevisionId!==Number(a.connection_id)||intent.amountCents!==Number(a.amount_cents)||intent.paymentDate!==a.preview.paymentDate||intent.mode!==connection.mode||intent.originatingAccountId!==connection.originatingAccountId)fail('Retained carrier payment and funding evidence do not agree.')
 const result=await readModernTreasuryCarrierPayment(intent,{...connection,fetcher:paymentFetcher})
 let events;try{events=carrierSettlementEvents(intent,result)}catch{fail('Recover a matching completed bank withdrawal before reviewing carrier settlement accounting.')}
 const {row,check}=await prepareCarrierAccounting(db,{canonicalAccess:{facilityId:facility},params:{id:a.invoice_id},body:{}},false,{fetcher})
 const premium=(await db.query('SELECT a.*,(SELECT result FROM payroll_carrier_premium_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1) AS observation FROM payroll_carrier_premium_authorization a WHERE a.id=$1 AND a.invoice_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation c WHERE c.authorization_id=a.id)',[a.premium_authorization_id,a.invoice_id])).rows[0]
 if(!premium||premium.fingerprint!==a.preview.premiumFingerprint||premium.observation?.status!=='SYNCED'||premium.observation.journalId!==a.preview.premiumJournalId)fail('Recover the retained premium journal before reviewing its bank settlement.')
 if((await db.query('SELECT id FROM payroll_carrier_reversal_authorization r WHERE r.premium_authorization_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_reversal_cancellation c WHERE c.authorization_id=r.id)',[premium.id])).rows.length)fail('Resolve the premium reversal before settlement accounting.')
 const expected=carrierPremiumJournal(row.id,row.invoice,{expense:premium.preview.accounts[0]?.id,carrier:premium.preview.accounts[1]?.id,deductions:check.deductionAccountId})
 if(!journalMatches(premium.preview.payload,expected))fail('The retained premium does not match the current invoice.')
 const state=await carrierSettlementMappingState(db,facility),qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0],liabilityId=a.preview.liabilityAccount.id
 if(!qbo||qbo.realm_id!==a.preview.realmId||qbo.environment!==a.preview.environment||premium.preview.accounts[1]?.id!==liabilityId)fail('Reconnect the retained premium company and liability before settlement accounting.')
 const mapping=state.history.find(m=>m.payment_connection_id===Number(a.connection_id)&&m.details.liability.id===liabilityId)
 if(!mapping||mapping.status!=='CURRENT'||mapping.details.fundingAccountId!==intent.originatingAccountId)fail('Review the carrier settlement mapping for this payment funding revision and premium liability.')
 const request=(path,options)=>quickbooksRequest(db,qbo,path,{...options,fetcher}),original=await resolveCarrierPremiumJournal({id:premium.id,payload:premium.preview.payload},request)
 if(original.status!=='SYNCED'||original.journalId!==a.preview.premiumJournalId)fail('The actual premium journal changed or could not be verified.')
 const bank=(await request(`account/${mapping.details.bank.id}`)).Account,liability=(await request(`account/${liabilityId}`)).Account,preferences=(await request('preferences')).Preferences
 if(String(bank?.Id)!==mapping.details.bank.id||String(liability?.Id)!==liabilityId)fail('QuickBooks returned different settlement account identities.')
 const accounts=settlementAccounts(bank,liability,preferences)
 if(!isDeepStrictEqual(accounts.bank,mapping.details.bank)||!isDeepStrictEqual(accounts.clearing,mapping.details.liability))fail('The bank or carrier liability account changed. Review the settlement mapping again.')
 const journals=events.map(event=>{
  if(event.postedDate<premium.preview.payload.TxnDate)fail('The bank withdrawal precedes the premium accounting date. Reconcile the accounting dates before posting.')
  return {event,period:carrierAccountingPeriod(preferences,event.postedDate),payload:carrierSettlementJournalPayload(event,mapping.details,{facilityId:Number(facility),realmId:qbo.realm_id,environment:qbo.environment})}
 })
 const basis={authorizationId:a.id,invoiceId:a.invoice_id,invoiceRevision:row.revision,premiumAuthorizationId:premium.id,premiumFingerprint:premium.fingerprint,premiumJournalId:original.journalId,mappingId:mapping.id,connectionGeneration:state.connection.generation,realmId:qbo.realm_id,environment:qbo.environment,amountCents:Number(a.amount_cents),accounts:{bank:accounts.bank,liability:accounts.clearing},journals}
 return {...basis,status:'PREVIEW_ONLY',fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex')}
}
export function registerCarrierSettlementPreviewRoutes(app,pool,options){
 app.post('/api/admin/payroll/carrier-payment-authorizations/:id/settlement-preview',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId]);const data=await prepareCarrierSettlement(db,req.canonicalAccess.facilityId,req.params.id,options);await db.query('COMMIT');res.json({success:true,data})}
  catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to verify carrier settlement evidence.'})}finally{db.release()}
 })
}
