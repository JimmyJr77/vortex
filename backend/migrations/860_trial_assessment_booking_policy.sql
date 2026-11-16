-- Keep assessment scheduling in the normal class tools while restricting all
-- booking paths to the qualified, waived, zero-cost free-trial workflow.
ALTER TABLE program ADD COLUMN IF NOT EXISTS is_trial_assessment BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE program SET is_trial_assessment = TRUE
WHERE category = 'GYMNASTICS' AND name = 'trial_assessment'
  AND is_trial_assessment = FALSE;

CREATE OR REPLACE FUNCTION reject_trial_assessment_monthly_signup()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM scheduling_form f JOIN program c ON c.id = f.program_id
    WHERE c.is_trial_assessment = TRUE
      AND (f.id = NEW.form_id
        OR f.id = (SELECT g.form_id FROM scheduling_slot_group g WHERE g.id = NEW.slot_group_id)
        OR f.id = (SELECT t.form_id FROM scheduling_time_slot t WHERE t.id = NEW.time_slot_id))
  ) THEN
    RAISE EXCEPTION 'Trial Assessments must be booked through the free-trial flow, not monthly enrollment.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trial_assessment_monthly_signup_guard ON scheduling_signup;
CREATE TRIGGER trial_assessment_monthly_signup_guard
BEFORE INSERT OR UPDATE ON scheduling_signup
FOR EACH ROW EXECUTE FUNCTION reject_trial_assessment_monthly_signup();

CREATE OR REPLACE FUNCTION enforce_trial_assessment_free_booking()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM scheduling_form f JOIN program c ON c.id = f.program_id
    WHERE c.is_trial_assessment = TRUE
      AND (f.id = NEW.form_id
        OR f.id = (SELECT g.form_id FROM scheduling_slot_group g WHERE g.id = NEW.slot_group_id))
  ) AND (NEW.benefit_type IS DISTINCT FROM 'free_trial'
    OR NEW.amount_cents IS DISTINCT FROM 0
    OR NEW.status = 'payment_pending') THEN
    RAISE EXCEPTION 'Trial Assessments only accept free-trial bookings with no payment.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trial_assessment_free_booking_guard ON drop_in_registration;
CREATE TRIGGER trial_assessment_free_booking_guard
BEFORE INSERT OR UPDATE ON drop_in_registration
FOR EACH ROW EXECUTE FUNCTION enforce_trial_assessment_free_booking();
