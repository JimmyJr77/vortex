import { useState } from 'react'
import { addDays, monthRange, parseDateString, toDateString, type CalendarView } from './calendarDateUtils'

export function useCalendarNavigation(initialView: CalendarView = 'month') {
  const now = new Date()
  const today = toDateString(now)
  const [view, setView] = useState<CalendarView>(initialView)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [focusDate, setFocusDate] = useState(today)

  const handleViewChange = (next: CalendarView) => {
    setView(next)
    if (next === 'week' || next === 'day') {
      const { startDate, endDate } = monthRange(year, month)
      setFocusDate(today >= startDate && today <= endDate ? today : startDate)
    }
  }

  const goBack = () => {
    if (view === 'month' || view === 'byClass') {
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
    if (view === 'month' || view === 'byClass') {
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

  return {
    view,
    year,
    month,
    focusDate,
    handleViewChange,
    goBack,
    goForward,
  }
}
