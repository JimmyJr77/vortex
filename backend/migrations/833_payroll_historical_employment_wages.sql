CREATE TABLE IF NOT EXISTS payroll_historical_employment_wage_review (
 id UUID PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 tax_year INTEGER NOT NULL CHECK(tax_year=2026),
 revision INTEGER NOT NULL CHECK(revision>0),
 source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),
 source JSONB NOT NULL CHECK(jsonb_typeof(source)='object'),
 review JSONB NOT NULL CHECK((jsonb_typeof(review)='object' AND review->>'disposition' IN ('REVIEWED','UNRESOLVED') AND review->'confirmed'='true'::jsonb) IS TRUE),
 request_key UUID NOT NULL,
 request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,employee_id,tax_year,revision),
 UNIQUE(facility_id,request_key),
 CHECK((review->>'disposition'<>'REVIEWED' OR (review->'sameEmployerConfirmed'='true'::jsonb AND review->'uncappedWagesConfirmed'='true'::jsonb AND review->'completeHistoryConfirmed'='true'::jsonb AND jsonb_typeof(review->'payments')='array' AND jsonb_array_length(review->'payments')>0)) IS TRUE)
);
CREATE OR REPLACE FUNCTION payroll_validate_historical_employment_wages() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE next_revision INTEGER;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Imported wage review employee scope differs.'; END IF;
 SELECT COALESCE(max(revision),0)+1 INTO next_revision FROM payroll_historical_employment_wage_review WHERE facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND tax_year=NEW.tax_year;
 IF NEW.revision<>next_revision THEN RAISE EXCEPTION 'Imported wage review revision changed.'; END IF;
 IF NEW.source->>'fingerprint' IS DISTINCT FROM NEW.source_fingerprint OR NEW.source->>'facilityId' IS DISTINCT FROM NEW.facility_id::text OR NEW.source->>'employeeId' IS DISTINCT FROM NEW.employee_id::text OR NEW.source->>'year' IS DISTINCT FROM NEW.tax_year::text OR NEW.review->>'sourceFingerprint' IS DISTINCT FROM NEW.source_fingerprint THEN RAISE EXCEPTION 'Imported wage review differs from retained source.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_historical_employment_wages ON payroll_historical_employment_wage_review;
CREATE TRIGGER payroll_validate_historical_employment_wages BEFORE INSERT ON payroll_historical_employment_wage_review FOR EACH ROW EXECUTE FUNCTION payroll_validate_historical_employment_wages();
DROP TRIGGER IF EXISTS payroll_guard_historical_employment_wages ON payroll_historical_employment_wage_review;
CREATE TRIGGER payroll_guard_historical_employment_wages BEFORE UPDATE OR DELETE ON payroll_historical_employment_wage_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
