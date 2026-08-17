-- Source 84 identifies a diagonal shoulder-to-opposite-hip route but does not
-- define entry, exit, side assignment, arm route, surface, or count.  Those
-- facts are safety-critical and cannot be fabricated into a selectable card.
DO $source_84_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=84 AND slug='shoulder-roll-progression';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 84 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-84', display_name='Shoulder / Safety Roll Identity Quarantine — Source 84', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','entry_exit_side_assignment_arm_route_surface_and_repetition_unit_are_unspecified'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB,
    programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived', card_version=card_version+1,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('entry','exit','shoulder_side_assignment','arm_route','surface','repetition_unit'))
  WHERE id=definition_id_value;
END;
$source_84_quarantine$;
