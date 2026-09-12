export type NoWorkCloseoutReview={fingerprint:string;eligible:boolean;issues:string[];evidence:{employeeId:number;counts:Record<string,number>};closeout:{id:number;recordedAt:string;reason:string;reference:string}|null}
export type EmploymentPeriod={id:string;started_on:string;ended_on:string|null;source:string}
export type RehireReviewData={
 fingerprint:string;employmentTerms:{jobTitle:string;workState:string;residenceState:string;location:string|null;overtimeClassification:string;workerClassification:string;sickLeavePolicy:string};
 employeeId:number;employeeNumber:string;proposedStartDate:string;asOfDate:string;previousHireDate:string;previousSeparationDate:string|null;
 employmentPeriods:Array<{id:number;start:string;end:string|null}>;issues:string[];finalPay:FinalPayStatus;
 pendingRuns:Array<{id:number;kind:string;status:string;start:string;end:string}>;
 compensation:{payType:string;hourlyRateCents:number|null;annualSalaryCents:number|null;source:string;effectiveOn:string|null;laterChanges:Array<{id:number;effectiveOn:string}>};
 leaveBalances:Array<{type:string;minutes:number;reservedMinutes:number}>;onboarding:Array<{key:string;cycle:number;status:string}>;
}
import { adminApiRequest } from './api'

export type OffCycleExpense={id:string;employee_id:string;employee_name:string;amount_cents:string;source_request_id:string;period:{id:string;start:string;end:string;payDate:string}}
export type LeavePayoutReservation={payment_mode:'REGULAR'|'STANDALONE';offcycle_run_id:string|null;id:string;pay_period_id:string;minutes:string;amount_cents:string;status:string;cancellation_reason:string|null}
export type LeavePayoutPreview={asOfDate:string;version:number;leaveType:string;minutes:number;hourlyRateCents:number;amountCents:number;availableMinutes:number;remainingMinutes:number;fingerprint:string}
export type FinalPayStatus={employeeId:number;terminationDate:string|null;dueOn:string|null;status:string;paymentTiming:string|null;issues:string[];unresolvedTimeEntries:number;pendingRequests:number;period:{id:number;start:string;end:string}|null;run:{id:number;status:string;paymentDate:string;netPayCents:number|null}|null}
export type EarnedBonusAllocation = {
 version:number; fingerprint:string; method:string; bonusCents:number; additionalOvertimeCents:number; earnedStart:string; earnedEnd:string;
 compensation?:Array<{employmentStart:string;start:string;end:string;payType:string;salaryReview?:{classification:string}|null}>;
 weeks:Array<{week:string;workedMinutes:number;earnedMinutes:number;overtimeMinutes:number;overtimeEligible:boolean;allocatedBonusCents:number;additionalOvertimeCents:number}>
}

export type SalaryReview = {
 normalWorkweekMinutes?:number[]|null;
 classification:'EXEMPT'|'NONEXEMPT'; category:string; jobTitle:string; source:string; dutiesEvidence:string
 salaryBasisVerified:boolean; dutiesVerified:boolean; stateRulesVerified:boolean
 fixedHoursVerified?:boolean; fixed40Verified?:boolean; minimumWageVerified?:boolean; minimumWageCents?:number|null
 verifiedAt?:string; annualSalaryCents:number; standardWeeklyHours:number
}
export type PayrollEmployee = {
  id: number
  employeeNumber: string
  legalFirstName: string
  legalMiddleName: string
  legalLastName: string
  preferredName: string
  jobTitle: string
  employmentStatus: string
  hasPriorEmployment?:boolean
  payType: 'HOURLY' | 'SALARY'
  salaryReview?:SalaryReview|null
  annualSalaryCents:number|null
  hourlyRateCents: number | null
  hireDate: string
  workState: string
  residenceState: string
  primaryWorkLocation: string
  personalEmail: string
  phone: string
  w4Status: string
  stateWithholdingStatus: string
  i9Status: string
  directDepositStatus: string
  notes: string
}

