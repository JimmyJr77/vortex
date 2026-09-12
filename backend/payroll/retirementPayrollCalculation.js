import {retirementPayrollWages} from './retirementPayrollWages.js'
import {retirementPayrollSource} from './retirementPayrollSource.js'
import {retirementInternalBalances} from './retirementLedger.js'
import {retirementContributionCalculation} from './retirementContributionCalculation.js'
// Caller supplies engine-derived wages and a locked/repeatable-read transaction.
// Employee elections, annual sources and internal balances are always loaded
// here from scoped records, never supplied as calculation overrides.
export async function retirementPayrollCalculation(db,{facility,employeeId,planId,payDate,runKind,payrollPreview,excludeRunId=null}){
 const source=await retirementPayrollSource(db,facility,employeeId,planId,payDate)
 const wages=retirementPayrollWages(payrollPreview,source.plan)
 if(String(payrollPreview.employeeId)!==String(employeeId))throw Object.assign(new Error('Retirement wages belong to another employee.'),{status:409})
 const ledger=await retirementInternalBalances(db,facility,employeeId,planId,2026,{excludeRunId})
 if(ledger.unreconciledPayrollIds.length)throw Object.assign(new Error('Earlier payroll needs retirement compensation reconciliation before calculating contributions.'),{status:409})
 const calculation=retirementContributionCalculation({...source,internal:ledger.totals,payDate,runKind,...wages,availableDeductionCents:payrollPreview.grossPayCents,catchUpAuthorized:source.processingReview.catchUpAuthorized})
 // Allocate pretax deferrals to included bonus wages proportionally; nearest
 // cent, with half-cent ties assigned to the bonus. Retain the exact policy.
 const bonusBasis=source.plan.compensation.BONUS?wages.compensation.BONUS:0
 const denominator=BigInt(calculation.planCompensationCents)
 const pretaxAnnualBonusCents=denominator?Number((BigInt(calculation.pretaxCents)*BigInt(bonusBasis)*2n+denominator)/(denominator*2n)):0
 const retirement401k={planType:source.plan.planType,pretaxCents:calculation.pretaxCents,rothCents:calculation.rothCents,pretaxAnnualBonusCents}
 return {...calculation,planName:source.plan.name,retirement401k,bonusAllocationPolicy:'PROPORTIONAL_INCLUDED_WAGES_HALF_UP',wageSource:wages,source:{processingReviewId:source.processingReviewId,planRevisionId:source.planRevisionId,annualSourceId:source.annualSourceId,eligibilityRevisionId:source.eligibilityRevisionId,electionId:source.electionId,eligibilitySourceFingerprint:source.eligibilitySourceFingerprint}}
}
