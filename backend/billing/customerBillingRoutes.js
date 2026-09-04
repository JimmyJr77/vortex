import { publicAppUrl } from '../email/publicAppUrl.js'
import { notifyPaymentReceipt, notifyPaymentRequest, notifyRefundReceipt } from '../email/memberNotifications.js'
import { loadCanonicalFinancialSnapshot } from './canonicalBillingAccount.js'
import { listBillingAnomalies } from './billingAnomalies.js'
import {
  buildCustomerBillingOverview,
  ensureCustomerBillingAccount,
  exportCustomerBillingTransactionsCsv,
  listCustomerBillingActivity,
  listCustomerBillingTransactions,
  searchCustomerBilling,
} from './customerBillingQueries.js'
import { listCustomerBillingOverviews } from './customerBillingOverviewList.js'
import {
  createEnrollmentPriceAdjustment,
  previewEnrollmentPriceAdjustment,
  retryEnrollmentPriceAdjustmentSync,
  revokeEnrollmentPriceAdjustment,
} from './customerBillingAdjustments.js'
import {
  cancelCustomerBillingEnrollment,
  previewCustomerBillingEnrollmentCancellation,
} from './customerBillingEnrollmentCancellation.js'
import {
  moveCustomerBillingEnrollmentClass,
  previewCustomerBillingEnrollmentClassSwap,
} from './customerBillingEnrollmentSwap.js'
import { reassignCustomerBillingEnrollmentMember } from './customerBillingEnrollmentMemberSwap.js'
import {
  collectCustomChargeWithSavedCard,
  collectOutstandingBalanceWithSavedCard,
  billAnnualMembershipNow,
  adjustCustomerBillingCharge,
  createCustomerBillingCustomCharge,
  createCustomerBillingChargePaymentRequest,
  createCustomerBillingPaymentMethodLink,
  createCustomerBillingRefund,
  createCustomChargeCheckoutSession,
  loadCustomerBillingCharge,
  previewCustomerBillingRefund,
  SavedCardCollectionError,
} from './customerBillingPayments.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'
import { setAnnualMembershipAutoRenewal } from './annualMembershipAutoRenewal.js'
import {
  adjustAdminMultiClassPass,
  loadAdminCustomerBillingMigrationStatus,
  recordAdminExternalPayment,
  resendAdminPaymentReceipt,
  resendAdminRefundReceipt,
  updateAdminCustomerBillingAccount,
} from './customerBillingAdminOperations.js'
import { requireAdminFacilityScope } from './adminFacilityScope.js'

