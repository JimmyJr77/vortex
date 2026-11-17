export const publicPaths = new Set([
  '/', '/404', '/read-board', '/enroll', '/drop-in', '/contact', '/support',
  '/privacy-policy', '/terms-of-service', '/ninja',
  '/copy',
  '/camp_interest', '/camp_interest/thank-you',
  '/blog/athletic-development-young-athletes',
  '/blog/youth-sports-bowie',
  '/schedule', '/scheduling', '/store', '/store/success',
  '/signup/family', '/signup/invite', '/signup/lead',
  '/verify-email', '/registration/receipt', '/waivers-memberships',
  '/gymnastics', '/adult-gymnastics', '/vortex-athletics', '/fit-and-flip', '/summer-athletic-training',
  '/aerobic-gymnastics', '/acro-gymnastics', '/artistic-gymnastics', '/rhythmic-gymnastics',
  '/trampoline-tumbling', '/beginner-gymnastics', '/homeschool-gymnastics', '/summer-camp-26',
  '/artistic-gymnastics-early', '/artistic-gymnastics-6-12', '/artistic-gymnastics-13-18',
  '/campaigns/artistic-gymnastics-early', '/campaigns/artistic-gymnastics-6-12',
  '/campaigns/artistic-gymnastics-13-18',
])

export const actionNames = [
  'cta_click', 'button_click', 'link_click', 'outbound_click', 'phone_click', 'email_click',
  'directions_click', 'contact_click', 'legacy_login_click', 'program_page_view', 'program_interest',
  'schedule_view', 'select_item', 'media_engagement',
  'form_open', 'inquiry_form_start', 'inquiry_form_submit',
  'trial_start', 'trial_availability', 'trial_class_select', 'trial_registration_start',
  'trial_confirm_submit', 'trial_confirm_error',
  'drop_in_start', 'drop_in_checkout_start', 'sign_up_start', 'begin_checkout',
  'store_add_to_cart', 'store_checkout_start', 'class_signup_submitted',
]

export const conversionNames = [
  'generate_lead', 'trial_confirmed', 'drop_in_confirmed', 'newsletter_signup', 'sign_up',
  'enrollment_confirmed', 'store_purchase',
]

export const intentNames = actionNames.filter((name) =>
  !['program_page_view', 'trial_availability'].includes(name),
)

const eventNames = new Set([
  ...actionNames, ...conversionNames,
  'page_view', 'page_engagement', 'scroll_depth', 'web_vital', 'form_start',
  'registration_receipt_view', 'camp_inquiry_thank_you',
  'waiver_completed', 'family_member_added', 'billing_payment_return', 'checkout_cancelled', 'purchase',
])

const categories = new Set(['mobile', 'tablet', 'desktop'])
const metrics = new Map([['CLS', 10], ['LCP', 300000], ['INP', 300000], ['FCP', 300000], ['TTFB', 300000]])
const milestones = new Set([25, 50, 75, 90, 100])
const propertyLabels = [
  'section', 'program_slug', 'action', 'source', 'form', 'form_type', 'form_name',
  'inquiry_variant', 'lead_type', 'campaign_type', 'checkout_type', 'signup_mode', 'method',
]

export function sanitizeAnalyticsPath(input) {
  if (typeof input !== 'string' || !input.startsWith('/') || input.startsWith('//')) return null
  const path = input.split(/[?#]/, 1)[0].toLowerCase().replace(/\/+$/, '') || '/'
  if (publicPaths.has(path)) return path
  if (/^\/(admin|new-admin|member|coach|payroll)(?:\/|$)/.test(path)) return null
  // Raw URL segments can contain invite tokens or names. Use fixed route labels.
  for (const prefix of ['/registration/receipt', '/signup/family', '/signup/invite', '/signup/lead', '/verify-email']) {
    if (path.startsWith(prefix + '/')) return prefix
  }
  return '/other'
}

export function sanitizeHostname(input) {
  if (typeof input !== 'string') return null
  const hostname = input.trim().toLowerCase().replace(/^www\./, '')
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(hostname)
    ? hostname
    : null
}

export function sanitizeReferrer(input) {
  if (!input) return null
  try {
    const url = new URL(input)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    return null
  }
}

const analyticsId = /^(?:[vs]_[a-z0-9_-]{8,60}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

export function sanitizeAnalyticsId(value) {
  return typeof value === 'string' && analyticsId.test(value) ? value : null
}

function safeLabel(value, max = 100) {
  if (typeof value !== 'string') return null
  const label = value.trim()
  return label.length <= max && /^[a-z0-9][a-z0-9 _.-]*$/i.test(label) ? label : null
}

export function sanitizeCampaign(utm) {
  return {
    source: safeLabel(utm?.source),
    medium: safeLabel(utm?.medium),
    campaign: safeLabel(utm?.campaign),
    content: safeLabel(utm?.content),
    term: safeLabel(utm?.term),
  }
}

export function normalizeBrowserEvent(event) {
  if (!event.consentAnalytics || event.isStaff || !eventNames.has(event.eventName)) return null
  const visitorId = sanitizeAnalyticsId(event.visitorId)
  const sessionId = sanitizeAnalyticsId(event.sessionId)
  const pagePath = sanitizeAnalyticsPath(event.pagePath || '/')
  const hostname = sanitizeHostname(event.hostname)
  if (!visitorId || !sessionId || !pagePath || !hostname) return null

  const input = event.properties || {}
  const properties = {}
  const device = input.device_type || input.device_category
  const pageViewId = input.page_view_id
  if (typeof pageViewId === 'string' && uuid.test(pageViewId)) properties.page_view_id = pageViewId
  if (categories.has(device)) properties.device_type = device

  if (event.eventName === 'web_vital') {
    const name = input.name || input.metric
    if (!metrics.has(name) || !Number.isFinite(input.value) || input.value < 0 || input.value > metrics.get(name)) return null
    properties.name = name
    properties.value = input.value
  } else if (event.eventName === 'page_engagement') {
    if (!properties.page_view_id || !Number.isFinite(input.engaged_ms) || input.engaged_ms < 0) return null
    properties.engaged_ms = Math.min(Math.round(input.engaged_ms), 24 * 60 * 60 * 1000)
  } else if (event.eventName === 'scroll_depth') {
    if (!milestones.has(input.percent)) return null
    properties.percent = input.percent
  } else {
    for (const key of propertyLabels) {
      const label = safeLabel(input[key], 80)
      if (label) properties[key] = label
    }
    const target = event.eventName === 'outbound_click'
      ? sanitizeHostname(input.target)
      : safeLabel(input.target, 80)
    if (target) properties.target = target
    if (['available', 'empty', 'error'].includes(input.outcome)) properties.outcome = input.outcome
  }

  const utm = sanitizeCampaign(event.utm)
  return {
    event_id: event.eventId,
    event_name: event.eventName,
    occurred_at: event.occurredAt,
    visitor_id: visitorId,
    session_id: sessionId,
    page_path: pagePath,
    hostname,
    properties,
    consent_marketing: event.consentMarketing,
    referrer: sanitizeReferrer(event.referrer),
    utm_source: utm.source,
    utm_medium: utm.medium,
    utm_campaign: utm.campaign,
    device_type: properties.device_type || null,
  }
}
