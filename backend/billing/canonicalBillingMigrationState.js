import crypto from 'node:crypto'

export const BILLING_MIGRATION_STATES = Object.freeze({
  DISCOVERED: 'discovered',
  REPAIRING: 'repairing',
  BLOCKED: 'blocked',
  SHADOW_VERIFIED: 'shadow_verified',
  ARMED: 'armed',
  CANCELLATION_SCHEDULED: 'cancellation_scheduled',
  DETACHED: 'detached',
  REMOTE_RETIRED: 'remote_retired',
  HOUSEHOLD_ACTIVE: 'household_active',
  VERIFIED: 'verified',
  ROLLBACK_PENDING: 'rollback_pending',
  ROLLED_BACK: 'rolled_back',
  FAILED_FORWARD_ONLY: 'failed_forward_only',
})

const S = BILLING_MIGRATION_STATES

export const BILLING_MIGRATION_TRANSITIONS = Object.freeze({
  [S.DISCOVERED]: new Set([S.REPAIRING, S.BLOCKED, S.SHADOW_VERIFIED, S.ROLLED_BACK]),
  [S.REPAIRING]: new Set([S.BLOCKED, S.SHADOW_VERIFIED]),
  [S.BLOCKED]: new Set([S.REPAIRING, S.SHADOW_VERIFIED]),
  // A shadow-only audit may be superseded if its immutable release contract
  // becomes stale before any collector or household action is armed.
  [S.SHADOW_VERIFIED]: new Set([S.ARMED, S.BLOCKED, S.ROLLED_BACK]),
  // Once an account is armed, later audit failures must preserve its cutover
  // state so an operator can explicitly roll it back. Moving it back to
  // `blocked` would hide a live remote cancellation behind a pre-cutover state.
  [S.ARMED]: new Set([S.CANCELLATION_SCHEDULED, S.ROLLBACK_PENDING, S.FAILED_FORWARD_ONLY]),
  [S.CANCELLATION_SCHEDULED]: new Set([
    S.DETACHED,
    S.ROLLBACK_PENDING,
    S.FAILED_FORWARD_ONLY,
  ]),
  // Detachment alone is reversible while every remote subscription remains
  // active and its scheduled cancellation can still be cleared.
  [S.DETACHED]: new Set([S.REMOTE_RETIRED, S.ROLLBACK_PENDING, S.FAILED_FORWARD_ONLY]),
  [S.REMOTE_RETIRED]: new Set([S.HOUSEHOLD_ACTIVE, S.FAILED_FORWARD_ONLY]),
  [S.HOUSEHOLD_ACTIVE]: new Set([S.VERIFIED, S.FAILED_FORWARD_ONLY]),
  [S.ROLLBACK_PENDING]: new Set([S.ROLLED_BACK, S.FAILED_FORWARD_ONLY]),
  [S.FAILED_FORWARD_ONLY]: new Set([
    S.DETACHED,
    S.REMOTE_RETIRED,
    S.HOUSEHOLD_ACTIVE,
    S.VERIFIED,
  ]),
  [S.VERIFIED]: new Set(),
  [S.ROLLED_BACK]: new Set(),
})

export const FORWARD_ONLY_STATES = new Set([
  S.REMOTE_RETIRED,
  S.HOUSEHOLD_ACTIVE,
  S.VERIFIED,
  S.FAILED_FORWARD_ONLY,
])

/**
 * Once an account reaches one of these durable states, its legacy class-level
 * Stripe collector must stay frozen. The global cutover feature flag controls
 * whether operators may advance a migration; it must not select collectors for
 * unrelated accounts.
 */
export const BILLING_COLLECTION_LOCK_STATES = Object.freeze([
  S.ARMED,
  S.CANCELLATION_SCHEDULED,
  S.DETACHED,
  S.REMOTE_RETIRED,
  S.HOUSEHOLD_ACTIVE,
  S.VERIFIED,
  S.ROLLBACK_PENDING,
  S.FAILED_FORWARD_ONLY,
])

const BILLING_COLLECTION_LOCK_STATE_SET = new Set(BILLING_COLLECTION_LOCK_STATES)

export function billingMigrationCollectionLocked(state) {
  return BILLING_COLLECTION_LOCK_STATE_SET.has(String(state ?? ''))
}

export const PRE_CANCEL_ROLLBACK_STATES = new Set([
  S.ARMED,
  S.CANCELLATION_SCHEDULED,
  S.DETACHED,
  S.ROLLBACK_PENDING,
])

export const BILLING_CUTOVER_MIN_PREPARE_SECONDS = 7 * 24 * 60 * 60
export const BILLING_CUTOVER_REVALIDATE_SECONDS = 24 * 60 * 60

