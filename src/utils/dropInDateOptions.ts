interface DatedDropInSession {
  classId: number
  date: string
  startTime: string
  isFull: boolean
  excludedFromDropIns?: boolean
}

/** List upcoming openings, and keep the requested day first when a date is selected. */
export function getDropInDateOptions<T extends DatedDropInSession>(
  sessions: T[],
  classId: number | null,
  selectedDate: string,
) {
  const forClass = sessions.filter((session) => session.classId === classId && !session.excludedFromDropIns)
  const onSelectedDate = forClass
    .filter((session) => session.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const upcoming = forClass
    .filter((session) => !session.isFull && (!selectedDate || session.date > selectedDate))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 6)
  return { onSelectedDate, upcoming }
}
