import {paymentAccountingEvidence} from './paymentAccounting.js'
const withoutObservation=({observationId,...event})=>event
// Follow the latest executed cycle. An unstarted/cancelled successor does not
// erase the bank return that still establishes the unpaid amount.
export async function replacementPredecessor(db,facility,instructionId){
 const latest=(await db.query(`SELECT a.* FROM payroll_payment_replacement_authorization a JOIN payroll_payment_replacement_attempt t ON t.authorization_id=a.id WHERE a.facility_id=$1 AND a.instruction_id=$2 ORDER BY a.created_at DESC,a.id DESC LIMIT 1`,[facility,instructionId])).rows[0]
 if(!latest)return {predecessor:null,issues:[]}
 const everReturned=(await db.query("SELECT 1 FROM payroll_payment_replacement_observation WHERE authorization_id=$1 AND result->>'status'='RETURNED' LIMIT 1",[latest.id])).rowCount
 const selected=everReturned?latest.id:latest.predecessor_id
 if(!selected)return {predecessor:null,issues:[]}
 const row=selected===latest.id?latest:(await db.query('SELECT * FROM payroll_payment_replacement_authorization WHERE id=$1 AND facility_id=$2 AND instruction_id=$3',[selected,facility,instructionId])).rows[0]
 if(!row)return {predecessor:null,issues:['The prior replacement chain needs reconciliation.']}
 const observations=(await db.query('SELECT id,source,result FROM payroll_payment_replacement_observation WHERE authorization_id=$1 ORDER BY id',[row.id])).rows
 const bank=paymentAccountingEvidence({id:row.id,amount_cents:row.amount_cents,originating_account_id:row.intent.originatingAccountId,mode:row.intent.mode},observations),last=observations.at(-1)?.result,returned=bank.events.find(e=>e.kind==='RETURN')
 const issues=[...bank.issues]
 if(last?.status!=='RETURNED'||last.returnEvidenceStatus!=='BANK_CREDIT_POSTED'||!returned)issues.push('Confirm the full posted return of the prior replacement before another payment.')
 return {predecessor:{id:row.id,paymentDate:row.intent.paymentDate,amountCents:Number(row.amount_cents),returnEvent:returned?withoutObservation(returned):null,returnCode:last?.returnEvidence?.code||null,bankEvidence:bank.events.map(withoutObservation)},issues}
}
