import {retirementProcessingInput} from './retirementProcessingReview.js'
import {retirementEligibilitySource} from './retirementEligibility.js'
import {retirementElectionInput} from './retirementElectionInput.js'
import {retirementPlanInput} from './retirementPlanInput.js'
import {retirementAnnualInput} from './retirementAnnualInput.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
// Use a transaction with the employer settings lock when preparing approval;
// repeatable-read is sufficient for a read-only preview. Never accept these
// records from a payroll request body.
export async function retirementPayrollSource(db,facility,employeeId,planId,payDate){
 if(typeof payDate!=='string'||!/^2026-\d{2}-\d{2}$/.test(payDate)||!Number.isFinite(Date.parse(payDate))||new Date(payDate).toISOString().slice(0,10)!==payDate)throw fail('Review the retirement payroll date and tax year.')
 const source=await retirementEligibilitySource(db,facility,employeeId,planId)
 const planRow=(await db.query('SELECT id,plan FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]
 const annualRow=(await db.query('SELECT id,facts,plan_revision_id FROM payroll_retirement_annual_source WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,employeeId,planId])).rows[0]
 const eligibility=(await db.query('SELECT id,source_fingerprint,review FROM payroll_retirement_eligibility WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY revision DESC LIMIT 1',[facility,employeeId,planId])).rows[0]
 const elected=(await db.query("SELECT id,election FROM payroll_retirement_election WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 AND election->>'effectiveOn'<=$4 ORDER BY revision DESC LIMIT 1",[facility,employeeId,planId,payDate])).rows[0]
 const plan=planRow?.plan,annual=annualRow?.facts
 if(!plan||!annual||annualRow.plan_revision_id!==planRow.id||source.planRevisionId!==planRow.id)throw fail('Review current retirement plan and annual sources before payroll.')
 if(plan.effectiveOn>payDate||annual.asOfDate>payDate)throw fail('Retirement plan or annual evidence is dated after this payroll payment.')
 if(!eligibility||eligibility.source_fingerprint!==source.fingerprint||eligibility.review.disposition!=='ELIGIBLE'||eligibility.review.eligibleOn>payDate)throw fail('Review current participant eligibility for this payroll payment.')
 if(!elected)throw fail('No signed retirement election applies to this payroll payment.')
 const election=retirementElectionInput({...elected.election,confirmed:true},elected.election.proposal)
 const p=election.proposal
 if(p.planFingerprint!==plan.fingerprint||p.eligibilityRevisionId!==eligibility.id||String(p.employeeId)!==String(employeeId)||String(p.facilityId)!==String(facility)||p.planId!==planId||p.onboardingCycle!==source.onboardingCycle||p.planRevision!==source.planRevision)throw fail('Current participant election or eligibility differs from payroll.')
 if(retirementPlanInput({...plan,confirmed:true}).fingerprint!==plan.fingerprint||retirementAnnualInput({...annual,confirmed:true}).fingerprint!==annual.fingerprint)throw fail('Retained retirement terms or annual evidence changed.')
 const processing=(await db.query('SELECT id,plan_revision_id,review FROM payroll_retirement_processing_review WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]
 if(!processing||processing.plan_revision_id!==planRow.id||processing.review.disposition!=='REVIEWED')throw fail('Review current retirement processing policies before payroll.')
 const processingReview=retirementProcessingInput({...processing.review,confirmed:true})
 if(processingReview.catchUpAuthorized&&!plan.allowsCatchUp)throw fail('Current plan does not permit reviewed catch-up processing.')
 return {plan,annual,election,processingReview,processingReviewId:processing.id,planRevisionId:planRow.id,annualSourceId:annualRow.id,eligibilityRevisionId:eligibility.id,electionId:elected.id,eligibilitySourceFingerprint:source.fingerprint}
}
