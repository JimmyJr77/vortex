import {historicalReportingRange} from './historicalReportingEvidence.js'
import {retirementAnnualReporting} from './retirementAnnualReporting.js'
import {checkReplacementAnnualEvidence} from './checkReplacementReview.js'
import {replacementAnnualEvidence} from './paymentReplacementReview.js'
import {registerW2Publication} from './w2Publication.js'
import {registerW2Furnishing} from './w2Furnishing.js'
import {registerW2Approval,w2ApprovalHistory} from './w2Approval.js'
import {w2DraftMapping} from './w2DraftMapping.js'
import {registerCompensationApplicability,compensationApplicabilityHistory,compensationCategories} from './compensationApplicability.js'
import {registerEmployeeHealthClassification,employeeHealthHistory} from './employeeHealthClassification.js'
import {registerHealthReporting,healthReportingHistory} from './healthReporting.js'
import {registerAnnualInputReview} from './yearEndReview.js'
import {annualPaymentSources,annualSourceFingerprint} from './yearEndSource.js'
import {benefitContributionReport} from './benefitContributionReport.js'
import {employeeSummaryCsv} from './employeeSummary.js'
import {overtimeReportingRecords} from './overtimeReporting.js'
import {readFilingIdentity} from './filingIdentity.js'
const money=cents=>`${cents/100n}.${String(cents%100n).padStart(2,'0')}`
export function combinedMedicareWithholding(regular,additional){
 if([regular,additional].some(value=>typeof value!=='string'||!/^\d+\.\d{2}$/.test(value)))return null
 return money(BigInt(regular.replace('.',''))+BigInt(additional.replace('.','')))
}
export async function yearEndPreparation(db,facility){
 const [headers,...rows]=await employeeSummaryCsv(db,facility,'2026-01-01','2026-12-31',{nativeWageBasesOnly:true})
 const overtime=await overtimeReportingRecords(db,facility),paymentSources=await annualPaymentSources(db,facility)
 const replacementReviews=[...await replacementAnnualEvidence(db,facility),...await checkReplacementAnnualEvidence(db,facility)]
 const identities=(await db.query(`SELECT DISTINCT ON(subject_key) id,subject_key,employee_id,identifier_last4 FROM payroll_filing_identity WHERE facility_id=$1 ORDER BY subject_key,id DESC`,[facility])).rows
 const identity=async subject=>{
  const row=identities.find(r=>r.subject_key===subject)
  if(!row)return {revision:null,issue:'Filing identity has not been recorded.'}
  try{const data=await readFilingIdentity(db,facility,row.id);return {revision:Number(row.id),identifierLast4:row.identifier_last4,legalName:data.legalName||[data.firstName,data.middleName,data.lastName,data.suffix].filter(Boolean).join(' '),address:data.address,...(subject==='EMPLOYER'?{marylandRegistrationLast4:/^\d{8}$/.test(data.marylandRegistrationNumber||'')&&!/^0{8}$/.test(data.marylandRegistrationNumber)?data.marylandRegistrationNumber.slice(-4):null}:{}),issue:null}}catch{return {revision:Number(row.id),issue:'Encrypted filing identity cannot be read. Review vault configuration and stored evidence.'}}
 }
 const employer=await identity('EMPLOYER'),employees=[],healthCoverageReporting=await healthReportingHistory(db,facility)
 for(const row of rows){
  const values=Object.fromEntries(headers.map((header,index)=>[header,row[index]])),employeeId=Number(values['Employee ID']),filingIdentity=await identity(`EMPLOYEE:${employeeId}`),records=overtime.filter(r=>r.employeeId===employeeId),issues=[]
  const replacementTaxReviews=replacementReviews.filter(r=>r.employeeId===employeeId)
  issues.push(...new Set(replacementTaxReviews.flatMap(r=>r.issues)))
  if(employer.issue)issues.push(`Employer: ${employer.issue}`)
  if(!employer.issue&&!employer.marylandRegistrationLast4)issues.push('Employer Maryland Central Registration Number has not been recorded. Update employer filing identity before state reporting.')
  if(filingIdentity.issue)issues.push(filingIdentity.issue)
  const review=filingIdentity.revision?(await db.query('SELECT id,decision,created_at FROM payroll_filing_identity_employee_review WHERE facility_id=$1 AND employee_id=$2 AND identity_id=$3 ORDER BY id DESC LIMIT 1',[facility,employeeId,filingIdentity.revision])).rows[0]:null
  if(review?.decision==='CORRECTION_REQUESTED')issues.push('Employee requested a correction to the current filing identity.')
  const imports=Number(values['Imported payment count']),importedAnnual=imports?await historicalReportingRange(db,facility,employeeId,'2026-01-01','2026-12-31'):null
  if(importedAnnual)issues.push(...importedAnnual.issues)
  const importedTotals=importedAnnual?.totals,nativeCount=Number(values['Finalized run count'])
  const combined=(native,key)=>{if(imports&&!importedTotals)return null;if(!nativeCount)native='0.00';if(typeof native!=='string'||!/^\d+\.\d{2}$/.test(native))return null;return money(BigInt(native.replace('.',''))+BigInt(importedTotals?.[key]||0))}
  if(values['Review status']==='INCOMPLETE FINALIZED TAX RECORDS')issues.push('Finalized withholding or net payment records are incomplete.')
  if(nativeCount&&(!values['Retained Social Security taxable wages']||!values['Retained Medicare taxable wages']))issues.push(String(values['Wage-basis review']))
  if(nativeCount&&(!values['Retained federal income-tax wages']||!values['Retained Maryland income-tax wages']))issues.push(String(values['Income-tax wage review']))
  const overtimeComplete=(!imports||!!importedTotals)&&records.length===nativeCount&&(records.length>0||imports>0)&&records.every(r=>r.qualificationStatus==='REVIEWED'&&r.qualifiedPremiumCents!==null)
  if(!overtimeComplete)issues.push('Overtime qualification is missing, stale or unreconciled for one or more payments.')
  const taxesComplete=(!imports||!!importedTotals)&&(!nativeCount||values['Review status']!=='INCOMPLETE FINALIZED TAX RECORDS'&&!!values['Retained Social Security taxable wages']&&!!values['Retained Medicare taxable wages']&&!!values['Retained federal income-tax wages']&&!!values['Retained Maryland income-tax wages'])
  if(!taxesComplete)issues.push('Reconcile native and imported annual wage and withholding detail.')
  const wageInputs={federal:combined(values['Retained federal income-tax wages'],'federalWagesCents'),maryland:combined(values['Retained Maryland income-tax wages'],'marylandWagesCents'),socialSecurity:combined(values['Retained Social Security taxable wages'],'socialSecurityReportedWagesCents'),medicare:combined(values['Retained Medicare taxable wages'],'medicareWagesCents')}
  if(wageInputs.socialSecurity&&BigInt(wageInputs.socialSecurity.replace('.',''))>18450000n)issues.push('Combined native and imported Social Security reporting wages exceed the annual wage limit.')
  const withholding=Object.fromEntries([['federal','Federal withholding','federalWithheldCents'],['maryland','Maryland withholding','marylandWithheldCents'],['socialSecurity','Employee Social Security','socialSecurityWithheldCents'],['medicare','Employee Medicare','medicareWithheldCents'],['additionalMedicare','Additional Medicare','additionalMedicareWithheldCents']].map(([key,column,importedKey])=>[key,taxesComplete?combined(values[column],importedKey):null]))
  withholding.combinedMedicare=taxesComplete?combinedMedicareWithholding(withholding.medicare,withholding.additionalMedicare):null
  let benefitContributions=null
  try{const [benefitHeaders,...benefitRows]=await benefitContributionReport(db,facility,'2026-01-01','2026-12-31',employeeId);benefitContributions=benefitRows.map(row=>{const item=Object.fromEntries(benefitHeaders.map((header,index)=>[header,row[index]]));return {paymentDate:item['Payment date'],month:item['Contribution month'],planId:item['Plan ID'],planName:item.Plan,optionId:item['Option ID'],optionLabel:item['Coverage option'],employeeContribution:item['Employee contribution'],taxTreatment:item['Tax treatment'],runId:item['Payroll run'],authorizationFingerprint:item['Authorization fingerprint']}})}catch(e){if(e.status!==409)throw e;issues.push('Employee benefit contributions require reconciliation with retained payroll and deduction authorizations.')}
  let retirementContributions=null
  try{retirementContributions=await retirementAnnualReporting(db,facility,employeeId)}catch(e){if(e.status!==409)throw e;issues.push('Retirement contributions require reconciliation with finalized payroll, statements and ledger evidence.')}
  const prepared={...(retirementContributions?{retirementContributions}:{}),employeeId,employeeNumber:values['Employee #'],employeeName:values.Employee,filingIdentity,employeeIdentityReview:review?.decision||'NOT_REVIEWED',finalizedRunCount:Number(values['Finalized run count']),runIds:records.map(r=>r.runId),importedPaymentCount:imports,
   wageInputs,withholding,...(importedAnnual?{importedAnnual}:{}),
   ...(replacementTaxReviews.length?{replacementTaxReviews}:{}),benefitContributions,benefitReportingNotice:'These are retained employee wage deductions only. They do not establish employer contributions, reportable health coverage cost or other benefit tax-form amounts.',
   reviewedQualifiedOvertime:overtimeComplete?money(records.reduce((sum,r)=>sum+BigInt(r.qualifiedPremiumCents),BigInt(importedTotals?.qualifiedOvertimePremiumCents||0))):null,issues,sourceStatus:issues.length?'NEEDS_RECONCILIATION':'READY_FOR_REVIEW'}
  const sourceFingerprint=annualSourceFingerprint(facility,employer,prepared,paymentSources.get(String(employeeId))||{paid:[],imported:[]},records.map(r=>({runId:r.runId,sourceFingerprint:r.sourceFingerprint,reviewId:r.reviewId,qualificationStatus:r.qualificationStatus,qualifiedPremiumCents:r.qualifiedPremiumCents})),review?{id:String(review.id),decision:review.decision}:null)
  const history=(await db.query('SELECT id,source_fingerprint,reference,created_by,created_at FROM payroll_annual_input_review WHERE facility_id=$1 AND employee_id=$2 AND payment_year=2026 ORDER BY id DESC',[facility,employeeId])).rows
  employees.push({...prepared,sourceFingerprint,sourceVersion:1,compensationApplicabilityHistory:await compensationApplicabilityHistory(db,facility,employeeId,sourceFingerprint),healthClassificationHistory:await employeeHealthHistory(db,facility,employeeId,sourceFingerprint,healthCoverageReporting.revision),inputReviewHistory:history.map((item,index)=>({...item,status:item.source_fingerprint!==sourceFingerprint?'STALE':index===0?'CURRENT':'SUPERSEDED'}))})
 }
 for(const employee of employees){employee.w2Draft=w2DraftMapping(facility,employer,employee,healthCoverageReporting.history[0]);employee.w2ApprovalHistory=await w2ApprovalHistory(db,facility,employee.employeeId,employee.w2Draft.fingerprint)}
 return {year:2026,employer,employees,healthCoverageReporting,compensationCategories,issuanceAvailable:false,remainingRequirements:['Review all applicable compensation, benefits, exclusions and form mappings.','Approve and retain tax forms before employee furnishing or agency transmission.'],notice:'Annual preparation inputs, not issued W-2 forms. Amounts reflect finalized payments and reconciled retained evidence.'}
}
export function registerYearEndPreparationRoutes(app,pool){
 registerAnnualInputReview(app,pool,yearEndPreparation)
 registerW2Approval(app,pool,yearEndPreparation)
 registerW2Publication(app,pool,yearEndPreparation)
 registerW2Furnishing(app,pool)
 registerHealthReporting(app,pool)
 registerCompensationApplicability(app,pool,yearEndPreparation)
 registerEmployeeHealthClassification(app,pool,yearEndPreparation)
 app.get('/api/admin/payroll/reports/year-end-preparation',async(req,res)=>{
  if(String(req.query.year)!=='2026')return res.status(400).json({success:false,message:'Year-end preparation currently supports payment year 2026.'})
  const db=await pool.connect()
  try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await yearEndPreparation(db,req.canonicalAccess.facilityId);await db.query('COMMIT');res.setHeader('Cache-Control','no-store');res.json({success:true,data})}
  catch{await db.query('ROLLBACK').catch(()=>{});res.status(500).json({success:false,message:'Unable to prepare annual payroll inputs.'})}finally{db.release()}
 })
}
