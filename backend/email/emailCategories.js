/**
 * Email classification model.
 *
 * Every outbound message must declare a category. Categories are grouped into two
 * streams: `transactional` and `marketing`. Transactional messages are strictly
 * functional (account, security, registration). Marketing messages are subscribed
 * promotional content and MUST carry one-click unsubscribe headers.
 *
 * This module is pure (no I/O) so it is cheap to unit test and safe to import anywhere.
 */

export const STREAM_TRANSACTIONAL = 'transactional'
export const STREAM_MARKETING = 'marketing'

/** category -> stream */
export const EMAIL_CATEGORIES = Object.freeze({
  // --- transactional ---
  parent_account_invitation: STREAM_TRANSACTIONAL,
  parent_email_verification: STREAM_TRANSACTIONAL,
  parent_account_created: STREAM_TRANSACTIONAL,
  account_welcome: STREAM_TRANSACTIONAL,
  family_member_added: STREAM_TRANSACTIONAL,
  password_reset: STREAM_TRANSACTIONAL,
  signin_magic_link: STREAM_TRANSACTIONAL,
  registration_confirmation: STREAM_TRANSACTIONAL,
  payment_receipt: STREAM_TRANSACTIONAL,
  payment_failed: STREAM_TRANSACTIONAL,
  schedule_change: STREAM_TRANSACTIONAL,
  waiver_request: STREAM_TRANSACTIONAL,
  security_notification: STREAM_TRANSACTIONAL,

  // --- marketing (no senders today; reserved + scaffolded) ---
  newsletter: STREAM_MARKETING,
  discount: STREAM_MARKETING,
  referral_offer: STREAM_MARKETING,
  reengagement_campaign: STREAM_MARKETING,
  promotional_announcement: STREAM_MARKETING,
})

export function isKnownCategory(category) {
  return Object.prototype.hasOwnProperty.call(EMAIL_CATEGORIES, category)
}

export function streamForCategory(category) {
  return EMAIL_CATEGORIES[category] || null
}

export function isTransactional(category) {
  return streamForCategory(category) === STREAM_TRANSACTIONAL
}

export function isMarketing(category) {
  return streamForCategory(category) === STREAM_MARKETING
}

/**
 * Categories that are account-security sensitive: click tracking should be disabled and
 * these must never be re-sent automatically after a complaint, nor blocked by a marketing
 * unsubscribe.
 */
export const SECURITY_CATEGORIES = Object.freeze(
  new Set([
    'parent_account_invitation',
    'parent_email_verification',
    'parent_account_created',
    'password_reset',
    'signin_magic_link',
    'security_notification',
  ]),
)

export function isSecurityCategory(category) {
  return SECURITY_CATEGORIES.has(category)
}

/**
 * Lightweight guardrail: detect obvious promotional content that must not appear in a
 * transactional message. This is a defensive check for developers, not a spam filter.
 * Returns an array of offending phrases (empty when clean).
 */
const PROMO_PATTERNS = [
  /\b\d{1,3}%\s*off\b/i,
  /\bdiscount\b/i,
  /\bpromo(?:tion|tional)?\b/i,
  /\bcoupon\b/i,
  /\brefer a friend\b/i,
  /\breferral (?:offer|bonus)\b/i,
  /\bsale\b/i,
  /\blimited[- ]time\b/i,
  /\bsubscribe to our newsletter\b/i,
  /\bfollow us on\b/i,
  /\bupgrade now\b/i,
  /\bspecial offer\b/i,
]

export function findPromotionalContent(...textBlocks) {
  const haystack = textBlocks.filter(Boolean).join('\n')
  const hits = []
  for (const re of PROMO_PATTERNS) {
    const m = haystack.match(re)
    if (m) hits.push(m[0])
  }
  return hits
}
