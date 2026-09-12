import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {prepareRetirementSettlement} from './retirementSettlementPreview.js'
import {retirementSettlementMappingState} from './retirementSettlementMapping.js'
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const comparable=preview=>{const {fingerprint,status,...basis}=preview;return {...basis,journals:basis.journals.map(({period,...journal})=>journal)}}
export async function retirementAccountingDependency(db,facility,a){
 const state=await retirementSettlementMappingState(db,facility,a.preview.planId),source=(await db.query('SELECT status,external_id,payload FROM payroll_quickbooks_sync WHERE id=$1 AND facility_id=$2',[a.preview.sourceSyncId,facility])).rows[0],bank=(await db.query('SELECT result FROM payroll_retirement_remittance_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1',[a.payment_authorization_id])).rows[0]
 return digest({authorizationId:a.id,fingerprint:a.fingerprint,connection:state.connection,mapping:state.history.find(m=>m.id===Number(a.mapping_id))||null,source:source||null,bank:bank?.result||null})
}
export async function verifyRetirementAccountingEvidence(db,facility,a,options){
 // Book closure after a valid posting does not invalidate that historical entry.
 // Verify actual journals separately; only first-create checks require open books.
 const current=await prepareRetirementSettlement(db,facility,a.payment_authorization_id,{...options,postedReview:true})
 if(!isDeepStrictEqual(comparable(current),comparable(a.preview)))throw new Error('Original payroll, bank or mapping evidence changed.')
 return retirementAccountingDependency(db,facility,a)
}
export async function retirementAccountingStatus(db,facility,paymentId,{now=new Date()}={}){
 const approvals=(await db.query('SELECT * FROM payroll_retirement_settlement_authorization a WHERE payment_authorization_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_settlement_cancellation c WHERE c.authorization_id=a.id)',[paymentId])).rows
 if(approvals.length!==1)return 'REQUIRED'
 const a=approvals[0],dependency=await retirementAccountingDependency(db,facility,a),jobs=(await db.query('SELECT j.payload,j.event_key,(SELECT result FROM payroll_retirement_settlement_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) result,(SELECT created_at FROM payroll_retirement_settlement_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) checked_at FROM payroll_retirement_settlement_journal j WHERE authorization_id=$1 AND facility_id=$2',[a.id,facility])).rows
 if(jobs.length!==a.preview.journals.length||!jobs.length)return 'REQUIRED'
 return jobs.every(j=>j.result?.status==='SYNCED'&&j.result.accountingEvidence===dependency&&+new Date(now)-+new Date(j.checked_at)<=86400000&&a.preview.journals.some(p=>p.event.key===j.event_key&&isDeepStrictEqual(p.payload,j.payload)))?'MATCHED':'REVIEW_REQUIRED'
}
