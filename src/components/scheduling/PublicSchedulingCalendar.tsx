import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchPublicSchedulingCalendar,
  fetchPublicSchedulingClasses,
  type PublicSchedulingClassOption,
  type SchedulingCalendarMonth,
} from '../../utils/schedulingApi'
import SchedulingCalendarView from './SchedulingCalendarView'
import { dateRangeForView } from './calendarDateUtils'
import { useCalendarNavigation } from './useCalendarNavigation'

interface PublicSchedulingCalendarProps {
  theme?: 'light' | 'dark'
}

const PublicSchedulingCalendar = ({ theme = 'dark' }: PublicSchedulingCalendarProps) => {
  const nav = useCalendarNavigation()
  const [classOptions, setClassOptions] = useState<PublicSchedulingClassOption[]>([])
  const [classFilterId, setClassFilterId] = useState<number | 'none'>('none')
  const [calendar, setCalendar] = useState<SchedulingCalendarMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)

  const dateRange = useMemo(
    () => dateRangeForView(nav.view, nav.year, nav.month, nav.focusDate),
    [nav.view, nav.year, nav.month, nav.focusDate],
  )

  const loadClassOptions = useCallback(async () => {
    try {
      const data = await fetchPublicSchedulingClasses()
      setClassOptions(data)
    } catch {
      setClassOptions([])
    }
  }, [])

  useEffect(() => {
    loadClassOptions()
  }, [loadClassOptions])

  const classId = nav.view === 'byClass' && classFilterId !== 'none' ? classFilterId : null
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void fetchPublicSchedulingCalendar({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      programId: classId,
      signal: controller.signal,
    }).then((data) => {
      if (!controller.signal.aborted) setCalendar(data)
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return
      setCalendar(null)
      setError(reason instanceof Error ? reason.message : 'Failed to load calendar')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [dateRange.startDate, dateRange.endDate, classId, retryVersion])

  return (
    <SchedulingCalendarView
      mode="public"
      calendar={calendar}
      loading={loading}
      error={error}
      programs={[]}
      classOptions={classOptions}
      programFilterId="all"
      formActiveFilter="active"
      classFilterId={classFilterId}
      showProgramFilter={false}
      view={nav.view}
      year={nav.year}
      month={nav.month}
      focusDate={nav.focusDate}
      onViewChange={nav.handleViewChange}
      onGoBack={nav.goBack}
      onGoForward={nav.goForward}
      onProgramFilterChange={() => {}}
      onFormActiveFilterChange={() => {}}
      onClassFilterChange={setClassFilterId}
      onEventClick={(event) => nav.openDay(event.date)}
      onRetry={() => setRetryVersion((version) => version + 1)}
      theme={theme}
    />
  )
}

export default PublicSchedulingCalendar
