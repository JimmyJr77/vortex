import {createHash} from 'node:crypto'
import {retirementRemittanceSources} from './retirementRemittanceSources.js'
import {readRetirementParticipantMapping} from './retirementParticipantMapping.js'
import {readRetirementDestination} from './retirementDestination.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readModernTreasuryCarrierAccount as readBusinessAccount} from './modernTreasuryCarrierPayments.js'
import {verifyModernTreasuryFundingAccount} from './modernTreasuryPayments.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function retirementRemittancePreview(db,facility,runId,input,{fetcher=fetch,now=new Date()}={}){
 if(typeof input?.planId!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(input.planId)||typeof input.sourceFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(input.sourceFingerprint))throw fail('Choose the current payroll contribution source and retirement plan.',400)
 const source=(await retirementRemittanceSources(db,facility,{runId,limit:1,now})).items[0]
 if(!source)throw fail('Finalized retirement payroll not found.',404)
 if(source.status==='RECONCILIATION_REQUIRED'||source.sourceFingerprint!==input.sourceFingerprint)throw fail('Contribution or participant evidence changed. Refresh and reconcile the payroll source.')
 const selected=source.allocations.filter(a=>a.planId===input.planId&&a.totalCents>0)
 if(!selected.length)throw fail('This payroll has no positive employee contributions for the selected plan.')
 if(selected.some(a=>a.destinationReview.status==='ACCOUNT_REVIEW_REQUIRED'))throw fail('Retirement destination account review requires a successful current recheck before remittance preparation.')
 const plan=(await db.query('SELECT id,plan FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,input.planId])).rows[0]
 const destinationId=(await db.query('SELECT id FROM payroll_retirement_destination WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC LIMIT 1',[facility,input.planId])).rows[0]?.id
 if(!plan||!destinationId)throw fail('Review the retirement plan and its remittance destination first.')
 const destination=await readRetirementDestination(db,facility,destinationId),connectionId=(await db.query('SELECT id FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[facility])).rows[0]?.id
 if(destination.plan_revision_id!==plan.id||String(destination.connection_id)!==String(connectionId))throw fail('Plan or funding configuration changed. Review the remittance destination again.')
 const mappings=[];let providerPlanId=null,total=0
 for(const allocation of selected){
  const mapping=await readRetirementParticipantMapping(db,facility,allocation.employeeId,input.planId)
  if(mapping.id!==allocation.participantMapping.mappingId||mapping.source.fingerprint!==allocation.participantMapping.sourceFingerprint)throw fail('Participant mapping changed. Refresh the contribution source.')
  if(providerPlanId!==null&&providerPlanId!==mapping.identifiers.providerPlanId)throw fail('Reconcile the recordkeeper plan identifier across participant mappings.')
  providerPlanId=mapping.identifiers.providerPlanId
  total+=allocation.totalCents;if(!Number.isSafeInteger(total))throw fail('Reconcile the exact contribution total.')
  mappings.push({...allocation,participantMapping:{mappingId:mapping.id,sourceFingerprint:mapping.source.fingerprint,maskedIdentifiers:mapping.masked_identifiers}})
 }
 const configuration=await readPayrollPaymentConnection(db,facility,connectionId),funding=await verifyModernTreasuryFundingAccount({...configuration,fetcher}),account=await readBusinessAccount({...configuration,fetcher},destination.destination.accountId)
 if(funding.status!=='VERIFIED'||account.status!=='VERIFIED'||account.account.fingerprint!==destination.destination.fingerprint)throw fail('Retirement destination or funding evidence changed or is unavailable. Recheck the account before remittance review.')
 const basis={version:1,facilityId:String(facility),runId:String(runId),planId:input.planId,planName:plan.plan.name,planRevisionId:plan.id,withheldDate:source.paymentDate,timing:selected[0].timing,sourceFingerprint:source.sourceFingerprint,destinationRevisionId:destination.id,destinationFingerprint:destination.fingerprint,fundingRevisionId:String(connectionId),destination:destination.masked_destination,allocations:mappings,amountCents:total}
 return {...basis,status:'PREVIEW_ONLY',fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex'),remainingRequirements:['Review the plan deposit timing and provider submission cutoffs.','Set up how the recordkeeper receives and confirms employee allocations.','Review contributions made outside Vortex before authorizing payment.']}
}
export function registerRetirementRemittancePreviewRoutes(app,pool,{fetcher=fetch,now=()=>new Date()}={}){
 app.post('/api/admin/payroll/runs/:id/retirement-remittance/preview',async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');const facility=req.canonicalAccess.facilityId
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const preview=await retirementRemittancePreview(db,facility,req.params.id,req.body,{fetcher,now:now()});await db.query('COMMIT');res.json({success:true,data:preview})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to prepare retirement remittance review.'})}finally{db.release()}})
}
