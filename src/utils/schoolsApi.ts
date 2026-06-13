import { getApiUrl } from './api'

export interface SchoolSearchResult {
  id: number
  name: string
  level: string | null
  location: string | null
}

export async function searchSchools(query: string): Promise<SchoolSearchResult[]> {
  const q = query.trim()
  if (!q) return []
  const res = await fetch(`${getApiUrl()}/api/schools/search?${new URLSearchParams({ q })}`)
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to search schools')
  }
  return data.data as SchoolSearchResult[]
}
