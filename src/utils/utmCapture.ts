const UTM_SESSION_KEY = 'vortex_utm'

export type UtmParams = {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
  clickIds?: Record<string, string>
}

export const parseUtmFromSearch = (search: string): UtmParams => {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const utm: UtmParams = {}
  if (params.get('utm_source')) utm.source = params.get('utm_source')!
  if (params.get('utm_medium')) utm.medium = params.get('utm_medium')!
  if (params.get('utm_campaign')) utm.campaign = params.get('utm_campaign')!
  if (params.get('utm_content')) utm.content = params.get('utm_content')!
  if (params.get('utm_term')) utm.term = params.get('utm_term')!
  const clickIds: Record<string, string> = {}
  if (params.get('gclid')) clickIds.gclid = params.get('gclid')!
  if (params.get('fbclid')) clickIds.fbclid = params.get('fbclid')!
  if (Object.keys(clickIds).length) utm.clickIds = clickIds
  return utm
}

export const captureUtmFromLocation = () => {
  if (typeof window === 'undefined') return
  const incoming = parseUtmFromSearch(window.location.search)
  if (!incoming.source && !incoming.medium && !incoming.campaign && !incoming.clickIds) {
    return
  }
  try {
    const existing = sessionStorage.getItem(UTM_SESSION_KEY)
    const firstTouch = existing ? (JSON.parse(existing) as { first: UtmParams; last: UtmParams }) : null
    const payload = {
      first: firstTouch?.first && Object.keys(firstTouch.first).length ? firstTouch.first : incoming,
      last: incoming,
    }
    sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export const getStoredUtm = (): { first: UtmParams; last: UtmParams } => {
  try {
    const raw = sessionStorage.getItem(UTM_SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { first: {}, last: {} }
}

export const getAttributionPayload = () => {
  const { first, last } = getStoredUtm()
  return {
    utmSource: last.source ?? first.source,
    utmMedium: last.medium ?? first.medium,
    utmCampaign: last.campaign ?? first.campaign,
    utmContent: last.content ?? first.content,
    utmTerm: last.term ?? first.term,
    landingPage:
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : undefined,
    hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
  }
}
