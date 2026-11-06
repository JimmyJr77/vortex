import { getApiUrl, getAdminToken } from './api'
import { getMemberSessionToken } from './portalSession'
import { getPayrollEmployeeSession } from './employeePayrollApi'

export type LegalPortal = 'admin' | 'coach' | 'payroll' | 'member'
export type LegalSignature = { id: number; signer_name: string; signed_at: string; document_sha256: string; document_version: string }
export type LegalDocument = { id: string; title: string; version: string; sha256: string; text: string; signature: LegalSignature | null }
export type Packet = { eligible?: boolean; documents: LegalDocument[]; consentText: string; accountName: string }
export const legalBase = (portal: LegalPortal) => portal === 'payroll' ? '/api/payroll/employee/legal' : '/api/staff/legal'
const token = (portal: LegalPortal) => portal === 'payroll' ? getPayrollEmployeeSession() : portal === 'admin' ? getAdminToken() : getMemberSessionToken()
export async function legalRequest<T>(portal: LegalPortal, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiUrl()}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(portal) || ''}`, ...options.headers } })
  const body = await response.json()
  if (!response.ok || !body.success) throw new Error(body.message || 'Unable to load legal policies.')
  return body.data as T
}
export async function downloadLegalDocument(portal: LegalPortal, doc: { id: string; version: string }) {
  const response = await fetch(`${getApiUrl()}${legalBase(portal)}/${doc.id}/file`, { headers: { Authorization: `Bearer ${token(portal) || ''}` } })
  if (!response.ok) throw new Error('Unable to download the document. Please try again.')
  const url = URL.createObjectURL(await response.blob())
  const a = document.createElement('a'); a.href = url; a.download = `${doc.id}-${doc.version}.docx`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
