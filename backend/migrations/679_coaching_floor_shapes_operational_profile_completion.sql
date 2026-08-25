-- Complete standardized planning fields for exact review candidates only.
-- Conservative operational estimates remain human-review-only and unpublished.
DO $floor_shapes_operational_profile_completion$
DECLARE
  migration_key CONSTANT TEXT := '679_coaching_floor_shapes_operational_profile_completion';
  spec RECORD;
  definition_id_value UUID;
  prior_version INTEGER;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('dynamic-supine-tuck-rock'::TEXT, 'supine-shins-wrapped-backward-forward-tuck-rock'::TEXT, 1, 6, 5, 1, 12),
    ('static-supine-tuck-hold'::TEXT, 'supine-shins-wrapped-static-tuck-hold'::TEXT, 1, 3, 2, 1, 8),
    ('pike-fold-tall-sit'::TEXT, 'seated-legs-together-extended-pike-fold-tall-cycle'::TEXT, 1, 4, 4, 1, 8),
    ('seated-straddle-reach-to-tall-cycle'::TEXT, 'seated-straddle-forward-reach-tall-return'::TEXT, 1, 5, 4, 1, 8),
    ('front-support-shape-hold'::TEXT, 'stable-floor-palms-forefeet-straight-arm-shape-hold'::TEXT, 10, 10, 8, 8, 12),
    ('rear-support-shape-hold'::TEXT, 'stable-floor-palms-behind-hips-bent-knee-rear-table-hold'::TEXT, 10, 8, 8, 8, 12),
    ('wall-body-line-drill'::TEXT, 'standing-stable-wall-available-contact-overhead-reach-recall'::TEXT, 1, 3, 3, 1, 4)
  ) AS cards(slug, variant_key, grip, spinal, eccentric, grip_fatigue, recovery_hours)
  LOOP
    SELECT id, card_version INTO definition_id_value, prior_version
    FROM coaching.exercise_definition_v1
    WHERE facility_id = 1 AND slug = spec.slug AND status = 'review';
    IF definition_id_value IS NULL THEN
      RAISE EXCEPTION '% requires review candidate %', migration_key, spec.slug;
    END IF;
    IF EXISTS (
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id = definition_id_value
        AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    ) THEN
      RAISE EXCEPTION '% refuses to overwrite reviewed candidate %', migration_key, spec.slug;
    END IF;

    UPDATE coaching.exercise_variant_v1
    SET load_profile_json = COALESCE(load_profile_json, '{}'::jsonb) || jsonb_build_object(
          'gripDemand', spec.grip,
          'spinalLoading', spec.spinal,
          'eccentricStress', spec.eccentric,
          'landingContactsPerRep', 0
        ),
        fatigue_profile_json = COALESCE(fatigue_profile_json, '{}'::jsonb) || jsonb_build_object(
          'gripFatigue', spec.grip_fatigue,
          'recoveryHours', spec.recovery_hours
        ),
        updated_at = now()
    WHERE definition_id = definition_id_value
      AND variant_key = spec.variant_key
      AND status = 'review';
    IF NOT EXISTS (
      SELECT 1 FROM coaching.exercise_variant_v1
      WHERE definition_id = definition_id_value
        AND variant_key = spec.variant_key
        AND status = 'review'
        AND load_profile_json ?& ARRAY['gripDemand', 'spinalLoading', 'eccentricStress', 'landingContactsPerRep', 'externalLoadMethod']
        AND fatigue_profile_json ?& ARRAY['localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity', 'impactAccumulation', 'recoveryHours']
    ) THEN
      RAISE EXCEPTION '% failed operational completion for %', migration_key, spec.slug;
    END IF;

    UPDATE coaching.exercise_definition_v1
    SET card_version = prior_version + 1,
        provenance_json = COALESCE(provenance_json, '{}'::jsonb) || jsonb_build_object(
          'operationalProfileCompletion', migration_key,
          'operationalEstimateStatus', 'candidate_unapproved_planning_estimates',
          'humanReviewRequired', true,
          'approvalsCreated', false,
          'publicationQuarantined', true
        ),
        updated_at = now()
    WHERE id = definition_id_value;
    UPDATE coaching.exercise_section_evidence_v1
    SET reviewed_card_version = prior_version + 1, updated_at = now()
    WHERE definition_id = definition_id_value AND reviewed_card_version = prior_version AND review_status = 'candidate';
    UPDATE coaching.exercise_media_candidate_v1
    SET reviewed_card_version = prior_version + 1, updated_at = now()
    WHERE definition_id = definition_id_value AND reviewed_card_version = prior_version AND review_status = 'candidate';
    UPDATE coaching.exercise_alternate_assessment_v1
    SET reviewed_card_version = prior_version + 1, updated_at = now()
    WHERE definition_id = definition_id_value AND reviewed_card_version = prior_version AND review_status = 'candidate';
  END LOOP;
END;
$floor_shapes_operational_profile_completion$;
