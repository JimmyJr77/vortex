-- Close the exercise-card/skill-library boundary for every spelling of a
-- skill/proficiency classification, including historical keys missed by the
-- enumerated migration 347 cleanup. Exercise cards retain only complexity and
-- physical-difficulty assessments; coaching.skill is intentionally untouched.
--
-- The cleanup is recursive, refuses protected human-reviewed state, and adds
-- database constraints so alternate write paths cannot reintroduce the keys.
-- IDEMPOTENT and fail-closed.

CREATE OR REPLACE FUNCTION coaching.exercise_json_has_level_classification(
  input_value JSONB
)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $function$
  SELECT jsonb_path_exists(
    coalesce(input_value, 'null'::JSONB),
    '$.** ? (@.type() == "object").keyvalue() ? (@.key like_regex "(skill[^a-z0-9]*level|proficiency[^a-z0-9]*level|proficiency[^a-z0-9]*classification)" flag "i")'::JSONPATH
  );
$function$;

CREATE OR REPLACE FUNCTION coaching.strip_exercise_level_classification(
  input_value JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $function$
DECLARE
  item RECORD;
  result JSONB;
  normalized_key TEXT;
BEGIN
  IF input_value IS NULL THEN
    RETURN NULL;
  END IF;

  CASE jsonb_typeof(input_value)
    WHEN 'object' THEN
      result := '{}'::JSONB;
      FOR item IN
        SELECT entry.key, entry.value
        FROM jsonb_each(input_value) AS entry
      LOOP
        normalized_key := regexp_replace(
          lower(item.key),
          '[^a-z0-9]+',
          '',
          'g'
        );
        IF normalized_key !~ (
          'skilllevel'
          || '|proficiencylevel'
          || '|proficiencyclassification'
        ) THEN
          result := result || jsonb_build_object(
            item.key,
            coaching.strip_exercise_level_classification(item.value)
          );
        END IF;
      END LOOP;
      RETURN result;

    WHEN 'array' THEN
      SELECT coalesce(
        jsonb_agg(
          coaching.strip_exercise_level_classification(element.value)
          ORDER BY element.ordinality
        ),
        '[]'::JSONB
      )
      INTO result
      FROM jsonb_array_elements(input_value)
        WITH ORDINALITY AS element(value, ordinality);
      RETURN result;

    ELSE
      RETURN input_value;
  END CASE;
END;
$function$;

CREATE OR REPLACE FUNCTION
  coaching.exercise_json_has_non_neutral_level_classification(
    input_value JSONB
  )
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $function$
  WITH hits AS (
    SELECT jsonb_path_query(
      coalesce(input_value, 'null'::JSONB),
      '$.** ? (@.type() == "object").keyvalue() ? (@.key like_regex "(skill[^a-z0-9]*level|proficiency[^a-z0-9]*level|proficiency[^a-z0-9]*classification)" flag "i")'::JSONPATH
    ) AS hit
  )
  SELECT EXISTS (
    SELECT 1
    FROM hits
    WHERE CASE jsonb_typeof(hit -> 'value')
      WHEN 'null' THEN FALSE
      WHEN 'boolean' THEN (hit ->> 'value')::BOOLEAN
      WHEN 'string' THEN lower(hit ->> 'value') NOT IN (
        'not_applicable',
        'not_applicable_to_exercise_cards',
        'coaching_skill_library_only',
        'exercise_complexity_and_physical_difficulty_only'
      )
      ELSE TRUE
    END
  );
$function$;

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '350_coaching_exercise_proficiency_metadata_guard';
  protected_records INTEGER;
  skill_library_levels_before INTEGER;
  skill_library_levels_after INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO skill_library_levels_before
  FROM coaching.skill
  WHERE skill_level IS NOT NULL;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1 definition
      WHERE coaching.exercise_json_has_non_neutral_level_classification(
        jsonb_build_array(
          definition.provenance_json,
          definition.environment_json,
          definition.population_json,
          definition.anatomy_json,
          definition.athlete_support_json,
          definition.coach_support_json,
          definition.support_operations_json
        )
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
      WHERE coaching.exercise_json_has_non_neutral_level_classification(
        jsonb_build_array(
          variant.difficulty_json,
          variant.requirements_json,
          variant.load_profile_json,
          variant.fatigue_profile_json,
          variant.programming_profile_json
        )
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
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = profile.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = variant.definition_id
      WHERE coaching.exercise_json_has_non_neutral_level_classification(
        jsonb_build_array(
          profile.objective_relevance_json,
          profile.dosage_json,
          profile.logistics_json,
          profile.time_model_json,
          profile.dose_scaling_json,
          profile.measurement_json,
          profile.support_prompts_json
        )
      )
        AND (
          profile.status = 'published'
          OR definition.status = 'published'
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_score_v1 score
      WHERE coaching.exercise_json_has_non_neutral_level_classification(
        score.legacy_scores
      )
        AND (
          score.human_review_status <> 'queued'
          OR score.reviewed_by IS NOT NULL
          OR score.reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise exercise
      WHERE coaching.exercise_json_has_non_neutral_level_classification(
        jsonb_build_array(
          exercise.movement_requirements,
          exercise.coaching_execution,
          exercise.programming_logic,
          exercise.media_library
        )
      )
        AND exercise.is_published = TRUE
    )
  INTO protected_records;

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      '% refused to remove level classifications from % protected record(s)',
      migration_key,
      protected_records;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET provenance_json =
        coaching.strip_exercise_level_classification(provenance_json),
      environment_json =
        coaching.strip_exercise_level_classification(environment_json),
      population_json =
        coaching.strip_exercise_level_classification(population_json),
      anatomy_json =
        coaching.strip_exercise_level_classification(anatomy_json),
      athlete_support_json =
        coaching.strip_exercise_level_classification(athlete_support_json),
      coach_support_json =
        coaching.strip_exercise_level_classification(coach_support_json),
      support_operations_json =
        coaching.strip_exercise_level_classification(
          support_operations_json
        ),
      updated_at = now()
  WHERE coaching.exercise_json_has_level_classification(
    jsonb_build_array(
      provenance_json,
      environment_json,
      population_json,
      anatomy_json,
      athlete_support_json,
      coach_support_json,
      support_operations_json
    )
  );

  UPDATE coaching.exercise_variant_v1
  SET difficulty_json =
        coaching.strip_exercise_level_classification(difficulty_json),
      requirements_json =
        coaching.strip_exercise_level_classification(requirements_json),
      load_profile_json =
        coaching.strip_exercise_level_classification(load_profile_json),
      fatigue_profile_json =
        coaching.strip_exercise_level_classification(fatigue_profile_json),
      programming_profile_json =
        coaching.strip_exercise_level_classification(
          programming_profile_json
        ),
      updated_at = now()
  WHERE coaching.exercise_json_has_level_classification(
    jsonb_build_array(
      difficulty_json,
      requirements_json,
      load_profile_json,
      fatigue_profile_json,
      programming_profile_json
    )
  );

  UPDATE coaching.exercise_delivery_profile_v1
  SET objective_relevance_json =
        coaching.strip_exercise_level_classification(
          objective_relevance_json
        ),
      dosage_json =
        coaching.strip_exercise_level_classification(dosage_json),
      logistics_json =
        coaching.strip_exercise_level_classification(logistics_json),
      time_model_json =
        coaching.strip_exercise_level_classification(time_model_json),
      dose_scaling_json =
        coaching.strip_exercise_level_classification(dose_scaling_json),
      measurement_json =
        coaching.strip_exercise_level_classification(measurement_json),
      support_prompts_json =
        coaching.strip_exercise_level_classification(
          support_prompts_json
        ),
      updated_at = now()
  WHERE coaching.exercise_json_has_level_classification(
    jsonb_build_array(
      objective_relevance_json,
      dosage_json,
      logistics_json,
      time_model_json,
      dose_scaling_json,
      measurement_json,
      support_prompts_json
    )
  );

  UPDATE coaching.exercise_score_v1
  SET legacy_scores =
        coaching.strip_exercise_level_classification(legacy_scores),
      updated_at = now()
  WHERE coaching.exercise_json_has_level_classification(legacy_scores);

  UPDATE coaching.exercise
  SET skill_level = NULL,
      movement_requirements =
        coaching.strip_exercise_level_classification(
          movement_requirements
        ),
      coaching_execution =
        coaching.strip_exercise_level_classification(
          coaching_execution
        ),
      programming_logic =
        coaching.strip_exercise_level_classification(programming_logic),
      media_library =
        coaching.strip_exercise_level_classification(media_library),
      updated_at = now()
  WHERE skill_level IS NOT NULL
     OR coaching.exercise_json_has_level_classification(
          jsonb_build_array(
            movement_requirements,
            coaching_execution,
            programming_logic,
            media_library
          )
        );

  UPDATE coaching.exercise_scaling_profile
  SET skill_level = NULL
  WHERE skill_level IS NOT NULL;

  UPDATE coaching.exercise_safety_profile
  SET minimum_skill_level = NULL
  WHERE minimum_skill_level IS NOT NULL;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    WHERE coaching.exercise_json_has_level_classification(
      jsonb_build_array(
        definition.provenance_json,
        definition.environment_json,
        definition.population_json,
        definition.anatomy_json,
        definition.athlete_support_json,
        definition.coach_support_json,
        definition.support_operations_json
      )
    )
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_variant_v1 variant
    WHERE coaching.exercise_json_has_level_classification(
      jsonb_build_array(
        variant.difficulty_json,
        variant.requirements_json,
        variant.load_profile_json,
        variant.fatigue_profile_json,
        variant.programming_profile_json
      )
    )
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_delivery_profile_v1 profile
    WHERE coaching.exercise_json_has_level_classification(
      jsonb_build_array(
        profile.objective_relevance_json,
        profile.dosage_json,
        profile.logistics_json,
        profile.time_model_json,
        profile.dose_scaling_json,
        profile.measurement_json,
        profile.support_prompts_json
      )
    )
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_score_v1 score
    WHERE coaching.exercise_json_has_level_classification(
      score.legacy_scores
    )
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise exercise
    WHERE exercise.skill_level IS NOT NULL
       OR coaching.exercise_json_has_level_classification(
            jsonb_build_array(
              exercise.movement_requirements,
              exercise.coaching_execution,
              exercise.programming_logic,
              exercise.media_library
            )
          )
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
      '% left exercise-card level metadata after recursive cleanup',
      migration_key;
  END IF;

  SELECT COUNT(*)
  INTO skill_library_levels_after
  FROM coaching.skill
  WHERE skill_level IS NOT NULL;

  IF skill_library_levels_after <> skill_library_levels_before THEN
    RAISE EXCEPTION
      '% changed dedicated skill-library level assignments (% -> %)',
      migration_key,
      skill_library_levels_before,
      skill_library_levels_after;
  END IF;
END;
$$;

ALTER TABLE coaching.exercise_definition_v1
  DROP CONSTRAINT IF EXISTS
    exercise_definition_no_level_classification_check;
ALTER TABLE coaching.exercise_definition_v1
  ADD CONSTRAINT exercise_definition_no_level_classification_check
  CHECK (
    NOT coaching.exercise_json_has_level_classification(
      jsonb_build_array(
        provenance_json,
        environment_json,
        population_json,
        anatomy_json,
        athlete_support_json,
        coach_support_json,
        support_operations_json
      )
    )
  );

ALTER TABLE coaching.exercise_variant_v1
  DROP CONSTRAINT IF EXISTS
    exercise_variant_no_level_classification_check;
ALTER TABLE coaching.exercise_variant_v1
  ADD CONSTRAINT exercise_variant_no_level_classification_check
  CHECK (
    NOT coaching.exercise_json_has_level_classification(
      jsonb_build_array(
        difficulty_json,
        requirements_json,
        load_profile_json,
        fatigue_profile_json,
        programming_profile_json
      )
    )
  );

ALTER TABLE coaching.exercise_delivery_profile_v1
  DROP CONSTRAINT IF EXISTS
    exercise_delivery_no_level_classification_check;
ALTER TABLE coaching.exercise_delivery_profile_v1
  ADD CONSTRAINT exercise_delivery_no_level_classification_check
  CHECK (
    NOT coaching.exercise_json_has_level_classification(
      jsonb_build_array(
        objective_relevance_json,
        dosage_json,
        logistics_json,
        time_model_json,
        dose_scaling_json,
        measurement_json,
        support_prompts_json
      )
    )
  );

ALTER TABLE coaching.exercise_score_v1
  DROP CONSTRAINT IF EXISTS exercise_score_no_level_classification_check;
ALTER TABLE coaching.exercise_score_v1
  ADD CONSTRAINT exercise_score_no_level_classification_check
  CHECK (
    NOT coaching.exercise_json_has_level_classification(legacy_scores)
  );

ALTER TABLE coaching.exercise
  DROP CONSTRAINT IF EXISTS exercise_legacy_no_level_classification_check;
ALTER TABLE coaching.exercise
  ADD CONSTRAINT exercise_legacy_no_level_classification_check
  CHECK (
    skill_level IS NULL
    AND NOT coaching.exercise_json_has_level_classification(
      jsonb_build_array(
        movement_requirements,
        coaching_execution,
        programming_logic,
        media_library
      )
    )
  );

COMMENT ON FUNCTION coaching.exercise_json_has_level_classification(JSONB) IS
  'Detects skill/proficiency classification keys recursively in exercise-card JSON. Skill-library cards are outside this contract.';
COMMENT ON FUNCTION coaching.exercise_json_has_non_neutral_level_classification(JSONB) IS
  'Detects non-null, non-false skill/proficiency classifications. Neutral legacy markers may be removed from protected cards without changing their movement or difficulty contract.';
COMMENT ON FUNCTION coaching.strip_exercise_level_classification(JSONB) IS
  'Recursively removes skill/proficiency classification keys from exercise-card JSON without changing dedicated skill-library cards.';
