import {authorizedSettlementEarnings} from './authorizedSettlementEarnings.js'
import {splitCompensationEarnings} from './splitCompensation.js'
import {salaryExtraStraightTime} from './fixedSalaryAgreement.js'
import {calculateSalary,salaryOvertimeCents} from './salaryCalculation.js'
import { calculateWeightedHourlyWeek, allocateWorkweekPayments, applyWeightedWorkweekPremiums } from './weightedOvertime.js'
import { previousBankBusinessDay } from './bankCalendar.js'
import { employerTaxes2026 } from './employerTaxes.js'
import { calculateWithholding2026 } from './withholding2026.js'
const MINUTES_PER_OVERTIME_WEEK = 40 * 60

export const PAYROLL_CALCULATION_VERSION = 'us-md-2026-preview-v1'
export const PAYROLL_TAX_REFERENCE = Object.freeze({
  version: PAYROLL_CALCULATION_VERSION,
  effectiveYear: 2026,
  socialSecurityEmployeeRate: 0.062,
  socialSecurityEmployerRate: 0.062,
  socialSecurityWageBaseCents: 18_450_000,
  medicareEmployeeRate: 0.0145,
  medicareEmployerRate: 0.0145,
  additionalMedicareEmployeeRate: 0.009,
  additionalMedicareWithholdingThresholdCents: 20_000_000,
})

export function calculateMarylandSickAccrual({
  workedMinutes,
  payFrequency,
  yearAccruedMinutes = 0,
  annualCapMinutes = 40 * 60,
  previousPeriodWorkedMinutes,
  currentBalanceMinutes = 0,
  balanceCapMinutes = 64 * 60,
  priorRemainder = 0,
}) {
  const worked = Number(workedMinutes)
  if(!Number.isSafeInteger(priorRemainder)||priorRemainder<0||priorRemainder>=30)throw new Error('Verify the sick-leave fractional remainder before calculating accrual.')
  const noAccrual={minutes:0,remainder:priorRemainder}
  if(!Number.isSafeInteger(currentBalanceMinutes)||!Number.isSafeInteger(balanceCapMinutes)||balanceCapMinutes<0)throw new Error('Verify the sick-leave balance and balance cap before calculating accrual.')
  if (!Number.isInteger(worked) || worked < 0) throw new Error('Worked minutes must be a non-negative integer.')
  if (payFrequency === 'SEMIMONTHLY' && worked < 26 * 60) return noAccrual
  if (payFrequency === 'BIWEEKLY' && worked < 24 * 60) return noAccrual
  if (worked === 0) return noAccrual
  if (payFrequency === 'WEEKLY' && worked < 24 * 60) {
    if (!Number.isSafeInteger(previousPeriodWorkedMinutes) || previousPeriodWorkedMinutes < 0) throw new Error('Verify worked hours in the immediately preceding pay period before calculating sick leave.')
    if (worked + previousPeriodWorkedMinutes < 24 * 60) return noAccrual
  }
  const remaining = Math.max(0, Number(annualCapMinutes) - Number(yearAccruedMinutes))
  const capacity=Math.min(remaining,Math.max(0,balanceCapMinutes-currentBalanceMinutes))
  const numerator=worked+priorRemainder
  const minutes=Math.min(capacity,Math.floor(numerator/30))
  return {minutes,remainder:numerator>=capacity*30?0:numerator%30}
}

export function calculateMarylandSickAccrualMinutes(options){return calculateMarylandSickAccrual(options).minutes}

function utcDate(dateOnly) {
  const value = new Date(`${dateOnly}T00:00:00.000Z`)
  if (Number.isNaN(value.valueOf())) throw new Error(`Invalid date: ${dateOnly}`)
  return value
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10)
}

function addUtcDays(date, days) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function calculateWorkedMinutes(clockIn, clockOut, unpaidBreakMinutes = 0) {
  if(!clockIn || !clockOut)throw new Error('Clock-in and clock-out are required.')
  const start = new Date(clockIn)
  const end = new Date(clockOut)
  const breakMinutes = Number(unpaidBreakMinutes)
  if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || end <= start) {
    throw new Error('Clock-out must be after clock-in.')
  }
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 1440) throw new Error('Break minutes must be an integer from 0 through 1440.')
  const elapsedMinutes = Math.round((end.valueOf() - start.valueOf()) / 60_000)
  if (breakMinutes >= elapsedMinutes) throw new Error('Break minutes must be shorter than the shift.')
  return elapsedMinutes - breakMinutes
}

