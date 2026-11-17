import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchTopPrograms, type TopProgram } from '../../utils/programsApi'
import {
  adminFetchSchedulingCalendar,
  adminFetchSchedulingCalendarClasses,
  adminSetCalendarDayStatus,
  adminSetCalendarOccurrenceStatus,
  type CalendarFormActiveFilter,
  type PublicSchedulingClassOption,
  type SchedulingCalendarEvent,
  type SchedulingCalendarMonth,
} from '../../utils/schedulingApi'
import AdminCalendarDayModal from './AdminCalendarDayModal'
import AdminCalendarEventModal from './AdminCalendarEventModal'
import SchedulingCalendarView from './SchedulingCalendarView'
import { dateRangeForView } from './calendarDateUtils'
import { useCalendarNavigation } from './useCalendarNavigation'

const AdminCalendar = ({ canManage }: { canManage: boolean }) => {
  const nav = useCalendarNavigation()
  const [programs, setPrograms] = useState<TopProgram[]>([])
  const [classOptions, setClassOptions] = useState<PublicSchedulingClassOption[]>([])
  const [programFilterId, setProgramFilterId] = useState<number | 'all'>('all')
  const [formActiveFilter, setFormActiveFilter] = useState<CalendarFormActiveFilter>('all')
  const [classFilterId, setClassFilterId] = useState<number | 'none'>('none')
  const [calendar, setCalendar] = useState<SchedulingCalendarMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const calendarRequest = useRef<AbortController | null>(null)
  const selectedEvent = calendar?.events.find(({ id }) => id === selectedEventId)

  const dateRange = useMemo(
    () => dateRangeForView(nav.view, nav.year, nav.month, nav.focusDate),
    [nav.view, nav.year, nav.month, nav.focusDate],
  )

  const loadPrograms = useCallback(async () => {
    try {
      const data = await fetchTopPrograms(false)
      setPrograms(data.filter((p) => !p.archived))
    } catch {
      setPrograms([])
    }
  }, [])

  const loadClassOptions = useCallback(async () => {
    try {
      const data = await adminFetchSchedulingCalendarClasses()
      setClassOptions(data)
    } catch {
      setClassOptions([])
    }
  }, [])

  const loadCalendar = useCallback(async (showLoading = true) => {
    calendarRequest.current?.abort()
    const controller = new AbortController()
    calendarRequest.current = controller
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const data = await adminFetchSchedulingCalendar({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        programsId: programFilterId === 'all' ? null : programFilterId,
        programId:
          nav.view === 'byClass' && classFilterId !== 'none' ? classFilterId : null,
        formActive: formActiveFilter,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) setCalendar(data)
    } catch (e) {
      if (controller.signal.aborted) return
      setCalendar(null)
      setError(e instanceof Error ? e.message : 'Failed to load calendar')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [
    dateRange.startDate,
    dateRange.endDate,
    programFilterId,
    formActiveFilter,
    nav.view,
    classFilterId,
  ])

  useEffect(() => {
    loadPrograms()
    loadClassOptions()
  }, [loadPrograms, loadClassOptions])

  useEffect(() => {
    void loadCalendar()
    return () => calendarRequest.current?.abort()
  }, [loadCalendar])

  const setOccurrenceCancelled = async (event: SchedulingCalendarEvent, cancelled: boolean) => {
    const status = await adminSetCalendarOccurrenceStatus({
      date: event.date,
      slotId: event.timeSlotId,
      cancelled,
    })
    setCalendar((current) => current && ({
      ...current,
      events: current.events.map((item) => (
        item.timeSlotId === status.slotId && item.date === status.date
          ? { ...item, isIndividuallyCancelled: status.cancelled, isCancelled: status.cancelled || Boolean(item.isCancelledByDay) }
          : item
      )),
    }))
  }

  const setDayCancelled = async (date: string, cancelled: boolean) => {
    await adminSetCalendarDayStatus({ date, cancelled })
    await loadCalendar(false)
  }

  return (
    <>
      <SchedulingCalendarView
        mode="admin"
        calendar={calendar}
        loading={loading}
        error={error}
        programs={programs}
        classOptions={classOptions}
        programFilterId={programFilterId}
        formActiveFilter={formActiveFilter}
        classFilterId={classFilterId}
        showFormActiveFilter
        view={nav.view}
        year={nav.year}
        month={nav.month}
        focusDate={nav.focusDate}
        onViewChange={nav.handleViewChange}
        onGoBack={nav.goBack}
        onGoForward={nav.goForward}
        onProgramFilterChange={setProgramFilterId}
        onFormActiveFilterChange={setFormActiveFilter}
        onClassFilterChange={setClassFilterId}
        onEventClick={(event) => setSelectedEventId(event.id)}
        onDayClick={canManage && calendar ? setSelectedDate : undefined}
        onRetry={() => void loadCalendar()}
      />
      {selectedDate && canManage && (
        <AdminCalendarDayModal
          date={selectedDate}
          cancelled={calendar?.cancelledDates?.includes(selectedDate) ?? false}
          onCancellationChange={(cancelled) => setDayCancelled(selectedDate, cancelled)}
          onClose={() => setSelectedDate(null)}
        />
      )}
      {selectedEvent && (
        <AdminCalendarEventModal
          event={selectedEvent}
          canManage={canManage}
          onCancellationChange={(cancelled) => setOccurrenceCancelled(selectedEvent, cancelled)}
          onClose={() => setSelectedEventId(null)}
        />
      )}
    </>
  )
}

export default AdminCalendar
