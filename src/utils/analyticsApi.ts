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
  if (preset === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo }
  }
  const to = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const from = new Date(to + 'T00:00:00Z')
  from.setUTCDate(from.getUTCDate() - (preset === '7d' ? 6 : preset === '90d' ? 89 : 29))
  return { from: from.toISOString().slice(0, 10), to }
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
  outcomes?: {
    free_trials: number
    other_drop_ins: number
    enrollments: number
    store_orders: number
    store_order_value_cents: number
  } | null
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

type SessionConversions = { sessions: number; conversions: number }
type WebsitePage = { hostname: string; page_path: string }
type ActionCounts = { event_name: string; events: number; sessions: number }
type Vital = { metric: 'CLS' | 'LCP' | 'INP' | 'FCP' | 'TTFB'; p75: number; samples: number }

export interface TrafficData {
  totals: {
    sessions: number
    page_views: number
    visitors: number
    returning_visitors: number
    engaged_sessions: number
    converting_sessions: number
    timed_sessions: number
    avg_active_seconds: number | null
  }
  pageViewsByDay: Array<{ day: string; page_views: number; sessions: number; visitors: number }>
  topPages: Array<WebsitePage & { views: number; sessions: number }>
  paths: Array<WebsitePage & { entrances: number; exits: number; conversions: number }>
  devices: Array<SessionConversions & { device: string }>
  channels: Array<SessionConversions & { channel: string }>
  sources: Array<SessionConversions & { channel: string; source: string; medium: string | null; campaign: string | null }>
}

export interface EngagementData {
  pageViews: number
  timedViews: number
  actions: ActionCounts[]
  topActions: Array<ActionCounts & WebsitePage & { target: string }>
  scroll: Array<{ percent: number; views: number }>
  pages: Array<WebsitePage & { views: number; timed_views: number; avg_active_seconds: number | null; depth_75_views: number }>
  vitals: Array<Vital & { device: string }>
  vitalPages: Array<Vital & WebsitePage>
}

export interface FunnelData {
  journeys: Array<{
    name: string
    steps: Array<{ name: string; count: number; conversionFromPrevious: number | null }>
  }>
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
    impressions: number
    clicks: number
    position: number | null
    ctr: number | null
  }>
  inquiriesByLandingPage: Array<{ landing_page: string; inquiries: number }>
  dailyTraffic: Array<{
    date: string
    hostname: string
    sessions: number
    users: number
    page_views: number
    source: string
  }>
}

export type SearchConsoleTopicFailure = 'access_denied' | 'provider_error'
export type SearchConsoleQueryScope = 'all' | 'without_vortex'
export type SearchConsoleReportView = 'totals' | 'pages'

interface SearchConsoleTopicMetrics {
  clicks: number
  impressions: number
  ctr: number | null
  position: number | null
}

export interface SearchConsoleTopicReport {
  scope?: SearchConsoleQueryScope
  view?: SearchConsoleReportView
  status: 'ok' | 'partial' | 'unconfigured' | 'error'
  reason?: 'missing_property' | 'missing_credentials' | SearchConsoleTopicFailure
  startDate: string
  endDate: string
  timeZone: 'America/Los_Angeles'
  topics: Array<{
    id: string
    label: string
    status: 'reported' | 'no_data' | 'error' | 'unavailable'
    metrics: SearchConsoleTopicMetrics | null
    pages?: Array<{ page: string | null; metrics: SearchConsoleTopicMetrics }>
    reason?: SearchConsoleTopicFailure
  }>
}

export async function fetchSearchConsoleTopics(scope: SearchConsoleQueryScope = 'all', view: SearchConsoleReportView = 'totals'): Promise<SearchConsoleTopicReport> {
  const params = new URLSearchParams()
  if (scope !== 'all') params.set('scope', scope)
  if (view !== 'totals') params.set('view', view)
  const query = params.size ? `?${params}` : ''
  const response = await adminApiRequest(`/api/admin/analytics/seo/topics${query}`)
  const result = await response.json()
  const report: SearchConsoleTopicReport | undefined = result.data
  if (!response.ok || !result.success || !report || (report.scope ?? 'all') !== scope || (report.view ?? 'totals') !== view) {
    throw new Error('Could not load the Search Console topic report.')
  }
  return report
}

export interface SearchConsoleProgramPageWindow {
  startDate: string
  endDate: string
  status: 'ok' | 'error' | 'unavailable'
  reason?: SearchConsoleTopicFailure
}

export interface SearchConsoleProgramPageReport {
  status: SearchConsoleTopicReport['status']
  reason?: SearchConsoleTopicReport['reason']
  timeZone: 'America/Los_Angeles'
  current: SearchConsoleProgramPageWindow
  previous: SearchConsoleProgramPageWindow
  pages: Array<{
    page: string
    label: string
    currentImpressions: number | null
    previousImpressions: number | null
  }>
}

export async function fetchSearchConsoleProgramPages(): Promise<SearchConsoleProgramPageReport> {
  const response = await adminApiRequest('/api/admin/analytics/seo/program-pages')
  const result = await response.json()
  const report: SearchConsoleProgramPageReport | undefined = result.data
  if (!response.ok || !result.success || !report?.current || !report.previous || !Array.isArray(report.pages)) {
    throw new Error('Could not load the Search Console program page report.')
  }
  return report
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
export const fetchEngagement = (q: AnalyticsQuery) =>
  fetchJson<EngagementData>('/api/admin/analytics/engagement', q)
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
  reportType: 'inquiries' | 'programs' | 'traffic' | 'engagement' | 'funnel',
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
