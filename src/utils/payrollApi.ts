import { adminApiRequest } from './api'

export type PayrollEmployee = {
  id: number
  employeeNumber: string
  legalFirstName: string
  legalMiddleName: string
  legalLastName: string
  preferredName: string
  jobTitle: string
  employmentStatus: string
  payType: 'HOURLY' | 'SALARY'
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
    legalBusinessName: string
    businessAddress: string
    einLast4: string | null
    einStatus: string
    workweekStartsOn: number
    payFrequency: string
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
  previewRun: (payPeriodId: number) => payrollRequest<{ period: Record<string, unknown>; preview: Record<string, unknown> }>('/runs/preview', { method: 'POST', body: JSON.stringify({ payPeriodId }) }),
  createRun: (payPeriodId: number) => payrollRequest('/runs', { method: 'POST', body: JSON.stringify({ payPeriodId }) }),
  setRunStatus: (id: number, status: 'REVIEW' | 'APPROVED' | 'VOID') => payrollRequest(`/runs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  setVerifiedWithholding: (runId: number, employeeId: number, body: Record<string, unknown>) => payrollRequest(`/runs/${runId}/employees/${employeeId}/withholding`, { method: 'PATCH', body: JSON.stringify(body) }),
  finalizeRun: (runId: number, paymentConfirmationReference: string) => payrollRequest(`/runs/${runId}/finalize`, { method: 'POST', body: JSON.stringify({ paymentConfirmationReference }) }),
  verifyAccountingMapping: (body: Record<string, unknown>) => payrollRequest('/accounting-mapping', { method: 'PATCH', body: JSON.stringify(body) }),
  dismissAlert: (id: number) => payrollRequest(`/alerts/${id}/dismiss`, { method: 'PATCH' }),
  reconcileExport: (id: number, body: Record<string, unknown>) => payrollRequest(`/exports/${id}/reconcile`, { method: 'PATCH', body: JSON.stringify(body) }),
  askAi: (question: string) => payrollRequest<{ answer: string; advisoryOnly: boolean }>('/ai-review', { method: 'POST', body: JSON.stringify({ question }) }),
}
