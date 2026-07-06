/**
 * Generates:
 *   backend/migrations/190_coaching_reaction_time_reduction_infrastructure_and_seed.sql
 *   backend/migrations/191_coaching_reaction_time_reduction_cards.sql
 *
 * Run: node scripts/generate-188-reaction-time-reduction.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(__dirname, 'data/reaction-time-reduction-all-50.json')
const data = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))
const CARDS = data.cards ?? []
const SLUGS = CARDS.map((c) => c.slug)

function detectMergeSlugs(slugs) {
  const migDir = path.join(__dirname, '../backend/migrations')
  const exclude = new Set([
    '190_coaching_reaction_time_reduction_infrastructure_and_seed.sql',
    '191_coaching_reaction_time_reduction_cards.sql',
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
  movement_intelligence: 750,
  output: 740,
}

const COHORT_KEYS = [
  'youth_beginner', 'youth_intermediate', 'teen', 'adult_beginner',
  'adult_advanced', 'older_adult', 'pregnancy_postpartum',
]

const SCALING_SOURCE = {
  youth_beginner: 'youthBeginner',
  youth_intermediate: 'youthIntermediate',
  teen: 'teen',
  adult_beginner: 'adultBeginner',
  adult_advanced: 'adultAdvanced',
  older_adult: 'olderAdult',
  pregnancy_postpartum: 'pregnancyPostpartum',
}

/** Map source subrole labels to canonical exercise.phase_subrole values. */
const SUBROLE_MAP = {
  reactive_agility_output: 'reactive_agility_tumbling_output',
  coordinate: 'balance_coordination_rhythm',
}

const EQUIPMENT_SEED = [
  ['stick', 'Reaction Stick / Dowel', 23],
  ['whistle', 'Whistle', 24],
  ['floor_grid', 'Floor Grid / Tape Pattern', 25],
  ['light', 'Visual Light Cue', 26],
  ['ball', 'Ball (Generic)', 27],
  ['lines', 'Field Lines / Lane Markers', 28],
]

const BODY_REGION_SEED = [
  ['eye_hand', 'Eye-Hand', 11],
]

const METHODOLOGY_SEED = [
  ['speed_agility', 'Speed & Agility', 'Reactive speed, COD, and agility output work', 9],
]

const MOVEMENT_PATTERN_SEED = [
  ['catch', 'Catch / Receive', 13],
  ['crawl', 'Crawl / Ground Transition', 14],
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
  body_regions: 'bodyRegions',
}

