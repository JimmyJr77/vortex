import {
  facilityDate,
  nextBillingMonth,
  sanitizeBillingMigrationSnapshot,
  zonedDateStartUnix,
} from './canonicalBillingMigrationState.js'

export class BillingMigrationSafetyError extends Error {
  constructor(code, message, details = {}, { forwardOnly = false } = {}) {
    super(message)
    this.name = 'BillingMigrationSafetyError'
    this.code = code
    this.details = sanitizeBillingMigrationSnapshot(details)
    this.forwardOnly = forwardOnly
  }
}

function objectId(value) {
  if (!value) return null
  return typeof value === 'string' ? value : value.id ?? null
}

function unix(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : null
}

function stripeMissing(error) {
  return error?.code === 'resource_missing' || /No such (?:subscription|invoice|customer)/i.test(String(error?.message ?? ''))
}

async function listStripePages(fetchPage, initialParams, {
  collectionName,
} = {}) {
  const rows = []
  const cursors = new Set()
  let startingAfter = null
  do {
    const page = await fetchPage({
      ...initialParams,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    const pageRows = page?.data ?? []
    rows.push(...pageRows)
    if (!page?.has_more) break
    const cursor = pageRows.at(-1)?.id ?? null
    if (!cursor || cursors.has(cursor)) {
      throw new BillingMigrationSafetyError(
        'stripe_pagination_incomplete',
        `Stripe did not provide a safe continuation cursor while listing ${collectionName ?? 'billing objects'}.`,
        { collectionName: collectionName ?? null, cursor },
      )
    }
    cursors.add(cursor)
    startingAfter = cursor
  } while (true)
  return rows
}

function periodsOverlap(start, end, boundaryUnix, nextBoundaryUnix) {
  const from = unix(start)
  const to = unix(end)
  return from != null && to != null && from < Number(nextBoundaryUnix) && to > Number(boundaryUnix)
}

function stripeInvoiceLineSubscriptionId(line) {
  return objectId(line?.subscription)
    ?? objectId(line?.parent?.subscription_item_details?.subscription)
    ?? null
}

function stripeInvoiceLineSubscriptionItemId(line) {
  return objectId(line?.subscription_item)
    ?? objectId(line?.parent?.subscription_item_details?.subscription_item)
    ?? null
}

function stripeInvoiceLinePriceId(line) {
  return objectId(line?.price)
    ?? objectId(line?.pricing?.price_details?.price)
    ?? null
}

async function listStripeInvoiceLines(stripe, invoice) {
  if (typeof stripe?.invoices?.listLineItems === 'function') {
    return listStripePages(
      (params) => stripe.invoices.listLineItems(String(invoice.id), params),
      { limit: 100 },
      { collectionName: `invoice ${invoice.id} lines` },
    )
  }
  const inline = invoice?.lines?.data ?? []
  if (invoice?.lines?.has_more) {
    throw new BillingMigrationSafetyError(
      'stripe_invoice_line_pagination_unavailable',
      `Stripe invoice ${invoice.id} has additional lines that cannot be enumerated safely.`,
      { invoiceId: invoice.id },
    )
  }
  return inline
}

export function snapshotStripeSubscription(subscription, { schedule = null } = {}) {
  if (!subscription) return null
  return sanitizeBillingMigrationSnapshot({
    id: subscription.id,
    status: subscription.status ?? null,
    customerId: objectId(subscription.customer),
    cancelAt: unix(subscription.cancel_at),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    canceledAt: unix(subscription.canceled_at),
    endedAt: unix(subscription.ended_at),
    currentPeriodStart: unix(subscription.current_period_start),
    currentPeriodEnd: unix(subscription.current_period_end),
    pauseCollection: subscription.pause_collection
      ? { behavior: subscription.pause_collection.behavior ?? null, resumesAt: unix(subscription.pause_collection.resumes_at) }
      : null,
    scheduleId: objectId(subscription.schedule) ?? schedule?.id ?? null,
    schedule: schedule ? {
      id: schedule.id,
      status: schedule.status ?? null,
      endBehavior: schedule.end_behavior ?? null,
      releasedAt: unix(schedule.released_at),
      canceledAt: unix(schedule.canceled_at),
      phases: (schedule.phases ?? []).map((phase) => ({
        startDate: unix(phase.start_date),
        endDate: unix(phase.end_date),
        itemPrices: (phase.items ?? []).map((item) => ({
          priceId: objectId(item.price),
          quantity: Number(item.quantity ?? 1),
          interval: item.price?.recurring?.interval ?? null,
          intervalCount: item.price?.recurring?.interval_count == null
            ? null
            : Number(item.price.recurring.interval_count),
        })),
      })),
    } : null,
    latestInvoice: subscription.latest_invoice && typeof subscription.latest_invoice === 'object' ? {
      id: subscription.latest_invoice.id,
      status: subscription.latest_invoice.status ?? null,
      amountDue: Number(subscription.latest_invoice.amount_due ?? 0),
      amountPaid: Number(subscription.latest_invoice.amount_paid ?? 0),
      created: unix(subscription.latest_invoice.created),
      periodStart: unix(subscription.latest_invoice.period_start),
      periodEnd: unix(subscription.latest_invoice.period_end),
    } : subscription.latest_invoice ? { id: subscription.latest_invoice } : null,
    items: (subscription.items?.data ?? []).map((item) => ({
      id: item.id,
      quantity: Number(item.quantity ?? 1),
      priceId: objectId(item.price),
      productId: objectId(item.price?.product),
      unitAmount: item.price?.unit_amount == null ? null : Number(item.price.unit_amount),
      currency: item.price?.currency ?? null,
      interval: item.price?.recurring?.interval ?? null,
      intervalCount: item.price?.recurring?.interval_count == null
        ? null
        : Number(item.price.recurring.interval_count),
    })),
  })
}

export async function retrieveStripeSubscriptionSnapshot(stripe, subscriptionId) {
  if (!stripe) throw new BillingMigrationSafetyError('stripe_unavailable', 'Stripe is required for legacy collection migration.')
  try {
    const subscription = await stripe.subscriptions.retrieve(String(subscriptionId), {
      expand: ['items.data.price.product', 'latest_invoice'],
    })
    let schedule = null
    const scheduleId = objectId(subscription.schedule)
    if (scheduleId && stripe.subscriptionSchedules?.retrieve) {
      try {
        schedule = await stripe.subscriptionSchedules.retrieve(scheduleId, {
          expand: ['phases.items.price'],
        })
      } catch (error) {
        if (!stripeMissing(error)) throw error
      }
    }
    return { subscription, schedule, snapshot: snapshotStripeSubscription(subscription, { schedule }) }
  } catch (error) {
    if (stripeMissing(error)) {
      throw new BillingMigrationSafetyError(
        'stripe_subscription_missing',
        `Stripe subscription ${subscriptionId} does not exist in the configured Stripe account.`,
        { subscriptionId },
      )
    }
    throw error
  }
}

export async function retrieveStripeCustomerReadiness(stripe, customerId) {
  if (!stripe) throw new BillingMigrationSafetyError('stripe_unavailable', 'Stripe is required for collection migration.')
  if (!customerId) {
    return { ready: false, reason: 'stripe_customer_missing', snapshot: { customerId: null, deleted: false, hasDefaultPaymentMethod: false } }
  }
  try {
    const customer = await stripe.customers.retrieve(String(customerId), {
      expand: ['invoice_settings.default_payment_method'],
    })
    if (customer.deleted) {
      return { ready: false, reason: 'stripe_customer_deleted', snapshot: { customerId, deleted: true, hasDefaultPaymentMethod: false } }
    }
    let methodId = objectId(customer.invoice_settings?.default_payment_method)
    if (!methodId && stripe.paymentMethods?.list) {
      const methods = await stripe.paymentMethods.list({ customer: String(customerId), type: 'card', limit: 1 })
      methodId = methods.data?.[0]?.id ?? null
    }
    return {
      ready: Boolean(methodId),
      reason: methodId ? null : 'payment_method_required',
      snapshot: {
        customerId: customer.id,
        deleted: false,
        hasDefaultPaymentMethod: Boolean(methodId),
        // Keep only the opaque ID. Never snapshot card, bank, or billing details.
        defaultPaymentMethodId: methodId,
      },
    }
  } catch (error) {
    if (stripeMissing(error)) {
      return { ready: false, reason: 'stripe_customer_missing', snapshot: { customerId, missing: true, hasDefaultPaymentMethod: false } }
    }
    throw error
  }
}

const LIVE_STRIPE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'paused',
  'past_due',
  'unpaid',
  'incomplete',
])

