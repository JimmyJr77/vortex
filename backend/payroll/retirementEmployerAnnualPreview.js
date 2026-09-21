import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const amount=value=>Number.isSafeInteger(value)&&value>=0
const sum=(a,b)=>{if(!amount(a)||!amount(b)||!Number.isSafeInteger(a+b))throw fail('Reconcile exact contribution cents before reviewing annual employer capacity.');return a+b}

// This compares the gross formula obligation, before prior employer-funding
// offsets. It does not reserve capacity or determine a remittable balance.
export function retirementEmployerAnnualPreview({compensation,deferralPreview,obligationPreview,fundingSourceFingerprint}){
 if(deferralPreview?.status!=='CALCULATED_NOT_APPLIED')return {status:'DEFERRAL_REVIEW_REQUIRED',message:'Resolve employee deferrals before checking shared annual contribution capacity.',remainingAfterEmployeeDeferralsCents:null,excessCents:null,requiresPriorFundingReview:true,requiresApprovalReservation:true,requiresPayrollIntegration:true}
 if(obligationPreview?.obligation?.totalCents==null)return {status:'OBLIGATION_REVIEW_REQUIRED',message:'Resolve the full employer obligation before checking shared annual contribution capacity.',remainingAfterEmployeeDeferralsCents:null,excessCents:null,requiresPriorFundingReview:true,requiresApprovalReservation:true,requiresPayrollIntegration:true}
 const c=deferralPreview.calculation,capacity=c?.capacity,o=obligationPreview.obligation
 if(c?.previewOnly!==true||c.planFingerprint!==compensation.planFingerprint||c.annualSourceFingerprint!==compensation.annualSourceFingerprint||capacity?.planFingerprint!==compensation.planFingerprint||capacity.annualSourceFingerprint!==compensation.annualSourceFingerprint||c.source?.planRevisionId!==compensation.source.planRevisionId||c.source?.annualSourceId!==compensation.source.annualSourceId||obligationPreview.planFingerprint!==compensation.planFingerprint||obligationPreview.sourceFingerprint!==fundingSourceFingerprint)throw fail('Employer and employee annual-capacity previews must use the same retained plan, annual sources and funding evidence.')
 const ordinary=sum(c.ordinary?.pretax,c.ordinary?.roth),catchUp=sum(c.catchUp?.pretax,c.catchUp?.roth)
 if(deferralPreview.ordinaryDeferralsCents!==ordinary||deferralPreview.catchUpDeferralsCents!==catchUp||sum(o.matchingCents,o.nonelectiveCents)!==o.totalCents||!amount(capacity.annualAdditionsLimitCents)||!amount(capacity.used?.annualAdditionsCents)||!amount(capacity.annualAdditionsRemainingCents)||capacity.annualAdditionsRemainingCents!==Math.max(0,capacity.annualAdditionsLimitCents-capacity.used.annualAdditionsCents)||ordinary>capacity.annualAdditionsRemainingCents)throw fail('Employee, employer and annual-additions preview amounts do not reconcile.')
 // Catch-up deferrals are deliberately excluded from annual additions.
 const remainingAfterEmployeeDeferralsCents=capacity.annualAdditionsRemainingCents-ordinary
 const excessCents=Math.max(0,o.totalCents-remainingAfterEmployeeDeferralsCents)
 const basis={version:1,fundingSourceFingerprint,deferralFingerprint:deferralPreview.fingerprint,obligationFingerprint:obligationPreview.fingerprint,annualAdditionsLimitCents:capacity.annualAdditionsLimitCents,priorAnnualAdditionsCents:capacity.used.annualAdditionsCents,ordinaryDeferralsCents:ordinary,catchUpDeferralsCents:catchUp,remainingAfterEmployeeDeferralsCents,grossEmployerObligationCents:o.totalCents,excessCents}
 return {...basis,status:excessCents?'GROSS_OBLIGATION_CAPACITY_SHORTFALL':'GROSS_OBLIGATION_FITS_REVIEWED_CAPACITY',fingerprint:createHash('sha256').update(JSON.stringify(compensationEvidence(basis))).digest('hex'),requiresPriorFundingReview:true,requiresApprovalReservation:true,requiresPayrollIntegration:true}
}
