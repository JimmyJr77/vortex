import { useEffect, useState } from 'react'
import { adminApiRequest, getAdminToken } from '../../utils/api'

export interface Access { isMasterAdmin: boolean; permissions: string[] }
export interface Page<T> { rows: T[]; total: number; page: number; pageSize: number; totalPages: number }
export interface BillingTarget { familyId: number; memberId: number | null }
export function allowed(access: Access, permission: string) { return access.isMasterAdmin || access.permissions.includes(permission) }

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await adminApiRequest(path, options)
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.success === false) throw new Error(body?.message || `Request failed (${response.status}). Please retry.`)
  return body?.data as T
}

// Share only in-flight reads, including StrictMode mounts. No stale account data is cached.
const pendingReads = new Map<string, Promise<unknown>>()
function read<T>(path: string, revision: number): Promise<T> {
  const key = `${getAdminToken() ?? ''}:${revision}:${path}`
  const pending = pendingReads.get(key)
  if (pending) return pending as Promise<T>
  const task = request<T>(path).finally(() => pendingReads.delete(key))
  pendingReads.set(key, task)
  return task
}

export function useRead<T>(path: string | null, revision = 0) {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string | null; loading: boolean }>({ path: null, data: null, error: null, loading: false })
  useEffect(() => {
    if (!path) return
    let active = true
    setState({ path, data: null, error: null, loading: true })
    void read<T>(path, revision).then(
      data => { if (active) setState({ path, data, error: null, loading: false }) },
      error => { if (active) setState({ path, data: null, error: error instanceof Error ? error.message : 'Unable to load data.', loading: false }) },
    )
    return () => { active = false }
  }, [path, revision])
  return state.path === path ? state : { path, data: null, error: null, loading: Boolean(path) }
}

export function useSearch(value: string) {
  const [search, setSearch] = useState(value)
  useEffect(() => { const timer = window.setTimeout(() => setSearch(value.trim()), 250); return () => window.clearTimeout(timer) }, [value])
  return search
}
