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
            AND v.difficulty_json ? 'supervisionDemand'
            AND v.difficulty_json ? 'failureConsequence'
            AND v.difficulty_json ? 'impact'
            AND v.difficulty_json ? 'baseOverallDifficulty'
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
          )::int AS operational_profile_complete
        FROM coaching.exercise_definition_v1 d
        LEFT JOIN coaching.exercise_variant_v1 v ON v.definition_id = d.id
        LEFT JOIN coaching.exercise_delivery_profile_v1 p ON p.variant_id = v.id
        WHERE d.facility_id = $1
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
            SELECT COUNT(*)::int
            FROM coaching.exercise_definition_v1 a
            JOIN coaching.exercise_definition_v1 b
              ON a.facility_id=b.facility_id AND a.id < b.id
            WHERE a.facility_id=$1
              AND a.status != 'archived' AND b.status != 'archived'
              AND (
                lower(a.canonical_name)=lower(b.canonical_name)
                OR lower(a.display_name)=lower(b.display_name)
                OR a.aliases && b.aliases
              )
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
