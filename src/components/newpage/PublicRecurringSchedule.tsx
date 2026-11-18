import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { formatSkillLevel } from '../../utils/classDisplayUtils'
import { DEVELOPMENTAL_GYMNASTICS_PROGRAM, type RecurringBookingProgram } from '../../utils/publicBookingPrograms'
import type { LoadedRecurringSchedule } from './loadPublicRecurringSchedule'
import PublicClassPricing from './PublicClassPricing'

type ScheduleState = { status: 'loading' | 'unavailable' } | LoadedRecurringSchedule

const NO_CLASSES = [] as const

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
    void import('./loadPublicRecurringSchedule').then(async ({ loadPublicRecurringSchedule }) => {
      if (!current) return
      const result = await loadPublicRecurringSchedule(programName)
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
