import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import {
  adminFetchPromoCodes,
  type PromoCodeRegistryEntry,
  type PromoCodeSourceType,
} from '../../utils/schedulingApi'

type SortKey =
  | 'code'
  | 'sourceName'
  | 'sourceType'
  | 'subtypeLabel'
  | 'active'
  | 'redeemedCount'
  | 'startsAt'

type SortDir = 'asc' | 'desc'

const SOURCE_LABELS: Record<PromoCodeSourceType, string> = {
  discount: 'Discount',
  free_pass: 'Free pass',
}

function compareValues(a: unknown, b: unknown, dir: SortDir): number {
  const mult = dir === 'asc' ? 1 : -1
  if (a == null && b == null) return 0
  if (a == null) return 1 * mult
  if (b == null) return -1 * mult
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return (a === b ? 0 : a ? -1 : 1) * mult
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * mult
  }
  return String(a).localeCompare(String(b)) * mult
}

const AdminPromoCodesPanel = () => {
  const [entries, setEntries] = useState<PromoCodeRegistryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | PromoCodeSourceType>('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('code')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEntries(await adminFetchPromoCodes())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load promo codes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-vortex-red" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-vortex-red" />
    )
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = entries
    if (sourceFilter !== 'all') {
      rows = rows.filter((e) => e.sourceType === sourceFilter)
    }
    if (activeFilter === 'active') rows = rows.filter((e) => e.active)
    if (activeFilter === 'inactive') rows = rows.filter((e) => !e.active)
    if (q) {
      rows = rows.filter(
        (e) =>
          e.code.toLowerCase().includes(q) ||
          e.sourceName.toLowerCase().includes(q) ||
          e.subtypeLabel.toLowerCase().includes(q),
      )
    }
    return [...rows].sort((a, b) => {
      let av: unknown = a[sortKey]
      let bv: unknown = b[sortKey]
      if (sortKey === 'redeemedCount') {
        av = a.redeemedCount
        bv = b.redeemedCount
      }
      return compareValues(av, bv, sortDir)
    })
  }, [entries, query, sourceFilter, activeFilter, sortKey, sortDir])

  const sortableHeader = (label: string, column: SortKey) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-gray-900"
      onClick={() => toggleSort(column)}
    >
      {label}
      <SortIcon column={column} />
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Promo codes</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Every discount and free pass has a promo code for tracking. Codes are auto-generated on
            save when left blank, and can be entered manually at checkout or in the editors.
          </p>
        </div>

        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-end">
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs font-semibold mb-1 text-gray-600">Search</label>
            <input
              type="search"
              placeholder="Code, name, or type…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Source</label>
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
            >
              <option value="all">All</option>
              <option value="discount">Discounts</option>
              <option value="free_pass">Free passes</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Status</label>
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400">
            {entries.length === 0 ? 'No promo codes yet.' : 'No codes match your filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2">{sortableHeader('Code', 'code')}</th>
                  <th className="px-4 py-2">{sortableHeader('Name', 'sourceName')}</th>
                  <th className="px-4 py-2">{sortableHeader('Source', 'sourceType')}</th>
                  <th className="px-4 py-2">{sortableHeader('Type', 'subtypeLabel')}</th>
                  <th className="px-4 py-2">{sortableHeader('Status', 'active')}</th>
                  <th className="px-4 py-2">{sortableHeader('Used', 'redeemedCount')}</th>
                  <th className="px-4 py-2">{sortableHeader('Valid from', 'startsAt')}</th>
                  <th className="px-4 py-2">Valid through</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={`${entry.sourceType}-${entry.sourceId}`} className="border-b border-gray-50">
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-gray-900">
                      {entry.code}
                      {entry.autoGenerated && (
                        <span className="ml-2 text-[10px] font-sans font-normal text-gray-400 uppercase">
                          auto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-800">{entry.sourceName}</td>
                    <td className="px-4 py-2 text-gray-600">{SOURCE_LABELS[entry.sourceType]}</td>
                    <td className="px-4 py-2 text-gray-600">{entry.subtypeLabel}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                          entry.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {entry.active ? 'Active' : 'Off'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {entry.redeemedCount}
                      {entry.maxRedemptions != null ? ` / ${entry.maxRedemptions}` : ''}
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-xs">
                      {entry.startsAt ? entry.startsAt.slice(0, 10) : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-xs">
                      {entry.endsAt ? entry.endsAt.slice(0, 10) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPromoCodesPanel
