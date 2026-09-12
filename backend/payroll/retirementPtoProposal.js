import {createHash} from 'node:crypto'
import {retirementPtoAssessment} from './retirementPtoEvidence.js'
import {retirementPayrollSource} from './retirementPayrollSource.js'
import {retirementInternalBalances} from './retirementLedger.js'
import {retirementContributionCalculation} from './retirementContributionCalculation.js'
import {retirement401kTaxWages} from './retirement401kTaxWages.js'
const fail=message=>Object.assign(new Error(message),{status:409})
// Source-derived proposal only. Withholding, affordability and ledger posting
// must validate this exact source again before applying employee deductions.
export async function retirementPtoProposal(db,{facility,employeeId,planId,payoutId,paymentDate,evidence,excludeRunId=null}){
 const assessment=await retirementPtoAssessment(db,{facility,employeeId,planId,payoutId,paymentDate,evidence})
 if(assessment.status!=='EVIDENCE_READY')throw fail(assessment.issues.join(' '))
 const source=await retirementPayrollSource(db,facility,employeeId,planId,paymentDate)
 if(source.planRevisionId!==assessment.source.planRevisionId||source.plan.fingerprint!==assessment.source.planFingerprint)throw fail('Retirement plan changed while preparing the PTO contribution.')
 const employee=(await db.query('SELECT work_state,residence_state FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employeeId])).rows[0]
 const ledger=await retirementInternalBalances(db,facility,employeeId,planId,2026,{excludeRunId})
 if(ledger.unreconciledPayrollIds.length)throw fail('Reconcile earlier retirement compensation before this PTO contribution.')
 const grossCents=Number(assessment.source.payout.amount_cents)
 const unusedPto={paymentTiming:evidence.employmentEndedOn&&paymentDate>evidence.employmentEndedOn?'POST_SEVERANCE':'IN_SERVICE',grossCents,eligibleCents:assessment.deferralTreatment==='INCLUDED'?grossCents:0,compensation415Cents:assessment.compensation415Cents,assessmentFingerprint:assessment.fingerprint}
 const calculation=retirementContributionCalculation({...source,internal:ledger.totals,payDate:paymentDate,runKind:'OFF_CYCLE',compensation:{REGULAR:0,OVERTIME:0,BONUS:0,PAID_LEAVE:0},compensation415Cents:unusedPto.compensation415Cents,unusedPto,availableDeductionCents:grossCents,catchUpAuthorized:source.processingReview.catchUpAuthorized})
 const retirement401k={planType:source.plan.planType,pretaxCents:calculation.pretaxCents,rothCents:calculation.rothCents,pretaxAnnualBonusCents:0}
 let taxWages
 try{taxWages=retirement401kTaxWages({...retirement401k,grossCents,annualBonusCents:0,year:2026,workState:employee?.work_state,residenceState:employee?.residence_state})}catch(e){throw fail(e.message)}
 const result={version:1,planId,planName:source.plan.name,calculation,retirement401k,taxWages,source:{assessmentFingerprint:assessment.fingerprint,planRevisionId:source.planRevisionId,annualSourceId:source.annualSourceId,eligibilityRevisionId:source.eligibilityRevisionId,electionId:source.electionId,processingReviewId:source.processingReviewId,eligibilitySourceFingerprint:source.eligibilitySourceFingerprint}}
 return {...result,fingerprint:createHash('sha256').update(JSON.stringify(result)).digest('hex')}
}
