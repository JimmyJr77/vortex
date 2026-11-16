-- The experienced-gymnast free trial uses the ordinary class scheduler.
-- Seed one editable assessment class per facility with a gymnastics program.
-- Existing class settings and schedules are deliberately preserved on reruns.
DO $$
DECLARE
  target RECORD;
  assessment_id BIGINT;
  assessment_form_id BIGINT;
  assessment_offering_id BIGINT;
  assessment_group_id BIGINT;
BEGIN
  FOR target IN
    SELECT DISTINCT ON (p.facility_id) p.id, p.facility_id
    FROM programs p
    WHERE p.archived = FALSE AND p.is_active = TRUE
      AND (p.display_name ILIKE '%gymnastics%' OR p.name ILIKE '%gymnastics%')
      AND p.display_name !~* 'fit[[:space:]]*(&|and)?[[:space:]]*flip'
    ORDER BY p.facility_id,
      CASE
        WHEN p.display_name ~* '^development(al)? gymnastics$' THEN 0
        WHEN p.display_name ~* '^gymnastics$' THEN 1
        WHEN p.display_name ~* '^\[DEV\] gymnastics$' THEN 2
        ELSE 3
      END, p.id
  LOOP
    SELECT c.id INTO assessment_id FROM program c
    WHERE c.facility_id = target.facility_id AND c.category = 'GYMNASTICS'
      AND (c.name = 'trial_assessment' OR lower(c.display_name) = 'trial assessment')
    ORDER BY c.id LIMIT 1;

    IF assessment_id IS NULL THEN
      INSERT INTO program (
        facility_id, category, programs_id, name, display_name, abridged_name,
        age_min, age_max, description, skill_requirements, is_active, archived
      ) VALUES (
        target.facility_id, 'GYMNASTICS', target.id, 'trial_assessment',
        'Trial Assessment', 'Trial Assessment', 6, 17,
        'A free gymnastics assessment for athletes with prior experience. Coaches assess readiness and recommend the appropriate training group.',
        'Prior gymnastics experience. Ages 6–17.', TRUE, FALSE
      ) RETURNING id INTO assessment_id;
    END IF;

    SELECT f.id INTO assessment_form_id FROM scheduling_form f
    WHERE f.program_id = assessment_id
    ORDER BY f.id LIMIT 1;

    -- Only a new form receives the initial schedule. Never restore or overwrite
    -- a schedule that staff have subsequently edited, paused, or removed.
    IF assessment_form_id IS NULL THEN
      INSERT INTO scheduling_form (
        program_id, programs_id, title, description, is_active, start_date,
        signup_fields, mandate_waiver, enroll_sites, pricing_overrides_program,
        class_monthly_price_cents, slot_cost_monthly_cents, cost_amount_cents,
        cost_unit, class_program_pricing
      ) VALUES (
        assessment_id, (SELECT programs_id FROM program WHERE id = assessment_id),
        'Trial Assessment',
        'Free assessment for experienced gymnasts. Manage assessment availability in this class schedule.',
        TRUE, CURRENT_DATE, '["first_name","last_name","email","phone","date_of_birth"]'::jsonb,
        TRUE, ARRAY['athletics', 'gymnastics'], TRUE, 0, 0, 0, 'per_month', '{}'::jsonb
      ) RETURNING id INTO assessment_form_id;

      INSERT INTO scheduling_offering (form_id, start_date, end_date, label, is_selected)
      VALUES (assessment_form_id, CURRENT_DATE, NULL, 'Trial assessments', TRUE)
      RETURNING id INTO assessment_offering_id;

      INSERT INTO scheduling_slot_group (
        form_id, offering_id, schedule_mode, max_participants,
        active_start, active_end, inherits_offering_dates, dates_tbd, is_active
      ) VALUES (
        assessment_form_id, assessment_offering_id, 'day', 8,
        CURRENT_DATE, NULL, TRUE, FALSE, TRUE
      ) RETURNING id INTO assessment_group_id;

      INSERT INTO scheduling_time_slot (
        form_id, slot_group_id, schedule_mode, day_of_week,
        start_time, end_time, max_participants, active_start, active_end, dates_tbd, is_active
      ) VALUES (
        assessment_form_id, assessment_group_id, 'day', 6,
        '12:00', '13:00', 8, CURRENT_DATE, NULL, FALSE, TRUE
      );
    END IF;
  END LOOP;
END $$;
