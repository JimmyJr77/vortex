import {
  buildCanonicalCardTestPacket,
  findPotentialCanonicalDuplicates,
} from './canonicalCardAuthoring.js'

export const CANONICAL_CARD_AUDIT_VERSION = 'canonical-card-audit-v1'

const asNumber = (value) => Number(value ?? 0)
const asArray = (value) => (Array.isArray(value) ? value : [])
const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

function hasKeys(value) {
  return Object.keys(asObject(value)).length > 0
}

function rowToCard(definition, variants, profilesByVariant) {
  return {
    id: String(definition.id),
    slug: definition.slug,
    canonicalName: definition.canonical_name,
    displayName: definition.display_name,
    description: definition.description,
    aliases: asArray(definition.aliases),
    familyKey: definition.family_key,
    schemaVersion: definition.schema_version,
    cardVersion: asNumber(definition.card_version),
    status: definition.status,
    contentConfidence: definition.content_confidence == null ? null : asNumber(definition.content_confidence),
    scoringConfidence: definition.scoring_confidence == null ? null : asNumber(definition.scoring_confidence),
    mediaConfidence: definition.media_confidence == null ? null : asNumber(definition.media_confidence),
    movementPatterns: asArray(definition.movement_patterns),
    bodyRegions: asArray(definition.body_regions),
    requiredEquipment: asArray(definition.required_equipment),
    optionalEquipment: asArray(definition.optional_equipment),
    environment: asObject(definition.environment_json),
    population: asObject(definition.population_json),
    athleteSupport: asObject(definition.athlete_support_json),
    coachSupport: asObject(definition.coach_support_json),
    supportOperations: asObject(definition.support_operations_json),
    anatomy: asObject(definition.anatomy_json),
    approvedVideoUrl: definition.approved_video_url,
    variants: variants.map((variant) => ({
      id: String(variant.id),
      variantKey: variant.variant_key,
      displayName: variant.display_name,
      modifierKeys: asArray(variant.modifier_keys),
      difficulty: asObject(variant.difficulty_json),
      requirements: asObject(variant.requirements_json),
      programming: asObject(variant.programming_profile_json),
      loadProfile: asObject(variant.load_profile_json),
      fatigueProfile: asObject(variant.fatigue_profile_json),
      status: variant.status,
      profiles: asArray(profilesByVariant.get(String(variant.id))).map((profile) => ({
        id: String(profile.id),
        profileKey: profile.profile_key,
        phaseKey: profile.phase_key,
        role: profile.role,
        purpose: profile.purpose,
        phaseSuitability: asNumber(profile.phase_suitability),
        methodologyAlignment: profile.methodology_alignment == null
          ? null
          : asNumber(profile.methodology_alignment),
        objectiveRelevance: asObject(profile.objective_relevance_json),
        dosage: asObject(profile.dosage_json),
        qualityGate: profile.quality_gate,
        stopRules: asArray(profile.stop_rules),
        coachInstructions: profile.coach_instructions,
        athleteInstructions: profile.athlete_instructions,
        expectedAdaptation: profile.expected_adaptation,
        equipmentRequired: asArray(profile.equipment_required),
        logistics: asObject(profile.logistics_json),
        timeModel: asObject(profile.time_model_json),
        doseScaling: asObject(profile.dose_scaling_json),
        measurement: asObject(profile.measurement_json),
        supportPrompts: asObject(profile.support_prompts_json),
      })),
    })),
  }
}

