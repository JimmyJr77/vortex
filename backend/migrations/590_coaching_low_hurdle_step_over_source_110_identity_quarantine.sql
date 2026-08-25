-- Source 110 explicitly bundles hurdle and cone-line targets, forward and
-- lateral travel, over-and-back repetitions, and lead-leg variations.  Those
-- choices change the movement contract, laterality accounting, lane layout,
-- dosage, and fatigue budget, so this source cannot safely publish one
-- selectable exercise card.
DO $source_110_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1
    AND legacy_exercise_id=110
    AND slug='low-hurdle-step-over';

  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION 'Source 110 canonical definition missing';
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key='identity-quarantine-source-110',
      display_name='Low Hurdle Step-Over Series Identity Quarantine — Source 110',
      status='archived',
      requirements_json=jsonb_build_object(
        'selectable',false,
        'identityQuarantine',true,
        'unresolvedContract','hurdle_vs_cone_line_forward_vs_lateral_over_and_back_lead_leg_target_height_contact_order_exit_count_load_and_fatigue_are_conflated'
      ),
      difficulty_json='{}'::JSONB,
      load_profile_json='{}'::JSONB,
      fatigue_profile_json='{}'::JSONB,
      programming_profile_json=jsonb_build_object(
        'selectable',false,
        'humanReviewRequired',true,
        'publicationQuarantined',true
      )
  WHERE definition_id=definition_id_value
    AND variant_key='baseline';

  UPDATE coaching.exercise_definition_v1
  SET status='archived',
      card_version=card_version+1,
      provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
        'sourceDisposition','identity_quarantine',
        'humanReviewRequired',true,
        'approvalsCreated',false,
        'publicationQuarantined',true,
        'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only',
        'unresolvedIdentity',jsonb_build_array(
          'hurdle_vs_cone_line_target',
          'forward_vs_lateral_vs_over_and_back_travel',
          'lead_leg_target_height_and_contact_order',
          'exit_count_load_and_fatigue'
        )
      )
  WHERE id=definition_id_value;
END;
$source_110_quarantine$;
