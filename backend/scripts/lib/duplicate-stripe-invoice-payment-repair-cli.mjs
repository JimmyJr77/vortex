import { createHash } from 'node:crypto'

export const APPLY_CONFIRMATION = 'REPAIR_DUPLICATE_STRIPE_INVOICE_PAYMENTS'
export const MAX_REPAIR_PAIRS = 25

const VALUE_OPTIONS = new Set([
  '--pairs',
  '--target',
  '--confirm',
  '--plan-hash',
  '--change-ticket',
  '--operator',
])
const FLAG_OPTIONS = new Set(['--apply', '--dry-run'])

function requiredValue(values, name) {
  const value = values.get(name)
  if (!value) throw new Error(`${name}=... is required.`)
  return value
}

export function parseRepairCliArgs(argv = []) {
  const values = new Map()
  const flags = new Set()
  for (const argument of argv) {
    if (FLAG_OPTIONS.has(argument)) {
      if (flags.has(argument)) throw new Error(`Duplicate option: ${argument}`)
      flags.add(argument)
      continue
    }
    const separator = argument.indexOf('=')
    const name = separator > 0 ? argument.slice(0, separator) : argument
    if (!VALUE_OPTIONS.has(name) || separator < 0) throw new Error(`Unknown option: ${argument}`)
    if (values.has(name)) throw new Error(`Duplicate option: ${name}`)
    const value = argument.slice(separator + 1).trim()
    if (!value) throw new Error(`${name} cannot be empty.`)
    values.set(name, value)
  }

  const apply = flags.has('--apply')
  if (apply && flags.has('--dry-run')) throw new Error('--apply and --dry-run are mutually exclusive.')
  const target = requiredValue(values, '--target')
  if (!['production', 'staging', 'local'].includes(target)) {
    throw new Error('--target must be production, staging, or local.')
  }
  const rawPairs = requiredValue(values, '--pairs').split(',')
  if (rawPairs.length > MAX_REPAIR_PAIRS) {
    throw new Error(`At most ${MAX_REPAIR_PAIRS} explicit payment pairs may be repaired at once.`)
  }
  const usedIds = new Set()
  const pairs = rawPairs.map((rawPair) => {
    if (!/^[1-9]\d*:[1-9]\d*$/.test(rawPair)) {
      throw new Error(`Invalid payment pair: ${rawPair}`)
    }
    const [invoiceText, duplicateText] = rawPair.split(':')
    const invoicePaymentId = Number(invoiceText)
    const duplicatePaymentId = Number(duplicateText)
    if (!Number.isSafeInteger(invoicePaymentId) || !Number.isSafeInteger(duplicatePaymentId)) {
      throw new Error(`Payment pair exceeds JavaScript's safe integer range: ${rawPair}`)
    }
    if (invoicePaymentId === duplicatePaymentId) throw new Error(`Payment pair reuses the same id: ${rawPair}`)
    for (const id of [invoicePaymentId, duplicatePaymentId]) {
      if (usedIds.has(id)) throw new Error(`Payment id ${id} appears in more than one repair position.`)
      usedIds.add(id)
    }
    return { invoicePaymentId, duplicatePaymentId }
  }).sort((left, right) => (
    left.invoicePaymentId - right.invoicePaymentId
      || left.duplicatePaymentId - right.duplicatePaymentId
  ))

  const parsed = {
    apply,
    target,
    pairs,
    confirmation: values.get('--confirm') ?? null,
    planHash: values.get('--plan-hash') ?? null,
    changeTicket: values.get('--change-ticket') ?? null,
    operator: values.get('--operator') ?? null,
  }
  if (apply) {
    if (parsed.confirmation !== APPLY_CONFIRMATION) {
      throw new Error(`--apply requires --confirm=${APPLY_CONFIRMATION}.`)
    }
    if (!/^[0-9a-f]{64}$/.test(String(parsed.planHash ?? ''))) {
      throw new Error('--apply requires the 64-character --plan-hash emitted by dry-run.')
    }
    if (!parsed.changeTicket) throw new Error('--apply requires --change-ticket=....')
    if (!parsed.operator) throw new Error('--apply requires --operator=....')
  }
  return parsed
}

