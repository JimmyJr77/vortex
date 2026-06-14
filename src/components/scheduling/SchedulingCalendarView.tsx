import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDateForDisplay } from '../../utils/dateUtils'
import {
  formatSchedulingOccurrenceLabel,
  schedulingSignupPath,
  type CalendarFormActiveFilter,
  type PublicSchedulingClassOption,
  type SchedulingCalendarEvent,
  type SchedulingCalendarMonth,
  type SchedulingCalendarTbd,
  type SchedulingTimeSlot,
} from '../../utils/schedulingApi'
import {
  addDays,
  formatTime12,
  MAX_VISIBLE_EVENTS,
  monthRange,
  parseDateString,
  periodTitle,
  toDateString,
  weekRange,
  WEEKDAY_LABELS,
  type CalendarView,
} from './calendarDateUtils'

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

export interface SchedulingCalendarViewProps {
  mode: 'admin' | 'public'
  calendar: SchedulingCalendarMonth | null
  loading: boolean
  error: string | null
  programs: { id: number; displayName: string }[]
  classOptions: PublicSchedulingClassOption[]
  programFilterId: number | 'all'
  formActiveFilter: CalendarFormActiveFilter
  classFilterId: number | 'none'
  showFormActiveFilter?: boolean
  showProgramFilter?: boolean
  view: CalendarView
  year: number
  month: number
  focusDate: string
  onViewChange: (view: CalendarView) => void
  onGoBack: () => void
  onGoForward: () => void
  onProgramFilterChange: (id: number | 'all') => void
  onFormActiveFilterChange: (value: CalendarFormActiveFilter) => void
  onClassFilterChange: (id: number | 'none') => void
  onEventClick?: (event: SchedulingCalendarEvent) => void
  onRetry: () => void
  theme?: 'light' | 'dark'
}

