import { getEasternDateString } from '../../utils/dateUtils'
import { getRecurringBookingProgram, type RecurringBookingProgram } from '../../utils/publicBookingPrograms'
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

export type RecurringPriceClass = {
  classId: number
  formId: number
  name: string
  excludeFromDropIns?: boolean
  groups: { id: number; offeringId?: number | null }[]
}

export type RecurringClassTimes = RecurringPriceClass & {
  skillLevel: string | null
  skillRequirements: string | null
  times: { label: string; isFull: boolean }[]
}

export type LoadedRecurringSchedule = { status: 'loaded'; classes: RecurringClassTimes[]; usesClassTuition: boolean }

function includesDate(date: string, start?: string | null, end?: string | null) {
  return (!start || start <= date) && (!end || end >= date)
}

export async function loadPublicRecurringSchedule(programName: RecurringBookingProgram): Promise<LoadedRecurringSchedule> {
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
