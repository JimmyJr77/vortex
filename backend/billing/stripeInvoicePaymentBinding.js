function objectId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

export class StripeInvoicePaymentBindingConflict extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'StripeInvoicePaymentBindingConflict'
    this.code = 'stripe_invoice_payment_binding_conflict'
    this.details = details
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(String))]
}

function conflict(message, details = {}) {
  throw new StripeInvoicePaymentBindingConflict(message, details)
}

export function assertStripeUsdCurrency(object, {
  source = 'object',
  ...details
} = {}) {
  const currency = typeof object?.currency === 'string'
    ? object.currency.trim().toLowerCase()
    : null
  if (currency !== 'usd') {
    conflict(
      `Stripe ${source} must use USD before it can be recorded in the billing ledger.`,
      { ...details, stripeCurrency: currency },
    )
  }
  return currency
}

function paidInvoiceAmount(invoice, details = {}) {
  const amountPaid = invoice?.amount_paid
  if (!Number.isSafeInteger(amountPaid) || amountPaid < 0) {
    conflict(
      `Stripe invoice ${objectId(invoice) ?? '(missing)'} has no exact paid amount to verify.`,
      { ...details, stripeInvoiceId: objectId(invoice), invoiceAmountPaid: amountPaid ?? null },
    )
  }
  return amountPaid
}

function assertPaidInvoice(invoice, details = {}) {
  if (invoice?.paid === true || invoice?.status === 'paid') return
  conflict(
    `Stripe invoice ${objectId(invoice) ?? '(missing)'} is not conclusively paid.`,
    {
      ...details,
      stripeInvoiceId: objectId(invoice),
      stripeInvoiceStatus: invoice?.status ?? null,
      stripeInvoicePaid: invoice?.paid ?? null,
    },
  )
}

function paymentReference(invoicePayment) {
  const payment = invoicePayment?.payment
  const type = payment?.type
  if (type === 'payment_intent') {
    const id = objectId(payment.payment_intent)
    return { type, id, paymentIntentId: id }
  }
  if (type === 'charge') return { type, id: objectId(payment.charge), paymentIntentId: null }
  if (type === 'payment_record') return { type, id: objectId(payment.payment_record), paymentIntentId: null }
  return { type: type ?? null, id: null, paymentIntentId: null }
}

function paidBindings(rows, {
  source,
  stripeInvoiceId = null,
  stripePaymentIntentId = null,
} = {}) {
  const result = []
  for (const [index, invoicePayment] of rows.entries()) {
    const status = invoicePayment?.status
    if (status !== 'paid') {
      conflict(
        `Stripe ${source} contains a non-paid Invoice Payment, so the whole paid binding is ambiguous.`,
        {
          source,
          stripeInvoiceId,
          stripePaymentIntentId,
          invoicePaymentIndex: index,
          stripeInvoicePaymentId: objectId(invoicePayment),
          invoicePaymentStatus: status ?? null,
        },
      )
    }

    const invoiceId = objectId(invoicePayment.invoice)
    const payment = paymentReference(invoicePayment)
    const amountPaid = invoicePayment.amount_paid
    if (
      !invoiceId
      || !payment.type
      || !payment.id
      || !Number.isSafeInteger(amountPaid)
      || amountPaid < 0
    ) {
      conflict(
        `Stripe ${source} contains an incomplete paid Invoice Payment.`,
        {
          source,
          stripeInvoiceId,
          stripePaymentIntentId,
          invoicePaymentIndex: index,
          stripeInvoicePaymentId: objectId(invoicePayment),
          bindingInvoiceId: invoiceId,
          bindingPaymentType: payment.type,
          bindingPaymentId: payment.id,
          bindingAmountPaid: amountPaid ?? null,
        },
      )
    }
    assertStripeUsdCurrency(invoicePayment, {
      source: `${source} Invoice Payment`,
      stripeInvoiceId: invoiceId,
      stripePaymentIntentId: payment.paymentIntentId,
      stripeInvoicePaymentId: objectId(invoicePayment),
    })
    if (stripeInvoiceId && invoiceId !== stripeInvoiceId) {
      conflict(
        `Stripe ${source} returned a paid Invoice Payment for a different invoice.`,
        {
          source,
          stripeInvoiceId,
          bindingInvoiceId: invoiceId,
          stripeInvoicePaymentId: objectId(invoicePayment),
        },
      )
    }
    if (stripePaymentIntentId && payment.paymentIntentId !== stripePaymentIntentId) {
      conflict(
        `Stripe ${source} returned a paid Invoice Payment for a different payment.`,
        {
          source,
          stripePaymentIntentId,
          bindingPaymentType: payment.type,
          bindingPaymentId: payment.id,
          stripeInvoicePaymentId: objectId(invoicePayment),
        },
      )
    }
    result.push({
      invoicePayment,
      invoiceId,
      invoice: invoicePayment.invoice,
      paymentType: payment.type,
      paymentId: payment.id,
      paymentIntentId: payment.paymentIntentId,
      amountPaid,
    })
  }
  return result
}

