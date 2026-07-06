export const GAME_TYPES = [
  { key: 'tag_and_chase', label: 'Tag & Chase' },
  { key: 'territory_and_zone', label: 'Territory & Zone' },
  { key: 'relay_and_race', label: 'Relay & Race' },
  { key: 'target_and_accuracy', label: 'Target & Accuracy' },
  { key: 'ball_object_control', label: 'Ball & Object Control' },
  { key: 'reaction_and_decision', label: 'Reaction & Decision' },
  { key: 'balance_body_control', label: 'Balance & Body Control' },
  { key: 'strength_power_play', label: 'Strength & Power Play' },
  { key: 'obstacle_ninja', label: 'Obstacle & Ninja' },
  { key: 'cooperative_team', label: 'Cooperative & Team' },
  { key: 'flexibility_shape', label: 'Flexibility & Shape' },
  { key: 'structured_competition', label: 'Structured Competition' },
]

export const GAME_KINDS = [
  { key: 'game', label: 'Game' },
  { key: 'competition', label: 'Competition' },
  { key: 'both', label: 'Game & Competition' },
]

export const GAME_GROUP_STRUCTURES = [
  { key: 'individual', label: 'Individual' },
  { key: 'pairs', label: 'Pairs' },
  { key: 'small_group', label: 'Small group' },
  { key: 'large_group', label: 'Large group' },
  { key: 'teams', label: 'Teams' },
]

export const GAME_AGE_BRACKETS = [
  { key: 'preschool', label: 'Preschool' },
  { key: 'elementary_young', label: 'Elementary 1 (younger)' },
  { key: 'elementary_older', label: 'Elementary 2 (older)' },
  { key: 'middle_school', label: 'Middle school' },
  { key: 'high_school', label: 'High school' },
  { key: 'adult', label: 'Adult' },
]

export const GAME_INTENSITY_LEVELS = ['low', 'moderate', 'high']
export const GAME_CONTACT_LEVELS = ['none', 'light', 'moderate']

const GAME_TYPE_LABEL = Object.fromEntries(GAME_TYPES.map((t) => [t.key, t.label]))
const GAME_KIND_LABEL = Object.fromEntries(GAME_KINDS.map((k) => [k.key, k.label]))
const GROUP_STRUCTURE_LABEL = Object.fromEntries(GAME_GROUP_STRUCTURES.map((g) => [g.key, g.label]))
const AGE_BRACKET_LABEL = Object.fromEntries(GAME_AGE_BRACKETS.map((a) => [a.key, a.label]))

export function gameTypeLabel(key) {
  return GAME_TYPE_LABEL[key] ?? key
}

export function gameKindLabel(key) {
  return GAME_KIND_LABEL[key] ?? key
}

export function groupStructureLabel(key) {
  return GROUP_STRUCTURE_LABEL[key] ?? key
}

export function ageBracketLabel(key) {
  return AGE_BRACKET_LABEL[key] ?? key
}

export function normalizeGameKind(raw) {
  const v = String(raw || 'game').trim()
  return GAME_KINDS.some((k) => k.key === v) ? v : 'game'
}

export function normalizeGameType(raw) {
  const v = String(raw || '').trim()
  return GAME_TYPES.some((t) => t.key === v) ? v : 'reaction_and_decision'
}

export function normalizeGroupStructure(raw) {
  const v = String(raw || 'pairs').trim()
  return GAME_GROUP_STRUCTURES.some((g) => g.key === v) ? v : 'pairs'
}

export function normalizeAgeBrackets(raw) {
  if (!Array.isArray(raw)) return []
  return raw.filter((k) => GAME_AGE_BRACKETS.some((a) => a.key === k))
}

