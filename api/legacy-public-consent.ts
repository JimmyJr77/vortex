import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import {
  CONSENT_COOKIE_MAX_AGE,
  CONSENT_ID_COOKIE_NAME,
  CONSENT_ID_QUERY_PARAM,
} from '../src/config/analyticsPolicy.js'

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

  const url = new URL(request.url ?? '/', 'https://vortexathletics.com')
  const legacyDestination = legacyRedirects[url.pathname]
  const destination = legacyDestination ? new URL(legacyDestination, url) : url
  const consentIds = url.searchParams.getAll(CONSENT_ID_QUERY_PARAM)
  if (!publicPaths.has(destination.pathname) || !consentIds.length || url.searchParams.has('sport')) {
    response.statusCode = 404
    response.end()
    return
  }

  const consentId = consentIds.length === 1 ? consentIds[0] : ''
  url.searchParams.delete(CONSENT_ID_QUERY_PARAM)

  if (/^c_[a-z0-9_-]{1,62}$/i.test(consentId)) {
    const cookie = CONSENT_ID_COOKIE_NAME + '=' + consentId
    response.setHeader('Set-Cookie', cookie + '; Path=/; Max-Age=' + CONSENT_COOKIE_MAX_AGE + '; SameSite=Lax; Secure')
  }

  // An explicit legacy section takes precedence. Otherwise the browser inherits its fragment.
  response.setHeader('Location', destination.pathname + url.search + (legacyDestination ? destination.hash : ''))
  response.setHeader('Cache-Control', 'private, no-store')
  response.statusCode = 308
  response.end()
}
