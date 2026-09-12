import {createHash} from 'node:crypto'
import {quickbooksRequest} from './quickbooks.js'
import {resolveCarrierPremiumJournal} from './carrierPremiumDispatch.js'
import {carrierAccountingPeriod} from './carrierAccountingPeriod.js'
import {journalMatches} from './settlementJournal.js'
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})}
export function carrierPremiumReversalPayload(authorizationId,original,reversalDate){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(authorizationId)||!/^VTXC-[A-Za-z0-9_-]{16}$/.test(original?.DocNumber)||!journalMatches(original,original))fail('The retained original premium journal could not be verified.')
 carrierAccountingPeriod({AccountingInfoPrefs:{}},reversalDate)
 if(reversalDate<original.TxnDate)fail('The reversal date cannot precede the original premium journal.')
 return {TxnDate:reversalDate,DocNumber:`VTXR-${createHash('sha256').update(authorizationId).digest('base64url').slice(0,16)}`,PrivateNote:`Vortex premium reversal ${authorizationId}`,CurrencyRef:{value:'USD'},Line:original.Line.map(line=>({Amount:line.Amount,Description:`Reversal: ${line.Description||'Carrier premium'}`,DetailType:'JournalEntryLineDetail',JournalEntryLineDetail:{PostingType:line.JournalEntryLineDetail.PostingType==='Debit'?'Credit':'Debit',AccountRef:{value:line.JournalEntryLineDetail.AccountRef.value}}}))}
}
export async function carrierPremiumReversalPreview(db,facility,id,reversalDate,{fetcher=fetch}={}){
 if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))fail('Choose a retained premium authorization.',400)
 const a=(await db.query('SELECT a.*,c.authorization_id AS cancelled,(SELECT result FROM payroll_carrier_premium_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1) AS observation FROM payroll_carrier_premium_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id LEFT JOIN payroll_carrier_premium_cancellation c ON c.authorization_id=a.id WHERE a.id=$1 AND i.facility_id=$2',[id,facility])).rows[0]
 if(!a)fail('Premium authorization was not found.',404)
 if((await db.query('SELECT p.id FROM payroll_carrier_payment_authorization p WHERE p.premium_authorization_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation c WHERE c.authorization_id=p.id)',[a.id])).rows.length)fail('Resolve active carrier payment authorizations before reversing the premium journal.')
 if(a.cancelled||a.observation?.status!=='SYNCED')fail('Recover the original premium journal before preparing its reversal.')
 const payload=carrierPremiumReversalPayload(a.id,a.preview.payload,reversalDate)
 const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
 if(!qbo||qbo.realm_id!==a.preview.realmId||qbo.environment!==a.preview.environment)fail('Reconnect the original QuickBooks company and environment before preparing the reversal.')
 const request=(path,options)=>quickbooksRequest(db,qbo,path,{...options,fetcher})
 const original=await resolveCarrierPremiumJournal({id:a.id,payload:a.preview.payload},request)
 if(original.status!=='SYNCED'||original.journalId!==a.observation.journalId)fail('The original QuickBooks journal changed or cannot be verified. Recover and review it before reversal.')
 const accounts=[]
 for(const line of payload.Line){
  const id=line.JournalEntryLineDetail.AccountRef.value
  if(accounts.some(account=>account.id===id))continue
  const expected=a.preview.accounts.find(account=>account.id===id)?.type||'Other Current Liability'
  const account=(await request(`account/${id}`)).Account
  if(String(account?.Id)!==id||account.Active!==true||!['Expense','Other Current Liability'].includes(expected)||account.AccountType!==expected||typeof account.Name!=='string'||!account.Name.trim()||account.CurrencyRef?.value&&account.CurrencyRef.value!=='USD')fail('The original premium accounts must remain active with their verified types and USD currency.')
  accounts.push({id,name:account.Name,type:account.AccountType})
 }
 const preferences=(await request('preferences')).Preferences
 if(preferences?.CurrencyPrefs?.HomeCurrency?.value!=='USD')fail('Premium reversal requires a verified USD home currency.')
 const period=carrierAccountingPeriod(preferences,reversalDate)
 const generation=Number((await db.query('SELECT quickbooks_connection_generation FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]?.quickbooks_connection_generation)
 if(!Number.isSafeInteger(generation)||generation<0)fail('QuickBooks connection history could not be verified.')
 const basis={authorizationId:a.id,invoiceId:a.invoice_id,originalFingerprint:a.fingerprint,originalJournalId:original.journalId,realmId:qbo.realm_id,environment:qbo.environment,connectionGeneration:generation,accounts,period,payload}
 return {...basis,status:'PREVIEW_ONLY',fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex')}
}
