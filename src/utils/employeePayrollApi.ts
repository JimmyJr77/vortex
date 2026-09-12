import { getApiUrl } from './api'

export type RetirementProposal={fingerprint:string;planName:string;employeeTerms:string;employeeExplanation:string;eligibilityTerms:string;compensationTerms:string;allowsPretax:boolean;allowsRoth:boolean;earliestEffectiveOn:string;methods:string[]}
export type RetirementEmployeePlan={planId:string;planName:string;status:string;explanation:string;proposal:RetirementProposal|null;history:{id:string;revision:number;onboardingCycle:number;createdAt:string;processingStatus:string;election:{action:string;method:string|null;pretax:number;roth:number;effectiveOn:string;signature:string;proposal:RetirementProposal}}[]}
const SESSION_KEY = 'vortex_payroll_employee_session_v1'

export function getPayrollEmployeeSession() {
  return sessionStorage.getItem(SESSION_KEY)
}

export function clearPayrollEmployeeSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) }
  const token = getPayrollEmployeeSession()
  if (authenticated && token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${getApiUrl()}${path}`, { ...options, headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success === false) throw new Error(body.message || 'Payroll portal request failed')
  return body.data as T
}

export type EmployeePayrollPortalData = {
  employee: {
    id: number
    facilityId: number
    hasPassword: boolean
    employeeNumber: string
    legalFirstName: string
    legalMiddleName: string
    legalLastName: string
    preferredName: string
    jobTitle: string
    employmentStatus: string
    payType:'HOURLY'|'SALARY'
    annualSalaryCents:number|null
    hourlyRateCents: number
    hireDate: string
    primaryWorkLocation: string
    personalEmail: string
    phone: string
    w4Status: string
    stateWithholdingStatus: string
    i9Status: string
    directDepositStatus: string
  }
  documents: Array<Record<string, unknown>>
  shifts: Array<Record<string, unknown>>
  timeEntries: Array<Record<string, unknown>>
  payStatements: Array<Record<string, unknown>>
  sickLeaveBalanceMinutes: number
  onboardingMaterials: Array<{ key: string; label: string; url: string }>
}

export type EmployeeFilingIdentity={revision:number;identifierLast4:string;firstName:string;middleName:string;lastName:string;suffix:string;address:{line1:string;line2:string;city:string;state:string;postalCode:string;country:string};review:{decision:string;created_at:string}|null}
export type CheckReceipt={sourceKind?:'REPLACEMENT_CHECK';originalPaymentDate?:string;id:string;runId:number;employeeName:string;amountCents:number;paymentDate:string;deliveredAt:string;acknowledgedAt:string|null;status:'OUTSTANDING'|'BANK_CONFIRMED'|'NEEDS_REVIEW';bankPostedDates:string[];observedAt:string|null}
export type ReplacementReceipt={sourceKind?:string;id:string;employeeName:string;amountCents:number;originalPaymentDate:string;paymentDate:string;bankPostedDates:string[];account:{accountType:string;accountLast4:string}|null;createdAt:string;status:'BANK_CONFIRMED'|'NEEDS_REVIEW'}

export type EmployeeBenefitCoverage = {month:string;rows:{planId:string;planName:string;onboardingCycle:number;status:string;reviewedAt:string|null;carrier:string|null;coverageStart:string|null;coverageEnd:string|null}[]}

export type MarylandSigningTerms={employeeTerms:string;effectiveOn:string;agreement:{amountCents:number;payFrequency:string;electionFingerprint:string;periodBasis:'PAYMENT_DATE'}}
export type MarylandSigningHistory={history:Array<{id:string;revision:number;fingerprint:string;terms:MarylandSigningTerms;decision:'ACCEPT'|'DECLINE'|null;signature:string|null;signed_at:string|null;agreement_id:string|null}>;actionable:boolean;reason:string}

export type W4Preview={reviewId:string;expiresAt:string;previewSha256:string;pdfBase64:string;perjury:string;pageCount:number}

export const employeePayrollApi = {
  readW4Draft:<T>(taskId:number,cycle:number)=>request<{revision:number;baseSubmissionId:string|null;draft:T|null;savedAt:string|null}>(`/api/payroll/employee/onboarding/${taskId}/w4/draft?onboardingCycle=${cycle}`),
  saveW4Draft:(taskId:number,body:unknown)=>request<{revision:number;baseSubmissionId:string|null;savedAt:string}>(`/api/payroll/employee/onboarding/${taskId}/w4/draft`,{method:'POST',body:JSON.stringify(body)}),
  previewW4:(taskId:number,body:unknown)=>request<W4Preview>(`/api/payroll/employee/onboarding/${taskId}/w4/preview`,{method:'POST',body:JSON.stringify(body)}),
  visitW4Page:(taskId:number,body:unknown)=>request<{recorded:boolean}>(`/api/payroll/employee/onboarding/${taskId}/w4/page`,{method:'POST',body:JSON.stringify(body)}),
  signW4:(taskId:number,body:unknown)=>request<{documentId:string;submissionId:string;status:string}>(`/api/payroll/employee/onboarding/${taskId}/w4/sign`,{method:'POST',body:JSON.stringify(body)}),
  marylandAgreementProposals:()=>request<MarylandSigningHistory>('/api/payroll/employee/maryland-agreement-proposals'),
  respondMarylandAgreement:(id:string,body:Record<string,unknown>)=>request<{id:string;agreementId:string|null;reused:boolean}>(`/api/payroll/employee/maryland-agreement-proposals/${id}/respond`,{method:'POST',body:JSON.stringify(body)}),
  retirementContributions:(cursor?:string)=>request<{items:EmployeeRetirementContribution[];nextCursor:string|null}>(`/api/payroll/employee/retirement-contributions${cursor?'?beforeRunId='+encodeURIComponent(cursor):''}`),
  retirement:()=>request<{plans:RetirementEmployeePlan[]}>('/api/payroll/employee/retirement'),
  saveRetirementElection:(planId:string,body:unknown)=>request<{id:string;reused:boolean}>(`/api/payroll/employee/retirement/${encodeURIComponent(planId)}/elections`,{method:'POST',body:JSON.stringify(body)}),
  benefitCoverage:(month:string)=>request<EmployeeBenefitCoverage>(`/api/payroll/employee/benefit-coverage?${new URLSearchParams({month})}`),
  acknowledgeCheckReceipt:(id:string)=>request<{acknowledgedAt:string;reused:boolean}>(`/api/payroll/employee/check-receipts/${encodeURIComponent(id)}/acknowledge`,{method:'POST',body:JSON.stringify({acknowledged:true})}),
  checkReceipts:()=>request<CheckReceipt[]>('/api/payroll/employee/check-receipts'),
  replacementReceipts:()=>request<ReplacementReceipt[]>('/api/payroll/employee/payment-replacement-receipts'),
  filingIdentity:()=>request<EmployeeFilingIdentity|null>('/api/payroll/employee/filing-identity'),
  reviewFilingIdentity:(revision:number,decision:string)=>request('/api/payroll/employee/filing-identity/review',{method:'POST',body:JSON.stringify({revision,decision,confirmed:true})}),
  async downloadStatement(id:number) {
    const response=await fetch(`${getApiUrl()}/api/payroll/employee/pay-statements/${id}.pdf`,{headers:{Authorization:`Bearer ${getPayrollEmployeeSession()}`}})
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||'Unable to download statement')}
    const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=`pay-statement-${id}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  },
  async login(email: string, password: string, facilityId: number) {
    const data = await request<{ sessionToken: string }>('/api/payroll/employee/login', { method: 'POST', body: JSON.stringify({ email, password, facilityId }) }, false)
    sessionStorage.setItem(SESSION_KEY, data.sessionToken)
  },
  setPassword: (password: string) => request('/api/payroll/employee/access', { method: 'POST', body: JSON.stringify({ password }) }),
  async redeem(token: string) {
    const data = await request<EmployeePayrollPortalData & { sessionToken: string; expiresAt: string }>('/api/payroll/employee/invitations/redeem', { method: 'POST', body: JSON.stringify({ token }) }, false)
    sessionStorage.setItem(SESSION_KEY, data.sessionToken)
    return data
  },
  me: () => request<EmployeePayrollPortalData>('/api/payroll/employee/me'),
  clock: (action: 'IN' | 'OUT', activityType = 'INSTRUCTION') => request('/api/payroll/employee/clock', { method: 'POST', body: JSON.stringify({ action, activityType }) }),
  attest: (entryId: number) => request(`/api/payroll/employee/time-entries/${entryId}/attest`, { method: 'POST', body: JSON.stringify({ confirmed: true }) }),
  updateProfile: (preferredName: string, phone: string) => request('/api/payroll/employee/profile', { method: 'PATCH', body: JSON.stringify({ preferredName, phone }) }),
  async logout() {
    try { await request('/api/payroll/employee/logout', { method: 'POST' }) } finally { clearPayrollEmployeeSession() }
  },
}

export type EmployeeRetirementContribution={runId:string;paymentDate?:string;status:string;contributions:{planName:string;amountCents:number;status:string;fundingStatus:string;postedCents:number|null;reportedCents:number|null;providerRecordedAt:string|null;checkedAt:string|null;replacement?:{status:string;postedCents:number|null;receiptCheckedAt:string|null;accountingStatus:string;caseStatus:string}|null}[]}
