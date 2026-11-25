-- Replace Vortex's Thursday 4–5:30 classes with private gymnastics evaluations.
-- This is an explicitly scoped operational change, never a default for other gyms.
DO $$
DECLARE
  target_facility BIGINT;
  assessment_id BIGINT;
  assessment_programs_id BIGINT;
  assessment_form_id BIGINT;
  assessment_offering_id BIGINT;
  assessment_group_id BIGINT;
  retired_slots BIGINT[];
  retired_groups BIGINT[];
  local_today DATE;
  meeting RECORD;
BEGIN
  SELECT id, (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(timezone,''),'America/New_York'))::date
    INTO target_facility, local_today
  FROM facility WHERE id=1 AND name='Vortex Athletics';
  IF target_facility IS NULL THEN RETURN; END IF;

  SELECT c.id,c.programs_id INTO STRICT assessment_id,assessment_programs_id FROM program c
  WHERE c.facility_id=target_facility AND c.name='trial_assessment'
    AND c.is_trial_assessment IS TRUE AND c.archived IS NOT TRUE;
  SELECT f.id INTO STRICT assessment_form_id FROM scheduling_form f
  WHERE f.program_id=assessment_id AND f.deleted_at IS NULL AND f.is_active IS TRUE
  FOR UPDATE;

  -- The dedicated offering survives later staff edits. A direct SQL rerun must
  -- not restore times staff have since moved or disabled, or duplicate groups.
  IF EXISTS(SELECT 1 FROM scheduling_offering
    WHERE form_id=assessment_form_id AND label='Free 1:1 evaluations') THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(ts.id ORDER BY ts.id),'{}'::bigint[]),
         COALESCE(array_agg(DISTINCT ts.slot_group_id),'{}'::bigint[])
    INTO retired_slots, retired_groups
  FROM scheduling_time_slot ts
  JOIN scheduling_form f ON f.id=ts.form_id AND f.deleted_at IS NULL
  JOIN program c ON c.id=f.program_id AND c.facility_id=target_facility
  WHERE ts.is_active IS TRUE AND ts.schedule_mode='day'
    AND ((c.id=assessment_id AND ts.day_of_week=6 AND ts.start_time='12:00' AND ts.end_time='13:00')
      OR (c.programs_id=assessment_programs_id AND lower(btrim(c.display_name)) IN ('tornadoes','cyclones')
        AND ts.day_of_week=4 AND ts.start_time='16:00' AND ts.end_time='17:30'));

  -- Booking and enrollment reserve their group before changing attendance.
  -- Take those same locks and refuse to displace a future reservation or hold.
  PERFORM g.id FROM scheduling_slot_group g WHERE g.id=ANY(retired_groups) ORDER BY g.id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM scheduling_signup s
      WHERE s.slot_group_id=ANY(retired_groups) AND s.archived_at IS NULL AND s.orphaned_at IS NULL
        AND s.status NOT IN ('cancelled','completed','expired','reservation_expired')
        AND (s.cancel_effective_date IS NULL OR s.cancel_effective_date>local_today))
    OR EXISTS(SELECT 1 FROM scheduling_slot_group g
      WHERE g.id=ANY(retired_groups) AND pending_registration_holds(g.id)>0)
    OR EXISTS(SELECT 1 FROM drop_in_registration booking
      WHERE booking.slot_group_id=ANY(retired_groups) AND booking.class_date>=local_today
        AND booking.status IN ('account_required','payment_pending','confirmed','attended')
        AND (booking.status<>'account_required' OR booking.expires_at IS NULL OR booking.expires_at>now())) THEN
    RAISE EXCEPTION 'Cannot replace Vortex evaluation schedules while affected classes have future enrollments, reservations or holds.';
  END IF;

  UPDATE scheduling_time_slot SET is_active=FALSE, exclude_from_drop_ins=TRUE,
    allow_free_trials=FALSE, updated_at=now() WHERE id=ANY(retired_slots);
  UPDATE scheduling_slot_group g SET is_active=FALSE, updated_at=now()
  WHERE g.id=ANY(retired_groups) AND NOT EXISTS(
    SELECT 1 FROM scheduling_time_slot ts WHERE ts.slot_group_id=g.id AND ts.is_active IS TRUE);

  UPDATE program SET age_min=2, age_max=17,
    description='Free private 1:1 gymnastics evaluation for athletes with prior gymnastics experience. Each evaluation lasts 30 minutes and is reserved for one athlete. Coaches recommend the appropriate training group.',
    skill_requirements='Prior gymnastics experience. Ages 2–17.', updated_at=now()
  WHERE id=assessment_id;
  UPDATE scheduling_form SET description='Free private 1:1 gymnastics evaluation: 30 minutes for one athlete with prior gymnastics experience.',
    updated_at=now() WHERE id=assessment_form_id;

  -- A form has a single selected offering. Preserve the old offering and its
  -- history, then select the replacement only after the reservation guards pass.
  UPDATE scheduling_offering SET is_selected=FALSE, updated_at=now()
  WHERE form_id=assessment_form_id AND is_selected IS TRUE;
  INSERT INTO scheduling_offering(form_id,start_date,end_date,label,is_selected)
  VALUES(assessment_form_id,local_today,NULL,'Free 1:1 evaluations',TRUE)
  RETURNING id INTO assessment_offering_id;

  FOR meeting IN SELECT * FROM (VALUES
      (4,'16:00'::time,'16:30'::time),
      (4,'16:30'::time,'17:00'::time),
      (4,'17:00'::time,'17:30'::time),
      (2,'19:30'::time,'20:00'::time),
      (3,'19:30'::time,'20:00'::time),
      (4,'19:30'::time,'20:00'::time),
      (5,'19:30'::time,'20:00'::time)
    ) AS times(day_of_week,start_time,end_time)
  LOOP
    -- Separate groups make each half-hour an independently reserved appointment.
    INSERT INTO scheduling_slot_group(form_id,offering_id,schedule_mode,max_participants,
      active_start,active_end,inherits_offering_dates,dates_tbd,is_active)
    VALUES(assessment_form_id,assessment_offering_id,'day',1,local_today,NULL,TRUE,FALSE,TRUE)
    RETURNING id INTO assessment_group_id;
    INSERT INTO scheduling_time_slot(form_id,slot_group_id,schedule_mode,day_of_week,
      start_time,end_time,max_participants,active_start,active_end,dates_tbd,is_active,
      exclude_from_drop_ins,allow_free_trials)
    VALUES(assessment_form_id,assessment_group_id,'day',meeting.day_of_week,
      meeting.start_time,meeting.end_time,1,local_today,NULL,FALSE,TRUE,TRUE,TRUE);
  END LOOP;
END $$;
