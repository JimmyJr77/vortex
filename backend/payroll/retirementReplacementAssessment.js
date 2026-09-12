import {createHash} from 'node:crypto'
import {retirementContributionAssessment} from './retirementContributionAssessment.js'
import {retirementReplacementReceiptBindingState} from './retirementReplacementReceiptBinding.js'
import {retirementSettlementEvents} from './retirementSettlementEvents.js'
import {decryptDocument} from './onboarding.js'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const fresh=(at,now)=>Number.isFinite(+new Date(at))&&+new Date(now)>=+new Date(at)&&+new Date(now)-+new Date(at)<=86400000
const categories=['ordinaryPretaxCents','ordinaryRothCents','catchUpPretaxCents','catchUpRothCents','totalCents']
export async function retirementReplacementAssessment(db,facility,id,{now=new Date()}={}){
 if(!uuid(id))throw fail('Choose a valid replacement contribution.',400)
 const a=(await db.query('SELECT a.*,EXISTS(SELECT 1 FROM payroll_retirement_replacement_cancellation c WHERE c.authorization_id=a.id) AS cancelled FROM payroll_retirement_replacement_authorization a WHERE a.id=$1 AND a.facility_id=$2',[id,facility])).rows[0]
 if(!a)throw fail('Replacement contribution not found.',404)
 const p=a.preview,issues=[],data={authorizationId:id,originalAuthorizationId:a.original_authorization_id,amountCents:p.amountCents,status:'REVIEW_REQUIRED',originalEvidenceStatus:'REVIEW_REQUIRED',bankStatus:'UNVERIFIED',receiptStatus:'UNVERIFIED',deliveryStatus:'UNVERIFIED',accountingStatus:'REQUIRED',caseStatus:'OPEN',returnReviewRequired:false,bankCheckedAt:null,receiptCheckedAt:null,postedCents:null,issues}
 if(a.cancelled){data.status='CANCELLED';data.caseStatus='CANCELLED';return data}
 try{const original=await retirementContributionAssessment(db,facility,a.original_authorization_id,{now});if(original.replacementReviewStatus!=='EVIDENCE_READY'||original.amountCents!==p.amountCents)throw fail('Original evidence needs review');data.originalEvidenceStatus='MATCHED'}catch{issues.push('Reconcile the original deductions, full bank return, participant reversals and return accounting.')}
 data.returnReviewRequired=!!(await db.query("SELECT 1 FROM payroll_retirement_replacement_observation WHERE authorization_id=$1 AND kind='BANK' AND result->>'status' IN ('RETURNED','REVERSED') LIMIT 1",[id])).rowCount
 try{
  const claim=(await db.query("SELECT encrypted_instruction FROM payroll_retirement_replacement_claim WHERE authorization_id=$1 AND kind='BANK'",[id])).rows[0],observation=(await db.query("SELECT result,created_at FROM payroll_retirement_replacement_observation WHERE authorization_id=$1 AND kind='BANK' ORDER BY id DESC LIMIT 1",[id])).rows[0]
  if(!claim||!observation)throw fail('Missing replacement bank evidence')
  data.bankCheckedAt=new Date(observation.created_at).toISOString()
  if(!fresh(observation.created_at,now)||data.returnReviewRequired)throw fail('Replacement withdrawal needs current review')
  const intent=JSON.parse(decryptDocument(claim.encrypted_instruction,`payroll-retirement-replacement-bank:${facility}:${id}`).toString())
  if(intent.id!==id||intent.replacementAuthorizationId!==id||intent.originalAuthorizationId!==a.original_authorization_id||intent.returnAuthorizationId!==a.return_authorization_id||intent.facilityId!==Number(facility)||intent.runId!==Number(p.runId)||intent.planId!==p.planId||intent.amountCents!==p.amountCents||intent.destinationId!==p.allocation.destinationRevisionId||intent.fundingRevisionId!==Number(p.allocation.fundingRevisionId)||intent.paymentDate!==p.timing.depositDate||intent.submitBefore!==p.timing.submissionAt||intent.originalWithheldDate!==p.originalWithheldDate)throw fail('Changed replacement instruction')
  retirementSettlementEvents(intent,observation.result);data.bankStatus='BANK_POSTED'
 }catch{issues.push('Recover the exact replacement bank withdrawal; returned, missing, uncertain or stale evidence requires review.')}
 try{
  const binding=await retirementReplacementReceiptBindingState(db,facility,id),o=(await db.query('SELECT * FROM payroll_retirement_replacement_receipt_observation WHERE facility_id=$1 AND allocation_id=$2 ORDER BY sequence DESC LIMIT 1',[facility,id])).rows[0]
  if(!o)throw fail('Missing replacement receipt')
  data.receiptCheckedAt=new Date(o.created_at).toISOString()
  if(binding.status!=='BOUND'||binding.history[0]?.id!==o.binding_id||o.decision!=='RECONCILED'||!fresh(o.created_at,now))throw fail('Receipt needs current review')
  const result=JSON.parse(decryptDocument(o.encrypted_result,`payroll-retirement-replacement-receipt:${facility}:${o.id}:result`).toString()),receipt=decryptDocument(o.encrypted_receipt,`payroll-retirement-replacement-receipt:${facility}:${o.id}:file`),allocation=decryptDocument(a.encrypted_allocation,`payroll-retirement-replacement:${facility}:${id}`)
  if(result.sourceSha256!==hash(allocation)||result.receiptSha256!==hash(receipt)||result.status!=='POSTED'||result.authorizedCents!==p.amountCents||result.postedCents!==p.amountCents||!Array.isArray(result.participants)||result.participants.length!==p.allocation.allocations.length||p.allocation.allocations.some(original=>{const found=result.participants.filter(row=>String(row.employeeId)===String(original.employeeId));return found.length!==1||found[0].status!=='POSTED'||found[0].fullyAccounted!==true||found[0].authorizedCents!==original.totalCents||categories.some(k=>found[0].reported?.[k]!==original[k])}))throw fail('Replacement participant amounts do not match')
  data.receiptStatus='POSTED';data.postedCents=result.postedCents
 }catch{issues.push('Obtain a current receipt matching every replacement participant allocation.')}
 if(data.returnReviewRequired){data.postedCents=null;issues.push('A recorded replacement bank return requires a separate resolution; later ordinary observations cannot clear it.')}
 if(data.originalEvidenceStatus==='MATCHED'&&data.bankStatus==='BANK_POSTED'&&data.receiptStatus==='POSTED'&&!data.returnReviewRequired)data.deliveryStatus='MATCHED'
 issues.push('Replacement settlement accounting and original return-case closure still require reconciliation.')
 return data
}
export function registerRetirementReplacementAssessment(app,pool){
 app.get('/api/admin/payroll/retirement-replacement-authorizations/:id/assessment',async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await retirementReplacementAssessment(db,req.canonicalAccess.facilityId,req.params.id);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to assess replacement contribution evidence.'})}finally{db.release()}})
}
