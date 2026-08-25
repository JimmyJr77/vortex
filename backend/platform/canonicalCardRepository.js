import {
  approvalAppliesToVersion,
  assertIndependentReviewer,
  assertCardStatusTransition,
  buildCanonicalCardTestPacket,
  evaluateCanonicalCardReadiness,
  findPotentialCanonicalDuplicates,
  hasVerifiedMediaReviewBasis,
  normalizeMediaReviewBasis,
  validateCanonicalCardDraft,
  validateCanonicalRelationship,
} from './canonicalCardAuthoring.js'
import {
  normalizeExactVariantProfile,
  structuredProfileCompleteness,
} from './canonicalExerciseProfilesV2.js'

const STRUCTURED_PROFILE_QUEUE_STATUSES = new Set(['pending', 'suggested', 'review'])
const STRUCTURED_PROFILE_QUEUE_SORTS = new Set(['closest_to_complete', 'alphabetical'])

function rowToTaxonomyAssignment(row) {
  return {
    id: String(row.id),
    termId: Number(row.term_id),
    facetType: row.facet_type,
    key: row.term_key,
    name: row.term_name,
    domain: row.term_domain,
    scope: row.subject_scope,
    role: row.assignment_role,
    weight: Number(row.weight),
    confidence: Number(row.confidence),
    reviewStatus: row.review_status,
    provenance: row.provenance_json ?? {},
    createdBy: row.created_by == null ? null : Number(row.created_by),
    reviewedBy: row.reviewed_by == null ? null : Number(row.reviewed_by),
    reviewedAt: row.reviewed_at,
  }
}

function rowToTaxonomyDecision(row) {
  return {
    id: String(row.id),
    facetType: row.facet_type,
    scope: row.subject_scope,
    decision: row.decision,
    rationale: row.rationale,
    confidence: Number(row.confidence),
    reviewStatus: row.review_status,
    provenance: row.provenance_json ?? {},
    createdBy: row.created_by == null ? null : Number(row.created_by),
    reviewedBy: row.reviewed_by == null ? null : Number(row.reviewed_by),
    reviewedAt: row.reviewed_at,
  }
}

function rowToCard(definition, variants, profiles, taxonomyAssignments = [], taxonomyDecisions = []) {
  const taxonomyBlock = (scope, id) => ({
    assignments: taxonomyAssignments.filter((row) => (
      row.subject_scope === scope && String(row[`${scope === 'delivery_profile' ? 'delivery_profile' : scope}_id`]) === String(id)
    )).map(rowToTaxonomyAssignment),
    decisions: taxonomyDecisions.filter((row) => (
      row.subject_scope === scope && String(row[`${scope === 'delivery_profile' ? 'delivery_profile' : scope}_id`]) === String(id)
    )).map(rowToTaxonomyDecision),
  })
  const profilesByVariant = new Map()
  for (const profile of profiles) {
    const key = String(profile.variant_id)
    if (!profilesByVariant.has(key)) profilesByVariant.set(key, [])
    profilesByVariant.get(key).push({
      id: String(profile.id),
      profileKey: profile.profile_key,
      phaseKey: profile.phase_key,
      role: profile.role,
      purpose: profile.purpose,
      phaseSuitability: Number(profile.phase_suitability),
      methodologyAlignment: profile.methodology_alignment == null ? null : Number(profile.methodology_alignment),
      objectiveRelevance: profile.objective_relevance_json ?? {},
      dosage: profile.dosage_json ?? {},
      qualityGate: profile.quality_gate,
      stopRules: profile.stop_rules ?? [],
      coachInstructions: profile.coach_instructions,
      athleteInstructions: profile.athlete_instructions,
      expectedAdaptation: profile.expected_adaptation,
      equipmentRequired: profile.equipment_required ?? [],
      logistics: profile.logistics_json ?? {},
      timeModel: profile.time_model_json ?? {},
      doseScaling: profile.dose_scaling_json ?? {},
      measurement: profile.measurement_json ?? {},
      supportPrompts: profile.support_prompts_json ?? {},
      taxonomyV2: taxonomyBlock('delivery_profile', profile.id),
      status: profile.status,
    })
  }
  return {
    id: String(definition.id),
    slug: definition.slug,
    canonicalName: definition.canonical_name,
    displayName: definition.display_name,
    description: definition.description,
    aliases: definition.aliases ?? [],
    familyKey: definition.family_key,
    schemaVersion: definition.schema_version,
    cardVersion: Number(definition.card_version),
    status: definition.status,
    contentConfidence: definition.content_confidence == null ? null : Number(definition.content_confidence),
    scoringConfidence: definition.scoring_confidence == null ? null : Number(definition.scoring_confidence),
    mediaConfidence: definition.media_confidence == null ? null : Number(definition.media_confidence),
    movementPatterns: definition.movement_patterns ?? [],
    bodyRegions: definition.body_regions ?? [],
    requiredEquipment: definition.required_equipment ?? [],
    optionalEquipment: definition.optional_equipment ?? [],
    environment: definition.environment_json ?? {},
    population: definition.population_json ?? {},
    athleteSupport: definition.athlete_support_json ?? {},
    coachSupport: definition.coach_support_json ?? {},
    supportOperations: definition.support_operations_json ?? {},
    anatomy: definition.anatomy_json ?? {},
    approvedVideoUrl: definition.approved_video_url,
    taxonomyV2: taxonomyBlock('definition', definition.id),
    createdBy: definition.created_by == null ? null : Number(definition.created_by),
    reviewedBy: definition.reviewed_by == null ? null : Number(definition.reviewed_by),
    approvedBy: definition.approved_by == null ? null : Number(definition.approved_by),
    updatedAt: definition.updated_at,
    variants: variants.map((variant) => ({
      id: String(variant.id),
      variantKey: variant.variant_key,
      displayName: variant.display_name,
      modifierKeys: variant.modifier_keys ?? [],
      difficulty: variant.difficulty_json ?? {},
      movementGeometry: variant.movement_geometry_json ?? {},
      anatomyProfile: variant.anatomy_profile_json ?? {},
      equipmentRoles: variant.equipment_roles_json ?? [],
      taskDemands: variant.task_demands_json ?? {},
      stressProfile: variant.stress_profile_json ?? {},
      scalingHandles: variant.scaling_handles_json ?? [],
      compositionProfile: variant.composition_profile_json ?? {},
      structuredProfileReview: {
        reviewStatus: variant.structured_profile_review_status ?? 'suggested',
        provenance: variant.structured_profile_provenance_json ?? {},
        createdBy: variant.structured_profile_created_by == null ? null : Number(variant.structured_profile_created_by),
        reviewedBy: variant.structured_profile_reviewed_by == null ? null : Number(variant.structured_profile_reviewed_by),
        reviewedAt: variant.structured_profile_reviewed_at,
      },
      requirements: variant.requirements_json ?? {},
      loadProfile: variant.load_profile_json ?? {},
      fatigueProfile: variant.fatigue_profile_json ?? {},
      programming: variant.programming_profile_json ?? {},
      taxonomyV2: taxonomyBlock('variant', variant.id),
      status: variant.status,
      profiles: profilesByVariant.get(String(variant.id)) ?? [],
    })),
  }
}

