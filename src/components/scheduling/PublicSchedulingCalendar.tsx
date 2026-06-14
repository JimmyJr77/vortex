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

  const loadCalendar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPublicSchedulingCalendar({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        programId:
          nav.view === 'byClass' && classFilterId !== 'none' ? classFilterId : null,
      })
      setCalendar(data)
    } catch (e) {
      setCalendar(null)
      setError(e instanceof Error ? e.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [dateRange.startDate, dateRange.endDate, nav.view, classFilterId])

  useEffect(() => {
    loadClassOptions()
  }, [loadClassOptions])

  useEffect(() => {
    loadCalendar()
  }, [loadCalendar])

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
      onRetry={loadCalendar}
      theme={theme}
    />
  )
}

export default PublicSchedulingCalendar
