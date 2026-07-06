/**
 * Ingest kicking-athletes exercise cards from source files into repo JSON.
 *
 * Run: node scripts/ingest-kicking-athletes-sources.mjs
 * Optional env:
 *   KICKING_JSON=/path/to/kicking_athletes_exercise_cards_all_50.json
 *   KICKING_MD=/path/to/kicking_athletes_exercise_cards_all_50.md
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME ?? ''
const MIG_DIR = path.join(__dirname, '../backend/migrations')

const KICKING_JSON = process.env.KICKING_JSON
  ?? path.join(HOME, 'Downloads/kicking_athletes_exercise_cards_all_50.json')
const KICKING_MD = process.env.KICKING_MD
  ?? path.join(HOME, 'Downloads/kicking_athletes_exercise_cards_all_50.md')

const OUT_JSON = path.join(__dirname, 'data/kicking-athletes-all-cards.json')
const OUT_MD = path.join(__dirname, 'data/kicking-athletes-all-cards.md')

const RISK_MAP = {
  low: 1,
  moderate: 2,
  medium: 2,
  high: 3,
  very_high: 4,
  extreme: 5,
}

const SUBROLE_MAP = {
  reactive_agility_output: 'reactive_agility_tumbling_output',
  coordinate: 'balance_coordination_rhythm',
  frontal_plane_lower_body_strength: 'squat_knee_dominant_strength',
  hip_flexor_strength: 'tissue_capacity_isometric_eccentric_accessory',
  locomotive_force_capacity: 'squat_knee_dominant_strength',
}

const METHODOLOGY_MAP = {
  medicine_ball: null,
  reactive_agility: 'neural',
  breathing_downshift: 'mobility_flexibility',
  resistance_training: 'resistance_calisthenics',
}

const PHYSIOLOGY_MAP = {
  recovery_downregulation: 'recovery_downregulation',
}

const PATTERN_MAP = {
  lunge: 'squat',
}

const EQUIPMENT_MAP = {
  dumbbells: 'dumbbell',
  cable: 'cable',
}

const REQUIRED_FIELDS = [
  'slug', 'name', 'family', 'primaryPhaseKey', 'subrole', 'slot',
  'cardSummary', 'description', 'coachLanguage', 'athleteLanguage',
  'movementRequirements', 'coachingExecution', 'dosage', 'scaling', 'safety', 'regimen', 'phaseProfile',
]

function detectExistingSlugs(cards) {
  const files = fs.readdirSync(MIG_DIR)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('196_') && !f.startsWith('197_'))
  const content = files.map((f) => fs.readFileSync(path.join(MIG_DIR, f), 'utf8')).join('\n')
  const existing = new Set()
  for (const card of cards) {
    if (content.includes(`'${card.slug}'`) || content.includes(`slug = '${card.slug}'`)) {
      existing.add(card.slug)
    }
  }
  return existing
}

function mapTags(tags, keyMap) {
  const out = []
  const seen = new Set()
  for (const t of tags ?? []) {
    const mapped = keyMap[t.key]
    if (mapped === null) continue
    const key = mapped ?? t.key
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ key, weight: t.weight })
  }
  return out
}

function normalizeScalingBlock(scaling) {
  const out = {}
  for (const [ck, val] of Object.entries(scaling ?? {})) {
    if (typeof val === 'string') {
      out[ck] = val
      continue
    }
    const load = val.loadGuidance ?? val.load_guidance ?? ''
    const dose = val.doseGuidance ?? val.dose_guidance ?? ''
    out[ck] = [load, dose].filter(Boolean).join(' ')
  }
  return out
}

function normalizeSafety(safety, phaseProfile) {
  const s = safety ?? {}
  const riskRaw = s.risk_level ?? s.riskLevel ?? 'low'
  const risk_level = typeof riskRaw === 'number'
    ? riskRaw
    : (RISK_MAP[String(riskRaw).toLowerCase()] ?? 1)
  return {
    risk_level,
    impact_level: s.impact_level ?? s.impactLevel ?? phaseProfile?.impactLevel ?? phaseProfile?.impact_level ?? 0,
    requires_spotting: s.requires_spotting ?? s.requiresSpotting ?? false,
    requires_coach_supervision: s.requires_coach_supervision ?? s.requiresCoachSupervision ?? 'optional',
    readiness_checks: s.readiness_checks ?? s.readinessChecks ?? [],
    contraindications: s.contraindications ?? [],
    common_substitutions: s.common_substitutions ?? s.commonSubstitutions ?? s.regressionPriority ?? [],
    common_risks: s.commonRisks ?? s.common_risks ?? [],
  }
}

function normalizeDosage(dosage) {
  const d = dosage ?? {}
  const repsRaw = d.default_reps ?? d.defaultReps
  let default_reps = null
  let rep_note = null
  if (typeof repsRaw === 'number') {
    default_reps = repsRaw
  } else if (typeof repsRaw === 'string') {
    const m = repsRaw.match(/\d+/)
    default_reps = m ? parseInt(m[0], 10) : null
    rep_note = repsRaw
  }
  const notes = [d.notes, rep_note].filter(Boolean).join(' — ') || null
  return {
    volume_unit: d.volume_unit ?? d.volumeUnit ?? 'reps',
    default_sets: d.default_sets ?? d.defaultSets ?? 2,
    default_reps,
    default_work_seconds: d.default_work_seconds ?? d.defaultWorkSeconds ?? null,
    default_rest_seconds: d.default_rest_seconds ?? d.defaultRestSeconds ?? 30,
    default_distance: d.default_distance ?? d.defaultDistance ?? null,
    est_seconds_per_set: d.est_seconds_per_set ?? d.estSecondsPerSet ?? 40,
    default_rpe_min: d.default_rpe_min ?? d.defaultRpeMin ?? 3,
    default_rpe_max: d.default_rpe_max ?? d.defaultRpeMax ?? 6,
    notes,
  }
}

function normalizePhaseProfile(pp, card) {
  const p = pp ?? {}
  return {
    role: p.role ?? 'primary',
    primaryPhaseKey: p.primaryPhaseKey ?? card.primaryPhaseKey,
    fit_weight: p.fit_weight ?? p.fitWeight ?? 5,
    orderSlot: p.orderSlot ?? card.slot,
    freshness_required: p.freshness_required ?? p.freshnessRequired ?? false,
    fatigue_cost: p.fatigue_cost ?? p.fatigueCost ?? 2,
    fatigue_sensitivity: p.fatigue_sensitivity ?? p.fatigueSensitivity ?? 2,
    technical_complexity: p.technical_complexity ?? p.technicalComplexity ?? 2,
    impact_level: p.impact_level ?? p.impactLevel ?? 0,
    intensity_ceiling: p.intensity_ceiling ?? p.intensityCeiling ?? 'moderate',
    notes: p.notes ?? null,
  }
}

function normalizePairing(card) {
  const p = card.pairingLogic ?? {}
  return {
    pairs_well_before: p.pairs_well_before ?? p.pairsWellBefore ?? [],
    pairs_well_after: p.pairs_well_after ?? p.pairsWellAfter ?? [],
    good_for_sessions: p.good_for_sessions ?? p.goodForSessions ?? card.regimen?.sessionNeedKeys ?? [],
    avoid_before: p.avoid_before ?? p.avoidBefore ?? [],
    avoid_after: p.avoid_after ?? p.avoidPairingWith ?? p.avoidPairingWith ?? [],
    do_not_use_when: p.do_not_use_when ?? p.doNotUseWhen ?? [],
    coach_note: p.coach_note ?? p.coachNote ?? null,
  }
}

function normalizeMovementRequirements(req) {
  const r = req ?? {}
  return {
    primary_joint_actions: r.primary_joint_actions ?? r.primaryJointActions ?? [],
    primary_tissues: r.primary_tissues ?? r.primaryTissues ?? [],
    primary_motor_control_demands: r.primary_motor_control_demands ?? r.primaryMotorControlDemands ?? [],
    postural_shape: r.postural_shape ?? r.posturalShape ?? null,
    breathing_demand: r.breathing_demand ?? r.breathingDemand ?? null,
    balance_demand: r.balance_demand ?? r.balanceDemand ?? null,
    coordination_demand: r.coordination_demand ?? r.coordinationDemand ?? null,
    impact_level: r.impact_level ?? r.impactLevel ?? 0,
    space_needed: r.space_needed ?? r.spaceNeeded ?? null,
    sport_carryover: r.sport_carryover ?? r.sportCarryover ?? [],
    kicking_constraints: r.kicking_constraints ?? r.kickingConstraints ?? [],
  }
}

function normalizeCoachingExecution(exec, card) {
  const e = exec ?? {}
  return {
    movement_description: e.movement_description ?? e.movementDescription ?? card.description,
    setup: e.setup ?? [],
    execution_steps: e.execution_steps ?? e.executionSteps ?? [],
    coach_cues: e.coach_cues ?? e.coachCues ?? [],
    common_faults: e.common_faults ?? e.commonFaults ?? [],
    breathing_cues: e.breathing_cues ?? e.breathingCues ?? [],
    quality_gate: e.quality_gate ?? e.qualityGate ?? null,
    stop_signs: e.stop_signs ?? e.stopSigns ?? [],
  }
}

function normalizeRegimen(regimen) {
  const r = regimen ?? {}
  return {
    session_need_keys: r.session_need_keys ?? r.sessionNeedKeys ?? [],
    typical_frequency: r.typical_frequency ?? r.typicalFrequency ?? null,
    can_be_daily: r.can_be_daily ?? r.canBeDaily ?? false,
    counts_as_conditioning: r.counts_as_conditioning ?? r.countsAsConditioning ?? false,
    in_season_note: r.in_season_note ?? r.inSeasonNote ?? null,
    off_season_note: r.off_season_note ?? r.offSeasonNote ?? null,
    weekly_max_frequency: r.weekly_max_frequency ?? r.weeklyMaxFrequency ?? 4,
    minimum_hours_between_hard_exposures: r.minimum_hours_between_hard_exposures ?? r.minimumHoursBetweenHardExposures ?? 0,
    counts_as_high_intensity: r.counts_as_high_intensity ?? r.countsAsHighIntensity ?? false,
    counts_as_high_impact: r.counts_as_high_impact ?? r.countsAsHighImpact ?? false,
    counts_as_neural: r.counts_as_neural ?? r.countsAsNeural ?? false,
    counts_as_tissue_stress: r.counts_as_tissue_stress ?? r.countsAsTissueStress ?? false,
  }
}

function normalizeCard(card, existingSlugs) {
  const slug = existingSlugs.has(card.slug) ? `${card.slug}-kicking` : card.slug
  const subrole = SUBROLE_MAP[card.subrole] ?? card.subrole
  const phaseProfile = normalizePhaseProfile(card.phaseProfile, card)
  return {
    id: card.id,
    slug,
    source_slug: card.slug,
    name: card.name,
    family: card.family,
    category: card.category,
    primaryPhaseKey: card.primaryPhaseKey,
    subrole,
    subrole_secondary: card.subroleSecondary ?? card.subrole_secondary ?? null,
    slot: card.slot,
    cardSummary: card.cardSummary,
    bestPlacement: card.bestPlacement,
    description: card.description,
    coachLanguage: card.coachLanguage,
    athleteLanguage: card.athleteLanguage,
    selectionRationale: card.selectionRationale,
    transferTargets: card.transferTargets ?? [],
    tenets: card.tenets ?? [],
    methodologies: mapTags(card.methodologies, METHODOLOGY_MAP),
    physiology: mapTags(card.physiology, PHYSIOLOGY_MAP),
    patterns: mapTags(card.patterns, PATTERN_MAP),
    equipment: mapTags(card.equipment, EQUIPMENT_MAP),
    body_regions: mapTags(card.body_regions, {}),
    movementRequirements: normalizeMovementRequirements(card.movementRequirements),
    whyItWorks: card.whyItWorks,
    whyItGoesHere: card.whyItGoesHere,
    commonMisuse: card.commonMisuse,
    scalingGuidance: card.scalingGuidance,
    coachingExecution: normalizeCoachingExecution(card.coachingExecution, card),
    dosage: normalizeDosage(card.dosage),
    scaling: normalizeScalingBlock(card.scaling),
    pairingLogic: normalizePairing(card),
    safety: normalizeSafety(card.safety, phaseProfile),
    regimen: normalizeRegimen(card.regimen),
    phaseProfile,
    mediaReferences: card.mediaReferences ?? [],
    mediaInternalNotes: card.mediaInternalNotes ?? [],
  }
}

function parseMdJsonBlock(content) {
  const match = content.match(/```json\n([\s\S]*?)\n```/)
  if (!match) throw new Error('Could not parse JSON block from kicking athletes MD')
  const parsed = JSON.parse(match[1])
  return { cluster: parsed.cluster, cards: parsed.cards ?? parsed }
}

function validateCard(card) {
  for (const f of REQUIRED_FIELDS) {
    if (card[f] == null || (typeof card[f] === 'string' && !card[f].trim())) {
      throw new Error(`Card ${card.slug} missing required field: ${f}`)
    }
  }
  const exec = card.coachingExecution
  if (!exec.setup?.length || !exec.execution_steps?.length) {
    throw new Error(`Card ${card.slug} missing setup or execution_steps in coachingExecution`)
  }
}

function loadSource() {
  if (fs.existsSync(KICKING_JSON)) {
    const raw = JSON.parse(fs.readFileSync(KICKING_JSON, 'utf8'))
    return { cluster: raw.cluster, cards: raw.cards ?? raw }
  }
  if (fs.existsSync(OUT_JSON)) {
    const raw = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'))
    return { cluster: raw.cluster, cards: raw.cards ?? raw }
  }
  if (fs.existsSync(KICKING_MD)) {
    return parseMdJsonBlock(fs.readFileSync(KICKING_MD, 'utf8'))
  }
  throw new Error(`Missing source: ${KICKING_JSON}, ${OUT_JSON}, or ${KICKING_MD}`)
}

function main() {
  const { cluster, cards: rawCards } = loadSource()
  if (rawCards.length !== 50) throw new Error(`Expected 50 cards, got ${rawCards.length}`)

  const existingSlugs = detectExistingSlugs(rawCards)
  const cards = rawCards.map((c) => normalizeCard(c, existingSlugs))
  for (const c of cards) validateCard(c)

  const slugs = cards.map((c) => c.slug)
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
  if (dupes.length) throw new Error(`Duplicate slugs after normalization: ${[...new Set(dupes)].join(', ')}`)

  const output = {
    cluster: cluster ?? {
      title: 'Top 50 Kicking Athletes Exercise Library',
      focus: 'kicking_athletes_kickboxing_mma_soccer',
      card_count: cards.length,
    },
    cards,
    meta: {
      total_cards: cards.length,
      slug_suffixes: cards.filter((c) => c.source_slug !== c.slug).map((c) => c.source_slug),
      generated_at: new Date().toISOString(),
    },
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2))

  let md = '# Top 50 Kicking Athletes Exercise Cards\n\n'
  md += `Generated ${output.meta.generated_at}. Slug suffix \`-kicking\` applied where a global library slug already existed.\n\n`
  if (cluster?.purpose) md += `${cluster.purpose}\n\n`
  for (const c of cards) {
    md += `- **${c.name}** (\`${c.slug}\`) — ${c.primaryPhaseKey} / ${c.subrole}\n`
  }
  fs.writeFileSync(OUT_MD, md)

  console.log('Wrote', OUT_JSON)
  console.log('Wrote', OUT_MD)
  console.log(`Cards: ${cards.length}`)
  if (output.meta.slug_suffixes.length) {
    console.log('Slug suffix applied:', output.meta.slug_suffixes.join(', '))
  }
}

main()
