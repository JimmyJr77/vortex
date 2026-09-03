import { randomUUID } from 'node:crypto'
import { checkoutFingerprint, checkoutIdempotencyConflict, normalizeCheckoutRequestKey, stripeCheckoutIdempotencyKey } from '../billing/checkoutIdempotency.js'
import { getStripeClient, stripeEnabled } from '../billing/stripeBilling.js'
import { sendStoreOrderReceiptEmail } from '../email/storeReceiptEmail.js'
import { publicAppUrl } from '../email/publicAppUrl.js'
import { createXlsxWorkbook } from './xlsxExport.js'

const PICKUP_NOTE = 'Pickup at Vortex Athletics. We do not ship store items.'
const STORE_PRODUCT_CATEGORIES = new Set(['clothing', 'equipment', 'food', 'drink', 'other'])
const MEMBER_PAYMENT_METHODS = new Set(['billing_account', 'card'])
const ADMIN_PAYMENT_METHODS = new Set(['billing_account', 'card', 'cash', 'check', 'mobile'])

function normalizeProductTags(value, fallback = []) {
  const source = Array.isArray(value) ? value : value == null ? fallback : [value]
  return [...new Set(source.map((tag) => String(tag ?? '').trim()).filter((tag) => STORE_PRODUCT_CATEGORIES.has(tag)))]
}

function integer(value, fallback = null) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : fallback
}

function stripeObjectId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

export class StoreStripeCheckoutBindingConflict extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'StoreStripeCheckoutBindingConflict'
    this.code = 'store_stripe_checkout_binding_conflict'
    this.details = details
  }
}

/**
 * Bind guest Checkout (where both Stripe customer IDs may legitimately be
 * null) to the immutable local store order before marking it paid.
 */
export function assertStoreStripeCheckoutBinding(order, session) {
  const orderId = integer(session?.metadata?.storeOrderId, null)
  const sessionId = stripeObjectId(session)
  const paymentIntentId = stripeObjectId(session?.payment_intent)
  const amountTotal = session?.amount_total
  const orderTotal = order?.total_cents
  const storedSessionId = order?.stripe_checkout_session_id ?? null
  const problems = []

  if (!Number.isSafeInteger(orderId) || orderId <= 0 || Number(order?.id) !== orderId) {
    problems.push('store_order_mismatch')
  }
  if (!sessionId || !storedSessionId || String(storedSessionId) !== String(sessionId)) {
    problems.push('checkout_session_mismatch')
  }
  if (!paymentIntentId) problems.push('payment_intent_missing')
  if (session?.metadata?.checkoutType !== 'store') problems.push('checkout_type_mismatch')
  if (session?.mode !== 'payment') problems.push('checkout_mode_mismatch')
  if (session?.status !== 'complete' || session?.payment_status !== 'paid') {
    problems.push('checkout_not_paid')
  }
  if (String(session?.currency ?? '').trim().toLowerCase() !== 'usd') {
    problems.push('checkout_currency_mismatch')
  }
  if (
    !Number.isSafeInteger(amountTotal)
    || amountTotal <= 0
    || !Number.isSafeInteger(Number(orderTotal))
    || Number(orderTotal) !== amountTotal
  ) {
    problems.push('checkout_amount_mismatch')
  }
  if (order?.payment_method !== 'card') problems.push('store_payment_method_mismatch')
  if (!['awaiting_payment', 'placed', 'fulfilled'].includes(String(order?.status ?? ''))) {
    problems.push('store_order_status_mismatch')
  }
  if (order?.status === 'awaiting_payment' && order?.payment_status !== 'pending') {
    problems.push('store_payment_status_mismatch')
  }
  if (
    ['placed', 'fulfilled'].includes(String(order?.status ?? ''))
    && order?.payment_status !== 'paid'
  ) {
    problems.push('store_payment_status_mismatch')
  }
  if (
    order?.external_reference
    && String(order.external_reference) !== String(paymentIntentId ?? sessionId ?? '')
  ) {
    problems.push('store_external_reference_mismatch')
  }

  if (problems.length > 0) {
    throw new StoreStripeCheckoutBindingConflict(
      `Stripe Checkout Session ${sessionId ?? '(missing)'} does not exactly match store order ${orderId ?? '(missing)'}.`,
      {
        storeOrderId: orderId,
        storedOrderId: order?.id ?? null,
        stripeCheckoutSessionId: sessionId,
        storedStripeCheckoutSessionId: storedSessionId,
        stripePaymentIntentId: paymentIntentId,
        checkoutAmountTotal: amountTotal ?? null,
        storeOrderTotalCents: orderTotal ?? null,
        checkoutCurrency: session?.currency ?? null,
        problems,
      },
    )
  }

  return { orderId, sessionId, paymentIntentId, amountTotal }
}

function storeCheckoutConflict(message, details = {}) {
  const error = new StoreStripeCheckoutBindingConflict(message, details)
  error.statusCode = 409
  return error
}

function storeOrderValue(order, databaseName, serializedName) {
  return order?.[databaseName] ?? order?.[serializedName] ?? null
}

/**
 * Prove that the exact Checkout Session bound to a pending card order is
 * either safely expirable/already expired or has already collected payment.
 */
export function assertStoreStripeCheckoutCancellationBinding(order, session) {
  const orderId = integer(session?.metadata?.storeOrderId, null)
  const storedOrderId = integer(order?.id, null)
  const sessionId = stripeObjectId(session)
  const storedSessionId = storeOrderValue(
    order,
    'stripe_checkout_session_id',
    'stripeCheckoutSessionId',
  )
  const paymentIntentId = stripeObjectId(session?.payment_intent)
  const amountTotal = session?.amount_total
  const orderTotal = storeOrderValue(order, 'total_cents', 'totalCents')
  const orderStatus = storeOrderValue(order, 'status', 'status')
  const paymentStatus = storeOrderValue(order, 'payment_status', 'paymentStatus')
  const paymentMethod = storeOrderValue(order, 'payment_method', 'paymentMethod')
  const externalReference = storeOrderValue(order, 'external_reference', 'externalReference')
  const problems = []

  if (!Number.isSafeInteger(orderId) || orderId <= 0 || storedOrderId !== orderId) {
    problems.push('store_order_mismatch')
  }
  if (!sessionId || !storedSessionId || String(storedSessionId) !== String(sessionId)) {
    problems.push('checkout_session_mismatch')
  }
  if (session?.metadata?.checkoutType !== 'store') problems.push('checkout_type_mismatch')
  if (session?.mode !== 'payment') problems.push('checkout_mode_mismatch')
  if (String(session?.currency ?? '').trim().toLowerCase() !== 'usd') {
    problems.push('checkout_currency_mismatch')
  }
  if (
    !Number.isSafeInteger(amountTotal)
    || amountTotal <= 0
    || !Number.isSafeInteger(Number(orderTotal))
    || Number(orderTotal) !== amountTotal
  ) {
    problems.push('checkout_amount_mismatch')
  }
  if (paymentMethod !== 'card') problems.push('store_payment_method_mismatch')
  if (orderStatus !== 'awaiting_payment') problems.push('store_order_status_mismatch')
  if (paymentStatus !== 'pending') problems.push('store_payment_status_mismatch')

  let disposition = null
  if (session?.status === 'complete' && session?.payment_status === 'paid') {
    disposition = 'paid'
    if (!paymentIntentId) problems.push('payment_intent_missing')
    if (externalReference && String(externalReference) !== String(paymentIntentId ?? '')) {
      problems.push('store_external_reference_mismatch')
    }
  } else if (session?.status === 'open' && session?.payment_status === 'unpaid') {
    disposition = 'open'
    if (externalReference) problems.push('store_external_reference_mismatch')
  } else if (session?.status === 'expired' && session?.payment_status === 'unpaid') {
    disposition = 'expired'
    if (externalReference) problems.push('store_external_reference_mismatch')
  } else {
    problems.push('checkout_state_unsafe_for_cancellation')
  }

  if (problems.length > 0) {
    throw storeCheckoutConflict(
      `Stripe Checkout Session ${sessionId ?? '(missing)'} cannot safely release store order ${orderId ?? '(missing)'}.`,
      {
        storeOrderId: orderId,
        storedOrderId,
        stripeCheckoutSessionId: sessionId,
        storedStripeCheckoutSessionId: storedSessionId,
        stripePaymentIntentId: paymentIntentId,
        checkoutStatus: session?.status ?? null,
        checkoutPaymentStatus: session?.payment_status ?? null,
        checkoutAmountTotal: amountTotal ?? null,
        storeOrderTotalCents: orderTotal == null ? null : Number(orderTotal),
        problems,
      },
    )
  }

  return { orderId, sessionId, paymentIntentId, amountTotal, disposition }
}

