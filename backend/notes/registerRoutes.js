import { createNotesHandlers } from './handlers.js'

export function registerNotesRoutes(app, pool) {
  const h = createNotesHandlers(pool)

  app.get('/api/admin/notes', h.listNotes)
  app.post('/api/admin/notes', h.addNote)
  app.delete('/api/admin/notes/:id', h.deleteNote)

  console.log('✅ Notes routes registered')
}
