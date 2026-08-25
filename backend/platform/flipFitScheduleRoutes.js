import {
  loadFlipFitSchedule,
  saveFlipFitSchedule,
} from './flipFitScheduleRepository.js'

export function registerFlipFitScheduleRoutes(app, pool, { can, ok, bad }) {
  app.get('/api/coach/flip-fit-schedule', ...can('library.view'), async (req, res) => {
    try {
      const schedule = await loadFlipFitSchedule(pool, req.platformAuth.user.facility_id)
      ok(res, schedule)
    } catch (error) {
      bad(
        res,
        error.message,
        error.status ?? (error instanceof TypeError ? 400 : 500),
        error.code ? { code: error.code } : null,
      )
    }
  })

  app.put('/api/coach/flip-fit-schedule', ...can('training_programs.manage'), async (req, res) => {
    try {
      const schedule = await saveFlipFitSchedule(
        pool,
        req.platformAuth.user.facility_id,
        req.platformAuth.user.id,
        req.body ?? {},
      )
      ok(res, schedule)
    } catch (error) {
      bad(
        res,
        error.message,
        error.status ?? (error instanceof TypeError ? 400 : 500),
        error.code ? { code: error.code } : null,
      )
    }
  })
}
