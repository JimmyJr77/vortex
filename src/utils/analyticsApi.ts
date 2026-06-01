import { adminApiRequest, getApiUrl, getAdminToken } from './api'

export type DatePreset = '7d' | '30d' | '90d' | 'custom'

export interface AnalyticsQuery {
  from: string
  to: string
  hostname?: string
}

export function buildRangeFromPreset(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
): AnalyticsQuery {
  const to = new Date()
  to.setHours(23, 59, 59, 999)
  const from = new Date()
  if (preset === 'custom' && customFrom && customTo) {
    const f = new Date(customFrom)
    const t = new Date(customTo)
    f.setHours(0, 0, 0, 0)
    t.setHours(23, 59, 59, 999)
    return { from: f.toISOString(), to: t.toISOString() }
  }
  if (preset === '7d') from.setDate(from.getDate() - 7)
  else if (preset === '90d') from.setDate(from.getDate() - 90)
  else from.setDate(from.getDate() - 30)
  from.setHours(0, 0, 0, 0)
  return { from: from.toISOString(), to: to.toISOString() }
}

function queryString(q: AnalyticsQuery, extra?: Record<string, string>): string {
  const params = new URLSearchParams()
  params.set('from', q.from)
  params.set('to', q.to)
  if (q.hostname && q.hostname !== 'all') params.set('hostname', q.hostname)
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v)
    }
  }
  return `?${params.toString()}`
}

async function fetchJson<T>(path: string, q: AnalyticsQuery): Promise<T> {
  const res = await adminApiRequest(`${path}${queryString(q)}`)
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Request failed (${res.status})`)
  }
  return json.data as T
}

export interface OverviewData {
  inquiries: {
    total: number
    contacted: number
    contactedRate: number
    trend: Array<{ day: string; count: number }>
  }
  newsletterSignups: number
  newEnrollments: number
  sessions: number
  uncontactedOver48h: number
  capacityAlerts: Array<{
    programId: number
    name: string
    enrolled: number
    capacity: number
    fillRate: number
    alert: string
  }>
}

export interface TrafficData {
  pageViewsByDay: Array<{ day: string; page_views: number }>
  topPages: Array<{ page_path: string; views: number }>
}

export interface FunnelData {
  steps: Array<{ name: string; count: number; conversionFromPrevious: number }>
}

export interface ProgramsData {
  inquiriesByInterest: Array<{ interest: string; count: number }>
  enrollmentsByProgram: Array<{ display_name: string; count: number }>
  capacity: Array<{
    programId: number
    name: string
    enrolled: number
    capacity: number
    fillRate: number | null
  }>
}

export interface InquiryRow {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  created_at: string
  contacted: boolean
  visitor_id: string | null
  landing_page: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  lead_status: string
}

export interface ConversionData {
  newFamilies: number
  inquiriesNotEnrolled: Array<{
    id: number
    first_name: string
    last_name: string
    email: string
    created_at: string
    contacted: boolean
    utm_source: string | null
    landing_page: string | null
  }>
}

export interface SeoData {
  configured: boolean
  keywords: Array<{
    query: string
    page: string
    date: string
    impressions: number
    clicks: number
    position: number
    ctr: number
  }>
  inquiriesByLandingPage: Array<{ landing_page: string; inquiries: number }>
  dailyTraffic: Array<{
    date: string
    sessions: number
    users: number
    page_views: number
    source: string
  }>
}

export interface CompetitorRow {
  id: number
  name: string
  website_url: string | null
  gbp_place_id: string | null
  notes: string | null
  latest_snapshot: {
    rating: number | null
    review_count: number | null
    programs_json: Record<string, unknown> | null
    notes: string | null
    captured_at: string
    source: string
  } | null
}

export interface MarketingCampaign {
  id: number
  name: string
  channel: string | null
  utm_campaign: string | null
  budget: number | null
  start_date: string | null
  end_date: string | null
  notes: string | null
}

export const fetchOverview = (q: AnalyticsQuery) =>
  fetchJson<OverviewData>('/api/admin/analytics/overview', q)
export const fetchTraffic = (q: AnalyticsQuery) =>
  fetchJson<TrafficData>('/api/admin/analytics/traffic', q)
export const fetchFunnel = (q: AnalyticsQuery) =>
  fetchJson<FunnelData>('/api/admin/analytics/funnel', q)
export const fetchPrograms = (q: AnalyticsQuery) =>
  fetchJson<ProgramsData>('/api/admin/analytics/programs', q)
export const fetchInquiries = (q: AnalyticsQuery) =>
  fetchJson<InquiryRow[]>('/api/admin/analytics/inquiries', q)
export const fetchConversion = (q: AnalyticsQuery) =>
  fetchJson<ConversionData>('/api/admin/analytics/conversion', q)
export const fetchSeo = (q: AnalyticsQuery) =>
  fetchJson<SeoData>('/api/admin/analytics/seo', q)

export async function downloadAnalyticsExport(
  q: AnalyticsQuery,
  reportType: 'inquiries' | 'programs' | 'funnel',
): Promise<void> {
  const apiUrl = getApiUrl()
  const token = getAdminToken()
  const params = queryString(q, { reportType })
  const res = await fetch(`${apiUrl}/api/admin/analytics/export${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Export failed')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vortex-${reportType}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export async function syncExternalAnalytics(): Promise<unknown> {
  const res = await adminApiRequest('/api/admin/analytics/sync', { method: 'POST' })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.message || 'Sync failed')
  return json.data
}

export async function listCompetitors(): Promise<CompetitorRow[]> {
  const res = await adminApiRequest('/api/admin/competitors')
  const json = await res.json()
  if (!json.success) throw new Error(json.message)
  return json.data
}

export async function createCompetitor(body: {
  name: string
  websiteUrl?: string
  notes?: string
}): Promise<CompetitorRow> {
  const res = await adminApiRequest('/api/admin/competitors', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.message)
  return json.data
}

export async function addCompetitorSnapshot(
  id: number,
  body: { rating?: number; reviewCount?: number; notes?: string },
): Promise<void> {
  const res = await adminApiRequest(`/api/admin/competitors/${id}/snapshots`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.message)
}

export async function listMarketingCampaigns(): Promise<MarketingCampaign[]> {
  const res = await adminApiRequest('/api/admin/marketing-campaigns')
  const json = await res.json()
  if (!json.success) throw new Error(json.message)
  return json.data
}

export async function createMarketingCampaign(body: {
  name: string
  channel?: string
  utmCampaign?: string
  budget?: number
}): Promise<MarketingCampaign> {
  const res = await adminApiRequest('/api/admin/marketing-campaigns', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.message)
  return json.data
}
