/** firstName + first two letters of lastName, lowercase alphanumeric only (e.g. Jimmy O'Brien → jimmyob). */
export function buildSuggestedUsername(firstName: string, lastName: string): string {
  const cleanFirst = String(firstName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')
  const cleanLast = String(lastName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '').slice(0, 2)
  return cleanFirst + cleanLast
}

/** True when the username field is empty or still holds a first-name-only auto suggestion. */
export function shouldAutoFillUsername(currentUsername: string, firstName: string): boolean {
  const current = currentUsername.trim().toLowerCase()
  if (!current) return true
  return current === buildSuggestedUsername(firstName, '').toLowerCase()
}

export async function fetchSuggestedUsername(
  apiUrl: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  const local = buildSuggestedUsername(firstName, lastName)
  if (!local) return ''
  try {
    const res = await fetch(
      `${apiUrl}/api/signup/suggest-username?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`,
    )
    const data = await res.json()
    if (res.ok && data.data?.username) return data.data.username
  } catch {
    /* fall back to local suggestion */
  }
  return local
}

/** Suggest username when both names are present and the field is empty or stale. */
export async function maybeSuggestUsername(
  apiUrl: string,
  firstName: string,
  lastName: string,
  currentUsername: string,
): Promise<string | null> {
  if (!firstName.trim() || !lastName.trim()) return null
  if (!shouldAutoFillUsername(currentUsername, firstName)) return null
  const suggested = await fetchSuggestedUsername(apiUrl, firstName, lastName)
  return suggested || null
}
