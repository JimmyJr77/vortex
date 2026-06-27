/** Canonical production site URL for links in transactional email. */
export const PRODUCTION_APP_URL = 'https://www.vortexathletics.com'

function normalizeUrl(raw) {
  return String(raw || '').trim().replace(/\/$/, '')
}

function isLocalhostUrl(url) {
  return /localhost|127\.0\.0\.1/i.test(url)
}

/**
 * Site base URL embedded in transactional email links (invites, verification, receipts).
 * Always uses production unless PUBLIC_APP_URL is explicitly set to a non-localhost URL
 * (e.g. a staging frontend). FRONTEND_URL is ignored — it is for CORS, not email links.
 */
export function publicAppUrl() {
  const fromEnv = normalizeUrl(process.env.PUBLIC_APP_URL)
  if (fromEnv && !isLocalhostUrl(fromEnv)) {
    return fromEnv
  }
  if (fromEnv && isLocalhostUrl(fromEnv)) {
    console.warn(
      '[publicAppUrl] PUBLIC_APP_URL points at localhost; email links use',
      PRODUCTION_APP_URL,
    )
  }
  return PRODUCTION_APP_URL
}

/** Member Portal deep link — opens the Vortex Account login modal on the public site. */
export function memberPortalLoginUrl() {
  return `${publicAppUrl()}/?login=1`
}
