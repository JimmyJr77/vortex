CREATE TABLE IF NOT EXISTS payroll_health_plan_qualification (
 id UUID PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 plan_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 effective_on DATE NOT NULL,
 effective_through DATE NOT NULL CHECK(effective_through>=effective_on),
 source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),
 source JSONB NOT NULL CHECK(jsonb_typeof(source)='object'),
 review JSONB NOT NULL CHECK((jsonb_typeof(review)='object' AND review->>'disposition' IN ('QUALIFIED','SUSPENDED')) IS TRUE),
 document_sha256 TEXT,
 document_pages INTEGER,
 encrypted_document BYTEA,
 request_key UUID NOT NULL,
 request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,plan_id,revision),
 UNIQUE(facility_id,request_key),
 CHECK((review->>'disposition'<>'QUALIFIED' OR (document_sha256 ~ '^[a-f0-9]{64}$' AND document_pages>0 AND encrypted_document IS NOT NULL AND review->>'classification'='SECTION125_ACCIDENT_HEALTH_PREMIUM' AND review->'writtenPlanConfirmed'='true'::jsonb AND review->'eligibleBenefitsConfirmed'='true'::jsonb AND review->'nondiscriminationConfirmed'='true'::jsonb)) IS TRUE)
);
CREATE OR REPLACE FUNCTION payroll_validate_health_plan_qualification() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE next_revision INTEGER;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 SELECT COALESCE(max(revision),0)+1 INTO next_revision FROM payroll_health_plan_qualification WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id;
 IF NEW.revision<>next_revision THEN RAISE EXCEPTION 'Health plan qualification revision changed.'; END IF;
 IF NEW.source->>'fingerprint' IS DISTINCT FROM NEW.source_fingerprint OR NEW.source->>'facilityId' IS DISTINCT FROM NEW.facility_id::text OR NEW.source->>'planId' IS DISTINCT FROM NEW.plan_id THEN RAISE EXCEPTION 'Health plan qualification differs from its retained scope.'; END IF;
 IF NEW.review->>'effectiveOn' IS DISTINCT FROM NEW.effective_on::text OR NEW.review->>'effectiveThrough' IS DISTINCT FROM NEW.effective_through::text THEN RAISE EXCEPTION 'Health plan qualification dates differ from retained review.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_health_plan_qualification ON payroll_health_plan_qualification;
CREATE TRIGGER payroll_validate_health_plan_qualification BEFORE INSERT ON payroll_health_plan_qualification FOR EACH ROW EXECUTE FUNCTION payroll_validate_health_plan_qualification();
DROP TRIGGER IF EXISTS payroll_guard_health_plan_qualification ON payroll_health_plan_qualification;
CREATE TRIGGER payroll_guard_health_plan_qualification BEFORE UPDATE OR DELETE ON payroll_health_plan_qualification FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_health_participant_qualification (
 id UUID PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 onboarding_cycle INTEGER NOT NULL CHECK(onboarding_cycle>0),
 plan_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 effective_on DATE NOT NULL,
 effective_through DATE NOT NULL CHECK(effective_through>=effective_on),
 source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),
 source JSONB NOT NULL CHECK(jsonb_typeof(source)='object'),
 review JSONB NOT NULL CHECK((jsonb_typeof(review)='object' AND review->>'disposition' IN ('ELIGIBLE','SUSPENDED')) IS TRUE),
 request_key UUID NOT NULL,
 request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,employee_id,onboarding_cycle,plan_id,revision),
 UNIQUE(facility_id,request_key),
 CHECK((review->>'disposition'<>'ELIGIBLE' OR (review->'commonLawEmployeeConfirmed'='true'::jsonb AND review->'ownershipEligibleConfirmed'='true'::jsonb AND review->'coverageEligibleConfirmed'='true'::jsonb AND review->'electionRulesConfirmed'='true'::jsonb AND review->'nondiscriminationConfirmed'='true'::jsonb)) IS TRUE)
);
CREATE OR REPLACE FUNCTION payroll_validate_health_participant_qualification() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE next_revision INTEGER;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE facility_id=NEW.facility_id AND id=NEW.employee_id) THEN RAISE EXCEPTION 'Health participant belongs to another workplace.'; END IF;
 SELECT COALESCE(max(revision),0)+1 INTO next_revision FROM payroll_health_participant_qualification WHERE facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND onboarding_cycle=NEW.onboarding_cycle AND plan_id=NEW.plan_id;
 IF NEW.revision<>next_revision THEN RAISE EXCEPTION 'Health participant qualification revision changed.'; END IF;
 IF NEW.source->>'fingerprint' IS DISTINCT FROM NEW.source_fingerprint OR NEW.source->>'facilityId' IS DISTINCT FROM NEW.facility_id::text OR NEW.source->>'employeeId' IS DISTINCT FROM NEW.employee_id::text OR NEW.source->>'onboardingCycle' IS DISTINCT FROM NEW.onboarding_cycle::text OR NEW.source->>'planId' IS DISTINCT FROM NEW.plan_id THEN RAISE EXCEPTION 'Health participant qualification differs from its retained scope.'; END IF;
 IF NEW.review->>'effectiveOn' IS DISTINCT FROM NEW.effective_on::text OR NEW.review->>'effectiveThrough' IS DISTINCT FROM NEW.effective_through::text THEN RAISE EXCEPTION 'Health participant qualification dates differ from retained review.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_health_participant_qualification ON payroll_health_participant_qualification;
CREATE TRIGGER payroll_validate_health_participant_qualification BEFORE INSERT ON payroll_health_participant_qualification FOR EACH ROW EXECUTE FUNCTION payroll_validate_health_participant_qualification();
DROP TRIGGER IF EXISTS payroll_guard_health_participant_qualification ON payroll_health_participant_qualification;
CREATE TRIGGER payroll_guard_health_participant_qualification BEFORE UPDATE OR DELETE ON payroll_health_participant_qualification FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
