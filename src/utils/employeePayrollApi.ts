import { getApiUrl } from './api'

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
    employeeNumber: string
    legalFirstName: string
    legalMiddleName: string
    legalLastName: string
    preferredName: string
    jobTitle: string
    employmentStatus: string
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

export const employeePayrollApi = {
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
