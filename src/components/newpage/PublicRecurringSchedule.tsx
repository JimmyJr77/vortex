import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DEVELOPMENTAL_GYMNASTICS_PROGRAM, type RecurringBookingProgram } from '../../utils/publicBookingPrograms'
import type { LoadedRecurringSchedule } from './loadPublicRecurringSchedule'
import PublicClassPricing from './PublicClassPricing'

type ScheduleState = { status: 'loading' | 'unavailable' } | LoadedRecurringSchedule

const NO_CLASSES = [] as const

export default function PublicRecurringSchedule({ programName, scheduleId }: {
  programName: RecurringBookingProgram
  scheduleId: string
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

  return <div ref={controlsRef}>
    <PublicClassPricing
      program={programName}
      classes={schedule.status === 'loaded' ? schedule.classes : schedule.status === 'loading' ? null : NO_CLASSES}
      usesClassTuition={!isDevelopmentalGymnastics || (schedule.status === 'loaded' && schedule.usesClassTuition)}
      loading={requested && schedule.status === 'loading'}
    />
  </div>
}
