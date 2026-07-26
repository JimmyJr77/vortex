const REVIEW_OUTCOMES = new Set(['keep', 'minor_edit', 'major_edit', 'reject'])
const EDIT_REASONS = new Set([
  'objective_mismatch',
  'phase_mismatch',
  'readiness',
  'safety',
  'equipment',
  'logistics',
  'variety',
  'recent_exposure',
  'unclear_instruction',
  'dosage',
  'coach_preference',
])

function percent(numerator, denominator) {
  if (!denominator) return null
  return Math.round((Number(numerator) / Number(denominator)) * 10000) / 100
}

export async function buildCanonicalDataQualityReport(pool, facilityId) {
  const [coverageResult, phaseResult, graphResult, reviewResult, governanceResult] = await Promise.all([
    pool.query(
      `
        SELECT
          COUNT(DISTINCT d.id)::int AS total_definitions,
          COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'published')::int AS published_definitions,
          COUNT(DISTINCT d.id) FILTER (WHERE d.approved_video_url IS NOT NULL)::int AS video_complete,
          COUNT(DISTINCT d.id) FILTER (WHERE d.content_confidence IS NOT NULL
            AND d.scoring_confidence IS NOT NULL AND d.media_confidence IS NOT NULL)::int AS confidence_complete,
          COUNT(DISTINCT d.id) FILTER (WHERE v.status = 'published')::int AS with_published_variant,
          COUNT(DISTINCT d.id) FILTER (WHERE p.status = 'published')::int AS with_published_profile,
          COUNT(DISTINCT d.id) FILTER (WHERE
            v.difficulty_json ? 'technicalComplexity'
            AND v.difficulty_json ? 'absoluteLoadDemand'
            AND v.difficulty_json ? 'supervisionDemand'
            AND v.difficulty_json ? 'failureConsequence'
            AND v.difficulty_json ? 'impact'
            AND v.difficulty_json ? 'baseOverallDifficulty'
            AND CASE
              WHEN jsonb_typeof(v.difficulty_json->'baseOverallDifficulty') = 'number'
                AND jsonb_typeof(v.difficulty_json->'technicalComplexity') = 'number'
                AND jsonb_typeof(v.difficulty_json->'absoluteLoadDemand') = 'number'
              THEN (v.difficulty_json->>'baseOverallDifficulty')::numeric = GREATEST(
                (v.difficulty_json->>'technicalComplexity')::numeric,
                (v.difficulty_json->>'absoluteLoadDemand')::numeric
              )
              ELSE FALSE
            END
          )::int AS score_complete,
          COUNT(DISTINCT d.id) FILTER (WHERE
            jsonb_array_length(COALESCE(d.anatomy_json->'joints', '[]'::jsonb)) > 0
            AND jsonb_array_length(COALESCE(d.anatomy_json->'planes', '[]'::jsonb)) > 0
            AND COALESCE(d.anatomy_json->>'laterality', '') != ''
          )::int AS anatomy_complete,
          COUNT(DISTINCT d.id) FILTER (WHERE
            v.load_profile_json ?& ARRAY[
              'gripDemand', 'spinalLoading', 'eccentricStress',
              'landingContactsPerRep', 'externalLoadMethod'
            ]
          )::int AS load_profile_complete,
          COUNT(DISTINCT d.id) FILTER (WHERE
            v.fatigue_profile_json ?& ARRAY[
              'localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity',
              'impactAccumulation', 'recoveryHours'
            ]
          )::int AS fatigue_profile_complete,
          COUNT(DISTINCT d.id) FILTER (WHERE
            d.athlete_support_json != '{}'::jsonb
            AND d.coach_support_json != '{}'::jsonb
            AND d.support_operations_json != '{}'::jsonb
          )::int AS support_complete,
          COUNT(DISTINCT d.id) FILTER (WHERE
            v.programming_profile_json != '{}'::jsonb
            AND p.time_model_json != '{}'::jsonb
            AND p.dose_scaling_json != '{}'::jsonb
            AND p.measurement_json != '{}'::jsonb
            AND p.support_prompts_json != '{}'::jsonb
          )::int AS operational_profile_complete,
          COUNT(DISTINCT d.id) FILTER (WHERE (
            SELECT COUNT(DISTINCT e.section_key)
            FROM coaching.exercise_section_evidence_v1 e
            WHERE e.definition_id=d.id
              AND e.reviewed_card_version=d.card_version
              AND e.review_status IN ('candidate','reviewed')
          ) = 16)::int AS research_candidate_sections_complete,
          COUNT(DISTINCT d.id) FILTER (WHERE (
            SELECT COUNT(DISTINCT e.section_key)
            FROM coaching.exercise_section_evidence_v1 e
            WHERE e.definition_id=d.id
              AND e.reviewed_card_version=d.card_version
              AND e.review_status='reviewed'
          ) = 16)::int AS research_sections_complete,
          (
            SELECT COUNT(DISTINCT (e.definition_id, e.section_key))::int
            FROM coaching.exercise_section_evidence_v1 e
            JOIN coaching.exercise_definition_v1 evidence_definition
              ON evidence_definition.id=e.definition_id
            WHERE evidence_definition.facility_id=$1
              AND evidence_definition.status!='archived'
              AND e.reviewed_card_version=evidence_definition.card_version
              AND e.review_status IN ('candidate','reviewed')
          ) AS research_candidate_section_count,
          (
            SELECT COUNT(DISTINCT (e.definition_id, e.section_key))::int
            FROM coaching.exercise_section_evidence_v1 e
            JOIN coaching.exercise_definition_v1 evidence_definition
              ON evidence_definition.id=e.definition_id
            WHERE evidence_definition.facility_id=$1
              AND evidence_definition.status!='archived'
              AND e.reviewed_card_version=evidence_definition.card_version
              AND e.review_status='reviewed'
          ) AS research_reviewed_section_count,
          COUNT(DISTINCT d.id) FILTER (WHERE (
            SELECT COUNT(DISTINCT m.video_id)
            FROM coaching.exercise_media_candidate_v1 m
            WHERE m.definition_id=d.id
              AND m.reviewed_card_version=d.card_version
              AND m.review_status IN ('candidate','shortlisted','approved')
          ) BETWEEN 3 AND 5)::int AS media_candidate_set_complete,
          COUNT(DISTINCT d.id) FILTER (WHERE (
            SELECT COUNT(DISTINCT m.video_id)
            FROM coaching.exercise_media_candidate_v1 m
            WHERE m.definition_id=d.id
              AND m.reviewed_card_version=d.card_version
              AND m.review_status IN ('candidate','shortlisted','approved')
              AND m.link_status='healthy'
              AND m.embedding_allowed IS TRUE
          ) BETWEEN 3 AND 5)::int AS media_embeddable_candidate_set_complete,
          COUNT(DISTINCT d.id) FILTER (WHERE (
            SELECT COUNT(DISTINCT m.video_id)
            FROM coaching.exercise_media_candidate_v1 m
            WHERE m.definition_id=d.id
              AND m.reviewed_card_version=d.card_version
              AND m.review_status='approved'
          ) BETWEEN 3 AND 5)::int AS media_approved_set_complete,
          COUNT(DISTINCT d.id) FILTER (WHERE EXISTS (
            SELECT 1 FROM coaching.exercise_alternate_assessment_v1 a
            WHERE a.definition_id=d.id
              AND a.reviewed_card_version=d.card_version
              AND a.review_status IN ('candidate','reviewed','approved')
          ))::int AS alternates_candidate_assessed,
          COUNT(DISTINCT d.id) FILTER (WHERE EXISTS (
            SELECT 1 FROM coaching.exercise_alternate_assessment_v1 a
            WHERE a.definition_id=d.id
              AND a.reviewed_card_version=d.card_version
              AND a.review_status IN ('reviewed','approved')
          ))::int AS alternates_reviewed
        FROM coaching.exercise_definition_v1 d
        LEFT JOIN coaching.exercise_variant_v1 v ON v.definition_id = d.id
        LEFT JOIN coaching.exercise_delivery_profile_v1 p ON p.variant_id = v.id
        WHERE d.facility_id = $1 AND d.status != 'archived'
      `,
      [facilityId],
    ),
    pool.query(
      `
        SELECT p.phase_key, COUNT(DISTINCT v.id)::int AS candidate_count
        FROM coaching.exercise_definition_v1 d
        JOIN coaching.exercise_variant_v1 v ON v.definition_id = d.id AND v.status = 'published'
        JOIN coaching.exercise_delivery_profile_v1 p ON p.variant_id = v.id
          AND p.status = 'published' AND p.role != 'avoid'
        WHERE d.facility_id = $1 AND d.status = 'published'
        GROUP BY p.phase_key
        ORDER BY p.phase_key
      `,
      [facilityId],
    ),
    pool.query(
      `
        SELECT
          COUNT(*)::int AS total_edges,
          COUNT(*) FILTER (WHERE r.review_status = 'approved')::int AS approved_edges,
          COUNT(DISTINCT r.from_variant_id) FILTER (WHERE r.review_status = 'approved')::int AS connected_variants
        FROM coaching.exercise_relationship_v1 r
        JOIN coaching.exercise_variant_v1 v ON v.id = r.from_variant_id
        JOIN coaching.exercise_definition_v1 d ON d.id = v.definition_id
        WHERE d.facility_id = $1
      `,
      [facilityId],
    ),
    pool.query(
      `
        SELECT
          COUNT(*)::int AS review_count,
          COUNT(*) FILTER (WHERE r.outcome IN ('keep', 'minor_edit'))::int AS keep_minor_count,
          COALESCE(SUM(r.exercise_count), 0)::int AS exercise_count,
          COALESCE(SUM(r.swap_count), 0)::int AS swap_count,
          COALESCE(SUM(r.dose_edit_count), 0)::int AS dose_edit_count
        FROM coaching.generated_workout_review_v1 r
        JOIN coaching.generated_workout_v1 w ON w.id = r.generated_workout_id
        WHERE w.facility_id = $1
      `,
      [facilityId],
    ),
    pool.query(
      `
        SELECT
          COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'draft')::int AS draft_cards,
          COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'review')::int AS cards_in_review,
          COUNT(DISTINCT mr.definition_id) FILTER (
            WHERE mr.link_status IN ('broken', 'mismatched')
          )::int AS media_failures,
          COUNT(DISTINCT mr.definition_id) FILTER (
            WHERE mr.next_review_at IS NOT NULL AND mr.next_review_at <= now()
          )::int AS media_reviews_due,
          COUNT(DISTINCT rel.id) FILTER (WHERE rel.review_status = 'review')::int AS relationships_in_review,
          (
            SELECT COUNT(*)::int FROM coaching.exercise_score_calibration_v1 c
            WHERE c.facility_id=$1 AND c.status='review'
          ) AS calibrations_in_review,
          (
            SELECT COUNT(*)::int FROM coaching.exercise_score_calibration_v1 c
            WHERE c.facility_id=$1 AND c.status='approved'
          ) AS approved_calibration_anchors,
          (
            WITH identity_names AS (
              SELECT DISTINCT
                identity_definition.id AS definition_id,
                btrim(regexp_replace(lower(identity_name.value), '[^a-z0-9]+', ' ', 'g'))
                  AS normalized_name
              FROM coaching.exercise_definition_v1 identity_definition
              CROSS JOIN LATERAL unnest(
                ARRAY[identity_definition.canonical_name, identity_definition.display_name]
                || COALESCE(identity_definition.aliases, '{}'::text[])
              ) AS identity_name(value)
              WHERE identity_definition.facility_id=$1
                AND identity_definition.status!='archived'
                AND NULLIF(
                  btrim(regexp_replace(lower(identity_name.value), '[^a-z0-9]+', ' ', 'g')),
                  ''
                ) IS NOT NULL
            )
            SELECT COUNT(*)::int
            FROM (
              SELECT left_name.definition_id, right_name.definition_id
              FROM identity_names left_name
              JOIN identity_names right_name
                ON right_name.normalized_name=left_name.normalized_name
                AND right_name.definition_id>left_name.definition_id
              GROUP BY left_name.definition_id, right_name.definition_id
            ) exact_pairs
          ) AS exact_identity_collisions
        FROM coaching.exercise_definition_v1 d
        LEFT JOIN coaching.exercise_media_review_v1 mr ON mr.definition_id=d.id
        LEFT JOIN coaching.exercise_variant_v1 v ON v.definition_id=d.id
        LEFT JOIN coaching.exercise_relationship_v1 rel ON rel.from_variant_id=v.id
        WHERE d.facility_id=$1
      `,
      [facilityId],
    ),
  ])
  const coverage = coverageResult.rows[0] ?? {}
  const graph = graphResult.rows[0] ?? {}
  const reviews = reviewResult.rows[0] ?? {}
  const governance = governanceResult.rows[0] ?? {}
  const total = Number(coverage.total_definitions ?? 0)
  const poolDepth = Object.fromEntries(phaseResult.rows.map((row) => [row.phase_key, Number(row.candidate_count)]))
  const requiredPhases = [
    'prepare_and_access', 'movement_intelligence', 'output', 'capacity',
    'resilience', 'sustained_capacity', 'restore',
  ]
  return {
    generatedAt: new Date().toISOString(),
    facilityId,
    coverage: {
      totalDefinitions: total,
      publishedDefinitions: Number(coverage.published_definitions ?? 0),
      publicationPercent: percent(coverage.published_definitions, total),
      scoreCompletePercent: percent(coverage.score_complete, total),
      anatomyCompletePercent: percent(coverage.anatomy_complete, total),
      loadProfileCompletePercent: percent(coverage.load_profile_complete, total),
      fatigueProfileCompletePercent: percent(coverage.fatigue_profile_complete, total),
      supportCompletePercent: percent(coverage.support_complete, total),
      operationalProfileCompletePercent: percent(coverage.operational_profile_complete, total),
      researchCandidateCardsCompletePercent: percent(coverage.research_candidate_sections_complete, total),
      researchSectionsCompletePercent: percent(coverage.research_sections_complete, total),
      researchCandidateSectionCoveragePercent: percent(
        coverage.research_candidate_section_count,
        total * 16,
      ),
      researchReviewedSectionCoveragePercent: percent(
        coverage.research_reviewed_section_count,
        total * 16,
      ),
      mediaCandidateSetCompletePercent: percent(coverage.media_candidate_set_complete, total),
      mediaEmbeddableCandidateSetCompletePercent: percent(
        coverage.media_embeddable_candidate_set_complete,
        total,
      ),
      mediaApprovedSetCompletePercent: percent(coverage.media_approved_set_complete, total),
      alternatesCandidateAssessedPercent: percent(coverage.alternates_candidate_assessed, total),
      alternatesAssessedPercent: percent(coverage.alternates_candidate_assessed, total),
      alternatesReviewedPercent: percent(coverage.alternates_reviewed, total),
      confidenceCompletePercent: percent(coverage.confidence_complete, total),
      approvedVideoPercent: percent(coverage.video_complete, total),
      publishedVariantPercent: percent(coverage.with_published_variant, total),
      publishedDeliveryProfilePercent: percent(coverage.with_published_profile, total),
    },
    graph: {
      totalEdges: Number(graph.total_edges ?? 0),
      approvedEdges: Number(graph.approved_edges ?? 0),
      connectedVariants: Number(graph.connected_variants ?? 0),
    },
    poolDepthByPhase: Object.fromEntries(requiredPhases.map((phase) => [phase, poolDepth[phase] ?? 0])),
    zeroDepthPhases: requiredPhases.filter((phase) => !poolDepth[phase]),
    coachPilot: {
      reviewCount: Number(reviews.review_count ?? 0),
      keepOrMinorEditPercent: percent(reviews.keep_minor_count, reviews.review_count),
      swapPercent: percent(reviews.swap_count, reviews.exercise_count),
      doseEditPercent: percent(reviews.dose_edit_count, reviews.exercise_count),
    },
    governance: {
      draftCards: Number(governance.draft_cards ?? 0),
      cardsInReview: Number(governance.cards_in_review ?? 0),
      mediaFailures: Number(governance.media_failures ?? 0),
      mediaReviewsDue: Number(governance.media_reviews_due ?? 0),
      relationshipsInReview: Number(governance.relationships_in_review ?? 0),
      calibrationsInReview: Number(governance.calibrations_in_review ?? 0),
      approvedCalibrationAnchors: Number(governance.approved_calibration_anchors ?? 0),
      exactIdentityCollisions: Number(governance.exact_identity_collisions ?? 0),
    },
  }
}

