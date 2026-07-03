import {
  formatSchedulingOccurrenceLabel,
  type SchedulingCalendarEvent,
  type SchedulingCalendarTbd,
  type SchedulingTimeSlot,
  weekLettersBySlotGroup,
  includeWeekForSlotGroup,
} from '../../utils/schedulingApi'
import { formatTime12, parseDateString } from './calendarDateUtils'
import { compareScheduleOptions, daySortIndex } from '../../utils/slotSort'

export interface ClassScheduleOffering {
  key: string
  formId: number
  offeringId: number | null
  offeringLabel: string | null
  offeringStartDate: string | null
  slotGroupId: number
  timeSlotId: number
  occurrenceLabel: string
  daySort: number
  startTime: string
  scheduleMode?: 'day' | 'date'
  specificDate?: string | null
  maxParticipants: number
  spotsRemaining: number
  waitlistCount: number
  isFull: boolean
  enrollVisible: boolean
  inactive: boolean
}

export interface ClassScheduleClassGroup {
  key: string
  className: string
  classDescription: string | null
  ageMin: number | null
  ageMax: number | null
  skillLevel: string | null
  skillRequirements: string | null
  offerings: ClassScheduleOffering[]
}

export interface ClassScheduleProgramGroup {
  key: string
  programName: string | null
  classes: ClassScheduleClassGroup[]
}

function weekdayFromDate(date: string): number {
  return parseDateString(date).getDay()
}

function occurrenceFromParts(options: {
  scheduleMode?: 'day' | 'date'
  weekLetter?: string | null
  dayOfWeek?: number | null
  dayName?: string | null
  specificDate?: string | null
  startTime: string
  endTime: string
  includeWeek?: boolean
}): {
  label: string
  daySort: number
  startTime: string
  scheduleMode: 'day' | 'date'
  specificDate: string | null
} {
  const occ: SchedulingTimeSlot = {
    id: 0,
    formId: 0,
    scheduleMode: options.scheduleMode ?? 'day',
    weekLetter: options.weekLetter ?? null,
    dayOfWeek: options.dayOfWeek ?? null,
    dayName: options.dayName ?? null,
    specificDate: options.specificDate ?? null,
    startTime: options.startTime,
    endTime: options.endTime,
    maxParticipants: 0,
    signupCount: 0,
    spotsRemaining: 0,
    isFull: false,
    activeStart: null,
    activeEnd: null,
    datesTbd: false,
    isActive: true,
  }
  const daySort =
    options.dayOfWeek != null
      ? daySortIndex(options.dayOfWeek)
      : options.specificDate
        ? 98
        : 99
  return {
    label: formatSchedulingOccurrenceLabel(occ, {
      includeWeek: Boolean(options.includeWeek),
      formatTime: formatTime12,
    }),
    daySort,
    startTime: options.startTime,
    scheduleMode: options.scheduleMode ?? 'day',
    specificDate: options.specificDate ?? null,
  }
}

function programKey(programName: string | null) {
  return programName?.trim() || '__no_program__'
}

function classKey(programName: string | null, className: string) {
  return `${programKey(programName)}::${className}`
}

function offeringKey(
  formId: number,
  slotGroupId: number,
  timeSlotId: number,
) {
  return `${formId}:${slotGroupId}:${timeSlotId}`
}

interface MutableClass {
  className: string
  classDescription: string | null
  ageMin: number | null
  ageMax: number | null
  skillLevel: string | null
  skillRequirements: string | null
  offerings: Map<string, ClassScheduleOffering>
}

interface MutableProgram {
  programName: string | null
  classes: Map<string, MutableClass>
}

function mergeClassMeta(target: MutableClass, meta: {
  classDescription: string | null
  ageMin: number | null
  ageMax: number | null
  skillLevel: string | null
  skillRequirements: string | null
}) {
  target.classDescription = target.classDescription || meta.classDescription
  target.ageMin = target.ageMin ?? meta.ageMin
  target.ageMax = target.ageMax ?? meta.ageMax
  target.skillLevel = target.skillLevel || meta.skillLevel
  target.skillRequirements = target.skillRequirements || meta.skillRequirements
}

