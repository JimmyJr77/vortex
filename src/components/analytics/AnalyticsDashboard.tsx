import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  RefreshCw,
  Download,
  AlertTriangle,
  Users,
  Mail,
  TrendingUp,
  Globe,
  Target,
} from 'lucide-react'
import DateRangeFilter from './DateRangeFilter'
import {
  buildRangeFromPreset,
  type AnalyticsQuery,
  type DatePreset,
  fetchOverview,
  fetchTraffic,
  fetchFunnel,
  fetchPrograms,
  fetchInquiries,
  fetchConversion,
  fetchSeo,
  downloadAnalyticsExport,
  syncExternalAnalytics,
  listCompetitors,
  createCompetitor,
  addCompetitorSnapshot,
  listMarketingCampaigns,
  createMarketingCampaign,
  type OverviewData,
  type TrafficData,
  type FunnelData,
  type ProgramsData,
  type InquiryRow,
  type ConversionData,
  type SeoData,
  type CompetitorRow,
  type MarketingCampaign,
} from '../../utils/analyticsApi'

type TabId =
  | 'overview'
  | 'traffic'
  | 'funnel'
  | 'programs'
  | 'inquiries'
  | 'conversion'
  | 'seo'
  | 'competitors'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'funnel', label: 'Lead Funnel' },
  { id: 'programs', label: 'Programs & Capacity' },
  { id: 'inquiries', label: 'Inquiries & Attribution' },
  { id: 'conversion', label: 'Conversion' },
  { id: 'seo', label: 'Marketing & SEO' },
  { id: 'competitors', label: 'Competitors' },
]

const CHART_RED = '#dc2626'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-center space-x-3 mb-2">
        <Icon className="w-5 h-5 text-vortex-red" />
        <span className="text-gray-600 text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold text-black">{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
    </div>
  )
}

function formatDay(d: string) {
  try {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return d
  }
}

