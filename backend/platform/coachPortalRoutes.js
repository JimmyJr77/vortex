// ============================================================
// Vortex Coach Portal — API routes
//
// Mounts the coaching module endpoints: taxonomy, exercise library,
// workout/warmup builders, the Needs Engine, training programs,
// challenges, assessments/grading, plan assignment + completion,
// athlete-facing training endpoints, insights, and the AI layer.
//
// All coaching tables live in the `coaching` Postgres schema; auth/RBAC
// reuses the platform helpers from registerRoutes.js.
// ============================================================

import crypto from 'crypto'
import { authMiddleware, requirePermission, requireAnyPermission } from './registerRoutes.js'
import { sendEmail, isEmailConfigured } from '../email/sendEmail.js'
import { llmProgressNarrative } from './aiService.js'
import { buildProgressReportPdf } from './pdfReport.js'
import { registerCoachingPhaseGHRoutes } from './coachPhaseGHRoutes.js'
import {
  queryAssignmentTargetMemberIds,
  queryAssignTargetOptions,
  queryAssignDrilldown,
  planAssignmentMemberMatchSql,
} from './assignmentTargets.js'
import {
  queryCoachRosterMemberIds,
  getMembersForCoachClassTarget,
  queryCoachUserIdsForMember,
  queryCoachMemberPickerList,
  queryMinorChildGuardianMemberIds,
} from './coachRoster.js'
import { ensureCoachingNotificationSchema } from './coachingSchemaEnsure.js'

function ok(res, data) {
  res.json({ success: true, data })
}

function bad(res, message, status = 400) {
  res.status(status).json({ success: false, message })
}