export function workweekStartFor(dateValue, startsOn = 1, timezone = 'UTC') {
  if (!Number.isInteger(startsOn) || startsOn < 0 || startsOn > 6) throw new Error('Workweek start must be 0 through 6.')
  const instant = new Date(dateValue)
  if (!Number.isFinite(instant.valueOf())) throw new Error('Invalid workweek date.')
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant)
  const part = (key) => parts.find(item => item.type === key).value
  const localDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue)) ? String(dateValue) : `${part('year')}-${part('month')}-${part('day')}`
  const date = utcDate(localDate)
  const distance = (date.getUTCDay() - startsOn + 7) % 7
  return dateOnly(addUtcDays(date, -distance))
}

export function allocateWeeklyOvertime(entries, {
  workweekStartsOn = 1,
  timezone = 'UTC',
  priorApprovedMinutesByWeek = {},
} = {}) {
  const result = []
  const runningMinutes = new Map()
  const sorted = [...entries].sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn))

  for (const entry of sorted) {
    const minutes = entry.minutes ?? calculateWorkedMinutes(entry.clockIn, entry.clockOut, entry.unpaidBreakMinutes)
    const week = workweekStartFor(entry.clockIn, workweekStartsOn, timezone)
    const before = runningMinutes.has(week)
      ? runningMinutes.get(week)
      : Number(priorApprovedMinutesByWeek[week] ?? 0)
    const regularCapacity = Math.max(0, MINUTES_PER_OVERTIME_WEEK - before)
    const regularMinutes = Math.min(minutes, regularCapacity)
    const overtimeMinutes = minutes - regularMinutes
    runningMinutes.set(week, before + minutes)
    result.push({ ...entry, minutes, workweekStart: week, regularMinutes, overtimeMinutes })
  }
  return result
}

function centsForMinutes(rateCents, minutes, multiplier = 1) {
  return Math.round((Number(rateCents) * Number(minutes) * multiplier) / 60)
}

function warning(code, severity, message, blocking = false) {
  return { code, severity, message, blocking }
}