const VALIDATION_EDU = {
  title: 'Reaction time reduction without conditioning drift or pre-fatigue',
  short_summary:
    'Reaction-time drills require crisp cues, accurate answers, adequate rest, and immediate stop when decision quality, posture, braking, spacing, or reset behavior degrades.',
  what_it_is:
    data.library?.purpose
    ?? 'Reduce the time between a valid cue and an accurate, organized athletic response while preserving decision quality, posture, braking, spacing, and reset behavior.',
  why_it_matters:
    'Reaction speed depends on perception, inhibition, first-step timing, and safe finish behavior. Poor dose, short rest, or progression before accuracy trains guessing, collisions, and sloppy mechanics.',
  programming_guidance:
    data.authoringRule
    ?? 'Reaction-time work is quality-first: short exposures, clear stimulus, adequate rest, and immediate stop when decision quality degrades.',
  common_misuse:
    'Do not turn reaction drills into conditioning, punishment, or chaos circuits. Do not add speed, choices, or partner pressure before the athlete can read the cue and answer safely.',
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

function phaseSubrole(subrole) {
  return SUBROLE_MAP[subrole] ?? subrole
}

function normalizeMovementRequirements(card) {
  const req = card.movementRequirements ?? {}
  const target = card.reactionTimeReductionTarget ?? null
  if (req.primary_joint_actions) {
    return {
      ...req,
      reaction_time_reduction_target: target,
    }
  }

  const pp = card.phaseProfile ?? {}
  const safety = card.safety ?? {}
  const qualityGate = req.qualityGate
  return {
    stimulus: req.stimulus ?? target?.stimulus ?? null,
    decision_pattern: req.decisionPattern ?? target?.decisionPattern ?? null,
    space_needed: req.spaceNeeded ?? null,
    setup: req.setup ?? null,
    primary_joint_actions: req.primaryJointActions ?? [],
    primary_tissues: req.primaryTissues ?? [],
    primary_motor_control_demands: req.primaryMotorControlDemands ?? [],
    postural_shape: req.posturalShape ?? req.postural_shape ?? null,
    breathing_demand: req.breathingDemand ?? req.breathing_demand ?? null,
    balance_demand: req.balanceDemand ?? req.balance_demand ?? null,
    coordination_demand: req.coordinationDemand ?? req.coordination_demand ?? null,
    impact_level: req.impactLevel ?? pp.impactLevel ?? safety.impactLevel ?? 2,
    quality_gate: Array.isArray(qualityGate) ? qualityGate.join(' ') : qualityGate ?? null,
    stop_signs: req.stopSigns ?? [],
    reaction_time_reduction_target: target,
  }
}

function movementRequirementsJson(card) {
  return jsonb(normalizeMovementRequirements(card))
}

function normalizeCoachingExecution(card) {
  const exec = card.coachingExecution ?? {}
  const qualityGate = exec.qualityGate ?? exec.quality_gate
  return {
    movement_description: exec.movementDescription ?? exec.movement_description ?? card.description,
    setup: exec.setup ?? [],
    execution_steps: exec.executionSteps ?? exec.execution_steps ?? [],
    breathing_cues: exec.breathingCues ?? exec.breathing_cues ?? [],
    coach_cues: exec.coachCues ?? exec.coach_cues ?? [],
    athlete_cues: exec.athleteCues ?? exec.athlete_cues ?? [],
    quality_gate: Array.isArray(qualityGate) ? qualityGate : qualityGate ? [qualityGate] : [],
    common_faults: exec.commonFaults ?? exec.common_faults ?? [],
    stop_signs: exec.stopSigns ?? exec.stop_signs ?? [],
  }
}

function pairingLogic(card) {
  return {
    pairs_well_before: card.pairsWellBefore ?? [],
    pairs_well_after: card.pairsWellAfter ?? [],
    good_for_sessions: card.goodForSessions ?? ['reaction_time_reduction'],
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
  const sourceKey = SCALING_SOURCE[cohortKey]
  const guidance = card.scaling?.[sourceKey] ?? card.scaling?.adultBeginner
  return guidance
    ?? card.scalingGuidance
    ?? 'Scale one constraint at a time: cue choices, distance, speed, object speed, partner pressure, impact, field size, and rest.'
}

function facetTags(card, field) {
  if (field === 'bodyRegions') return card.bodyRegions ?? card.body_regions ?? []
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
      const base = PHASE_ORDER_BASE[card.primaryPhaseKey] ?? 760
      phaseCounters[card.primaryPhaseKey] = (phaseCounters[card.primaryPhaseKey] ?? 0) + 1
      seen.set(key, {
        phase: card.primaryPhaseKey,
        slot: card.slot,
        subrole: phaseSubrole(card.subrole),
        order_index: base + phaseCounters[card.primaryPhaseKey],
        name: slotName(card.slot),
        description: `${card.family} — ${card.name}.`,
      })
    }
  }
  return [...seen.values()]
}

function skillLevel(card) {
  const risk = card.safety?.riskLevel ?? card.safety?.risk_level ?? 1
  if (card.primaryPhaseKey === 'output' && risk >= 3) return 'INTERMEDIATE'
  if (risk >= 4) return 'ADVANCED'
  return 'BEGINNER'
}

function parseDosage(card) {
  const d = card.dosage ?? {}
  return {
    volume_unit: d.volumeUnit ?? d.volume_unit ?? 'reps',
    default_sets: d.defaultSets ?? d.default_sets ?? 3,
    default_reps: d.defaultReps ?? d.default_reps ?? 4,
    default_work_seconds: d.defaultWorkSeconds ?? d.default_work_seconds ?? null,
    default_rest_seconds: d.defaultRestSeconds ?? d.default_rest_seconds ?? 60,
    est_seconds_per_set: d.estSecondsPerSet ?? d.est_seconds_per_set ?? 68,
    default_rpe_min: d.defaultRpeMin ?? d.default_rpe_min ?? 6,
    default_rpe_max: d.defaultRpeMax ?? d.default_rpe_max ?? 8,
  }
}

