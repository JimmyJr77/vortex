import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { fetchTopPrograms, type TopProgram } from '../../utils/programsApi'
import { formatDateForDisplay } from '../../utils/dateUtils'
import {
  adminFetchSchedulingCalendar,
  formatSchedulingOccurrenceLabel,
  type CalendarFormActiveFilter,
  type SchedulingCalendarEvent,
  type SchedulingCalendarMonth,
  type SchedulingCalendarTbd,
  type SchedulingTimeSlot,
} from '../../utils/schedulingApi'
import AdminCalendarEventModal from './AdminCalendarEventModal'

type CalendarView = 'month' | 'week' | 'day'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_VISIBLE_EVENTS = 4

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDateString(date: string): Date {
  return new Date(`${date}T12:00:00`)
}

function monthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return { startDate: toDateString(start), endDate: toDateString(end) }
}

function weekRange(focusDate: string) {
  const d = parseDateString(focusDate)
  const start = new Date(d)
  start.setDate(d.getDate() - d.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { startDate: toDateString(start), endDate: toDateString(end) }
}

function addDays(date: string, delta: number): string {
  const d = parseDateString(date)
  d.setDate(d.getDate() + delta)
  return toDateString(d)
}

function periodTitle(view: CalendarView, year: number, month: number, focusDate: string): string {
  if (view === 'month') {
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

function tbdToOccurrence(tbd: SchedulingCalendarTbd): SchedulingTimeSlot {
  return {
    id: 0,
    formId: tbd.formId,
    categoryId: tbd.categoryId,
    scheduleMode: tbd.scheduleMode,
    weekLetter: tbd.weekLetter,
    dayOfWeek: tbd.dayOfWeek,
    dayName: tbd.dayName,
    specificDate: null,
    startTime: tbd.startTime,
    endTime: tbd.endTime,
    maxParticipants: 0,
    signupCount: 0,
    spotsRemaining: 0,
    isFull: false,
    activeStart: null,
    activeEnd: null,
    datesTbd: true,
    isActive: true,
  }
}

const AdminCalendar = () => {
  const now = new Date()
  const today = toDateString(now)
  const [view, setView] = useState<CalendarView>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [focusDate, setFocusDate] = useState(today)
  const [programs, setPrograms] = useState<TopProgram[]>([])
  const [programFilterId, setProgramFilterId] = useState<number | 'all'>('all')
  const [formActiveFilter, setFormActiveFilter] = useState<CalendarFormActiveFilter>('all')
  const [calendar, setCalendar] = useState<SchedulingCalendarMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [selectedEvent, setSelectedEvent] = useState<SchedulingCalendarEvent | null>(null)

  const dateRange = useMemo(() => {
    if (view === 'month') return monthRange(year, month)
    if (view === 'week') return weekRange(focusDate)
    return { startDate: focusDate, endDate: focusDate }
  }, [view, year, month, focusDate])

  const loadPrograms = useCallback(async () => {
    try {
      const data = await fetchTopPrograms(false)
      setPrograms(data.filter((p) => !p.archived))
    } catch {
      setPrograms([])
    }
  }, [])

  const loadCalendar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetchSchedulingCalendar({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        programsId: programFilterId === 'all' ? null : programFilterId,
        formActive: formActiveFilter,
      })
      setCalendar(data)
      setExpandedDays(new Set())
    } catch (e) {
      setCalendar(null)
      setError(e instanceof Error ? e.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [dateRange.startDate, dateRange.endDate, programFilterId, formActiveFilter])

  useEffect(() => {
    loadPrograms()
  }, [loadPrograms])

  useEffect(() => {
    loadCalendar()
  }, [loadCalendar])

  const goBack = () => {
    if (view === 'month') {
      if (month === 1) {
        setYear((y) => y - 1)
        setMonth(12)
      } else {
        setMonth((m) => m - 1)
      }
      return
    }
    if (view === 'week') {
      const next = addDays(focusDate, -7)
      setFocusDate(next)
      const d = parseDateString(next)
      setYear(d.getFullYear())
      setMonth(d.getMonth() + 1)
      return
    }
    const next = addDays(focusDate, -1)
    setFocusDate(next)
    const d = parseDateString(next)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  const goForward = () => {
    if (view === 'month') {
      if (month === 12) {
        setYear((y) => y + 1)
        setMonth(1)
      } else {
        setMonth((m) => m + 1)
      }
      return
    }
    if (view === 'week') {
      const next = addDays(focusDate, 7)
      setFocusDate(next)
      const d = parseDateString(next)
      setYear(d.getFullYear())
      setMonth(d.getMonth() + 1)
      return
    }
    const next = addDays(focusDate, 1)
    setFocusDate(next)
    const d = parseDateString(next)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  const eventsByDate = useMemo(() => {
    const map = new Map<string, SchedulingCalendarEvent[]>()
    for (const event of calendar?.events ?? []) {
      const list = map.get(event.date) ?? []
      list.push(event)
      map.set(event.date, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const timeCmp = (a.startTime || '').localeCompare(b.startTime || '')
        if (timeCmp !== 0) return timeCmp
        return a.className.localeCompare(b.className)
      })
    }
    return map
  }, [calendar?.events])

  const monthGridCells = useMemo(() => {
    const firstWeekday = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const cells: Array<{ date: string | null; dayNumber: number | null }> = []
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ date: null, dayNumber: null })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ date, dayNumber: d })
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, dayNumber: null })
    }
    return cells
  }, [year, month])

  const weekDates = useMemo(() => {
    const { startDate } = weekRange(focusDate)
    return Array.from({ length: 7 }, (_, i) => addDays(startDate, i))
  }, [focusDate])

  const dayEvents = eventsByDate.get(focusDate) ?? []

  const toggleDayExpanded = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const renderCompactChip = (event: SchedulingCalendarEvent) => {
    const inactive = !event.formActive
    const timeLabel = `${formatTime12(event.startTime)}–${formatTime12(event.endTime)}`
    return (
      <button
        key={event.id}
        type="button"
        onClick={() => setSelectedEvent(event)}
        className={`w-full text-left rounded px-1.5 py-0.5 text-[11px] leading-tight border transition-colors cursor-pointer ${
          inactive
            ? 'bg-gray-50 border-gray-200 text-gray-500 opacity-70'
            : 'bg-vortex-red/5 border-vortex-red/20 text-gray-800 hover:bg-vortex-red/10'
        }`}
        title={[timeLabel, event.className, event.categoryName].filter(Boolean).join(' · ')}
      >
        <span className="font-medium text-vortex-red">{timeLabel}</span>
        <span className="block truncate font-medium">{event.className}</span>
        {event.categoryName && (
          <span className="block truncate text-gray-500">{event.categoryName}</span>
        )}
      </button>
    )
  }

  const renderDayListItem = (event: SchedulingCalendarEvent) => {
    const inactive = !event.formActive
    const timeLabel = `${formatTime12(event.startTime)} – ${formatTime12(event.endTime)}`
    return (
      <button
        key={event.id}
        type="button"
        onClick={() => setSelectedEvent(event)}
        className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
          inactive
            ? 'border-gray-200 bg-gray-50 opacity-80'
            : 'border-gray-200 bg-white hover:border-vortex-red/40 hover:bg-red-50/30'
        }`}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-semibold text-vortex-red">{timeLabel}</span>
          <span className="font-semibold text-black">{event.className}</span>
          {event.categoryName && (
            <span className="text-sm text-gray-600">{event.categoryName}</span>
          )}
          {event.programName && (
            <span className="text-sm text-gray-500">{event.programName}</span>
          )}
        </div>
        {event.classDescription && (
          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {event.classDescription}
          </p>
        )}
      </button>
    )
  }

  const renderMonthGrid = () => (
    <div className="grid grid-cols-7 auto-rows-fr min-h-[480px]">
      {monthGridCells.map((cell, idx) => {
        if (!cell.date) {
          return (
            <div
              key={`pad-${idx}`}
              className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50/50"
            />
          )
        }

        const dayEventsForCell = eventsByDate.get(cell.date) ?? []
        const expanded = expandedDays.has(cell.date)
        const visibleEvents = expanded ? dayEventsForCell : dayEventsForCell.slice(0, MAX_VISIBLE_EVENTS)
        const hiddenCount = dayEventsForCell.length - visibleEvents.length
        const isToday = cell.date === today

        return (
          <div
            key={cell.date}
            className="min-h-[100px] border-b border-r border-gray-100 p-1.5 flex flex-col gap-1"
          >
            <div
              className={`text-sm font-semibold ${
                isToday
                  ? 'inline-flex w-7 h-7 items-center justify-center rounded-full bg-vortex-red text-white'
                  : 'text-gray-700'
              }`}
            >
              {cell.dayNumber}
            </div>
            <div className="flex-1 space-y-1">
              {visibleEvents.map(renderCompactChip)}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => toggleDayExpanded(cell.date!)}
                  className="text-[11px] text-vortex-red font-medium hover:underline px-1"
                >
                  {expanded ? 'Show less' : `+${hiddenCount} more`}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderWeekGrid = () => (
    <div className="grid grid-cols-7 min-h-[420px]">
      {weekDates.map((date) => {
        const dayEventsForCell = eventsByDate.get(date) ?? []
        const isToday = date === today
        const dayNum = parseDateString(date).getDate()
        return (
          <div key={date} className="border-r border-gray-100 last:border-r-0 flex flex-col min-h-[420px]">
            <div
              className={`px-2 py-2 text-center border-b border-gray-100 text-sm font-semibold ${
                isToday ? 'bg-vortex-red text-white' : 'bg-gray-50 text-gray-700'
              }`}
            >
              <div className="text-xs uppercase tracking-wide opacity-80">
                {WEEKDAY_LABELS[parseDateString(date).getDay()]}
              </div>
              <div>{dayNum}</div>
            </div>
            <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
              {dayEventsForCell.length === 0 ? (
                <p className="text-[11px] text-gray-400 px-1 py-2">—</p>
              ) : (
                dayEventsForCell.map(renderCompactChip)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderDayView = () => (
    <div className="p-4 md:p-6 min-h-[320px]">
      {dayEvents.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-12">No classes scheduled for this day.</p>
      ) : (
        <div className="space-y-3 max-w-3xl mx-auto">{dayEvents.map(renderDayListItem)}</div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            {(['month', 'week', 'day'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setView(v)
                  if (v === 'week' || v === 'day') {
                    const { startDate, endDate } = monthRange(year, month)
                    setFocusDate(today >= startDate && today <= endDate ? today : startDate)
                  }
                }}
                className={`px-3 py-2 capitalize transition-colors ${
                  view === v
                    ? 'bg-vortex-red text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              aria-label="Previous period"
            >
              <ChevronLeft className="w-5 h-5 text-vortex-red" />
            </button>
            <h2 className="text-xl font-display font-bold text-black min-w-[200px] text-center">
              {periodTitle(view, year, month, focusDate)}
            </h2>
            <button
              type="button"
              onClick={goForward}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              aria-label="Next period"
            >
              <ChevronRight className="w-5 h-5 text-vortex-red" />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <select
            value={programFilterId === 'all' ? 'all' : String(programFilterId)}
            onChange={(e) =>
              setProgramFilterId(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="all">All programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            {(['all', 'active', 'inactive'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormActiveFilter(value)}
                className={`px-3 py-2 capitalize transition-colors ${
                  formActiveFilter === value
                    ? 'bg-vortex-red text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadCalendar}
            className="text-vortex-red font-semibold hover:underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
        {view === 'month' && (
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide"
              >
                {label}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading calendar…
          </div>
        ) : view === 'month' ? (
          renderMonthGrid()
        ) : view === 'week' ? (
          renderWeekGrid()
        ) : (
          renderDayView()
        )}
      </div>

      {!loading && calendar && calendar.events.length === 0 && calendar.tbdPatterns.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-4">
          No scheduled classes for this period.
        </p>
      )}

      {!loading && calendar && calendar.tbdPatterns.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 md:p-6">
          <h3 className="text-lg font-display font-bold text-black mb-4">Dates TBD</h3>
          <p className="text-sm text-gray-600 mb-4">
            These classes have recurring time slots but no fixed calendar dates yet.
          </p>
          <ul className="space-y-2">
            {calendar.tbdPatterns.map((tbd) => {
              const label = formatSchedulingOccurrenceLabel(tbdToOccurrence(tbd), {
                includeWeek: Boolean(tbd.weekLetter),
                formatTime: formatTime12,
              })
              const inactive = !tbd.formActive
              return (
                <li
                  key={`${tbd.formId}-${tbd.className}-${label}`}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2 border-b border-gray-100 last:border-b-0 text-sm ${
                    inactive ? 'opacity-60' : ''
                  }`}
                >
                  <div>
                    <span className="font-semibold text-black">{tbd.className}</span>
                    {tbd.categoryName && (
                      <span className="text-gray-500"> · {tbd.categoryName}</span>
                    )}
                    {inactive && (
                      <span className="ml-2 text-xs text-gray-500 uppercase tracking-wide">
                        Inactive
                      </span>
                    )}
                  </div>
                  <span className="text-gray-700">{label}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {selectedEvent && (
        <AdminCalendarEventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  )
}

export default AdminCalendar
