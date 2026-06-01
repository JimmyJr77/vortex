import { getApiUrl } from './api'
import {
  ANALYTICS_POLICY_VERSION,
  CONSENT_STORAGE_KEY,
  defaultConsent,
  type ConsentChoices,
} from '../config/analyticsPolicy'
import { getVisitorId } from './visitorId'
import { updateGoogleConsent } from './googleAnalytics'

export const getStoredConsent = (): ConsentChoices | null => {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ConsentChoices
  } catch {
    return null
  }
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
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(full))
  updateGoogleConsent(full.analytics, full.marketing)

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

export const getActiveConsent = (): ConsentChoices => {
  return getStoredConsent() ?? defaultConsent()
}
