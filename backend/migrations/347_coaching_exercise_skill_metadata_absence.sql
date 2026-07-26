-- Enforce the exercise-card/skill-card boundary by removing obsolete
-- skill- or proficiency-level metadata from every exercise-card JSON surface
-- and nulling the deprecated relational exercise level columns.
--
-- Skill-library records are intentionally untouched. Exercise difficulty
-- remains exercise complexity plus physical difficulty, with overall derived
-- as their maximum. The migration refuses to change protected reviewed state.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '347_coaching_exercise_skill_metadata_absence';
  forbidden_keys CONSTANT TEXT[] := ARRAY[
    'skillLevel',
    'skill_level',
    'minimumSkillLevel',
    'minimum_skill_level',
    'proficiencyLevel',
    'proficiency_level',
    'exerciseSkillLevel',
    'exerciseSkillLevelAllowed',
    'neverUseExerciseSkillLevel',
    'exerciseCardSkillLevel',
    'formalProficiencyClassification',
    'proficiencyClassificationScope',
    'skill_level_applicability',
    'skillLevelApplicability',
    'skillLevelClassification'
  ]::TEXT[];
  protected_records INTEGER;
  cleaned_definitions INTEGER := 0;
BEGIN
  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1 definition
      WHERE (
        coalesce(definition.provenance_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(definition.environment_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(definition.population_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(definition.anatomy_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(definition.athlete_support_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(definition.coach_support_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(definition.support_operations_json, '{}'::JSONB)
          ?| forbidden_keys
      )
        AND (
          definition.status = 'published'
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR EXISTS (
            SELECT 1
            FROM coaching.exercise_card_review_v1 review
            WHERE review.definition_id = definition.id
          )
          OR EXISTS (
            SELECT 1
            FROM coaching.exercise_card_revision_v1 revision
            WHERE revision.definition_id = definition.id
          )
          OR EXISTS (
            SELECT 1
            FROM coaching.exercise_media_review_v1 media_review
            WHERE media_review.definition_id = definition.id
          )
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = variant.definition_id
      WHERE (
        coalesce(variant.difficulty_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(variant.requirements_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(variant.load_profile_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(variant.fatigue_profile_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(variant.programming_profile_json, '{}'::JSONB)
          ?| forbidden_keys
      )
        AND (
          variant.status = 'published'
          OR definition.status = 'published'
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_delivery_profile_v1 profile
      WHERE (
        coalesce(profile.objective_relevance_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(profile.dosage_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(profile.logistics_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(profile.time_model_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(profile.dose_scaling_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(profile.measurement_json, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(profile.support_prompts_json, '{}'::JSONB)
          ?| forbidden_keys
      )
        AND profile.status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_score_v1 score
      WHERE coalesce(score.legacy_scores, '{}'::JSONB)
          ?| forbidden_keys
        AND (
          score.human_review_status <> 'queued'
          OR score.reviewed_by IS NOT NULL
          OR score.reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise exercise
      WHERE (
        exercise.skill_level IS NOT NULL
        OR coalesce(exercise.movement_requirements, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(exercise.coaching_execution, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(exercise.programming_logic, '{}'::JSONB)
          ?| forbidden_keys
        OR coalesce(exercise.media_library, '{}'::JSONB)
          ?| forbidden_keys
      )
        AND exercise.is_published = TRUE
    )
  INTO protected_records;

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      '% refused to remove exercise level metadata from % protected record(s)',
      migration_key,
      protected_records;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET provenance_json =
        coalesce(provenance_json, '{}'::JSONB) - forbidden_keys,
      environment_json =
        coalesce(environment_json, '{}'::JSONB) - forbidden_keys,
      population_json =
        coalesce(population_json, '{}'::JSONB) - forbidden_keys,
      anatomy_json =
        coalesce(anatomy_json, '{}'::JSONB) - forbidden_keys,
      athlete_support_json =
        coalesce(athlete_support_json, '{}'::JSONB) - forbidden_keys,
      coach_support_json =
        coalesce(coach_support_json, '{}'::JSONB) - forbidden_keys,
      support_operations_json =
        coalesce(support_operations_json, '{}'::JSONB)
          - forbidden_keys,
      updated_at = now()
  WHERE coalesce(provenance_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(environment_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(population_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(anatomy_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(athlete_support_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(coach_support_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(support_operations_json, '{}'::JSONB)
          ?| forbidden_keys;

  GET DIAGNOSTICS cleaned_definitions = ROW_COUNT;

  UPDATE coaching.exercise_variant_v1
  SET difficulty_json =
        coalesce(difficulty_json, '{}'::JSONB) - forbidden_keys,
      requirements_json =
        coalesce(requirements_json, '{}'::JSONB) - forbidden_keys,
      load_profile_json =
        coalesce(load_profile_json, '{}'::JSONB) - forbidden_keys,
      fatigue_profile_json =
        coalesce(fatigue_profile_json, '{}'::JSONB) - forbidden_keys,
      programming_profile_json =
        coalesce(programming_profile_json, '{}'::JSONB)
          - forbidden_keys,
      updated_at = now()
  WHERE coalesce(difficulty_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(requirements_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(load_profile_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(fatigue_profile_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(programming_profile_json, '{}'::JSONB)
          ?| forbidden_keys;

  UPDATE coaching.exercise_delivery_profile_v1
  SET objective_relevance_json =
        coalesce(objective_relevance_json, '{}'::JSONB)
          - forbidden_keys,
      dosage_json =
        coalesce(dosage_json, '{}'::JSONB) - forbidden_keys,
      logistics_json =
        coalesce(logistics_json, '{}'::JSONB) - forbidden_keys,
      time_model_json =
        coalesce(time_model_json, '{}'::JSONB) - forbidden_keys,
      dose_scaling_json =
        coalesce(dose_scaling_json, '{}'::JSONB) - forbidden_keys,
      measurement_json =
        coalesce(measurement_json, '{}'::JSONB) - forbidden_keys,
      support_prompts_json =
        coalesce(support_prompts_json, '{}'::JSONB)
          - forbidden_keys,
      updated_at = now()
  WHERE coalesce(objective_relevance_json, '{}'::JSONB)
          ?| forbidden_keys
     OR coalesce(dosage_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(logistics_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(time_model_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(dose_scaling_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(measurement_json, '{}'::JSONB) ?| forbidden_keys
     OR coalesce(support_prompts_json, '{}'::JSONB)
          ?| forbidden_keys;

  UPDATE coaching.exercise_score_v1
  SET legacy_scores =
        coalesce(legacy_scores, '{}'::JSONB) - forbidden_keys,
      updated_at = now()
  WHERE coalesce(legacy_scores, '{}'::JSONB) ?| forbidden_keys;

  UPDATE coaching.exercise
  SET skill_level = NULL,
      movement_requirements =
        coalesce(movement_requirements, '{}'::JSONB)
          - forbidden_keys,
      coaching_execution =
        coalesce(coaching_execution, '{}'::JSONB)
          - forbidden_keys,
      programming_logic =
        coalesce(programming_logic, '{}'::JSONB)
          - forbidden_keys,
      media_library =
        coalesce(media_library, '{}'::JSONB) - forbidden_keys,
      updated_at = now()
  WHERE skill_level IS NOT NULL
     OR coalesce(movement_requirements, '{}'::JSONB)
          ?| forbidden_keys
     OR coalesce(coaching_execution, '{}'::JSONB)
          ?| forbidden_keys
     OR coalesce(programming_logic, '{}'::JSONB)
          ?| forbidden_keys
     OR coalesce(media_library, '{}'::JSONB) ?| forbidden_keys;

  UPDATE coaching.exercise_scaling_profile
  SET skill_level = NULL
  WHERE skill_level IS NOT NULL;

  UPDATE coaching.exercise_safety_profile
  SET minimum_skill_level = NULL
  WHERE minimum_skill_level IS NOT NULL;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    WHERE coalesce(definition.provenance_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(definition.environment_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(definition.population_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(definition.anatomy_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(definition.athlete_support_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(definition.coach_support_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(definition.support_operations_json, '{}'::JSONB)
            ?| forbidden_keys
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_variant_v1 variant
    WHERE coalesce(variant.difficulty_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(variant.requirements_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(variant.load_profile_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(variant.fatigue_profile_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(variant.programming_profile_json, '{}'::JSONB)
            ?| forbidden_keys
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_delivery_profile_v1 profile
    WHERE coalesce(profile.objective_relevance_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(profile.dosage_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(profile.logistics_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(profile.time_model_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(profile.dose_scaling_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(profile.measurement_json, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(profile.support_prompts_json, '{}'::JSONB)
            ?| forbidden_keys
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_score_v1 score
    WHERE coalesce(score.legacy_scores, '{}'::JSONB)
            ?| forbidden_keys
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise exercise
    WHERE exercise.skill_level IS NOT NULL
       OR coalesce(exercise.movement_requirements, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(exercise.coaching_execution, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(exercise.programming_logic, '{}'::JSONB)
            ?| forbidden_keys
       OR coalesce(exercise.media_library, '{}'::JSONB)
            ?| forbidden_keys
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_scaling_profile
    WHERE skill_level IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_safety_profile
    WHERE minimum_skill_level IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      '% left exercise-card level metadata after cleanup',
      migration_key;
  END IF;

  RAISE NOTICE
    '% removed obsolete level metadata from % exercise definition(s); skill-library records were not modified',
    migration_key,
    cleaned_definitions;
END;
$$;
