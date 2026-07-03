import type { SignupOrderPreviewClass } from './schedulingApi'

type EnrollmentHeadingFields = {
  class_context_line?: string | null
  sport_name?: string | null
  sportName?: string | null
  program_name?: string | null
  programName?: string | null
  class_name?: string | null
  className?: string | null
  formTitle?: string
}

/** Sport · program · class heading for enrollment tables (no dates/times). */
export function enrollmentClassHeading(item: EnrollmentHeadingFields): string {
  if (item.class_context_line?.trim()) return item.class_context_line.trim()

  const sportName = item.sport_name ?? item.sportName
  const programName = item.program_name ?? item.programName
  const className = item.class_name ?? item.className ?? item.formTitle

  const parts = [sportName, programName, className].filter(
    (part) => part != null && String(part).trim() !== '',
  )
  if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) {
    parts.pop()
  }
  return parts.length > 0 ? parts.join(' · ') : className || 'Class'
}

/** Full enrollment context line for checkout and billing summaries. */
export function enrollmentDisplayLine(item: Pick<
  SignupOrderPreviewClass,
  | 'displayLine'
  | 'sportName'
  | 'programName'
  | 'className'
  | 'formTitle'
  | 'offeringDates'
  | 'scheduleDays'
  | 'scheduleTimes'
  | 'slotLabel'
>): string {
  if (item.displayLine?.trim()) return item.displayLine.trim()

  const className = item.className || item.formTitle
  const parts = [
    item.sportName,
    item.programName,
    className,
    item.offeringDates,
    item.scheduleDays,
    item.scheduleTimes,
  ].filter((part) => part != null && String(part).trim() !== '')

  if (parts.length > 0) return parts.join(' · ')
  if (className && item.slotLabel) return `${className} · ${item.slotLabel}`
  return className || item.slotLabel || 'Class'
}