function addOffering(
  programs: Map<string, MutableProgram>,
  meta: {
    programName: string | null
    className: string
    classDescription: string | null
    ageMin: number | null
    ageMax: number | null
    skillLevel: string | null
    skillRequirements: string | null
    formId: number
    offeringId: number | null
    offeringLabel: string | null
    offeringStartDate: string | null
    slotGroupId: number
    timeSlotId: number
    maxParticipants: number
    spotsRemaining: number
    waitlistCount: number
    isFull: boolean
    enrollVisible: boolean
    inactive: boolean
  },
  occurrence: { label: string; daySort: number; startTime: string; scheduleMode?: 'day' | 'date'; specificDate?: string | null },
) {
  const pKey = programKey(meta.programName)
  if (!programs.has(pKey)) {
    programs.set(pKey, { programName: meta.programName, classes: new Map() })
  }
  const program = programs.get(pKey)!
  const cKey = classKey(meta.programName, meta.className)
  if (!program.classes.has(cKey)) {
    program.classes.set(cKey, {
      className: meta.className,
      classDescription: meta.classDescription,
      ageMin: meta.ageMin,
      ageMax: meta.ageMax,
      skillLevel: meta.skillLevel,
      skillRequirements: meta.skillRequirements,
      offerings: new Map(),
    })
  }
  const classGroup = program.classes.get(cKey)!
  mergeClassMeta(classGroup, meta)

  const key = offeringKey(meta.formId, meta.slotGroupId, meta.timeSlotId)
  if (!classGroup.offerings.has(key)) {
    classGroup.offerings.set(key, {
      key,
      formId: meta.formId,
      offeringId: meta.offeringId,
      offeringLabel: meta.offeringLabel,
      offeringStartDate: meta.offeringStartDate,
      slotGroupId: meta.slotGroupId,
      timeSlotId: meta.timeSlotId,
      occurrenceLabel: occurrence.label,
      daySort: occurrence.daySort,
      startTime: occurrence.startTime,
      scheduleMode: occurrence.scheduleMode,
      specificDate: occurrence.specificDate ?? null,
      maxParticipants: meta.maxParticipants,
      spotsRemaining: meta.spotsRemaining,
      waitlistCount: meta.waitlistCount,
      isFull: meta.isFull,
      enrollVisible: meta.enrollVisible,
      inactive: meta.inactive,
    })
  }
}

