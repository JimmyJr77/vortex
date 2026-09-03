import test from 'node:test'
import assert from 'node:assert/strict'

import {
  listStripeInvoicePaymentInventory,
  resolveStripeInvoicePaymentIntentId,
  resolveStripePaymentIntentInvoice,
  StripeInvoicePaymentBindingConflict,
  verifyStripeInvoicePaymentIntent,
} from '../stripeInvoicePaymentBinding.js'

function paidBinding({
  id = 'inpay_household',
  invoice = 'in_household',
  paymentIntentId = 'pi_household',
  amountPaid = 7125,
  currency = 'usd',
} = {}) {
  return {
    id,
    object: 'invoice_payment',
    invoice,
    status: 'paid',
    amount_paid: amountPaid,
    currency,
    payment: { type: 'payment_intent', payment_intent: paymentIntentId },
  }
}

function paidInvoice(overrides = {}) {
  return {
    id: 'in_household',
    status: 'paid',
    paid: true,
    amount_paid: 7125,
    currency: 'usd',
    customer: 'cus_household',
    ...overrides,
  }
}

test('resolves a complete paid Invoice Payment to its PaymentIntent', async () => {
  const calls = []
  const stripe = {
    invoicePayments: {
      async list(params) {
        calls.push(params)
        return { data: [paidBinding()], has_more: false }
      },
    },
  }

  const paymentIntentId = await resolveStripeInvoicePaymentIntentId(stripe, paidInvoice())

  assert.equal(paymentIntentId, 'pi_household')
  assert.deepEqual(calls, [{ invoice: 'in_household', limit: 100 }])
})

test('a fresh all-status inventory rejects an extra open binding even when embedded payments look complete', async () => {
  let listed = 0
  const stripe = {
    invoicePayments: {
      async list() {
        listed += 1
        return {
          has_more: false,
          data: [
            paidBinding(),
            {
              id: 'inpay_open',
              invoice: 'in_household',
              status: 'open',
              amount_paid: null,
              currency: 'usd',
              payment: { type: 'payment_intent', payment_intent: 'pi_unpaid' },
            },
          ],
        }
      },
    },
  }
  const invoice = paidInvoice({
    payment_intent: 'pi_household',
    payments: {
      has_more: false,
      data: [
        {
          id: 'inpay_open',
          status: 'open',
          payment: { type: 'payment_intent', payment_intent: 'pi_unpaid' },
        },
        paidBinding(),
      ],
    },
  })

  await assert.rejects(
    resolveStripeInvoicePaymentIntentId(stripe, invoice),
    (error) => (
      error instanceof StripeInvoicePaymentBindingConflict
      && error.details.invoicePaymentStatus === 'open'
    ),
  )
  assert.equal(listed, 1)
})

test('fully paginates the all-status Invoice Payment inventory', async () => {
  const calls = []
  const stripe = {
    invoicePayments: {
      async list(params) {
        calls.push(params)
        if (!params.starting_after) {
          return { data: [paidBinding({ id: 'inpay_first' })], has_more: true }
        }
        return { data: [paidBinding({ id: 'inpay_second' })], has_more: false }
      },
    },
  }

  const rows = await listStripeInvoicePaymentInventory(stripe, {
    stripeInvoiceId: 'in_household',
  })

  assert.deepEqual(rows.map((row) => row.id), ['inpay_first', 'inpay_second'])
  assert.equal(calls[1].starting_after, 'inpay_first')
})

test('does not trust an incomplete or unpaid embedded binding', async () => {
  await assert.rejects(
    resolveStripeInvoicePaymentIntentId(null, paidInvoice({
      payment_intent: 'pi_unverified',
      payments: {
        has_more: false,
        data: [{
          id: 'inpay_incomplete',
          invoice: 'in_household',
          payment: { type: 'payment_intent', payment_intent: 'pi_unverified' },
        }],
      },
    })),
    (error) => error instanceof StripeInvoicePaymentBindingConflict,
  )

  await assert.rejects(
    resolveStripeInvoicePaymentIntentId(null, paidInvoice({
      payment_intent: 'pi_unpaid',
      payments: {
        has_more: false,
        data: [{
          id: 'inpay_open',
          status: 'open',
          invoice: 'in_household',
          payment: { type: 'payment_intent', payment_intent: 'pi_unpaid' },
        }],
      },
    })),
    (error) => error instanceof StripeInvoicePaymentBindingConflict,
  )
})

