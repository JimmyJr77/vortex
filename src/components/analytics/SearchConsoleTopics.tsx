import { useState } from 'react'
import {
  fetchSearchConsoleProgramPages,
  fetchSearchConsoleTopics,
  type SearchConsoleProgramPageReport,
  type SearchConsoleProgramPageWindow,
  type SearchConsoleQueryScope,
  type SearchConsoleReportView,
  type SearchConsoleTopicReport,
} from '../../utils/analyticsApi'

const number = new Intl.NumberFormat('en-US')
const signedNumber = new Intl.NumberFormat('en-US', { signDisplay: 'exceptZero' })
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })
const position = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const day = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
})

const problemMessages = {
  missing_property: 'Add the Search Console property to the analytics backend settings.',
  missing_credentials: 'Connect an identity that has access to this Search Console property.',
  access_denied: 'Check the connected identity and its permission to read this Search Console property.',
  provider_error: 'Search Console could not return this report. Try again later.',
}

type VisibilityView = SearchConsoleReportView | 'program-pages'

function impressionCell(impressions: number | null, window: SearchConsoleProgramPageWindow) {
  if (impressions !== null) return number.format(impressions)
  if (window.status === 'ok') return 'No data reported'
  if (window.reason === 'access_denied') return 'Property access denied'
  return 'Unavailable'
}

