import {quickbooksRequest,journalPayload,verifyBenefitPosting} from './quickbooks.js'
import {journalMatches} from './settlementJournal.js'
const fail=message=>{throw Object.assign(new Error(message),{status:409})}
export async function carrierAccountingCheck(db,facility,invoice,{fetcher=fetch}={}){
 const allocation=invoice.allocation
 if(!allocation||allocation.version!==2)fail('Retain the current invoice allocation and matched employee contributions first.')
 const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
 if(!qbo)fail('Connect the QuickBooks company before checking invoice accounting.')
 const id=String(qbo.account_ids?.deductions||'')
 if(allocation.employeeContributionCents>0&&!/^\d+$/.test(id))fail('Map the payroll deduction liability account in QuickBooks.')
 const request=path=>quickbooksRequest(db,qbo,path,{fetcher}),journals=[]
 if(allocation.employeeContributionCents>0){
  const result=await request(`account/${id}`),account=result.Account,preferences=(await request('preferences')).Preferences
  if(String(account?.Id)!==id||account.Active!==true||account.AccountType!=='Other Current Liability'||account.CurrencyRef?.value&&account.CurrencyRef.value!=='USD'||preferences?.CurrencyPrefs?.HomeCurrency?.value!=='USD')fail('Employee contributions require an active USD Other Current Liability account and a USD company.')
  for(const runId of new Set(allocation.contributions.map(c=>c.runId))){
   const run=(await db.query('SELECT r.*,COALESCE(r.payment_date,p.pay_date) AS pay_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND r.id=$2',[facility,runId])).rows[0]
   if(!run||run.status!=='FINALIZED')fail('A matched source payroll is no longer finalized.')
   await verifyBenefitPosting(db,run)
   const job=(await db.query("SELECT * FROM payroll_quickbooks_sync WHERE facility_id=$1 AND payroll_run_id=$2 AND realm_id=$3 AND environment=$4 AND status='SYNCED'",[facility,runId,qbo.realm_id,qbo.environment])).rows[0]
   if(!job||!/^\d+$/.test(String(job.external_id||''))||!journalMatches(job.payload,journalPayload(run,qbo.account_ids)))fail('Sync and reconcile each matched payroll journal in the current QuickBooks company before applying its deductions.')
   const actual=(await request(`journalentry/${job.external_id}`)).JournalEntry
   if(String(actual?.Id)!==String(job.external_id)||!journalMatches(actual,job.payload))fail('A QuickBooks source payroll journal changed or could not be reconciled. Review it before applying its deductions.')
   journals.push({runId:Number(runId),journalId:String(job.external_id)})
  }
 }
 return {status:'SOURCE_PAYROLL_VERIFIED',realmId:qbo.realm_id,environment:qbo.environment,deductionAccountId:allocation.employeeContributionCents?id:null,employeeContributionCents:allocation.employeeContributionCents,journals,checkedAt:new Date().toISOString(),premiumJournalStatus:'NOT_POSTED'}
}
