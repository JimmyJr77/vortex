import {createHash} from 'node:crypto'
export async function retirementAllocationUnsentProof(db,facility,id){
 const claim=(await db.query('SELECT c.id FROM payroll_retirement_allocation_claim c JOIN payroll_retirement_allocation_authorization a ON a.id=c.authorization_id WHERE a.facility_id=$1 AND a.id=$2',[facility,id])).rows[0]
 const observations=(await db.query('SELECT o.id,o.source,o.result FROM payroll_retirement_allocation_observation o JOIN payroll_retirement_allocation_authorization a ON a.id=o.authorization_id WHERE a.facility_id=$1 AND a.id=$2 ORDER BY o.id',[facility,id])).rows
 const receipts=(await db.query('SELECT id,transport_status FROM payroll_retirement_receipt_observation WHERE facility_id=$1 AND allocation_id=$2 ORDER BY sequence',[facility,id])).rows
 const submissions=observations.filter(o=>o.source==='SUBMISSION'),submission=submissions[0],reasons=[]
 if(!claim)reasons.push('No retained file claim exists.')
 if(submissions.length!==1||submission?.result?.noWriteProof!==true||submission?.result?.writeAttempted!==false||submission?.result?.promotionAttempted!==false||!['CLAIM_NOT_CONFIRMED','TRANSPORT_UNCERTAIN'].includes(submission?.result?.status))reasons.push('The original submission has no explicit retained proof that all remote writes were prevented.')
 if(observations.some(o=>o.result?.writeAttempted===true||o.result?.promotionAttempted===true||!['CLAIM_NOT_CONFIRMED','TRANSPORT_UNCERTAIN','RECOVERY_UNAVAILABLE','REMOTE_FILE_NOT_FOUND'].includes(o.result?.status)))reasons.push('Retained observations show remote activity or conflicting evidence requiring reconciliation.')
 if(receipts.some(r=>r.transport_status==='READ'))reasons.push('A provider receipt was retrieved for this allocation. Reconcile its outside activity before any non-send release.')
 const snapshot={receipts,version:1,authorizationId:id,claimId:claim?.id||null,observations:observations.map(o=>({id:String(o.id),source:o.source,result:o.result}))}
 return {eligible:reasons.length===0,reasons,snapshot,submissionId:submission?.id||null,fingerprint:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')}
}
