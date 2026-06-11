import { HUB_URL, STUB_HOSTS } from '../config/stubSites'
import {
  CONSENT_COOKIE_MAX_AGE,
  CONSENT_COOKIE_NAME,
  CONSENT_ID_COOKIE_NAME,
  CONSENT_ID_QUERY_PARAM,
  type ConsentChoices,
} from '../config/analyticsPolicy'
import { getApiUrl } from './api'

const HUB_HOSTS = ['vortexathletics.com', 'www.vortexathletics.com']

const randomConsentId = () =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

const setCookie = (name: string, value: string, maxAge: number) => {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`
}

const normalizeHost = (hostname: string): string =>
  hostname.trim().toLowerCase().replace(/^www\./, '')

/** True for hub, gymnastics, sport stubs, and local dev hosts. */
export const isVortexConsentHost = (hostname: string): boolean => {
  const host = normalizeHost(hostname)
  if (host === 'localhost' || host === '127.0.0.1') return true
  if (HUB_HOSTS.some((h) => normalizeHost(h) === host)) return true
  return STUB_HOSTS.includes(host)
}

export const getConsentFromCookie = (): ConsentChoices | null => {
  try {
    const raw = getCookie(CONSENT_COOKIE_NAME)
    if (!raw) return null
    return JSON.parse(raw) as ConsentChoices
  } catch {
    return null
  }
}

export const setConsentCookie = (choices: ConsentChoices): void => {
  setCookie(CONSENT_COOKIE_NAME, JSON.stringify(choices), CONSENT_COOKIE_MAX_AGE)
}

export const getConsentId = (): string | null => getCookie(CONSENT_ID_COOKIE_NAME)

export const setConsentId = (consentId: string): void => {
  setCookie(CONSENT_ID_COOKIE_NAME, consentId, CONSENT_COOKIE_MAX_AGE)
}

/** Necessary first-party id used to sync consent across Vortex domains. */
export const ensureConsentId = (): string => {
  const existing = getConsentId()
  if (existing) return existing
  const id = randomConsentId()
  setConsentId(id)
  return id
}

/**
 * When navigating between Vortex domains, pass the consent id so the destination
 * can load the same preference from the API.
 */
export const appendCrossDomainConsentId = (url: string): string => {
  const consentId = getConsentId()
  if (!consentId) return url

  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined)
    if (!isVortexConsentHost(parsed.hostname)) return url
    parsed.searchParams.set(CONSENT_ID_QUERY_PARAM, consentId)
    return parsed.toString()
  } catch {
    return url
  }
}

export const getHubSiteUrl = (path = '/'): string => {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const base = HUB_URL.replace(/\/$/, '')
  return appendCrossDomainConsentId(`${base}${normalized}`)
}

/** Apply ?vcid= from inbound cross-domain navigation. */
export const captureConsentIdFromUrl = (): void => {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get(CONSENT_ID_QUERY_PARAM)
  if (!fromUrl) return

  setConsentId(fromUrl)
  params.delete(CONSENT_ID_QUERY_PARAM)
  const query = params.toString()
  const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
  window.history.replaceState({}, '', next)
}

export const pickNewestConsent = (
  a: ConsentChoices | null,
  b: ConsentChoices | null,
): ConsentChoices | null => {
  if (!a) return b
  if (!b) return a
  const aTime = new Date(a.updatedAt).getTime()
  const bTime = new Date(b.updatedAt).getTime()
  if (Number.isNaN(aTime)) return b
  if (Number.isNaN(bTime)) return a
  return aTime >= bTime ? a : b
}

export const fetchRemoteConsent = async (
  consentId: string,
): Promise<ConsentChoices | null> => {
  try {
    const res = await fetch(`${getApiUrl()}/api/consent/sync/${encodeURIComponent(consentId)}`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      success?: boolean
      consent?: ConsentChoices | null
    }
    if (!data.success || !data.consent) return null
    return data.consent
  } catch {
    return null
  }
}

export const pushRemoteConsent = async (
  consentId: string,
  choices: ConsentChoices,
): Promise<void> => {
  try {
    await fetch(`${getApiUrl()}/api/consent/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consentId,
        analytics: choices.analytics,
        marketing: choices.marketing,
        policyVersion: choices.policyVersion,
        updatedAt: choices.updatedAt,
      }),
    })
  } catch (e) {
    console.warn('[consent] cross-domain sync failed', e)
  }
}
