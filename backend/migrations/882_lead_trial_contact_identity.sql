-- Trial attendance augments the original inquiry without changing its source or
-- treating a portal contact as a paid conversion. Existing source rows survive.
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS trial_contact_member_id BIGINT REFERENCES member(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_registrations_trial_contact ON registrations(facility_id,trial_contact_member_id)
  WHERE trial_contact_member_id IS NOT NULL;

CREATE OR REPLACE FUNCTION guard_lead_trial_contact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trial_contact_member_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM member m WHERE m.id=NEW.trial_contact_member_id AND m.facility_id=NEW.facility_id
  ) THEN RAISE EXCEPTION 'Trial lead and contact must belong to the same facility' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS registrations_guard_trial_contact ON registrations;
CREATE TRIGGER registrations_guard_trial_contact BEFORE INSERT OR UPDATE OF facility_id,trial_contact_member_id
  ON registrations FOR EACH ROW EXECUTE FUNCTION guard_lead_trial_contact();

CREATE OR REPLACE FUNCTION convert_trial_lead_on_enrollment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='confirmed' AND NEW.member_id IS NOT NULL AND NEW.orphaned_at IS NULL AND NEW.archived_at IS NULL
    AND EXISTS(SELECT 1 FROM scheduling_form sf JOIN program p ON p.id=sf.program_id
      JOIN member athlete ON athlete.id=NEW.member_id AND athlete.facility_id=p.facility_id
      WHERE sf.id=NEW.form_id AND COALESCE(p.is_trial_assessment,FALSE)=FALSE) THEN
    UPDATE registrations r SET converted_member_id=COALESCE(r.trial_contact_member_id,r.member_id),
      converted_at=now(),lead_status='converted',updated_at=now()
    WHERE (r.inquiry_source='free_trial' OR r.trial_contact_member_id IS NOT NULL)
      AND r.converted_member_id IS NULL AND COALESCE(r.trial_contact_member_id,r.member_id) IS NOT NULL
      AND r.facility_id=(SELECT m.facility_id FROM member m WHERE m.id=NEW.member_id)
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END) child
        WHERE child->>'memberId'=NEW.member_id::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS scheduling_signup_convert_trial_lead ON scheduling_signup;
CREATE TRIGGER scheduling_signup_convert_trial_lead AFTER INSERT OR UPDATE OF status,member_id
  ON scheduling_signup FOR EACH ROW EXECUTE FUNCTION convert_trial_lead_on_enrollment();