function assertCreatedStoreStripeCheckoutIdentity(order, session) {
  const orderId = integer(session?.metadata?.storeOrderId, null)
  const storedOrderId = integer(order?.id, null)
  const sessionId = stripeObjectId(session)
  const paymentIntentId = stripeObjectId(session?.payment_intent)
  const amountTotal = session?.amount_total
  const orderTotal = storeOrderValue(order, 'total_cents', 'totalCents')
  const problems = []

  if (!Number.isSafeInteger(orderId) || orderId <= 0 || storedOrderId !== orderId) {
    problems.push('store_order_mismatch')
  }
  if (!sessionId) problems.push('checkout_session_missing')
  if (session?.metadata?.checkoutType !== 'store') problems.push('checkout_type_mismatch')
  if (session?.mode !== 'payment') problems.push('checkout_mode_mismatch')
  if (String(session?.currency ?? '').trim().toLowerCase() !== 'usd') {
    problems.push('checkout_currency_mismatch')
  }
  if (
    !Number.isSafeInteger(amountTotal)
    || amountTotal <= 0
    || !Number.isSafeInteger(Number(orderTotal))
    || Number(orderTotal) !== amountTotal
  ) {
    problems.push('checkout_amount_mismatch')
  }

  let disposition = null
  if (session?.status === 'complete' && session?.payment_status === 'paid') {
    disposition = 'paid'
    if (!paymentIntentId) problems.push('payment_intent_missing')
  } else if (session?.status === 'open' && session?.payment_status === 'unpaid') {
    disposition = 'open'
  } else if (session?.status === 'expired' && session?.payment_status === 'unpaid') {
    disposition = 'expired'
  } else {
    problems.push('checkout_state_unsafe')
  }

  if (problems.length > 0) {
    throw storeCheckoutConflict(
      `Stripe Checkout Session ${sessionId ?? '(missing)'} does not exactly match the new store payment request.`,
      {
        storeOrderId: orderId,
        storedOrderId,
        stripeCheckoutSessionId: sessionId,
        stripePaymentIntentId: paymentIntentId,
        checkoutStatus: session?.status ?? null,
        checkoutPaymentStatus: session?.payment_status ?? null,
        checkoutAmountTotal: amountTotal ?? null,
        storeOrderTotalCents: orderTotal == null ? null : Number(orderTotal),
        problems,
      },
    )
  }

  return { orderId, sessionId, paymentIntentId, amountTotal, disposition }
}

async function retrieveExactStoreStripeCheckout(stripe, sessionId) {
  if (!stripe?.checkout?.sessions?.retrieve) {
    throw storeCheckoutConflict(
      'Stripe Checkout retrieval is unavailable, so this store order cannot be changed safely.',
      { stripeCheckoutSessionId: sessionId },
    )
  }
  const session = await stripe.checkout.sessions.retrieve(String(sessionId), {
    expand: ['payment_intent'],
  })
  if (stripeObjectId(session) !== String(sessionId)) {
    throw storeCheckoutConflict(
      'Stripe returned a different Checkout Session than the one requested.',
      {
        stripeCheckoutSessionId: stripeObjectId(session),
        expectedStripeCheckoutSessionId: String(sessionId),
      },
    )
  }
  return session
}

async function expireExactStoreStripeCheckout(stripe, sessionId) {
  if (!stripe?.checkout?.sessions?.expire) {
    throw storeCheckoutConflict(
      'Stripe Checkout expiration is unavailable, so inventory remains reserved.',
      { stripeCheckoutSessionId: sessionId },
    )
  }
  const expired = await stripe.checkout.sessions.expire(String(sessionId))
  if (stripeObjectId(expired) !== String(sessionId) || expired?.status !== 'expired') {
    throw storeCheckoutConflict(
      'Stripe did not confirm expiration of the exact Checkout Session, so inventory remains reserved.',
      {
        stripeCheckoutSessionId: stripeObjectId(expired),
        expectedStripeCheckoutSessionId: String(sessionId),
        checkoutStatus: expired?.status ?? null,
      },
    )
  }
  return expired
}

function moneyCents(value) {
  const parsed = integer(value, null)
  return parsed != null && parsed >= 0 ? parsed : null
}

function normalizedCode(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

function orderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `ST-${date}-${randomUUID().replaceAll('-', '').slice(0, 7).toUpperCase()}`
}