function additionalChecks({ card, definition, relationships, calibrations }) {
  const anatomy = asObject(card.anatomy)
  const variants = asArray(card.variants)
  const profiles = variants.flatMap((variant) => asArray(variant.profiles))
  const approvedRelationships = relationships.filter((edge) => edge.review_status === 'approved')
  const approvedCalibrations = calibrations.filter((anchor) => anchor.status === 'approved')
  const requiredDifficulty = [
    'technicalComplexity', 'supervisionDemand', 'failureConsequence',
    'impact', 'workCapacityDemand', 'baseOverallDifficulty',
  ]
  const requiredLoad = [
    'gripDemand', 'spinalLoading', 'eccentricStress',
    'landingContactsPerRep', 'externalLoadMethod',
  ]
  const requiredFatigue = [
    'localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity',
    'impactAccumulation', 'recoveryHours',
  ]
  const checks = [
    {
      id: 'CARD-MIGRATION-01',
      category: 'migration',
      priority: 'P0',
      status: definition.legacy_exercise_id == null ? 'failed' : 'passed',
      evidence: { legacyExerciseId: definition.legacy_exercise_id },
      message: 'The canonical card retains a stable link to its legacy source.',
    },
    {
      id: 'CARD-TAXONOMY-02',
      category: 'taxonomy',
      priority: 'P1',
      status: card.movementPatterns.length > 0 && card.bodyRegions.length > 0 ? 'passed' : 'failed',
      evidence: { movementPatterns: card.movementPatterns, bodyRegions: card.bodyRegions },
      message: 'Controlled movement-pattern and body-region taxonomy is populated.',
    },
    {
      id: 'CARD-ANATOMY-02',
      category: 'anatomy',
      priority: 'P1',
      status: asArray(anatomy.primaryMuscles).length > 0
        && asArray(anatomy.joints).length > 0
        && asArray(anatomy.jointActions).length > 0
        && asArray(anatomy.planes).length > 0
        && Boolean(anatomy.laterality) ? 'passed' : 'failed',
      evidence: {
        primaryMuscles: asArray(anatomy.primaryMuscles),
        joints: asArray(anatomy.joints),
        jointActions: asArray(anatomy.jointActions),
        planes: asArray(anatomy.planes),
        laterality: anatomy.laterality ?? null,
      },
      message: 'Muscles, joints, actions, planes, and laterality are explicit.',
    },
    {
      id: 'CARD-DIFFICULTY-01',
      category: 'difficulty',
      priority: 'P1',
      status: variants.length > 0 && variants.every((variant) => (
        requiredDifficulty.every((field) => Number.isInteger(variant.difficulty?.[field]))
      )) ? 'passed' : 'failed',
      evidence: { requiredFields: requiredDifficulty },
      message: 'Every variant has all controlled 1-100 difficulty dimensions.',
    },
    {
      id: 'CARD-LOAD-01',
      category: 'load_profile',
      priority: 'P1',
      status: variants.length > 0 && variants.every((variant) => (
        requiredLoad.every((field) => variant.loadProfile?.[field] != null)
      )) ? 'passed' : 'failed',
      evidence: { requiredFields: requiredLoad },
      message: 'Every variant has a complete loading profile.',
    },
    {
      id: 'CARD-FATIGUE-01',
      category: 'fatigue_recovery',
      priority: 'P1',
      status: variants.length > 0 && variants.every((variant) => (
        requiredFatigue.every((field) => variant.fatigueProfile?.[field] != null)
      )) ? 'passed' : 'failed',
      evidence: { requiredFields: requiredFatigue },
      message: 'Every variant has cumulative fatigue, impact, and recovery data.',
    },
    {
      id: 'CARD-CONSTRAINTS-01',
      category: 'constraints',
      priority: 'P1',
      status: hasKeys(card.environment) && hasKeys(card.population) ? 'passed' : 'failed',
      evidence: { environment: card.environment, population: card.population },
      message: 'Environment and population constraints are explicit.',
    },
    {
      id: 'CARD-DELIVERY-03',
      category: 'delivery_profile',
      priority: 'P1',
      status: profiles.length > 0 && profiles.every((profile) => (
        hasKeys(profile.dosage)
        && Boolean(profile.qualityGate)
        && profile.stopRules.length > 0
        && Boolean(profile.coachInstructions)
        && Boolean(profile.athleteInstructions)
        && Boolean(profile.expectedAdaptation)
      )) ? 'passed' : 'failed',
      evidence: { profileCount: profiles.length },
      message: 'Contextual dosage, instructions, adaptation, quality gates, and stop rules are complete.',
    },
    {
      id: 'CARD-EQUIPMENT-04',
      category: 'equipment',
      priority: 'P0',
      status: profiles.length > 0 && profiles.every((profile) => profile.equipmentRequired.length > 0)
        ? 'passed'
        : 'failed',
      evidence: {
        undeclaredProfiles: profiles
          .filter((profile) => profile.equipmentRequired.length === 0)
          .map((profile) => ({ id: profile.id, profileKey: profile.profileKey })),
        noEquipmentSentinel: 'none',
      },
      message: 'Every exact variant delivery profile declares its equipment, using "none" for bodyweight.',
    },
    {
      id: 'CARD-PROVENANCE-01',
      category: 'provenance',
      priority: 'P1',
      status: hasKeys(definition.provenance_json) ? 'passed' : 'failed',
      evidence: { provenance: asObject(definition.provenance_json) },
      message: 'The source and migration provenance are recorded.',
    },
    {
      id: 'CARD-GENERATION-SUPPORT-02',
      category: 'generation_support',
      priority: 'P1',
      status: variants.length > 0 && variants.every((variant) => (
        hasKeys(variant.programming)
      )) && profiles.every((profile) => (
        hasKeys(profile.timeModel) && hasKeys(profile.doseScaling) && hasKeys(profile.measurement)
      )) ? 'passed' : 'failed',
      evidence: { variantCount: variants.length, profileCount: profiles.length },
      message: 'Programming, timing, scaling, and measurement support are complete.',
    },
    {
      id: 'CARD-USER-SUPPORT-01',
      category: 'user_support',
      priority: 'P1',
      status: hasKeys(card.athleteSupport) ? 'passed' : 'failed',
      evidence: { athleteSupport: card.athleteSupport },
      message: 'Member guidance, self-checks, accessibility, and media alternatives are complete.',
    },
    {
      id: 'CARD-COACH-SUPPORT-02',
      category: 'coach_support',
      priority: 'P1',
      status: hasKeys(card.coachSupport) ? 'passed' : 'failed',
      evidence: { coachSupport: card.coachSupport },
      message: 'Coach observation, correction, demonstration, and group-management support are complete.',
    },
    {
      id: 'CARD-SUPPORT-OPS-02',
      category: 'support_operations',
      priority: 'P1',
      status: hasKeys(card.supportOperations)
        && profiles.every((profile) => hasKeys(profile.supportPrompts)) ? 'passed' : 'failed',
      evidence: { supportOperations: card.supportOperations },
      message: 'Issue escalation, retention, change-impact, and feedback support are complete.',
    },
    {
      id: 'CARD-GRAPH-03',
      category: 'relationship_graph',
      priority: 'P1',
      status: approvedRelationships.length > 0 ? 'passed' : 'failed',
      evidence: { approvedRelationshipCount: approvedRelationships.length },
      message: 'At least one progression, regression, or substitution edge is coach-approved.',
    },
    {
      id: 'CARD-CALIBRATION-01',
      category: 'calibration',
      priority: 'P1',
      status: approvedCalibrations.length > 0 ? 'passed' : 'failed',
      evidence: { approvedCalibrationCount: approvedCalibrations.length },
      message: 'Difficulty scoring has approved calibration evidence.',
    },
  ]
  return checks
}