export function buildClassScheduleGroups(options: {
  events: SchedulingCalendarEvent[]
  tbdPatterns: SchedulingCalendarTbd[]
  classFilterId: number | 'none'
  classOptions: { id: number; displayName: string }[]
  isEventInactive: (event: Pick<SchedulingCalendarEvent, 'classActive' | 'formActive'>) => boolean
  isTbdInactive: (tbd: Pick<SchedulingCalendarTbd, 'classActive' | 'formActive'>) => boolean
}): ClassScheduleProgramGroup[] {
  const programs = new Map<string, MutableProgram>()
  const selectedClass =
    options.classFilterId === 'none'
      ? null
      : options.classOptions.find((c) => c.id === options.classFilterId) ?? null

  const weekMap = weekLettersBySlotGroup([
    ...options.events.map((event) => ({
      slotGroupId: event.slotGroupId,
      weekLetter: event.weekLetter,
      scheduleMode: 'day' as const,
    })),
    ...options.tbdPatterns.map((tbd) => ({
      slotGroupId: tbd.slotGroupId,
      weekLetter: tbd.weekLetter,
      scheduleMode: tbd.scheduleMode,
    })),
  ])

  const seenEventSlots = new Set<string>()

  for (const event of options.events) {
    if (selectedClass && event.className !== selectedClass.displayName) continue

    const dedupeKey = offeringKey(
      event.formId,
      event.slotGroupId,
      event.timeSlotId,
    )
    if (seenEventSlots.has(dedupeKey)) continue
    seenEventSlots.add(dedupeKey)

    const occurrence = occurrenceFromParts({
      scheduleMode: 'day',
      weekLetter: event.weekLetter,
      dayOfWeek: weekdayFromDate(event.date),
      startTime: event.startTime,
      endTime: event.endTime,
      includeWeek: includeWeekForSlotGroup(weekMap, event.slotGroupId),
    })

    addOffering(
      programs,
      {
        programName: event.programName,
        className: event.className,
        classDescription: event.classDescription,
        ageMin: event.ageMin,
        ageMax: event.ageMax,
        skillLevel: event.skillLevel,
        skillRequirements: event.skillRequirements,
        formId: event.formId,
        offeringId: event.offeringId,
        offeringLabel: event.offeringLabel,
        offeringStartDate: event.offeringStartDate,
        slotGroupId: event.slotGroupId,
        timeSlotId: event.timeSlotId,
        maxParticipants: event.maxParticipants,
        spotsRemaining: event.spotsRemaining,
        waitlistCount: event.waitlistCount,
        isFull: event.isFull,
        enrollVisible: Boolean(event.enrollVisible),
        inactive: options.isEventInactive(event),
      },
      occurrence,
    )
  }

  for (const tbd of options.tbdPatterns) {
    if (selectedClass && tbd.className !== selectedClass.displayName) continue

    const occurrence = occurrenceFromParts({
      scheduleMode: tbd.scheduleMode,
      weekLetter: tbd.weekLetter,
      dayOfWeek: tbd.dayOfWeek,
      dayName: tbd.dayName,
      specificDate: tbd.specificDate,
      startTime: tbd.startTime,
      endTime: tbd.endTime,
      includeWeek: includeWeekForSlotGroup(weekMap, tbd.slotGroupId),
    })

    addOffering(
      programs,
      {
        programName: tbd.programName,
        className: tbd.className,
        classDescription: tbd.classDescription,
        ageMin: tbd.ageMin,
        ageMax: tbd.ageMax,
        skillLevel: tbd.skillLevel,
        skillRequirements: tbd.skillRequirements,
        formId: tbd.formId,
        offeringId: tbd.offeringId,
        offeringLabel: tbd.offeringLabel,
        offeringStartDate: tbd.offeringStartDate ?? null,
        slotGroupId: tbd.slotGroupId,
        timeSlotId: tbd.timeSlotId,
        maxParticipants: tbd.maxParticipants,
        spotsRemaining: tbd.spotsRemaining,
        waitlistCount: tbd.waitlistCount,
        isFull: tbd.isFull,
        enrollVisible: Boolean(tbd.enrollVisible),
        inactive: options.isTbdInactive(tbd),
      },
      occurrence,
    )
  }

  return [...programs.values()]
    .sort((a, b) => (a.programName ?? '').localeCompare(b.programName ?? ''))
    .map((program) => ({
      key: programKey(program.programName),
      programName: program.programName,
      classes: [...program.classes.values()]
        .sort((a, b) => a.className.localeCompare(b.className))
        .map((classGroup) => ({
          key: classKey(program.programName, classGroup.className),
          className: classGroup.className,
          classDescription: classGroup.classDescription,
          ageMin: classGroup.ageMin,
          ageMax: classGroup.ageMax,
          skillLevel: classGroup.skillLevel,
          skillRequirements: classGroup.skillRequirements,
          offerings: [...classGroup.offerings.values()].sort((a, b) =>
            compareScheduleOptions(
              {
                offeringStartDate: a.offeringStartDate,
                scheduleMode: a.scheduleMode,
                specificDate: a.specificDate,
                daySort: a.daySort,
                startTime: a.startTime,
                slotGroupId: a.slotGroupId,
              },
              {
                offeringStartDate: b.offeringStartDate,
                scheduleMode: b.scheduleMode,
                specificDate: b.specificDate,
                daySort: b.daySort,
                startTime: b.startTime,
                slotGroupId: b.slotGroupId,
              },
            ),
          ),
        })),
    }))
}
