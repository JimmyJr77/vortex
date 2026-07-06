/**
 * Generates:
 *   backend/migrations/153_coaching_balance_infrastructure_and_seed.sql
 *   backend/migrations/154_coaching_balance_cards.sql
 *
 * Run: node scripts/generate-153-balance.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(__dirname, 'data/balance-all-cards.json')
const data = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))
const CARDS = data.cards ?? []
const SLUGS = CARDS.map((c) => c.slug)

const PHASE_ORDER_BASE = {
  movement_intelligence: 269,
  resilience: 531,
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

const EQUIPMENT_SEED = [
  ['line', 'Floor Line / Chalk Line', 21],
  ['tape_line', 'Tape Line', 22],
  ['low_beam', 'Low Beam / Balance Beam', 23],
]

const VALIDATION_EDU = {
  title: 'Balance without pre-fatigue or wrong phase intent',
  short_summary:
    'Sideline, beam, and wrestling center-of-gravity balance drills must match phase intent — fresh for Movement Intelligence skill work, controlled for Resilience braking and perturbation, and never disguised conditioning.',
  what_it_is:
    'Balance cards span foot tripod holds, beam walks, deceleration sticks, partner perturbations, and loaded carries for athletes who need sideline contact recovery, narrow-base control, and center-of-gravity ownership.',
  why_it_matters:
    'Balance quality depends on sensory input, foot pressure, trunk organization, and joint alignment. Poor placement, unstable surfaces before basics are owned, or fatigue stacking raises fall risk and trains compensatory wobble.',
  programming_guidance:
    'Master static floor balance before beam or eyes-closed progressions; use Resilience sticks after Output when braking is the goal; keep perturbation work submaximal until base single-leg control is clean.',
  common_misuse:
    'Do not program long boredom holds, unstable gimmicks before floor balance is owned, or hide fatigue circuits in Movement Intelligence when the goal is skill and body control.',
}

/** Card v2 authoring uses shorthand subroles; map to DB CHECK values. */
function normalizeSubrole(card) {
  if (card.subrole === 'coordinate') return 'balance_coordination_rhythm'
  return card.subrole
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

function movementRequirementsJson(card) {
  return jsonb(card.movementRequirements ?? {})
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
      const base = PHASE_ORDER_BASE[card.primaryPhaseKey] ?? 500
      phaseCounters[card.primaryPhaseKey] = (phaseCounters[card.primaryPhaseKey] ?? 0) + 1
      seen.set(key, {
        phase: card.primaryPhaseKey,
        slot: card.slot,
        subrole: normalizeSubrole(card),
        order_index: base + phaseCounters[card.primaryPhaseKey],
        name: slotName(card.slot),
        description: `${card.family} — ${card.name}.`,
      })
    }
  }
  return [...seen.values()]
}

function seedReq(card) {
  const req = card.movementRequirements ?? {}
  return {
    primary_joint_actions: req.primary_joint_actions ?? [],
    primary_tissues: req.primary_tissues ?? [],
    primary_motor_control_demands: req.primary_motor_control_demands ?? [],
    postural_shape: req.postural_shape ?? null,
    breathing_demand: req.breathing_demand ?? null,
    balance_demand: req.balance_demand ?? null,
    coordination_demand: req.coordination_demand ?? null,
    impact_level: req.impact_level ?? card.phaseProfile?.impact_level ?? 0,
  }
}

function seedExec(card) {
  const exec = card.coachingExecution ?? {}
  return {
    movement_description: exec.movement_description ?? card.description,
    setup: exec.setup ?? [],
    execution_steps: exec.execution_steps ?? [],
    coach_cues: exec.coach_cues ?? [],
    common_faults: exec.common_faults ?? [],
  }
}

function defaultScaling(card, ck) {
  return card.scaling?.[ck] ?? card.scaling?.adult_beginner
    ?? 'Scale one variable at a time: base width, visual input, range, speed, surface height, perturbation, external load, hold duration, or reset time.'
}

// ── 153: infrastructure + seed ─────────────────────────────────────────────

let seedSql = `-- Top 50 Balance Exercise Library — phase infrastructure, taxonomy support, and 50-card seed.
-- IDEMPOTENT. Generated by scripts/generate-153-balance.mjs

INSERT INTO coaching.equipment (key, name, sort_order) VALUES\n`
seedSql += EQUIPMENT_SEED.map(([k, n, o]) => `  (${sqlStr(k)}, ${sqlStr(n)}, ${o})`).join(',\n')
seedSql += `
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

`

