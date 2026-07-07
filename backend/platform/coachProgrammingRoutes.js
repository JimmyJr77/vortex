import {
  loadProgrammingMethodBundle,
  attachProgrammingMethod,
  buildProgrammingCard,
  saveProgrammingMethod,
  validateProgrammingMethodPublishReady,
  programmingMethodSummary,
  PROGRAMMING_CATEGORIES,
  EXERCISE_COMPATIBILITY_TYPES,
} from './programmingMethodProgramming.js'
import { validateProgrammingBlock, scoreProgrammingMethodForBlock } from './programmingValidation.js'
import { normalizePhaseKey } from './sessionPhaseKeys.js'

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80)
}

function canMutateRow(row, userId) {
  if (!row) return false
  return row.visibility !== 'private' || Number(row.created_by) === Number(userId)
}

export function registerProgrammingRoutes(app, pool, { can, canMutateRow: sharedCanMutate, ok, bad }) {
  const mutateCheck = sharedCanMutate ?? canMutateRow

  app.get('/api/coach/programming-taxonomy', ...can('library.view'), (_req, res) => {
    ok(res, {
      categories: PROGRAMMING_CATEGORIES,
      exerciseCompatibilityTypes: EXERCISE_COMPATIBILITY_TYPES,
      energySystems: ['aerobic', 'glycolytic', 'alactic_repeat', 'mixed', 'recovery', 'local_muscular_endurance', 'grip_endurance', 'trunk_endurance'],
      programmingTypes: ['emom', 'amrap', 'interval', 'circuit', 'density', 'tempo', 'relay', 'game', 'timed_work_capacity', 'repeat_sprint', 'repeat_shuttle', 'zone2', 'custom'],
    })
  })

  app.get('/api/coach/programming-methods', ...can('library.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const userId = Number(req.platformAuth.user.id)
      const params = [facilityId, userId]
      const where = [
        `pm.facility_id = $1`,
        `pm.archived = FALSE`,
        `((pm.visibility = 'facility' AND pm.is_published = TRUE) OR pm.created_by = $2)`,
      ]
      const q = req.query.q ? String(req.query.q).trim() : null
      if (q) {
        params.push(`%${q}%`)
        where.push(`(pm.name ILIKE $${params.length} OR pm.definition ILIKE $${params.length} OR pm.coach_summary ILIKE $${params.length})`)
      }
      if (req.query.category) {
        params.push(String(req.query.category))
        where.push(`pm.category = $${params.length}`)
      }
      const phase = req.query.phase ? normalizePhaseKey(String(req.query.phase)) : null
      if (phase) {
        params.push(phase)
        where.push(`(pm.best_session_phase = $${params.length} OR $${params.length} = ANY(pm.compatible_session_phases))`)
      }
      if (req.query.groupFriendly === 'true') {
        where.push(`(pm.workout_builder_rules->>'group_friendly')::boolean IS TRUE`)
      }
      const result = await pool.query(
        `SELECT pm.* FROM coaching.programming_method pm WHERE ${where.join(' AND ')} ORDER BY pm.category, pm.name LIMIT 500`,
        params,
      )
      const ids = result.rows.map((r) => Number(r.id))
      const bundle = await loadProgrammingMethodBundle(pool, ids)
      ok(res, result.rows.map((row) => programmingMethodSummary(row, attachProgrammingMethod(row, bundle))))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/programming-methods/:id', ...can('library.view'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const result = await pool.query(`SELECT * FROM coaching.programming_method WHERE id = $1 AND facility_id = $2 AND archived = FALSE`, [id, facilityId])
      if (result.rows.length === 0) return bad(res, 'Programming method not found.', 404)
      const bundle = await loadProgrammingMethodBundle(pool, [id])
      ok(res, attachProgrammingMethod(result.rows[0], bundle))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/programming-methods/:id/card', ...can('library.view'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const result = await pool.query(`SELECT * FROM coaching.programming_method WHERE id = $1 AND facility_id = $2 AND archived = FALSE`, [id, facilityId])
      if (result.rows.length === 0) return bad(res, 'Programming method not found.', 404)
      const bundle = await loadProgrammingMethodBundle(pool, [id])
      const attached = attachProgrammingMethod(result.rows[0], bundle)
      ok(res, buildProgrammingCard(result.rows[0], attached))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/programming-methods', ...can('library.manage'), async (req, res) => {
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const name = String(req.body?.name || '').trim()
    if (!name) return bad(res, 'Name is required.')
    const slug = slugify(req.body?.slug || name)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const created = await client.query(
        `
          INSERT INTO coaching.programming_method (
            facility_id, name, slug, category, definition, coach_summary, athlete_summary,
            primary_development_goal, secondary_development_goals, programming_type, best_session_phase,
            compatible_session_phases, incompatible_phases, energy_system_focus, fatigue_profile,
            supervision_level, what_it_is, why_it_matters, when_to_use, when_not_to_use, common_misuse,
            work_rest_structure, exercise_compatibility, workout_builder_rules, created_by, visibility, is_published
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24::jsonb,$25,$26,$27
          ) RETURNING id
        `,
        [
          facilityId, name, slug,
          req.body?.category || 'custom',
          req.body?.definition || null,
          req.body?.coach_summary || null,
          req.body?.athlete_summary || null,
          req.body?.primary_development_goal || null,
          req.body?.secondary_development_goals ?? [],
          req.body?.programming_type || 'custom',
          normalizePhaseKey(req.body?.best_session_phase),
          req.body?.compatible_session_phases ?? [],
          req.body?.incompatible_phases ?? [],
          req.body?.energy_system_focus ?? [],
          JSON.stringify(req.body?.fatigue_profile ?? {}),
          req.body?.supervision_level || 'recommended',
          req.body?.what_it_is || null,
          req.body?.why_it_matters || null,
          req.body?.when_to_use || null,
          req.body?.when_not_to_use || null,
          req.body?.common_misuse ?? [],
          JSON.stringify(req.body?.work_rest_structure ?? {}),
          JSON.stringify(req.body?.exercise_compatibility ?? {}),
          JSON.stringify(req.body?.workout_builder_rules ?? {}),
          userId,
          req.body?.visibility === 'private' ? 'private' : 'facility',
          req.body?.is_published !== false,
        ],
      )
      const id = Number(created.rows[0].id)
      await saveProgrammingMethod(client, id, req.body || {})
      await client.query('COMMIT')
      ok(res, { id })
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  app.put('/api/coach/programming-methods/:id', ...can('library.manage'), async (req, res) => {
    const id = num(req.params.id)
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const existing = await pool.query(`SELECT * FROM coaching.programming_method WHERE id = $1 AND facility_id = $2`, [id, facilityId])
    if (existing.rows.length === 0) return bad(res, 'Programming method not found.', 404)
    if (!mutateCheck(existing.rows[0], userId)) return bad(res, 'You can only edit private items you created.', 403)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await saveProgrammingMethod(client, id, req.body || {})
      await client.query('COMMIT')
      ok(res, { id })
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  app.delete('/api/coach/programming-methods/:id', ...can('library.manage'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const userId = Number(req.platformAuth.user.id)
      const existing = await pool.query(`SELECT * FROM coaching.programming_method WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      if (existing.rows.length === 0) return bad(res, 'Programming method not found.', 404)
      if (!mutateCheck(existing.rows[0], userId)) return bad(res, 'You can only delete private items you created.', 403)
      await pool.query(`UPDATE coaching.programming_method SET archived = TRUE, updated_at = now() WHERE id = $1`, [id])
      ok(res, { id })
    } catch (error) {
      bad(res, error.message)
    }
  })

  app.post('/api/coach/workout-builder/validate-programming-block', ...can('library.view'), async (req, res) => {
    try {
      const result = await validateProgrammingBlock(pool, req.body || {})
      ok(res, result)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/needs-engine/prescribe-programming-method', ...can('library.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const phaseKey = normalizePhaseKey(req.body?.phaseKey ?? req.body?.phase_key)
      if (!phaseKey) return bad(res, 'phaseKey is required.')
      const result = await pool.query(
        `
          SELECT pm.* FROM coaching.programming_method pm
          WHERE pm.facility_id = $1 AND pm.archived = FALSE AND pm.is_published = TRUE
            AND (pm.best_session_phase = $2 OR $2 = ANY(pm.compatible_session_phases))
          ORDER BY pm.name
        `,
        [facilityId, phaseKey],
      )
      const ids = result.rows.map((r) => Number(r.id))
      const bundle = await loadProgrammingMethodBundle(pool, ids)
      const ctx = {
        phaseKey,
        youth: Boolean(req.body?.youth),
        lowImpact: Boolean(req.body?.lowImpact),
        groupSize: Number(req.body?.groupSize) || 1,
        desiredAdaptation: req.body?.desiredAdaptation ? String(req.body.desiredAdaptation) : null,
        methodologyKey: req.body?.methodologyKey ? String(req.body.methodologyKey).toLowerCase() : null,
        blockMinutes: Number(req.body?.blockMinutes) || null,
      }
      const ranked = result.rows
        .map((row) => {
          const attached = attachProgrammingMethod(row, bundle)
          return { method: attached, score: scoreProgrammingMethodForBlock(attached, ctx) }
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
      const top = ranked[0]?.method ?? null
      ok(res, {
        recommendations: ranked.slice(0, 5).map((r) => ({
          id: r.method.id,
          slug: r.method.slug,
          name: r.method.name,
          score: r.score,
          prescriptions: r.method.prescriptions,
          workout_builder_rules: r.method.workout_builder_rules,
        })),
        selected: top,
      })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })
}
