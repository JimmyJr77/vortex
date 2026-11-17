import { useState, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { EngagementData, FunnelData, TrafficData } from '../../utils/analyticsApi'

const number = new Intl.NumberFormat()
const percent = (part: number, total: number) => total ? (100 * part / total).toFixed(1) + '%' : '—'
const time = (seconds: number | null) => seconds == null ? '—' : number.format(seconds) + ' s'
const UNAVAILABLE = '—'

function ReportTable<T>({
  title,
  description,
  items,
  columns,
}: {
  title: string
  description?: string
  items: T[]
  columns: Array<{ label: string; cell: (item: T) => ReactNode }>
}) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="font-bold text-black">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      {items.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table aria-label={title} className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-600">
                {columns.map(({ label }) => <th key={label} scope="col" className="px-2 py-2">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-b border-gray-100 last:border-0">
                  {columns.map(({ label, cell }) => <td key={label} className="px-2 py-2">{cell(item)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="mt-3 text-sm text-gray-600">No data for this selection.</p>}
    </div>
  )
}

function Metrics({ items }: { items: Array<{ label: string; value: string; detail?: string }> }) {
  return (
    <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map(({ label, value, detail }) => (
        <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <dt className="text-sm text-gray-600">{label}</dt>
          <dd className="mt-1 text-2xl font-bold text-black">{value}</dd>
          {detail && <dd className="mt-1 text-xs text-gray-600">{detail}</dd>}
        </div>
      ))}
    </dl>
  )
}

function pageLabel(item: { hostname: string; page_path: string }) {
  return <><span className="font-medium">{item.page_path}</span><span className="block text-xs text-gray-500">{item.hostname}</span></>
}

const sessionColumn = { label: 'Sessions', cell: ({ sessions }: { sessions: number }) => number.format(sessions) }
const conversionColumn = { label: 'Converted', cell: ({ conversions }: { conversions: number }) => number.format(conversions) }
const rateColumn = { label: 'Conversion rate', cell: ({ conversions, sessions }: { conversions: number; sessions: number }) => percent(conversions, sessions) }
const pageColumn = { label: 'Page', cell: pageLabel }

export function TrafficReport({ data }: { data: TrafficData }) {
  const { totals } = data
  const days = data.pageViewsByDay.map(day => ({
    ...day,
    day: new Date(day.day + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }),
  }))
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Public visits with analytics consent. Dates use Eastern time. A converting session includes a recorded inquiry, booking, enrollment, account creation, newsletter signup, or purchase.</p>
      <Metrics items={[
        { label: 'Sessions', value: number.format(totals.sessions) },
        { label: 'Unique visitors', value: number.format(totals.visitors),
          detail: `${number.format(totals.visitors - totals.returning_visitors)} new · ${number.format(totals.returning_visitors)} returning` },
        { label: 'Page views', value: number.format(totals.page_views) },
        { label: 'Engaged sessions', value: percent(totals.engaged_sessions, totals.sessions),
          detail: 'Two page views, 10 seconds active, or an action' },
        { label: 'Average active time', value: time(totals.avg_active_seconds),
          detail: `Across ${number.format(totals.timed_sessions)} sessions with timing data` },
        { label: 'Converting sessions', value: number.format(totals.converting_sessions),
          detail: percent(totals.converting_sessions, totals.sessions) === '—' ? undefined : `${percent(totals.converting_sessions, totals.sessions)} of sessions` },
      ]} />
      {days.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-4 font-bold text-black">Visits by day</h3>
          <ResponsiveContainer width="100%" height={256}>
            <LineChart data={days}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line name="Page views" dataKey="page_views" stroke="#dc2626" strokeWidth={2} />
              <Line name="Sessions" dataKey="sessions" stroke="#2563eb" strokeWidth={2} />
              <Line name="Unique visitors" dataKey="visitors" stroke="#0f766e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <ReportTable title="Acquisition channels" items={data.channels} columns={[
          { label: 'Channel', cell: row => row.channel }, sessionColumn, conversionColumn, rateColumn,
        ]} />
        <ReportTable title="Devices" items={data.devices} columns={[
          { label: 'Device', cell: row => row.device }, sessionColumn, conversionColumn, rateColumn,
        ]} />
        <ReportTable title="Top pages" items={data.topPages} columns={[
          pageColumn, { label: 'Views', cell: row => number.format(row.views) }, sessionColumn,
        ]} />
        <ReportTable title="Landing and exit pages" items={data.paths} columns={[
          pageColumn, { label: 'Entrances', cell: row => number.format(row.entrances) },
          { label: 'Exits', cell: row => number.format(row.exits) }, conversionColumn,
          { label: 'Landing conversion rate', cell: row => percent(row.conversions, row.entrances) },
        ]} />
      </div>
      <ReportTable title="Sources and campaigns" description="Attribution uses the session’s first campaign tags or referring website." items={data.sources} columns={[
        { label: 'Channel', cell: row => row.channel },
        { label: 'Source', cell: row => row.source },
        { label: 'Medium', cell: row => row.medium || UNAVAILABLE },
        { label: 'Campaign', cell: row => row.campaign || UNAVAILABLE },
        sessionColumn, conversionColumn, rateColumn,
      ]} />
    </div>
  )
}

