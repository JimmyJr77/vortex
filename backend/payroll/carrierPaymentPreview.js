import {carrierPaymentReservations} from './carrierPaymentAuthorization.js'
import {createHash} from 'node:crypto'
import {readCarrierPayee} from './carrierPayee.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readModernTreasuryCarrierAccount} from './modernTreasuryCarrierPayments.js'
import {verifyModernTreasuryFundingAccount} from './modernTreasuryPayments.js'
import {quickbooksRequest} from './quickbooks.js'
import {resolveCarrierPremiumJournal} from './carrierPremiumDispatch.js'
import {carrierPremiumJournal} from './carrierPremiumJournal.js'
import {journalMatches} from './settlementJournal.js'
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})}
export async function carrierPaymentPreview(db,facility,row,check,input,{paymentFetcher=fetch,quickbooksFetcher=fetch,reservationIgnoreId=null}={}){
 if(!Number.isSafeInteger(input.amountCents)||input.amountCents<=0||input.amountCents>row.invoice.amountCents)fail('Choose a positive payment amount no greater than the invoice total.',400)
 const reservations=await carrierPaymentReservations(db,facility,row,reservationIgnoreId)
 if(input.amountCents>reservations.availableCents)fail('The proposed payment exceeds the unreserved invoice amount.')
 const date=input.paymentDate
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Choose a valid carrier payment date.',400)
 const authorizations=(await db.query('SELECT a.*,(SELECT result FROM payroll_carrier_premium_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1) AS observation FROM payroll_carrier_premium_authorization a WHERE a.invoice_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation c WHERE c.authorization_id=a.id)',[row.id])).rows
 if(authorizations.length!==1||authorizations[0].observation?.status!=='SYNCED')fail('Post and reconcile the invoice premium journal before reviewing its payment.')
 const a=authorizations[0]
 if((await db.query('SELECT r.id FROM payroll_carrier_reversal_authorization r WHERE r.premium_authorization_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_reversal_cancellation c WHERE c.authorization_id=r.id)',[a.id])).rows.length)fail('Resolve the premium reversal and corrected invoice before reviewing payment.')
 if(date<a.preview.payload.TxnDate)fail('The payment date cannot precede the posted premium accounting date.')
 const expected=carrierPremiumJournal(row.id,row.invoice,{expense:a.preview.accounts[0]?.id,carrier:a.preview.accounts[1]?.id,deductions:check.deductionAccountId})
 if(!journalMatches(a.preview.payload,expected))fail('The posted premium does not match the current invoice allocation.')
 const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
 if(!qbo||qbo.realm_id!==a.preview.realmId||qbo.environment!==a.preview.environment||qbo.realm_id!==check.realmId||qbo.environment!==check.environment)fail('Reconnect the invoice QuickBooks company before reviewing payment.')
 const request=path=>quickbooksRequest(db,qbo,path,{fetcher:quickbooksFetcher})
 const journal=await resolveCarrierPremiumJournal({id:a.id,payload:a.preview.payload},request)
 if(journal.status!=='SYNCED'||journal.journalId!==a.observation.journalId)fail('The posted premium journal changed or cannot be verified.')
 const liabilityId=a.preview.accounts[1].id,liability=(await request(`account/${liabilityId}`)).Account,preferences=(await request('preferences')).Preferences
 if(String(liability?.Id)!==liabilityId||liability.Active!==true||liability.AccountType!=='Other Current Liability'||typeof liability.Name!=='string'||!liability.Name.trim()||liability.CurrencyRef?.value&&liability.CurrencyRef.value!=='USD'||preferences?.CurrencyPrefs?.HomeCurrency?.value!=='USD')fail('Verify the active USD carrier liability account and company currency.')
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
 const p=(await db.query('SELECT id FROM payroll_carrier_payee WHERE facility_id=$1 AND carrier_key=$2 ORDER BY revision DESC LIMIT 1',[facility,row.carrier_key])).rows[0]
 if(!p)fail('Review and retain the carrier payment destination first.')
 const payee=await readCarrierPayee(db,facility,p.id),connectionId=(await db.query('SELECT id FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[facility])).rows[0]?.id
 if(Number(connectionId)!==Number(payee.connection_id))fail('The employer payment connection changed. Review the carrier destination again.')
 const configuration=await readPayrollPaymentConnection(db,facility,connectionId)
 if(configuration.mode!==(qbo.environment==='production'?'LIVE':'TEST'))fail('Carrier payment and QuickBooks environments must match.')
 const funding=await verifyModernTreasuryFundingAccount({...configuration,fetcher:paymentFetcher}),destination=await readModernTreasuryCarrierAccount({...configuration,fetcher:paymentFetcher},payee.destination.accountId)
 if(funding.status!=='VERIFIED'||destination.status!=='VERIFIED'||destination.account.fingerprint!==payee.destination.fingerprint)fail('Carrier destination or funding evidence changed or is unavailable. Recheck the destination before payment.')
 const generation=Number((await db.query('SELECT quickbooks_connection_generation FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]?.quickbooks_connection_generation)
 if(!Number.isSafeInteger(generation)||generation<0)fail('QuickBooks connection history could not be verified.')
 const basis={reservations,connectionGeneration:generation,invoiceId:row.id,invoiceRevision:row.revision,invoiceFingerprint:row.payload_fingerprint,sourceFingerprint:row.source_fingerprint,invoiceNumber:row.invoice.invoiceNumber,carrier:row.invoice.carrier,invoiceAmountCents:row.invoice.amountCents,amountCents:input.amountCents,paymentDate:date,premiumAuthorizationId:a.id,premiumFingerprint:a.fingerprint,premiumJournalId:journal.journalId,realmId:qbo.realm_id,environment:qbo.environment,liabilityAccount:{id:liabilityId,name:liability.Name},payeeRevisionId:payee.id,payeeFingerprint:payee.fingerprint,fundingRevisionId:Number(connectionId),destination:payee.masked_destination}
 return {...basis,status:'PREVIEW_ONLY',fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex')}
}
