import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { formatSkillLevel } from '../../utils/classDisplayUtils'
import { getEasternDateString } from '../../utils/dateUtils'
import { DEVELOPMENTAL_GYMNASTICS_PROGRAM, getRecurringBookingProgram, type RecurringBookingProgram } from '../../utils/publicBookingPrograms'
import { fetchClassesOffered } from '../../utils/publicClassesApi'
import { publicEnrollmentPricingOptions } from '../../utils/programPricingOptions'
import {
  fetchPublicSchedulingForm,
  fetchPublicSchedulingOfferings,
  formatSchedulingOccurrenceLabel,
  slotGroupHasMultipleWeekLetters,
} from '../../utils/schedulingApi'
import { sortOccurrences } from '../../utils/slotSort'
import { programUsesWeeklyTierPricing } from '../../utils/weeklyTierPricing'
import PublicClassPricing, { type RecurringPriceClass } from './PublicClassPricing'

type ClassTimes = RecurringPriceClass & {
  skillLevel: string | null
  skillRequirements: string | null
  times: { label: string; isFull: boolean }[]
}
type ScheduleState =
  | { status: 'loading' | 'unavailable' }
  | { status: 'loaded'; classes: ClassTimes[]; usesClassTuition: boolean }

const NO_CLASSES: readonly ClassTimes[] = []

function includesDate(date: string, start?: string | null, end?: string | null) {
  return (!start || start <= date) && (!end || end >= date)
}

async function loadSchedule(programName: RecurringBookingProgram): Promise<Extract<ScheduleState, { status: 'loaded' }>> {
  const { programs } = await fetchClassesOffered()
  const program = getRecurringBookingProgram(programs, programName)
  if (!program) return { status: 'loaded', classes: [], usesClassTuition: false }

  const today = getEasternDateString()
  const timesByClass = await Promise.allSettled(program.classes.map(async ({
    id: classId, formId, displayName, skillLevel, skillRequirements, excludeFromDropIns,
  }) => {
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
      .map(({ id, offeringId, isFull, occurrences }) => ({
        id, offeringId, isFull,
        slots: occurrences.filter(slot => slot.formId === formId && slot.isActive && !slot.datesTbd &&
          slot.scheduleMode === 'day' && includesDate(today, slot.activeStart, slot.activeEnd) &&
          (slot.dayName || slot.dayOfWeek != null) && slot.startTime && slot.endTime),
      })).filter(group => group.slots.length > 0)
    const slots = groups.flatMap(({ slots, isFull }) =>
      slots.map(slot => ({ ...slot, groupIsFull: isFull === true })))
    const includeWeek = slotGroupHasMultipleWeekLetters(slots)
    const fullByLabel = new Map<string, boolean>()
    for (const slot of sortOccurrences(slots)) {
      const label = formatSchedulingOccurrenceLabel(slot, { includeWeek })
      fullByLabel.set(label, (fullByLabel.get(label) ?? true) && slot.groupIsFull)
    }
    const times = Array.from(fullByLabel, ([label, isFull]) => ({ label, isFull }))
    return times.length ? {
      classId, formId, name: displayName, skillLevel, skillRequirements: skillRequirements?.trim() || null, times, groups,
      excludeFromDropIns: excludeFromDropIns ?? program.excludeFromDropIns,
    } : null
  }))

  return {
    status: 'loaded',
    classes: timesByClass.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []),
    usesClassTuition: !programUsesWeeklyTierPricing(program) && !publicEnrollmentPricingOptions(program.pricingCostOptions ?? []).length,
  }
}

export default function PublicRecurringSchedule({ programName, scheduleId, onLayoutSettled }: {
  programName: RecurringBookingProgram
  scheduleId: string
  onLayoutSettled?: () => void
}) {
  const { hash } = useLocation()
  const controlsRef = useRef<HTMLDivElement>(null)
  const [requested, setRequested] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleState>({ status: 'loading' })
  const isDevelopmentalGymnastics = programName === DEVELOPMENTAL_GYMNASTICS_PROGRAM

  useEffect(() => {
    if (requested) return
    if (hash === `#${scheduleId}` || typeof IntersectionObserver === 'undefined') {
      setRequested(true)
      return
    }
    const controls = controlsRef.current
    if (!controls) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect()
        setRequested(true)
      }
    }, { rootMargin: '0px 0px 64px' })
    observer.observe(controls)
    return () => observer.disconnect()
  }, [hash, requested, scheduleId])

  useEffect(() => {
    if (!requested) return
    let current = true
    void loadSchedule(programName).then((result) => {
      if (current) setSchedule(result)
    }).catch(() => {
      if (current) setSchedule({ status: 'unavailable' })
    })
    return () => { current = false }
  }, [programName, requested])

  useLayoutEffect(() => {
    if (schedule.status !== 'loading') onLayoutSettled?.()
  }, [onLayoutSettled, schedule.status])

  return <div ref={controlsRef}>
    <div className="np-recurring-schedule" data-prerender-dynamic="" aria-live="polite">
      {!requested ? null : schedule.status === 'loading' ? (
        <p>Checking recurring class times…</p>
      ) : schedule.status === 'loaded' && schedule.classes.length ? (
        <>
          <ul className={isDevelopmentalGymnastics ? 'np-recurring-schedule-groups' : undefined}>
            {schedule.classes.map(({ formId, name, times, skillLevel, skillRequirements }) => {
              const timeList = (
                <ul>
                  {times.map(({ label, isFull }) => (
                    <li key={label}>
                      {label}
                      {isFull && <span className="font-semibold text-amber-800"> · Full</span>}
                    </li>
                  ))}
                </ul>
              )
              return (
                <li key={formId}>
                  {isDevelopmentalGymnastics ? (
                    <details>
                      <summary>{name} {skillLevel && <span>{formatSkillLevel(skillLevel)}</span>}</summary>
                      {skillRequirements && <p className="np-recurring-skill-requirements"><strong>Skill requirements</strong> {skillRequirements}</p>}
                      {timeList}
                    </details>
                  ) : <>{name}{timeList}</>}
                </li>
              )
            })}
          </ul>
          <p>
            All times Eastern.{' '}
            {schedule.classes.some(({ times }) => times.some(({ isFull }) => isFull))
              ? 'If a time is full, check enrollment for another time or waitlist options.'
              : 'Check enrollment for dates and availability.'}
          </p>
        </>
      ) : (
        <p>Check enrollment for current class times or contact Vortex for help.</p>
      )}
    </div>
    <PublicClassPricing
      program={programName}
      classes={schedule.status === 'loaded' ? schedule.classes : schedule.status === 'loading' ? null : NO_CLASSES}
      usesClassTuition={!isDevelopmentalGymnastics || (schedule.status === 'loaded' && schedule.usesClassTuition)}
      onOpen={() => setRequested(true)}
    />
  </div>
}
