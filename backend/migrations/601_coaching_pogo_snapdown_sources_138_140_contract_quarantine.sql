-- Source 138 does not specify hold duration, takeoff leg, hop direction,
-- landing leg, stick/rebound rule, dosage, or fatigue.  Source 140 omits the
-- rebound direction, amplitude, contact target, arm policy, landing/reset,
-- impact cap, and workload.  Neither can be offered as one exact variant.
DO $pogo_snapdown_quarantine$
DECLARE source_record RECORD;
BEGIN
  FOR source_record IN
    SELECT * FROM (VALUES
      (138, 'single-leg-pogo-hold-to-hop', 'Single-Leg Pogo Hold-to-Hop Contract Quarantine — Source 138', 'hold_duration_takeoff_leg_hop_direction_landing_leg_stick_or_rebound_rule_dosage_load_and_fatigue_are_unspecified'),
      (140, 'snap-down-to-rebound', 'Snap-Down to Rebound Contract Quarantine — Source 140', 'rebound_direction_amplitude_contact_target_arm_policy_landing_or_reset_impact_cap_dosage_load_and_fatigue_are_unspecified')
    ) AS source_data(legacy_id, slug_value, display_value, unresolved_value)
  LOOP
    UPDATE coaching.exercise_variant_v1 v
    SET variant_key='identity-quarantine-source-' || source_record.legacy_id,
        display_name=source_record.display_value,status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',source_record.unresolved_value),
        difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,
        programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    FROM coaching.exercise_definition_v1 d
    WHERE v.definition_id=d.id AND d.facility_id=1 AND d.legacy_exercise_id=source_record.legacy_id AND d.slug=source_record.slug_value AND v.variant_key='baseline';
    UPDATE coaching.exercise_definition_v1 d
    SET status='archived',card_version=card_version+1,
        provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE d.facility_id=1 AND d.legacy_exercise_id=source_record.legacy_id AND d.slug=source_record.slug_value;
  END LOOP;
END;
$pogo_snapdown_quarantine$;