const SchedulingCalendarView = ({
  mode,
  calendar,
  loading,
  error,
  programs,
  classOptions,
  programFilterId,
  formActiveFilter,
  classFilterId,
  showFormActiveFilter = false,
  showProgramFilter = true,
  view,
  year,
  month,
  focusDate,
  onViewChange,
  onGoBack,
  onGoForward,
  onProgramFilterChange,
  onFormActiveFilterChange,
  onClassFilterChange,
  onEventClick,
  onRetry,
  theme = 'light',
}: SchedulingCalendarViewProps) => {
  const today = toDateString(new Date())
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const isDark = theme === 'dark'

  const selectedClassName =
    classFilterId === 'none'
      ? null
      : classOptions.find((c) => c.id === classFilterId)?.displayName ?? null

  const filteredTbdPatterns = useMemo(() => {
    const patterns = calendar?.tbdPatterns ?? []
    if (view !== 'byClass' || classFilterId === 'none') return patterns
    const match = classOptions.find((c) => c.id === classFilterId)
    if (!match) return patterns
    return patterns.filter((tbd) => tbd.className === match.displayName)
  }, [calendar?.tbdPatterns, view, classFilterId, classOptions])

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

  const byClassDates = useMemo(() => {
    return Array.from(eventsByDate.keys()).sort()
  }, [eventsByDate])

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

  const handleEventAction = (event: SchedulingCalendarEvent) => {
    onEventClick?.(event)
  }

  const renderSignupButton = (event: SchedulingCalendarEvent, compact = false) => {
    if (mode !== 'public' || !event.formActive) return null
    const url = schedulingSignupPath(event.formId, event.categoryId)
    return (
      <Link
        to={url}
        className={`inline-flex items-center justify-center rounded-lg font-semibold text-white bg-vortex-red hover:bg-red-700 transition-colors ${
          compact ? 'text-xs px-2 py-1' : 'text-sm px-4 py-2'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        Sign Up
      </Link>
    )
  }

  const renderCompactChip = (event: SchedulingCalendarEvent) => {
    const inactive = !event.formActive
    const timeLabel = `${formatTime12(event.startTime)}–${formatTime12(event.endTime)}`
    return (
      <button
        key={event.id}
        type="button"
        onClick={() => handleEventAction(event)}
        className={`w-full text-left rounded px-1.5 py-0.5 text-[11px] leading-tight border transition-colors cursor-pointer ${
          inactive
            ? isDark
              ? 'bg-gray-800 border-gray-700 text-gray-400 opacity-70'
              : 'bg-gray-50 border-gray-200 text-gray-500 opacity-70'
            : isDark
              ? 'bg-vortex-red/20 border-vortex-red/30 text-gray-100 hover:bg-vortex-red/30'
              : 'bg-vortex-red/5 border-vortex-red/20 text-gray-800 hover:bg-vortex-red/10'
        }`}
        title={[timeLabel, event.className, event.categoryName].filter(Boolean).join(' · ')}
      >
        <span className="font-medium text-vortex-red">{timeLabel}</span>
        <span className="block truncate font-medium">{event.className}</span>
        {event.categoryName && (
          <span className={`block truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {event.categoryName}
          </span>
        )}
      </button>
    )
  }

  const renderDayListItem = (event: SchedulingCalendarEvent, showSignup = false) => {
    const inactive = !event.formActive
    const timeLabel = `${formatTime12(event.startTime)} – ${formatTime12(event.endTime)}`
    return (
      <div
        key={event.id}
        className={`w-full rounded-lg border px-4 py-3 transition-colors ${
          inactive
            ? isDark
              ? 'border-gray-700 bg-gray-800/50 opacity-80'
              : 'border-gray-200 bg-gray-50 opacity-80'
            : isDark
              ? 'border-gray-700 bg-gray-800 hover:border-vortex-red/40'
              : 'border-gray-200 bg-white hover:border-vortex-red/40 hover:bg-red-50/30'
        }`}
      >
        <button
          type="button"
          onClick={() => handleEventAction(event)}
          className="w-full text-left"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-semibold text-vortex-red">{timeLabel}</span>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
              {event.className}
            </span>
            {event.categoryName && (
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {event.categoryName}
              </span>
            )}
            {event.programName && (
              <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {event.programName}
              </span>
            )}
          </div>
          {event.classDescription && (
            <p
              className={`mt-2 text-sm whitespace-pre-wrap leading-relaxed ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              {event.classDescription}
            </p>
          )}
        </button>
        {showSignup && (
          <div className="mt-3 flex justify-end">{renderSignupButton(event)}</div>
        )}
      </div>
    )
  }

  const renderMonthGrid = () => (
    <div className="grid grid-cols-7 auto-rows-fr min-h-[480px]">
      {monthGridCells.map((cell, idx) => {
        if (!cell.date) {
          return (
            <div
              key={`pad-${idx}`}
              className={`min-h-[100px] border-b border-r ${
                isDark ? 'border-gray-700 bg-gray-800/30' : 'border-gray-100 bg-gray-50/50'
              }`}
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
            className={`min-h-[100px] border-b border-r p-1.5 flex flex-col gap-1 ${
              isDark ? 'border-gray-700' : 'border-gray-100'
            }`}
          >
            <div
              className={`text-sm font-semibold ${
                isToday
                  ? 'inline-flex w-7 h-7 items-center justify-center rounded-full bg-vortex-red text-white'
                  : isDark
                    ? 'text-gray-200'
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
          <div
            key={date}
            className={`border-r last:border-r-0 flex flex-col min-h-[420px] ${
              isDark ? 'border-gray-700' : 'border-gray-100'
            }`}
          >
            <div
              className={`px-2 py-2 text-center border-b text-sm font-semibold ${
                isToday
                  ? 'bg-vortex-red text-white'
                  : isDark
                    ? 'bg-gray-800 text-gray-200 border-gray-700'
                    : 'bg-gray-50 text-gray-700 border-gray-100'
              }`}
            >
              <div className="text-xs uppercase tracking-wide opacity-80">
                {WEEKDAY_LABELS[parseDateString(date).getDay()]}
              </div>
              <div>{dayNum}</div>
            </div>
            <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
              {dayEventsForCell.length === 0 ? (
                <p className={`text-[11px] px-1 py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  —
                </p>
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
        <p className={`text-center text-sm py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          No classes scheduled for this day.
        </p>
      ) : (
        <div className="space-y-3 max-w-3xl mx-auto">
          {dayEvents.map((event) => renderDayListItem(event, mode === 'public'))}
        </div>
      )}
    </div>
  )

  const renderByClassView = () => {
    if (classFilterId === 'none') {
      return (
        <div className="p-8 text-center">
          <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
            Select a class above to see its scheduled offerings.
          </p>
        </div>
      )
    }

    if (byClassDates.length === 0) {
      return (
        <div className="p-8 text-center">
          <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
            No scheduled offerings for this class in this period.
          </p>
        </div>
      )
    }

    return (
      <div className="p-4 md:p-6 space-y-8 max-w-3xl mx-auto">
        {byClassDates.map((date) => {
          const events = eventsByDate.get(date) ?? []
          return (
            <div key={date}>
              <h3
                className={`text-lg font-display font-bold mb-3 ${
                  isDark ? 'text-white' : 'text-black'
                }`}
              >
                {formatDateForDisplay(date, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
              <div className="space-y-3">
                {events.map((event) => renderDayListItem(event, mode === 'public'))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const viewModes: CalendarView[] = ['month', 'week', 'day', 'byClass']

  const shellClass = isDark
    ? 'rounded-xl border border-gray-700 overflow-hidden bg-gray-900 shadow-sm'
    : 'rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm'

  const selectClass = isDark
    ? 'border border-gray-600 rounded-lg px-3 py-2 text-sm bg-gray-800 text-gray-100'
    : 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="inline-flex rounded-lg border overflow-hidden text-sm flex-wrap">
            {viewModes.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  onViewChange(v)
                  if (v === 'week' || v === 'day') {
                    const { startDate, endDate } = monthRange(year, month)
                    if (today < startDate || today > endDate) {
                      // parent handles focus via onViewChange side effect
                    }
                  }
                }}
                className={`px-3 py-2 capitalize transition-colors border-r last:border-r-0 ${
                  isDark ? 'border-gray-600' : 'border-gray-300'
                } ${
                  view === v
                    ? 'bg-vortex-red text-white'
                    : isDark
                      ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {v === 'byClass' ? 'By class' : v}
              </button>
            ))}
          </div>

          {view !== 'byClass' || classFilterId !== 'none' ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onGoBack}
                className={`p-2 rounded-lg border transition-colors ${
                  isDark
                    ? 'border-gray-600 hover:bg-gray-800'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                aria-label="Previous period"
              >
                <ChevronLeft className="w-5 h-5 text-vortex-red" />
              </button>
              <h2
                className={`text-xl font-display font-bold min-w-[200px] text-center ${
                  isDark ? 'text-white' : 'text-black'
                }`}
              >
                {periodTitle(view, year, month, focusDate, selectedClassName)}
              </h2>
              <button
                type="button"
                onClick={onGoForward}
                className={`p-2 rounded-lg border transition-colors ${
                  isDark
                    ? 'border-gray-600 hover:bg-gray-800'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                aria-label="Next period"
              >
                <ChevronRight className="w-5 h-5 text-vortex-red" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
          {view === 'byClass' && (
            <select
              value={classFilterId === 'none' ? 'none' : String(classFilterId)}
              onChange={(e) =>
                onClassFilterChange(e.target.value === 'none' ? 'none' : Number(e.target.value))
              }
              className={selectClass}
            >
              <option value="none">Select a class…</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.programName ? `${c.programName} · ${c.displayName}` : c.displayName}
                </option>
              ))}
            </select>
          )}

          {showProgramFilter && view !== 'byClass' && (
            <select
              value={programFilterId === 'all' ? 'all' : String(programFilterId)}
              onChange={(e) =>
                onProgramFilterChange(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className={selectClass}
            >
              <option value="all">All programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          )}

          {showFormActiveFilter && (
            <div
              className={`inline-flex rounded-lg border overflow-hidden text-sm ${
                isDark ? 'border-gray-600' : 'border-gray-300'
              }`}
            >
              {(['all', 'active', 'inactive'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onFormActiveFilterChange(value)}
                  className={`px-3 py-2 capitalize transition-colors border-r last:border-r-0 ${
                    isDark ? 'border-gray-600' : 'border-gray-300'
                  } ${
                    formActiveFilter === value
                      ? 'bg-vortex-red text-white'
                      : isDark
                        ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-center justify-between gap-4 ${
            isDark
              ? 'border-red-800 bg-red-900/30 text-red-300'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="text-vortex-red font-semibold hover:underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      <div className={shellClass}>
        {(view === 'month' || view === 'week') && (
          <div
            className={`grid grid-cols-7 border-b ${
              isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}
          >
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className={`px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {label}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className={`flex items-center justify-center py-24 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading calendar…
          </div>
        ) : view === 'month' ? (
          renderMonthGrid()
        ) : view === 'week' ? (
          renderWeekGrid()
        ) : view === 'day' ? (
          renderDayView()
        ) : (
          renderByClassView()
        )}
      </div>

      {!loading && calendar && calendar.events.length === 0 && filteredTbdPatterns.length === 0 && (
        <p className={`text-center text-sm py-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          No scheduled classes for this period.
        </p>
      )}

      {!loading && filteredTbdPatterns.length > 0 && (
        <div className={`${shellClass} p-4 md:p-6`}>
          <h3 className={`text-lg font-display font-bold mb-4 ${isDark ? 'text-white' : 'text-black'}`}>
            Dates TBD
          </h3>
          <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            These classes have recurring time slots but no fixed calendar dates yet.
          </p>
          <ul className="space-y-2">
            {filteredTbdPatterns.map((tbd) => {
              const label = formatSchedulingOccurrenceLabel(tbdToOccurrence(tbd), {
                includeWeek: Boolean(tbd.weekLetter),
                formatTime: formatTime12,
              })
              const inactive = !tbd.formActive
              const signupPath =
                mode === 'public' && tbd.formActive
                  ? schedulingSignupPath(tbd.formId, tbd.categoryId)
                  : null
              return (
                <li
                  key={`${tbd.formId}-${tbd.className}-${label}`}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b last:border-b-0 text-sm ${
                    isDark ? 'border-gray-700' : 'border-gray-100'
                  } ${inactive ? 'opacity-60' : ''}`}
                >
                  <div>
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                      {tbd.className}
                    </span>
                    {tbd.categoryName && (
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                        {' '}
                        · {tbd.categoryName}
                      </span>
                    )}
                    {inactive && showFormActiveFilter && (
                      <span className="ml-2 text-xs text-gray-500 uppercase tracking-wide">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{label}</span>
                    {signupPath && (
                      <Link
                        to={signupPath}
                        className="text-xs px-2 py-1 rounded-lg font-semibold text-white bg-vortex-red hover:bg-red-700"
                      >
                        Sign Up
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default SchedulingCalendarView
