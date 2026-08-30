import { publicAppUrl } from '../email/publicAppUrl.js'
import { notifyPaymentReceipt, notifyRefundReceipt } from '../email/memberNotifications.js'
import {
  buildCustomerBillingOverview,
  ensureCustomerBillingAccount,
  exportCustomerBillingTransactionsCsv,
  listCustomerBillingActivity,
  listCustomerBillingTransactions,
  searchCustomerBilling,
} from './customerBillingQueries.js'
import {
  createEnrollmentPriceAdjustment,
  previewEnrollmentPriceAdjustment,
  retryEnrollmentPriceAdjustmentSync,
  revokeEnrollmentPriceAdjustment,
} from './customerBillingAdjustments.js'
import {
  collectCustomChargeWithSavedCard,
  createCustomerBillingCustomCharge,
  createCustomerBillingPaymentMethodLink,
  createCustomerBillingRefund,
  createCustomChargeCheckoutSession,
  loadCustomerBillingCharge,
  previewCustomerBillingRefund,
  SavedCardCollectionError,
} from './customerBillingPayments.js'

function facilityId(req) {
  return req.platformAuth?.user?.facility_id ?? null
}

function actorId(req) {
  return req.platformAuth?.user?.id ?? req.adminId ?? null
}

function idempotencyKey(req, prefix) {
  const raw = String(req.get('Idempotency-Key') ?? req.body?.requestKey ?? '').trim()
  if (!raw) return null
  if (!/^[A-Za-z0-9_.:-]{8,120}$/.test(raw)) {
    throw new Error('Idempotency-Key must be 8–120 URL-safe characters.')
  }
  return `${prefix}:${raw}`
}

function errorStatus(error) {
  if (/not found/i.test(String(error?.message ?? ''))) return 404
  if (/Stripe|payment|sync/i.test(String(error?.message ?? '')) && /unavailable|not enabled/i.test(String(error?.message ?? ''))) return 503
  return 400
}

function transactionFilters(req, accountId) {
  return {
    accountId,
    memberId: req.query.memberId == null || req.query.memberId === '' ? null : Number(req.query.memberId),
    type: String(req.query.type ?? '').trim() || null,
    status: String(req.query.status ?? '').trim() || null,
    search: String(req.query.search ?? '').trim() || null,
    from: String(req.query.from ?? '').trim() || null,
    through: String(req.query.through ?? '').trim() || null,
    cursor: String(req.query.cursor ?? '').trim() || null,
    limit: req.query.limit == null ? 100 : Number(req.query.limit),
  }
}

