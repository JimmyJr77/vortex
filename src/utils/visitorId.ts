const VISITOR_COOKIE = '_vortex_vid'
const SESSION_COOKIE = '_vortex_sid'
const COOKIE_MAX_AGE_VISITOR = 365 * 24 * 60 * 60
const COOKIE_MAX_AGE_SESSION = 30 * 60

const randomId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

const setCookie = (name: string, value: string, maxAge: number) => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`
}

/** First-party visitor id (only when analytics consent granted). */
export const getVisitorId = (allowCookie = true): string | null => {
  if (!allowCookie) return null
  let id = getCookie(VISITOR_COOKIE)
  if (!id) {
    id = randomId('v')
    setCookie(VISITOR_COOKIE, id, COOKIE_MAX_AGE_VISITOR)
  }
  return id
}

export const getSessionId = (allowCookie = true): string | null => {
  if (!allowCookie) return null
  let id = getCookie(SESSION_COOKIE)
  if (!id) {
    id = randomId('s')
    setCookie(SESSION_COOKIE, id, COOKIE_MAX_AGE_SESSION)
  }
  return id
}

export const refreshSessionCookie = (allowCookie = true) => {
  if (!allowCookie) return
  const id = getCookie(SESSION_COOKIE) || randomId('s')
  setCookie(SESSION_COOKIE, id, COOKIE_MAX_AGE_SESSION)
}

export const isStaffSession = (): boolean => {
  return (
    localStorage.getItem('vortex_admin') === 'true' ||
    Boolean(localStorage.getItem('vortex_member_token'))
  )
}
