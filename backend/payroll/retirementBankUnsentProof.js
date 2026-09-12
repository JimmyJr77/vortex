import {createHash} from 'node:crypto'
export async function retirementBankUnsentProof(db,facility,id){
 const claim=(await db.query('SELECT c.id FROM payroll_retirement_remittance_claim c JOIN payroll_retirement_remittance_authorization a ON a.id=c.authorization_id WHERE a.facility_id=$1 AND a.id=$2',[facility,id])).rows[0]
 const observations=(await db.query('SELECT o.id,o.source,o.result FROM payroll_retirement_remittance_observation o JOIN payroll_retirement_remittance_authorization a ON a.id=o.authorization_id WHERE a.facility_id=$1 AND a.id=$2 ORDER BY o.id',[facility,id])).rows
 const files=(await db.query('SELECT d.id,c.id AS claim_id,r.id AS release_id FROM payroll_retirement_allocation_authorization d LEFT JOIN payroll_retirement_allocation_claim c ON c.authorization_id=d.id LEFT JOIN payroll_retirement_allocation_unsent_release r ON r.authorization_id=d.id WHERE d.facility_id=$1 AND d.remittance_id=$2 ORDER BY d.id',[facility,id])).rows
 const submissions=observations.filter(o=>o.source==='SUBMISSION'),submission=submissions[0],reasons=[]
 if(!claim)reasons.push('No retained bank claim exists.')
 if(submissions.length!==1||submission?.result?.noSendProof!==true||submission?.result?.submissionAttempted!==false||!['UNCERTAIN','BLOCKED_ACCOUNT_LOOKUP','BLOCKED_ACCOUNT_VERIFICATION','BLOCKED_CUTOFF'].includes(submission?.result?.status))reasons.push('The original bank submission lacks explicit retained proof that no payment creation was attempted.')
 if(observations.some(o=>o.result?.submissionAttempted===true||o.result?.providerId||o.result?.reused===true||!['UNCERTAIN','BLOCKED_ACCOUNT_LOOKUP','BLOCKED_ACCOUNT_VERIFICATION','BLOCKED_CUTOFF','NOT_FOUND','RECOVERY_UNAVAILABLE'].includes(o.result?.status)))reasons.push('Retained bank observations show payment activity or conflicting evidence requiring reconciliation.')
 if(files.some(f=>f.claim_id&&!f.release_id))reasons.push('An allocation file has an unresolved claim. Reconcile its delivery before releasing the contribution reservation.')
 const snapshot={version:1,authorizationId:id,claimId:claim?.id||null,observations:observations.map(o=>({id:String(o.id),source:o.source,result:o.result})),files}
 return {eligible:reasons.length===0,reasons,snapshot,submissionId:submission?.id||null,fingerprint:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')}
}
