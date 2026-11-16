const PUBLIC_BOOKING_PROGRAMS = [
  { name: 'Developmental Gymnastics', aliases: ['Development Gymnastics', 'Developmental Gymnastics'] },
  { name: 'Vortex Gymnastics Team', aliases: ['Vortex Gymnastics Team'] },
  { name: 'Flip & Fun', aliases: ['Fit & Flip', 'Flip & Fun'] },
] as const

const normalize = (name: string) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

/** Public booking labels only; retain catalog IDs, pricing, and portal names. */
export function getPublicBookingProgramName(name: string): string | null {
  return PUBLIC_BOOKING_PROGRAMS.find(program => program.aliases.some(alias => normalize(alias) === normalize(name)))?.name ?? null
}

export function getPublicBookingPrograms<T extends { displayName: string }>(programs: readonly T[]): T[] {
  return PUBLIC_BOOKING_PROGRAMS.flatMap(({ name }) => programs
    .filter(program => getPublicBookingProgramName(program.displayName) === name)
    .map(program => ({ ...program, displayName: name })))
}
