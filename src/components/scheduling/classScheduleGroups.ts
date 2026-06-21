import {
  SCHEDULING_DAYS,
  type SchedulingCalendarEvent,
  type SchedulingCalendarTbd,
} from '../../utils/schedulingApi'
import { formatTime12, parseDateString } from './calendarDateUtils'

export interface ClassScheduleTimeslot {
  key: string
  dayLabel: string
  daySort: number
  timeLabel: string
}

export interface ClassScheduleCategoryGroup {
  key: string
  categoryId: number | null
  categoryName: string | null
  offeringLabel: string | null
  formId: number
  enrollVisible: boolean
  inactive: boolean
  timeslots: ClassScheduleTimeslot[]
}

export interface ClassScheduleClassGroup {
  key: string
  className: string
  classDescription: string | null
  categories: ClassScheduleCategoryGroup[]
}

export interface ClassScheduleProgramGroup {
  key: string
  programName: string | null
  classes: ClassScheduleClassGroup[]
}

const MONDAY_FIRST_ORDER = [1, 2, 3, 4, 5, 6, 0]

function daySortIndex(dayOfWeek: number): number {
  const idx = MONDAY_FIRST_ORDER.indexOf(dayOfWeek)
  return idx >= 0 ? idx : dayOfWeek
}

function pluralWeekday(label: string): string {
  if (!label) return label
  if (label.endsWith('s')) return label
  return `${label}s`
}

function weekdayFromDate(date: string): { dayOfWeek: number; dayLabel: string } {
  const dayOfWeek = parseDateString(date).getDay()
  const single = SCHEDULING_DAYS.find((d) => d.value === dayOfWeek)?.label ?? 'Day'
  return { dayOfWeek, dayLabel: pluralWeekday(single) }
}

function weekdayFromTbd(tbd: SchedulingCalendarTbd): { dayOfWeek: number; dayLabel: string } | null {
  if (tbd.dayName) {
    return {
      dayOfWeek: tbd.dayOfWeek ?? 0,
      dayLabel: pluralWeekday(tbd.dayName),
    }
  }
  if (tbd.dayOfWeek != null) {
    const single = SCHEDULING_DAYS.find((d) => d.value === tbd.dayOfWeek)?.label ?? 'Day'
    return { dayOfWeek: tbd.dayOfWeek, dayLabel: pluralWeekday(single) }
  }
  return null
}

