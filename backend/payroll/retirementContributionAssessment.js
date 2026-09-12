import {retirementReplacementAssessment} from './retirementReplacementAssessment.js'
import {retirementParticipantReversalEvidence} from './retirementParticipantReversalEvidence.js'
import {retirementRecordedReturn} from './retirementRecordedReturn.js'
import {retirementReturnBankEvidence,retirementReturnAccountingStatus} from './retirementReturnAccountingEvidence.js'
import {retirementAccountingStatus} from './retirementAccountingEvidence.js'
import {retirementRemittanceSources} from './retirementRemittanceSources.js'
import {retirementReceiptBindingState} from './retirementReceiptBinding.js'
import {retirementSettlementEvents} from './retirementSettlementEvents.js'
import {decryptDocument} from './onboarding.js'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const categories=['ordinaryPretaxCents','ordinaryRothCents','catchUpPretaxCents','catchUpRothCents','totalCents']
export async function retirementOriginalContributionAssessment(db,facility,id,{now=new Date()}={}){
 if(!uuid(id))throw fail('Choose a valid retirement contribution.',400)
 const a=(await db.query('SELECT a.*,EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation c WHERE c.authorization_id=a.id) cancelled FROM payroll_retirement_remittance_authorization a WHERE a.id=$1 AND a.facility_id=$2',[id,facility])).rows[0]
 if(!a)throw fail('Retirement contribution not found.',404)
 const issues=[],data={authorizationId:id,runId:String(a.run_id),planId:a.plan_id,amountCents:Number(a.amount_cents),status:'REVIEW_REQUIRED',payrollStatus:'REVIEW_REQUIRED',bankStatus:'UNVERIFIED',receiptStatus:'UNVERIFIED',accountingStatus:'REQUIRED',returnAccountingStatus:'NOT_REQUIRED',returnReviewRequired:false,reversedAllocationCents:null,replacementReviewStatus:'NOT_APPLICABLE',bankCheckedAt:null,receiptCheckedAt:null,postedCents:null,issues}
 if(a.cancelled){data.status='CANCELLED';issues.push('The contribution authorization was cancelled.');return data}
 try{
  const source=(await retirementRemittanceSources(db,facility,{runId:a.run_id,now})).items[0],current=source?.allocations.filter(p=>p.planId===a.plan_id),original=a.basis.allocations
  if(!current?.length||current.length!==original.length||current.reduce((n,p)=>n+p.totalCents,0)!==Number(a.amount_cents)||current.some(p=>{const matches=original.filter(o=>String(o.employeeId)===String(p.employeeId));return matches.length!==1||categories.some(k=>matches[0][k]!==p[k])}))throw fail('Changed payroll')
  data.payrollStatus='MATCHED'
 }catch{issues.push('Reconcile the authorized participant deductions with finalized payroll.')}
 try{
  const claim=(await db.query('SELECT encrypted_instruction FROM payroll_retirement_remittance_claim WHERE authorization_id=$1',[id])).rows[0],observation=(await db.query('SELECT result,created_at FROM payroll_retirement_remittance_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1',[id])).rows[0]
  if(!claim||!observation)throw fail('Missing bank evidence')
  data.bankCheckedAt=new Date(observation.created_at).toISOString()
  if(+new Date(now)-+new Date(observation.created_at)>86400000)throw fail('Stale bank evidence')
  const intent=JSON.parse(decryptDocument(claim.encrypted_instruction,`payroll-retirement-instruction:${facility}:${id}`).toString())
  if(intent.id!==id||String(intent.facilityId)!==String(facility)||String(intent.runId)!==String(a.run_id)||intent.planId!==a.plan_id||intent.amountCents!==Number(a.amount_cents)||intent.destinationId!==a.destination_id||intent.fundingRevisionId!==Number(a.basis.fundingRevisionId)||intent.paymentDate!==a.basis.timing.depositDate)throw fail('Changed bank instruction')
  retirementSettlementEvents(intent,observation.result);data.bankStatus='BANK_POSTED'
 }catch{
  try{const returned=await retirementReturnBankEvidence(db,facility,id,{now});data.bankStatus='RETURN_CREDIT_POSTED';data.bankCheckedAt=returned.checkedAt;issues.push('The contribution funds returned to the employer. Reconcile participant allocations and authorize any replacement before closing this contribution.')}
  catch{issues.push('Recover and reconcile the exact bank withdrawal; pending, returned, missing or stale evidence cannot establish settlement.')}
 }
 try{
  const files=(await db.query('SELECT id FROM payroll_retirement_allocation_authorization a WHERE remittance_id=$1 AND facility_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation c WHERE c.authorization_id=a.id)',[id,facility])).rows
  if(files.length!==1)throw fail('Missing or ambiguous allocation')
  const file=files[0],binding=await retirementReceiptBindingState(db,facility,id,file.id),o=(await db.query('SELECT id,binding_id,decision,encrypted_result,created_at FROM payroll_retirement_receipt_observation WHERE facility_id=$1 AND allocation_id=$2 ORDER BY sequence DESC LIMIT 1',[facility,file.id])).rows[0]
  if(!o)throw fail('Missing receipt')
  data.receiptCheckedAt=new Date(o.created_at).toISOString()
  if(binding.status!=='BOUND'||binding.history[0]?.id!==o.binding_id||o.decision!=='RECONCILED'||+new Date(now)-+new Date(o.created_at)>86400000)throw fail('Receipt needs current review')
  const result=JSON.parse(decryptDocument(o.encrypted_result,`payroll-retirement-receipt:${facility}:${o.id}:result`).toString())
  if(['REVERSED','PARTIALLY_REVERSED'].includes(result.status)){
   const contract=binding.contracts.find(c=>c.id===binding.history[0].contract_id)?.contract
   if(contract?.participantReversalConfirmed!==true)throw fail('Review reversal interpretation.')
   const bank=await retirementReturnBankEvidence(db,facility,id,{now}),reversal=retirementParticipantReversalEvidence(result,a.basis.allocations,bank)
   data.receiptStatus=reversal.status;data.reversedAllocationCents=reversal.reversedAllocationCents;data.postedCents=reversal.postedCents
   issues.push(reversal.status==='REVERSED'?'The recordkeeper confirmed full participant reversals. Review replacement instructions before funding the contribution again.':'Only part of the participant allocation is confirmed reversed. Reconcile every participant before reviewing replacement funding.')
  }else{
  if(result.status!=='POSTED'||result.postedCents!==Number(a.amount_cents)||result.participants.length!==a.basis.allocations.length||a.basis.allocations.some(p=>{const found=result.participants.filter(r=>String(r.employeeId)===String(p.employeeId));return found.length!==1||found[0].status!=='POSTED'||!found[0].fullyAccounted||found[0].authorizedCents!==p.totalCents||categories.some(k=>found[0].reported[k]!==p[k])}))throw fail('Participant amounts need reconciliation')
  data.receiptStatus='POSTED';data.postedCents=result.postedCents
  }
 }catch{issues.push('Obtain a current matching receipt for participant posting or reviewed reversals, with current supporting bank evidence.')}
 if(!issues.length)data.status='DELIVERY_EVIDENCE_MATCHED'
 try{data.accountingStatus=await retirementAccountingStatus(db,facility,id,{now})}catch{data.accountingStatus='REVIEW_REQUIRED'}
 if(data.accountingStatus==='MATCHED'&&!issues.length)data.status='RECONCILED'
 try{data.returnAccountingStatus=await retirementReturnAccountingStatus(db,facility,id,{now})}catch{data.returnAccountingStatus='REVIEW_REQUIRED'}
 if(data.bankStatus==='RETURN_CREDIT_POSTED'&&data.returnAccountingStatus==='MATCHED')data.accountingStatus='VERIFIED_WITH_RETURN'
 if(!['MATCHED','VERIFIED_WITH_RETURN'].includes(data.accountingStatus))issues.push('Retirement bank settlement accounting still requires a verified journal and reconciliation.')
 if(data.bankStatus==='RETURN_CREDIT_POSTED'&&data.returnAccountingStatus==='NOT_REQUIRED')data.returnAccountingStatus='REQUIRED'
 if(['REQUIRED','REVIEW_REQUIRED'].includes(data.returnAccountingStatus))issues.push('Return accounting requires a current matching journal and verified original bank and accounting evidence.')
 data.returnReviewRequired=await retirementRecordedReturn(db,facility,id)
 if(data.returnReviewRequired){issues.push('A recorded bank return or reversal requires participant reconciliation and a reviewed replacement decision; a later bank status or receipt alone cannot close it.');data.status='REVIEW_REQUIRED'}
 if(data.returnAccountingStatus!=='NOT_REQUIRED')data.status='REVIEW_REQUIRED'
 if(data.returnReviewRequired)data.replacementReviewStatus=data.payrollStatus==='MATCHED'&&data.bankStatus==='RETURN_CREDIT_POSTED'&&data.receiptStatus==='REVERSED'&&data.reversedAllocationCents===data.amountCents&&data.returnAccountingStatus==='MATCHED'?'EVIDENCE_READY':'EVIDENCE_REQUIRED'
 return data
}
// Keep original-return verification independent to avoid using a replacement
// resolution as evidence of its own original funding/reversal prerequisites.
export async function retirementContributionAssessment(db,facility,id,options={}){
 const original=await retirementOriginalContributionAssessment(db,facility,id,options)
 if(!original.returnReviewRequired)return original
 original.replacementCaseStatus='OPEN'
 const replacements=(await db.query('SELECT id FROM payroll_retirement_replacement_authorization r WHERE r.original_authorization_id=$1 AND r.facility_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_cancellation c WHERE c.authorization_id=r.id)',[id,facility])).rows
 if(replacements.length!==1)return original
 const replacement=await retirementReplacementAssessment(db,facility,replacements[0].id,options)
 original.replacementEvidence={authorizationId:replacement.authorizationId,originalAuthorizationId:id,status:replacement.status,originalEvidenceStatus:replacement.originalEvidenceStatus,bankStatus:replacement.bankStatus,receiptStatus:replacement.receiptStatus,deliveryStatus:replacement.deliveryStatus,accountingStatus:replacement.accountingStatus,caseStatus:replacement.caseStatus,returnReviewRequired:replacement.returnReviewRequired,amountCents:replacement.amountCents,postedCents:replacement.postedCents}
 if(original.replacementReviewStatus==='EVIDENCE_READY'&&replacement.caseStatus==='CLOSED'&&replacement.amountCents===original.amountCents){original.status='REPLACEMENT_RECONCILED';original.replacementCaseStatus='CLOSED';original.returnReviewRequired=false;original.issues=[]}
 return original
}
export function registerRetirementContributionAssessment(app,pool){
 app.get('/api/admin/payroll/retirement-remittance-authorizations/:id/assessment',async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await retirementContributionAssessment(db,req.canonicalAccess.facilityId,req.params.id);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to assess contribution evidence.'})}finally{db.release()}})
}