export function resolveUnambiguousDatabaseUrl(environment = process.env) {
  const candidates = ['EXTERNAL_DB_URL', 'DATABASE_URL', 'DB_URL']
    .map((name) => ({ name, value: String(environment[name] ?? '').trim() }))
    .filter((entry) => entry.value)
  if (candidates.length === 0) throw new Error('EXTERNAL_DB_URL, DATABASE_URL, or DB_URL is required.')
  if (new Set(candidates.map((entry) => entry.value)).size !== 1) {
    throw new Error(`Database URL variables disagree: ${candidates.map((entry) => entry.name).join(', ')}.`)
  }
  return candidates[0].value
}

export function databaseTargetFingerprint(connectionString) {
  const url = new URL(connectionString)
  const identity = `${url.protocol}//${url.hostname}:${url.port || 'default'}/${url.pathname.replace(/^\//, '')}`
  return createHash('sha256').update(identity).digest('hex')
}

function stablePlanRows(result) {
  return (result.ready ?? []).map((row) => ({
    pair: row.pair,
    accountId: row.accountId,
    accountStripeCustomerId: row.accountStripeCustomerId,
    amountCents: row.amountCents,
    invoicePayment: {
      id: row.invoicePayment?.id,
      stripeCustomerId: row.invoicePayment?.stripeCustomerId,
      stripeInvoiceId: row.invoicePayment?.stripeInvoiceId,
      stripePaymentIntentId: row.invoicePayment?.stripePaymentIntentId,
      externalReference: row.invoicePayment?.externalReference,
      status: row.invoicePayment?.status,
    },
    duplicatePayment: {
      id: row.duplicatePayment?.id,
      stripeCustomerId: row.duplicatePayment?.stripeCustomerId,
      stripeInvoiceId: row.duplicatePayment?.stripeInvoiceId,
      stripePaymentIntentId: row.duplicatePayment?.stripePaymentIntentId,
      externalReference: row.duplicatePayment?.externalReference,
      status: row.duplicatePayment?.status,
    },
    reversals: row.reversals,
    remote: row.remote,
    state: row.state,
  })).sort((left, right) => left.pair.localeCompare(right.pair, 'en', { numeric: true }))
}

export function buildRepairPlanHash(result, {
  target,
  databaseFingerprint,
  stripeAccountId,
  stripeMode,
  codeVersion,
  sourceChecksum,
} = {}) {
  const plan = {
    version: 2,
    target,
    databaseFingerprint,
    stripeAccountId,
    stripeMode,
    codeVersion,
    sourceChecksum,
    repairs: stablePlanRows(result),
  }
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex')
}

export function sanitizeRepairReport(result) {
  const payment = (row) => row ? {
    id: row.id,
    accountId: row.accountId,
    amountCents: row.amountCents,
    status: row.status,
    stripeInvoiceId: row.stripeInvoiceId,
    stripePaymentIntentId: row.stripePaymentIntentId,
  } : null
  const sanitize = (row) => ({
    pair: row.pair,
    accountId: row.accountId,
    amountCents: row.amountCents,
    invoicePayment: payment(row.invoicePayment),
    duplicatePayment: payment(row.duplicatePayment),
    reversals: row.reversals,
    remote: row.remote ? {
      stripeInvoiceId: row.remote.stripeInvoiceId ?? null,
      stripePaymentIntentId: row.remote.stripePaymentIntentId ?? null,
      stripeCustomerId: row.remote.stripeCustomerId ?? null,
      amountCents: row.remote.amountCents ?? null,
      currency: row.remote.currency ?? null,
      method: row.remote.method ?? null,
    } : null,
    state: row.state,
  })
  const safeMessage = (value) => String(value ?? '')
    .replace(/sk_(?:live|test)_[A-Za-z0-9_-]+/g, '[redacted Stripe key]')
    .replace(/(?:postgres(?:ql)?):\/\/[^\s]+/gi, '[redacted database URL]')
    .slice(0, 500)
  const failures = (rows) => (rows ?? []).map((row) => ({
    pair: row.pair,
    ...(row.state ? { state: row.state } : {}),
    message: safeMessage(row.message),
  }))
  return {
    mode: result.mode,
    cohortStopped: result.cohortStopped,
    ready: (result.ready ?? []).map(sanitize),
    repaired: (result.repaired ?? []).map(sanitize),
    committed: (result.committed ?? []).map(sanitize),
    notApplied: (result.notApplied ?? []).map(sanitize),
    unknown: failures(result.unknown),
    failed: failures(result.failed),
  }
}
