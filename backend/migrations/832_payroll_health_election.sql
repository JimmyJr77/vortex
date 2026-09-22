CREATE TABLE IF NOT EXISTS payroll_health_plan_disclosure (
 id UUID PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 plan_id TEXT NOT NULL,
 qualification_id UUID NOT NULL REFERENCES payroll_health_plan_qualification(id),
 revision INTEGER NOT NULL CHECK(revision>0),
 source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),
 source JSONB NOT NULL CHECK(jsonb_typeof(source)='object'),
 disclosure JSONB NOT NULL CHECK((jsonb_typeof(disclosure)='object' AND disclosure->'employeeDisclosureConfirmed'='true'::jsonb) IS TRUE),
 document_sha256 TEXT NOT NULL CHECK(document_sha256 ~ '^[a-f0-9]{64}$'),
 document_pages INTEGER NOT NULL CHECK(document_pages>0),
 encrypted_document BYTEA NOT NULL,
 request_key UUID NOT NULL,
 request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,plan_id,revision),
 UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_health_plan_disclosure() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE next_revision INTEGER;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_health_plan_qualification WHERE id=NEW.qualification_id AND facility_id=NEW.facility_id AND plan_id=NEW.plan_id AND review->>'disposition'='QUALIFIED') THEN RAISE EXCEPTION 'Disclosure needs the retained qualification for this workplace and plan.'; END IF;
 SELECT COALESCE(max(revision),0)+1 INTO next_revision FROM payroll_health_plan_disclosure WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id;
 IF NEW.revision<>next_revision THEN RAISE EXCEPTION 'Health plan disclosure revision changed.'; END IF;
 IF NEW.source->>'fingerprint' IS DISTINCT FROM NEW.source_fingerprint OR NEW.source->>'facilityId' IS DISTINCT FROM NEW.facility_id::text OR NEW.source->>'planId' IS DISTINCT FROM NEW.plan_id OR NEW.source->>'qualificationId' IS DISTINCT FROM NEW.qualification_id::text THEN RAISE EXCEPTION 'Health plan disclosure differs from its retained scope.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_health_plan_disclosure ON payroll_health_plan_disclosure;
