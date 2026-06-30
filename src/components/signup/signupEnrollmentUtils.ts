export interface SignupProgramOption {
  id: number
  name: string
  displayName?: string | null
}

export interface SignupClassOption {
  id: number
  name: string
  displayName?: string | null
  schedulingFormId?: number | null
}

export interface SignupOfferingOption {
  id: number
  label: string | null
  startDate: string
  endDate: string
}

export interface SignupScheduleOption {
  slotGroupId: number
  timeSlotId: number
  offeringId: number | null
  offeringLabel: string | null
  offeringDates: string | null
  offeringStartDate?: string | null
  activeStart?: string | null
  datesTbd?: boolean
  scheduleMode?: 'day' | 'date'
  specificDate?: string | null
  daySort?: number
  startTime?: string | null
  scheduleLabel: string
  priceCents: number | null
  priceLabel: string | null
}

export interface SignupClassCatalog {
  formId: number | null
  offerings: SignupOfferingOption[]
  scheduleOptions: SignupScheduleOption[]
  priceLabel?: string | null
  classActiveDates?: string | null
}

export interface SignupEnrollmentRow {
  programsId: number | ''
  classEventId: number | ''
  offeringIds: number[]
  selectedSlotKeys: string[]
  schedulingFormId?: number
  slotGroupId?: number
  timeSlotId?: number
}

export interface PendingInviteEnrollment {
  classEventId?: number
  programId?: number
  programsId?: number
  schedulingFormId?: number
  slotGroupId?: number
  timeSlotId?: number
  offeringId?: number
  offeringIds?: number[]
  programName?: string
  className?: string
  scheduleLabel?: string
  priceLabel?: string
  classActiveDates?: string
}

export function slotOptionKey(slotGroupId: number, timeSlotId: number) {
  return `${slotGroupId}:${timeSlotId}`
}

export function emptyEnrollmentRow(): SignupEnrollmentRow {
  return {
    programsId: '',
    classEventId: '',
    offeringIds: [],
    selectedSlotKeys: [],
  }
}

/** Flat pending enrollments (one row per slot) → grouped picker rows. */
export function pendingEnrollmentsToRows(pending: PendingInviteEnrollment[]): SignupEnrollmentRow[] {
  const byClass = new Map<number, PendingInviteEnrollment[]>()
  for (const item of pending) {
    const classEventId = Number(item.classEventId ?? item.programId)
    if (!Number.isFinite(classEventId)) continue
    const list = byClass.get(classEventId) ?? []
    list.push(item)
    byClass.set(classEventId, list)
  }

  return [...byClass.entries()].map(([classEventId, items]) => {
    const first = items[0]
    const programsId = Number(first.programsId)
    const selectedSlotKeys = items
      .filter((i) => i.slotGroupId != null && i.timeSlotId != null)
      .map((i) => slotOptionKey(Number(i.slotGroupId), Number(i.timeSlotId)))
    const offeringIds = first.offeringIds?.length
      ? first.offeringIds.map(Number).filter(Number.isFinite)
      : first.offeringId != null
        ? [Number(first.offeringId)]
        : []
    return {
      programsId: Number.isFinite(programsId) ? programsId : '',
      classEventId,
      offeringIds,
      selectedSlotKeys,
      schedulingFormId: first.schedulingFormId != null ? Number(first.schedulingFormId) : undefined,
      slotGroupId: first.slotGroupId != null ? Number(first.slotGroupId) : undefined,
      timeSlotId: first.timeSlotId != null ? Number(first.timeSlotId) : undefined,
    }
  })
}

export function buildEnrollmentSubmitPayload(
  rows: SignupEnrollmentRow[],
  catalogs: Record<number, SignupClassCatalog>,
  classesByProgram: Record<number, SignupClassOption[]>,
  programs: SignupProgramOption[],
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []
  for (const row of rows) {
    if (row.classEventId === '') continue
    const classEventId = Number(row.classEventId)
    const pack = catalogs[classEventId]
    const classes = row.programsId !== '' ? (classesByProgram[Number(row.programsId)] ?? []) : []
    const classOption = classes.find((c) => c.id === classEventId)
    const programOption = programs.find((p) => p.id === Number(row.programsId))
    const base = {
      classEventId,
      programId: classEventId,
      programsId: row.programsId !== '' ? Number(row.programsId) : undefined,
      schedulingFormId: row.schedulingFormId ?? pack?.formId ?? undefined,
      programName: programOption?.displayName || programOption?.name || classOption?.displayName || classOption?.name,
      className: classOption?.displayName || classOption?.name,
      classActiveDates: pack?.classActiveDates ?? undefined,
      daysPerWeek: 1,
    }

    if (row.selectedSlotKeys.length > 0) {
      for (const key of row.selectedSlotKeys) {
        const opt = pack?.scheduleOptions?.find(
          (o) => slotOptionKey(o.slotGroupId, o.timeSlotId) === key,
        )
        if (!opt) continue
        out.push({
          ...base,
          slotGroupId: opt.slotGroupId,
          timeSlotId: opt.timeSlotId,
          offeringId: opt.offeringId,
          offeringLabel: opt.offeringLabel,
          scheduleLabel: opt.scheduleLabel,
          priceCents: opt.priceCents,
          priceLabel: opt.priceLabel,
        })
      }
    } else if (row.slotGroupId != null && row.timeSlotId != null) {
      out.push({
        ...base,
        slotGroupId: row.slotGroupId,
        timeSlotId: row.timeSlotId,
        offeringIds: row.offeringIds,
      })
    }
  }
  return out
}