function seedExec(card) {
  return normalizeCoachingExecution(card)
}

// ── 188: infrastructure + seed ─────────────────────────────────────────────

let seedSql = `-- Reaction time reduction exercise library: infrastructure and ${INSERT_CARDS.length}-card seed.
-- IDEMPOTENT. Generated by scripts/generate-188-reaction-time-reduction.mjs (migrations 190/191)
-- ${CARDS.length} total cards (${INSERT_CARDS.length} insert, ${MERGE_COUNT} merge-only hydration).
-- Cluster: ${data.library?.title ?? 'Top 50 Reaction Time Reduction Exercise Library'}

INSERT INTO coaching.equipment (key, name, sort_order) VALUES\n`
seedSql += EQUIPMENT_SEED.map(([key, name, sort]) =>
  `  (${sqlStr(key)}, ${sqlStr(name)}, ${sort})`,
).join(',\n')
seedSql += `
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

INSERT INTO coaching.body_region (key, name, sort_order) VALUES\n`
seedSql += BODY_REGION_SEED.map(([key, name, sort]) =>
  `  (${sqlStr(key)}, ${sqlStr(name)}, ${sort})`,
).join(',\n')
seedSql += `
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

INSERT INTO coaching.methodology (key, name, description, sort_order) VALUES\n`
seedSql += METHODOLOGY_SEED.map(([key, name, desc, sort]) =>
  `  (${sqlStr(key)}, ${sqlStr(name)}, ${sqlStr(desc)}, ${sort})`,
).join(',\n')
seedSql += `
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order;

INSERT INTO coaching.movement_pattern (key, name, sort_order) VALUES\n`
seedSql += MOVEMENT_PATTERN_SEED.map(([key, name, sort]) =>
  `  (${sqlStr(key)}, ${sqlStr(name)}, ${sort})`,
).join(',\n')
seedSql += `
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

`

const slots = slotRows()
for (const phase of [...new Set(slots.map((s) => s.phase))]) {
  const phaseSlots = slots.filter((s) => s.phase === phase)
  seedSql += `-- ${phase} reaction-time slots\n`
  seedSql += `INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity, subrole_key)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity, v.subrole_key
FROM coaching.session_phase sp
CROSS JOIN (VALUES\n`
  seedSql += phaseSlots.map((s) =>
    `  (${sqlStr(s.slot)}, ${sqlStr(s.name)}, ${sqlStr(s.description)}, ${s.order_index}, 5, ${sqlStr(s.subrole)})`,
  ).join(',\n')
  seedSql += `
) AS v(key, name, description, order_index, freshness_sensitivity, subrole_key)
WHERE sp.key = ${sqlStr(phase)}
ON CONFLICT (key) DO NOTHING;

`
}

if (INSERT_CARDS.length > 0) {
  seedSql += `-- Insert ${INSERT_CARDS.length} new reaction-time exercises\n`
  seedSql += `INSERT INTO coaching.exercise (
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

  seedSql += INSERT_CARDS.map((card) => {
    const d = parseDosage(card)
    return `  (${sqlStr(card.name)}, ${sqlStr(card.slug)}, ${sqlStr(card.description)}, ${sqlStr(skillLevel(card))}, 8, ${sqlInt(d.default_sets)}, ${sqlInt(d.default_reps)}, ${sqlInt(d.default_work_seconds)}, ${sqlInt(d.default_rest_seconds)}, ${sqlInt(d.est_seconds_per_set)}, ${sqlStr(card.cardSummary)}, ${sqlStr(card.coachLanguage)}, ${sqlStr(card.athleteLanguage)}, ${sqlStr(card.family)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(phaseSubrole(card.subrole))}, ${sqlStr(card.slot)}, ${movementRequirementsJson(card).replace('::jsonb', '')}::jsonb, ${jsonb(seedExec(card)).replace('::jsonb', '')}::jsonb)`
  }).join(',\n')

  seedSql += `
) AS d(name, slug, description, skill, age_min, sets, reps, work, rest, est, summary, coach_lang, athlete_lang, family, phase_key, subrole, slot, req, exec)
CROSS JOIN public.facility f
ON CONFLICT (facility_id, slug) DO NOTHING;