async function controlledTaxonomyIssues(client, card) {
  const [patterns, regions, equipment] = await Promise.all([
    client.query(`SELECT key FROM coaching.movement_pattern`),
    client.query(`SELECT key FROM coaching.body_region`),
    client.query(`SELECT key FROM coaching.equipment`),
  ])
  const allowed = {
    movementPatterns: new Set(patterns.rows.map((row) => row.key)),
    bodyRegions: new Set(regions.rows.map((row) => row.key)),
    equipment: new Set(equipment.rows.map((row) => row.key)),
  }
  const invalid = {
    movementPatterns: card.movementPatterns.filter((key) => !allowed.movementPatterns.has(key)),
    bodyRegions: card.bodyRegions.filter((key) => !allowed.bodyRegions.has(key)),
    equipment: [...new Set([
      ...card.requiredEquipment,
      ...card.optionalEquipment,
      ...card.variants.flatMap((variant) => (
        variant.profiles.flatMap((profile) => profile.equipmentRequired)
      )),
    ])].filter((key) => !allowed.equipment.has(key)),
  }
  return invalid
}

async function assertControlledTaxonomies(client, card) {
  const invalid = await controlledTaxonomyIssues(client, card)
  if (Object.values(invalid).some((values) => values.length > 0)) {
    throw Object.assign(new TypeError('Canonical card contains uncontrolled taxonomy keys.'), {
      details: { invalid },
    })
  }
}

async function duplicateCandidates(client, facilityId, card, definitionId = null) {
  const result = await client.query(
    `SELECT
       definition.id,
       definition.canonical_name,
       definition.display_name,
       definition.aliases,
       definition.family_key,
       resolution.id AS identity_resolution_id,
       resolution.decision AS identity_resolution_decision,
       resolution.resolution_source AS identity_resolution_source
     FROM coaching.exercise_definition_v1 definition
     LEFT JOIN LATERAL (
       SELECT
         candidate_resolution.id,
         candidate_resolution.decision,
         candidate_resolution.resolution_source
       FROM coaching.exercise_identity_resolution_v1 candidate_resolution
       WHERE $2::uuid IS NOT NULL
         AND (
           (
             candidate_resolution.survivor_definition_id = $2
             AND candidate_resolution.resolved_definition_id = definition.id
           )
           OR (
             candidate_resolution.resolved_definition_id = $2
             AND candidate_resolution.survivor_definition_id = definition.id
           )
         )
       ORDER BY candidate_resolution.resolved_at DESC, candidate_resolution.id
       LIMIT 1
     ) resolution ON TRUE
     WHERE definition.facility_id=$1
       AND ($2::uuid IS NULL OR definition.id != $2)
       AND definition.status != 'archived'`,
    [facilityId, definitionId],
  )
  const rowById = new Map(result.rows.map((row) => [String(row.id), row]))
  return findPotentialCanonicalDuplicates({ ...card, id: definitionId }, result.rows)
    .map((duplicate) => {
      const row = rowById.get(String(duplicate.id))
      return {
        ...duplicate,
        identityResolution: row?.identity_resolution_id ? {
          id: String(row.identity_resolution_id),
          decision: row.identity_resolution_decision,
          resolutionSource: row.identity_resolution_source,
        } : null,
      }
    })
    .filter((duplicate) => ![
      'distinct_exercises',
      'duplicate_consolidated',
    ].includes(duplicate.identityResolution?.decision))
}

export async function findCanonicalCardDuplicates(pool, facilityId, raw, definitionId = null) {
  const validation = validateCanonicalCardDraft(raw)
  const candidate = validation.normalized ?? raw
  return duplicateCandidates(pool, facilityId, candidate, definitionId)
}

