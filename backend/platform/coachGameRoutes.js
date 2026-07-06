import {
  GAME_TYPES,
  GAME_KINDS,
  GAME_GROUP_STRUCTURES,
  GAME_AGE_BRACKETS,
  GAME_INTENSITY_LEVELS,
  GAME_CONTACT_LEVELS,
  normalizeGameKind,
  normalizeGameType,
  normalizeGroupStructure,
  normalizeAgeBrackets,
  gameSummary,
  loadGameTags,
  writeGameTags,
  buildGameCard,
} from './gameProgramming.js'

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

function parseGameBody(body) {
  return {
    name: body?.name ? String(body.name).trim() : null,
    description: body?.description ?? null,
    card_summary: body?.card_summary ?? null,
    coach_summary: body?.coach_summary ?? null,
    athlete_summary: body?.athlete_summary ?? null,
    game_kind: body?.game_kind != null ? normalizeGameKind(body.game_kind) : null,
    game_type: body?.game_type != null ? normalizeGameType(body.game_type) : null,
    competition_format: body?.competition_format ?? null,
    group_structure: body?.group_structure != null ? normalizeGroupStructure(body.group_structure) : null,
    min_players: num(body?.min_players),
    max_players: num(body?.max_players),
    ideal_players: body?.ideal_players ?? null,
    age_brackets: body?.age_brackets != null ? normalizeAgeBrackets(body.age_brackets) : null,
    age_variations: body?.age_variations ?? null,
    space_requirements: body?.space_requirements ?? null,
    equipment: Array.isArray(body?.equipment) ? body.equipment : null,
    duration_typical_min: num(body?.duration_typical_min),
    duration_typical_max: num(body?.duration_typical_max),
    intensity_level: body?.intensity_level ?? null,
    contact_level: body?.contact_level ?? null,
    supervision_level: body?.supervision_level ?? null,
    rules: body?.rules ?? null,
    safety: body?.safety ?? null,
    coaching_notes: body?.coaching_notes ?? null,
    best_session_phase: body?.best_session_phase ?? null,
    compatible_phases: Array.isArray(body?.compatible_phases) ? body.compatible_phases : null,
    is_published: typeof body?.is_published === 'boolean' ? body.is_published : null,
    visibility: body?.visibility === 'private' ? 'private' : body?.visibility === 'facility' ? 'facility' : null,
    tags: body?.tags,
  }
}