export function buildEmployeePreview({
  employee,
  entries,
  ytdSocialSecurityWagesCents = 0,
  workweekStartsOn = 1,
  timezone = 'UTC',
  priorApprovedMinutesByWeek = {},
  priorApprovedSegmentsByWeek = {},
  adjustments = [],
  taxElection = null,
  payFrequency = 'SEMIMONTHLY',
  taxYear = 2026,
  employerTaxConfig,
  retirement401k,
  weightedSettlements = null,
  payPeriod = null,
}) {
  let settlement=null,settlementError=null
  try{settlement=authorizedSettlementEarnings({reviews:employee.authorizedWorkweeks,entries,payPeriod,adjustments,minutesFor:e=>calculateWorkedMinutes(e.clockIn,e.clockOut,e.unpaidBreakMinutes)})}catch(error){settlementError=error.message}
  if(settlement){adjustments=adjustments.map(a=>a.kind==='PAID_LEAVE'?{...a,amountCents:settlement.leaveEntries.find(e=>e.id===a.leaveId).amountCents,includedInSalary:false,allocatedLeave:settlement.leaveEntries.find(e=>e.id===a.leaveId)}:a.kind==='BONUS'?{...a,allocatedBonus:settlement.bonusPayments.find(b=>b.adjustmentId===a.adjustmentId)}:a);employee={...employee,payType:'HOURLY',hourlyRateCents:1,compensationSegments:undefined};entries=[]}
  let split=null
  if(new Set(employee.compensationSegments?.map(s=>s.payType)).size>1){
    split=splitCompensationEarnings({employee,entries,adjustments,payPeriod,workweekStartsOn,timezone,weekFor:workweekStartFor,
      calculate:(terms,selected,paidLeave)=>buildEmployeePreview({employee:terms,entries:selected,adjustments:paidLeave,payPeriod,workweekStartsOn,timezone,priorApprovedMinutesByWeek,priorApprovedSegmentsByWeek,taxElection,payFrequency,taxYear,employerTaxConfig,ytdSocialSecurityWagesCents,weightedSettlements:terms.payType==='HOURLY'?weightedSettlements:null})})
    employee={...employee,payType:'HOURLY',hourlyRateCents:1}
    entries=[]
    adjustments=adjustments.filter(a=>a.kind!=='PAID_LEAVE')
  }
  const warnings = []
  if(settlementError)warnings.push(warning('AUTHORIZED_SETTLEMENT_COVERAGE','critical',settlementError,true))
  let salaryCalculation=null
  if(employee.payType==='SALARY')try {salaryCalculation=calculateSalary(employee,payPeriod,payFrequency)}catch(error){warnings.push(warning('SALARY_CONFIGURATION_REQUIRED','critical',error.message,true))}
  if (employee.payType !== 'SALARY' && (employee.payType !== 'HOURLY' || !Number.isInteger(employee.hourlyRateCents))) {
    warnings.push(warning('UNSUPPORTED_PAY_CONFIGURATION', 'critical', 'Only configured hourly employees can be calculated in this preview.', true))
  }
  if(salaryCalculation?.classification!=='EXEMPT'&&adjustments.some(a=>a.kind==='BONUS'&&a.bonusReview?.classification!=='DISCRETIONARY'&&!a.bonusAllocation))warnings.push(warning('SALARY_BONUS_REGULAR_RATE_REVIEW','critical','Allocate additional earnings to their workweeks before calculating nonexempt overtime.',true))
  const nonApproved = entries.filter((entry) => entry.status !== 'APPROVED')
  if (nonApproved.length) warnings.push(warning('UNAPPROVED_TIME', 'critical', `${nonApproved.length} time entr${nonApproved.length === 1 ? 'y is' : 'ies are'} not approved.`, true))
  if (employee.w4Status !== 'COMPLETE') warnings.push(warning('MISSING_W4', 'critical', 'Federal Form W-4 is not complete, so federal income-tax withholding cannot be calculated.', true))
  if (employee.stateWithholdingStatus !== 'COMPLETE') warnings.push(warning('MISSING_STATE_WITHHOLDING', 'critical', 'Maryland MW507 is not complete, so state/local withholding cannot be calculated.', true))

  const calculableEntries = entries.filter(entry=>{
    try { calculateWorkedMinutes(entry.clockIn,entry.clockOut,entry.unpaidBreakMinutes);return true }
    catch { warnings.push(warning('INCOMPLETE_TIME','critical','A time entry is open or invalid. Close or correct it before calculating payroll.',true));return false }
  })
  if(taxYear!==PAYROLL_TAX_REFERENCE.effectiveYear)warnings.push(warning('TAX_YEAR_UNSUPPORTED','critical',`The Social Security and Medicare rules are verified for ${PAYROLL_TAX_REFERENCE.effectiveYear}. Update tax rules before approving another tax year.`,true))
  let allocated = allocateWeeklyOvertime(calculableEntries, { workweekStartsOn, timezone, priorApprovedMinutesByWeek })
  const salary=employee.payType==='SALARY'
  if(salaryCalculation?.classification==='EXEMPT')for(const entry of allocated){entry.regularMinutes+=entry.overtimeMinutes;entry.overtimeMinutes=0}
  let regularMinutes = allocated.reduce((sum, entry) => sum + entry.regularMinutes, 0)
  let overtimeMinutes = allocated.reduce((sum, entry) => sum + entry.overtimeMinutes, 0)
  const rates = new Map()
  const weekRates = new Map()
  const currentWeeks=new Set(allocated.map(entry=>entry.workweekStart))
  const weekSegments=new Map()
  for(const [week,segments] of Object.entries(salary?{}:priorApprovedSegmentsByWeek)) {
    if(!currentWeeks.has(week))continue
    weekSegments.set(week,[...segments])
    for(const segment of segments) {
      if(weekRates.has(week)&&weekRates.get(week)!==segment.hourlyRateCents)warnings.push(warning('MIXED_WORKWEEK_RATES','critical','Prior-period work contains different rates in the same workweek and requires weighted overtime reconciliation.',true))
      weekRates.set(week,segment.hourlyRateCents)
    }
  }
  for (const entry of salary?[]:allocated) {
    const rate = entry.hourlyRateCents === undefined ? employee.hourlyRateCents : entry.hourlyRateCents
    if (!Number.isSafeInteger(rate) || rate <= 0) {
      warnings.push(warning('MISSING_EFFECTIVE_PAY_RATE','critical','A workday has no positive effective hourly rate. Verify compensation before approving payroll.',true))
      continue
    }
    if(weekRates.has(entry.workweekStart)&&weekRates.get(entry.workweekStart)!==rate)warnings.push(warning('MIXED_WORKWEEK_RATES','critical','Different rates within one workweek need a verified regular-rate overtime calculation.',true))
    weekRates.set(entry.workweekStart,rate)
    weekSegments.set(entry.workweekStart,[...(weekSegments.get(entry.workweekStart)??[]),{minutes:entry.regularMinutes+entry.overtimeMinutes,hourlyRateCents:rate}])
    const group=rates.get(rate)||{hourlyRateCents:rate,regularMinutes:0,overtimeMinutes:0}
    group.regularMinutes+=entry.regularMinutes;group.overtimeMinutes+=entry.overtimeMinutes;rates.set(rate,group)
  }
  let workweekEarnings=[]
  for(const [week,segments] of weekSegments) {
    if(!currentWeeks.has(week))continue
    try {
      const priorMinutes=(priorApprovedSegmentsByWeek[week]??[]).reduce((sum,s)=>sum+s.minutes,0)
      if(priorMinutes!==Number(priorApprovedMinutesByWeek[week]??0))throw new Error('Prior-period earnings do not cover the carried workweek hours.')
      workweekEarnings.push({week,scope:'THROUGH_PAY_PERIOD_END',...calculateWeightedHourlyWeek(segments)})
    }catch(error){warnings.push(warning('WORKWEEK_EARNINGS_INCOMPLETE','critical',error.message,true))}
  }
  let rateBreakdown=[...rates.values()].map(group=>({...group,regularPayCents:centsForMinutes(group.hourlyRateCents,group.regularMinutes),overtimePayCents:centsForMinutes(group.hourlyRateCents,group.overtimeMinutes,1.5)}))
  let workweekPayments=[]
  try {workweekPayments=allocateWorkweekPayments((salary?[]:allocated).map(entry=>({week:entry.workweekStart,hourlyRateCents:entry.hourlyRateCents??employee.hourlyRateCents,regularMinutes:entry.regularMinutes,overtimeMinutes:entry.overtimeMinutes})),rateBreakdown)}
  catch(error){warnings.push(warning('WORKWEEK_PAYMENT_ALLOCATION','critical',error.message,true))}
  let weightedOvertimeApplied=false
  if(!salary&&weightedSettlements!==null)try {
    for(const [week,segments] of weekSegments)if(new Set(segments.map(s=>s.hourlyRateCents)).size>1&&!weightedSettlements.some(s=>s.week===week))throw new Error('Every mixed-rate workweek requires a verified settlement.')
    const applied=applyWeightedWorkweekPremiums(allocated.map(entry=>({week:entry.workweekStart,hourlyRateCents:entry.hourlyRateCents??employee.hourlyRateCents,regularMinutes:entry.regularMinutes,overtimeMinutes:entry.overtimeMinutes})),rateBreakdown,weightedSettlements)
    rateBreakdown=applied.rateBreakdown;workweekPayments=applied.workweekPayments;weightedOvertimeApplied=true
    for(let i=warnings.length-1;i>=0;i--)if(warnings[i].code==='MIXED_WORKWEEK_RATES')warnings.splice(i,1)
  }catch(error){warnings.push(warning('WEIGHTED_SETTLEMENT_REQUIRED','critical',error.message,true))}
  let regularPayCents = salary ? (salaryCalculation?.regularPayCents??0) : rateBreakdown.reduce((sum,rate)=>sum+rate.regularPayCents,0)
  let overtimePayCents = salaryCalculation ? salaryOvertimeCents(salaryCalculation,overtimeMinutes) : rateBreakdown.reduce((sum,rate)=>sum+rate.overtimePayCents,0)
  let salaryExtra={minutes:0,amountCents:0}
  if(salaryCalculation)try{salaryExtra=salaryExtraStraightTime(salaryCalculation,allocated,priorApprovedMinutesByWeek);salaryCalculation.extraStraightTimeMinutes=salaryExtra.minutes;salaryCalculation.extraStraightTimePayCents=salaryExtra.amountCents}catch(error){warnings.push(warning('SALARY_EXTRA_PAY_REVIEW','critical',error.message,true))}
  let paidLeavePayCents = 0
  let paidLeaveMinutes = 0
  let otherTaxablePayCents = salaryExtra.amountCents
  let reimbursementCents = 0
  let pretaxDeductionCents = 0
  let posttaxDeductionCents = 0
  let garnishmentCents = 0
  for (const adjustment of adjustments) {
    const amount = Number(adjustment.amountCents ?? 0)
    if (!Number.isInteger(amount) || amount < 0) {
      warnings.push(warning('INVALID_ADJUSTMENT', 'critical', 'An earning or deduction has an invalid amount.', true))
      continue
    }
    if (!adjustment.taxTreatmentVerified) {
      warnings.push(warning('UNVERIFIED_ADJUSTMENT_TAX_TREATMENT', 'critical', `${adjustment.name || 'An adjustment'} needs documented authorization and verified tax treatment.`, true))
      continue
    }
    if (adjustment.kind === 'PAID_LEAVE') { paidLeaveMinutes += Number(adjustment.minutes || 0); if(!salary){paidLeavePayCents += amount;otherTaxablePayCents += amount} }
    if (adjustment.kind === 'BONUS'||adjustment.kind === 'BONUS_OVERTIME'||adjustment.kind === 'LEAVE_PAYOUT'||adjustment.kind === 'WAGE_CORRECTION') otherTaxablePayCents += amount
    if (adjustment.kind === 'REIMBURSEMENT') reimbursementCents += amount
    if (adjustment.kind === 'PRETAX_DEDUCTION') pretaxDeductionCents += amount
    if (adjustment.kind === 'POSTTAX_DEDUCTION') posttaxDeductionCents += amount
    if (adjustment.kind === 'GARNISHMENT') garnishmentCents += amount
  }
  if(split){
    regularPayCents=split.regularPayCents;overtimePayCents=split.overtimePayCents
    regularMinutes=split.regularMinutes;overtimeMinutes=split.overtimeMinutes
    paidLeavePayCents=split.paidLeavePayCents;paidLeaveMinutes=split.paidLeaveMinutes
    otherTaxablePayCents+=split.otherTaxablePayCents;salaryExtra.amountCents=split.salaryExtraCents
    allocated=split.entries;rateBreakdown=split.rateBreakdown;workweekEarnings=split.workweekEarnings;workweekPayments=split.workweekPayments;weightedOvertimeApplied=split.weightedOvertimeApplied
    warnings.push(...split.warnings)
  }
  if(settlement){regularPayCents=settlement.regularPayCents;overtimePayCents=settlement.overtimePayCents;regularMinutes=settlement.regularMinutes;overtimeMinutes=settlement.overtimeMinutes;allocated=settlement.entries;rateBreakdown=[];workweekPayments=settlement.workweekPayments;workweekEarnings=settlement.evidence.map(e=>({...e,scope:'COMPLETE_WORKWEEK'}))}
  const grossPayCents = regularPayCents + overtimePayCents + otherTaxablePayCents
  const remainingSocialSecurityBase = Math.max(0, PAYROLL_TAX_REFERENCE.socialSecurityWageBaseCents - ytdSocialSecurityWagesCents)
  const socialSecurityTaxableCents = Math.min(grossPayCents, remainingSocialSecurityBase)
  const socialSecurityTaxCents = Math.round(socialSecurityTaxableCents * PAYROLL_TAX_REFERENCE.socialSecurityEmployeeRate)
  const medicareTaxCents = Math.round(grossPayCents * PAYROLL_TAX_REFERENCE.medicareEmployeeRate)
  const additionalMedicareTaxableCents = Math.max(0, ytdSocialSecurityWagesCents + grossPayCents - PAYROLL_TAX_REFERENCE.additionalMedicareWithholdingThresholdCents)
    - Math.max(0, ytdSocialSecurityWagesCents - PAYROLL_TAX_REFERENCE.additionalMedicareWithholdingThresholdCents)
  const additionalMedicareTaxCents = Math.round(additionalMedicareTaxableCents * PAYROLL_TAX_REFERENCE.additionalMedicareEmployeeRate)

  let employerTaxes={futaTaxCents:0,mdUiTaxCents:0}
  if(employerTaxConfig!==undefined)try {employerTaxes=employerTaxes2026({grossCents:grossPayCents,ytdWagesCents:ytdSocialSecurityWagesCents,config:employerTaxConfig,year:taxYear,workState:employee.workState,pretaxDeductionCents})}catch(error){warnings.push(warning('EMPLOYER_TAX_SETUP_REQUIRED','critical',error.message,true))}
  let withholding = null
  try { withholding=calculateWithholding2026({grossPayCents,paymentDate:payPeriod?.pay_date?new Date(payPeriod.pay_date).toISOString().slice(0,10):undefined,election:taxElection,payFrequency,year:taxYear,workState:employee.workState,residenceState:employee.residenceState,pretaxDeductionCents,retirement401k,regularWagesCents:regularPayCents+overtimePayCents+salaryExtra.amountCents+paidLeavePayCents,leavePayoutCents:adjustments.filter(a=>a.kind==='LEAVE_PAYOUT'&&a.taxTreatmentVerified).reduce((sum,a)=>sum+Number(a.amountCents),0),hasBonus:adjustments.some(a=>a.kind==='BONUS'),annualBonusCents:adjustments.filter(a=>a.kind==='BONUS'&&a.taxTreatmentVerified&&a.bonusReview?.paymentType==='ANNUAL_LUMP_SUM').reduce((sum,a)=>sum+Number(a.amountCents),0),bonusReviewComplete:adjustments.filter(a=>a.kind==='BONUS').every(a=>a.taxTreatmentVerified&&a.bonusReview?.verifiedAt&&a.bonusReview?.paymentType==='ANNUAL_LUMP_SUM'),ytdWagesCents:ytdSocialSecurityWagesCents}) }
  catch(error) { warnings.push(warning('WITHHOLDING_ENGINE_NOT_CONFIGURED','critical',error.message,true)) }
  // Only validated typed retirement treatment changes deductions. Generic
  // pretax adjustments remain unsupported, and failed withholding blocks pay.
  const retirementWages=withholding?.incomeTaxWageBasis?.retirement401k
  if(retirementWages){
    pretaxDeductionCents+=retirementWages.pretaxCents
    posttaxDeductionCents+=retirementWages.rothCents
  }
  const netPayCents=withholding?grossPayCents+reimbursementCents-pretaxDeductionCents-posttaxDeductionCents-garnishmentCents-socialSecurityTaxCents-medicareTaxCents-additionalMedicareTaxCents-withholding.federalIncomeTaxCents-withholding.stateIncomeTaxCents:null
  if(netPayCents!==null && netPayCents<0)warnings.push(warning('NEGATIVE_NET_PAY','critical','Taxes and deductions exceed available pay.',true))

  return {
    employeeId: employee.id,
    payType:settlement||split?'MIXED':employee.payType,
    ...(settlement?{authorizedSettlement:settlement.evidence,splitLeaveBasisMinutes:settlement.leaveBasisMinutes}:{}),
    ...(split?{splitCompensation:split.evidence,splitLeaveBasisMinutes:split.leaveBasisMinutes}:{}),
    salaryCalculation,
    payFrequency,
    employeeName: [employee.legalFirstName, employee.legalLastName].filter(Boolean).join(' '),
    hourlyRateCents: settlement||split?null:employee.hourlyRateCents,
    calculationVersion: PAYROLL_CALCULATION_VERSION,
    regularMinutes,
    overtimeMinutes,
    regularPayCents,
    overtimePayCents,
    rateBreakdown,
    otherTaxablePayCents,
    workweekEarnings,
    weightedOvertimeApplied,
    workweekPaymentVersion:1,
    workweekPayments,
    paidLeavePayCents,
    paidLeaveMinutes,
    reimbursementCents,
    pretaxDeductionCents,
    posttaxDeductionCents,
    garnishmentCents,
    totalDeductionCents: pretaxDeductionCents + posttaxDeductionCents + garnishmentCents,
    grossPayCents,
    ...(retirementWages?{retirement401k:retirementWages}:{}),
    federalIncomeTaxCents: withholding?.federalIncomeTaxCents ?? null,
    stateIncomeTaxCents: withholding?.stateIncomeTaxCents ?? null,
    withholdingMethod: withholding?.method ?? null,
    incomeTaxWageBasis: withholding?.incomeTaxWageBasis ?? null,
    payItems: [...(split?.payItems||[]).map(item=>({...item,taxTreatmentVerified:true})),...(!split&&salaryExtra.amountCents>0?[{kind:'SALARY_EXTRA_STRAIGHT_TIME',name:'Additional salary straight-time wages',amountCents:salaryExtra.amountCents,minutes:salaryExtra.minutes,taxTreatmentVerified:true}]:[]),...adjustments].filter(a=>a.taxTreatmentVerified).map(a=>({kind:a.kind,name:a.name,amountCents:salary&&a.kind==='PAID_LEAVE'?0:a.amountCents,minutes:a.minutes,...(a.employmentStart?{employmentStart:a.employmentStart}:{}),...(a.salaryStandardWeeklyHours?{salaryStandardWeeklyHours:a.salaryStandardWeeklyHours}:{}),...(a.federalSupplemental===true?{federalSupplemental:true}:{}),...(a.sourceRequestId?{sourceRequestId:a.sourceRequestId}:{}),...(a.leavePayout?{leavePayout:a.leavePayout}:{}),...(a.allocatedLeave?{allocatedLeave:a.allocatedLeave}:{}),...(a.allocatedBonus?{allocatedBonus:a.allocatedBonus}:{}),...(a.correction?{correction:a.correction}:{}),...(a.bonusAdjustmentId?{bonusAdjustmentId:a.bonusAdjustmentId}:{}),...(a.bonusAllocation?{bonusAllocation:a.bonusAllocation}:{}),...(a.bonusReview?{bonusReview:{version:a.bonusReview.version,classification:a.bonusReview.classification,paymentType:a.bonusReview.paymentType,verifiedAt:a.bonusReview.verifiedAt}}:{}),...((salary&&a.kind==='PAID_LEAVE'||a.includedInSalary===true)?{includedInSalary:true}:{})})).concat(retirementWages?[
      {kind:'RETIREMENT_401K_PRETAX',name:'401(k) pretax employee deferral',amountCents:retirementWages.pretaxCents},
      {kind:'RETIREMENT_401K_ROTH',name:'401(k) Roth employee deferral',amountCents:retirementWages.rothCents},
    ].filter(item=>item.amountCents>0):[]),
    ficaWageBasis: {version:1,calculationReference:PAYROLL_TAX_REFERENCE.version,grossWagesCents:grossPayCents,ytdWagesBeforeCents:ytdSocialSecurityWagesCents,socialSecurityWageBaseCents:PAYROLL_TAX_REFERENCE.socialSecurityWageBaseCents,additionalMedicareThresholdCents:PAYROLL_TAX_REFERENCE.additionalMedicareWithholdingThresholdCents,socialSecurityTaxableCents,medicareTaxableCents:grossPayCents,additionalMedicareTaxableCents},
    socialSecurityTaxCents,
    medicareTaxCents,
    additionalMedicareTaxCents,
    ...employerTaxes,
    employerSocialSecurityTaxCents: socialSecurityTaxCents,
    employerMedicareTaxCents: medicareTaxCents,
    netPayCents,
    warnings,
    entries: allocated,
  }
}

