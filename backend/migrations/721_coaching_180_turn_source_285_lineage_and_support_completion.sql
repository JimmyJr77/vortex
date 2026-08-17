-- Preserve the pre-existing source-285 row as non-selectable lineage and add
-- operationally complete candidate support to the exact source-160 card.
-- This does not approve media, relationships, calibration, or publication.
DO $planned_180_turn_source_285_lineage_and_support_completion$
DECLARE
  migration_key CONSTANT TEXT := '721_coaching_180_turn_source_285_lineage_and_support_completion';
  definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='180-degree-turn-shuttle-cut' AND status='review';

  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION '% requires the active planned 180-degree-turn review definition', migration_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE id=definition_id_value
      AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to change a human-reviewed card', migration_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_definition_source_v1
    WHERE definition_id=definition_id_value AND legacy_exercise_id=285
  ) THEN
    RAISE EXCEPTION '% requires source 285 to remain mapped to this definition', migration_key;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET status='archived',
      requirements_json=requirements_json || jsonb_build_object(
        'selectable',FALSE,
        'representation','legacy_source_skeleton',
        'sourceLegacyExerciseId',285,
        'archiveReason','Source 285 lacks the exact approach and exit geometry, turn-foot, braking, pivot, line-validity, dose, fatigue, support, alternate, and review contract.',
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE
      ),
      programming_profile_json=programming_profile_json || jsonb_build_object(
        'selectionStatus','legacy_source_skeleton',
        'selectable',FALSE,
        'publicationQuarantined',TRUE
      ),
      updated_at=now()
  WHERE definition_id=definition_id_value
    AND variant_key='baseline-source-285'
    AND status<>'archived';

  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_variant_v1
    WHERE definition_id=definition_id_value
      AND variant_key='baseline-source-285'
      AND status='archived'
      AND requirements_json->>'sourceLegacyExerciseId'='285'
      AND requirements_json->>'selectable'='false'
  ) THEN
    RAISE EXCEPTION '% failed to preserve source-285 lineage as archived', migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET athlete_support_json=athlete_support_json || jsonb_build_object(
        'painGuidance','Stop rather than forcing a brake, plant, or exit through pain, slipping, collapse, dizziness, or a new concerning symptom; report it to the coach and follow facility escalation policy.',
        'mediaAlternatives',jsonb_build_object(
          'captionsRequired',TRUE,
          'transcriptRequired',TRUE,
          'stillSequenceRequired',TRUE,
          'audioDescriptionRequired',TRUE,
          'humanReviewRequired',TRUE,
          'approvedMediaAvailable',FALSE
        )
      ),
      coach_support_json=coach_support_json || jsonb_build_object(
        'demonstrationPlan',jsonb_build_array(
          'show the protected approach, brake zone, turn line, exit lane, and stop signal',
          'show a lower-speed valid repetition with declared plant side and one turn only',
          'show invalid late braking, line overrun, collapse, slip, and false exit step',
          'confirm the athlete can state the turn foot, exit direction, line rule, and stop signal before speed rises'
        ),
        'groupManagement',jsonb_build_array(
          'use one athlete per protected lane and do not permit cross traffic',
          'stage athletes behind the approach start and release only after the prior athlete clears the finish zone',
          'assign, record, and balance planned turn side, entry speed, valid trials, rest, symptoms, and total COD exposure',
          'keep a coach sightline to braking contacts, plant, exit, and the stop signal'
        ),
        'modificationDecisionTree',jsonb_build_array(
          jsonb_build_object('when','pain_slip_collapse_dizziness_or_unsafe_lane','action','stop_and_escalate_under_facility_policy'),
          jsonb_build_object('when','late_braking_or_line_overrun_at_current_speed','action','shorten_or_slow_approach_then_revalidate_exact_profile'),
          jsonb_build_object('when','plant_or_exit_control_cannot_be_restored','action','end_this_task_and_select_a_separately_reviewed_option_after_full_revalidation'),
          jsonb_build_object('when','cue_route_turn_count_or_testing_protocol_changes','action','do_not_substitute_automatically; rerun_identity_selection_budgets_logistics_duration_and_validation')
        )
      ),
      support_operations_json=support_operations_json || jsonb_build_object(
        'retentionPolicy','Persist the versioned definition and exact variant, declared and actual approach/exit distance, entry-speed context, turn foot, pivot and line rule, valid trials, first fault, symptoms, rest, total COD and braking exposure, substitution, stop reason, and rendering/generator versions under facility policy.'
      ),
      provenance_json=provenance_json || jsonb_build_object(
        'supportCompletenessMigration',migration_key,
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE,
        'publicationQuarantined',TRUE
      ),
      card_version=GREATEST(card_version,4),
      updated_at=now()
  WHERE id=definition_id_value;

  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id=definition_id_value
      AND athlete_support_json ?& ARRAY['painGuidance','mediaAlternatives']::TEXT[]
      AND coach_support_json ?& ARRAY['demonstrationPlan','groupManagement','modificationDecisionTree']::TEXT[]
      AND support_operations_json ? 'retentionPolicy'
      AND provenance_json->>'supportCompletenessMigration'=migration_key
      AND provenance_json->>'approvalsCreated'='false'
      AND provenance_json->>'publicationQuarantined'='true'
      AND card_version>=4
  ) THEN
    RAISE EXCEPTION '% failed to persist candidate support completion', migration_key;
  END IF;
END;
$planned_180_turn_source_285_lineage_and_support_completion$;
