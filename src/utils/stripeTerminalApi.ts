import { adminApiRequest } from './api'

export interface StripeTerminalReader {
  id: string
  label: string
  status: string
  simulated: boolean
}

interface StripeTerminalConfiguration {
  enabled: boolean
  readers: StripeTerminalReader[]
  testMode: boolean
}

export type StripeTerminalTarget = 'billing' | 'store'

export interface StripeTerminalAttempt {
  id: string | number
  readerId: string
  amountCents: number | null
  status: 'awaiting_card' | 'processing' | 'retryable' | 'succeeded' | 'canceled'
  message?: string | null
  simulated: boolean
}

const basePath = '/api/admin/stripe-terminal'
const targetPath = (kind: StripeTerminalTarget, targetId: number) => `${basePath}/${kind}/${targetId}`

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await adminApiRequest(path, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success !== true) {
    throw new Error(body.message || `Stripe Terminal request failed (${response.status}).`)
  }
  return body.data as T
}

export function getStripeTerminalReaders(signal?: AbortSignal) {
  return request<StripeTerminalConfiguration>(`${basePath}/readers`, { signal })
}

export function getStripeTerminalAttempt(kind: StripeTerminalTarget, targetId: number, signal?: AbortSignal) {
  return request<StripeTerminalAttempt | null>(targetPath(kind, targetId), { signal })
}

export function startStripeTerminalPayment(
  kind: StripeTerminalTarget,
  targetId: number,
  readerId: string,
  expectedAmountCents: number,
  previousAttemptId?: StripeTerminalAttempt['id'],
) {
  return request<StripeTerminalAttempt>(targetPath(kind, targetId), {
    method: 'POST',
    body: JSON.stringify({ readerId, expectedAmountCents, previousAttemptId }),
  })
}

export function cancelStripeTerminalPayment(kind: StripeTerminalTarget, targetId: number, attemptId: StripeTerminalAttempt['id']) {
  return request<StripeTerminalAttempt>(`${targetPath(kind, targetId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ attemptId }),
  })
}

export function simulateStripeTerminalPayment(
  kind: StripeTerminalTarget,
  targetId: number,
  attemptId: StripeTerminalAttempt['id'],
  outcome: 'approved' | 'declined',
) {
  return request<StripeTerminalAttempt>(`${targetPath(kind, targetId)}/simulate`, {
    method: 'POST',
    body: JSON.stringify({ attemptId, outcome }),
  })
}
