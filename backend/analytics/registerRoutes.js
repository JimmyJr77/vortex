import rateLimit from 'express-rate-limit'
import { createPublicAnalyticsHandlers } from './publicHandlers.js'
import { createAdminAnalyticsHandlers } from './adminHandlers.js'

const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many analytics events' },
})

export function registerAnalyticsRoutes(app, pool) {
  const publicHandlers = createPublicAnalyticsHandlers(pool)
  const admin = createAdminAnalyticsHandlers(pool)

  app.post('/api/analytics/event', eventLimiter, publicHandlers.ingestEvents)
  app.post('/api/consent', eventLimiter, publicHandlers.recordConsent)

  app.get('/api/admin/analytics/overview', admin.getOverview)
  app.get('/api/admin/analytics/traffic', admin.getTraffic)
  app.get('/api/admin/analytics/funnel', admin.getFunnel)
  app.get('/api/admin/analytics/programs', admin.getPrograms)
  app.get('/api/admin/analytics/inquiries', admin.getInquiries)
  app.get('/api/admin/analytics/conversion', admin.getConversion)
  app.get('/api/admin/analytics/export', admin.exportReport)
  app.get('/api/admin/analytics/seo', admin.getSeo)
  app.post('/api/admin/analytics/sync', admin.postSync)

  app.get('/api/admin/competitors', admin.listCompetitors)
  app.post('/api/admin/competitors', admin.createCompetitor)
  app.put('/api/admin/competitors/:id', admin.updateCompetitor)
  app.post('/api/admin/competitors/:id/snapshots', admin.addSnapshot)

  app.get('/api/admin/marketing-campaigns', admin.listCampaigns)
  app.post('/api/admin/marketing-campaigns', admin.createCampaign)

  console.log('✅ Analytics routes registered')
}
