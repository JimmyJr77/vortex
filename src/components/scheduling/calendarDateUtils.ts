import { formatDateForDisplay } from '../../utils/dateUtils'

export type CalendarView = 'month' | 'week' | 'day' | 'byClass'

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MAX_VISIBLE_EVENTS = 4

export function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseDateString(date: string): Date {
  return new Date(`${date}T12:00:00`)
}

export function monthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return { startDate: toDateString(start), endDate: toDateString(end) }
}

export function weekRange(focusDate: string) {
  const d = parseDateString(focusDate)
  const start = new Date(d)
  start.setDate(d.getDate() - d.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { startDate: toDateString(start), endDate: toDateString(end) }
}

export function addDays(date: string, delta: number): string {
  const d = parseDateString(date)
  d.setDate(d.getDate() + delta)
  return toDateString(d)
}

export function periodTitle(
  view: CalendarView,
  year: number,
  month: number,
  focusDate: string,
  className?: string | null,
): string {
  if (view === 'byClass' && className) {
    const base = periodTitle('month', year, month, focusDate)
    return `${className} · ${base}`
  }
  if (view === 'month' || view === 'byClass') {
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  }
  if (view === 'day') {
    return formatDateForDisplay(focusDate, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }
  const { startDate, endDate } = weekRange(focusDate)
  const start = parseDateString(startDate)
  const end = parseDateString(endDate)
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  if (sameMonth) {
    return `${start.toLocaleDateString(undefined, { month: 'long' })} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
  }
  return `${formatDateForDisplay(startDate)} – ${formatDateForDisplay(endDate)}`
}

export function dateRangeForView(
  view: CalendarView,
  year: number,
  month: number,
  focusDate: string,
): { startDate: string; endDate: string } {
  if (view === 'month' || view === 'byClass') return monthRange(year, month)
  if (view === 'week') return weekRange(focusDate)
  return { startDate: focusDate, endDate: focusDate }
}