function facilityId(req) {
  return requireAdminFacilityScope({
    facilityId: req.platformAuth?.user?.facility_id ?? null,
  })
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

function requiredIdempotencyKey(req, prefix) {
  const key = idempotencyKey(req, prefix)
  if (!key) throw new Error('An Idempotency-Key header is required.')
  return key
}

function errorStatus(error) {
  if (Number.isInteger(error?.statusCode)) return error.statusCode
  if (/not found/i.test(String(error?.message ?? ''))) return 404
  if (/Stripe|payment|sync/i.test(String(error?.message ?? '')) && /unavailable|not enabled/i.test(String(error?.message ?? ''))) return 503
  if (/^(42|08|XX)/.test(String(error?.code ?? ''))) return 500
  return 400
}

export function retrySyncHttpStatus(data) {
  return data?.syncStatus === 'failed' || data?.adjustment?.status === 'sync_failed'
    ? 202
    : 200
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
    '/api/admin/customer-billing/anomalies',
    ...requirePermission(pool, jwtSecret, 'billing.view'),
    async (req, res) => {
      try {
        const data = await listBillingAnomalies(pool, { facilityId: facilityId(req) })
        res.json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] anomalies:', error)
        res.status(errorStatus(error)).json({
          success: false,
          message: error?.message ?? 'Billing anomalies could not be loaded.',
        })
      }
    },
  )

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
        res.status(errorStatus(error)).json({ success: false, message: 'Customer billing search failed.' })
      }
    },
  )

  app.get(
    '/api/admin/customer-billing/overview',
    ...requirePermission(pool, jwtSecret, 'billing.view'),
    async (req, res) => {
      try {
        const data = await listCustomerBillingOverviews(pool, {
          facilityId: facilityId(req),
        })
        res.json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] overview list:', error)
        res.status(errorStatus(error)).json({ success: false, message: 'Billing overview failed to load.' })
      }
    },
  )

  app.patch(
    '/api/admin/customer-billing/families/:familyId/account',
    ...requirePermission(pool, jwtSecret, 'family_billing.manage'),
    async (req, res) => {
      try {
        const data = await updateAdminCustomerBillingAccount(pool, {
          familyId: Number(req.params.familyId),
          facilityId: facilityId(req),
          actorUserId: actorId(req),
          input: req.body ?? {},
        })
        res.json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] account update:', error)
        res.status(errorStatus(error)).json({
          success: false,
          message: error?.message ?? 'Billing account could not be updated.',
        })
      }
    },
  )

  app.get(
    '/api/admin/customer-billing/families/:familyId/migration-status',
    ...requirePermission(pool, jwtSecret, 'billing.view'),
    async (req, res) => {
      try {
        const data = await loadAdminCustomerBillingMigrationStatus(pool, {
          familyId: Number(req.params.familyId),
          facilityId: facilityId(req),
        })
        if (!data) {
          return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        }
        res.json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] migration status:', error)
        res.status(errorStatus(error)).json({
          success: false,
          message: error?.message ?? 'Billing migration status could not be loaded.',
        })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/families/:familyId/payments',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await recordAdminExternalPayment(pool, {
          familyId: Number(req.params.familyId),
          facilityId: facilityId(req),
          actorUserId: actorId(req),
          requestKey: requiredIdempotencyKey(req, 'external-payment'),
          input: req.body ?? {},
        })
        res.status(data.replayed ? 200 : 201).json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] external payment:', error)
        res.status(errorStatus(error)).json({
          success: false,
          message: error?.message ?? 'External payment could not be recorded.',
        })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/families/:familyId/payments/:paymentId/resend-receipt',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await resendAdminPaymentReceipt(pool, {
          familyId: Number(req.params.familyId),
          facilityId: facilityId(req),
          paymentId: Number(req.params.paymentId),
          actorUserId: actorId(req),
          requestKey: requiredIdempotencyKey(req, 'payment-receipt'),
        })
        res.json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] resend payment receipt:', error)
        res.status(errorStatus(error)).json({
          success: false,
          message: error?.message ?? 'Payment receipt could not be resent.',
        })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/families/:familyId/refunds/:refundId/resend-receipt',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await resendAdminRefundReceipt(pool, {
          familyId: Number(req.params.familyId),
          facilityId: facilityId(req),
          refundId: Number(req.params.refundId),
          actorUserId: actorId(req),
          requestKey: requiredIdempotencyKey(req, 'refund-receipt'),
        })
        res.json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] resend refund receipt:', error)
        res.status(errorStatus(error)).json({
          success: false,
          message: error?.message ?? 'Refund receipt could not be resent.',
        })
      }
    },
  )

  app.post(
    '/api/admin/entitlements/multi-class-passes/:passId/adjustments',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await adjustAdminMultiClassPass(pool, {
          passId: Number(req.params.passId),
          facilityId: facilityId(req),
          actorUserId: actorId(req),
          requestKey: requiredIdempotencyKey(req, 'pass-adjustment'),
          input: req.body ?? {},
        })
        res.status(data.replayed ? 200 : 201).json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] pass adjustment:', error)
        res.status(errorStatus(error)).json({
          success: false,
          message: error?.message ?? 'Pass balance could not be adjusted.',
        })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/families/:familyId/annual-memberships/:memberId/bill-now',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await billAnnualMembershipNow(pool, {
          familyId: Number(req.params.familyId),
          facilityId: facilityId(req),
          memberId: Number(req.params.memberId),
          actorUserId: actorId(req),
          idempotencyKey: idempotencyKey(req, 'annual-membership-bill'),
        })
        res.status(data.created ? 201 : 200).json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] annual membership bill:', error)
        res.status(errorStatus(error)).json({
          success: false,
          message: error?.message ?? 'Annual membership bill could not be created.',
        })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/families/:familyId/charges/:chargeId/adjustments',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await adjustCustomerBillingCharge(pool, {
          familyId: Number(req.params.familyId),
          facilityId: facilityId(req),
          actorUserId: actorId(req),
          chargeId: Number(req.params.chargeId),
          finalAmountCents: req.body?.finalAmountCents,
          promoCode: req.body?.promoCode,
          appliesTo: req.body?.appliesTo,
          reason: req.body?.reason,
          idempotencyKey: idempotencyKey(req, 'billing-charge-adjustment'),
        })
        res.status(data.replayed ? 200 : 201).json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] charge adjustment:', error)
        res.status(errorStatus(error)).json({
          success: false,
          message: error?.message ?? 'Bill adjustment could not be created.',
        })
      }
    },
  )

  app.patch(
    '/api/admin/customer-billing/families/:familyId/annual-memberships/:subscriptionId/auto-renewal',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const enabled = req.body?.enabled
        if (typeof enabled !== 'boolean') {
          return res.status(400).json({ success: false, message: 'enabled must be true or false.' })
        }
        const account = await ensureCustomerBillingAccount(
          pool,
          Number(req.params.familyId),
          facilityId(req),
        )
        if (!account) {
          return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        }
        const subscriptionId = Number(req.params.subscriptionId)
        const updated = await setAnnualMembershipAutoRenewal(pool, {
          account,
          subscriptionId,
          enabled,
          actorUserId: actorId(req),
          actorType: 'admin',
        })
        res.json({
          success: true,
          data: {
            billingSubscriptionId: subscriptionId,
            memberId: updated.member_id == null ? null : Number(updated.member_id),
            autoRenewal: enabled,
            renewalDate: updated.next_bill_date,
          },
        })
      } catch (error) {
        console.error('[customer-billing] annual membership auto-renewal:', error)
        res.status(errorStatus(error)).json({
          success: false,
          message: error?.message ?? 'Annual membership auto-renewal could not be changed.',
        })
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
        if (data.revision) res.setHeader('ETag', `W/"billing-${data.revision}"`)
        res.json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] overview:', error)
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Billing overview failed.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/families/:familyId/refresh',
    ...requirePermission(pool, jwtSecret, 'billing.view'),
    async (req, res) => {
      try {
        // Refresh is deliberately a read operation. Stripe reconciliation,
        // account activation, and payment allocation run only through their
        // explicit operational jobs so billing.view can never authorize a
        // financial mutation.
        const data = await buildCustomerBillingOverview(pool, {
          familyId: Number(req.params.familyId),
          facilityId: facilityId(req),
          selectedMemberId: req.body?.memberId == null ? null : Number(req.body.memberId),
        })
        if (!data) return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        if (data.revision) res.setHeader('ETag', `W/"billing-${data.revision}"`)
        res.json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] account refresh:', error)
        res.status(errorStatus(error)).json({
          success: false,
          message: error?.message ?? 'Billing account refresh failed.',
        })
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
        console.error('[customer-billing] transactions:', error)
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
        console.error('[customer-billing] transaction export:', error)
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
        console.error('[customer-billing] activity:', error)
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
    '/api/admin/customer-billing/enrollments/:signupId/cancellation/preview',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await previewCustomerBillingEnrollmentCancellation(pool, {
          signupId: Number(req.params.signupId),
          facilityId: facilityId(req),
          input: req.body,
        })
        res.json({ success: true, data })
      } catch (error) {
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Cancellation preview failed.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/enrollments/:signupId/class-swap/preview',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await previewCustomerBillingEnrollmentClassSwap(pool, {
          signupId: Number(req.params.signupId),
          facilityId: facilityId(req),
          input: req.body,
        })
        res.json({ success: true, data })
      } catch (error) {
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Class move preview failed.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/enrollments/:signupId/class-swap',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await moveCustomerBillingEnrollmentClass(pool, {
          signupId: Number(req.params.signupId),
          facilityId: facilityId(req),
          actorUserId: actorId(req),
          requestKey: requiredIdempotencyKey(req, 'class-swap'),
          input: req.body,
        })
        res.status(data.replayed ? 200 : 201).json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] class swap:', error)
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Class move failed.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/enrollments/:signupId/member-swap',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await reassignCustomerBillingEnrollmentMember(pool, {
          signupId: Number(req.params.signupId),
          facilityId: facilityId(req),
          actorUserId: actorId(req),
          requestKey: requiredIdempotencyKey(req, 'enrollment-member-swap'),
          input: req.body,
        })
        res.status(data.replayed ? 200 : 201).json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] enrollment member reassignment:', error)
        res.status(errorStatus(error)).json({
          success: false,
          message: error?.message ?? 'Enrollment member reassignment failed.',
        })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/enrollments/:signupId/cancellation',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const data = await cancelCustomerBillingEnrollment(pool, {
          signupId: Number(req.params.signupId),
          facilityId: facilityId(req),
          actorUserId: actorId(req),
          input: req.body,
        })
        res.status(201).json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] cancel enrollment:', error)
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Enrollment cancellation failed.' })
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
        console.info('[customer-billing] price adjustment created', {
          adjustmentId: data.adjustment.id,
          signupId: Number(req.params.signupId),
          kind: data.adjustment.kind,
          status: data.adjustment.status,
          actorUserId: actorId(req),
          resultingBalanceCents: data.preview?.resultingBalanceCents ?? null,
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
        const status = retrySyncHttpStatus(data)
        console.info('[customer-billing] price adjustment synchronization retried', {
          adjustmentId: Number(req.params.adjustmentId),
          adjustmentStatus: data.adjustment.status,
          syncStatus: data.syncStatus,
          actorUserId: actorId(req),
        })
        res.status(status).json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] retry price adjustment synchronization:', error)
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
        console.info('[customer-billing] price adjustment revoked', {
          adjustmentId: Number(req.params.adjustmentId),
          signupId: data.adjustment.signupId,
          actorUserId: actorId(req),
          correctionCount: data.corrections.length,
          correctionTotalCents: data.corrections.reduce(
            (sum, correction) => sum + Number(correction.amountCents || 0),
            0,
          ),
        })
        res.json({ success: true, data })
      } catch (error) {
        console.error('[customer-billing] revoke price adjustment:', error)
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Price change could not be revoked.' })
      }
    },
  )

  app.post(
    '/api/admin/customer-billing/families/:familyId/process-outstanding-balance',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const account = await ensureCustomerBillingAccount(pool, Number(req.params.familyId), facilityId(req))
        if (!account) return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        const data = await collectOutstandingBalanceWithSavedCard(pool, {
          account,
          amountCents: req.body?.amountCents,
          authorization: req.body?.authorization,
          actorUserId: actorId(req),
          attemptKey: idempotencyKey(req, 'outstanding-balance'),
        })
        notifyPaymentReceipt(pool, { account, payment: data.payment, billingUrl: `${publicAppUrl()}/?billing=portal-return` }).catch(() => {})
        // The collector has already committed the payment and exact charge
        // applications. Read the canonical balance after that commit so the
        // UI can immediately show what was paid and what remains.
        const snapshot = await loadCanonicalFinancialSnapshot(pool, { accountId: account.id })
        res.json({
          success: true,
          data: {
            ...data,
            remainingBalanceCents: snapshot.balanceCents,
            remainingCollectibleBalanceCents: snapshot.collectibleBalanceCents,
          },
        })
      } catch (error) {
        if (error instanceof SavedCardCollectionError) {
          return res.status(409).json({
            success: false,
            code: 'PAYMENT_RECONCILIATION_PENDING',
            message: error.message,
            data: { stripeStatus: error.stripeStatus },
          })
        }
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Prior-month balance could not be collected.' })
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
    '/api/admin/customer-billing/families/:familyId/charges/:chargeId/payment-request',
    ...requirePermission(pool, jwtSecret, 'billing.manage'),
    async (req, res) => {
      try {
        const requestKey = idempotencyKey(req, 'billing-charge-payment-request')
        const account = await ensureCustomerBillingAccount(pool, Number(req.params.familyId), facilityId(req))
        if (!account) return res.status(404).json({ success: false, message: 'Family billing account was not found.' })
        const charge = await loadCustomerBillingCharge(pool, account.id, Number(req.params.chargeId))
        const base = publicAppUrl()
        const checkout = await createCustomerBillingChargePaymentRequest(pool, {
          account,
          charge,
          successUrl: `${base}/?billing=charge-paid`,
          cancelUrl: `${base}/?billing=charge-cancelled`,
          actorUserId: actorId(req),
          attemptKey: requestKey,
        })
        const delivery = await notifyPaymentRequest(pool, {
          account,
          amountCents: checkout.amountCents,
          checkoutUrl: checkout.url,
          expiresAt: checkout.expiresAt,
          idempotencyKey: `billing-charge-payment-request-${checkout.id}`,
          bestEffort: false,
        })
        if (!delivery.sent) {
          return res.status(422).json({
            success: false,
            message: 'The secure payment link was created, but no billing email could receive it.',
            data: checkout,
          })
        }
        await recordBillingActivityBestEffort(pool, {
          eventKey: `billing-charge-payment-request-sent:${charge.id}:${checkout.id}`,
          accountId: account.id,
          memberId: charge.member_id,
          chargeId: charge.id,
          eventType: 'billing_charge_payment_request_sent',
          summary: `Secure payment request sent for ${charge.description}.`,
          details: {
            amountCents: checkout.amountCents,
            recipientEmail: delivery.email,
            expiresAt: checkout.expiresAt,
          },
          stripeObjectId: checkout.id,
          actorUserId: actorId(req),
          actorType: 'admin',
        })
        res.json({ success: true, data: { ...checkout, recipientEmail: delivery.email } })
      } catch (error) {
        res.status(errorStatus(error)).json({ success: false, message: error?.message ?? 'Payment request failed.' })
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
        const requestKey = requiredIdempotencyKey(req, 'refund')
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
