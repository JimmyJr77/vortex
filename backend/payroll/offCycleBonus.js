import {assertNativeW4ExemptionDate,assertNativeMW507Date} from './withholding2026.js'
import {loadOptionalMarylandAdditionalPeriod} from './loadMarylandAdditionalPeriod.js'
import {marylandElectionFingerprint} from './marylandElectionFingerprint.js'
import {regularRetirementPayroll} from './regularRetirementPayroll.js'
import {retirement401kTaxWages} from './retirement401kTaxWages.js'
import {loadAggregatePaymentBasis} from './aggregatePaymentBasis.js'
import {assertEmploymentPaymentDate} from './employmentPeriods.js'
import {standaloneComplianceWarnings} from './employerSetup.js'
import {previewEarnedBonus} from './earnedBonusAllocation.js'
import {loadBonusPaymentCoverage} from './bonusPaymentCoverage.js'
import {createHash} from 'node:crypto'
import {validateBonus} from './bonuses.js'
import {buildEmployeePreview} from './payrollEngine.js'
import {marylandWithholding2026} from './withholding2026.js'
import {federalSupplementalWithholding2026} from './supplementalWithholding2026.js'
import {loadSupplementalPaymentHistory} from './supplementalPaymentHistory.js'
const fail=message=>Object.assign(new Error(message),{status:409})
export function validateOffCycleBonus(body){
 if(body.federalMethod!==undefined&&!['FLAT_22','AGGREGATE'].includes(body.federalMethod))throw fail('Select flat or aggregate federal supplemental withholding.')
 const review=validateBonus(body)
 if(body.stateBonusRateVerified!==true)throw fail('Verify that the employee residence uses the 9.70% Maryland annual-bonus rate, including the highest applicable local rate.')
 if(!Number.isSafeInteger(Number(body.employeeId))||Number(body.employeeId)<=0)throw fail('Select an employee for the bonus.')
 if(body.historyCompleteVerified!==true||String(body.historySource||'').trim().length<20)throw fail('Reconcile complete employer and related-employer payment history and record its source before standalone withholding.')
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(String(body.requestKey||'')))throw fail('Use a unique bonus payment request reference.')
 return {...(body.federalMethod==='AGGREGATE'?{federalMethod:'AGGREGATE'}:{}),version:1,stateBonusRateVerified:true,employeeId:Number(body.employeeId),amountCents:body.amountCents,review,historyCompleteVerified:true,historySource:String(body.historySource).trim().slice(0,2000),requestKey:String(body.requestKey)}
}
export async function loadOffCycleBonusPreview(db,facility,periodId,paymentDate,context,runId=null){
 const result=await loadBaseBonusPreview(db,facility,periodId,paymentDate,context,undefined,runId)
 return regularRetirementPayroll(db,facility,result,runId,inputs=>loadBaseBonusPreview(db,facility,periodId,paymentDate,context,inputs[context.employeeId],runId),'OFF_CYCLE')
}
async function loadBaseBonusPreview(db,facility,periodId,paymentDate,context,retirement401k,runId=null){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(paymentDate))||!Number.isFinite(Date.parse(paymentDate))||new Date(paymentDate).toISOString().slice(0,10)!==paymentDate)throw fail('Choose a valid standalone bonus payment date.')
 const employee=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,context.employeeId])).rows[0]
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
 let bonusAllocation=null,allocationIssue=null
 if(context.review.classification==='NONDISCRETIONARY')try{
  const allocation=await previewEarnedBonus(db,facility,employee.id,{amountCents:context.amountCents,earnedStart:context.review.earnedStart,earnedEnd:context.review.earnedEnd})
  if(allocation.fingerprint!==context.review.allocationFingerprint)throw fail('Earned bonus inputs changed. Recalculate and review the allocation before payment.')
  if(allocation.earnedEnd>paymentDate||allocation.weeks.some(w=>new Date(Date.parse(w.week)+7*86400000).toISOString().slice(0,10)>paymentDate))throw fail('The complete earned-bonus workweeks must close before the payment date.')
  const coverage=await loadBonusPaymentCoverage(db,facility,employee.id,allocation,{...period,pay_date:paymentDate},{requireFinalized:true})
  bonusAllocation={version:allocation.version,method:allocation.method,earnedStart:allocation.earnedStart,earnedEnd:allocation.earnedEnd,bonusCents:allocation.bonusCents,additionalOvertimeCents:allocation.additionalOvertimeCents,weeks:allocation.weeks,fingerprint:allocation.fingerprint,coverage}
 }catch(e){allocationIssue=e.message}
 const adjustments=[{kind:'BONUS',name:'Standalone annual bonus',amountCents:context.amountCents,taxTreatmentVerified:true,bonusReview:{...context.review,verifiedAt:'off-cycle-reviewed'},...(bonusAllocation?{bonusAllocation}:{})}]
 if(bonusAllocation?.additionalOvertimeCents>0)adjustments.push({kind:'BONUS_OVERTIME',name:'Earned bonus additional overtime',amountCents:bonusAllocation.additionalOvertimeCents,taxTreatmentVerified:true,federalSupplemental:true})
 const calculated=buildEmployeePreview({employee:{id:Number(employee.id),payType:'HOURLY',hourlyRateCents:0,legalFirstName:employee.legal_first_name,legalLastName:employee.legal_last_name,w4Status:employee.w4_status,stateWithholdingStatus:employee.state_withholding_status,workState:employee.work_state,residenceState:employee.residence_state},entries:[],adjustments,ytdSocialSecurityWagesCents:ytd,taxElection:election,payPeriod:{...period,pay_date:paymentDate},payFrequency:period.frequency,taxYear:year,employerTaxConfig:settings.employer_tax_config})
 if(retirement401k){
  // Standalone withholding is calculated below; the regular-wage engine
  // intentionally refuses a bonus without concurrent regular wages.
  const wages=retirement401kTaxWages({...retirement401k,grossCents:calculated.grossPayCents,annualBonusCents:context.amountCents,year,workState:employee.work_state,residenceState:employee.residence_state})
  if(calculated.totalDeductionCents!==0)throw fail('Reconcile other deductions before standalone retirement processing.')
  calculated.retirement401k=wages;calculated.pretaxDeductionCents=wages.pretaxCents;calculated.posttaxDeductionCents=wages.rothCents;calculated.totalDeductionCents=wages.pretaxCents+wages.rothCents
  for(const [kind,amountCents] of [['RETIREMENT_401K_PRETAX',wages.pretaxCents],['RETIREMENT_401K_ROTH',wages.rothCents]])if(amountCents)calculated.payItems.push({kind,name:kind==='RETIREMENT_401K_PRETAX'?'401(k) pretax':'401(k) Roth',amountCents})
  calculated.incomeTaxWageBasis={version:1,source:'NATIVE_ENGINE',year,workState:employee.work_state,residenceState:employee.residence_state,grossWagesCents:calculated.grossPayCents,federalWagesCents:wages.federalWagesCents,marylandWagesCents:wages.marylandWagesCents,marylandRegularWagesCents:wages.marylandRegularWagesCents,marylandAnnualBonusWagesCents:wages.marylandAnnualBonusWagesCents,pretaxDeductionCents:wages.pretaxCents,retirement401k:wages}
 }
 if(allocationIssue)calculated.warnings.push({code:'BONUS_PAYMENT_RECONCILIATION',severity:'critical',blocking:true,message:allocationIssue})
 calculated.payType=employee.pay_type;calculated.sickLeaveAccrualMinutes=0
 calculated.warnings=calculated.warnings.filter(w=>w.code!=='WITHHOLDING_ENGINE_NOT_CONFIGURED'&&w.code!=='NEGATIVE_NET_PAY')
 if(!history.reconciled)calculated.warnings.push({code:'SUPPLEMENTAL_HISTORY_REVIEW',severity:'critical',blocking:true,message:'Reconcile supplemental payment history and imported totals before paying this bonus.'})
 let federal=null,state=null,taxBreakdown=null,aggregateBasis=null
 try{
  if(context.stateBonusRateVerified!==true||!election||year!==2026||employee.work_state!=='MD'||employee.residence_state!=='MD'||election.maryland?.exempt||election.federal?.nonresidentAlien||election.federal?.lockInLetter)throw fail('This standalone method requires verified 2026 Maryland resident elections without a state exemption, nonresident or lock-in exception.')
  marylandWithholding2026(0,election.maryland,period.frequency)
  if(context.federalMethod==='AGGREGATE'&&history.ytdSupplementalCents<100000000)aggregateBasis=await loadAggregatePaymentBasis(db,facility,history,paymentDate)
  taxBreakdown=federalSupplementalWithholding2026({paymentCents:calculated.retirement401k?.federalWagesCents??calculated.grossPayCents,ytdSupplementalCents:history.ytdSupplementalCents,historyVerified:history.reconciled&&context.historyCompleteVerified===true,year,method:context.federalMethod||'FLAT_22',regularWithholdingVerified:history.regularWithholdingVerified,...(aggregateBasis?{aggregate:{...aggregateBasis,verified:true,election:{...election.federal,verified:true}}}:{})})
  federal=taxBreakdown.federalIncomeTaxCents;
  if(bonusAllocation?.additionalOvertimeCents>0)throw fail('Record a verified Maryland income-tax calculation for the annual bonus and additional overtime before approving this standalone payment.')
  state=Number((BigInt(calculated.retirement401k?.marylandAnnualBonusWagesCents??context.amountCents)*970n+5000n)/10000n)
  const baseState=state,allocation=await loadOptionalMarylandAdditionalPeriod(db,{facility,employeeId:employee.id,paymentDate,excludeRunId:runId}),extra=allocation?.remainingAdditionalCents??0
  const totalState=BigInt(baseState)+BigInt(extra);if(totalState>BigInt(Number.MAX_SAFE_INTEGER))throw fail('Maryland withholding exceeds safe cent precision.')
  state=Number(totalState)
  calculated.incomeTaxWageBasis??={version:1,source:'NATIVE_ENGINE',year,workState:employee.work_state,residenceState:employee.residence_state,grossWagesCents:calculated.grossPayCents,federalWagesCents:calculated.grossPayCents,marylandWagesCents:calculated.grossPayCents,marylandRegularWagesCents:0,marylandAnnualBonusWagesCents:calculated.grossPayCents,pretaxDeductionCents:0}
  calculated.incomeTaxWageBasis.stateTaxComponents={version:1,method:'BONUS_PERIOD',payFrequency:period.frequency,regularBaseCents:0,annualBonusTaxCents:baseState,requestedAdditionalCents:election.maryland.extraWithholdingCents??0,appliedAdditionalCents:extra,totalCents:state,exempt:false,electionFingerprint:marylandElectionFingerprint(election.maryland),...(allocation?{allocation}:{})}

 }catch(e){calculated.warnings.push({code:'WITHHOLDING_ENGINE_NOT_CONFIGURED',severity:'critical',blocking:true,message:e.message})}
 calculated.federalIncomeTaxCents=federal;calculated.stateIncomeTaxCents=state
 calculated.withholdingMethod=federal!==null&&state!==null?'2026-standalone-federal-supplemental-md-annual-bonus-9.70':null
 calculated.netPayCents=federal!==null&&state!==null?calculated.grossPayCents-calculated.socialSecurityTaxCents-calculated.medicareTaxCents-calculated.additionalMedicareTaxCents-federal-state-calculated.totalDeductionCents:null
 if(calculated.netPayCents!==null&&calculated.netPayCents<0)calculated.warnings.push({code:'NEGATIVE_NET_PAY',severity:'critical',blocking:true,message:'Calculated taxes exceed this bonus payment.'})
 calculated.offcycleFingerprint=createHash('sha256').update(JSON.stringify([...(calculated.incomeTaxWageBasis?.stateTaxComponents?.allocation?[calculated.incomeTaxWageBasis.stateTaxComponents.allocation]:[]),context.employeeId,context.amountCents,context.review.classification,context.review.paymentType,context.review.source,context.review.earnedStart,context.review.earnedEnd,context.review.allocationFingerprint,bonusAllocation?.coverage?.evidence.map(e=>[e.entryId,e.workDate,e.runId]),context.review.amountDiscretionVerified,context.review.paymentDiscretionVerified,context.review.noPriorPromiseVerified,context.historySource,context.stateBonusRateVerified,context.requestKey,context.federalMethod,aggregateBasis?.fingerprint,history.fingerprint,paymentDate,Number(periodId)])).digest('hex')
 calculated.supplementalTax={...taxBreakdown,...(aggregateBasis?{aggregateBasis}:{}),historyFingerprint:history.fingerprint,ytdSupplementalCents:history.ytdSupplementalCents,ytdWagesCents:ytd}
 const warnings=[...calculated.warnings.map(w=>({...w,employeeId:Number(employee.id)})),...await standaloneComplianceWarnings(db,facility)]
 if(!settings.legal_business_name||!settings.business_address||!settings.onboarding_policy?.businessPhone)warnings.push({code:'EMPLOYER_STATEMENT_DETAILS',severity:'critical',blocking:true,message:'Complete employer name, address and telephone before payment.'})
 const order=(await db.query(`SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND r.run_kind<>'OFF_CYCLE_REIMBURSEMENT' AND r.status IN ('APPROVED','FINALIZED') AND COALESCE(r.payment_date,p.pay_date)>$2::date AND EXTRACT(YEAR FROM COALESCE(r.payment_date,p.pay_date))=$3 LIMIT 1`,[facility,paymentDate,year])).rows
 if(order.length)warnings.push({code:'PAYMENT_ORDER_REVIEW_REQUIRED',severity:'critical',blocking:true,message:'A later taxable payroll is already committed. Resolve its year-to-date tax impact before paying an earlier bonus.'})
 const prior=(await db.query("SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND r.status='APPROVED' AND r.run_kind<>'OFF_CYCLE_REIMBURSEMENT' AND COALESCE(r.payment_date,p.pay_date)<=$2::date AND (r.offcycle_context->>'requestKey' IS DISTINCT FROM $3) LIMIT 1",[facility,paymentDate,context.requestKey])).rows
 if(prior.length)warnings.push({code:'PRIOR_PAYMENT_NOT_FINALIZED',severity:'critical',blocking:true,message:'Finalize earlier approved taxable payments before calculating this bonus.'})
 return {context,period:{...period,pay_date:paymentDate},preview:{runKind:'OFF_CYCLE_BONUS',calculationVersion:'off-cycle-bonus-v1',employees:[calculated],grossPayCents:calculated.grossPayCents,employeeTaxCents:calculated.socialSecurityTaxCents+calculated.medicareTaxCents+calculated.additionalMedicareTaxCents+Number(federal||0)+Number(state||0),employerTaxCents:calculated.employerSocialSecurityTaxCents+calculated.employerMedicareTaxCents+calculated.futaTaxCents+calculated.mdUiTaxCents,deductionCents:calculated.totalDeductionCents,reimbursementCents:0,netPayCents:calculated.netPayCents,warnings,canApprove:!warnings.some(w=>w.blocking),paymentDate}}
}
