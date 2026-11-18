import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import {
  CONSENT_COOKIE_MAX_AGE,
  CONSENT_FRAGMENT_ANCHOR,
  CONSENT_ID_COOKIE_NAME,
  CONSENT_ID_QUERY_PARAM,
} from '../src/config/analyticsPolicy.js'
import { HUB_ORIGIN } from '../src/utils/seo.js'

const publicPaths = new Set(['/gymnastics', '/fit-and-flip', '/read-board', '/drop-in', '/contact', '/support'])
const legacyRedirects: Record<string, string> = JSON.parse(
  readFileSync(join(process.cwd(), 'src/config/publicLandingRedirects.json'), 'utf8'),
)

export default function legacyPublicConsent(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD')
    response.statusCode = 405
    response.end()
    return
  }

  const url = new URL(request.url ?? '/', HUB_ORIGIN)
  url.pathname = url.pathname.replace(/\/$/, '')
  const retiredGymnasticsHost = /^(?:www\.)?vortex-gymnastics\.com$/i.test(request.headers.host ?? '')
  const legacyPath = retiredGymnasticsHost ? url.pathname.replace(/\/index\.html$/, '') : url.pathname
  const legacyDestination = legacyRedirects[legacyPath]
  const destination = legacyDestination ? new URL(legacyDestination, HUB_ORIGIN) : url
  const consentIds = url.searchParams.getAll(CONSENT_ID_QUERY_PARAM)
  if (!publicPaths.has(destination.pathname) || !consentIds.length || url.searchParams.has('sport') ||
      (retiredGymnasticsHost && (!legacyDestination || !destination.hash))) {
    response.statusCode = 404
    response.end()
    return
  }

  const consentId = consentIds.length === 1 ? consentIds[0] : ''
  const validConsentId = /^c_[a-z0-9_-]{1,62}$/i.test(consentId)
  url.searchParams.delete(CONSENT_ID_QUERY_PARAM)

  // An explicit legacy section takes precedence. Otherwise the browser inherits its fragment.
  let location = destination.pathname + url.search + (legacyDestination ? destination.hash : '')
  if (retiredGymnasticsHost) {
    destination.search = url.search
    // The retired domain cannot set the destination's cookie. The page reads the fragment before mounting.
    if (validConsentId) {
      destination.hash = new URLSearchParams({
        [CONSENT_ID_QUERY_PARAM]: consentId,
        [CONSENT_FRAGMENT_ANCHOR]: destination.hash.slice(1),
      }).toString()
    }
    location = destination.href
  } else if (validConsentId) {
    const cookie = CONSENT_ID_COOKIE_NAME + '=' + consentId
    response.setHeader('Set-Cookie', cookie + '; Path=/; Max-Age=' + CONSENT_COOKIE_MAX_AGE + '; SameSite=Lax; Secure')
  }

  response.setHeader('Location', location)
  response.setHeader('Cache-Control', 'private, no-store')
  response.statusCode = 308
  response.end()
}