function completePageData(page, details = {}) {
  if (!page || !Array.isArray(page.data) || page.has_more !== false) {
    conflict(
      'Stripe Invoice Payment pagination is incomplete, so the paid binding cannot be verified safely.',
      {
        ...details,
        hasMore: page?.has_more ?? null,
        hasData: Array.isArray(page?.data),
      },
    )
  }
  return page.data
}

/**
 * Read the complete, all-status Invoice Payment inventory for one invoice or
 * PaymentIntent. Filtering to `paid` is unsafe: an extra open/canceled binding
 * is still a competing or ambiguous collector and must remain visible to the
 * caller's exact-cardinality proof.
 */
export async function listStripeInvoicePaymentInventory(stripe, {
  stripeInvoiceId = null,
  stripePaymentIntentId = null,
  expandInvoice = false,
  embeddedPayments = null,
} = {}) {
  const invoiceId = objectId(stripeInvoiceId)
  const paymentIntentId = objectId(stripePaymentIntentId)
  if (Boolean(invoiceId) === Boolean(paymentIntentId)) {
    conflict('Exactly one Stripe invoice or PaymentIntent is required to list Invoice Payments.', {
      stripeInvoiceId: invoiceId,
      stripePaymentIntentId: paymentIntentId,
    })
  }

  if (!stripe?.invoicePayments?.list) {
    if (embeddedPayments) {
      return completePageData(embeddedPayments, {
        stripeInvoiceId: invoiceId,
        stripePaymentIntentId: paymentIntentId,
      })
    }
    return undefined
  }

  const rows = []
  const cursors = new Set()
  let startingAfter = null
  do {
    const page = await stripe.invoicePayments.list({
      ...(invoiceId
        ? { invoice: invoiceId }
        : { payment: { type: 'payment_intent', payment_intent: paymentIntentId } }),
      limit: 100,
      ...(expandInvoice ? { expand: ['data.invoice'] } : {}),
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    if (!page || !Array.isArray(page.data) || typeof page.has_more !== 'boolean') {
      conflict('Stripe Invoice Payment pagination is incomplete, so the binding cannot be verified safely.', {
        stripeInvoiceId: invoiceId,
        stripePaymentIntentId: paymentIntentId,
        hasMore: page?.has_more ?? null,
        hasData: Array.isArray(page?.data),
      })
    }
    rows.push(...page.data)
    if (!page.has_more) break
    startingAfter = objectId(page.data.at(-1))
    if (!startingAfter || cursors.has(startingAfter)) {
      conflict('Stripe Invoice Payment pagination returned no safe continuation cursor.', {
        stripeInvoiceId: invoiceId,
        stripePaymentIntentId: paymentIntentId,
        continuationCursor: startingAfter,
      })
    }
    cursors.add(startingAfter)
  } while (startingAfter)
  return rows
}

function exactWholeInvoiceBinding(bindings, invoice, details = {}) {
  const invoiceId = objectId(invoice)
  assertStripeUsdCurrency(invoice, {
    source: 'invoice',
    ...details,
    stripeInvoiceId: invoiceId,
  })
  const amountPaid = paidInvoiceAmount(invoice, details)
  assertPaidInvoice(invoice, details)
  if (bindings.length === 0) {
    if (amountPaid === 0) return null
    conflict(
      `Stripe invoice ${invoiceId ?? '(missing)'} has no complete paid Invoice Payment binding.`,
      { ...details, stripeInvoiceId: invoiceId, invoiceAmountPaid: amountPaid },
    )
  }
  if (bindings.length !== 1) {
    conflict(
      `Stripe invoice ${invoiceId ?? '(missing)'} has multiple paid Invoice Payment bindings.`,
      {
        ...details,
        stripeInvoiceId: invoiceId,
        stripeInvoicePaymentIds: bindings.map(({ invoicePayment }) => objectId(invoicePayment)),
        stripePaymentIntentIds: unique(bindings.map(({ paymentIntentId }) => paymentIntentId)),
        bindingAmountsPaid: bindings.map(({ amountPaid: bindingAmount }) => bindingAmount),
      },
    )
  }
  const binding = bindings[0]
  if (binding.amountPaid !== amountPaid) {
    conflict(
      `Stripe Invoice Payment amount does not match invoice ${invoiceId ?? '(missing)'}.`,
      {
        ...details,
        stripeInvoiceId: invoiceId,
        stripeInvoicePaymentId: objectId(binding.invoicePayment),
        invoiceAmountPaid: amountPaid,
        bindingAmountPaid: binding.amountPaid,
      },
    )
  }
  return binding
}

async function currentInvoiceBinding(stripe, invoice) {
  const invoiceId = objectId(invoice)
  if (!invoiceId) return undefined
  const rows = await listStripeInvoicePaymentInventory(stripe, {
    stripeInvoiceId: invoiceId,
    embeddedPayments: invoice?.payments ?? null,
  })
  if (rows === undefined) return undefined
  const bindings = paidBindings(
    rows,
    {
      source: stripe?.invoicePayments?.list ? 'invoice payment list' : 'embedded invoice payments',
      stripeInvoiceId: invoiceId,
    },
  )
  return exactWholeInvoiceBinding(bindings, invoice, {
    source: stripe?.invoicePayments?.list ? 'invoice payment list' : 'embedded invoice payments',
  })
}

/**
 * Resolve the PaymentIntent that actually paid an invoice across old and
 * current Stripe API response shapes. Current Stripe versions expose this
 * relationship through Invoice Payments rather than PaymentIntent.invoice.
 */
export async function resolveStripeInvoicePaymentIntentId(stripe, invoice) {
  const invoiceId = objectId(invoice)
  assertStripeUsdCurrency(invoice, { source: 'invoice', stripeInvoiceId: invoiceId })
  assertPaidInvoice(invoice)
  const direct = objectId(invoice?.payment_intent)
  const binding = await currentInvoiceBinding(stripe, invoice)

  // A missing Invoice Payments surface is possible only for legacy response
  // shapes. Keep the old direct relationship as that narrow compatibility path.
  if (binding === undefined) return direct

  if (direct && direct !== binding?.paymentIntentId) {
    conflict(
      `Stripe invoice ${invoiceId ?? '(missing)'} has conflicting payment bindings.`,
      {
        stripeInvoiceId: invoiceId,
        directStripePaymentIntentId: direct,
        boundStripePaymentIntentId: binding?.paymentIntentId ?? null,
        bindingPaymentType: binding?.paymentType ?? null,
      },
    )
  }
  return binding?.paymentIntentId ?? null
}

async function retrieveBoundInvoice(stripe, binding, details = {}) {
  if (typeof binding.invoice === 'object' && binding.invoice && binding.invoice.deleted !== true) {
    return binding.invoice
  }
  if (!stripe?.invoices?.retrieve) {
    conflict(
      `Stripe invoice ${binding.invoiceId} cannot be retrieved to verify its paid amount.`,
      { ...details, stripeInvoiceId: binding.invoiceId },
    )
  }
  return stripe.invoices.retrieve(binding.invoiceId)
}

function verifyPaymentIntentAmount(paymentIntent, binding, invoice) {
  const paymentIntentId = objectId(paymentIntent)
  assertStripeUsdCurrency(paymentIntent, {
    source: 'PaymentIntent',
    stripePaymentIntentId: paymentIntentId,
  })
  assertStripeUsdCurrency(invoice, {
    source: 'invoice',
    stripePaymentIntentId: paymentIntentId,
    stripeInvoiceId: objectId(invoice),
  })
  const amountReceived = paymentIntent?.amount_received
  if (!Number.isSafeInteger(amountReceived) || amountReceived < 0) {
    conflict(
      `Stripe PaymentIntent ${paymentIntentId ?? '(missing)'} has no exact received amount to verify.`,
      { stripePaymentIntentId: paymentIntentId, paymentIntentAmountReceived: amountReceived ?? null },
    )
  }
  if (paymentIntent?.status !== 'succeeded') {
    conflict(
      `Stripe PaymentIntent ${paymentIntentId ?? '(missing)'} is not succeeded.`,
      { stripePaymentIntentId: paymentIntentId, paymentIntentStatus: paymentIntent?.status ?? null },
    )
  }
  const paymentIntentCustomerId = objectId(paymentIntent?.customer)
  const invoiceCustomerId = objectId(invoice?.customer)
  if (
    !paymentIntentCustomerId
    || !invoiceCustomerId
    || paymentIntentCustomerId !== invoiceCustomerId
  ) {
    conflict(
      `Stripe PaymentIntent ${paymentIntentId ?? '(missing)'} and its paid invoice do not have the same customer.`,
      {
        stripePaymentIntentId: paymentIntentId,
        stripeInvoiceId: objectId(invoice),
        paymentIntentCustomerId,
        invoiceCustomerId,
      },
    )
  }
  const invoiceAmountPaid = paidInvoiceAmount(invoice, { stripePaymentIntentId: paymentIntentId })
  if (binding.amountPaid !== invoiceAmountPaid || binding.amountPaid !== amountReceived) {
    conflict(
      `Stripe PaymentIntent ${paymentIntentId ?? '(missing)'} does not represent the whole paid invoice amount.`,
      {
        stripePaymentIntentId: paymentIntentId,
        stripeInvoiceId: objectId(invoice),
        stripeInvoicePaymentId: objectId(binding.invoicePayment),
        bindingAmountPaid: binding.amountPaid,
        invoiceAmountPaid,
        paymentIntentAmountReceived: amountReceived,
      },
    )
  }
}

/**
 * Resolve the paid invoice, if any, that owns a succeeded PaymentIntent.
 * Null means only that the current complete read reported no paid Invoice
 * Payment binding. Callers must still require another durable payment owner or
 * defer settlement because webhook ordering can expose the binding later.
 */
export async function resolveStripePaymentIntentInvoice(stripe, paymentIntent) {
  const paymentIntentId = objectId(paymentIntent)
  assertStripeUsdCurrency(paymentIntent, {
    source: 'PaymentIntent',
    stripePaymentIntentId: paymentIntentId,
  })
  const direct = paymentIntent?.invoice
  const directInvoiceId = objectId(direct)

  // PaymentIntent.invoice is retained only as an old-API compatibility path.
  // Whenever Invoice Payments are available, their paid, complete list is the
  // authoritative relationship and amount evidence.
  if (!paymentIntentId || !stripe?.invoicePayments?.list) {
    if (!directInvoiceId) {
      if (!paymentIntentId) return null
      conflict(
        `Stripe Invoice Payments are unavailable while resolving PaymentIntent ${paymentIntentId}.`,
        { stripePaymentIntentId: paymentIntentId },
      )
    }
    let invoice = direct
    if (typeof direct !== 'object' && !stripe?.invoices?.retrieve) {
      conflict(
        `Stripe invoice ${directInvoiceId} cannot be retrieved for PaymentIntent ${paymentIntentId ?? '(missing)'}.`,
        { stripePaymentIntentId: paymentIntentId, stripeInvoiceId: directInvoiceId },
      )
    }
    if (typeof direct !== 'object') invoice = await stripe.invoices.retrieve(String(direct))
    assertPaidInvoice(invoice, { stripePaymentIntentId: paymentIntentId })
    verifyPaymentIntentAmount(paymentIntent, {
      amountPaid: paidInvoiceAmount(invoice, { stripePaymentIntentId: paymentIntentId }),
      invoicePayment: null,
    }, invoice)
    return invoice
  }

  const rows = await listStripeInvoicePaymentInventory(stripe, {
    stripePaymentIntentId: paymentIntentId,
    expandInvoice: true,
  })
  const bindings = paidBindings(
    rows,
    { source: 'invoice payment list', stripePaymentIntentId: paymentIntentId },
  )
  if (bindings.length === 0) {
    if (directInvoiceId) {
      conflict(
        `Stripe PaymentIntent ${paymentIntentId} has a direct invoice but no paid Invoice Payment binding.`,
        { stripePaymentIntentId: paymentIntentId, directStripeInvoiceId: directInvoiceId },
      )
    }
    return null
  }
  if (bindings.length !== 1) {
    conflict(
      `Stripe PaymentIntent ${paymentIntentId} is bound to multiple paid invoices.`,
      {
        stripePaymentIntentId: paymentIntentId,
        stripeInvoiceIds: unique(bindings.map(({ invoiceId }) => invoiceId)),
        stripeInvoicePaymentIds: bindings.map(({ invoicePayment }) => objectId(invoicePayment)),
        bindingAmountsPaid: bindings.map(({ amountPaid }) => amountPaid),
      },
    )
  }

  const binding = bindings[0]
  if (directInvoiceId && directInvoiceId !== binding.invoiceId) {
    conflict(
      `Stripe PaymentIntent ${paymentIntentId} has conflicting invoice bindings.`,
      {
        stripePaymentIntentId: paymentIntentId,
        directStripeInvoiceId: directInvoiceId,
        boundStripeInvoiceId: binding.invoiceId,
      },
    )
  }
  const invoice = await retrieveBoundInvoice(stripe, binding, { stripePaymentIntentId: paymentIntentId })
  if (objectId(invoice) !== binding.invoiceId) {
    conflict(
      `Stripe retrieved a different invoice for PaymentIntent ${paymentIntentId}.`,
      {
        stripePaymentIntentId: paymentIntentId,
        boundStripeInvoiceId: binding.invoiceId,
        retrievedStripeInvoiceId: objectId(invoice),
      },
    )
  }
  assertPaidInvoice(invoice, { stripePaymentIntentId: paymentIntentId })
  verifyPaymentIntentAmount(paymentIntent, binding, invoice)
  return invoice
}

/**
 * Independently retrieve and reverse-resolve the PaymentIntent discovered from
 * a paid invoice before any ledger write. This proves the Invoice, Invoice
 * Payment, and PaymentIntent agree on identity, customer, amount, status, and
 * currency in both directions.
 */
export async function verifyStripeInvoicePaymentIntent(stripe, invoice, paymentIntentId) {
  const expectedPaymentIntentId = objectId(paymentIntentId)
  if (!expectedPaymentIntentId) return null
  if (!stripe?.paymentIntents?.retrieve) {
    conflict(
      `Stripe PaymentIntent ${expectedPaymentIntentId} cannot be retrieved to verify its paid invoice binding.`,
      {
        stripePaymentIntentId: expectedPaymentIntentId,
        stripeInvoiceId: objectId(invoice),
      },
    )
  }
  const paymentIntent = await stripe.paymentIntents.retrieve(expectedPaymentIntentId, {
    expand: ['payment_method', 'latest_charge'],
  })
  if (objectId(paymentIntent) !== expectedPaymentIntentId) {
    conflict(
      `Stripe retrieved a different PaymentIntent for invoice ${objectId(invoice) ?? '(missing)'}.`,
      {
        stripeInvoiceId: objectId(invoice),
        expectedStripePaymentIntentId: expectedPaymentIntentId,
        retrievedStripePaymentIntentId: objectId(paymentIntent),
      },
    )
  }
  const boundInvoice = await resolveStripePaymentIntentInvoice(stripe, paymentIntent)
  if (objectId(boundInvoice) !== objectId(invoice)) {
    conflict(
      `Stripe PaymentIntent ${expectedPaymentIntentId} does not resolve back to its paid invoice.`,
      {
        stripePaymentIntentId: expectedPaymentIntentId,
        expectedStripeInvoiceId: objectId(invoice),
        resolvedStripeInvoiceId: objectId(boundInvoice),
      },
    )
  }
  if (
    objectId(boundInvoice?.customer) !== objectId(invoice?.customer)
    || paidInvoiceAmount(boundInvoice) !== paidInvoiceAmount(invoice)
  ) {
    conflict(
      `Stripe PaymentIntent ${expectedPaymentIntentId} resolves to invoice evidence that changed before ledger recording.`,
      {
        stripePaymentIntentId: expectedPaymentIntentId,
        stripeInvoiceId: objectId(invoice),
        eventInvoiceCustomerId: objectId(invoice?.customer),
        retrievedInvoiceCustomerId: objectId(boundInvoice?.customer),
        eventInvoiceAmountPaid: invoice?.amount_paid ?? null,
        retrievedInvoiceAmountPaid: boundInvoice?.amount_paid ?? null,
      },
    )
  }
  return paymentIntent
}