`
}

for (const facet of ['tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region']) {
  const table = FACET_TABLE[facet === 'body_region' ? 'body_regions' : facet]
  const field = facet === 'body_region' ? 'bodyRegions' : FACET_TAG_FIELD[facet]
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

if (INSERT_CARDS.length > 0) {
  seedSql += `INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, COALESCE(m.fit_weight, 5), 'primary', m.slot, pos.order_index,
  COALESCE(m.freshness_required, TRUE), COALESCE(m.fatigue_sensitivity, 5), COALESCE(m.fatigue_cost, 3),
  COALESCE(m.technical_complexity, 3), COALESCE(m.impact_level, 2), COALESCE(m.intensity_ceiling, 'moderate')
FROM (VALUES\n`
  seedSql += INSERT_CARDS.map((card) => {
    const pp = card.phaseProfile ?? {}
    return `  (${sqlStr(card.slug)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(card.slot)}, ${sqlInt(pp.fitWeight ?? pp.fit_weight ?? 5)}, ${sqlBool(pp.freshnessRequired ?? pp.freshness_required ?? true)}, ${sqlInt(pp.fatigueSensitivity ?? pp.fatigue_sensitivity ?? 5)}, ${sqlInt(pp.fatigueCost ?? pp.fatigue_cost ?? 3)}, ${sqlInt(pp.technicalComplexity ?? pp.technical_complexity ?? 3)}, ${sqlInt(pp.impactLevel ?? pp.impact_level ?? 2)}, ${sqlStr(pp.intensityCeiling ?? pp.intensity_ceiling ?? 'moderate')})`
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
    return `  (${sqlStr(card.slug)}, ${sqlInt(s.riskLevel ?? s.risk_level ?? 1)}, ${sqlInt(s.impactLevel ?? s.impact_level ?? 1)}, ${sqlBool(s.requiresSpotting ?? s.requires_spotting)}, ${sqlStr(s.requiresCoachSupervision ?? s.requires_coach_supervision ?? 'optional')}, ${sqlTextArray(s.readinessChecks ?? s.readiness_checks)}, ${sqlTextArray(s.contraindications)}, ${sqlTextArray(s.commonSubstitutions ?? s.common_substitutions)})`
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
  COALESCE(m.weekly_max_frequency, 2),
  COALESCE(m.minimum_hours_between_hard_exposures, 48),
  COALESCE(m.counts_as_high_intensity, TRUE),
  COALESCE(m.counts_as_high_impact, FALSE),
  COALESCE(m.counts_as_neural, TRUE),
  COALESCE(m.counts_as_tissue_stress, TRUE),
  COALESCE(m.counts_as_conditioning, FALSE)
FROM (VALUES\n`
  seedSql += INSERT_CARDS.map((card) => {
    const r = card.regimen ?? {}
    return `  (${sqlStr(card.slug)}, ${sqlBool(r.canBeDaily ?? r.can_be_daily)}, ${sqlInt(r.weeklyMaxFrequency ?? r.weekly_max_frequency ?? 2)}, ${sqlInt(r.minimumHoursBetweenHardExposures ?? r.minimum_hours_between_hard_exposures ?? 48)}, ${sqlBool(r.countsAsHighIntensity ?? r.counts_as_high_intensity ?? true)}, ${sqlBool(r.countsAsHighImpact ?? r.counts_as_high_impact)}, ${sqlBool(r.countsAsNeural ?? r.counts_as_neural ?? true)}, ${sqlBool(r.countsAsTissueStress ?? r.counts_as_tissue_stress ?? true)}, ${sqlBool(r.countsAsConditioning ?? r.counts_as_conditioning)})`
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
}

// ── 189: full hydration ──────────────────────────────────────────────────────

let hydrateSql = `-- Reaction time reduction 50-card full hydration (card v2).
-- IDEMPOTENT. Generated by scripts/generate-188-reaction-time-reduction.mjs (migrations 190/191)

INSERT INTO coaching.equipment (key, name, sort_order) VALUES\n`
hydrateSql += EQUIPMENT_SEED.map(([key, name, sort]) =>
  `  (${sqlStr(key)}, ${sqlStr(name)}, ${sort})`,
).join(',\n')
hydrateSql += `
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

INSERT INTO coaching.body_region (key, name, sort_order) VALUES\n`
hydrateSql += BODY_REGION_SEED.map(([key, name, sort]) =>
  `  (${sqlStr(key)}, ${sqlStr(name)}, ${sort})`,
).join(',\n')
hydrateSql += `
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

INSERT INTO coaching.methodology (key, name, description, sort_order) VALUES\n`
hydrateSql += METHODOLOGY_SEED.map(([key, name, desc, sort]) =>
  `  (${sqlStr(key)}, ${sqlStr(name)}, ${sqlStr(desc)}, ${sort})`,
).join(',\n')
hydrateSql += `
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order;

INSERT INTO coaching.movement_pattern (key, name, sort_order) VALUES\n`
hydrateSql += MOVEMENT_PATTERN_SEED.map(([key, name, sort]) =>
  `  (${sqlStr(key)}, ${sqlStr(name)}, ${sort})`,
).join(',\n')
hydrateSql += `
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

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
  phase_subrole = ${sqlStr(phaseSubrole(card.subrole))},
  primary_order_slot = ${sqlStr(card.slot)},
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
  fit_weight = ${sqlInt(pp.fitWeight ?? pp.fit_weight ?? 5)},
  freshness_required = ${sqlBool(pp.freshnessRequired ?? pp.freshness_required ?? true)},
  fatigue_sensitivity = ${sqlInt(pp.fatigueSensitivity ?? pp.fatigue_sensitivity ?? 5)},
  fatigue_cost = ${sqlInt(pp.fatigueCost ?? pp.fatigue_cost ?? 3)},
  technical_complexity = ${sqlInt(pp.technicalComplexity ?? pp.technical_complexity ?? 3)},
  impact_level = ${sqlInt(pp.impactLevel ?? pp.impact_level ?? 2)},
  intensity_ceiling = ${sqlStr(pp.intensityCeiling ?? pp.intensity_ceiling ?? 'moderate')},
  notes = ${sqlStr(pp.notes ?? card.bestPlacement ?? null)}
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = ${sqlStr(card.primaryPhaseKey)}
JOIN coaching.phase_order_slot pos ON pos.key = ${sqlStr(card.slot)} AND pos.phase_id = sp.id
WHERE p.exercise_id = e.id AND p.phase_id = sp.id AND e.slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, ${sqlInt(pp.fitWeight ?? pp.fit_weight ?? 5)}, ${sqlStr(pp.role ?? 'primary')}, ${sqlStr(card.slot)}, pos.order_index,
  ${sqlBool(pp.freshnessRequired ?? pp.freshness_required ?? true)}, ${sqlInt(pp.fatigueSensitivity ?? pp.fatigue_sensitivity ?? 5)}, ${sqlInt(pp.fatigueCost ?? pp.fatigue_cost ?? 3)},
  ${sqlInt(pp.technicalComplexity ?? pp.technical_complexity ?? 3)}, ${sqlInt(pp.impactLevel ?? pp.impact_level ?? 2)}, ${sqlStr(pp.intensityCeiling ?? pp.intensity_ceiling ?? 'moderate')}
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
  can_be_daily = ${sqlBool(r.canBeDaily ?? r.can_be_daily)},
  weekly_max_frequency = ${sqlInt(r.weeklyMaxFrequency ?? r.weekly_max_frequency ?? 2)},
  minimum_hours_between_hard_exposures = ${sqlInt(r.minimumHoursBetweenHardExposures ?? r.minimum_hours_between_hard_exposures ?? 48)},
  counts_as_high_intensity = ${sqlBool(r.countsAsHighIntensity ?? r.counts_as_high_intensity ?? true)},
  counts_as_high_impact = ${sqlBool(r.countsAsHighImpact ?? r.counts_as_high_impact)},
  counts_as_neural = ${sqlBool(r.countsAsNeural ?? r.counts_as_neural ?? true)},
  counts_as_tissue_stress = ${sqlBool(r.countsAsTissueStress ?? r.counts_as_tissue_stress ?? true)},
  counts_as_conditioning = ${sqlBool(r.countsAsConditioning ?? r.counts_as_conditioning)}
FROM coaching.exercise e
WHERE r.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_regimen_rule (
  exercise_id, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures,
  counts_as_high_intensity, counts_as_high_impact, counts_as_neural, counts_as_tissue_stress, counts_as_conditioning
)
SELECT e.id,
  ${sqlBool(r.canBeDaily ?? r.can_be_daily)}, ${sqlInt(r.weeklyMaxFrequency ?? r.weekly_max_frequency ?? 2)}, ${sqlInt(r.minimumHoursBetweenHardExposures ?? r.minimum_hours_between_hard_exposures ?? 48)},
  ${sqlBool(r.countsAsHighIntensity ?? r.counts_as_high_intensity ?? true)}, ${sqlBool(r.countsAsHighImpact ?? r.counts_as_high_impact)}, ${sqlBool(r.countsAsNeural ?? r.counts_as_neural ?? true)},
  ${sqlBool(r.countsAsTissueStress ?? r.counts_as_tissue_stress ?? true)}, ${sqlBool(r.countsAsConditioning ?? r.counts_as_conditioning)}
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_regimen_rule rr WHERE rr.exercise_id = e.id);

UPDATE coaching.exercise_safety_profile s SET
  risk_level = ${sqlInt(s.riskLevel ?? s.risk_level ?? 1)},
  impact_level = ${sqlInt(s.impactLevel ?? s.impact_level ?? 1)},
  requires_spotting = ${sqlBool(s.requiresSpotting ?? s.requires_spotting)},
  requires_coach_supervision = ${sqlStr(s.requiresCoachSupervision ?? s.requires_coach_supervision ?? 'optional')},
  readiness_checks = ${sqlTextArray(s.readinessChecks ?? s.readiness_checks)},
  contraindications = ${sqlTextArray(s.contraindications)},
  common_substitutions = ${sqlTextArray(s.commonSubstitutions ?? s.common_substitutions)}
FROM coaching.exercise e
WHERE s.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_safety_profile (
  exercise_id, risk_level, impact_level, requires_spotting, requires_coach_supervision,
  readiness_checks, contraindications, common_substitutions
)
SELECT e.id, ${sqlInt(s.riskLevel ?? s.risk_level ?? 1)}, ${sqlInt(s.impactLevel ?? s.impact_level ?? 1)}, ${sqlBool(s.requiresSpotting ?? s.requires_spotting)},
  ${sqlStr(s.requiresCoachSupervision ?? s.requires_coach_supervision ?? 'optional')},
  ${sqlTextArray(s.readinessChecks ?? s.readiness_checks)}, ${sqlTextArray(s.contraindications)}, ${sqlTextArray(s.commonSubstitutions ?? s.common_substitutions)}
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_safety_profile sp WHERE sp.exercise_id = e.id);

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
  'Reaction-time reduction depends on perception, inhibition, first-step timing, safe braking, and reset behavior — not fatigue or guessing.',
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

-- Reaction time reduction cluster validation education
INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_matters, programming_guidance, common_misuse
)
VALUES (
  'validation_rule',
  'reaction_time_reduction_readiness',
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

const seedPath = path.join(__dirname, '../backend/migrations/190_coaching_reaction_time_reduction_infrastructure_and_seed.sql')
const hydratePath = path.join(__dirname, '../backend/migrations/191_coaching_reaction_time_reduction_cards.sql')
fs.writeFileSync(seedPath, seedSql)
fs.writeFileSync(hydratePath, hydrateSql)
console.log('Wrote', seedPath)
console.log('Wrote', hydratePath, '—', CARDS.length, 'reaction-time cards (', INSERT_CARDS.length, 'insert,', MERGE_COUNT, 'merge-only)')
console.log('Merge slugs:', [...MERGE_SLUGS].sort().join(', '))
