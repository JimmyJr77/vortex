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
export type BenefitDeductionProposal={fingerprint:string;terms:string;monthlyCents:number;startOn:string;items?:{planId:string;planName:string;optionId:string;optionLabel:string;monthlyCents:number;taxTreatment:string}[]}
export type BenefitDeductionStatus={withdrawal?:{authorizationRequestKey:string;recordedAt:string}|null;required:boolean;status:string;proposal:BenefitDeductionProposal|null;saved:{signature:string;signedAt:string;requestKey:string;proposalFingerprint:string;proposal:BenefitDeductionProposal}|null}
export type Packet = { marylandCertificateAvailable?:boolean; benefitsDeduction?:BenefitDeductionStatus; benefitPlans?:BenefitPlan[];benefitsElection?:BenefitsElection|null;benefitsReview?:BenefitsReview|null;paySetup?:{marylandAgreement?:{status:string;paymentDate:string|null;effectiveOn:string|null}|null;benefitsCurrent?:boolean;status:string;issues:string[];fingerprint:string;taxYear:number|null;paymentMethod:string|null}; reviewIssues?:Array<{taskId:number;message:string}>; firstShift?:{status:string;current:HiringShift|null;reviewed:HiringShift|null}; wageTerms?:{salaryWeeklyHours?:number;normalWorkweekMinutes?:number[];jobTitle:string;hourlyRateCents:number|null;annualSalaryCents:number|null;payType:string;overtimeClassification:string;hireDate:string;location:string|null;paySchedule:string;payScheduleSnapshot?:Record<string,unknown>}; leaveBalances: Array<{leave_type: string; minutes: number; reservedMinutes?:number}>; tasks: OnboardingTask[]; documents: Array<{ id: number; task_id: number; filename: string; uploaded_at: string }>; requests: WorkforceRequest[]; readiness: { ready: boolean; blockers: string[]; total: number; complete: number }; policy: Record<string, string>; vaultReady: boolean }
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
export type I9EmployerDocument={title:string;issuingAuthority:string;number:string;expiresOn:string}
export type I9EmployerDraft={documentChoice:'LIST_A'|'LIST_B_C'|null;listA:I9EmployerDocument[];listB:I9EmployerDocument|null;listC:I9EmployerDocument|null;additionalInformation:string;examinationMethod:'PHYSICAL'|'ALTERNATIVE'|null;firstDayEmployed:string;representativeNameAndTitle:string;businessName:string;businessAddress:string}
export type I9EmployerDraftState={revision:number;basisHash:string;submissionId:string|number|null;draft:I9EmployerDraft|null;savedAt:string|null;invalidated:boolean}
export type I9EmployerPreview={attestation:string;examinationContext:{today:string;hireDate:string;offerAcceptedOn:string;eVerify:boolean;examinationMethod:string;documentChoice:string;representativeNameAndTitle:string};reviewId:string|number;expiresAt:string;previewSha256:string;pdfBase64:string;pageCount:number;supplements:Array<{documentKey:string;documentId:string|number;sha256:string;pdfBase64:string;pageCount:number}>}
export type I9CopyList={documents:Array<{key:string;label:string;copies:Array<{id:string|number;documentId:string|number;pageCount:number;filename:string;mime:string;createdAt:string}>}>}
export type I9CopyView={copyId:string|number;contentBase64:string;mime:string;pageCount:number;filename:string}
export type I9ExaminationDraftData={examinedOn:string;initials:string;identity:string;days:number[];closures:string;short:string;late:string;qualification:string;video:string;decisions:Record<string,{copyIds:string[];acceptance:string;ruleSource:string;ruleEvidence:string;validUntil:string;formNotation:string;followUpKind:string;followUpOn:string}>}
export type I9ExaminationDraftState={revision:number;draft:I9ExaminationDraftData|null;savedAt:string|null;invalidated:boolean}
export type I9SupplementDraftState={revision:number;basisHash:string;draft:null|{form:Record<string,string>;facts:Record<string,string>};savedAt:string|null;invalidated:boolean}
export type I9SupplementPreview={reviewId:string|number;expiresAt:string;previewSha256:string;pdfBase64:string;pageCount:number;attestation:string;source:{pdfBase64:string;pageCount:number};previousReceiptAmendments?:Array<{signatureId:string|number;documentKey:string;pdfBase64:string;pageCount:number}>;previousSupplements:Array<{signatureId:string|number;documentKey:string;pdfBase64:string;pageCount:number}>}
export type I9SupplementRecord={qualification?:I9QualificationState['current'];signatureId:string|number;signedAt:string;signature:string;attestation:string;examination:{examinedOn:string;requirementEvidence:string;acceptanceEvidence:string;followUpKind:string;followUpOn:string;lateReason:string};document:{id:string|number;filename:string};copies:Array<{copyId:string|number;documentId:string|number;filename:string;pageCount:number}>}
export type I9ReceiptPreview={reviewId:string|number;expiresAt:string;previewSha256:string;pdfBase64:string;pageCount:number;attestation:string;source:{pdfBase64:string;pageCount:number}}
export type I9DifferentDraftFacts={fields:Record<string,string>;days:number[];decisions:Record<string,Record<string,string>>}
export type I9DifferentDraftData={form:Partial<Record<'choice'|'method'|'businessName'|'businessAddress'|'representative'|'reason'|'initials'|'notes',string>>&{listA?:Partial<I9EmployerDocument>[];listB?:Partial<I9EmployerDocument>;listC?:Partial<I9EmployerDocument>};facts:I9DifferentDraftFacts}
export type I9DifferentDraftState={revision:number;basisHash:string;draft:I9DifferentDraftData|null;savedAt:string|null;invalidated:boolean}
export type I9ReceiptResolution={taskId:string|number;rowKey:string;dueOn:string;status:string}
export type I9DifferentContext={receiptTasks:I9ReceiptResolution[];signatureId:string|number;sourceKind:'SECTION2'|'SUPPLEMENT_B';rowKey:string;dueOn:string;today:string;originalExaminedOn:string;retainedHiringContext:{attestationKind:string;eVerify:boolean};employerDefaults:{firstDayEmployed:string;businessName:string;businessAddress:string}}
export type I9DifferentPreview={receiptTasks:I9ReceiptResolution[];attestation:string;reviewId:string|number;expiresAt:string;previewSha256:string;recordedOn:string;packet:Array<{documentKey:string;documentId?:string|number;sha256:string;pdfBase64:string;pageCount:number}>}
export type I9DifferentCertification={qualification?:I9QualificationState['current'];resolvedReceiptTasks?:I9ReceiptResolution[];signatureId:string|number;signedAt:string;signature:string;attestation:string;answers:{reason:string;initials:string};examination:I9EmployerRecord['examination'];authorization:{authorizationIndefinite:boolean;authorizationThrough:string;authorizationEvidence:string};timing:{dueOn:string;late:boolean};document:{id:string|number;filename:string};copies:I9EmployerRecord['copies']}
export type I9EmployerRecord={qualification?:I9QualificationState['current'];differentSupplements?:Array<I9SupplementRecord&{answers:{reason:string;initials:string};receiptSignatureId:string|number}>;differentCertifications?:I9DifferentCertification[];receiptAmendments?:I9SupplementRecord[];supplements?:I9SupplementRecord[];signatureId:string|number;onboardingCycle:number;signedAt:string;current:boolean;signature:string;attestation:string;examination:{examinedOn:string;identityEvidence:string;businessDays:number[];closedDates:string[];lateReason:string;alternative:null|{qualificationEvidence:string;videoEvidence:string};documents:Array<{rowKey:string;acceptance:string;ruleSource:string;ruleEvidence:string;formNotation:string;followUpKind:string;followUpOn:string}>};timing:{dueOn:string;late:boolean};document:{id:string|number;filename:string};copies:Array<{copyId:string|number;documentId:string|number;rowKey:string;pageCount:number;filename:string}>;followups:Array<{id:string|number;task_key:string;followup_kind?:string;status:string;due_on:string;description:string;source_url:string;completion_note:string}>}
export type EVerifyResult={outcome:string;caseReference:string;observedOn:string;caseClosed:boolean;nextActionOn:string;nextAction:string;evidenceNote:string;verifiedAgainstOfficialCase:boolean;employeeAndEmployerMatched:boolean;evidenceReviewed:boolean}
export type EVerifyHistory={revision:number;events:Array<{id:string|number;revision:number;recordedAt:string;result:EVerifyResult;documentId:string|number;filename:string}>}
export type I9DifferentSupplementPreview=Omit<I9DifferentPreview,'receiptTasks'>&{receiptSignatureId:string|number}
export type I9QualificationState={revision:number;today:string;current:null|{revision:number;findings:Record<string,string|boolean>;recordedAt:string;actorUserId:number};history:Array<{revision:number;findings:Record<string,string|boolean>;recordedAt:string;actorUserId:number}>}
export const workforceApi = {
 i9Qualification:()=>request<I9QualificationState>(`/i9/qualification`,true),
 saveI9Qualification:(body:unknown)=>request<I9QualificationState&{recordedRevision:number}>(`/i9/qualification`,true,body),
 differentSupplementDraft:(employeeId:number,taskId:string|number)=>request<I9SupplementDraftState>(`/employees/${employeeId}/i9/different-supplement/${taskId}/draft`,true),
 saveDifferentSupplementDraft:(employeeId:number,taskId:string|number,body:unknown)=>request<I9SupplementDraftState>(`/employees/${employeeId}/i9/different-supplement/${taskId}/draft`,true,body),
 differentSupplementPreview:(employeeId:number,taskId:string|number,body:unknown)=>request<I9DifferentSupplementPreview>(`/employees/${employeeId}/i9/different-supplement/${taskId}/preview`,true,body),
 differentSupplementPage:(employeeId:number,taskId:string|number,body:unknown)=>request<{recorded:boolean}>(`/employees/${employeeId}/i9/different-supplement/${taskId}/page`,true,body),
 differentSupplementCopies:(employeeId:number,taskId:string|number,body:unknown)=>request<{copies:Array<{id:string|number;filename:string;pageCount:number}>}>(`/employees/${employeeId}/i9/different-supplement/${taskId}/copies/list`,true,body),
 uploadDifferentSupplementCopy:(employeeId:number,taskId:string|number,body:unknown)=>request<{id:string|number}>(`/employees/${employeeId}/i9/different-supplement/${taskId}/copies`,true,body),
 differentSupplementCopy:(employeeId:number,taskId:string|number,body:unknown)=>request<I9CopyView>(`/employees/${employeeId}/i9/different-supplement/${taskId}/copy`,true,body),
 differentSupplementCopyPage:(employeeId:number,taskId:string|number,body:unknown)=>request<{recorded:boolean}>(`/employees/${employeeId}/i9/different-supplement/${taskId}/copy-page`,true,body),
 signDifferentSupplement:(employeeId:number,taskId:string|number,body:unknown)=>request<{signedAt:string;status:string}>(`/employees/${employeeId}/i9/different-supplement/${taskId}/sign`,true,body),
 differentDraft:(employeeId:number,taskId:string|number)=>request<I9DifferentDraftState>(`/employees/${employeeId}/i9/different-documents/${taskId}/draft`,true),
 saveDifferentDraft:(employeeId:number,taskId:string|number,body:unknown)=>request<I9DifferentDraftState>(`/employees/${employeeId}/i9/different-documents/${taskId}/draft`,true,body),
 differentContext:(employeeId:number,taskId:string|number)=>request<I9DifferentContext>(`/employees/${employeeId}/i9/different-documents/${taskId}/context`,true),
 differentPreview:(employeeId:number,taskId:string|number,body:unknown)=>request<I9DifferentPreview>(`/employees/${employeeId}/i9/different-documents/${taskId}/preview`,true,body),
 differentPage:(employeeId:number,taskId:string|number,body:unknown)=>request<{recorded:boolean}>(`/employees/${employeeId}/i9/different-documents/${taskId}/page`,true,body),
 differentCopies:(employeeId:number,taskId:string|number,params:Record<string,string>)=>request<{copies:Array<{id:string|number;rowKey:string;documentId:string|number;pageCount:number;filename:string;mime:string}>}>(`/employees/${employeeId}/i9/different-documents/${taskId}/copies?${new URLSearchParams(params)}`,true),
 uploadDifferentCopy:(employeeId:number,taskId:string|number,body:unknown)=>request<{id:string|number;documentId:string|number;pageCount:number}>(`/employees/${employeeId}/i9/different-documents/${taskId}/copies`,true,body),
 differentCopy:(employeeId:number,taskId:string|number,body:unknown)=>request<I9CopyView>(`/employees/${employeeId}/i9/different-documents/${taskId}/copy`,true,body),
 differentCopyPage:(employeeId:number,taskId:string|number,body:unknown)=>request<{recorded:boolean}>(`/employees/${employeeId}/i9/different-documents/${taskId}/copy-page`,true,body),
 signDifferent:(employeeId:number,taskId:string|number,body:unknown)=>request<{signatureId:string|number;documentId:string|number;status:string}>(`/employees/${employeeId}/i9/different-documents/${taskId}/sign`,true,body),
 receiptDraft:(employeeId:number,taskId:string|number)=>request<I9SupplementDraftState>(`/employees/${employeeId}/i9/receipt/${taskId}/draft`,true),
 saveReceiptDraft:(employeeId:number,taskId:string|number,body:unknown)=>request<I9SupplementDraftState>(`/employees/${employeeId}/i9/receipt/${taskId}/draft`,true,body),
 supplementDraft:(employeeId:number,taskId:string|number)=>request<I9SupplementDraftState>(`/employees/${employeeId}/i9/supplement/${taskId}/draft`,true),
 saveSupplementDraft:(employeeId:number,taskId:string|number,body:unknown)=>request<I9SupplementDraftState>(`/employees/${employeeId}/i9/supplement/${taskId}/draft`,true,body),

 receiptContext:(employeeId:number,taskId:string|number)=>request<{sourceKind:string;rowKey:string;today:string;dueOn:string}>(`/employees/${employeeId}/i9/receipt/${taskId}/context`,true),
 receiptPreview:(employeeId:number,taskId:string|number,body:unknown)=>request<I9ReceiptPreview>(`/employees/${employeeId}/i9/receipt/${taskId}/preview`,true,body),
 receiptPage:(employeeId:number,taskId:string|number,body:unknown)=>request(`/employees/${employeeId}/i9/receipt/${taskId}/page`,true,body),
 receiptCopies:(employeeId:number,taskId:string|number,body:{reviewId:string|number;previewSha256:string})=>request<{copies:Array<{id:string|number;filename:string;pageCount:number}>}>(`/employees/${employeeId}/i9/receipt/${taskId}/copies?${new URLSearchParams({reviewId:String(body.reviewId),previewSha256:body.previewSha256})}`,true),
 receiptCopy:(employeeId:number,taskId:string|number,body:unknown)=>request<I9CopyView>(`/employees/${employeeId}/i9/receipt/${taskId}/copy`,true,body),
 receiptCopyPage:(employeeId:number,taskId:string|number,body:unknown)=>request(`/employees/${employeeId}/i9/receipt/${taskId}/copy-page`,true,body),
 async uploadReceiptCopy(employeeId:number,taskId:string|number,body:Record<string,unknown>,file:File){
  if(file.size>5*1024*1024)throw new Error('Choose a file up to 5 MB.')
  const contentBase64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Unable to read file'));reader.readAsDataURL(file)})
  return request<{id:string|number;pageCount:number}>(`/employees/${employeeId}/i9/receipt/${taskId}/copies`,true,{...body,filename:file.name,contentBase64})
 },
 signReceipt:(employeeId:number,taskId:string|number,body:unknown)=>request<{signatureId:string|number;signedAt:string;nextFollowup:null|{id:string|number;due_on:string;kind:string}}>(`/employees/${employeeId}/i9/receipt/${taskId}/sign`,true,body),
 supplementPreview:(employeeId:number,taskId:string|number,body:unknown)=>request<I9SupplementPreview>(`/employees/${employeeId}/i9/supplement/${taskId}/preview`,true,body),
 supplementPage:(employeeId:number,taskId:string|number,body:unknown)=>request(`/employees/${employeeId}/i9/supplement/${taskId}/page`,true,body),
 supplementCopies:(employeeId:number,taskId:string|number,body:{reviewId:string|number;previewSha256:string})=>request<{copies:Array<{id:string|number;filename:string;pageCount:number}>}>(`/employees/${employeeId}/i9/supplement/${taskId}/copies?${new URLSearchParams({reviewId:String(body.reviewId),previewSha256:body.previewSha256})}`,true),
 supplementCopy:(employeeId:number,taskId:string|number,body:unknown)=>request<I9CopyView>(`/employees/${employeeId}/i9/supplement/${taskId}/copy`,true,body),
 supplementCopyPage:(employeeId:number,taskId:string|number,body:unknown)=>request(`/employees/${employeeId}/i9/supplement/${taskId}/copy-page`,true,body),
 async uploadSupplementCopy(employeeId:number,taskId:string|number,body:Record<string,unknown>,file:File){
  if(file.size>5*1024*1024)throw new Error('Choose a file up to 5 MB.')
  const contentBase64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Unable to read file'));reader.readAsDataURL(file)})
  return request<{id:string|number;pageCount:number}>(`/employees/${employeeId}/i9/supplement/${taskId}/copies`,true,{...body,filename:file.name,contentBase64})
 },
 signSupplement:(employeeId:number,taskId:string|number,body:unknown)=>request<{signatureId:string|number;signedAt:string;nextFollowup:null|{id:string|number;due_on:string;kind:string}}>(`/employees/${employeeId}/i9/supplement/${taskId}/sign`,true,body),

 eVerifyHistory:(employeeId:number,taskId:string|number)=>request<EVerifyHistory>(`/employees/${employeeId}/i9/everify/${taskId}`,true),
 recordEVerifyResult:async(employeeId:number,taskId:string|number,body:unknown,file:File)=>{if(file.size>5*1024*1024)throw new Error('Choose a PDF up to 5 MB.');const contentBase64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Unable to read case evidence.'));reader.readAsDataURL(file)});return request<{eventId:string|number;revision:number;status:string}>(`/employees/${employeeId}/i9/everify/${taskId}`,true,{...(body as object),filename:file.name,contentBase64})},
 i9EmployerRecords:(employeeId:number)=>request<{records:I9EmployerRecord[]}>(`/employees/${employeeId}/i9/employer-records`,true),
 i9ExaminationDraft:(employeeId:number,taskId:number,body:Record<string,string|number>)=>request<I9ExaminationDraftState>(`/employees/${employeeId}/onboarding/${taskId}/i9/examination-draft?${new URLSearchParams(Object.fromEntries(Object.entries(body).map(([key,value])=>[key,String(value)])))}`,true),
 saveI9ExaminationDraft:(employeeId:number,taskId:number,body:unknown)=>request<I9ExaminationDraftState>(`/employees/${employeeId}/onboarding/${taskId}/i9/examination-draft`,true,body),
 i9EmployerCopies:(employeeId:number,taskId:number,body:Record<string,string|number>)=>request<I9CopyList>(`/employees/${employeeId}/onboarding/${taskId}/i9/employer-copies?${new URLSearchParams(Object.fromEntries(Object.entries(body).map(([key,value])=>[key,String(value)])))}`,true),
 async uploadI9EmployerCopy(employeeId:number,taskId:number,body:Record<string,unknown>,file:File){
  if(file.size>5*1024*1024)throw new Error('Choose a file up to 5 MB.')
  const contentBase64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Unable to read file'));reader.readAsDataURL(file)})
  return request<{id:string|number;documentId:string|number;pageCount:number}>(`/employees/${employeeId}/onboarding/${taskId}/i9/employer-copies`,true,{...body,contentBase64})
 },
 viewI9EmployerCopy:(employeeId:number,taskId:number,body:unknown)=>request<I9CopyView>(`/employees/${employeeId}/onboarding/${taskId}/i9/employer-copy-view`,true,body),
 recordI9CopyPage:(employeeId:number,taskId:number,body:unknown)=>request<{recorded:boolean}>(`/employees/${employeeId}/onboarding/${taskId}/i9/employer-copy-page`,true,body),
 previewI9Employer:(employeeId:number,taskId:number,body:unknown)=>request<I9EmployerPreview>(`/employees/${employeeId}/onboarding/${taskId}/i9/employer-preview`,true,body),
 signI9Employer:(employeeId:number,taskId:number,body:unknown)=>request<{signatureId:string|number;documentId:string|number;signedAt:string;status:string}>(`/employees/${employeeId}/onboarding/${taskId}/i9/employer-sign`,true,body),
 recordI9EmployerPage:(employeeId:number,taskId:number,body:unknown)=>request<{recorded:boolean}>(`/employees/${employeeId}/onboarding/${taskId}/i9/employer-page`,true,body),
 i9EmployerDraft:(employeeId:number,taskId:number,cycle:number)=>request<I9EmployerDraftState>(`/employees/${employeeId}/onboarding/${taskId}/i9/employer-draft?onboardingCycle=${cycle}`,true),
 saveI9EmployerDraft:(employeeId:number,taskId:number,body:unknown)=>request<{revision:number;basisHash:string;savedAt:string}>(`/employees/${employeeId}/onboarding/${taskId}/i9/employer-draft`,true,body),
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
 i9Preparers:(employeeId:number,taskId:number,cycle:number)=>request<PreparerRoster>(`/employees/${employeeId}/onboarding/${taskId}/i9/preparers?onboardingCycle=${cycle}`,true),
 inviteI9Preparer:(employeeId:number,taskId:number,body:unknown)=>request<{id:string;token:string;expiresAt:string}>(`/employees/${employeeId}/onboarding/${taskId}/i9/preparers`,true,body),
 cancelI9Preparer:(employeeId:number,taskId:number,requestId:string,body:unknown)=>request(`/employees/${employeeId}/onboarding/${taskId}/i9/preparers/${requestId}/cancel`,true,body),
 i9Context:(employeeId:number,taskId:number,cycle:number)=>request<I9HiringContext>(`/employees/${employeeId}/onboarding/${taskId}/i9/context?onboardingCycle=${cycle}`,true),
 saveI9Context:(employeeId:number,taskId:number,body:unknown)=>request<I9HiringContext>(`/employees/${employeeId}/onboarding/${taskId}/i9/context`,true,body),
 packet: (employeeId?: number) => request<Packet>(employeeId ? `/employees/${employeeId}/onboarding` : '/onboarding', !!employeeId),
 saveDraft: (taskId: number, body: unknown) => request<Packet>(`/onboarding/${taskId}/draft`, false, body),
 submit: (taskId: number, body: unknown) => request<Packet>(`/onboarding/${taskId}`, false, body),
 withdrawBenefitsDeduction:(body:unknown)=>request<Packet>('/benefits-deduction-authorization/withdraw',false,body),
 authorizeBenefitsDeduction:(body:unknown)=>request<Packet>('/benefits-deduction-authorization',false,body),
 benefitsElection:(body:unknown)=>request<Packet>('/benefits-election',false,body),
 review: (employeeId: number, taskId: number, status: string, note: string, onboardingCycle=1, paySetupFingerprint?:string, benefitsReview?:BenefitsReview,i9PreparerReview?:{confirmed:boolean;fingerprint:string}) => request<Packet>(`/employees/${employeeId}/onboarding/${taskId}/review`, true, { status, note, onboardingCycle, paySetupFingerprint, benefitsReview,i9PreparerReview }),
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

export type I9HiringRecord={revision:number;offerAcceptedOn:string;participationVerifiedOn:string|null;eVerify:boolean;evidence:string;actorUserId:number;recordedAt:string}
export type I9HiringContext={revision:number;current:I9HiringRecord|null;history:I9HiringRecord[]}

export type PreparerRoster={submissionId:string|null;fingerprint:string;requests:Array<{id:string;name:string;email:string;evidence:string;expiresAt:string;cancelledAt:string|null;signedAt:string|null;signatureId:string|null;documentId:string|null}>}
