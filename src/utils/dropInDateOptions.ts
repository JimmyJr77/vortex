interface DatedDropInSession {
  classId: number
  date: string
  startTime: string
  isFull: boolean
}

/** Keep the requested day first, then offer the next available days for that class. */
export function getDropInDateOptions<T extends DatedDropInSession>(
  sessions: T[],
  classId: number | null,
  selectedDate: string,
) {
  const forClass = sessions.filter((session) => session.classId === classId)
  const onSelectedDate = forClass
    .filter((session) => session.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const alternatives = selectedDate ? forClass
    .filter((session) => session.date > selectedDate && !session.isFull)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 6) : []
  return { onSelectedDate, alternatives }
}
