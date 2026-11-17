import { FIT_AND_FLIP_PUBLIC_COPY } from '../config/fitAndFlipCopy'
import { ADULT_BOOKING_PROGRAM } from '../config/publicCatalog'
import type { PublicClassOffered, PublicProgramOffered } from './publicClassesApi'

export const DEVELOPMENTAL_GYMNASTICS_PROGRAM = 'Developmental Gymnastics'
export const DEVELOPMENTAL_GYMNASTICS_HREF = `/enroll?program=${encodeURIComponent(DEVELOPMENTAL_GYMNASTICS_PROGRAM)}`
export const DEVELOPMENTAL_GYMNASTICS_DROP_IN_HREF = `/drop-in?program=${encodeURIComponent(DEVELOPMENTAL_GYMNASTICS_PROGRAM)}`
export const GYMNASTICS_TEAM_PROGRAM = 'Vortex Gymnastics Team'
export const GYMNASTICS_TEAM_BOOKING_HREF = `/enroll?program=${encodeURIComponent(GYMNASTICS_TEAM_PROGRAM)}`
export const FIT_AND_FLIP_BOOKING_PROGRAM = 'Fit & Flip'
export const FIT_AND_FLIP_BOOKING_HREF = `/enroll?program=${encodeURIComponent(FIT_AND_FLIP_BOOKING_PROGRAM)}`
export const FIT_AND_FLIP_DROP_IN_HREF = `/drop-in?program=${encodeURIComponent(FIT_AND_FLIP_BOOKING_PROGRAM)}`

const PUBLIC_BOOKING_PROGRAMS = [
  { name: DEVELOPMENTAL_GYMNASTICS_PROGRAM, aliases: ['Development Gymnastics', DEVELOPMENTAL_GYMNASTICS_PROGRAM] },
  { name: GYMNASTICS_TEAM_PROGRAM, aliases: [GYMNASTICS_TEAM_PROGRAM] },
  { name: FIT_AND_FLIP_BOOKING_PROGRAM, aliases: [FIT_AND_FLIP_BOOKING_PROGRAM] },
] as const

export { ADULT_BOOKING_PROGRAM }
export const ADULT_BOOKING_HREF = `/enroll?program=${encodeURIComponent(ADULT_BOOKING_PROGRAM)}`
export const ADULT_DROP_IN_HREF = `/drop-in?program=${encodeURIComponent(ADULT_BOOKING_PROGRAM)}`
export type RecurringBookingProgram = typeof ADULT_BOOKING_PROGRAM | typeof FIT_AND_FLIP_BOOKING_PROGRAM | typeof DEVELOPMENTAL_GYMNASTICS_PROGRAM

const normalize = (name: string) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')
const normalizedAdultBookingProgram = normalize(ADULT_BOOKING_PROGRAM)
const fitAndFlipSearchCopy = Object.values(FIT_AND_FLIP_PUBLIC_COPY).join(' ')

export function isAdultBookingProgram(name: string | null): boolean {
  return name !== null && normalize(name) === normalizedAdultBookingProgram
}

export function getAdultBookingProgram(programs: readonly PublicProgramOffered[]) {
  return getRecurringBookingProgram(programs, ADULT_BOOKING_PROGRAM)
}

export function getRecurringBookingProgram(programs: readonly PublicProgramOffered[], name: RecurringBookingProgram) {
  const normalizedName = normalize(name)
  const program = programs.find(({ displayName }) => typeof displayName === 'string' &&
    normalize(getPublicBookingProgramName(displayName) ?? displayName) === normalizedName)
  if (!program) return null
  const classes = program.classes.filter((classItem): classItem is PublicClassOffered & { formId: number } =>
    classItem.enrollVisible === true && classItem.formId != null)
  if (name === FIT_AND_FLIP_BOOKING_PROGRAM) {
    classes.sort((left, right) => (left.ageMin ?? Number.MAX_SAFE_INTEGER) - (right.ageMin ?? Number.MAX_SAFE_INTEGER))
  }
  return { ...program, classes }
}

/** Public booking labels only; retain catalog IDs, pricing, and portal names. */
export function getPublicBookingProgramName(name: string): string | null {
  return PUBLIC_BOOKING_PROGRAMS.find(program => program.aliases.some(alias => normalize(alias) === normalize(name)))?.name ?? null
}

export function getScopedDropInProgram(name: string | null) {
  if (isAdultBookingProgram(name)) return ADULT_BOOKING_PROGRAM
  const program = name ? getPublicBookingProgramName(name) : null
  return program === FIT_AND_FLIP_BOOKING_PROGRAM || program === DEVELOPMENTAL_GYMNASTICS_PROGRAM ? program : null
}

export function getPublicBookingDescription(programName: string, catalogDescription: string | null) {
  return programName === FIT_AND_FLIP_BOOKING_PROGRAM ? FIT_AND_FLIP_PUBLIC_COPY.intro : catalogDescription
}

export function matchesPublicBookingSearch(
  query: string, programName: string | null, fields: readonly (string | null | undefined)[],
) {
  if (!query) return true
  const programCopy = programName === FIT_AND_FLIP_BOOKING_PROGRAM ? fitAndFlipSearchCopy : ''
  return [...fields, programCopy].filter(Boolean).join(' ').toLowerCase().includes(query)
}

export function getPublicBookingPrograms<T extends { displayName: string; enrollmentSortOrder?: number | null }>(programs: readonly T[]): T[] {
  const publicPrograms = PUBLIC_BOOKING_PROGRAMS.flatMap(({ name }) => programs
    .filter(program => getPublicBookingProgramName(program.displayName) === name)
    .map(program => ({ ...program, displayName: name })))

  // A stable sort keeps the curated relative order for programs with no saved position.
  return publicPrograms.sort((left, right) =>
    (left.enrollmentSortOrder ?? Number.MAX_SAFE_INTEGER) -
    (right.enrollmentSortOrder ?? Number.MAX_SAFE_INTEGER))
}