export type ComplianceTask = {
  id: number
  employeeId: number | null
  taskKey: string
  title: string
  category: string
  jurisdiction: string
  dueDate: string | null
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETE' | 'NOT_APPLICABLE'
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  description: string
  sourceUrl: string | null
  sourceAuthority: string | null
  lastVerifiedOn: string | null
  nextReviewOn: string | null
  completionNote: string
}

export type PayrollDashboard = {
  settings: {
    onboardingPolicy?: Record<string, string>
    legalBusinessName: string
    businessAddress: string
    einLast4: string | null
    einStatus: string
    workweekStartsOn: number
    payFrequency: string
    payPeriodAnchorStart?: string | null
    payPeriodPaymentLagDays?: number | null
    semimonthlyFirstDay: number
    semimonthlySecondDay: number
    timezone: string
    stateCode: string
    mdCrnStatus: string
    mdUiStatus: string
    workersCompStatus: string
    payrollExecutionMode: string
  } | null
  employees: PayrollEmployee[]
  documents: Array<Record<string, unknown>>
  historicalPayments: Array<Record<string, unknown>>
  shifts: Array<Record<string, unknown>>
  timeEntries: Array<Record<string, unknown>>
  payPeriods: Array<Record<string, unknown>>
  payrollRuns: Array<Record<string, unknown>>
  payrollRunEmployees: Array<Record<string, unknown>>
  complianceTasks: ComplianceTask[]
  sourceReviews: Array<Record<string, unknown>>
  invitations: Array<Record<string, unknown>>
  adjustments: Array<Record<string, unknown>>
  leaveBalances: Array<Record<string, unknown>>
  accountingMapping: Record<string, unknown> | null
  alerts: Array<Record<string, unknown>>
  exportLogs: Array<Record<string, unknown>>
  summary: {
    activeEmployees: number
    openCriticalTasks: number
    openClocks: number
    setupScore: number
    historicalGrossCents: number
    unreconciledPayments: number
    sourcesDueForReview: number
  }
  aiEnabled: boolean
}

async function payrollRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await adminApiRequest(`/api/admin/payroll${path}`, options)
  const json = await response.json().catch(() => ({}))
  if (!response.ok || json.success === false) throw new Error(json.message || 'Payroll request failed')
  return json.data as T
}

