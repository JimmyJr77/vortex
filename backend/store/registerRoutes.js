import { randomUUID } from 'node:crypto'
import { checkoutFingerprint, checkoutIdempotencyConflict, normalizeCheckoutRequestKey, stripeCheckoutIdempotencyKey } from '../billing/checkoutIdempotency.js'
import { getStripeClient, stripeEnabled } from '../billing/stripeBilling.js'
import { sendStoreOrderReceiptEmail } from '../email/storeReceiptEmail.js'
import { publicAppUrl } from '../email/publicAppUrl.js'

const PICKUP_NOTE = 'Pickup at Vortex Athletics. We do not ship store items.'
const MEMBER_PAYMENT_METHODS = new Set(['billing_account', 'card', 'cash', 'check', 'mobile'])
const ADMIN_PAYMENT_METHODS = new Set(['billing_account', 'card', 'cash', 'check', 'mobile'])

function integer(value, fallback = null) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : fallback
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
  return {
    id: Number(row.id),
    sku: row.sku,
    name: row.name,
    description: row.description ?? null,
    category: row.category,
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

async function sendReceiptIfNeeded(pool, orderId) {
  let order
  const client = await pool.connect()
  try {
    order = await getOrder(client, orderId)
  } finally {
    client.release()
  }
  if (!order || !order.purchaserEmail || !['placed', 'fulfilled'].includes(order.status)) return { sent: false }
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
    const awaitsPayment = source !== 'admin' && ['card', 'cash', 'check', 'mobile'].includes(paymentMethod)
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
    await client.query('COMMIT')
    return { order, reused: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function createCardCheckout(pool, order) {
  if (order.stripeCheckoutUrl) return order.stripeCheckoutUrl
  if (!stripeEnabled()) {
    const error = new Error('Online card payments are not enabled yet. Please choose monthly account billing or ask the front desk.')
    error.statusCode = 503
    throw error
  }
  const stripe = await getStripeClient()
  if (!stripe) {
    const error = new Error('Online card payments are not available right now.')
    error.statusCode = 503
    throw error
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
  if (!session?.url) throw new Error('Stripe did not return a checkout URL.')
  await pool.query(
    `UPDATE store_order
        SET stripe_checkout_session_id = $2, stripe_checkout_session_url = $3, updated_at = now()
      WHERE id = $1`,
    [order.id, session.id ?? null, session.url],
  )
  return session.url
}

export async function completeStoreStripeCheckout(pool, session) {
  const orderId = integer(session?.metadata?.storeOrderId, null)
  if (orderId == null) return { handled: false }
  const client = await pool.connect()
  let order
  try {
    await client.query('BEGIN')
    const current = await client.query(`SELECT * FROM store_order WHERE id = $1 FOR UPDATE`, [orderId])
    const row = current.rows[0]
    if (!row || row.payment_method !== 'card') {
      await client.query('COMMIT')
      return { handled: false }
    }
    if (!['placed', 'fulfilled'].includes(row.status)) {
      await client.query(
        `UPDATE store_order
            SET status = 'placed', payment_status = 'paid',
                external_reference = COALESCE($2, external_reference), updated_at = now()
          WHERE id = $1`,
        [orderId, session.payment_intent ?? session.id ?? null],
      )
      await consumeDiscount(client, row.discount_code_id)
    }
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
  return { handled: true, order }
}

async function cancelStoreOrder(pool, { orderId, facilityId, actorUserId }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query(
      `SELECT * FROM store_order WHERE id = $1 AND facility_id = $2 FOR UPDATE`,
      [orderId, facilityId],
    )
    const row = current.rows[0]
    if (!row) {
      const error = new Error('Store order not found.')
      error.statusCode = 404
      throw error
    }
    if (row.status === 'cancelled') {
      const order = await getOrder(client, orderId)
      await client.query('COMMIT')
      return order
    }
    if (row.payment_status === 'paid' || row.payment_status === 'external') {
      const error = new Error('Paid orders require a recorded refund before they can be cancelled.')
      error.statusCode = 409
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
      `UPDATE store_order SET status = 'cancelled', updated_at = now() WHERE id = $1`,
      [orderId],
    )
    const order = await getOrder(client, orderId)
    await client.query('COMMIT')
    return order
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
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
        return res.status(400).json({ success: false, message: 'Choose a supported store payment method.' })
      }
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
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const name = String(req.body?.name ?? '').trim()
      const sku = String(req.body?.sku ?? '').trim().toUpperCase()
      const priceCents = moneyCents(req.body?.priceCents)
      const inventory = req.body?.inventoryQuantity == null || req.body?.inventoryQuantity === '' ? null : integer(req.body.inventoryQuantity, null)
      const category = String(req.body?.category ?? 'other')
      if (!name || !sku || priceCents == null || !['apparel', 'food_drink', 'other'].includes(category) || (inventory != null && inventory < 0)) {
        return res.status(400).json({ success: false, message: 'Name, SKU, valid price, category, and inventory are required.' })
      }
      const result = await pool.query(
        `INSERT INTO store_product (facility_id, sku, name, description, category, price_cents, inventory_quantity, is_public, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [facilityId, sku, name, String(req.body?.description ?? '').trim() || null, category, priceCents, inventory, req.body?.isPublic !== false, integer(req.body?.sortOrder, 0)],
      )
      res.status(201).json({ success: true, data: serializeProduct(result.rows[0]) })
    } catch (error) {
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'That SKU is already in use.' })
      handleRouteError(res, error, 'Could not create store product.')
    }
  })

  app.patch('/api/admin/store/products/:id', ...requirePermission('billing.manage'), async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const id = integer(req.params.id, null)
      if (!id) return res.status(400).json({ success: false, message: 'Invalid product.' })
      const existing = await pool.query(`SELECT * FROM store_product WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      if (!existing.rows[0]) return res.status(404).json({ success: false, message: 'Store product not found.' })
      const current = existing.rows[0]
      const next = {
        name: req.body?.name == null ? current.name : String(req.body.name).trim(),
        sku: req.body?.sku == null ? current.sku : String(req.body.sku).trim().toUpperCase(),
        description: req.body?.description == null ? current.description : String(req.body.description).trim() || null,
        category: req.body?.category == null ? current.category : String(req.body.category),
        priceCents: req.body?.priceCents == null ? Number(current.price_cents) : moneyCents(req.body.priceCents),
        inventory: req.body?.inventoryQuantity === undefined ? current.inventory_quantity : (req.body.inventoryQuantity == null || req.body.inventoryQuantity === '' ? null : integer(req.body.inventoryQuantity, null)),
        isPublic: req.body?.isPublic == null ? current.is_public : req.body.isPublic === true,
        isActive: req.body?.isActive == null ? current.is_active : req.body.isActive === true,
        sortOrder: req.body?.sortOrder == null ? Number(current.sort_order) : integer(req.body.sortOrder, null),
      }
      if (!next.name || !next.sku || next.priceCents == null || next.priceCents < 0 || next.inventory != null && next.inventory < 0 || !['apparel', 'food_drink', 'other'].includes(next.category) || next.sortOrder == null) {
        return res.status(400).json({ success: false, message: 'Product details are invalid.' })
      }
      const result = await pool.query(
        `UPDATE store_product SET sku = $3, name = $4, description = $5, category = $6,
             price_cents = $7, inventory_quantity = $8, is_public = $9, is_active = $10,
             sort_order = $11, updated_at = now()
           WHERE id = $1 AND facility_id = $2 RETURNING *`,
        [id, facilityId, next.sku, next.name, next.description, next.category, next.priceCents, next.inventory, next.isPublic, next.isActive, next.sortOrder],
      )
      res.json({ success: true, data: serializeProduct(result.rows[0]) })
    } catch (error) {
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'That SKU is already in use.' })
      handleRouteError(res, error, 'Could not update store product.')
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
        await client.query(`INSERT INTO store_inventory_adjustment (product_id, quantity_delta, reason, created_by_user_id) VALUES ($1, $2, $3, $4)`, [productId, delta, String(req.body.reason).trim(), integer(req.platformAuth?.user?.id, null)])
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
      const result = await pool.query(
        `INSERT INTO store_discount_code (facility_id, code, discount_type, value, minimum_order_cents, max_redemptions, starts_at, ends_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE) RETURNING *`,
        [facilityId, code, type, value, minimum, max, req.body?.startsAt || null, req.body?.endsAt || null],
      )
      res.status(201).json({ success: true, data: serializeDiscount(result.rows[0]) })
    } catch (error) {
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'That store discount code already exists.' })
      handleRouteError(res, error, 'Could not create store discount code.')
    }
  })

  app.patch('/api/admin/store/discount-codes/:id', ...requirePermission('billing.manage'), async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const id = integer(req.params.id, null)
      if (!id) return res.status(400).json({ success: false, message: 'Invalid discount code.' })
      const current = await pool.query(`SELECT * FROM store_discount_code WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      if (!current.rows[0]) return res.status(404).json({ success: false, message: 'Store discount code not found.' })
      const row = current.rows[0]
      const result = await pool.query(
        `UPDATE store_discount_code SET is_active = $3, updated_at = now() WHERE id = $1 AND facility_id = $2 RETURNING *`,
        [id, facilityId, req.body?.isActive == null ? row.is_active : req.body.isActive === true],
      )
      res.json({ success: true, data: serializeDiscount(result.rows[0]) })
    } catch (error) {
      handleRouteError(res, error, 'Could not update store discount code.')
    }
  })

  app.delete('/api/admin/store/discount-codes/:id', ...requirePermission('billing.manage'), async (req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool, req.platformAuth)
      const id = integer(req.params.id, null)
      const result = await pool.query(`DELETE FROM store_discount_code WHERE id = $1 AND facility_id = $2 RETURNING id`, [id, facilityId])
      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Store discount code not found.' })
      res.json({ success: true })
    } catch (error) {
      if (error?.code === '23503') return res.status(409).json({ success: false, message: 'This code has order history and can be disabled instead.' })
      handleRouteError(res, error, 'Could not delete store discount code.')
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
      await sendReceiptIfNeeded(pool, result.order.id).catch((error) => {
        console.warn('[store] receipt email failed:', error?.message || error)
      })
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
      if (!orderId || !(['fulfilled', 'cancelled'].includes(status) || action === 'collect_payment')) {
        return res.status(400).json({ success: false, message: 'Choose a valid order status.' })
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
      const update = await pool.query(
        `UPDATE store_order SET status = 'fulfilled', picked_up_at = COALESCE(picked_up_at, now()), updated_at = now()
          WHERE id = $1 AND facility_id = $2 AND status = 'placed' RETURNING id`,
        [orderId, facilityId],
      )
      if (!update.rows[0]) return res.status(409).json({ success: false, message: 'Only placed orders can be marked picked up.' })
      const client = await pool.connect()
      try {
        const order = await getOrder(client, orderId)
        res.json({ success: true, data: order })
      } finally {
        client.release()
      }
    } catch (error) {
      handleRouteError(res, error, 'Could not update store order.')
    }
  })
}