export default function AnalyticsDashboard() {
  const [tab, setTab] = useState<TabId>('overview')
  const [preset, setPreset] = useState<DatePreset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [hostname, setHostname] = useState('all')
  const [query, setQuery] = useState<AnalyticsQuery>(() =>
    buildRangeFromPreset('30d'),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [traffic, setTraffic] = useState<TrafficData | null>(null)
  const [funnel, setFunnel] = useState<FunnelData | null>(null)
  const [programs, setPrograms] = useState<ProgramsData | null>(null)
  const [inquiries, setInquiries] = useState<InquiryRow[] | null>(null)
  const [conversion, setConversion] = useState<ConversionData | null>(null)
  const [seo, setSeo] = useState<SeoData | null>(null)
  const [competitors, setCompetitors] = useState<CompetitorRow[] | null>(null)
  const [campaigns, setCampaigns] = useState<MarketingCampaign[] | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const applyRange = useCallback(() => {
    const q = buildRangeFromPreset(preset, customFrom, customTo)
    if (hostname !== 'all') q.hostname = hostname
    setQuery(q)
  }, [preset, customFrom, customTo, hostname])

  const loadTab = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      switch (tab) {
        case 'overview':
          setOverview(await fetchOverview(query))
          break
        case 'traffic':
          setTraffic(await fetchTraffic(query))
          break
        case 'funnel':
          setFunnel(await fetchFunnel(query))
          break
        case 'programs':
          setPrograms(await fetchPrograms(query))
          break
        case 'inquiries':
          setInquiries(await fetchInquiries(query))
          break
        case 'conversion':
          setConversion(await fetchConversion(query))
          break
        case 'seo': {
          const [s, c] = await Promise.all([
            fetchSeo(query),
            listMarketingCampaigns(),
          ])
          setSeo(s)
          setCampaigns(c)
          break
        }
        case 'competitors':
          setCompetitors(await listCompetitors())
          break
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [tab, query])

  useEffect(() => {
    loadTab()
  }, [loadTab])

  const handleExport = async (reportType: 'inquiries' | 'programs') => {
    try {
      await downloadAnalyticsExport(query, reportType)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed')
    }
  }

  const handleSync = async () => {
    setSyncMsg(null)
    try {
      const result = await syncExternalAnalytics()
      setSyncMsg(JSON.stringify(result))
      await loadTab()
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Sync failed')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t ${
              tab === t.id
                ? 'bg-vortex-red text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'competitors' && (
        <DateRangeFilter
          preset={preset}
          onPresetChange={setPreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          hostname={hostname}
          onHostnameChange={setHostname}
          onApply={applyRange}
          loading={loading}
        />
      )}

      <div className="flex justify-end gap-2 mb-4">
        <motion.button
          type="button"
          onClick={loadTab}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-700 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-600 disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </motion.button>
        {(tab === 'inquiries' || tab === 'programs') && (
          <button
            type="button"
            onClick={() =>
              handleExport(tab === 'programs' ? 'programs' : 'inquiries')
            }
            className="flex items-center gap-2 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
        {tab === 'seo' && (
          <button
            type="button"
            onClick={handleSync}
            className="flex items-center gap-2 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700"
          >
            <Globe className="w-4 h-4" />
            Sync GA4 / GSC
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading && !overview && !traffic && !funnel && (
        <div className="bg-white p-8 rounded-lg border text-center text-gray-600">
          Loading…
        </div>
      )}

      {tab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Inquiries"
              value={overview.inquiries.total}
              sub={`${overview.inquiries.contactedRate}% contacted`}
              icon={Mail}
            />
            <StatCard
              label="Sessions"
              value={overview.sessions}
              sub="excludes staff"
              icon={Users}
            />
            <StatCard
              label="New enrollments"
              value={overview.newEnrollments}
              icon={TrendingUp}
            />
            <StatCard
              label="Newsletter signups"
              value={overview.newsletterSignups}
              icon={Target}
            />
          </div>
          {overview.uncontactedOver48h > 0 && (
            <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                <strong>{overview.uncontactedOver48h}</strong> inquiries not
                contacted in over 48 hours.
              </p>
            </div>
          )}
          {overview.capacityAlerts.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="font-bold text-black mb-3">Capacity alerts</h3>
              <ul className="space-y-2 text-sm">
                {overview.capacityAlerts.map((a) => (
                  <li key={a.programId} className="flex justify-between">
                    <span>{a.name}</span>
                    <span className="text-vortex-red font-medium">
                      {a.fillRate}% ({a.alert})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-bold text-black mb-4">Inquiry trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={overview.inquiries.trend.map((r) => ({
                  day: formatDay(String(r.day)),
                  count: r.count,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke={CHART_RED} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'traffic' && traffic && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-bold text-black mb-4">Page views by day</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={traffic.pageViewsByDay.map((r) => ({
                  day: formatDay(String(r.day)),
                  views: r.page_views,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="views" stroke={CHART_RED} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-bold text-black mb-4">Top pages</h3>
            <div className="space-y-2">
              {traffic.topPages.map((p, i) => (
                <div
                  key={p.page_path}
                  className="flex justify-between bg-gray-50 p-3 rounded border text-sm"
                >
                  <span>
                    {i + 1}. {p.page_path || '/'}
                  </span>
                  <span className="font-semibold text-vortex-red">{p.views}</span>
                </div>
              ))}
              {traffic.topPages.length === 0 && (
                <p className="text-gray-500 text-center py-4">No page views in range</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'funnel' && funnel && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="font-bold text-black mb-4">Conversion funnel</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={funnel.steps}
              layout="vertical"
              margin={{ left: 120 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_RED}>
                {funnel.steps.map((_, i) => (
                  <Cell key={i} fill={CHART_RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <table className="w-full mt-4 text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2">Step</th>
                <th className="py-2">Count</th>
                <th className="py-2">From previous</th>
              </tr>
            </thead>
            <tbody>
              {funnel.steps.map((s) => (
                <tr key={s.name} className="border-b border-gray-100">
                  <td className="py-2">{s.name}</td>
                  <td className="py-2 font-medium">{s.count}</td>
                  <td className="py-2">{s.conversionFromPrevious}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'programs' && programs && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-bold text-black mb-4">Inquiries by interest</h3>
            <ResponsiveContainer width="100%" height={Math.min(400, programs.inquiriesByInterest.length * 36 + 40)}>
              <BarChart data={programs.inquiriesByInterest.slice(0, 12)} layout="vertical" margin={{ left: 140 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="interest" width={130} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill={CHART_RED} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 overflow-x-auto">
            <h3 className="font-bold text-black mb-4">Program capacity</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-4">Program</th>
                  <th className="py-2 pr-4">Enrolled</th>
                  <th className="py-2 pr-4">Capacity</th>
                  <th className="py-2">Fill %</th>
                </tr>
              </thead>
              <tbody>
                {programs.capacity.map((p) => (
                  <tr key={p.programId} className="border-b border-gray-100">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">{p.enrolled}</td>
                    <td className="py-2">{p.capacity}</td>
                    <td className="py-2 font-medium">
                      {p.fillRate != null ? `${p.fillRate}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'inquiries' && inquiries && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-left text-gray-600 border-b bg-gray-50">
                <th className="p-3">Date</th>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Status</th>
                <th className="p-3">UTM source</th>
                <th className="p-3">Campaign</th>
                <th className="p-3">Landing</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="p-3 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    {r.first_name} {r.last_name}
                  </td>
                  <td className="p-3">{r.email}</td>
                  <td className="p-3">{r.lead_status}</td>
                  <td className="p-3">{r.utm_source || '—'}</td>
                  <td className="p-3">{r.utm_campaign || '—'}</td>
                  <td className="p-3 max-w-[200px] truncate" title={r.landing_page || ''}>
                    {r.landing_page || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {inquiries.length === 0 && (
            <p className="text-center text-gray-500 py-8">No inquiries in range</p>
          )}
        </div>
      )}

      {tab === 'conversion' && conversion && (
        <div className="space-y-6">
          <StatCard
            label="New families"
            value={conversion.newFamilies}
            icon={Users}
          />
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-bold text-black mb-4">
              Inquired, not enrolled (up to 200)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Contacted</th>
                    <th className="py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {conversion.inquiriesNotEnrolled.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {r.first_name} {r.last_name}
                      </td>
                      <td className="py-2">{r.email}</td>
                      <td className="py-2">{r.contacted ? 'Yes' : 'No'}</td>
                      <td className="py-2">{r.utm_source || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'seo' && (
        <SeoTab
          seo={seo}
          campaigns={campaigns}
          syncMsg={syncMsg}
          onReload={loadTab}
        />
      )}

      {tab === 'competitors' && (
        <CompetitorsTab
          competitors={competitors}
          onReload={loadTab}
          loading={loading}
        />
      )}
    </motion.div>
  )
}

function SeoTab({
  seo,
  campaigns,
  syncMsg,
  onReload,
}: {
  seo: SeoData | null
  campaigns: MarketingCampaign[] | null
  syncMsg: string | null
  onReload: () => void
}) {
  const [campName, setCampName] = useState('')
  const [campChannel, setCampChannel] = useState('')
  const [campUtm, setCampUtm] = useState('')
  const [campBudget, setCampBudget] = useState('')

  const addCampaign = async () => {
    if (!campName.trim()) return
    await createMarketingCampaign({
      name: campName,
      channel: campChannel || undefined,
      utmCampaign: campUtm || undefined,
      budget: campBudget ? Number(campBudget) : undefined,
    })
    setCampName('')
    onReload()
  }

  if (!seo) {
    return (
      <div className="bg-white p-8 rounded-lg border text-center text-gray-600">
        Loading SEO data…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!seo.configured && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
          GA4/GSC credentials are not configured on the server. First-party
          landing-page data still appears below. See docs/ANALYTICS-INTEGRATIONS.md.
        </div>
      )}
      {syncMsg && (
        <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-24">
          {syncMsg}
        </pre>
      )}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="font-bold text-black mb-4">Inquiries by landing page</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="py-2">Page</th>
              <th className="py-2">Inquiries</th>
            </tr>
          </thead>
          <tbody>
            {seo.inquiriesByLandingPage.map((r) => (
              <tr key={r.landing_page} className="border-b">
                <td className="py-2">{r.landing_page}</td>
                <td className="py-2 font-medium">{r.inquiries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {seo.keywords.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200 overflow-x-auto">
          <h3 className="font-bold text-black mb-4">Search keywords (GSC)</h3>
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="p-2">Query</th>
                <th className="p-2">Clicks</th>
                <th className="p-2">Impressions</th>
                <th className="p-2">Position</th>
              </tr>
            </thead>
            <tbody>
              {seo.keywords.slice(0, 50).map((k, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{k.query}</td>
                  <td className="p-2">{k.clicks}</td>
                  <td className="p-2">{k.impressions}</td>
                  <td className="p-2">{Number(k.position).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="font-bold text-black mb-4">Marketing campaigns</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            placeholder="Campaign name"
            value={campName}
            onChange={(e) => setCampName(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <input
            placeholder="Channel"
            value={campChannel}
            onChange={(e) => setCampChannel(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <input
            placeholder="utm_campaign"
            value={campUtm}
            onChange={(e) => setCampUtm(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <input
            placeholder="Budget"
            type="number"
            value={campBudget}
            onChange={(e) => setCampBudget(e.target.value)}
            className="border rounded px-2 py-1 text-sm w-24"
          />
          <button
            type="button"
            onClick={addCampaign}
            className="px-3 py-1 bg-vortex-red text-white rounded text-sm"
          >
            Add
          </button>
        </div>
        <ul className="text-sm space-y-1">
          {(campaigns || []).map((c) => (
            <li key={c.id}>
              {c.name} — {c.channel || 'no channel'} — utm:{' '}
              {c.utm_campaign || '—'} — budget: {c.budget ?? '—'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function CompetitorsTab({
  competitors,
  onReload,
  loading,
}: {
  competitors: CompetitorRow[] | null
  onReload: () => void
  loading: boolean
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [snapId, setSnapId] = useState<number | null>(null)
  const [rating, setRating] = useState('')
  const [reviews, setReviews] = useState('')

  const addComp = async () => {
    if (!name.trim()) return
    await createCompetitor({ name, websiteUrl: url || undefined })
    setName('')
    setUrl('')
    onReload()
  }

  const saveSnap = async () => {
    if (snapId == null) return
    await addCompetitorSnapshot(snapId, {
      rating: rating ? Number(rating) : undefined,
      reviewCount: reviews ? Number(reviews) : undefined,
    })
    setRating('')
    setReviews('')
    setSnapId(null)
    onReload()
  }

  if (loading && !competitors) {
    return <div className="text-center py-8 text-gray-600">Loading…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded border">
        <input
          placeholder="Competitor name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        <input
          placeholder="Website URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="border rounded px-2 py-1 text-sm flex-1 min-w-[200px]"
        />
        <button
          type="button"
          onClick={addComp}
          className="px-3 py-1 bg-vortex-red text-white rounded text-sm"
        >
          Add competitor
        </button>
      </div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b bg-gray-50">
              <th className="p-3">Name</th>
              <th className="p-3">Website</th>
              <th className="p-3">Rating</th>
              <th className="p-3">Reviews</th>
              <th className="p-3">Snapshot</th>
            </tr>
          </thead>
          <tbody>
            {(competitors || []).map((c) => (
              <tr key={c.id} className="border-b">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.website_url || '—'}</td>
                <td className="p-3">{c.latest_snapshot?.rating ?? '—'}</td>
                <td className="p-3">{c.latest_snapshot?.review_count ?? '—'}</td>
                <td className="p-3">
                  {snapId === c.id ? (
                    <span className="flex gap-1 items-center">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        placeholder="Rating"
                        value={rating}
                        onChange={(e) => setRating(e.target.value)}
                        className="w-16 border rounded px-1 text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Reviews"
                        value={reviews}
                        onChange={(e) => setReviews(e.target.value)}
                        className="w-16 border rounded px-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={saveSnap}
                        className="text-xs text-vortex-red font-semibold"
                      >
                        Save
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSnapId(c.id)}
                      className="text-xs text-vortex-red font-semibold"
                    >
                      Add snapshot
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
