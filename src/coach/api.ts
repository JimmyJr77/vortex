import { getApiUrl } from '../utils/api'

/**
 * Coach/member portal API requests reuse the member JWT stored under
 * `vortex_member_token` (see CoachDashboard and App.tsx session handling).
 */
export function getCoachToken(): string | null {
  return localStorage.getItem('vortex_member_token')
}

export async function coachFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getCoachToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${getApiUrl()}${endpoint}`, { ...options, headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed: ${res.status}`)
  }
  return (json?.data ?? json) as T
}
