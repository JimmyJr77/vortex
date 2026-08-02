-- Complete the generic load-profile schema contract for the Nordic family.
-- A planned hand catch is recorded separately and is not a lower-body landing.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '466_coaching_nordic_hamstring_machine_gate_completion';
  canonical_id CONSTANT UUID := '03894b45-360d-444b-a142-6771ce6df7dd';
  active_variant_ids CONSTANT UUID[] := ARRAY[
    '12796771-cd0b-4344-ab3b-e91f579b5473'::UUID,
    'a4e727f1-6e9b-41d5-aa10-88a9a15a3a2c'::UUID,
    '8d3befd9-33a1-4686-a421-9d766c540df9'::UUID,
    'ee63d821-8e03-4402-b1a5-355705ce43fc'::UUID];
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=canonical_id AND id=ANY(active_variant_ids)
        AND status='review')<>4 THEN
    RAISE EXCEPTION '% Nordic working variants are missing or drifted',
      migration_key;
  END IF;

  UPDATE coaching.exercise_variant_v1 SET
    load_profile_json=load_profile_json||jsonb_build_object(
      'landingContactsPerRep',0,
      'handCatchAccounting','planned_two_hand_catch_is_recorded_as_upper_extremity_contact_and_incident_exposure_not_lower_body_landing'),
    updated_at=now()
  WHERE definition_id=canonical_id AND id=ANY(active_variant_ids)
    AND status='review';

  UPDATE coaching.exercise_card_test_packet_v1 SET
    audit_version=migration_key,
    checks_json=jsonb_set(
      checks_json,
      '{loadFatigueRecovery}',
      coalesce(checks_json->'loadFatigueRecovery','{}'::JSONB)||
        jsonb_build_object(
          'passed',TRUE,'landingContactsPerRep',0,
          'plannedHandCatchIsNotLowerBodyLanding',TRUE),
      TRUE),
    checked_at=now()
  WHERE definition_id=canonical_id;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=canonical_id AND id=ANY(active_variant_ids)
        AND load_profile_json->>'landingContactsPerRep'='0'
        AND load_profile_json->>'handCatchAccounting'=
          'planned_two_hand_catch_is_recorded_as_upper_extremity_contact_and_incident_exposure_not_lower_body_landing')<>4 THEN
    RAISE EXCEPTION '% did not complete Nordic load profiles',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise WHERE id IN(4,574,839)
      AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id IN(4,574,839) AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_id
        AND (status<>'quarantined' OR human_review_required<>TRUE
          OR jsonb_array_length(blocking_issues_json)<>4)) THEN
    RAISE EXCEPTION '% changed proficiency or human-review quarantine',
      migration_key;
  END IF;
END;
$$;
