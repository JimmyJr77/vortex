import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {retirementReturnAccountingDependency} from './retirementReturnAccountingEvidence.js'
import {retirementSettlementMappingState} from './retirementSettlementMapping.js'
export async function replacementSettlementDependency(db,facility,a){
 const replacement=(await db.query('SELECT * FROM payroll_retirement_replacement_authorization WHERE id=$1 AND facility_id=$2',[a.replacement_id,facility])).rows[0]
 const returned=(await db.query('SELECT * FROM payroll_retirement_return_authorization WHERE id=$1 AND facility_id=$2',[replacement.return_authorization_id,facility])).rows[0]
 const original=await retirementReturnAccountingDependency(db,facility,returned),mapping=await retirementSettlementMappingState(db,facility,a.preview.planId)
 const returnJobs=(await db.query('SELECT j.id,j.payload,(SELECT result FROM payroll_retirement_return_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS result FROM payroll_retirement_return_journal j WHERE authorization_id=$1 ORDER BY j.id',[returned.id])).rows
 const bank=(await db.query("SELECT result FROM payroll_retirement_replacement_observation WHERE authorization_id=$1 AND kind='BANK' ORDER BY id DESC LIMIT 1",[replacement.id])).rows[0]?.result
 return createHash('sha256').update(JSON.stringify({fingerprint:a.fingerprint,original,returnJobs,bank,connection:mapping.connection,mapping:mapping.history.find(m=>String(m.id)===String(a.mapping_id))})).digest('hex')
}
export async function replacementSettlementStatus(db,facility,id,{now=new Date()}={}){
 const approvals=(await db.query('SELECT * FROM payroll_retirement_replacement_settlement_authorization a WHERE facility_id=$1 AND replacement_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_cancellation c WHERE c.authorization_id=a.id)',[facility,id])).rows
 if(!approvals.length)return 'REQUIRED'
 if(approvals.length!==1)return 'REVIEW_REQUIRED'
 const a=approvals[0],dependency=await replacementSettlementDependency(db,facility,a),jobs=(await db.query('SELECT j.*,(SELECT result FROM payroll_retirement_replacement_settlement_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS result,(SELECT created_at FROM payroll_retirement_replacement_settlement_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS checked_at FROM payroll_retirement_replacement_settlement_journal j WHERE authorization_id=$1 AND facility_id=$2',[a.id,facility])).rows
 if(!jobs.length)return 'REQUIRED'
 if(jobs.length!==a.preview.journals.length)return 'REVIEW_REQUIRED'
 return jobs.every(j=>{const age=+new Date(now)-+new Date(j.checked_at);return j.result?.status==='SYNCED'&&j.result.accountingVerified===true&&j.result.accountingEvidence===dependency&&Number.isFinite(age)&&age>=0&&age<=86400000&&a.preview.journals.some(p=>p.event.key===j.event_key&&isDeepStrictEqual(p.payload,j.payload))})?'MATCHED':'REVIEW_REQUIRED'
}
