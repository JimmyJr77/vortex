-- Null means legacy/unknown. Never infer non-send from an absent journal.
ALTER TABLE payroll_settlement_journal_observation ADD COLUMN IF NOT EXISTS create_attempted BOOLEAN;
CREATE TABLE IF NOT EXISTS payroll_settlement_unsent_retry (
 id UUID PRIMARY KEY,
 journal_id UUID NOT NULL REFERENCES payroll_settlement_journal(id),
 prior_submission_id BIGINT NOT NULL UNIQUE REFERENCES payroll_settlement_journal_observation(id),
 absence_observation_id BIGINT NOT NULL UNIQUE REFERENCES payroll_settlement_journal_observation(id),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 500),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE payroll_settlement_journal_observation ADD COLUMN IF NOT EXISTS retry_id UUID REFERENCES payroll_settlement_unsent_retry(id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_settlement_retry_result ON payroll_settlement_journal_observation(retry_id) WHERE retry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payroll_settlement_retry_job ON payroll_settlement_unsent_retry(journal_id);
DROP TRIGGER IF EXISTS payroll_guard_settlement_retry ON payroll_settlement_unsent_retry;
CREATE TRIGGER payroll_guard_settlement_retry BEFORE UPDATE OR DELETE ON payroll_settlement_unsent_retry FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_settlement_retry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE job payroll_settlement_journal; initial_id BIGINT; latest_submission BIGINT; latest_observation BIGINT;
BEGIN
 SELECT * INTO job FROM payroll_settlement_journal WHERE id=NEW.journal_id;
 IF job.id IS NULL THEN RAISE EXCEPTION 'Settlement journal not found.'; END IF;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=job.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_settlement_journal_claim WHERE journal_id=job.id) THEN RAISE EXCEPTION 'Original journal claim is required.'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_settlement_journal_observation WHERE journal_id=job.id AND (create_attempted IS DISTINCT FROM false OR result->>'status' IS NULL OR result->>'status' NOT IN ('UNCERTAIN','BLOCKED_CONFIGURATION','NOT_FOUND'))) THEN RAISE EXCEPTION 'Settlement has unknown, transmitted or conflicting evidence.'; END IF;
 SELECT min(id) FILTER(WHERE source='SUBMISSION' AND retry_id IS NULL),max(id) FILTER(WHERE source='SUBMISSION'),max(id) INTO initial_id,latest_submission,latest_observation FROM payroll_settlement_journal_observation WHERE journal_id=job.id;
 IF initial_id IS NULL OR (SELECT count(*) FROM payroll_settlement_journal_observation WHERE journal_id=job.id AND source='SUBMISSION' AND retry_id IS NULL)<>1 OR initial_id<>(SELECT min(id) FROM payroll_settlement_journal_observation WHERE journal_id=job.id) THEN RAISE EXCEPTION 'Original completed no-send submission is required.'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_settlement_unsent_retry r WHERE r.journal_id=job.id AND NOT EXISTS(SELECT 1 FROM payroll_settlement_journal_observation o WHERE o.journal_id=job.id AND o.retry_id=r.id AND o.source='SUBMISSION' AND o.create_attempted=false)) THEN RAISE EXCEPTION 'Previous settlement retry is unresolved.'; END IF;
 IF NEW.prior_submission_id<>latest_submission OR NEW.absence_observation_id<>latest_observation OR NOT EXISTS(SELECT 1 FROM payroll_settlement_journal_observation WHERE id=NEW.absence_observation_id AND journal_id=job.id AND source='RECOVERY' AND create_attempted=false AND result->>'status'='NOT_FOUND' AND id>latest_submission) THEN RAISE EXCEPTION 'Current submission and fresh provider absence evidence are required.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_settlement_retry ON payroll_settlement_unsent_retry;
CREATE TRIGGER payroll_validate_settlement_retry BEFORE INSERT ON payroll_settlement_unsent_retry FOR EACH ROW EXECUTE FUNCTION payroll_validate_settlement_retry();
CREATE OR REPLACE FUNCTION payroll_validate_settlement_retry_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.retry_id IS NOT NULL AND (NEW.source<>'SUBMISSION' OR NEW.create_attempted IS NULL OR NOT EXISTS(SELECT 1 FROM payroll_settlement_unsent_retry WHERE id=NEW.retry_id AND journal_id=NEW.journal_id)) THEN RAISE EXCEPTION 'Retry result must belong to its claimed settlement journal.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_settlement_retry_observation ON payroll_settlement_journal_observation;
CREATE TRIGGER payroll_validate_settlement_retry_observation BEFORE INSERT ON payroll_settlement_journal_observation FOR EACH ROW EXECUTE FUNCTION payroll_validate_settlement_retry_observation();