CREATE TRIGGER payroll_validate_health_plan_disclosure BEFORE INSERT ON payroll_health_plan_disclosure FOR EACH ROW EXECUTE FUNCTION payroll_validate_health_plan_disclosure();
DROP TRIGGER IF EXISTS payroll_guard_health_plan_disclosure ON payroll_health_plan_disclosure;
CREATE TRIGGER payroll_guard_health_plan_disclosure BEFORE UPDATE OR DELETE ON payroll_health_plan_disclosure FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_health_election (
 id UUID PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 onboarding_cycle INTEGER NOT NULL CHECK(onboarding_cycle>0),
 plan_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 participant_qualification_id UUID NOT NULL REFERENCES payroll_health_participant_qualification(id),
 disclosure_id UUID NOT NULL REFERENCES payroll_health_plan_disclosure(id),
 effective_on DATE NOT NULL,
 effective_through DATE NOT NULL CHECK(effective_through>=effective_on),
 proposal_fingerprint TEXT NOT NULL CHECK(proposal_fingerprint ~ '^[a-f0-9]{64}$'),
 election JSONB NOT NULL CHECK((jsonb_typeof(election)='object' AND election->>'action' IN ('ELECT','DECLINE')) IS TRUE),
 employee_session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),
 request_key UUID NOT NULL,
 request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,employee_id,onboarding_cycle,plan_id,revision),
 UNIQUE(participant_qualification_id),
 UNIQUE(facility_id,employee_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_health_election() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE next_revision INTEGER; signed_at TIMESTAMPTZ; signed_day DATE;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_health_participant_qualification p JOIN payroll_health_plan_disclosure d ON d.id=NEW.disclosure_id AND d.facility_id=p.facility_id AND d.plan_id=p.plan_id WHERE p.id=NEW.participant_qualification_id AND p.facility_id=NEW.facility_id AND p.employee_id=NEW.employee_id AND p.onboarding_cycle=NEW.onboarding_cycle AND p.plan_id=NEW.plan_id AND p.review->>'disposition'='ELIGIBLE') THEN RAISE EXCEPTION 'Health election qualification belongs to a different scope.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee_session WHERE id=NEW.employee_session_id AND facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND revoked_at IS NULL AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'Health election employee session is not current for this scope.'; END IF;
 IF NOT (NEW.election->'version'='1'::jsonb AND NEW.election->'confirmed'='true'::jsonb AND NEW.election->'disclosureConfirmed'='true'::jsonb AND NEW.election->'electionRulesConfirmed'='true'::jsonb AND jsonb_typeof(NEW.election->'signature')='string' AND length(btrim(NEW.election->>'signature'))>=2 AND length(NEW.election->>'signature')<=200 AND (NEW.election->>'signature') !~ '[[:cntrl:]]' AND jsonb_typeof(NEW.election->'signedAt')='string') IS TRUE THEN RAISE EXCEPTION 'Health election requires complete retained signature proof.'; END IF;
 BEGIN signed_at := (NEW.election->>'signedAt')::timestamptz; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Health election signature timestamp is invalid.'; END;
 IF NOT isfinite(signed_at) OR signed_at>clock_timestamp() OR signed_at<clock_timestamp()-interval '5 minutes' THEN RAISE EXCEPTION 'Health election signature timestamp is not current.'; END IF;
 SELECT (signed_at AT TIME ZONE timezone)::date INTO signed_day FROM payroll_settings WHERE facility_id=NEW.facility_id;
 IF signed_day>NEW.effective_on OR NOT EXISTS(SELECT 1 FROM payroll_health_participant_qualification WHERE id=NEW.participant_qualification_id AND effective_on=NEW.effective_on AND (review->>'electionDeadline')::date>=signed_day) THEN RAISE EXCEPTION 'Health election signature is outside the reviewed election window.'; END IF;
 SELECT COALESCE(max(revision),0)+1 INTO next_revision FROM payroll_health_election WHERE facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND onboarding_cycle=NEW.onboarding_cycle AND plan_id=NEW.plan_id;
 IF NEW.revision<>next_revision THEN RAISE EXCEPTION 'Health election revision changed.'; END IF;
 IF NEW.election->>'proposalFingerprint' IS DISTINCT FROM NEW.proposal_fingerprint OR NEW.election->'proposal'->>'facilityId' IS DISTINCT FROM NEW.facility_id::text OR NEW.election->'proposal'->>'employeeId' IS DISTINCT FROM NEW.employee_id::text OR NEW.election->'proposal'->>'onboardingCycle' IS DISTINCT FROM NEW.onboarding_cycle::text OR NEW.election->'proposal'->>'planId' IS DISTINCT FROM NEW.plan_id OR NEW.election->'proposal'->>'participantQualificationId' IS DISTINCT FROM NEW.participant_qualification_id::text OR NEW.election->'proposal'->>'disclosureId' IS DISTINCT FROM NEW.disclosure_id::text OR NEW.election->'proposal'->>'effectiveOn' IS DISTINCT FROM NEW.effective_on::text OR NEW.election->'proposal'->>'effectiveThrough' IS DISTINCT FROM NEW.effective_through::text THEN RAISE EXCEPTION 'Health election differs from the signed proposal scope.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_health_election ON payroll_health_election;
CREATE TRIGGER payroll_validate_health_election BEFORE INSERT ON payroll_health_election FOR EACH ROW EXECUTE FUNCTION payroll_validate_health_election();
DROP TRIGGER IF EXISTS payroll_guard_health_election ON payroll_health_election;
CREATE TRIGGER payroll_guard_health_election BEFORE UPDATE OR DELETE ON payroll_health_election FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