function integer(value, field) {
  const number = Number(value ?? 0)
  if (!Number.isInteger(number) || number < 0) throw new RangeError(`${field} must be a non-negative integer`)
  return number
}

function optionalScore(value, field) {
  if (value == null || value === '') return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1 || number > 100) throw new RangeError(`${field} must be 1-100 or null`)
  return number
}

export async function recordCanonicalCoachReview(pool, generatedWorkoutId, reviewerId, raw) {
  if (!REVIEW_OUTCOMES.has(raw?.outcome)) throw new RangeError('invalid review outcome')
  const reasons = Array.isArray(raw.editReasons) ? [...new Set(raw.editReasons.map(String))] : []
  const invalidReasons = reasons.filter((reason) => !EDIT_REASONS.has(reason))
  if (invalidReasons.length) throw new RangeError(`invalid edit reasons: ${invalidReasons.join(', ')}`)
  const exerciseCount = integer(raw.exerciseCount, 'exerciseCount')
  const swapCount = integer(raw.swapCount, 'swapCount')
  const doseEditCount = integer(raw.doseEditCount, 'doseEditCount')
  if (swapCount > exerciseCount || doseEditCount > exerciseCount) {
    throw new RangeError('edit counts cannot exceed exerciseCount')
  }
  const scores = [
    'safetyScore', 'objectiveFidelityScore', 'phaseIntentScore', 'doseScore',
    'athleteFitScore', 'logisticsScore', 'clarityScore', 'overallScore',
  ].map((field) => optionalScore(raw[field], field))
  const result = await pool.query(
    `INSERT INTO coaching.generated_workout_review_v1 (
       generated_workout_id, reviewer_id, outcome, safety_score,
       objective_fidelity_score, phase_intent_score, dose_score,
       athlete_fit_score, logistics_score, clarity_score, overall_score,
       exercise_count, swap_count, dose_edit_count, edit_reasons_json, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)
     RETURNING *`,
    [
      generatedWorkoutId, reviewerId, raw.outcome, ...scores,
      exerciseCount, swapCount, doseEditCount, JSON.stringify(reasons), raw.notes ?? null,
    ],
  )
  return result.rows[0]
}

export async function recordAiIntentAudit(pool, {
  facilityId,
  userId,
  requestHash,
  modelVersion = null,
  status,
  interpretedIntent = null,
  validationErrors = [],
  latencyMs = null,
  usage = null,
}) {
  const validStatuses = new Set(['validated', 'clarification_required', 'invalid', 'service_unavailable'])
  if (!validStatuses.has(status)) throw new RangeError('invalid AI audit status')
  await pool.query(
    `INSERT INTO coaching.ai_workout_intent_audit_v1 (
       facility_id, user_id, request_hash, model_version, schema_version,
       status, interpreted_intent_json, validation_errors_json, latency_ms,
       input_tokens, output_tokens, estimated_cost_micros
     ) VALUES ($1,$2,$3,$4,'1.0.0',$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11)`,
    [
      facilityId,
      userId,
      requestHash,
      modelVersion,
      status,
      interpretedIntent == null ? null : JSON.stringify(interpretedIntent),
      JSON.stringify(validationErrors),
      latencyMs,
      usage?.inputTokens ?? null,
      usage?.outputTokens ?? null,
      usage?.estimatedCostMicros ?? null,
    ],
  )
}
