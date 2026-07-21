/**
 * Centralized, env-driven sending policy: sender identity, cooldowns, caps, and limits.
 * Keeping these in one place avoids scattering magic numbers through the codebase.
 */

import { extractEmailAddress, isValidEmail } from './emailAddress.js'

const num = (val, fallback) => {
  const n = Number(val)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export const ROOT_DOMAIN = (process.env.VORTEX_ROOT_DOMAIN || 'vortexathletics.com').trim()
export const TRANSACTIONAL_SUBDOMAIN = (process.env.EMAIL_TRANSACTIONAL_SUBDOMAIN || 'notify').trim()
export const MARKETING_SUBDOMAIN = (process.env.EMAIL_MARKETING_SUBDOMAIN || 'news').trim()

export const BRAND_NAME = (process.env.EMAIL_BRAND_NAME || 'Vortex Athletics').trim()

/** Single monitored mailbox for every financial conversation and alert. */
export function billingMailbox() {
  const raw = (
    process.env.BILLING_REPLY_TO ||
    process.env.BILLING_ALERT_EMAIL ||
    `billing@${ROOT_DOMAIN}`
  ).trim()
  const addr = extractEmailAddress(raw)
  return isValidEmail(addr) ? addr : `billing@${ROOT_DOMAIN}`
}

/** Recommended transactional From (used once the notify.* subdomain is verified at the ESP). */
export function recommendedTransactionalFrom() {
  return `accounts@${TRANSACTIONAL_SUBDOMAIN}.${ROOT_DOMAIN}`
}

/**
 * Monitored Reply-To (front desk). Falls back to undefined so sendEmail can decide.
 * Validates before returning so we never set a malformed Reply-To.
 */
export function frontDeskReplyTo() {
  const raw = (process.env.EMAIL_REPLY_TO || process.env.SMTP_REPLY_TO || '').trim()
  if (!raw) return undefined
  const addr = extractEmailAddress(raw)
  return isValidEmail(addr) ? raw : undefined
}

export const POLICY = Object.freeze({
  // Cooldown between manual resends of the same (category, recipient).
  resendCooldownSec: num(process.env.EMAIL_RESEND_COOLDOWN_SEC, 120),
  // Maximum messages of a given category to one address per rolling 24h.
  dailyPerAddressMax: num(process.env.EMAIL_DAILY_PER_ADDRESS_MAX, 5),
  // Maximum automatic reminders for an unused invitation (plan recommends 1–2).
  maxAutomaticReminders: num(process.env.EMAIL_MAX_REMINDERS, 2),
  // Days between automatic reminders.
  reminderIntervalDays: num(process.env.EMAIL_REMINDER_INTERVAL_DAYS, 7),
  // Tenant-level burst guard: max sends per hour across all addresses.
  perTenantHourlyMax: num(process.env.EMAIL_PER_TENANT_HOURLY_MAX, 500),
  // Global kill switch: when 'true', suppress ALL sending (incident response).
  killSwitchAll: String(process.env.EMAIL_KILL_SWITCH || '').toLowerCase() === 'true',
})

/**
 * Per-category kill switch via env, e.g. EMAIL_KILL_SWITCH_PARENT_ACCOUNT_INVITATION=true
 */
export function categoryDisabled(category) {
  if (POLICY.killSwitchAll) return true
  const key = `EMAIL_KILL_SWITCH_${String(category || '').toUpperCase()}`
  return String(process.env[key] || '').toLowerCase() === 'true'
}
