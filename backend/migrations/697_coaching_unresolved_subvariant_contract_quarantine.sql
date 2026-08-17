-- Archive only the unresolved subvariants within otherwise usable review
-- definitions.  Their own records defer identity and scoring, so assigning
-- difficulty/load data would fabricate a protocol; the exact sibling variants
-- remain untouched.
DO $unresolved_subvariant_quarantine$
DECLARE
  target RECORD;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('adductor-rockback', 'half-kneeling-kicking-access', 'half_kneeling_base_working_leg_path_load_rock_direction_and_terminal_position_are_unresolved'),
      ('adductor-rockback', 'reach-overlay-unresolved', 'reach_direction_arm_path_timing_support_and_intended_trunk_motion_are_unresolved'),
      ('backpedal-to-sprint-to-stick', 'free-deceleration-no-hold-unresolved', 'terminal_action_without_a_stick_crosses_an_identity_boundary_and_requires_human_protocol_review')
    ) AS target_data(slug_value, variant_key_value, unresolved_value)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_v1 d
      JOIN coaching.exercise_variant_v1 v ON v.definition_id=d.id
      WHERE d.facility_id=1 AND d.slug=target.slug_value
        AND v.variant_key=target.variant_key_value AND d.status='review' AND v.status='review'
    ) THEN
      RAISE EXCEPTION '697_coaching_unresolved_subvariant_contract_quarantine prerequisite missing for %.%', target.slug_value, target.variant_key_value;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_v1 d
      JOIN coaching.exercise_variant_v1 v ON v.definition_id=d.id
      WHERE d.facility_id=1 AND d.slug=target.slug_value AND v.variant_key=target.variant_key_value
        AND (d.reviewed_by IS NOT NULL OR d.approved_by IS NOT NULL OR d.last_reviewed_at IS NOT NULL)
    ) THEN
      RAISE EXCEPTION '697_coaching_unresolved_subvariant_contract_quarantine refuses human-reviewed %.%', target.slug_value, target.variant_key_value;
    END IF;

    UPDATE coaching.exercise_delivery_profile_v1 p
    SET status='archived', updated_at=now()
    FROM coaching.exercise_variant_v1 v
    JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id
    WHERE p.variant_id=v.id AND d.facility_id=1 AND d.slug=target.slug_value
      AND v.variant_key=target.variant_key_value AND p.status IN ('draft','review');

    UPDATE coaching.exercise_variant_v1 v
    SET variant_key='identity-quarantine-' || target.variant_key_value,
        display_name=v.display_name || ' — Contract Quarantine',
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract',target.unresolved_value),
        difficulty_json='{}'::jsonb,
        load_profile_json='{}'::jsonb,
        fatigue_profile_json='{}'::jsonb,
        programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true,'requiresExactProtocolBeforeCandidateCreation',true),
        updated_at=now()
    FROM coaching.exercise_definition_v1 d
    WHERE v.definition_id=d.id AND d.facility_id=1 AND d.slug=target.slug_value
      AND v.variant_key=target.variant_key_value;
  END LOOP;
END;
$unresolved_subvariant_quarantine$;