export async function loadCanonicalCard(pool, facilityId, definitionId, client = pool) {
  const [
    definition, variants, profiles, mediaReview, reviews, revisions,
    relationships, taxonomyAssignments, taxonomyDecisions,
  ] = await Promise.all([
    client.query(
      `SELECT * FROM coaching.exercise_definition_v1 WHERE id = $1 AND facility_id = $2`,
      [definitionId, facilityId],
    ),
    client.query(
      `SELECT v.* FROM coaching.exercise_variant_v1 v
       JOIN coaching.exercise_definition_v1 d ON d.id = v.definition_id
       WHERE v.definition_id = $1 AND d.facility_id = $2 AND v.status != 'archived'
       ORDER BY v.variant_key`,
      [definitionId, facilityId],
    ),
    client.query(
      `SELECT p.* FROM coaching.exercise_delivery_profile_v1 p
       JOIN coaching.exercise_variant_v1 v ON v.id = p.variant_id
       JOIN coaching.exercise_definition_v1 d ON d.id = v.definition_id
       WHERE v.definition_id = $1 AND d.facility_id = $2 AND p.status != 'archived'
       ORDER BY v.variant_key, p.phase_key, p.profile_key`,
      [definitionId, facilityId],
    ),
    client.query(
      `SELECT url, exact_variant_match, demonstration_quality_score, link_status,
              reviewed_card_version,
              reviewer_user_id, reviewed_at, next_review_at, notes, review_basis_json
       FROM coaching.exercise_media_review_v1
       WHERE definition_id = $1 ORDER BY reviewed_at DESC NULLS LAST LIMIT 1`,
      [definitionId],
    ),
    client.query(
      `SELECT * FROM coaching.exercise_card_review_v1
       WHERE definition_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [definitionId],
    ),
    client.query(
      `SELECT id, revision_number, action, from_status, to_status, change_summary,
              actor_user_id, created_at
       FROM coaching.exercise_card_revision_v1
       WHERE definition_id = $1 ORDER BY revision_number DESC LIMIT 50`,
      [definitionId],
    ),
    client.query(
      `SELECT r.*, fv.display_name AS from_name, tv.display_name AS to_name
       FROM coaching.exercise_relationship_v1 r
       JOIN coaching.exercise_variant_v1 fv ON fv.id = r.from_variant_id
       JOIN coaching.exercise_variant_v1 tv ON tv.id = r.to_variant_id
       WHERE fv.definition_id = $1 OR tv.definition_id = $1
       ORDER BY r.updated_at DESC`,
      [definitionId],
    ),
    client.query(
      `SELECT assignment.*, term.facet_type, term.key AS term_key,
              term.name AS term_name, term.domain AS term_domain
       FROM coaching.exercise_taxonomy_assignment_v2 assignment
       JOIN coaching.taxonomy_term_v2 term ON term.id = assignment.term_id
       LEFT JOIN coaching.exercise_variant_v1 variant ON variant.id = assignment.variant_id
       LEFT JOIN coaching.exercise_delivery_profile_v1 profile ON profile.id = assignment.delivery_profile_id
       LEFT JOIN coaching.exercise_variant_v1 profile_variant ON profile_variant.id = profile.variant_id
       WHERE assignment.definition_id = $1
          OR variant.definition_id = $1
          OR profile_variant.definition_id = $1
       ORDER BY term.facet_type, term.sort_order, term.key`,
      [definitionId],
    ),
    client.query(
      `SELECT decision.*
       FROM coaching.exercise_taxonomy_decision_v2 decision
       LEFT JOIN coaching.exercise_variant_v1 variant ON variant.id = decision.variant_id
       LEFT JOIN coaching.exercise_delivery_profile_v1 profile ON profile.id = decision.delivery_profile_id
       LEFT JOIN coaching.exercise_variant_v1 profile_variant ON profile_variant.id = profile.variant_id
       WHERE decision.definition_id = $1
          OR variant.definition_id = $1
          OR profile_variant.definition_id = $1
       ORDER BY decision.subject_scope, decision.facet_type`,
      [definitionId],
    ),
  ])
  if (definition.rows.length === 0) return null
  const card = {
    ...rowToCard(
      definition.rows[0], variants.rows, profiles.rows,
      taxonomyAssignments.rows, taxonomyDecisions.rows,
    ),
    mediaReview: mediaReview.rows[0] ? {
      url: mediaReview.rows[0].url,
      exactVariantMatch: mediaReview.rows[0].exact_variant_match,
      demonstrationQualityScore: mediaReview.rows[0].demonstration_quality_score == null
        ? null
        : Number(mediaReview.rows[0].demonstration_quality_score),
      linkStatus: mediaReview.rows[0].link_status,
      reviewedCardVersion: Number(mediaReview.rows[0].reviewed_card_version),
      reviewerUserId: mediaReview.rows[0].reviewer_user_id,
      reviewedAt: mediaReview.rows[0].reviewed_at,
      nextReviewAt: mediaReview.rows[0].next_review_at,
      notes: mediaReview.rows[0].notes,
      reviewBasis: mediaReview.rows[0].review_basis_json ?? {},
    } : null,
    reviews: reviews.rows,
    revisions: revisions.rows,
    relationships: relationships.rows,
  }
  const [duplicates, invalidTaxonomy] = await Promise.all([
    duplicateCandidates(client, facilityId, card, definitionId),
    controlledTaxonomyIssues(client, card),
  ])
  const activeMediaReview = card.mediaReview?.reviewedCardVersion === card.cardVersion
    ? card.mediaReview
    : null
  return {
    ...card,
    duplicateCandidates: duplicates,
    readiness: evaluateCanonicalCardReadiness(card, { mediaReview: activeMediaReview }),
    testPacket: buildCanonicalCardTestPacket(card, {
      mediaReview: activeMediaReview,
      duplicates,
      invalidTaxonomyKeys: Object.entries(invalidTaxonomy).flatMap(([group, keys]) => (
        keys.map((key) => `${group}:${key}`)
      )),
      relationships: relationships.rows,
    }),
  }
}

export async function listCanonicalCards(pool, facilityId, filters = {}) {
  const status = filters.status ? String(filters.status) : null
  const search = filters.search ? String(filters.search).trim() : ''
  const result = await pool.query(
    `SELECT d.id, d.slug, d.canonical_name, d.display_name, d.family_key, d.status,
            d.card_version, d.content_confidence, d.scoring_confidence,
            d.media_confidence, d.approved_video_url, d.updated_at,
            COUNT(DISTINCT v.id)::int AS variant_count,
            COUNT(DISTINCT p.id)::int AS profile_count
     FROM coaching.exercise_definition_v1 d
     LEFT JOIN coaching.exercise_variant_v1 v ON v.definition_id = d.id AND v.status != 'archived'
     LEFT JOIN coaching.exercise_delivery_profile_v1 p ON p.variant_id = v.id AND p.status != 'archived'
     WHERE d.facility_id = $1
       AND ($2::text IS NULL OR d.status = $2)
       AND ($3::text = '' OR d.canonical_name ILIKE '%' || $3 || '%'
         OR d.display_name ILIKE '%' || $3 || '%'
         OR d.slug ILIKE '%' || $3 || '%' OR d.family_key ILIKE '%' || $3 || '%'
         OR EXISTS (
           SELECT 1 FROM unnest(d.aliases) alias
           WHERE alias ILIKE '%' || $3 || '%'
         ))
     GROUP BY d.id
     ORDER BY d.updated_at DESC, d.canonical_name
     LIMIT 200`,
    [facilityId, status, search],
  )
  return result.rows
}

async function insertRevision(client, facilityId, definitionId, actorUserId, action, fromStatus, toStatus, snapshot, changeSummary) {
  await client.query(
    `INSERT INTO coaching.exercise_card_revision_v1 (
       definition_id, facility_id, revision_number, action, from_status,
       to_status, snapshot_json, change_summary, actor_user_id
     )
     SELECT $1, $2, COALESCE(MAX(revision_number), 0) + 1, $3, $4, $5,
            $6::jsonb, $7, $8
     FROM coaching.exercise_card_revision_v1 WHERE definition_id = $1`,
    [
      definitionId, facilityId, action, fromStatus, toStatus,
      JSON.stringify(snapshot), changeSummary || null, actorUserId,
    ],
  )
}

async function replaceTaxonomyV2Block(client, subjectScope, subjectId, block, actorUserId) {
  if (block == null) return
  const idColumn = subjectScope === 'delivery_profile' ? 'delivery_profile_id' : `${subjectScope}_id`
  await client.query(
    `DELETE FROM coaching.exercise_taxonomy_assignment_v2 WHERE ${idColumn} = $1`,
    [subjectId],
  )
  await client.query(
    `DELETE FROM coaching.exercise_taxonomy_decision_v2 WHERE ${idColumn} = $1`,
    [subjectId],
  )
  for (const assignment of block.assignments) {
    await client.query(
      `INSERT INTO coaching.exercise_taxonomy_assignment_v2 (
         ${idColumn}, subject_scope, term_id, assignment_role, weight,
         confidence, review_status, provenance_json, created_by
       )
       SELECT $1, $2, term.id, $3, $4, $5, 'suggested', $6::jsonb, $7
       FROM coaching.taxonomy_term_v2 term
       WHERE term.facet_type = $8 AND term.key = $9`,
      [
        subjectId, subjectScope, assignment.role, assignment.weight,
        assignment.confidence, JSON.stringify({
          ...(assignment.provenance ?? {}),
          taxonomyVersion: '2.0.0',
          sourceType: 'canonical_authoring',
          approvalCreated: false,
          humanReviewRequired: true,
        }), actorUserId, assignment.facetType, assignment.key,
      ],
    )
  }
  for (const decision of block.decisions) {
    await client.query(
      `INSERT INTO coaching.exercise_taxonomy_decision_v2 (
         ${idColumn}, subject_scope, facet_type, decision, rationale,
         confidence, review_status, provenance_json, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,'suggested',$7::jsonb,$8)`,
      [
        subjectId, subjectScope, decision.facetType, decision.decision,
        decision.rationale, decision.confidence, JSON.stringify({
          ...(decision.provenance ?? {}),
          taxonomyVersion: '2.0.0',
          sourceType: 'canonical_authoring',
          approvalCreated: false,
          humanReviewRequired: true,
        }), actorUserId,
      ],
    )
  }
}

async function writeVariantsAndProfiles(client, definitionId, card, status, actorUserId) {
  const activeVariantIds = []
  for (const variant of card.variants) {
    const savedVariant = await client.query(
      `INSERT INTO coaching.exercise_variant_v1 (
         definition_id, variant_key, display_name, modifier_keys,
         difficulty_json, requirements_json, load_profile_json,
         fatigue_profile_json, programming_profile_json,
         movement_geometry_json, anatomy_profile_json, equipment_roles_json,
         task_demands_json, stress_profile_json, scaling_handles_json,
         composition_profile_json, structured_profile_review_status,
         structured_profile_provenance_json, structured_profile_created_by,
         structured_profile_reviewed_by, structured_profile_reviewed_at, status
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,
                 $10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,
                 $16::jsonb,'suggested',$17::jsonb,$18,NULL,NULL,$19)
       ON CONFLICT (definition_id, variant_key) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         modifier_keys = EXCLUDED.modifier_keys,
         difficulty_json = EXCLUDED.difficulty_json,
         requirements_json = EXCLUDED.requirements_json,
         load_profile_json = EXCLUDED.load_profile_json,
         fatigue_profile_json = EXCLUDED.fatigue_profile_json,
         programming_profile_json = EXCLUDED.programming_profile_json,
         movement_geometry_json = EXCLUDED.movement_geometry_json,
         anatomy_profile_json = EXCLUDED.anatomy_profile_json,
         equipment_roles_json = EXCLUDED.equipment_roles_json,
         task_demands_json = EXCLUDED.task_demands_json,
         stress_profile_json = EXCLUDED.stress_profile_json,
         scaling_handles_json = EXCLUDED.scaling_handles_json,
         composition_profile_json = EXCLUDED.composition_profile_json,
         structured_profile_review_status = 'suggested',
         structured_profile_provenance_json = EXCLUDED.structured_profile_provenance_json,
         structured_profile_created_by = EXCLUDED.structured_profile_created_by,
         structured_profile_reviewed_by = NULL,
         structured_profile_reviewed_at = NULL,
         status = EXCLUDED.status,
         updated_at = now()
       RETURNING id`,
      [
        definitionId, variant.variantKey, variant.displayName, variant.modifierKeys,
        JSON.stringify(variant.difficulty), JSON.stringify(variant.requirements),
        JSON.stringify(variant.loadProfile), JSON.stringify(variant.fatigueProfile),
        JSON.stringify(variant.programming), JSON.stringify(variant.movementGeometry),
        JSON.stringify(variant.anatomyProfile), JSON.stringify(variant.equipmentRoles),
        JSON.stringify(variant.taskDemands), JSON.stringify(variant.stressProfile),
        JSON.stringify(variant.scalingHandles), JSON.stringify(variant.compositionProfile),
        JSON.stringify({
          ...(variant.structuredProfileReview?.provenance ?? {}),
          schemaVersion: '2.0.0', sourceType: 'canonical_authoring',
          approvalCreated: false, humanReviewRequired: true,
        }), actorUserId, status,
      ],
    )
    const variantId = savedVariant.rows[0].id
    activeVariantIds.push(variantId)
    await replaceTaxonomyV2Block(client, 'variant', variantId, variant.taxonomyV2, actorUserId)
    const activeProfileIds = []
    for (const profile of variant.profiles) {
      const savedProfile = await client.query(
        `INSERT INTO coaching.exercise_delivery_profile_v1 (
           variant_id, profile_key, phase_key, role, purpose, phase_suitability,
           methodology_alignment, objective_relevance_json, dosage_json,
           quality_gate, stop_rules, coach_instructions, athlete_instructions,
           expected_adaptation, equipment_required, logistics_json, time_model_json,
           dose_scaling_json, measurement_json, support_prompts_json, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,
                   $16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20::jsonb,$21)
         ON CONFLICT (variant_id, profile_key) DO UPDATE SET
           phase_key = EXCLUDED.phase_key, role = EXCLUDED.role,
           purpose = EXCLUDED.purpose, phase_suitability = EXCLUDED.phase_suitability,
           methodology_alignment = EXCLUDED.methodology_alignment,
           objective_relevance_json = EXCLUDED.objective_relevance_json,
           dosage_json = EXCLUDED.dosage_json, quality_gate = EXCLUDED.quality_gate,
           stop_rules = EXCLUDED.stop_rules, coach_instructions = EXCLUDED.coach_instructions,
           athlete_instructions = EXCLUDED.athlete_instructions,
           expected_adaptation = EXCLUDED.expected_adaptation,
           equipment_required = EXCLUDED.equipment_required,
           logistics_json = EXCLUDED.logistics_json,
           time_model_json = EXCLUDED.time_model_json,
           dose_scaling_json = EXCLUDED.dose_scaling_json,
           measurement_json = EXCLUDED.measurement_json,
           support_prompts_json = EXCLUDED.support_prompts_json,
           status = EXCLUDED.status,
           updated_at = now()
         RETURNING id`,
        [
          variantId, profile.profileKey, profile.phaseKey, profile.role,
          profile.purpose, profile.phaseSuitability, profile.methodologyAlignment,
          JSON.stringify(profile.objectiveRelevance), JSON.stringify(profile.dosage),
          profile.qualityGate, profile.stopRules, profile.coachInstructions,
          profile.athleteInstructions, profile.expectedAdaptation,
          profile.equipmentRequired, JSON.stringify(profile.logistics),
          JSON.stringify(profile.timeModel), JSON.stringify(profile.doseScaling),
          JSON.stringify(profile.measurement), JSON.stringify(profile.supportPrompts), status,
        ],
      )
      activeProfileIds.push(savedProfile.rows[0].id)
      await replaceTaxonomyV2Block(
        client,
        'delivery_profile',
        savedProfile.rows[0].id,
        profile.taxonomyV2,
        actorUserId,
      )
    }
    await client.query(
      `UPDATE coaching.exercise_delivery_profile_v1
       SET status = 'archived', updated_at = now()
       WHERE variant_id = $1 AND NOT (id = ANY($2::uuid[]))`,
      [variantId, activeProfileIds],
    )
  }
  await client.query(
    `UPDATE coaching.exercise_variant_v1
     SET status = 'archived', updated_at = now()
     WHERE definition_id = $1 AND NOT (id = ANY($2::uuid[]))`,
    [definitionId, activeVariantIds],
  )
}

function validatedCanonicalCardDraft(raw) {
  const draftValidation = validateCanonicalCardDraft(raw)
  if (!draftValidation.valid) {
    throw Object.assign(new TypeError('Canonical card draft is invalid.'), { details: draftValidation })
  }
  return draftValidation.normalized
}

export async function withCanonicalCardTransaction(pool, facilityId, operation) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('canonical-card:' || $1::text))`, [facilityId])
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function persistCanonicalCardDraft(client, facilityId, actorUserId, card, options = {}) {
  const definitionId = options.definitionId ?? null
  await assertControlledTaxonomies(client, card)
  const duplicates = await duplicateCandidates(client, facilityId, card, definitionId)
  const blockingDuplicates = duplicates.filter((match) => match.score >= 90)
  if (blockingDuplicates.length > 0) {
    throw Object.assign(new Error('A canonical card or alias is too similar to an existing card.'), {
      status: 409,
      details: { duplicates: blockingDuplicates },
    })
  }
  let id = definitionId
  let fromStatus = null
  if (definitionId) {
    const existing = await client.query(
      `SELECT * FROM coaching.exercise_definition_v1
       WHERE id = $1 AND facility_id = $2 FOR UPDATE`,
      [definitionId, facilityId],
    )
    if (existing.rows.length === 0) throw Object.assign(new Error('Canonical card not found.'), { status: 404 })
    const row = existing.rows[0]
    fromStatus = row.status
    if (!['draft', 'review'].includes(row.status)) {
      throw new RangeError('Published, deprecated, and archived cards are immutable; create a reviewed revision instead.')
    }
    if (!options.expectedUpdatedAt || new Date(options.expectedUpdatedAt).getTime() !== new Date(row.updated_at).getTime()) {
      throw Object.assign(new Error('This card changed after it was opened. Reload before saving.'), { status: 409 })
    }
    await client.query(
      `UPDATE coaching.exercise_definition_v1 SET
         slug=$3, canonical_name=$4, display_name=$5, aliases=$6,
         description=$7, family_key=$8, content_confidence=$9,
         scoring_confidence=$10, media_confidence=$11,
         movement_patterns=$12, body_regions=$13, required_equipment=$14,
         optional_equipment=$15, environment_json=$16::jsonb,
         population_json=$17::jsonb, anatomy_json=$18::jsonb,
         athlete_support_json=$19::jsonb, coach_support_json=$20::jsonb,
         support_operations_json=$21::jsonb, approved_video_url=$22,
         status='draft', reviewed_by=NULL,
         card_version=card_version + 1, updated_at=now()
       WHERE id=$1 AND facility_id=$2`,
      [
        definitionId, facilityId, card.slug, card.canonicalName, card.displayName,
        card.aliases, card.description, card.familyKey, card.contentConfidence,
        card.scoringConfidence, card.mediaConfidence, card.movementPatterns,
        card.bodyRegions, card.requiredEquipment, card.optionalEquipment,
        JSON.stringify(card.environment), JSON.stringify(card.population),
        JSON.stringify(card.anatomy), JSON.stringify(card.athleteSupport),
        JSON.stringify(card.coachSupport), JSON.stringify(card.supportOperations),
        card.approvedVideoUrl,
      ],
    )
  } else {
    const created = await client.query(
      `INSERT INTO coaching.exercise_definition_v1 (
         facility_id, slug, canonical_name, display_name, aliases, description,
         family_key, status, content_confidence, scoring_confidence,
         media_confidence, movement_patterns, body_regions, required_equipment,
         optional_equipment, environment_json, population_json,
         anatomy_json, athlete_support_json, coach_support_json,
         support_operations_json, approved_video_url, provenance_json, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10,$11,$12,$13,$14,
                 $15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20::jsonb,
                 $21,'{"source":"canonical_authoring"}'::jsonb,$22)
       RETURNING id`,
      [
        facilityId, card.slug, card.canonicalName, card.displayName, card.aliases,
        card.description, card.familyKey, card.contentConfidence,
        card.scoringConfidence, card.mediaConfidence, card.movementPatterns,
        card.bodyRegions, card.requiredEquipment, card.optionalEquipment,
        JSON.stringify(card.environment), JSON.stringify(card.population),
        JSON.stringify(card.anatomy), JSON.stringify(card.athleteSupport),
        JSON.stringify(card.coachSupport), JSON.stringify(card.supportOperations),
        card.approvedVideoUrl, actorUserId,
      ],
    )
    id = created.rows[0].id
  }
  await writeVariantsAndProfiles(client, id, card, 'draft')
  if (definitionId) {
    await client.query(
      `UPDATE coaching.exercise_media_review_v1
       SET exact_variant_match=FALSE, link_status='pending', updated_at=now()
       WHERE definition_id=$1`,
      [definitionId],
    )
  }
  await insertRevision(
    client, facilityId, id, actorUserId,
    definitionId && fromStatus === 'review' ? 'returned_to_draft' : definitionId ? 'updated' : 'created',
    fromStatus, 'draft', card, options.changeSummary,
  )
  return id
}

export async function saveCanonicalCardDraftInTransaction(client, facilityId, actorUserId, raw, options = {}) {
  const card = validatedCanonicalCardDraft(raw)
  const id = await persistCanonicalCardDraft(client, facilityId, actorUserId, card, options)
  return {
    id: String(id),
    ...card,
    status: 'draft',
  }
}

export async function saveCanonicalCardDraft(pool, facilityId, actorUserId, raw, options = {}) {
  const card = validatedCanonicalCardDraft(raw)
  const id = await withCanonicalCardTransaction(
    pool,
    facilityId,
    (client) => persistCanonicalCardDraft(client, facilityId, actorUserId, card, options),
  )
  return loadCanonicalCard(pool, facilityId, id)
}

export async function transitionCanonicalCard(pool, facilityId, definitionId, actorUserId, toStatus, options = {}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const card = await loadCanonicalCard(pool, facilityId, definitionId, client)
    if (!card) throw Object.assign(new Error('Canonical card not found.'), { status: 404 })
    assertCardStatusTransition(card.status, toStatus)
    if (!options.expectedUpdatedAt || new Date(options.expectedUpdatedAt).getTime() !== new Date(card.updatedAt).getTime()) {
      throw Object.assign(new Error('This card changed after it was opened. Reload before changing status.'), { status: 409 })
    }
    if (toStatus === 'published') {
      assertIndependentReviewer(card.createdBy, actorUserId, 'publishing')
      const approval = card.reviews.find((review) => approvalAppliesToVersion(review, card.cardVersion, actorUserId))
      if (!approval) throw Object.assign(new Error('The publishing reviewer must first record an approval.'), { status: 409 })
      const readiness = evaluateCanonicalCardReadiness(card, {
        mediaReview: card.mediaReview?.reviewedCardVersion === card.cardVersion ? card.mediaReview : null,
      })
      if (!readiness.ready || card.testPacket?.status === 'failed') {
        throw Object.assign(new Error('Canonical card is not publication-ready.'), {
          status: 422,
          details: { readiness, testPacket: card.testPacket },
        })
      }
    }
    await client.query(
      `UPDATE coaching.exercise_definition_v1 SET
         status=$3,
         reviewed_by=CASE WHEN $3='review' THEN NULL ELSE reviewed_by END,
         approved_by=CASE WHEN $3='published' THEN $4 ELSE approved_by END,
         last_reviewed_at=CASE WHEN $3 IN ('review','published') THEN now() ELSE last_reviewed_at END,
         updated_at=now()
       WHERE id=$1 AND facility_id=$2`,
      [definitionId, facilityId, toStatus, actorUserId],
    )
    await client.query(
      `UPDATE coaching.exercise_variant_v1 SET status=$2, updated_at=now()
       WHERE definition_id=$1 AND status != 'archived'`,
      [definitionId, toStatus],
    )
    await client.query(
      `UPDATE coaching.exercise_delivery_profile_v1 p SET status=$2, updated_at=now()
       FROM coaching.exercise_variant_v1 v
       WHERE p.variant_id=v.id AND v.definition_id=$1 AND p.status != 'archived'`,
      [definitionId, toStatus],
    )
    const action = toStatus === 'review'
      ? 'submitted_for_review'
      : toStatus === 'draft'
        ? 'returned_to_draft'
        : toStatus
    await insertRevision(
      client, facilityId, definitionId, actorUserId, action,
      card.status, toStatus, card, options.changeSummary,
    )
    await client.query('COMMIT')
    return loadCanonicalCard(pool, facilityId, definitionId)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function recordCanonicalCardReview(pool, facilityId, definitionId, reviewerUserId, body = {}) {
  const decision = body.decision === 'approve' ? 'approve' : body.decision === 'request_changes' ? 'request_changes' : null
  const notes = String(body.notes || '').trim()
  if (!decision || notes.length < 20) {
    throw new TypeError('Review decision and at least 20 characters of observed evidence are required.')
  }
  const card = await loadCanonicalCard(pool, facilityId, definitionId)
  if (!card) throw Object.assign(new Error('Canonical card not found.'), { status: 404 })
  if (card.status !== 'review') throw new RangeError('Reviews can only be recorded while a card is in review.')
  assertIndependentReviewer(card.createdBy, reviewerUserId)
  if (decision === 'approve' && (!card.readiness?.ready || card.testPacket?.status === 'failed')) {
    throw Object.assign(new Error('Only a publication-ready current card version can be approved.'), {
      status: 422,
      details: { readiness: card.readiness, testPacket: card.testPacket },
    })
  }
  const result = await pool.query(
    `INSERT INTO coaching.exercise_card_review_v1 (
       definition_id, reviewer_user_id, reviewed_card_version, decision, rubric_json, notes
     ) SELECT d.id, $3, d.card_version, $4, $5::jsonb, $6
         FROM coaching.exercise_definition_v1 d
        WHERE d.id=$1 AND d.facility_id=$2 AND d.status='review'
          AND d.card_version=$7
       RETURNING *`,
    [
      definitionId, facilityId, reviewerUserId, decision,
      JSON.stringify(body.rubric ?? {}), notes, card.cardVersion,
    ],
  )
  if (!result.rows[0]) {
    throw Object.assign(new Error('This card changed after it was opened. Reload before recording a review.'), { status: 409 })
  }
  return result.rows[0]
}

export async function listCanonicalCardReviewQueue(pool, facilityId, {
  limit = 25,
  offset = 0,
} = {}) {
  const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 25))
  const boundedOffset = Math.max(0, Number(offset) || 0)
  const result = await pool.query(
    `SELECT d.id, d.canonical_name, d.display_name, d.card_version, d.updated_at,
            latest_review.decision AS latest_review_decision,
            latest_review.created_at AS latest_reviewed_at,
            COUNT(review.id)::int AS review_count
     FROM coaching.exercise_definition_v1 d
     LEFT JOIN coaching.exercise_card_review_v1 review
       ON review.definition_id=d.id AND review.reviewed_card_version=d.card_version
     LEFT JOIN LATERAL (
       SELECT decision, created_at
       FROM coaching.exercise_card_review_v1
       WHERE definition_id=d.id AND reviewed_card_version=d.card_version
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) latest_review ON TRUE
     WHERE d.facility_id=$1 AND d.status='review'
       AND NOT EXISTS (
         SELECT 1
         FROM coaching.exercise_card_review_v1 approved_review
         WHERE approved_review.definition_id=d.id
           AND approved_review.reviewed_card_version=d.card_version
           AND approved_review.decision='approve'
           AND approved_review.reviewer_user_id IS DISTINCT FROM d.created_by
       )
     GROUP BY d.id, d.canonical_name, d.display_name, d.card_version, d.updated_at,
              latest_review.decision, latest_review.created_at
     ORDER BY d.updated_at ASC, d.canonical_name, d.id`,
    [facilityId],
  )
  const items = result.rows.map((row) => ({
    definitionId: String(row.id),
    subjectName: row.display_name || row.canonical_name,
    canonicalName: row.canonical_name,
    cardVersion: Number(row.card_version),
    updatedAt: row.updated_at,
    reviewCount: Number(row.review_count ?? 0),
    latestDecision: row.latest_review_decision ?? null,
    latestReviewedAt: row.latest_reviewed_at ?? null,
  }))
  return {
    items: items.slice(boundedOffset, boundedOffset + boundedLimit),
    total: items.length,
    offset: boundedOffset,
    limit: boundedLimit,
  }
}

export async function listCanonicalStructuredProfileReviewQueue(pool, facilityId, {
  limit = 100,
  offset = 0,
  status = 'pending',
  missingField = null,
  sort = 'closest_to_complete',
} = {}) {
  const boundedLimit = Math.max(1, Math.min(250, Number(limit) || 100))
  const boundedOffset = Math.max(0, Number(offset) || 0)
  const normalizedStatus = String(status || 'pending')
  const normalizedMissingField = String(missingField || '').trim() || null
  const normalizedSort = String(sort || 'closest_to_complete')
  if (!STRUCTURED_PROFILE_QUEUE_STATUSES.has(normalizedStatus)) {
    throw new RangeError('Structured profile queue status must be pending, suggested, or review.')
  }
  if (!STRUCTURED_PROFILE_QUEUE_SORTS.has(normalizedSort)) {
    throw new RangeError('Structured profile queue sort must be closest_to_complete or alphabetical.')
  }
  const result = await pool.query(
    `SELECT v.id, v.variant_key, v.display_name, v.structured_profile_review_status,
            v.structured_profile_provenance_json, v.structured_profile_created_by,
            v.movement_geometry_json, v.anatomy_profile_json, v.equipment_roles_json,
            v.task_demands_json, v.stress_profile_json, v.scaling_handles_json,
            v.composition_profile_json, d.id AS definition_id, d.canonical_name
     FROM coaching.exercise_variant_v1 v
     JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id
     WHERE d.facility_id=$1 AND d.status != 'archived' AND v.status != 'archived'
       AND (
         ($2='pending' AND v.structured_profile_review_status IN ('suggested','review'))
         OR v.structured_profile_review_status=$2
       )
     ORDER BY d.canonical_name, v.variant_key`,
    [facilityId, normalizedStatus],
  )
  const records = result.rows.map((row) => {
    const profile = {
      movementGeometry: row.movement_geometry_json ?? {},
      anatomyProfile: row.anatomy_profile_json ?? {},
      equipmentRoles: row.equipment_roles_json ?? [],
      taskDemands: row.task_demands_json ?? {},
      stressProfile: row.stress_profile_json ?? {},
      scalingHandles: row.scaling_handles_json ?? [],
      compositionProfile: row.composition_profile_json ?? {},
    }
    let normalizedProfile = null
    let validationError = null
    try {
      normalizedProfile = normalizeExactVariantProfile(profile)
    } catch (error) {
      validationError = error.message
    }
    const completeness = normalizedProfile
      ? structuredProfileCompleteness(normalizedProfile, { requireApproved: false })
      : { complete: false, issues: [{ field: 'structuredProfile', code: 'invalid' }] }
    return {
      id: String(row.id),
      definitionId: String(row.definition_id),
      subjectName: `${row.canonical_name} / ${row.display_name}`,
      variantKey: row.variant_key,
      reviewStatus: row.structured_profile_review_status,
      provenance: row.structured_profile_provenance_json ?? {},
      createdBy: row.structured_profile_created_by == null ? null : Number(row.structured_profile_created_by),
      profile,
      completeness,
      validationError,
      reviewPriority: validationError ? 999 : completeness.issues.length,
    }
  })
  const missingFieldCounts = new Map()
  for (const record of records) {
    for (const issue of record.completeness.issues) {
      missingFieldCounts.set(issue.field, (missingFieldCounts.get(issue.field) ?? 0) + 1)
    }
  }
  if (normalizedMissingField && !missingFieldCounts.has(normalizedMissingField)) {
    throw new RangeError('The requested structured profile missing-field filter is not available in this queue.')
  }
  const filtered = records
    .filter((record) => !normalizedMissingField || record.completeness.issues.some((issue) => issue.field === normalizedMissingField))
    .sort((left, right) => {
      if (normalizedSort === 'closest_to_complete' && left.reviewPriority !== right.reviewPriority) {
        return left.reviewPriority - right.reviewPriority
      }
      return left.subjectName.localeCompare(right.subjectName) || left.variantKey.localeCompare(right.variantKey)
    })
  const reviewStatusCounts = Object.fromEntries(
    ['suggested', 'review'].map((key) => [key, records.filter((record) => record.reviewStatus === key).length]),
  )
  return {
    items: filtered.slice(boundedOffset, boundedOffset + boundedLimit),
    total: filtered.length,
    totalPending: records.length,
    offset: boundedOffset,
    limit: boundedLimit,
    status: normalizedStatus,
    missingField: normalizedMissingField,
    sort: normalizedSort,
    eligibleForApprovalCount: records.filter((record) => record.completeness.complete).length,
    reviewStatusCounts,
    missingFieldCounts: [...missingFieldCounts.entries()]
      .map(([field, count]) => ({ field, count }))
      .sort((left, right) => right.count - left.count || left.field.localeCompare(right.field)),
  }
}

export async function listCanonicalMediaVerificationQueue(pool, facilityId, {
  limit = 25,
  offset = 0,
} = {}) {
  const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 25))
  const boundedOffset = Math.max(0, Number(offset) || 0)
  const result = await pool.query(
    `SELECT d.id, d.canonical_name, d.display_name, d.status, d.approved_video_url,
            d.card_version, d.created_by, media.exact_variant_match,
            media.reviewed_card_version, media.demonstration_quality_score,
            media.link_status, media.reviewed_at, media.review_basis_json
     FROM coaching.exercise_definition_v1 d
     LEFT JOIN LATERAL (
       SELECT exact_variant_match, reviewed_card_version, demonstration_quality_score,
              link_status, reviewed_at, review_basis_json
       FROM coaching.exercise_media_review_v1
       WHERE definition_id=d.id AND url=d.approved_video_url
       ORDER BY reviewed_at DESC NULLS LAST
       LIMIT 1
     ) media ON TRUE
     WHERE d.facility_id=$1 AND d.status != 'archived' AND d.approved_video_url IS NOT NULL
     ORDER BY CASE d.status WHEN 'published' THEN 0 WHEN 'review' THEN 1 ELSE 2 END,
              d.canonical_name, d.id`,
    [facilityId],
  )
  const records = result.rows.map((row) => {
    const currentVersion = Number(row.card_version)
    const issues = []
    if (Number(row.reviewed_card_version) !== currentVersion) issues.push('current_card_version')
    if (row.link_status !== 'healthy') issues.push('healthy_link')
    if (row.exact_variant_match !== true) issues.push('exact_variant_match')
    if (Number(row.demonstration_quality_score) < 80) issues.push('demonstration_quality')
    if (!hasVerifiedMediaReviewBasis(row.review_basis_json ?? {})) issues.push('manual_review_basis')
    return {
      definitionId: String(row.id),
      subjectName: row.display_name || row.canonical_name,
      canonicalName: row.canonical_name,
      cardStatus: row.status,
      approvedVideoUrl: row.approved_video_url,
      cardVersion: currentVersion,
      reviewedAt: row.reviewed_at ?? null,
      issues,
    }
  }).filter((record) => record.issues.length > 0)
  return {
    items: records.slice(boundedOffset, boundedOffset + boundedLimit),
    total: records.length,
    offset: boundedOffset,
    limit: boundedLimit,
    publishedCount: records.filter((record) => record.cardStatus === 'published').length,
  }
}

