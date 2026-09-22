import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {retirementEmployerEligibilitySource,retirementEmployerEligibilityInput} from './retirementEmployerEligibility.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const calendarDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const day=value=>calendarDay(value)&&value.startsWith('2026-')
export function employerEligibilityPeriod(source,row,periodStart,periodEnd){
 if(!day(periodStart)||!day(periodEnd)||periodStart>periodEnd)throw fail('Use the actual employer contribution period in 2026.')
 if(!row||row.source_fingerprint!==source.fingerprint)throw fail('Review current employer eligibility before calculating contributions.')
 let review
 try{review=retirementEmployerEligibilityInput({...row.review,confirmed:true,sourceFingerprint:row.source_fingerprint},source)}catch{throw fail('Retain employer eligibility with an explicit current assessment date range.')}
 if(review.assessedFrom>periodStart||review.assessedThrough<periodEnd)throw fail('Employer eligibility assessment does not cover the full contribution period.')
 const components={}
 for(const key of ['matching','nonelective']){
  const finding=review[key]
  if(finding.status==='REVIEW_REQUIRED')throw fail('Resolve each employer contribution eligibility finding before calculation.')
  if(finding.status==='ELIGIBLE'&&finding.eligibleOn>periodStart&&finding.eligibleOn<=periodEnd)throw fail('Employer entry falls inside the contribution period. Reconcile dated compensation and deferrals on each side of entry.')
  components[key]={eligible:finding.status==='ELIGIBLE'&&finding.eligibleOn<=periodStart,vestedBps:finding.vestedBps,eligibleOn:finding.eligibleOn,status:finding.status}
 }
 const basis={version:1,sourceFingerprint:source.fingerprint,reviewId:row.id,periodStart,periodEnd,review,components}
 return {...basis,fingerprint:createHash('sha256').update(JSON.stringify(compensationEvidence(basis))).digest('hex')}
}
// Reads server-owned source and latest review under the caller's transaction.
export async function retirementEmployerEligibilityForPeriod(db,{facility,employeeId,planId,periodStart,periodEnd}){
 const source=await retirementEmployerEligibilitySource(db,facility,employeeId,planId)
 const row=(await db.query('SELECT id,source_fingerprint,review FROM payroll_retirement_employer_eligibility WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY revision DESC LIMIT 1',[facility,employeeId,planId])).rows[0]
 return employerEligibilityPeriod(source,row,periodStart,periodEnd)
}

export function employerPayrollEligibilityCoverage(source,payrollPreview,periodStart,periodEnd){
 if(!day(periodStart)||!day(periodEnd)||periodStart>periodEnd)throw fail('Use the actual employer contribution period in 2026.')
 const hire=source.hireDate
 if(!calendarDay(hire)||hire>periodEnd)throw fail('Review the employment cycle covering these payroll earnings.')
 const separation=source.terminationDate
 if(separation!=null&&(!calendarDay(separation)||separation<hire||separation<periodStart))throw fail('Review the recorded separation date covering these payroll earnings.')
 const clippedForSeparation=separation!=null&&separation<periodEnd
 if(hire<=periodStart&&!clippedForSeparation)return {periodStart,periodEnd,payrollPeriodStart:periodStart,payrollPeriodEnd:periodEnd,clippedForNewHire:false}
 const coverageStart=hire>periodStart?hire:periodStart,coverageEnd=clippedForSeparation?separation:periodEnd
 const periods=source.employmentPeriods
 if(!Array.isArray(periods))throw fail('Retain employment history before allocating partial-period eligibility coverage.')
 const overlapping=periods.filter(p=>p.started_on<=periodEnd&&(!p.ended_on||p.ended_on>=periodStart))
 if(overlapping.length!==1||overlapping[0].started_on!==hire||(clippedForSeparation?overlapping[0].ended_on!==separation:overlapping[0].ended_on&&overlapping[0].ended_on<periodEnd))throw fail('Review each employment cycle separately before allocating employer eligibility to this payroll.')
 const segments=payrollPreview?.employmentCompensation
 if(!Array.isArray(segments)||!segments.length||segments.some(s=>String(s.employeeId)!==String(source.employeeId)||s.employmentStart!==hire||!day(s.start)||!day(s.end)||s.start<coverageStart||s.end>coverageEnd||s.start>s.end||s.issue))throw fail('Retain complete dated engine compensation for the recorded employment interval.')
 const ordered=[...segments].sort((a,b)=>a.start.localeCompare(b.start))
 let next=coverageStart
 for(const segment of ordered){
  if(segment.start!==next)throw fail('Employment compensation coverage has a gap or overlap requiring review.')
  next=new Date(Date.parse(segment.end)+86400000).toISOString().slice(0,10)
 }
 if(ordered.at(-1).end!==coverageEnd)throw fail('Employment compensation coverage does not reach the recorded employment interval end.')
 if(!Array.isArray(payrollPreview.payItems)||payrollPreview.payItems.some(i=>i.kind==='BONUS'||i.kind==='BONUS_OVERTIME'||i.correction||i.allocatedBonus||i.bonusAllocation||i.leavePayout||i.employmentStart&&i.employmentStart!==hire)||payrollPreview.authorizedSettlement)throw fail('Reconcile dated bonus, correction or other employment-cycle earnings before narrowing employer eligibility coverage.')
 return {periodStart:coverageStart,periodEnd:coverageEnd,payrollPeriodStart:periodStart,payrollPeriodEnd:periodEnd,clippedForNewHire:hire>periodStart,...(clippedForSeparation?{clippedForSeparation:true}:{}),employmentPeriodId:String(overlapping[0].id)}
}

export async function retirementEmployerEligibilityForPayroll(db,{facility,employeeId,planId,periodStart,periodEnd,payrollPreview}){
 const source=await retirementEmployerEligibilitySource(db,facility,employeeId,planId)
 const coverage=employerPayrollEligibilityCoverage(source,payrollPreview,periodStart,periodEnd)
 const row=(await db.query('SELECT id,source_fingerprint,review FROM payroll_retirement_employer_eligibility WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY revision DESC LIMIT 1',[facility,employeeId,planId])).rows[0]
 const review=employerEligibilityPeriod(source,row,coverage.periodStart,coverage.periodEnd)
 const basis={...review,coverage}
 return {...basis,fingerprint:createHash('sha256').update(JSON.stringify(compensationEvidence(basis))).digest('hex')}
}
