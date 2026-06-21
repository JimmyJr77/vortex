function parseDateOnly(str) {
  if (!str) return null
  return String(str).slice(0, 10)
}

function expandDateRange(start, end) {
  const dates = []
  const cur = new Date(`${start}T12:00:00`)
  const last = new Date(`${end}T12:00:00`)
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

/**
 * Expand admin slot batch payload into rows for scheduling_time_slot INSERT.
 */
export function expandSlotBatch(payload) {
  const rows = []
  const {
    activeDatesMode,
    activeStart,
    activeEnd,
    scheduleMode,
    maxParticipants,
    daySchedule,
    dateSchedule,
  } = payload

  const batchActiveStart = activeDatesMode === 'custom' ? parseDateOnly(activeStart) : null
  const batchActiveEnd = activeDatesMode === 'custom' ? parseDateOnly(activeEnd) : null
  const batchDatesTbd = activeDatesMode === 'tbd'

  if (scheduleMode === 'day' && daySchedule?.weeks) {
    for (const week of daySchedule.weeks) {
      const weekLetter = week.weekLetter || 'A'
      for (const day of week.days || []) {
        const dayActiveStart = parseDateOnly(day.activeStart) ?? batchActiveStart
        const dayActiveEnd = parseDateOnly(day.activeEnd) ?? batchActiveEnd
        for (const time of day.times || []) {
          rows.push({
            scheduleMode: 'day',
            weekLetter,
            dayOfWeek: day.dayOfWeek,
            specificDate: null,
            startTime: time.startTime,
            endTime: time.endTime,
            maxParticipants: time.maxParticipants ?? maxParticipants,
            activeStart: dayActiveStart,
            activeEnd: dayActiveEnd,
            datesTbd: batchDatesTbd,
          })
        }
      }
    }
  }

  if (scheduleMode === 'date' && dateSchedule?.entries) {
    for (const entry of dateSchedule.entries) {
      let dates = []
      if (entry.type === 'single' && entry.date) {
        dates = [parseDateOnly(entry.date)]
      } else if (entry.type === 'range' && entry.startDate && entry.endDate) {
        dates = expandDateRange(parseDateOnly(entry.startDate), parseDateOnly(entry.endDate))
      }
      for (const date of dates) {
        for (const time of entry.times || []) {
          rows.push({
            scheduleMode: 'date',
            weekLetter: null,
            dayOfWeek: null,
            specificDate: date,
            startTime: time.startTime,
            endTime: time.endTime,
            maxParticipants: time.maxParticipants ?? maxParticipants,
            activeStart: batchActiveStart,
            activeEnd: batchActiveEnd,
            datesTbd: batchDatesTbd,
          })
        }
      }
    }
  }

  return rows
}