export async function listCanonicalRelationshipReviewQueue(pool, facilityId, {
  limit = 25,
  offset = 0,
} = {}) {
  const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 25))
  const boundedOffset = Math.max(0, Number(offset) || 0)
  const result = await pool.query(
    `SELECT r.id, r.relationship, r.similarity_score, r.dimensions, r.reason,
            r.conditions_json, r.created_by, r.created_at,
            from_variant.id AS from_variant_id, from_variant.display_name AS from_variant_name,
            to_variant.id AS to_variant_id, to_variant.display_name AS to_variant_name,
            from_definition.id AS from_definition_id, from_definition.canonical_name AS from_canonical_name,
            to_definition.id AS to_definition_id, to_definition.canonical_name AS to_canonical_name
     FROM coaching.exercise_relationship_v1 r
     JOIN coaching.exercise_variant_v1 from_variant ON from_variant.id=r.from_variant_id
     JOIN coaching.exercise_definition_v1 from_definition ON from_definition.id=from_variant.definition_id
     JOIN coaching.exercise_variant_v1 to_variant ON to_variant.id=r.to_variant_id
     JOIN coaching.exercise_definition_v1 to_definition ON to_definition.id=to_variant.definition_id
     WHERE from_definition.facility_id=$1 AND to_definition.facility_id=$1
       AND r.review_status='review'
     ORDER BY r.created_at ASC, r.id ASC`,
    [facilityId],
  )
  const items = result.rows.map((row) => ({
    id: String(row.id),
    relationship: row.relationship,
    similarityScore: Number(row.similarity_score),
    dimensions: row.dimensions ?? [],
    reason: row.reason,
    conditions: row.conditions_json ?? {},
    createdBy: row.created_by == null ? null : Number(row.created_by),
    createdAt: row.created_at,
    from: {
      definitionId: String(row.from_definition_id), variantId: String(row.from_variant_id),
      name: row.from_variant_name || row.from_canonical_name,
    },
    to: {
      definitionId: String(row.to_definition_id), variantId: String(row.to_variant_id),
      name: row.to_variant_name || row.to_canonical_name,
    },
  }))
  return {
    items: items.slice(boundedOffset, boundedOffset + boundedLimit),
    total: items.length,
    offset: boundedOffset,
    limit: boundedLimit,
  }
}

