/** Browser-safe UUID for client-generated ids. */
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
