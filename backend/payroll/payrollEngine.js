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

export function calculateMarylandSickAccrualMinutes({
  workedMinutes,
  payFrequency,
  yearAccruedMinutes = 0,
  annualCapMinutes = 40 * 60,
}) {
  const worked = Number(workedMinutes)
  if (!Number.isInteger(worked) || worked < 0) throw new Error('Worked minutes must be a non-negative integer.')
  if (payFrequency === 'SEMIMONTHLY' && worked < 26 * 60) return 0
  const remaining = Math.max(0, Number(annualCapMinutes) - Number(yearAccruedMinutes))
  return Math.min(remaining, Math.floor(worked / 30))
}

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
  const start = new Date(clockIn)
  const end = new Date(clockOut)
  const breakMinutes = Number(unpaidBreakMinutes)
  if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || end <= start) {
    throw new Error('Clock-out must be after clock-in.')
  }
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) throw new Error('Break minutes must be a non-negative integer.')
  const elapsedMinutes = Math.round((end.valueOf() - start.valueOf()) / 60_000)
  if (breakMinutes >= elapsedMinutes) throw new Error('Break minutes must be shorter than the shift.')
  return elapsedMinutes - breakMinutes
}

export function workweekStartFor(dateValue, startsOn = 1) {
  if (!Number.isInteger(startsOn) || startsOn < 0 || startsOn > 6) throw new Error('Workweek start must be 0 through 6.')
  const date = utcDate(String(dateValue).slice(0, 10))
  const distance = (date.getUTCDay() - startsOn + 7) % 7
  return dateOnly(addUtcDays(date, -distance))
}

export function allocateWeeklyOvertime(entries, {
  workweekStartsOn = 1,
  priorApprovedMinutesByWeek = {},
} = {}) {
  const result = []
  const runningMinutes = new Map()
  const sorted = [...entries].sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn))

  for (const entry of sorted) {
    const minutes = entry.minutes ?? calculateWorkedMinutes(entry.clockIn, entry.clockOut, entry.unpaidBreakMinutes)
    const week = workweekStartFor(entry.clockIn, workweekStartsOn)
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
  priorApprovedMinutesByWeek = {},
  adjustments = [],
}) {
  const warnings = []
  if (employee.payType !== 'HOURLY' || !Number.isInteger(employee.hourlyRateCents)) {
    warnings.push(warning('UNSUPPORTED_PAY_CONFIGURATION', 'critical', 'Only configured hourly employees can be calculated in this preview.', true))
  }
  const nonApproved = entries.filter((entry) => entry.status !== 'APPROVED')
  if (nonApproved.length) warnings.push(warning('UNAPPROVED_TIME', 'critical', `${nonApproved.length} time entr${nonApproved.length === 1 ? 'y is' : 'ies are'} not approved.`, true))
  if (employee.w4Status !== 'COMPLETE') warnings.push(warning('MISSING_W4', 'critical', 'Federal Form W-4 is not complete, so federal income-tax withholding cannot be calculated.', true))
  if (employee.stateWithholdingStatus !== 'COMPLETE') warnings.push(warning('MISSING_STATE_WITHHOLDING', 'critical', 'Maryland MW507 is not complete, so state/local withholding cannot be calculated.', true))
  warnings.push(warning('WITHHOLDING_ENGINE_NOT_CONFIGURED', 'critical', 'Federal, Maryland, and local income-tax withholding tables are not yet configured and verified for this calculation version.', true))

  const allocated = allocateWeeklyOvertime(entries, { workweekStartsOn, priorApprovedMinutesByWeek })
  const regularMinutes = allocated.reduce((sum, entry) => sum + entry.regularMinutes, 0)
  const overtimeMinutes = allocated.reduce((sum, entry) => sum + entry.overtimeMinutes, 0)
  const regularPayCents = centsForMinutes(employee.hourlyRateCents ?? 0, regularMinutes)
  const overtimePayCents = centsForMinutes(employee.hourlyRateCents ?? 0, overtimeMinutes, 1.5)
  let otherTaxablePayCents = 0
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
    if (adjustment.kind === 'BONUS') otherTaxablePayCents += amount
    if (adjustment.kind === 'REIMBURSEMENT') reimbursementCents += amount
    if (adjustment.kind === 'PRETAX_DEDUCTION') pretaxDeductionCents += amount
    if (adjustment.kind === 'POSTTAX_DEDUCTION') posttaxDeductionCents += amount
    if (adjustment.kind === 'GARNISHMENT') garnishmentCents += amount
  }
  const grossPayCents = regularPayCents + overtimePayCents + otherTaxablePayCents
  const remainingSocialSecurityBase = Math.max(0, PAYROLL_TAX_REFERENCE.socialSecurityWageBaseCents - ytdSocialSecurityWagesCents)
  const socialSecurityTaxableCents = Math.min(grossPayCents, remainingSocialSecurityBase)
  const socialSecurityTaxCents = Math.round(socialSecurityTaxableCents * PAYROLL_TAX_REFERENCE.socialSecurityEmployeeRate)
  const medicareTaxCents = Math.round(grossPayCents * PAYROLL_TAX_REFERENCE.medicareEmployeeRate)
  const additionalMedicareTaxableCents = Math.max(0, ytdSocialSecurityWagesCents + grossPayCents - PAYROLL_TAX_REFERENCE.additionalMedicareWithholdingThresholdCents)
    - Math.max(0, ytdSocialSecurityWagesCents - PAYROLL_TAX_REFERENCE.additionalMedicareWithholdingThresholdCents)
  const additionalMedicareTaxCents = Math.round(additionalMedicareTaxableCents * PAYROLL_TAX_REFERENCE.additionalMedicareEmployeeRate)

  return {
    employeeId: employee.id,
    hourlyRateCents: employee.hourlyRateCents,
    calculationVersion: PAYROLL_CALCULATION_VERSION,
    regularMinutes,
    overtimeMinutes,
    regularPayCents,
    overtimePayCents,
    otherTaxablePayCents,
    reimbursementCents,
    pretaxDeductionCents,
    posttaxDeductionCents,
    garnishmentCents,
    totalDeductionCents: pretaxDeductionCents + posttaxDeductionCents + garnishmentCents,
    grossPayCents,
    federalIncomeTaxCents: null,
    stateIncomeTaxCents: null,
    socialSecurityTaxCents,
    medicareTaxCents,
    additionalMedicareTaxCents,
    employerSocialSecurityTaxCents: socialSecurityTaxCents,
    employerMedicareTaxCents: medicareTaxCents,
    netPayCents: null,
    warnings,
    entries: allocated,
  }
}