export async function reviewCanonicalStructuredProfile(
  pool, facilityId, variantId, reviewerUserId, body = {},
) {
  const outcome = body.outcome === 'approve' ? 'approved' : body.outcome === 'reject' ? 'rejected' : null
  const notes = String(body.notes || '').trim()
  if (!outcome || notes.length < 20) {
    throw new TypeError('Structured profile review outcome and at least 20 characters of observed evidence are required.')
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `SELECT v.*, d.facility_id
       FROM coaching.exercise_variant_v1 v
       JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id
       WHERE v.id=$1 AND d.facility_id=$2
       FOR UPDATE OF v`,
      [variantId, facilityId],
    )
    const variant = result.rows[0]
    if (!variant) throw Object.assign(new Error('Exact variant profile not found.'), { status: 404 })
    assertIndependentReviewer(variant.structured_profile_created_by, reviewerUserId, 'structured profile')
    const snapshot = {
      movementGeometry: variant.movement_geometry_json,
      anatomyProfile: variant.anatomy_profile_json,
      equipmentRoles: variant.equipment_roles_json,
      taskDemands: variant.task_demands_json,
      stressProfile: variant.stress_profile_json,
      scalingHandles: variant.scaling_handles_json,
      compositionProfile: variant.composition_profile_json,
      provenance: variant.structured_profile_provenance_json,
    }
    if (outcome === 'approved') {
      const normalized = normalizeExactVariantProfile({
        ...snapshot,
        structuredProfileReview: {
          reviewStatus: 'approved', reviewedBy: reviewerUserId,
          reviewedAt: new Date().toISOString(),
        },
      })
      const completeness = structuredProfileCompleteness(normalized)
      if (!completeness.complete) {
        throw Object.assign(new TypeError('Incomplete exact-variant profiles cannot be approved.'), {
          details: completeness,
        })
      }
    }
    await client.query(
      `INSERT INTO coaching.exercise_structured_profile_review_v2 (
         variant_id, outcome, notes, reviewer_user_id, snapshot_json
       ) VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [variantId, outcome, notes, reviewerUserId, JSON.stringify(snapshot)],
    )
    const updated = await client.query(
      `UPDATE coaching.exercise_variant_v1
       SET structured_profile_review_status=$2,
           structured_profile_reviewed_by=$3,
           structured_profile_reviewed_at=now(), updated_at=now()
       WHERE id=$1
       RETURNING id, structured_profile_review_status, structured_profile_reviewed_by,
                 structured_profile_reviewed_at`,
      [variantId, outcome, reviewerUserId],
    )
    await client.query('COMMIT')
    return updated.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function recordCanonicalMediaReview(pool, facilityId, definitionId, reviewerUserId, body = {}) {
  const card = await loadCanonicalCard(pool, facilityId, definitionId)
  if (!card) throw Object.assign(new Error('Canonical card not found.'), { status: 404 })
  assertIndependentReviewer(card.createdBy, reviewerUserId, 'media')
  const url = String(body.url || '').trim()
  if (!url || url !== card.approvedVideoUrl) throw new TypeError('Media review URL must match the card approved video.')
  const score = Number(body.demonstrationQualityScore)
  if (!Number.isInteger(score) || score < 1 || score > 100) throw new RangeError('Media quality must be an integer from 1 to 100.')
  const linkStatus = ['healthy', 'broken', 'mismatched'].includes(body.linkStatus) ? body.linkStatus : null
  if (!linkStatus) throw new TypeError('A valid media link status is required.')
  const notes = String(body.notes || '').trim()
  if (notes.length < 20) throw new TypeError('Media review notes must document at least 20 characters of observed evidence.')
  const reviewBasis = normalizeMediaReviewBasis(body.reviewBasis ?? body.review_basis)
  const result = await pool.query(
    `INSERT INTO coaching.exercise_media_review_v1 (
       definition_id, url, exact_variant_match, reviewed_card_version, demonstration_quality_score,
       link_status, reviewer_user_id, reviewed_at, next_review_at, notes, review_basis_json
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now() + interval '180 days',$8,$9::jsonb)
     ON CONFLICT (definition_id, url) DO UPDATE SET
       exact_variant_match=EXCLUDED.exact_variant_match,
       reviewed_card_version=EXCLUDED.reviewed_card_version,
       demonstration_quality_score=EXCLUDED.demonstration_quality_score,
       link_status=EXCLUDED.link_status, reviewer_user_id=EXCLUDED.reviewer_user_id,
       reviewed_at=EXCLUDED.reviewed_at, next_review_at=EXCLUDED.next_review_at, notes=EXCLUDED.notes,
       review_basis_json=EXCLUDED.review_basis_json, updated_at=now()
     RETURNING *`,
    [
      definitionId, url, body.exactVariantMatch === true, card.cardVersion, score,
      linkStatus, reviewerUserId, notes, JSON.stringify(reviewBasis),
    ],
  )
  return result.rows[0]
}

export async function saveCanonicalRelationship(pool, facilityId, reviewerUserId, raw) {
  const validation = validateCanonicalRelationship(raw)
  if (!validation.valid) throw Object.assign(new TypeError('Invalid canonical relationship.'), { details: validation })
  const relationship = validation.normalized
  const ownership = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM coaching.exercise_variant_v1 v
     JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id
     WHERE v.id=ANY($1::uuid[]) AND d.facility_id=$2`,
    [[relationship.fromVariantId, relationship.toVariantId], facilityId],
  )
  if (Number(ownership.rows[0]?.count) !== 2) {
    throw Object.assign(new Error('Both relationship variants must belong to this facility.'), { status: 404 })
  }
  const result = await pool.query(
    `INSERT INTO coaching.exercise_relationship_v1 (
       from_variant_id, to_variant_id, relationship, similarity_score,
       dimensions, reason, conditions_json, review_status, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'review',$8)
     ON CONFLICT (from_variant_id,to_variant_id,relationship) DO UPDATE SET
       similarity_score=EXCLUDED.similarity_score, dimensions=EXCLUDED.dimensions,
       reason=EXCLUDED.reason, conditions_json=EXCLUDED.conditions_json,
       review_status='review', reviewed_by=NULL, reviewed_at=NULL, updated_at=now()
     RETURNING *`,
    [
      relationship.fromVariantId, relationship.toVariantId,
      relationship.relationship, relationship.similarityScore,
      relationship.dimensions, relationship.reason,
      JSON.stringify(relationship.conditions), reviewerUserId,
    ],
  )
  return result.rows[0]
}

