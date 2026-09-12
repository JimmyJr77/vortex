import {marylandAgreementPaySetup} from './marylandAgreementPaySetup.js'
import {benefitsTerms,benefitPlans} from './benefitCatalog.js'
import {employeePaymentReadiness} from './paymentReadiness.js'
import {benefitsReviewCurrent} from './benefitsReview.js'
import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {calculateWithholding2026} from './withholding2026.js'
import {effectiveScheduleSettings} from './payCalendar.js'
export async function employeePaySetup(db,facility,employee,tasks){
 const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]
 const today=(await db.query('SELECT (now() AT TIME ZONE $1)::date::text AS today',[settings.timezone])).rows[0].today
 const schedule=await effectiveScheduleSettings(db,facility,settings)
 const election=(await db.query('SELECT tax_year,elections,verified_at,source_note FROM payroll_tax_election WHERE facility_id=$1 AND employee_id=$2',[facility,employee.id])).rows[0]
 const payment=tasks.find(t=>t.task_key==='PAYMENT'),review=tasks.find(t=>t.task_key==='PAY_REVIEW'),issues=[]
 if(employee.w4_status!=='COMPLETE')issues.push('Review the signed federal withholding form.')
 if(employee.state_withholding_status!=='COMPLETE')issues.push('Review the signed state withholding form.')
 if(!election?.verified_at)issues.push('Save verified employee tax elections in pay settings.')
 else try{calculateWithholding2026({grossPayCents:200000,paymentDate:today,election:{...election.elections,verified:true},payFrequency:schedule.pay_frequency,year:election.tax_year,workState:employee.work_state,residenceState:employee.residence_state})}catch(e){issues.push(e.message)}
 const signedW4=tasks.find(t=>t.task_key==='W4')?.response?.w4SubmissionId
 if(signedW4&&String(election?.elections?.w4Source?.submissionId)!==String(signedW4))issues.push('Save tax elections from the current employee-signed W-4.')
 if(payment?.status!=='COMPLETE'||!['CHECK','DIRECT_DEPOSIT'].includes(payment?.response?.method))issues.push('Review and complete the employee payment election.')
 const paymentReadiness=payment?.response?.method==='DIRECT_DEPOSIT'?await employeePaymentReadiness(db,facility,employee.id):null
 if(paymentReadiness?.issue)issues.push(paymentReadiness.issue)
 const basis=JSON.parse(JSON.stringify({taxElection:election||null,payFrequency:schedule.pay_frequency,payment:{status:payment?.status||null,response:payment?.response||{},directDepositStatus:employee.direct_deposit_status},employee:Object.fromEntries(['pay_type','hourly_rate_cents','annual_salary_cents','overtime_classification','salary_review','work_state','residence_state','sick_leave_policy','w4_status','state_withholding_status'].map(k=>[k,employee[k]??null]))}))
 const marylandAgreement=await marylandAgreementPaySetup(db,{facility,employee,election,settings,review,today})
 if(marylandAgreement){basis.marylandAgreement=marylandAgreement;if(marylandAgreement.issue)issues.push(marylandAgreement.issue)}
 if(paymentReadiness)basis.payment.providerReadiness=paymentReadiness
 basis.benefitsPolicy=benefitsTerms(settings.onboarding_policy)
 basis.benefitPlans=benefitPlans(settings.onboarding_policy)
 basis.benefitsElection=review?.response?.benefitsElection||null
 const benefitsCurrent=review?.status==='COMPLETE'&&benefitsReviewCurrent(review?.response?.benefitsReview,basis.benefitsPolicy,today,basis.benefitsElection,basis.benefitPlans)
 const fingerprint=createHash('sha256').update(JSON.stringify(compensationEvidence(basis))).digest('hex')
 const status=review?.status==='COMPLETE'?(issues.length||!benefitsCurrent||review.response?.paySetup?.fingerprint!==fingerprint?'NEEDS_REVIEW':'CURRENT'):'PENDING'
 return {marylandAgreement,status,issues,fingerprint,taxYear:election?.tax_year||null,paymentMethod:payment?.response?.method||null,paymentReadiness,benefitsCurrent,today,basis}
}
