import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {retirementContributionAssessment} from './retirementContributionAssessment.js'
import {prepareRetirementReturn} from './retirementReturnPreview.js'
import {retirementRemittanceSources} from './retirementRemittanceSources.js'
import {retirementAllocationFile} from './retirementAllocationFile.js'
import {retirementReceiptBindingState} from './retirementReceiptBinding.js'
import {retirementTimingHistory,retirementTimingDates} from './retirementTiming.js'
import {retirementSftpHistory,readRetirementSftpConfiguration} from './retirementSftpSetup.js'
import {readRetirementSftpReceipt,transferRetirementAllocation} from './retirementSftpTransport.js'
import {decryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const comparable=p=>{const {fingerprint,status,period,...basis}=p;return basis}
export async function prepareRetirementReplacement(db,facility,id,input,{fetcher=fetch,paymentFetcher=fetch,reader=readRetirementSftpReceipt,transfer=transferRetirementAllocation,now=()=>new Date(),reservationId=null}={}){
 if(!input||['confirmed','newAllocationRequired','priorBatchReversedConfirmed','outsideActivityReviewed','lateCorrectionReviewed'].some(k=>input[k]!==true)||typeof input.reference!=='string'||input.reference.trim().length<20||input.reference.length>2000||/[\u0000-\u001f\u007f]/.test(input.reference)||typeof input.fileName!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}\.csv$/.test(input.fileName)||input.fileName.includes('..')||typeof input.depositDate!=='string'||!/^2026-\d{2}-\d{2}$/.test(input.depositDate))throw fail('Review the replacement deposit date, new allocation filename, provider instructions, prior reversal and late/outside activity.',400)
 const assessment=await retirementContributionAssessment(db,facility,id)
 if(assessment.replacementReviewStatus!=='EVIDENCE_READY')throw fail('Reconcile payroll, returned funds, every participant reversal and return accounting before replacement review.')
 const original=(await db.query('SELECT * FROM payroll_retirement_remittance_authorization WHERE id=$1 AND facility_id=$2',[id,facility])).rows[0]
 const approval=(await db.query('SELECT * FROM payroll_retirement_return_authorization a WHERE payment_authorization_id=$1 AND facility_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_return_cancellation c WHERE c.authorization_id=a.id)',[id,facility])).rows[0]
 const returned=await prepareRetirementReturn(db,facility,id,{fetcher,paymentFetcher,postedReview:true})
 if(!approval||!isDeepStrictEqual(comparable(returned),comparable(approval.preview)))throw fail('Original bank or accounting evidence changed. Recover the return review.')
 const files=(await db.query('SELECT id FROM payroll_retirement_allocation_authorization a WHERE remittance_id=$1 AND facility_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation c WHERE c.authorization_id=a.id)',[id,facility])).rows
 if(files.length!==1)throw fail('Reconcile the original allocation delivery.')
 const binding=await retirementReceiptBindingState(db,facility,id,files[0].id),location=binding.history[0],receipt=(await db.query('SELECT id,binding_id,encrypted_receipt FROM payroll_retirement_receipt_observation WHERE allocation_id=$1 AND facility_id=$2 ORDER BY sequence DESC LIMIT 1',[files[0].id,facility])).rows[0]
 if(binding.status!=='BOUND'||!receipt||receipt.binding_id!==location?.id)throw fail('Review the current original reversal receipt binding.')
 const oldConfig=(await readRetirementSftpConfiguration(db,facility,binding.source.configuration_id)).configuration,remote=await reader(oldConfig,{directory:location.directory,fileName:location.file_name})
 const bytes=decryptDocument(receipt.encrypted_receipt,`payroll-retirement-receipt:${facility}:${receipt.id}:file`)
 if(remote.status!=='READ'||!Buffer.isBuffer(remote.bytes)||!remote.bytes.equals(bytes))throw fail('The recordkeeper reversal receipt changed or is unavailable. Retrieve and reconcile it again.')
 const source=(await retirementRemittanceSources(db,facility,{runId:original.run_id,now:now()})).items[0]
 const file=await retirementAllocationFile(db,facility,original.run_id,{planId:original.plan_id,sourceFingerprint:source?.sourceFingerprint},{fetcher:paymentFetcher,now:now()})
 if(file.summary.amountCents!==Number(original.amount_cents))throw fail('Replacement allocations must match the original deductions.')
 const timingState=await retirementTimingHistory(db,facility,original.plan_id),timing=timingState.history.find(r=>r.policy.effectiveOn<=input.depositDate)
 if(!timing?.currentPlan||timing.policy.disposition!=='REVIEWED')throw fail('Review current replacement provider timing.')
 const dates=retirementTimingDates({...timing.policy,depositBusinessDays:0},input.depositDate,now())
 if(!dates.submissionAt||input.depositDate<returned.event.postedDate||new Date(dates.submissionAt)<=new Date(+now()+60000))throw fail('Choose a bank-business deposit date after returned funds, with enough time for the reviewed provider lead time and cutoff.')
 const delivery=await retirementSftpHistory(db,facility,original.plan_id),configuration=delivery.history[0]
 if(delivery.status!=='VERIFIED'||configuration.format_id!==file.summary.formatId||configuration.plan_revision_id!==file.summary.planRevisionId)throw fail('Review the current replacement allocation delivery configuration.')
 if((await db.query('SELECT id FROM payroll_retirement_allocation_authorization WHERE facility_id=$1 AND file_name=$2 UNION ALL SELECT id FROM payroll_retirement_replacement_authorization WHERE facility_id=$1 AND file_name=$2 AND ($3::uuid IS NULL OR id<>$3) LIMIT 1',[facility,input.fileName,reservationId])).rowCount)throw fail('Use a new allocation filename that has never been reserved for this employer.')
 const config=(await readRetirementSftpConfiguration(db,facility,configuration.id)).configuration
 const absent=await transfer(config,{name:input.fileName,bytes:Buffer.from(file.csv)},{mode:'VERIFY_ABSENCE'})
 if(absent.status!=='REMOTE_PATHS_ABSENT')throw fail('The replacement staging and delivery paths must both be absent.')
 if(new Date(dates.submissionAt)<=new Date(+now()+60000))throw fail('The replacement cutoff passed during verification. Review a later deposit date.')
 const summary={originalAuthorizationId:id,runId:String(original.run_id),planId:original.plan_id,amountCents:file.summary.amountCents,originalWithheldDate:file.summary.withheldDate,returnAuthorizationId:approval.id,returnFingerprint:approval.fingerprint,receiptId:receipt.id,receiptBindingId:location.id,receiptSha256:createHash('sha256').update(bytes).digest('hex'),allocation:file.summary,fileName:input.fileName,configurationId:configuration.id,timing:{...dates,status:'REPLACEMENT_REVIEW',reviewId:timing.id},reference:input.reference.trim(),newAllocationRequired:true,priorBatchReversedConfirmed:true,outsideActivityReviewed:true,lateCorrectionReviewed:true}
 return {summary:{...summary,status:'REPLACEMENT_PREVIEW_ONLY',fingerprint:createHash('sha256').update(JSON.stringify(summary)).digest('hex')},csv:file.csv}
}
export function registerRetirementReplacementPreview(app,pool,options){
 app.post('/api/admin/payroll/retirement-remittance-authorizations/:id/replacement-preview',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{const facility=req.canonicalAccess.facilityId;await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility]);const result=await prepareRetirementReplacement(db,facility,req.params.id,req.body,options);await db.query('COMMIT');res.json({success:true,data:result.summary})}
  catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to verify replacement contribution instructions.'})}finally{db.release()}
 })
}