const eventLabels: Record<string, string> = {
  cta_click: 'Call to action clicked',
  program_page_view: 'Program page viewed',
  program_interest: 'Program selected',
  schedule_view: 'Schedule viewed',
  media_engagement: 'Media interaction',
  generate_lead: 'Inquiry received',
  inquiry_form_submit: 'Inquiry submit attempted',
  trial_confirm_error: 'Trial confirmation failed',
  trial_confirm_submit: 'Trial confirmation attempted',
  trial_confirmed: 'Trial confirmed',
  store_purchase: 'Store order confirmed',
  class_signup_submitted: 'Class signup submitted',
  enrollment_confirmed: 'Enrollment confirmed',
}
const actionLabel = (event: string) => eventLabels[event] || event.replaceAll('_', ' ')

const goalByVital = { LCP: 2500, INP: 200, CLS: 0.1, FCP: 1800, TTFB: 800 }

function renderVital(row: EngagementData['vitals'][number] | EngagementData['vitalPages'][number]) {
  return number.format(row.p75) + (row.metric === 'CLS' ? '' : ' ms')
}

export function EngagementReport({ data }: { data: EngagementData }) {
  const [action, setAction] = useState('')
  const actionOptions = [...new Set(data.topActions.map(row => row.event_name))]
  const topActions = action ? data.topActions.filter(row => row.event_name === action) : data.topActions.slice(0, 25)
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <ReportTable title="Website actions" items={data.actions} columns={[
          { label: 'Action', cell: row => actionLabel(row.event_name) },
          { label: 'Events', cell: row => number.format(row.events) }, sessionColumn,
        ]} />
        <ReportTable title="Scroll depth" description="Share of tracked page views that reached each point on the page." items={data.pageViews ? data.scroll : []} columns={[
          { label: 'Depth', cell: row => row.percent + '%' },
          { label: 'Page views', cell: row => number.format(row.views) },
          { label: 'Share of views', cell: row => percent(row.views, data.pageViews) },
        ]} />
      </div>
      <div className="space-y-2">
        {actionOptions.length > 0 && (
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            Filter top actions
            <select value={action} onChange={event => setAction(event.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1">
              <option value="">All actions</option>
              {actionOptions.map(option => <option key={option} value={option}>{actionLabel(option)}</option>)}
            </select>
          </label>
        )}
        <ReportTable title="Top actions by page" description="Compare calls to action, contact links, program interest, and registration activity." items={topActions} columns={[
          pageColumn, { label: 'Action', cell: row => actionLabel(row.event_name) },
          { label: 'Target', cell: row => row.target },
          { label: 'Events', cell: row => number.format(row.events) }, sessionColumn,
        ]} />
      </div>
      <ReportTable title="Page engagement" description={`Active time is measured for ${number.format(data.timedViews)} of ${number.format(data.pageViews)} tracked page views.`} items={data.pages} columns={[
        pageColumn, { label: 'Views', cell: row => number.format(row.views) },
        { label: 'Timed views', cell: row => number.format(row.timed_views) },
        { label: 'Average active time', cell: row => time(row.avg_active_seconds) },
        { label: 'Reached 75% depth', cell: row => percent(row.depth_75_views, row.views) },
      ]} />
      <div className="grid gap-4 xl:grid-cols-2">
        <ReportTable title="Web Vitals by device" description="The 75th percentile (p75) comes from consented, observed page loads." items={data.vitals} columns={[
          { label: 'Metric', cell: row => row.metric },
          { label: 'Device', cell: row => row.device },
          { label: 'p75', cell: row => <span className={row.p75 <= goalByVital[row.metric] ? 'text-green-800' : 'text-amber-800'}>{renderVital(row)}</span> },
          { label: 'Good threshold', cell: row => renderVital({ ...row, p75: goalByVital[row.metric] }) },
          { label: 'Samples', cell: row => number.format(row.samples) },
        ]} />
        <ReportTable title="Web Vitals by page" items={data.vitalPages} columns={[
          pageColumn, { label: 'Metric', cell: row => row.metric },
          { label: 'p75', cell: renderVital }, { label: 'Samples', cell: row => number.format(row.samples) },
        ]} />
      </div>
    </div>
  )
}

export function FunnelReport({ data }: { data: FunnelData }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Each step counts consented sessions that reached it in order. Confirmations without an earlier tracked step appear in the Engagement tab.</p>
      <div className="grid gap-4 xl:grid-cols-2">
        {data.journeys.map(journey => (
          <ReportTable key={journey.name} title={journey.name} items={journey.steps} columns={[
            { label: 'Step', cell: row => row.name },
            { label: 'Sessions', cell: row => number.format(row.count) },
            { label: 'From previous step', cell: row => row.conversionFromPrevious == null ? UNAVAILABLE : row.conversionFromPrevious + '%' },
          ]} />
        ))}
      </div>
    </div>
  )
}
