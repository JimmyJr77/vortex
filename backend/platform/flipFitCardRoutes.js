import {
  loadFlipFitCardReferences,
  reconcileFlipFitCards,
} from './flipFitCardRepository.js'

export function registerFlipFitCardRoutes(app, pool, { can, ok, bad }) {
  app.get('/api/coach/flip-fit-card-references', ...can('library.view'), async (req, res) => {
    try {
      ok(res, await loadFlipFitCardReferences(pool, req.platformAuth.user.facility_id))
    } catch (error) {
      bad(res, error.message, error.status ?? 500, error.code ? { code: error.code } : null)
    }
  })

  app.post('/api/coach/flip-fit-card-references/reconcile', ...can('library.manage'), async (req, res) => {
    try {
      ok(res, await reconcileFlipFitCards(
        pool,
        req.platformAuth.user.facility_id,
        Number(req.platformAuth.user.id),
        req.body?.cards,
      ))
    } catch (error) {
      bad(
        res,
        error.message,
        error.status ?? (error instanceof TypeError || error instanceof RangeError ? 400 : 500),
        error.code ? { code: error.code } : error.details ?? null,
      )
    }
  })
}
