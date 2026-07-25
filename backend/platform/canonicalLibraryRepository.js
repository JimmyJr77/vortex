/**
 * Loads only coach-approved canonical cards. Legacy review rows are deliberately
 * invisible until definition, variant, profile, scores, and media are approved.
 */
export async function loadPublishedCanonicalLibrary(pool, facilityId) {
  const [result, relationshipResult] = await Promise.all([
    pool.query(
    `
      SELECT
        d.id AS definition_id, d.slug, d.canonical_name, d.display_name,
        d.family_key, d.card_version, d.schema_version,
        d.content_confidence, d.scoring_confidence, d.media_confidence,
        d.movement_patterns, d.body_regions, d.required_equipment,
        d.optional_equipment, d.environment_json, d.population_json,
        d.anatomy_json, d.athlete_support_json, d.coach_support_json,
        d.support_operations_json,
        d.approved_video_url, d.approved_by,
        v.id AS variant_id, v.difficulty_json, v.requirements_json,
        v.load_profile_json, v.fatigue_profile_json, v.programming_profile_json,
        p.id AS profile_id, p.profile_key, p.phase_key, p.role, p.purpose,
        p.phase_suitability, p.methodology_alignment,
        p.objective_relevance_json, p.dosage_json, p.quality_gate,
        p.stop_rules, p.coach_instructions, p.athlete_instructions,
        p.expected_adaptation, p.equipment_required, p.logistics_json,
        p.substitution_ids, p.time_model_json, p.dose_scaling_json,
        p.measurement_json, p.support_prompts_json
      FROM coaching.exercise_definition_v1 d
      JOIN coaching.exercise_variant_v1 v
        ON v.definition_id = d.id AND v.status = 'published'
      JOIN coaching.exercise_delivery_profile_v1 p
        ON p.variant_id = v.id AND p.status = 'published' AND p.role != 'avoid'
      WHERE d.facility_id = $1
        AND d.status = 'published'
        AND d.approved_by IS NOT NULL
        AND d.approved_video_url IS NOT NULL
      ORDER BY d.slug, v.variant_key, p.phase_key, p.profile_key
    `,
    [facilityId],
    ),
    pool.query(
      `SELECT r.id, r.from_variant_id, r.to_variant_id, r.relationship,
              r.similarity_score, r.dimensions, r.reason, r.conditions_json
       FROM coaching.exercise_relationship_v1 r
       JOIN coaching.exercise_variant_v1 fv ON fv.id=r.from_variant_id AND fv.status='published'
       JOIN coaching.exercise_definition_v1 fd ON fd.id=fv.definition_id
         AND fd.facility_id=$1 AND fd.status='published'
       JOIN coaching.exercise_variant_v1 tv ON tv.id=r.to_variant_id AND tv.status='published'
       JOIN coaching.exercise_definition_v1 td ON td.id=tv.definition_id
         AND td.facility_id=$1 AND td.status='published'
       WHERE r.review_status='approved'
       ORDER BY r.from_variant_id, r.relationship, r.similarity_score DESC`,
      [facilityId],
    ),
  ])

  const cards = new Map()
  for (const row of result.rows) {
    const key = String(row.variant_id)
    let card = cards.get(key)
    if (!card) {
      card = {
        id: String(row.definition_id),
        variantId: String(row.variant_id),
        slug: row.slug,
        canonicalName: row.canonical_name,
        displayName: row.display_name,
        cardVersion: Number(row.card_version),
        schemaVersion: row.schema_version,
        status: 'published',
        familyId: row.family_key,
        approvedBy: String(row.approved_by),
        contentConfidence: Number(row.content_confidence),
        scoringConfidence: Number(row.scoring_confidence),
        mediaConfidence: Number(row.media_confidence),
        movementPatterns: row.movement_patterns ?? [],
        bodyRegions: row.body_regions ?? [],
        equipment: {
          required: row.required_equipment ?? [],
          optional: row.optional_equipment ?? [],
          quantityPerStation: row.requirements_json?.equipmentQuantityPerStation ?? {},
        },
        environment: row.environment_json ?? {},
        population: row.population_json ?? {},
        athleteSupport: row.athlete_support_json ?? {},
        coachSupport: row.coach_support_json ?? {},
        supportOperations: row.support_operations_json ?? {},
        anatomy: row.anatomy_json ?? {},
        difficulty: row.difficulty_json ?? {},
        loadProfile: row.load_profile_json ?? {},
        fatigueProfile: row.fatigue_profile_json ?? {},
        programming: row.programming_profile_json ?? {},
        media: { approvedVideoUrl: row.approved_video_url },
        deliveryProfiles: [],
      }
      cards.set(key, card)
    }
    card.deliveryProfiles.push({
      id: String(row.profile_id),
      key: row.profile_key,
      phaseKey: row.phase_key,
      role: row.role,
      purpose: row.purpose,
      phaseSuitability: Number(row.phase_suitability),
      methodologyAlignment: row.methodology_alignment == null ? null : Number(row.methodology_alignment),
      objectiveRelevance: row.objective_relevance_json ?? {},
      dosage: row.dosage_json ?? {},
      qualityGate: row.quality_gate,
      stopRules: row.stop_rules ?? [],
      coachInstructions: row.coach_instructions,
      athleteInstructions: row.athlete_instructions,
      expectedAdaptation: row.expected_adaptation,
      equipmentRequired: row.equipment_required ?? [],
      substitutions: (row.substitution_ids ?? []).map(String),
      timeModel: row.time_model_json ?? {},
      doseScaling: row.dose_scaling_json ?? {},
      measurement: row.measurement_json ?? {},
      supportPrompts: row.support_prompts_json ?? {},
      ...(row.logistics_json ?? {}),
    })
  }
  for (const row of relationshipResult.rows) {
    const card = cards.get(String(row.from_variant_id))
    if (!card) continue
    const relationship = {
      id: String(row.id),
      toVariantId: String(row.to_variant_id),
      type: row.relationship,
      similarityScore: Number(row.similarity_score),
      dimensions: row.dimensions ?? [],
      reason: row.reason,
      conditions: row.conditions_json ?? {},
    }
    if (!card.relationships) card.relationships = []
    card.relationships.push(relationship)
    if (['regression', 'lateral_substitution', 'equipment_equivalent', 'phase_equivalent'].includes(row.relationship)) {
      for (const profile of card.deliveryProfiles) {
        profile.substitutions = [...new Set([...profile.substitutions, String(row.to_variant_id)])]
      }
    }
  }
  return [...cards.values()]
}

export async function loadCurrentCanonicalLibraryRelease(pool, facilityId) {
  const result = await pool.query(
    `SELECT * FROM coaching.workout_library_release_v1
     WHERE facility_id = $1 AND status = 'published'
     ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT 1`,
    [facilityId],
  )
  return result.rows[0] ?? null
}

export async function persistCanonicalWorkout(pool, facilityId, userId, release, output) {
  const result = await pool.query(
    `INSERT INTO coaching.generated_workout_v1 (
       facility_id, library_release_id, schema_version, generator_version,
       rule_version, model_version, mode, random_seed, intent_json,
       output_json, validation_json, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12)
     RETURNING id`,
    [
      facilityId,
      release?.id ?? null,
      output.schemaVersion,
      output.generatorVersion,
      output.ruleVersion,
      output.modelVersion ?? null,
      output.mode,
      output.randomSeed,
      JSON.stringify(output.intent),
      JSON.stringify(output),
      JSON.stringify(output.validation),
      userId,
    ],
  )
  return result.rows[0].id
}
