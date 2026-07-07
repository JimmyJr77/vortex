/**
 * Generates:
 *   backend/migrations/212_coaching_ladder_infrastructure_and_seed.sql
 *   backend/migrations/213_coaching_ladder_cards.sql
 *   backend/platform/ladderMovementIntelligenceSlugs.js
 *
 * Source: scripts/data/ladder-all-cards.json
 * Run: node scripts/generate-210-ladder.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(__dirname, 'data/ladder-all-cards.json')
const data = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))
const CARDS = data.cards ?? []
const SLUGS = CARDS.map((c) => c.slug)
const MI_SLUGS = CARDS.filter((c) => c.primaryPhaseKey === 'movement_intelligence').map((c) => c.slug)

function detectMergeSlugs(slugs) {
  const migDir = path.join(__dirname, '../backend/migrations')
  const exclude = new Set([
    '212_coaching_ladder_infrastructure_and_seed.sql',
    '213_coaching_ladder_cards.sql',
  ])
  const merge = new Set()
  for (const slug of slugs) {
    for (const file of fs.readdirSync(migDir)) {
      if (!file.endsWith('.sql') || exclude.has(file)) continue
      const content = fs.readFileSync(path.join(migDir, file), 'utf8')
      if (content.includes(`'${slug}'`)) {
        merge.add(slug)
        break
      }
    }
  }
  return merge
}

const MERGE_SLUGS = detectMergeSlugs(SLUGS)
const INSERT_CARDS = CARDS.filter((c) => !MERGE_SLUGS.has(c.slug))
const MERGE_COUNT = CARDS.length - INSERT_CARDS.length

const PHASE_ORDER_BASE = {
  movement_intelligence: 300,
  output: 810,
  resilience: 555,
}

const COHORT_KEYS = [
  'youth_beginner', 'youth_intermediate', 'teen', 'adult_beginner',
  'adult_advanced', 'older_adult', 'pregnancy_postpartum',
]

const FACET_TABLE = {
  tenet: 'tenet',
  methodology: 'methodology',
  physiology: 'physiological_emphasis',
  pattern: 'movement_pattern',
  equipment: 'equipment',
  body_regions: 'body_region',
}

const FACET_TAG_FIELD = {
  tenet: 'tenets',
  methodology: 'methodologies',
  physiology: 'physiology',
  pattern: 'patterns',
  equipment: 'equipment',
  body_regions: 'body_regions',
}

const VALIDATION_EDU = {
  title: 'Ladder footwork without conditioning drift or ego speed',
  short_summary:
    'Agility-ladder drills are coordination and rhythm constraints — crisp passes with full rest, not fatigued fast-feet circuits, max-intent Output work, or resilience finishers disguised as skill.',
  what_it_is:
    'Ladder-focused cards span linear rhythm, sprint mechanics, lateral footwork, crossover patterns, elastic hops, reactive decisions, partner mirroring, dual-task catches, and hand-support ladder progressions.',
  why_it_matters:
    'The ladder gives immediate feedback on stride length, contact location, and rhythm. Sloppy volume, rushed rest, or chasing speed before pattern quality trains messy contacts and raises trip risk.',
  programming_guidance:
    'Keep Movement Intelligence ladder work to ~2 sets × 2 passes with ≥30s rest; progress pattern complexity before speed; move long reactive or high-impact ladder circuits to Output or Sustained Capacity only when landing and spacing stay clean.',
  common_misuse:
    'Do not turn ladder drills into HIIT finishers, race athletes before they own the pattern, or stack partner chaos, hops, and sprint exits in one fatigued block.',
}

function sqlStr(s) {
  return `'${String(s ?? '').replace(/'/g, "''")}'`
}

function jsonb(obj) {
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`
}

function sqlBool(v) {
  return v ? 'TRUE' : 'FALSE'
}

function sqlTextArray(arr) {
  const items = (arr ?? []).map(sqlStr).join(', ')
  return `ARRAY[${items}]::text[]`
}

function sqlInt(v) {
  return v == null ? 'NULL' : String(v)
}

function parseDosage(card) {
  const d = card.dosage ?? {}
  return {
    volume_unit: d.volume_unit ?? 'reps',
    default_sets: d.default_sets ?? 2,
    default_reps: d.default_reps ?? 2,
    default_work_seconds: d.default_work_seconds ?? 15,
    default_rest_seconds: d.default_rest_seconds ?? 30,
    est_seconds_per_set: d.est_seconds_per_set ?? 55,
    default_rpe_min: d.default_rpe_min ?? 3,
    default_rpe_max: d.default_rpe_max ?? 5,
  }
}

function difficultyFromCard(card) {
  const d = card.difficultyProfile ?? {}
  return {
    technical: d.technical ?? 3,
    load: d.load ?? 2,
    complexity: d.complexity ?? 3,
    overall: d.overall ?? 3,
    recommended_age_min: d.recommended_age_min ?? 6,
    recommended_age_max: d.recommended_age_max ?? null,
    attention_demand: d.attention_demand ?? 'low',
    notes: d.notes ?? null,
  }
}

function participantStructure(card) {
  return card.participantStructure ?? 'individual'
}

function movementRequirementsJson(card) {
  return jsonb(card.movementRequirements ?? {})
}

function normalizeCoachingExecution(card) {
  const exec = card.coachingExecution ?? {}
  return {
    movement_description: exec.movement_description ?? card.description,
    setup: exec.setup ?? [],
    execution_steps: exec.execution_steps ?? [],
    coach_cues: exec.coach_cues ?? [],
    athlete_cues: exec.athlete_cues ?? [],
    breathing_cues: exec.breathing_cues ?? [],
    quality_gate: exec.quality_gate ?? [],
    common_faults: exec.common_faults ?? [],
    stop_signs: exec.stop_signs ?? [],
  }
}

function pairingLogic(card) {
  return {
    pairs_well_before: card.pairsWellBefore ?? [],
    pairs_well_after: card.pairsWellAfter ?? [],
    good_for_sessions: card.goodForSessions ?? [],
    avoid_before: card.avoidBefore ?? [],
    avoid_after: [],
    do_not_use_when: card.doNotUseWhen ?? [],
  }
}

function mediaLibrary(card) {
  return {
    demo_video_sources: [],
    coaching_articles: [],
    clinical_or_sport_science_references: card.mediaReferences ?? [],
    internal_notes: card.mediaInternalNotes ?? [],
  }
}

function scalingGuidance(card, cohortKey) {
  return card.scaling?.[cohortKey]
    ?? card.scalingGuidance
    ?? 'Scale first by pattern complexity, then by speed, then by impact or reactive demand.'
}

function facetTags(card, field) {
  if (field === 'body_regions') return card.body_regions ?? card.bodyRegions ?? []
  return card[field] ?? []
}

function slotName(slot) {
  return slot
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function slotRows() {
  const seen = new Map()
  const phaseCounters = {}
  for (const card of CARDS) {
    const key = `${card.primaryPhaseKey}|${card.slot}`
    if (!seen.has(key)) {
      const base = PHASE_ORDER_BASE[card.primaryPhaseKey] ?? 650
      phaseCounters[card.primaryPhaseKey] = (phaseCounters[card.primaryPhaseKey] ?? 0) + 1
      seen.set(key, {
        phase: card.primaryPhaseKey,
        slot: card.slot,
        subrole: card.subrole,
        order_index: base + phaseCounters[card.primaryPhaseKey],
        name: slotName(card.slot),
        description: `${card.family} — ${card.name}.`,
      })
    }
  }
  return [...seen.values()]
}

function skillLevel(card) {
  const diff = difficultyFromCard(card)
  if (diff.overall >= 7) return 'ADVANCED'
  if (diff.overall >= 5) return 'INTERMEDIATE'
  return 'BEGINNER'
}

function difficultySql(card) {
  const diff = difficultyFromCard(card)
  return `INSERT INTO coaching.exercise_difficulty_profile (
  exercise_id, technical, load, complexity, overall,
  recommended_age_min, recommended_age_max, attention_demand, notes, source
)
SELECT e.id, ${sqlInt(diff.technical)}, ${sqlInt(diff.load)}, ${sqlInt(diff.complexity)}, ${sqlInt(diff.overall)},
  ${sqlInt(diff.recommended_age_min)}, NULL::integer, ${sqlStr(diff.attention_demand)}, ${sqlStr(diff.notes)}, 'authored'
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
ON CONFLICT (exercise_id) DO UPDATE SET
  technical = EXCLUDED.technical,
  load = EXCLUDED.load,
  complexity = EXCLUDED.complexity,
  overall = EXCLUDED.overall,
  recommended_age_min = EXCLUDED.recommended_age_min,
  attention_demand = EXCLUDED.attention_demand,
  notes = EXCLUDED.notes,
  source = EXCLUDED.source,
  updated_at = now();

`
}

// ── 210: infrastructure + seed ─────────────────────────────────────────────

let seedSql = `-- Top 50 ladder-focused exercise library: infrastructure and ${INSERT_CARDS.length}-card seed.
-- IDEMPOTENT. Generated by scripts/generate-210-ladder.mjs (migrations 212/213)
-- ${CARDS.length} total cards (${INSERT_CARDS.length} insert, ${MERGE_COUNT} merge-only hydration).

INSERT INTO coaching.equipment (key, name, sort_order) VALUES
  ('agility_ladder', 'Agility Ladder', 19)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

`

const slots = slotRows()
for (const phase of [...new Set(slots.map((s) => s.phase))]) {
  const phaseSlots = slots.filter((s) => s.phase === phase)
  seedSql += `-- ${phase} ladder slots\n`
  seedSql += `INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity, subrole_key)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity, v.subrole_key
FROM coaching.session_phase sp
CROSS JOIN (VALUES\n`
  seedSql += phaseSlots.map((s) =>
    `  (${sqlStr(s.slot)}, ${sqlStr(s.name)}, ${sqlStr(s.description)}, ${s.order_index}, 2, ${sqlStr(s.subrole)})`,
  ).join(',\n')
  seedSql += `
) AS v(key, name, description, order_index, freshness_sensitivity, subrole_key)
WHERE sp.key = ${sqlStr(phase)}
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  phase_id = EXCLUDED.phase_id,
  order_index = EXCLUDED.order_index,
  freshness_sensitivity = EXCLUDED.freshness_sensitivity,
  subrole_key = EXCLUDED.subrole_key;

`
}

if (INSERT_CARDS.length > 0) {
  seedSql += `INSERT INTO coaching.exercise (
  facility_id, name, slug, description, sport_id, skill_level, age_min,
  default_sets, default_reps, default_work_seconds, default_rest_seconds, est_seconds_per_set,
  is_published, visibility, participant_structure,
  card_summary, coach_language, athlete_language,
  movement_family, primary_phase_key, phase_subrole, primary_order_slot,
  movement_requirements, coaching_execution
)
SELECT
  f.id,
  d.name, d.slug, d.description,
  (SELECT id FROM coaching.sport WHERE key = 'fitness'),
  d.skill::public.skill_level,
  d.age_min,
  d.sets, d.reps, d.work, d.rest, d.est,
  TRUE, 'facility', d.participant,
  d.summary, d.coach_lang, d.athlete_lang,
  d.family, d.phase_key, d.subrole, d.slot,
  d.req::jsonb, d.exec::jsonb
FROM (VALUES\n`

  seedSql += INSERT_CARDS.map((card) => {
    const d = parseDosage(card)
    const diff = difficultyFromCard(card)
    return `  (${sqlStr(card.name)}, ${sqlStr(card.slug)}, ${sqlStr(card.description)}, ${sqlStr(skillLevel(card))}, ${sqlInt(diff.recommended_age_min)}, ${sqlInt(d.default_sets)}, ${sqlInt(d.default_reps)}, ${sqlInt(d.default_work_seconds)}, ${sqlInt(d.default_rest_seconds)}, ${sqlInt(d.est_seconds_per_set)}, ${sqlStr(participantStructure(card))}, ${sqlStr(card.cardSummary)}, ${sqlStr(card.coachLanguage)}, ${sqlStr(card.athleteLanguage)}, ${sqlStr(card.family)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(card.subrole)}, ${sqlStr(card.slot)}, ${movementRequirementsJson(card).replace('::jsonb', '')}::jsonb, ${jsonb(normalizeCoachingExecution(card)).replace('::jsonb', '')}::jsonb)`
  }).join(',\n')

  seedSql += `
) AS d(name, slug, description, skill, age_min, sets, reps, work, rest, est, participant, summary, coach_lang, athlete_lang, family, phase_key, subrole, slot, req, exec)
CROSS JOIN public.facility f
ON CONFLICT (facility_id, slug) DO NOTHING;

`
}

for (const facet of ['tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region']) {
  const table = FACET_TABLE[facet === 'body_region' ? 'body_regions' : facet]
  const field = facet === 'body_region' ? 'body_regions' : FACET_TAG_FIELD[facet]
  const facetType = facet
  const rows = []
  for (const card of INSERT_CARDS) {
    for (const t of facetTags(card, field)) {
      rows.push(`  (${sqlStr(card.slug)}, ${sqlStr(t.key)}, ${t.weight})`)
    }
  }
  if (rows.length === 0) continue
  seedSql += `INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, '${facetType}', f.id, v.weight
FROM (VALUES\n${rows.join(',\n')}
) AS v(slug, fkey, weight)
JOIN coaching.exercise e ON e.slug = v.slug
JOIN coaching.${table} f ON f.key = v.fkey
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

`
}

seedSql += `INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, COALESCE(m.fit_weight, 5), 'primary', m.slot, pos.order_index,
  COALESCE(m.freshness_required, TRUE), COALESCE(m.fatigue_sensitivity, 4), COALESCE(m.fatigue_cost, 3),
  COALESCE(m.technical_complexity, 2), COALESCE(m.impact_level, 1), COALESCE(m.intensity_ceiling, 'moderate')
FROM (VALUES\n`
seedSql += INSERT_CARDS.map((card) => {
  const pp = card.phaseProfile ?? {}
  return `  (${sqlStr(card.slug)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(card.slot)}, ${sqlInt(pp.fit_weight ?? 5)}, ${sqlBool(pp.freshness_required ?? true)}, ${sqlInt(pp.fatigue_sensitivity ?? 4)}, ${sqlInt(pp.fatigue_cost ?? 3)}, ${sqlInt(pp.technical_complexity ?? 2)}, ${sqlInt(pp.impact_level ?? 1)}, ${sqlStr(pp.intensity_ceiling ?? 'moderate')})`
}).join(',\n')
seedSql += `
) AS m(slug, phase_key, slot, fit_weight, freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling)
JOIN coaching.exercise e ON e.slug = m.slug
JOIN coaching.session_phase sp ON sp.key = m.phase_key
JOIN coaching.phase_order_slot pos ON pos.key = m.slot AND pos.phase_id = sp.id
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  role = EXCLUDED.role, order_slot = EXCLUDED.order_slot, fit_weight = EXCLUDED.fit_weight,
  freshness_required = EXCLUDED.freshness_required, fatigue_sensitivity = EXCLUDED.fatigue_sensitivity,
  fatigue_cost = EXCLUDED.fatigue_cost, technical_complexity = EXCLUDED.technical_complexity,
  impact_level = EXCLUDED.impact_level, intensity_ceiling = EXCLUDED.intensity_ceiling;

`

seedSql += `INSERT INTO coaching.exercise_dosage_profile (
  exercise_id, profile_name, is_default, volume_unit, default_sets, default_reps,
  default_work_seconds, default_rest_seconds, default_distance, est_seconds_per_set, default_rpe_min, default_rpe_max
)
SELECT e.id, 'Default', TRUE, m.unit, m.sets, m.reps, m.work, m.rest, m.distance, m.est, m.rpe_min, m.rpe_max
FROM (VALUES\n`
seedSql += INSERT_CARDS.map((card) => {
  const d = parseDosage(card)
  return `  (${sqlStr(card.slug)}, ${sqlStr(d.volume_unit)}, ${sqlInt(d.default_sets)}, ${sqlInt(d.default_reps)}, ${sqlInt(d.default_work_seconds)}, ${sqlInt(d.default_rest_seconds)}, NULL, ${sqlInt(d.est_seconds_per_set)}, ${sqlInt(d.default_rpe_min)}, ${sqlInt(d.default_rpe_max)})`
}).join(',\n')
seedSql += `
) AS m(slug, unit, sets, reps, work, rest, distance, est, rpe_min, rpe_max)
JOIN coaching.exercise e ON e.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_dosage_profile d WHERE d.exercise_id = e.id AND d.profile_name = 'Default');

`

seedSql += `INSERT INTO coaching.exercise_safety_profile (
  exercise_id, risk_level, impact_level, requires_spotting, requires_coach_supervision,
  readiness_checks, contraindications, common_substitutions
)
SELECT e.id, COALESCE(m.risk_level, 1), COALESCE(m.impact_level, 1), COALESCE(m.requires_spotting, FALSE),
  COALESCE(m.requires_coach_supervision, 'optional'),
  COALESCE(m.readiness_checks, ARRAY[]::text[]),
  COALESCE(m.contraindications, ARRAY[]::text[]),
  COALESCE(m.common_substitutions, ARRAY[]::text[])
FROM (VALUES\n`
seedSql += INSERT_CARDS.map((card) => {
  const s = card.safety ?? {}
  return `  (${sqlStr(card.slug)}, ${sqlInt(s.risk_level ?? 1)}, ${sqlInt(s.impact_level ?? 1)}, ${sqlBool(s.requires_spotting)}, ${sqlStr(s.requires_coach_supervision ?? 'optional')}, ${sqlTextArray(s.readiness_checks)}, ${sqlTextArray(s.contraindications)}, ${sqlTextArray(s.common_substitutions)})`
}).join(',\n')
seedSql += `
) AS m(slug, risk_level, impact_level, requires_spotting, requires_coach_supervision, readiness_checks, contraindications, common_substitutions)
JOIN coaching.exercise e ON e.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_safety_profile s WHERE s.exercise_id = e.id);

`

seedSql += `INSERT INTO coaching.exercise_regimen_rule (
  exercise_id, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures,
  counts_as_high_intensity, counts_as_high_impact, counts_as_neural, counts_as_tissue_stress, counts_as_conditioning
)
SELECT e.id,
  COALESCE(m.can_be_daily, TRUE),
  COALESCE(m.weekly_max_frequency, 5),
  COALESCE(m.minimum_hours_between_hard_exposures, 0),
  COALESCE(m.counts_as_high_intensity, FALSE),
  COALESCE(m.counts_as_high_impact, FALSE),
  COALESCE(m.counts_as_neural, TRUE),
  COALESCE(m.counts_as_tissue_stress, FALSE),
  COALESCE(m.counts_as_conditioning, FALSE)
FROM (VALUES\n`
seedSql += INSERT_CARDS.map((card) => {
  const r = card.regimen ?? {}
  return `  (${sqlStr(card.slug)}, ${sqlBool(r.can_be_daily ?? true)}, ${sqlInt(r.weekly_max_frequency ?? 5)}, ${sqlInt(r.minimum_hours_between_hard_exposures ?? 0)}, ${sqlBool(r.counts_as_high_intensity)}, ${sqlBool(r.counts_as_high_impact)}, ${sqlBool(r.counts_as_neural ?? true)}, ${sqlBool(r.counts_as_tissue_stress)}, ${sqlBool(r.counts_as_conditioning)})`
}).join(',\n')
seedSql += `
) AS m(slug, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures, counts_as_high_intensity, counts_as_high_impact, counts_as_neural, counts_as_tissue_stress, counts_as_conditioning)
JOIN coaching.exercise e ON e.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_regimen_rule r WHERE r.exercise_id = e.id);

`

for (const ck of COHORT_KEYS) {
  seedSql += `INSERT INTO coaching.exercise_scaling_profile (exercise_id, cohort_key, label, scale_direction, load_guidance, gender_specific_notes)
SELECT e.id, '${ck}', '${ck.replace(/_/g, ' ')}', 'baseline', v.guidance,
  CASE WHEN '${ck}' = 'adult_beginner' THEN v.gender_notes ELSE NULL END
FROM (VALUES\n`
  seedSql += INSERT_CARDS.map((card) =>
    `  (${sqlStr(card.slug)}, ${sqlStr(scalingGuidance(card, ck))}, ${sqlStr(card.genderSpecificNotes ?? '')})`,
  ).join(',\n')
  seedSql += `
) AS v(slug, guidance, gender_notes)
JOIN coaching.exercise e ON e.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM coaching.exercise_scaling_profile sp
  WHERE sp.exercise_id = e.id AND sp.cohort_key = '${ck}'
);

`
}

for (const card of INSERT_CARDS) {
  seedSql += difficultySql(card)
}

// ── 211: full hydration ──────────────────────────────────────────────────────

let hydrateSql = `-- Top 50 ladder-focused exercise library — full Card v2 hydration.
-- IDEMPOTENT. Generated by scripts/generate-210-ladder.mjs (migrations 212/213)

`

for (const card of CARDS) {
  const pairing = pairingLogic(card)
  const media = mediaLibrary(card)
  const pp = card.phaseProfile ?? {}
  const d = parseDosage(card)
  const s = card.safety ?? {}
  const r = card.regimen ?? {}

  hydrateSql += `-- ${card.name} (${card.slug})
UPDATE coaching.exercise SET
  name = ${sqlStr(card.name)},
  description = ${sqlStr(card.description)},
  card_summary = ${sqlStr(card.cardSummary)},
  coach_language = ${sqlStr(card.coachLanguage)},
  athlete_language = ${sqlStr(card.athleteLanguage)},
  movement_family = ${sqlStr(card.family)},
  primary_phase_key = ${sqlStr(card.primaryPhaseKey)},
  phase_subrole = ${sqlStr(card.subrole)},
  primary_order_slot = ${sqlStr(card.slot)},
  participant_structure = ${sqlStr(participantStructure(card))},
  default_sets = ${sqlInt(d.default_sets)},
  default_reps = ${sqlInt(d.default_reps)},
  default_work_seconds = ${sqlInt(d.default_work_seconds)},
  default_rest_seconds = ${sqlInt(d.default_rest_seconds)},
  est_seconds_per_set = ${sqlInt(d.est_seconds_per_set)},
  movement_requirements = ${movementRequirementsJson(card)},
  coaching_execution = ${jsonb(normalizeCoachingExecution(card))},
  pairing_logic = ${jsonb(pairing)},
  media_library = ${jsonb(media)},
  updated_at = now()
WHERE slug = ${sqlStr(card.slug)};

UPDATE coaching.exercise_phase_profile p SET
  role = ${sqlStr(pp.role ?? 'primary')},
  order_slot = ${sqlStr(card.slot)},
  order_index = pos.order_index,
  fit_weight = ${sqlInt(pp.fit_weight ?? 5)},
  freshness_required = ${sqlBool(pp.freshness_required ?? true)},
  fatigue_sensitivity = ${sqlInt(pp.fatigue_sensitivity ?? 4)},
  fatigue_cost = ${sqlInt(pp.fatigue_cost ?? 3)},
  technical_complexity = ${sqlInt(pp.technical_complexity ?? 2)},
  impact_level = ${sqlInt(pp.impact_level ?? 1)},
  intensity_ceiling = ${sqlStr(pp.intensity_ceiling ?? 'moderate')}
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = ${sqlStr(card.primaryPhaseKey)}
JOIN coaching.phase_order_slot pos ON pos.key = ${sqlStr(card.slot)} AND pos.phase_id = sp.id
WHERE p.exercise_id = e.id AND p.phase_id = sp.id AND e.slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, ${sqlInt(pp.fit_weight ?? 5)}, ${sqlStr(pp.role ?? 'primary')}, ${sqlStr(card.slot)}, pos.order_index,
  ${sqlBool(pp.freshness_required ?? true)}, ${sqlInt(pp.fatigue_sensitivity ?? 4)}, ${sqlInt(pp.fatigue_cost ?? 3)},
  ${sqlInt(pp.technical_complexity ?? 2)}, ${sqlInt(pp.impact_level ?? 1)}, ${sqlStr(pp.intensity_ceiling ?? 'moderate')}
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = ${sqlStr(card.primaryPhaseKey)}
JOIN coaching.phase_order_slot pos ON pos.key = ${sqlStr(card.slot)} AND pos.phase_id = sp.id
WHERE e.slug = ${sqlStr(card.slug)}
  AND NOT EXISTS (
    SELECT 1 FROM coaching.exercise_phase_profile ep
    WHERE ep.exercise_id = e.id AND ep.phase_id = sp.id
  );

UPDATE coaching.exercise_dosage_profile d SET
  volume_unit = ${sqlStr(d.volume_unit)},
  default_sets = ${sqlInt(d.default_sets)},
  default_reps = ${sqlInt(d.default_reps)},
  default_work_seconds = ${sqlInt(d.default_work_seconds)},
  default_rest_seconds = ${sqlInt(d.default_rest_seconds)},
  est_seconds_per_set = ${sqlInt(d.est_seconds_per_set)},
  default_rpe_min = ${sqlInt(d.default_rpe_min)},
  default_rpe_max = ${sqlInt(d.default_rpe_max)}
FROM coaching.exercise e
WHERE d.exercise_id = e.id AND d.profile_name = 'Default' AND e.slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_dosage_profile (
  exercise_id, profile_name, is_default, volume_unit, default_sets, default_reps,
  default_work_seconds, default_rest_seconds, default_distance, est_seconds_per_set, default_rpe_min, default_rpe_max
)
SELECT e.id, 'Default', TRUE, ${sqlStr(d.volume_unit)}, ${sqlInt(d.default_sets)}, ${sqlInt(d.default_reps)},
  ${sqlInt(d.default_work_seconds)}, ${sqlInt(d.default_rest_seconds)}, NULL,
  ${sqlInt(d.est_seconds_per_set)}, ${sqlInt(d.default_rpe_min)}, ${sqlInt(d.default_rpe_max)}
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_dosage_profile dp WHERE dp.exercise_id = e.id AND dp.profile_name = 'Default');

UPDATE coaching.exercise_regimen_rule r SET
  can_be_daily = ${sqlBool(r.can_be_daily ?? true)},
  weekly_max_frequency = ${sqlInt(r.weekly_max_frequency ?? 5)},
  minimum_hours_between_hard_exposures = ${sqlInt(r.minimum_hours_between_hard_exposures ?? 0)},
  counts_as_high_intensity = ${sqlBool(r.counts_as_high_intensity)},
  counts_as_high_impact = ${sqlBool(r.counts_as_high_impact)},
  counts_as_neural = ${sqlBool(r.counts_as_neural ?? true)},
  counts_as_tissue_stress = ${sqlBool(r.counts_as_tissue_stress)},
  counts_as_conditioning = ${sqlBool(r.counts_as_conditioning)}
FROM coaching.exercise e
WHERE r.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_regimen_rule (
  exercise_id, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures,
  counts_as_high_intensity, counts_as_high_impact, counts_as_neural, counts_as_tissue_stress, counts_as_conditioning
)
SELECT e.id,
  ${sqlBool(r.can_be_daily ?? true)}, ${sqlInt(r.weekly_max_frequency ?? 5)}, ${sqlInt(r.minimum_hours_between_hard_exposures ?? 0)},
  ${sqlBool(r.counts_as_high_intensity)}, ${sqlBool(r.counts_as_high_impact)}, ${sqlBool(r.counts_as_neural ?? true)},
  ${sqlBool(r.counts_as_tissue_stress)}, ${sqlBool(r.counts_as_conditioning)}
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_regimen_rule rr WHERE rr.exercise_id = e.id);

UPDATE coaching.exercise_safety_profile s SET
  risk_level = ${sqlInt(s.risk_level ?? 1)},
  impact_level = ${sqlInt(s.impact_level ?? 1)},
  requires_spotting = ${sqlBool(s.requires_spotting)},
  requires_coach_supervision = ${sqlStr(s.requires_coach_supervision ?? 'optional')},
  readiness_checks = ${sqlTextArray(s.readiness_checks)},
  contraindications = ${sqlTextArray(s.contraindications)},
  common_substitutions = ${sqlTextArray(s.common_substitutions)}
FROM coaching.exercise e
WHERE s.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_safety_profile (
  exercise_id, risk_level, impact_level, requires_spotting, requires_coach_supervision,
  readiness_checks, contraindications, common_substitutions
)
SELECT e.id, ${sqlInt(s.risk_level ?? 1)}, ${sqlInt(s.impact_level ?? 1)}, ${sqlBool(s.requires_spotting)},
  ${sqlStr(s.requires_coach_supervision ?? 'optional')},
  ${sqlTextArray(s.readiness_checks)}, ${sqlTextArray(s.contraindications)}, ${sqlTextArray(s.common_substitutions)}
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_safety_profile sp WHERE sp.exercise_id = e.id);

${difficultySql(card)}`
}

hydrateSql += `-- Refresh weighted taxonomy tags
DELETE FROM coaching.exercise_tag t
USING coaching.exercise e
WHERE t.exercise_id = e.id
  AND e.slug IN (${SLUGS.map(sqlStr).join(', ')})
  AND t.facet_type IN ('tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region');

`

for (const [facetKey, table] of Object.entries(FACET_TABLE)) {
  const facetType = facetKey === 'body_regions' ? 'body_region' : facetKey
  const tagField = FACET_TAG_FIELD[facetKey]
  const rows = []
  for (const card of CARDS) {
    for (const t of facetTags(card, tagField)) {
      rows.push(`  (${sqlStr(card.slug)}, ${sqlStr(t.key)}, ${t.weight})`)
    }
  }
  if (rows.length === 0) continue
  hydrateSql += `INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, '${facetType}', f.id, v.weight
FROM (VALUES\n${rows.join(',\n')}
) AS v(slug, fkey, weight)
JOIN coaching.exercise e ON e.slug = v.slug
JOIN coaching.${table} f ON f.key = v.fkey
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight;

`
}

for (const ck of COHORT_KEYS) {
  hydrateSql += `UPDATE coaching.exercise_scaling_profile sp SET
  load_guidance = v.guidance,
  gender_specific_notes = CASE WHEN '${ck}' = 'adult_beginner' THEN v.gender_notes ELSE sp.gender_specific_notes END
FROM (VALUES\n`
  hydrateSql += CARDS.map((card) =>
    `  (${sqlStr(card.slug)}, ${sqlStr(scalingGuidance(card, ck))}, ${sqlStr(card.genderSpecificNotes ?? '')})`,
  ).join(',\n')
  hydrateSql += `
) AS v(slug, guidance, gender_notes)
JOIN coaching.exercise e ON e.slug = v.slug
WHERE sp.exercise_id = e.id AND sp.cohort_key = '${ck}';

INSERT INTO coaching.exercise_scaling_profile (exercise_id, cohort_key, label, scale_direction, load_guidance, gender_specific_notes)
SELECT e.id, '${ck}', '${ck.replace(/_/g, ' ')}', 'baseline', v.guidance,
  CASE WHEN '${ck}' = 'adult_beginner' THEN v.gender_notes ELSE NULL END
FROM (VALUES\n`
  hydrateSql += CARDS.map((card) =>
    `  (${sqlStr(card.slug)}, ${sqlStr(scalingGuidance(card, ck))}, ${sqlStr(card.genderSpecificNotes ?? '')})`,
  ).join(',\n')
  hydrateSql += `
) AS v(slug, guidance, gender_notes)
JOIN coaching.exercise e ON e.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM coaching.exercise_scaling_profile sp
  WHERE sp.exercise_id = e.id AND sp.cohort_key = '${ck}'
);

`
}

hydrateSql += `-- Why-layer education
INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_works, why_it_matters, why_it_goes_here,
  programming_guidance, common_misuse, scaling_guidance
)
SELECT
  'exercise', e.slug, e.id, e.name, e.card_summary,
  e.description,
  v.why_works,
  'Develops tagged tenets and physiological qualities for ladder rhythm, sprint mechanics, lateral control, elastic hops, reactive decisions, and hand-support progressions.',
  v.why_here,
  v.best_placement,
  v.misuse,
  v.scale_guidance
FROM (VALUES\n`
hydrateSql += CARDS.map((c) =>
  `  (${sqlStr(c.slug)}, ${sqlStr(c.whyItWorks)}, ${sqlStr(c.whyItGoesHere)}, ${sqlStr(c.bestPlacement)}, ${sqlStr(c.commonMisuse)}, ${sqlStr(c.scalingGuidance)})`,
).join(',\n')
hydrateSql += `
) AS v(slug, why_works, why_here, best_placement, misuse, scale_guidance)
JOIN coaching.exercise e ON e.slug = v.slug
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_works = EXCLUDED.why_it_works,
  why_it_goes_here = EXCLUDED.why_it_goes_here,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  scaling_guidance = EXCLUDED.scaling_guidance,
  updated_at = now();

-- Ladder cluster validation education
INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_matters, programming_guidance, common_misuse
)
VALUES (
  'validation_rule',
  'ladder_footwork_readiness',
  NULL,
  ${sqlStr(VALIDATION_EDU.title)},
  ${sqlStr(VALIDATION_EDU.short_summary)},
  ${sqlStr(VALIDATION_EDU.what_it_is)},
  ${sqlStr(VALIDATION_EDU.why_it_matters)},
  ${sqlStr(VALIDATION_EDU.programming_guidance)},
  ${sqlStr(VALIDATION_EDU.common_misuse)}
)
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_matters = EXCLUDED.why_it_matters,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  updated_at = now();
`

const slugModule = `/**
 * Movement Intelligence ladder exercise slugs (generated).
 * Source: scripts/data/ladder-all-cards.json via scripts/generate-210-ladder.mjs
 */
export const LADDER_MOVEMENT_INTELLIGENCE_SLUGS = new Set([
${MI_SLUGS.map((s) => `  '${s}',`).join('\n')}
])
`

const seedPath = path.join(__dirname, '../backend/migrations/212_coaching_ladder_infrastructure_and_seed.sql')
const hydratePath = path.join(__dirname, '../backend/migrations/213_coaching_ladder_cards.sql')
const slugPath = path.join(__dirname, '../backend/platform/ladderMovementIntelligenceSlugs.js')
fs.writeFileSync(seedPath, seedSql)
fs.writeFileSync(hydratePath, hydrateSql)
fs.writeFileSync(slugPath, slugModule)
console.log('Wrote', seedPath)
console.log('Wrote', hydratePath, '—', CARDS.length, 'ladder cards (', INSERT_CARDS.length, 'insert,', MERGE_COUNT, 'merge-only)')
console.log('Wrote', slugPath, '—', MI_SLUGS.length, 'MI slugs')
if (MERGE_COUNT > 0) console.log('Merge slugs:', [...MERGE_SLUGS].sort().join(', '))
