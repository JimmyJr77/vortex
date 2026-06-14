import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchTopPrograms, type TopProgram } from '../../utils/programsApi'
import {
  adminFetchSchedulingCalendar,
  fetchPublicSchedulingClasses,
  type CalendarFormActiveFilter,
  type PublicSchedulingClassOption,
  type SchedulingCalendarEvent,
  type SchedulingCalendarMonth,
} from '../../utils/schedulingApi'
import AdminCalendarEventModal from './AdminCalendarEventModal'
import SchedulingCalendarView from './SchedulingCalendarView'
import { dateRangeForView } from './calendarDateUtils'
import { useCalendarNavigation } from './useCalendarNavigation'

const AdminCalendar = () => {
  const nav = useCalendarNavigation()
  const [programs, setPrograms] = useState<TopProgram[]>([])
  const [classOptions, setClassOptions] = useState<PublicSchedulingClassOption[]>([])
  const [programFilterId, setProgramFilterId] = useState<number | 'all'>('all')
  const [formActiveFilter, setFormActiveFilter] = useState<CalendarFormActiveFilter>('all')
  const [classFilterId, setClassFilterId] = useState<number | 'none'>('none')
  const [calendar, setCalendar] = useState<SchedulingCalendarMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<SchedulingCalendarEvent | null>(null)

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
      const data = await fetchPublicSchedulingClasses()
      setClassOptions(data)
    } catch {
      setClassOptions([])
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
        programId:
          nav.view === 'byClass' && classFilterId !== 'none' ? classFilterId : null,
        formActive: formActiveFilter,
      })
      setCalendar(data)
    } catch (e) {
      setCalendar(null)
      setError(e instanceof Error ? e.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
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
    loadCalendar()
  }, [loadCalendar])

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
        onEventClick={setSelectedEvent}
        onRetry={loadCalendar}
      />
      {selectedEvent && (
        <AdminCalendarEventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  )
}

export default AdminCalendar
