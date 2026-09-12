import {journalEntries,journalPayload,verifyBenefitPosting,quickbooksRequest} from './quickbooks.js'
import {verifyRetirementPosting} from './retirementJournal.js'
import {journalMatches} from './settlementJournal.js'
const fail=message=>Object.assign(new Error(message),{status:409})
// Recover original accounts from the retained payload, then reconstruct every
// payroll line from finalized source evidence. Current account choices must not
// silently reinterpret the liability booked by an earlier payroll journal.
export function retirementSourceJournal(run,job,planId){
 if(!run||run.status!=='FINALIZED'||job?.status!=='SYNCED'||!/^[1-9]\d*$/.test(String(job.external_id||''))||String(job.payroll_run_id)!==String(run.id))throw fail('Retain the synced original payroll journal before retirement settlement.')
 const entries=journalEntries(run),lines=job.payload?.Line
 if(!Array.isArray(lines)||lines.length!==entries.length)throw fail('Original payroll journal lines require reconciliation.')
 const accounts={};let amountCents=0
 entries.forEach(([key,amount,posting,description],index)=>{
  const line=lines[index],account=line?.JournalEntryLineDetail?.AccountRef?.value
  if(typeof account!=='string'||!/^\d+$/.test(account)||accounts[key]&&accounts[key]!==account)throw fail('Original payroll journal account allocation requires reconciliation.')
  accounts[key]=account
  if(key==='retirement'&&description.startsWith(`401(k) ${planId}: `))amountCents+=amount
 })
 const payload=journalPayload(run,accounts)
 if(!journalMatches(job.payload,payload)||!Number.isSafeInteger(amountCents)||amountCents<=0||!accounts.retirement)throw fail('Original retirement liability does not match finalized payroll.')
 return {payload,liabilityAccountId:accounts.retirement,amountCents}
}
export async function verifyRetirementSettlementSource(db,facility,runId,planId,connection,{fetcher=fetch}={}){
 if(String(connection?.facility_id)!==String(facility))throw fail('Use the employer accounting connection.')
 const run=(await db.query('SELECT r.*,COALESCE(r.payment_date,p.pay_date) AS pay_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.id=$1 AND r.facility_id=$2',[runId,facility])).rows[0]
 if(!run)throw fail('Original payroll was not found.')
 await verifyRetirementPosting(db,run);await verifyBenefitPosting(db,run)
 const job=(await db.query('SELECT * FROM payroll_quickbooks_sync WHERE facility_id=$1 AND payroll_run_id=$2 AND realm_id=$3 AND environment=$4',[facility,runId,connection.realm_id,connection.environment])).rows[0]
 const source=retirementSourceJournal(run,job,planId),actual=(await quickbooksRequest(db,connection,`journalentry/${job.external_id}`,{fetcher})).JournalEntry
 if(String(actual?.Id)!==String(job.external_id)||!journalMatches(actual,source.payload))throw fail('The actual original payroll journal changed or could not be verified.')
 return {...source,syncId:String(job.id),journalId:String(job.external_id),runId:String(run.id),payrollDate:source.payload.TxnDate}
}
