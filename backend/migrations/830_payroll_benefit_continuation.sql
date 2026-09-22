CREATE TABLE IF NOT EXISTS payroll_benefit_continuation_review (
 id UUID PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 payment_date DATE NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),
 source JSONB NOT NULL CHECK(jsonb_typeof(source)='object'),
 review JSONB NOT NULL CHECK((jsonb_typeof(review)='object' AND review->>'disposition' IN ('COLLECT_SIGNED_MONTHLY','SUSPENDED')) IS TRUE),
 request_key UUID NOT NULL,
 request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,employee_id,payment_date,revision),
 UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_benefit_continuation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE next_revision INTEGER;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Benefit continuation employee belongs to another workplace.'; END IF;
 SELECT COALESCE(max(revision),0)+1 INTO next_revision FROM payroll_benefit_continuation_review WHERE facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND payment_date=NEW.payment_date;
 IF NEW.revision<>next_revision THEN RAISE EXCEPTION 'Benefit continuation revision changed.'; END IF;
 IF NEW.source->>'fingerprint' IS DISTINCT FROM NEW.source_fingerprint OR NEW.source->>'facilityId' IS DISTINCT FROM NEW.facility_id::text OR NEW.source->>'employeeId' IS DISTINCT FROM NEW.employee_id::text OR NEW.source->>'paymentDate' IS DISTINCT FROM NEW.payment_date::text THEN RAISE EXCEPTION 'Benefit continuation evidence differs from its retained scope.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_benefit_continuation ON payroll_benefit_continuation_review;
CREATE TRIGGER payroll_validate_benefit_continuation BEFORE INSERT ON payroll_benefit_continuation_review FOR EACH ROW EXECUTE FUNCTION payroll_validate_benefit_continuation();
DROP TRIGGER IF EXISTS payroll_guard_benefit_continuation ON payroll_benefit_continuation_review;
CREATE TRIGGER payroll_guard_benefit_continuation BEFORE UPDATE OR DELETE ON payroll_benefit_continuation_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
