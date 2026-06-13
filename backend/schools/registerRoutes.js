import { createSchoolsHandlers } from './handlers.js'

export function registerSchoolsRoutes(app, pool) {
  const h = createSchoolsHandlers(pool)

  app.get('/api/schools/search', h.searchSchoolsPublic)
  app.get('/api/admin/schools', h.listSchools)
  app.get('/api/admin/schools/unverified', h.listUnverified)
  app.post('/api/admin/schools', h.createSchool)
  app.put('/api/admin/schools/:id', h.updateSchool)
  app.patch('/api/admin/schools/:id/active', h.setActive)
  app.post('/api/admin/schools/:id/verify', h.verifySchool)
  app.post('/api/admin/schools/:id/merge', h.mergeSchool)
  app.get('/api/admin/schools/:id/members', h.schoolMembers)
  app.get('/api/admin/members/:id/schools', h.memberSchools)
  app.put('/api/admin/members/:id/schools', h.setMemberSchoolsRoute)

  console.log('✅ Schools routes registered')
}