function localSubscriptionInventoryRow(row) {
  const id = Number(row?.id ?? row?.subscriptionId)
  const sourceType = row?.source_type ?? row?.sourceType ?? null
  const pricingOptionKey = row?.pricing_option_key ?? row?.pricingOptionKey ?? null
  return {
    id: Number.isSafeInteger(id) && id > 0 ? id : null,
    stripeSubscriptionId: row?.stripe_subscription_id ?? row?.stripeSubscriptionId ?? null,
    status: row?.status ?? null,
    annual: row?.isAnnualMembership === true ||
      sourceType === 'annual_membership' || pricingOptionKey === 'annual_membership',
  }
}

function metadataInteger(metadata, key) {
  if (metadata?.[key] == null || metadata[key] === '') return null
  const value = Number(metadata[key])
  return Number.isSafeInteger(value) && value > 0 ? value : NaN
}

function metadataTrue(metadata, key) {
  return String(metadata?.[key] ?? '').trim().toLowerCase() === 'true'
}

function subscriptionInventoryIssue(code, message, details = {}) {
  return { code, message, ...sanitizeBillingMigrationSnapshot(details) }
}

/**
 * Fully enumerate live Stripe subscriptions for one customer and prove every
 * non-annual collector has one exact durable local link. Annual exclusion is
 * based only on a local annual row, optionally reached through exact Vortex
 * metadata; names, descriptions, and Stripe product labels are never trusted.
 */
export async function inspectStripeCustomerSubscriptionInventory(stripe, {
  stripeCustomerId,
  accountId,
  localSubscriptions = [],
} = {}) {
  if (!stripeCustomerId) {
    return {
      verified: false,
      issues: [subscriptionInventoryIssue(
        'stripe_customer_missing',
        'The billing account has no Stripe customer for subscription inventory.',
      )],
      snapshot: { customerId: null, liveSubscriptionCount: 0, subscriptions: [] },
    }
  }
  if (!stripe?.subscriptions?.list) {
    throw new BillingMigrationSafetyError(
      'stripe_subscription_inventory_unavailable',
      'Stripe customer subscription listing is unavailable during migration audit.',
      { accountId, stripeCustomerId },
    )
  }

  const normalizedAccountId = Number(accountId)
  const locals = localSubscriptions
    .map(localSubscriptionInventoryRow)
    .filter((row) => row.id != null)
  const localsById = new Map(locals.map((row) => [row.id, row]))
  const localsByRemoteId = new Map()
  for (const local of locals) {
    if (!local.stripeSubscriptionId) continue
    const key = String(local.stripeSubscriptionId)
    const rows = localsByRemoteId.get(key) ?? []
    rows.push(local)
    localsByRemoteId.set(key, rows)
  }

  const remoteRows = await listStripePages(
    (params) => stripe.subscriptions.list(params),
    {
      customer: String(stripeCustomerId),
      status: 'all',
      limit: 100,
      expand: ['data.items.data.price.product'],
    },
    { collectionName: `customer ${stripeCustomerId} subscriptions` },
  )
  const liveRows = remoteRows.filter((row) => (
    LIVE_STRIPE_SUBSCRIPTION_STATUSES.has(String(row?.status ?? ''))
  ))
  const issues = []
  const subscriptions = []
  const claimedAnnualLocalIds = new Map()

  for (const remote of liveRows) {
    const remoteId = String(remote?.id ?? '')
    const metadata = remote?.metadata ?? {}
    const metadataLocalId = metadataInteger(metadata, 'billingSubscriptionId')
    const metadataAccountId = metadataInteger(metadata, 'familyBillingAccountId')
    const metadataLocal = Number.isSafeInteger(metadataLocalId)
      ? localsById.get(metadataLocalId) ?? null
      : null
    const directMappings = localsByRemoteId.get(remoteId) ?? []
    const directLocal = directMappings.length === 1 ? directMappings[0] : null
    const metadataMappingConflict = metadataLocalId != null && (
      !Number.isSafeInteger(metadataLocalId) ||
      !metadataLocal ||
      (directLocal && directLocal.id !== metadataLocal.id)
    )
    const accountMetadataConflict = metadataAccountId != null && (
      !Number.isSafeInteger(metadataAccountId) || metadataAccountId !== normalizedAccountId
    )
    const annualMetadata = metadataTrue(metadata, 'annualMembership')
    const perClassMetadata = metadataTrue(metadata, 'perClassSubscription')
    const localActive = (local) => ['active', 'paused'].includes(String(local?.status ?? ''))
    const candidateAnnualLocal = directLocal?.annual === true
      ? directLocal
      : annualMetadata && metadataLocal?.annual === true ? metadataLocal : null
    const annualStoredLinkConflict = candidateAnnualLocal?.stripeSubscriptionId != null &&
      String(candidateAnnualLocal.stripeSubscriptionId) !== remoteId
    const priorAnnualRemoteId = candidateAnnualLocal
      ? claimedAnnualLocalIds.get(candidateAnnualLocal.id) ?? null
      : null
    const annualMappingDuplicate = priorAnnualRemoteId != null && priorAnnualRemoteId !== remoteId
    const authoritativeAnnual = candidateAnnualLocal != null &&
      localActive(candidateAnnualLocal) &&
      !perClassMetadata &&
      !metadataMappingConflict &&
      !accountMetadataConflict &&
      !annualStoredLinkConflict &&
      !annualMappingDuplicate
    if (authoritativeAnnual) claimedAnnualLocalIds.set(candidateAnnualLocal.id, remoteId)
    const inventoryRow = {
      ...snapshotStripeSubscription(remote),
      classification: authoritativeAnnual ? 'annual_membership' : 'nonannual',
      localSubscriptionId: directLocal?.id ?? metadataLocal?.id ?? null,
      localLinkExact: directLocal != null,
      mappingSource: directLocal ? 'stripe_subscription_id' : metadataLocal ? 'metadata' : null,
      metadata: {
        billingSubscriptionId: Number.isSafeInteger(metadataLocalId) ? metadataLocalId : null,
        familyBillingAccountId: Number.isSafeInteger(metadataAccountId) ? metadataAccountId : null,
        annualMembership: annualMetadata,
        perClassSubscription: perClassMetadata,
      },
    }
    subscriptions.push(inventoryRow)

    if (String(objectId(remote.customer) ?? '') !== String(stripeCustomerId)) {
      issues.push(subscriptionInventoryIssue(
        'stripe_customer_subscription_customer_mismatch',
        `Stripe subscription ${remoteId} belongs to a different customer.`,
        { stripeSubscriptionId: remoteId, actualCustomerId: objectId(remote.customer), stripeCustomerId },
      ))
    }
    if (directMappings.length > 1) {
      issues.push(subscriptionInventoryIssue(
        'stripe_customer_subscription_local_mapping_duplicate',
        `Stripe subscription ${remoteId} is linked to more than one local subscription.`,
        { stripeSubscriptionId: remoteId, localSubscriptionIds: directMappings.map((row) => row.id) },
      ))
      continue
    }
    if (authoritativeAnnual) continue
    if (directLocal?.annual === true || annualMetadata) {
      issues.push(subscriptionInventoryIssue(
        'stripe_customer_annual_subscription_mapping_invalid',
        `Stripe subscription ${remoteId} claims annual-membership exclusion without an exact authoritative mapping.`,
        {
          stripeSubscriptionId: remoteId,
          localSubscriptionId: directLocal?.id ?? metadataLocal?.id ?? null,
          metadataMappingConflict,
          accountMetadataConflict,
          perClassMetadata,
          annualStoredLinkConflict,
          annualMappingDuplicate,
          priorAnnualRemoteId,
        },
      ))
      continue
    }
    if (!directLocal) {
      issues.push(subscriptionInventoryIssue(
        metadataLocal && metadataLocal.annual !== true
          ? 'stripe_customer_subscription_local_link_missing'
          : 'stripe_customer_subscription_unmapped',
        metadataLocal && metadataLocal.annual !== true
          ? `Stripe subscription ${remoteId} identifies local subscription ${metadataLocal.id} but is not durably linked to it.`
          : `Stripe subscription ${remoteId} has no exact local subscription mapping.`,
        { stripeSubscriptionId: remoteId, metadataLocalSubscriptionId: metadataLocal?.id ?? null },
      ))
      continue
    }
    if (!localActive(directLocal) || metadataMappingConflict || accountMetadataConflict) {
      issues.push(subscriptionInventoryIssue(
        'stripe_customer_subscription_mapping_invalid',
        `Stripe subscription ${remoteId} does not exactly match an active local class subscription.`,
        {
          stripeSubscriptionId: remoteId,
          localSubscriptionId: directLocal.id,
          localStatus: directLocal.status,
          metadataMappingConflict,
          accountMetadataConflict,
        },
      ))
    }
  }

  const orderedSubscriptions = [...subscriptions].sort((left, right) => (
    String(left.id).localeCompare(String(right.id))
  ))
  return {
    verified: issues.length === 0,
    issues,
    snapshot: sanitizeBillingMigrationSnapshot({
      customerId: String(stripeCustomerId),
      liveSubscriptionCount: orderedSubscriptions.length,
      mappedNonannualCount: orderedSubscriptions.filter((row) => (
        row.classification === 'nonannual' && row.localLinkExact
      )).length,
      annualMembershipCount: orderedSubscriptions.filter((row) => (
        row.classification === 'annual_membership'
      )).length,
      subscriptions: orderedSubscriptions,
    }),
  }
}