export function registerGameRoutes(app, pool, { can, canMutateRow: sharedCanMutate, ok, bad }) {
  const mutateCheck = sharedCanMutate ?? canMutateRow

  app.get('/api/coach/game-taxonomy', ...can('library.view'), (_req, res) => {
    ok(res, {
      gameTypes: GAME_TYPES,
      gameKinds: GAME_KINDS,
      groupStructures: GAME_GROUP_STRUCTURES,
      ageBrackets: GAME_AGE_BRACKETS,
      intensityLevels: GAME_INTENSITY_LEVELS,
      contactLevels: GAME_CONTACT_LEVELS,
    })
  })

  app.get('/api/coach/games', ...can('library.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const userId = Number(req.platformAuth.user.id)
      const params = [facilityId, userId]
      const where = [
        `g.facility_id = $1`,
        `g.archived = FALSE`,
        `((g.visibility = 'facility' AND g.is_published = TRUE) OR g.created_by = $2)`,
      ]

      const q = req.query.q ? String(req.query.q).trim() : null
      if (q) {
        params.push(`%${q}%`)
        where.push(`(g.name ILIKE $${params.length} OR g.description ILIKE $${params.length} OR g.card_summary ILIKE $${params.length})`)
      }

      if (req.query.game_type) {
        params.push(String(req.query.game_type))
        where.push(`g.game_type = $${params.length}`)
      }

      if (req.query.game_kind) {
        params.push(String(req.query.game_kind))
        where.push(`g.game_kind = $${params.length}`)
      }

      if (req.query.group_structure) {
        params.push(String(req.query.group_structure))
        where.push(`g.group_structure = $${params.length}`)
      }

      if (req.query.age_bracket) {
        params.push(String(req.query.age_bracket))
        where.push(`$${params.length} = ANY(g.age_brackets)`)
      }

      const minPlayers = num(req.query.min_players)
      if (minPlayers != null) {
        params.push(minPlayers)
        where.push(`g.min_players <= $${params.length}`)
        where.push(`(g.max_players IS NULL OR g.max_players >= $${params.length})`)
      }

      if (req.query.intensity) {
        params.push(String(req.query.intensity))
        where.push(`g.intensity_level = $${params.length}`)
      }

      if (req.query.phase) {
        params.push(String(req.query.phase))
        where.push(`(g.best_session_phase = $${params.length} OR $${params.length} = ANY(g.compatible_phases))`)
      }

      const tenetId = num(req.query.tenet)
      if (tenetId) {
        params.push(tenetId)
        where.push(`EXISTS (
          SELECT 1 FROM coaching.game_tag gt
          WHERE gt.game_id = g.id AND gt.facet_type = 'tenet' AND gt.facet_id = $${params.length}
        )`)
      }

      const result = await pool.query(
        `SELECT g.* FROM coaching.game g
         WHERE ${where.join(' AND ')}
         ORDER BY g.game_type, g.min_players, g.name
         LIMIT 500`,
        params,
      )
      const ids = result.rows.map((r) => Number(r.id))
      const tagMap = await loadGameTags(pool, ids)
      ok(res, result.rows.map((row) => gameSummary(row, tagMap.get(String(row.id)) ?? [])))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/games/:id', ...can('library.view'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const result = await pool.query(
        `SELECT g.* FROM coaching.game g WHERE g.id = $1 AND g.facility_id = $2 AND g.archived = FALSE`,
        [id, facilityId],
      )
      if (result.rows.length === 0) return bad(res, 'Game not found.', 404)
      const row = result.rows[0]
      const tagMap = await loadGameTags(pool, [id])
      const links = await pool.query(
        `SELECT gel.exercise_id, gel.role, e.name AS exercise_name, e.slug AS exercise_slug
         FROM coaching.game_exercise_link gel
         JOIN coaching.exercise e ON e.id = gel.exercise_id
         WHERE gel.game_id = $1`,
        [id],
      )
      ok(res, {
        ...gameSummary(row, tagMap.get(String(id)) ?? []),
        age_variations: row.age_variations ?? {},
        space_requirements: row.space_requirements ?? {},
        rules: row.rules ?? {},
        safety: row.safety ?? {},
        coaching_notes: row.coaching_notes,
        compatible_phases: row.compatible_phases ?? [],
        supervision_level: row.supervision_level,
        competition_format: row.competition_format,
        exercise_links: links.rows,
      })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/games/:id/card', ...can('library.view'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const result = await pool.query(
        `SELECT g.* FROM coaching.game g WHERE g.id = $1 AND g.facility_id = $2 AND g.archived = FALSE`,
        [id, facilityId],
      )
      if (result.rows.length === 0) return bad(res, 'Game not found.', 404)
      const row = result.rows[0]
      const tagMap = await loadGameTags(pool, [id])
      const links = await pool.query(
        `SELECT gel.exercise_id, gel.role, e.name AS exercise_name
         FROM coaching.game_exercise_link gel
         JOIN coaching.exercise e ON e.id = gel.exercise_id
         WHERE gel.game_id = $1`,
        [id],
      )
      ok(res, buildGameCard(row, tagMap.get(String(id)) ?? [], links.rows))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/games', ...can('library.manage'), async (req, res) => {
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const body = parseGameBody(req.body || {})
    if (!body.name) return bad(res, 'Game name is required.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const created = await client.query(
        `INSERT INTO coaching.game (
          facility_id, name, slug, description, card_summary, coach_summary, athlete_summary,
          game_kind, game_type, competition_format, group_structure, min_players, max_players, ideal_players,
          age_brackets, age_variations, space_requirements, equipment,
          duration_typical_min, duration_typical_max, intensity_level, contact_level,
          supervision_level, rules, safety, coaching_notes,
          best_session_phase, compatible_phases, created_by, is_published, visibility
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14,
          $15, $16::jsonb, $17::jsonb, $18,
          $19, $20, $21, $22,
          $23, $24::jsonb, $25::jsonb, $26,
          $27, $28, $29, $30, $31
        ) RETURNING id`,
        [
          facilityId,
          body.name,
          slugify(body.name) || `game-${Date.now()}`,
          body.description,
          body.card_summary,
          body.coach_summary,
          body.athlete_summary,
          body.game_kind ?? 'game',
          body.game_type ?? 'reaction_and_decision',
          body.competition_format,
          body.group_structure ?? 'pairs',
          body.min_players ?? 2,
          body.max_players,
          body.ideal_players,
          body.age_brackets ?? [],
          JSON.stringify(body.age_variations ?? {}),
          JSON.stringify(body.space_requirements ?? {}),
          body.equipment ?? [],
          body.duration_typical_min,
          body.duration_typical_max,
          body.intensity_level ?? 'moderate',
          body.contact_level ?? 'none',
          body.supervision_level ?? 'recommended',
          JSON.stringify(body.rules ?? {}),
          JSON.stringify(body.safety ?? {}),
          body.coaching_notes,
          body.best_session_phase,
          body.compatible_phases ?? [],
          userId,
          body.is_published !== false,
          body.visibility ?? 'facility',
        ],
      )
      const id = Number(created.rows[0].id)
      await writeGameTags(client, id, body.tags)
      await client.query('COMMIT')
      ok(res, { id })
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  app.put('/api/coach/games/:id', ...can('library.manage'), async (req, res) => {
    const id = num(req.params.id)
    const facilityId = req.platformAuth.user.facility_id
    const userId = Number(req.platformAuth.user.id)
    const body = parseGameBody(req.body || {})
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query(
        `SELECT id, created_by, visibility FROM coaching.game WHERE id = $1 AND facility_id = $2 AND archived = FALSE`,
        [id, facilityId],
      )
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK')
        return bad(res, 'Game not found.', 404)
      }
      if (!mutateCheck(existing.rows[0], userId)) {
        await client.query('ROLLBACK')
        return bad(res, 'You can only edit private items you created.', 403)
      }
      await client.query(
        `UPDATE coaching.game SET
          name = COALESCE($2, name),
          description = $3,
          card_summary = $4,
          coach_summary = $5,
          athlete_summary = $6,
          game_kind = COALESCE($7, game_kind),
          game_type = COALESCE($8, game_type),
          competition_format = $9,
          group_structure = COALESCE($10, group_structure),
          min_players = COALESCE($11, min_players),
          max_players = $12,
          ideal_players = $13,
          age_brackets = COALESCE($14, age_brackets),
          age_variations = COALESCE($15::jsonb, age_variations),
          space_requirements = COALESCE($16::jsonb, space_requirements),
          equipment = COALESCE($17, equipment),
          duration_typical_min = $18,
          duration_typical_max = $19,
          intensity_level = COALESCE($20, intensity_level),
          contact_level = COALESCE($21, contact_level),
          supervision_level = COALESCE($22, supervision_level),
          rules = COALESCE($23::jsonb, rules),
          safety = COALESCE($24::jsonb, safety),
          coaching_notes = $25,
          best_session_phase = $26,
          compatible_phases = COALESCE($27, compatible_phases),
          is_published = COALESCE($28, is_published),
          visibility = COALESCE($29, visibility),
          updated_at = now()
        WHERE id = $1`,
        [
          id,
          body.name,
          body.description,
          body.card_summary,
          body.coach_summary,
          body.athlete_summary,
          body.game_kind,
          body.game_type,
          body.competition_format,
          body.group_structure,
          body.min_players,
          body.max_players,
          body.ideal_players,
          body.age_brackets,
          body.age_variations != null ? JSON.stringify(body.age_variations) : null,
          body.space_requirements != null ? JSON.stringify(body.space_requirements) : null,
          body.equipment,
          body.duration_typical_min,
          body.duration_typical_max,
          body.intensity_level,
          body.contact_level,
          body.supervision_level,
          body.rules != null ? JSON.stringify(body.rules) : null,
          body.safety != null ? JSON.stringify(body.safety) : null,
          body.coaching_notes,
          body.best_session_phase,
          body.compatible_phases,
          body.is_published,
          body.visibility,
        ],
      )
      if (body.tags != null) await writeGameTags(client, id, body.tags)
      await client.query('COMMIT')
      ok(res, { id })
    } catch (error) {
      await client.query('ROLLBACK')
      bad(res, error.message)
    } finally {
      client.release()
    }
  })

  app.delete('/api/coach/games/:id', ...can('library.manage'), async (req, res) => {
    try {
      const id = num(req.params.id)
      const facilityId = req.platformAuth.user.facility_id
      const userId = Number(req.platformAuth.user.id)
      const existing = await pool.query(
        `SELECT id, created_by, visibility FROM coaching.game WHERE id = $1 AND facility_id = $2 AND archived = FALSE`,
        [id, facilityId],
      )
      if (existing.rows.length === 0) return bad(res, 'Game not found.', 404)
      if (!mutateCheck(existing.rows[0], userId)) return bad(res, 'You can only delete private items you created.', 403)
      await pool.query(`UPDATE coaching.game SET archived = TRUE, updated_at = now() WHERE id = $1 AND facility_id = $2`, [id, facilityId])
      ok(res, { id })
    } catch (error) {
      bad(res, error.message)
    }
  })
}
