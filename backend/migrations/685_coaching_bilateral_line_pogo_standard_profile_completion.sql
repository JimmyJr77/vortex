-- Complete shared standardized planning fields for exact bilateral low-amplitude
-- line-pogo candidates. Direction remains a variant identity, not an approval.
DO $bilateral_line_pogo_standard_profile_completion$
DECLARE
  migration_key CONSTANT TEXT := '685_coaching_bilateral_line_pogo_standard_profile_completion';
  spec RECORD;
  definition_id_value UUID;
  prior_version INTEGER;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('line-pogo-forward-back'::TEXT, 'two-foot-forward-back-low-amplitude'::TEXT),
    ('lateral-line-pogo'::TEXT, 'two-foot-side-to-side-low-amplitude'::TEXT)
  ) AS cards(slug, variant_key)
  LOOP
    SELECT id, card_version INTO definition_id_value, prior_version FROM coaching.exercise_definition_v1
    WHERE facility_id = 1 AND slug = spec.slug AND status = 'review';
    IF definition_id_value IS NULL THEN RAISE EXCEPTION '% requires review candidate %', migration_key, spec.slug; END IF;
    IF EXISTS (SELECT 1 FROM coaching.exercise_definition_v1 WHERE id = definition_id_value
               AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)) THEN
      RAISE EXCEPTION '% refuses to overwrite reviewed candidate %', migration_key, spec.slug;
    END IF;
    UPDATE coaching.exercise_variant_v1
    SET load_profile_json = COALESCE(load_profile_json, '{}'::jsonb) || jsonb_build_object(
          'gripDemand', 1, 'spinalLoading', 12, 'eccentricStress', 48
        ), fatigue_profile_json = COALESCE(fatigue_profile_json, '{}'::jsonb) || jsonb_build_object('gripFatigue', 1), updated_at = now()
    WHERE definition_id = definition_id_value AND variant_key = spec.variant_key AND status = 'review';
    IF NOT EXISTS (SELECT 1 FROM coaching.exercise_variant_v1 WHERE definition_id = definition_id_value
                   AND variant_key = spec.variant_key AND status = 'review'
                   AND load_profile_json ?& ARRAY['gripDemand', 'spinalLoading', 'eccentricStress', 'landingContactsPerRep', 'externalLoadMethod']
                   AND fatigue_profile_json ?& ARRAY['localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity', 'impactAccumulation', 'recoveryHours']) THEN
      RAISE EXCEPTION '% failed operational completion for %', migration_key, spec.slug;
    END IF;
    UPDATE coaching.exercise_definition_v1 SET card_version = prior_version + 1,
      provenance_json = COALESCE(provenance_json, '{}'::jsonb) || jsonb_build_object(
        'operationalProfileCompletion', migration_key, 'operationalEstimateStatus', 'candidate_unapproved_planning_estimates',
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
$bilateral_line_pogo_standard_profile_completion$;
