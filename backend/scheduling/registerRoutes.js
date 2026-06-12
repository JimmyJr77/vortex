import rateLimit from 'express-rate-limit'
import { createSchedulingHandlers } from './handlers.js'

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many signup attempts' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts' },
})

export function registerSchedulingRoutes(app, pool) {
  const h = createSchedulingHandlers(pool)

  app.get('/api/scheduling/forms', h.listPublicForms)
  app.get('/api/scheduling/forms/:id', h.getPublicForm)
  app.post('/api/scheduling/auth/check-email', authLimiter, h.checkEmail)
  app.post('/api/scheduling/auth/login', authLimiter, h.authLogin)
  app.post('/api/scheduling/auth/magic-link', authLimiter, h.authMagicLink)
  app.post('/api/scheduling/auth/verify-token', authLimiter, h.authVerifyToken)
  app.post('/api/scheduling/signups', signupLimiter, h.createSignup)

  app.get('/api/admin/scheduling/forms', h.listAdminForms)
  app.get('/api/admin/scheduling/forms/:id', h.getAdminForm)
  app.post('/api/admin/scheduling/forms', h.createAdminForm)
  app.put('/api/admin/scheduling/forms/:id', h.updateAdminForm)
  app.put('/api/admin/scheduling/forms/:id/signup-fields', h.updateSignupFields)
  app.delete('/api/admin/scheduling/forms/:id', h.deleteAdminForm)

  app.get('/api/admin/scheduling/categories', h.listCategories)
  app.post('/api/admin/scheduling/categories', h.createCategory)
  app.put('/api/admin/scheduling/categories/:id', h.updateCategory)
  app.delete('/api/admin/scheduling/categories/:id', h.deleteCategory)

  app.post('/api/admin/scheduling/forms/:formId/slot-batches', h.createSlotBatch)
  app.patch('/api/admin/scheduling/time-slots/:id', h.updateTimeSlot)
  app.delete('/api/admin/scheduling/time-slots/:id', h.deleteTimeSlot)
  app.patch('/api/admin/scheduling/slot-groups/:id', h.updateSlotGroupMax)
  app.delete('/api/admin/scheduling/slot-groups/:id', h.deleteSlotGroup)

  app.get('/api/admin/scheduling/signups', h.listSignups)
  app.patch('/api/admin/scheduling/signups/:id', h.updateSignupStatus)
  app.post('/api/admin/scheduling/signups/:id/resend-email', h.resendSignupEmail)
  app.patch('/api/admin/scheduling/signups/:id/member-password', h.updateSignupMemberPassword)

  console.log('✅ Scheduling routes registered')
}
