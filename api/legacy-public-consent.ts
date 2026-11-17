import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  CONSENT_COOKIE_MAX_AGE,
  CONSENT_ID_COOKIE_NAME,
  CONSENT_ID_QUERY_PARAM,
} from '../src/config/analyticsPolicy.js'

const publicPaths = new Set(['/fit-and-flip', '/read-board', '/drop-in', '/contact', '/support'])

export default function legacyPublicConsent(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD')
    response.statusCode = 405
    response.end()
    return
  }

  const url = new URL(request.url ?? '/', 'https://vortexathletics.com')
  const consentIds = url.searchParams.getAll(CONSENT_ID_QUERY_PARAM)
  if (!publicPaths.has(url.pathname) || !consentIds.length || url.searchParams.has('sport')) {
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

  // A fragment-free Location lets the browser carry the original section anchor.
  response.setHeader('Location', url.pathname + url.search)
  response.setHeader('Cache-Control', 'private, no-store')
  response.statusCode = 308
  response.end()
}
