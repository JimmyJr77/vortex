export interface DateRangeValue { from: string; through: string; preset: string }

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function presetRange(preset: string, timezone?: string): DateRangeValue {
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
