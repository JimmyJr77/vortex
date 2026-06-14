import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { fetchTopPrograms, type TopProgram } from '../../utils/programsApi'
import {
  adminFetchSchedulingCalendar,
  formatSchedulingOccurrenceLabel,
  type CalendarFormActiveFilter,
  type SchedulingCalendarEvent,
  type SchedulingCalendarMonth,
  type SchedulingCalendarTbd,
  type SchedulingTimeSlot,
} from '../../utils/schedulingApi'
import type { SchedulingNavigationIntent } from '../../utils/schedulingNavigation'

interface Props {
  onOpenScheduling?: (intent: SchedulingNavigationIntent) => void
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_VISIBLE_EVENTS = 4

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

function categorySelectionFromEvent(
  event: SchedulingCalendarEvent | SchedulingCalendarTbd,
): SchedulingNavigationIntent['categorySelection'] {
  if (event.categoryId == null) return 'none'
  return event.categoryId
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

const AdminCalendar = ({ onOpenScheduling }: Props) => {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [programs, setPrograms] = useState<TopProgram[]>([])
  const [programFilterId, setProgramFilterId] = useState<number | 'all'>('all')
  const [formActiveFilter, setFormActiveFilter] = useState<CalendarFormActiveFilter>('all')
  const [calendar, setCalendar] = useState<SchedulingCalendarMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

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
        year,
        month,
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
  }, [year, month, programFilterId, formActiveFilter])

  useEffect(() => {
    loadPrograms()
  }, [loadPrograms])

  useEffect(() => {
    loadCalendar()
  }, [loadCalendar])

  const goToPrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const goToNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
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

  const gridCells = useMemo(() => {
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

  const handleEventClick = (event: SchedulingCalendarEvent) => {
    if (!onOpenScheduling || event.programsId == null || event.classEventId == null) return
    onOpenScheduling({
      programsId: event.programsId,
      classEventId: event.classEventId,
      categorySelection: categorySelectionFromEvent(event),
      targetPanel: 'slots',
    })
  }

  const toggleDayExpanded = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const renderEventChip = (event: SchedulingCalendarEvent) => {
    const inactive = !event.formActive
    const timeLabel = `${formatTime12(event.startTime)}–${formatTime12(event.endTime)}`
    return (
      <button
        key={event.id}
        type="button"
        onClick={() => handleEventClick(event)}
        disabled={!onOpenScheduling || event.programsId == null || event.classEventId == null}
        className={`w-full text-left rounded px-1.5 py-0.5 text-[11px] leading-tight border transition-colors ${
          inactive
            ? 'bg-gray-50 border-gray-200 text-gray-500 opacity-70'
            : 'bg-vortex-red/5 border-vortex-red/20 text-gray-800 hover:bg-vortex-red/10'
        } ${onOpenScheduling && event.programsId != null && event.classEventId != null ? 'cursor-pointer' : 'cursor-default'}`}
        title={
          [
            timeLabel,
            event.className,
            event.programName,
            event.categoryName,
            inactive ? '(Inactive)' : null,
          ]
            .filter(Boolean)
            .join(' · ')
        }
      >
        <span className="font-medium text-vortex-red">{timeLabel}</span>
        <span className="block truncate">{event.className}</span>
        {event.programName && (
          <span className="block truncate text-gray-500">{event.programName}</span>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={goToPrevMonth}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-vortex-red" />
          </button>
          <h2 className="text-xl font-display font-bold text-black min-w-[180px] text-center">
            {monthLabel(year, month)}
          </h2>
          <button
            type="button"
            onClick={goToNextMonth}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 text-vortex-red" />
          </button>
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

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading calendar…
          </div>
        ) : (
          <div className="grid grid-cols-7 auto-rows-fr min-h-[480px]">
            {gridCells.map((cell, idx) => {
              if (!cell.date) {
                return (
                  <div
                    key={`pad-${idx}`}
                    className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50/50"
                  />
                )
              }

              const dayEvents = eventsByDate.get(cell.date) ?? []
              const expanded = expandedDays.has(cell.date)
              const visibleEvents = expanded ? dayEvents : dayEvents.slice(0, MAX_VISIBLE_EVENTS)
              const hiddenCount = dayEvents.length - visibleEvents.length
              const isToday =
                cell.date ===
                `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

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
                    {visibleEvents.map(renderEventChip)}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleDayExpanded(cell.date!)}
                        className="text-[11px] text-vortex-red font-medium hover:underline px-1"
                      >
                        {expanded ? 'Show less' : `+${hiddenCount} more`}
                      </button>
                    )}
                    {expanded && dayEvents.length > MAX_VISIBLE_EVENTS && (
                      <button
                        type="button"
                        onClick={() => toggleDayExpanded(cell.date!)}
                        className="text-[11px] text-gray-500 hover:underline px-1"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!loading && calendar && calendar.events.length === 0 && calendar.tbdPatterns.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-4">
          No scheduled classes for {monthLabel(year, month)}.
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
                    {tbd.programName && (
                      <span className="text-gray-500"> · {tbd.programName}</span>
                    )}
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
    </div>
  )
}

export default AdminCalendar
