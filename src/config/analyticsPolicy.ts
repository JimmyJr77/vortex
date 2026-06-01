export const ANALYTICS_POLICY_VERSION = '2026-06-01'

export const CONSENT_STORAGE_KEY = 'vortex_consent'

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