/** Prove that no active or future subscription schedule can recreate a charge. */
export async function inspectStripeCustomerSubscriptionScheduleInventory(stripe, {
  stripeCustomerId,
  accountId,
} = {}) {
  if (!stripeCustomerId) {
    return {
      verified: true,
      issues: [],
      snapshot: { customerId: null, liveScheduleCount: 0, schedules: [] },
    }
  }
  if (!stripe?.subscriptionSchedules?.list) {
    throw new BillingMigrationSafetyError(
      'stripe_subscription_schedule_inventory_unavailable',
      'Stripe subscription schedule listing is unavailable during forward adoption.',
      { accountId, stripeCustomerId },
    )
  }
  const rows = await listStripePages(
    (params) => stripe.subscriptionSchedules.list(params),
    { customer: String(stripeCustomerId), limit: 100 },
    { collectionName: `customer ${stripeCustomerId} subscription schedules` },
  )
  const schedules = rows
    .filter((row) => ['not_started', 'active'].includes(String(row?.status ?? '')))
    .map((row) => ({
      id: String(row.id),
      status: row.status ?? null,
      customerId: objectId(row.customer),
      subscriptionId: objectId(row.subscription),
      startDate: row.start_date == null ? null : Number(row.start_date),
      endBehavior: row.end_behavior ?? null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
  const issues = schedules.map((schedule) => subscriptionInventoryIssue(
    'stripe_customer_subscription_schedule_active',
    `Stripe subscription schedule ${schedule.id} is still ${schedule.status}.`,
    { accountId, stripeCustomerId, ...schedule },
  ))
  return {
    verified: issues.length === 0,
    issues,
    snapshot: sanitizeBillingMigrationSnapshot({
      customerId: String(stripeCustomerId),
      liveScheduleCount: schedules.length,
      schedules,
    }),
  }
}

export function validateRemoteSubscriptionForMigration({
  remoteSnapshot,
  expectedCustomerId,
  expectedItemId = null,
  boundaryUnix,
  allowExpectedCancellation = true,
  facilityTimezone = null,
} = {}) {
  const errors = []
  if (!remoteSnapshot) errors.push({ code: 'stripe_subscription_missing', message: 'Stripe subscription snapshot is missing.' })
  if (remoteSnapshot && !['active', 'trialing', 'paused'].includes(remoteSnapshot.status)) {
    errors.push({ code: 'stripe_subscription_not_collectible', message: `Stripe subscription is ${remoteSnapshot.status}.` })
  }
  if (remoteSnapshot?.customerId !== String(expectedCustomerId)) {
    errors.push({
      code: 'stripe_customer_mismatch',
      message: 'Stripe subscription belongs to a different customer.',
      expectedCustomerId,
      actualCustomerId: remoteSnapshot?.customerId ?? null,
    })
  }
  if (expectedItemId && !remoteSnapshot?.items?.some((item) => item.id === String(expectedItemId))) {
    errors.push({ code: 'stripe_item_mismatch', message: 'Stored Stripe subscription item was not found remotely.', expectedItemId })
  }
  if (facilityTimezone && Number.isFinite(Number(boundaryUnix))) {
    try {
      const boundaryDate = facilityDate(new Date(Number(boundaryUnix) * 1000), facilityTimezone)
      const facilityBoundaryUnix = zonedDateStartUnix(boundaryDate, facilityTimezone)
      if (!boundaryDate.endsWith('-01') || facilityBoundaryUnix !== Number(boundaryUnix)) {
        errors.push({
          code: 'billing_boundary_not_facility_month_start',
          message: 'The cutover boundary is not midnight on the first day of a month in the facility timezone.',
          boundaryUnix,
          boundaryDate,
          facilityTimezone,
        })
      }
      const periodDates = {}
      for (const [field, value] of [
        ['currentPeriodStart', remoteSnapshot?.currentPeriodStart],
        ['currentPeriodEnd', remoteSnapshot?.currentPeriodEnd],
      ]) {
        if (!value) {
          errors.push({
            code: 'stripe_period_missing',
            message: `Stripe ${field} is required to prove monthly billing alignment.`,
            field,
          })
          continue
        }
        const remoteDate = facilityDate(new Date(Number(value) * 1000), facilityTimezone)
        periodDates[field] = remoteDate
        if (!remoteDate.endsWith('-01') || zonedDateStartUnix(remoteDate, facilityTimezone) !== Number(value)) {
          errors.push({
            code: 'stripe_period_not_facility_month_aligned',
            message: `Stripe ${field} is not exactly local midnight on the first of a month in the facility timezone.`,
            field,
            unix: value,
            facilityDate: remoteDate,
            facilityTimezone,
          })
        }
      }
      if (
        periodDates.currentPeriodStart &&
        periodDates.currentPeriodEnd &&
        periodDates.currentPeriodStart.endsWith('-01') &&
        nextBillingMonth(periodDates.currentPeriodStart) !== periodDates.currentPeriodEnd
      ) {
        errors.push({
          code: 'stripe_period_not_single_month',
          message: 'Stripe current billing period is not exactly one calendar month.',
          currentPeriodStart: periodDates.currentPeriodStart,
          currentPeriodEnd: periodDates.currentPeriodEnd,
          facilityTimezone,
        })
      }

      const cadenceRows = [
        ...(remoteSnapshot?.items ?? []).map((item) => ({
          location: `subscription item ${item.id ?? '(unknown)'}`,
          interval: item.interval,
          intervalCount: item.intervalCount,
        })),
        ...(remoteSnapshot?.schedule?.phases ?? []).flatMap((phase, phaseIndex) => (
          (phase.itemPrices ?? []).map((item) => ({
            location: `schedule phase ${phaseIndex + 1} price ${item.priceId ?? '(unknown)'}`,
            interval: item.interval,
            intervalCount: item.intervalCount,
          }))
        )),
      ]
      if ((remoteSnapshot?.items ?? []).length === 0) {
        errors.push({
          code: 'stripe_subscription_item_missing',
          message: 'Stripe subscription has no price item to prove its monthly cadence.',
        })
      }
      for (const cadence of cadenceRows) {
        if (cadence.interval !== 'month' || Number(cadence.intervalCount) !== 1) {
          errors.push({
            code: 'stripe_subscription_not_calendar_monthly',
            message: `${cadence.location} is not configured for one-month recurring billing.`,
            ...cadence,
          })
        }
      }

      for (const [phaseIndex, phase] of (remoteSnapshot?.schedule?.phases ?? []).entries()) {
        for (const [field, value] of [
          ['startDate', phase.startDate],
          ['endDate', phase.endDate],
        ]) {
          if (!value) continue
          const phaseDate = facilityDate(new Date(Number(value) * 1000), facilityTimezone)
          if (!phaseDate.endsWith('-01') || zonedDateStartUnix(phaseDate, facilityTimezone) !== Number(value)) {
            errors.push({
              code: 'stripe_schedule_phase_not_facility_month_aligned',
              message: `Stripe schedule phase ${phaseIndex + 1} ${field} is not exactly a facility month boundary.`,
              phaseIndex,
              field,
              unix: value,
              facilityDate: phaseDate,
              facilityTimezone,
            })
          }
        }
      }
    } catch (error) {
      errors.push({
        code: 'facility_month_alignment_invalid',
        message: `Stripe billing alignment could not be validated: ${error.message}`,
        facilityTimezone,
      })
    }
  }
  if (remoteSnapshot?.cancelAt && (
    Number(remoteSnapshot.cancelAt) !== Number(boundaryUnix) || !allowExpectedCancellation
  )) {
    errors.push({
      code: Number(remoteSnapshot.cancelAt) === Number(boundaryUnix)
        ? 'preexisting_stripe_cancellation'
        : 'unexpected_stripe_cancellation',
      message: Number(remoteSnapshot.cancelAt) === Number(boundaryUnix)
        ? 'Stripe subscription already has a cancellation at the migration boundary.'
        : 'Stripe subscription already has a different cancellation date.',
      cancelAt: remoteSnapshot.cancelAt,
      expectedCancelAt: boundaryUnix,
    })
  }
  const latest = remoteSnapshot?.latestInvoice
  if (latest && ['open', 'draft', 'uncollectible'].includes(latest.status) && Number(latest.amountDue) > Number(latest.amountPaid)) {
    errors.push({
      code: 'legacy_invoice_unsettled',
      message: 'Stripe subscription has an unsettled invoice that requires review.',
      invoiceId: latest.id,
      status: latest.status,
      amountDue: latest.amountDue,
      amountPaid: latest.amountPaid,
    })
  }
  return errors
}

export async function scheduleStripeSubscriptionForCutover(stripe, {
  subscriptionId,
  boundaryUnix,
  idempotencyKey,
  expectedCustomerId = null,
  expectedItemId = null,
  facilityTimezone = null,
} = {}) {
  const before = await retrieveStripeSubscriptionSnapshot(stripe, subscriptionId)
  const errors = validateRemoteSubscriptionForMigration({
    remoteSnapshot: before.snapshot,
    expectedCustomerId: expectedCustomerId ?? before.snapshot.customerId,
    expectedItemId,
    boundaryUnix,
    allowExpectedCancellation: true,
    facilityTimezone,
  })
  if (errors.length > 0) {
    const validationError = errors[0]
    throw new BillingMigrationSafetyError(
      validationError.code,
      validationError.message,
      { ...validationError, validationErrors: errors },
    )
  }
  if (Number(before.snapshot.cancelAt) === Number(boundaryUnix)) {
    return { changed: false, before: before.snapshot, after: before.snapshot }
  }
  await stripe.subscriptions.update(
    String(subscriptionId),
    { cancel_at: Number(boundaryUnix), proration_behavior: 'none' },
    { idempotencyKey: String(idempotencyKey) },
  )
  const after = await retrieveStripeSubscriptionSnapshot(stripe, subscriptionId)
  if (Number(after.snapshot.cancelAt) !== Number(boundaryUnix)) {
    throw new BillingMigrationSafetyError(
      'stripe_cancellation_not_persisted',
      `Stripe did not retain the requested cancellation date for ${subscriptionId}.`,
      { subscriptionId, boundaryUnix, actualCancelAt: after.snapshot.cancelAt },
    )
  }
  return { changed: true, before: before.snapshot, after: after.snapshot }
}

export async function clearStripeSubscriptionCutover(stripe, {
  subscriptionId,
  boundaryUnix,
  idempotencyKey,
} = {}) {
  const before = await retrieveStripeSubscriptionSnapshot(stripe, subscriptionId)
  if (['canceled', 'incomplete_expired'].includes(before.snapshot.status)) {
    throw new BillingMigrationSafetyError(
      'stripe_subscription_already_retired',
      `Stripe subscription ${subscriptionId} can no longer be rolled back.`,
      { subscriptionId, status: before.snapshot.status },
      { forwardOnly: true },
    )
  }
  if (!before.snapshot.cancelAt) return { changed: false, before: before.snapshot, after: before.snapshot }
  if (Number(before.snapshot.cancelAt) !== Number(boundaryUnix)) {
    throw new BillingMigrationSafetyError(
      'unexpected_stripe_cancellation',
      'Rollback refused to clear a cancellation date it did not create.',
      { subscriptionId, cancelAt: before.snapshot.cancelAt, boundaryUnix },
    )
  }
  await stripe.subscriptions.update(
    String(subscriptionId),
    { cancel_at: '', cancel_at_period_end: false, proration_behavior: 'none' },
    { idempotencyKey: String(idempotencyKey) },
  )
  const after = await retrieveStripeSubscriptionSnapshot(stripe, subscriptionId)
  if (after.snapshot.cancelAt) {
    throw new BillingMigrationSafetyError(
      'stripe_cancellation_clear_failed',
      `Stripe cancellation remained set for ${subscriptionId}.`,
      { subscriptionId, cancelAt: after.snapshot.cancelAt },
    )
  }
  return { changed: true, before: before.snapshot, after: after.snapshot }
}

export async function retireStripeSubscription(stripe, {
  subscriptionId,
  idempotencyKey,
} = {}) {
  let before
  try {
    before = await retrieveStripeSubscriptionSnapshot(stripe, subscriptionId)
  } catch (error) {
    if (error instanceof BillingMigrationSafetyError && error.code === 'stripe_subscription_missing') {
      return { changed: false, missing: true, before: null, after: { id: subscriptionId, status: 'missing' } }
    }
    throw error
  }
  if (['canceled', 'incomplete_expired'].includes(before.snapshot.status)) {
    return { changed: false, before: before.snapshot, after: before.snapshot }
  }
  await stripe.subscriptions.cancel(
    String(subscriptionId),
    { invoice_now: false, prorate: false },
    { idempotencyKey: String(idempotencyKey) },
  )
  let after
  try {
    after = await retrieveStripeSubscriptionSnapshot(stripe, subscriptionId)
  } catch (error) {
    if (error instanceof BillingMigrationSafetyError && error.code === 'stripe_subscription_missing') {
      return { changed: true, before: before.snapshot, after: { id: subscriptionId, status: 'missing' } }
    }
    throw error
  }
  if (!['canceled', 'incomplete_expired'].includes(after.snapshot.status)) {
    throw new BillingMigrationSafetyError(
      'stripe_subscription_retirement_unconfirmed',
      `Stripe subscription ${subscriptionId} is still ${after.snapshot.status}.`,
      { subscriptionId, status: after.snapshot.status },
      { forwardOnly: true },
    )
  }
  return { changed: true, before: before.snapshot, after: after.snapshot }
}

export async function listTargetMonthLegacyInvoices(stripe, {
  subscriptionId,
  boundaryUnix,
  nextBoundaryUnix,
} = {}) {
  if (!stripe?.invoices?.list) return []
  const invoices = await listStripePages(
    (params) => stripe.invoices.list(params),
    {
      subscription: String(subscriptionId),
      limit: 100,
      expand: ['data.payment_intent'],
    },
    { collectionName: `subscription ${subscriptionId} invoices` },
  )
  const matches = []
  for (const invoice of invoices) {
    const lines = await listStripeInvoiceLines(stripe, invoice)
    const scopedLines = lines.filter((line) => {
      const lineSubscriptionId = stripeInvoiceLineSubscriptionId(line)
      return lineSubscriptionId == null || lineSubscriptionId === String(subscriptionId)
    })
    const invoiceSubscriptionId = objectId(invoice.subscription)
    const subscriptionMatches = invoiceSubscriptionId == null || invoiceSubscriptionId === String(subscriptionId)
    const invoicePeriodMatches = subscriptionMatches && periodsOverlap(
      invoice.period_start,
      invoice.period_end,
      boundaryUnix,
      nextBoundaryUnix,
    )
    const matchingLines = scopedLines.filter((line) => periodsOverlap(
      line.period?.start,
      line.period?.end,
      boundaryUnix,
      nextBoundaryUnix,
    ))
    if (!invoicePeriodMatches && matchingLines.length === 0) continue
    matches.push(sanitizeBillingMigrationSnapshot({
      id: invoice.id,
      status: invoice.status,
      subscriptionId: invoiceSubscriptionId ?? String(subscriptionId),
      created: unix(invoice.created),
      periodStart: unix(invoice.period_start),
      periodEnd: unix(invoice.period_end),
      lineCount: lines.length,
      nonZeroLineCount: lines.filter((line) => Number(line.amount ?? 0) !== 0).length,
      nonZeroLineIds: lines
        .filter((line) => Number(line.amount ?? 0) !== 0)
        .map((line) => line.id),
      matchingLineIds: matchingLines.map((line) => line.id),
      matchingLinePeriods: matchingLines.map((line) => ({
        id: line.id,
        subscriptionId: stripeInvoiceLineSubscriptionId(line),
        subscriptionItemId: stripeInvoiceLineSubscriptionItemId(line),
        periodStart: unix(line.period?.start),
        periodEnd: unix(line.period?.end),
        amountCents: Number(line.amount ?? 0),
        currency: String(line.currency ?? line.price?.currency ?? '').toLowerCase() || null,
        priceId: stripeInvoiceLinePriceId(line),
        quantity: line.quantity == null ? null : Number(line.quantity),
        proration: line.proration === true || line.parent?.subscription_item_details?.proration === true,
      })),
      amountDue: Number(invoice.amount_due ?? 0),
      amountPaid: Number(invoice.amount_paid ?? 0),
      amountRemaining: Number(invoice.amount_remaining ?? 0),
      amountOverpaid: Number(invoice.amount_overpaid ?? 0),
      startingBalance: Number(invoice.starting_balance ?? 0),
      endingBalance: Number(invoice.ending_balance ?? 0),
      prePaymentCreditNotesAmount: Number(invoice.pre_payment_credit_notes_amount ?? 0),
      postPaymentCreditNotesAmount: Number(invoice.post_payment_credit_notes_amount ?? 0),
      collectionMethod: invoice.collection_method ?? null,
      currency: String(invoice.currency ?? '').toLowerCase() || null,
      customerId: objectId(invoice.customer),
      paymentIntentId: objectId(invoice.payment_intent),
      paymentIntentStatus: typeof invoice.payment_intent === 'object'
        ? invoice.payment_intent.status ?? null
        : null,
      paymentIntentAmountReceived: typeof invoice.payment_intent === 'object'
        ? Number(invoice.payment_intent.amount_received ?? 0)
        : 0,
    }))
  }
  return matches
}

/**
 * Enumerate every Stripe invoice that could collect for an account's billing
 * month. This is intentionally a verification-only, fully paged scan: an
 * unlinked invoice must not disappear merely because the local database does
 * not know its id.
 */
export async function inspectStripeCustomerBillingMonthCollectors(stripe, {
  stripeCustomerId,
  billingMonth,
  facilityTimezone = 'UTC',
  expectedStripeInvoiceIds = [],
  excludedSubscriptionIds = [],
} = {}) {
  if (!stripeCustomerId) {
    return {
      verified: false,
      issues: [{
        code: 'stripe_customer_missing',
        message: 'The billing account has no Stripe customer for collector verification.',
      }],
      snapshot: {
        collectorCount: 0,
        householdInvoiceCount: 0,
        legacyCollectorCount: 0,
        ambiguousCollectorCount: 0,
        unexpectedStripeInvoiceCount: 0,
        invoices: [],
      },
    }
  }
  if (!stripe?.invoices?.list) {
    throw new BillingMigrationSafetyError(
      'stripe_invoice_inventory_unavailable',
      'Stripe invoice listing is unavailable during billing-cycle verification.',
      { billingMonth },
    )
  }
  const month = String(billingMonth ?? '').slice(0, 10)
  const nextMonth = nextBillingMonth(month)
  const boundaryUnix = zonedDateStartUnix(month, facilityTimezone)
  const nextBoundaryUnix = zonedDateStartUnix(nextMonth, facilityTimezone)
  const expected = new Set(expectedStripeInvoiceIds.filter(Boolean).map(String))
  const excludedSubscriptions = new Set(excludedSubscriptionIds.filter(Boolean).map(String))
  const invoices = await listStripePages(
    (params) => stripe.invoices.list(params),
    { customer: String(stripeCustomerId), limit: 100 },
    { collectionName: `customer ${stripeCustomerId} invoices` },
  )
  const candidates = []
  for (const invoice of invoices) {
    const lines = await listStripeInvoiceLines(stripe, invoice)
    const directSubscriptionId = objectId(invoice.subscription)
    const invoicePeriodMatches = periodsOverlap(
      invoice.period_start,
      invoice.period_end,
      boundaryUnix,
      nextBoundaryUnix,
    )
    const targetPeriodLines = lines.filter((line) => {
      const hasLinePeriod = unix(line.period?.start) != null && unix(line.period?.end) != null
      return hasLinePeriod
        ? periodsOverlap(line.period?.start, line.period?.end, boundaryUnix, nextBoundaryUnix)
        : invoicePeriodMatches
    })
    const directLegacyPeriod = directSubscriptionId
      && !excludedSubscriptions.has(String(directSubscriptionId))
      && invoicePeriodMatches
    const legacyLines = targetPeriodLines.filter((line) => {
      const subscriptionId = stripeInvoiceLineSubscriptionId(line)
      return subscriptionId
        && !excludedSubscriptions.has(String(subscriptionId))
    })
    const unscopedLines = targetPeriodLines.filter(
      (line) => stripeInvoiceLineSubscriptionId(line) == null,
    )
    const authoritativeTargetPeriodLines = targetPeriodLines.filter(
      (line) => stripeInvoiceLineSubscriptionId(line) != null,
    )
    const householdForMonth = String(invoice.metadata?.householdMonthlyInvoice ?? '') === 'true'
      && String(invoice.metadata?.billingMonth ?? '') === month.slice(0, 7)
    const explicitlyScopedToMonth = String(invoice.metadata?.billingMonth ?? '') === month.slice(0, 7)
    // A top-level-null invoice can still be owned authoritatively by its line
    // parents (the normal shape for some annual invoices). It is ambiguous only
    // when no target line has subscription ownership, or when even one target
    // line is unscoped alongside otherwise excluded annual lines.
    const ambiguousCollector = !householdForMonth && (
      unscopedLines.length > 0 ||
      (
        directSubscriptionId == null &&
        invoicePeriodMatches &&
        authoritativeTargetPeriodLines.length === 0
      )
    )
    if (
      !householdForMonth &&
      !explicitlyScopedToMonth &&
      !directLegacyPeriod &&
      legacyLines.length === 0 &&
      !ambiguousCollector
    ) continue
    const status = String(invoice.status ?? '')
    const collectable = !['void', 'deleted'].includes(status)
    const legacyCollector = Boolean(directLegacyPeriod || legacyLines.length > 0)
    candidates.push({
      id: String(invoice.id),
      status,
      collectable,
      householdForMonth,
      legacyCollector,
      ambiguousCollector,
      expected: expected.has(String(invoice.id)),
      subscriptionId: directSubscriptionId,
      legacyLineIds: legacyLines.map((line) => line.id),
      unscopedLineIds: unscopedLines.map((line) => line.id),
      targetPeriodLineIds: targetPeriodLines.map((line) => line.id),
      invoicePeriodMatches,
    })
  }
  const collectable = candidates.filter((invoice) => invoice.collectable)
  const householdInvoices = collectable.filter((invoice) => invoice.householdForMonth)
  const legacyCollectors = collectable.filter((invoice) => invoice.legacyCollector)
  const ambiguousCollectors = collectable.filter((invoice) => invoice.ambiguousCollector)
  const unexpected = collectable.filter((invoice) => !invoice.expected)
  const issues = []
  if (legacyCollectors.length > 0) {
    issues.push(householdInvoiceIssue(
      'legacy_target_month_collector_present',
      'A non-annual Stripe subscription invoice can collect during the verified household billing month.',
      { stripeInvoiceIds: legacyCollectors.map((invoice) => invoice.id) },
    ))
  }
  if (ambiguousCollectors.length > 0) {
    issues.push(householdInvoiceIssue(
      'ambiguous_target_month_stripe_invoice',
      'A collectable Stripe invoice has unscoped target-month lines and must be reviewed before household collection.',
      { stripeInvoiceIds: ambiguousCollectors.map((invoice) => invoice.id) },
    ))
  }
  if (collectable.length > 1) {
    issues.push(householdInvoiceIssue(
      'duplicate_target_month_collectors',
      'More than one Stripe invoice can collect for the verified billing month.',
      { stripeInvoiceIds: collectable.map((invoice) => invoice.id) },
    ))
  }
  if (unexpected.length > 0) {
    issues.push(householdInvoiceIssue(
      'unexpected_target_month_stripe_invoice',
      'Stripe contains a target-month invoice that is not linked to the canonical household invoice.',
      { stripeInvoiceIds: unexpected.map((invoice) => invoice.id) },
    ))
  }
  const missingExpected = [...expected].filter((id) => !candidates.some((invoice) => invoice.id === id))
  if (missingExpected.length > 0) {
    issues.push(householdInvoiceIssue(
      'expected_target_month_stripe_invoice_missing_from_inventory',
      'A locally linked household invoice was absent from the complete Stripe customer inventory.',
      { stripeInvoiceIds: missingExpected },
    ))
  }
  return {
    verified: issues.length === 0,
    issues,
    snapshot: sanitizeBillingMigrationSnapshot({
      collectorCount: collectable.length,
      householdInvoiceCount: householdInvoices.length,
      legacyCollectorCount: legacyCollectors.length,
      ambiguousCollectorCount: ambiguousCollectors.length,
      unexpectedStripeInvoiceCount: unexpected.length,
      invoices: candidates,
    }),
  }
}

function invoiceItemId(item) {
  return objectId(item?.parent?.invoice_item_details?.invoice_item)
    ?? objectId(item?.invoice_item)
    ?? item?.id
    ?? null
}

async function listHouseholdInvoiceItems(stripe, remote) {
  if (typeof stripe?.invoiceItems?.list === 'function') {
    return listStripePages(
      (params) => stripe.invoiceItems.list(params),
      { invoice: String(remote.id), limit: 100 },
      { collectionName: `invoice ${remote.id} items` },
    )
  }
  return listStripeInvoiceLines(stripe, remote)
}

function householdInvoiceIssue(code, message, details = {}) {
  return { code, message, ...sanitizeBillingMigrationSnapshot(details) }
}

/**
 * Fail-closed structural verification for the single remote household invoice.
 * Payment refusal/nonpayment is intentionally not an issue when the remote
 * invoice remains open or becomes uncollectible; identity, totals and lines
 * still must match exactly.
 */
export async function inspectStripeHouseholdInvoice(stripe, {
  accountId,
  stripeCustomerId,
  billingMonth,
  invoice,
  lines = [],
} = {}) {
  const issues = []
  const stripeInvoiceId = invoice?.stripeInvoiceId ?? null
  if (!stripeInvoiceId) {
    if (Number(invoice?.totalCents ?? 0) > 0) {
      issues.push(householdInvoiceIssue(
        'remote_household_invoice_missing',
        `Monthly invoice ${invoice?.id} has a positive total but no linked Stripe invoice.`,
        { invoiceId: Number(invoice?.id), totalCents: Number(invoice?.totalCents ?? 0) },
      ))
    }
    return { verified: issues.length === 0, issues, snapshot: { stripeInvoiceId: null, itemCount: 0 } }
  }
  if (!stripe?.invoices?.retrieve) {
    throw new BillingMigrationSafetyError(
      'stripe_invoice_verification_unavailable',
      'Stripe invoice retrieval is unavailable during canonical billing verification.',
      { stripeInvoiceId },
    )
  }

  let remote
  try {
    remote = await stripe.invoices.retrieve(String(stripeInvoiceId), {
      expand: ['payment_intent'],
    })
  } catch (error) {
    if (!stripeMissing(error)) throw error
    issues.push(householdInvoiceIssue(
      'remote_household_invoice_missing',
      `Linked Stripe invoice ${stripeInvoiceId} does not exist.`,
      { invoiceId: Number(invoice.id), stripeInvoiceId },
    ))
    return { verified: false, issues, snapshot: { stripeInvoiceId, missing: true, itemCount: 0 } }
  }
  const items = await listHouseholdInvoiceItems(stripe, remote)
  const expectedMonth = String(billingMonth ?? '').slice(0, 7)
  const metadata = remote.metadata ?? {}
  const remoteCustomerId = objectId(remote.customer)
  if (String(remoteCustomerId ?? '') !== String(stripeCustomerId ?? '')) {
    issues.push(householdInvoiceIssue(
      'remote_household_invoice_customer_mismatch',
      `Stripe invoice ${remote.id} belongs to a different customer.`,
      { stripeInvoiceId: remote.id, expectedCustomerId: stripeCustomerId, actualCustomerId: remoteCustomerId },
    ))
  }
  for (const [key, expected] of [
    ['familyBillingAccountId', String(accountId)],
    ['monthlyInvoiceId', String(invoice.id)],
    ['billingMonth', expectedMonth],
  ]) {
    if (String(metadata[key] ?? '') !== expected) {
      issues.push(householdInvoiceIssue(
        'remote_household_invoice_metadata_mismatch',
        `Stripe invoice ${remote.id} has invalid ${key} metadata.`,
        { stripeInvoiceId: remote.id, key, expected, actual: metadata[key] ?? null },
      ))
    }
  }
  if (String(metadata.householdMonthlyInvoice ?? '') !== 'true') {
    issues.push(householdInvoiceIssue(
      'remote_household_invoice_metadata_mismatch',
      `Stripe invoice ${remote.id} is not marked as a household monthly invoice.`,
      { stripeInvoiceId: remote.id, key: 'householdMonthlyInvoice', expected: 'true', actual: metadata.householdMonthlyInvoice ?? null },
    ))
  }

  const acceptedStatuses = new Set(['open', 'paid', 'uncollectible'])
  if (!acceptedStatuses.has(remote.status)) {
    issues.push(householdInvoiceIssue(
      'remote_household_invoice_status_invalid',
      `Stripe invoice ${remote.id} is ${remote.status}; it has not reached an accepted collection state.`,
      { stripeInvoiceId: remote.id, status: remote.status },
    ))
  }
  const localTotal = Number(invoice.totalCents ?? 0)
  for (const [field, expected] of [
    // Stripe's subtotal is the signed sum of invoice items. Canonical charge
    // credits are represented as negative immutable items, so both Stripe's
    // subtotal and total must equal the local net collectible amount.
    ['subtotal', localTotal],
    ['total', localTotal],
    ['amount_due', localTotal],
  ]) {
    if (Number(remote[field] ?? 0) !== expected) {
      issues.push(householdInvoiceIssue(
        'remote_household_invoice_amount_mismatch',
        `Stripe invoice ${remote.id} ${field} does not match the local monthly invoice.`,
        { stripeInvoiceId: remote.id, field, expectedCents: expected, actualCents: Number(remote[field] ?? 0) },
      ))
    }
  }
  const remotePaid = Number(remote.amount_paid ?? 0)
  const remoteRemaining = Number(remote.amount_remaining ?? 0)
  if (remote.status === 'paid') {
    if (remotePaid !== localTotal || remoteRemaining !== 0 || invoice.status !== 'paid') {
      issues.push(householdInvoiceIssue(
        'remote_household_invoice_paid_state_mismatch',
        `Paid Stripe invoice ${remote.id} is inconsistent with local payment state.`,
        {
          stripeInvoiceId: remote.id,
          localStatus: invoice.status,
          remotePaid: true,
          amountPaidCents: remotePaid,
          amountRemainingCents: remoteRemaining,
          expectedTotalCents: localTotal,
        },
      ))
    }
  } else {
    if (invoice.status === 'paid') {
      issues.push(householdInvoiceIssue(
        'remote_household_invoice_paid_state_mismatch',
        `Local monthly invoice ${invoice.id} is paid but Stripe invoice ${remote.id} is ${remote.status}.`,
        { stripeInvoiceId: remote.id, localStatus: invoice.status, remoteStatus: remote.status },
      ))
    }
    if (remote.status === 'open' && remotePaid + remoteRemaining !== localTotal) {
      issues.push(householdInvoiceIssue(
        'remote_household_invoice_balance_mismatch',
        `Open Stripe invoice ${remote.id} has an inconsistent paid/remaining balance.`,
        { stripeInvoiceId: remote.id, amountPaidCents: remotePaid, amountRemainingCents: remoteRemaining, expectedTotalCents: localTotal },
      ))
    }
  }

  const expectedLines = new Map(lines.map((line) => [String(line.id), line]))
  const seenLineIds = new Set()
  for (const item of items) {
    const itemMetadata = item.metadata ?? {}
    const lineId = String(itemMetadata.monthlyInvoiceLineId ?? '')
    const expected = expectedLines.get(lineId)
    if (
      String(itemMetadata.monthlyInvoiceId ?? '') !== String(invoice.id)
      || !expected
    ) {
      issues.push(householdInvoiceIssue(
        'remote_household_invoice_extra_item',
        `Stripe invoice ${remote.id} contains an item that does not map to a local monthly invoice line.`,
        { stripeInvoiceId: remote.id, stripeInvoiceItemId: invoiceItemId(item), monthlyInvoiceLineId: lineId || null },
      ))
      continue
    }
    if (seenLineIds.has(lineId)) {
      issues.push(householdInvoiceIssue(
        'remote_household_invoice_duplicate_item',
        `Stripe invoice ${remote.id} contains multiple items for local line ${lineId}.`,
        { stripeInvoiceId: remote.id, monthlyInvoiceLineId: lineId },
      ))
      continue
    }
    seenLineIds.add(lineId)
    if (Number(item.amount ?? 0) !== Number(expected.amountCents ?? 0)) {
      issues.push(householdInvoiceIssue(
        'remote_household_invoice_item_amount_mismatch',
        `Stripe invoice item for local line ${lineId} has the wrong amount.`,
        { stripeInvoiceId: remote.id, monthlyInvoiceLineId: lineId, expectedCents: Number(expected.amountCents ?? 0), actualCents: Number(item.amount ?? 0) },
      ))
    }
    if (String(itemMetadata.billingChargeId ?? '') !== String(expected.billingChargeId ?? '')) {
      issues.push(householdInvoiceIssue(
        'remote_household_invoice_item_charge_mismatch',
        `Stripe invoice item for local line ${lineId} references the wrong billing charge.`,
        { stripeInvoiceId: remote.id, monthlyInvoiceLineId: lineId, expectedBillingChargeId: expected.billingChargeId ?? null, actualBillingChargeId: itemMetadata.billingChargeId ?? null },
      ))
    }
    const remoteItemId = invoiceItemId(item)
    if (expected.stripeInvoiceItemId && String(expected.stripeInvoiceItemId) !== String(remoteItemId ?? '')) {
      issues.push(householdInvoiceIssue(
        'remote_household_invoice_item_link_mismatch',
        `Local line ${lineId} is linked to a different Stripe invoice item.`,
        { stripeInvoiceId: remote.id, monthlyInvoiceLineId: lineId, expectedStripeInvoiceItemId: expected.stripeInvoiceItemId, actualStripeInvoiceItemId: remoteItemId },
      ))
    }
  }
  for (const line of lines) {
    if (!seenLineIds.has(String(line.id))) {
      issues.push(householdInvoiceIssue(
        'remote_household_invoice_item_missing',
        `Stripe invoice ${remote.id} is missing local monthly invoice line ${line.id}.`,
        { stripeInvoiceId: remote.id, monthlyInvoiceLineId: String(line.id) },
      ))
    }
  }

  return {
    verified: issues.length === 0,
    issues,
    snapshot: sanitizeBillingMigrationSnapshot({
      stripeInvoiceId: remote.id,
      customerId: remoteCustomerId,
      status: remote.status,
      paid: remote.paid === true,
      subtotalCents: Number(remote.subtotal ?? 0),
      totalCents: Number(remote.total ?? 0),
      amountDueCents: Number(remote.amount_due ?? 0),
      amountPaidCents: remotePaid,
      amountRemainingCents: remoteRemaining,
      metadata: {
        householdMonthlyInvoice: metadata.householdMonthlyInvoice ?? null,
        monthlyInvoiceId: metadata.monthlyInvoiceId ?? null,
        familyBillingAccountId: metadata.familyBillingAccountId ?? null,
        billingMonth: metadata.billingMonth ?? null,
      },
      itemCount: items.length,
      items: items.map((item) => ({
        id: invoiceItemId(item),
        amountCents: Number(item.amount ?? 0),
        monthlyInvoiceId: item.metadata?.monthlyInvoiceId ?? null,
        monthlyInvoiceLineId: item.metadata?.monthlyInvoiceLineId ?? null,
        billingChargeId: item.metadata?.billingChargeId ?? null,
      })),
    }),
  }
}

export function validateTargetMonthLegacyInvoices(invoices) {
  const blocking = []
  for (const invoice of invoices ?? []) {
    const amountPaid = Number(invoice.amountPaid ?? 0)
    const amountRemaining = Number(invoice.amountRemaining ?? 0)
    if (invoice.status === 'paid' && amountPaid > 0 && amountRemaining === 0) {
      blocking.push({
        code: 'target_month_legacy_invoice_paid',
        message: `Legacy Stripe invoice ${invoice.id} already collected target-month tuition.`,
        disposition: 'defer_next_month',
        invoice,
      })
    } else if (amountPaid > 0 || invoice.status === 'paid') {
      blocking.push({
        code: 'target_month_legacy_invoice_partially_paid',
        message: `Legacy Stripe invoice ${invoice.id} has a partial or inconsistent payment and requires review.`,
        disposition: 'manual_review_required',
        invoice,
      })
    } else if (['processing', 'requires_capture'].includes(invoice.paymentIntentStatus)) {
      blocking.push({
        code: 'target_month_legacy_invoice_processing',
        message: `Legacy Stripe invoice ${invoice.id} is still processing target-month tuition.`,
        disposition: 'defer_next_month',
        invoice,
      })
    } else if (!['void', 'deleted'].includes(invoice.status)) {
      blocking.push({
        code: 'target_month_legacy_invoice_open',
        message: `Legacy Stripe invoice ${invoice.id} must be voided before household collection.`,
        disposition: 'review_and_void',
        invoice,
      })
    }
  }
  const hasDeferredCollection = blocking.some((problem) => problem.disposition === 'defer_next_month')
  const hasUnpaidCollectionToVoid = blocking.some((problem) => problem.disposition === 'review_and_void')
  if (hasDeferredCollection && hasUnpaidCollectionToVoid) {
    blocking.push({
      code: 'target_month_legacy_invoice_mixed_collection',
      message: 'Paid or processing legacy collection is mixed with an unpaid invoice; the account requires explicit review before any invoice is voided.',
      disposition: 'manual_review_required',
      invoice: null,
    })
  }
  return blocking
}

export async function voidUnpaidTargetMonthLegacyInvoice(stripe, invoice, { idempotencyKey } = {}) {
  if (invoice.status === 'paid' || Number(invoice.amountPaid) > 0) {
    throw new BillingMigrationSafetyError(
      'target_month_legacy_invoice_paid',
      `Paid legacy invoice ${invoice.id} cannot be voided automatically.`,
      { invoice },
      { forwardOnly: true },
    )
  }
  if (['void', 'deleted'].includes(invoice.status)) return { ...invoice, changed: false }
  if (invoice.status === 'draft' && stripe.invoices?.del) {
    await stripe.invoices.del(String(invoice.id), {}, { idempotencyKey: String(idempotencyKey) })
    return { ...invoice, status: 'deleted', changed: true }
  }
  await stripe.invoices.voidInvoice(
    String(invoice.id),
    {},
    { idempotencyKey: String(idempotencyKey) },
  )
  const verified = await stripe.invoices.retrieve(String(invoice.id))
  if (verified.status !== 'void') {
    throw new BillingMigrationSafetyError(
      'legacy_invoice_void_unconfirmed',
      `Stripe invoice ${invoice.id} did not reach void status.`,
      { invoiceId: invoice.id, status: verified.status },
      { forwardOnly: true },
    )
  }
  return { ...invoice, status: 'void', changed: true }
}