const slots = slotRows()
for (const phase of [...new Set(slots.map((s) => s.phase))]) {
  const phaseSlots = slots.filter((s) => s.phase === phase)
  seedSql += `-- ${phase} balance slots\n`
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

seedSql += `-- Insert 50 balance exercises
INSERT INTO coaching.exercise (
  facility_id, name, slug, description, sport_id, skill_level, age_min,
  default_sets, default_reps, default_work_seconds, default_rest_seconds, est_seconds_per_set,
  is_published, visibility,
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
  TRUE, 'facility',
  d.summary, d.coach_lang, d.athlete_lang,
  d.family, d.phase_key, d.subrole, d.slot,
  d.req::jsonb, d.exec::jsonb
FROM (VALUES\n`

seedSql += CARDS.map((card) => {
  const d = card.dosage ?? {}
  const skill = 'BEGINNER'
  return `  (${sqlStr(card.name)}, ${sqlStr(card.slug)}, ${sqlStr(card.description)}, ${sqlStr(skill)}, 8, ${sqlInt(d.default_sets ?? 2)}, ${sqlInt(d.default_reps)}, ${sqlInt(d.default_work_seconds)}, ${sqlInt(d.default_rest_seconds ?? 30)}, ${sqlInt(d.est_seconds_per_set ?? 40)}, ${sqlStr(card.cardSummary)}, ${sqlStr(card.coachLanguage)}, ${sqlStr(card.athleteLanguage)}, ${sqlStr(card.family)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(normalizeSubrole(card))}, ${sqlStr(card.slot)}, ${jsonb(seedReq(card)).replace('::jsonb', '')}::jsonb, ${jsonb(seedExec(card)).replace('::jsonb', '')}::jsonb)`
}).join(',\n')

seedSql += `
) AS d(name, slug, description, skill, age_min, sets, reps, work, rest, est, summary, coach_lang, athlete_lang, family, phase_key, subrole, slot, req, exec)
CROSS JOIN public.facility f
ON CONFLICT (facility_id, slug) DO NOTHING;

`

for (const facet of ['tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region']) {
  const table = FACET_TABLE[facet === 'body_region' ? 'body_regions' : facet]
  const field = facet === 'body_region' ? 'body_regions' : FACET_TAG_FIELD[facet]
  const facetType = facet
  const rows = []
  for (const card of CARDS) {
    const tags = card[field] ?? []
    for (const t of tags.slice(0, facet === 'tenet' ? 2 : 1)) {
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
  COALESCE(m.freshness_required, FALSE), COALESCE(m.fatigue_sensitivity, 2), COALESCE(m.fatigue_cost, 2),
  COALESCE(m.technical_complexity, 2), COALESCE(m.impact_level, 0), COALESCE(m.intensity_ceiling, 'low')
FROM (VALUES\n`
seedSql += CARDS.map((card) => {
  const pp = card.phaseProfile ?? {}
  return `  (${sqlStr(card.slug)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(card.slot)}, ${sqlInt(pp.fit_weight ?? 5)}, ${sqlBool(pp.freshness_required ?? true)}, ${sqlInt(pp.fatigue_sensitivity ?? 2)}, ${sqlInt(pp.fatigue_cost ?? 1)}, ${sqlInt(pp.technical_complexity ?? 2)}, ${sqlInt(pp.impact_level ?? 0)}, ${sqlStr(pp.intensity_ceiling ?? 'low')})`
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
seedSql += CARDS.map((card) => {
  const d = card.dosage ?? {}
  return `  (${sqlStr(card.slug)}, ${sqlStr(d.volume_unit ?? 'reps')}, ${sqlInt(d.default_sets ?? 2)}, ${sqlInt(d.default_reps)}, ${sqlInt(d.default_work_seconds)}, ${sqlInt(d.default_rest_seconds ?? 30)}, ${d.default_distance != null ? sqlStr(String(d.default_distance)) : 'NULL'}, ${sqlInt(d.est_seconds_per_set ?? 40)}, ${sqlInt(d.default_rpe_min ?? 3)}, ${sqlInt(d.default_rpe_max ?? 6)})`
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
SELECT e.id, COALESCE(m.risk_level, 1), COALESCE(m.impact_level, 0), COALESCE(m.requires_spotting, FALSE),
  COALESCE(m.requires_coach_supervision, 'optional'),
  COALESCE(m.readiness_checks, ARRAY[]::text[]),
  COALESCE(m.contraindications, ARRAY[]::text[]),
  COALESCE(m.common_substitutions, ARRAY[]::text[])
FROM (VALUES\n`
seedSql += CARDS.map((card) => {
  const s = card.safety ?? {}
  return `  (${sqlStr(card.slug)}, ${sqlInt(s.risk_level ?? 1)}, ${sqlInt(s.impact_level ?? 0)}, ${sqlBool(s.requires_spotting)}, ${sqlStr(s.requires_coach_supervision ?? 'optional')}, ${sqlTextArray(s.readiness_checks)}, ${sqlTextArray(s.contraindications)}, ${sqlTextArray(s.common_substitutions)})`
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
  COALESCE(m.can_be_daily, FALSE),
  COALESCE(m.weekly_max_frequency, 4),
  COALESCE(m.minimum_hours_between_hard_exposures, 0),
  COALESCE(m.counts_as_high_intensity, FALSE),
  COALESCE(m.counts_as_high_impact, FALSE),
  COALESCE(m.counts_as_neural, FALSE),
  COALESCE(m.counts_as_tissue_stress, FALSE),
  COALESCE(m.counts_as_conditioning, FALSE)
FROM (VALUES\n`
seedSql += CARDS.map((card) => {
  const r = card.regimen ?? {}
  return `  (${sqlStr(card.slug)}, ${sqlBool(r.can_be_daily)}, ${sqlInt(r.weekly_max_frequency ?? 4)}, ${sqlInt(r.minimum_hours_between_hard_exposures ?? 0)}, ${sqlBool(r.counts_as_high_intensity)}, ${sqlBool(r.counts_as_high_impact)}, ${sqlBool(r.counts_as_neural)}, ${sqlBool(r.counts_as_tissue_stress)}, ${sqlBool(r.counts_as_conditioning)})`
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
  seedSql += CARDS.map((card) =>
    `  (${sqlStr(card.slug)}, ${sqlStr(defaultScaling(card, ck))}, ${sqlStr(card.genderSpecificNotes ?? '')})`,
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

// ── 154: full hydration ──────────────────────────────────────────────────────

let hydrateSql = `-- Top 50 Balance Exercise Library — full hydration (card v2).
-- IDEMPOTENT. Generated by scripts/generate-153-balance.mjs

`

for (const card of CARDS) {
  const pairing = {
    pairs_well_before: card.pairsWellBefore ?? [],
    pairs_well_after: card.pairsWellAfter ?? [],
    good_for_sessions: card.goodForSessions ?? [],
    avoid_before: card.avoidBefore ?? [],
    avoid_after: [],
    do_not_use_when: card.doNotUseWhen ?? [],
  }
  const media = {
    demo_video_sources: [],
    coaching_articles: [],
    clinical_or_sport_science_references: card.mediaReferences ?? [],
    internal_notes: [
      ...(card.mediaInternalNotes ?? []),
      'Balance cluster card; source: top_50_balance_exercise_library.',
    ],
  }
  const pp = card.phaseProfile ?? {}
  const d = card.dosage ?? {}
  const s = card.safety ?? {}
  const r = card.regimen ?? {}
  const sessionVolMin = d.session_volume_min != null ? sqlStr(String(d.session_volume_min)) : 'NULL'
  const sessionVolMax = d.session_volume_max != null ? sqlStr(String(d.session_volume_max)) : 'NULL'
  const defaultDistance = d.default_distance != null ? sqlStr(String(d.default_distance)) : 'NULL'

  hydrateSql += `-- ${card.name} (${card.slug})
UPDATE coaching.exercise SET
  name = ${sqlStr(card.name)},
  description = ${sqlStr(card.description)},
  card_summary = ${sqlStr(card.cardSummary)},
  coach_language = ${sqlStr(card.coachLanguage)},
  athlete_language = ${sqlStr(card.athleteLanguage)},
  movement_family = ${sqlStr(card.family)},
  primary_phase_key = ${sqlStr(card.primaryPhaseKey)},
  phase_subrole = ${sqlStr(normalizeSubrole(card))},
  primary_order_slot = ${sqlStr(card.slot)},
  default_sets = ${sqlInt(d.default_sets ?? 2)},
  default_reps = ${sqlInt(d.default_reps)},
  default_work_seconds = ${sqlInt(d.default_work_seconds)},
  default_rest_seconds = ${sqlInt(d.default_rest_seconds ?? 30)},
  est_seconds_per_set = ${sqlInt(d.est_seconds_per_set ?? 40)},
  movement_requirements = ${movementRequirementsJson(card)},
  coaching_execution = ${jsonb(card.coachingExecution ?? {})},
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
  fatigue_sensitivity = ${sqlInt(pp.fatigue_sensitivity ?? 2)},
  fatigue_cost = ${sqlInt(pp.fatigue_cost ?? 1)},
  technical_complexity = ${sqlInt(pp.technical_complexity ?? 2)},
  impact_level = ${sqlInt(pp.impact_level ?? 0)},
  intensity_ceiling = ${sqlStr(pp.intensity_ceiling ?? 'low')},
  notes = ${sqlStr(pp.notes ?? null)}
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = ${sqlStr(card.primaryPhaseKey)}
JOIN coaching.phase_order_slot pos ON pos.key = ${sqlStr(card.slot)} AND pos.phase_id = sp.id
WHERE p.exercise_id = e.id AND p.phase_id = sp.id AND e.slug = ${sqlStr(card.slug)};

UPDATE coaching.exercise_dosage_profile d SET
  volume_unit = ${sqlStr(d.volume_unit ?? 'reps')},
  default_sets = ${sqlInt(d.default_sets ?? 2)},
  default_reps = ${sqlInt(d.default_reps)},
  default_distance = ${defaultDistance},
  default_work_seconds = ${sqlInt(d.default_work_seconds)},
  default_rest_seconds = ${sqlInt(d.default_rest_seconds ?? 30)},
  est_seconds_per_set = ${sqlInt(d.est_seconds_per_set ?? 40)},
  default_rpe_min = ${sqlInt(d.default_rpe_min ?? 3)},
  default_rpe_max = ${sqlInt(d.default_rpe_max ?? 6)},
  session_volume_min = ${sessionVolMin},
  session_volume_max = ${sessionVolMax}
FROM coaching.exercise e
WHERE d.exercise_id = e.id AND d.profile_name = 'Default' AND e.slug = ${sqlStr(card.slug)};

UPDATE coaching.exercise_regimen_rule r SET
  can_be_daily = ${sqlBool(r.can_be_daily)},
  weekly_max_frequency = ${sqlInt(r.weekly_max_frequency ?? 4)},
  minimum_hours_between_hard_exposures = ${sqlInt(r.minimum_hours_between_hard_exposures ?? 0)},
  counts_as_high_intensity = ${sqlBool(r.counts_as_high_intensity)},
  counts_as_high_impact = ${sqlBool(r.counts_as_high_impact)},
  counts_as_neural = ${sqlBool(r.counts_as_neural)},
  counts_as_tissue_stress = ${sqlBool(r.counts_as_tissue_stress)},
  counts_as_conditioning = ${sqlBool(r.counts_as_conditioning)}
FROM coaching.exercise e
WHERE r.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

UPDATE coaching.exercise_safety_profile s SET
  risk_level = ${sqlInt(s.risk_level ?? 1)},
  impact_level = ${sqlInt(s.impact_level ?? 0)},
  requires_spotting = ${sqlBool(s.requires_spotting)},
  requires_coach_supervision = ${sqlStr(s.requires_coach_supervision ?? 'optional')},
  readiness_checks = ${sqlTextArray(s.readiness_checks)},
  contraindications = ${sqlTextArray(s.contraindications)},
  common_substitutions = ${sqlTextArray(s.common_substitutions)}
FROM coaching.exercise e
WHERE s.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

`
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
    for (const t of card[tagField] ?? []) {
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
    `  (${sqlStr(card.slug)}, ${sqlStr(defaultScaling(card, ck))}, ${sqlStr(card.genderSpecificNotes ?? '')})`,
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
    `  (${sqlStr(card.slug)}, ${sqlStr(defaultScaling(card, ck))}, ${sqlStr(card.genderSpecificNotes ?? '')})`,
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
  'Develops sideline, beam, and center-of-gravity balance qualities for athletic body control and contact recovery.',
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

-- Balance cluster validation education
INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_matters, programming_guidance, common_misuse
)
VALUES (
  'validation_rule',
  'balance_readiness',
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

const seedPath = path.join(__dirname, '../backend/migrations/153_coaching_balance_infrastructure_and_seed.sql')
const hydratePath = path.join(__dirname, '../backend/migrations/154_coaching_balance_cards.sql')
fs.writeFileSync(seedPath, seedSql)
fs.writeFileSync(hydratePath, hydrateSql)
console.log('Wrote', seedPath)
console.log('Wrote', hydratePath, '—', CARDS.length, 'balance cards')
