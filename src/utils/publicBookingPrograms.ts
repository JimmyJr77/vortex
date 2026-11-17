const PUBLIC_BOOKING_PROGRAMS = [
  { name: 'Developmental Gymnastics', aliases: ['Development Gymnastics', 'Developmental Gymnastics'] },
  { name: 'Vortex Gymnastics Team', aliases: ['Vortex Gymnastics Team'] },
  { name: 'Fit & Flip', aliases: ['Fit & Flip'] },
] as const

const normalize = (name: string) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

/** Public booking labels only; retain catalog IDs, pricing, and portal names. */
export function getPublicBookingProgramName(name: string): string | null {
  return PUBLIC_BOOKING_PROGRAMS.find(program => program.aliases.some(alias => normalize(alias) === normalize(name)))?.name ?? null
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
