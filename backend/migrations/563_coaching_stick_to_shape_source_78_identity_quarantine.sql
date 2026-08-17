-- Source 78 permits multiple unrelated target shapes and two movement bases.
-- It is retained for lineage but cannot become a selectable exercise contract.
DO $source_78_quarantine$
DECLARE
  definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=78 AND slug='stick-to-shape-freeze-game';
  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION 'Source 78 canonical definition missing';
  END IF;
  UPDATE coaching.exercise_variant_v1
  SET variant_key='identity-quarantine-source-78', display_name='Stick-to-Shape Freeze Game Identity Quarantine — Source 78', status='archived',
      requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','target_shape_locomotor_base_and_round_rules_are_unspecified'),
      difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1
  SET status='archived', card_version=card_version+1,
      provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'unresolvedIdentity',jsonb_build_array('target_shape','locomotor_base','exact_cue_round_and_quality_contract'))
  WHERE id=definition_id_value;
END;
$source_78_quarantine$;
