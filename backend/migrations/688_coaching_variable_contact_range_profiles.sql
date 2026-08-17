-- Normalise exact range-based contact exposure without pretending distance-pass
-- drills have a universal per-repetition contact count. All values remain review-only.
DO $variable_contact_range_profiles$
DECLARE
  migration_key CONSTANT TEXT := '688_coaching_variable_contact_range_profiles';
  spec RECORD;
  definition_id_value UUID;
  prior_version INTEGER;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('high-dribble-run'::TEXT, 'high-knee-recovery'::TEXT, 20, 30, 40, 1, 8, 20, 32, 56, 34, 1, 16),
    ('high-dribble-run'::TEXT, 'low-ankle-shin-recovery'::TEXT, 20, 30, 40, 1, 6, 18, 26, 48, 28, 1, 12),
    ('ankling-drill'::TEXT, 'baseline'::TEXT, 16, 28, 40, 1, 6, 18, 20, 42, 23, 1, 12),
    ('straight-leg-bounds-to-sprint'::TEXT, 'baseline'::TEXT, 20, 28, 40, 1, 12, 62, 66, 76, 70, 1, 48),
    ('dribble-build-to-sprint'::TEXT, 'baseline'::TEXT, 45, 60, 90, 1, 14, 58, 64, 75, 62, 1, 48),
    ('power-skip-for-distance'::TEXT, 'baseline'::TEXT, 6, 8, 12, 1, 10, 48, 45, 58, 57, 1, 36),
    ('distance-jump-straight-leg-bound-march'::TEXT, 'baseline'::TEXT, 20, 30, 40, 1, 6, 10, 14, 44, 20, 1, 12),
    ('distance-jump-straight-leg-bound'::TEXT, 'baseline'::TEXT, 4, 8, 12, 1, 12, 60, 64, 66, 68, 1, 48)
  ) AS cards(slug, variant_key, minimum_contacts, planning_default_contacts, maximum_contacts, grip, spinal, eccentric, local_fatigue, technical_fatigue, impact_accumulation, grip_fatigue, recovery_hours)
  LOOP
    SELECT id, card_version INTO definition_id_value, prior_version
    FROM coaching.exercise_definition_v1 WHERE facility_id = 1 AND slug = spec.slug AND status = 'review';
    IF definition_id_value IS NULL THEN RAISE EXCEPTION '% requires review candidate %', migration_key, spec.slug; END IF;
    IF EXISTS (SELECT 1 FROM coaching.exercise_definition_v1 WHERE id = definition_id_value
               AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)) THEN
      RAISE EXCEPTION '% refuses to overwrite reviewed candidate %', migration_key, spec.slug;
    END IF;
    UPDATE coaching.exercise_variant_v1
    SET load_profile_json = COALESCE(load_profile_json, '{}'::jsonb) || jsonb_build_object(
          'gripDemand', spec.grip, 'spinalLoading', spec.spinal, 'eccentricStress', spec.eccentric,
          'externalLoadMethod', 'bodyweight',
          'contactExposureModel', jsonb_build_object(
            'model', 'per_set_range',
            'minimumContactsPerSet', spec.minimum_contacts,
            'planningDefaultContactsPerSet', spec.planning_default_contacts,
            'maximumContactsPerSet', spec.maximum_contacts,
            'source', 'declared_delivery_profile_range',
            'humanReviewRequired', true
          )
        ), fatigue_profile_json = COALESCE(fatigue_profile_json, '{}'::jsonb) || jsonb_build_object(
          'localMuscleFatigue', spec.local_fatigue, 'technicalFatigueSensitivity', spec.technical_fatigue,
          'impactAccumulation', spec.impact_accumulation, 'gripFatigue', spec.grip_fatigue,
          'recoveryHours', spec.recovery_hours
        ), updated_at = now()
    WHERE definition_id = definition_id_value AND variant_key = spec.variant_key AND status = 'review';
    IF NOT EXISTS (SELECT 1 FROM coaching.exercise_variant_v1 WHERE definition_id = definition_id_value
                   AND variant_key = spec.variant_key AND status = 'review'
                   AND load_profile_json ?& ARRAY['gripDemand', 'spinalLoading', 'eccentricStress', 'externalLoadMethod']
                   AND load_profile_json->'contactExposureModel' ?& ARRAY['model', 'minimumContactsPerSet', 'planningDefaultContactsPerSet', 'maximumContactsPerSet']
                   AND fatigue_profile_json ?& ARRAY['localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity', 'impactAccumulation', 'recoveryHours']) THEN
      RAISE EXCEPTION '% failed range-profile completion for %', migration_key, spec.slug;
    END IF;
    UPDATE coaching.exercise_definition_v1 SET card_version = prior_version + 1,
      provenance_json = COALESCE(provenance_json, '{}'::jsonb) || jsonb_build_object(
        'operationalProfileCompletion', migration_key, 'operationalEstimateStatus', 'candidate_unapproved_planning_estimates',
        'contactExposureBasis', 'bounded_per_set_range_declared_by_delivery_profile',
        'humanReviewRequired', true, 'approvalsCreated', false, 'publicationQuarantined', true
      ), updated_at = now() WHERE id = definition_id_value;
    UPDATE coaching.exercise_section_evidence_v1 SET reviewed_card_version = prior_version + 1, updated_at = now()
    WHERE definition_id = definition_id_value AND reviewed_card_version = prior_version AND review_status = 'candidate';
    UPDATE coaching.exercise_media_candidate_v1 SET reviewed_card_version = prior_version + 1, updated_at = now()
    WHERE definition_id = definition_id_value AND reviewed_card_version = prior_version AND review_status = 'candidate';
    UPDATE coaching.exercise_alternate_assessment_v1 SET reviewed_card_version = prior_version + 1, updated_at = now()
    WHERE definition_id = definition_id_value AND reviewed_card_version = prior_version AND review_status = 'candidate';
  END LOOP;
END;
$variable_contact_range_profiles$;
