/** Matches backend DEFAULT_MASTER_EMAIL — permanent owner account. */
export const DEFAULT_MASTER_EMAIL = (
  import.meta.env.VITE_DEFAULT_MASTER_EMAIL || 'team.vortexathletics@gmail.com'
)
  .trim()
  .toLowerCase()

export function isDefaultMasterEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.trim().toLowerCase() === DEFAULT_MASTER_EMAIL)
}