function LandingPageVisibility({ report }: { report: SearchConsoleProgramPageReport }) {
  const { current, previous, pages } = report
  const dateRange = ({ startDate, endDate }: SearchConsoleProgramPageWindow) =>
    `${day.format(new Date(startDate))} to ${day.format(new Date(endDate))}`

  return <>
    {report.reason && <p role="alert" className="text-sm text-amber-800">{problemMessages[report.reason]}</p>}
    {report.status === 'partial' && <p role="status" className="text-sm text-gray-600">One date range could not be loaded.</p>}
    <div className="overflow-x-auto">
      <table aria-label="Google impressions by landing page" className="min-w-[610px] w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-600">
            <th scope="col" className="py-2 pr-4">Page</th>
            <th scope="col" className="px-3 py-2">Latest 28 days <span className="block font-normal">{dateRange(current)}</span></th>
            <th scope="col" className="px-3 py-2">Previous 28 days <span className="block font-normal">{dateRange(previous)}</span></th>
            <th scope="col" className="px-3 py-2">Impression change</th>
          </tr>
        </thead>
        <tbody>
          {pages.map(({ page, label, currentImpressions, previousImpressions }) => (
            <tr key={page} className="border-b last:border-b-0">
              <th scope="row" className="max-w-xs break-all py-2 pr-4 font-medium">
                {label}
                <span className="block text-xs font-normal text-gray-600">{page}</span>
              </th>
              <td className="px-3 py-2">{impressionCell(currentImpressions, current)}</td>
              <td className="px-3 py-2">{impressionCell(previousImpressions, previous)}</td>
              <td className="px-3 py-2">{currentImpressions !== null && previousImpressions !== null
                ? signedNumber.format(currentImpressions - previousImpressions) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p className="text-xs text-gray-600">
      Includes all web searches. Google usually credits impressions to its selected canonical URL. Dates use Pacific time.
    </p>
  </>
}

function TopicTable({ topics, view }: Pick<SearchConsoleTopicReport, 'topics' | 'view'>) {
  const showPages = view === 'pages'
  const rows = topics.flatMap<SearchConsoleTopicReport['topics'][number] & { page: string | null }>(topic => {
    if (showPages && topic.pages?.length) {
      return topic.pages.map(({ page, metrics }) => ({ ...topic, page, metrics }))
    }
    return [{ ...topic, page: null }]
  })
  return (
    <div className="overflow-x-auto">
      <table aria-label={showPages ? 'Top reported pages by topic' : 'Search visibility by topic'} className="min-w-[610px] w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-600">
            <th scope="col" className="py-2 pr-4">Query topic</th>
            {showPages && <th scope="col" className="px-3 py-2">Page</th>}
            <th scope="col" className="px-3 py-2">Clicks</th>
            <th scope="col" className="px-3 py-2">Impressions</th>
            <th scope="col" className="px-3 py-2">CTR</th>
            <th scope="col" className="px-3 py-2">Avg. position</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, label, page, status, metrics, reason }, index) => (
            <tr key={showPages ? `${id}:${index}` : id} className="border-b last:border-b-0">
              <th scope="row" className="py-2 pr-4 font-medium">{label}</th>
              {metrics ? (
                <>
                  {showPages && <td className="max-w-xs break-all px-3 py-2">{page ?? 'Unlisted page'}</td>}
                  <td className="px-3 py-2">{number.format(metrics.clicks)}</td>
                  <td className="px-3 py-2">{number.format(metrics.impressions)}</td>
                  <td className="px-3 py-2">{metrics.ctr === null ? '—' : percent.format(metrics.ctr)}</td>
                  <td className="px-3 py-2">{metrics.position === null ? '—' : position.format(metrics.position)}</td>
                </>
              ) : (
                <td colSpan={showPages ? 5 : 4} className="px-3 py-2 text-gray-600">
                  {status === 'no_data' && 'No data reported'}
                  {status === 'error' && (reason === 'access_denied' ? 'Property access denied' : 'Query unavailable')}
                  {status === 'unavailable' && 'Report unavailable'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SearchConsoleTopics() {
  const [scope, setScope] = useState<SearchConsoleQueryScope>('all')
  const [view, setView] = useState<VisibilityView>('totals')
  const [report, setReport] = useState<SearchConsoleTopicReport | SearchConsoleProgramPageReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function loadTopics() {
    setLoading(true)
    setError(false)
    try {
      setReport(await (view === 'program-pages' ? fetchSearchConsoleProgramPages() : fetchSearchConsoleTopics(scope, view)))
    } catch {
      setReport(null)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-labelledby="search-console-topics" className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="search-console-topics" className="font-bold text-black">
            {view === 'program-pages' ? 'Google search visibility by landing page' : 'Google search visibility by topic'}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {view === 'program-pages'
              ? 'Compare Google web search impressions for the homepage, program pages, guides, and the former youth sports performance URL.'
              : 'A 28-day report of Google web searches for the Search Console property, using finalized Pacific dates.'}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-900">
            Report type
            <select value={view} disabled={loading} onChange={event => {
              const selected = event.currentTarget.value
              setView(selected === 'pages' || selected === 'program-pages' ? selected : 'totals')
              setReport(null)
              setError(false)
            }} className="rounded-md border border-gray-300 bg-white px-3 py-2 disabled:opacity-60">
              <option value="totals">Topic totals</option>
              <option value="pages">Top reported pages by clicks</option>
              <option value="program-pages">Landing page visibility</option>
            </select>
          </label>
          {view !== 'program-pages' && <label className="flex flex-col gap-1 text-sm font-medium text-gray-900">
            Search queries
            <select value={scope} disabled={loading} onChange={event => {
              setScope(event.currentTarget.value === 'without_vortex' ? 'without_vortex' : 'all')
              setReport(null)
              setError(false)
            }} className="rounded-md border border-gray-300 bg-white px-3 py-2 disabled:opacity-60">
              <option value="all">All matching queries</option>
              <option value="without_vortex">Queries without the Vortex name</option>
            </select>
          </label>}
          <button type="button" onClick={loadTopics} disabled={loading}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60">
            {loading ? 'Checking Search Console…' : 'Check search visibility'}
          </button>
        </div>
      </div>

      <div aria-busy={loading} className="mt-3 space-y-3">
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {view === 'program-pages' ? 'Could not load the Search Console landing page report.' : 'Could not load the Search Console topic report.'} Try again.
          </p>
        )}
        {report && 'pages' in report && <LandingPageVisibility report={report} />}
        {report && 'topics' in report && (
          <>
            <p className="text-sm text-gray-600" role="status">
              {day.format(new Date(report.startDate))} to {day.format(new Date(report.endDate))} (Pacific time).
              {report.status === 'partial' && ' Some topic queries could not be loaded.'}
            </p>
            {report.reason && <p role="alert" className="text-sm text-amber-800">{problemMessages[report.reason]}</p>}
            <TopicTable topics={report.topics} view={report.view} />
            <p className="text-xs text-gray-600">
              Topics can overlap. Google omits some search terms, even when a topic has no reported data.
              {report.scope === 'without_vortex' && ' Searches for program names such as Fit & Flip can still appear.'}
            </p>
            {report.view === 'pages' && <p className="text-xs text-gray-600">
              Up to five pages per topic, ordered by clicks. Google usually credits its selected canonical URLs. Unrecognized paths and query strings are hidden.
            </p>}
          </>
        )}
      </div>
    </section>
  )
}