async function persistPackets(pool, packets) {
  if (packets.length === 0) return
  await pool.query(
    `INSERT INTO coaching.exercise_card_test_packet_v1 (
       definition_id, facility_id, card_version, audit_version, status,
       checks_json, blocking_issues_json, human_review_required, checked_at
     )
     SELECT
       x.definition_id::uuid, x.facility_id::bigint, x.card_version::integer,
       x.audit_version, x.status, x.checks_json, x.blocking_issues_json,
       x.human_review_required, now()
     FROM jsonb_to_recordset($1::jsonb) AS x(
       definition_id text, facility_id text, card_version integer,
       audit_version text, status text, checks_json jsonb,
       blocking_issues_json jsonb, human_review_required boolean
     )
     ON CONFLICT (definition_id) DO UPDATE SET
       facility_id=EXCLUDED.facility_id,
       card_version=EXCLUDED.card_version,
       audit_version=EXCLUDED.audit_version,
       status=EXCLUDED.status,
       checks_json=EXCLUDED.checks_json,
       blocking_issues_json=EXCLUDED.blocking_issues_json,
       human_review_required=EXCLUDED.human_review_required,
       checked_at=now()`,
    [JSON.stringify(packets)],
  )
}

export async function auditCanonicalExerciseLibrary(pool, {
  facilityId,
  persist = true,
} = {}) {
  if (!Number.isInteger(Number(facilityId)) || Number(facilityId) < 1) {
    throw new TypeError('facilityId must be a positive integer')
  }
  const id = Number(facilityId)
  const [
    definitionsResult,
    variantsResult,
    profilesResult,
    mediaResult,
    relationshipsResult,
    calibrationsResult,
    taxonomyResult,
    legacyResult,
  ] = await Promise.all([
    pool.query(
      `SELECT * FROM coaching.exercise_definition_v1
       WHERE facility_id=$1 AND status!='archived' ORDER BY slug`,
      [id],
    ),
    pool.query(
      `SELECT v.* FROM coaching.exercise_variant_v1 v
       JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id
       WHERE d.facility_id=$1 AND v.status!='archived' ORDER BY v.definition_id, v.variant_key`,
      [id],
    ),
    pool.query(
      `SELECT p.* FROM coaching.exercise_delivery_profile_v1 p
       JOIN coaching.exercise_variant_v1 v ON v.id=p.variant_id
       JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id
       WHERE d.facility_id=$1 AND p.status!='archived'
       ORDER BY p.variant_id, p.phase_key, p.profile_key`,
      [id],
    ),
    pool.query(
      `SELECT DISTINCT ON (mr.definition_id) mr.*
       FROM coaching.exercise_media_review_v1 mr
       JOIN coaching.exercise_definition_v1 d ON d.id=mr.definition_id
       WHERE d.facility_id=$1
       ORDER BY mr.definition_id, mr.reviewed_at DESC NULLS LAST, mr.created_at DESC`,
      [id],
    ),
    pool.query(
      `SELECT r.* FROM coaching.exercise_relationship_v1 r
       JOIN coaching.exercise_variant_v1 v ON v.id=r.from_variant_id
       JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id
       WHERE d.facility_id=$1`,
      [id],
    ),
    pool.query(
      `SELECT c.* FROM coaching.exercise_score_calibration_v1 c WHERE c.facility_id=$1`,
      [id],
    ),
    pool.query(
      `SELECT 'movementPatterns' AS kind, key FROM coaching.movement_pattern
       UNION ALL SELECT 'bodyRegions', key FROM coaching.body_region
       UNION ALL SELECT 'equipment', key FROM coaching.equipment`,
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS count,
         (SELECT COUNT(DISTINCT s.legacy_exercise_id)::int
          FROM coaching.exercise_definition_source_v1 s
          JOIN coaching.exercise_definition_v1 d ON d.id=s.definition_id
          WHERE d.facility_id=$1) AS mapped_count
       FROM coaching.exercise WHERE facility_id=$1`,
      [id],
    ),
  ])

  const definitions = definitionsResult.rows
  const variantsByDefinition = new Map()
  for (const variant of variantsResult.rows) {
    const key = String(variant.definition_id)
    if (!variantsByDefinition.has(key)) variantsByDefinition.set(key, [])
    variantsByDefinition.get(key).push(variant)
  }
  const profilesByVariant = new Map()
  for (const profile of profilesResult.rows) {
    const key = String(profile.variant_id)
    if (!profilesByVariant.has(key)) profilesByVariant.set(key, [])
    profilesByVariant.get(key).push(profile)
  }
  const mediaByDefinition = new Map(mediaResult.rows.map((row) => [String(row.definition_id), row]))
  const relationshipsByDefinition = new Map()
  const variantDefinition = new Map(variantsResult.rows.map((row) => [String(row.id), String(row.definition_id)]))
  for (const relationship of relationshipsResult.rows) {
    const definitionId = variantDefinition.get(String(relationship.from_variant_id))
    if (!relationshipsByDefinition.has(definitionId)) relationshipsByDefinition.set(definitionId, [])
    relationshipsByDefinition.get(definitionId).push(relationship)
  }
  const calibrationsByDefinition = new Map()
  for (const calibration of calibrationsResult.rows) {
    const key = variantDefinition.get(String(calibration.variant_id))
    if (!key) continue
    if (!calibrationsByDefinition.has(key)) calibrationsByDefinition.set(key, [])
    calibrationsByDefinition.get(key).push(calibration)
  }
  const taxonomy = new Map()
  for (const row of taxonomyResult.rows) {
    if (!taxonomy.has(row.kind)) taxonomy.set(row.kind, new Set())
    taxonomy.get(row.kind).add(row.key)
  }

  const identityRows = definitions.map((row) => ({
    id: row.id,
    canonical_name: row.canonical_name,
    display_name: row.display_name,
    aliases: row.aliases,
    family_key: row.family_key,
  }))
  const packets = definitions.map((definition) => {
    const definitionId = String(definition.id)
    const card = rowToCard(
      definition,
      asArray(variantsByDefinition.get(definitionId)),
      profilesByVariant,
    )
    const media = mediaByDefinition.get(definitionId)
    const mediaReview = media && asNumber(media.reviewed_card_version) === card.cardVersion ? {
      url: media.url,
      exactVariantMatch: media.exact_variant_match,
      demonstrationQualityScore: media.demonstration_quality_score,
      linkStatus: media.link_status,
    } : null
    const invalidTaxonomyKeys = [
      ...card.movementPatterns.filter((key) => !taxonomy.get('movementPatterns')?.has(key))
        .map((key) => `movementPatterns:${key}`),
      ...card.bodyRegions.filter((key) => !taxonomy.get('bodyRegions')?.has(key))
        .map((key) => `bodyRegions:${key}`),
      ...[...card.requiredEquipment, ...card.optionalEquipment]
        .filter((key) => !taxonomy.get('equipment')?.has(key))
        .map((key) => `equipment:${key}`),
    ]
    const relationships = asArray(relationshipsByDefinition.get(definitionId))
    const basePacket = buildCanonicalCardTestPacket(card, {
      mediaReview,
      invalidTaxonomyKeys,
      duplicates: findPotentialCanonicalDuplicates(card, identityRows),
      relationships,
    })
    const checks = [
      ...basePacket.checks,
      ...additionalChecks({
        card,
        definition,
        relationships,
        calibrations: asArray(calibrationsByDefinition.get(definitionId)),
      }),
    ]
    const blockingIssues = checks.filter((check) => (
      check.status === 'failed' && ['P0', 'P1'].includes(check.priority)
    ))
    return {
      definition_id: definitionId,
      facility_id: String(id),
      card_version: card.cardVersion,
      audit_version: CANONICAL_CARD_AUDIT_VERSION,
      status: blockingIssues.length === 0 ? 'pass' : 'quarantined',
      checks_json: checks,
      blocking_issues_json: blockingIssues.map(({ id: checkId, category, message }) => ({
        code: checkId,
        category,
        message,
      })),
      human_review_required: blockingIssues.length > 0 || definition.status !== 'published',
      slug: card.slug,
    }
  })
  if (persist) await persistPackets(pool, packets)

  const issueCounts = {}
  for (const packet of packets) {
    for (const issue of packet.blocking_issues_json) {
      issueCounts[issue.code] = (issueCounts[issue.code] ?? 0) + 1
    }
  }
  const legacyCount = asNumber(legacyResult.rows[0]?.count)
  return {
    auditVersion: CANONICAL_CARD_AUDIT_VERSION,
    generatedAt: new Date().toISOString(),
    facilityId: id,
    totals: {
      legacyExercises: legacyCount,
      canonicalDefinitions: definitions.length,
      migratedLegacyExercises: asNumber(legacyResult.rows[0]?.mapped_count),
      passed: packets.filter((packet) => packet.status === 'pass').length,
      quarantined: packets.filter((packet) => packet.status === 'quarantined').length,
      published: definitions.filter((row) => row.status === 'published').length,
    },
    migrationCoverageComplete: legacyCount === asNumber(legacyResult.rows[0]?.mapped_count),
    issueCounts: Object.fromEntries(
      Object.entries(issueCounts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
    ),
    packets,
  }
}
