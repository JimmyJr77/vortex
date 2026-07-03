import type { SignupOrderPreviewClass } from './schedulingApi'
import type { PublicProgramOffered } from './publicClassesApi'

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
  const sportName = item.sport_name ?? item.sportName
  const programName = item.program_name ?? item.programName
  const className = item.class_name ?? item.className ?? item.formTitle

  const parts = [sportName, programName, className].filter(
    (part) => part != null && String(part).trim() !== '',
  )
  if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) {
    parts.pop()
  }
  if (parts.length > 0) return parts.join(' · ')

  if (item.class_context_line?.trim()) return item.class_context_line.trim()
  return className || 'Class'
}

/** Fill missing sport/program/class from public classes-offered catalog (by form_id). */
export function enrichEnrollmentsFromClassesOffered<
  T extends {
    form_id?: number | null
    sport_name?: string | null
    program_name?: string | null
    class_name?: string | null
    class_context_line?: string | null
    program_id?: number | null
  },
>(rows: T[], programs: PublicProgramOffered[]): T[] {
  if (!programs.length) return rows

  const byFormId = new Map<
    number,
    { sportName: string | null; programName: string; className: string; programId: number }
  >()
  for (const program of programs) {
    for (const cls of program.classes) {
      if (cls.formId == null) continue
      byFormId.set(cls.formId, {
        sportName: program.primarySportName?.trim() || null,
        programName: program.displayName,
        className: cls.displayName,
        programId: program.id,
      })
    }
  }

  return rows.map((row) => {
    if (row.form_id == null) return row
    const meta = byFormId.get(row.form_id)
    if (!meta) return row

    const sportName = row.sport_name?.trim() || meta.sportName
    const programName = row.program_name?.trim() || meta.programName
    const className = row.class_name?.trim() || meta.className
    const classContextLine = [sportName, programName, className]
      .filter((part) => part != null && String(part).trim() !== '')
      .join(' · ')

    return {
      ...row,
      sport_name: sportName,
      program_name: programName,
      class_name: className,
      program_id: row.program_id ?? meta.programId,
      class_context_line: classContextLine || row.class_context_line,
    }
  })
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

/** Modal heading for member enrollment cancellation: sport through schedule. */
export function memberEnrollmentCancelHeading(row: {
  sport_name?: string | null
  program_name?: string | null
  class_name?: string | null
  offering_label?: string | null
  offering_dates?: string | null
  slot_label?: string | null
  class_context_line?: string | null
}): string {
  const offering = row.offering_label?.trim() || row.offering_dates?.trim() || null
  const parts = [
    row.sport_name,
    row.program_name,
    row.class_name,
    offering,
    row.slot_label,
  ].filter((part) => part != null && String(part).trim() !== '')
  if (parts.length > 0) return parts.join(' · ')
  if (row.class_context_line?.trim()) return row.class_context_line.trim()
  return row.class_name?.trim() || 'Enrollment'
}
