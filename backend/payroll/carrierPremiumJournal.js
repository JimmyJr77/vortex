import {carrierAccountingPeriod} from './carrierAccountingPeriod.js'
import {createHash} from 'node:crypto'
import {quickbooksRequest} from './quickbooks.js'
const fail=message=>{throw Object.assign(new Error(message),{status:409})}
export function carrierPremiumJournal(invoiceId,invoice,accounts){
 const a=invoice.allocation
 if(!a||![invoice.amountCents,a.employerExpenseCents,a.employeeContributionCents].every(n=>Number.isSafeInteger(n)&&n>=0)||invoice.amountCents<=0||a.employerExpenseCents+a.employeeContributionCents!==invoice.amountCents)fail('Reconcile the retained invoice allocation before preparing a premium journal.')
 if(typeof invoice.invoiceDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(invoice.invoiceDate)||!Number.isFinite(Date.parse(invoice.invoiceDate))||new Date(invoice.invoiceDate).toISOString().slice(0,10)!==invoice.invoiceDate)fail('The invoice needs a valid accounting date.')
 const accountingDate=invoice.accountingDate||invoice.invoiceDate
 if(typeof accountingDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(accountingDate)||!Number.isFinite(Date.parse(accountingDate))||new Date(accountingDate).toISOString().slice(0,10)!==accountingDate)fail('The invoice needs a valid premium accounting date.')
 const selected=[accounts.expense,accounts.carrier,...(a.employeeContributionCents?[accounts.deductions]:[])]
 if(selected.some(id=>typeof id!=='string'||!/^\d+$/.test(id))||new Set(selected).size!==selected.length)fail('Choose distinct expense, carrier liability and payroll deduction liability accounts.')
 return {TxnDate:accountingDate,DocNumber:`VTXC-${createHash('sha256').update(invoiceId).digest('base64url').slice(0,16)}`,PrivateNote:`Vortex carrier invoice ${invoiceId}`,CurrencyRef:{value:'USD'},Line:[['Debit',accounts.expense,a.employerExpenseCents,'Employer premium expense'],['Debit',accounts.deductions,a.employeeContributionCents,'Employee contributions applied'],['Credit',accounts.carrier,invoice.amountCents,'Carrier premium liability']].filter(([, ,cents])=>cents>0).map(([posting,id,cents,description])=>({Amount:cents/100,Description:description,DetailType:'JournalEntryLineDetail',JournalEntryLineDetail:{PostingType:posting,AccountRef:{value:id}}}))}
}
export async function carrierPremiumPreview(db,facility,row,check,input,{fetcher=fetch}={}){
 if(![input.expenseAccountId,input.carrierAccountId].every(id=>typeof id==='string'&&/^\d+$/.test(id)))fail('Choose the QuickBooks expense and carrier liability account IDs.')
 const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
 if(!qbo||qbo.realm_id!==check.realmId||qbo.environment!==check.environment)fail('The QuickBooks company changed. Check the invoice again.')
 const request=path=>quickbooksRequest(db,qbo,path,{fetcher}),accounts=[]
 for(const [id,type] of [[input.expenseAccountId,'Expense'],[input.carrierAccountId,'Other Current Liability']]){
  const account=(await request(`account/${id}`)).Account
  if(String(account?.Id)!==id||account.Active!==true||account.AccountType!==type||typeof account.Name!=='string'||!account.Name.trim()||account.CurrencyRef?.value&&account.CurrencyRef.value!=='USD')fail('Choose active USD Expense and Other Current Liability accounts for carrier premiums.')
  accounts.push({id,name:account.Name,type})
 }
 const preferences=(await request('preferences')).Preferences
 if(preferences?.CurrencyPrefs?.HomeCurrency?.value!=='USD')fail('Premium accounting requires a verified USD home currency.')
 const period=carrierAccountingPeriod(preferences,row.invoice.accountingDate||row.invoice.invoiceDate)
 const generation=Number((await db.query('SELECT quickbooks_connection_generation FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]?.quickbooks_connection_generation)
 if(!Number.isSafeInteger(generation)||generation<0)fail('QuickBooks connection history could not be verified.')
 const payload=carrierPremiumJournal(row.id,row.invoice,{expense:input.expenseAccountId,carrier:input.carrierAccountId,deductions:check.deductionAccountId})
 const basis={period,connectionGeneration:generation,invoiceId:row.id,invoice:row.invoice,sourceFingerprint:row.source_fingerprint,realmId:check.realmId,environment:check.environment,accounts,journals:check.journals,payload}
 return {status:'PREVIEW_ONLY',period,connectionGeneration:generation,accounts,payload,fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex')}
}