test('does not bind one PaymentIntent to the whole invoice when its paid amount is partial', async () => {
  const stripe = {
    invoicePayments: {
      async list() {
        return { data: [paidBinding({ amountPaid: 5000 })], has_more: false }
      },
    },
  }

  await assert.rejects(
    resolveStripeInvoicePaymentIntentId(stripe, paidInvoice()),
    (error) => (
      error instanceof StripeInvoicePaymentBindingConflict
      && error.details.bindingAmountPaid === 5000
      && error.details.invoiceAmountPaid === 7125
    ),
  )
})

test('resolves a succeeded PaymentIntent back only to its whole paid invoice', async () => {
  const invoice = paidInvoice()
  const stripe = {
    invoicePayments: {
      async list(params) {
        assert.deepEqual(params, {
          payment: { type: 'payment_intent', payment_intent: 'pi_household' },
          limit: 100,
          expand: ['data.invoice'],
        })
        return { data: [paidBinding({ invoice })], has_more: false }
      },
    },
    invoices: {
      async retrieve() {
        throw new Error('expanded invoice should not be retrieved twice')
      },
    },
  }

  assert.equal(
    await resolveStripePaymentIntentInvoice(stripe, {
      id: 'pi_household',
      status: 'succeeded',
      amount_received: 7125,
      currency: 'usd',
      customer: 'cus_household',
    }),
    invoice,
  )
})

test('rejects a partial Invoice Payment on PaymentIntent-to-invoice resolution', async () => {
  const invoice = paidInvoice()
  const stripe = {
    invoicePayments: {
      async list() {
        return {
          data: [paidBinding({ invoice, amountPaid: 5000 })],
          has_more: false,
        }
      },
    },
  }

  await assert.rejects(
    resolveStripePaymentIntentInvoice(stripe, {
      id: 'pi_household',
      status: 'succeeded',
      amount_received: 7125,
      currency: 'usd',
      customer: 'cus_household',
    }),
    (error) => (
      error instanceof StripeInvoicePaymentBindingConflict
      && error.details.bindingAmountPaid === 5000
      && error.details.invoiceAmountPaid === 7125
    ),
  )
})

test('reports no paid invoice binding without treating that absence as generic payment ownership', async () => {
  const stripe = {
    invoicePayments: { async list() { return { data: [], has_more: false } } },
  }
  assert.equal(await resolveStripePaymentIntentInvoice(stripe, {
    id: 'pi_checkout',
    currency: 'usd',
  }), null)
})

test('fails closed for multiple bindings even when they repeat one Stripe object ID', async () => {
  const invoiceStripe = {
    invoicePayments: {
      async list() {
        return {
          data: [
            paidBinding({ id: 'inpay_one', amountPaid: 3000 }),
            paidBinding({ id: 'inpay_two', amountPaid: 4125 }),
          ],
          has_more: false,
        }
      },
    },
  }
  await assert.rejects(
    resolveStripeInvoicePaymentIntentId(invoiceStripe, paidInvoice()),
    (error) => error instanceof StripeInvoicePaymentBindingConflict,
  )

  const firstInvoice = paidInvoice({ id: 'in_one', amount_paid: 3000 })
  const secondInvoice = paidInvoice({ id: 'in_two', amount_paid: 4125 })
  const paymentIntentStripe = {
    invoicePayments: {
      async list() {
        return {
          data: [
            paidBinding({ id: 'inpay_one', invoice: firstInvoice, amountPaid: 3000 }),
            paidBinding({ id: 'inpay_two', invoice: secondInvoice, amountPaid: 4125 }),
          ],
          has_more: false,
        }
      },
    },
  }
  await assert.rejects(
    resolveStripePaymentIntentInvoice(paymentIntentStripe, {
      id: 'pi_household',
      status: 'succeeded',
      amount_received: 7125,
      currency: 'usd',
      customer: 'cus_household',
    }),
    (error) => error instanceof StripeInvoicePaymentBindingConflict,
  )
})

