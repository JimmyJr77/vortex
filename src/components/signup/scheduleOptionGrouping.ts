import { normalizeDateKey, sortScheduleOptions } from '../../utils/slotSort'
import type { SignupScheduleOption } from './signupEnrollmentUtils'

export interface GroupedScheduleOptions {
  offeringLabel: string
  offeringDates: string | null
  options: SignupScheduleOption[]
}

/** Group flat schedule options by offering, sorted by active date then day/date/time. */
export function groupScheduleOptions(scheduleOptions: SignupScheduleOption[]): GroupedScheduleOptions[] {
  const sorted = sortScheduleOptions(scheduleOptions)
  const groups = new Map<string, GroupedScheduleOptions>()
  for (const option of sorted) {
    const key = option.offeringId != null ? String(option.offeringId) : '__general__'
    if (!groups.has(key)) {
      groups.set(key, {
        offeringLabel: option.offeringLabel || 'Schedule options',
        offeringDates: option.offeringDates,
        options: [],
      })
    }
    groups.get(key)!.options.push(option)
  }
  return [...groups.values()].sort((a, b) => {
    const aDate = normalizeDateKey(a.options[0]?.offeringStartDate) ?? '\u0000'
    const bDate = normalizeDateKey(b.options[0]?.offeringStartDate) ?? '\u0000'
    if (aDate !== bDate) return aDate.localeCompare(bDate)
    return (a.options[0]?.offeringLabel ?? '').localeCompare(b.options[0]?.offeringLabel ?? '')
  })
}