function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime12(startTime)} – ${formatTime12(endTime)}`
}

function categoryKey(formId: number, categoryId: number | null, offeringLabel: string | null) {
  return `${formId}:${categoryId ?? 'none'}:${offeringLabel ?? ''}`
}

function programKey(programName: string | null) {
  return programName?.trim() || '__no_program__'
}

function classKey(programName: string | null, className: string) {
  return `${programKey(programName)}::${className}`
}

interface MutableCategory {
  categoryId: number | null
  categoryName: string | null
  offeringLabel: string | null
  formId: number
  enrollVisible: boolean
  inactive: boolean
  slots: Map<string, ClassScheduleTimeslot>
}

interface MutableClass {
  className: string
  classDescription: string | null
  categories: Map<string, MutableCategory>
}

interface MutableProgram {
  programName: string | null
  classes: Map<string, MutableClass>
}

function addTimeslot(
  programs: Map<string, MutableProgram>,
  meta: {
    programName: string | null
    className: string
    classDescription: string | null
    categoryId: number | null
    categoryName: string | null
    offeringLabel: string | null
    formId: number
    enrollVisible: boolean
    inactive: boolean
  },
  slot: {
    slotKey: string
    dayLabel: string
    daySort: number
    timeLabel: string
  },
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
      categories: new Map(),
    })
  }
  const classGroup = program.classes.get(cKey)!
  const catKey = categoryKey(meta.formId, meta.categoryId, meta.offeringLabel)
  if (!classGroup.categories.has(catKey)) {
    classGroup.categories.set(catKey, {
      categoryId: meta.categoryId,
      categoryName: meta.categoryName,
      offeringLabel: meta.offeringLabel,
      formId: meta.formId,
      enrollVisible: meta.enrollVisible,
      inactive: meta.inactive,
      slots: new Map(),
    })
  }
  const category = classGroup.categories.get(catKey)!
  category.inactive = category.inactive || meta.inactive
  category.enrollVisible = category.enrollVisible || meta.enrollVisible
  if (!category.slots.has(slot.slotKey)) {
    category.slots.set(slot.slotKey, {
      key: slot.slotKey,
      dayLabel: slot.dayLabel,
      daySort: slot.daySort,
      timeLabel: slot.timeLabel,
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

  for (const event of options.events) {
    if (selectedClass && event.className !== selectedClass.displayName) continue

    const weekday = weekdayFromDate(event.date)
    const weekPrefix = event.weekLetter ? `${event.weekLetter}-Week · ` : ''
    const dedupeKey = `${event.formId}:${event.categoryId}:${weekday.dayOfWeek}:${event.startTime}:${event.endTime}:${event.weekLetter ?? ''}:${event.offeringLabel ?? ''}`

    addTimeslot(
      programs,
      {
        programName: event.programName,
        className: event.className,
        classDescription: event.classDescription,
        categoryId: event.categoryId,
        categoryName: event.categoryName,
        offeringLabel: event.offeringLabel,
        formId: event.formId,
        enrollVisible: Boolean(event.enrollVisible),
        inactive: options.isEventInactive(event),
      },
      {
        slotKey: dedupeKey,
        dayLabel: `${weekPrefix}${weekday.dayLabel}`,
        daySort: daySortIndex(weekday.dayOfWeek),
        timeLabel: formatTimeRange(event.startTime, event.endTime),
      },
    )
  }

  for (const tbd of options.tbdPatterns) {
    if (selectedClass && tbd.className !== selectedClass.displayName) continue

    const weekday = weekdayFromTbd(tbd)
    const weekPrefix = tbd.weekLetter ? `${tbd.weekLetter}-Week · ` : ''
    const dayLabel = weekday ? `${weekPrefix}${weekday.dayLabel}` : 'Dates TBD'
    const daySort = weekday ? daySortIndex(weekday.dayOfWeek) : 99
    const dedupeKey = `${tbd.formId}:${tbd.categoryId}:${tbd.dayOfWeek}:${tbd.startTime}:${tbd.endTime}:${tbd.weekLetter ?? ''}:${tbd.offeringLabel ?? ''}`

    addTimeslot(
      programs,
      {
        programName: tbd.programName,
        className: tbd.className,
        classDescription: tbd.classDescription,
        categoryId: tbd.categoryId,
        categoryName: tbd.categoryName,
        offeringLabel: tbd.offeringLabel,
        formId: tbd.formId,
        enrollVisible: Boolean(tbd.enrollVisible),
        inactive: options.isTbdInactive(tbd),
      },
      {
        slotKey: dedupeKey,
        dayLabel,
        daySort,
        timeLabel: formatTimeRange(tbd.startTime, tbd.endTime),
      },
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
          categories: [...classGroup.categories.values()]
            .sort(
              (a, b) =>
                (a.categoryName ?? '').localeCompare(b.categoryName ?? '') ||
                (a.offeringLabel ?? '').localeCompare(b.offeringLabel ?? ''),
            )
            .map((cat) => ({
              key: categoryKey(cat.formId, cat.categoryId, cat.offeringLabel),
              categoryId: cat.categoryId,
              categoryName: cat.categoryName,
              offeringLabel: cat.offeringLabel,
              formId: cat.formId,
              enrollVisible: cat.enrollVisible,
              inactive: cat.inactive,
              timeslots: [...cat.slots.values()].sort(
                (a, b) => a.daySort - b.daySort || a.timeLabel.localeCompare(b.timeLabel),
              ),
            })),
        })),
    }))
}
