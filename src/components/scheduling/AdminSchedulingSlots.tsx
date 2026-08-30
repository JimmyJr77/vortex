import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Pencil, Plus, Trash2, Users } from 'lucide-react'
import {
  SCHEDULING_DAYS,
  WEEK_LETTERS,
  adminCreateSlotBatch,
  adminDeleteSlotGroup,
  adminSaveSchedulingForm,
  adminUpdateSlotGroupMax,
  dayAbbrev,
  schedulingHasMultipleWeeks,
  type SchedulingFormDetail,
  type SchedulingSlotGroup,
  type SlotBatchPayload,
} from '../../utils/schedulingApi'
import { formatDateForInput } from '../../utils/dateUtils'
import {
  groupSlotGroupsByWeek,
  sortOccurrences,
  sortSlotGroups,
  weekBucketLabel,
} from '../../utils/slotSort'
import OrphanedSignupsPanel from './OrphanedSignupsPanel'
import type {
  SchedulingFormSummary,
  SchedulingOrphanedSignup,
  SchedulingSignup,
} from '../../utils/schedulingApi'

type DurationMode = 'session' | 'evergreen'

interface Props {
  formId: number
  detail: SchedulingFormDetail
  formStartDate: string | null
  formEndDate: string | null
  offeringId?: number | null
  offeringStartDate?: string | null
  offeringEndDate?: string | null
  setupContextPrimary?: string | null
  canBuild?: boolean
  /** Class Master puts the existing-slots card above the builder; Scheduling tab keeps it below. */
  existingSlotsPosition?: 'top' | 'bottom'
  orphanedSignups: SchedulingOrphanedSignup[]
  signups: SchedulingSignup[]
  forms: SchedulingFormSummary[]
  onRefresh: () => Promise<void>
}

type TimeRow = { startTime: string; endTime: string }
type DayRow = { dayOfWeek: number; enabled: boolean; activeStart: string; activeEnd: string; times: TimeRow[] }
type WeekRow = { weekLetter: string; days: DayRow[] }
type DateEntry = { type: 'single' | 'range'; date: string; startDate: string; endDate: string; times: TimeRow[] }

const defaultTime = (): TimeRow => ({ startTime: '09:00', endTime: '10:00' })

const normalizeTime = (time: string) => (time.length >= 5 ? time.slice(0, 5) : time)

const lastTimeSessionKey = (formId: number) => `vortex:scheduling:last-timeslot:${formId}`

