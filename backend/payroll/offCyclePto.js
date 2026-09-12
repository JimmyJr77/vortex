import {assertNativeW4ExemptionDate,assertNativeMW507Date} from './withholding2026.js'
import {loadOptionalMarylandAdditionalPeriod} from './loadMarylandAdditionalPeriod.js'
import {ptoStateReviewBasis} from './ptoStateWithholding.js'
import {ptoStateMethodInput,calculatePtoState} from './ptoStateCalculation.js'
import {retirementPtoProposal} from './retirementPtoProposal.js'
import {retirementPtoAssessment,retirementPtoEvidenceInput} from './retirementPtoEvidence.js'
import {retirementCandidatesFor,retirementOffCycleWarnings} from './regularRetirementPayroll.js'
import {loadAggregatePaymentBasis} from './aggregatePaymentBasis.js'
import {assertEmploymentPaymentDate} from './employmentPeriods.js'
import {standaloneComplianceWarnings} from './employerSetup.js'
import {createHash} from 'node:crypto'
import {buildEmployeePreview} from './payrollEngine.js'
import {federalSupplementalWithholding2026} from './supplementalWithholding2026.js'
import {loadSupplementalPaymentHistory} from './supplementalPaymentHistory.js'
const fail=message=>Object.assign(new Error(message),{status:409})
export function validateOffCyclePto(body){
 if(body.federalMethod!==undefined&&!['FLAT_22','AGGREGATE'].includes(body.federalMethod))throw fail('Select flat or aggregate federal supplemental withholding.')
 if(!Number.isSafeInteger(Number(body.payoutId))||Number(body.payoutId)<=0)throw fail('Select a reserved standalone PTO payout.')
 if(body.historyCompleteVerified!==true||String(body.historySource||'').trim().length<20)throw fail('Reconcile complete employer and related-employer payment history and record its source before standalone withholding.')
 return {...ptoStateMethodInput(body),...(body.retirementPtoEvidence!==undefined?{retirementPtoEvidence:retirementPtoEvidenceInput(body.retirementPtoEvidence)}:{}),...(body.federalMethod==='AGGREGATE'?{federalMethod:'AGGREGATE'}:{}),version:1,payoutId:Number(body.payoutId),historyCompleteVerified:true,historySource:String(body.historySource).trim().slice(0,2000)}
}
export async function loadOffCyclePtoPreview(db,facility,periodId,paymentDate,context,runId=null){
 context=validateOffCyclePto(context)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(paymentDate))||!Number.isFinite(Date.parse(paymentDate))||new Date(paymentDate).toISOString().slice(0,10)!==paymentDate)throw fail('Choose a valid standalone PTO payout payment date.')
 const payout=(await db.query("SELECT * FROM payroll_leave_payout WHERE facility_id=$1 AND id=$2 AND payment_mode='STANDALONE' AND status='RESERVED'",[facility,context.payoutId])).rows[0]
 if(!payout||Number(payout.pay_period_id)!==Number(periodId))throw fail('Choose a reserved standalone PTO payout and its processing period.')
 if(paymentDate<new Date(payout.reserved_on).toISOString().slice(0,10))throw fail('PTO payment cannot precede its balance reservation.')
 if(payout.offcycle_run_id&&Number(payout.offcycle_run_id)!==Number(runId)){
  const assigned=(await db.query('SELECT status FROM payroll_run WHERE facility_id=$1 AND id=$2',[facility,payout.offcycle_run_id])).rows[0]
  if(!assigned||assigned.status!=='VOID')throw fail('This PTO payout already belongs to another payroll. Review or void that run first.')
 }
 const employeeId=Number(payout.employee_id)
 const employee=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employeeId])).rows[0]
 const period=(await db.query("SELECT * FROM payroll_pay_period WHERE facility_id=$1 AND id=$2 AND status<>'VOID'",[facility,periodId])).rows[0]
 const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]
 if(!employee||employee.employment_status==='ONBOARDING'||!period||!settings)throw fail('Choose an active or former employee and a valid processing period.')
 await assertEmploymentPaymentDate(db,facility,employee.id,paymentDate)
 const history=await loadSupplementalPaymentHistory(db,facility,employee.id,paymentDate)
 const year=Number(paymentDate.slice(0,4)),ytd=history.evidence.filter(e=>Number(e.paymentDate.slice(0,4))===year).reduce((n,e)=>n+e.grossCents,0)
 const electionRow=(await db.query('SELECT elections FROM payroll_tax_election WHERE facility_id=$1 AND employee_id=$2 AND tax_year=$3',[facility,employee.id,year])).rows[0]
 const election=electionRow?{...electionRow.elections,verified:true}:null
 assertNativeW4ExemptionDate(election,paymentDate)
 assertNativeMW507Date(election,paymentDate)
 if(election?.w4ReviewRequired)throw fail('Review and save the latest signed W-4 before preparing this payment.')
 if(election?.mw507ReviewRequired)throw fail('Review and save the latest signed MW507 before preparing this payment.')
 const adjustments=[{kind:'LEAVE_PAYOUT',name:'Unused PTO payout',amountCents:Number(payout.amount_cents),minutes:Number(payout.minutes),taxTreatmentVerified:true,leavePayout:{id:Number(payout.id),hourlyRateCents:Number(payout.hourly_rate_cents),fingerprint:payout.review.fingerprint}}]
 const calculated=buildEmployeePreview({employee:{id:Number(employee.id),payType:'HOURLY',hourlyRateCents:0,legalFirstName:employee.legal_first_name,legalLastName:employee.legal_last_name,w4Status:employee.w4_status,stateWithholdingStatus:employee.state_withholding_status,workState:employee.work_state,residenceState:employee.residence_state},entries:[],adjustments,ytdSocialSecurityWagesCents:ytd,taxElection:election,payPeriod:{...period,pay_date:paymentDate},payFrequency:period.frequency,taxYear:year,employerTaxConfig:settings.employer_tax_config})
 calculated.payType=employee.pay_type;calculated.sickLeaveAccrualMinutes=0
 calculated.warnings=calculated.warnings.filter(w=>w.code!=='WITHHOLDING_ENGINE_NOT_CONFIGURED'&&w.code!=='NEGATIVE_NET_PAY')
 if(!history.reconciled)calculated.warnings.push({code:'SUPPLEMENTAL_HISTORY_REVIEW',severity:'critical',blocking:true,message:'Reconcile supplemental payment history and imported totals before paying this PTO payout.'})
 const retirementCandidates=await retirementCandidatesFor(db,facility,paymentDate,[employeeId])
 const retirementPtoAssessments=[]
 for(const candidate of retirementCandidates)retirementPtoAssessments.push(await retirementPtoAssessment(db,{facility,employeeId,planId:candidate.plan_id,payoutId:payout.id,paymentDate,evidence:context.retirementPtoEvidence}))
 if(retirementPtoAssessments.length)calculated.retirementPtoAssessments=retirementPtoAssessments
 const retirementPtoProposals=[]
 if(retirementCandidates.length===1&&retirementPtoAssessments[0].status==='EVIDENCE_READY'){
  try{retirementPtoProposals.push(await retirementPtoProposal(db,{facility,employeeId,planId:retirementCandidates[0].plan_id,payoutId:payout.id,paymentDate,evidence:context.retirementPtoEvidence,excludeRunId:runId}))}
  catch(e){if(![400,409].includes(e.status))throw e;calculated.warnings.push({code:'RETIREMENT_PTO_CONTRIBUTION_REVIEW',severity:'critical',blocking:true,message:e.message})}
 }
 if(retirementPtoProposals.length)calculated.retirementPtoProposals=retirementPtoProposals

 const proposal=retirementPtoProposals[0],pretax=proposal?.calculation.pretaxCents||0,roth=proposal?.calculation.rothCents||0
 let federal=null,state=null,taxBreakdown=null,aggregateBasis=null
 try{
  if(!election||year!==2026||election.federal?.nonresidentAlien||election.federal?.lockInLetter)throw fail('Verify supported 2026 federal elections before native supplemental withholding.')
  if(context.federalMethod==='AGGREGATE'&&history.ytdSupplementalCents<100000000)aggregateBasis=await loadAggregatePaymentBasis(db,facility,history,paymentDate)
  taxBreakdown=federalSupplementalWithholding2026({paymentCents:calculated.grossPayCents-pretax,ytdSupplementalCents:history.ytdSupplementalCents,historyVerified:history.reconciled&&context.historyCompleteVerified===true,year,method:context.federalMethod||'FLAT_22',regularWithholdingVerified:history.regularWithholdingVerified,...(aggregateBasis?{aggregate:{...aggregateBasis,verified:true,election:{...election.federal,verified:true}}}:{})})
  federal=taxBreakdown.federalIncomeTaxCents;
  const additionalAllocation=context.stateMethod==='MD_LUMP_SUM'?await loadOptionalMarylandAdditionalPeriod(db,{facility,employeeId,paymentDate,excludeRunId:runId},(election.maryland.extraWithholdingCents??0)>0):null
  calculated.ptoStateWithholdingBasis=ptoStateReviewBasis({payFrequency:period.frequency,...(additionalAllocation?{marylandAdditionalAllocation:additionalAllocation}:{}),facility:String(facility),employeeId:String(employeeId),payoutId:String(payout.id),paymentDate,year,workState:employee.work_state,residenceState:employee.residence_state,grossWagesCents:calculated.grossPayCents,marylandWagesCents:calculated.grossPayCents-pretax,pretaxCents:pretax,rothCents:roth,federalIncomeTaxCents:federal,ficaCents:calculated.socialSecurityTaxCents+calculated.medicareTaxCents+calculated.additionalMedicareTaxCents,retirementProposalFingerprint:proposal?.fingerprint||null,payoutFingerprint:payout.review.fingerprint,historyFingerprint:history.fingerprint,marylandHistory:history.marylandHistory,historySource:context.historySource,federalMethod:context.federalMethod||'FLAT_22',aggregateFingerprint:aggregateBasis?.fingerprint||null,taxElection:election})
  const stateResult=calculatePtoState({context,basis:calculated.ptoStateWithholdingBasis,wageBasisVerified:history.reconciled&&(!retirementCandidates.length||!!proposal),lumpSumVerified:payout.review?.policyVerified===true&&payout.review?.unusedVacationVerified===true&&payout.payment_mode==='STANDALONE'})
  if(stateResult.review)calculated.ptoStateWithholdingReview=stateResult.review
  if(stateResult.calculation){calculated.ptoStateWithholdingCalculation=stateResult.calculation;calculated.ptoStateTaxComponents=stateResult.stateTaxComponents}
  state=stateResult.stateIncomeTaxCents
 }catch(e){calculated.warnings.push({code:'WITHHOLDING_ENGINE_NOT_CONFIGURED',severity:'critical',blocking:true,message:e.message})}
 calculated.federalIncomeTaxCents=federal;calculated.stateIncomeTaxCents=state
 calculated.withholdingMethod=federal!==null&&state!==null?('2026-standalone-federal-supplemental-pto-'+(context.stateMethod==='MD_LUMP_SUM'?'native-md':'reviewed-md'))+(proposal?'-401k':''):null
 calculated.netPayCents=federal!==null&&state!==null?calculated.grossPayCents-pretax-roth-calculated.socialSecurityTaxCents-calculated.medicareTaxCents-calculated.additionalMedicareTaxCents-federal-state:null
 if(calculated.netPayCents!==null&&calculated.netPayCents<0)calculated.warnings.push({code:'NEGATIVE_NET_PAY',severity:'critical',blocking:true,message:'Calculated taxes exceed this PTO payout payment.'})

 const integrated=!!proposal&&state!==null&&federal!==null&&Number.isSafeInteger(calculated.netPayCents)&&calculated.netPayCents>=0&&!calculated.warnings.some(w=>w.blocking)
 if(integrated){
  calculated.retirement401k=proposal.taxWages;calculated.pretaxDeductionCents=pretax;calculated.posttaxDeductionCents=roth;calculated.totalDeductionCents=pretax+roth
  if(pretax)calculated.payItems.push({kind:'RETIREMENT_401K_PRETAX',name:'401(k) pretax employee deferral',amountCents:pretax})
  if(roth)calculated.payItems.push({kind:'RETIREMENT_401K_ROTH',name:'401(k) Roth employee deferral',amountCents:roth})
  const employeeTaxCents=calculated.socialSecurityTaxCents+calculated.medicareTaxCents+calculated.additionalMedicareTaxCents+federal+state
  calculated.retirementPlans=[{planId:proposal.planId,calculation:{...proposal.calculation,planName:proposal.planName,retirement401k:proposal.retirement401k,source:proposal.source,wageSource:{grossWagesCents:calculated.grossPayCents,compensation415Cents:proposal.calculation.compensation415Cents,unusedPto:proposal.calculation.unusedPto,annualBonusCents:0},requiresPayrollIntegration:false,availablePayEvidence:{version:2,grossPayCents:calculated.grossPayCents,reimbursementCents:0,netPayBeforeDeductionCents:calculated.grossPayCents-employeeTaxCents,netPayAfterRetirementCents:calculated.netPayCents,wageNetAfterRetirementCents:calculated.netPayCents,employeeTaxCents,totalDeductionCents:pretax+roth,withholdingBasis:context.stateMethod==='MD_LUMP_SUM'?'POST_DEFERRAL_NATIVE':'POST_DEFERRAL_REVIEW'}}}]
 }
 if(proposal&&!integrated)calculated.netPayCents=null
 if(state!==null&&federal!==null&&(!retirementCandidates.length||integrated))calculated.incomeTaxWageBasis={version:1,source:'NATIVE_ENGINE',year,workState:employee.work_state,residenceState:employee.residence_state,grossWagesCents:calculated.grossPayCents,federalWagesCents:calculated.grossPayCents-pretax,marylandWagesCents:calculated.grossPayCents-pretax,marylandRegularWagesCents:calculated.grossPayCents-pretax,marylandAnnualBonusWagesCents:0,pretaxDeductionCents:pretax,...(integrated?{retirement401k:proposal.taxWages}:{}),stateWithholdingSource:context.stateMethod==='MD_LUMP_SUM'?'NATIVE_MD_LUMP_SUM':'REVIEWED_PTO_CALCULATION',...(calculated.ptoStateWithholdingCalculation?{stateCalculation:calculated.ptoStateWithholdingCalculation,stateTaxComponents:calculated.ptoStateTaxComponents}:{})}
 calculated.offcycleFingerprint=createHash('sha256').update(JSON.stringify([...(calculated.ptoStateWithholdingCalculation?[context.stateMethod,calculated.ptoStateWithholdingCalculation]:[]),...(context.stateWithholdingReview?[context.stateWithholdingReview]:[]),...(retirementPtoProposals.length?[retirementPtoProposals.map(p=>p.fingerprint)]:[]),...(retirementPtoAssessments.length?[retirementPtoAssessments.map(a=>a.fingerprint)]:[]),...(context.retirementPtoEvidence?[context.retirementPtoEvidence]:[]),employeeId,Number(payout.id),Number(payout.amount_cents),Number(payout.minutes),payout.review.fingerprint,context.historySource,context.historyCompleteVerified,context.federalMethod,aggregateBasis?.fingerprint,history.fingerprint,paymentDate,Number(periodId)])).digest('hex')
 calculated.supplementalTax={...taxBreakdown,...(integrated?{retirementAllocation:{version:1,kind:'LEAVE_PAYOUT',payoutId:Number(payout.id),grossCents:calculated.grossPayCents,pretaxCents:pretax,incomeTaxWagesCents:calculated.grossPayCents-pretax,proposalFingerprint:proposal.fingerprint}}:{}),...(aggregateBasis?{aggregateBasis}:{}),historyFingerprint:history.fingerprint,ytdSupplementalCents:history.ytdSupplementalCents,ytdWagesCents:ytd}
 for(const assessment of retirementPtoAssessments)for(const message of assessment.issues)calculated.warnings.push({code:'RETIREMENT_PTO_EVIDENCE_REVIEW',severity:'critical',blocking:true,message:`${assessment.planName}: ${message}`})
 if(!integrated)calculated.warnings.push(...await retirementOffCycleWarnings(db,facility,Number(employee.id),paymentDate))
 const warnings=[...calculated.warnings.map(w=>({...w,employeeId:Number(employee.id)})),...await standaloneComplianceWarnings(db,facility)]
 if(!settings.legal_business_name||!settings.business_address||!settings.onboarding_policy?.businessPhone)warnings.push({code:'EMPLOYER_STATEMENT_DETAILS',severity:'critical',blocking:true,message:'Complete employer name, address and telephone before payment.'})
 const order=(await db.query(`SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND r.run_kind<>'OFF_CYCLE_REIMBURSEMENT' AND r.status IN ('APPROVED','FINALIZED') AND COALESCE(r.payment_date,p.pay_date)>$2::date AND EXTRACT(YEAR FROM COALESCE(r.payment_date,p.pay_date))=$3 LIMIT 1`,[facility,paymentDate,year])).rows
 if(order.length)warnings.push({code:'PAYMENT_ORDER_REVIEW_REQUIRED',severity:'critical',blocking:true,message:'A later taxable payroll is already committed. Resolve its year-to-date tax impact before paying an earlier PTO payout.'})
 const prior=(await db.query("SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND r.status='APPROVED' AND r.run_kind<>'OFF_CYCLE_REIMBURSEMENT' AND COALESCE(r.payment_date,p.pay_date)<=$2::date AND r.id IS DISTINCT FROM $3::bigint LIMIT 1",[facility,paymentDate,runId])).rows
 if(prior.length)warnings.push({code:'PRIOR_PAYMENT_NOT_FINALIZED',severity:'critical',blocking:true,message:'Finalize earlier approved taxable payments before calculating this PTO payout.'})
 return {context,period:{...period,pay_date:paymentDate},preview:{runKind:'OFF_CYCLE_PTO',calculationVersion:'off-cycle-pto-v1',employees:[calculated],grossPayCents:calculated.grossPayCents,employeeTaxCents:calculated.socialSecurityTaxCents+calculated.medicareTaxCents+calculated.additionalMedicareTaxCents+Number(federal||0)+Number(state||0),employerTaxCents:calculated.employerSocialSecurityTaxCents+calculated.employerMedicareTaxCents+calculated.futaTaxCents+calculated.mdUiTaxCents,deductionCents:calculated.totalDeductionCents,reimbursementCents:0,netPayCents:calculated.netPayCents,warnings,canApprove:!warnings.some(w=>w.blocking),paymentDate}}
}