export async function reviewCanonicalRelationship(pool, facilityId, relationshipId, reviewerUserId, body = {}) {
  const outcome = body?.decision ?? body?.outcome
  const notes = String(body?.notes || '').trim()
  if (!['approved', 'rejected'].includes(outcome)) throw new TypeError('Relationship decision must be approved or rejected.')
  if (notes.length < 20) throw new TypeError('Relationship review notes must document at least 20 characters of observed rationale.')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existing = await client.query(
      `SELECT r.*
       FROM coaching.exercise_relationship_v1 r
       JOIN coaching.exercise_variant_v1 fv ON fv.id=r.from_variant_id
       JOIN coaching.exercise_definition_v1 d ON d.id=fv.definition_id
       WHERE r.id=$1 AND d.facility_id=$2
       FOR UPDATE OF r`,
      [relationshipId, facilityId],
    )
    const relationship = existing.rows[0]
    if (!relationship) throw Object.assign(new Error('Canonical relationship not found.'), { status: 404 })
    if (Number(relationship.created_by) === Number(reviewerUserId)) {
      throw Object.assign(new Error('Two-person control requires a different relationship reviewer.'), { status: 409 })
    }
    const snapshot = {
      fromVariantId: String(relationship.from_variant_id),
      toVariantId: String(relationship.to_variant_id),
      relationship: relationship.relationship,
      similarityScore: Number(relationship.similarity_score),
      dimensions: relationship.dimensions ?? [],
      reason: relationship.reason,
      conditions: relationship.conditions_json ?? {},
    }
    await client.query(
      `INSERT INTO coaching.exercise_relationship_review_v2 (
         relationship_id, outcome, notes, reviewer_user_id, snapshot_json
       ) VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [relationshipId, outcome, notes, reviewerUserId, JSON.stringify(snapshot)],
    )
    const result = await client.query(
      `UPDATE coaching.exercise_relationship_v1 SET
         review_status=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now()
       WHERE id=$1
       RETURNING *`,
      [relationshipId, outcome, reviewerUserId],
    )
    await client.query('COMMIT')
    return result.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
