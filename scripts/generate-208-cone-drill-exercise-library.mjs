/**
 * Generates:
 *   backend/migrations/210_coaching_cone_drill_exercise_library_infrastructure_and_seed.sql
 *   backend/migrations/211_coaching_cone_drill_exercise_library_cards.sql
 *
 * Source: scripts/data/cone-drill-exercise-cards-all-50.json
 * Run: node scripts/generate-208-cone-drill-exercise-library.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(__dirname, 'data/cone-drill-exercise-cards-all-50.json')
const MIG_DIR = path.join(__dirname, '../backend/migrations')

const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))
const CARDS = raw.cards ?? []
const cluster = raw.cluster ?? {}

function detectMergeSlugs(slugs) {
  const exclude = new Set([
    '210_coaching_cone_drill_exercise_library_infrastructure_and_seed.sql',
    '211_coaching_cone_drill_exercise_library_cards.sql',
  ])
  const merge = new Set()
  for (const slug of slugs) {
    for (const file of fs.readdirSync(MIG_DIR)) {
      if (!file.endsWith('.sql') || exclude.has(file)) continue
      const content = fs.readFileSync(path.join(MIG_DIR, file), 'utf8')
      if (content.includes(`'${slug}'`)) {
        merge.add(slug)
        break
      }
    }
  }
  return merge
}

const MERGE_SLUGS = detectMergeSlugs(CARDS.map((c) => c.slug))
const INSERT_CARDS = CARDS.filter((c) => !MERGE_SLUGS.has(c.slug))
const SLUGS = CARDS.map((c) => c.slug)

const PHASE_ORDER_BASE = {
  movement_intelligence: 320,
  output: 780,
  resilience: 530,
  sustained_capacity: 620,
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
  title: 'Cone drill exercise library without conditioning drift or wrong phase intent',
  short_summary:
    'Cone drills must stay quality-first — Movement Intelligence for route learning, Output for fresh high-intent reps, Resilience for braking control, Sustained Capacity only when intentionally placed late for repeatability.',
  what_it_is:
    'Top 50 cone drill library spanning foundational sprint mechanics, deceleration and cut preparation, planned COD patterns, curvilinear control, and reactive agility across Movement Intelligence, Output, Resilience, and Sustained Capacity.',
  why_it_matters:
    'The same cone layout can train different qualities depending on speed, spacing, rest, and coaching intent. Misplaced fatigue or wrong-phase dosing turns skill drills into junk volume.',
  programming_guidance:
    'After Prepare & Access and before Output when fresh. Slow down for Movement Intelligence; use full rest for Output COD; emphasize stick quality for Resilience; reserve reactive and repeatability work for late session only when appropriate.',
  common_misuse:
    'Do not race drills before the athlete owns the route, chase times over posture, extend sets after braking quality fades, or use reactive partner games without defined boundaries and roles.',
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

function normalizeSupervision(val) {
  if (val === 'optional') return 'recommended'
  return val ?? 'recommended'
}

function participantStructure(card) {
  return card.participantStructure ?? 'individual'
}

function normalizeMovementRequirements(card) {
  const req = card.movementRequirements ?? {}
  const pp = card.phaseProfile ?? {}
  const safety = card.safety ?? {}
  return {
    primary_joint_actions: req.primaryJointActions ?? req.primary_joint_actions ?? [],
    primary_tissues: req.primaryTissues ?? req.primary_tissues ?? [],
    primary_motor_control_demands: req.primaryMotorControlDemands ?? req.primary_motor_control_demands ?? [],
    postural_shape: req.posturalShape ?? req.postural_shape ?? null,
    breathing_demand: req.breathingDemand ?? req.breathing_demand ?? null,
    balance_demand: req.balanceDemand ?? req.balance_demand ?? null,
    coordination_demand: req.coordinationDemand ?? req.coordination_demand ?? null,
    impact_level: req.impactLevel ?? req.impact_level ?? pp.impactLevel ?? pp.impact_level ?? safety.impactLevel ?? safety.impact_level ?? 0,
  }
}

function normalizeCoachingExecution(card) {
  const exec = card.coachingExecution ?? {}
  return {
    movement_description: exec.movementDescription ?? exec.movement_description ?? card.description,
    setup: exec.setup ?? [],
    execution_steps: exec.executionSteps ?? exec.execution_steps ?? [],
    coach_cues: exec.coachCues ?? exec.coach_cues ?? [],
    athlete_cues: exec.athleteCues ?? exec.athlete_cues ?? [],
    breathing_cues: exec.breathingCues ?? exec.breathing_cues ?? [],
    common_faults: exec.commonFaults ?? exec.common_faults ?? [],
    quality_gate: exec.qualityGates ?? exec.quality_gate ?? [],
    stop_signs: exec.stopSigns ?? exec.stop_signs ?? [],
  }
}

function pairingLogic(card) {
  const p = card.pairingLogic ?? {}
  return {
    pairs_well_before: p.pairsWellBefore ?? p.pairs_well_before ?? card.pairsWellBefore ?? [],
    pairs_well_after: p.pairsWellAfter ?? p.pairs_well_after ?? card.pairsWellAfter ?? [],
    good_for_sessions: p.goodForSessions ?? p.good_for_sessions ?? card.goodForSessions ?? [],
    avoid_before: p.avoidBefore ?? p.avoid_before ?? [],
    avoid_after: p.avoidAfter ?? p.avoid_after ?? [],
    do_not_use_when: p.doNotUseWhen ?? p.do_not_use_when ?? card.doNotUseWhen ?? [],
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
    ?? 'Scale cone spacing, approach speed, cut angle, and decision complexity before adding volume.'
}

function slotName(slot) {
  return slot.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function slotRows() {
  const seen = new Map()
  const phaseCounters = {}
  for (const card of CARDS) {
    const key = `${card.primaryPhaseKey}|${card.slot}`
    if (!seen.has(key)) {
      const base = PHASE_ORDER_BASE[card.primaryPhaseKey] ?? 850
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

function skillForCard(card) {
  const risk = card.safety?.riskLevel ?? card.safety?.risk_level ?? 2
  if (risk >= 4) return 'ADVANCED'
  if (risk >= 3) return 'INTERMEDIATE'
  return 'BEGINNER'
}

function defaultIntensityCeiling(card) {
  return card.phaseProfile?.intensityCeiling ?? card.phaseProfile?.intensity_ceiling
    ?? (card.primaryPhaseKey === 'resilience' ? 'moderate' : 'high')
}

function parseDosage(card) {
  const d = card.dosage ?? {}
  return {
    volume_unit: d.volumeUnit ?? d.volume_unit ?? 'reps',
    default_sets: d.defaultSets ?? d.default_sets ?? 3,
    default_reps: d.defaultReps ?? d.default_reps ?? null,
    default_work_seconds: d.defaultWorkSeconds ?? d.default_work_seconds ?? null,
    default_rest_seconds: d.defaultRestSeconds ?? d.default_rest_seconds ?? 75,
    est_seconds_per_set: d.estSecondsPerSet ?? d.est_seconds_per_set ?? 30,
    default_rpe_min: d.defaultRpeMin ?? d.default_rpe_min ?? 6,
    default_rpe_max: d.defaultRpeMax ?? d.default_rpe_max ?? 8,
  }
}

function normalizeRegimen(card) {
  const r = card.regimen ?? {}
  return {
    can_be_daily: r.canBeDaily ?? r.can_be_daily ?? false,
    weekly_max_frequency: r.weeklyMaxFrequency ?? r.weekly_max_frequency ?? 3,
    minimum_hours_between_hard_exposures: r.minimumHoursBetweenHardExposures ?? r.minimum_hours_between_hard_exposures ?? 36,
    counts_as_high_intensity: r.countsAsHighIntensity ?? r.counts_as_high_intensity ?? false,
    counts_as_high_impact: r.countsAsHighImpact ?? r.counts_as_high_impact ?? false,
    counts_as_neural: r.countsAsNeural ?? r.counts_as_neural ?? false,
    counts_as_tissue_stress: r.countsAsTissueStress ?? r.counts_as_tissue_stress ?? false,
    counts_as_conditioning: r.countsAsConditioning ?? r.counts_as_conditioning ?? false,
  }
}

function normalizeSafety(card) {
  const s = card.safety ?? {}
  return {
    risk_level: s.riskLevel ?? s.risk_level ?? 2,
    impact_level: s.impactLevel ?? s.impact_level ?? 0,
    requires_spotting: s.requiresSpotting ?? s.requires_spotting ?? false,
    requires_coach_supervision: normalizeSupervision(s.requiresCoachSupervision ?? s.requires_coach_supervision),
    readiness_checks: s.readinessChecks ?? s.readiness_checks ?? [],
    contraindications: s.contraindications ?? [],
    common_substitutions: s.commonSubstitutions ?? s.common_substitutions ?? [],
  }
}

function normalizePhaseProfile(card) {
  const pp = card.phaseProfile ?? {}
  return {
    role: pp.role ?? 'primary',
    fit_weight: pp.fitWeight ?? pp.fit_weight ?? 5,
    freshness_required: pp.freshnessRequired ?? pp.freshness_required ?? false,
    fatigue_sensitivity: pp.fatigueSensitivity ?? pp.fatigue_sensitivity ?? 3,
    fatigue_cost: pp.fatigueCost ?? pp.fatigue_cost ?? 3,
    technical_complexity: pp.technicalComplexity ?? pp.technical_complexity ?? 3,
    impact_level: pp.impactLevel ?? pp.impact_level ?? 0,
    intensity_ceiling: defaultIntensityCeiling(card),
  }
}

function normalizeDifficulty(card) {
  const d = card.difficultyProfile ?? {}
  const technical = d.technical ?? 3
  const load = d.load ?? 2
  const complexity = d.complexity ?? 3
  const overall = d.overall ?? Math.max(technical, load, complexity)
  return {
    technical,
    load,
    complexity,
    overall,
    recommended_age_min: d.recommendedAgeMin ?? d.recommended_age_min ?? 6,
    recommended_age_max: d.recommendedAgeMax ?? d.recommended_age_max ?? null,
    attention_demand: d.attentionDemand ?? d.attention_demand ?? 'moderate',
    notes: d.notes ?? null,
  }
}

function movementRequirementsJson(card) {
  return jsonb(normalizeMovementRequirements(card))
}

// ── 210: infrastructure + seed ─────────────────────────────────────────────

let seedSql = `-- Cone drill exercise library infrastructure, taxonomy, and ${INSERT_CARDS.length}-card seed.
-- IDEMPOTENT. Generated by scripts/generate-208-cone-drill-exercise-library.mjs (migrations 210/211)
-- ${CARDS.length} total cards (${INSERT_CARDS.length} insert, ${MERGE_SLUGS.size} merge).
-- Library: ${cluster.topic ?? 'best_cone_drill_exercises'} (${cluster.card_count ?? CARDS.length} cards)

`

const slots = slotRows()
for (const phase of [...new Set(slots.map((s) => s.phase))]) {
  const phaseSlots = slots.filter((s) => s.phase === phase)
  seedSql += `-- ${phase} cone drill slots\n`
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
  seedSql += `-- Insert ${INSERT_CARDS.length} cone drill exercises\n`
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
    const skill = skillForCard(card)
    const diff = normalizeDifficulty(card)
    return `  (${sqlStr(card.name)}, ${sqlStr(card.slug)}, ${sqlStr(card.description)}, ${sqlStr(skill)}, ${sqlInt(diff.recommended_age_min ?? 8)}, ${sqlInt(d.default_sets)}, ${sqlInt(d.default_reps)}, ${sqlInt(d.default_work_seconds)}, ${sqlInt(d.default_rest_seconds)}, ${sqlInt(d.est_seconds_per_set)}, ${sqlStr(participantStructure(card))}, ${sqlStr(card.cardSummary)}, ${sqlStr(card.coachLanguage)}, ${sqlStr(card.athleteLanguage)}, ${sqlStr(card.family)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(card.subrole)}, ${sqlStr(card.slot)}, ${jsonb(normalizeMovementRequirements(card)).replace('::jsonb', '')}::jsonb, ${jsonb(normalizeCoachingExecution(card)).replace('::jsonb', '')}::jsonb)`
  }).join(',\n')

  seedSql += `
) AS d(name, slug, description, skill, age_min, sets, reps, work, rest, est, participant, summary, coach_lang, athlete_lang, family, phase_key, subrole, slot, req, exec)
CROSS JOIN public.facility f
ON CONFLICT (facility_id, slug) DO NOTHING;

`
}

function skeletonTagsFor(cards) {
  for (const facet of ['tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region']) {
    const table = FACET_TABLE[facet === 'body_region' ? 'body_regions' : facet]
    const field = facet === 'body_region' ? 'body_regions' : FACET_TAG_FIELD[facet]
    const facetType = facet
    const rows = []
    for (const card of cards) {
      const tags = card[field] ?? []
      for (const t of tags) {
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
}

if (INSERT_CARDS.length > 0) skeletonTagsFor(INSERT_CARDS)

if (INSERT_CARDS.length > 0) {
  seedSql += `INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, COALESCE(m.fit_weight, 5), COALESCE(m.role, 'primary'), m.slot, pos.order_index,
  COALESCE(m.freshness_required, FALSE), COALESCE(m.fatigue_sensitivity, 3), COALESCE(m.fatigue_cost, 3),
  COALESCE(m.technical_complexity, 3), COALESCE(m.impact_level, 0), COALESCE(m.intensity_ceiling, 'high')
FROM (VALUES\n`
  seedSql += INSERT_CARDS.map((card) => {
    const pp = normalizePhaseProfile(card)
    return `  (${sqlStr(card.slug)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(card.slot)}, ${sqlStr(pp.role)}, ${sqlInt(pp.fit_weight)}, ${sqlBool(pp.freshness_required)}, ${sqlInt(pp.fatigue_sensitivity)}, ${sqlInt(pp.fatigue_cost)}, ${sqlInt(pp.technical_complexity)}, ${sqlInt(pp.impact_level)}, ${sqlStr(pp.intensity_ceiling)})`
  }).join(',\n')
  seedSql += `
) AS m(slug, phase_key, slot, role, fit_weight, freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling)
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
    return `  (${sqlStr(card.slug)}, ${sqlStr(d.volume_unit)}, ${sqlInt(d.default_sets)}, ${sqlInt(d.default_reps)}, ${sqlInt(d.default_work_seconds)}, ${sqlInt(d.default_rest_seconds)}, NULL::integer, ${sqlInt(d.est_seconds_per_set)}, ${sqlInt(d.default_rpe_min)}, ${sqlInt(d.default_rpe_max)})`
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
SELECT e.id, COALESCE(m.risk_level, 2), COALESCE(m.impact_level, 0), COALESCE(m.requires_spotting, FALSE),
  COALESCE(m.requires_coach_supervision, 'recommended'),
  COALESCE(m.readiness_checks, ARRAY[]::text[]),
  COALESCE(m.contraindications, ARRAY[]::text[]),
  COALESCE(m.common_substitutions, ARRAY[]::text[])
FROM (VALUES\n`
  seedSql += INSERT_CARDS.map((card) => {
    const s = normalizeSafety(card)
    return `  (${sqlStr(card.slug)}, ${sqlInt(s.risk_level)}, ${sqlInt(s.impact_level)}, ${sqlBool(s.requires_spotting)}, ${sqlStr(s.requires_coach_supervision)}, ${sqlTextArray(s.readiness_checks)}, ${sqlTextArray(s.contraindications)}, ${sqlTextArray(s.common_substitutions)})`
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
  COALESCE(m.weekly_max_frequency, 3),
  COALESCE(m.minimum_hours_between_hard_exposures, 36),
  COALESCE(m.counts_as_high_intensity, FALSE),
  COALESCE(m.counts_as_high_impact, FALSE),
  COALESCE(m.counts_as_neural, FALSE),
  COALESCE(m.counts_as_tissue_stress, FALSE),
  COALESCE(m.counts_as_conditioning, FALSE)
FROM (VALUES\n`
  seedSql += INSERT_CARDS.map((card) => {
    const r = normalizeRegimen(card)
    return `  (${sqlStr(card.slug)}, ${sqlBool(r.can_be_daily)}, ${sqlInt(r.weekly_max_frequency)}, ${sqlInt(r.minimum_hours_between_hard_exposures)}, ${sqlBool(r.counts_as_high_intensity)}, ${sqlBool(r.counts_as_high_impact)}, ${sqlBool(r.counts_as_neural)}, ${sqlBool(r.counts_as_tissue_stress)}, ${sqlBool(r.counts_as_conditioning)})`
  }).join(',\n')
  seedSql += `
) AS m(slug, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures, counts_as_high_intensity, counts_as_high_impact, counts_as_neural, counts_as_tissue_stress, counts_as_conditioning)
JOIN coaching.exercise e ON e.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_regimen_rule r WHERE r.exercise_id = e.id);

`

  seedSql += `INSERT INTO coaching.exercise_difficulty_profile (
  exercise_id, technical, load, complexity, overall,
  recommended_age_min, recommended_age_max, attention_demand, notes, source
)
SELECT e.id, m.technical, m.load, m.complexity, m.overall,
  m.age_min, NULL::integer, m.attention, m.notes, 'authored'
FROM (VALUES\n`
  seedSql += INSERT_CARDS.map((card) => {
    const diff = normalizeDifficulty(card)
    return `  (${sqlStr(card.slug)}, ${sqlInt(diff.technical)}, ${sqlInt(diff.load)}, ${sqlInt(diff.complexity)}, ${sqlInt(diff.overall)}, ${sqlInt(diff.recommended_age_min)}, ${sqlStr(diff.attention_demand)}, ${sqlStr(diff.notes)})`
  }).join(',\n')
  seedSql += `
) AS m(slug, technical, load, complexity, overall, age_min, attention, notes)
JOIN coaching.exercise e ON e.slug = m.slug
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

seedSql += `-- Cone drill library validation education
INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_matters, programming_guidance, common_misuse
)
VALUES (
  'validation_rule',
  'cone_drill_exercise_library_readiness',
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

// ── 211: full hydration ──────────────────────────────────────────────────────

let hydrateSql = `-- Cone drill exercise library ${CARDS.length}-card full hydration (card v2).
-- IDEMPOTENT. Generated by scripts/generate-208-cone-drill-exercise-library.mjs (migrations 210/211)
-- ${INSERT_CARDS.length} insert + ${MERGE_SLUGS.size} merge

`

for (const card of CARDS) {
  const d = parseDosage(card)
  const pp = normalizePhaseProfile(card)
  const reg = normalizeRegimen(card)
  const saf = normalizeSafety(card)
  const diff = normalizeDifficulty(card)

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
  pairing_logic = ${jsonb(pairingLogic(card))},
  media_library = ${jsonb(mediaLibrary(card))},
  updated_at = now()
WHERE slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, ${sqlInt(pp.fit_weight)}, ${sqlStr(pp.role)}, ${sqlStr(card.slot)}, pos.order_index,
  ${sqlBool(pp.freshness_required)}, ${sqlInt(pp.fatigue_sensitivity)}, ${sqlInt(pp.fatigue_cost)},
  ${sqlInt(pp.technical_complexity)}, ${sqlInt(pp.impact_level)}, ${sqlStr(pp.intensity_ceiling)}
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = ${sqlStr(card.primaryPhaseKey)}
JOIN coaching.phase_order_slot pos ON pos.key = ${sqlStr(card.slot)} AND pos.phase_id = sp.id
WHERE e.slug = ${sqlStr(card.slug)}
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  role = EXCLUDED.role,
  order_slot = EXCLUDED.order_slot,
  order_index = EXCLUDED.order_index,
  fit_weight = EXCLUDED.fit_weight,
  freshness_required = EXCLUDED.freshness_required,
  fatigue_sensitivity = EXCLUDED.fatigue_sensitivity,
  fatigue_cost = EXCLUDED.fatigue_cost,
  technical_complexity = EXCLUDED.technical_complexity,
  impact_level = EXCLUDED.impact_level,
  intensity_ceiling = EXCLUDED.intensity_ceiling;

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
  ${sqlInt(d.default_work_seconds)}, ${sqlInt(d.default_rest_seconds)}, NULL::integer,
  ${sqlInt(d.est_seconds_per_set)}, ${sqlInt(d.default_rpe_min)}, ${sqlInt(d.default_rpe_max)}
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_dosage_profile dp WHERE dp.exercise_id = e.id AND dp.profile_name = 'Default');

UPDATE coaching.exercise_regimen_rule r SET
  can_be_daily = ${sqlBool(reg.can_be_daily)},
  weekly_max_frequency = ${sqlInt(reg.weekly_max_frequency)},
  minimum_hours_between_hard_exposures = ${sqlInt(reg.minimum_hours_between_hard_exposures)},
  counts_as_high_intensity = ${sqlBool(reg.counts_as_high_intensity)},
  counts_as_high_impact = ${sqlBool(reg.counts_as_high_impact)},
  counts_as_neural = ${sqlBool(reg.counts_as_neural)},
  counts_as_tissue_stress = ${sqlBool(reg.counts_as_tissue_stress)},
  counts_as_conditioning = ${sqlBool(reg.counts_as_conditioning)}
FROM coaching.exercise e
WHERE r.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_regimen_rule (
  exercise_id, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures,
  counts_as_high_intensity, counts_as_high_impact, counts_as_neural, counts_as_tissue_stress, counts_as_conditioning
)
SELECT e.id, ${sqlBool(reg.can_be_daily)}, ${sqlInt(reg.weekly_max_frequency)}, ${sqlInt(reg.minimum_hours_between_hard_exposures)},
  ${sqlBool(reg.counts_as_high_intensity)}, ${sqlBool(reg.counts_as_high_impact)}, ${sqlBool(reg.counts_as_neural)},
  ${sqlBool(reg.counts_as_tissue_stress)}, ${sqlBool(reg.counts_as_conditioning)}
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_regimen_rule rr WHERE rr.exercise_id = e.id);

UPDATE coaching.exercise_safety_profile s SET
  risk_level = ${sqlInt(saf.risk_level)},
  impact_level = ${sqlInt(saf.impact_level)},
  requires_spotting = ${sqlBool(saf.requires_spotting)},
  requires_coach_supervision = ${sqlStr(saf.requires_coach_supervision)},
  readiness_checks = ${sqlTextArray(saf.readiness_checks)},
  contraindications = ${sqlTextArray(saf.contraindications)},
  common_substitutions = ${sqlTextArray(saf.common_substitutions)}
FROM coaching.exercise e
WHERE s.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_safety_profile (
  exercise_id, risk_level, impact_level, requires_spotting, requires_coach_supervision,
  readiness_checks, contraindications, common_substitutions
)
SELECT e.id, ${sqlInt(saf.risk_level)}, ${sqlInt(saf.impact_level)}, ${sqlBool(saf.requires_spotting)},
  ${sqlStr(saf.requires_coach_supervision)},
  ${sqlTextArray(saf.readiness_checks)}, ${sqlTextArray(saf.contraindications)}, ${sqlTextArray(saf.common_substitutions)}
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_safety_profile sp WHERE sp.exercise_id = e.id);

INSERT INTO coaching.exercise_difficulty_profile (
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
  'Cone drills build route learning, braking quality, and perception-action skill when dosed for the tagged phase.',
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
`

const seedPath = path.join(MIG_DIR, '210_coaching_cone_drill_exercise_library_infrastructure_and_seed.sql')
const hydratePath = path.join(MIG_DIR, '211_coaching_cone_drill_exercise_library_cards.sql')
fs.writeFileSync(seedPath, seedSql)
fs.writeFileSync(hydratePath, hydrateSql)
console.log('Wrote', seedPath)
console.log('Wrote', hydratePath, '—', CARDS.length, 'cone drill cards (', INSERT_CARDS.length, 'insert,', MERGE_SLUGS.size, 'merge)')
if (MERGE_SLUGS.size) console.log('Merge slugs:', [...MERGE_SLUGS].sort().join(', '))