function serializeProduct(row) {
  const tags = normalizeProductTags(row.tags, [row.category])
  return {
    id: Number(row.id),
    sku: row.sku,
    name: row.name,
    description: row.description ?? null,
    category: row.category,
    tags,
    priceCents: Number(row.price_cents),
    inventoryQuantity: row.inventory_quantity == null ? null : Number(row.inventory_quantity),
    isPublic: row.is_public === true,
    isActive: row.is_active === true,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function serializeDiscount(row) {
  return {
    id: Number(row.id),
    code: row.code,
    discountType: row.discount_type,
    value: Number(row.value),
    minimumOrderCents: Number(row.minimum_order_cents ?? 0),
    maxRedemptions: row.max_redemptions == null ? null : Number(row.max_redemptions),
    redemptionCount: Number(row.redemption_count ?? 0),
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    isActive: row.is_active === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function serializeStoreAudit(row) {
  return {
    id: Number(row.id),
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id == null ? null : Number(row.entity_id),
    actorName: row.actor_label,
    details: row.details && typeof row.details === 'object' ? row.details : {},
    occurredAt: row.occurred_at,
  }
}

function productAuditSnapshot(row) {
  return {
    sku: row.sku,
    name: row.name,
    description: row.description ?? null,
    tags: normalizeProductTags(row.tags, [row.category]),
    priceCents: Number(row.price_cents),
    inventoryQuantity: row.inventory_quantity == null ? null : Number(row.inventory_quantity),
    isPublic: row.is_public === true,
    isActive: row.is_active === true,
    sortOrder: Number(row.sort_order ?? 0),
  }
}

function changedProductFields(before, after) {
  return Object.keys(after).reduce((changes, key) => {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { before: before[key], after: after[key] }
    }
    return changes
  }, {})
}

async function recordStoreAudit(client, {
  facilityId,
  actorUserId = null,
  action,
  entityType,
  entityId = null,
  details = {},
}) {
  await client.query(
    `INSERT INTO store_action_audit (
       facility_id, actor_user_id, actor_label, action, entity_type, entity_id, details
     ) VALUES (
       $1, $2,
       COALESCE(
         (SELECT NULLIF(TRIM(COALESCE(full_name, '')), '')
            FROM app_user WHERE id = $2 AND facility_id = $1),
         'System'
       ),
       $3, $4, $5, $6::jsonb
     )`,
    [facilityId, actorUserId, action, entityType, entityId, JSON.stringify(details)],
  )
}

function spreadsheetText(value) {
  const text = String(value ?? '')
  return /^[=+\-@]/.test(text) ? `'${text}` : text
}

function auditExportRow(event) {
  const details = event.details ?? {}
  return {
    Timestamp: new Date(event.occurredAt).toISOString(),
    Action: spreadsheetText(event.action),
    'Performed by': spreadsheetText(event.actorName),
    'Record type': spreadsheetText(event.entityType),
    'Record ID': event.entityId ?? '',
    Item: spreadsheetText(details.productName ?? details.name ?? ''),
    SKU: spreadsheetText(details.sku ?? ''),
    'Order number': spreadsheetText(details.orderNumber ?? ''),
    'Discount code': spreadsheetText(details.code ?? ''),
    'Details (JSON)': spreadsheetText(JSON.stringify(details)),
  }
}

function serializeOrder(row, items = []) {
  return {
    id: Number(row.id),
    orderNumber: row.order_number,
    memberId: row.member_id == null ? null : Number(row.member_id),
    purchaserName: row.purchaser_name ?? null,
    purchaserEmail: row.purchaser_email ?? null,
    source: row.source,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    externalReference: row.external_reference ?? null,
    subtotalCents: Number(row.subtotal_cents),
    discountCents: Number(row.discount_cents),
    totalCents: Number(row.total_cents),
    discountCode: row.discount_code ?? null,
    fulfillmentNote: row.fulfillment_note,
    pickedUpAt: row.picked_up_at ?? null,
    receiptSentAt: row.receipt_sent_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stripeCheckoutUrl: row.stripe_checkout_session_url ?? null,
    items: items.map((item) => ({
      id: Number(item.id),
      productId: item.product_id == null ? null : Number(item.product_id),
      productName: item.product_name,
      sku: item.sku ?? null,
      unitPriceCents: Number(item.unit_price_cents),
      quantity: Number(item.quantity),
      lineTotalCents: Number(item.line_total_cents),
    })),
  }
}

async function resolveFacilityId(pool, platformAuth = null) {
  const fromAuth = integer(platformAuth?.user?.facility_id, null)
  if (fromAuth != null && fromAuth > 0) return fromAuth
  const result = await pool.query('SELECT id FROM facility ORDER BY id ASC LIMIT 1')
  return result.rows[0] ? Number(result.rows[0].id) : null
}

async function loadMember(client, memberId, facilityId) {
  const result = await client.query(
    `SELECT id, facility_id, first_name, last_name, email
       FROM member
      WHERE id = $1 AND facility_id = $2 AND is_active = TRUE
      LIMIT 1`,
    [memberId, facilityId],
  )
  return result.rows[0] ?? null
}

async function loadMemberBillingAccount(client, memberId, facilityId) {
  const member = await loadMember(client, memberId, facilityId)
  if (!member) return { member: null, account: null }
  const family = await client.query(
    `SELECT COALESCE(
        (SELECT fm.family_id
           FROM family_member fm
          WHERE fm.member_id = $1 AND fm.is_active = TRUE
          ORDER BY fm.id ASC LIMIT 1),
        (SELECT family_id FROM member WHERE id = $1)
      ) AS family_id`,
    [memberId],
  )
  const familyId = integer(family.rows[0]?.family_id, null)
  if (familyId == null) return { member, account: null }
  const account = await client.query(
    `SELECT * FROM family_billing_account
      WHERE family_id = $1 AND is_active = TRUE
      LIMIT 1`,
    [familyId],
  )
  return { member, account: account.rows[0] ?? null }
}

async function getOrder(client, id) {
  const order = await client.query(
    `SELECT o.*, d.code AS discount_code
       FROM store_order o
       LEFT JOIN store_discount_code d ON d.id = o.discount_code_id
      WHERE o.id = $1
      LIMIT 1`,
    [id],
  )
  if (!order.rows[0]) return null
  const items = await client.query(
    `SELECT * FROM store_order_item WHERE order_id = $1 ORDER BY id ASC`,
    [id],
  )
  return serializeOrder(order.rows[0], items.rows)
}

async function reserveProducts(client, { facilityId, rawItems, allowInternal, orderId, actorUserId = null }) {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 25) {
    const error = new Error('Add at least one item to your order.')
    error.statusCode = 400
    throw error
  }
  const quantities = new Map()
  for (const raw of rawItems) {
    const productId = integer(raw?.productId, null)
    const quantity = integer(raw?.quantity, null)
    if (productId == null || productId <= 0 || quantity == null || quantity <= 0 || quantity > 20) {
      const error = new Error('Each item needs a valid product and quantity.')
      error.statusCode = 400
      throw error
    }
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity)
  }
  const ids = [...quantities.keys()]
  const products = await client.query(
    `SELECT * FROM store_product
      WHERE facility_id = $1
        AND is_active = TRUE
        AND id = ANY($2::bigint[])
        AND ($3::boolean OR is_public = TRUE)
      FOR UPDATE`,
    [facilityId, ids, allowInternal],
  )
  if (products.rows.length !== ids.length) {
    const error = new Error('One or more store items are no longer available.')
    error.statusCode = 409
    throw error
  }
  const byId = new Map(products.rows.map((row) => [Number(row.id), row]))
  const lines = ids.map((id) => {
    const product = byId.get(id)
    const quantity = quantities.get(id)
    if (product.inventory_quantity != null && Number(product.inventory_quantity) < quantity) {
      const error = new Error(`${product.name} is out of stock for that quantity.`)
      error.statusCode = 409
      throw error
    }
    return {
      productId: id,
      product,
      quantity,
      unitPriceCents: Number(product.price_cents),
      lineTotalCents: Number(product.price_cents) * quantity,
    }
  })
  for (const line of lines) {
    await client.query(
      `UPDATE store_product
          SET inventory_quantity = CASE
                WHEN inventory_quantity IS NULL THEN NULL
                ELSE inventory_quantity - $2
              END,
              updated_at = now()
        WHERE id = $1`,
      [line.productId, line.quantity],
    )
    await client.query(
      `INSERT INTO store_inventory_adjustment
        (product_id, order_id, quantity_delta, reason, created_by_user_id)
       VALUES ($1, $2, $3, 'order_reserved', $4)`,
      [line.productId, orderId, -line.quantity, actorUserId],
    )
    await recordStoreAudit(client, {
      facilityId,
      actorUserId,
      action: 'inventory_reserved_for_sale',
      entityType: 'inventory',
      entityId: line.productId,
      details: {
        productName: line.product.name,
        sku: line.product.sku,
        quantityDelta: -line.quantity,
        orderId,
      },
    })
  }
  return lines
}

async function resolveDiscount(client, { facilityId, code, subtotalCents }) {
  const normalized = normalizedCode(code)
  if (!normalized) return { row: null, discountCents: 0 }
  const result = await client.query(
    `SELECT * FROM store_discount_code
      WHERE facility_id = $1 AND code = $2
      FOR UPDATE`,
    [facilityId, normalized],
  )
  const row = result.rows[0]
  const now = Date.now()
  const invalid = !row || row.is_active !== true
    || (row.starts_at && new Date(row.starts_at).getTime() > now)
    || (row.ends_at && new Date(row.ends_at).getTime() <= now)
    || Number(row.minimum_order_cents ?? 0) > subtotalCents
    || (row.max_redemptions != null && Number(row.redemption_count) >= Number(row.max_redemptions))
  if (invalid) {
    const error = new Error('That store discount code is not available for this order.')
    error.statusCode = 400
    throw error
  }
  const discountCents = row.discount_type === 'percent'
    ? Math.floor((subtotalCents * Number(row.value)) / 100)
    : Math.min(subtotalCents, Number(row.value))
  return { row, discountCents }
}

async function consumeDiscount(client, id) {
  if (!id) return
  await client.query(
    `UPDATE store_discount_code
        SET redemption_count = redemption_count + 1, updated_at = now()
      WHERE id = $1`,
    [id],
  )
}

async function sendStoreOrderReceipt(pool, {
  orderId,
  facilityId,
  purchaserEmail,
  actorUserId = null,
}) {
  const email = String(purchaserEmail ?? '').trim()
  if (!email) throw Object.assign(new Error('Enter an email address for the receipt.'), { statusCode: 400 })

  const client = await pool.connect()
  let order
  try {
    await client.query('BEGIN')
    const current = await client.query(
      `SELECT * FROM store_order WHERE id = $1 AND facility_id = $2 FOR UPDATE`,
      [orderId, facilityId],
    )
    if (!current.rows[0]) throw Object.assign(new Error('Store order not found.'), { statusCode: 404 })
    if (!['placed', 'fulfilled'].includes(current.rows[0].status)) {
      throw Object.assign(new Error('Receipts can only be sent for confirmed store orders.'), { statusCode: 400 })
    }
    await client.query(
      `UPDATE store_order SET purchaser_email = $2, updated_at = now() WHERE id = $1`,
      [orderId, email],
    )
    order = await getOrder(client, orderId)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }

  const result = await sendStoreOrderReceiptEmail({
    to: order.purchaserEmail,
    purchaserName: order.purchaserName,
    orderNumber: order.orderNumber,
    items: order.items,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    paymentMethod: order.paymentMethod,
    pickupNote: order.fulfillmentNote || PICKUP_NOTE,
    idempotencyKey: `store-order-receipt:${order.id}:manual:${randomUUID()}`,
  })
  if (!result.sent) {
    throw Object.assign(new Error('Receipt email could not be sent. Check email settings or try again.'), { statusCode: 422 })
  }
  await pool.query(
    `UPDATE store_order SET receipt_sent_at = now(), updated_at = now() WHERE id = $1`,
    [orderId],
  )
  const auditClient = await pool.connect()
  try {
    await auditClient.query('BEGIN')
    await recordStoreAudit(auditClient, {
      facilityId,
      actorUserId,
      action: 'receipt_emailed',
      entityType: 'sale',
      entityId: orderId,
      details: {
        orderNumber: order.orderNumber,
        purchaserEmail: order.purchaserEmail,
      },
    })
    await auditClient.query('COMMIT')
  } catch (error) {
    await auditClient.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    auditClient.release()
  }

  const refreshClient = await pool.connect()
  try {
    return await getOrder(refreshClient, orderId)
  } finally {
    refreshClient.release()
  }
}

export async function sendReceiptIfNeeded(pool, orderId, {
  sendReceiptEmail = sendStoreOrderReceiptEmail,
} = {}) {
  let order
  const client = await pool.connect()
  try {
    order = await getOrder(client, orderId)
  } finally {
    client.release()
  }
  if (
    !order
    || order.receiptSentAt
    || !order.purchaserEmail
    || !['placed', 'fulfilled'].includes(order.status)
  ) {
    return { sent: false, replayed: Boolean(order?.receiptSentAt) }
  }
  const result = await sendReceiptEmail({
    to: order.purchaserEmail,
    purchaserName: order.purchaserName,
    orderNumber: order.orderNumber,
    items: order.items,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    paymentMethod: order.paymentMethod,
    pickupNote: order.fulfillmentNote || PICKUP_NOTE,
    idempotencyKey: `store-order-receipt:${order.id}`,
  })
  if (result.sent) {
    await pool.query(
      `UPDATE store_order
          SET receipt_sent_at = COALESCE(receipt_sent_at, now()), updated_at = now()
        WHERE id = $1`,
      [orderId],
    )
  }
  return result
}

async function createStoreOrder(pool, {
  facilityId,
  memberId = null,
  source,
  rawItems,
  paymentMethod,
  discountCode = null,
  idempotencyKey,
  purchaserName = null,
  purchaserEmail = null,
  externalReference = null,
  actorUserId = null,
  allowInternal = false,
  requireBillingPayer = false,
}) {
  const requestFingerprint = checkoutFingerprint({
    items: rawItems,
    paymentMethod,
    discountCode: normalizedCode(discountCode),
    memberId,
    source,
    purchaserName,
    purchaserEmail,
    externalReference,
  })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existing = await client.query(
      `SELECT id, request_fingerprint FROM store_order
        WHERE facility_id = $1 AND idempotency_key = $2
        FOR UPDATE`,
      [facilityId, idempotencyKey],
    )
    if (existing.rows[0]) {
      if (existing.rows[0].request_fingerprint !== requestFingerprint) {
        throw checkoutIdempotencyConflict()
      }
      const order = await getOrder(client, existing.rows[0].id)
      await client.query('COMMIT')
      return { order, reused: true }
    }

    let member = null
    let billingAccount = null
    if (memberId != null) {
      const resolved = await loadMemberBillingAccount(client, memberId, facilityId)
      member = resolved.member
      billingAccount = resolved.account
      if (!member) {
        const error = new Error('The selected member is not available.')
        error.statusCode = 400
        throw error
      }
    }
    if (paymentMethod === 'billing_account') {
      if (!member || !billingAccount) {
        const error = new Error('A household billing account is required to bill this store order.')
        error.statusCode = 400
        throw error
      }
      if (requireBillingPayer && Number(billingAccount.payer_member_id) !== Number(member.id)) {
        const error = new Error('Only the household billing payer can bill a store purchase to the monthly account.')
        error.statusCode = 403
        throw error
      }
    }

    const name = purchaserName || (member ? `${member.first_name || ''} ${member.last_name || ''}`.trim() : null)
    const email = purchaserEmail || member?.email || null
    const preliminarySubtotal = 0
    const awaitsPayment = paymentMethod === 'card'
    const inserted = await client.query(
      `INSERT INTO store_order (
         facility_id, order_number, member_id, family_billing_account_id,
         purchaser_name, purchaser_email, source, status, payment_status,
         payment_method, external_reference, subtotal_cents, discount_cents,
         total_cents, fulfillment_note, idempotency_key, request_fingerprint,
         created_by_user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               $8, $9, $10, $11, $12, 0, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        facilityId,
        orderNumber(),
        member?.id ?? null,
        billingAccount?.id ?? null,
        name,
        email,
        source,
        awaitsPayment ? 'awaiting_payment' : 'placed',
        paymentMethod === 'billing_account'
          ? 'billed_to_account'
          : awaitsPayment
            ? 'pending'
            : ['cash', 'check', 'mobile'].includes(paymentMethod)
              ? 'external'
              : 'paid',
        paymentMethod,
        externalReference || null,
        preliminarySubtotal,
        PICKUP_NOTE,
        idempotencyKey,
        requestFingerprint,
        actorUserId,
      ],
    )
    const orderId = Number(inserted.rows[0].id)
    const lines = await reserveProducts(client, {
      facilityId,
      rawItems,
      allowInternal,
      orderId,
      actorUserId,
    })
    const subtotalCents = lines.reduce((sum, item) => sum + item.lineTotalCents, 0)
    const discount = await resolveDiscount(client, { facilityId, code: discountCode, subtotalCents })
    const totalCents = subtotalCents - discount.discountCents
    for (const line of lines) {
      await client.query(
        `INSERT INTO store_order_item
          (order_id, product_id, product_name, sku, unit_price_cents, quantity, line_total_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, line.productId, line.product.name, line.product.sku, line.unitPriceCents, line.quantity, line.lineTotalCents],
      )
    }
    const updated = await client.query(
      `UPDATE store_order
          SET subtotal_cents = $2, discount_cents = $3, total_cents = $4,
              discount_code_id = $5, updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [orderId, subtotalCents, discount.discountCents, totalCents, discount.row?.id ?? null],
    )
    if (paymentMethod === 'billing_account') {
      const charge = await client.query(
        `INSERT INTO billing_charge (
           family_billing_account_id, member_id, source_type, source_id,
           description, amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval, created_by_user_id
         )
         VALUES ($1, $2, 'store_order', $3, $4, $5, $6, $7, 'one_time', 'one_time', $8)
         RETURNING id`,
        [
          billingAccount.id,
          member.id,
          String(orderId),
          `Store order ${updated.rows[0].order_number}`,
          totalCents,
          subtotalCents,
          discount.discountCents,
          actorUserId,
        ],
      )
      await client.query(
        `UPDATE store_order SET billing_charge_id = $2, updated_at = now() WHERE id = $1`,
        [orderId, charge.rows[0].id],
      )
    }
    if (awaitsPayment && totalCents === 0) {
      await client.query(
        `UPDATE store_order
            SET status = 'placed', payment_status = 'paid', updated_at = now()
          WHERE id = $1`,
        [orderId],
      )
    }
    if (!awaitsPayment || totalCents === 0) await consumeDiscount(client, discount.row?.id)
    const order = await getOrder(client, orderId)
    await recordStoreAudit(client, {
      facilityId,
      actorUserId,
      action: 'sale_recorded',
      entityType: 'sale',
      entityId: orderId,
      details: {
        orderNumber: order.orderNumber,
        source: order.source,
        purchaserName: order.purchaserName,
        purchaserEmail: order.purchaserEmail,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        subtotalCents: order.subtotalCents,
        discountCents: order.discountCents,
        totalCents: order.totalCents,
        discountCode: order.discountCode,
        items: order.items.map((item) => ({
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          lineTotalCents: item.lineTotalCents,
        })),
      },
    })
    await client.query('COMMIT')
    return { order, reused: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export async function createCardCheckout(pool, order, { stripe: suppliedStripe = null } = {}) {
  if (!suppliedStripe && !stripeEnabled()) {
    const error = new Error('Online card payments are not enabled yet. Please choose monthly account billing or ask the front desk.')
    error.statusCode = 503
    throw error
  }
  const stripe = suppliedStripe ?? await getStripeClient()
  if (!stripe) {
    const error = new Error('Online card payments are not available right now.')
    error.statusCode = 503
    throw error
  }
  if (order.stripeCheckoutUrl) {
    const current = await pool.query(
      `SELECT * FROM store_order WHERE id = $1 LIMIT 1`,
      [order.id],
    )
    const row = current.rows[0]
    const sessionId = row?.stripe_checkout_session_id
    if (!row || !sessionId) {
      throw storeCheckoutConflict(
        'The saved store Checkout URL has no exact local Session binding and cannot be reused.',
        { storeOrderId: Number(order.id), stripeCheckoutSessionId: sessionId ?? null },
      )
    }
    const remote = await retrieveExactStoreStripeCheckout(stripe, sessionId)
    if (remote?.status === 'complete' && remote?.payment_status === 'paid') {
      assertStoreStripeCheckoutBinding(row, remote)
      await completeStoreStripeCheckout(pool, remote)
      throw storeCheckoutConflict(
        'This store payment is already complete; its Checkout URL was not reopened.',
        {
          storeOrderId: Number(order.id),
          stripeCheckoutSessionId: String(sessionId),
          checkoutDisposition: 'paid',
        },
      )
    }
    const remoteState = assertStoreStripeCheckoutCancellationBinding(row, remote)
    if (remoteState.disposition === 'open') {
      if (!remote?.url) {
        throw storeCheckoutConflict(
          'Stripe did not return a reusable URL for the exact open store Checkout Session.',
          { storeOrderId: Number(order.id), stripeCheckoutSessionId: String(sessionId) },
        )
      }
      return remote.url
    }
    await cancelStoreOrder(pool, {
      orderId: Number(row.id),
      facilityId: Number(row.facility_id),
      actorUserId: null,
      stripe,
    })
    throw storeCheckoutConflict(
      'This store Checkout Session expired, so its reserved order was released and no payment URL was returned.',
      {
        storeOrderId: Number(order.id),
        stripeCheckoutSessionId: String(sessionId),
        checkoutDisposition: 'expired',
      },
    )
  }
  // Stripe Checkout line items must add up to the immutable store total. For
  // an order-level code we send one summarized line (rather than rounding a
  // discount across quantities and risking a one-cent mismatch).
  const stripeLineItems = order.discountCents > 0
    ? [{
      price_data: {
        currency: 'usd',
        product_data: { name: `Vortex store order ${order.orderNumber}` },
        unit_amount: order.totalCents,
      },
      quantity: 1,
    }]
    : order.items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.productName },
        unit_amount: item.unitPriceCents,
      },
      quantity: item.quantity,
    }))
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: order.purchaserEmail || undefined,
    line_items: stripeLineItems,
    metadata: {
      checkoutType: 'store',
      storeOrderId: String(order.id),
    },
    success_url: `${publicAppUrl()}/store?store=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${publicAppUrl()}/store?store=cancelled`,
  }, {
    idempotencyKey: stripeCheckoutIdempotencyKey('store', order.id, order.orderNumber),
  })
  const created = assertCreatedStoreStripeCheckoutIdentity(order, session)
  if (created.disposition === 'open' && !session?.url) {
    throw storeCheckoutConflict(
      'Stripe did not return a URL for the new open store Checkout Session.',
      { storeOrderId: Number(order.id), stripeCheckoutSessionId: created.sessionId },
    )
  }
  const linked = await pool.query(
    `UPDATE store_order
        SET stripe_checkout_session_id = $2, stripe_checkout_session_url = $3, updated_at = now()
      WHERE id = $1
        AND status = 'awaiting_payment'
        AND payment_status = 'pending'
        AND payment_method = 'card'
        AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id = $2)
      RETURNING id, facility_id`,
    [order.id, created.sessionId, session?.url ?? null],
  )
  if (!linked.rows[0]) {
    // Cancellation may commit while Stripe is creating the Session. Never
    // expose that now-unbound payment surface: re-read the exact Session and
    // expire it, or recover an already-paid race through the durable binding.
    let remote = await retrieveExactStoreStripeCheckout(stripe, created.sessionId)
    let remoteState = assertCreatedStoreStripeCheckoutIdentity(order, remote)
    if (remoteState.disposition === 'open') {
      try {
        remote = await expireExactStoreStripeCheckout(stripe, created.sessionId)
      } catch (error) {
        if (error instanceof StoreStripeCheckoutBindingConflict) throw error
        remote = await retrieveExactStoreStripeCheckout(stripe, created.sessionId)
      }
      remoteState = assertCreatedStoreStripeCheckoutIdentity(order, remote)
    }
    if (remoteState.disposition === 'paid') {
      // A concurrent creator may have durably bound and exposed the same
      // idempotent Session before this compare-and-set lost the race.
      await completeStoreStripeCheckout(pool, remote)
    } else if (remoteState.disposition !== 'expired') {
      throw storeCheckoutConflict(
        'The unbound Stripe Checkout Session could not be retired safely.',
        { storeOrderId: Number(order.id), stripeCheckoutSessionId: created.sessionId },
      )
    }
    throw storeCheckoutConflict(
      remoteState.disposition === 'paid'
        ? 'This store payment completed while the order was changing and was recovered; the Checkout URL was not reopened.'
        : 'This store order is no longer awaiting card payment; its Checkout Session was expired.',
      {
        storeOrderId: Number(order.id),
        stripeCheckoutSessionId: created.sessionId,
        checkoutDisposition: remoteState.disposition,
      },
    )
  }
  if (created.disposition === 'expired') {
    await cancelStoreOrder(pool, {
      orderId: Number(order.id),
      facilityId: Number(linked.rows[0].facility_id),
      actorUserId: null,
      stripe,
    })
    throw storeCheckoutConflict(
      'Stripe returned an expired Checkout Session, so its reserved order was released and no payment URL was returned.',
      {
        storeOrderId: Number(order.id),
        stripeCheckoutSessionId: created.sessionId,
        checkoutDisposition: 'expired',
      },
    )
  }
  if (created.disposition === 'paid') {
    await completeStoreStripeCheckout(pool, session)
    throw storeCheckoutConflict(
      'This store payment is already complete; its Checkout URL was not reopened.',
      {
        storeOrderId: Number(order.id),
        stripeCheckoutSessionId: created.sessionId,
        checkoutDisposition: 'paid',
      },
    )
  }
  return session.url
}

async function settleStoreStripeCheckoutLocked(client, row, session, { actorUserId = null } = {}) {
  const binding = assertStoreStripeCheckoutBinding(row, session)
  if (row.status !== 'awaiting_payment') return false
  await client.query(
    `UPDATE store_order
        SET status = 'placed', payment_status = 'paid',
            external_reference = COALESCE($2, external_reference),
            stripe_checkout_session_url = NULL,
            updated_at = now()
      WHERE id = $1`,
    [binding.orderId, binding.paymentIntentId],
  )
  await consumeDiscount(client, row.discount_code_id)
  await recordStoreAudit(client, {
    facilityId: Number(row.facility_id),
    actorUserId,
    action: 'sale_card_payment_completed',
    entityType: 'sale',
    entityId: binding.orderId,
    details: {
      orderNumber: row.order_number,
      totalCents: Number(row.total_cents),
      paymentMethod: 'card',
      stripePaymentIntent: binding.paymentIntentId,
    },
  })
  return true
}

export async function completeStoreStripeCheckout(pool, session) {
  const orderId = integer(session?.metadata?.storeOrderId, null)
  if (orderId == null || orderId <= 0) {
    throw new StoreStripeCheckoutBindingConflict(
      'Stripe store Checkout is missing its durable order identifier.',
      { storeOrderId: orderId, stripeCheckoutSessionId: stripeObjectId(session) },
    )
  }
  const client = await pool.connect()
  let order
  let paymentCompleted = false
  try {
    await client.query('BEGIN')
    const current = await client.query(`SELECT * FROM store_order WHERE id = $1 FOR UPDATE`, [orderId])
    const row = current.rows[0]
    paymentCompleted = await settleStoreStripeCheckoutLocked(client, row, session)
    order = await getOrder(client, orderId)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
  await sendReceiptIfNeeded(pool, orderId).catch((error) => {
    console.warn('[store] receipt email failed:', error?.message || error)
  })
  return { handled: true, paymentCompleted, order }
}

export async function cancelStoreOrder(pool, {
  orderId,
  facilityId,
  actorUserId,
  stripe: suppliedStripe = null,
  sendReceipt: suppliedSendReceipt = sendReceiptIfNeeded,
}) {
  const client = await pool.connect()
  let clientReleased = false
  let transactionOpen = false
  let order = null
  let recoveredPaidCheckout = false
  try {
    await client.query('BEGIN')
    transactionOpen = true
    const current = await client.query(
      `SELECT * FROM store_order WHERE id = $1 AND facility_id = $2 FOR UPDATE`,
      [orderId, facilityId],
    )
    let row = current.rows[0]
    if (!row) {
      const error = new Error('Store order not found.')
      error.statusCode = 404
      throw error
    }
    if (row.status === 'cancelled') {
      order = await getOrder(client, orderId)
      await client.query('COMMIT')
      transactionOpen = false
      return order
    }
    if (row.payment_status === 'paid' || row.payment_status === 'external') {
      const error = new Error('Paid orders require a recorded refund before they can be cancelled.')
      error.statusCode = 409
      throw error
    }

    if (row.payment_method === 'card' && row.stripe_checkout_session_id) {
      const stripe = suppliedStripe ?? await getStripeClient()
      if (!stripe) {
        throw storeCheckoutConflict(
          'Stripe is unavailable, so the payment link cannot be retired and inventory remains reserved.',
          { storeOrderId: Number(orderId), stripeCheckoutSessionId: row.stripe_checkout_session_id },
        )
      }
      const sessionId = String(row.stripe_checkout_session_id)
      let remote = await retrieveExactStoreStripeCheckout(stripe, sessionId)
      let remoteState = assertStoreStripeCheckoutCancellationBinding(row, remote)
      if (remoteState.disposition === 'open') {
        try {
          remote = await expireExactStoreStripeCheckout(stripe, sessionId)
        } catch (error) {
          // Payment can win after retrieval but before expiration. Re-read the
          // exact Session so paid cash is finalized rather than restocked.
          if (error instanceof StoreStripeCheckoutBindingConflict) throw error
          remote = await retrieveExactStoreStripeCheckout(stripe, sessionId)
        }
        remoteState = assertStoreStripeCheckoutCancellationBinding(row, remote)
      }

      // Re-read the order after Stripe returns while the same row lock is held.
      // No inventory mutation is allowed if local identity or state drifted.
      row = await client.query(
        `SELECT * FROM store_order WHERE id = $1 AND facility_id = $2 FOR UPDATE`,
        [orderId, facilityId],
      ).then((result) => result.rows[0] ?? null)
      remoteState = assertStoreStripeCheckoutCancellationBinding(row, remote)
      if (remoteState.disposition === 'paid') {
        recoveredPaidCheckout = await settleStoreStripeCheckoutLocked(client, row, remote, {
          actorUserId,
        })
        order = await getOrder(client, orderId)
        await client.query('COMMIT')
        transactionOpen = false
      } else if (remoteState.disposition !== 'expired') {
        throw storeCheckoutConflict(
          'Stripe did not confirm that the payment link is expired, so inventory remains reserved.',
          { storeOrderId: Number(orderId), stripeCheckoutSessionId: sessionId },
        )
      }
    }

    if (recoveredPaidCheckout) {
      client.release()
      clientReleased = true
      await suppliedSendReceipt(pool, orderId).catch((error) => {
        console.warn('[store] receipt email failed:', error?.message || error)
      })
      const error = new Error(
        'The card payment completed while cancellation was requested. The order remains placed and was not cancelled.',
      )
      error.statusCode = 409
      error.code = 'store_card_payment_completed'
      error.details = {
        storeOrderId: Number(orderId),
        orderStatus: order?.status ?? 'placed',
        paymentStatus: order?.paymentStatus ?? 'paid',
      }
      throw error
    }

    const items = await client.query(`SELECT * FROM store_order_item WHERE order_id = $1`, [orderId])
    for (const item of items.rows) {
      if (item.product_id == null) continue
      await client.query(
        `UPDATE store_product
            SET inventory_quantity = CASE
              WHEN inventory_quantity IS NULL THEN NULL
              ELSE inventory_quantity + $2
            END, updated_at = now()
          WHERE id = $1`,
        [item.product_id, item.quantity],
      )
      await client.query(
        `INSERT INTO store_inventory_adjustment
          (product_id, order_id, quantity_delta, reason, created_by_user_id)
         VALUES ($1, $2, $3, 'order_cancelled', $4)`,
        [item.product_id, orderId, item.quantity, actorUserId],
      )
      await recordStoreAudit(client, {
        facilityId,
        actorUserId,
        action: 'inventory_restored_after_cancellation',
        entityType: 'inventory',
        entityId: Number(item.product_id),
        details: {
          productName: item.product_name,
          sku: item.sku,
          quantityDelta: Number(item.quantity),
          orderNumber: row.order_number,
          orderId,
        },
      })
    }
    if (row.payment_status === 'billed_to_account' && row.family_billing_account_id) {
      await client.query(
        `INSERT INTO billing_charge (
          family_billing_account_id, member_id, source_type, source_id,
          description, amount_cents, gross_amount_cents, discount_amount_cents,
          charge_type, billing_interval, created_by_user_id
        ) VALUES ($1, $2, 'store_order_void', $3, $4, $5, 0, 0, 'credit', 'one_time', $6)`,
        [
          row.family_billing_account_id,
          row.member_id,
          `${orderId}:void`,
          `Void store order ${row.order_number}`,
          -Number(row.total_cents),
          actorUserId,
        ],
      )
      if (row.discount_code_id) {
        await client.query(
          `UPDATE store_discount_code SET redemption_count = GREATEST(0, redemption_count - 1), updated_at = now() WHERE id = $1`,
          [row.discount_code_id],
        )
      }
    }
    await client.query(
      `UPDATE store_order
          SET status = 'cancelled',
              stripe_checkout_session_url = CASE
                WHEN payment_method = 'card' THEN NULL
                ELSE stripe_checkout_session_url
              END,
              updated_at = now()
        WHERE id = $1`,
      [orderId],
    )
    order = await getOrder(client, orderId)
    await recordStoreAudit(client, {
      facilityId,
      actorUserId,
      action: 'sale_cancelled',
      entityType: 'sale',
      entityId: orderId,
      details: { orderNumber: row.order_number, paymentStatus: row.payment_status, totalCents: Number(row.total_cents) },
    })
    await client.query('COMMIT')
    transactionOpen = false
    return order
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    if (!clientReleased) client.release()
  }
}

async function collectStoreOrderPayment(pool, { orderId, facilityId, actorUserId }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query(
      `SELECT * FROM store_order WHERE id = $1 AND facility_id = $2 FOR UPDATE`,
      [orderId, facilityId],
    )
    const row = current.rows[0]
    if (!row) throw Object.assign(new Error('Store order not found.'), { statusCode: 404 })
    if (row.status !== 'awaiting_payment' || !['cash', 'check', 'mobile'].includes(row.payment_method)) {
      throw Object.assign(new Error('Only in-person external-payment orders can be collected here.'), { statusCode: 409 })
    }
    await client.query(
      `UPDATE store_order
          SET status = 'placed', payment_status = 'external', updated_at = now()
        WHERE id = $1`,
      [orderId],
    )
    await consumeDiscount(client, row.discount_code_id)
    const order = await getOrder(client, orderId)
    await recordStoreAudit(client, {
      facilityId,
      actorUserId,
      action: 'sale_payment_collected',
      entityType: 'sale',
      entityId: orderId,
      details: {
        orderNumber: row.order_number,
        paymentMethod: row.payment_method,
        totalCents: Number(row.total_cents),
        externalReference: row.external_reference ?? null,
      },
    })
    await client.query('COMMIT')
    return order
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

function handleRouteError(res, error, fallback = 'Store request failed.') {
  const statusCode = Number(error?.statusCode ?? error?.status) || 500
  if (statusCode >= 500) console.error('[store]', error)
  res.status(statusCode).json({ success: false, message: error?.message || fallback, code: error?.code })
}

export function registerStoreRoutes(app, pool, { memberAuth, requirePermission }) {
  app.get('/api/store/products', async (_req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool)
      if (!facilityId) return res.json({ success: true, data: [] })
      const result = await pool.query(
        `SELECT * FROM store_product
          WHERE facility_id = $1 AND is_active = TRUE AND is_public = TRUE
          ORDER BY sort_order ASC, name ASC`,
        [facilityId],
      )
      res.json({ success: true, data: result.rows.map(serializeProduct) })
    } catch (error) {
      handleRouteError(res, error, 'Could not load the store catalog.')
    }
  })

  app.get('/api/members/store/products', ...memberAuth, async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const result = await pool.query(
        `SELECT * FROM store_product
          WHERE facility_id = $1 AND is_active = TRUE AND is_public = TRUE
          ORDER BY sort_order ASC, name ASC`,
        [facilityId],
      )
      res.json({ success: true, data: result.rows.map(serializeProduct) })
    } catch (error) {
      handleRouteError(res, error, 'Could not load the store catalog.')
    }
  })

  app.get('/api/members/store/orders', ...memberAuth, async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const memberId = integer(req.platformAuth?.user?.member_id, null)
      if (!facilityId || !memberId) return res.status(403).json({ success: false, message: 'Member account is required.' })
      const result = await pool.query(
        `SELECT id FROM store_order
          WHERE facility_id = $1 AND member_id = $2
          ORDER BY created_at DESC LIMIT 25`,
        [facilityId, memberId],
      )
      const client = await pool.connect()
      try {
        const orders = await Promise.all(result.rows.map((row) => getOrder(client, row.id)))
        res.json({ success: true, data: orders.filter(Boolean) })
      } finally {
        client.release()
      }
    } catch (error) {
      handleRouteError(res, error, 'Could not load store orders.')
    }
  })

  app.post('/api/members/store/checkout', ...memberAuth, async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const memberId = integer(req.platformAuth?.user?.member_id, null)
      const paymentMethod = String(req.body?.paymentMethod ?? '')
      if (!facilityId || !memberId || !MEMBER_PAYMENT_METHODS.has(paymentMethod)) {
        return res.status(400).json({ success: false, message: 'Choose card payment or monthly account billing.' })
      }
      if (paymentMethod === 'card' && !stripeEnabled()) return res.status(503).json({ success: false, message: 'Card payment is unavailable right now. Please use monthly account billing.' })
      const requestKey = normalizeCheckoutRequestKey(req.get('Idempotency-Key'), 'member-store')
      const result = await createStoreOrder(pool, {
        facilityId,
        memberId,
        source: 'member',
        rawItems: req.body?.items,
        paymentMethod,
        discountCode: req.body?.discountCode,
        idempotencyKey: requestKey,
        actorUserId: integer(req.platformAuth?.user?.id, null),
        requireBillingPayer: true,
      })
      if (paymentMethod === 'card' && result.order.status === 'awaiting_payment') {
        const checkoutUrl = await createCardCheckout(pool, result.order)
        result.order.stripeCheckoutUrl = checkoutUrl
      } else {
        await sendReceiptIfNeeded(pool, result.order.id).catch((error) => {
          console.warn('[store] receipt email failed:', error?.message || error)
        })
      }
      res.json({ success: true, data: result.order, reused: result.reused })
    } catch (error) {
      handleRouteError(res, error, 'Could not place store order.')
    }
  })

  app.get('/api/admin/store/dashboard', ...requirePermission('billing.view'), async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const [summary, lowStock, recent] = await Promise.all([
        pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE status IN ('placed', 'fulfilled'))::int AS order_count,
             COALESCE(SUM(total_cents) FILTER (WHERE status IN ('placed', 'fulfilled')), 0)::int AS sales_cents,
             COUNT(*) FILTER (WHERE status = 'awaiting_payment')::int AS awaiting_payment_count,
             COUNT(*) FILTER (WHERE status = 'placed')::int AS pickup_count
           FROM store_order WHERE facility_id = $1`,
          [facilityId],
        ),
        pool.query(
          `SELECT * FROM store_product
            WHERE facility_id = $1 AND is_active = TRUE
              AND inventory_quantity IS NOT NULL AND inventory_quantity <= 5
            ORDER BY inventory_quantity ASC, name ASC`,
          [facilityId],
        ),
        pool.query(`SELECT id FROM store_order WHERE facility_id = $1 ORDER BY created_at DESC LIMIT 30`, [facilityId]),
      ])
      const client = await pool.connect()
      try {
        const orders = await Promise.all(recent.rows.map((row) => getOrder(client, row.id)))
        res.json({
          success: true,
          data: {
            summary: {
              orderCount: Number(summary.rows[0]?.order_count ?? 0),
              salesCents: Number(summary.rows[0]?.sales_cents ?? 0),
              awaitingPaymentCount: Number(summary.rows[0]?.awaiting_payment_count ?? 0),
              pickupCount: Number(summary.rows[0]?.pickup_count ?? 0),
            },
            lowStock: lowStock.rows.map(serializeProduct),
            orders: orders.filter(Boolean),
          },
        })
      } finally {
        client.release()
      }
    } catch (error) {
      handleRouteError(res, error, 'Could not load store activity.')
    }
  })

  app.get('/api/admin/store/audit', ...requirePermission('billing.view'), async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const result = await pool.query(
        `SELECT id, action, entity_type, entity_id, actor_label, details, occurred_at
           FROM store_action_audit
          WHERE facility_id = $1
          ORDER BY occurred_at DESC, id DESC`,
        [facilityId],
      )
      res.json({ success: true, data: result.rows.map(serializeStoreAudit) })
    } catch (error) {
      handleRouteError(res, error, 'Could not load the store action audit.')
    }
  })

  app.get('/api/admin/store/audit/export', ...requirePermission('billing.view'), async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const result = await pool.query(
        `SELECT id, action, entity_type, entity_id, actor_label, details, occurred_at
           FROM store_action_audit
          WHERE facility_id = $1
          ORDER BY occurred_at DESC, id DESC`,
        [facilityId],
      )
      const events = result.rows.map(serializeStoreAudit)
      const file = createXlsxWorkbook({
        sheetName: 'Action audit',
        columns: [
          { header: 'Timestamp', key: 'Timestamp', width: 24 },
          { header: 'Action', key: 'Action', width: 34 },
          { header: 'Performed by', key: 'Performed by', width: 24 },
          { header: 'Record type', key: 'Record type', width: 18 },
          { header: 'Record ID', key: 'Record ID', width: 12 },
          { header: 'Item', key: 'Item', width: 30 },
          { header: 'SKU', key: 'SKU', width: 18 },
          { header: 'Order number', key: 'Order number', width: 24 },
          { header: 'Discount code', key: 'Discount code', width: 18 },
          { header: 'Details (JSON)', key: 'Details (JSON)', width: 100 },
        ],
        rows: events.map(auditExportRow),
      })
      const date = new Date().toISOString().slice(0, 10)
      res.status(200)
        .set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .set('Content-Disposition', `attachment; filename="store-action-audit-${date}.xlsx"`)
        .set('Cache-Control', 'no-store')
        .send(file)
    } catch (error) {
      handleRouteError(res, error, 'Could not export the store action audit.')
    }
  })

  app.get('/api/admin/store/products', ...requirePermission('billing.view'), async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const result = await pool.query(`SELECT * FROM store_product WHERE facility_id = $1 ORDER BY is_active DESC, sort_order ASC, name ASC`, [facilityId])
      res.json({ success: true, data: result.rows.map(serializeProduct) })
    } catch (error) {
      handleRouteError(res, error, 'Could not load store products.')
    }
  })

  app.post('/api/admin/store/products', ...requirePermission('billing.manage'), async (req, res) => {
    let client
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const name = String(req.body?.name ?? '').trim()
      const sku = String(req.body?.sku ?? '').trim().toUpperCase()
      const priceCents = moneyCents(req.body?.priceCents)
      const inventory = req.body?.inventoryQuantity == null || req.body?.inventoryQuantity === '' ? null : integer(req.body.inventoryQuantity, null)
      const tags = normalizeProductTags(req.body?.tags, [req.body?.category ?? 'other'])
      const category = tags[0] ?? 'other'
      if (!name || !sku || priceCents == null || tags.length === 0 || (inventory != null && inventory < 0)) {
        return res.status(400).json({ success: false, message: 'Name, SKU, valid price, tag, and inventory are required.' })
      }
      client = await pool.connect()
      await client.query('BEGIN')
      const result = await client.query(
        `INSERT INTO store_product (facility_id, sku, name, description, category, tags, price_cents, inventory_quantity, is_public, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10)
         RETURNING *`,
        [facilityId, sku, name, String(req.body?.description ?? '').trim() || null, category, tags, priceCents, inventory, req.body?.isPublic !== false, integer(req.body?.sortOrder, 0)],
      )
      await recordStoreAudit(client, {
        facilityId,
        actorUserId: integer(req.platformAuth?.user?.id, null),
        action: 'product_created',
        entityType: 'product',
        entityId: Number(result.rows[0].id),
        details: productAuditSnapshot(result.rows[0]),
      })
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: serializeProduct(result.rows[0]) })
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {})
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'That SKU is already in use.' })
      handleRouteError(res, error, 'Could not create store product.')
    } finally {
      client?.release()
    }
  })

  app.patch('/api/admin/store/products/:id', ...requirePermission('billing.manage'), async (req, res) => {
    let client
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const id = integer(req.params.id, null)
      if (!id) return res.status(400).json({ success: false, message: 'Invalid product.' })
      client = await pool.connect()
      await client.query('BEGIN')
      const existing = await client.query(`SELECT * FROM store_product WHERE id = $1 AND facility_id = $2 FOR UPDATE`, [id, facilityId])
      if (!existing.rows[0]) throw Object.assign(new Error('Store product not found.'), { statusCode: 404 })
      const current = existing.rows[0]
      const existingTags = normalizeProductTags(current.tags, [current.category])
      const tags = normalizeProductTags(
        req.body?.tags === undefined
          ? req.body?.category == null ? existingTags : [req.body.category]
          : req.body.tags,
        existingTags,
      )
      const next = {
        name: req.body?.name == null ? current.name : String(req.body.name).trim(),
        sku: req.body?.sku == null ? current.sku : String(req.body.sku).trim().toUpperCase(),
        description: req.body?.description == null ? current.description : String(req.body.description).trim() || null,
        category: tags[0] ?? null,
        tags,
        priceCents: req.body?.priceCents == null ? Number(current.price_cents) : moneyCents(req.body.priceCents),
        inventory: req.body?.inventoryQuantity === undefined ? current.inventory_quantity : (req.body.inventoryQuantity == null || req.body.inventoryQuantity === '' ? null : integer(req.body.inventoryQuantity, null)),
        isPublic: req.body?.isPublic == null ? current.is_public : req.body.isPublic === true,
        isActive: req.body?.isActive == null ? current.is_active : req.body.isActive === true,
        sortOrder: req.body?.sortOrder == null ? Number(current.sort_order) : integer(req.body.sortOrder, null),
      }
      if (!next.name || !next.sku || next.priceCents == null || next.priceCents < 0 || next.inventory != null && next.inventory < 0 || next.tags.length === 0 || next.sortOrder == null) throw Object.assign(new Error('Product details are invalid.'), { statusCode: 400 })
      const result = await client.query(
        `UPDATE store_product SET sku = $3, name = $4, description = $5, category = $6, tags = $7::text[],
             price_cents = $8, inventory_quantity = $9, is_public = $10, is_active = $11,
             sort_order = $12, updated_at = now()
           WHERE id = $1 AND facility_id = $2 RETURNING *`,
        [id, facilityId, next.sku, next.name, next.description, next.category, next.tags, next.priceCents, next.inventory, next.isPublic, next.isActive, next.sortOrder],
      )
      const before = productAuditSnapshot(current)
      const after = productAuditSnapshot(result.rows[0])
      const changes = changedProductFields(before, after)
      if (Object.keys(changes).length > 0) {
        const action = changes.priceCents
          ? 'product_price_updated'
          : changes.inventoryQuantity
            ? 'inventory_updated_with_product'
            : changes.isActive?.after === false
              ? 'product_archived'
              : 'product_updated'
        await recordStoreAudit(client, {
          facilityId,
          actorUserId: integer(req.platformAuth?.user?.id, null),
          action,
          entityType: 'product',
          entityId: id,
          details: { productName: after.name, sku: after.sku, changes },
        })
      }
      await client.query('COMMIT')
      res.json({ success: true, data: serializeProduct(result.rows[0]) })
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {})
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'That SKU is already in use.' })
      handleRouteError(res, error, 'Could not update store product.')
    } finally {
      client?.release()
    }
  })

  app.post('/api/admin/store/products/:id/inventory', ...requirePermission('billing.manage'), async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const productId = integer(req.params.id, null)
      const delta = integer(req.body?.quantityDelta, null)
      if (!productId || !delta || !String(req.body?.reason ?? '').trim()) {
        return res.status(400).json({ success: false, message: 'Enter a non-zero inventory adjustment and reason.' })
      }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const current = await client.query(`SELECT * FROM store_product WHERE id = $1 AND facility_id = $2 FOR UPDATE`, [productId, facilityId])
        const product = current.rows[0]
        if (!product) throw Object.assign(new Error('Store product not found.'), { statusCode: 404 })
        if (product.inventory_quantity == null) throw Object.assign(new Error('Enable inventory tracking for this product before adjusting its count.'), { statusCode: 400 })
        if (Number(product.inventory_quantity) + delta < 0) throw Object.assign(new Error('Inventory cannot go below zero.'), { statusCode: 400 })
        const update = await client.query(`UPDATE store_product SET inventory_quantity = inventory_quantity + $2, updated_at = now() WHERE id = $1 RETURNING *`, [productId, delta])
        const reason = String(req.body.reason).trim()
        const actorUserId = integer(req.platformAuth?.user?.id, null)
        await client.query(`INSERT INTO store_inventory_adjustment (product_id, quantity_delta, reason, created_by_user_id) VALUES ($1, $2, $3, $4)`, [productId, delta, reason, actorUserId])
        await recordStoreAudit(client, {
          facilityId,
          actorUserId,
          action: 'inventory_adjusted',
          entityType: 'inventory',
          entityId: productId,
          details: {
            productName: update.rows[0].name,
            sku: update.rows[0].sku,
            quantityDelta: delta,
            previousQuantity: Number(product.inventory_quantity),
            newQuantity: Number(update.rows[0].inventory_quantity),
            reason,
          },
        })
        await client.query('COMMIT')
        res.json({ success: true, data: serializeProduct(update.rows[0]) })
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      handleRouteError(res, error, 'Could not adjust inventory.')
    }
  })

  app.get('/api/admin/store/discount-codes', ...requirePermission('billing.view'), async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const result = await pool.query(`SELECT * FROM store_discount_code WHERE facility_id = $1 ORDER BY is_active DESC, code ASC`, [facilityId])
      res.json({ success: true, data: result.rows.map(serializeDiscount) })
    } catch (error) {
      handleRouteError(res, error, 'Could not load store discount codes.')
    }
  })

  app.post('/api/admin/store/discount-codes', ...requirePermission('billing.manage'), async (req, res) => {
    let client
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const code = normalizedCode(req.body?.code)
      const type = String(req.body?.discountType ?? '')
      const value = integer(req.body?.value, null)
      const minimum = moneyCents(req.body?.minimumOrderCents ?? 0)
      const max = req.body?.maxRedemptions == null || req.body?.maxRedemptions === '' ? null : integer(req.body.maxRedemptions, null)
      if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !['percent', 'amount'].includes(type) || value == null || value <= 0 || (type === 'percent' && value > 100) || minimum == null || (max != null && max <= 0)) {
        return res.status(400).json({ success: false, message: 'Discount code details are invalid.' })
      }
      client = await pool.connect()
      await client.query('BEGIN')
      const result = await client.query(
        `INSERT INTO store_discount_code (facility_id, code, discount_type, value, minimum_order_cents, max_redemptions, starts_at, ends_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE) RETURNING *`,
        [facilityId, code, type, value, minimum, max, req.body?.startsAt || null, req.body?.endsAt || null],
      )
      await recordStoreAudit(client, {
        facilityId,
        actorUserId: integer(req.platformAuth?.user?.id, null),
        action: 'discount_created',
        entityType: 'discount',
        entityId: Number(result.rows[0].id),
        details: { code, discount: serializeDiscount(result.rows[0]) },
      })
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: serializeDiscount(result.rows[0]) })
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {})
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'That store discount code already exists.' })
      handleRouteError(res, error, 'Could not create store discount code.')
    } finally {
      client?.release()
    }
  })

  app.patch('/api/admin/store/discount-codes/:id', ...requirePermission('billing.manage'), async (req, res) => {
    let client
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const id = integer(req.params.id, null)
      if (!id) return res.status(400).json({ success: false, message: 'Invalid discount code.' })
      client = await pool.connect()
      await client.query('BEGIN')
      const current = await client.query(`SELECT * FROM store_discount_code WHERE id = $1 AND facility_id = $2 FOR UPDATE`, [id, facilityId])
      if (!current.rows[0]) throw Object.assign(new Error('Store discount code not found.'), { statusCode: 404 })
      const row = current.rows[0]
      const result = await client.query(
        `UPDATE store_discount_code SET is_active = $3, updated_at = now() WHERE id = $1 AND facility_id = $2 RETURNING *`,
        [id, facilityId, req.body?.isActive == null ? row.is_active : req.body.isActive === true],
      )
      if (result.rows[0].is_active !== row.is_active) {
        await recordStoreAudit(client, {
          facilityId,
          actorUserId: integer(req.platformAuth?.user?.id, null),
          action: result.rows[0].is_active ? 'discount_enabled' : 'discount_disabled',
          entityType: 'discount',
          entityId: id,
          details: { code: row.code, previousIsActive: row.is_active, isActive: result.rows[0].is_active },
        })
      }
      await client.query('COMMIT')
      res.json({ success: true, data: serializeDiscount(result.rows[0]) })
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {})
      handleRouteError(res, error, 'Could not update store discount code.')
    } finally {
      client?.release()
    }
  })

  app.delete('/api/admin/store/discount-codes/:id', ...requirePermission('billing.manage'), async (req, res) => {
    let client
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const id = integer(req.params.id, null)
      if (!id) return res.status(400).json({ success: false, message: 'Invalid discount code.' })
      client = await pool.connect()
      await client.query('BEGIN')
      const result = await client.query(`DELETE FROM store_discount_code WHERE id = $1 AND facility_id = $2 RETURNING *`, [id, facilityId])
      if (!result.rows[0]) throw Object.assign(new Error('Store discount code not found.'), { statusCode: 404 })
      await recordStoreAudit(client, {
        facilityId,
        actorUserId: integer(req.platformAuth?.user?.id, null),
        action: 'discount_deleted',
        entityType: 'discount',
        entityId: id,
        details: { code: result.rows[0].code, discount: serializeDiscount(result.rows[0]) },
      })
      await client.query('COMMIT')
      res.json({ success: true })
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {})
      if (error?.code === '23503') return res.status(409).json({ success: false, message: 'This code has order history and can be disabled instead.' })
      handleRouteError(res, error, 'Could not delete store discount code.')
    } finally {
      client?.release()
    }
  })

  app.get('/api/admin/store/members', ...requirePermission('members.view'), async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const search = String(req.query?.q ?? '').trim()
      const params = [facilityId]
      let where = 'facility_id = $1 AND is_active = TRUE'
      if (search) {
        params.push(`%${search}%`)
        where += ` AND CONCAT_WS(' ', first_name, last_name, email) ILIKE $2`
      }
      const result = await pool.query(
        `SELECT id, first_name, last_name, email FROM member WHERE ${where} ORDER BY first_name, last_name LIMIT 20`,
        params,
      )
      res.json({ success: true, data: result.rows.map((row) => ({ id: Number(row.id), name: `${row.first_name || ''} ${row.last_name || ''}`.trim(), email: row.email ?? null })) })
    } catch (error) {
      handleRouteError(res, error, 'Could not search members.')
    }
  })

  app.post('/api/admin/store/orders', ...requirePermission('billing.manage'), async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const paymentMethod = String(req.body?.paymentMethod ?? '')
      const memberId = req.body?.memberId == null ? null : integer(req.body.memberId, null)
      if (!facilityId || !ADMIN_PAYMENT_METHODS.has(paymentMethod) || (paymentMethod === 'billing_account' && !memberId)) {
        return res.status(400).json({ success: false, message: 'Choose a valid payment method and member for monthly billing.' })
      }
      if (paymentMethod === 'card' && !stripeEnabled()) return res.status(503).json({ success: false, message: 'Secure card entry is unavailable right now. Use another payment method.' })
      const clientKey = String(req.get('Idempotency-Key') ?? `admin-store-${randomUUID()}`)
      const requestKey = normalizeCheckoutRequestKey(clientKey, 'admin-store')
      const result = await createStoreOrder(pool, {
        facilityId,
        memberId,
        source: 'admin',
        rawItems: req.body?.items,
        paymentMethod,
        discountCode: req.body?.discountCode,
        idempotencyKey: requestKey,
        purchaserName: String(req.body?.purchaserName ?? '').trim() || null,
        purchaserEmail: String(req.body?.purchaserEmail ?? '').trim() || null,
        externalReference: String(req.body?.externalReference ?? '').trim() || null,
        actorUserId: integer(req.platformAuth?.user?.id, null),
        allowInternal: true,
        requireBillingPayer: false,
      })
      if (paymentMethod === 'card' && result.order.status === 'awaiting_payment') {
        result.order.stripeCheckoutUrl = await createCardCheckout(pool, result.order)
      } else {
        await sendReceiptIfNeeded(pool, result.order.id).catch((error) => {
          console.warn('[store] receipt email failed:', error?.message || error)
        })
      }
      res.status(result.reused ? 200 : 201).json({ success: true, data: result.order, reused: result.reused })
    } catch (error) {
      handleRouteError(res, error, 'Could not record store sale.')
    }
  })

  app.patch('/api/admin/store/orders/:id', ...requirePermission('billing.manage'), async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const orderId = integer(req.params.id, null)
      const status = String(req.body?.status ?? '')
      const action = String(req.body?.action ?? '')
      if (!orderId || !(['fulfilled', 'cancelled'].includes(status) || ['collect_payment', 'send_receipt'].includes(action))) {
        return res.status(400).json({ success: false, message: 'Choose a valid order status.' })
      }
      if (action === 'send_receipt') {
        const purchaserEmail = String(req.body?.purchaserEmail ?? '').trim()
        const order = await sendStoreOrderReceipt(pool, {
          orderId,
          facilityId,
          purchaserEmail,
          actorUserId: integer(req.platformAuth?.user?.id, null),
        })
        return res.json({ success: true, data: order })
      }
      if (action === 'collect_payment') {
        const order = await collectStoreOrderPayment(pool, {
          orderId,
          facilityId,
          actorUserId: integer(req.platformAuth?.user?.id, null),
        })
        await sendReceiptIfNeeded(pool, orderId).catch((error) => {
          console.warn('[store] receipt email failed:', error?.message || error)
        })
        return res.json({ success: true, data: order })
      }
      if (status === 'cancelled') {
        const order = await cancelStoreOrder(pool, { orderId, facilityId, actorUserId: integer(req.platformAuth?.user?.id, null) })
        return res.json({ success: true, data: order })
      }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const update = await client.query(
          `UPDATE store_order SET status = 'fulfilled', picked_up_at = COALESCE(picked_up_at, now()), updated_at = now()
            WHERE id = $1 AND facility_id = $2 AND status = 'placed' RETURNING *`,
          [orderId, facilityId],
        )
        if (!update.rows[0]) throw Object.assign(new Error('Only placed orders can be marked picked up.'), { statusCode: 409 })
        const order = await getOrder(client, orderId)
        await recordStoreAudit(client, {
          facilityId,
          actorUserId: integer(req.platformAuth?.user?.id, null),
          action: 'sale_fulfilled',
          entityType: 'sale',
          entityId: orderId,
          details: { orderNumber: order.orderNumber, totalCents: order.totalCents },
        })
        await client.query('COMMIT')
        res.json({ success: true, data: order })
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      handleRouteError(res, error, 'Could not update store order.')
    }
  })
}
