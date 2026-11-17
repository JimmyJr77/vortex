import { useEffect, useState } from 'react'
import { ADULT_BOOKING_PROGRAM, getRecurringBookingProgram, type RecurringBookingProgram } from '../../utils/publicBookingPrograms'
import { fetchClassesOffered } from '../../utils/publicClassesApi'
import {
  fetchPublicSchedulingForm,
  fetchPublicSchedulingOfferings,
  formatSchedulingOccurrenceLabel,
  slotGroupHasMultipleWeekLetters,
} from '../../utils/schedulingApi'
import { sortOccurrences } from '../../utils/slotSort'
import AdultGymnasticsPricing, { type RecurringPriceClass } from './AdultGymnasticsPricing'

type ClassTimes = RecurringPriceClass & { name: string; times: string[] }
type ScheduleState =
  | { status: 'loading' | 'unavailable' }
  | { status: 'loaded'; classes: ClassTimes[] }

const easternDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
})
const NO_CLASSES: readonly ClassTimes[] = []

function includesDate(date: string, start?: string | null, end?: string | null) {
  return (!start || start <= date) && (!end || end >= date)
}

async function loadClassTimes(programName: RecurringBookingProgram): Promise<ClassTimes[]> {
  const { programs } = await fetchClassesOffered()
  const program = getRecurringBookingProgram(programs, programName)
  if (!program) return []

  const dateParts = easternDate.formatToParts(new Date())
  const today = ['year', 'month', 'day'].map((type) => dateParts.find((part) => part.type === type)?.value).join('-')
  const classes = await Promise.allSettled(program.classes.map(async ({ id: classId, formId, displayName }) => {
    const [form, offerings] = await Promise.all([
      fetchPublicSchedulingForm(formId), fetchPublicSchedulingOfferings(formId),
    ])
    if (!form.isActive || form.id !== formId || form.programsId !== program.id ||
      !includesDate(today, form.startDate, form.endDate)) return null

    const currentOfferingIds = new Set(offerings
      .filter((offer) => offer.formId === formId && includesDate(today, offer.startDate, offer.endDate))
      .map((offer) => offer.id))
    const groups = form.slotGroups
      .filter((group) => group.formId === formId && group.isActive && !group.datesTbd &&
        group.scheduleMode === 'day' && includesDate(today, group.activeStart, group.activeEnd) &&
        (group.offeringId == null ? offerings.length === 0 : currentOfferingIds.has(group.offeringId)))
      .map(({ id, offeringId, occurrences }) => ({
        id, offeringId,
        slots: occurrences.filter(slot => slot.formId === formId && slot.isActive && !slot.datesTbd &&
          slot.scheduleMode === 'day' && includesDate(today, slot.activeStart, slot.activeEnd) &&
          (slot.dayName || slot.dayOfWeek != null) && slot.startTime && slot.endTime),
      })).filter(group => group.slots.length > 0)
    const slots = groups.flatMap(group => group.slots)
    const includeWeek = slotGroupHasMultipleWeekLetters(slots)
    const times = Array.from(new Set(sortOccurrences(slots).map((slot) =>
      formatSchedulingOccurrenceLabel(slot, { includeWeek }))))
    return times.length ? { classId, formId, name: displayName, times, groups } : null
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

  return (<>
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
    {programName === ADULT_BOOKING_PROGRAM && (
      <AdultGymnasticsPricing classes={schedule.status === 'loaded' ? schedule.classes : schedule.status === 'loading' ? null : NO_CLASSES} />
    )}
  </>)
}
