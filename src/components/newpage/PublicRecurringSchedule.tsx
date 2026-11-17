import { useEffect, useState } from 'react'
import { getRecurringBookingProgram, type RecurringBookingProgram } from '../../utils/publicBookingPrograms'
import { fetchClassesOffered } from '../../utils/publicClassesApi'
import {
  fetchPublicSchedulingForm,
  fetchPublicSchedulingOfferings,
  formatSchedulingOccurrenceLabel,
  slotGroupHasMultipleWeekLetters,
} from '../../utils/schedulingApi'
import { sortOccurrences } from '../../utils/slotSort'

type ClassTimes = { formId: number; name: string; times: string[] }
type ScheduleState =
  | { status: 'loading' | 'unavailable' }
  | { status: 'loaded'; classes: ClassTimes[] }

const easternDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
})

function includesDate(date: string, start?: string | null, end?: string | null) {
  return (!start || start <= date) && (!end || end >= date)
}

async function loadClassTimes(programName: RecurringBookingProgram): Promise<ClassTimes[]> {
  const { programs } = await fetchClassesOffered()
  const program = getRecurringBookingProgram(programs, programName)
  if (!program) return []

  const dateParts = easternDate.formatToParts(new Date())
  const today = ['year', 'month', 'day'].map((type) => dateParts.find((part) => part.type === type)?.value).join('-')
  const classes = await Promise.allSettled(program.classes.map(async ({ formId, displayName }) => {
    const [form, offerings] = await Promise.all([
      fetchPublicSchedulingForm(formId), fetchPublicSchedulingOfferings(formId),
    ])
    if (!form.isActive || form.id !== formId || form.programsId !== program.id ||
      !includesDate(today, form.startDate, form.endDate)) return null

    const currentOfferingIds = new Set(offerings
      .filter((offer) => offer.formId === formId && includesDate(today, offer.startDate, offer.endDate))
      .map((offer) => offer.id))
    const slots = form.slotGroups
      .filter((group) => group.formId === formId && group.isActive && !group.datesTbd &&
        group.scheduleMode === 'day' && includesDate(today, group.activeStart, group.activeEnd) &&
        (group.offeringId == null ? offerings.length === 0 : currentOfferingIds.has(group.offeringId)))
      .flatMap((group) => group.occurrences)
      .filter((slot) => slot.formId === formId && slot.isActive && !slot.datesTbd &&
        slot.scheduleMode === 'day' && includesDate(today, slot.activeStart, slot.activeEnd) &&
        (slot.dayName || slot.dayOfWeek != null) && slot.startTime && slot.endTime)
    const includeWeek = slotGroupHasMultipleWeekLetters(slots)
    const times = Array.from(new Set(sortOccurrences(slots).map((slot) =>
      formatSchedulingOccurrenceLabel(slot, { includeWeek }))))
    return times.length ? { formId, name: displayName, times } : null
  }))

  return classes.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : [])
}

export default function PublicRecurringSchedule({ programName }: {
  programName: RecurringBookingProgram
}) {
  const [schedule, setSchedule] = useState<ScheduleState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    void loadClassTimes(programName).then((classes) => {
      if (current) setSchedule({ status: 'loaded', classes })
    }).catch(() => {
      if (current) setSchedule({ status: 'unavailable' })
    })
    return () => { current = false }
  }, [programName])

  return (
    <div className="np-recurring-schedule" data-prerender-dynamic="" aria-live="polite">
      {schedule.status === 'loading' ? (
        <p>Checking recurring class times…</p>
      ) : schedule.status === 'loaded' && schedule.classes.length ? (
        <>
          <ul>
            {schedule.classes.map(({ formId, name, times }) => (
              <li key={formId}>
                {name}
                <ul>{times.map((time) => <li key={time}>{time}</li>)}</ul>
              </li>
            ))}
          </ul>
          <p>All times Eastern. Check enrollment for dates and availability.</p>
        </>
      ) : (
        <p>Check enrollment for current class times or contact Vortex for help.</p>
      )}
    </div>
  )
}
