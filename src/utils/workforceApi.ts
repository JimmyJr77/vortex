export type EmployeeBenefitContribution={paymentDate:string;month:string;planName:string;optionLabel:string;amountCents:number;taxTreatment:string;runId:number}
export type CorrectionWorkweekAmountsData={workweekPaymentVersion?:number;originalWorkweekPayments?:Array<{week:string;workedMinutes:number;straightTimePayCents:number;premiumCents:number}>;proposedWorkweekPayments?:Array<{week:string;workedMinutes:number;straightTimePayCents:number;premiumCents:number}>}
export type MarylandWithholdingCalendarData = {year:number;today:string;config:{schedule:string;months:number[];source:string}|null;issues:string[];reliable:boolean;unappliedCents?:number;periods:Array<{formType?:string;reason?:string;start:string;end:string;dueOn:string;grossCents:number;liabilityCents:number;balanceCents:number;coveredCents:number;lateCoveredCents:number;projected:boolean;paymentStatus:string;filingStatus:string;filingReference:string|null}>;annual:{start:string;end:string;dueOn:string;filingStatus:string;filingReference:string|null}|null}
import { adminApiRequest, getApiUrl } from './api'
import { getPayrollEmployeeSession } from './employeePayrollApi'

export type MarylandUiCalendarData = {year:number;today:string;config:{first_quarter:number;last_quarter:number;source:string;verified_at:string}|null;issues:string[];reliable:boolean;quarters:Array<{quarter:number;start:string;end:string;dueOn:string;projected:boolean;grossCents:number;liabilityCents:number;coveredCents:number;lateCoveredCents:number;balanceCents:number;paymentStatus:string;filingStatus:string;filingReference:string|null}>}
export type FutaDepositCalendarData = {reliable:boolean;issues:string[];liabilityCents:number;coveredCents:number;unappliedCents:number;quarters:Array<{quarter:number;end:string;taxCents:number;carriedCents:number;closed:boolean}>;obligations:Array<{quarter:number;fromQuarter:number;dueOn:string;liabilityCents:number;coveredCents:number;lateCoveredCents:number;balanceCents:number;rule:string;projected:boolean;status:string}>}
export type FederalDepositCalendarData = {futa:FutaDepositCalendarData;year:number;today:string;config:{schedule:string;prior_year_next_day:boolean;source:string;verified_at:string}|null;issues:string[];reliable:boolean;effectiveSchedule:string|null;nextYearSemiweeklyRequired:boolean;obligations:Array<{key:string;quarter:number;firstPayDate:string;lastPayDate:string;dueOn:string;rule:string;liabilityCents:number;coveredCents:number;lateCoveredCents:number;balanceCents:number;status:string}>}
export type TaxReconciliationData = {year:number;legacyPayments:number;annual:{grossCents:number;IRS_941:number;IRS_FUTA:number;MD_WITHHOLDING:number;MD_UI:number;EMPLOYEE_FEDERAL:number};quarters:Array<{quarter:number;start:string;end:string;grossCents:number;employeeCount:number;agencies:Array<{agency:string;liabilityCents:number;depositedCents:number;balanceCents:number}>}>;deposits:Array<{id:number;agency:string;tax_quarter:number;paid_on:string;amount_cents:number;reference:string;status:string;void_reason:string|null}>;filings:Array<{id:number;form_type:string;period_start:string;period_end:string;filed_on:string;reference:string;status:string;reported_wages_cents:number;reported_tax_cents:number;currentWagesCents:number;currentTaxCents:number;void_reason?:string|null}>}
export type PayRateData = { rates: Array<{id:number;effective_on:string;hourly_rate_cents:number;reason:string;notice_delivered_on:string|null;notice_reference:string|null;acknowledged_at:string|null;cancelled_at:string|null;cancellation_reason:string|null;cancellation_notice_delivered_on:string|null;cancellation_notice_reference:string|null;cancellation_acknowledged_at:string|null}>; today:string;workweekStartsOn:number;payFrequency:string;currentRateCents:number|null }
export type OnboardingTask = { id: number; employee_id: number; onboarding_cycle:number; task_key: string; title: string; owner: 'EMPLOYEE' | 'ADMIN'; required: boolean; status: string; due_date: string; instructions: string; response: Record<string, unknown>; review_note: string | null }
export type WorkforceRequest = { id: number; employee_id: number; legal_first_name?: string; legal_last_name?: string; kind: string; status: string; payload: Record<string, unknown>; review_note: string | null; created_at: string }
export type SalaryNotice={salaryWeeklyHours?:number;normalWorkweekMinutes?:number[];id:number;effectiveOn:string;annualSalaryCents:number;jobTitle:string;classification:string;noticeDeliveredOn:string;cancelledAt:string|null;cancellationNoticeDeliveredOn:string|null;acknowledgedAt:string|null;cancellationAcknowledgedAt:string|null}
export type HiringShift={id:number;start:string;end:string;activityType:string;location:string;notes:string;timezone:string}
export type BenefitOption={id:string;label:string;employeeCostCents:number;employerCostCents:number;taxTreatment:string;costFrequency?:string}
export type BenefitPlan={id:string;name:string;description:string;options:BenefitOption[]}
export type BenefitsElection={version:number;choice:string;signature:string;policyTerms:string;submissionId:string;submittedAt:string;selections?:Array<{planId:string;planName:string;optionId:string;optionLabel?:string;employeeCostCents?:number;employerCostCents?:number;taxTreatment?:string;costFrequency?:string}>}
export type BenefitsReview={employerFundingConfirmed?:boolean;fundingTreatment?:string;disposition:string;effectiveOn:string;summary:string;evidenceReference?:string;confirmed?:boolean}
export type BenefitDeductionProposal={fingerprint:string;terms:string;monthlyCents:number;startOn:string}
export type BenefitDeductionStatus={withdrawal?:{authorizationRequestKey:string;recordedAt:string}|null;required:boolean;status:string;proposal:BenefitDeductionProposal|null;saved:{signature:string;signedAt:string;requestKey:string;proposalFingerprint:string;proposal:BenefitDeductionProposal}|null}
export type Packet = { benefitsDeduction?:BenefitDeductionStatus; benefitPlans?:BenefitPlan[];benefitsElection?:BenefitsElection|null;benefitsReview?:BenefitsReview|null;paySetup?:{marylandAgreement?:{status:string;paymentDate:string|null;effectiveOn:string|null}|null;benefitsCurrent?:boolean;status:string;issues:string[];fingerprint:string;taxYear:number|null;paymentMethod:string|null}; reviewIssues?:Array<{taskId:number;message:string}>; firstShift?:{status:string;current:HiringShift|null;reviewed:HiringShift|null}; wageTerms?:{salaryWeeklyHours?:number;normalWorkweekMinutes?:number[];jobTitle:string;hourlyRateCents:number|null;annualSalaryCents:number|null;payType:string;overtimeClassification:string;hireDate:string;location:string|null;paySchedule:string;payScheduleSnapshot?:Record<string,unknown>}; leaveBalances: Array<{leave_type: string; minutes: number; reservedMinutes?:number}>; tasks: OnboardingTask[]; documents: Array<{ id: number; task_id: number; filename: string; uploaded_at: string }>; requests: WorkforceRequest[]; readiness: { ready: boolean; blockers: string[]; total: number; complete: number }; policy: Record<string, string>; vaultReady: boolean }
export type WorkforceData = { requests: WorkforceRequest[]; tasks: OnboardingTask[]; audit: Array<{ id: number; action: string; entity_type: string; entity_id: string; created_at: string }> }
async function response(path: string, admin: boolean, options: RequestInit = {}) {
 if (admin) return adminApiRequest(`/api/admin/payroll${path}`, options)
 return fetch(`${getApiUrl()}/api/payroll/employee${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getPayrollEmployeeSession() || ''}` } })
}
async function request<T>(path: string, admin: boolean, body?: unknown, method = 'POST'): Promise<T> {
 const res = await response(path, admin, body === undefined ? {} : { method, body: JSON.stringify(body) })
 const json = await res.json()
 if (!res.ok || json.success === false) throw new Error(json.message || 'Unable to save workforce changes')
 return json.data as T
}
export type ScheduleTransitionPreview={noticeDeadline:string;periods:Array<{periodStart:string;periodEnd:string;payDate:string;frequency:string}>;replacedPeriodCount:number;previewToken:string}
export type ScheduleVersion={notice_delivered_on:string|null;cancellation_notice_delivered_on:string|null;id:number;can_cancel:boolean;cancelled_at:string|null;cancellation_source:string|null;effective_on:string;schedule_settings:{pay_frequency:string};source:string}
export type EmployeeScheduleNotice={id:number;effectiveOn:string;schedule:{pay_frequency:string;pay_period_anchor_start:string|null;pay_period_payment_lag_days:number|null;semimonthly_first_day:number;semimonthly_second_day:number};noticeDeliveredOn:string;cancelledAt:string|null;cancellationNoticeDeliveredOn:string|null;acknowledgedAt:string|null;cancellationAcknowledgedAt:string|null}
export type ScheduleReceipt={employee_id:number;legal_first_name:string;legal_last_name:string;employment_status:string;notice_kind:string|null;acknowledged_at:string|null}
export type LeaveYearPlan={year:number;previewToken:string;employees:Array<{id:number;legal_first_name:string;legal_last_name:string;sick_leave_policy:string;employed_at_opening?:boolean;balance:number;carryMinutes:number;rolloverDelta:number;grantMinutes:number;openingBalance:number}>}
export type LeaveYearHistory={policy:{enabled:boolean;first_year:number;carry_cap_minutes:number;frontload_minutes:number;source:string}|null;history:Array<{id:number;opening_year:number;source:string;created_at:string;employee_snapshot:LeaveYearPlan['employees']}>}
export type FractionRecoveryPlan={items:Array<{runId:string;workedMinutes:number;accruedMinutes:number;recoveredThirtieths:number}>;creditMinutes:number;remainder:number;effectiveOn:string;previewToken:string}
export type OnboardingRevision={id:number;onboarding_cycle:number;event:string;recorded_at:string;snapshot:OnboardingTask;documents:Array<{id:number;filename:string}>}
export type SavedAcknowledgment={id:number;cycle:number;kind:'HANDBOOK'|'WAGE_NOTICE';title:string;recordedAt:string;submittedAt:string|null;signature:string;terms:string|Record<string,unknown>|null;benefitsTerms:string|null;source:string}
export const workforceApi = {
 benefitContributions:(start:string,end:string)=>request<{contributions:EmployeeBenefitContribution[]}>(`/benefit-contributions?${new URLSearchParams({start,end})}`,false),
 acknowledgments:(taskId:number,beforeId?:number)=>request<{items:SavedAcknowledgment[];nextBeforeId:number|null}>(`/onboarding/${taskId}/acknowledgments${beforeId?`?beforeId=${beforeId}`:''}`,false),
 onboardingHistory:(employeeId:number,taskId:number)=>request<OnboardingRevision[]>(`/employees/${employeeId}/onboarding/${taskId}/history`,true),
 previewLeaveFractions:(id:number)=>request<FractionRecoveryPlan>(`/employees/${id}/leave-fractions/preview`,true,{}),
 applyLeaveFractions:(id:number,body:unknown)=>request(`/employees/${id}/leave-fractions/apply`,true,body),
 leaveYearHistory:()=>request<LeaveYearHistory>('/leave-year/history',true),
 saveLeaveYearPolicy:(body:unknown)=>request('/leave-year/policy',true,body),
 previewLeaveYear:(body:unknown)=>request<LeaveYearPlan>('/leave-year/preview',true,body),
 applyLeaveYear:(body:unknown)=>request('/leave-year/apply',true,body),
 employeeSalaryNotices:()=>request<SalaryNotice[]>('/salary-changes',false),
 acknowledgeSalaryNotice:(id:number,cancellation:boolean)=>request(`/salary-changes/${id}/acknowledge`,false,{acknowledged:true,cancellation}),
 employeeScheduleNotices:()=>request<EmployeeScheduleNotice[]>('/pay-schedule-notices',false),
 acknowledgeScheduleNotice:(id:number,cancellation:boolean)=>request(`/pay-schedule-notices/${id}/acknowledge`,false,{acknowledged:true,cancellation}),
 scheduleAcknowledgments:(id:number)=>request<ScheduleReceipt[]>(`/pay-schedule/${id}/acknowledgments`,true),
 previewScheduleCancellation:(id:number)=>request<ScheduleTransitionPreview>(`/pay-schedule/${id}/cancel-preview`,true,{}),
 cancelScheduleTransition:(id:number,body:unknown)=>request(`/pay-schedule/${id}/cancel`,true,body),
 payScheduleHistory:()=>request<ScheduleVersion[]>('/pay-schedule/history',true),
 previewScheduleTransition:(body:unknown)=>request<ScheduleTransitionPreview>('/pay-schedule/transition-preview',true,body),
 saveScheduleTransition:(body:unknown)=>request('/pay-schedule/transition',true,body),
 previewPaySchedule: (body:unknown) => request<{periods:Array<{periodStart:string;periodEnd:string;payDate:string}>}>('/pay-schedule/preview',true,body),
 configurePaySchedule: (body:unknown) => request('/pay-schedule/configure',true,body),
 marylandWithholdingCalendar: (year:number) => request<MarylandWithholdingCalendarData>(`/maryland-withholding-calendar?year=${year}`,true),
 saveMarylandWithholdingSchedule: (body:unknown) => request('/maryland-withholding-schedule',true,body),
 marylandUiCalendar: (year:number) => request<MarylandUiCalendarData>(`/maryland-ui-calendar?year=${year}`,true),
 saveMarylandUiReporting: (body:unknown) => request('/maryland-ui-reporting',true,body),
 federalDepositCalendar: (year:number) => request<FederalDepositCalendarData>(`/federal-deposit-calendar?year=${year}`,true),
 saveFederalDepositSchedule: (body:unknown) => request('/federal-deposit-schedule',true,body),
 taxReconciliation: (year:number) => request<TaxReconciliationData>(`/tax-reconciliation?year=${year}`,true),
 recordTaxDeposit: (body:unknown) => request('/tax-deposits',true,body),
 voidTaxDeposit: (id:number,reason:string) => request(`/tax-deposits/${id}/void`,true,{reason}),
 voidTaxFiling: (id:number,reason:string,localRecordOnlyConfirmed:boolean) => request(`/tax-filings/${id}/void`,true,{reason,localRecordOnlyConfirmed}),
 recordTaxFiling: (body:unknown) => request('/tax-filings',true,body),
 payRates: (employeeId?:number) => request<PayRateData>(employeeId?`/employees/${employeeId}/pay-rates`:'/pay-rates',!!employeeId),
 schedulePayRate: (employeeId:number,body:unknown) => request(`/employees/${employeeId}/pay-rates`,true,body),
 cancelPayRate: (employeeId:number,id:number,body:unknown) => request(`/employees/${employeeId}/pay-rates/${id}/cancel`,true,body),
 acknowledgePayRate: (id:number,cancellation=false) => request(`/pay-rates/${id}/acknowledge`,false,{acknowledged:true,cancellation}),
 packet: (employeeId?: number) => request<Packet>(employeeId ? `/employees/${employeeId}/onboarding` : '/onboarding', !!employeeId),
 saveDraft: (taskId: number, body: unknown) => request<Packet>(`/onboarding/${taskId}/draft`, false, body),
 submit: (taskId: number, body: unknown) => request<Packet>(`/onboarding/${taskId}`, false, body),
 withdrawBenefitsDeduction:(body:unknown)=>request<Packet>('/benefits-deduction-authorization/withdraw',false,body),
 authorizeBenefitsDeduction:(body:unknown)=>request<Packet>('/benefits-deduction-authorization',false,body),
 benefitsElection:(body:unknown)=>request<Packet>('/benefits-election',false,body),
 review: (employeeId: number, taskId: number, status: string, note: string, onboardingCycle=1, paySetupFingerprint?:string, benefitsReview?:BenefitsReview) => request<Packet>(`/employees/${employeeId}/onboarding/${taskId}/review`, true, { status, note, onboardingCycle, paySetupFingerprint, benefitsReview }),
 activate: (employeeId: number) => request(`/employees/${employeeId}/activate`, true, {}),
 retainCorrectionImpact:(id:number,body:unknown)=>request<{id:number;reviewedAt:string;reason:string}>(`/requests/${id}/payroll-impact/reviews`,true,body),
 authorizeCorrectionPayment:(id:number,body:unknown)=>request<{id:number}>(`/requests/${id}/payroll-correction-authorizations`,true,body),
 correctionPaymentAuthorizations:(id:number)=>request<Array<{id:number;authorizedAt:string;status:string;issue:string|null;paymentApplied:boolean;settlement:{id:number;runId:number;paymentDate:string;settledAt:string}|null;input:{reason:string};preview:{paymentDate:string;periodStart:string;periodEnd:string;delta:{grossPayCents:number;netPayCents:number;federalIncomeTaxCents:number;stateIncomeTaxCents:number};targetLeave:{combinedCreditDifferenceMinutes:number}}}>>(`/requests/${id}/payroll-correction-authorizations`,true),
 correctionPaymentPreview:(id:number,body:unknown)=>request<{priorWageCorrectionCents:number;currentWageReclassificationCents:number;targetHours:{before:{regularMinutes:number;overtimeMinutes:number};after:{regularMinutes:number;overtimeMinutes:number}};input:{calculationId:number;payPeriodId:number;paymentDate:string;historyCompleteConfirmed:boolean;historySource:string};targetLeave:{before:{accrualMinutes:number};after:{accrualMinutes:number};accrualDifferenceMinutes:number;combinedCreditDifferenceMinutes:number};correctionLeave:{creditDifferenceMinutes:number};fingerprint:string;before:Record<string,number>;after:Record<string,number>;delta:Record<string,number>;currentWorkedMinutes:number;currentLeaveAccrualMinutes:number;paymentDate:string;periodStart:string;periodEnd:string}>(`/requests/${id}/payroll-correction-payment-preview`,true,body),
 retainCorrectionCalculation:(id:number,body:unknown)=>request<{id:number}>(`/requests/${id}/payroll-corrections`,true,body),
 correctionCalculations:(id:number)=>request<Array<{id:number;retainedAt:string;reason:string;status:string;issue:string|null;calculation:{leave?:{status:string;issue?:string;creditDifferenceMinutes?:number};workedWagesDifferenceCents:number;runs:Array<CorrectionWorkweekAmountsData&{runId:number;periodStart:string;periodEnd:string;before:{regularMinutes:number;overtimeMinutes:number;regularPayCents:number;overtimePayCents:number};after:{regularMinutes:number;overtimeMinutes:number;regularPayCents:number;overtimePayCents:number}}>}}>>(`/requests/${id}/payroll-corrections`,true),
 correctionCalculation:(id:number)=>request<{leave:{status:string;issue?:string;creditDifferenceMinutes?:number;finalRemainder?:number;items?:Array<{runId:number;accruedMinutesBefore:number;accruedMinutesAfter:number}>};fingerprint:string;workedWagesDifferenceCents:number;runs:Array<CorrectionWorkweekAmountsData&{runId:number;status:string;periodStart:string;periodEnd:string;before:{regularMinutes:number;overtimeMinutes:number};after:{regularMinutes:number;overtimeMinutes:number};delta:{workedWagesCents:number}}> }>(`/requests/${id}/payroll-correction-preview`,true,{}),
 timeCorrectionImpact:(id:number)=>request<{fingerprint:string;reviews:Array<{id:number;reviewedAt:string;reason:string;status:string}>;status:string;proposed:{workedMinutes:number};scopes:Array<{first:string;last:string}>;runs:Array<Record<string,unknown>>;historicalPayments:Array<Record<string,unknown>>}>(`/requests/${id}/payroll-impact`,true),
 workforce: () => request<WorkforceData>('/workforce', true),
 benefitCatalog:(body:unknown)=>request<{benefitCatalog:string}>('/settings',true,body,'PATCH'),
 settings: (body: unknown) => request('/settings', true, body, 'PATCH'),
 leaveAvailability: (startDate:string,endDate:string,leaveType:string,employeeId?:number) => request<{startDate:string;endDate:string;leaveType:string;availableMinutes:number;reservedMinutes:number}>(`${employeeId?`/employees/${employeeId}`:''}/leave-availability?${new URLSearchParams({startDate,endDate,leaveType})}`,!!employeeId),
 submitRequest: (kind: string, payload: unknown, requestKey?:string) => request('/requests', false, { kind, payload, requestKey }),
 cancelRequest: (id: number) => request(`/requests/${id}/cancel`, false, {}),
 cancelApprovedLeave: (id:number,reason:string) => request(`/requests/${id}/cancel-approved-leave`,true,{reason}),
 reviewRequest: (id: number, status: string, note: string, taxTreatmentVerified = false, cancelConflictingShifts = false) => request(`/requests/${id}/review`, true, { status, note, taxTreatmentVerified, cancelConflictingShifts }),
 async upload(taskId: number, file: File, onboardingCycle=1) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose a file up to 5 MB.')
  const contentBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Unable to read file')); reader.readAsDataURL(file) })
  return request(`/onboarding/${taskId}/documents`, false, { filename: file.name, contentBase64, onboardingCycle })
 },
 async download(id: number, filename: string, admin: boolean) {
  const res = await response(`/documents/${id}`, admin)
  if (!res.ok) throw new Error((await res.json()).message || 'Unable to download document')
  const url = URL.createObjectURL(await res.blob()), link = document.createElement('a')
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
 },
}
