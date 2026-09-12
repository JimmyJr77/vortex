import {isDeepStrictEqual} from 'node:util'
import {retirementSettlementEvents} from './retirementSettlementEvents.js'
import {retirementSettlementJournalPayload} from './retirementSettlementJournal.js'
import {verifyRetirementSettlementSource} from './retirementSettlementSource.js'
import {quickbooksRequest} from './quickbooks.js'
import {journalMatches} from './settlementJournal.js'
const fail=()=>new Error('Verify the original payroll liability and every actual retirement withdrawal journal before return accounting.')
// Caller supplies scoped original instruction and verified withdrawal evidence
// under the employer lock. No journal is created or changed by this function.
export async function verifyRetirementReturnAccountingSource(db,facility,paymentId,intent,withdrawal,connection,{fetcher=fetch}={}){
 if(intent?.id!==paymentId||intent.facilityId!==Number(facility)||String(connection?.facility_id)!==String(facility))throw fail()
 const events=retirementSettlementEvents(intent,withdrawal)
 const approvals=(await db.query('SELECT a.* FROM payroll_retirement_settlement_authorization a JOIN payroll_retirement_remittance_authorization p ON p.id=a.payment_authorization_id WHERE a.payment_authorization_id=$1 AND p.facility_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_settlement_cancellation c WHERE c.authorization_id=a.id)',[paymentId,facility])).rows
 if(approvals.length!==1)throw fail()
 const a=approvals[0]
 if(a.preview.realmId!==connection.realm_id||a.preview.environment!==connection.environment||a.preview.planId!==intent.planId||String(a.preview.runId)!==String(intent.runId)||a.preview.amountCents!==intent.amountCents)throw fail()
 const mapping=(await db.query('SELECT * FROM payroll_retirement_settlement_mapping WHERE id=$1 AND facility_id=$2',[a.mapping_id,facility])).rows[0]
 if(!mapping||mapping.realm_id!==connection.realm_id||mapping.environment!==connection.environment)throw fail()
 const source=await verifyRetirementSettlementSource(db,facility,intent.runId,intent.planId,connection,{fetcher})
 if(source.amountCents!==intent.amountCents||source.syncId!==a.preview.sourceSyncId||source.journalId!==a.preview.sourceJournalId||source.liabilityAccountId!==mapping.details.liability.id||!isDeepStrictEqual(source.payload,a.preview.sourcePayload))throw fail()
 const jobs=(await db.query('SELECT j.*,(SELECT result FROM payroll_retirement_settlement_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS result FROM payroll_retirement_settlement_journal j WHERE authorization_id=$1 AND facility_id=$2 ORDER BY event_key',[a.id,facility])).rows
 if(jobs.length!==events.length||a.preview.journals.length!==events.length)throw fail()
 const verified=[]
 for(const event of events){
  const approved=a.preview.journals.filter(j=>j.event.key===event.key),matched=jobs.filter(j=>j.event_key===event.key)
  if(approved.length!==1||matched.length!==1||!isDeepStrictEqual(approved[0].event,event))throw fail()
  const job=matched[0],payload=retirementSettlementJournalPayload(event,mapping.details,{facilityId:Number(facility),realmId:connection.realm_id,environment:connection.environment})
  if(job.realm_id!==connection.realm_id||job.environment!==connection.environment||!isDeepStrictEqual(payload,approved[0].payload)||!isDeepStrictEqual(payload,job.payload)||job.result?.status!=='SYNCED'||!/^[1-9][0-9]*$/.test(String(job.result.journalId)))throw fail()
  const actual=(await quickbooksRequest(db,connection,`journalentry/${job.result.journalId}`,{fetcher})).JournalEntry
  if(String(actual?.Id)!==String(job.result.journalId)||!journalMatches(actual,payload))throw fail()
  verified.push({jobId:job.id,journalId:String(job.result.journalId),eventKey:event.key,payload})
 }
 return {authorizationId:a.id,paymentAuthorizationId:paymentId,mappingId:String(mapping.id),mapping:mapping.details,sourceSyncId:source.syncId,sourceJournalId:source.journalId,sourcePayload:source.payload,journals:verified}
}
