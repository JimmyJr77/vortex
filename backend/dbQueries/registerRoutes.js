import { createDbQueryHandlers } from './handlers.js'

export function registerDbQueryRoutes(app, pool) {
  const h = createDbQueryHandlers(pool)

  app.get('/api/admin/db-queries/entities', h.getEntities)
  app.post('/api/admin/db-queries/run', h.run)
  app.post('/api/admin/db-queries/export', h.exportCsv)
  app.get('/api/admin/db-queries/saved', h.listSaved)
  app.post('/api/admin/db-queries/saved', h.saveQuery)
  app.delete('/api/admin/db-queries/saved/:id', h.deleteSaved)

  console.log('✅ DB Queries routes registered')
}
