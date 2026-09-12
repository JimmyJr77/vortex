import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {retirementAccountingDependency} from './retirementAccountingEvidence.js'
import {retirementReturnSettlementEvent} from './retirementReturnSettlement.js'
import {decryptDocument} from './onboarding.js'
// Retained evidence only. Provider verification belongs to posting/recovery.
export async function retirementReturnBankEvidence(db,facility,paymentId,{now=new Date()}={}){
 const a=(await db.query('SELECT a.*,c.encrypted_instruction FROM payroll_retirement_remittance_authorization a JOIN payroll_retirement_remittance_claim c ON c.authorization_id=a.id WHERE a.id=$1 AND a.facility_id=$2',[paymentId,facility])).rows[0]
 if(!a)throw new Error('Missing scoped return instruction.')
 const intent=JSON.parse(decryptDocument(a.encrypted_instruction,`payroll-retirement-instruction:${facility}:${paymentId}`).toString())
 if(intent.id!==paymentId||String(intent.facilityId)!==String(facility)||String(intent.runId)!==String(a.run_id)||intent.planId!==a.plan_id||intent.amountCents!==Number(a.amount_cents)||intent.destinationId!==a.destination_id||intent.fundingRevisionId!==Number(a.basis.fundingRevisionId)||intent.paymentDate!==a.basis.timing.depositDate)throw new Error('Changed return instruction.')
 const current=(await db.query('SELECT id,result,created_at FROM payroll_retirement_remittance_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1',[paymentId])).rows[0]
 const age=+new Date(now)-+new Date(current?.created_at)
 if(!Number.isFinite(age)||age<0||age>86400000)throw new Error('Return bank evidence needs a current check.')
 const withdrawal=(await db.query("SELECT result FROM payroll_retirement_remittance_observation WHERE authorization_id=$1 AND result->>'status'='COMPLETED' AND result->>'settlementStatus'='BANK_POSTED' ORDER BY id DESC LIMIT 1",[paymentId])).rows[0]
 return {event:retirementReturnSettlementEvent(intent,withdrawal?.result,current.result),checkedAt:new Date(current.created_at).toISOString(),observationId:String(current.id)}
}
export async function retirementReturnAccountingDependency(db,facility,a){
 const original=(await db.query('SELECT a.*,EXISTS(SELECT 1 FROM payroll_retirement_settlement_cancellation c WHERE c.authorization_id=a.id) AS cancelled FROM payroll_retirement_settlement_authorization a JOIN payroll_retirement_remittance_authorization p ON p.id=a.payment_authorization_id WHERE a.id=$1 AND p.facility_id=$2 AND a.payment_authorization_id=$3',[a.original_settlement_id,facility,a.payment_authorization_id])).rows[0]
 if(!original||original.cancelled)throw new Error('Original withdrawal approval needs reconciliation.')
 const dependency=await retirementAccountingDependency(db,facility,original)
 const journals=(await db.query('SELECT j.id,j.event_key,j.payload,(SELECT result FROM payroll_retirement_settlement_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS result FROM payroll_retirement_settlement_journal j WHERE authorization_id=$1 AND facility_id=$2 ORDER BY j.id',[original.id,facility])).rows
 return createHash('sha256').update(JSON.stringify({authorizationId:a.id,fingerprint:a.fingerprint,dependency,journals})).digest('hex')
}
export async function retirementReturnAccountingStatus(db,facility,paymentId,{now=new Date()}={}){
 const approvals=(await db.query('SELECT * FROM payroll_retirement_return_authorization a WHERE facility_id=$1 AND payment_authorization_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_return_cancellation c WHERE c.authorization_id=a.id)',[facility,paymentId])).rows
 if(!approvals.length)return 'NOT_REQUIRED'
 if(approvals.length!==1)return 'REVIEW_REQUIRED'
 const a=approvals[0],bank=await retirementReturnBankEvidence(db,facility,paymentId,{now}),dependency=await retirementReturnAccountingDependency(db,facility,a)
 const jobs=(await db.query('SELECT j.payload,j.event_key,(SELECT result FROM payroll_retirement_return_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS result,(SELECT created_at FROM payroll_retirement_return_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS checked_at FROM payroll_retirement_return_journal j WHERE authorization_id=$1 AND facility_id=$2',[a.id,facility])).rows
 if(!jobs.length)return 'REQUIRED'
 const j=jobs[0],age=+new Date(now)-+new Date(j.checked_at)
 return jobs.length===1&&isDeepStrictEqual(bank.event,a.preview.event)&&j.event_key===bank.event.key&&isDeepStrictEqual(j.payload,a.preview.payload)&&j.result?.status==='SYNCED'&&j.result.accountingVerified===true&&j.result.accountingEvidence===dependency&&Number.isFinite(age)&&age>=0&&age<=86400000?'MATCHED':'REVIEW_REQUIRED'
}
