export interface DateRangeValue { from: string; through: string; preset: string }

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function presetRange(preset: string, timezone?: string): DateRangeValue {
  const today = new Date()
  const parts = timezone ? new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(today) : []
  const year = Number(parts.find(part => part.type === 'year')?.value ?? today.getFullYear())
  const month = Number(parts.find(part => part.type === 'month')?.value ?? today.getMonth() + 1) - 1
  const day = Number(parts.find(part => part.type === 'day')?.value ?? today.getDate())
  if (preset === 'month') return { preset, from: dateInput(new Date(year, month, 1)), through: dateInput(new Date(year, month + 1, 0)) }
  if (preset === 'last-month') return { preset, from: dateInput(new Date(year, month - 1, 1)), through: dateInput(new Date(year, month, 0)) }
  if (preset === 'year') return { preset, from: dateInput(new Date(year, 0, 1)), through: dateInput(new Date(year, month, day)) }
  return { preset, from: '', through: '' }
}

export const filterInput = 'mt-1.5 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200'

export default function DateRange({ value, onChange, basis, basisOptions, onBasisChange, timezone }: {
  value: DateRangeValue
  onChange: (range: DateRangeValue) => void
  basis: string
  basisOptions: Array<{ value: string; label: string }>
  onBasisChange: (value: string) => void
  timezone?: string
}) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <label className="text-xs font-semibold text-slate-600">Date applies to
      <select className={filterInput} value={basis} onChange={event => onBasisChange(event.target.value)}>
        {basisOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    <label className="text-xs font-semibold text-slate-600">Date range
      <select className={filterInput} value={value.preset} onChange={event => onChange(event.target.value === 'custom' ? { ...value, preset: 'custom' } : presetRange(event.target.value, timezone))}>
        <option value="all">All dates</option>
        <option value="month">This month</option>
        <option value="last-month">Last month</option>
        <option value="year">Year to date</option>
        <option value="custom">Custom dates</option>
      </select>
    </label>
    <label className="text-xs font-semibold text-slate-600">From
      <input className={filterInput} type="date" value={value.from} max={value.through || undefined} onChange={event => onChange({ ...value, from: event.target.value, preset: 'custom' })} />
    </label>
    <label className="text-xs font-semibold text-slate-600">Through <span className="font-normal">(inclusive)</span>
      <input className={filterInput} type="date" value={value.through} min={value.from || undefined} onChange={event => onChange({ ...value, through: event.target.value, preset: 'custom' })} />
    </label>
  </div>
}
