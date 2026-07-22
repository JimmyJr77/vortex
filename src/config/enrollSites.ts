export const ENROLL_SITE_KEYS = ['athletics', 'gymnastics', 'basketball'] as const

export type EnrollSiteKey = (typeof ENROLL_SITE_KEYS)[number]

export const ALL_ENROLL_SITES: EnrollSiteKey[] = [...ENROLL_SITE_KEYS]

export const ENROLL_PATH = '/enroll'
