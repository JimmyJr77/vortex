import { getApiUrl } from './api'
import {
  ANALYTICS_POLICY_VERSION,
  CONSENT_PARTIAL_REPROMPT_MS,
  CONSENT_STORAGE_KEY,
  defaultConsent,
  type ConsentChoices,
} from '../config/analyticsPolicy'
import {
  captureConsentIdFromUrl,
  ensureConsentId,
  fetchRemoteConsent,
  getConsentFromCookie,
  pickNewestConsent,
  pushRemoteConsent,
  setConsentCookie,
} from './crossDomainConsent'
import { getVisitorId } from './visitorId'
import { updateGoogleConsent } from './googleAnalytics'

let initPromise: Promise<ConsentChoices | null> | null = null

const getConsentFromLocalStorage = (): ConsentChoices | null => {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ConsentChoices
  } catch {
    return null
  }
}

export const persistConsentLocally = (choices: ConsentChoices): void => {
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(choices))
  setConsentCookie(choices)
}

export const getStoredConsent = (): ConsentChoices | null => {
  return pickNewestConsent(getConsentFromCookie(), getConsentFromLocalStorage())
}

export const saveConsent = async (
  choices: Pick<ConsentChoices, 'analytics' | 'marketing'> &
    Partial<Pick<ConsentChoices, 'policyVersion' | 'updatedAt'>>,
) => {
  const full: ConsentChoices = {
    necessary: true,
    analytics: choices.analytics,
    marketing: choices.marketing,
    policyVersion: choices.policyVersion || ANALYTICS_POLICY_VERSION,
    updatedAt: choices.updatedAt || new Date().toISOString(),
  }

  persistConsentLocally(full)
  updateGoogleConsent(full.analytics, full.marketing)

  const consentId = ensureConsentId()
  await pushRemoteConsent(consentId, full)

  const visitorId = getVisitorId(full.analytics)
  if (visitorId) {
    try {
      await fetch(`${getApiUrl()}/api/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          analytics: full.analytics,
          marketing: full.marketing,
          policyVersion: full.policyVersion,
        }),
      })
    } catch (e) {
      console.warn('[consent] server log failed', e)
    }
  }

  return full
}

export const hasConsentChoice = (): boolean => getStoredConsent() !== null

/** User accepted all optional cookies (analytics + marketing). */
export const hasFullCookieConsent = (choices: ConsentChoices): boolean =>
  choices.analytics && choices.marketing

/**
 * Show the cookie banner when no choice exists, or when the user previously chose
 * necessary-only / partial consent and a week has passed. Never re-prompt after accept-all.
 */
export const shouldShowCookieConsent = (): boolean => {
  const stored = getStoredConsent()
  if (!stored) return true
  if (hasFullCookieConsent(stored)) return false

  const updatedAt = new Date(stored.updatedAt).getTime()
  if (Number.isNaN(updatedAt)) return true

  return Date.now() - updatedAt >= CONSENT_PARTIAL_REPROMPT_MS
}

/**
 * Hydrate consent from first-party cookies, local storage, and the cross-domain API.
 * Safe to call multiple times; runs once per page load.
 */
export const initCrossDomainConsent = async (): Promise<ConsentChoices | null> => {
  if (typeof window === 'undefined') return null

  if (!initPromise) {
    initPromise = (async () => {
      captureConsentIdFromUrl()
      const consentId = ensureConsentId()

      const local = getStoredConsent()
      const remote = await fetchRemoteConsent(consentId)
      const merged = pickNewestConsent(local, remote)

      if (merged) {
        persistConsentLocally(merged)
        updateGoogleConsent(merged.analytics, merged.marketing)
      }

      return merged
    })()
  }

  return initPromise
}

export const getActiveConsent = (): ConsentChoices => {
  return getStoredConsent() ?? defaultConsent()
}
