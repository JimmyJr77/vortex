import type { AnalyticsQuery, DatePreset } from '../../utils/analyticsApi'

interface DateRangeFilterProps {
  preset: DatePreset
  onPresetChange: (p: DatePreset) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (v: string) => void
  onCustomToChange: (v: string) => void
  hostname: string
  onHostnameChange: (v: string) => void
  onApply: () => void
  loading?: boolean
}

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'custom', label: 'Custom' },
]

export default function DateRangeFilter({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  hostname,
  onHostnameChange,
  onApply,
  loading,
}: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div>
        <label className="block text-xs text-gray-600 mb-1">Range</label>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPresetChange(p.id)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                preset === p.id
                  ? 'bg-vortex-red text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {preset === 'custom' && (
        <>
          <div>
            <label className="block text-xs text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </div>
        </>
      )}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Hostname</label>
        <select
          value={hostname}
          onChange={(e) => onHostnameChange(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm min-w-[180px]"
        >
          <option value="all">All hosts</option>
          <option value="vortexathletics.com">vortexathletics.com</option>
          <option value="gymnastics.vortexathletics.com">gymnastics.vortexathletics.com</option>
        </select>
      </div>
      <button
        type="button"
        onClick={onApply}
        disabled={loading}
        className="px-4 py-2 bg-vortex-red text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Apply'}
      </button>
    </div>
  )
}

export type { AnalyticsQuery }