export function buildPayrollPreview({ settings, employees, entries, complianceTasks = [], ytdByEmployee = {}, priorApprovedMinutesByEmployee = {}, adjustments = [] }) {
  const employeePreviews = employees.map((employee) => buildEmployeePreview({
    employee,
    entries: entries.filter((entry) => Number(entry.employeeId) === Number(employee.id)),
    ytdSocialSecurityWagesCents: Number(ytdByEmployee[employee.id] ?? 0),
    workweekStartsOn: settings.workweekStartsOn,
    priorApprovedMinutesByWeek: priorApprovedMinutesByEmployee[employee.id] ?? {},
    adjustments: adjustments.filter((item) => Number(item.employeeId) === Number(employee.id)),
  }))
  const warnings = employeePreviews.flatMap((preview) => preview.warnings.map((item) => ({ ...item, employeeId: preview.employeeId })))
  for (const task of complianceTasks.filter((item) => item.status !== 'COMPLETE' && item.status !== 'NOT_APPLICABLE' && item.severity === 'CRITICAL')) {
    warnings.push(warning(`COMPLIANCE_${task.taskKey}`, 'critical', task.title, true))
  }
  if (settings.payrollExecutionMode === 'RECORD_ONLY') {
    warnings.push(warning('RECORD_ONLY', 'info', 'This system records and reviews payroll; it does not move money or file tax returns.', false))
  }
  return {
    calculationVersion: PAYROLL_CALCULATION_VERSION,
    employees: employeePreviews,
    grossPayCents: employeePreviews.reduce((sum, item) => sum + item.grossPayCents, 0),
    employeeTaxCents: employeePreviews.reduce((sum, item) => sum + item.socialSecurityTaxCents + item.medicareTaxCents + item.additionalMedicareTaxCents, 0),
    employerTaxCents: employeePreviews.reduce((sum, item) => sum + item.employerSocialSecurityTaxCents + item.employerMedicareTaxCents, 0),
    reimbursementCents: employeePreviews.reduce((sum, item) => sum + item.reimbursementCents, 0),
    deductionCents: employeePreviews.reduce((sum, item) => sum + item.totalDeductionCents, 0),
    netPayCents: null,
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
  const moveWeekendEarlier = (value) => {
    const date = utcDate(value)
    if (date.getUTCDay() === 6) return dateOnly(addUtcDays(date, -1))
    if (date.getUTCDay() === 0) return dateOnly(addUtcDays(date, -2))
    return value
  }
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
  ].map((period) => ({ ...period, nominalPayDate: period.payDate, payDate: moveWeekendEarlier(period.payDate), frequency: 'SEMIMONTHLY' }))
}
