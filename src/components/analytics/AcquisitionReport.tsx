import { useId, useState } from 'react'
import type { AcquisitionData, AcquisitionRow, AcquisitionTotals } from '../../utils/analyticsApi'

const count = new Intl.NumberFormat('en-US')
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const currency = (cents: number | null) => cents == null ? '—' : dollars.format(cents / 100)
const purchases = (row: AcquisitionTotals) => row.paidClassCheckouts + row.paidDropIns + row.storePurchases

const sortOptions = [
  { id: 'inquiries', label: 'Most inquiries', value: (row: AcquisitionRow) => row.inquiries },
  { id: 'freeTrials', label: 'Most free trials', value: (row: AcquisitionRow) => row.freeTrials },
  { id: 'purchases', label: 'Most paid purchases', value: purchases },
  { id: 'revenue', label: 'Highest revenue', value: (row: AcquisitionRow) => row.revenueCents ?? 0 },
] as const

const outcomeColumns = [
  { key: 'inquiries', label: 'Inquiries' },
  { key: 'freeTrials', label: 'Free trials' },
  { key: 'paidClassCheckouts', label: 'Paid class checkouts' },
  { key: 'paidDropIns', label: 'Paid drop-ins' },
  { key: 'storePurchases', label: 'Store purchases' },
] as const

type Sort = (typeof sortOptions)[number]['id']

export default function AcquisitionReport({ data }: { data: AcquisitionData | null }) {
  const headingId = useId()
  const [channel, setChannel] = useState('')
  const [sort, setSort] = useState<Sort>('inquiries')

  if (!data) {
    return <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">Lead and purchase sources are unavailable for this location.</p>
  }

  const { rows, totals, attributed, canViewRevenue } = data
  const channels = [...new Set(rows.map(row => row.channel))].sort((a, b) => a.localeCompare(b))
  const activeChannel = channels.includes(channel) ? channel : ''
  const visibleSortOptions = sortOptions.filter(option => canViewRevenue || option.id !== 'revenue')
  const activeSort = visibleSortOptions.find(option => option.id === sort) ?? sortOptions[0]
  const sortedRows = rows.filter(row => !activeChannel || row.channel === activeChannel).sort((a, b) => (
    activeSort.value(b) - activeSort.value(a) || a.source.localeCompare(b.source) || (a.campaign ?? '').localeCompare(b.campaign ?? '')
  ))
  const coverage = [
    { label: 'Inquiries', total: count.format(totals.inquiries), known: count.format(attributed.inquiries) },
    { label: 'Free trials', total: count.format(totals.freeTrials), known: count.format(attributed.freeTrials) },
    { label: 'Paid purchases', total: count.format(purchases(totals)), known: count.format(purchases(attributed)) },
  ]
  if (canViewRevenue) {
    coverage.push({ label: 'Collected revenue', total: currency(totals.revenueCents), known: currency(attributed.revenueCents) })
  }

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div>
        <h3 id={headingId} className="text-lg font-bold text-gray-900">Lead &amp; purchase sources</h3>
        <p className="mt-1 text-sm text-gray-600">
          Includes inquiries, confirmed free trials, and paid class checkouts, drop-ins, and store orders for this location.
          {canViewRevenue && ' Revenue is before refunds.'} Unknown and Staff entry are excluded from known-source counts.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {coverage.map(({ label, total, known }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <dt className="text-sm text-gray-600">{label}</dt>
            <dd className="mt-1 text-2xl font-bold text-gray-900">{total}</dd>
            <dd className="mt-1 text-xs text-gray-600">{known} with a known source</dd>
          </div>
        ))}
      </dl>
      {rows.length > 0 ? (
        <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap gap-x-5 gap-y-3 pb-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <label htmlFor={`${headingId}-channel`}>Channel</label>
              <select id={`${headingId}-channel`} value={activeChannel} onChange={event => setChannel(event.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1">
                <option value="">All channels</option>
                {channels.map(option => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <label htmlFor={`${headingId}-sort`}>Sort by</label>
              <select id={`${headingId}-sort`} value={activeSort.id} onChange={event => setSort(event.target.value as Sort)} className="rounded border border-gray-300 bg-white px-2 py-1">
                {visibleSortOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </div>
          </div>
          <div role="region" aria-label="Source details" tabIndex={0} className="overflow-x-auto rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vortex-red">
            <table aria-label="Outcomes by source and campaign" className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-700">
                  <th scope="col" className="px-3 py-2">Source / channel</th>
                  <th scope="col" className="px-3 py-2">Campaign / medium</th>
                  {outcomeColumns.map(({ key, label }) => <th key={key} scope="col" className="px-3 py-2 text-right">{label}</th>)}
                  {canViewRevenue && <th scope="col" className="px-3 py-2 text-right">Collected revenue</th>}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(row => (
                  <tr key={JSON.stringify([row.channel, row.source, row.medium, row.campaign])} className="border-b border-gray-100 last:border-0">
                    <th scope="row" className="whitespace-normal break-words px-3 py-2 font-medium text-gray-900">
                      {row.source}
                      {row.channel !== row.source && <span className="block text-xs font-normal text-gray-600">{row.channel}</span>}
                    </th>
                    <td className="whitespace-normal break-words px-3 py-2">
                      {row.campaign || '—'}
                      {row.medium && <span className="block text-xs text-gray-600">{row.medium}</span>}
                    </td>
                    {outcomeColumns.map(({ key }) => <td key={key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{count.format(row[key])}</td>)}
                    {canViewRevenue && <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{currency(row.revenueCents)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">No leads or paid purchases in this date range.</p>
      )}
    </section>
  )
}
