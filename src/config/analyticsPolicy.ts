export const ANALYTICS_POLICY_VERSION = '2026-06-01'

export const CONSENT_STORAGE_KEY = 'vortex_consent'

/** First-party cookie mirroring consent on each Vortex domain. */
export const CONSENT_COOKIE_NAME = '_vortex_consent'

/** Correlates consent across unrelated Vortex domains (synced via API + link param). */
export const CONSENT_ID_COOKIE_NAME = '_vortex_cid'

export const CONSENT_ID_QUERY_PARAM = 'vcid'

export const CONSENT_COOKIE_MAX_AGE = 365 * 24 * 60 * 60

/** Re-prompt users who declined analytics/marketing at most once per week. */
export const CONSENT_PARTIAL_REPROMPT_MS = 7 * 24 * 60 * 60 * 1000

export type ConsentChoices = {
  necessary: true
  analytics: boolean
  marketing: boolean
  policyVersion: string
  updatedAt: string
}

export const defaultConsent = (): ConsentChoices => ({
  necessary: true,
  analytics: false,
  marketing: false,
  policyVersion: ANALYTICS_POLICY_VERSION,
  updatedAt: new Date().toISOString(),
})