function readSessionLastTime(formId: number): TimeRow | null {
  try {
    const raw = sessionStorage.getItem(lastTimeSessionKey(formId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { startTime?: string; endTime?: string }
    if (!parsed.startTime || !parsed.endTime) return null
    return {
      startTime: normalizeTime(parsed.startTime),
      endTime: normalizeTime(parsed.endTime),
    }
  } catch {
    return null
  }
}

function writeSessionLastTime(formId: number, time: TimeRow) {
  try {
    sessionStorage.setItem(lastTimeSessionKey(formId), JSON.stringify(time))
  } catch {
    /* ignore quota / private mode */
  }
}

function timesEqual(a: TimeRow, b: TimeRow) {
  return a.startTime === b.startTime && a.endTime === b.endTime
}

function resolveSeedTime(
  formId: number,
  offeringGroups: SchedulingSlotGroup[],
  preserveTime?: TimeRow,
): TimeRow {
  if (preserveTime) return { ...preserveTime }
  return readSessionLastTime(formId) ?? deriveLastTimeFromOffering(offeringGroups)
}

function timeRowFromOccurrence(occ: { startTime: string; endTime: string }): TimeRow {
  return {
    startTime: normalizeTime(occ.startTime),
    endTime: normalizeTime(occ.endTime),
  }
}

function deriveLastTimeFromOffering(groups: SchedulingSlotGroup[]): TimeRow {
  const allOccs = groups.flatMap((g) => g.occurrences)
  if (allOccs.length === 0) return defaultTime()
  const latest = [...allOccs].sort((a, b) => b.id - a.id)[0]
  return timeRowFromOccurrence(latest)
}

function extractLastTimeFromBuilder(
  weeks: WeekRow[],
  dateEntries: DateEntry[],
  scheduleMode: 'day' | 'date',
): TimeRow {
  if (scheduleMode === 'day') {
    for (let wi = weeks.length - 1; wi >= 0; wi -= 1) {
      for (let di = weeks[wi].days.length - 1; di >= 0; di -= 1) {
        const day = weeks[wi].days[di]
        if (day.enabled && day.times.length > 0) {
          return { ...day.times[day.times.length - 1] }
        }
      }
    }
  } else {
    for (let i = dateEntries.length - 1; i >= 0; i -= 1) {
      const entry = dateEntries[i]
      if (entry.times.length > 0) {
        return { ...entry.times[entry.times.length - 1] }
      }
    }
  }
  return defaultTime()
}

function syncTimesAcrossDays(
  weeks: WeekRow[],
  previousTemplate: TimeRow,
  newTemplate: TimeRow,
  edited?: { weekIdx: number; dayIdx: number },
): WeekRow[] {
  return weeks.map((week, wi) => ({
    ...week,
    days: week.days.map((day, di) => {
      if (edited && edited.weekIdx === wi && edited.dayIdx === di) return day
      if (!day.enabled) {
        return { ...day, times: [{ ...newTemplate }] }
      }
      if (day.times.length === 1 && timesEqual(day.times[0], previousTemplate)) {
        return { ...day, times: [{ ...newTemplate }] }
      }
      return day
    }),
  }))
}

function syncDateEntryTimes(
  entries: DateEntry[],
  previousTemplate: TimeRow,
  newTemplate: TimeRow,
  editedIdx?: number,
): DateEntry[] {
  return entries.map((entry, idx) => {
    if (idx === editedIdx) return entry
    if (entry.times.length === 1 && timesEqual(entry.times[0], previousTemplate)) {
      return { ...entry, times: [{ ...newTemplate }] }
    }
    return entry
  })
}

function formatWeekSetupLabel(weekKey: string, options?: { multipleWeeks?: boolean }): string {
  if (weekKey === '__dates__') return 'Dates'
  if (options?.multipleWeeks !== true) return 'Schedule'
  return `${weekKey} Week`
}

function createDefaultWeeks(inheritedStart: string, inheritedEnd: string, time: TimeRow = defaultTime()): WeekRow[] {
  return [
    {
      weekLetter: 'A',
      days: SCHEDULING_DAYS.map((d) => ({
        dayOfWeek: d.value,
        enabled: false,
        activeStart: inheritedStart,
        activeEnd: inheritedEnd,
        times: [{ ...time }],
      })),
    },
  ]
}

function updateWeekDay(weeks: WeekRow[], weekIdx: number, dayIdx: number, updater: (day: DayRow) => DayRow): WeekRow[] {
  return weeks.map((week, wi) =>
    wi !== weekIdx
      ? week
      : { ...week, days: week.days.map((day, di) => (di !== dayIdx ? day : updater(day))) },
  )
}

function updateDateEntryAt(entries: DateEntry[], idx: number, updater: (entry: DateEntry) => DateEntry): DateEntry[] {
  return entries.map((entry, i) => (i !== idx ? entry : updater(entry)))
}

function payloadBase(
  durationMode: DurationMode,
  activeStart: string,
  activeEnd: string,
  scheduleMode: 'day' | 'date',
  maxParticipants: number,
  offeringId?: number | null,
) {
  return {
    offeringId: offeringId ?? null,
    // Persist dates on each slot group so billing can resolve class start per timeslot.
    activeDatesMode: 'custom' as const,
    activeStart: activeStart || null,
    activeEnd: durationMode === 'evergreen' ? null : activeEnd || null,
    scheduleMode,
    maxParticipants,
  }
}

const AdminSchedulingSlots = ({
  formId,
  detail,
  formStartDate,
  formEndDate,
  offeringId,
  offeringStartDate,
  offeringEndDate,
  setupContextPrimary,
  canBuild = true,
  existingSlotsPosition = 'bottom',
  orphanedSignups,
  forms,
  onRefresh,
}: Props) => {
  // Show all class timeslots; Active dates live at the class level (not per-offering UI).
  const offeringScopedSlotGroups = useMemo(
    () => sortSlotGroups(detail.slotGroups ?? []),
    [detail.slotGroups],
  )

  const prevOfferingIdRef = useRef<number | null | undefined>(offeringId)
  const lastTimeRef = useRef<TimeRow>(
    readSessionLastTime(formId) ?? defaultTime(),
  )

  const builderRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)
  const deletingRef = useRef(false)
  const [slotsContextOpen, setSlotsContextOpen] = useState(true)
  const [activeWeekKey, setActiveWeekKey] = useState<string | null>(null)
  const [editingSlotGroupId, setEditingSlotGroupId] = useState<number | null>(null)
  const [builderOpen, setBuilderOpen] = useState(existingSlotsPosition !== 'top')
  const [durationMode, setDurationMode] = useState<DurationMode>(formEndDate ? 'session' : 'evergreen')
  const [activeStart, setActiveStart] = useState('')
  const [activeEnd, setActiveEnd] = useState('')
  const [classNotes, setClassNotes] = useState(detail.description ?? '')
  const [scheduleMode, setScheduleMode] = useState<'day' | 'date'>('day')
  const [maxParticipants, setMaxParticipants] = useState(10)
  const [weeks, setWeeks] = useState<WeekRow[]>(createDefaultWeeks('', ''))
  const [activeWeekIdx, setActiveWeekIdx] = useState(0)
  const [dateEntries, setDateEntries] = useState<DateEntry[]>([
    { type: 'single', date: '', startDate: '', endDate: '', times: [{ ...lastTimeRef.current }] },
  ])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setClassNotes(detail.description ?? '')
  }, [formId, detail.description])

  useEffect(() => {
    if (existingSlotsPosition !== 'top') setBuilderOpen(true)
  }, [existingSlotsPosition, formId])

  const commitLastTime = (time: TimeRow) => {
    lastTimeRef.current = time
    writeSessionLastTime(formId, time)
  }

  const seedDatesFromForm = () => ({
    start: formatDateForInput(offeringStartDate ?? formStartDate),
    end: formatDateForInput(offeringEndDate ?? formEndDate),
  })

  const closeBuilder = () => {
    if (existingSlotsPosition === 'top') setBuilderOpen(false)
  }

  const scrollToBuilder = () => {
    builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const resetBuilderForm = (preserveTime?: TimeRow) => {
    const { start, end } = seedDatesFromForm()
    const seedTime = resolveSeedTime(formId, offeringScopedSlotGroups, preserveTime)
    setSaveError(null)
    setEditingSlotGroupId(null)
    setDurationMode(end ? 'session' : 'evergreen')
    setActiveStart(start)
    setActiveEnd(end)
    setScheduleMode('day')
    setMaxParticipants(10)
    setWeeks(createDefaultWeeks(start, end, seedTime))
    setActiveWeekIdx(0)
    setDateEntries([{ type: 'single', date: '', startDate: '', endDate: '', times: [{ ...seedTime }] }])
    commitLastTime(seedTime)
  }

  const openBlankBuilder = () => {
    resetBuilderForm()
    setBuilderOpen(true)
    requestAnimationFrame(() => scrollToBuilder())
  }

  const populateFormFromGroup = (group: SchedulingSlotGroup) => {
    const groupStart =
      formatDateForInput(group.activeStart) || seedDatesFromForm().start
    const groupEnd = group.datesTbd
      ? ''
      : formatDateForInput(group.activeEnd) || ''
    const mode: DurationMode = groupEnd ? 'session' : 'evergreen'

    setMaxParticipants(group.maxParticipants)
    setScheduleMode(group.scheduleMode)
    setDurationMode(mode)
    setActiveStart(groupStart)
    setActiveEnd(groupEnd)

    const occurrences = group.occurrences
    if (occurrences.length === 0) return

    const latestOcc = [...occurrences].sort((a, b) => b.id - a.id)[0] ?? occurrences[0]
    commitLastTime(timeRowFromOccurrence(latestOcc))

    if (group.scheduleMode === 'day') {
      const weekLetters = [...new Set(occurrences.map((o) => o.weekLetter || 'A'))].sort()
      const weekRows: WeekRow[] = weekLetters.map((letter) => ({
        weekLetter: letter,
        days: SCHEDULING_DAYS.map((d) => {
          const dayOcc = occurrences.filter(
            (o) => (o.weekLetter || 'A') === letter && o.dayOfWeek === d.value,
          )
          if (dayOcc.length === 0) {
            return {
              dayOfWeek: d.value,
              enabled: false,
              activeStart: groupStart,
              activeEnd: groupEnd,
              times: [defaultTime()],
            }
          }
          return {
            dayOfWeek: d.value,
            enabled: true,
            activeStart: groupStart,
            activeEnd: groupEnd,
            times: dayOcc.map((o) => ({
              startTime: normalizeTime(o.startTime),
              endTime: normalizeTime(o.endTime),
            })),
          }
        }),
      }))
      setWeeks(weekRows)
      setActiveWeekIdx(0)
      setDateEntries([{ type: 'single', date: '', startDate: '', endDate: '', times: [defaultTime()] }])
    } else {
      const dateMap = new Map<string, TimeRow[]>()
      for (const occ of occurrences) {
        const dateKey = formatDateForInput(occ.specificDate) || ''
        if (!dateKey) continue
        if (!dateMap.has(dateKey)) dateMap.set(dateKey, [])
        dateMap.get(dateKey)!.push({
          startTime: normalizeTime(occ.startTime),
          endTime: normalizeTime(occ.endTime),
        })
      }
      setWeeks(createDefaultWeeks(groupStart, groupEnd))
      setActiveWeekIdx(0)
      setDateEntries(
        [...dateMap.entries()].map(([date, times]) => ({
          type: 'single' as const,
          date,
          startDate: '',
          endDate: '',
          times,
        })),
      )
    }
  }

  const handleEditGroup = (group: SchedulingSlotGroup) => {
    setSaveError(null)
    populateFormFromGroup(group)
    setEditingSlotGroupId(group.id)
    setBuilderOpen(true)
    requestAnimationFrame(() => scrollToBuilder())
  }

  const handleCopyGroup = (group: SchedulingSlotGroup) => {
    setSaveError(null)
    populateFormFromGroup(group)
    setEditingSlotGroupId(null)
    setBuilderOpen(true)
    requestAnimationFrame(() => scrollToBuilder())
  }

  const weekSections = useMemo(() => {
    const multipleWeeks = schedulingHasMultipleWeeks(offeringScopedSlotGroups)
    const labelOpts = { multipleWeeks }
    return groupSlotGroupsByWeek(offeringScopedSlotGroups).map(([weekKey, groups]) => ({
      key: weekKey,
      label: weekBucketLabel(weekKey, labelOpts),
      setupLabel: formatWeekSetupLabel(weekKey, labelOpts),
      groups,
    }))
  }, [offeringScopedSlotGroups])

  const activeWeekSection =
    weekSections.find((section) => section.key === activeWeekKey) ?? weekSections[0] ?? null

  useEffect(() => {
    if (weekSections.length === 0) {
      setActiveWeekKey(null)
      return
    }
    setActiveWeekKey((current) =>
      current && weekSections.some((section) => section.key === current)
        ? current
        : weekSections[0].key,
    )
  }, [offeringId, weekSections])

  useEffect(() => {
    if (prevOfferingIdRef.current !== offeringId) {
      prevOfferingIdRef.current = offeringId
      resetBuilderForm()
      if (existingSlotsPosition === 'top') setBuilderOpen(false)
    }
  }, [offeringId])

  useEffect(() => {
    if (editingSlotGroupId || builderOpen === false) return
    if (activeStart) return
    const { start, end } = seedDatesFromForm()
    if (!start && !end) return
    setDurationMode(end ? 'session' : 'evergreen')
    setActiveStart(start)
    setActiveEnd(end)
  }, [formStartDate, formEndDate, offeringStartDate, offeringEndDate, editingSlotGroupId, builderOpen, activeStart])

  const addWeek = () => {
    if (weeks.length >= WEEK_LETTERS.length) return
    const letter = WEEK_LETTERS[weeks.length]
    setWeeks((prev) => [
      ...prev,
      {
        weekLetter: letter,
        days: SCHEDULING_DAYS.map((d) => ({
          dayOfWeek: d.value,
          enabled: false,
          activeStart: activeStart,
          activeEnd: activeEnd,
          times: [{ ...lastTimeRef.current }],
        })),
      },
    ])
    setActiveWeekIdx(weeks.length)
  }

  const addTimeToDay = (weekIdx: number, dayIdx: number) => {
    setWeeks((prev) =>
      updateWeekDay(prev, weekIdx, dayIdx, (day) => ({
        ...day,
        times: [...day.times, { ...lastTimeRef.current }],
      })),
    )
  }

  const removeTimeFromDay = (weekIdx: number, dayIdx: number, timeIdx: number) => {
    setWeeks((prev) =>
      updateWeekDay(prev, weekIdx, dayIdx, (day) => ({
        ...day,
        times: day.times.filter((_, ti) => ti !== timeIdx),
      })),
    )
  }

  const updateDayTime = (
    weekIdx: number,
    dayIdx: number,
    timeIdx: number,
    field: 'startTime' | 'endTime',
    val: string,
    currentEnd: string,
    currentStart: string,
  ) => {
    const previousCellTime = { startTime: currentStart, endTime: currentEnd }
    const newTime = field === 'startTime'
      ? { startTime: val, endTime: currentEnd }
      : { startTime: currentStart, endTime: val }
    commitLastTime(newTime)
    setWeeks((prev) => {
      const withEdit = updateWeekDay(prev, weekIdx, dayIdx, (day) => ({
        ...day,
        times: day.times.map((t, ti) => (ti !== timeIdx ? t : { ...t, [field]: val })),
      }))
      return syncTimesAcrossDays(withEdit, previousCellTime, newTime, { weekIdx, dayIdx })
    })
    setDateEntries((prev) => syncDateEntryTimes(prev, previousCellTime, newTime))
  }

  const addTimeToDateEntry = (entryIdx: number) => {
    setDateEntries((prev) =>
      updateDateEntryAt(prev, entryIdx, (entry) => ({
        ...entry,
        times: [...entry.times, { ...lastTimeRef.current }],
      })),
    )
  }

  const removeTimeFromDateEntry = (entryIdx: number, timeIdx: number) => {
    setDateEntries((prev) =>
      updateDateEntryAt(prev, entryIdx, (entry) => ({
        ...entry,
        times: entry.times.filter((_, ti) => ti !== timeIdx),
      })),
    )
  }

  const updateDateEntryTime = (
    entryIdx: number,
    timeIdx: number,
    field: 'startTime' | 'endTime',
    val: string,
    currentEnd: string,
    currentStart: string,
  ) => {
    const previousCellTime = { startTime: currentStart, endTime: currentEnd }
    const newTime = field === 'startTime'
      ? { startTime: val, endTime: currentEnd }
      : { startTime: currentStart, endTime: val }
    commitLastTime(newTime)
    setDateEntries((prev) => {
      const withEdit = updateDateEntryAt(prev, entryIdx, (entry) => ({
        ...entry,
        times: entry.times.map((t, ti) => (ti !== timeIdx ? t : { ...t, [field]: val })),
      }))
      return syncDateEntryTimes(withEdit, previousCellTime, newTime, entryIdx)
    })
    setWeeks((prev) => syncTimesAcrossDays(prev, previousCellTime, newTime))
  }

  const activeDatesValidationError = (() => {
    if (!activeStart) return 'Start date is required for Active dates.'
    if (durationMode === 'session') {
      if (!activeEnd) return 'End date is required for session Active dates.'
      if (activeEnd < activeStart) return 'End date must be on or after the start date.'
    }
    return null
  })()

  const buildPayload = (): SlotBatchPayload | null => {
    const base = payloadBase(
      durationMode,
      activeStart,
      activeEnd,
      scheduleMode,
      maxParticipants,
      offeringId,
    )
    if (scheduleMode === 'day') {
      const weekPayload = weeks
        .map((w) => ({
          weekLetter: w.weekLetter,
          days: w.days
            .filter((d) => d.enabled)
            .map((d) => ({
              dayOfWeek: d.dayOfWeek,
              // Slot-group Active dates apply to every day in the batch.
              activeStart: activeStart || null,
              activeEnd: durationMode === 'evergreen' ? null : activeEnd || null,
              times: d.times.map((t) => ({
                startTime: t.startTime,
                endTime: t.endTime,
                maxParticipants,
              })),
            })),
        }))
        .filter((w) => w.days.length > 0)
      if (weekPayload.length === 0) return null
      return { ...base, daySchedule: { weeks: weekPayload } }
    }
    const entries = dateEntries
      .filter((e) => (e.type === 'single' && e.date) || (e.type === 'range' && e.startDate && e.endDate))
      .map((e) => ({
        type: e.type,
        date: e.type === 'single' ? e.date : undefined,
        startDate: e.type === 'range' ? e.startDate : undefined,
        endDate: e.type === 'range' ? e.endDate : undefined,
        times: e.times.map((t) => ({
          startTime: t.startTime,
          endTime: t.endTime,
          maxParticipants,
        })),
      }))
    if (entries.length === 0) return null
    return { ...base, dateSchedule: { entries } }
  }

  const handleSaveBatch = async () => {
    if (savingRef.current) return
    setSaveError(null)

    if (activeDatesValidationError) {
      setSaveError(activeDatesValidationError)
      return
    }

    const payload = buildPayload()
    if (!payload) {
      setSaveError(
        scheduleMode === 'day'
          ? 'Enable at least one day with a time before saving.'
          : 'Add at least one date with a time before saving.',
      )
      return
    }

    savingRef.current = true
    setSaving(true)
    try {
      const notesChanged = (classNotes ?? '') !== (detail.description ?? '')
      if (notesChanged) {
        await adminSaveSchedulingForm(
          {
            title: detail.title,
            description: classNotes,
            startDate: detail.startDate ?? undefined,
            endDate: detail.endDate ?? undefined,
            isActive: detail.isActive,
            maxSlotsPerUser: detail.maxSlotsPerUser,
            slotCostMonthlyCents: detail.slotCostMonthlyCents,
            costUnit: detail.costUnit,
            freeSlotsPerUser: detail.freeSlotsPerUser,
            maxFreeSlotsTotal: detail.maxFreeSlotsTotal,
            pricingOverridesProgram: detail.pricingOverridesProgram,
          },
          formId,
        )
      }

      if (editingSlotGroupId) {
        const existing = detail.slotGroups?.find((g) => g.id === editingSlotGroupId)
        const activeSignups =
          (existing?.signupCount ?? 0) + (existing?.waitlistCount ?? 0)

        if (activeSignups > 0) {
          if (existing && existing.maxParticipants !== maxParticipants) {
            await adminUpdateSlotGroupMax(editingSlotGroupId, maxParticipants)
            await onRefresh()
            resetBuilderForm(extractLastTimeFromBuilder(weeks, dateEntries, scheduleMode))
            closeBuilder()
            return
          }
          const proceed = confirm(
            `${activeSignups} enrolled or waitlisted athlete(s) will move to Orphaned signups. Replace this schedule anyway?`,
          )
          if (!proceed) return
        }

        await adminDeleteSlotGroup(editingSlotGroupId)
      }
      await adminCreateSlotBatch(formId, payload)
      await onRefresh()
      resetBuilderForm(extractLastTimeFromBuilder(weeks, dateEntries, scheduleMode))
      closeBuilder()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save slot')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleDeleteGroup = async (group: SchedulingSlotGroup) => {
    if (deletingRef.current) return
    const activeSignups = (group.signupCount ?? 0) + (group.waitlistCount ?? 0)
    const message =
      activeSignups > 0
        ? `Delete this schedule? ${activeSignups} enrolled or waitlisted athlete(s) will move to Orphaned signups (cancelled signups are preserved too).`
        : 'Delete this signup slot and all of its days/times? Any cancelled signups will move to Orphaned signups.'
    if (!confirm(message)) return

    deletingRef.current = true
    setSaveError(null)
    try {
      if (editingSlotGroupId === group.id) setEditingSlotGroupId(null)
      await adminDeleteSlotGroup(group.id)
      await onRefresh()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to delete schedule')
    } finally {
      deletingRef.current = false
    }
  }

  const formatGroupActiveDates = (group: SchedulingSlotGroup) => {
    if (group.datesTbd) return 'Date TBD'
    if (group.activeStart || group.activeEnd) {
      return `${group.activeStart || '—'} → ${group.activeEnd || '—'}`
    }
    return '—'
  }

  const week = weeks[activeWeekIdx]

  const durationBtn = (mode: DurationMode, label: string, hint: string) => {
    const active = durationMode === mode
    return (
      <button
        type="button"
        onClick={() => setDurationMode(mode)}
        className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
          active
            ? 'border-vortex-red bg-red-50 text-gray-900 ring-1 ring-vortex-red'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span className="block font-semibold">{label}</span>
        <span className="text-xs text-gray-500">{hint}</span>
      </button>
    )
  }

  const builderForm = (
    <div ref={builderRef}>
      <h3 className="text-xl font-bold text-black mb-4">
        {editingSlotGroupId ? 'Edit time slot' : 'Add time slot'}
      </h3>
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-4 w-full">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Active dates</h4>
            <p className="mt-0.5 text-xs text-gray-500">
              When this timeslot runs. Start date is used for billing class-start timing.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {durationBtn('session', 'Session', 'Fixed start and end')}
            {durationBtn('evergreen', 'Evergreen', 'Starts on a date, no end')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Start date</label>
              <input
                type="date"
                value={activeStart}
                onChange={(e) => setActiveStart(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              />
            </div>
            {durationMode === 'session' && (
              <div>
                <label className="block text-sm font-semibold mb-1">End date</label>
                <input
                  type="date"
                  value={activeEnd}
                  onChange={(e) => setActiveEnd(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Schedule by</label>
            <select
              value={scheduleMode}
              onChange={(e) => setScheduleMode(e.target.value as 'day' | 'date')}
              className="w-full h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="day">Day</option>
              <option value="date">Date</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Max participants</label>
            <input
              type="number"
              min={1}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            />
          </div>
        </div>

        {scheduleMode === 'day' && week && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              {weeks.map((w, idx) => (
                <button
                  key={w.weekLetter}
                  type="button"
                  onClick={() => setActiveWeekIdx(idx)}
                  className={`px-3 py-1 rounded-lg font-semibold text-sm ${
                    activeWeekIdx === idx ? 'bg-vortex-red text-white' : 'bg-white border border-gray-300'
                  }`}
                >
                  {weeks.length > 1 ? `${w.weekLetter}-Week` : 'Schedule'}
                </button>
              ))}
              {weeks.length < WEEK_LETTERS.length && (
                <button type="button" onClick={addWeek} className="inline-flex items-center gap-1 text-sm text-vortex-red font-semibold">
                  <Plus className="w-4 h-4" /> Add week
                </button>
              )}
            </div>
            <div className="space-y-3">
              {week.days.map((day, dayIdx) => {
                const dayLabel = SCHEDULING_DAYS.find((d) => d.value === day.dayOfWeek)?.label
                return (
                  <div key={day.dayOfWeek} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <label className="flex items-center gap-2 font-semibold mb-2">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(e) => {
                          const enabled = e.target.checked
                          setWeeks((prev) =>
                            updateWeekDay(prev, activeWeekIdx, dayIdx, (d) => ({
                              ...d,
                              enabled,
                              times: enabled ? [{ ...lastTimeRef.current }] : d.times,
                            })),
                          )
                        }}
                      />
                      {dayLabel}
                    </label>
                    {day.enabled && (
                      <div className="ml-6 space-y-2">
                        {day.times.map((t, timeIdx) => (
                          <div key={timeIdx} className="flex gap-2 items-center">
                            <input
                              type="time"
                              value={t.startTime}
                              onChange={(e) => updateDayTime(activeWeekIdx, dayIdx, timeIdx, 'startTime', e.target.value, t.endTime, t.startTime)}
                              className="rounded border px-2 py-1"
                            />
                            <span>–</span>
                            <input
                              type="time"
                              value={t.endTime}
                              onChange={(e) => updateDayTime(activeWeekIdx, dayIdx, timeIdx, 'endTime', e.target.value, t.endTime, t.startTime)}
                              className="rounded border px-2 py-1"
                            />
                            {day.times.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeTimeFromDay(activeWeekIdx, dayIdx, timeIdx)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => addTimeToDay(activeWeekIdx, dayIdx)} className="text-sm text-vortex-red font-semibold">+ Add time</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {scheduleMode === 'date' && (
          <div className="space-y-4">
            {dateEntries.map((entry, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
                <div className="flex gap-2 items-stretch">
                  <select
                    value={entry.type}
                    onChange={(e) => {
                      const type = e.target.value as 'single' | 'range'
                      setDateEntries((prev) =>
                        updateDateEntryAt(prev, idx, (en) => ({ ...en, type })),
                      )
                    }}
                    className="rounded border border-gray-300 px-2 h-10 text-sm bg-white shrink-0"
                  >
                    <option value="single">Single date</option>
                    <option value="range">Date range</option>
                  </select>
                  {entry.type === 'single' ? (
                    <input
                      type="date"
                      value={entry.date}
                      onChange={(e) => {
                        const date = e.target.value
                        setDateEntries((prev) =>
                          updateDateEntryAt(prev, idx, (en) => ({ ...en, date })),
                        )
                      }}
                      className="flex-1 rounded border border-gray-300 px-2 h-10"
                    />
                  ) : (
                    <div className="flex flex-1 gap-2">
                      <input
                        type="date"
                        value={entry.startDate}
                        onChange={(e) => {
                          const startDate = e.target.value
                          setDateEntries((prev) =>
                            updateDateEntryAt(prev, idx, (en) => ({ ...en, startDate })),
                          )
                        }}
                        className="flex-1 rounded border border-gray-300 px-2 h-10"
                      />
                      <input
                        type="date"
                        value={entry.endDate}
                        onChange={(e) => {
                          const endDate = e.target.value
                          setDateEntries((prev) =>
                            updateDateEntryAt(prev, idx, (en) => ({ ...en, endDate })),
                          )
                        }}
                        className="flex-1 rounded border border-gray-300 px-2 h-10"
                      />
                    </div>
                  )}
                </div>
                {entry.times.map((t, tIdx) => (
                  <div key={tIdx} className="flex gap-2 items-center">
                    <input
                      type="time"
                      value={t.startTime}
                      onChange={(e) => updateDateEntryTime(idx, tIdx, 'startTime', e.target.value, t.endTime, t.startTime)}
                      className="rounded border px-2 py-1"
                    />
                    <span>–</span>
                    <input
                      type="time"
                      value={t.endTime}
                      onChange={(e) => updateDateEntryTime(idx, tIdx, 'endTime', e.target.value, t.endTime, t.startTime)}
                      className="rounded border px-2 py-1"
                    />
                    {entry.times.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTimeFromDateEntry(idx, tIdx)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addTimeToDateEntry(idx)}
                  className="text-sm text-vortex-red font-semibold"
                >
                  + Add time
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setDateEntries((prev) => [...prev, { type: 'single', date: '', startDate: '', endDate: '', times: [{ ...lastTimeRef.current }] }])} className="text-sm font-semibold text-gray-700">+ Add date entry</button>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold mb-1">Class notes</label>
          <textarea
            value={classNotes}
            onChange={(e) => setClassNotes(e.target.value)}
            rows={3}
            placeholder="Internal notes for this class (optional)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
          />
        </div>

        {saveError && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {saveError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveBatch}
            disabled={saving}
            className="bg-vortex-red text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : editingSlotGroupId ? 'Finalize Edit' : 'Add time slot'}
          </button>
          {(editingSlotGroupId || existingSlotsPosition === 'top') && (
            <button
              type="button"
              onClick={() => {
                resetBuilderForm()
                closeBuilder()
              }}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100"
            >
              {editingSlotGroupId ? 'Cancel edit' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const existingSlotsCard = setupContextPrimary ? (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setSlotsContextOpen((open) => !open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <div className="min-w-0">
          <p className="font-semibold text-black">{setupContextPrimary}</p>
          <p className="text-sm mt-1">
            {weekSections.length > 1 ? (
              <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                <select
                  value={activeWeekKey ?? weekSections[0]?.key ?? ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setActiveWeekKey(e.target.value)}
                  className="rounded border border-gray-300 bg-white px-2 py-0.5 text-sm text-gray-800"
                >
                  {weekSections.map((section) => (
                    <option key={section.key} value={section.key}>
                      {section.setupLabel}
                    </option>
                  ))}
                </select>
              </span>
            ) : (
              <span className="text-gray-800">
                {activeWeekSection?.setupLabel || 'Timeslots'}
              </span>
            )}
          </p>
        </div>
        <span className="flex items-center gap-2 text-sm text-gray-600 shrink-0">
          {activeWeekSection
            ? `${activeWeekSection.groups.length} slot${activeWeekSection.groups.length !== 1 ? 's' : ''}`
            : '0 slots'}
          {slotsContextOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
      </button>
      {slotsContextOpen && (
        <div className="p-4">
          {!activeWeekSection || activeWeekSection.groups.length === 0 ? (
            <p className="text-gray-500 text-sm">No scheduled slots for this class yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm align-top">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3 align-top">Schedule</th>
                    <th className="py-2 pr-3 align-top">Capacity</th>
                    <th className="py-2 pr-3 align-top">Active dates</th>
                    <th className="py-2 align-top">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeWeekSection.groups.map((group) => (
                    <tr
                      key={group.id}
                      className={`border-b border-gray-100 align-top ${editingSlotGroupId === group.id ? 'bg-amber-50' : ''}`}
                    >
                      <td className="py-2 pr-3 align-top">
                        <ul className="space-y-1">
                          {sortOccurrences(group.occurrences).map((occ) => (
                            <li key={occ.id}>
                              {occ.scheduleMode === 'date'
                                ? `${occ.specificDate} · ${occ.startTime} – ${occ.endTime}`
                                : `${dayAbbrev(occ.dayOfWeek) ?? occ.dayName} · ${occ.startTime} – ${occ.endTime}`}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <span className="inline-flex items-center gap-1 text-gray-700">
                          <Users className="w-3.5 h-3.5" aria-hidden />
                          {group.maxParticipants}
                        </span>
                      </td>
                      <td className="py-2 pr-3 align-top text-gray-600">
                        {formatGroupActiveDates(group)}
                      </td>
                      <td className="py-2 align-top">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditGroup(group)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                            title="Edit schedule"
                            aria-label="Edit schedule"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyGroup(group)}
                            className="text-gray-600 hover:text-gray-900 p-1"
                            title="Copy schedule"
                            aria-label="Copy schedule"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(group)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Delete signup slot"
                            aria-label="Delete signup slot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  ) : weekSections.length === 0 || offeringScopedSlotGroups.length === 0 ? (
    <p className="text-gray-500 text-sm mb-4">No scheduled slots for this class yet.</p>
  ) : null

  return (
    <div className="space-y-8">
      {existingSlotsPosition === 'top' && (
        <>
          {existingSlotsCard}
          {canBuild && (
            <div>
              <button
                type="button"
                onClick={openBlankBuilder}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                Add new
              </button>
            </div>
          )}
          {canBuild && builderOpen && builderForm}
        </>
      )}

      {existingSlotsPosition === 'bottom' && canBuild && builderForm}

      <div className={`${existingSlotsPosition === 'bottom' ? 'border-t border-gray-200 pt-8' : ''} space-y-6`}>
        {existingSlotsPosition === 'bottom' && existingSlotsCard}
        <OrphanedSignupsPanel
          orphanedSignups={orphanedSignups}
          forms={forms}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  )
}

export default AdminSchedulingSlots
