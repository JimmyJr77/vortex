import {retirementW2Codes} from './retirementW2Codes.js'
import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {compensationCategories} from './compensationApplicability.js'
const decimal=value=>typeof value==='string'&&/^\d+\.\d{2}$/.test(value)
const money=value=>{const cents=BigInt(value);return `${cents/100n}.${String(cents%100n).padStart(2,'0')}`}
export function w2DraftMapping(facility,employer,employee,determination){
 const issues=[],review=employee.inputReviewHistory?.[0],health=employee.healthClassificationHistory?.[0],applicability=employee.compensationApplicabilityHistory?.[0]
 if(employee.sourceStatus!=='READY_FOR_REVIEW')issues.push('Reconcile annual payroll inputs.')
 if(!review||review.status!=='CURRENT')issues.push('Record a current annual-input review.')
 if(!employer.revision||employer.issue||!employer.marylandRegistrationLast4||!employee.filingIdentity?.revision||employee.filingIdentity.issue)issues.push('Verify employer and employee filing identities, including Maryland registration.')
 if(!determination||!['REPORT','SMALL_EMPLOYER_RELIEF'].includes(determination.disposition))issues.push('Resolve employer health reporting.')
 if(!health||health.status!=='CURRENT'||Number(health.determination_id)!==Number(determination?.id)||!['REPORT','RELIEF_USED','NO_APPLICABLE_COVERAGE'].includes(health.disposition))issues.push('Record a current resolved employee health classification.')
 else if(health.disposition==='REPORT'&&(!/^[1-9]\d*$/.test(String(health.reportable_cost_cents))||!Number.isSafeInteger(Number(health.reportable_cost_cents)))||health.disposition==='RELIEF_USED'&&determination?.disposition!=='SMALL_EMPLOYER_RELIEF')issues.push('Reconcile health classification cost or relief eligibility.')
 if(!applicability||applicability.status!=='CURRENT')issues.push('Record a current compensation applicability review.')
 else for(const [key,label] of Object.entries(compensationCategories))if(applicability.categories[key]!=='NOT_APPLICABLE'&&!(key==='retirement'&&['EMPLOYER_ONLY_PARTICIPATION','STANDARD_401K_DEFERRALS'].includes(applicability.categories[key])))issues.push(`${label}: ${applicability.categories[key]==='APPLICABLE'?'detailed reporting treatment is not implemented':'resolve applicability'}.`)
 if(employee.retirementContributions?.hasEmployeeDeferrals&&applicability?.categories.retirement!=='STANDARD_401K_DEFERRALS')issues.push('Retained employee retirement deferrals require detailed contribution-code reporting before W-2 approval.')
 let retirementCodes=[]
 if(applicability?.categories.retirement==='STANDARD_401K_DEFERRALS')try{retirementCodes=retirementW2Codes(employee.retirementContributions)}catch(e){issues.push(e.message)}
 const wages=employee.wageInputs||{},tax=employee.withholding||{}
 if(['federal','maryland','socialSecurity','medicare'].some(k=>!decimal(wages[k]))||['federal','maryland','socialSecurity','medicare','additionalMedicare','combinedMedicare'].some(k=>!decimal(tax[k]))||!decimal(employee.reviewedQualifiedOvertime))issues.push('Annual amounts are unavailable or invalid.')
 if(issues.length)return {version:1,status:'REVIEW_REQUIRED',issues,boxes:null,fingerprint:null}
 if(BigInt(tax.medicare.replace('.',''))+BigInt(tax.additionalMedicare.replace('.',''))!==BigInt(tax.combinedMedicare.replace('.','')))return {version:1,status:'REVIEW_REQUIRED',issues:['Combined Medicare withholding does not reconcile.'],boxes:null,fingerprint:null}
 const box12=[...retirementCodes]
 if(health.disposition==='REPORT')box12.push({code:'DD',amount:money(health.reportable_cost_cents)})
 if(BigInt(employee.reviewedQualifiedOvertime.replace('.',''))>0n)box12.push({code:'TT',amount:employee.reviewedQualifiedOvertime})
 const boxes={box1:wages.federal,box2:tax.federal,box3:wages.socialSecurity,box4:tax.socialSecurity,box5:wages.medicare,box6:tax.combinedMedicare,box7:null,box8:null,box10:null,box11:null,box12,box13:{statutoryEmployee:false,retirementPlan:['EMPLOYER_ONLY_PARTICIPATION','STANDARD_401K_DEFERRALS'].includes(applicability.categories.retirement),thirdPartySickPay:false},box14a:[],box14b:[],box15:{state:'MD',employerIdentityRevision:employer.revision,registrationLast4:employer.marylandRegistrationLast4},box16:wages.maryland,box17:tax.maryland,box18:null,box19:null,box20:null}
 const basis={version:1,year:2026,facility:String(facility),employeeId:employee.employeeId,sourceFingerprint:employee.sourceFingerprint,employerIdentityRevision:employer.revision,employeeIdentityRevision:employee.filingIdentity.revision,inputReviewId:String(review.id),healthDeterminationId:String(determination.id),healthClassificationId:String(health.id),applicabilityReviewId:String(applicability.id),boxes}
 return {version:1,status:'DRAFT_REVIEW_REQUIRED',issues:[],boxes,fingerprint:createHash('sha256').update(JSON.stringify(compensationEvidence(basis))).digest('hex'),basis,notice:'Draft mapping only. Review and retain an approved form before issuance.'}
}