export function gameSummary(row, tags = []) {
  const tenetTags = tags.filter((t) => t.facet_type === 'tenet').sort((a, b) => b.weight - a.weight)
  return {
    id: Number(row.id),
    facility_id: Number(row.facility_id),
    name: row.name,
    slug: row.slug,
    description: row.description,
    card_summary: row.card_summary,
    coach_summary: row.coach_summary,
    athlete_summary: row.athlete_summary,
    game_kind: row.game_kind,
    game_kind_label: gameKindLabel(row.game_kind),
    game_type: row.game_type,
    game_type_label: gameTypeLabel(row.game_type),
    competition_format: row.competition_format,
    group_structure: row.group_structure,
    group_structure_label: groupStructureLabel(row.group_structure),
    min_players: row.min_players,
    max_players: row.max_players,
    ideal_players: row.ideal_players,
    age_brackets: row.age_brackets ?? [],
    age_bracket_labels: (row.age_brackets ?? []).map(ageBracketLabel),
    intensity_level: row.intensity_level,
    contact_level: row.contact_level,
    duration_typical_min: row.duration_typical_min,
    duration_typical_max: row.duration_typical_max,
    equipment: row.equipment ?? [],
    best_session_phase: row.best_session_phase,
    migrated_from_exercise: row.migrated_from_exercise === true,
    source_exercise_id: row.source_exercise_id != null ? Number(row.source_exercise_id) : null,
    is_published: row.is_published,
    visibility: row.visibility,
    tags: tenetTags,
    primary_tenets: tenetTags.filter((t) => t.weight >= 4).map((t) => t.name ?? t.facet_key),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function loadGameTags(pool, gameIds) {
  if (!gameIds.length) return new Map()
  const result = await pool.query(
    `SELECT gt.game_id, gt.facet_type, gt.facet_id, gt.weight,
            CASE gt.facet_type
              WHEN 'tenet' THEN (SELECT name FROM coaching.tenet WHERE id = gt.facet_id)
              WHEN 'sport' THEN (SELECT name FROM coaching.sport WHERE id = gt.facet_id)
              WHEN 'equipment' THEN (SELECT name FROM coaching.equipment WHERE id = gt.facet_id)
            END AS name,
            CASE gt.facet_type
              WHEN 'tenet' THEN (SELECT key FROM coaching.tenet WHERE id = gt.facet_id)
              WHEN 'sport' THEN (SELECT key FROM coaching.sport WHERE id = gt.facet_id)
              WHEN 'equipment' THEN (SELECT key FROM coaching.equipment WHERE id = gt.facet_id)
            END AS facet_key
     FROM coaching.game_tag gt
     WHERE gt.game_id = ANY($1::bigint[])`,
    [gameIds],
  )
  const map = new Map()
  for (const row of result.rows) {
    const key = String(row.game_id)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return map
}

export async function writeGameTags(client, gameId, tags) {
  await client.query(`DELETE FROM coaching.game_tag WHERE game_id = $1`, [gameId])
  if (!Array.isArray(tags) || tags.length === 0) return
  for (const tag of tags) {
    const facetType = String(tag.facet_type || tag.facetType || 'tenet')
    const facetId = Number(tag.facet_id ?? tag.facetId)
    const weight = Number(tag.weight) || 3
    if (!facetId) continue
    await client.query(
      `INSERT INTO coaching.game_tag (game_id, facet_type, facet_id, weight)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (game_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight`,
      [gameId, facetType, facetId, Math.min(5, Math.max(1, weight))],
    )
  }
}

export function buildGameCard(row, tags = [], exerciseLinks = []) {
  return {
    identity: {
      id: Number(row.id),
      name: row.name,
      slug: row.slug,
      description: row.description,
      card_summary: row.card_summary,
      coach_summary: row.coach_summary,
      athlete_summary: row.athlete_summary,
    },
    classification: {
      game_kind: row.game_kind,
      game_type: row.game_type,
      competition_format: row.competition_format,
      group_structure: row.group_structure,
      min_players: row.min_players,
      max_players: row.max_players,
      ideal_players: row.ideal_players,
      age_brackets: row.age_brackets ?? [],
      age_variations: row.age_variations ?? {},
      intensity_level: row.intensity_level,
      contact_level: row.contact_level,
      supervision_level: row.supervision_level,
      best_session_phase: row.best_session_phase,
      compatible_phases: row.compatible_phases ?? [],
      equipment: row.equipment ?? [],
      space_requirements: row.space_requirements ?? {},
      duration_typical_min: row.duration_typical_min,
      duration_typical_max: row.duration_typical_max,
      tags,
    },
    rules: row.rules ?? {},
    safety: row.safety ?? {},
    coaching_notes: row.coaching_notes,
    links: {
      source_exercise_id: row.source_exercise_id != null ? Number(row.source_exercise_id) : null,
      migrated_from_exercise: row.migrated_from_exercise === true,
      exercises: exerciseLinks,
    },
    meta: {
      is_published: row.is_published,
      visibility: row.visibility,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  }
}