export function billingCutoverTiming(boundaryUnix, now = new Date()) {
  const boundary = Number(boundaryUnix)
  const timestamp = now instanceof Date ? now.getTime() : new Date(now).getTime()
  if (!Number.isFinite(boundary) || boundary <= 0 || !Number.isFinite(timestamp)) {
    throw new Error('A valid billing boundary and current timestamp are required.')
  }
  const secondsUntilBoundary = Math.floor(boundary - timestamp / 1000)
  return {
    secondsUntilBoundary,
    boundaryReached: secondsUntilBoundary <= 0,
    canPrepare: secondsUntilBoundary >= BILLING_CUTOVER_MIN_PREPARE_SECONDS,
    inRevalidationWindow: secondsUntilBoundary > 0 &&
      secondsUntilBoundary <= BILLING_CUTOVER_REVALIDATE_SECONDS,
  }
}

export function canTransitionBillingMigration(fromState, toState) {
  return BILLING_MIGRATION_TRANSITIONS[fromState]?.has(toState) === true
}

export function assertBillingMigrationTransition(fromState, toState) {
  if (!canTransitionBillingMigration(fromState, toState)) {
    throw new Error(`Billing migration cannot transition from ${fromState} to ${toState}.`)
  }
}

export function normalizeBillingAccountIds(values) {
  const raw = Array.isArray(values) ? values : [values]
  const ids = [...new Set(raw.map(Number).filter((value) => Number.isSafeInteger(value) && value > 0))]
  if (ids.length === 0) {
    throw new Error('At least one explicit billing account ID is required.')
  }
  return ids.sort((a, b) => a - b)
}

export function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function datePartsInTimeZone(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('A valid timestamp is required.')
  if (!isValidTimeZone(timeZone)) throw new Error(`Invalid facility timezone: ${timeZone || '(missing)'}.`)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}

export function facilityDate(value, timeZone) {
  const { year, month, day } = datePartsInTimeZone(value, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function facilityMonth(value, timeZone) {
  return `${facilityDate(value, timeZone).slice(0, 7)}-01`
}

export function billingDateString(value) {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

export function nextBillingMonth(targetMonth) {
  const value = String(targetMonth ?? '')
  if (!/^\d{4}-\d{2}-01$/.test(value)) {
    throw new Error('Target month must be the first day of a month in YYYY-MM-01 format.')
  }
  const [year, month] = value.split('-').map(Number)
  if (month < 1 || month > 12) throw new Error(`Invalid target month: ${value}.`)
  const next = new Date(Date.UTC(year, month, 1))
  return next.toISOString().slice(0, 10)
}

export function validateBillingTargetMonth(targetMonth, {
  timeZone,
  now = new Date(),
  requireFuture = false,
} = {}) {
  const value = String(targetMonth ?? '')
  if (!/^\d{4}-\d{2}-01$/.test(value)) {
    throw new Error('Target month must be the first day of a month in YYYY-MM-01 format.')
  }
  const [year, month] = value.split('-').map(Number)
  if (year < 2000 || year > 9999 || month < 1 || month > 12) {
    throw new Error(`Invalid target month: ${value}.`)
  }
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`Invalid facility timezone: ${timeZone || '(missing)'}.`)
  }
  const currentMonth = facilityMonth(now, timeZone)
  if (requireFuture && value <= currentMonth) {
    throw new Error(`Target month ${value} must be after the current facility month ${currentMonth}.`)
  }
  return {
    targetMonth: value,
    currentMonth,
    facilityDate: facilityDate(now, timeZone),
    boundaryReached: facilityDate(now, timeZone) >= value,
    boundaryUnix: zonedDateStartUnix(value, timeZone),
  }
}

/** Unix seconds for local midnight on a YYYY-MM-DD date in an IANA timezone. */
export function zonedDateStartUnix(dateValue, timeZone) {
  const value = String(dateValue ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must use YYYY-MM-DD format.')
  if (!isValidTimeZone(timeZone)) throw new Error(`Invalid facility timezone: ${timeZone || '(missing)'}.`)
  const [year, month, day] = value.split('-').map(Number)
  const desiredUtc = Date.UTC(year, month - 1, day, 0, 0, 0)
  let candidate = desiredUtc
  // Two passes cover offset changes around DST boundaries without a timezone library.
  for (let index = 0; index < 2; index += 1) {
    const actual = datePartsInTimeZone(new Date(candidate), timeZone)
    const representedUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    )
    candidate += desiredUtc - representedUtc
  }
  if (facilityDate(new Date(candidate), timeZone) !== value) {
    throw new Error(`Could not resolve ${value} midnight in ${timeZone}.`)
  }
  return Math.floor(candidate / 1000)
}

const SECRET_KEY = /(?:secret|password|token|api[_-]?key|authorization|client[_-]?secret|cvc|cvv|card[_-]?number|account[_-]?number)/i

/** Recursively strips secret-bearing fields before a value can enter a JSONB snapshot. */
export function sanitizeBillingMigrationSnapshot(value, seen = new WeakSet()) {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => sanitizeBillingMigrationSnapshot(item, seen))
  if (typeof value !== 'object') return String(value)
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  const result = {}
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) {
      result[key] = '[REDACTED]'
      continue
    }
    result[key] = sanitizeBillingMigrationSnapshot(child, seen)
  }
  seen.delete(value)
  return result
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
}

export function billingMigrationSnapshotHash(value) {
  const safe = sanitizeBillingMigrationSnapshot(value)
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(safe))).digest('hex')
}
