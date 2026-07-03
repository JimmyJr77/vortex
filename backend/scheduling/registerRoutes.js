import rateLimit from 'express-rate-limit'
import { createSchedulingHandlers } from './handlers.js'
import { createDiscountHandlers } from './discountHandlers.js'
import { createAdditionalFeeHandlers } from './additionalFeeHandlers.js'
import { createFreePassHandlers } from './freePassHandlers.js'
import { createPromoCodeHandlers } from './promoCodeHandlers.js'
import { createBenefitSelectionHandlers } from './benefitSelectionHandlers.js'

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many signup attempts' },
})

export function registerSchedulingRoutes(app, pool) {
  const h = createSchedulingHandlers(pool)
  const d = createDiscountHandlers(pool)
  const f = createAdditionalFeeHandlers(pool)
  const fp = createFreePassHandlers(pool)
  const pc = createPromoCodeHandlers(pool)
  const bs = createBenefitSelectionHandlers(pool)

  app.get('/api/scheduling/calendar', h.getPublicCalendar)
  app.get('/api/public/scheduling/classes', h.listPublicSchedulingClasses)
  app.get('/api/scheduling/forms', h.listPublicForms)
  app.get('/api/scheduling/forms/:id', h.getPublicForm)
  app.get('/api/scheduling/forms/:formId/offerings', h.listPublicOfferings)
  app.get('/api/scheduling/forms/:id/program-options', h.getProgramSignupOptions)
  app.post('/api/scheduling/auth/check-email', h.checkEmail)
  app.post('/api/scheduling/my-signups', h.listMemberSignedUpForms)
  app.post('/api/scheduling/signups/order-preview', h.previewSignupOrder)
  app.post('/api/scheduling/auth/login', h.authLogin)
  app.post('/api/scheduling/auth/change-password', h.authChangePassword)
  app.post('/api/scheduling/auth/magic-link', h.authMagicLink)
  app.post('/api/scheduling/auth/verify-token', h.authVerifyToken)
  app.post('/api/scheduling/auth/member-session', h.authMemberSession)
  app.post('/api/scheduling/signups', signupLimiter, h.createSignup)
  app.post('/api/scheduling/signups/batch', signupLimiter, h.createSignupBatch)
  app.post('/api/scheduling/promo/validate', d.validatePromo)

  app.get('/api/admin/scheduling/calendar', h.getAdminCalendar)
  app.get('/api/admin/scheduling/forms', h.listAdminForms)
  app.get('/api/admin/scheduling/legacy-forms', h.listLegacyForms)
  app.get('/api/admin/scheduling/forms/:id', h.getAdminForm)
  app.post('/api/admin/scheduling/forms', h.createAdminForm)
  app.put('/api/admin/scheduling/forms/:id', h.updateAdminForm)
  app.post('/api/admin/scheduling/forms/:id/pricing/reset', h.resetAdminFormPricing)
  app.patch('/api/admin/scheduling/forms/:id/active', h.patchAdminFormActive)
  app.put('/api/admin/scheduling/forms/:id/signup-fields', h.updateSignupFields)
  app.delete('/api/admin/scheduling/forms/:id', h.deleteAdminForm)

  app.get('/api/admin/scheduling/forms/:formId/offerings', h.listOfferings)
  app.post('/api/admin/scheduling/forms/:formId/offerings', h.createOffering)
  app.put('/api/admin/scheduling/offerings/:id', h.updateOffering)
  app.patch('/api/admin/scheduling/offerings/:id/select', h.selectOffering)
  app.delete('/api/admin/scheduling/offerings/:id', h.deleteOffering)

  app.post('/api/admin/scheduling/forms/:formId/slot-batches', h.createSlotBatch)
  app.patch('/api/admin/scheduling/time-slots/:id', h.updateTimeSlot)
  app.delete('/api/admin/scheduling/time-slots/:id', h.deleteTimeSlot)
  app.patch('/api/admin/scheduling/slot-groups/:id', h.updateSlotGroupMax)
  app.delete('/api/admin/scheduling/slot-groups/:id', h.deleteSlotGroup)

  app.get('/api/admin/scheduling/signups', h.listSignups)
  app.post('/api/admin/scheduling/signups', h.adminCreateSignup)
  app.get('/api/admin/scheduling/orphaned-signups', h.listOrphanedSignups)
  app.delete('/api/admin/scheduling/orphaned-signups/:id', h.deleteOrphanedSignup)
  app.post('/api/admin/scheduling/orphaned-signups/:id/re-enroll', h.reEnrollOrphanedSignup)
  app.patch('/api/admin/scheduling/signups/:id', h.updateSignupStatus)
  app.post('/api/admin/scheduling/signups/:id/resend-email', h.resendSignupEmail)
  app.patch('/api/admin/scheduling/signups/:id/member-password', h.updateSignupMemberPassword)

  app.get('/api/admin/scheduling/discount-rules', d.listRules)
  app.post('/api/admin/scheduling/discount-rules', d.createRule)
  app.put('/api/admin/scheduling/discount-rules/:id', d.updateRule)
  app.delete('/api/admin/scheduling/discount-rules/:id', d.deleteRule)
  app.put('/api/admin/scheduling/discount-settings', d.updateGlobalSettings)
  app.post('/api/admin/scheduling/discount-simulate', d.simulateOrder)
  app.get('/api/admin/scheduling/promo-codes', pc.listPromoCodes)

  app.get('/api/admin/scheduling/members/:memberId/pricing-summary', h.adminMemberPricingSummary)
  app.get('/api/admin/scheduling/members/:memberId/enrollments', h.adminMemberEnrollments)
  app.post('/api/admin/scheduling/signups/:id/discount', h.adminSetSignupDiscount)
  app.delete('/api/admin/scheduling/enrollments/:id', h.adminDeleteEnrollment)
  app.get('/api/admin/scheduling/additional-fees', f.listFees)
  app.post('/api/admin/scheduling/additional-fees', f.createFee)
  app.put('/api/admin/scheduling/additional-fees/:id', f.updateFee)
  app.delete('/api/admin/scheduling/additional-fees/:id', f.deleteFee)

  app.get('/api/admin/scheduling/free-passes', fp.listTemplates)
  app.post('/api/admin/scheduling/free-passes', fp.createTemplate)
  app.put('/api/admin/scheduling/free-passes/:id', fp.updateTemplate)
  app.delete('/api/admin/scheduling/free-passes/:id', fp.deleteTemplate)
  app.get('/api/admin/scheduling/pricing-pass-attachments', fp.getAttachments)
  app.put('/api/admin/scheduling/pricing-pass-attachments', fp.putAttachments)
  app.get('/api/admin/scheduling/pricing-benefit-selections', bs.getSelections)
  app.put('/api/admin/scheduling/pricing-benefit-selections', bs.putSelections)
  app.get('/api/admin/scheduling/members/:memberId/free-passes', fp.listMemberGrants)
  app.post('/api/admin/scheduling/members/:memberId/free-passes', fp.issueMemberGrant)
  app.post('/api/admin/scheduling/free-passes/simulate', fp.simulate)

  console.log('✅ Scheduling routes registered')
}