export function buildPayrollPreview({ settings, employees, entries, complianceTasks = [], ytdByEmployee = {}, priorApprovedMinutesByEmployee = {}, priorApprovedSegmentsByEmployee = {}, weightedSettlementsByEmployee = {}, retirement401kByEmployee = {}, adjustments = [], taxYear = 2026, payPeriod = null }) {
  const employeePreviews = employees.map((employee) => buildEmployeePreview({
    employee,
    payPeriod,
    taxElection: employee.taxElection,
    retirement401k: retirement401kByEmployee[employee.id],
    employerTaxConfig: settings.employerTaxConfig ?? null,
    weightedSettlements:weightedSettlementsByEmployee[employee.id]??null,
    taxYear,
    payFrequency: settings.payFrequency,
    entries: entries.filter((entry) => Number(entry.employeeId) === Number(employee.id)),
    ytdSocialSecurityWagesCents: Number(ytdByEmployee[employee.id] ?? 0),
    workweekStartsOn: settings.workweekStartsOn,
    timezone: settings.timezone,
    priorApprovedMinutesByWeek: priorApprovedMinutesByEmployee[employee.id] ?? {},
    priorApprovedSegmentsByWeek: priorApprovedSegmentsByEmployee[employee.id] ?? {},
    adjustments: adjustments.filter((item) => Number(item.employeeId) === Number(employee.id)),
  }))
  const warnings = employeePreviews.flatMap((preview) => preview.warnings.map((item) => ({ ...item, employeeId: preview.employeeId })))
  for (const task of complianceTasks.filter((item) => item.status !== 'COMPLETE' && item.status !== 'NOT_APPLICABLE' && item.severity === 'CRITICAL')) {
    warnings.push(warning(`COMPLIANCE_${task.taskKey}`, 'critical', task.title, true))
  }
  if(!settings.legalBusinessName||!settings.businessAddress||!settings.onboardingPolicy?.businessPhone)warnings.push(warning('EMPLOYER_STATEMENT_DETAILS','critical','Complete employer name, address, and telephone in Employer setup before issuing payroll statements.',true))
  if (settings.payrollExecutionMode === 'RECORD_ONLY') {
    warnings.push(warning('RECORD_ONLY', 'info', 'This system records and reviews payroll; it does not move money or file tax returns.', false))
  }
  return {
    calculationVersion: PAYROLL_CALCULATION_VERSION,
    employees: employeePreviews,
    grossPayCents: employeePreviews.reduce((sum, item) => sum + item.grossPayCents, 0),
    employeeTaxCents: employeePreviews.reduce((sum, item) => sum + item.socialSecurityTaxCents + item.medicareTaxCents + item.additionalMedicareTaxCents + Number(item.federalIncomeTaxCents || 0) + Number(item.stateIncomeTaxCents || 0), 0),
    employerTaxCents: employeePreviews.reduce((sum, item) => sum + item.employerSocialSecurityTaxCents + item.employerMedicareTaxCents + item.futaTaxCents + item.mdUiTaxCents, 0),
    reimbursementCents: employeePreviews.reduce((sum, item) => sum + item.reimbursementCents, 0),
    deductionCents: employeePreviews.reduce((sum, item) => sum + item.totalDeductionCents, 0),
    netPayCents: employeePreviews.every(e=>e.netPayCents!==null)?employeePreviews.reduce((sum,e)=>sum+e.netPayCents,0):null,
    warnings,
    canApprove: warnings.every((item) => !item.blocking),
  }
}

export function generateSemimonthlyPeriods(year, monthIndex, firstPayDay = 5, secondPayDay = 20) {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 12) throw new Error('Use a valid year and month.')
  const pad = (number) => String(number).padStart(2, '0')
  const currentMonth = `${year}-${pad(monthIndex)}`
  const previousEnd = new Date(Date.UTC(year, monthIndex - 1, 0))
  const previousStart = new Date(Date.UTC(previousEnd.getUTCFullYear(), previousEnd.getUTCMonth(), 16))
  const nextMonthFirst = new Date(Date.UTC(year, monthIndex, 1))

  return [
    {
      periodStart: dateOnly(previousStart),
      periodEnd: dateOnly(previousEnd),
      payDate: `${currentMonth}-${pad(firstPayDay)}`,
    },
    {
      periodStart: `${currentMonth}-01`,
      periodEnd: `${currentMonth}-15`,
      payDate: `${currentMonth}-${pad(secondPayDay)}`,
    },
  ].map((period) => ({ ...period, nominalPayDate: period.payDate, payDate: previousBankBusinessDay(period.payDate), frequency: 'SEMIMONTHLY' }))
}
