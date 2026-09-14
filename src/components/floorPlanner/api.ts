import { adminApiRequest } from '../../utils/api'
import type { Plan, Coach } from './model'
export interface SavedPlan { plan: Plan | null; revision: number; facilityId: number }
export interface ViewSummary { id: string; name: string; revision: number; selectedDay: number; updatedAt: string }
export interface SavedView extends SavedPlan, ViewSummary { plan: Plan }
export const isSavedView = (value: SavedPlan): value is SavedView => 'id' in value && typeof value.id === 'string' && 'selectedDay' in value
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await adminApiRequest(`/api/admin/floor-planner${path}`, options)
  const data = await response.json()
  if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load Floor Planner.')
  return data.data
}
export const loadPlan = () => request<SavedPlan>('')
export const loadCoaches = () => request<Coach[]>('/coaches')
export const savePlan = (plan: Plan, revision: number) => request<SavedPlan>('', { method: 'PUT', body: JSON.stringify({ plan, revision }) })
export const listViews = () => request<ViewSummary[]>('/views')
export const loadView = (id: string) => request<SavedView>(`/views/${encodeURIComponent(id)}`)
export const saveView = (plan: Plan, selectedDay: number, name: string, id?: string, revision?: number) => request<SavedView>(id ? `/views/${encodeURIComponent(id)}` : '/views', { method: id ? 'PUT' : 'POST', body: JSON.stringify({ plan, selectedDay, name, revision }) })
export const deleteView = (id: string, revision: number) => request<{ id: string }>(`/views/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ revision }) })