function num(value) {
  const n = Number(value)
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

// Private library items can only be mutated by their creator. Facility-shared
// items remain editable by anyone holding the relevant manage permission.
function canMutateRow(row, userId) {
  if (!row) return false
  return row.visibility !== 'private' || Number(row.created_by) === Number(userId)
}

const FACET_TYPES = ['tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'sport', 'intent', 'body_region']

// Estimate seconds for a single workout item.
function itemSeconds(item, exerciseEst) {
  const sets = Number(item.sets) || 1
  const work = Number(item.work_seconds) || Number(exerciseEst) || 45
  const rest = Number(item.rest_seconds) || 0
  return sets * work + sets * rest
}

function computeWorkoutMinutes(blocks) {
  let total = 0
  for (const block of blocks) {
    const rounds = Number(block.rounds) || 1
    const restBetween = Number(block.rest_between_rounds_seconds) || 0
    let blockItemsSeconds = 0
    for (const item of block.items || []) {
      blockItemsSeconds += itemSeconds(item, item.est_seconds_per_set)
    }
    total += rounds * blockItemsSeconds + restBetween * Math.max(rounds - 1, 0)
  }
  return Math.round(total / 60)
}

export function registerCoachPortalRoutes(app, pool, { jwtSecret }) {
  const auth = authMiddleware(pool, jwtSecret)
  const can = (permission) => requirePermission(pool, jwtSecret, permission)
  const canAny = (permissions) => requireAnyPermission(pool, jwtSecret, permissions)

  // ==========================================================
  // TAXONOMY
  // ==========================================================
  app.get('/api/coach/taxonomy', ...can('library.view'), async (_req, res) => {
    try {
      const [tenets, methodologies, physiology, patterns, equipment, sports, intents, bodyRegions] = await Promise.all([
        pool.query(`SELECT id, key, name, description, detail, sort_order FROM coaching.tenet ORDER BY sort_order`),
        pool.query(`SELECT id, key, name, description, sort_order FROM coaching.methodology ORDER BY sort_order`),
        pool.query(`SELECT id, key, name, systems, purpose, outcomes, is_optional, sort_order FROM coaching.physiological_emphasis ORDER BY sort_order`),
        pool.query(`SELECT id, key, name, sort_order FROM coaching.movement_pattern ORDER BY sort_order`),
        pool.query(`SELECT id, key, name, sort_order FROM coaching.equipment ORDER BY sort_order`),
        pool.query(`SELECT id, key, name, sort_order FROM coaching.sport ORDER BY sort_order`),
        pool.query(`SELECT id, key, name, sort_order FROM coaching.exercise_intent ORDER BY sort_order`),
        pool.query(`SELECT id, key, name, sort_order FROM coaching.body_region ORDER BY sort_order`),
      ])
      ok(res, {
        tenets: tenets.rows,
        methodologies: methodologies.rows,
        physiology: physiology.rows,
        patterns: patterns.rows,
        equipment: equipment.rows,
        sports: sports.rows,
        intents: intents.rows,
        bodyRegions: bodyRegions.rows,
      })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // Public taxonomy (used by the marketing site). Read-only, no auth.
  app.get('/api/public/coach/taxonomy', async (_req, res) => {
    try {
      const [tenets, methodologies, physiology] = await Promise.all([
        pool.query(`SELECT key, name, description, detail, sort_order FROM coaching.tenet ORDER BY sort_order`),
        pool.query(`SELECT key, name, description, sort_order FROM coaching.methodology ORDER BY sort_order`),
        pool.query(`SELECT key, name, systems, purpose, outcomes, is_optional, sort_order FROM coaching.physiological_emphasis ORDER BY sort_order`),
      ])
      ok(res, {
        tenets: tenets.rows,
        methodologies: methodologies.rows,
        physiology: physiology.rows,
      })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // ==========================================================
  // EXERCISE LIBRARY
  // ==========================================================

  async function loadExerciseTags(exerciseIds) {
    if (exerciseIds.length === 0) return new Map()
    const tags = await pool.query(
      `SELECT exercise_id, facet_type, facet_id, weight FROM coaching.exercise_tag WHERE exercise_id = ANY($1::bigint[])`,
      [exerciseIds],
    )
    const map = new Map()
    for (const row of tags.rows) {
      const list = map.get(String(row.exercise_id)) ?? []
      list.push({ facetType: row.facet_type, facetId: Number(row.facet_id), weight: Number(row.weight) })
      map.set(String(row.exercise_id), list)
    }
    return map
  }

  app.get('/api/coach/exercises', ...can('library.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const userId = Number(req.platformAuth.user.id)
      const params = [facilityId, userId]
      const where = [
        `e.facility_id = $1`,
        `e.archived = FALSE`,
        `((e.visibility = 'facility' AND e.is_published = TRUE) OR e.created_by = $2)`,
      ]

      const q = req.query.q ? String(req.query.q).trim() : null
      if (q) {
        params.push(`%${q}%`)
        where.push(`(e.name ILIKE $${params.length} OR e.description ILIKE $${params.length})`)
      }

      const sportId = num(req.query.sport)
      if (sportId) {
        params.push(sportId)
        where.push(`(e.sport_id = $${params.length} OR e.sport_id IS NULL)`)
      }

      const maxSeconds = num(req.query.maxSeconds)
      if (maxSeconds) {
        params.push(maxSeconds)
        where.push(`e.est_seconds_per_set <= $${params.length}`)
      }

      if (req.query.level) {
        params.push(String(req.query.level))
        where.push(`e.skill_level = $${params.length}::public.skill_level`)
      }

      // Facet filters: tenet, method->methodology, physio->physiology, pattern, equipment, intent, body_region.
      const facetMap = {
        tenet: req.query.tenet,
        methodology: req.query.method ?? req.query.methodology,
        physiology: req.query.physio ?? req.query.physiology,
        pattern: req.query.pattern,
        equipment: req.query.equipment,
        intent: req.query.intent,
        body_region: req.query.bodyRegion ?? req.query.body_region,
      }
      for (const [facetType, raw] of Object.entries(facetMap)) {
        if (!raw) continue
        const ids = String(raw).split(',').map((v) => num(v)).filter((v) => v != null)
        if (ids.length === 0) continue
        params.push(facetType)
        const facetTypeIdx = params.length
        params.push(ids)
        const idsIdx = params.length
        where.push(`EXISTS (
          SELECT 1 FROM coaching.exercise_tag t
          WHERE t.exercise_id = e.id
            AND t.facet_type = $${facetTypeIdx}
            AND t.facet_id = ANY($${idsIdx}::bigint[])
        )`)
      }

      const result = await pool.query(
        `
          SELECT e.*, s.name as sport_name
          FROM coaching.exercise e
          LEFT JOIN coaching.sport s ON s.id = e.sport_id
          WHERE ${where.join(' AND ')}
          ORDER BY e.name
          LIMIT 500
        `,
        params,
      )
      const ids = result.rows.map((r) => Number(r.id))
      const tagMap = await loadExerciseTags(ids)
      ok(res, result.rows.map((r) => ({ ...r, tags: tagMap.get(String(r.id)) ?? [] })))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/exercises/:id', ...can('library.view'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const exercise = await pool.query(
        `SELECT e.*, s.name as sport_name FROM coaching.exercise e LEFT JOIN coaching.sport s ON s.id = e.sport_id WHERE e.id = $1 AND e.facility_id = $2`,
        [id, facilityId],
      )
      if (exercise.rows.length === 0) return bad(res, 'Exercise not found.', 404)
      const [tagMap, media, cues, prereqs] = await Promise.all([
        loadExerciseTags([id]),
        pool.query(`SELECT * FROM coaching.exercise_media WHERE exercise_id = $1 ORDER BY sort_order, id`, [id]),
        pool.query(`SELECT * FROM coaching.exercise_cue WHERE exercise_id = $1 ORDER BY sort_order, id`, [id]),
        pool.query(
          `SELECT p.prerequisite_exercise_id, p.note, e.name FROM coaching.exercise_prerequisite p JOIN coaching.exercise e ON e.id = p.prerequisite_exercise_id WHERE p.exercise_id = $1`,
          [id],
        ),
      ])
      ok(res, {
        ...exercise.rows[0],
        tags: tagMap.get(String(id)) ?? [],
        media: media.rows,
        cues: cues.rows,
        prerequisites: prereqs.rows,
      })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  async function writeExerciseRelations(client, exerciseId, body) {
    if (Array.isArray(body.tags)) {
      await client.query(`DELETE FROM coaching.exercise_tag WHERE exercise_id = $1`, [exerciseId])
      for (const tag of body.tags) {
        if (!FACET_TYPES.includes(tag.facetType) || num(tag.facetId) == null) continue
        await client.query(
          `INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight) VALUES ($1, $2, $3, $4)
           ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight`,
          [exerciseId, tag.facetType, num(tag.facetId), Math.min(Math.max(Number(tag.weight) || 3, 1), 5)],
        )
      }
    }
    if (Array.isArray(body.media)) {
      await client.query(`DELETE FROM coaching.exercise_media WHERE exercise_id = $1`, [exerciseId])
      let i = 0
      for (const m of body.media) {
        if (!m.url) continue
        await client.query(
          `INSERT INTO coaching.exercise_media (exercise_id, kind, url, caption, sort_order) VALUES ($1, $2, $3, $4, $5)`,
          [exerciseId, m.kind || 'video', m.url, m.caption || null, i++],
        )
      }
    }
    if (Array.isArray(body.cues)) {
      await client.query(`DELETE FROM coaching.exercise_cue WHERE exercise_id = $1`, [exerciseId])
      let i = 0
      for (const c of body.cues) {
        if (!c.body) continue
        await client.query(
          `INSERT INTO coaching.exercise_cue (exercise_id, cue_type, body, sort_order) VALUES ($1, $2, $3, $4)`,
          [exerciseId, c.cue_type === 'fault' ? 'fault' : 'cue', c.body, i++],
        )
      }
    }
    if (Array.isArray(body.prerequisites)) {
      await client.query(`DELETE FROM coaching.exercise_prerequisite WHERE exercise_id = $1`, [exerciseId])
      for (const p of body.prerequisites) {
        const pid = num(p.prerequisite_exercise_id ?? p)
        if (pid == null || pid === exerciseId) continue
        await client.query(
          `INSERT INTO coaching.exercise_prerequisite (exercise_id, prerequisite_exercise_id, note) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [exerciseId, pid, p.note || null],
        )
      }
    }
  }

  app.post('/api/coach/exercises', ...can('library.manage'), async (req, res) => {
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const name = String(req.body?.name || '').trim()
    if (!name) return bad(res, 'Exercise name is required.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const created = await client.query(
        `
          INSERT INTO coaching.exercise (
            facility_id, name, slug, description, instructions, sport_id, skill_level,
            age_min, age_max, default_sets, default_reps, default_work_seconds,
            default_rest_seconds, tempo, load_note, est_seconds_per_set, created_by,
            is_published, visibility
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::public.skill_level, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          RETURNING id
        `,
        [
          facilityId, name, slugify(name) || `ex-${Date.now()}`, req.body?.description || null,
          req.body?.instructions || null, num(req.body?.sport_id), req.body?.skill_level || null,
          num(req.body?.age_min), num(req.body?.age_max), num(req.body?.default_sets), num(req.body?.default_reps),
          num(req.body?.default_work_seconds), num(req.body?.default_rest_seconds), req.body?.tempo || null,
          req.body?.load_note || null, num(req.body?.est_seconds_per_set) ?? 45, userId,
          req.body?.is_published !== false, req.body?.visibility === 'private' ? 'private' : 'facility',
        ],
      )
      const id = Number(created.rows[0].id)
      await writeExerciseRelations(client, id, req.body || {})
      await client.query('COMMIT')
      ok(res, { id })
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  app.put('/api/coach/exercises/:id', ...can('library.manage'), async (req, res) => {
    const id = num(req.params.id)
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query(`SELECT id, created_by, visibility FROM coaching.exercise WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK')
        return bad(res, 'Exercise not found.', 404)
      }
      if (!canMutateRow(existing.rows[0], userId)) {
        await client.query('ROLLBACK')
        return bad(res, 'You can only edit private items you created.', 403)
      }
      await client.query(
        `
          UPDATE coaching.exercise SET
            name = COALESCE($2, name),
            description = $3, instructions = $4, sport_id = $5, skill_level = $6::public.skill_level,
            age_min = $7, age_max = $8, default_sets = $9, default_reps = $10, default_work_seconds = $11,
            default_rest_seconds = $12, tempo = $13, load_note = $14, est_seconds_per_set = COALESCE($15, est_seconds_per_set),
            is_published = COALESCE($16, is_published), visibility = COALESCE($17, visibility), updated_at = now()
          WHERE id = $1
        `,
        [
          id, req.body?.name ? String(req.body.name).trim() : null, req.body?.description || null,
          req.body?.instructions || null, num(req.body?.sport_id), req.body?.skill_level || null,
          num(req.body?.age_min), num(req.body?.age_max), num(req.body?.default_sets), num(req.body?.default_reps),
          num(req.body?.default_work_seconds), num(req.body?.default_rest_seconds), req.body?.tempo || null,
          req.body?.load_note || null, num(req.body?.est_seconds_per_set),
          typeof req.body?.is_published === 'boolean' ? req.body.is_published : null,
          req.body?.visibility === 'private' ? 'private' : req.body?.visibility === 'facility' ? 'facility' : null,
        ],
      )
      await writeExerciseRelations(client, id, req.body || {})
      await client.query('COMMIT')
      ok(res, { id })
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  app.delete('/api/coach/exercises/:id', ...can('library.manage'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const userId = Number(req.platformAuth.user.id)
      const existing = await pool.query(`SELECT id, created_by, visibility FROM coaching.exercise WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      if (existing.rows.length === 0) return bad(res, 'Exercise not found.', 404)
      if (!canMutateRow(existing.rows[0], userId)) return bad(res, 'You can only delete private items you created.', 403)
      await pool.query(`UPDATE coaching.exercise SET archived = TRUE, updated_at = now() WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      ok(res, { id })
    } catch (error) {
      bad(res, error.message)
    }
  })

  // ==========================================================
  // WORKOUTS (full-structure read + replace)
  // ==========================================================

  async function loadWorkout(workoutId, facilityId) {
    const workout = await pool.query(
      `SELECT w.*, s.name as sport_name FROM coaching.workout w LEFT JOIN coaching.sport s ON s.id = w.sport_id WHERE w.id = $1 AND w.facility_id = $2`,
      [workoutId, facilityId],
    )
    if (workout.rows.length === 0) return null
    const blocks = await pool.query(`SELECT * FROM coaching.workout_block WHERE workout_id = $1 ORDER BY sort_order, id`, [workoutId])
    const blockIds = blocks.rows.map((b) => Number(b.id))
    let items = { rows: [] }
    if (blockIds.length > 0) {
      items = await pool.query(
        `
          SELECT i.*, e.name as exercise_name, e.est_seconds_per_set
          FROM coaching.workout_item i
          LEFT JOIN coaching.exercise e ON e.id = i.exercise_id
          WHERE i.block_id = ANY($1::bigint[])
          ORDER BY i.sort_order, i.id
        `,
        [blockIds],
      )
    }
    const itemsByBlock = new Map()
    for (const item of items.rows) {
      const list = itemsByBlock.get(String(item.block_id)) ?? []
      list.push(item)
      itemsByBlock.set(String(item.block_id), list)
    }
    const blockList = blocks.rows.map((b) => ({ ...b, items: itemsByBlock.get(String(b.id)) ?? [] }))
    return { ...workout.rows[0], blocks: blockList, computed_minutes: computeWorkoutMinutes(blockList) }
  }

  // Signed direct-to-Cloudinary upload for exercise media. The client uploads
  // the file straight to Cloudinary using this signature, then stores the
  // returned secure_url in coaching.exercise_media via the exercise editor.
  app.get('/api/coach/media/upload-signature', ...can('library.manage'), (req, res) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (!cloudName || !apiKey || !apiSecret) {
      return ok(res, { configured: false })
    }
    const timestamp = Math.floor(Date.now() / 1000)
    const folder = 'coaching/exercise-media'
    const toSign = `folder=${folder}&timestamp=${timestamp}`
    const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex')
    ok(res, {
      configured: true,
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    })
  })

  app.get('/api/coach/workouts', ...can('library.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const userId = Number(req.platformAuth.user.id)
      const params = [facilityId, userId]
      const where = [`w.facility_id = $1`, `w.archived = FALSE`, `((w.visibility = 'facility' AND w.is_published = TRUE) OR w.created_by = $2)`]
      if (req.query.type) {
        params.push(String(req.query.type))
        where.push(`w.type = $${params.length}`)
      }
      const sportId = num(req.query.sport)
      if (sportId) {
        params.push(sportId)
        where.push(`(w.sport_id = $${params.length} OR w.sport_id IS NULL)`)
      }
      const minMinutes = num(req.query.minMinutes)
      if (minMinutes != null) {
        params.push(minMinutes)
        where.push(`w.computed_minutes >= $${params.length}`)
      }
      const maxMinutes = num(req.query.maxMinutes)
      if (maxMinutes != null) {
        params.push(maxMinutes)
        where.push(`w.computed_minutes <= $${params.length}`)
      }
      const result = await pool.query(
        `SELECT w.*, s.name as sport_name FROM coaching.workout w LEFT JOIN coaching.sport s ON s.id = w.sport_id WHERE ${where.join(' AND ')} ORDER BY w.updated_at DESC`,
        params,
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/workouts/:id', ...can('library.view'), async (req, res) => {
    try {
      const workout = await loadWorkout(num(req.params.id), req.platformAuth.user.facility_id)
      if (!workout) return bad(res, 'Workout not found.', 404)
      ok(res, workout)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  async function writeWorkoutStructure(client, workoutId, blocks) {
    await client.query(`DELETE FROM coaching.workout_block WHERE workout_id = $1`, [workoutId])
    let blockOrder = 0
    for (const block of blocks || []) {
      const createdBlock = await client.query(
        `
          INSERT INTO coaching.workout_block (workout_id, sort_order, label, block_format, rounds, rest_between_rounds_seconds, cap_minutes)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `,
        [
          workoutId, blockOrder++, block.label || null,
          ['straight_sets', 'circuit', 'amrap', 'emom', 'for_time', 'stations'].includes(block.block_format) ? block.block_format : 'straight_sets',
          Number(block.rounds) || 1, Number(block.rest_between_rounds_seconds) || 0, num(block.cap_minutes),
        ],
      )
      const blockId = Number(createdBlock.rows[0].id)
      let itemOrder = 0
      for (const item of block.items || []) {
        await client.query(
          `
            INSERT INTO coaching.workout_item (block_id, exercise_id, sort_order, sets, reps, work_seconds, rest_seconds, load, tempo, coaching_note)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          [
            blockId, num(item.exercise_id), itemOrder++, num(item.sets), num(item.reps),
            num(item.work_seconds), num(item.rest_seconds), item.load || null, item.tempo || null, item.coaching_note || null,
          ],
        )
      }
    }
  }

  app.post('/api/coach/workouts', ...can('workouts.manage'), async (req, res) => {
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const title = String(req.body?.title || '').trim()
    if (!title) return bad(res, 'Workout title is required.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const created = await client.query(
        `
          INSERT INTO coaching.workout (facility_id, title, type, sport_id, description, target_minutes, notes, created_by, is_published, visibility)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
        `,
        [
          facilityId, title,
          ['workout', 'warmup', 'cooldown', 'conditioning', 'practice'].includes(req.body?.type) ? req.body.type : 'workout',
          num(req.body?.sport_id), req.body?.description || null, num(req.body?.target_minutes), req.body?.notes || null,
          userId, req.body?.is_published !== false, req.body?.visibility === 'private' ? 'private' : 'facility',
        ],
      )
      const id = Number(created.rows[0].id)
      await writeWorkoutStructure(client, id, req.body?.blocks)
      await client.query('COMMIT')
      const full = await loadWorkout(id, facilityId)
      await pool.query(`UPDATE coaching.workout SET computed_minutes = $2 WHERE id = $1`, [id, full.computed_minutes])
      ok(res, full)
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  app.put('/api/coach/workouts/:id', ...can('workouts.manage'), async (req, res) => {
    const id = num(req.params.id)
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query(`SELECT id, created_by, visibility FROM coaching.workout WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK')
        return bad(res, 'Workout not found.', 404)
      }
      if (!canMutateRow(existing.rows[0], userId)) {
        await client.query('ROLLBACK')
        return bad(res, 'You can only edit private items you created.', 403)
      }
      await client.query(
        `
          UPDATE coaching.workout SET
            title = COALESCE($2, title), type = COALESCE($3, type), sport_id = $4,
            description = $5, target_minutes = $6, notes = $7,
            is_published = COALESCE($8, is_published), visibility = COALESCE($9, visibility), updated_at = now()
          WHERE id = $1
        `,
        [
          id, req.body?.title ? String(req.body.title).trim() : null,
          ['workout', 'warmup', 'cooldown', 'conditioning', 'practice'].includes(req.body?.type) ? req.body.type : null,
          num(req.body?.sport_id), req.body?.description || null, num(req.body?.target_minutes), req.body?.notes || null,
          typeof req.body?.is_published === 'boolean' ? req.body.is_published : null,
          req.body?.visibility === 'private' ? 'private' : req.body?.visibility === 'facility' ? 'facility' : null,
        ],
      )
      if (Array.isArray(req.body?.blocks)) {
        await writeWorkoutStructure(client, id, req.body.blocks)
      }
      await client.query('COMMIT')
      const full = await loadWorkout(id, facilityId)
      await pool.query(`UPDATE coaching.workout SET computed_minutes = $2 WHERE id = $1`, [id, full.computed_minutes])
      ok(res, full)
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  app.delete('/api/coach/workouts/:id', ...can('workouts.manage'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const userId = Number(req.platformAuth.user.id)
      const existing = await pool.query(`SELECT id, created_by, visibility FROM coaching.workout WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      if (existing.rows.length === 0) return bad(res, 'Workout not found.', 404)
      if (!canMutateRow(existing.rows[0], userId)) return bad(res, 'You can only delete private items you created.', 403)
      await pool.query(`UPDATE coaching.workout SET archived = TRUE, updated_at = now() WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      ok(res, { id })
    } catch (error) {
      bad(res, error.message)
    }
  })

  // ==========================================================
  // NEEDS ENGINE
  // ==========================================================
  async function runPrescription(facilityId, body) {
      const sportId = num(body.sportId)
      const ageMin = num(body.ageMin)
      const ageMax = num(body.ageMax)
      const level = body.skillLevel || null
      const equipmentIds = Array.isArray(body.equipmentIds) ? body.equipmentIds.map(num).filter((v) => v != null) : []
      const excludeBodyRegionIds = Array.isArray(body.excludeBodyRegionIds) ? body.excludeBodyRegionIds.map(num).filter((v) => v != null) : []
      const targets = Array.isArray(body.targets)
        ? body.targets
            .map((t) => ({ facetType: t.facetType, facetId: num(t.facetId), weight: Number(t.weight) || 3 }))
            .filter((t) => FACET_TYPES.includes(t.facetType) && t.facetId != null)
        : []
      const blocks = Array.isArray(body.blocks) && body.blocks.length > 0
        ? body.blocks
        : [{ label: 'Main Work', intentId: null, minutes: 30 }]

      // Candidate pool.
      const params = [facilityId]
      const where = [`e.facility_id = $1`, `e.archived = FALSE`, `e.is_published = TRUE`]
      if (sportId) {
        params.push(sportId)
        where.push(`(e.sport_id = $${params.length} OR e.sport_id IS NULL)`)
      }
      if (level) {
        params.push(level)
        where.push(`(e.skill_level IS NULL OR e.skill_level = $${params.length}::public.skill_level)`)
      }
      if (ageMin != null) {
        params.push(ageMin)
        where.push(`(e.age_max IS NULL OR e.age_max >= $${params.length})`)
      }
      if (ageMax != null) {
        params.push(ageMax)
        where.push(`(e.age_min IS NULL OR e.age_min <= $${params.length})`)
      }
      if (excludeBodyRegionIds.length > 0) {
        params.push(excludeBodyRegionIds)
        where.push(`NOT EXISTS (SELECT 1 FROM coaching.exercise_tag t WHERE t.exercise_id = e.id AND t.facet_type = 'body_region' AND t.facet_id = ANY($${params.length}::bigint[]))`)
      }
      const candidates = await pool.query(
        `SELECT e.* FROM coaching.exercise e WHERE ${where.join(' AND ')} LIMIT 1000`,
        params,
      )
      const ids = candidates.rows.map((r) => Number(r.id))
      const tagMap = await loadExerciseTags(ids)
      const allowedEquip = new Set(equipmentIds)

      const scored = candidates.rows
        .map((ex) => {
          const tags = tagMap.get(String(ex.id)) ?? []
          // Equipment gate: if a filter was provided, every equipment tag must be allowed.
          if (allowedEquip.size > 0) {
            const equip = tags.filter((t) => t.facetType === 'equipment')
            const blocked = equip.some((t) => !allowedEquip.has(t.facetId))
            if (blocked) return null
          }
          let score = 0
          for (const target of targets) {
            const match = tags.find((t) => t.facetType === target.facetType && t.facetId === target.facetId)
            if (match) score += match.weight * target.weight
          }
          const patternTag = tags.find((t) => t.facetType === 'pattern')
          const intentTags = tags.filter((t) => t.facetType === 'intent').map((t) => t.facetId)
          return { exercise: ex, tags, score, patternId: patternTag?.facetId ?? null, intentIds: intentTags }
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)

      // Time-pack each block.
      const usedPatterns = new Map()
      const resultBlocks = blocks.map((block) => {
        const budgetSeconds = (Number(block.minutes) || 20) * 60
        const intentId = num(block.intentId)
        const pool = scored
          .filter((c) => (intentId ? c.intentIds.includes(intentId) : true))
          .map((c) => {
            const penalty = usedPatterns.get(c.patternId) ? (usedPatterns.get(c.patternId) * 0.25) : 0
            return { ...c, adjScore: c.score * (1 - Math.min(penalty, 0.75)) }
          })
          .sort((a, b) => b.adjScore - a.adjScore)

        const items = []
        let usedSeconds = 0
        for (const c of pool) {
          const sets = Number(c.exercise.default_sets) || 3
          const est = Number(c.exercise.est_seconds_per_set) || 45
          const rest = Number(c.exercise.default_rest_seconds) || 30
          const cost = sets * est + sets * rest
          if (usedSeconds + cost > budgetSeconds && items.length > 0) continue
          items.push({
            exercise_id: Number(c.exercise.id),
            exercise_name: c.exercise.name,
            sets,
            reps: c.exercise.default_reps,
            work_seconds: c.exercise.default_work_seconds,
            rest_seconds: rest,
            est_seconds_per_set: est,
            score: Number(c.score.toFixed(2)),
          })
          usedSeconds += cost
          if (c.patternId != null) usedPatterns.set(c.patternId, (usedPatterns.get(c.patternId) || 0) + 1)
          if (usedSeconds >= budgetSeconds) break
        }
        return { label: block.label || 'Block', intentId, target_minutes: Number(block.minutes) || 20, estimated_minutes: Math.round(usedSeconds / 60), items }
      })

      return {
        blocks: resultBlocks,
        candidates: scored.slice(0, 40).map((c) => ({ exercise_id: Number(c.exercise.id), exercise_name: c.exercise.name, score: Number(c.score.toFixed(2)), est_seconds_per_set: Number(c.exercise.est_seconds_per_set) })),
      }
  }

  app.post('/api/coach/needs-engine/prescribe', ...can('library.view'), async (req, res) => {
    try {
      ok(res, await runPrescription(req.platformAuth.user.facility_id, req.body || {}))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // ==========================================================
  // TRAINING PROGRAMS
  // ==========================================================

  async function loadTrainingProgram(programId, facilityId) {
    const program = await pool.query(
      `SELECT tp.*, s.name as sport_name FROM coaching.training_program tp LEFT JOIN coaching.sport s ON s.id = tp.sport_id WHERE tp.id = $1 AND tp.facility_id = $2`,
      [programId, facilityId],
    )
    if (program.rows.length === 0) return null
    const weeks = await pool.query(`SELECT * FROM coaching.training_program_week WHERE training_program_id = $1 ORDER BY week_number`, [programId])
    const weekIds = weeks.rows.map((w) => Number(w.id))
    let sessions = { rows: [] }
    if (weekIds.length > 0) {
      sessions = await pool.query(
        `SELECT ps.*, w.title as workout_title FROM coaching.training_program_session ps LEFT JOIN coaching.workout w ON w.id = ps.workout_id WHERE ps.week_id = ANY($1::bigint[]) ORDER BY ps.sort_order, ps.id`,
        [weekIds],
      )
    }
    const byWeek = new Map()
    for (const session of sessions.rows) {
      const list = byWeek.get(String(session.week_id)) ?? []
      list.push(session)
      byWeek.set(String(session.week_id), list)
    }
    return { ...program.rows[0], weeks: weeks.rows.map((w) => ({ ...w, sessions: byWeek.get(String(w.id)) ?? [] })) }
  }

  app.get('/api/coach/training-programs', ...can('library.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const userId = Number(req.platformAuth.user.id)
      const result = await pool.query(
        `SELECT tp.*, s.name as sport_name FROM coaching.training_program tp LEFT JOIN coaching.sport s ON s.id = tp.sport_id
         WHERE tp.facility_id = $1 AND tp.archived = FALSE AND ((tp.visibility = 'facility' AND tp.is_published = TRUE) OR tp.created_by = $2)
         ORDER BY tp.updated_at DESC`,
        [facilityId, userId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/training-programs/:id', ...can('library.view'), async (req, res) => {
    try {
      const program = await loadTrainingProgram(num(req.params.id), req.platformAuth.user.facility_id)
      if (!program) return bad(res, 'Training program not found.', 404)
      ok(res, program)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  async function writeProgramStructure(client, programId, weeks) {
    await client.query(`DELETE FROM coaching.training_program_week WHERE training_program_id = $1`, [programId])
    for (const week of weeks || []) {
      const createdWeek = await client.query(
        `INSERT INTO coaching.training_program_week (training_program_id, week_number, focus, notes, phase_label, target_load_pct, is_deload)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          programId, Number(week.week_number) || 1, week.focus || null, week.notes || null,
          week.phase_label || null, num(week.target_load_pct), week.is_deload === true,
        ],
      )
      const weekId = Number(createdWeek.rows[0].id)
      let sortOrder = 0
      for (const session of week.sessions || []) {
        await client.query(
          `INSERT INTO coaching.training_program_session (week_id, day_of_week, sort_order, title, workout_id) VALUES ($1, $2, $3, $4, $5)`,
          [weekId, num(session.day_of_week), sortOrder++, session.title || null, num(session.workout_id)],
        )
      }
    }
    await client.query(`UPDATE coaching.training_program SET weeks_count = (SELECT COUNT(*) FROM coaching.training_program_week WHERE training_program_id = $1), updated_at = now() WHERE id = $1`, [programId])
  }

  app.post('/api/coach/training-programs', ...can('training_programs.manage'), async (req, res) => {
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const title = String(req.body?.title || '').trim()
    if (!title) return bad(res, 'Program title is required.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const created = await client.query(
        `INSERT INTO coaching.training_program (facility_id, title, description, sport_id, goal_phase, skill_level, created_by, is_published, visibility)
         VALUES ($1, $2, $3, $4, $5, $6::public.skill_level, $7, $8, $9) RETURNING id`,
        [
          facilityId, title, req.body?.description || null, num(req.body?.sport_id), req.body?.goal_phase || null,
          req.body?.skill_level || null, userId, req.body?.is_published !== false, req.body?.visibility === 'private' ? 'private' : 'facility',
        ],
      )
      const id = Number(created.rows[0].id)
      await writeProgramStructure(client, id, req.body?.weeks)
      await client.query('COMMIT')
      ok(res, await loadTrainingProgram(id, facilityId))
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  app.put('/api/coach/training-programs/:id', ...can('training_programs.manage'), async (req, res) => {
    const id = num(req.params.id)
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query(`SELECT id, created_by, visibility FROM coaching.training_program WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK')
        return bad(res, 'Training program not found.', 404)
      }
      if (!canMutateRow(existing.rows[0], userId)) {
        await client.query('ROLLBACK')
        return bad(res, 'You can only edit private items you created.', 403)
      }
      await client.query(
        `UPDATE coaching.training_program SET title = COALESCE($2, title), description = $3, sport_id = $4, goal_phase = $5,
         skill_level = $6::public.skill_level, is_published = COALESCE($7, is_published), visibility = COALESCE($8, visibility), updated_at = now() WHERE id = $1`,
        [
          id, req.body?.title ? String(req.body.title).trim() : null, req.body?.description || null, num(req.body?.sport_id),
          req.body?.goal_phase || null, req.body?.skill_level || null,
          typeof req.body?.is_published === 'boolean' ? req.body.is_published : null,
          req.body?.visibility === 'private' ? 'private' : req.body?.visibility === 'facility' ? 'facility' : null,
        ],
      )
      if (Array.isArray(req.body?.weeks)) await writeProgramStructure(client, id, req.body.weeks)
      await client.query('COMMIT')
      ok(res, await loadTrainingProgram(id, facilityId))
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  app.delete('/api/coach/training-programs/:id', ...can('training_programs.manage'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const userId = Number(req.platformAuth.user.id)
      const existing = await pool.query(`SELECT id, created_by, visibility FROM coaching.training_program WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      if (existing.rows.length === 0) return bad(res, 'Training program not found.', 404)
      if (!canMutateRow(existing.rows[0], userId)) return bad(res, 'You can only delete private items you created.', 403)
      await pool.query(`UPDATE coaching.training_program SET archived = TRUE, updated_at = now() WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      ok(res, { id })
    } catch (error) {
      bad(res, error.message)
    }
  })

  // Apply a progressive-overload factor to a workout's blocks (reps + numeric
  // load scaled; sets/work untouched to keep structure stable).
  function progressLoad(load, factor) {
    if (load == null) return load
    const str = String(load)
    return str.replace(/\d+(\.\d+)?/, (match) => {
      const scaled = Number(match) * factor
      return Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1)
    })
  }

  function applyProgression(blocks, factor) {
    return (blocks || []).map((block) => ({
      ...block,
      items: (block.items || []).map((item) => ({
        ...item,
        reps: item.reps != null ? Math.max(1, Math.round(Number(item.reps) * factor)) : item.reps,
        load: progressLoad(item.load, factor),
      })),
    }))
  }

  // Duplicate a program week as the next week, optionally advancing load via a
  // progression percentage. When progressWorkouts is set, each session's workout
  // is deep-cloned with scaled reps/load so the template is never mutated.
  app.post('/api/coach/training-programs/:id/weeks/:weekId/duplicate', ...can('training_programs.manage'), async (req, res) => {
    const programId = num(req.params.id)
    const weekId = num(req.params.weekId)
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const progressionPct = Number(req.body?.progressionPct) || 0
    const factor = 1 + progressionPct / 100
    const progressWorkouts = req.body?.progressWorkouts === true && progressionPct !== 0
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const program = await client.query(`SELECT id, created_by, visibility FROM coaching.training_program WHERE id = $1 AND facility_id = $2`, [programId, facilityId])
      if (program.rows.length === 0) {
        await client.query('ROLLBACK')
        return bad(res, 'Training program not found.', 404)
      }
      if (!canMutateRow(program.rows[0], userId)) {
        await client.query('ROLLBACK')
        return bad(res, 'You can only edit private items you created.', 403)
      }
      const srcWeek = await client.query(`SELECT * FROM coaching.training_program_week WHERE id = $1 AND training_program_id = $2`, [weekId, programId])
      if (srcWeek.rows.length === 0) {
        await client.query('ROLLBACK')
        return bad(res, 'Week not found.', 404)
      }
      const week = srcWeek.rows[0]
      const sessions = await client.query(`SELECT * FROM coaching.training_program_session WHERE week_id = $1 ORDER BY sort_order, id`, [weekId])
      const maxWeek = await client.query(`SELECT COALESCE(MAX(week_number), 0) AS n FROM coaching.training_program_week WHERE training_program_id = $1`, [programId])
      const newWeekNumber = Number(maxWeek.rows[0].n) + 1
      const newTargetLoad = week.target_load_pct != null ? Number((Number(week.target_load_pct) * factor).toFixed(1)) : null

      const createdWeek = await client.query(
        `INSERT INTO coaching.training_program_week (training_program_id, week_number, focus, notes, phase_label, target_load_pct, is_deload)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [programId, newWeekNumber, week.focus || null, week.notes || null, week.phase_label || null, newTargetLoad, week.is_deload === true],
      )
      const newWeekId = Number(createdWeek.rows[0].id)

      let sortOrder = 0
      for (const session of sessions.rows) {
        let workoutId = session.workout_id != null ? Number(session.workout_id) : null
        if (progressWorkouts && workoutId != null) {
          const full = await loadWorkout(workoutId, facilityId)
          if (full) {
            const clone = await client.query(
              `INSERT INTO coaching.workout (facility_id, title, type, sport_id, description, target_minutes, notes, created_by, is_published, visibility)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'private') RETURNING id`,
              [facilityId, `${full.title} (W${newWeekNumber})`, full.type, full.sport_id, full.description, full.target_minutes, full.notes, userId, full.is_published],
            )
            const cloneId = Number(clone.rows[0].id)
            await writeWorkoutStructure(client, cloneId, applyProgression(full.blocks, factor))
            const reloaded = await loadWorkout(cloneId, facilityId)
            await client.query(`UPDATE coaching.workout SET computed_minutes = $2 WHERE id = $1`, [cloneId, reloaded?.computed_minutes ?? 0])
            workoutId = cloneId
          }
        }
        await client.query(
          `INSERT INTO coaching.training_program_session (week_id, day_of_week, sort_order, title, workout_id) VALUES ($1, $2, $3, $4, $5)`,
          [newWeekId, session.day_of_week, sortOrder++, session.title || null, workoutId],
        )
      }

      await client.query(
        `UPDATE coaching.training_program SET weeks_count = (SELECT COUNT(*) FROM coaching.training_program_week WHERE training_program_id = $1), updated_at = now() WHERE id = $1`,
        [programId],
      )
      await client.query('COMMIT')
      ok(res, await loadTrainingProgram(programId, facilityId))
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  // ==========================================================
  // CHALLENGES
  // ==========================================================
  app.get('/api/coach/challenges', ...can('library.view'), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT c.*, s.name as sport_name,
           (SELECT COUNT(*) FROM coaching.challenge_entry ce WHERE ce.challenge_id = c.id)::int as entry_count
         FROM coaching.challenge c LEFT JOIN coaching.sport s ON s.id = c.sport_id
         WHERE c.facility_id = $1 AND c.archived = FALSE ORDER BY c.created_at DESC`,
        [req.platformAuth.user.facility_id],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/challenges/:id', ...can('library.view'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const challenge = await pool.query(`SELECT * FROM coaching.challenge WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      if (challenge.rows.length === 0) return bad(res, 'Challenge not found.', 404)
      const [criteria, entries] = await Promise.all([
        pool.query(`SELECT * FROM coaching.challenge_criteria WHERE challenge_id = $1`, [id]),
        pool.query(
          `SELECT ce.*, m.first_name, m.last_name FROM coaching.challenge_entry ce JOIN public.member m ON m.id = ce.member_id WHERE ce.challenge_id = $1 ORDER BY ce.value_numeric DESC NULLS LAST, ce.recorded_at`,
          [id],
        ),
      ])
      ok(res, { ...challenge.rows[0], criteria: criteria.rows, entries: entries.rows })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/challenges', ...can('challenges.manage'), async (req, res) => {
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const title = String(req.body?.title || '').trim()
    if (!title) return bad(res, 'Challenge title is required.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const created = await client.query(
        `INSERT INTO coaching.challenge (facility_id, title, description, sport_id, scoring_type, unit, starts_on, ends_on, leaderboard_visible, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          facilityId, title, req.body?.description || null, num(req.body?.sport_id),
          ['max_reps', 'fastest_time', 'max_load', 'distance', 'streak'].includes(req.body?.scoring_type) ? req.body.scoring_type : 'max_reps',
          req.body?.unit || null, req.body?.starts_on || null, req.body?.ends_on || null,
          req.body?.leaderboard_visible !== false, userId,
        ],
      )
      const id = Number(created.rows[0].id)
      if (Array.isArray(req.body?.criteria)) {
        for (const crit of req.body.criteria) {
          if (!FACET_TYPES.includes(crit.facetType) || num(crit.facetId) == null) continue
          await client.query(
            `INSERT INTO coaching.challenge_criteria (challenge_id, facet_type, facet_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [id, crit.facetType, num(crit.facetId)],
          )
        }
      }
      await client.query('COMMIT')
      ok(res, { id })
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  app.post('/api/coach/challenges/:id/entries', ...can('challenges.manage'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const memberId = num(req.body?.memberId)
      if (memberId == null) return bad(res, 'memberId is required.')
      const created = await pool.query(
        `INSERT INTO coaching.challenge_entry (challenge_id, member_id, value_numeric, unit, recorded_by, note) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, memberId, num(req.body?.value), req.body?.unit || null, Number(req.platformAuth.user.id), req.body?.note || null],
      )
      ok(res, created.rows[0])
    } catch (error) {
      bad(res, error.message)
    }
  })

  app.delete('/api/coach/challenges/:id', ...can('challenges.manage'), async (req, res) => {
    try {
      await pool.query(`UPDATE coaching.challenge SET archived = TRUE, updated_at = now() WHERE id = $1 AND facility_id = $2`, [num(req.params.id), req.platformAuth.user.facility_id])
      ok(res, { id: num(req.params.id) })
    } catch (error) {
      bad(res, error.message)
    }
  })

  // ==========================================================
  // ASSESSMENTS, RUBRICS & GRADING
  // ==========================================================
  app.get('/api/coach/rubrics', ...can('assessments.manage'), async (req, res) => {
    try {
      const rubrics = await pool.query(`SELECT * FROM coaching.rubric WHERE facility_id = $1 AND archived = FALSE ORDER BY name`, [req.platformAuth.user.facility_id])
      const ids = rubrics.rows.map((r) => Number(r.id))
      let criteria = { rows: [] }
      if (ids.length > 0) criteria = await pool.query(`SELECT * FROM coaching.rubric_criterion WHERE rubric_id = ANY($1::bigint[]) ORDER BY sort_order, id`, [ids])
      const byRubric = new Map()
      for (const c of criteria.rows) {
        const list = byRubric.get(String(c.rubric_id)) ?? []
        list.push(c)
        byRubric.set(String(c.rubric_id), list)
      }
      ok(res, rubrics.rows.map((r) => ({ ...r, criteria: byRubric.get(String(r.id)) ?? [] })))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/rubrics', ...can('assessments.manage'), async (req, res) => {
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const name = String(req.body?.name || '').trim()
    if (!name) return bad(res, 'Rubric name is required.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const created = await client.query(
        `INSERT INTO coaching.rubric (facility_id, name, description, sport_id, scale_min, scale_max, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [facilityId, name, req.body?.description || null, num(req.body?.sport_id), num(req.body?.scale_min) ?? 1, num(req.body?.scale_max) ?? 5, userId],
      )
      const id = Number(created.rows[0].id)
      let sortOrder = 0
      for (const crit of req.body?.criteria || []) {
        if (!crit.name) continue
        await client.query(
          `INSERT INTO coaching.rubric_criterion (rubric_id, name, description, tenet_id, sort_order) VALUES ($1, $2, $3, $4, $5)`,
          [id, crit.name, crit.description || null, num(crit.tenet_id), sortOrder++],
        )
      }
      await client.query('COMMIT')
      ok(res, { id })
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  app.get('/api/coach/assessments', ...can('assessments.manage'), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT a.*, t.name as tenet_name, r.name as rubric_name FROM coaching.assessment a
         LEFT JOIN coaching.tenet t ON t.id = a.tenet_id
         LEFT JOIN coaching.rubric r ON r.id = a.rubric_id
         WHERE a.facility_id = $1 AND a.archived = FALSE ORDER BY a.name`,
        [req.platformAuth.user.facility_id],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/assessments', ...can('assessments.manage'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const userId = Number(req.platformAuth.user.id)
      const name = String(req.body?.name || '').trim()
      if (!name) return bad(res, 'Assessment name is required.')
      const created = await pool.query(
        `INSERT INTO coaching.assessment (facility_id, name, description, sport_id, assessment_type, unit, higher_is_better, tenet_id, rubric_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          facilityId, name, req.body?.description || null, num(req.body?.sport_id),
          ['benchmark', 'rubric', 'skill'].includes(req.body?.assessment_type) ? req.body.assessment_type : 'benchmark',
          req.body?.unit || null, req.body?.higher_is_better !== false, num(req.body?.tenet_id), num(req.body?.rubric_id), userId,
        ],
      )
      ok(res, created.rows[0])
    } catch (error) {
      bad(res, error.message)
    }
  })

  app.post('/api/coach/assessments/:id/results', ...can('athlete_grading.manage'), async (req, res) => {
    try {
      const assessmentId = num(req.params.id)
      const memberId = num(req.body?.memberId)
      if (memberId == null) return bad(res, 'memberId is required.')
      const created = await pool.query(
        `INSERT INTO coaching.assessment_result (assessment_id, member_id, value_numeric, value_text, unit, tested_at, coach_user_id, note, media_url)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()), $7, $8, $9) RETURNING *`,
        [
          assessmentId, memberId, num(req.body?.value), req.body?.valueText || null, req.body?.unit || null,
          req.body?.testedAt || null, Number(req.platformAuth.user.id), req.body?.note || null, req.body?.mediaUrl || null,
        ],
      )
      const personalRecord = await detectPersonalRecord({
        sourceType: 'assessment',
        facilityId: req.platformAuth.user.facility_id,
        memberId,
        assessmentId,
        value: num(req.body?.value),
        unit: req.body?.unit || null,
        sourceResultId: Number(created.rows[0].id),
      })
      ok(res, { ...created.rows[0], personalRecord })
    } catch (error) {
      bad(res, error.message)
    }
  })

  app.post('/api/coach/athletes/:memberId/skill-grade', ...can('athlete_grading.manage'), async (req, res) => {
    try {
      const memberId = num(req.params.memberId)
      const created = await pool.query(
        `INSERT INTO coaching.athlete_skill_progress (member_id, exercise_id, rubric_criterion_id, skill_label, score, max_score, graded_at, coach_user_id, note, media_url)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now()), $8, $9, $10) RETURNING *`,
        [
          memberId, num(req.body?.exercise_id), num(req.body?.rubric_criterion_id), req.body?.skill_label || null,
          num(req.body?.score), num(req.body?.max_score), req.body?.graded_at || null, Number(req.platformAuth.user.id),
          req.body?.note || null, req.body?.media_url || null,
        ],
      )
      const personalRecord = await detectPersonalRecord({
        sourceType: 'skill',
        facilityId: req.platformAuth.user.facility_id,
        memberId,
        exerciseId: num(req.body?.exercise_id),
        value: num(req.body?.score),
        sourceResultId: Number(created.rows[0].id),
      })
      ok(res, { ...created.rows[0], personalRecord })
    } catch (error) {
      bad(res, error.message)
    }
  })

  app.get('/api/coach/athletes/:memberId/grades', ...can('coach_insights.view'), async (req, res) => {
    try {
      const memberId = num(req.params.memberId)
      const [results, skills] = await Promise.all([
        pool.query(
          `SELECT ar.*, a.name as assessment_name, a.unit as assessment_unit, t.name as tenet_name
           FROM coaching.assessment_result ar JOIN coaching.assessment a ON a.id = ar.assessment_id
           LEFT JOIN coaching.tenet t ON t.id = a.tenet_id WHERE ar.member_id = $1 ORDER BY ar.tested_at`,
          [memberId],
        ),
        pool.query(
          `SELECT sp.*, e.name as exercise_name FROM coaching.athlete_skill_progress sp LEFT JOIN coaching.exercise e ON e.id = sp.exercise_id WHERE sp.member_id = $1 ORDER BY sp.graded_at`,
          [memberId],
        ),
      ])
      ok(res, { results: results.rows, skills: skills.rows })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // ==========================================================
  // PERIODIZATION & TRAINING LOAD (Phase F)
  // ==========================================================

  // Convert a wellness check-in into a 0-100 readiness score (null if no data).
  function computeReadiness(checkin) {
    if (!checkin) return null
    const parts = []
    if (checkin.sleep_hours != null) parts.push(Math.max(0, Math.min(1, Number(checkin.sleep_hours) / 8)))
    if (checkin.soreness != null) parts.push((10 - Number(checkin.soreness)) / 9)
    if (checkin.rpe != null) parts.push((10 - Number(checkin.rpe)) / 9)
    if (checkin.mood != null) parts.push((Number(checkin.mood) - 1) / 9)
    if (checkin.energy != null) parts.push((Number(checkin.energy) - 1) / 9)
    if (parts.length === 0) return null
    return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
  }

  app.get('/api/coach/athletes/:memberId/prs', ...can('coach_insights.view'), async (req, res) => {
    try {
      const memberId = num(req.params.memberId)
      const facilityId = req.platformAuth.user.facility_id
      const result = await pool.query(
        `SELECT pr.*, a.name AS assessment_name, e.name AS exercise_name
         FROM coaching.personal_record pr
         LEFT JOIN coaching.assessment a ON a.id = pr.assessment_id
         LEFT JOIN coaching.exercise e ON e.id = pr.exercise_id
         WHERE pr.member_id = $1 AND pr.facility_id = $2
         ORDER BY pr.achieved_at DESC LIMIT 100`,
        [memberId, facilityId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // Training load: session-RPE (rpe x minutes) aggregated daily, with
  // acute (7d) / chronic (28d avg week) workload ratio and a risk flag.
  app.get('/api/coach/athletes/:memberId/load', ...can('coach_insights.view'), async (req, res) => {
    try {
      const memberId = num(req.params.memberId)
      const facilityId = req.platformAuth.user.facility_id
      const daily = await pool.query(
        `SELECT to_char(DATE(cl.logged_at), 'YYYY-MM-DD') AS date,
                ROUND(SUM(
                  COALESCE(cl.rpe, 0) * COALESCE(
                    cl.time_seconds / 60.0,
                    CASE WHEN cl.exercise_id IS NULL THEN w.computed_minutes ELSE 0 END,
                    0
                  )
                )::numeric, 1) AS load
         FROM coaching.completion_log cl
         JOIN public.member m ON m.id = cl.member_id
         LEFT JOIN coaching.workout w ON w.id = cl.workout_id
         WHERE cl.member_id = $1 AND m.facility_id = $2
           AND cl.logged_at >= now() - interval '35 days'
         GROUP BY DATE(cl.logged_at)
         ORDER BY DATE(cl.logged_at)`,
        [memberId, facilityId],
      )

      const loadByDate = new Map(daily.rows.map((r) => [r.date, Number(r.load) || 0]))
      const today = new Date()
      const series = []
      for (let i = 27; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        series.push({ date: key, load: loadByDate.get(key) || 0 })
      }
      const acute = series.slice(-7).reduce((a, b) => a + b.load, 0)
      const chronic = series.reduce((a, b) => a + b.load, 0) / 4
      const hasData = series.some((s) => s.load > 0)
      const ratio = chronic > 0 ? Number((acute / chronic).toFixed(2)) : null
      let flag = 'insufficient'
      if (hasData && ratio != null) {
        if (ratio > 1.5) flag = 'high'
        else if (ratio < 0.8) flag = 'low'
        else flag = 'ok'
      }

      const wellness = await pool.query(
        `SELECT * FROM coaching.wellness_checkin
         WHERE member_id = $1 AND facility_id = $2
         ORDER BY checkin_date DESC LIMIT 14`,
        [memberId, facilityId],
      )
      const latest = wellness.rows[0] || null

      ok(res, {
        series,
        acute: Number(acute.toFixed(1)),
        chronic: Number(chronic.toFixed(1)),
        ratio,
        flag,
        readiness: computeReadiness(latest),
        wellness: wellness.rows.slice().reverse(),
      })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/athletes/:memberId/wellness', ...can('coach_insights.view'), async (req, res) => {
    try {
      const memberId = num(req.params.memberId)
      const facilityId = req.platformAuth.user.facility_id
      const result = await pool.query(
        `SELECT * FROM coaching.wellness_checkin
         WHERE member_id = $1 AND facility_id = $2
         ORDER BY checkin_date DESC LIMIT 60`,
        [memberId, facilityId],
      )
      ok(res, result.rows.map((r) => ({ ...r, readiness: computeReadiness(r) })))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // Skill tree: exercise nodes + prerequisite edges, with optional per-athlete
  // mastery overlay from athlete_skill_progress.
  app.get('/api/coach/skill-tree', ...can('library.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const sportId = num(req.query.sportId)
      const memberId = num(req.query.memberId)

      const nodeParams = [facilityId]
      let sportFilter = ''
      if (sportId != null) {
        nodeParams.push(sportId)
        sportFilter = ` AND (e.sport_id = $${nodeParams.length} OR e.sport_id IS NULL)`
      }
      const nodes = await pool.query(
        `SELECT e.id, e.name, e.slug, e.sport_id, s.name AS sport_name
         FROM coaching.exercise e
         LEFT JOIN coaching.sport s ON s.id = e.sport_id
         WHERE e.facility_id = $1 AND e.archived = FALSE${sportFilter}
         ORDER BY e.name`,
        nodeParams,
      )
      const nodeIds = nodes.rows.map((n) => Number(n.id))

      let edges = { rows: [] }
      if (nodeIds.length > 0) {
        edges = await pool.query(
          `SELECT ep.exercise_id, ep.prerequisite_exercise_id
           FROM coaching.exercise_prerequisite ep
           WHERE ep.exercise_id = ANY($1::bigint[]) AND ep.prerequisite_exercise_id = ANY($1::bigint[])`,
          [nodeIds],
        )
      }

      let mastery = {}
      if (memberId != null && nodeIds.length > 0) {
        const grades = await pool.query(
          `SELECT exercise_id, MAX(score) AS score, MAX(max_score) AS max_score
           FROM coaching.athlete_skill_progress
           WHERE member_id = $1 AND exercise_id = ANY($2::bigint[])
           GROUP BY exercise_id`,
          [memberId, nodeIds],
        )
        for (const g of grades.rows) {
          const score = Number(g.score)
          const max = Number(g.max_score) || 0
          const status = max > 0 && score >= max ? 'mastered' : 'in_progress'
          mastery[String(g.exercise_id)] = { score, maxScore: max || null, status }
        }
      }

      ok(res, { nodes: nodes.rows, edges: edges.rows, mastery })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // ==========================================================
  // PLAN ASSIGNMENT & COMPLETION
  // ==========================================================
  app.get('/api/coach/members', ...canAny(['coach_portal.access', 'plans.assign']), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const scope = String(req.query.scope || 'my_classes') === 'all' ? 'all' : 'my_classes'
      const members = await queryCoachMemberPickerList(pool, {
        coachUserId,
        facilityId,
        scope,
      })
      ok(res, members)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/assignments', ...can('plans.assign'), async (req, res) => {
    try {
      const result = await pool.query(
        `
          SELECT pa.*, COALESCE(au.full_name, '') as coach_name,
            CASE pa.assignable_type
              WHEN 'workout' THEN (SELECT title FROM coaching.workout w WHERE w.id = pa.assignable_id)
              WHEN 'training_program' THEN (SELECT title FROM coaching.training_program tp WHERE tp.id = pa.assignable_id)
              WHEN 'challenge' THEN (SELECT title FROM coaching.challenge c WHERE c.id = pa.assignable_id)
              WHEN 'video_submission' THEN COALESCE(
                pa.title,
                (SELECT name FROM coaching.exercise e WHERE e.id = pa.assignable_id),
                'Video submission'
              )
            END as assignable_title
          FROM coaching.plan_assignment pa
          LEFT JOIN public.app_user au ON au.id = pa.coach_user_id
          WHERE pa.facility_id = $1 ORDER BY pa.created_at DESC LIMIT 500
        `,
        [req.platformAuth.user.facility_id],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  async function assignmentRecipientMembers(targetType, targetId, facilityId) {
    const ids = await queryAssignmentTargetMemberIds(pool, {
      targetType,
      targetId,
      facilityId,
    })
    if (ids.length === 0) return []
    const r = await pool.query(
      `SELECT id, email, first_name FROM member WHERE id = ANY($1::bigint[]) AND facility_id = $2`,
      [ids, facilityId],
    )
    return r.rows
  }

  async function createInAppNotification({ facilityId, recipientMemberId, recipientUserId, kind, title, body, payload }) {
    if (!facilityId || (!recipientMemberId && !recipientUserId)) return
    await pool.query(
      `INSERT INTO coaching.notification
         (facility_id, recipient_member_id, recipient_user_id, kind, title, body, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        facilityId,
        recipientMemberId ?? null,
        recipientUserId ?? null,
        kind,
        title,
        body ?? null,
        JSON.stringify(payload ?? {}),
      ],
    )
  }

  /** Coaches assigned to classes the member is enrolled in. */
  async function resolveAssignedCoachUserIdsForMember(memberId, facilityId) {
    return queryCoachUserIdsForMember(pool, memberId, facilityId)
  }

  async function notifyWellnessCheckinToCoaches(memberId, facilityId, checkin) {
    try {
      const coachIds = await resolveAssignedCoachUserIdsForMember(memberId, facilityId)
      if (coachIds.length === 0) return
      const memberRow = await pool.query(
        `SELECT first_name, last_name FROM public.member WHERE id = $1`,
        [memberId],
      )
      const name = memberRow.rows[0]
        ? `${memberRow.rows[0].first_name || ''} ${memberRow.rows[0].last_name || ''}`.trim()
        : 'Athlete'
      const readiness = computeReadiness(checkin)
      const title = `Check-in: ${name}`
      const body = `Sleep ${checkin.sleep_hours ?? '—'}h · Soreness ${checkin.soreness ?? '—'} · Mood ${checkin.mood ?? '—'}${readiness != null ? ` · Readiness ${readiness}` : ''}`
      await Promise.all(
        coachIds.map((coachUserId) =>
          createInAppNotification({
            facilityId,
            recipientUserId: coachUserId,
            kind: 'system',
            title,
            body,
            payload: {
              member_id: memberId,
              checkin_date: checkin.checkin_date,
              wellness_checkin_id: checkin.id,
            },
          }).catch(() => {}),
        ),
      )
    } catch {
      /* best-effort */
    }
  }

  function coachCanAccessThread(thread, coachUserId) {
    if (thread.thread_scope === 'coaching_circle') return true
    if (thread.coach_user_id == null) return true
    return Number(thread.coach_user_id) === coachUserId
  }

  async function assignableTitle(type, id, titleFallback) {
    if (type === 'video_submission') {
      if (titleFallback) return titleFallback
      if (id != null) {
        const r = await pool.query(`SELECT name FROM coaching.exercise WHERE id = $1`, [id])
        return r.rows[0]?.name || 'Video submission'
      }
      return 'Video submission'
    }
    const table = type === 'workout' ? 'coaching.workout' : type === 'training_program' ? 'coaching.training_program' : 'coaching.challenge'
    const r = await pool.query(`SELECT title FROM ${table} WHERE id = $1`, [id])
    return r.rows[0]?.title || 'a new plan'
  }

  async function notifyAssignment(assignment) {
    if (assignment.visibility !== 'athlete') return
    try {
      const [recipients, title] = await Promise.all([
        assignmentRecipientMembers(assignment.target_type, assignment.target_id, assignment.facility_id),
        assignableTitle(assignment.assignable_type, assignment.assignable_id, assignment.title),
      ])
      const isVideo = assignment.assignable_type === 'video_submission'
      const label = isVideo ? 'video submission request' : assignment.assignable_type.replace(/_/g, ' ')
      const due = assignment.due_date ? ` (due ${new Date(assignment.due_date).toLocaleDateString()})` : ''
      const notificationTitle = isVideo ? `Video submission requested: ${title}` : `New ${label}: ${title}`
      const notificationBody = isVideo
        ? `Your coach requested a video submission for "${title}"${due}. Open Progress → Video Submission Portal to upload.`
        : `Your coach assigned you a ${label}: "${title}"${due}.`

      await Promise.all(
        recipients.map((rcpt) =>
          createInAppNotification({
            facilityId: assignment.facility_id,
            recipientMemberId: rcpt.id,
            kind: 'assignment',
            title: notificationTitle,
            body: notificationBody,
            payload: {
              assignment_id: assignment.id,
              assignable_type: assignment.assignable_type,
              assignable_id: assignment.assignable_id,
            },
          }).catch(() => {}),
        ),
      )

      if (!isEmailConfigured()) return
      await Promise.all(
        recipients
          .filter((rcpt) => rcpt.email)
          .map((rcpt) =>
            sendEmail({
              to: rcpt.email,
              subject: `New ${label} assigned: ${title}`,
              text: `Hi ${rcpt.first_name || 'there'},\n\nYour coach assigned you a ${label}: "${title}"${due}. Log in to the member portal Training tab to view it.\n\n- Vortex Athletics`,
              html: `<p>Hi ${rcpt.first_name || 'there'},</p><p>Your coach assigned you a ${label}: <strong>${title}</strong>${due}.</p><p>Log in to the member portal <em>Training</em> tab to view it.</p><p>- Vortex Athletics</p>`,
            }).catch(() => {}),
          ),
      )
    } catch {
      /* notifications are best-effort */
    }
  }

  // ----------------------------------------------------------
  // PERSONAL RECORD AUTO-DETECTION (Phase F)
  // ----------------------------------------------------------
  async function notifyPrDetected(memberId, label, value, unit, facilityId) {
    try {
      const valueText = unit ? `${value} ${unit}` : `${value}`
      const title = `New personal record: ${label}!`
      const body = `You set a new PR on "${label}": ${valueText}.`
      await createInAppNotification({
        facilityId,
        recipientMemberId: memberId,
        kind: 'personal_record',
        title,
        body,
        payload: { label, value, unit },
      }).catch(() => {})

      if (!isEmailConfigured()) return
      const r = await pool.query(`SELECT email, first_name FROM public.member WHERE id = $1`, [memberId])
      const member = r.rows[0]
      if (!member?.email) return
      await sendEmail({
        to: member.email,
        subject: title,
        text: `Hi ${member.first_name || 'there'},\n\nYou just set a new personal record on "${label}": ${valueText}. Keep up the great work!\n\n- Vortex Athletics`,
        html: `<p>Hi ${member.first_name || 'there'},</p><p>You just set a new personal record on <strong>${label}</strong>: <strong>${valueText}</strong>. Keep up the great work!</p><p>- Vortex Athletics</p>`,
      }).catch(() => {})
    } catch {
      /* notifications are best-effort */
    }
  }

  // Returns the inserted personal_record row when the new value beats the prior
  // best, otherwise null. Best-effort: never throws into the calling handler.
  async function detectPersonalRecord({ sourceType, facilityId, memberId, assessmentId, exerciseId, value, unit, sourceResultId }) {
    try {
      if (value == null || memberId == null) return null
      let label = null
      let higherIsBetter = true
      let priorBest = null
      if (sourceType === 'assessment') {
        if (assessmentId == null) return null
        const a = await pool.query(`SELECT name, unit, higher_is_better FROM coaching.assessment WHERE id = $1`, [assessmentId])
        if (a.rows.length === 0) return null
        label = a.rows[0].name
        higherIsBetter = a.rows[0].higher_is_better !== false
        unit = unit || a.rows[0].unit || null
        const agg = await pool.query(
          `SELECT MAX(value_numeric) AS hi, MIN(value_numeric) AS lo
           FROM coaching.assessment_result
           WHERE member_id = $1 AND assessment_id = $2 AND value_numeric IS NOT NULL AND id <> $3`,
          [memberId, assessmentId, sourceResultId ?? -1],
        )
        priorBest = higherIsBetter ? num(agg.rows[0]?.hi) : num(agg.rows[0]?.lo)
      } else if (sourceType === 'skill') {
        const labelRow = exerciseId != null
          ? await pool.query(`SELECT name FROM coaching.exercise WHERE id = $1`, [exerciseId])
          : { rows: [] }
        label = labelRow.rows[0]?.name || 'Skill'
        const agg = await pool.query(
          `SELECT MAX(score) AS hi FROM coaching.athlete_skill_progress
           WHERE member_id = $1 AND score IS NOT NULL AND id <> $2
             AND ($3::bigint IS NULL OR exercise_id = $3)`,
          [memberId, sourceResultId ?? -1, exerciseId],
        )
        priorBest = num(agg.rows[0]?.hi)
      } else {
        return null
      }

      const isRecord = priorBest == null || (higherIsBetter ? value > priorBest : value < priorBest)
      if (!isRecord) return null

      const inserted = await pool.query(
        `INSERT INTO coaching.personal_record
           (facility_id, member_id, source_type, assessment_id, exercise_id, metric_label, value_numeric, unit, source_result_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [facilityId, memberId, sourceType, assessmentId ?? null, exerciseId ?? null, label, value, unit ?? null, sourceResultId ?? null],
      )
      void notifyPrDetected(memberId, label, value, unit, facilityId)
      void recordAchievement({
        facilityId,
        memberId,
        kind: 'milestone',
        label: `PR: ${label}`,
        description: unit ? `${value} ${unit}` : String(value),
        sourceType: 'personal_record',
        sourceId: inserted.rows[0].id,
        notify: false,
      })
      return inserted.rows[0]
    } catch {
      return null
    }
  }

  app.post('/api/coach/assignments', ...can('plans.assign'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const targetType = req.body?.target_type
      const assignableType = req.body?.assignable_type
      const validTargets = ['member', 'class', 'family', 'program', 'offering', 'category', 'scheduling_class', 'primary_sport']
      const validAssignable = ['workout', 'training_program', 'challenge', 'video_submission']
      if (!validTargets.includes(targetType)) return bad(res, 'Invalid target_type.')
      if (!validAssignable.includes(assignableType)) return bad(res, 'Invalid assignable_type.')
      if (num(req.body?.target_id) == null) return bad(res, 'target_id is required.')

      const assignableId = num(req.body?.assignable_id)
      const title = req.body?.title ? String(req.body.title).trim() : null

      if (assignableType === 'video_submission') {
        if (assignableId == null && !title) return bad(res, 'Pick an exercise or provide a custom name for the video request.')
      } else if (assignableId == null) {
        return bad(res, 'assignable_id is required.')
      }

      const created = await pool.query(
        `INSERT INTO coaching.plan_assignment (facility_id, coach_user_id, target_type, target_id, assignable_type, assignable_id, title, start_date, due_date, status, visibility, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'assigned', $10, $11) RETURNING *`,
        [
          facilityId, Number(req.platformAuth.user.id), targetType, num(req.body.target_id), assignableType, assignableId,
          title, req.body?.start_date || null, req.body?.due_date || null,
          req.body?.visibility === 'coach_only' ? 'coach_only' : 'athlete', req.body?.notes || null,
        ],
      )
      ok(res, created.rows[0])
      void notifyAssignment(created.rows[0])
    } catch (error) {
      bad(res, error.message)
    }
  })

  app.get('/api/coach/assign/target-options', ...can('plans.assign'), async (req, res) => {
    try {
      const type = String(req.query.type || '')
      const valid = ['primary_sport', 'program', 'offering', 'category', 'scheduling_class']
      if (!valid.includes(type)) return bad(res, 'Invalid type.')
      const options = await queryAssignTargetOptions(pool, {
        type,
        facilityId: req.platformAuth.user.facility_id,
      })
      ok(res, options)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/assign/drilldown', ...can('plans.assign'), async (req, res) => {
    try {
      const data = await queryAssignDrilldown(pool, req.platformAuth.user.facility_id, {
        sportId: num(req.query.sportId),
        programId: num(req.query.programId),
        formId: num(req.query.formId),
        categoryId: num(req.query.categoryId),
      })
      ok(res, data)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/note-templates', ...can('plans.assign'), async (req, res) => {
    try {
      const coachUserId = Number(req.platformAuth.user.id)
      const facilityId = req.platformAuth.user.facility_id
      const kind = String(req.query.kind || 'video_submission_request')
      const result = await pool.query(
        `SELECT id, label, body, kind, created_at FROM coaching.coach_note_template
         WHERE coach_user_id = $1 AND facility_id = $2 AND kind = $3
         ORDER BY label`,
        [coachUserId, facilityId, kind],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/note-templates', ...can('plans.assign'), async (req, res) => {
    try {
      const coachUserId = Number(req.platformAuth.user.id)
      const facilityId = req.platformAuth.user.facility_id
      const label = String(req.body?.label || '').trim()
      const body = String(req.body?.body || '').trim()
      const kind = String(req.body?.kind || 'video_submission_request')
      if (!label || !body) return bad(res, 'label and body are required.')
      const inserted = await pool.query(
        `INSERT INTO coaching.coach_note_template (facility_id, coach_user_id, label, body, kind)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [facilityId, coachUserId, label, body, kind],
      )
      ok(res, inserted.rows[0])
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.delete('/api/coach/note-templates/:id', ...can('plans.assign'), async (req, res) => {
    try {
      const coachUserId = Number(req.platformAuth.user.id)
      const id = num(req.params.id)
      const deleted = await pool.query(
        `DELETE FROM coaching.coach_note_template WHERE id = $1 AND coach_user_id = $2 RETURNING id`,
        [id, coachUserId],
      )
      if (deleted.rows.length === 0) return bad(res, 'Note template not found.', 404)
      ok(res, { deleted: true })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/completions', ...can('coach_insights.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const params = [facilityId]
      const where = [`m.facility_id = $1`]
      const memberId = num(req.query.memberId)
      if (memberId != null) {
        params.push(memberId)
        where.push(`cl.member_id = $${params.length}`)
      }
      const assignmentId = num(req.query.assignmentId)
      if (assignmentId != null) {
        params.push(assignmentId)
        where.push(`cl.assignment_id = $${params.length}`)
      }
      const result = await pool.query(
        `
          SELECT cl.*, e.name as exercise_name, w.title as workout_title, m.first_name, m.last_name
          FROM coaching.completion_log cl
          JOIN public.member m ON m.id = cl.member_id
          LEFT JOIN coaching.exercise e ON e.id = cl.exercise_id
          LEFT JOIN coaching.workout w ON w.id = cl.workout_id
          WHERE ${where.join(' AND ')}
          ORDER BY cl.logged_at DESC
          LIMIT 200
        `,
        params,
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.patch('/api/coach/completions/:id', ...can('athlete_grading.manage'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const updated = await pool.query(
        `
          UPDATE coaching.completion_log cl
          SET coach_grade = COALESCE($2, cl.coach_grade), coach_note = COALESCE($3, cl.coach_note)
          FROM public.member m
          WHERE cl.id = $1 AND cl.member_id = m.id AND m.facility_id = $4
          RETURNING cl.*
        `,
        [id, num(req.body?.coach_grade), req.body?.coach_note ?? null, facilityId],
      )
      if (updated.rows.length === 0) return bad(res, 'Completion log not found.', 404)
      ok(res, updated.rows[0])
    } catch (error) {
      bad(res, error.message)
    }
  })

  app.patch('/api/coach/assignments/:id/status', ...can('plans.assign'), async (req, res) => {
    try {
      const status = String(req.body?.status || '')
      if (!['assigned', 'in_progress', 'completed', 'cancelled'].includes(status)) return bad(res, 'Invalid status.')
      const updated = await pool.query(
        `UPDATE coaching.plan_assignment SET status = $2, updated_at = now() WHERE id = $1 AND facility_id = $3 RETURNING *`,
        [num(req.params.id), status, req.platformAuth.user.facility_id],
      )
      if (updated.rows.length === 0) return bad(res, 'Assignment not found.', 404)
      ok(res, updated.rows[0])
    } catch (error) {
      bad(res, error.message)
    }
  })

  // ==========================================================
  // LIVE SESSIONS & ATTENDANCE (gym floor)
  // ==========================================================

  async function loadSessionRoster(programId, iterationId, facilityId) {
    const ids = await queryCoachRosterMemberIds(pool, {
      programId,
      classIterationId: iterationId,
      facilityId,
    })
    if (ids.length === 0) return []
    const result = await pool.query(
      `
        SELECT m.id, m.first_name, m.last_name
        FROM public.member m
        WHERE m.id = ANY($1::bigint[])
          AND m.facility_id = $2
          AND m.is_active = TRUE
        ORDER BY m.last_name, m.first_name
      `,
      [ids, facilityId],
    )
    return result.rows
  }

  // Today's (or a given date's) sessions: persisted sessions merged with the
  // coach's scheduled calendar instances that don't yet have a session.
  app.get('/api/coach/sessions', ...can('plans.assign'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : new Date().toISOString().slice(0, 10)

      const saved = await pool.query(
        `SELECT s.*, w.title as workout_title, w.computed_minutes
         FROM coaching.session s LEFT JOIN coaching.workout w ON w.id = s.workout_id
         WHERE s.coach_user_id = $1 AND s.session_date = $2 ORDER BY s.start_time NULLS LAST, s.id`,
        [coachUserId, date],
      )
      const savedByKey = new Map(saved.rows.filter((r) => r.calendar_event_key).map((r) => [r.calendar_event_key, r]))

      // Scheduled instances for the coach's classes on this date.
      const classes = await pool.query(
        `SELECT DISTINCT program_id, class_iteration_id FROM public.coach_class_assignment WHERE coach_user_id = $1 AND program_id IS NOT NULL`,
        [coachUserId],
      )
      const scheduled = []
      try {
        const { loadSchedulingCalendar } = await import('../scheduling/calendarQuery.js')
        const programIds = [...new Set(classes.rows.map((c) => Number(c.program_id)))]
        for (const programId of programIds) {
          const calendar = await loadSchedulingCalendar(pool, { startDate: date, endDate: date, programId })
          for (const ev of calendar.events || []) {
            if (savedByKey.has(ev.id)) continue
            scheduled.push({
              calendar_event_key: ev.id,
              program_id: ev.classEventId,
              class_name: ev.className,
              start_time: ev.startTime,
              end_time: ev.endTime,
              session_date: ev.date,
              scheduled: true,
            })
          }
        }
      } catch {
        /* scheduling system optional; saved sessions still returned */
      }

      ok(res, { date, sessions: saved.rows, scheduled })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // Create or fetch the session for a scheduled instance (idempotent by event key) or ad-hoc.
  app.post('/api/coach/sessions', ...can('plans.assign'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const sessionDate = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.session_date || '')) ? String(req.body.session_date) : new Date().toISOString().slice(0, 10)
      const eventKey = req.body?.calendar_event_key ? String(req.body.calendar_event_key) : null

      if (eventKey) {
        const existing = await pool.query(`SELECT * FROM coaching.session WHERE coach_user_id = $1 AND calendar_event_key = $2`, [coachUserId, eventKey])
        if (existing.rows.length > 0) return ok(res, existing.rows[0])
      }
      const created = await pool.query(
        `INSERT INTO coaching.session (facility_id, coach_user_id, assignment_id, program_id, class_iteration_id, workout_id, calendar_event_key, session_date, start_time, end_time, title, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'planned') RETURNING *`,
        [
          facilityId, coachUserId, num(req.body?.assignment_id), num(req.body?.program_id), num(req.body?.class_iteration_id),
          num(req.body?.workout_id), eventKey, sessionDate, req.body?.start_time || null, req.body?.end_time || null, req.body?.title || null,
        ],
      )
      ok(res, created.rows[0])
    } catch (error) {
      bad(res, error.message)
    }
  })

  app.get('/api/coach/sessions/:id', ...can('plans.assign'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const sessionRow = await pool.query(`SELECT * FROM coaching.session WHERE id = $1 AND coach_user_id = $2`, [id, coachUserId])
      if (sessionRow.rows.length === 0) return bad(res, 'Session not found.', 404)
      const session = sessionRow.rows[0]

      const [roster, attendance, completions, workout] = await Promise.all([
        loadSessionRoster(session.program_id, session.class_iteration_id, facilityId),
        pool.query(`SELECT member_id, status, check_in_at, note FROM coaching.session_attendance WHERE session_id = $1`, [id]),
        pool.query(`SELECT member_id, status, reps, rpe, coach_grade, coach_note FROM coaching.completion_log WHERE session_id = $1`, [id]),
        session.workout_id ? loadWorkout(Number(session.workout_id), facilityId) : Promise.resolve(null),
      ])
      const attByMember = new Map(attendance.rows.map((r) => [String(r.member_id), r]))
      const logByMember = new Map(completions.rows.map((r) => [String(r.member_id), r]))
      const rosterRows = roster.map((m) => ({
        ...m,
        attendance: attByMember.get(String(m.id)) || null,
        completion: logByMember.get(String(m.id)) || null,
      }))
      ok(res, { ...session, workout, roster: rosterRows })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.patch('/api/coach/sessions/:id', ...can('plans.assign'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const coachUserId = Number(req.platformAuth.user.id)
      const status = ['planned', 'in_progress', 'completed', 'cancelled'].includes(req.body?.status) ? req.body.status : null
      const updated = await pool.query(
        `UPDATE coaching.session SET
           status = COALESCE($2, status),
           workout_id = COALESCE($3, workout_id),
           title = COALESCE($4, title),
           notes = COALESCE($5, notes),
           updated_at = now()
         WHERE id = $1 AND coach_user_id = $6 RETURNING *`,
        [id, status, num(req.body?.workout_id), req.body?.title ?? null, req.body?.notes ?? null, coachUserId],
      )
      if (updated.rows.length === 0) return bad(res, 'Session not found.', 404)
      ok(res, updated.rows[0])
    } catch (error) {
      bad(res, error.message)
    }
  })

  // Bulk attendance upsert for a session.
  app.post('/api/coach/sessions/:id/attendance', ...can('plans.assign'), async (req, res) => {
    const id = num(req.params.id)
    const coachUserId = Number(req.platformAuth.user.id)
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : []
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const owns = await client.query(`SELECT id FROM coaching.session WHERE id = $1 AND coach_user_id = $2`, [id, coachUserId])
      if (owns.rows.length === 0) {
        await client.query('ROLLBACK')
        return bad(res, 'Session not found.', 404)
      }
      for (const e of entries) {
        const memberId = num(e.member_id)
        if (memberId == null) continue
        const status = ['present', 'absent', 'late', 'excused'].includes(e.status) ? e.status : 'present'
        await client.query(
          `INSERT INTO coaching.session_attendance (session_id, member_id, status, check_in_at, note)
           VALUES ($1, $2, $3, CASE WHEN $3 IN ('present','late') THEN now() ELSE NULL END, $4)
           ON CONFLICT (session_id, member_id) DO UPDATE SET
             status = EXCLUDED.status,
             check_in_at = COALESCE(coaching.session_attendance.check_in_at, EXCLUDED.check_in_at),
             note = EXCLUDED.note,
             updated_at = now()`,
          [id, memberId, status, e.note || null],
        )
      }
      await client.query('COMMIT')
      ok(res, { id, count: entries.length })
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  // Bulk completion logging for the whole class in one shot.
  app.post('/api/coach/sessions/:id/bulk-log', ...can('athlete_grading.manage'), async (req, res) => {
    const id = num(req.params.id)
    const coachUserId = Number(req.platformAuth.user.id)
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : []
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const owns = await client.query(`SELECT id, workout_id FROM coaching.session WHERE id = $1 AND coach_user_id = $2`, [id, coachUserId])
      if (owns.rows.length === 0) {
        await client.query('ROLLBACK')
        return bad(res, 'Session not found.', 404)
      }
      const workoutId = num(req.body?.workout_id) ?? (owns.rows[0].workout_id != null ? Number(owns.rows[0].workout_id) : null)
      for (const e of entries) {
        const memberId = num(e.member_id)
        if (memberId == null) continue
        const status = ['completed', 'partial', 'skipped'].includes(e.status) ? e.status : 'completed'
        // One coach-authored completion row per member per session: replace on re-save.
        await client.query(
          `DELETE FROM coaching.completion_log WHERE session_id = $1 AND member_id = $2 AND exercise_id IS NULL`,
          [id, memberId],
        )
        await client.query(
          `INSERT INTO coaching.completion_log (session_id, assignment_id, member_id, workout_id, exercise_id, status, reps, rpe, coach_grade, coach_note)
           VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9)`,
          [id, num(e.assignment_id), memberId, workoutId, status, num(e.reps), num(e.rpe), num(e.coach_grade), e.coach_note || null],
        )
      }
      await client.query('COMMIT')
      ok(res, { id, count: entries.length })
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  // ==========================================================
  // INSIGHTS
  // ==========================================================
  app.get('/api/coach/insights/athlete/:memberId', ...can('coach_insights.view'), async (req, res) => {
    try {
      const memberId = num(req.params.memberId)
      // Tenet coverage from completed assignments -> workouts -> items -> exercises -> tags.
      const coverage = await pool.query(
        `
          SELECT t.id as tenet_id, t.name as tenet_name, COALESCE(SUM(tag.weight), 0)::int as load_score
          FROM coaching.tenet t
          LEFT JOIN coaching.exercise_tag tag ON tag.facet_type = 'tenet' AND tag.facet_id = t.id
          LEFT JOIN coaching.completion_log cl ON cl.exercise_id = tag.exercise_id AND cl.member_id = $1
          GROUP BY t.id, t.name
          ORDER BY t.sort_order
        `,
        [memberId],
      )
      const trends = await pool.query(
        `SELECT a.name as assessment_name, a.unit, ar.value_numeric, ar.tested_at
         FROM coaching.assessment_result ar JOIN coaching.assessment a ON a.id = ar.assessment_id
         WHERE ar.member_id = $1 ORDER BY ar.tested_at`,
        [memberId],
      )
      const recent = await pool.query(
        `SELECT cl.*, e.name as exercise_name FROM coaching.completion_log cl LEFT JOIN coaching.exercise e ON e.id = cl.exercise_id WHERE cl.member_id = $1 ORDER BY cl.logged_at DESC LIMIT 50`,
        [memberId],
      )
      ok(res, { tenetCoverage: coverage.rows, assessmentTrends: trends.rows, recentActivity: recent.rows })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/insights/cohort', ...can('coach_insights.view'), async (req, res) => {
    try {
      const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(num).filter((v) => v != null) : []
      if (memberIds.length === 0) return ok(res, { tenetCoverage: [], memberCount: 0 })
      const coverage = await pool.query(
        `
          SELECT t.id as tenet_id, t.name as tenet_name, COALESCE(SUM(tag.weight), 0)::int as load_score
          FROM coaching.tenet t
          LEFT JOIN coaching.exercise_tag tag ON tag.facet_type = 'tenet' AND tag.facet_id = t.id
          LEFT JOIN coaching.completion_log cl ON cl.exercise_id = tag.exercise_id AND cl.member_id = ANY($1::bigint[])
          GROUP BY t.id, t.name
          ORDER BY t.sort_order
        `,
        [memberIds],
      )
      ok(res, { tenetCoverage: coverage.rows, memberCount: memberIds.length })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // ==========================================================
  // AI LAYER (heuristic placeholder, logged for traceability)
  // ==========================================================
  app.post('/api/coach/ai/coverage-nudge/:memberId', ...can('coach_insights.view'), async (req, res) => {
    try {
      const memberId = num(req.params.memberId)
      const coverage = await pool.query(
        `
          SELECT t.name as tenet_name, COALESCE(SUM(tag.weight), 0)::int as load_score
          FROM coaching.tenet t
          LEFT JOIN coaching.exercise_tag tag ON tag.facet_type = 'tenet' AND tag.facet_id = t.id
          LEFT JOIN coaching.completion_log cl ON cl.exercise_id = tag.exercise_id AND cl.member_id = $1
          GROUP BY t.name ORDER BY load_score ASC
        `,
        [memberId],
      )
      const under = coverage.rows.slice(0, 2).map((r) => r.tenet_name)
      const over = coverage.rows.slice(-1).map((r) => r.tenet_name)
      const message = under.length
        ? `This athlete is under-trained in ${under.join(' and ')}${over.length ? ` and over-indexed on ${over[0]}` : ''}. Consider adding sessions emphasizing ${under[0]}.`
        : 'Training coverage looks balanced across the 8 tenets.'
      await pool.query(
        `INSERT INTO coaching.ai_draft_log (facility_id, coach_user_id, kind, prompt, response) VALUES ($1, $2, 'coverage_nudge', $3, $4)`,
        [req.platformAuth.user.facility_id, Number(req.platformAuth.user.id), `coverage_nudge:member:${memberId}`, JSON.stringify({ message, coverage: coverage.rows })],
      )
      ok(res, { message, coverage: coverage.rows })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // Natural-language needs parsing -> deterministic Needs Engine prescription.
  // We deliberately keep parsing rule-based (no opaque model call) so the
  // prescription stays explainable and reproducible. The parsed constraints and
  // result are logged to ai_draft_log for traceability.
  app.post('/api/coach/ai/nl-needs', ...can('library.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const prompt = String(req.body?.prompt || '').trim()
      if (!prompt) return bad(res, 'A prompt is required.')
      const lower = prompt.toLowerCase()

      const [tenets, methodologies, physiology, sports, equipment, intents] = await Promise.all([
        pool.query(`SELECT id, name FROM coaching.tenet`),
        pool.query(`SELECT id, name FROM coaching.methodology`),
        pool.query(`SELECT id, name FROM coaching.physiological_emphasis`),
        pool.query(`SELECT id, name FROM coaching.sport`),
        pool.query(`SELECT id, name FROM coaching.equipment`),
        pool.query(`SELECT id, name FROM coaching.exercise_intent`),
      ])

      const matchFacet = (rows, facetType, weight) =>
        rows.rows
          .filter((r) => lower.includes(String(r.name).toLowerCase()))
          .map((r) => ({ facetType, facetId: Number(r.id), weight }))

      const targets = [
        ...matchFacet(tenets, 'tenet', 5),
        ...matchFacet(methodologies, 'methodology', 4),
        ...matchFacet(physiology, 'physiology', 3),
      ]
      const equipmentIds = equipment.rows.filter((r) => lower.includes(String(r.name).toLowerCase())).map((r) => Number(r.id))
      const sport = sports.rows.find((r) => lower.includes(String(r.name).toLowerCase()))
      const intent = intents.rows.find((r) => lower.includes(String(r.name).toLowerCase()))

      const minutesMatch = lower.match(/(\d{1,3})\s*(?:min|minute|minutes|mins)/)
      const minutes = minutesMatch ? Math.min(180, Math.max(5, Number(minutesMatch[1]))) : 30

      let skillLevel = null
      if (/\b(beginner|novice|new)\b/.test(lower)) skillLevel = 'BEGINNER'
      else if (/\b(intermediate)\b/.test(lower)) skillLevel = 'INTERMEDIATE'
      else if (/\b(advanced|elite|competitive)\b/.test(lower)) skillLevel = 'ADVANCED'
      else if (/\b(early.stage|youth|kids|little)\b/.test(lower)) skillLevel = 'EARLY_STAGE'

      const parsed = {
        sportId: sport ? Number(sport.id) : null,
        skillLevel,
        equipmentIds,
        targets,
        blocks: [{ label: 'Main Work', intentId: intent ? Number(intent.id) : null, minutes }],
      }

      const prescription = await runPrescription(facilityId, parsed)
      await pool.query(
        `INSERT INTO coaching.ai_draft_log (facility_id, coach_user_id, kind, prompt, response) VALUES ($1, $2, 'nl_needs', $3, $4)`,
        [facilityId, Number(req.platformAuth.user.id), prompt, JSON.stringify({ parsed, prescription })],
      )
      ok(res, { parsed, ...prescription })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // Parent-friendly progress narrative from assessment trends + tenet coverage.
  app.post('/api/coach/ai/progress-narrative/:memberId', ...can('coach_insights.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const memberId = num(req.params.memberId)
      const [member, coverage, trends] = await Promise.all([
        pool.query(`SELECT first_name FROM public.member WHERE id = $1 AND facility_id = $2`, [memberId, facilityId]),
        pool.query(
          `SELECT t.name as tenet_name, COALESCE(SUM(tag.weight), 0)::int as load_score
           FROM coaching.tenet t
           LEFT JOIN coaching.exercise_tag tag ON tag.facet_type = 'tenet' AND tag.facet_id = t.id
           LEFT JOIN coaching.completion_log cl ON cl.exercise_id = tag.exercise_id AND cl.member_id = $1
           GROUP BY t.name ORDER BY load_score DESC`,
          [memberId],
        ),
        pool.query(
          `SELECT a.name as assessment_name, a.unit, a.higher_is_better,
             (array_agg(ar.value_numeric ORDER BY ar.tested_at))[1] as first_value,
             (array_agg(ar.value_numeric ORDER BY ar.tested_at DESC))[1] as last_value,
             count(*) as result_count
           FROM coaching.assessment_result ar JOIN coaching.assessment a ON a.id = ar.assessment_id
           WHERE ar.member_id = $1 AND ar.value_numeric IS NOT NULL
           GROUP BY a.id, a.name, a.unit, a.higher_is_better`,
          [memberId],
        ),
      ])
      const name = member.rows[0]?.first_name || 'Your athlete'
      const strengths = coverage.rows.filter((r) => r.load_score > 0).slice(0, 2).map((r) => r.tenet_name)
      const growth = coverage.rows.filter((r) => r.load_score === 0).slice(0, 2).map((r) => r.tenet_name)
      const improvements = trends.rows
        .filter((r) => r.result_count > 1 && r.first_value != null && r.last_value != null)
        .filter((r) => (r.higher_is_better ? Number(r.last_value) > Number(r.first_value) : Number(r.last_value) < Number(r.first_value)))
        .map((r) => r.assessment_name)

      const parts = [`${name} has been building a well-rounded athletic base.`]
      if (strengths.length) parts.push(`Recent training has emphasized ${strengths.join(' and ')}.`)
      if (improvements.length) parts.push(`We're seeing measurable progress in ${improvements.slice(0, 3).join(', ')}.`)
      if (growth.length) parts.push(`Next, we'll focus on developing ${growth.join(' and ')} for more complete development.`)
      parts.push('Keep encouraging consistent attendance — steady reps are how these gains compound.')
      const ruleNarrative = parts.join(' ')

      const llmNarrative = await llmProgressNarrative({
        athleteName: name,
        tenetCoverage: coverage.rows,
        assessmentTrends: trends.rows,
      })
      const narrative = llmNarrative || ruleNarrative
      const narrativeSource = llmNarrative ? 'llm' : 'rules'

      await pool.query(
        `INSERT INTO coaching.ai_draft_log (facility_id, coach_user_id, kind, prompt, response) VALUES ($1, $2, 'progress_narrative', $3, $4)`,
        [facilityId, Number(req.platformAuth.user.id), `progress_narrative:member:${memberId}`, JSON.stringify({ narrative, narrativeSource })],
      )
      ok(res, { narrative, narrativeSource })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/ai/progress-report/:memberId/pdf', ...can('coach_insights.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const memberId = num(req.params.memberId)
      const [member, coverage, trends, prs, goals] = await Promise.all([
        pool.query(`SELECT first_name, last_name FROM public.member WHERE id = $1 AND facility_id = $2`, [memberId, facilityId]),
        pool.query(
          `SELECT t.name as tenet_name, COALESCE(SUM(tag.weight), 0)::int as load_score
           FROM coaching.tenet t
           LEFT JOIN coaching.exercise_tag tag ON tag.facet_type = 'tenet' AND tag.facet_id = t.id
           LEFT JOIN coaching.completion_log cl ON cl.exercise_id = tag.exercise_id AND cl.member_id = $1
           GROUP BY t.name ORDER BY load_score DESC`,
          [memberId],
        ),
        pool.query(
          `SELECT a.name as assessment_name, a.unit, a.higher_is_better,
             (array_agg(ar.value_numeric ORDER BY ar.tested_at))[1] as first_value,
             (array_agg(ar.value_numeric ORDER BY ar.tested_at DESC))[1] as last_value,
             count(*) as result_count
           FROM coaching.assessment_result ar JOIN coaching.assessment a ON a.id = ar.assessment_id
           WHERE ar.member_id = $1 AND ar.value_numeric IS NOT NULL
           GROUP BY a.id, a.name, a.unit, a.higher_is_better`,
          [memberId],
        ),
        pool.query(
          `SELECT metric_label, value_numeric, unit, achieved_at FROM coaching.personal_record
           WHERE member_id = $1 AND facility_id = $2 ORDER BY achieved_at DESC LIMIT 8`,
          [memberId, facilityId],
        ),
        pool.query(
          `SELECT title, target_date FROM coaching.goal
           WHERE member_id = $1 AND facility_id = $2 AND status = 'active' ORDER BY target_date NULLS LAST LIMIT 8`,
          [memberId, facilityId],
        ),
      ])
      if (member.rows.length === 0) return bad(res, 'Member not found.', 404)

      const athleteName = `${member.rows[0].first_name || ''} ${member.rows[0].last_name || ''}`.trim() || 'Athlete'
      const strengths = coverage.rows.filter((r) => r.load_score > 0).slice(0, 2).map((r) => r.tenet_name)
      const growth = coverage.rows.filter((r) => r.load_score === 0).slice(0, 2).map((r) => r.tenet_name)
      const improvements = trends.rows
        .filter((r) => r.result_count > 1 && r.first_value != null && r.last_value != null)
        .filter((r) => (r.higher_is_better ? Number(r.last_value) > Number(r.first_value) : Number(r.last_value) < Number(r.first_value)))
        .map((r) => r.assessment_name)

      const parts = [`${athleteName} has been building a well-rounded athletic base.`]
      if (strengths.length) parts.push(`Recent training has emphasized ${strengths.join(' and ')}.`)
      if (improvements.length) parts.push(`We're seeing measurable progress in ${improvements.slice(0, 3).join(', ')}.`)
      if (growth.length) parts.push(`Next, we'll focus on developing ${growth.join(' and ')} for more complete development.`)
      parts.push('Keep encouraging consistent attendance — steady reps are how these gains compound.')
      const ruleNarrative = parts.join(' ')

      const llmNarrative = await llmProgressNarrative({
        athleteName,
        tenetCoverage: coverage.rows,
        assessmentTrends: trends.rows,
      })
      const narrative = llmNarrative || ruleNarrative

      const pdfBuffer = await buildProgressReportPdf({
        athleteName,
        narrative,
        prs: prs.rows.map((pr) => ({
          label: pr.metric_label || 'PR',
          value: `${pr.value_numeric ?? ''}${pr.unit ? ` ${pr.unit}` : ''} · ${new Date(pr.achieved_at).toLocaleDateString()}`,
        })),
        goals: goals.rows.map((g) => ({
          title: g.title,
          targetDate: g.target_date ? new Date(g.target_date).toLocaleDateString() : null,
        })),
      })

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="vortex-progress-${memberId}.pdf"`)
      res.send(pdfBuffer)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // Auto-tagging suggestions for a new exercise from its name/description/cues.
  app.post('/api/coach/ai/autotag', ...can('library.manage'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const text = `${req.body?.name || ''} ${req.body?.description || ''} ${Array.isArray(req.body?.cues) ? req.body.cues.map((c) => c.body || c).join(' ') : ''}`.toLowerCase()
      if (!text.trim()) return ok(res, { suggestions: [] })

      const [tenets, methodologies, physiology, patterns, equipment, intents] = await Promise.all([
        pool.query(`SELECT id, name FROM coaching.tenet`),
        pool.query(`SELECT id, name FROM coaching.methodology`),
        pool.query(`SELECT id, name FROM coaching.physiological_emphasis`),
        pool.query(`SELECT id, name FROM coaching.movement_pattern`),
        pool.query(`SELECT id, name FROM coaching.equipment`),
        pool.query(`SELECT id, name FROM coaching.exercise_intent`),
      ])

      // Keyword heuristics map common training language onto taxonomy facets.
      const KEYWORDS = {
        strength: { tenet: ['strength'], methodology: ['strength'] },
        power: { tenet: ['power'], methodology: ['power', 'plyometric'] },
        jump: { tenet: ['power'], pattern: ['jump', 'lower'] },
        sprint: { tenet: ['speed'], pattern: ['run'] },
        run: { tenet: ['speed', 'endurance'] },
        balance: { tenet: ['balance'] },
        mobility: { tenet: ['mobility', 'flexibility'], methodology: ['mobility'] },
        stretch: { tenet: ['flexibility'], methodology: ['mobility'] },
        squat: { pattern: ['squat', 'lower'] },
        hinge: { pattern: ['hinge'] },
        push: { pattern: ['push'] },
        pull: { pattern: ['pull'] },
        core: { pattern: ['core', 'brace'], physiology: ['core'] },
        carry: { pattern: ['carry'] },
        endurance: { tenet: ['endurance'], physiology: ['aerobic'] },
        conditioning: { physiology: ['anaerobic', 'aerobic'] },
        barbell: { equipment: ['barbell'] },
        dumbbell: { equipment: ['dumbbell'] },
        kettlebell: { equipment: ['kettlebell'] },
        bodyweight: { equipment: ['bodyweight'] },
        band: { equipment: ['band'] },
        warmup: { intent: ['warmup', 'activation'] },
        skill: { intent: ['skill'] },
      }

      const facetRows = { tenet: tenets.rows, methodology: methodologies.rows, physiology: physiology.rows, pattern: patterns.rows, equipment: equipment.rows, intent: intents.rows }
      const suggestions = []
      const seen = new Set()
      const addByName = (facetType, namePart) => {
        const row = facetRows[facetType].find((r) => String(r.name).toLowerCase().includes(namePart))
        if (!row) return
        const key = `${facetType}:${row.id}`
        if (seen.has(key)) return
        seen.add(key)
        suggestions.push({ facetType, facetId: Number(row.id), name: row.name, weight: 3 })
      }
      // Direct taxonomy-name hits in the text.
      for (const [facetType, rows] of Object.entries(facetRows)) {
        for (const r of rows) {
          if (text.includes(String(r.name).toLowerCase())) addByName(facetType, String(r.name).toLowerCase())
        }
      }
      // Keyword-driven hits.
      for (const [keyword, mapping] of Object.entries(KEYWORDS)) {
        if (!text.includes(keyword)) continue
        for (const [facetType, names] of Object.entries(mapping)) {
          for (const namePart of names) addByName(facetType, namePart)
        }
      }

      await pool.query(
        `INSERT INTO coaching.ai_draft_log (facility_id, coach_user_id, kind, prompt, response) VALUES ($1, $2, 'autotag', $3, $4)`,
        [facilityId, Number(req.platformAuth.user.id), text.slice(0, 500), JSON.stringify({ suggestions })],
      )
      ok(res, { suggestions })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // ==========================================================
  // IN-APP NOTIFICATIONS (Phase G)
  // ==========================================================

  app.get('/api/coach/notifications', auth, async (req, res) => {
    try {
      await ensureCoachingNotificationSchema(pool)
      const userId = Number(req.platformAuth.user.id)
      const facilityId = req.platformAuth.user.facility_id
      const unreadOnly = req.query.unreadOnly === 'true'
      const limit = Math.min(num(req.query.limit) || 50, 100)
      const params = [userId, facilityId]
      let where = `recipient_user_id = $1 AND facility_id = $2`
      if (unreadOnly) where += ` AND read_at IS NULL`
      params.push(limit)
      const result = await pool.query(
        `SELECT id, kind, title, body, payload, read_at, created_at
         FROM coaching.notification
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      )
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS n FROM coaching.notification
         WHERE recipient_user_id = $1 AND facility_id = $2 AND read_at IS NULL`,
        [userId, facilityId],
      )
      ok(res, { notifications: result.rows, unreadCount: countRes.rows[0]?.n ?? 0 })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.patch('/api/coach/notifications/:id/read', auth, async (req, res) => {
    try {
      const userId = Number(req.platformAuth.user.id)
      const facilityId = req.platformAuth.user.facility_id
      const id = num(req.params.id)
      const updated = await pool.query(
        `UPDATE coaching.notification SET read_at = now()
         WHERE id = $1 AND recipient_user_id = $2 AND facility_id = $3 AND read_at IS NULL
         RETURNING *`,
        [id, userId, facilityId],
      )
      if (updated.rows.length === 0) return bad(res, 'Notification not found.', 404)
      ok(res, updated.rows[0])
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/notifications/mark-all-read', auth, async (req, res) => {
    try {
      const userId = Number(req.platformAuth.user.id)
      const facilityId = req.platformAuth.user.facility_id
      await pool.query(
        `UPDATE coaching.notification SET read_at = now()
         WHERE recipient_user_id = $1 AND facility_id = $2 AND read_at IS NULL`,
        [userId, facilityId],
      )
      ok(res, { ok: true })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/member/notifications', auth, async (req, res) => {
    try {
      await ensureCoachingNotificationSchema(pool)
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const facilityId = ctx.user.facility_id
      const unreadOnly = req.query.unreadOnly === 'true'
      const limit = Math.min(num(req.query.limit) || 50, 100)
      const params = [memberId, facilityId]
      let where = `recipient_member_id = $1 AND facility_id = $2`
      if (unreadOnly) where += ` AND read_at IS NULL`
      params.push(limit)
      const result = await pool.query(
        `SELECT id, kind, title, body, payload, read_at, created_at
         FROM coaching.notification
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      )
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS n FROM coaching.notification
         WHERE recipient_member_id = $1 AND facility_id = $2 AND read_at IS NULL`,
        [memberId, facilityId],
      )
      ok(res, { notifications: result.rows, unreadCount: countRes.rows[0]?.n ?? 0 })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.patch('/api/member/notifications/:id/read', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const facilityId = ctx.user.facility_id
      const id = num(req.params.id)
      const updated = await pool.query(
        `UPDATE coaching.notification SET read_at = now()
         WHERE id = $1 AND recipient_member_id = $2 AND facility_id = $3 AND read_at IS NULL
         RETURNING *`,
        [id, memberId, facilityId],
      )
      if (updated.rows.length === 0) return bad(res, 'Notification not found.', 404)
      ok(res, updated.rows[0])
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/member/notifications/mark-all-read', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const facilityId = ctx.user.facility_id
      await pool.query(
        `UPDATE coaching.notification SET read_at = now()
         WHERE recipient_member_id = $1 AND facility_id = $2 AND read_at IS NULL`,
        [memberId, facilityId],
      )
      ok(res, { ok: true })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // ==========================================================
  // MESSAGING (Phase G)
  // ==========================================================

  async function appendThreadMessage(threadId, { senderUserId, senderMemberId, body }) {
    const inserted = await pool.query(
      `INSERT INTO coaching.message (thread_id, sender_user_id, sender_member_id, body)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [threadId, senderUserId ?? null, senderMemberId ?? null, body],
    )
    await pool.query(
      `UPDATE coaching.message_thread SET last_message_at = now(), updated_at = now() WHERE id = $1`,
      [threadId],
    )
    return inserted.rows[0]
  }

  async function memberCanAccessMessageThread(viewerMemberId, threadMemberId) {
    if (Number(threadMemberId) === Number(viewerMemberId)) return true
    const guardianIds = await queryMinorChildGuardianMemberIds(pool, threadMemberId)
    return guardianIds.includes(Number(viewerMemberId))
  }

  async function notifyNewMessage(thread, message, senderIsCoach) {
    const preview = String(message.body || '').slice(0, 160)
    try {
      if (senderIsCoach) {
        await createInAppNotification({
          facilityId: thread.facility_id,
          recipientMemberId: thread.member_id,
          kind: 'message',
          title: thread.subject || 'New message from your coach',
          body: preview,
          payload: { thread_id: thread.id, message_id: message.id },
        })

        const guardianIds = await queryMinorChildGuardianMemberIds(pool, thread.member_id)
        if (guardianIds.length > 0) {
          const athleteRow = await pool.query(
            `SELECT first_name, last_name FROM public.member WHERE id = $1`,
            [thread.member_id],
          )
          const athleteName = athleteRow.rows[0]
            ? `${athleteRow.rows[0].first_name || ''} ${athleteRow.rows[0].last_name || ''}`.trim()
            : 'your athlete'
          const parentTitle = thread.subject || `Coach message for ${athleteName}`
          await Promise.all(
            guardianIds
              .filter((guardianId) => guardianId !== Number(thread.member_id))
              .map((guardianId) =>
                createInAppNotification({
                  facilityId: thread.facility_id,
                  recipientMemberId: guardianId,
                  kind: 'message',
                  title: parentTitle,
                  body: preview,
                  payload: {
                    thread_id: thread.id,
                    message_id: message.id,
                    child_member_id: thread.member_id,
                  },
                }),
              ),
          )
        }
      } else if (thread.coach_user_id) {
        await createInAppNotification({
          facilityId: thread.facility_id,
          recipientUserId: thread.coach_user_id,
          kind: 'message',
          title: thread.subject || 'New athlete message',
          body: preview,
          payload: { thread_id: thread.id, message_id: message.id, member_id: thread.member_id },
        })
      }
    } catch {
      /* best-effort */
    }
  }

  async function loadThreadMessages(threadId, facilityId) {
    const thread = await pool.query(
      `SELECT t.*, m.first_name, m.last_name
       FROM coaching.message_thread t
       JOIN public.member m ON m.id = t.member_id
       WHERE t.id = $1 AND t.facility_id = $2`,
      [threadId, facilityId],
    )
    if (thread.rows.length === 0) return null
    const messages = await pool.query(
      `SELECT msg.*,
         CASE WHEN msg.sender_member_id IS NOT NULL THEN (SELECT first_name FROM public.member WHERE id = msg.sender_member_id)
              ELSE (SELECT full_name FROM public.app_user WHERE id = msg.sender_user_id) END AS sender_name
       FROM coaching.message msg
       WHERE msg.thread_id = $1
       ORDER BY msg.created_at ASC`,
      [threadId],
    )
    return { thread: thread.rows[0], messages: messages.rows }
  }

  app.get('/api/coach/messages/member-options', auth, async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const scope = String(req.query.scope || 'my_classes') === 'all' ? 'all' : 'my_classes'
      const members = await queryCoachMemberPickerList(pool, {
        coachUserId,
        facilityId,
        scope,
      })
      ok(res, members)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/messages', auth, async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const status = req.query.status === 'archived' ? 'archived' : 'open'
      const result = await pool.query(
        `
          SELECT t.*, m.first_name, m.last_name,
            lm.body AS last_message_body,
            lm.created_at AS last_message_created_at
          FROM coaching.message_thread t
          JOIN public.member m ON m.id = t.member_id
          LEFT JOIN LATERAL (
            SELECT body, created_at FROM coaching.message
            WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1
          ) lm ON TRUE
          WHERE t.facility_id = $1 AND t.status = $2
            AND (
              t.thread_scope = 'coaching_circle'
              OR t.coach_user_id IS NULL
              OR t.coach_user_id = $3
            )
          ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC
          LIMIT 100
        `,
        [facilityId, status, coachUserId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/messages/:threadId', auth, async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const threadId = num(req.params.threadId)
      const data = await loadThreadMessages(threadId, facilityId)
      if (!data) return bad(res, 'Thread not found.', 404)
      const coachUserId = Number(req.platformAuth.user.id)
      if (!coachCanAccessThread(data.thread, coachUserId)) return bad(res, 'Thread not found.', 404)
      ok(res, data)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/messages', auth, async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const memberId = num(req.body?.member_id)
      const body = String(req.body?.body || '').trim()
      if (memberId == null || !body) return bad(res, 'member_id and body are required.')
      const memberCheck = await pool.query(
        `SELECT id FROM public.member WHERE id = $1 AND facility_id = $2`,
        [memberId, facilityId],
      )
      if (memberCheck.rows.length === 0) return bad(res, 'Member not found.', 404)
      const subject = req.body?.subject ? String(req.body.subject).trim() : null
      const created = await pool.query(
        `INSERT INTO coaching.message_thread (facility_id, member_id, coach_user_id, subject, thread_scope, last_message_at)
         VALUES ($1, $2, $3, $4, 'assigned_coach', now()) RETURNING *`,
        [facilityId, memberId, coachUserId, subject],
      )
      const thread = created.rows[0]
      const message = await appendThreadMessage(thread.id, { senderUserId: coachUserId, body })
      void notifyNewMessage(thread, message, true)
      ok(res, { thread, message })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/messages/:threadId', auth, async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const threadId = num(req.params.threadId)
      const body = String(req.body?.body || '').trim()
      if (!body) return bad(res, 'body is required.')
      const threadRes = await pool.query(
        `SELECT * FROM coaching.message_thread WHERE id = $1 AND facility_id = $2`,
        [threadId, facilityId],
      )
      if (threadRes.rows.length === 0) return bad(res, 'Thread not found.', 404)
      const thread = threadRes.rows[0]
      if (!coachCanAccessThread(thread, coachUserId)) return bad(res, 'Thread not found.', 404)
      if (!thread.coach_user_id) {
        await pool.query(`UPDATE coaching.message_thread SET coach_user_id = $1 WHERE id = $2`, [coachUserId, threadId])
        thread.coach_user_id = coachUserId
      }
      const message = await appendThreadMessage(threadId, { senderUserId: coachUserId, body })
      void notifyNewMessage(thread, message, true)
      ok(res, message)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.patch('/api/coach/messages/:threadId/open-circle', auth, async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const threadId = num(req.params.threadId)
      const threadRes = await pool.query(
        `SELECT * FROM coaching.message_thread WHERE id = $1 AND facility_id = $2`,
        [threadId, facilityId],
      )
      if (threadRes.rows.length === 0) return bad(res, 'Thread not found.', 404)
      const thread = threadRes.rows[0]
      if (thread.thread_scope === 'coaching_circle') {
        ok(res, thread)
        return
      }
      if (Number(thread.coach_user_id) !== coachUserId) {
        return bad(res, 'Only the assigned coach can open this thread to the coaching circle.', 403)
      }
      const updated = await pool.query(
        `UPDATE coaching.message_thread SET thread_scope = 'coaching_circle', updated_at = now() WHERE id = $1 RETURNING *`,
        [threadId],
      )
      ok(res, updated.rows[0])
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/member/messages', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const facilityId = ctx.user.facility_id
      const result = await pool.query(
        `
          SELECT t.*,
            athlete.first_name,
            athlete.last_name,
            lm.body AS last_message_body,
            lm.created_at AS last_message_created_at
          FROM coaching.message_thread t
          JOIN public.member athlete ON athlete.id = t.member_id
          LEFT JOIN LATERAL (
            SELECT body, created_at FROM coaching.message
            WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1
          ) lm ON TRUE
          WHERE t.facility_id = $1 AND t.status = 'open'
            AND (
              t.member_id = $2
              OR (
                athlete.date_of_birth IS NOT NULL
                AND athlete.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')
                AND (
                  $2 = ANY(athlete.parent_guardian_ids)
                  OR EXISTS (
                    SELECT 1 FROM parent_guardian_authority pga
                    WHERE pga.child_member_id = athlete.id
                      AND pga.parent_member_id = $2
                      AND pga.has_legal_authority = TRUE
                  )
                )
              )
            )
          ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC
        `,
        [facilityId, memberId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/member/messages/:threadId', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const facilityId = ctx.user.facility_id
      const threadId = num(req.params.threadId)
      const threadCheck = await pool.query(
        `SELECT * FROM coaching.message_thread WHERE id = $1 AND facility_id = $2`,
        [threadId, facilityId],
      )
      if (threadCheck.rows.length === 0) return bad(res, 'Thread not found.', 404)
      const thread = threadCheck.rows[0]
      if (!await memberCanAccessMessageThread(memberId, thread.member_id)) {
        return bad(res, 'Thread not found.', 404)
      }
      const data = await loadThreadMessages(threadId, facilityId)
      ok(res, data)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/member/messages', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const facilityId = ctx.user.facility_id
      const body = String(req.body?.body || '').trim()
      if (!body) return bad(res, 'body is required.')
      const subject = req.body?.subject ? String(req.body.subject).trim() : null
      const pickedCoachId = num(req.body?.coach_user_id)
      let coachUserId = null
      let threadScope = 'coaching_circle'
      if (pickedCoachId != null) {
        const coachCheck = await pool.query(
          `SELECT id FROM public.app_user WHERE id = $1 AND facility_id = $2 AND is_active = TRUE`,
          [pickedCoachId, facilityId],
        )
        if (coachCheck.rows.length === 0) return bad(res, 'Selected coach not found.', 404)
        const assigned = await resolveAssignedCoachUserIdsForMember(memberId, facilityId)
        if (!assigned.includes(pickedCoachId)) {
          return bad(res, 'Selected coach is not assigned to your classes.', 400)
        }
        coachUserId = pickedCoachId
        threadScope = 'assigned_coach'
      }
      const created = await pool.query(
        `INSERT INTO coaching.message_thread (facility_id, member_id, coach_user_id, subject, thread_scope, last_message_at)
         VALUES ($1, $2, $3, $4, $5, now()) RETURNING *`,
        [facilityId, memberId, coachUserId, subject, threadScope],
      )
      const thread = created.rows[0]
      const message = await appendThreadMessage(thread.id, { senderMemberId: memberId, body })
      void notifyNewMessage(thread, message, false)
      ok(res, { thread, message })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/member/messages/:threadId', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const facilityId = ctx.user.facility_id
      const threadId = num(req.params.threadId)
      const body = String(req.body?.body || '').trim()
      if (!body) return bad(res, 'body is required.')
      const threadRes = await pool.query(
        `SELECT * FROM coaching.message_thread WHERE id = $1 AND facility_id = $2`,
        [threadId, facilityId],
      )
      if (threadRes.rows.length === 0) return bad(res, 'Thread not found.', 404)
      const thread = threadRes.rows[0]
      if (!await memberCanAccessMessageThread(memberId, thread.member_id)) {
        return bad(res, 'Thread not found.', 404)
      }
      const message = await appendThreadMessage(threadId, { senderMemberId: memberId, body })
      void notifyNewMessage(thread, message, false)
      ok(res, message)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // ==========================================================
  // GOALS & ACHIEVEMENTS (Phase G)
  // ==========================================================

  async function recordAchievement({ facilityId, memberId, kind, label, description, valueNumeric, sourceType, sourceId, notify = true }) {
    const inserted = await pool.query(
      `INSERT INTO coaching.achievement
         (facility_id, member_id, kind, label, description, value_numeric, source_type, source_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [facilityId, memberId, kind, label, description ?? null, valueNumeric ?? null, sourceType ?? null, sourceId ?? null],
    )
    const row = inserted.rows[0]
    if (notify) {
      void createInAppNotification({
        facilityId,
        recipientMemberId: memberId,
        kind: 'achievement',
        title: `Achievement: ${label}`,
        body: description || label,
        payload: { achievement_id: row.id },
      })
    }
    return row
  }

  app.get('/api/coach/athletes/:memberId/goals', ...can('coach_insights.view'), async (req, res) => {
    try {
      const memberId = num(req.params.memberId)
      const facilityId = req.platformAuth.user.facility_id
      const result = await pool.query(
        `SELECT * FROM coaching.goal WHERE member_id = $1 AND facility_id = $2 ORDER BY target_date NULLS LAST, created_at DESC`,
        [memberId, facilityId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/athletes/:memberId/goals', ...can('coach_insights.view'), async (req, res) => {
    try {
      const memberId = num(req.params.memberId)
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const title = String(req.body?.title || '').trim()
      if (!title) return bad(res, 'title is required.')
      const created = await pool.query(
        `INSERT INTO coaching.goal (facility_id, member_id, coach_user_id, title, description, target_date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          facilityId, memberId, coachUserId, title,
          req.body?.description || null,
          req.body?.target_date || null,
        ],
      )
      ok(res, created.rows[0])
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.patch('/api/coach/goals/:id', ...can('coach_insights.view'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const status = req.body?.status
      const completedAt = status === 'completed' ? new Date() : null
      const updated = await pool.query(
        `UPDATE coaching.goal SET
           title = COALESCE($3, title),
           description = COALESCE($4, description),
           target_date = COALESCE($5, target_date),
           status = COALESCE($6, status),
           completed_at = CASE WHEN $6 = 'completed' THEN now() WHEN $6 IS NOT NULL AND $6 <> 'completed' THEN NULL ELSE completed_at END,
           updated_at = now()
         WHERE id = $1 AND facility_id = $2 RETURNING *`,
        [
          id, facilityId,
          req.body?.title ?? null,
          req.body?.description ?? null,
          req.body?.target_date ?? null,
          status ?? null,
        ],
      )
      if (updated.rows.length === 0) return bad(res, 'Goal not found.', 404)
      ok(res, updated.rows[0])
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/athletes/:memberId/achievements', ...can('coach_insights.view'), async (req, res) => {
    try {
      const memberId = num(req.params.memberId)
      const facilityId = req.platformAuth.user.facility_id
      const result = await pool.query(
        `SELECT * FROM coaching.achievement WHERE member_id = $1 AND facility_id = $2 ORDER BY achieved_at DESC LIMIT 50`,
        [memberId, facilityId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/athletes/:memberId/achievements', ...can('coach_insights.view'), async (req, res) => {
    try {
      const memberId = num(req.params.memberId)
      const facilityId = req.platformAuth.user.facility_id
      const label = String(req.body?.label || '').trim()
      if (!label) return bad(res, 'label is required.')
      const row = await recordAchievement({
        facilityId,
        memberId,
        kind: req.body?.kind || 'badge',
        label,
        description: req.body?.description || null,
        valueNumeric: num(req.body?.value_numeric),
        sourceType: 'manual',
      })
      ok(res, row)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/member/training/goals', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const facilityId = ctx.user.facility_id
      const result = await pool.query(
        `SELECT * FROM coaching.goal WHERE member_id = $1 AND facility_id = $2 AND status = 'active' ORDER BY target_date NULLS LAST`,
        [memberId, facilityId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/member/training/achievements', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const facilityId = ctx.user.facility_id
      const result = await pool.query(
        `SELECT * FROM coaching.achievement WHERE member_id = $1 AND facility_id = $2 ORDER BY achieved_at DESC LIMIT 30`,
        [memberId, facilityId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // ==========================================================
  // ATHLETE-FACING (member portal) TRAINING ENDPOINTS
  // ==========================================================
  app.get('/api/member/training/assignments', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const familyId = ctx.user.family_id
      const matchSql = planAssignmentMemberMatchSql(1, 2)
      const result = await pool.query(
        `
          SELECT pa.*,
            CASE pa.assignable_type
              WHEN 'workout' THEN (SELECT title FROM coaching.workout w WHERE w.id = pa.assignable_id)
              WHEN 'training_program' THEN (SELECT title FROM coaching.training_program tp WHERE tp.id = pa.assignable_id)
              WHEN 'challenge' THEN (SELECT title FROM coaching.challenge c WHERE c.id = pa.assignable_id)
              WHEN 'video_submission' THEN COALESCE(
                pa.title,
                (SELECT name FROM coaching.exercise e WHERE e.id = pa.assignable_id),
                'Video submission'
              )
            END as assignable_title
          FROM coaching.plan_assignment pa
          WHERE pa.visibility = 'athlete'
            AND pa.status <> 'cancelled'
            AND (${matchSql})
          ORDER BY pa.start_date DESC NULLS LAST, pa.created_at DESC
        `,
        [memberId, familyId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/member/training/workout/:id', auth, async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const workout = await loadWorkout(num(req.params.id), facilityId)
      if (!workout) return bad(res, 'Workout not found.', 404)
      ok(res, workout)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/member/training/program/:id', auth, async (req, res) => {
    try {
      const program = await loadTrainingProgram(num(req.params.id), req.platformAuth.user.facility_id)
      if (!program) return bad(res, 'Training program not found.', 404)
      ok(res, program)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/member/training/challenge/:id', auth, async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const challenge = await pool.query(`SELECT * FROM coaching.challenge WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      if (challenge.rows.length === 0) return bad(res, 'Challenge not found.', 404)
      const entries = await pool.query(
        `SELECT ce.value_numeric, ce.recorded_at, m.first_name, m.last_name
         FROM coaching.challenge_entry ce JOIN public.member m ON m.id = ce.member_id
         WHERE ce.challenge_id = $1 ORDER BY ce.value_numeric DESC NULLS LAST, ce.recorded_at`,
        [id],
      )
      ok(res, { ...challenge.rows[0], entries: challenge.rows[0].leaderboard_visible ? entries.rows : [] })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/member/training/log', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const created = await pool.query(
        `INSERT INTO coaching.completion_log (assignment_id, member_id, workout_id, exercise_id, status, reps, load, time_seconds, rpe, athlete_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          num(req.body?.assignment_id), memberId, num(req.body?.workout_id), num(req.body?.exercise_id),
          ['completed', 'partial', 'skipped'].includes(req.body?.status) ? req.body.status : 'completed',
          num(req.body?.reps), req.body?.load || null, num(req.body?.time_seconds), num(req.body?.rpe), req.body?.athlete_note || null,
        ],
      )
      if (num(req.body?.assignment_id) != null) {
        await pool.query(`UPDATE coaching.plan_assignment SET status = 'in_progress', updated_at = now() WHERE id = $1 AND status = 'assigned'`, [num(req.body.assignment_id)])
      }
      ok(res, created.rows[0])
    } catch (error) {
      bad(res, error.message)
    }
  })

  app.get('/api/member/training/progress', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const [results, skills, prs] = await Promise.all([
        pool.query(
          `SELECT ar.value_numeric, ar.unit, ar.tested_at, a.name as assessment_name, t.name as tenet_name
           FROM coaching.assessment_result ar JOIN coaching.assessment a ON a.id = ar.assessment_id
           LEFT JOIN coaching.tenet t ON t.id = a.tenet_id WHERE ar.member_id = $1 ORDER BY ar.tested_at`,
          [memberId],
        ),
        pool.query(
          `SELECT sp.skill_label, sp.score, sp.max_score, sp.graded_at, e.name as exercise_name
           FROM coaching.athlete_skill_progress sp LEFT JOIN coaching.exercise e ON e.id = sp.exercise_id WHERE sp.member_id = $1 ORDER BY sp.graded_at`,
          [memberId],
        ),
        pool.query(
          `SELECT pr.metric_label, pr.value_numeric, pr.unit, pr.achieved_at, pr.source_type,
                  a.name as assessment_name, e.name as exercise_name
           FROM coaching.personal_record pr
           LEFT JOIN coaching.assessment a ON a.id = pr.assessment_id
           LEFT JOIN coaching.exercise e ON e.id = pr.exercise_id
           WHERE pr.member_id = $1 ORDER BY pr.achieved_at DESC LIMIT 50`,
          [memberId],
        ),
      ])
      ok(res, { results: results.rows, skills: skills.rows, prs: prs.rows })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // Daily wellness check-in (athlete self-report); upsert per (member, date).
  app.post('/api/member/training/wellness', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      if (memberId == null) return bad(res, 'Member context required.')
      const m = await pool.query(`SELECT facility_id FROM public.member WHERE id = $1`, [memberId])
      if (m.rows.length === 0) return bad(res, 'Member not found.', 404)
      const facilityId = m.rows[0].facility_id
      const checkinDate = req.body?.checkin_date || new Date().toISOString().slice(0, 10)
      const clamp = (v) => {
        const n = num(v)
        return n == null ? null : Math.max(1, Math.min(10, n))
      }
      const created = await pool.query(
        `INSERT INTO coaching.wellness_checkin (facility_id, member_id, checkin_date, sleep_hours, soreness, rpe, mood, energy, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (member_id, checkin_date) DO UPDATE SET
           sleep_hours = EXCLUDED.sleep_hours, soreness = EXCLUDED.soreness, rpe = EXCLUDED.rpe,
           mood = EXCLUDED.mood, energy = EXCLUDED.energy, note = EXCLUDED.note, updated_at = now()
         RETURNING *`,
        [facilityId, memberId, checkinDate, num(req.body?.sleep_hours), clamp(req.body?.soreness), clamp(req.body?.rpe), clamp(req.body?.mood), clamp(req.body?.energy), req.body?.note || null],
      )
      const checkin = created.rows[0]
      void notifyWellnessCheckinToCoaches(memberId, facilityId, checkin)
      ok(res, checkin)
    } catch (error) {
      bad(res, error.message)
    }
  })

  app.get('/api/member/training/coaches', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const facilityId = ctx.user.facility_id
      const coachIds = await queryCoachUserIdsForMember(pool, memberId, facilityId)
      const coaches = coachIds.length === 0
        ? { rows: [] }
        : await pool.query(
            `SELECT id, full_name AS name FROM app_user WHERE id = ANY($1::bigint[]) AND facility_id = $2 ORDER BY full_name`,
            [coachIds, facilityId],
          )
      ok(res, coaches.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // Athlete's own recent wellness history (for the check-in form's "today" state).
  app.get('/api/member/training/wellness', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const result = await pool.query(
        `SELECT * FROM coaching.wellness_checkin WHERE member_id = $1 ORDER BY checkin_date DESC LIMIT 30`,
        [memberId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  registerCoachingPhaseGHRoutes(app, pool, {
    ok,
    bad,
    num,
    auth,
    can,
    createInAppNotification,
    resolveAssignedCoachUserIdsForMember,
  })

  console.log('✅ Coach portal routes registered')
}
