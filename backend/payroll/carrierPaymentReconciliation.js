import {isDeepStrictEqual} from 'node:util'
import {carrierSettlementMappingState} from './carrierSettlementMapping.js'

// A read-time assessment of retained evidence. It neither contacts providers nor
// asserts that the whole invoice is paid: a payment may cover only part of it.
export async function carrierPaymentReconciliation(db,facility,payment,application,receipt){
 const premium=(await db.query(`SELECT a.*,
  (SELECT result FROM payroll_carrier_premium_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1) AS result,
  EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation WHERE authorization_id=a.id) AS cancelled,
  EXISTS(SELECT 1 FROM payroll_carrier_reversal_authorization r WHERE r.premium_authorization_id=a.id AND NOT EXISTS(SELECT 1 FROM payroll_carrier_reversal_cancellation c WHERE c.authorization_id=r.id)) AS reversing
  FROM payroll_carrier_premium_authorization a WHERE a.id=$1 AND a.invoice_id=$2`,[payment.premium_authorization_id,payment.invoice_id])).rows[0]
 const authorizations=(await db.query(`SELECT a.* FROM payroll_carrier_settlement_authorization a WHERE payment_authorization_id=$1
  AND NOT EXISTS(SELECT 1 FROM payroll_carrier_settlement_cancellation c WHERE c.authorization_id=a.id)`,[payment.id])).rows
 const settlement=authorizations.length===1?authorizations[0]:null
 const mapping=await carrierSettlementMappingState(db,facility)
 const company=mapping.connection
 const companyMatches=!!company&&company.realmId===payment.preview.realmId&&company.environment===payment.preview.environment&&!!settlement&&Number(settlement.preview.connectionGeneration)===company.generation&&mapping.history.some(m=>m.id===Number(settlement.mapping_id)&&m.status==='CURRENT')
 const premiumMatches=!!premium&&!premium.cancelled&&!premium.reversing&&premium.fingerprint===payment.preview.premiumFingerprint&&premium.result?.status==='SYNCED'&&premium.result.journalId===payment.preview.premiumJournalId
 let journalsMatch=false
 if(settlement){
  const jobs=(await db.query(`SELECT j.*,(SELECT result FROM payroll_carrier_settlement_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS result
   FROM payroll_carrier_settlement_journal j WHERE authorization_id=$1`,[settlement.id])).rows
  const expected=settlement.preview.journals||[],withdrawals=receipt?.bankWithdrawals||[]
  journalsMatch=expected.length>0&&expected.length===jobs.length&&expected.length===withdrawals.length&&
   settlement.preview.premiumAuthorizationId===payment.premium_authorization_id&&settlement.preview.premiumJournalId===payment.preview.premiumJournalId&&
   Number(settlement.preview.amountCents)===Number(payment.amount_cents)&&
   new Set(expected.map(j=>j.event.transactionId)).size===expected.length&&expected.every(j=>{
    const withdrawal=withdrawals.find(w=>w.transactionId===j.event.transactionId)
    const job=jobs.find(row=>row.event_key===j.event.key)
    return withdrawal?.postedDate===j.event.postedDate&&withdrawal?.amountCents===j.event.amountCents&&!!job&&
     job.realm_id===company?.realmId&&job.environment===company?.environment&&isDeepStrictEqual(job.payload,j.payload)&&job.result?.status==='SYNCED'&&!!job.result.journalId
   })
 }
 const checks=[
  {key:'bank',complete:receipt?.status==='BANK_CONFIRMED',message:'Recover matching bank settlement evidence.'},
  {key:'application',complete:application.status==='FULLY_APPLIED',message:'Retain a current carrier review applying this entire payment to the invoice.'},
  {key:'premium',complete:premiumMatches,message:'Recover the matching premium journal and resolve any reversal.'},
  {key:'company',complete:companyMatches,message:'Reconcile settlement accounting with the current QuickBooks connection.'},
  {key:'settlement',complete:journalsMatch,message:'Post or recover matching settlement journals for every bank withdrawal.'}
 ]
 return {status:checks.every(c=>c.complete)?'RECONCILED':'OPEN',checks,scope:'PAYMENT',evidence:'LATEST_RETAINED',references:{premiumAuthorizationId:premium?.id||null,premiumJournalId:premium?.result?.journalId||null,settlementAuthorizationId:settlement?.id||null,mappingId:settlement?.mapping_id||null,company},bankObservedAt:receipt?.observedAt||null}
}
