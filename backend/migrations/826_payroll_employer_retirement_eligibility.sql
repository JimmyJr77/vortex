CREATE TABLE IF NOT EXISTS payroll_retirement_employer_eligibility (
 id UUID PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 plan_id TEXT NOT NULL,
 plan_revision_id UUID NOT NULL REFERENCES payroll_retirement_plan_revision(id),
 revision INTEGER NOT NULL CHECK(revision>0),
 source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),
 source JSONB NOT NULL CHECK(jsonb_typeof(source)='object'),
 review JSONB NOT NULL CHECK(jsonb_typeof(review)='object'),
 request_key UUID NOT NULL,
 request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,employee_id,plan_id,revision),
 UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_employer_retirement_eligibility() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest UUID; next_revision INTEGER;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Employer eligibility employee belongs to another workplace.'; END IF;
 SELECT id INTO latest FROM payroll_retirement_plan_revision WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id AND tax_year=2026 ORDER BY revision DESC LIMIT 1;
 IF latest IS DISTINCT FROM NEW.plan_revision_id THEN RAISE EXCEPTION 'Employer eligibility requires the current scoped plan revision.'; END IF;
 SELECT COALESCE(max(revision),0)+1 INTO next_revision FROM payroll_retirement_employer_eligibility WHERE facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND plan_id=NEW.plan_id;
 IF NEW.revision<>next_revision THEN RAISE EXCEPTION 'Employer eligibility revision changed.'; END IF;
 IF NEW.source->>'fingerprint' IS DISTINCT FROM NEW.source_fingerprint OR NEW.source->>'facilityId' IS DISTINCT FROM NEW.facility_id::text OR NEW.source->>'employeeId' IS DISTINCT FROM NEW.employee_id::text OR NEW.source->>'planId' IS DISTINCT FROM NEW.plan_id OR NEW.source->>'planRevisionId' IS DISTINCT FROM NEW.plan_revision_id::text THEN RAISE EXCEPTION 'Employer eligibility source scope differs from the review.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_employer_retirement_eligibility ON payroll_retirement_employer_eligibility;
CREATE TRIGGER payroll_validate_employer_retirement_eligibility BEFORE INSERT ON payroll_retirement_employer_eligibility FOR EACH ROW EXECUTE FUNCTION payroll_validate_employer_retirement_eligibility();
DROP TRIGGER IF EXISTS payroll_guard_employer_retirement_eligibility ON payroll_retirement_employer_eligibility;
CREATE TRIGGER payroll_guard_employer_retirement_eligibility BEFORE UPDATE OR DELETE ON payroll_retirement_employer_eligibility FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