test('fails closed when a paid-binding page is paginated or omits pagination proof', async () => {
  for (const hasMore of [true, undefined]) {
    const stripe = {
      invoicePayments: {
        async list() {
          const page = { data: [] }
          if (hasMore !== undefined) page.has_more = hasMore
          return page
        },
      },
    }

    await assert.rejects(
      resolveStripeInvoicePaymentIntentId(stripe, paidInvoice()),
      (error) => error instanceof StripeInvoicePaymentBindingConflict,
    )
    await assert.rejects(
      resolveStripePaymentIntentInvoice(stripe, { id: 'pi_many', currency: 'usd' }),
      (error) => error instanceof StripeInvoicePaymentBindingConflict,
    )
  }
})

test('retains direct relationships only when the Invoice Payments surface is absent', async () => {
  assert.equal(
    await resolveStripeInvoicePaymentIntentId(null, paidInvoice({ payment_intent: 'pi_legacy' })),
    'pi_legacy',
  )

  const invoice = paidInvoice({ id: 'in_legacy' })
  assert.equal(
    await resolveStripePaymentIntentInvoice({}, {
      id: 'pi_legacy',
      status: 'succeeded',
      amount_received: 7125,
      currency: 'usd',
      customer: 'cus_household',
      invoice,
    }),
    invoice,
  )
})

test('requires exact USD currency across invoice, Invoice Payment, and PaymentIntent evidence', async () => {
  const cases = [
    {
      name: 'invoice',
      invoice: paidInvoice({ currency: 'eur' }),
      binding: paidBinding(),
      paymentIntent: { id: 'pi_household', status: 'succeeded', amount_received: 7125, currency: 'usd', customer: 'cus_household' },
    },
    {
      name: 'Invoice Payment',
      invoice: paidInvoice(),
      binding: paidBinding({ currency: 'eur' }),
      paymentIntent: { id: 'pi_household', status: 'succeeded', amount_received: 7125, currency: 'usd', customer: 'cus_household' },
    },
    {
      name: 'PaymentIntent',
      invoice: paidInvoice(),
      binding: paidBinding(),
      paymentIntent: { id: 'pi_household', status: 'succeeded', amount_received: 7125, currency: 'eur', customer: 'cus_household' },
    },
  ]

  for (const fixture of cases) {
    const stripe = {
      invoicePayments: {
        async list(params) {
          return {
            data: [{
              ...fixture.binding,
              invoice: params.invoice ? fixture.invoice.id : fixture.invoice,
            }],
            has_more: false,
          }
        },
      },
    }
    await assert.rejects(
      resolveStripePaymentIntentInvoice(stripe, fixture.paymentIntent),
      (error) => (
        error instanceof StripeInvoicePaymentBindingConflict
        && /must use USD/.test(error.message)
      ),
      fixture.name,
    )
  }
})

test('independently verifies a paid invoice binding in both directions before recording', async () => {
  const invoice = paidInvoice()
  const paymentIntent = {
    id: 'pi_household',
    status: 'succeeded',
    amount_received: 7125,
    currency: 'usd',
    customer: 'cus_household',
  }
  const stripe = {
    paymentIntents: {
      async retrieve(id) {
        assert.equal(id, paymentIntent.id)
        return paymentIntent
      },
    },
    invoicePayments: {
      async list(params) {
        return {
          data: [paidBinding({ invoice: params.invoice ? invoice.id : invoice })],
          has_more: false,
        }
      },
    },
  }

  assert.equal(
    await verifyStripeInvoicePaymentIntent(stripe, invoice, paymentIntent.id),
    paymentIntent,
  )
})

test('rejects a paid invoice whose bound PaymentIntent belongs to another customer', async () => {
  const invoice = paidInvoice()
  const stripe = {
    paymentIntents: {
      async retrieve() {
        return {
          id: 'pi_household',
          status: 'succeeded',
          amount_received: 7125,
          currency: 'usd',
          customer: 'cus_other',
        }
      },
    },
    invoicePayments: {
      async list(params) {
        return {
          data: [paidBinding({ invoice: params.invoice ? invoice.id : invoice })],
          has_more: false,
        }
      },
    },
  }

  await assert.rejects(
    verifyStripeInvoicePaymentIntent(stripe, invoice, 'pi_household'),
    (error) => (
      error instanceof StripeInvoicePaymentBindingConflict
      && /same customer/.test(error.message)
    ),
  )
})