export const payrollApi = {
  employmentPeriods:(id:number)=>payrollRequest<EmploymentPeriod[]>(`/employees/${id}/employment-periods`),
  previewOffCyclePto:(payPeriodId:number,paymentDate:string,offCyclePto:Record<string,unknown>)=>payrollRequest<{preview:{netPayCents:number|null;deductionCents:number;warnings:Array<{message:string}>;employees:Array<{retirementPlans?:unknown[];ptoStateWithholdingBasis?:{fingerprint:string;grossWagesCents:number;marylandWagesCents:number;pretaxCents:number;rothCents:number;federalIncomeTaxCents:number;ficaCents:number};retirementPtoProposals?:Array<{planId:string;planName:string;calculation:{pretaxCents:number;rothCents:number;totalCents:number;notAppliedReason:string|null};taxWages:{federalWagesCents:number;marylandWagesCents:number;socialSecurityWagesCents:number}}>} >}}>('/runs/preview',{method:'POST',body:JSON.stringify({payPeriodId,paymentDate,offCyclePto})}),
  createOffCyclePto:(payPeriodId:number,paymentDate:string,offCyclePto:Record<string,unknown>)=>payrollRequest<{id:number}>('/runs',{method:'POST',body:JSON.stringify({payPeriodId,paymentDate,offCyclePto})}),
  previewOffCycleBonus:(payPeriodId:number,paymentDate:string,offCycleBonus:Record<string,unknown>)=>payrollRequest<{preview:{grossPayCents:number;netPayCents:number|null;warnings:Array<{message:string}>;employees:Array<{federalIncomeTaxCents:number|null;stateIncomeTaxCents:number|null;socialSecurityTaxCents:number;medicareTaxCents:number;additionalMedicareTaxCents:number}>}}>('/runs/preview',{method:'POST',body:JSON.stringify({payPeriodId,paymentDate,offCycleBonus})}),
  createOffCycleBonus:(payPeriodId:number,paymentDate:string,offCycleBonus:Record<string,unknown>)=>payrollRequest<{id:number}>('/runs',{method:'POST',body:JSON.stringify({payPeriodId,paymentDate,offCycleBonus})}),
  offCycleExpenses:()=>payrollRequest<OffCycleExpense[]>('/off-cycle/reimbursements'),
  previewOffCycleExpense:(adjustmentId:string,paymentDate:string)=>payrollRequest<{preview:{netPayCents:number;warnings:Array<{message:string}>};context:{adjustmentId:number}} >('/off-cycle/reimbursements/preview',{method:'POST',body:JSON.stringify({adjustmentId,paymentDate})}),
  createOffCycleExpense:(offCycleReimbursementId:string,payPeriodId:string,paymentDate:string)=>payrollRequest<{id:number}>('/runs',{method:'POST',body:JSON.stringify({offCycleReimbursementId,payPeriodId,paymentDate})}),
  previewBonusAllocation:(id:number,body:Record<string,unknown>)=>payrollRequest<EarnedBonusAllocation>(`/employees/${id}/bonus-allocation/preview`,{method:'POST',body:JSON.stringify(body)}),
  leavePayouts:(id:number)=>payrollRequest<LeavePayoutReservation[]>(`/employees/${id}/leave-payouts`),
  reserveLeavePayout:(id:number,body:Record<string,unknown>)=>payrollRequest<LeavePayoutReservation>(`/employees/${id}/leave-payouts`,{method:'POST',body:JSON.stringify(body)}),
  cancelLeavePayout:(employeeId:number,id:string,reason:string)=>payrollRequest(`/employees/${employeeId}/leave-payouts/${id}/cancel`,{method:'POST',body:JSON.stringify({reason})}),
  previewLeavePayout:(id:number,body:Record<string,unknown>)=>payrollRequest<LeavePayoutPreview>(`/employees/${id}/leave-payout/preview`,{method:'POST',body:JSON.stringify(body)}),
  noWorkCloseout:(id:number)=>payrollRequest<NoWorkCloseoutReview>(`/employees/${id}/no-work-closeout`),
  closeNoWorkHire:(id:number,body:Record<string,unknown>)=>payrollRequest<NoWorkCloseoutReview>(`/employees/${id}/no-work-closeout`,{method:'POST',body:JSON.stringify(body)}),
  finalPayStatus:(id:number)=>payrollRequest<FinalPayStatus>(`/employees/${id}/final-pay`),
  rehireReview:(id:number,startDate:string)=>payrollRequest<RehireReviewData>(`/employees/${id}/rehire-review?startDate=${encodeURIComponent(startDate)}`),
  rehire:(id:number,body:Record<string,unknown>)=>payrollRequest<{employeeId:number;startDate:string;employmentStatus:string}>(`/employees/${id}/rehire`,{method:'POST',body:JSON.stringify(body)}),
  createBonus:(id:number,body:Record<string,unknown>)=>payrollRequest(`/employees/${id}/bonuses`,{method:'POST',body:JSON.stringify(body)}),
  salaryChanges:(id:number)=>payrollRequest<Array<{id:number;effective_on:string;annual_salary_cents:string;notice_delivered_on:string|null;cancelled_at:string|null;canCancel:boolean;acknowledged_at:string|null;cancellation_acknowledged_at:string|null;notice_reference:string|null;reason:string;cancellation_reason:string|null;cancellation_notice_delivered_on:string|null;cancellation_notice_reference:string|null}>>(`/employees/${id}/salary-changes`),
  cancelSalaryChange:(id:number,changeId:number,body:Record<string,unknown>)=>payrollRequest(`/employees/${id}/salary-changes/${changeId}/cancel`,{method:'POST',body:JSON.stringify(body)}),
  scheduleSalaryChange:(id:number,body:Record<string,unknown>)=>payrollRequest(`/employees/${id}/salary-changes`,{method:'POST',body:JSON.stringify(body)}),
  changePayBasis:(id:number,body:Record<string,unknown>)=>payrollRequest<{employeeId:number;payType:'HOURLY'|'SALARY';employmentStart:string}>(`/employees/${id}/pay-basis`,{method:'POST',body:JSON.stringify(body)}),
  saveSalaryReview:(id:number,body:Record<string,unknown>)=>payrollRequest<SalaryReview>(`/employees/${id}/salary-review`,{method:'POST',body:JSON.stringify(body)}),
  runAutomation: () => payrollRequest('/automation/run', { method: 'POST', body: '{}' }),
  dashboard: () => payrollRequest<PayrollDashboard>('/dashboard'),
  createEmployee: (body: Record<string, unknown>) => payrollRequest<PayrollEmployee>('/employees', { method: 'POST', body: JSON.stringify(body) }),
  updateEmployee: (id: number, body: Record<string, unknown>) => payrollRequest<PayrollEmployee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  createEmployeeInvitation: (id: number, email: string, sendEmail: boolean) => payrollRequest<{ inviteUrl: string; expiresAt: string; emailed: boolean; emailWarning: string | null }>(`/employees/${id}/invitations`, { method: 'POST', body: JSON.stringify({ email, sendEmail }) }),
  createShift: (body: Record<string, unknown>) => payrollRequest('/shifts', { method: 'POST', body: JSON.stringify(body) }),
  updateShift: (id: number, body: Record<string, unknown>) => payrollRequest(`/shifts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  createAdjustment: (employeeId: number, body: Record<string, unknown>) => payrollRequest(`/employees/${employeeId}/adjustments`, { method: 'POST', body: JSON.stringify(body) }),
  updateAdjustmentStatus: (id: number, status: string) => payrollRequest(`/adjustments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  createLeaveTransaction: (employeeId: number, body: Record<string, unknown>) => payrollRequest(`/employees/${employeeId}/leave-transactions`, { method: 'POST', body: JSON.stringify(body) }),
  createTimeEntry: (body: Record<string, unknown>) => payrollRequest('/time-entries', { method: 'POST', body: JSON.stringify(body) }),
  setTimeStatus: (id: number, status: string) => payrollRequest(`/time-entries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  clock: (employeeId: number, action: 'IN' | 'OUT', activityType = 'INSTRUCTION') => payrollRequest('/clock', { method: 'POST', body: JSON.stringify({ employeeId, action, activityType }) }),
  setCompliance: (id: number, status: string, completionNote: string) => payrollRequest(`/compliance/${id}`, { method: 'PATCH', body: JSON.stringify({ status, completionNote }) }),
  checkComplianceSource: (taskId: number) => payrollRequest<Array<Record<string, unknown>>>('/compliance/check-updates', { method: 'POST', body: JSON.stringify({ taskId }) }),
  generatePeriods: (year: number, month: number) => payrollRequest('/pay-periods/generate', { method: 'POST', body: JSON.stringify({ year, month }) }),
  retainHistoricalAllocation:(id:number,paymentId:number,body:Record<string,unknown>)=>payrollRequest<{id:number;reviewedAt:string;reason:string}>(`/employees/${id}/historical-payments/${paymentId}/allocations`,{method:'POST',body:JSON.stringify(body)}),
  historicalAllocationHistory:(id:number,paymentId:number)=>payrollRequest<Array<{id:number;reviewedAt:string;reason:string}>>(`/employees/${id}/historical-payments/${paymentId}/allocations`),
  previewHistoricalAllocation:(id:number,paymentId:number,body:Record<string,unknown>)=>payrollRequest<{fingerprint:string;source:{grossCents:number};weeks:Array<{week:string;workedMinutes:number;straightTimePayCents:number;premiumCents:number}>;reviewRequired:string}>(`/employees/${id}/historical-payments/${paymentId}/allocation-preview`,{method:'POST',body:JSON.stringify(body)}),
  recordHistoricalPayment:(id:number,body:Record<string,unknown>)=>payrollRequest<Record<string,unknown>>(`/employees/${id}/historical-payments`,{method:'POST',body:JSON.stringify(body)}),
  authorizeWorkweekSettlement:(id:number,body:Record<string,unknown>)=>payrollRequest<Record<string,unknown>>(`/employees/${id}/workweek-settlement-authorizations`,{method:'POST',body:JSON.stringify(body)}),
  saveWorkweekAllocation:(id:number,body:Record<string,unknown>)=>payrollRequest<ReviewedWorkweekAllocation>(`/employees/${id}/workweek-allocations`,{method:'POST',body:JSON.stringify(body)}),
  workweekAllocations:(id:number)=>payrollRequest<ReviewedWorkweekAllocation[]>(`/employees/${id}/workweek-allocations`),
  previewWorkweekAllocation:(id:number,body:Record<string,unknown>)=>payrollRequest<{leaveEarnings:{salaryIncludedCents:number;hourlyAdditionalCents:number;totalCents:number};paidLeave:Array<{id:number;leaveDate:string;minutes:number;includedInSalary:boolean}>;fingerprint:string;reviewRequired:string;coverage:{version:number;entries:Array<{id:number;workDate:string;minutes:number;straightTimePayCents:number;premiumCents:number}>};calculation:{workedMinutes:number;straightTimePayCents:number;overtimePremiumCents:number;regularRateNumerator:string;regularRateDenominator:string}}>(`/employees/${id}/workweek-allocation-preview`,{method:'POST',body:JSON.stringify(body)}),
  previewRun: (payPeriodId: number, paymentDate?: string) => payrollRequest<{ period: Record<string, unknown>; preview: Record<string, unknown> }>('/runs/preview', { method: 'POST', body: JSON.stringify({ payPeriodId, paymentDate }) }),
  createRun: (payPeriodId: number, paymentDate?: string) => payrollRequest('/runs', { method: 'POST', body: JSON.stringify({ payPeriodId, paymentDate }) }),
  setRunStatus: (id: number, status: 'REVIEW' | 'APPROVED' | 'VOID') => payrollRequest(`/runs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  setVerifiedWithholding: (runId: number, employeeId: number, body: Record<string, unknown>) => payrollRequest(`/runs/${runId}/employees/${employeeId}/withholding`, { method: 'PATCH', body: JSON.stringify(body) }),
  finalizeRun: (runId: number, paymentConfirmationReference: string, paymentDate: string) => payrollRequest(`/runs/${runId}/finalize`, { method: 'POST', body: JSON.stringify({ paymentConfirmationReference, paymentDate }) }),
  verifyAccountingMapping: (body: Record<string, unknown>) => payrollRequest('/accounting-mapping', { method: 'PATCH', body: JSON.stringify(body) }),
  dismissAlert: (id: number) => payrollRequest(`/alerts/${id}/dismiss`, { method: 'PATCH' }),
  reconcileExport: (id: number, body: Record<string, unknown>) => payrollRequest(`/exports/${id}/reconcile`, { method: 'PATCH', body: JSON.stringify(body) }),
  askAi: (question: string) => payrollRequest<{ answer: string; advisoryOnly: boolean }>('/ai-review', { method: 'POST', body: JSON.stringify({ question }) }),
}

export type ReviewedWorkweekAllocation={id:number;week:string;reviewedAt:string;reason:string;fingerprint:string;reviewRequired:string;calculation:{workedMinutes:number;straightTimePayCents:number;overtimePremiumCents:number}}
