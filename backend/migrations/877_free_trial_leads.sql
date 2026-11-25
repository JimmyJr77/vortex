-- Trials remain prospect records even after the guardian creates a portal
-- account. Reuse the existing member link and identify trial-only records by
-- inquiry_source; paid conversion still uses converted_member_id.
CREATE INDEX IF NOT EXISTS idx_registrations_trial_member
  ON registrations(facility_id,member_id) WHERE inquiry_source='free_trial';

-- Historical bookings have explicit athlete/family identities. Prefer that
-- family's payer, then an unambiguous legal guardian, then the athlete itself.
-- Contact email is never used to infer a relationship.
WITH athletes AS (
  SELECT DISTINCT child.id,child.facility_id,child.first_name,child.last_name,child.date_of_birth,child.gender,
    COALESCE((SELECT CASE WHEN count(*)=1 THEN min(fm.family_id) END
      FROM family_member fm JOIN family f ON f.id=fm.family_id AND f.facility_id=child.facility_id
      WHERE fm.member_id=child.id AND fm.is_active=TRUE),
      CASE WHEN NOT EXISTS(SELECT 1 FROM family_member fm WHERE fm.member_id=child.id) THEN child.family_id END) AS family_id
  FROM drop_in_registration booking
  JOIN member child ON child.id=booking.member_id
  JOIN scheduling_form sf ON sf.id=booking.form_id
  JOIN program p ON p.id=sf.program_id AND p.facility_id=child.facility_id
  WHERE booking.benefit_type='free_trial'
), linked AS (
  SELECT athlete.*,COALESCE(payer.id,guardian.id,athlete.id) AS contact_id
  FROM athletes athlete
  LEFT JOIN family_billing_account billing ON billing.family_id=athlete.family_id AND billing.is_active=TRUE
  LEFT JOIN member payer ON payer.id=billing.payer_member_id AND payer.facility_id=athlete.facility_id
  LEFT JOIN LATERAL (
    SELECT CASE WHEN count(*)=1 THEN min(parent.id) END AS id
    FROM parent_guardian_authority authority
    JOIN member parent ON parent.id=authority.parent_member_id AND parent.facility_id=athlete.facility_id
    WHERE authority.child_member_id=athlete.id AND authority.has_legal_authority=TRUE
  ) guardian ON TRUE
), households AS (
  SELECT facility_id,contact_id,jsonb_agg(jsonb_build_object('memberId',id,'firstName',first_name,
    'lastName',last_name,'dateOfBirth',to_char(date_of_birth,'YYYY-MM-DD'),'gender',COALESCE(gender::text,'')) ORDER BY id) AS children
  FROM linked GROUP BY facility_id,contact_id
), refreshed AS (
  UPDATE registrations r SET campers=(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END)||(
    SELECT COALESCE(jsonb_agg(child),'[]'::jsonb) FROM jsonb_array_elements(h.children) child
    WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END) stored
      WHERE stored->>'memberId'=child->>'memberId'))
  FROM households h WHERE r.facility_id=h.facility_id AND r.member_id=h.contact_id
    AND r.inquiry_source='free_trial' AND r.converted_member_id IS NULL AND r.archived IS NOT TRUE
  RETURNING r.id
)
INSERT INTO registrations(facility_id,member_id,first_name,last_name,email,phone,campers,inquiry_source,lead_status,contacted,follow_up)
SELECT h.facility_id,h.contact_id,left(contact.first_name,50),left(contact.last_name,50),COALESCE(contact.email,''),contact.phone,
  h.children,'free_trial','qualified',FALSE,FALSE
FROM households h JOIN member contact ON contact.id=h.contact_id AND contact.facility_id=h.facility_id
WHERE NOT EXISTS(SELECT 1 FROM registrations r WHERE r.facility_id=h.facility_id AND r.member_id=h.contact_id
  AND r.inquiry_source='free_trial');

-- A confirmed monthly enrollment, rather than a free drop-in or a portal
-- account, completes the prospect's conversion. This performs no billing.
CREATE OR REPLACE FUNCTION convert_trial_lead_on_enrollment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='confirmed' AND NEW.member_id IS NOT NULL AND NEW.orphaned_at IS NULL AND NEW.archived_at IS NULL
    AND EXISTS(SELECT 1 FROM scheduling_form sf JOIN program p ON p.id=sf.program_id
      WHERE sf.id=NEW.form_id AND COALESCE(p.is_trial_assessment,FALSE)=FALSE) THEN
    UPDATE registrations r SET converted_member_id=r.member_id,converted_at=now(),lead_status='converted',updated_at=now()
    WHERE r.inquiry_source='free_trial' AND r.converted_member_id IS NULL AND r.member_id IS NOT NULL
      AND r.facility_id=(SELECT m.facility_id FROM member m WHERE m.id=NEW.member_id)
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END) child
        WHERE child->>'memberId'=NEW.member_id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS scheduling_signup_convert_trial_lead ON scheduling_signup;
CREATE TRIGGER scheduling_signup_convert_trial_lead AFTER INSERT OR UPDATE OF status,member_id
  ON scheduling_signup FOR EACH ROW EXECUTE FUNCTION convert_trial_lead_on_enrollment();

-- Apply the same boundary to historical trial athletes already enrolled.
UPDATE registrations r SET converted_member_id=r.member_id,converted_at=COALESCE(r.converted_at,now()),lead_status='converted',updated_at=now()
WHERE r.inquiry_source='free_trial' AND r.converted_member_id IS NULL AND r.member_id IS NOT NULL
  AND EXISTS(SELECT 1 FROM scheduling_signup signup JOIN member athlete ON athlete.id=signup.member_id AND athlete.facility_id=r.facility_id
    JOIN scheduling_form sf ON sf.id=signup.form_id JOIN program p ON p.id=sf.program_id AND COALESCE(p.is_trial_assessment,FALSE)=FALSE
    WHERE signup.status='confirmed' AND signup.orphaned_at IS NULL AND signup.archived_at IS NULL
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END) child
        WHERE child->>'memberId'=athlete.id::text));
