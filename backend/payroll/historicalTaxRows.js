import {historicalEmploymentWageState} from './historicalEmploymentWageReview.js'
import {historicalEmploymentWageReview} from './historicalEmploymentTaxWages.js'
import {historicalReportingRange} from './historicalReportingEvidence.js'
const fail=message=>Object.assign(new Error(message),{status:409})
export async function historicalTaxRows(db,facility,year){
 const people=(await db.query('SELECT DISTINCT employee_id FROM payroll_historical_payment WHERE facility_id=$1 AND EXTRACT(YEAR FROM payment_date)=$2 ORDER BY employee_id',[facility,year])).rows
 const rows=[]
 for(const {employee_id:employeeId} of people){
  const validated=await historicalReportingRange(db,facility,employeeId,`${year}-01-01`,`${year}-12-31`)
  if(!validated.totals)throw fail('Review imported annual wage and withholding detail before tax reconciliation. '+validated.issues.join(' '))
  const state=await historicalEmploymentWageState(db,facility,employeeId,`${year}-12-31`),review=historicalEmploymentWageReview(state.source,state.current.review)
  for(const payment of review.payments){
   const annual=payment.annualDetail,employer=annual?.employerTaxes,source=state.source.payments.find(p=>p.paymentId===payment.paymentId)
   if(!employer)throw fail('Review separate employer Social Security, Medicare, FUTA and Maryland unemployment taxes for each imported payment before tax reconciliation.')
   rows.push({run_id:0,employee_id:employeeId,payment_date:payment.paymentDate,gross:source.grossCents,federal_wages:annual.federalWagesCents,federal_income:annual.federalWithheldCents,social_security:annual.socialSecurityWithheldCents,medicare:annual.medicareWithheldCents,additional_medicare:annual.additionalMedicareWithheldCents,employer_social_security:employer.socialSecurityCents,employer_medicare:employer.medicareCents,futa:employer.futaCents,maryland:annual.marylandWithheldCents,md_ui:employer.marylandUnemploymentCents,imported_evidence:{kind:'IMPORTED',paymentId:payment.paymentId,reviewId:state.current.id,sourceFingerprint:state.source.fingerprint}})
  }
 }
 return rows
}
