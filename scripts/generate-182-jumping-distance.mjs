/**
 * Generates:
 *   backend/migrations/184_coaching_jumping_distance_infrastructure_and_seed.sql
 *   backend/migrations/185_coaching_jumping_distance_cards.sql
 *
 * Run: node scripts/generate-182-jumping-distance.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(__dirname, 'data/jumping-distance-all-cards.json')
const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))

const SLUG_CONFLICTS = new Set([
  'snap-down-to-stick', 'drop-landing-to-stick', 'ankle-pogo-in-place', 'single-leg-pogo-in-place',
  'tibialis-raise', 'wall-drive-switch', 'straight-leg-bound-march', 'squat-jump-to-stick',
  'countermovement-jump-to-stick', 'broad-jump-to-stick', 'single-leg-hop-to-stick', 'power-skip-for-distance',
  'straight-leg-bound', 'trap-bar-deadlift', 'rear-foot-elevated-split-squat', 'single-leg-romanian-deadlift',
  'hip-thrust', 'standing-calf-raise', 'bent-knee-soleus-raise', 'nordic-hamstring-eccentric', 'medicine-ball-scoop-toss',
])

function cardSlug(card) {
  return SLUG_CONFLICTS.has(card.slug) ? `distance-jump-${card.slug}` : card.slug
}

const CARDS = (raw.cards ?? []).map((card) => ({
  ...card,
  slug: cardSlug(card),
  subrole: normalizeSubrole(card.subrole),
}))

const SLUGS = CARDS.map((c) => c.slug)

const PHASE_ORDER_BASE = {
  prepare_and_access: 190,
  movement_intelligence: 650,
  resilience: 645,
  output: 750,
  capacity: 490,
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
  body_regions: 'bodyRegions',
}

const VALIDATION_EDU = {
  title: 'Jumping for distance without pre-fatigue or wrong phase intent',
  short_summary:
    'Approach rhythm, horizontal projection, elastic bounds, landing control, and strength support for long/broad jumping must match phase intent — fresh for Output power, controlled for Resilience landings, and never disguised conditioning.',
  what_it_is:
    'Distance-jump cards span landing sticks, ankle stiffness, sprint approach mechanics, penultimate timing, broad-jump power, bound series, triple-jump elasticity, and strength/tendon support for athletes who need horizontal projection with safe landings.',
  why_it_matters:
    'Distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip/trunk control, and landing tolerance. Poor placement, short rest, or progression before basic landings raise injury risk and train sloppy contacts.',
  programming_guidance:
    'Master quiet landings and approach rhythm before maximal distance attempts; use full rest on Output jumps; place strength support in Capacity — not as conditioning finishers; stop when rhythm, stiffness, projection, or landing quality degrades.',
  common_misuse:
    'Do not program max jumps after fatigue, use high-impact contacts as warm-up conditioning, or hide distance work in Resilience when the goal is maximal projection while fresh.',
}

function normalizeSubrole(subrole) {
  if (subrole === 'lower_leg_tissue_capacity') return 'slow_eccentric_isometric_joint_resilience'
  return subrole
}

function normalizeMethodologyKey(key) {
  const map = {
    sprint_mechanics: 'neural',
    strength_training: 'resistance_calisthenics',
    strength_power: 'resistance_calisthenics',
    eccentrics: 'eccentric_negative',
  }
  return map[key] ?? key
}

function normalizePhysiologyKey(key) {
  const map = {
    tissue_capacity: 'force_tissue_capacity',
    elastic_energy: 'ssc_stiffness',
    rate_of_force_development: 'neural_output_readiness',
    force_capacity: 'force_tissue_capacity',
  }
  return map[key] ?? key
}

function normalizeTenetKey(key) {
  const map = {
    resilience: 'body_control',
    power: 'explosiveness',
  }
  return map[key] ?? key
}

function normalizeBodyRegionKey(key) {
  const map = {
    calf: 'ankle',
    shin: 'ankle',
  }
  return map[key] ?? key
}

function primaryPhaseProfile(card) {
  const profiles = card.phaseProfile ?? []
  return profiles.find((p) => p.role === 'primary') ?? profiles[0] ?? {}
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

function coachSupervision(val) {
  if (val === true) return 'required'
  if (val === false) return 'optional'
  return val ?? 'optional'
}

function genderNotes(card) {
  return card.scaling?.genderSpecificNotes ?? ''
}

function pairingLogic(card) {
  const pl = card.pairingLogic ?? {}
  return {
    pairs_well_before: pl.pairsWellBefore ?? [],
    pairs_well_after: pl.pairsWellAfter ?? [],
    good_for_sessions: pl.goodForSessions ?? [],
    avoid_before: pl.avoidBefore ?? [],
    avoid_after: [],
    do_not_use_when: pl.doNotUseWhen ?? [],
  }
}

function seedReq(card) {
  const req = card.movementRequirements ?? {}
  const pp = primaryPhaseProfile(card)
  const impact = req.landingOrImpact?.impactLevel ?? req.impact_level ?? pp.impactLevel ?? 0
  return {
    primary_joint_actions: req.primaryJointActions ?? req.primary_joint_actions ?? [],
    primary_tissues: req.primaryTissues ?? req.primary_tissues ?? [],
    primary_motor_control_demands: req.primaryMotorControlDemands ?? req.primary_motor_control_demands ?? [],
    postural_shape: req.posturalShape ?? req.postural_shape ?? null,
    breathing_demand: req.breathingDemand ?? req.breathing_demand ?? null,
    balance_demand: req.balanceDemand ?? req.balance_demand ?? null,
    coordination_demand: req.coordinationDemand ?? req.coordination_demand ?? null,
    impact_level: impact,
    range_of_motion: req.rangeOfMotion ?? req.range_of_motion ?? null,
    surface_and_space: req.surfaceAndSpace ?? req.surface_and_space ?? null,
    asymmetry_watch: req.asymmetryWatch ?? req.asymmetry_watch ?? null,
  }
}

function seedExec(card) {
  const exec = card.coachingExecution ?? {}
  return {
    movement_description: exec.movementDescription ?? exec.movement_description ?? card.description,
    setup: exec.setup ?? [],
    execution_steps: exec.executionSteps ?? exec.execution_steps ?? [],
    coach_cues: exec.coachCues ?? exec.coach_cues ?? [],
    common_faults: exec.commonFaults ?? exec.common_faults ?? [],
    breathing_cues: exec.breathingCues ?? exec.breathing_cues ?? [],
    quality_gate: exec.qualityGate ?? exec.quality_gate ?? [],
    stop_signs: exec.stopSigns ?? exec.stop_signs ?? [],
  }
}

function movementRequirementsJson(card) {
  return jsonb(seedReq(card))
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
      const base = PHASE_ORDER_BASE[card.primaryPhaseKey] ?? 800
      phaseCounters[card.primaryPhaseKey] = (phaseCounters[card.primaryPhaseKey] ?? 0) + 1
      const freshness = card.primaryPhaseKey === 'output' ? 5 : 2
      seen.set(key, {
        phase: card.primaryPhaseKey,
        slot: card.slot,
        subrole: card.subrole,
        order_index: base + phaseCounters[card.primaryPhaseKey],
        freshness_sensitivity: freshness,
        name: slotName(card.slot),
        description: `${card.family} — ${card.name}.`,
      })
    }
  }
  return [...seen.values()]
}

function skillLevel(card) {
  if (card.primaryPhaseKey === 'output') return 'INTERMEDIATE'
  if (card.primaryPhaseKey === 'capacity') return 'INTERMEDIATE'
  return 'BEGINNER'
}

function tagRows(facetKey) {
  const field = facetKey === 'body_region' ? 'bodyRegions' : FACET_TAG_FIELD[facetKey === 'body_region' ? 'body_regions' : facetKey]
  const rows = []
  for (const card of CARDS) {
    for (const t of card[field] ?? []) {
      let fkey = t.key
      if (facetKey === 'methodology') fkey = normalizeMethodologyKey(fkey)
      if (facetKey === 'physiology') fkey = normalizePhysiologyKey(fkey)
      if (facetKey === 'tenet') fkey = normalizeTenetKey(fkey)
      if (facetKey === 'body_region') fkey = normalizeBodyRegionKey(fkey)
      rows.push(`  (${sqlStr(card.slug)}, ${sqlStr(fkey)}, ${t.weight})`)
    }
  }
  return rows
}

// ── 182: infrastructure + seed ─────────────────────────────────────────────

let seedSql = `-- Top 50 Jumping Athletes for Distance — infrastructure, taxonomy, and 50-card seed.
-- IDEMPOTENT. Generated by scripts/generate-182-jumping-distance.mjs

INSERT INTO coaching.equipment (key, name, sort_order) VALUES
  ('jump_pit', 'Jump Pit / Sand Pit', 100),
  ('machine_or_dumbbells', 'Machine or Dumbbells', 101),
  ('wall_or_open_space', 'Wall or Open Space', 102),
  ('open_space', 'Open Space', 103)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

INSERT INTO coaching.body_region (key, name, sort_order) VALUES
  ('hamstring', 'Hamstring', 12)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

`

const slots = slotRows()
for (const phase of [...new Set(slots.map((s) => s.phase))]) {
  const phaseSlots = slots.filter((s) => s.phase === phase)
  seedSql += `-- ${phase} distance-jump slots\n`
  seedSql += `INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity, subrole_key)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity, v.subrole_key
FROM coaching.session_phase sp
CROSS JOIN (VALUES\n`
  seedSql += phaseSlots.map((s) =>
    `  (${sqlStr(s.slot)}, ${sqlStr(s.name)}, ${sqlStr(s.description)}, ${s.order_index}, ${s.freshness_sensitivity}, ${sqlStr(s.subrole)})`,
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

seedSql += `-- Insert 50 distance-jump exercises
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
  const reps = d.defaultReps ?? d.default_reps ?? null
  const work = d.defaultWorkSeconds ?? d.default_work_seconds ?? null
  return `  (${sqlStr(card.name)}, ${sqlStr(card.slug)}, ${sqlStr(card.description)}, ${sqlStr(skillLevel(card))}, 8, ${sqlInt(d.defaultSets ?? d.default_sets ?? 2)}, ${sqlInt(reps)}, ${sqlInt(work)}, ${sqlInt(d.defaultRestSeconds ?? d.default_rest_seconds ?? 30)}, ${sqlInt(d.estSecondsPerSet ?? d.est_seconds_per_set ?? 40)}, ${sqlStr(card.cardSummary)}, ${sqlStr(card.coachLanguage)}, ${sqlStr(card.athleteLanguage)}, ${sqlStr(card.family)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(card.subrole)}, ${sqlStr(card.slot)}, ${jsonb(seedReq(card)).replace('::jsonb', '')}::jsonb, ${jsonb(seedExec(card)).replace('::jsonb', '')}::jsonb)`
}).join(',\n')

seedSql += `
) AS d(name, slug, description, skill, age_min, sets, reps, work, rest, est, summary, coach_lang, athlete_lang, family, phase_key, subrole, slot, req, exec)
CROSS JOIN public.facility f
ON CONFLICT (facility_id, slug) DO NOTHING;

`

for (const facet of ['tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region']) {
  const table = FACET_TABLE[facet === 'body_region' ? 'body_regions' : facet]
  const rows = tagRows(facet)
  if (rows.length === 0) continue
  seedSql += `INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, '${facet}', f.id, v.weight
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
SELECT e.id, sp.id, COALESCE(m.fit_weight, 5), COALESCE(m.role, 'primary'), m.slot, pos.order_index,
  COALESCE(m.freshness_required, FALSE), COALESCE(m.fatigue_sensitivity, 2), COALESCE(m.fatigue_cost, 2),
  COALESCE(m.technical_complexity, 2), COALESCE(m.impact_level, 1), COALESCE(m.intensity_ceiling, 'moderate')
FROM (VALUES\n`
seedSql += CARDS.map((card) => {
  const pp = primaryPhaseProfile(card)
  return `  (${sqlStr(card.slug)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(card.slot)}, ${sqlInt(pp.fitWeight ?? pp.fit_weight ?? 5)}, ${sqlStr(pp.role ?? 'primary')}, ${sqlBool(pp.freshnessRequired ?? pp.freshness_required)}, ${sqlInt(pp.fatigueSensitivity ?? pp.fatigue_sensitivity ?? 2)}, ${sqlInt(pp.fatigueCost ?? pp.fatigue_cost ?? 2)}, ${sqlInt(pp.technicalComplexity ?? pp.technical_complexity ?? 2)}, ${sqlInt(pp.impactLevel ?? pp.impact_level ?? 1)}, ${sqlStr(pp.intensityCeiling ?? pp.intensity_ceiling ?? 'moderate')})`
}).join(',\n')
seedSql += `
) AS m(slug, phase_key, slot, fit_weight, role, freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling)
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
  return `  (${sqlStr(card.slug)}, ${sqlStr(d.volumeUnit ?? d.volume_unit ?? 'reps')}, ${sqlInt(d.defaultSets ?? d.default_sets ?? 2)}, ${sqlInt(d.defaultReps ?? d.default_reps)}, ${sqlInt(d.defaultWorkSeconds ?? d.default_work_seconds)}, ${sqlInt(d.defaultRestSeconds ?? d.default_rest_seconds ?? 30)}, ${d.defaultDistance != null ? sqlStr(String(d.defaultDistance)) : 'NULL'}, ${sqlInt(d.estSecondsPerSet ?? d.est_seconds_per_set ?? 40)}, ${sqlInt(d.defaultRpeMin ?? d.default_rpe_min ?? 3)}, ${sqlInt(d.defaultRpeMax ?? d.default_rpe_max ?? 6)})`
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
seedSql += CARDS.map((card) => {
  const s = card.safety ?? {}
  return `  (${sqlStr(card.slug)}, ${sqlInt(s.riskLevel ?? s.risk_level ?? 1)}, ${sqlInt(s.impactLevel ?? s.impact_level ?? 1)}, ${sqlBool(s.requiresSpotting ?? s.requires_spotting)}, ${sqlStr(coachSupervision(s.requiresCoachSupervision ?? s.requires_coach_supervision))}, ${sqlTextArray(s.readinessChecks ?? s.readiness_checks)}, ${sqlTextArray(s.contraindications)}, ${sqlTextArray(s.commonSubstitutions ?? s.common_substitutions)})`
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
  return `  (${sqlStr(card.slug)}, ${sqlBool(r.canBeDaily ?? r.can_be_daily)}, ${sqlInt(r.weeklyMaxFrequency ?? r.weekly_max_frequency ?? 4)}, ${sqlInt(r.minimumHoursBetweenHardExposures ?? r.minimum_hours_between_hard_exposures ?? 0)}, ${sqlBool(r.countsAsHighIntensity ?? r.counts_as_high_intensity)}, ${sqlBool(r.countsAsHighImpact ?? r.counts_as_high_impact)}, ${sqlBool(r.countsAsNeural ?? r.counts_as_neural)}, ${sqlBool(r.countsAsTissueStress ?? r.counts_as_tissue_stress)}, ${sqlBool(r.countsAsConditioning ?? r.counts_as_conditioning)})`
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
  seedSql += CARDS.map((card) => {
    const guidance = card.scaling?.[ck] ?? card.scaling?.adult_beginner ?? 'Scale by amplitude, approach speed, and landing quality before adding distance or load.'
    return `  (${sqlStr(card.slug)}, ${sqlStr(guidance)}, ${sqlStr(genderNotes(card))})`
  }).join(',\n')
  seedSql += `
) AS v(slug, guidance, gender_notes)
JOIN coaching.exercise e ON e.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM coaching.exercise_scaling_profile sp
  WHERE sp.exercise_id = e.id AND sp.cohort_key = '${ck}'
);

`
}

// ── 183: full hydration ──────────────────────────────────────────────────────

let hydrateSql = `-- Top 50 Jumping Athletes for Distance — full card v2 hydration.
-- IDEMPOTENT. Generated by scripts/generate-182-jumping-distance.mjs

`

for (const card of CARDS) {
  const pp = primaryPhaseProfile(card)
  const d = card.dosage ?? {}
  const s = card.safety ?? {}
  const r = card.regimen ?? {}
  const pairing = pairingLogic(card)
  const media = {
    demo_video_sources: [],
    coaching_articles: [],
    clinical_or_sport_science_references: card.mediaReferences ?? [],
    internal_notes: card.mediaInternalNotes ?? [],
  }
  const sessionVolMin = d.sessionVolumeMin ?? d.session_volume_min
  const sessionVolMax = d.sessionVolumeMax ?? d.session_volume_max
  const defaultDistance = d.defaultDistance ?? d.default_distance

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
  default_sets = ${sqlInt(d.defaultSets ?? d.default_sets ?? 2)},
  default_reps = ${sqlInt(d.defaultReps ?? d.default_reps)},
  default_work_seconds = ${sqlInt(d.defaultWorkSeconds ?? d.default_work_seconds)},
  default_rest_seconds = ${sqlInt(d.defaultRestSeconds ?? d.default_rest_seconds ?? 30)},
  est_seconds_per_set = ${sqlInt(d.estSecondsPerSet ?? d.est_seconds_per_set ?? 40)},
  movement_requirements = ${movementRequirementsJson(card)},
  coaching_execution = ${jsonb(seedExec(card))},
  pairing_logic = ${jsonb(pairing)},
  media_library = ${jsonb(media)},
  updated_at = now()
WHERE slug = ${sqlStr(card.slug)};

UPDATE coaching.exercise_phase_profile p SET
  role = ${sqlStr(pp.role ?? 'primary')},
  order_slot = ${sqlStr(card.slot)},
  order_index = pos.order_index,
  fit_weight = ${sqlInt(pp.fitWeight ?? pp.fit_weight ?? 5)},
  freshness_required = ${sqlBool(pp.freshnessRequired ?? pp.freshness_required)},
  fatigue_sensitivity = ${sqlInt(pp.fatigueSensitivity ?? pp.fatigue_sensitivity ?? 2)},
  fatigue_cost = ${sqlInt(pp.fatigueCost ?? pp.fatigue_cost ?? 2)},
  technical_complexity = ${sqlInt(pp.technicalComplexity ?? pp.technical_complexity ?? 2)},
  impact_level = ${sqlInt(pp.impactLevel ?? pp.impact_level ?? 1)},
  intensity_ceiling = ${sqlStr(pp.intensityCeiling ?? pp.intensity_ceiling ?? 'moderate')},
  notes = ${sqlStr(pp.notes ?? null)}
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = ${sqlStr(card.primaryPhaseKey)}
JOIN coaching.phase_order_slot pos ON pos.key = ${sqlStr(card.slot)} AND pos.phase_id = sp.id
WHERE p.exercise_id = e.id AND p.phase_id = sp.id AND e.slug = ${sqlStr(card.slug)};

UPDATE coaching.exercise_dosage_profile d SET
  volume_unit = ${sqlStr(d.volumeUnit ?? d.volume_unit ?? 'reps')},
  default_sets = ${sqlInt(d.defaultSets ?? d.default_sets ?? 2)},
  default_reps = ${sqlInt(d.defaultReps ?? d.default_reps)},
  default_distance = ${defaultDistance != null ? sqlStr(String(defaultDistance)) : 'NULL'},
  default_work_seconds = ${sqlInt(d.defaultWorkSeconds ?? d.default_work_seconds)},
  default_rest_seconds = ${sqlInt(d.defaultRestSeconds ?? d.default_rest_seconds ?? 30)},
  est_seconds_per_set = ${sqlInt(d.estSecondsPerSet ?? d.est_seconds_per_set ?? 40)},
  default_rpe_min = ${sqlInt(d.defaultRpeMin ?? d.default_rpe_min ?? 3)},
  default_rpe_max = ${sqlInt(d.defaultRpeMax ?? d.default_rpe_max ?? 6)},
  session_volume_min = ${sessionVolMin != null ? sqlStr(String(sessionVolMin)) : 'NULL'},
  session_volume_max = ${sessionVolMax != null ? sqlStr(String(sessionVolMax)) : 'NULL'}
FROM coaching.exercise e
WHERE d.exercise_id = e.id AND d.profile_name = 'Default' AND e.slug = ${sqlStr(card.slug)};

UPDATE coaching.exercise_regimen_rule r SET
  can_be_daily = ${sqlBool(r.canBeDaily ?? r.can_be_daily)},
  weekly_max_frequency = ${sqlInt(r.weeklyMaxFrequency ?? r.weekly_max_frequency ?? 4)},
  minimum_hours_between_hard_exposures = ${sqlInt(r.minimumHoursBetweenHardExposures ?? r.minimum_hours_between_hard_exposures ?? 0)},
  counts_as_high_intensity = ${sqlBool(r.countsAsHighIntensity ?? r.counts_as_high_intensity)},
  counts_as_high_impact = ${sqlBool(r.countsAsHighImpact ?? r.counts_as_high_impact)},
  counts_as_neural = ${sqlBool(r.countsAsNeural ?? r.counts_as_neural)},
  counts_as_tissue_stress = ${sqlBool(r.countsAsTissueStress ?? r.counts_as_tissue_stress)},
  counts_as_conditioning = ${sqlBool(r.countsAsConditioning ?? r.counts_as_conditioning)}
FROM coaching.exercise e
WHERE r.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

UPDATE coaching.exercise_safety_profile s SET
  risk_level = ${sqlInt(s.riskLevel ?? s.risk_level ?? 1)},
  impact_level = ${sqlInt(s.impactLevel ?? s.impact_level ?? 1)},
  requires_spotting = ${sqlBool(s.requiresSpotting ?? s.requires_spotting)},
  requires_coach_supervision = ${sqlStr(coachSupervision(s.requiresCoachSupervision ?? s.requires_coach_supervision))},
  readiness_checks = ${sqlTextArray(s.readinessChecks ?? s.readiness_checks)},
  contraindications = ${sqlTextArray(s.contraindications)},
  common_substitutions = ${sqlTextArray(s.commonSubstitutions ?? s.common_substitutions)}
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

for (const facet of ['tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region']) {
  const table = FACET_TABLE[facet === 'body_region' ? 'body_regions' : facet]
  const rows = tagRows(facet)
  if (rows.length === 0) continue
  hydrateSql += `INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, '${facet}', f.id, v.weight
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
  hydrateSql += CARDS.map((card) => {
    const guidance = card.scaling?.[ck] ?? card.scaling?.adult_beginner ?? 'Scale by amplitude, approach speed, and landing quality before adding distance or load.'
    return `  (${sqlStr(card.slug)}, ${sqlStr(guidance)}, ${sqlStr(genderNotes(card))})`
  }).join(',\n')
  hydrateSql += `
) AS v(slug, guidance, gender_notes)
JOIN coaching.exercise e ON e.slug = v.slug
WHERE sp.exercise_id = e.id AND sp.cohort_key = '${ck}';

INSERT INTO coaching.exercise_scaling_profile (exercise_id, cohort_key, label, scale_direction, load_guidance, gender_specific_notes)
SELECT e.id, '${ck}', '${ck.replace(/_/g, ' ')}', 'baseline', v.guidance,
  CASE WHEN '${ck}' = 'adult_beginner' THEN v.gender_notes ELSE NULL END
FROM (VALUES\n`
  hydrateSql += CARDS.map((card) => {
    const guidance = card.scaling?.[ck] ?? card.scaling?.adult_beginner ?? 'Scale by amplitude, approach speed, and landing quality before adding distance or load.'
    return `  (${sqlStr(card.slug)}, ${sqlStr(guidance)}, ${sqlStr(genderNotes(card))})`
  }).join(',\n')
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
  'Develops horizontal projection, approach rhythm, elastic stiffness, and landing tolerance for distance jumping.',
  v.why_here,
  v.best_placement,
  v.misuse,
  v.scale_guidance
FROM (VALUES\n`
hydrateSql += CARDS.map((c) =>
  `  (${sqlStr(c.slug)}, ${sqlStr(c.whyItWorks)}, ${sqlStr(c.whyItGoesHere)}, ${sqlStr(c.bestPlacement)}, ${sqlStr(c.commonMisuse)}, ${sqlStr(c.scaling?.adult_beginner ?? '')})`,
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

-- Distance-jump cluster validation education
INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_matters, programming_guidance, common_misuse
)
VALUES (
  'validation_rule',
  'jumping_distance_readiness',
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

const seedPath = path.join(__dirname, '../backend/migrations/184_coaching_jumping_distance_infrastructure_and_seed.sql')
const hydratePath = path.join(__dirname, '../backend/migrations/185_coaching_jumping_distance_cards.sql')
fs.writeFileSync(seedPath, seedSql)
fs.writeFileSync(hydratePath, hydrateSql)
console.log('Wrote', seedPath)
console.log('Wrote', hydratePath, '—', CARDS.length, 'distance-jump cards')
console.log('Slug conflicts prefixed with distance-jump-:', SLUG_CONFLICTS.size)