export function registerCustomerBillingRoutes(app, pool, { jwtSecret, requirePermission }) {
  app.get(
    '/api/admin/customer-billing/search',
    ...requirePermission(pool, jwtSecret, 'billing.view'),
    async (req, res) => {
      try {
        const data = await searchCustomerBilling(pool, {
          facilityId: facilityId(req),
          query: req.query.q,
        })
        res.json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] search:', error)
        res.status(500).json({ success: false, message: 'Customer billing search failed.' })
      }
    },
  )

  app.get(
    '/api/admin/customer-billing/families/:familyId/overview',
    ...requirePermission(pool, jwtSecret, 'billing.view'),
    async (req, res) => {
      try {
        const data = await buildCustomerBillingOverview(pool, {
          familyId: Number(req.params.familyId),
          facilityId: facilityId(req),
          selectedMemberId: req.query.memberId == null ? null : Number(req.query.memberId),
        })
        if (!data) return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        res.json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] overview:', error)
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Billing overview failed.' })
      }
    },
  )

  app.get(
    '/api/admin/customer-billing/families/:familyId/transactions',
    ...requirePermission(pool, jwtSecret, 'billing.view'),
    async (req, res) => {
      try {
        const account = await ensureCustomerBillingAccount(pool, Number(req.params.familyId), facilityId(req))
        if (!account) return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        const data = await listCustomerBillingTransactions(pool, transactionFilters(req, account.id))
        res.json({ success: true, data })
      } catch (error) {
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Transactions failed to load.' })
      }
    },
  )

  app.get(
    '/api/admin/customer-billing/families/:familyId/transactions.csv',
    ...requirePermission(pool, jwtSecret, 'billing.view'),
    async (req, res) => {
      try {
        const account = await ensureCustomerBillingAccount(pool, Number(req.params.familyId), facilityId(req))
        if (!account) return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        const csv = await exportCustomerBillingTransactionsCsv(pool, transactionFilters(req, account.id))
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="customer-billing-family-${account.family_id}.csv"`)
        res.send(csv)
      } catch (error) {
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Transaction export failed.' })
      }
    },
  )

  app.get(
    '/api/admin/customer-billing/families/:familyId/activity',
    ...requirePermission(pool, jwtSecret, 'billing.view'),
    async (req, res) => {
      try {
        const account = await ensureCustomerBillingAccount(pool, Number(req.params.familyId), facilityId(req))
        if (!account) return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        const data = await listCustomerBillingActivity(pool, {
          accountId: account.id,
          memberId: req.query.memberId == null || req.query.memberId === '' ? null : Number(req.query.memberId),
          cursor: req.query.cursor ?? null,
          limit: req.query.limit == null ? 100 : Number(req.query.limit),
        })
        res.json({ success: true, data })
      } catch (error) {
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Billing activity failed to load.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/enrollments/:signupId/price-adjustments/preview',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await previewEnrollmentPriceAdjustment(pool, {
          signupId: Number(req.params.signupId),
          facilityId: facilityId(req),
          input: req.body,
        })
        res.json({ success: true, data })
      } catch (error) {
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Price preview failed.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/enrollments/:signupId/price-adjustments',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await createEnrollmentPriceAdjustment(pool, {
          signupId: Number(req.params.signupId),
          facilityId: facilityId(req),
          actorUserId: actorId(req),
          input: req.body,
        })
        const status = data.adjustment.status === 'sync_failed' ? 202 : 201
        res.status(status).json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] create price adjustment:', error)
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Price change failed.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/price-adjustments/:adjustmentId/retry-sync',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await retryEnrollmentPriceAdjustmentSync(pool, {
          adjustmentId: Number(req.params.adjustmentId),
          facilityId: facilityId(req),
          actorUserId: actorId(req),
        })
        const status = data.adjustment.status === 'sync_failed' ? 202 : 200
        res.status(status).json({ success: true, data })
      } catch (error) {
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Stripe synchronization retry failed.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/price-adjustments/:adjustmentId/revoke',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await revokeEnrollmentPriceAdjustment(pool, {
          adjustmentId: Number(req.params.adjustmentId),
          facilityId: facilityId(req),
          actorUserId: actorId(req),
          reason: req.body?.reason,
        })
        res.json({ success: true, data })
      } catch (error) {
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Price change could not be revoked.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/families/:familyId/custom-charges',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const requestKey = idempotencyKey(req, 'custom-charge')
        const collectionMethod = req.body?.collectionMethod ?? 'checkout'
        if (collectionMethod === 'saved_card') {
          const amount = Number(req.body?.amountCents)
          const authorization = req.body?.authorization
          const date = String(authorization?.date ?? '').slice(0, 10)
          if (
            !Number.isInteger(amount) || amount <= 0 ||
            !String(authorization?.source ?? '').trim() ||
            !String(authorization?.note ?? '').trim() ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            authorization?.confirmed !== true ||
            Number(authorization?.confirmedAmountCents) !== amount
          ) {
            return res.status(400).json({
              success: false,
              message: 'Saved-card collection requires authorization source, date, note, and exact-amount confirmation.',
            })
          }
        }
        const created = await createCustomerBillingCustomCharge(pool, {
          familyId: Number(req.params.familyId),
          facilityId: facilityId(req),
          actorUserId: actorId(req),
          memberId: req.body?.memberId,
          description: req.body?.description,
          amountCents: req.body?.amountCents,
          servicePeriodStart: req.body?.servicePeriodStart,
          servicePeriodEnd: req.body?.servicePeriodEnd,
          collectionMethod,
          idempotencyKey: requestKey,
        })
        const base = publicAppUrl()
        let collection = null
        if (collectionMethod === 'checkout') {
          collection = await createCustomChargeCheckoutSession(pool, {
            account: created.account,
            charge: created.charge,
            successUrl: `${base}/?billing=custom-charge-paid`,
            cancelUrl: `${base}/?billing=custom-charge-cancelled`,
            actorUserId: actorId(req),
            attemptKey: requestKey,
          })
        } else if (collectionMethod === 'saved_card') {
          try {
            collection = await collectCustomChargeWithSavedCard(pool, {
              account: created.account,
              charge: created.charge,
              authorization: req.body?.authorization,
              successUrl: `${base}/?billing=custom-charge-paid`,
              cancelUrl: `${base}/?billing=custom-charge-cancelled`,
              actorUserId: actorId(req),
              attemptKey: requestKey,
            })
            if (collection.payment) {
              notifyPaymentReceipt(pool, {
                account: created.account,
                payment: collection.payment,
                billingUrl: `${base}/?billing=portal-return`,
              }).catch(() => {})
            }
          } catch (error) {
            if (error instanceof SavedCardCollectionError) {
              return res.status(409).json({
                success: false,
                message: error.message,
                data: {
                  charge: created.charge,
                  fallback: error.fallback,
                  stripeStatus: error.stripeStatus,
                },
              })
            }
            let fallback = null
            try {
              fallback = await createCustomChargeCheckoutSession(pool, {
                account: created.account,
                charge: created.charge,
                successUrl: `${base}/?billing=custom-charge-paid`,
                cancelUrl: `${base}/?billing=custom-charge-cancelled`,
                actorUserId: actorId(req),
                attemptKey: requestKey ? `${requestKey}-fallback` : null,
              })
            } catch {
              // The immutable charge remains outstanding for manual follow-up.
            }
            return res.status(409).json({
              success: false,
              message: error?.message ?? 'Saved card could not be charged; the amount remains due.',
              data: { charge: created.charge, fallback },
            })
          }
        }
        res.status(created.created ? 201 : 200).json({ success: true, data: { charge: created.charge, collection, replayed: !created.created } })
      } catch (error) {
        console.error('[customer-billing] custom charge:', error)
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Custom charge failed.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/families/:familyId/charges/:chargeId/checkout-session',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const requestKey = idempotencyKey(req, 'custom-checkout')
        const account = await ensureCustomerBillingAccount(pool, Number(req.params.familyId), facilityId(req))
        if (!account) return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        const charge = await loadCustomerBillingCharge(pool, account.id, Number(req.params.chargeId))
        const base = publicAppUrl()
        const data = await createCustomChargeCheckoutSession(pool, {
          account,
          charge,
          successUrl: `${base}/?billing=custom-charge-paid`,
          cancelUrl: `${base}/?billing=custom-charge-cancelled`,
          actorUserId: actorId(req),
          attemptKey: requestKey,
        })
        res.json({ success: true, data })
      } catch (error) {
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Checkout link failed.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/families/:familyId/refunds/preview',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const account = await ensureCustomerBillingAccount(pool, Number(req.params.familyId), facilityId(req))
        if (!account) return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        const data = await previewCustomerBillingRefund(pool, {
          account,
          paymentId: req.body?.paymentId,
          amountCents: req.body?.amountCents,
          ledgerTreatment: req.body?.ledgerTreatment,
          relatedChargeId: req.body?.relatedChargeId,
        })
        res.json({ success: true, data })
      } catch (error) {
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Refund preview failed.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/families/:familyId/refunds',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const requestKey = idempotencyKey(req, 'refund')
        const account = await ensureCustomerBillingAccount(pool, Number(req.params.familyId), facilityId(req))
        if (!account) return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        const data = await createCustomerBillingRefund(pool, {
          account,
          actorUserId: actorId(req),
          paymentId: req.body?.paymentId,
          amountCents: req.body?.amountCents,
          ledgerTreatment: req.body?.ledgerTreatment,
          relatedChargeId: req.body?.relatedChargeId,
          exceptionCategory: req.body?.exceptionCategory,
          evidenceNote: req.body?.evidenceNote,
          reason: req.body?.reason,
          idempotencyKey: requestKey,
        })
        if (!data.replayed && data.refund?.external_status === 'succeeded') {
          notifyRefundReceipt(pool, {
            account,
            refund: data.refund,
            billingUrl: `${publicAppUrl()}/?billing=portal-return`,
          }).catch(() => {})
        }
        res.status(data.replayed ? 200 : 201).json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] refund:', error)
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Refund failed.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/families/:familyId/payment-method-link',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const account = await ensureCustomerBillingAccount(pool, Number(req.params.familyId), facilityId(req))
        if (!account) return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        const data = await createCustomerBillingPaymentMethodLink(pool, {
          account,
          returnUrl: `${publicAppUrl()}/?billing=portal-return`,
          actorUserId: actorId(req),
        })
        res.json({ success: true, data })
      } catch (error) {
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Payment-method link failed.' })
      }
    },
  )
}
