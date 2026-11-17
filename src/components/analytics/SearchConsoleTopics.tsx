import { useState } from 'react'
import {
  fetchSearchConsoleTopics,
  type SearchConsoleQueryScope,
  type SearchConsoleReportView,
  type SearchConsoleTopicReport,
} from '../../utils/analyticsApi'

const number = new Intl.NumberFormat('en-US')
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
  const [view, setView] = useState<SearchConsoleReportView>('totals')
  const [report, setReport] = useState<SearchConsoleTopicReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function loadTopics() {
    setLoading(true)
    setError(false)
    try {
      setReport(await fetchSearchConsoleTopics(scope, view))
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
          <h3 id="search-console-topics" className="font-bold text-black">Google search visibility by topic</h3>
          <p className="mt-1 text-sm text-gray-600">
            A 28-day report of Google web searches for the Search Console property, using finalized Pacific dates.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-900">
            Report type
            <select value={view} disabled={loading} onChange={event => {
              setView(event.currentTarget.value === 'pages' ? 'pages' : 'totals')
              setReport(null)
              setError(false)
            }} className="rounded-md border border-gray-300 bg-white px-3 py-2 disabled:opacity-60">
              <option value="totals">Topic totals</option>
              <option value="pages">Top reported pages by clicks</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-900">
            Search queries
            <select value={scope} disabled={loading} onChange={event => {
              setScope(event.currentTarget.value === 'without_vortex' ? 'without_vortex' : 'all')
              setReport(null)
              setError(false)
            }} className="rounded-md border border-gray-300 bg-white px-3 py-2 disabled:opacity-60">
              <option value="all">All matching queries</option>
              <option value="without_vortex">Queries without the Vortex name</option>
            </select>
          </label>
          <button type="button" onClick={loadTopics} disabled={loading}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60">
            {loading ? 'Checking Search Console…' : 'Check search visibility'}
          </button>
        </div>
      </div>

      <div aria-busy={loading} className="mt-3 space-y-3">
        {error && (
          <p role="alert" className="text-sm text-red-700">
            Could not load the Search Console topic report. Try again.
          </p>
        )}
        {report && (
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
