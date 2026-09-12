-- End-to-end onboarding, review queues, and encrypted document storage.
CREATE TABLE IF NOT EXISTS payroll_onboarding_task (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
 task_key TEXT NOT NULL,
 title TEXT NOT NULL,
 owner TEXT NOT NULL CHECK (owner IN ('EMPLOYEE','ADMIN')),
 required BOOLEAN NOT NULL DEFAULT true,
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','SUBMITTED','CHANGES_REQUESTED','COMPLETE','NOT_APPLICABLE')),
 due_date DATE,
 instructions TEXT NOT NULL DEFAULT '',
 response JSONB NOT NULL DEFAULT '{}',
 review_note TEXT,
 reviewed_by BIGINT,
 submitted_at TIMESTAMPTZ,
 completed_at TIMESTAMPTZ,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(employee_id,task_key)
);
CREATE TABLE IF NOT EXISTS payroll_private_document (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
 task_id BIGINT NOT NULL REFERENCES payroll_onboarding_task(id) ON DELETE CASCADE,
 filename TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 encrypted_content BYTEA NOT NULL,
 content_sha256 TEXT NOT NULL,
 uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payroll_employee_request (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK (kind IN ('LEAVE','TIME_CORRECTION','AVAILABILITY','EXPENSE','GENERAL')),
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','DECLINED','CANCELLED')),
 payload JSONB NOT NULL,
 review_note TEXT,
 reviewed_by BIGINT,
 reviewed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE payroll_settings ADD COLUMN IF NOT EXISTS onboarding_policy JSONB NOT NULL DEFAULT '{}';
ALTER TABLE payroll_employee ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE payroll_leave_transaction ADD COLUMN IF NOT EXISTS source_request_id BIGINT REFERENCES payroll_employee_request(id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_leave_request_unique ON payroll_leave_transaction(source_request_id) WHERE source_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payroll_requests_queue ON payroll_employee_request(facility_id,status,created_at);
CREATE INDEX IF NOT EXISTS payroll_onboarding_queue ON payroll_onboarding_task(facility_id,employee_id,status);
ALTER TABLE payroll_employee ADD COLUMN IF NOT EXISTS portal_password_hash TEXT;
ALTER TABLE payroll_recurring_adjustment ADD COLUMN IF NOT EXISTS source_request_id BIGINT REFERENCES payroll_employee_request(id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_adjustment_request_unique ON payroll_recurring_adjustment(source_request_id) WHERE source_request_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS payroll_quickbooks_connection (
 facility_id BIGINT PRIMARY KEY REFERENCES facility(id) ON DELETE CASCADE,
 realm_id TEXT NOT NULL,
 encrypted_tokens BYTEA NOT NULL,
 environment TEXT NOT NULL CHECK (environment IN ('sandbox','production')),
 account_ids JSONB NOT NULL DEFAULT '{}',
 auto_sync BOOLEAN NOT NULL DEFAULT false,
 connected_by BIGINT,
 connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payroll_quickbooks_oauth_state (
 token_hash TEXT PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 admin_id BIGINT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '10 minutes'
);
CREATE TABLE IF NOT EXISTS payroll_quickbooks_sync (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 payroll_run_id BIGINT NOT NULL REFERENCES payroll_run(id),
 realm_id TEXT NOT NULL,
 request_id TEXT NOT NULL UNIQUE,
 payload JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SYNCED','FAILED')),
 external_id TEXT,
 error_message TEXT,
 attempts INTEGER NOT NULL DEFAULT 0,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(facility_id,payroll_run_id,realm_id)
);
CREATE TABLE IF NOT EXISTS payroll_paid_leave (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 request_id BIGINT NOT NULL UNIQUE REFERENCES payroll_employee_request(id),
 leave_date DATE NOT NULL,
 minutes INTEGER NOT NULL CHECK (minutes>0),
 hourly_rate_cents INTEGER NOT NULL CHECK (hourly_rate_cents>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE payroll_run_employee ADD COLUMN IF NOT EXISTS paid_leave_cents BIGINT NOT NULL DEFAULT 0;
ALTER TABLE payroll_run_employee ADD COLUMN IF NOT EXISTS paid_leave_minutes INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS payroll_tax_election (
 facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 employee_id BIGINT PRIMARY KEY REFERENCES payroll_employee(id) ON DELETE CASCADE,
 tax_year INTEGER NOT NULL,
 elections JSONB NOT NULL,
 source_note TEXT NOT NULL,
 verified_by BIGINT NOT NULL,
 verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_quickbooks_sync ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production'));
ALTER TABLE payroll_quickbooks_sync DROP CONSTRAINT IF EXISTS payroll_quickbooks_sync_facility_id_payroll_run_id_realm_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_quickbooks_sync_destination ON payroll_quickbooks_sync (facility_id,payroll_run_id,realm_id,environment);

-- Serialize time changes with payroll approval and protect every API/import path.
-- Weighted premiums depend on all time in the frozen employee workweeks.
ALTER TABLE payroll_run ADD COLUMN IF NOT EXISTS run_kind text NOT NULL DEFAULT 'REGULAR' CHECK(run_kind IN ('REGULAR','OFF_CYCLE_REIMBURSEMENT'));

CREATE OR REPLACE FUNCTION payroll_weighted_time_locked(f BIGINT, employee BIGINT, starts TIMESTAMPTZ, ends TIMESTAMPTZ, tz TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT EXISTS(
  SELECT 1 FROM payroll_run r
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.calculation_snapshot->'employees','[]'::jsonb)) e
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e->'workweekPayments','[]'::jsonb)) w
  WHERE r.facility_id=f AND r.run_kind='REGULAR' AND r.status IN ('APPROVED','FINALIZED')
   AND e->>'employeeId'=employee::text AND e->>'weightedOvertimeApplied'='true' AND w->>'weightedPremiumApplied'='true'
   AND starts<(((w->>'week')::date+7)::timestamp AT TIME ZONE tz)
   AND COALESCE(ends,'infinity'::timestamptz)>((w->>'week')::date::timestamp AT TIME ZONE tz)
 )
$$;

CREATE OR REPLACE FUNCTION payroll_guard_time_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE f BIGINT; tz TEXT; locked BOOLEAN;
BEGIN
 f := CASE WHEN TG_OP='DELETE' THEN OLD.facility_id ELSE NEW.facility_id END;
 SELECT timezone INTO tz FROM payroll_settings WHERE facility_id=f FOR UPDATE;
 IF TG_OP<>'INSERT' THEN
  SELECT EXISTS(SELECT 1 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
   WHERE r.facility_id=f AND r.run_kind='REGULAR' AND r.status IN ('APPROVED','FINALIZED')
   AND OLD.clock_in<((p.period_end+1)::timestamp AT TIME ZONE tz)
   AND COALESCE(OLD.clock_out,'infinity'::timestamptz)>(p.period_start::timestamp AT TIME ZONE tz)) INTO locked;
  IF locked OR payroll_weighted_time_locked(f,OLD.employee_id,OLD.clock_in,OLD.clock_out,tz) THEN RAISE EXCEPTION 'Time belongs to approved or finalized payroll. Use a payroll correction.' USING ERRCODE='23514',CONSTRAINT='payroll_time_locked'; END IF;
 END IF;
 IF TG_OP<>'DELETE' THEN
  SELECT EXISTS(SELECT 1 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
   WHERE r.facility_id=f AND r.run_kind='REGULAR' AND r.status IN ('APPROVED','FINALIZED')
   AND NEW.clock_in<((p.period_end+1)::timestamp AT TIME ZONE tz)
   AND COALESCE(NEW.clock_out,'infinity'::timestamptz)>(p.period_start::timestamp AT TIME ZONE tz)) INTO locked;
  IF locked OR payroll_weighted_time_locked(f,NEW.employee_id,NEW.clock_in,NEW.clock_out,tz) THEN RAISE EXCEPTION 'Time belongs to approved or finalized payroll. Use a payroll correction.' USING ERRCODE='23514',CONSTRAINT='payroll_time_locked'; END IF;
  IF NEW.status<>'REJECTED' AND EXISTS(SELECT 1 FROM payroll_time_entry t
   WHERE t.facility_id=f AND t.employee_id=NEW.employee_id AND t.id<>NEW.id AND t.status<>'REJECTED'
   AND t.clock_in<COALESCE(NEW.clock_out,'infinity'::timestamptz)
   AND COALESCE(t.clock_out,'infinity'::timestamptz)>NEW.clock_in) THEN
   RAISE EXCEPTION 'Time overlaps another entry for this employee.' USING ERRCODE='23514',CONSTRAINT='payroll_time_overlap';
  END IF;
  RETURN NEW;
 END IF;
 RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS payroll_time_change_guard ON payroll_time_entry;
CREATE TRIGGER payroll_time_change_guard BEFORE INSERT OR UPDATE OR DELETE ON payroll_time_entry FOR EACH ROW EXECUTE FUNCTION payroll_guard_time_change();

ALTER TABLE payroll_run_employee ADD COLUMN IF NOT EXISTS statement_snapshot JSONB;

ALTER TABLE payroll_settings ADD COLUMN IF NOT EXISTS employer_tax_config JSONB;
ALTER TABLE payroll_run_employee ADD COLUMN IF NOT EXISTS futa_tax_cents BIGINT NOT NULL DEFAULT 0;
ALTER TABLE payroll_run_employee ADD COLUMN IF NOT EXISTS md_ui_tax_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE payroll_paid_leave DROP CONSTRAINT IF EXISTS payroll_paid_leave_request_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_paid_leave_request_day ON payroll_paid_leave(request_id,leave_date);

-- Opening rates are preserved when future compensation is scheduled.
CREATE TABLE IF NOT EXISTS payroll_pay_rate (
  id bigserial PRIMARY KEY,
  facility_id bigint NOT NULL REFERENCES facility(id),
  employee_id bigint NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
  effective_on date NOT NULL,
  hourly_rate_cents integer NOT NULL CHECK (hourly_rate_cents >= 0),
  reason text NOT NULL,
  notice_delivered_on date,
  notice_reference text,
  acknowledged_at timestamptz,
  created_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id,effective_on)
);
ALTER TABLE payroll_pay_rate ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE payroll_pay_rate ADD COLUMN IF NOT EXISTS cancelled_by bigint;
ALTER TABLE payroll_pay_rate ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE payroll_pay_rate ADD COLUMN IF NOT EXISTS cancellation_notice_delivered_on date;
ALTER TABLE payroll_pay_rate ADD COLUMN IF NOT EXISTS cancellation_notice_reference text;
ALTER TABLE payroll_pay_rate ADD COLUMN IF NOT EXISTS cancellation_acknowledged_at timestamptz;
ALTER TABLE payroll_pay_rate DROP CONSTRAINT IF EXISTS payroll_pay_rate_employee_id_effective_on_key;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_pay_rate_live_effective
 ON payroll_pay_rate(employee_id,effective_on) WHERE cancelled_at IS NULL;
INSERT INTO payroll_pay_rate (facility_id,employee_id,effective_on,hourly_rate_cents,reason)
SELECT facility_id,id,hire_date,hourly_rate_cents,'Opening rate from existing employee profile; verify legacy records before historical corrections.'
FROM payroll_employee WHERE pay_type='HOURLY' AND hourly_rate_cents IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE payroll_run ADD COLUMN IF NOT EXISTS payment_date date;
-- Preserve the date used by existing calculations; future drafts can choose another date.
UPDATE payroll_run r SET payment_date=p.pay_date FROM payroll_pay_period p
WHERE p.id=r.pay_period_id AND r.payment_date IS NULL;

CREATE TABLE IF NOT EXISTS payroll_tax_deposit (
 id bigserial PRIMARY KEY,
 facility_id bigint NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 agency text NOT NULL CHECK(agency IN ('IRS_941','IRS_FUTA','MD_WITHHOLDING','MD_UI')),
 tax_year integer NOT NULL CHECK(tax_year BETWEEN 2000 AND 2200),
 tax_quarter integer NOT NULL CHECK(tax_quarter BETWEEN 1 AND 4),
 paid_on date NOT NULL,
 amount_cents bigint NOT NULL CHECK(amount_cents>0),
 reference text NOT NULL,
 notes text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'RECORDED' CHECK(status IN ('RECORDED','VOID')),
 void_reason text,
 created_by bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(facility_id,agency,reference)
);
CREATE TABLE IF NOT EXISTS payroll_tax_filing (
 id bigserial PRIMARY KEY,
 facility_id bigint NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 form_type text NOT NULL CHECK(form_type IN ('IRS_941','IRS_940','MD_MW506','MD_MW508','MD_UI','W2_W3')),
 period_start date NOT NULL,
 period_end date NOT NULL CHECK(period_end>=period_start),
 filed_on date NOT NULL,
 reference text NOT NULL,
 reported_wages_cents bigint NOT NULL CHECK(reported_wages_cents>=0),
 reported_tax_cents bigint NOT NULL CHECK(reported_tax_cents>=0),
 payroll_snapshot jsonb NOT NULL,
 notes text NOT NULL DEFAULT '',
 created_by bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(facility_id,form_type,reference)
);

ALTER TABLE payroll_quickbooks_oauth_state ADD COLUMN IF NOT EXISTS environment text;
ALTER TABLE payroll_quickbooks_oauth_state ADD COLUMN IF NOT EXISTS redirect_uri text;
ALTER TABLE payroll_quickbooks_oauth_state ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE payroll_quickbooks_oauth_state ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE payroll_settings ADD COLUMN IF NOT EXISTS quickbooks_connection_generation integer NOT NULL DEFAULT 0;
ALTER TABLE payroll_quickbooks_oauth_state ADD COLUMN IF NOT EXISTS connection_generation integer NOT NULL DEFAULT 0;

-- Rejected entries remain in the audit history but do not occupy the active clock.
DROP INDEX IF EXISTS idx_payroll_one_open_clock;
CREATE UNIQUE INDEX idx_payroll_one_open_clock
  ON payroll_time_entry(employee_id) WHERE clock_out IS NULL AND status <> 'REJECTED';

CREATE TABLE IF NOT EXISTS payroll_federal_deposit_schedule (
 facility_id bigint NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 tax_year integer NOT NULL,
 schedule text NOT NULL CHECK(schedule IN ('MONTHLY','SEMIWEEKLY')),
 prior_year_next_day boolean NOT NULL,
 source text NOT NULL,
 verified_by bigint,
 verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(facility_id,tax_year)
);

CREATE TABLE IF NOT EXISTS payroll_md_ui_reporting_config (
 facility_id bigint NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 tax_year integer NOT NULL,
 first_quarter integer NOT NULL CHECK(first_quarter BETWEEN 1 AND 4),
 last_quarter integer NOT NULL CHECK(last_quarter BETWEEN first_quarter AND 4),
 source text NOT NULL,
 verified_by bigint,
 verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(facility_id,tax_year)
);

CREATE TABLE IF NOT EXISTS payroll_md_withholding_config (
 facility_id bigint NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 tax_year integer NOT NULL,
 schedule text NOT NULL CHECK(schedule IN ('MONTHLY','QUARTERLY','ANNUAL','SEASONAL','ACCELERATED')),
 months integer[] NOT NULL,
 source text NOT NULL,
 verified_by bigint,
 verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(facility_id,tax_year)
);

-- Accelerated Maryland returns have their own form identity and receipt history.
ALTER TABLE payroll_tax_filing DROP CONSTRAINT IF EXISTS payroll_tax_filing_form_type_check;
ALTER TABLE payroll_tax_filing ADD CONSTRAINT payroll_tax_filing_form_type_check CHECK(form_type IN ('IRS_941','IRS_940','MD_MW506','MD_MW506M','MD_MW508','MD_UI','W2_W3'));

ALTER TABLE payroll_tax_filing ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE payroll_tax_filing ADD COLUMN IF NOT EXISTS void_reason text;

ALTER TABLE payroll_settings ADD COLUMN IF NOT EXISTS pay_period_anchor_start date;
ALTER TABLE payroll_settings ADD COLUMN IF NOT EXISTS pay_period_payment_lag_days integer CHECK(pay_period_payment_lag_days BETWEEN 1 AND 31);

CREATE TABLE IF NOT EXISTS payroll_schedule_version (
 id bigserial PRIMARY KEY,
 facility_id bigint NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 effective_on date NOT NULL,
 schedule_settings jsonb NOT NULL CHECK(jsonb_typeof(schedule_settings)='object'),
 source text NOT NULL,
 created_by bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(facility_id,effective_on)
);
ALTER TABLE payroll_schedule_version ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE payroll_schedule_version ADD COLUMN IF NOT EXISTS cancelled_by bigint;
ALTER TABLE payroll_schedule_version ADD COLUMN IF NOT EXISTS cancellation_source text;
ALTER TABLE payroll_schedule_version DROP CONSTRAINT IF EXISTS payroll_schedule_version_facility_id_effective_on_key;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_schedule_version_active_date ON payroll_schedule_version(facility_id,effective_on) WHERE cancelled_at IS NULL;
ALTER TABLE payroll_schedule_version ADD COLUMN IF NOT EXISTS notice_delivered_on date;
ALTER TABLE payroll_schedule_version ADD COLUMN IF NOT EXISTS cancellation_notice_delivered_on date;
CREATE TABLE IF NOT EXISTS payroll_schedule_acknowledgment (
 id bigserial PRIMARY KEY,
 facility_id bigint NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 employee_id bigint NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
 schedule_version_id bigint NOT NULL REFERENCES payroll_schedule_version(id),
 notice_kind text NOT NULL CHECK(notice_kind IN ('CHANGE','CANCELLATION')),
 acknowledged_at timestamptz NOT NULL DEFAULT now(),
 notice_snapshot jsonb NOT NULL,
 UNIQUE(employee_id,schedule_version_id,notice_kind)
);
ALTER TABLE payroll_leave_transaction ADD COLUMN IF NOT EXISTS transaction_kind text NOT NULL DEFAULT 'ADJUSTMENT'
 CHECK(transaction_kind IN ('ADJUSTMENT','PAYROLL_ACCRUAL','OPENING_BALANCE','RESTORATION','ROLLOVER','FRONTLOAD'));
ALTER TABLE payroll_leave_transaction DROP CONSTRAINT IF EXISTS payroll_leave_transaction_transaction_kind_check;
ALTER TABLE payroll_leave_transaction ADD CONSTRAINT payroll_leave_transaction_transaction_kind_check CHECK(transaction_kind IN ('ADJUSTMENT','PAYROLL_ACCRUAL','OPENING_BALANCE','RESTORATION','ROLLOVER','FRONTLOAD','CORRECTION_ACCRUAL'));
UPDATE payroll_leave_transaction SET transaction_kind='PAYROLL_ACCRUAL' WHERE source_run_employee_id IS NOT NULL AND transaction_kind='ADJUSTMENT';
CREATE TABLE IF NOT EXISTS payroll_leave_year_close (
 id bigserial PRIMARY KEY,
 facility_id bigint NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 opening_year integer NOT NULL CHECK(opening_year BETWEEN 2001 AND 2200),
 policy_snapshot jsonb NOT NULL,
 employee_snapshot jsonb NOT NULL,
 source text NOT NULL,
 created_by bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(facility_id,opening_year)
);
CREATE OR REPLACE FUNCTION payroll_protect_closed_leave_year() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_facility bigint;
BEGIN
 row_facility:=CASE WHEN TG_OP='DELETE' THEN OLD.facility_id ELSE NEW.facility_id END;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=row_facility FOR UPDATE;
 IF TG_OP<>'INSERT' AND OLD.leave_type='MD_SICK_SAFE' AND EXISTS(SELECT 1 FROM payroll_leave_year_close c WHERE c.facility_id=OLD.facility_id AND (OLD.transaction_date<make_date(c.opening_year,1,1) OR (OLD.transaction_date=make_date(c.opening_year,1,1) AND OLD.transaction_kind IN ('ROLLOVER','FRONTLOAD')))) THEN
  RAISE EXCEPTION 'This leave entry belongs to a closed leave year. Record a documented correction in the current year.' USING ERRCODE='23514',CONSTRAINT='payroll_leave_year_closed';
 END IF;
 IF TG_OP<>'DELETE' AND NEW.leave_type='MD_SICK_SAFE' AND EXISTS(SELECT 1 FROM payroll_leave_year_close c WHERE c.facility_id=NEW.facility_id AND (NEW.transaction_date<make_date(c.opening_year,1,1) OR (NEW.transaction_date=make_date(c.opening_year,1,1) AND NEW.transaction_kind IN ('ROLLOVER','FRONTLOAD')))) THEN
  RAISE EXCEPTION 'This leave date belongs to a closed leave year. Record a documented correction in the current year.' USING ERRCODE='23514',CONSTRAINT='payroll_leave_year_closed';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_protect_closed_leave_year ON payroll_leave_transaction;
CREATE TRIGGER payroll_protect_closed_leave_year BEFORE INSERT OR UPDATE OR DELETE ON payroll_leave_transaction FOR EACH ROW EXECUTE FUNCTION payroll_protect_closed_leave_year();
CREATE TABLE IF NOT EXISTS payroll_leave_year_policy (
 facility_id bigint PRIMARY KEY REFERENCES facility(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 first_year integer NOT NULL CHECK(first_year BETWEEN 2001 AND 2200),
 carry_cap_minutes integer NOT NULL CHECK(carry_cap_minutes BETWEEN 2400 AND 3840),
 frontload_minutes integer NOT NULL CHECK(frontload_minutes BETWEEN 2400 AND 3840),
 source text NOT NULL,
 verified_by bigint,
 verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payroll_leave_fraction_reconciliation (
 id bigserial PRIMARY KEY,
 facility_id bigint NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 employee_id bigint NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
 through_run_id bigint NOT NULL REFERENCES payroll_run(id),
 effective_on date NOT NULL,
 credited_minutes integer NOT NULL CHECK(credited_minutes>=0),
 remainder integer NOT NULL CHECK(remainder BETWEEN 0 AND 29),
 source text NOT NULL,
 history_snapshot jsonb NOT NULL,
 created_by bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(employee_id,through_run_id)
);
ALTER TABLE payroll_employee ADD COLUMN IF NOT EXISTS salary_review jsonb;

ALTER TABLE payroll_paid_leave ADD COLUMN IF NOT EXISTS included_in_salary boolean NOT NULL DEFAULT false;
ALTER TABLE payroll_paid_leave ALTER COLUMN hourly_rate_cents DROP NOT NULL;
ALTER TABLE payroll_paid_leave DROP CONSTRAINT IF EXISTS payroll_paid_leave_hourly_rate_cents_check;
ALTER TABLE payroll_paid_leave DROP CONSTRAINT IF EXISTS payroll_paid_leave_pay_basis_check;
ALTER TABLE payroll_paid_leave ADD CONSTRAINT payroll_paid_leave_pay_basis_check CHECK (
 (included_in_salary AND hourly_rate_cents IS NULL) OR
 (NOT included_in_salary AND hourly_rate_cents IS NOT NULL AND hourly_rate_cents>0)
);

CREATE TABLE IF NOT EXISTS payroll_salary_change (
 id bigserial PRIMARY KEY,
 facility_id bigint NOT NULL REFERENCES facility(id),
 employee_id bigint NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
 effective_on date NOT NULL,
 annual_salary_cents bigint NOT NULL CHECK(annual_salary_cents>0),
 salary_review jsonb NOT NULL,
 reason text NOT NULL,
 notice_delivered_on date,
 notice_reference text,
 created_by bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 cancelled_at timestamptz,
 cancellation_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_salary_change_active_date ON payroll_salary_change(employee_id,effective_on) WHERE cancelled_at IS NULL;
ALTER TABLE payroll_salary_change ADD COLUMN IF NOT EXISTS cancelled_by bigint;
ALTER TABLE payroll_salary_change ADD COLUMN IF NOT EXISTS cancellation_notice_delivered_on date;
ALTER TABLE payroll_salary_change ADD COLUMN IF NOT EXISTS cancellation_notice_reference text;
ALTER TABLE payroll_salary_change ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
ALTER TABLE payroll_salary_change ADD COLUMN IF NOT EXISTS acknowledged_notice jsonb;
ALTER TABLE payroll_salary_change ADD COLUMN IF NOT EXISTS cancellation_acknowledged_at timestamptz;
ALTER TABLE payroll_salary_change ADD COLUMN IF NOT EXISTS cancellation_acknowledged_notice jsonb;
ALTER TABLE payroll_recurring_adjustment ADD COLUMN IF NOT EXISTS bonus_pay_period_id bigint REFERENCES payroll_pay_period(id);
ALTER TABLE payroll_recurring_adjustment ADD COLUMN IF NOT EXISTS bonus_review jsonb;
ALTER TABLE payroll_recurring_adjustment ADD COLUMN IF NOT EXISTS bonus_request_key text;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_bonus_request_unique ON payroll_recurring_adjustment(facility_id,bonus_request_key) WHERE bonus_request_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS payroll_leave_payout (
 id bigserial PRIMARY KEY,
 facility_id bigint NOT NULL REFERENCES facility(id),
 employee_id bigint NOT NULL REFERENCES payroll_employee(id),
 pay_period_id bigint NOT NULL REFERENCES payroll_pay_period(id),
 minutes bigint NOT NULL CHECK(minutes>0),
 hourly_rate_cents bigint NOT NULL CHECK(hourly_rate_cents>0),
 amount_cents bigint NOT NULL CHECK(amount_cents>0),
 status text NOT NULL DEFAULT 'RESERVED' CHECK(status IN ('RESERVED','CANCELLED','PAID')),
 request_key text NOT NULL,
 review jsonb NOT NULL,
 reserved_on date NOT NULL,
 created_by bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 cancelled_by bigint,
 cancelled_at timestamptz,
 cancellation_reason text,
 paid_run_employee_id bigint REFERENCES payroll_run_employee(id),
 leave_transaction_id bigint UNIQUE REFERENCES payroll_leave_transaction(id),
 UNIQUE(facility_id,request_key)
);
ALTER TABLE payroll_leave_payout ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'REGULAR' CHECK(payment_mode IN ('REGULAR','STANDALONE'));
ALTER TABLE payroll_leave_payout ADD COLUMN IF NOT EXISTS offcycle_run_id bigint REFERENCES payroll_run(id);
CREATE INDEX IF NOT EXISTS payroll_leave_payout_pending ON payroll_leave_payout(facility_id,employee_id) WHERE status='RESERVED';
CREATE OR REPLACE FUNCTION payroll_lock_leave_payout() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=CASE WHEN TG_OP='DELETE' THEN OLD.facility_id ELSE NEW.facility_id END FOR UPDATE;
 IF TG_OP='UPDATE' AND (NEW.facility_id,NEW.employee_id,NEW.pay_period_id,NEW.minutes,NEW.hourly_rate_cents,NEW.amount_cents,NEW.request_key,NEW.review,NEW.reserved_on,NEW.payment_mode) IS DISTINCT FROM (OLD.facility_id,OLD.employee_id,OLD.pay_period_id,OLD.minutes,OLD.hourly_rate_cents,OLD.amount_cents,OLD.request_key,OLD.review,OLD.reserved_on,OLD.payment_mode) THEN
  RAISE EXCEPTION 'Cancel and replace a leave payout instead of rewriting its reviewed terms.' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Cancel a leave payout to preserve its audit history.' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' AND NEW.status<>'RESERVED' THEN RAISE EXCEPTION 'A leave payout must start reserved.' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND OLD.status<>'RESERVED' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Completed or cancelled leave payouts cannot be changed.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_lock_leave_payout ON payroll_leave_payout;
CREATE TRIGGER payroll_lock_leave_payout BEFORE INSERT OR UPDATE OR DELETE ON payroll_leave_payout FOR EACH ROW EXECUTE FUNCTION payroll_lock_leave_payout();
CREATE OR REPLACE FUNCTION payroll_check_reserved_pto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_f bigint; old_e bigint; new_f bigint; new_e bigint; account record; reserved bigint; balance bigint; local_today date;
BEGIN
 IF TG_OP<>'INSERT' THEN old_f:=OLD.facility_id; old_e:=OLD.employee_id; END IF;
 IF TG_OP<>'DELETE' THEN new_f:=NEW.facility_id; new_e:=NEW.employee_id; END IF;
 FOR account IN SELECT DISTINCT f,e FROM (VALUES(old_f,old_e),(new_f,new_e)) AS v(f,e) WHERE f IS NOT NULL LOOP
  SELECT COALESCE(SUM(minutes),0) INTO reserved FROM payroll_leave_payout WHERE facility_id=account.f AND employee_id=account.e AND status='RESERVED';
  IF reserved>0 THEN
   SELECT (now() AT TIME ZONE timezone)::date INTO local_today FROM payroll_settings WHERE facility_id=account.f;
   SELECT COALESCE(SUM(minutes),0) INTO balance FROM payroll_leave_transaction WHERE facility_id=account.f AND employee_id=account.e AND leave_type='PTO' AND (transaction_date<=local_today OR minutes<0);
   IF balance<reserved THEN RAISE EXCEPTION 'PTO is reserved for a pending payout. Cancel the reservation before spending or reducing that balance.' USING ERRCODE='23514',CONSTRAINT='payroll_leave_payout_reserved'; END IF;
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_check_reserved_pto ON payroll_leave_payout;
CREATE CONSTRAINT TRIGGER payroll_check_reserved_pto AFTER INSERT OR UPDATE OR DELETE ON payroll_leave_payout DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION payroll_check_reserved_pto();
DROP TRIGGER IF EXISTS payroll_check_reserved_pto ON payroll_leave_transaction;
CREATE CONSTRAINT TRIGGER payroll_check_reserved_pto AFTER INSERT OR UPDATE OR DELETE ON payroll_leave_transaction DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION payroll_check_reserved_pto();

CREATE OR REPLACE FUNCTION payroll_protect_paid_pto_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM payroll_leave_payout WHERE leave_transaction_id=OLD.id AND status='PAID') THEN
  RAISE EXCEPTION 'A paid PTO payout ledger entry is immutable. Record a separate reviewed correction.' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_protect_paid_pto_ledger ON payroll_leave_transaction;
CREATE TRIGGER payroll_protect_paid_pto_ledger BEFORE UPDATE OR DELETE ON payroll_leave_transaction FOR EACH ROW EXECUTE FUNCTION payroll_protect_paid_pto_ledger();

ALTER TABLE payroll_run ADD COLUMN IF NOT EXISTS offcycle_context jsonb;
ALTER TABLE payroll_recurring_adjustment ADD COLUMN IF NOT EXISTS offcycle_run_id bigint REFERENCES payroll_run(id);

ALTER TABLE payroll_run DROP CONSTRAINT IF EXISTS payroll_run_run_kind_check;
ALTER TABLE payroll_run ADD CONSTRAINT payroll_run_run_kind_check CHECK(run_kind IN ('REGULAR','OFF_CYCLE_REIMBURSEMENT','OFF_CYCLE_BONUS','OFF_CYCLE_PTO'));
CREATE UNIQUE INDEX IF NOT EXISTS payroll_offcycle_bonus_request_unique ON payroll_run(facility_id,(offcycle_context->>'requestKey')) WHERE run_kind='OFF_CYCLE_BONUS';

CREATE UNIQUE INDEX IF NOT EXISTS payroll_offcycle_pto_unique ON payroll_run(facility_id,(offcycle_context->>'payoutId')) WHERE run_kind='OFF_CYCLE_PTO' AND status<>'VOID';

-- Preserve employment ranges independently from the current hiring profile.
CREATE TABLE IF NOT EXISTS payroll_employment_period (
 id bigserial PRIMARY KEY,
 facility_id bigint NOT NULL REFERENCES facility(id),
 employee_id bigint NOT NULL REFERENCES payroll_employee(id),
 started_on date NOT NULL,
 ended_on date,
 source text NOT NULL DEFAULT 'EMPLOYEE_PROFILE',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ended_on IS NULL OR ended_on>=started_on),
 UNIQUE(employee_id,started_on)
);
INSERT INTO payroll_employment_period(facility_id,employee_id,started_on,ended_on)
 SELECT facility_id,id,hire_date,termination_date FROM payroll_employee
 WHERE termination_date IS NULL OR termination_date>=hire_date
 ON CONFLICT(employee_id,started_on) DO NOTHING;
ALTER TABLE payroll_employment_period ADD COLUMN IF NOT EXISTS pay_type text;
UPDATE payroll_employment_period ep SET pay_type=e.pay_type FROM payroll_employee e WHERE e.id=ep.employee_id AND e.facility_id=ep.facility_id AND ep.pay_type IS NULL;
ALTER TABLE payroll_employment_period ALTER COLUMN pay_type SET NOT NULL;
ALTER TABLE payroll_employment_period DROP CONSTRAINT IF EXISTS payroll_employment_period_pay_type_check;
ALTER TABLE payroll_employment_period ADD CONSTRAINT payroll_employment_period_pay_type_check CHECK(pay_type IN ('HOURLY','SALARY'));
CREATE OR REPLACE FUNCTION payroll_guard_employment_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Employment periods must be retained with payroll history.' USING ERRCODE='23514'; END IF;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Employment period employee does not belong to this employer.' USING ERRCODE='23514'; END IF;
 IF NEW.pay_type IS NULL THEN SELECT pay_type INTO NEW.pay_type FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id; END IF;
 IF TG_OP='UPDATE' AND NEW.pay_type IS DISTINCT FROM OLD.pay_type AND NOT EXISTS(SELECT 1 FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id AND hire_date=NEW.started_on AND employment_status='ONBOARDING') THEN RAISE EXCEPTION 'Historical employment pay basis cannot be rewritten.' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW.facility_id,NEW.employee_id,NEW.started_on) IS DISTINCT FROM (OLD.facility_id,OLD.employee_id,OLD.started_on) THEN RAISE EXCEPTION 'Employment period identity and start date cannot be rewritten.' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_employment_period WHERE employee_id=NEW.employee_id AND id<>NEW.id AND started_on<>NEW.started_on AND daterange(started_on,ended_on,'[]') && daterange(NEW.started_on,NEW.ended_on,'[]')) THEN RAISE EXCEPTION 'Employment periods cannot overlap.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_employment_period ON payroll_employment_period;
CREATE TRIGGER payroll_guard_employment_period BEFORE INSERT OR UPDATE OR DELETE ON payroll_employment_period FOR EACH ROW EXECUTE FUNCTION payroll_guard_employment_period();
CREATE OR REPLACE FUNCTION payroll_sync_employment_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO payroll_employment_period(facility_id,employee_id,started_on,ended_on,pay_type)
 VALUES(NEW.facility_id,NEW.id,NEW.hire_date,NEW.termination_date,NEW.pay_type)
 ON CONFLICT(employee_id,started_on) DO UPDATE SET ended_on=EXCLUDED.ended_on,pay_type=EXCLUDED.pay_type,updated_at=now()
 WHERE (payroll_employment_period.ended_on,payroll_employment_period.pay_type) IS DISTINCT FROM (EXCLUDED.ended_on,EXCLUDED.pay_type);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_sync_employment_period ON payroll_employee;
CREATE TRIGGER payroll_sync_employment_period AFTER INSERT OR UPDATE OF hire_date,termination_date,pay_type ON payroll_employee FOR EACH ROW EXECUTE FUNCTION payroll_sync_employment_period();

ALTER TABLE payroll_onboarding_task ADD COLUMN IF NOT EXISTS onboarding_cycle integer NOT NULL DEFAULT 1 CHECK(onboarding_cycle>0);
ALTER TABLE payroll_private_document ADD COLUMN IF NOT EXISTS onboarding_cycle integer NOT NULL DEFAULT 1 CHECK(onboarding_cycle>0);
CREATE TABLE IF NOT EXISTS payroll_onboarding_revision (
 id bigserial PRIMARY KEY,
 facility_id bigint NOT NULL REFERENCES facility(id),
 employee_id bigint NOT NULL REFERENCES payroll_employee(id),
 task_id bigint NOT NULL REFERENCES payroll_onboarding_task(id),
 onboarding_cycle integer NOT NULL,
 event text NOT NULL,
 snapshot jsonb NOT NULL,
 documents jsonb NOT NULL DEFAULT '[]',
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_onboarding_revision_task ON payroll_onboarding_revision(facility_id,employee_id,task_id,id);
CREATE OR REPLACE FUNCTION payroll_capture_onboarding_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE task payroll_onboarding_task; files jsonb;
BEGIN
 IF TG_TABLE_NAME='payroll_private_document' THEN
  SELECT * INTO task FROM payroll_onboarding_task WHERE id=NEW.task_id;
 ELSE
  task:=NEW;
  IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'filename',filename,'mime_type',mime_type,'uploaded_at',uploaded_at) ORDER BY id),'[]') INTO files
 FROM payroll_private_document WHERE task_id=task.id AND employee_id=task.employee_id AND facility_id=task.facility_id AND onboarding_cycle=task.onboarding_cycle;
 INSERT INTO payroll_onboarding_revision(facility_id,employee_id,task_id,onboarding_cycle,event,snapshot,documents)
 VALUES(task.facility_id,task.employee_id,task.id,task.onboarding_cycle,CASE WHEN TG_TABLE_NAME='payroll_private_document' THEN 'DOCUMENT_ADDED' ELSE TG_OP END,to_jsonb(task),files);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_capture_onboarding_revision ON payroll_onboarding_task;
CREATE TRIGGER payroll_capture_onboarding_revision AFTER INSERT OR UPDATE ON payroll_onboarding_task FOR EACH ROW EXECUTE FUNCTION payroll_capture_onboarding_revision();
DROP TRIGGER IF EXISTS payroll_capture_document_revision ON payroll_private_document;
CREATE TRIGGER payroll_capture_document_revision AFTER INSERT ON payroll_private_document FOR EACH ROW EXECUTE FUNCTION payroll_capture_onboarding_revision();
INSERT INTO payroll_onboarding_revision(facility_id,employee_id,task_id,onboarding_cycle,event,snapshot,documents)
 SELECT t.facility_id,t.employee_id,t.id,t.onboarding_cycle,'INITIAL_CAPTURE',to_jsonb(t),COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'filename',d.filename,'mime_type',d.mime_type,'uploaded_at',d.uploaded_at) ORDER BY d.id) FROM payroll_private_document d WHERE d.task_id=t.id AND d.onboarding_cycle=t.onboarding_cycle),'[]')
 FROM payroll_onboarding_task t WHERE NOT EXISTS(SELECT 1 FROM payroll_onboarding_revision r WHERE r.task_id=t.id);
CREATE OR REPLACE FUNCTION payroll_preserve_onboarding_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Onboarding revisions are immutable signed-record history.' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS payroll_preserve_onboarding_revision ON payroll_onboarding_revision;
CREATE TRIGGER payroll_preserve_onboarding_revision BEFORE UPDATE OR DELETE ON payroll_onboarding_revision FOR EACH ROW EXECUTE FUNCTION payroll_preserve_onboarding_revision();
CREATE OR REPLACE FUNCTION payroll_guard_onboarding_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.onboarding_cycle IS DISTINCT FROM OLD.onboarding_cycle AND
 (NEW.onboarding_cycle<>OLD.onboarding_cycle+1 OR NEW.status<>'OPEN' OR NEW.response<>'{}'::jsonb OR NEW.submitted_at IS NOT NULL OR NEW.completed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL) THEN
  RAISE EXCEPTION 'A new onboarding cycle must advance once and reset submissions and approvals.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_onboarding_cycle ON payroll_onboarding_task;
CREATE TRIGGER payroll_guard_onboarding_cycle BEFORE UPDATE ON payroll_onboarding_task FOR EACH ROW EXECUTE FUNCTION payroll_guard_onboarding_cycle();
CREATE OR REPLACE FUNCTION payroll_preserve_private_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Signed onboarding documents must be retained unchanged.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_onboarding_task WHERE id=NEW.task_id AND facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND onboarding_cycle=NEW.onboarding_cycle) THEN
  RAISE EXCEPTION 'Document must belong to the current employee onboarding cycle.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_preserve_private_document ON payroll_private_document;
CREATE TRIGGER payroll_preserve_private_document BEFORE INSERT OR UPDATE OR DELETE ON payroll_private_document FOR EACH ROW EXECUTE FUNCTION payroll_preserve_private_document();

-- Paid time remains immutable. Settlement supplies a separately retained source
-- amendment; readers see it only when its linked payment is finalized.
CREATE TABLE IF NOT EXISTS payroll_correction_settlement (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 request_id BIGINT NOT NULL UNIQUE REFERENCES payroll_employee_request(id),
 authorization_id BIGINT NOT NULL UNIQUE REFERENCES payroll_audit_log(id),
 run_employee_id BIGINT NOT NULL REFERENCES payroll_run_employee(id),
 effective_entry_id BIGINT NOT NULL DEFAULT nextval('payroll_time_entry_id_seq') CHECK(effective_entry_id>0),
 plan JSONB NOT NULL,
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_correction_source ON payroll_correction_settlement(facility_id,employee_id,effective_entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_correction_effective_identity ON payroll_correction_settlement(effective_entry_id);
CREATE OR REPLACE FUNCTION payroll_guard_correction_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q payroll_employee_request; a payroll_audit_log; r payroll_run; re payroll_run_employee; original payroll_time_entry;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Correction settlement evidence is immutable.' USING ERRCODE='23514'; END IF;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 SELECT * INTO q FROM payroll_employee_request WHERE id=NEW.request_id AND facility_id=NEW.facility_id AND employee_id=NEW.employee_id FOR UPDATE;
 SELECT * INTO re FROM payroll_run_employee WHERE id=NEW.run_employee_id AND employee_id=NEW.employee_id;
 SELECT * INTO r FROM payroll_run WHERE id=re.payroll_run_id AND facility_id=NEW.facility_id;
 SELECT * INTO a FROM payroll_audit_log WHERE id=NEW.authorization_id AND facility_id=NEW.facility_id AND entity_type='employee_request' AND entity_id=NEW.request_id::text AND action='CORRECTION_PAYMENT_AUTHORIZED';
 IF q.id IS NULL OR q.kind<>'TIME_CORRECTION' OR q.status<>'PENDING' OR r.id IS NULL OR r.status<>'APPROVED' OR r.run_kind<>'REGULAR' OR a.id IS NULL THEN
  RAISE EXCEPTION 'Settlement requires this employee pending correction and approved authorized payroll.' USING ERRCODE='23514';
 END IF;
 IF NEW.plan->>'version' IS DISTINCT FROM '1' OR NEW.plan->>'status' IS DISTINCT FROM 'AUTHORIZED_UNAPPLIED'
  OR NEW.plan->>'paymentApplied' IS DISTINCT FROM 'false'
  OR NEW.plan->>'requestId' IS DISTINCT FROM NEW.request_id::text OR NEW.plan->>'employeeId' IS DISTINCT FROM NEW.employee_id::text
  OR NEW.plan->>'authorizationId' IS DISTINCT FROM NEW.authorization_id::text
  OR NEW.plan->>'payPeriodId' IS DISTINCT FROM r.pay_period_id::text
  OR NEW.plan->'proposedTime' IS DISTINCT FROM q.payload
  OR NEW.plan->>'fingerprint' IS DISTINCT FROM a.after_data->'preview'->>'fingerprint'
  OR EXISTS(SELECT 1 FROM payroll_audit_log newer WHERE newer.facility_id=NEW.facility_id AND newer.entity_type='employee_request' AND newer.entity_id=NEW.request_id::text AND newer.action='CORRECTION_PAYMENT_AUTHORIZED' AND newer.id>a.id)
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.calculation_snapshot->'employees') e
    CROSS JOIN LATERAL jsonb_array_elements(e->'correctionSettlements') p
    WHERE e->>'employeeId'=NEW.employee_id::text AND p=NEW.plan) THEN
  RAISE EXCEPTION 'Settlement must match the complete approved correction plan and latest authorization.' USING ERRCODE='23514';
 END IF;
 IF q.payload->>'entryId' IS NOT NULL THEN
  SELECT * INTO original FROM payroll_time_entry WHERE id=(q.payload->>'entryId')::bigint AND facility_id=NEW.facility_id AND employee_id=NEW.employee_id;
  -- Approved JSON evidence uses JavaScript's millisecond timestamp precision.
  original.clock_in:=date_trunc('milliseconds',original.clock_in);
  original.clock_out:=date_trunc('milliseconds',original.clock_out);
  original.employee_attested_at:=date_trunc('milliseconds',original.employee_attested_at);
  original.approved_at:=date_trunc('milliseconds',original.approved_at);
  original.created_at:=date_trunc('milliseconds',original.created_at);
  original.updated_at:=date_trunc('milliseconds',original.updated_at);
  IF original.id IS NULL OR NEW.effective_entry_id<>original.id OR to_jsonb(original) IS DISTINCT FROM to_jsonb(jsonb_populate_record(NULL::payroll_time_entry,NEW.plan->'originalTime')) THEN
   RAISE EXCEPTION 'Settlement original time differs from retained evidence.' USING ERRCODE='23514';
  END IF;
 ELSE
  IF NEW.plan->'originalTime' IS DISTINCT FROM 'null'::jsonb OR EXISTS(SELECT 1 FROM payroll_time_entry WHERE id=NEW.effective_entry_id) THEN
   RAISE EXCEPTION 'Missing-time settlement must use a new time identity.' USING ERRCODE='23514';
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM payroll_correction_settlement WHERE effective_entry_id=NEW.effective_entry_id) THEN
  RAISE EXCEPTION 'An already amended entry requires correction-chain reconciliation.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_correction_settlement ON payroll_correction_settlement;
CREATE TRIGGER payroll_guard_correction_settlement BEFORE INSERT OR UPDATE OR DELETE ON payroll_correction_settlement FOR EACH ROW EXECUTE FUNCTION payroll_guard_correction_settlement();

CREATE OR REPLACE FUNCTION payroll_require_complete_correction_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payment payroll_run; employee_payment payroll_run_employee; request payroll_employee_request; historical_minutes BIGINT; target_minutes BIGINT;
BEGIN
 SELECT * INTO employee_payment FROM payroll_run_employee WHERE id=NEW.run_employee_id;
 SELECT * INTO payment FROM payroll_run WHERE id=employee_payment.payroll_run_id;
 SELECT * INTO request FROM payroll_employee_request WHERE id=NEW.request_id;
 SELECT COALESCE(SUM(minutes),0) INTO historical_minutes FROM payroll_leave_transaction
  WHERE source_request_id=NEW.request_id AND facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND leave_type='MD_SICK_SAFE';
 SELECT COALESCE(SUM(minutes),0) INTO target_minutes FROM payroll_leave_transaction
  WHERE source_run_employee_id=NEW.run_employee_id AND facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND leave_type='MD_SICK_SAFE';
 IF payment.status<>'FINALIZED' OR request.status<>'APPROVED' OR request.payload IS DISTINCT FROM NEW.plan->'proposedTime'
  OR COALESCE(payment.payment_date,(SELECT pay_date FROM payroll_pay_period WHERE id=payment.pay_period_id)) IS DISTINCT FROM (NEW.plan->>'paymentDate')::date
  OR (employee_payment.regular_pay_cents+employee_payment.overtime_pay_cents+employee_payment.other_taxable_pay_cents) IS DISTINCT FROM (NEW.plan->'after'->>'grossPayCents')::bigint
  OR employee_payment.net_pay_cents IS DISTINCT FROM (NEW.plan->'after'->>'netPayCents')::bigint
  OR historical_minutes IS DISTINCT FROM (NEW.plan->'correctionLeave'->>'creditDifferenceMinutes')::bigint
  OR target_minutes IS DISTINCT FROM (NEW.plan->'targetLeave'->'after'->>'accrualMinutes')::bigint
  OR EXISTS(SELECT 1 FROM payroll_leave_transaction l WHERE (l.source_request_id=NEW.request_id OR l.source_run_employee_id=NEW.run_employee_id)
   AND (l.transaction_date IS DISTINCT FROM (NEW.plan->>'paymentDate')::date OR l.facility_id<>NEW.facility_id OR l.employee_id<>NEW.employee_id OR l.leave_type<>'MD_SICK_SAFE'))
  OR NOT COALESCE(employee_payment.statement_snapshot->'correctionSettlementIds' @> jsonb_build_array(NEW.id),false) THEN
  RAISE EXCEPTION 'Correction source, leave, statement, request and finalized payment must commit together.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_require_complete_correction_settlement ON payroll_correction_settlement;
CREATE CONSTRAINT TRIGGER payroll_require_complete_correction_settlement AFTER INSERT ON payroll_correction_settlement DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_require_complete_correction_settlement();

CREATE OR REPLACE VIEW payroll_effective_time_entry AS
 SELECT t.* FROM payroll_time_entry t WHERE NOT EXISTS(
  SELECT 1 FROM payroll_correction_settlement c JOIN payroll_run_employee re ON re.id=c.run_employee_id JOIN payroll_run r ON r.id=re.payroll_run_id
  WHERE r.status='FINALIZED' AND c.facility_id=t.facility_id AND c.employee_id=t.employee_id AND c.effective_entry_id=t.id)
 UNION ALL
 SELECT amended.* FROM payroll_correction_settlement c
 JOIN payroll_run_employee re ON re.id=c.run_employee_id JOIN payroll_run r ON r.id=re.payroll_run_id
 CROSS JOIN LATERAL jsonb_populate_record(NULL::payroll_time_entry,
  COALESCE(NULLIF(c.plan->'originalTime','null'::jsonb),jsonb_build_object('activity_type','INSTRUCTION','source','RECONSTRUCTION','created_by',c.created_by,'created_at',c.created_at))
  ||jsonb_build_object('id',c.effective_entry_id,'facility_id',c.facility_id,'employee_id',c.employee_id,
   'clock_in',c.plan->'proposedTime'->>'clockIn','clock_out',c.plan->'proposedTime'->>'clockOut',
   'unpaid_break_minutes',COALESCE((c.plan->'proposedTime'->>'unpaidBreakMinutes')::integer,0),
   'status','APPROVED','approved_by',c.created_by,'approved_at',c.created_at,'updated_at',c.created_at,
   'evidence_note','Paid time correction settlement #'||c.id)) amended
 WHERE r.status='FINALIZED';

CREATE TABLE IF NOT EXISTS payroll_automation_run (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
 source TEXT NOT NULL CHECK(source IN ('SCHEDULED','MANUAL')),
 status TEXT NOT NULL DEFAULT 'RUNNING' CHECK(status IN ('RUNNING','SUCCEEDED','FAILED')),
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 finished_at TIMESTAMPTZ,
 result JSONB,
 error_message TEXT
);
CREATE INDEX IF NOT EXISTS payroll_automation_run_history ON payroll_automation_run(facility_id,id DESC);

CREATE TABLE IF NOT EXISTS payroll_income_tax_basis_review (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 run_employee_id BIGINT NOT NULL REFERENCES payroll_run_employee(id),
 request_key TEXT NOT NULL,
 source_fingerprint TEXT NOT NULL CHECK(length(source_fingerprint)=64),
 source_snapshot JSONB NOT NULL,
 federal_wages_cents BIGINT NOT NULL CHECK(federal_wages_cents>=0),
 maryland_wages_cents BIGINT NOT NULL CHECK(maryland_wages_cents>=0),
 evidence_reference TEXT NOT NULL CHECK(length(evidence_reference)>=12),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(facility_id,request_key)
);
CREATE INDEX IF NOT EXISTS payroll_income_tax_basis_history ON payroll_income_tax_basis_review(facility_id,run_employee_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_preserve_income_tax_basis_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Income-tax wage reviews are append-only.' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS payroll_preserve_income_tax_basis_review ON payroll_income_tax_basis_review;
CREATE TRIGGER payroll_preserve_income_tax_basis_review BEFORE UPDATE OR DELETE ON payroll_income_tax_basis_review FOR EACH ROW EXECUTE FUNCTION payroll_preserve_income_tax_basis_review();
CREATE OR REPLACE FUNCTION payroll_scope_income_tax_basis_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id JOIN payroll_employee e ON e.id=re.employee_id
  WHERE re.id=NEW.run_employee_id AND r.facility_id=NEW.facility_id AND e.facility_id=NEW.facility_id AND r.status='FINALIZED'
  AND NEW.federal_wages_cents<=re.regular_pay_cents+re.overtime_pay_cents+re.other_taxable_pay_cents
  AND NEW.maryland_wages_cents<=re.regular_pay_cents+re.overtime_pay_cents+re.other_taxable_pay_cents
  AND NEW.source_snapshot->>'runEmployeeId'=re.id::text AND NEW.source_snapshot->>'facilityId'=r.facility_id::text) THEN
  RAISE EXCEPTION 'Income-tax wage review must match finalized payroll and facility.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_scope_income_tax_basis_review ON payroll_income_tax_basis_review;
CREATE TRIGGER payroll_scope_income_tax_basis_review BEFORE INSERT ON payroll_income_tax_basis_review FOR EACH ROW EXECUTE FUNCTION payroll_scope_income_tax_basis_review();

CREATE TABLE IF NOT EXISTS payroll_filing_identity (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT REFERENCES payroll_employee(id),
 subject_key TEXT NOT NULL,
 encrypted_identity BYTEA NOT NULL,
 identifier_last4 TEXT NOT NULL CHECK(identifier_last4 ~ '^[0-9]{4}$'),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK((employee_id IS NULL AND subject_key='EMPLOYER') OR (employee_id IS NOT NULL AND subject_key='EMPLOYEE:'||employee_id::text))
);
CREATE INDEX IF NOT EXISTS payroll_filing_identity_history ON payroll_filing_identity(facility_id,subject_key,id DESC);
CREATE OR REPLACE FUNCTION payroll_guard_filing_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Filing identity revisions are append-only.' USING ERRCODE='23514'; END IF;
 IF NEW.employee_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id) THEN
  RAISE EXCEPTION 'Filing identity must belong to the employee facility.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_filing_identity ON payroll_filing_identity;
CREATE TRIGGER payroll_guard_filing_identity BEFORE INSERT OR UPDATE OR DELETE ON payroll_filing_identity FOR EACH ROW EXECUTE FUNCTION payroll_guard_filing_identity();

CREATE TABLE IF NOT EXISTS payroll_filing_identity_employee_review (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 identity_id BIGINT NOT NULL REFERENCES payroll_filing_identity(id),
 decision TEXT NOT NULL CHECK(decision IN ('CONFIRMED','CORRECTION_REQUESTED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_filing_identity_employee_review_history ON payroll_filing_identity_employee_review(facility_id,employee_id,identity_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_guard_filing_identity_employee_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Employee filing identity reviews are append-only.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_filing_identity WHERE id=NEW.identity_id AND employee_id=NEW.employee_id AND facility_id=NEW.facility_id) THEN
  RAISE EXCEPTION 'Employee filing review must match identity ownership.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_filing_identity_employee_review ON payroll_filing_identity_employee_review;
CREATE TRIGGER payroll_guard_filing_identity_employee_review BEFORE INSERT OR UPDATE OR DELETE ON payroll_filing_identity_employee_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_filing_identity_employee_review();

CREATE TABLE IF NOT EXISTS payroll_overtime_qualification (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 run_employee_id BIGINT NOT NULL REFERENCES payroll_run_employee(id),
 source_fingerprint TEXT NOT NULL CHECK(length(source_fingerprint)=64),
 qualified_premium_cents BIGINT NOT NULL CHECK(qualified_premium_cents>=0),
 flsa_status TEXT NOT NULL CHECK(flsa_status IN ('FLSA_REQUIRED','NOT_FLSA_REQUIRED')),
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(flsa_status<>'NOT_FLSA_REQUIRED' OR qualified_premium_cents=0)
);
CREATE INDEX IF NOT EXISTS payroll_overtime_qualification_history ON payroll_overtime_qualification(facility_id,run_employee_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_guard_overtime_qualification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Overtime qualification reviews are append-only.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id JOIN payroll_employee e ON e.id=re.employee_id WHERE re.id=NEW.run_employee_id AND r.facility_id=NEW.facility_id AND e.facility_id=NEW.facility_id AND r.status='FINALIZED') THEN RAISE EXCEPTION 'Overtime qualification must match finalized payroll ownership.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_overtime_qualification ON payroll_overtime_qualification;
CREATE TRIGGER payroll_guard_overtime_qualification BEFORE INSERT OR UPDATE OR DELETE ON payroll_overtime_qualification FOR EACH ROW EXECUTE FUNCTION payroll_guard_overtime_qualification();

CREATE TABLE IF NOT EXISTS payroll_annual_input_review (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 payment_year INTEGER NOT NULL CHECK(payment_year=2026),
 source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),
 encrypted_snapshot BYTEA NOT NULL,
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_annual_input_review_history ON payroll_annual_input_review(facility_id,employee_id,payment_year,id DESC);
CREATE OR REPLACE FUNCTION payroll_guard_annual_input_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Annual input reviews are append-only.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Annual input review must match employee facility.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_annual_input_review ON payroll_annual_input_review;
CREATE TRIGGER payroll_guard_annual_input_review BEFORE INSERT OR UPDATE OR DELETE ON payroll_annual_input_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_annual_input_review();

CREATE TABLE IF NOT EXISTS payroll_health_reporting_determination (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 payment_year INTEGER NOT NULL CHECK(payment_year=2026),
 disposition TEXT NOT NULL CHECK(disposition IN ('REPORT','SMALL_EMPLOYER_RELIEF','UNRESOLVED')),
 prior_year_w2_count INTEGER CHECK(prior_year_w2_count>=0),
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(disposition<>'SMALL_EMPLOYER_RELIEF' OR (prior_year_w2_count IS NOT NULL AND prior_year_w2_count<250))
);
CREATE INDEX IF NOT EXISTS payroll_health_reporting_history ON payroll_health_reporting_determination(facility_id,payment_year,id DESC);
CREATE OR REPLACE FUNCTION payroll_guard_health_reporting() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Health reporting determinations are append-only.' USING ERRCODE='23514';
END $$;
DROP TRIGGER IF EXISTS payroll_guard_health_reporting ON payroll_health_reporting_determination;
CREATE TRIGGER payroll_guard_health_reporting BEFORE UPDATE OR DELETE ON payroll_health_reporting_determination FOR EACH ROW EXECUTE FUNCTION payroll_guard_health_reporting();

CREATE TABLE IF NOT EXISTS payroll_employee_health_classification (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 payment_year INTEGER NOT NULL CHECK(payment_year=2026),
 determination_id BIGINT NOT NULL REFERENCES payroll_health_reporting_determination(id),
 source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),
 disposition TEXT NOT NULL CHECK(disposition IN ('REPORT','RELIEF_USED','NO_APPLICABLE_COVERAGE','UNRESOLVED')),
 reportable_cost_cents BIGINT,
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK((disposition='REPORT' AND reportable_cost_cents>0 AND reportable_cost_cents<=9007199254740991) OR (disposition<>'REPORT' AND reportable_cost_cents IS NULL)),
 CHECK(disposition<>'REPORT' OR reportable_cost_cents IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS payroll_employee_health_classification_history ON payroll_employee_health_classification(facility_id,employee_id,payment_year,id DESC);
CREATE OR REPLACE FUNCTION payroll_guard_employee_health_classification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Employee health classifications are append-only.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id) OR NOT EXISTS(SELECT 1 FROM payroll_health_reporting_determination WHERE id=NEW.determination_id AND facility_id=NEW.facility_id AND payment_year=NEW.payment_year AND (NEW.disposition<>'RELIEF_USED' OR disposition='SMALL_EMPLOYER_RELIEF')) THEN RAISE EXCEPTION 'Employee health classification must match employer determination and ownership.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_employee_health_classification ON payroll_employee_health_classification;
CREATE TRIGGER payroll_guard_employee_health_classification BEFORE INSERT OR UPDATE OR DELETE ON payroll_employee_health_classification FOR EACH ROW EXECUTE FUNCTION payroll_guard_employee_health_classification();

CREATE TABLE IF NOT EXISTS payroll_compensation_applicability (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 payment_year INTEGER NOT NULL CHECK(payment_year=2026),
 source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),
 categories JSONB NOT NULL CHECK(jsonb_typeof(categories)='object'),
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_compensation_applicability_history ON payroll_compensation_applicability(facility_id,employee_id,payment_year,id DESC);
CREATE OR REPLACE FUNCTION payroll_guard_compensation_applicability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Compensation applicability reviews are append-only.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Compensation review must match employee facility.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_compensation_applicability ON payroll_compensation_applicability;
CREATE TRIGGER payroll_guard_compensation_applicability BEFORE INSERT OR UPDATE OR DELETE ON payroll_compensation_applicability FOR EACH ROW EXECUTE FUNCTION payroll_guard_compensation_applicability();

CREATE TABLE IF NOT EXISTS payroll_w2_approval (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 payment_year INTEGER NOT NULL CHECK(payment_year=2026),
 draft_fingerprint TEXT NOT NULL CHECK(draft_fingerprint ~ '^[a-f0-9]{64}$'),
 encrypted_form BYTEA NOT NULL,
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_w2_approval_history ON payroll_w2_approval(facility_id,employee_id,payment_year,id DESC);
CREATE OR REPLACE FUNCTION payroll_guard_w2_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'W-2 approvals are append-only.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'W-2 approval must match employee facility.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w2_approval ON payroll_w2_approval;
CREATE TRIGGER payroll_guard_w2_approval BEFORE INSERT OR UPDATE OR DELETE ON payroll_w2_approval FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_approval();

CREATE TABLE IF NOT EXISTS payroll_w2_packet (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 approval_id BIGINT NOT NULL UNIQUE REFERENCES payroll_w2_approval(id),
 payment_year INTEGER NOT NULL CHECK(payment_year=2026),
 content_sha256 TEXT NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
 encrypted_pdf BYTEA NOT NULL,
 renderer_version TEXT NOT NULL CHECK(renderer_version='irs-2026-v1'),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION payroll_guard_w2_packet() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'W-2 packets are append-only.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_w2_approval WHERE id=NEW.approval_id AND employee_id=NEW.employee_id AND facility_id=NEW.facility_id AND payment_year=NEW.payment_year) THEN RAISE EXCEPTION 'W-2 packet must match approval ownership.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w2_packet ON payroll_w2_packet;
CREATE TRIGGER payroll_guard_w2_packet BEFORE INSERT OR UPDATE OR DELETE ON payroll_w2_packet FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_packet();

CREATE TABLE IF NOT EXISTS payroll_w2_furnishing_event (
 id BIGSERIAL PRIMARY KEY,
 packet_id BIGINT NOT NULL REFERENCES payroll_w2_packet(id),
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 event_type TEXT NOT NULL CHECK(event_type IN ('PAPER_MAILED','HAND_DELIVERED','RETURNED_UNDELIVERABLE')),
 occurred_at TIMESTAMPTZ NOT NULL,
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_w2_furnishing_history ON payroll_w2_furnishing_event(packet_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_guard_w2_furnishing() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior payroll_w2_furnishing_event%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'W-2 furnishing events are append-only.' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('w2-furnishing:'||NEW.packet_id,0));
 SELECT * INTO prior FROM payroll_w2_furnishing_event WHERE packet_id=NEW.packet_id ORDER BY id DESC LIMIT 1;
 IF (prior.id IS NOT NULL AND NEW.occurred_at<prior.occurred_at) OR (NEW.event_type='RETURNED_UNDELIVERABLE' AND (prior.id IS NULL OR prior.event_type<>'PAPER_MAILED')) THEN RAISE EXCEPTION 'W-2 furnishing events must follow the recorded mailing chronology.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_w2_packet WHERE id=NEW.packet_id AND employee_id=NEW.employee_id AND facility_id=NEW.facility_id AND created_at<=NEW.occurred_at) OR NEW.occurred_at>clock_timestamp() THEN RAISE EXCEPTION 'W-2 furnishing must match packet ownership and an actual event time.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w2_furnishing ON payroll_w2_furnishing_event;
CREATE TRIGGER payroll_guard_w2_furnishing BEFORE INSERT OR UPDATE OR DELETE ON payroll_w2_furnishing_event FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_furnishing();

CREATE TABLE IF NOT EXISTS payroll_w2_return_resolution (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 packet_id BIGINT NOT NULL REFERENCES payroll_w2_packet(id),
 return_event_id BIGINT NOT NULL REFERENCES payroll_w2_furnishing_event(id),
 replacement_packet_id BIGINT NOT NULL REFERENCES payroll_w2_packet(id),
 replacement_event_id BIGINT NOT NULL REFERENCES payroll_w2_furnishing_event(id),
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(packet_id<>replacement_packet_id)
);
CREATE INDEX IF NOT EXISTS payroll_w2_return_resolution_history ON payroll_w2_return_resolution(packet_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_guard_w2_return_resolution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'W-2 return resolutions are append-only.' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('w2-furnishing:'||LEAST(NEW.packet_id,NEW.replacement_packet_id),0));
 PERFORM pg_advisory_xact_lock(hashtextextended('w2-furnishing:'||GREATEST(NEW.packet_id,NEW.replacement_packet_id),0));
 IF NOT EXISTS(SELECT 1 FROM payroll_w2_packet p JOIN payroll_w2_packet r ON r.facility_id=p.facility_id AND r.employee_id=p.employee_id AND r.payment_year=p.payment_year AND r.approval_id>p.approval_id
 JOIN payroll_w2_furnishing_event origin_event ON origin_event.packet_id=p.id AND origin_event.id=NEW.return_event_id AND origin_event.event_type='RETURNED_UNDELIVERABLE'
 JOIN payroll_w2_furnishing_event newer ON newer.packet_id=r.id AND newer.id=NEW.replacement_event_id AND newer.event_type IN ('PAPER_MAILED','HAND_DELIVERED') AND newer.occurred_at>=origin_event.occurred_at
 WHERE p.id=NEW.packet_id AND r.id=NEW.replacement_packet_id AND p.facility_id=NEW.facility_id AND p.employee_id=NEW.employee_id
 AND origin_event.id=(SELECT max(id) FROM payroll_w2_furnishing_event WHERE packet_id=p.id)
 AND newer.id=(SELECT max(id) FROM payroll_w2_furnishing_event WHERE packet_id=r.id)) THEN RAISE EXCEPTION 'Return resolution must match current same-owner replacement furnishing evidence.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w2_return_resolution ON payroll_w2_return_resolution;
CREATE TRIGGER payroll_guard_w2_return_resolution BEFORE INSERT OR UPDATE OR DELETE ON payroll_w2_return_resolution FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_return_resolution();

CREATE TABLE IF NOT EXISTS payroll_w2_access_proof (
 id UUID PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),
 terms_fingerprint TEXT NOT NULL CHECK(terms_fingerprint ~ '^[a-f0-9]{64}$'),
 code_hash TEXT NOT NULL CHECK(code_hash ~ '^[a-f0-9]{64}$'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL CHECK(expires_at>created_at)
);
CREATE OR REPLACE FUNCTION payroll_guard_w2_access_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'W-2 access proofs are append-only.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee_session WHERE id=NEW.session_id AND facility_id=NEW.facility_id AND employee_id=NEW.employee_id) THEN RAISE EXCEPTION 'W-2 access proof must match employee session ownership.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w2_access_proof ON payroll_w2_access_proof;
CREATE TRIGGER payroll_guard_w2_access_proof BEFORE INSERT OR UPDATE OR DELETE ON payroll_w2_access_proof FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_access_proof();

CREATE TABLE IF NOT EXISTS payroll_w2_consent (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),
 payment_year INTEGER NOT NULL CHECK(payment_year=2026),
 decision TEXT NOT NULL CHECK(decision IN ('CONSENT','WITHDRAW')),
 proof_id UUID UNIQUE REFERENCES payroll_w2_access_proof(id),
 terms_fingerprint TEXT,
 encrypted_receipt BYTEA,
 request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK((decision='CONSENT' AND proof_id IS NOT NULL AND terms_fingerprint ~ '^[a-f0-9]{64}$' AND encrypted_receipt IS NOT NULL) OR (decision='WITHDRAW' AND proof_id IS NULL AND terms_fingerprint IS NULL AND encrypted_receipt IS NULL))
);
CREATE INDEX IF NOT EXISTS payroll_w2_consent_history ON payroll_w2_consent(facility_id,employee_id,payment_year,id DESC);
CREATE OR REPLACE FUNCTION payroll_guard_w2_consent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'W-2 consent records are append-only.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee_session WHERE id=NEW.session_id AND employee_id=NEW.employee_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'W-2 consent must match employee session ownership.' USING ERRCODE='23514'; END IF;
 IF NEW.decision='CONSENT' AND NOT EXISTS(SELECT 1 FROM payroll_w2_access_proof WHERE id=NEW.proof_id AND session_id=NEW.session_id AND employee_id=NEW.employee_id AND facility_id=NEW.facility_id AND terms_fingerprint=NEW.terms_fingerprint AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'W-2 consent must match an unexpired access proof.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w2_consent ON payroll_w2_consent;
CREATE TRIGGER payroll_guard_w2_consent BEFORE INSERT OR UPDATE OR DELETE ON payroll_w2_consent FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_consent();

CREATE TABLE IF NOT EXISTS payroll_w2_proof_attempt (
 id BIGSERIAL PRIMARY KEY,
 proof_id UUID NOT NULL REFERENCES payroll_w2_access_proof(id),
 matched BOOLEAN NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_guard_w2_proof_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'W-2 proof attempts are append-only.' USING ERRCODE='23514';
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w2_proof_attempt ON payroll_w2_proof_attempt;
CREATE TRIGGER payroll_guard_w2_proof_attempt BEFORE UPDATE OR DELETE ON payroll_w2_proof_attempt FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_proof_attempt();

CREATE TABLE IF NOT EXISTS payroll_w2_publication (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 packet_id BIGINT NOT NULL UNIQUE REFERENCES payroll_w2_packet(id),
 consent_id BIGINT NOT NULL REFERENCES payroll_w2_consent(id),
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 published_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_guard_w2_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'W-2 publications are append-only.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_w2_packet p JOIN payroll_w2_consent c ON c.facility_id=p.facility_id AND c.employee_id=p.employee_id AND c.payment_year=p.payment_year WHERE p.id=NEW.packet_id AND c.id=NEW.consent_id AND p.facility_id=NEW.facility_id AND p.employee_id=NEW.employee_id AND c.decision='CONSENT' AND c.id=(SELECT max(id) FROM payroll_w2_consent WHERE facility_id=c.facility_id AND employee_id=c.employee_id AND payment_year=c.payment_year)) THEN RAISE EXCEPTION 'W-2 publication must match employee packet and current consent.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w2_publication ON payroll_w2_publication;
CREATE TRIGGER payroll_guard_w2_publication BEFORE INSERT OR UPDATE OR DELETE ON payroll_w2_publication FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_publication();

CREATE TABLE IF NOT EXISTS payroll_w2_notice_job (
 id BIGSERIAL PRIMARY KEY,
 publication_id BIGINT NOT NULL REFERENCES payroll_w2_publication(id),
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 initial_status TEXT NOT NULL CHECK(initial_status IN ('QUEUED','NEEDS_CONTACT')),
 encrypted_notice BYTEA NOT NULL,
 content_sha256 TEXT NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_guard_w2_notice_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'W-2 notice jobs are append-only.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_w2_publication WHERE id=NEW.publication_id AND employee_id=NEW.employee_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'W-2 notice job must match publication ownership.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w2_notice_job ON payroll_w2_notice_job;
CREATE TRIGGER payroll_guard_w2_notice_job BEFORE INSERT OR UPDATE OR DELETE ON payroll_w2_notice_job FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_notice_job();

CREATE INDEX IF NOT EXISTS payroll_w2_notice_job_history ON payroll_w2_notice_job(publication_id,id DESC);

CREATE TABLE IF NOT EXISTS payroll_w2_notice_attempt (
 id BIGSERIAL PRIMARY KEY,
 job_id BIGINT NOT NULL REFERENCES payroll_w2_notice_job(id),
 dispatch_key UUID NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_w2_notice_result (
 id BIGSERIAL PRIMARY KEY,
 attempt_id BIGINT NOT NULL UNIQUE REFERENCES payroll_w2_notice_attempt(id),
 outcome TEXT NOT NULL CHECK(outcome IN ('SMTP_ACCEPTED','NOT_SENT','UNCERTAIN')),
 provider_message_id TEXT,
 reason TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_guard_w2_notice_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'W-2 notice delivery evidence is append-only.' USING ERRCODE='23514';
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w2_notice_attempt ON payroll_w2_notice_attempt;
CREATE TRIGGER payroll_guard_w2_notice_attempt BEFORE UPDATE OR DELETE ON payroll_w2_notice_attempt FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_notice_evidence();
DROP TRIGGER IF EXISTS payroll_guard_w2_notice_result ON payroll_w2_notice_result;
CREATE TRIGGER payroll_guard_w2_notice_result BEFORE UPDATE OR DELETE ON payroll_w2_notice_result FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_notice_evidence();

ALTER TABLE payroll_w2_notice_result ADD COLUMN IF NOT EXISTS retry_not_before TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS payroll_w2_notice_reconciliation (
 id BIGSERIAL PRIMARY KEY,
 attempt_id BIGINT NOT NULL UNIQUE REFERENCES payroll_w2_notice_attempt(id),
 source_delivery_id BIGINT NOT NULL,
 accepted_at TIMESTAMPTZ NOT NULL,
 source_snapshot JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_w2_notice_reconciliation ON payroll_w2_notice_reconciliation;
CREATE TRIGGER payroll_guard_w2_notice_reconciliation BEFORE UPDATE OR DELETE ON payroll_w2_notice_reconciliation FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_notice_evidence();


CREATE TABLE IF NOT EXISTS payroll_w2_notice_return (
 id BIGSERIAL PRIMARY KEY,
 attempt_id BIGINT NOT NULL UNIQUE REFERENCES payroll_w2_notice_attempt(id),
 source_delivery_id BIGINT NOT NULL,
 returned_at TIMESTAMPTZ NOT NULL,
 source_snapshot JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_w2_notice_return ON payroll_w2_notice_return;
CREATE TRIGGER payroll_guard_w2_notice_return BEFORE UPDATE OR DELETE ON payroll_w2_notice_return FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_notice_evidence();
CREATE OR REPLACE VIEW payroll_w2_notice_effective_result AS
 SELECT COALESCE(r.id,c.id,b.id) AS id,a.id AS attempt_id,
 CASE WHEN b.id IS NOT NULL THEN 'NOTICE_RETURNED' WHEN c.id IS NOT NULL THEN 'SMTP_ACCEPTED' ELSE r.outcome END AS outcome,
 COALESCE(b.created_at,c.created_at,r.created_at) AS created_at,r.retry_not_before,
 CASE WHEN b.id IS NOT NULL THEN 'retained_mail_return' WHEN c.id IS NOT NULL THEN 'retained_mail_acceptance' ELSE r.reason END AS reason,
 r.outcome AS original_outcome,c.id AS reconciliation_id,b.returned_at
 FROM payroll_w2_notice_attempt a LEFT JOIN payroll_w2_notice_result r ON r.attempt_id=a.id
 LEFT JOIN payroll_w2_notice_reconciliation c ON c.attempt_id=a.id
 LEFT JOIN payroll_w2_notice_return b ON b.attempt_id=a.id;

ALTER TABLE payroll_w2_notice_return ADD COLUMN IF NOT EXISTS followup_timezone TEXT;
ALTER TABLE payroll_w2_notice_return ADD COLUMN IF NOT EXISTS followup_due_on DATE;

ALTER TABLE payroll_w2_notice_return ALTER COLUMN source_delivery_id DROP NOT NULL;
ALTER TABLE payroll_w2_notice_return ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'MAIL_LOG';
ALTER TABLE payroll_w2_notice_return ADD COLUMN IF NOT EXISTS created_by BIGINT;
ALTER TABLE payroll_w2_notice_return ADD COLUMN IF NOT EXISTS reference TEXT;
CREATE OR REPLACE FUNCTION payroll_validate_notice_return_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.source_kind='MAIL_LOG' AND NEW.source_delivery_id IS NOT NULL THEN RETURN NEW; END IF;
 IF NEW.source_kind='ADMIN' AND NEW.source_delivery_id IS NULL AND NEW.created_by IS NOT NULL AND length(trim(NEW.reference)) BETWEEN 12 AND 2000 AND NEW.followup_timezone IS NOT NULL AND NEW.followup_due_on IS NOT NULL THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Notice returns require retained mail evidence or identified admin evidence.' USING ERRCODE='23514';
END $$;
DROP TRIGGER IF EXISTS payroll_validate_notice_return_source ON payroll_w2_notice_return;
CREATE TRIGGER payroll_validate_notice_return_source BEFORE INSERT ON payroll_w2_notice_return FOR EACH ROW EXECUTE FUNCTION payroll_validate_notice_return_source();

-- A payment instruction is retained before any provider request. Provider IDs
-- are references only; bank account numbers and credentials are never stored here.
CREATE TABLE IF NOT EXISTS payroll_payment_instruction (
 id UUID PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 payroll_run_id BIGINT NOT NULL REFERENCES payroll_run(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 provider TEXT NOT NULL CHECK(provider='MODERN_TREASURY'),
 mode TEXT NOT NULL CHECK(mode IN ('TEST','LIVE')),
 originating_account_id UUID NOT NULL,
 receiving_account_id UUID NOT NULL,
 amount_cents BIGINT NOT NULL CHECK(amount_cents BETWEEN 1 AND 9007199254740991),
 payment_date DATE NOT NULL,
 calculation_snapshot JSONB NOT NULL,
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,payroll_run_id,employee_id,mode)
);
CREATE OR REPLACE FUNCTION payroll_guard_payment_instruction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'Payroll payment instructions are append-only.' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM payroll_run r JOIN payroll_run_employee re ON re.payroll_run_id=r.id
  LEFT JOIN payroll_pay_period p ON p.id=r.pay_period_id
  JOIN payroll_employee e ON e.id=re.employee_id
  WHERE r.id=NEW.payroll_run_id AND r.facility_id=NEW.facility_id
   AND e.id=NEW.employee_id AND e.facility_id=NEW.facility_id
   AND r.status='APPROVED' AND re.net_pay_cents=NEW.amount_cents
   AND COALESCE(r.payment_date,p.pay_date)=NEW.payment_date
   AND r.calculation_snapshot=NEW.calculation_snapshot
 ) THEN
  RAISE EXCEPTION 'Payment instruction must match an approved payroll employee and calculation.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_payment_instruction ON payroll_payment_instruction;
CREATE TRIGGER payroll_guard_payment_instruction BEFORE INSERT OR UPDATE OR DELETE ON payroll_payment_instruction FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_instruction();

CREATE TABLE IF NOT EXISTS payroll_payment_connection (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 encrypted_configuration BYTEA NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('TEST','LIVE')),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_payment_connection_facility ON payroll_payment_connection(facility_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_guard_payment_connection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Payroll payment connections are append-only.' USING ERRCODE='23514';
END $$;
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_payment_connection;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_payment_connection FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_payment_connection_check (
 id BIGSERIAL PRIMARY KEY,
 connection_id BIGINT NOT NULL REFERENCES payroll_payment_connection(id),
 status TEXT NOT NULL CHECK(status IN ('VERIFIED','FAILED','UNAVAILABLE')),
 reason TEXT NOT NULL CHECK(reason IN ('CREDENTIALS_OR_ACCESS','ACCOUNT_NOT_FOUND','PROVIDER_UNAVAILABLE','ACCOUNT_OR_ENVIRONMENT_MISMATCH','FUNDING_ACCOUNT_MATCHED')),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_payment_connection_check_latest ON payroll_payment_connection_check(connection_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection_check ON payroll_payment_connection_check;
CREATE TRIGGER payroll_guard_payment_connection_check BEFORE UPDATE OR DELETE ON payroll_payment_connection_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_payment_destination (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 connection_id BIGINT NOT NULL REFERENCES payroll_payment_connection(id),
 encrypted_destination BYTEA NOT NULL,
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_payment_destination_latest ON payroll_payment_destination(facility_id,employee_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_validate_payment_destination() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_employee e JOIN payroll_payment_connection c ON c.facility_id=e.facility_id WHERE e.id=NEW.employee_id AND e.facility_id=NEW.facility_id AND c.id=NEW.connection_id) THEN
  RAISE EXCEPTION 'Payment destination ownership mismatch.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_payment_destination ON payroll_payment_destination;
CREATE TRIGGER payroll_validate_payment_destination BEFORE INSERT ON payroll_payment_destination FOR EACH ROW EXECUTE FUNCTION payroll_validate_payment_destination();
DROP TRIGGER IF EXISTS payroll_guard_payment_destination ON payroll_payment_destination;
CREATE TRIGGER payroll_guard_payment_destination BEFORE UPDATE OR DELETE ON payroll_payment_destination FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_payment_authorization (
 id BIGSERIAL PRIMARY KEY,
 destination_id BIGINT NOT NULL REFERENCES payroll_payment_destination(id),
 decision TEXT NOT NULL CHECK(decision IN ('AUTHORIZE','WITHDRAW')),
 session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),
 encrypted_receipt BYTEA,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK(decision='WITHDRAW' OR encrypted_receipt IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS payroll_payment_authorization_latest ON payroll_payment_authorization(destination_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_authorization ON payroll_payment_authorization;
CREATE TRIGGER payroll_guard_payment_authorization BEFORE UPDATE OR DELETE ON payroll_payment_authorization FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_payment_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_destination d JOIN payroll_employee_session s ON s.facility_id=d.facility_id AND s.employee_id=d.employee_id WHERE d.id=NEW.destination_id AND s.id=NEW.session_id) THEN
  RAISE EXCEPTION 'Payment authorization session ownership mismatch.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_payment_authorization ON payroll_payment_authorization;
CREATE TRIGGER payroll_validate_payment_authorization BEFORE INSERT ON payroll_payment_authorization FOR EACH ROW EXECUTE FUNCTION payroll_validate_payment_authorization();

CREATE TABLE IF NOT EXISTS payroll_payment_batch (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 payroll_run_id BIGINT NOT NULL UNIQUE REFERENCES payroll_run(id),
 fingerprint TEXT NOT NULL,
 plan JSONB NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_payment_batch_instruction (
 batch_id BIGINT NOT NULL REFERENCES payroll_payment_batch(id),
 instruction_id UUID NOT NULL UNIQUE REFERENCES payroll_payment_instruction(id),
 PRIMARY KEY(batch_id,instruction_id)
);
CREATE TABLE IF NOT EXISTS payroll_payment_batch_cancellation (
 batch_id BIGINT PRIMARY KEY REFERENCES payroll_payment_batch(id),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_payment_dispatch_attempt (
 id BIGSERIAL PRIMARY KEY,
 batch_id BIGINT NOT NULL,
 instruction_id UUID NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(batch_id,instruction_id) REFERENCES payroll_payment_batch_instruction(batch_id,instruction_id)
);
CREATE OR REPLACE FUNCTION payroll_validate_payment_batch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_run r WHERE r.id=NEW.payroll_run_id AND r.facility_id=NEW.facility_id AND r.status='APPROVED') THEN
  RAISE EXCEPTION 'Payment batch requires an approved payroll run in this facility.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_payment_batch ON payroll_payment_batch;
CREATE TRIGGER payroll_validate_payment_batch BEFORE INSERT ON payroll_payment_batch FOR EACH ROW EXECUTE FUNCTION payroll_validate_payment_batch();
CREATE OR REPLACE FUNCTION payroll_validate_payment_batch_instruction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_batch b JOIN payroll_payment_instruction i ON i.payroll_run_id=b.payroll_run_id AND i.facility_id=b.facility_id WHERE b.id=NEW.batch_id AND i.id=NEW.instruction_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(b.plan->'payments') p WHERE (p->>'employeeId')::bigint=i.employee_id AND p->>'method'='DIRECT_DEPOSIT' AND (p->>'amountCents')::bigint=i.amount_cents)) THEN
  RAISE EXCEPTION 'Payment instruction does not belong to this reviewed batch.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_payment_batch_instruction ON payroll_payment_batch_instruction;
CREATE TRIGGER payroll_validate_payment_batch_instruction BEFORE INSERT ON payroll_payment_batch_instruction FOR EACH ROW EXECUTE FUNCTION payroll_validate_payment_batch_instruction();
CREATE OR REPLACE FUNCTION payroll_guard_authorized_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IN ('FINALIZED','VOID') AND EXISTS(SELECT 1 FROM payroll_payment_batch b LEFT JOIN payroll_payment_batch_cancellation c ON c.batch_id=b.id WHERE b.payroll_run_id=OLD.id AND c.batch_id IS NULL) THEN
  RAISE EXCEPTION 'Cancel the unsubmitted payment authorization before manual finalization or voiding.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_authorized_run ON payroll_run;
CREATE TRIGGER payroll_guard_authorized_run BEFORE UPDATE ON payroll_run FOR EACH ROW EXECUTE FUNCTION payroll_guard_authorized_run();
CREATE OR REPLACE FUNCTION payroll_guard_payment_batch_cancel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll-payment-connection:'||b.facility_id,0)) FROM payroll_payment_batch b WHERE b.id=NEW.batch_id;
 PERFORM r.id FROM payroll_run r JOIN payroll_payment_batch b ON b.payroll_run_id=r.id WHERE b.id=NEW.batch_id FOR UPDATE OF r;
 IF EXISTS(SELECT 1 FROM payroll_payment_closeout WHERE batch_id=NEW.batch_id) OR NOT payroll_payment_batch_cancellable(NEW.batch_id) THEN
  RAISE EXCEPTION 'A submitted payment requires provider reconciliation, not cancellation.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_payment_batch_cancel ON payroll_payment_batch_cancellation;
CREATE TRIGGER payroll_guard_payment_batch_cancel BEFORE INSERT ON payroll_payment_batch_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_batch_cancel();
CREATE OR REPLACE FUNCTION payroll_guard_payment_dispatch_start() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM r.id FROM payroll_run r JOIN payroll_payment_batch b ON b.payroll_run_id=r.id WHERE b.id=NEW.batch_id FOR UPDATE OF r;
 IF EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=NEW.batch_id) THEN
  RAISE EXCEPTION 'Cancelled payment authorization cannot be dispatched.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_payment_dispatch_start ON payroll_payment_dispatch_attempt;
CREATE TRIGGER payroll_guard_payment_dispatch_start BEFORE INSERT ON payroll_payment_dispatch_attempt FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_dispatch_start();
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['payroll_payment_batch','payroll_payment_batch_instruction','payroll_payment_batch_cancellation','payroll_payment_dispatch_attempt'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_evidence ON %I',table_name);
  EXECUTE format('CREATE TRIGGER payroll_guard_payment_evidence BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',table_name);
 END LOOP;
END $$;

-- Provider observations are appended independently of durable dispatch claims.
CREATE TABLE IF NOT EXISTS payroll_payment_observation (
 id BIGSERIAL PRIMARY KEY,
 attempt_id BIGINT NOT NULL REFERENCES payroll_payment_dispatch_attempt(id),
 source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),
 result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_observation ON payroll_payment_observation;
CREATE TRIGGER payroll_guard_payment_observation BEFORE UPDATE OR DELETE ON payroll_payment_observation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE OR REPLACE FUNCTION payroll_payment_batch_cancellable(target_batch BIGINT) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT NOT EXISTS (
  SELECT 1 FROM payroll_payment_dispatch_attempt a WHERE a.batch_id=target_batch AND (
   NOT EXISTS(SELECT 1 FROM payroll_payment_observation o WHERE o.attempt_id=a.id AND o.source='SUBMISSION' AND o.result->>'status' IN ('BLOCKED_ACCOUNT_LOOKUP','BLOCKED_ACCOUNT_VERIFICATION'))
   OR EXISTS(SELECT 1 FROM payroll_payment_observation o WHERE o.attempt_id=a.id AND (
    o.result->>'providerId' IS NOT NULL OR (o.source='SUBMISSION' AND COALESCE(o.result->>'status','') NOT IN ('BLOCKED_ACCOUNT_LOOKUP','BLOCKED_ACCOUNT_VERIFICATION'))
   ))
  )
 )
$$;

CREATE TABLE IF NOT EXISTS payroll_payment_closeout (
 batch_id BIGINT PRIMARY KEY REFERENCES payroll_payment_batch(id),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 500),
 check_payments JSONB NOT NULL CHECK(jsonb_typeof(check_payments)='array'),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE payroll_payment_closeout ADD COLUMN IF NOT EXISTS bank_observations JSONB NOT NULL DEFAULT '[]';
CREATE OR REPLACE FUNCTION payroll_payment_closeout_ready(target_batch BIGINT,checks JSONB) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_payment_batch b
  WHERE b.id=target_batch AND NOT EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=b.id)
  AND jsonb_typeof(checks)='array'
  AND jsonb_array_length(b.plan->'payments')>0
  AND jsonb_array_length(checks)=(SELECT count(*) FROM jsonb_array_elements(b.plan->'payments') p WHERE p->>'method'='CHECK')
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b.plan->'payments') p WHERE NOT (
   (p->>'method'='ZERO_NET' AND (p->>'amountCents')::bigint=0)
   OR (p->>'method'='CHECK' AND (SELECT count(*) FROM jsonb_array_elements(checks) c WHERE c->>'employeeId'=p->>'employeeId' AND c->>'amountCents'=p->>'amountCents' AND c->>'paymentDate'=b.plan->>'paymentDate' AND length(trim(c->>'reference')) BETWEEN 4 AND 200)=1)
   OR (p->>'method'='DIRECT_DEPOSIT' AND EXISTS(
    SELECT 1 FROM payroll_payment_batch_instruction l JOIN payroll_payment_instruction i ON i.id=l.instruction_id
    JOIN payroll_payment_dispatch_attempt a ON a.instruction_id=i.id AND a.batch_id=l.batch_id
    JOIN LATERAL(SELECT * FROM payroll_payment_observation WHERE attempt_id=a.id ORDER BY id DESC LIMIT 1)o ON true
    WHERE l.batch_id=b.id AND i.employee_id=(p->>'employeeId')::bigint AND i.amount_cents=(p->>'amountCents')::bigint AND i.mode='LIVE'
    AND o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED'
    AND o.result->>'dateMatches'='true' AND o.result->>'reconciliationStatus'='reconciled' AND o.result->>'liveMode'='true'
    AND o.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()
   ))
  ))
 )
$$;
CREATE OR REPLACE FUNCTION payroll_validate_payment_closeout() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll-payment-connection:'||b.facility_id,0)) FROM payroll_payment_batch b WHERE b.id=NEW.batch_id;
 PERFORM r.id FROM payroll_run r JOIN payroll_payment_batch b ON b.payroll_run_id=r.id WHERE b.id=NEW.batch_id AND r.status='APPROVED' FOR UPDATE OF r;
 IF NOT FOUND OR NOT payroll_payment_closeout_ready(NEW.batch_id,NEW.check_payments) THEN
  RAISE EXCEPTION 'Payment closeout requires current posted bank evidence and complete check records.' USING ERRCODE='23514';
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('instructionId',a.instruction_id,'observationId',o.id) ORDER BY a.instruction_id),'[]'::jsonb) INTO NEW.bank_observations
 FROM payroll_payment_dispatch_attempt a JOIN LATERAL(SELECT id FROM payroll_payment_observation WHERE attempt_id=a.id ORDER BY id DESC LIMIT 1)o ON true WHERE a.batch_id=NEW.batch_id;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_payment_closeout ON payroll_payment_closeout;
CREATE TRIGGER payroll_validate_payment_closeout BEFORE INSERT ON payroll_payment_closeout FOR EACH ROW EXECUTE FUNCTION payroll_validate_payment_closeout();
DROP TRIGGER IF EXISTS payroll_guard_payment_closeout ON payroll_payment_closeout;
CREATE TRIGGER payroll_guard_payment_closeout BEFORE UPDATE OR DELETE ON payroll_payment_closeout FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_authorized_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IN ('FINALIZED','VOID') AND EXISTS(
  SELECT 1 FROM payroll_payment_batch b LEFT JOIN payroll_payment_batch_cancellation c ON c.batch_id=b.id
  WHERE b.payroll_run_id=OLD.id AND c.batch_id IS NULL
  AND NOT (NEW.status='FINALIZED' AND EXISTS(SELECT 1 FROM payroll_payment_closeout x WHERE x.batch_id=b.id AND (OLD.status='FINALIZED' OR payroll_payment_closeout_ready(b.id,x.check_payments))))
 ) THEN
  RAISE EXCEPTION 'Cancel the unsubmitted payment authorization before manual finalization or voiding.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS payroll_payment_recovery_check (
 id BIGSERIAL PRIMARY KEY,
 attempt_id BIGINT NOT NULL REFERENCES payroll_payment_dispatch_attempt(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_payment_recovery_check_attempt ON payroll_payment_recovery_check(attempt_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_recovery_check ON payroll_payment_recovery_check;
CREATE TRIGGER payroll_guard_payment_recovery_check BEFORE UPDATE OR DELETE ON payroll_payment_recovery_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_automatic_closeout (
 batch_id BIGINT PRIMARY KEY REFERENCES payroll_payment_batch(id),
 body JSONB NOT NULL,
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_automatic_closeout_cancellation (
 batch_id BIGINT PRIMARY KEY REFERENCES payroll_automatic_closeout(batch_id),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_automatic_closeout_check (
 id BIGSERIAL PRIMARY KEY,
 batch_id BIGINT NOT NULL REFERENCES payroll_automatic_closeout(batch_id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_automatic_closeout_check_batch ON payroll_automatic_closeout_check(batch_id,id DESC);
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['payroll_automatic_closeout','payroll_automatic_closeout_cancellation','payroll_automatic_closeout_check'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_automatic_closeout ON %I',table_name);
  EXECUTE format('CREATE TRIGGER payroll_guard_automatic_closeout BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',table_name);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION payroll_guard_automatic_closeout_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll-payment-connection:'||b.facility_id,0)) FROM payroll_payment_batch b WHERE b.id=NEW.batch_id;
 PERFORM r.id FROM payroll_run r JOIN payroll_payment_batch b ON b.payroll_run_id=r.id WHERE b.id=NEW.batch_id AND r.status='APPROVED' FOR UPDATE OF r;
 IF NOT FOUND THEN RAISE EXCEPTION 'Automatic closeout changes require approved payroll.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_automatic_closeout_request ON payroll_automatic_closeout;
CREATE TRIGGER payroll_guard_automatic_closeout_request BEFORE INSERT ON payroll_automatic_closeout FOR EACH ROW EXECUTE FUNCTION payroll_guard_automatic_closeout_request();
DROP TRIGGER IF EXISTS payroll_guard_automatic_closeout_cancel ON payroll_automatic_closeout_cancellation;
CREATE TRIGGER payroll_guard_automatic_closeout_cancel BEFORE INSERT ON payroll_automatic_closeout_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_automatic_closeout_request();

CREATE TABLE IF NOT EXISTS payroll_payment_submission_schedule (
 id BIGSERIAL PRIMARY KEY,
 batch_id BIGINT NOT NULL,
 instruction_id UUID NOT NULL UNIQUE,
 submit_at TIMESTAMPTZ NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 500),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(batch_id,instruction_id) REFERENCES payroll_payment_batch_instruction(batch_id,instruction_id)
);
CREATE TABLE IF NOT EXISTS payroll_payment_submission_cancellation (
 schedule_id BIGINT PRIMARY KEY REFERENCES payroll_payment_submission_schedule(id),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_payment_submission_check (
 id BIGSERIAL PRIMARY KEY,
 schedule_id BIGINT NOT NULL REFERENCES payroll_payment_submission_schedule(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_payment_submission_check_schedule ON payroll_payment_submission_check(schedule_id,id DESC);
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['payroll_payment_submission_schedule','payroll_payment_submission_cancellation','payroll_payment_submission_check'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_submission_schedule ON %I',table_name);
  EXECUTE format('CREATE TRIGGER payroll_guard_submission_schedule BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',table_name);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_submission_cancellation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE instruction UUID;
BEGIN
 SELECT q.instruction_id INTO instruction FROM payroll_payment_submission_schedule q WHERE q.id=NEW.schedule_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll-payment-connection:'||b.facility_id,0)) FROM payroll_payment_batch b JOIN payroll_payment_submission_schedule q ON q.batch_id=b.id WHERE q.id=NEW.schedule_id;
 IF EXISTS(SELECT 1 FROM payroll_payment_dispatch_attempt WHERE instruction_id=instruction) THEN RAISE EXCEPTION 'Dispatch already started. Recover provider status.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_submission_cancellation ON payroll_payment_submission_cancellation;
CREATE TRIGGER payroll_guard_submission_cancellation BEFORE INSERT ON payroll_payment_submission_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_submission_cancellation();

CREATE TABLE IF NOT EXISTS payroll_bank_enrollment (
 id UUID PRIMARY KEY,
 revision BIGSERIAL UNIQUE NOT NULL,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 connection_id BIGINT NOT NULL REFERENCES payroll_payment_connection(id),
 session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),
 encrypted_request BYTEA NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_bank_enrollment_employee ON payroll_bank_enrollment(facility_id,employee_id,revision DESC);
DROP TRIGGER IF EXISTS payroll_guard_bank_enrollment ON payroll_bank_enrollment;
CREATE TRIGGER payroll_guard_bank_enrollment BEFORE UPDATE OR DELETE ON payroll_bank_enrollment FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_bank_enrollment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_employee e JOIN payroll_payment_connection c ON c.facility_id=e.facility_id JOIN payroll_employee_session s ON s.facility_id=e.facility_id AND s.employee_id=e.id WHERE e.id=NEW.employee_id AND e.facility_id=NEW.facility_id AND c.id=NEW.connection_id AND s.id=NEW.session_id) THEN
  RAISE EXCEPTION 'Bank enrollment ownership mismatch.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_bank_enrollment ON payroll_bank_enrollment;
CREATE TRIGGER payroll_validate_bank_enrollment BEFORE INSERT ON payroll_bank_enrollment FOR EACH ROW EXECUTE FUNCTION payroll_validate_bank_enrollment();
CREATE TABLE IF NOT EXISTS payroll_bank_enrollment_operation (
 id UUID PRIMARY KEY,
 enrollment_id UUID NOT NULL REFERENCES payroll_bank_enrollment(id),
 stage TEXT NOT NULL CHECK(stage IN ('COUNTERPARTY','ACCOUNT','START','COMPLETE')),
 attempt INTEGER NOT NULL CHECK(attempt BETWEEN 1 AND 5),
 encrypted_input BYTEA,
 session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(enrollment_id,stage,attempt),
 CHECK(stage='COMPLETE' OR attempt=1)
);
CREATE TABLE IF NOT EXISTS payroll_bank_enrollment_observation (
 id BIGSERIAL PRIMARY KEY,
 operation_id UUID NOT NULL REFERENCES payroll_bank_enrollment_operation(id),
 source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),
 result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_bank_enrollment_observation_operation ON payroll_bank_enrollment_observation(operation_id,id DESC);
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['payroll_bank_enrollment_operation','payroll_bank_enrollment_observation'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_bank_operation ON %I',table_name);
  EXECUTE format('CREATE TRIGGER payroll_guard_bank_operation BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',table_name);
 END LOOP;
END $$;
ALTER TABLE payroll_payment_destination ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE payroll_payment_destination ADD COLUMN IF NOT EXISTS created_by_session BIGINT REFERENCES payroll_employee_session(id);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='payroll_payment_destination_actor' AND conrelid='payroll_payment_destination'::regclass) THEN
  ALTER TABLE payroll_payment_destination ADD CONSTRAINT payroll_payment_destination_actor CHECK((created_by IS NOT NULL)::integer+(created_by_session IS NOT NULL)::integer=1);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS payroll_bank_enrollment_link (
 enrollment_id UUID PRIMARY KEY REFERENCES payroll_bank_enrollment(id),
 destination_id BIGINT UNIQUE NOT NULL REFERENCES payroll_payment_destination(id),
 observation_id BIGINT NOT NULL REFERENCES payroll_bank_enrollment_observation(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_bank_link ON payroll_bank_enrollment_link;
CREATE TRIGGER payroll_guard_bank_link BEFORE UPDATE OR DELETE ON payroll_bank_enrollment_link FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_bank_operation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_bank_enrollment e JOIN payroll_employee_session s ON s.facility_id=e.facility_id AND s.employee_id=e.employee_id WHERE e.id=NEW.enrollment_id AND s.id=NEW.session_id) THEN
  RAISE EXCEPTION 'Bank operation ownership mismatch.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_bank_operation ON payroll_bank_enrollment_operation;
CREATE TRIGGER payroll_validate_bank_operation BEFORE INSERT ON payroll_bank_enrollment_operation FOR EACH ROW EXECUTE FUNCTION payroll_validate_bank_operation();
CREATE OR REPLACE FUNCTION payroll_validate_bank_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_bank_enrollment e JOIN payroll_payment_destination d ON d.facility_id=e.facility_id AND d.employee_id=e.employee_id AND d.connection_id=e.connection_id JOIN payroll_bank_enrollment_operation o ON o.enrollment_id=e.id JOIN payroll_bank_enrollment_observation v ON v.operation_id=o.id JOIN payroll_employee_session s ON s.id=d.created_by_session AND s.facility_id=e.facility_id AND s.employee_id=e.employee_id WHERE e.id=NEW.enrollment_id AND d.id=NEW.destination_id AND v.id=NEW.observation_id AND v.result->>'status'='RECORDED' AND v.result->>'verificationStatus'='verified') THEN
  RAISE EXCEPTION 'Verified bank link ownership or evidence mismatch.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_bank_link ON payroll_bank_enrollment_link;
CREATE TRIGGER payroll_validate_bank_link BEFORE INSERT ON payroll_bank_enrollment_link FOR EACH ROW EXECUTE FUNCTION payroll_validate_bank_link();

CREATE TABLE IF NOT EXISTS payroll_payment_accounting_mapping (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 payment_connection_id BIGINT NOT NULL REFERENCES payroll_payment_connection(id),
 connection_generation BIGINT NOT NULL CHECK(connection_generation>=0),
 realm_id TEXT NOT NULL,
 environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),
 details JSONB NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 500),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_payment_accounting_mapping_facility ON payroll_payment_accounting_mapping(facility_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_accounting_mapping ON payroll_payment_accounting_mapping;
CREATE TRIGGER payroll_guard_accounting_mapping BEFORE UPDATE OR DELETE ON payroll_payment_accounting_mapping FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_accounting_mapping() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_connection c WHERE c.id=NEW.payment_connection_id AND c.facility_id=NEW.facility_id AND c.mode='LIVE') THEN
  RAISE EXCEPTION 'Settlement mapping payment connection mismatch.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_accounting_mapping ON payroll_payment_accounting_mapping;
CREATE TRIGGER payroll_validate_accounting_mapping BEFORE INSERT ON payroll_payment_accounting_mapping FOR EACH ROW EXECUTE FUNCTION payroll_validate_accounting_mapping();

CREATE TABLE IF NOT EXISTS payroll_settlement_journal (
 id UUID PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 payroll_run_id BIGINT NOT NULL REFERENCES payroll_run(id),
 mapping_id BIGINT NOT NULL REFERENCES payroll_payment_accounting_mapping(id),
 payroll_journal_id BIGINT NOT NULL REFERENCES payroll_quickbooks_sync(id),
 event_key TEXT NOT NULL,
 event JSONB NOT NULL,
 realm_id TEXT NOT NULL,
 environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),
 payload JSONB NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 500),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,event_key,realm_id,environment)
);
CREATE TABLE IF NOT EXISTS payroll_settlement_journal_claim (
 journal_id UUID PRIMARY KEY REFERENCES payroll_settlement_journal(id),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_settlement_journal_observation (
 id BIGSERIAL PRIMARY KEY,
 journal_id UUID NOT NULL REFERENCES payroll_settlement_journal(id),
 source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),
 result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_settlement_journal_observation_job ON payroll_settlement_journal_observation(journal_id,id DESC);
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['payroll_settlement_journal','payroll_settlement_journal_claim','payroll_settlement_journal_observation'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_settlement_journal ON %I',table_name);
  EXECUTE format('CREATE TRIGGER payroll_guard_settlement_journal BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',table_name);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_validate_settlement_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_run r JOIN payroll_payment_accounting_mapping m ON m.facility_id=r.facility_id JOIN payroll_quickbooks_sync q ON q.facility_id=r.facility_id AND q.payroll_run_id=r.id AND q.realm_id=m.realm_id AND q.environment=m.environment WHERE r.id=NEW.payroll_run_id AND r.facility_id=NEW.facility_id AND r.status='FINALIZED' AND m.id=NEW.mapping_id AND q.id=NEW.payroll_journal_id AND q.status='SYNCED' AND NEW.realm_id=m.realm_id AND NEW.environment=m.environment) THEN
  RAISE EXCEPTION 'Settlement journal source or ownership mismatch.' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_instruction i JOIN payroll_payment_dispatch_attempt a ON a.instruction_id=i.id JOIN payroll_payment_observation o ON o.attempt_id=a.id WHERE i.facility_id=NEW.facility_id AND i.payroll_run_id=NEW.payroll_run_id AND i.id::text=NEW.event->>'instructionId' AND i.originating_account_id::text=NEW.event->>'fundingAccountId' AND o.id::text=NEW.event->>'observationId' AND o.source='RECOVERY' AND NEW.event_key=NEW.event->>'key' AND ((NEW.event->>'kind'='WITHDRAWAL' AND o.result->>'settlementStatus'='BANK_POSTED') OR (NEW.event->>'kind'='RETURN' AND o.result->>'returnEvidenceStatus'='BANK_CREDIT_POSTED'))) AND NOT EXISTS(SELECT 1 FROM payroll_payment_replacement_authorization a JOIN payroll_payment_replacement_observation o ON o.authorization_id=a.id WHERE a.facility_id=NEW.facility_id AND a.payroll_run_id=NEW.payroll_run_id AND a.id::text=NEW.event->>'instructionId' AND a.instruction_id::text=NEW.event->>'originalInstructionId' AND NEW.event->>'sourceKind'='REPLACEMENT' AND a.intent->>'originatingAccountId'=NEW.event->>'fundingAccountId' AND o.id::text=NEW.event->>'observationId' AND o.source='RECOVERY' AND NEW.event_key=NEW.event->>'key' AND ((NEW.event->>'kind'='WITHDRAWAL' AND o.result->>'settlementStatus'='BANK_POSTED') OR (NEW.event->>'kind'='RETURN' AND o.result->>'returnEvidenceStatus'='BANK_CREDIT_POSTED'))) AND NOT EXISTS(SELECT 1 FROM payroll_check_issue i JOIN payroll_check_issue_observation o ON o.issue_id=i.id JOIN payroll_payment_accounting_mapping m ON m.id=NEW.mapping_id AND m.payment_connection_id=i.connection_id AND m.facility_id=i.facility_id WHERE i.facility_id=NEW.facility_id AND i.payroll_run_id=NEW.payroll_run_id AND i.id::text=NEW.event->>'instructionId' AND NEW.event->>'sourceKind'='CHECK' AND NEW.event->>'kind'='WITHDRAWAL' AND m.details->>'fundingAccountId'=NEW.event->>'fundingAccountId' AND o.id::text=NEW.event->>'observationId' AND o.source='RECOVERY' AND NEW.event_key=NEW.event->>'key' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED' AND o.result->>'dateMatches'='true' AND o.result->>'expiryMatches'='true' AND o.result->>'liveMode'='true' AND o.result->>'providerId'=(SELECT result->>'providerId' FROM payroll_check_issue_observation WHERE issue_id=i.id AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1)) AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization a JOIN payroll_check_issue i ON i.id=a.issue_id JOIN payroll_check_replacement_observation o ON o.authorization_id=a.id JOIN payroll_payment_accounting_mapping m ON m.id=NEW.mapping_id AND m.payment_connection_id=a.connection_id AND m.facility_id=i.facility_id WHERE i.facility_id=NEW.facility_id AND i.payroll_run_id=NEW.payroll_run_id AND a.id::text=NEW.event->>'instructionId' AND i.id::text=NEW.event->>'originalInstructionId' AND NEW.event->>'sourceKind'='CHECK_REPLACEMENT' AND NEW.event->>'paymentRail'=a.method AND m.details->>'fundingAccountId'=NEW.event->>'fundingAccountId' AND o.id::text=NEW.event->>'observationId' AND o.source='RECOVERY' AND NEW.event_key=NEW.event->>'key' AND o.result->>'dateMatches'='true' AND o.result->>'liveMode'='true' AND (a.method<>'CHECK' OR o.result->>'expiryMatches'='true') AND o.result->>'providerId'=(SELECT result->>'providerId' FROM payroll_check_replacement_observation WHERE authorization_id=a.id AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1) AND ((NEW.event->>'kind'='WITHDRAWAL' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED') OR (a.method='DIRECT_DEPOSIT' AND NEW.event->>'kind'='RETURN' AND o.result->>'status'='RETURNED' AND o.result->>'returnEvidenceStatus'='BANK_CREDIT_POSTED'))) THEN
  RAISE EXCEPTION 'Settlement bank evidence ownership mismatch.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_settlement_journal ON payroll_settlement_journal;
CREATE TRIGGER payroll_validate_settlement_journal BEFORE INSERT ON payroll_settlement_journal FOR EACH ROW EXECUTE FUNCTION payroll_validate_settlement_journal();

CREATE TABLE IF NOT EXISTS payroll_settlement_recovery_check (
 id BIGSERIAL PRIMARY KEY,
 journal_id UUID NOT NULL REFERENCES payroll_settlement_journal(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_settlement_recovery_check_job ON payroll_settlement_recovery_check(journal_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_settlement_recovery_check ON payroll_settlement_recovery_check;
CREATE TRIGGER payroll_guard_settlement_recovery_check BEFORE UPDATE OR DELETE ON payroll_settlement_recovery_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_bank_enrollment_restart (
 parent_id UUID PRIMARY KEY REFERENCES payroll_bank_enrollment(id),
 child_id UUID NOT NULL UNIQUE REFERENCES payroll_bank_enrollment(id),
 observation_id BIGINT NOT NULL REFERENCES payroll_bank_enrollment_observation(id),
 session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK(parent_id<>child_id)
);
DROP TRIGGER IF EXISTS payroll_guard_bank_restart ON payroll_bank_enrollment_restart;
CREATE TRIGGER payroll_guard_bank_restart BEFORE UPDATE OR DELETE ON payroll_bank_enrollment_restart FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_bank_restart() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_bank_enrollment p JOIN payroll_bank_enrollment c ON c.facility_id=p.facility_id AND c.employee_id=p.employee_id AND c.connection_id=p.connection_id AND c.revision>p.revision JOIN payroll_employee_session s ON s.id=c.session_id AND s.facility_id=c.facility_id AND s.employee_id=c.employee_id JOIN payroll_bank_enrollment_operation o ON o.enrollment_id=p.id AND o.stage='START' JOIN payroll_bank_enrollment_observation v ON v.operation_id=o.id WHERE p.id=NEW.parent_id AND c.id=NEW.child_id AND s.id=NEW.session_id AND v.id=NEW.observation_id AND v.source='RECOVERY' AND v.result->>'status'='RECORDED' AND v.result->>'verificationStatus'='unverified') THEN
  RAISE EXCEPTION 'Bank verification restart ownership or evidence mismatch.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_bank_restart ON payroll_bank_enrollment_restart;
CREATE TRIGGER payroll_validate_bank_restart BEFORE INSERT ON payroll_bank_enrollment_restart FOR EACH ROW EXECUTE FUNCTION payroll_validate_bank_restart();

CREATE TABLE IF NOT EXISTS payroll_bank_enrollment_recovery_check (
 id BIGSERIAL PRIMARY KEY,
 enrollment_id UUID NOT NULL REFERENCES payroll_bank_enrollment(id),
 operation_id UUID NOT NULL REFERENCES payroll_bank_enrollment_operation(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_bank_enrollment_recovery_check_enrollment ON payroll_bank_enrollment_recovery_check(enrollment_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_enrollment_recovery_check ON payroll_bank_enrollment_recovery_check;
CREATE TRIGGER payroll_guard_enrollment_recovery_check BEFORE UPDATE OR DELETE ON payroll_bank_enrollment_recovery_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_enrollment_recovery_check() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_bank_enrollment_operation WHERE id=NEW.operation_id AND enrollment_id=NEW.enrollment_id) THEN
  RAISE EXCEPTION 'Bank enrollment recovery ownership mismatch.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_enrollment_recovery_check ON payroll_bank_enrollment_recovery_check;
CREATE TRIGGER payroll_validate_enrollment_recovery_check BEFORE INSERT ON payroll_bank_enrollment_recovery_check FOR EACH ROW EXECUTE FUNCTION payroll_validate_enrollment_recovery_check();

CREATE TABLE IF NOT EXISTS payroll_payment_replacement_review (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 payroll_run_id BIGINT NOT NULL REFERENCES payroll_run(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 instruction_id UUID NOT NULL REFERENCES payroll_payment_instruction(id),
 return_observation_id BIGINT NOT NULL REFERENCES payroll_payment_observation(id),
 basis JSONB NOT NULL,
 basis_fingerprint TEXT NOT NULL CHECK(basis_fingerprint ~ '^[a-f0-9]{64}$'),
 review JSONB NOT NULL,
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_payment_replacement_review_instruction ON payroll_payment_replacement_review(instruction_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_replacement_review ON payroll_payment_replacement_review;
CREATE TRIGGER payroll_guard_payment_replacement_review BEFORE UPDATE OR DELETE ON payroll_payment_replacement_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_payment_replacement_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_instruction i JOIN payroll_run r ON r.id=i.payroll_run_id AND r.facility_id=i.facility_id JOIN payroll_payment_dispatch_attempt a ON a.instruction_id=i.id JOIN payroll_payment_observation o ON o.attempt_id=a.id WHERE i.id=NEW.instruction_id AND i.facility_id=NEW.facility_id AND i.payroll_run_id=NEW.payroll_run_id AND i.employee_id=NEW.employee_id AND r.status='FINALIZED' AND o.id=NEW.return_observation_id AND o.source='RECOVERY' AND o.result->>'status'='RETURNED' AND o.result->>'returnEvidenceStatus'='BANK_CREDIT_POSTED' AND (o.result->'returnEvidence'->>'amountCents')::bigint=i.amount_cents) THEN
  RAISE EXCEPTION 'Replacement review source or ownership mismatch.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_payment_replacement_review ON payroll_payment_replacement_review;
CREATE TRIGGER payroll_validate_payment_replacement_review BEFORE INSERT ON payroll_payment_replacement_review FOR EACH ROW EXECUTE FUNCTION payroll_validate_payment_replacement_review();

CREATE TABLE IF NOT EXISTS payroll_payment_replacement_authorization (
 id UUID PRIMARY KEY,
 predecessor_id UUID REFERENCES payroll_payment_replacement_authorization(id),
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 payroll_run_id BIGINT NOT NULL REFERENCES payroll_run(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 instruction_id UUID NOT NULL REFERENCES payroll_payment_instruction(id),
 review_id BIGINT NOT NULL REFERENCES payroll_payment_replacement_review(id),
 method TEXT NOT NULL CHECK(method IN ('CHECK','DIRECT_DEPOSIT')),
 amount_cents BIGINT NOT NULL CHECK(amount_cents>0),
 intent JSONB NOT NULL,
 account_summary JSONB,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 1000),
 return_resolution_reference TEXT NOT NULL CHECK(length(trim(return_resolution_reference)) BETWEEN 12 AND 1000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE payroll_payment_replacement_authorization ADD COLUMN IF NOT EXISTS predecessor_id UUID REFERENCES payroll_payment_replacement_authorization(id);
CREATE INDEX IF NOT EXISTS payroll_payment_replacement_authorization_source ON payroll_payment_replacement_authorization(instruction_id,created_at DESC);
CREATE TABLE IF NOT EXISTS payroll_payment_replacement_cancellation (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_payment_replacement_authorization(id),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 1000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_payment_replacement_attempt (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_payment_replacement_authorization(id),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['payroll_payment_replacement_authorization','payroll_payment_replacement_cancellation','payroll_payment_replacement_attempt'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_replacement ON %I',table_name);
  EXECUTE format('CREATE TRIGGER payroll_guard_payment_replacement BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',table_name);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_validate_replacement_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll-replacement:'||NEW.instruction_id::text,0));
 IF EXISTS(SELECT 1 FROM payroll_payment_replacement_authorization a WHERE a.instruction_id=NEW.instruction_id AND a.id IS DISTINCT FROM NEW.predecessor_id AND NOT EXISTS(SELECT 1 FROM payroll_payment_replacement_authorization child WHERE child.predecessor_id=a.id) AND NOT EXISTS(SELECT 1 FROM payroll_payment_replacement_cancellation WHERE authorization_id=a.id)) THEN
  RAISE EXCEPTION 'An active replacement authorization already exists.' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_replacement_review q JOIN payroll_payment_instruction i ON i.id=q.instruction_id JOIN payroll_run r ON r.id=i.payroll_run_id AND r.facility_id=i.facility_id WHERE q.id=NEW.review_id AND q.id=(SELECT max(id) FROM payroll_payment_replacement_review WHERE instruction_id=i.id) AND q.facility_id=NEW.facility_id AND q.payroll_run_id=NEW.payroll_run_id AND q.employee_id=NEW.employee_id AND q.instruction_id=NEW.instruction_id AND r.status='FINALIZED' AND i.amount_cents=NEW.amount_cents AND q.review->>'taxTreatment'='ORIGINAL_PAYROLL_RETAINED' AND q.review->>'method'=NEW.method AND COALESCE(NEW.predecessor_id::text,'')=COALESCE(q.basis->'predecessor'->>'id','') AND COALESCE(NEW.intent->>'predecessorId','')=COALESCE(NEW.predecessor_id::text,'') AND (q.review->>'amountCents')::bigint=NEW.amount_cents AND q.review->>'noOtherPaymentConfirmed'='true' AND NEW.intent->>'id'=NEW.id::text AND (NEW.intent->>'amountCents')::bigint=NEW.amount_cents AND NEW.intent->>'method'=NEW.method AND NEW.intent->>'paymentDate'=q.review->>'replacementDate' AND (NEW.intent->>'facilityId')::bigint=NEW.facility_id AND (NEW.intent->>'runId')::bigint=NEW.payroll_run_id AND (NEW.intent->>'employeeId')::bigint=NEW.employee_id AND (NEW.method='CHECK' OR (NEW.intent->>'mode'='LIVE' AND (NEW.intent->>'connectionId')::bigint=(q.basis->'readiness'->>'connectionId')::bigint AND (NEW.intent->>'destinationId')::bigint=(q.basis->'readiness'->>'destinationId')::bigint AND (NEW.intent->>'wageAuthorizationId')::bigint=(q.basis->'readiness'->>'authorizationId')::bigint))) THEN
  RAISE EXCEPTION 'Replacement authorization source or ownership mismatch.' USING ERRCODE='23514';
 END IF;
 IF NEW.predecessor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM payroll_payment_replacement_authorization p JOIN payroll_payment_replacement_review q ON q.id=NEW.review_id JOIN LATERAL(SELECT source,result FROM payroll_payment_replacement_observation WHERE authorization_id=p.id ORDER BY id DESC LIMIT 1)o ON true WHERE p.id=NEW.predecessor_id AND p.id<>NEW.id AND p.facility_id=NEW.facility_id AND p.instruction_id=NEW.instruction_id AND p.amount_cents=NEW.amount_cents AND q.basis->'predecessor'->>'id'=p.id::text AND NEW.intent->>'predecessorId'=p.id::text AND o.source='RECOVERY' AND o.result->>'status'='RETURNED' AND o.result->>'returnEvidenceStatus'='BANK_CREDIT_POSTED' AND o.result->>'dateMatches'='true' AND o.result->>'liveMode'='true' AND (o.result->'returnEvidence'->>'amountCents')::bigint=NEW.amount_cents) THEN RAISE EXCEPTION 'Replacement predecessor requires reconciled full returned funds.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_replacement_authorization ON payroll_payment_replacement_authorization;
CREATE TRIGGER payroll_validate_replacement_authorization BEFORE INSERT ON payroll_payment_replacement_authorization FOR EACH ROW EXECUTE FUNCTION payroll_validate_replacement_authorization();
CREATE OR REPLACE FUNCTION payroll_validate_replacement_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_id UUID;
BEGIN
 SELECT instruction_id INTO source_id FROM payroll_payment_replacement_authorization WHERE id=NEW.authorization_id;
 IF source_id IS NULL THEN RAISE EXCEPTION 'Replacement authorization not found.' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll-replacement:'||source_id::text,0));
 IF TG_TABLE_NAME='payroll_payment_replacement_cancellation' AND EXISTS(SELECT 1 FROM payroll_payment_replacement_attempt WHERE authorization_id=NEW.authorization_id) THEN
  RAISE EXCEPTION 'Replacement dispatch has already started.' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME='payroll_payment_replacement_attempt' AND EXISTS(SELECT 1 FROM payroll_payment_replacement_cancellation WHERE authorization_id=NEW.authorization_id) THEN
  RAISE EXCEPTION 'Replacement authorization is cancelled.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_replacement_transition ON payroll_payment_replacement_cancellation;
CREATE TRIGGER payroll_validate_replacement_transition BEFORE INSERT ON payroll_payment_replacement_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_validate_replacement_transition();
DROP TRIGGER IF EXISTS payroll_validate_replacement_transition ON payroll_payment_replacement_attempt;
CREATE TRIGGER payroll_validate_replacement_transition BEFORE INSERT ON payroll_payment_replacement_attempt FOR EACH ROW EXECUTE FUNCTION payroll_validate_replacement_transition();

CREATE TABLE IF NOT EXISTS payroll_payment_replacement_observation (
 id BIGSERIAL PRIMARY KEY,
 authorization_id UUID NOT NULL REFERENCES payroll_payment_replacement_attempt(authorization_id),
 source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),
 result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_payment_replacement_observation_latest ON payroll_payment_replacement_observation(authorization_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_payment_replacement_observation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_payment_replacement_observation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_payment_replacement_recovery_check (
 id BIGSERIAL PRIMARY KEY,
 authorization_id UUID NOT NULL REFERENCES payroll_payment_replacement_attempt(authorization_id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_payment_replacement_recovery_check_latest ON payroll_payment_replacement_recovery_check(authorization_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_payment_replacement_recovery_check;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_payment_replacement_recovery_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_payment_replacement_receipt (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_payment_replacement_authorization(id),
 observation_id BIGINT NOT NULL REFERENCES payroll_payment_replacement_observation(id),
 snapshot JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_payment_replacement_receipt;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_payment_replacement_receipt FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_replacement_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_replacement_observation o JOIN payroll_payment_replacement_authorization a ON a.id=o.authorization_id JOIN payroll_payment_instruction i ON i.id=a.instruction_id WHERE o.id=NEW.observation_id AND a.id=NEW.authorization_id AND o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED' AND o.result->>'dateMatches'='true' AND o.result->>'liveMode'='true' AND jsonb_typeof(o.result->'settlementEvidence')='array' AND jsonb_array_length(o.result->'settlementEvidence')>0 AND NEW.snapshot=jsonb_build_object('amountCents',a.amount_cents,'paymentDate',a.intent->>'paymentDate','originalPaymentDate',i.payment_date::text,'account',a.account_summary,'providerId',o.result->>'providerId','settlementEvidence',o.result->'settlementEvidence')) THEN
  RAISE EXCEPTION 'Replacement receipt requires matching bank recovery evidence.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_replacement_receipt ON payroll_payment_replacement_receipt;
CREATE TRIGGER payroll_validate_replacement_receipt BEFORE INSERT ON payroll_payment_replacement_receipt FOR EACH ROW EXECUTE FUNCTION payroll_validate_replacement_receipt();

CREATE TABLE IF NOT EXISTS payroll_payment_return_case (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 payroll_run_id BIGINT NOT NULL REFERENCES payroll_run(id),
 instruction_id UUID NOT NULL REFERENCES payroll_payment_instruction(id),
 status TEXT NOT NULL CHECK(status IN ('OPEN','CLOSED')),
 issues JSONB NOT NULL,
 evidence JSONB NOT NULL,
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_payment_return_case_latest ON payroll_payment_return_case(instruction_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_payment_return_case;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_payment_return_case FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_payment_return_case() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_instruction WHERE id=NEW.instruction_id AND facility_id=NEW.facility_id AND payroll_run_id=NEW.payroll_run_id) THEN RAISE EXCEPTION 'Returned-payment case ownership mismatch.' USING ERRCODE='23514'; END IF;
 IF NEW.status='CLOSED' AND (NEW.issues<>'[]'::jsonb OR NOT EXISTS(SELECT 1 FROM payroll_payment_replacement_receipt r JOIN payroll_payment_replacement_authorization a ON a.id=r.authorization_id WHERE a.instruction_id=NEW.instruction_id AND a.id::text=NEW.evidence->>'authorizationId' AND r.authorization_id::text=NEW.evidence->>'receiptId')) THEN RAISE EXCEPTION 'Closed case requires its replacement receipt and reconciled evidence.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_payment_return_case ON payroll_payment_return_case;
CREATE TRIGGER payroll_validate_payment_return_case BEFORE INSERT ON payroll_payment_return_case FOR EACH ROW EXECUTE FUNCTION payroll_validate_payment_return_case();
CREATE TABLE IF NOT EXISTS payroll_payment_return_case_check (
 id BIGSERIAL PRIMARY KEY,
 payroll_run_id BIGINT NOT NULL REFERENCES payroll_run(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_payment_return_case_check_latest ON payroll_payment_return_case_check(payroll_run_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_payment_return_case_check;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_payment_return_case_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_check_configuration (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 connection_id BIGINT NOT NULL REFERENCES payroll_payment_connection(id),
 enabled BOOLEAN NOT NULL,
 expiry_days INTEGER NOT NULL CHECK(expiry_days BETWEEN 1 AND 180),
 activation_reference TEXT NOT NULL CHECK(length(trim(activation_reference)) BETWEEN 12 AND 2000),
 created_by BIGINT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_check_configuration_latest ON payroll_check_configuration(facility_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_configuration;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_configuration FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_check_configuration_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_connection c WHERE c.id=NEW.connection_id AND c.facility_id=NEW.facility_id) THEN
  RAISE EXCEPTION 'Check configuration must belong to its employer funding connection';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_configuration_source ON payroll_check_configuration;
CREATE TRIGGER payroll_guard_check_configuration_source BEFORE INSERT ON payroll_check_configuration FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_configuration_source();

CREATE TABLE IF NOT EXISTS payroll_check_payee (
 id UUID PRIMARY KEY,
 revision BIGSERIAL UNIQUE NOT NULL,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 connection_id BIGINT NOT NULL REFERENCES payroll_payment_connection(id),
 encrypted_input BYTEA NOT NULL,
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_check_payee_employee ON payroll_check_payee(facility_id,employee_id,revision DESC);
CREATE TABLE IF NOT EXISTS payroll_check_payee_operation (
 id UUID PRIMARY KEY,
 payee_id UUID NOT NULL REFERENCES payroll_check_payee(id),
 stage TEXT NOT NULL CHECK(stage IN ('COUNTERPARTY','ACCOUNT')),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(payee_id,stage)
);
CREATE TABLE IF NOT EXISTS payroll_check_payee_observation (
 id BIGSERIAL PRIMARY KEY,
 operation_id UUID NOT NULL REFERENCES payroll_check_payee_operation(id),
 source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),
 result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_check_payee_observation_latest ON payroll_check_payee_observation(operation_id,id DESC);
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['payroll_check_payee','payroll_check_payee_operation','payroll_check_payee_observation'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',table_name);
  EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',table_name);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_check_payee_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_employee e JOIN payroll_payment_connection c ON c.facility_id=e.facility_id WHERE e.id=NEW.employee_id AND e.facility_id=NEW.facility_id AND c.id=NEW.connection_id) THEN
  RAISE EXCEPTION 'Check recipient employer ownership mismatch';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_payee_source ON payroll_check_payee;
CREATE TRIGGER payroll_guard_check_payee_source BEFORE INSERT ON payroll_check_payee FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_payee_source();

CREATE TABLE IF NOT EXISTS payroll_check_payee_recovery_check (
 id BIGSERIAL PRIMARY KEY,
 operation_id UUID NOT NULL REFERENCES payroll_check_payee_operation(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_check_payee_recovery_check_latest ON payroll_check_payee_recovery_check(operation_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_payee_recovery_check;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_payee_recovery_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();


CREATE TABLE IF NOT EXISTS payroll_check_issue (
 id UUID PRIMARY KEY,
 batch_id BIGINT NOT NULL REFERENCES payroll_payment_batch(id),
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 payroll_run_id BIGINT NOT NULL REFERENCES payroll_run(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 connection_id BIGINT NOT NULL REFERENCES payroll_payment_connection(id),
 configuration_id BIGINT NOT NULL REFERENCES payroll_check_configuration(id),
 payee_id UUID NOT NULL REFERENCES payroll_check_payee(id),
 amount_cents BIGINT NOT NULL CHECK(amount_cents>0),
 payment_date DATE NOT NULL,
 review_fingerprint TEXT NOT NULL CHECK(review_fingerprint ~ '^[a-f0-9]{64}$'),
 encrypted_intent BYTEA NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,payroll_run_id,employee_id)
);
CREATE TABLE IF NOT EXISTS payroll_check_issue_observation (
 id BIGSERIAL PRIMARY KEY,
 issue_id UUID NOT NULL REFERENCES payroll_check_issue(id),
 source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),
 result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_check_issue_observation_latest ON payroll_check_issue_observation(issue_id,id DESC);
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['payroll_check_issue','payroll_check_issue_observation'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',table_name);
  EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',table_name);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_check_issue_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll-payment-connection:'||NEW.facility_id,0));
 PERFORM id FROM payroll_run WHERE id=NEW.payroll_run_id AND facility_id=NEW.facility_id AND status='APPROVED' FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=NEW.batch_id)
 OR EXISTS(SELECT 1 FROM payroll_payment_closeout WHERE batch_id=NEW.batch_id)
 OR EXISTS(SELECT 1 FROM payroll_automatic_closeout WHERE batch_id=NEW.batch_id)
 OR NOT EXISTS(
  SELECT 1 FROM payroll_payment_batch b JOIN payroll_check_configuration c ON c.facility_id=b.facility_id
  JOIN payroll_payment_connection f ON f.id=c.connection_id AND f.facility_id=b.facility_id
  JOIN payroll_check_payee p ON p.facility_id=b.facility_id AND p.connection_id=f.id
  WHERE b.id=NEW.batch_id AND b.facility_id=NEW.facility_id AND b.payroll_run_id=NEW.payroll_run_id
  AND c.id=NEW.configuration_id AND c.enabled AND f.mode='LIVE' AND f.id=NEW.connection_id
  AND p.id=NEW.payee_id AND p.employee_id=NEW.employee_id AND b.plan->>'paymentDate'=NEW.payment_date::text
  AND EXISTS(SELECT 1 FROM jsonb_array_elements(b.plan->'payments') x WHERE x->>'method'='CHECK' AND (x->>'employeeId')::bigint=NEW.employee_id AND (x->>'amountCents')::bigint=NEW.amount_cents)
 ) THEN RAISE EXCEPTION 'Check claim must match active approved wages, recipient and funding without prior delivery'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_issue_source ON payroll_check_issue;
CREATE TRIGGER payroll_guard_check_issue_source BEFORE INSERT ON payroll_check_issue FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_issue_source();
CREATE OR REPLACE FUNCTION payroll_payment_batch_cancellable(target_batch BIGINT) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT NOT EXISTS(SELECT 1 FROM payroll_check_issue WHERE batch_id=target_batch) AND NOT EXISTS (
  SELECT 1 FROM payroll_payment_dispatch_attempt a WHERE a.batch_id=target_batch AND (
   NOT EXISTS(SELECT 1 FROM payroll_payment_observation o WHERE o.attempt_id=a.id AND o.source='SUBMISSION' AND o.result->>'status' IN ('BLOCKED_ACCOUNT_LOOKUP','BLOCKED_ACCOUNT_VERIFICATION'))
   OR EXISTS(SELECT 1 FROM payroll_payment_observation o WHERE o.attempt_id=a.id AND (
    o.result->>'providerId' IS NOT NULL OR (o.source='SUBMISSION' AND COALESCE(o.result->>'status','') NOT IN ('BLOCKED_ACCOUNT_LOOKUP','BLOCKED_ACCOUNT_VERIFICATION'))
   ))
  )
 )
$$;
CREATE OR REPLACE FUNCTION payroll_payment_closeout_ready(target_batch BIGINT,checks JSONB) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_payment_batch b
  WHERE NOT EXISTS(SELECT 1 FROM payroll_check_issue WHERE batch_id=target_batch) AND b.id=target_batch AND NOT EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=b.id)
  AND jsonb_typeof(checks)='array'
  AND jsonb_array_length(b.plan->'payments')>0
  AND jsonb_array_length(checks)=(SELECT count(*) FROM jsonb_array_elements(b.plan->'payments') p WHERE p->>'method'='CHECK')
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b.plan->'payments') p WHERE NOT (
   (p->>'method'='ZERO_NET' AND (p->>'amountCents')::bigint=0)
   OR (p->>'method'='CHECK' AND (SELECT count(*) FROM jsonb_array_elements(checks) c WHERE c->>'employeeId'=p->>'employeeId' AND c->>'amountCents'=p->>'amountCents' AND c->>'paymentDate'=b.plan->>'paymentDate' AND length(trim(c->>'reference')) BETWEEN 4 AND 200)=1)
   OR (p->>'method'='DIRECT_DEPOSIT' AND EXISTS(
    SELECT 1 FROM payroll_payment_batch_instruction l JOIN payroll_payment_instruction i ON i.id=l.instruction_id
    JOIN payroll_payment_dispatch_attempt a ON a.instruction_id=i.id AND a.batch_id=l.batch_id
    JOIN LATERAL(SELECT * FROM payroll_payment_observation WHERE attempt_id=a.id ORDER BY id DESC LIMIT 1)o ON true
    WHERE l.batch_id=b.id AND i.employee_id=(p->>'employeeId')::bigint AND i.amount_cents=(p->>'amountCents')::bigint AND i.mode='LIVE'
    AND o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED'
    AND o.result->>'dateMatches'='true' AND o.result->>'reconciliationStatus'='reconciled' AND o.result->>'liveMode'='true'
    AND o.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()
   ))
  ))
 )
$$;

CREATE TABLE IF NOT EXISTS payroll_check_document_check (
 id BIGSERIAL PRIMARY KEY,
 issue_id UUID NOT NULL REFERENCES payroll_check_issue(id),
 action TEXT NOT NULL CHECK(action IN ('RETAIN','DOWNLOAD')),
 status TEXT NOT NULL CHECK(status ~ '^[A-Z_]{1,64}$'),
 metadata JSONB NOT NULL,
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_check_document (
 issue_id UUID PRIMARY KEY REFERENCES payroll_check_issue(id),
 provider_id UUID NOT NULL,
 document_id UUID NOT NULL,
 sha256 TEXT NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 encrypted_pdf BYTEA NOT NULL,
 source_check_id BIGINT NOT NULL REFERENCES payroll_check_document_check(id),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['payroll_check_document','payroll_check_document_check'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',table_name);
  EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',table_name);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_check_document_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_document_check c WHERE c.id=NEW.source_check_id AND c.issue_id=NEW.issue_id AND c.automatic=NEW.automatic AND c.created_by IS NOT DISTINCT FROM NEW.created_by AND c.action='RETAIN' AND c.status='RETAINED' AND c.metadata->>'providerId'=NEW.provider_id::text AND c.metadata->>'documentId'=NEW.document_id::text AND c.metadata->>'sha256'=NEW.sha256)
 OR NEW.provider_id::text IS DISTINCT FROM (SELECT result->>'providerId' FROM payroll_check_issue_observation WHERE issue_id=NEW.issue_id AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1) THEN
  RAISE EXCEPTION 'Check document must match its verified issued-check evidence';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_document_source ON payroll_check_document;
CREATE TRIGGER payroll_guard_check_document_source BEFORE INSERT ON payroll_check_document FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_document_source();


CREATE TABLE IF NOT EXISTS payroll_check_delivery (
 issue_id UUID PRIMARY KEY REFERENCES payroll_check_issue(id),
 document_check_id BIGINT NOT NULL REFERENCES payroll_check_document_check(id),
 download_check_id BIGINT NOT NULL REFERENCES payroll_check_document_check(id),
 delivery_date DATE NOT NULL,
 amount_cents BIGINT NOT NULL CHECK(amount_cents>0),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 200),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_delivery;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_delivery FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_check_delivery_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_issue i JOIN payroll_check_document d ON d.issue_id=i.id JOIN payroll_check_document_check c ON c.id=NEW.document_check_id AND c.issue_id=i.id JOIN payroll_check_document_check p ON p.id=NEW.download_check_id AND p.issue_id=i.id
 WHERE i.id=NEW.issue_id AND NOT payroll_check_stop_blocks(i.id) AND i.amount_cents=NEW.amount_cents AND i.payment_date=NEW.delivery_date
 AND c.id=(SELECT id FROM payroll_check_document_check WHERE issue_id=i.id ORDER BY id DESC LIMIT 1)
 AND c.status='RETAINED' AND c.action='RETAIN' AND p.status='DOWNLOADED' AND p.action='DOWNLOAD' AND p.created_by=NEW.created_by
 AND c.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp() AND p.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation o WHERE o.issue_id=i.id AND o.id=(SELECT id FROM payroll_check_issue_observation WHERE issue_id=i.id ORDER BY id DESC LIMIT 1) AND o.created_at>c.created_at AND (COALESCE(o.result->>'status','')<>'SENT' OR o.result->>'providerId' IS DISTINCT FROM d.provider_id::text OR o.result->>'dateMatches' IS DISTINCT FROM 'true' OR o.result->>'expiryMatches' IS DISTINCT FROM 'true'))
 AND c.metadata->>'providerId'=d.provider_id::text AND c.metadata->>'documentId'=d.document_id::text AND c.metadata->>'sha256'=d.sha256
 AND p.metadata->>'providerId'=d.provider_id::text AND p.metadata->>'documentId'=d.document_id::text AND p.metadata->>'sha256'=d.sha256
 ) THEN RAISE EXCEPTION 'Check delivery requires matching recent retained and downloaded document evidence'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_delivery_source ON payroll_check_delivery;
CREATE TRIGGER payroll_guard_check_delivery_source BEFORE INSERT ON payroll_check_delivery FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_delivery_source();
CREATE OR REPLACE FUNCTION payroll_check_delivery_ready(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_delivery d JOIN payroll_check_document p ON p.issue_id=d.issue_id
 WHERE d.issue_id=target_issue AND (
 EXISTS(SELECT 1 FROM payroll_check_document_check c WHERE c.issue_id=d.issue_id AND c.id=(SELECT id FROM payroll_check_document_check WHERE issue_id=d.issue_id ORDER BY id DESC LIMIT 1) AND c.status IN ('RETAINED','DOWNLOADED') AND c.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp() AND c.metadata->>'providerId'=p.provider_id::text AND c.metadata->>'documentId'=p.document_id::text AND c.metadata->>'sha256'=p.sha256 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation o WHERE o.issue_id=d.issue_id AND o.id=(SELECT id FROM payroll_check_issue_observation WHERE issue_id=d.issue_id ORDER BY id DESC LIMIT 1) AND o.created_at>c.created_at AND (COALESCE(o.result->>'status','')<>'SENT' OR o.result->>'providerId' IS DISTINCT FROM p.provider_id::text OR o.result->>'dateMatches' IS DISTINCT FROM 'true' OR o.result->>'expiryMatches' IS DISTINCT FROM 'true')))
 OR EXISTS(SELECT 1 FROM payroll_check_issue_observation o WHERE o.issue_id=d.issue_id AND o.id=(SELECT id FROM payroll_check_issue_observation WHERE issue_id=d.issue_id ORDER BY id DESC LIMIT 1) AND o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED' AND o.result->>'providerId'=p.provider_id::text AND o.result->>'dateMatches'='true' AND o.result->>'expiryMatches'='true' AND o.result->>'liveMode'='true' AND o.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp())
 ))
$$;
CREATE OR REPLACE FUNCTION payroll_payment_closeout_ready(target_batch BIGINT,checks JSONB) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_payment_batch b
  WHERE NOT EXISTS(SELECT 1 FROM payroll_check_issue i WHERE i.batch_id=target_batch AND (
   NOT payroll_check_delivery_ready(i.id) OR NOT EXISTS(SELECT 1 FROM payroll_check_delivery d JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(checks)='array' THEN checks ELSE '[]'::jsonb END) c ON true WHERE d.issue_id=i.id AND c->>'employeeId'=i.employee_id::text AND c->>'amountCents'=i.amount_cents::text AND c->>'paymentDate'=d.delivery_date::text AND c->>'reference'=d.reference)
  )) AND b.id=target_batch AND NOT EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=b.id)
  AND jsonb_typeof(checks)='array'
  AND jsonb_array_length(b.plan->'payments')>0
  AND jsonb_array_length(checks)=(SELECT count(*) FROM jsonb_array_elements(b.plan->'payments') p WHERE p->>'method'='CHECK')
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b.plan->'payments') p WHERE NOT (
   (p->>'method'='ZERO_NET' AND (p->>'amountCents')::bigint=0)
   OR (p->>'method'='CHECK' AND (SELECT count(*) FROM jsonb_array_elements(checks) c WHERE c->>'employeeId'=p->>'employeeId' AND c->>'amountCents'=p->>'amountCents' AND c->>'paymentDate'=b.plan->>'paymentDate' AND length(trim(c->>'reference')) BETWEEN 4 AND 200)=1)
   OR (p->>'method'='DIRECT_DEPOSIT' AND EXISTS(
    SELECT 1 FROM payroll_payment_batch_instruction l JOIN payroll_payment_instruction i ON i.id=l.instruction_id
    JOIN payroll_payment_dispatch_attempt a ON a.instruction_id=i.id AND a.batch_id=l.batch_id
    JOIN LATERAL(SELECT * FROM payroll_payment_observation WHERE attempt_id=a.id ORDER BY id DESC LIMIT 1)o ON true
    WHERE l.batch_id=b.id AND i.employee_id=(p->>'employeeId')::bigint AND i.amount_cents=(p->>'amountCents')::bigint AND i.mode='LIVE'
    AND o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED'
    AND o.result->>'dateMatches'='true' AND o.result->>'reconciliationStatus'='reconciled' AND o.result->>'liveMode'='true'
    AND o.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()
   ))
  ))
 )
$$;


CREATE TABLE IF NOT EXISTS payroll_check_issue_recovery_check (
 id BIGSERIAL PRIMARY KEY,
 issue_id UUID NOT NULL REFERENCES payroll_check_issue(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_check_issue_recovery_check_latest ON payroll_check_issue_recovery_check(issue_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_issue_recovery_check;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_issue_recovery_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();


ALTER TABLE payroll_check_document_check ADD COLUMN IF NOT EXISTS automatic BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payroll_check_document_check ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE payroll_check_document ADD COLUMN IF NOT EXISTS automatic BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payroll_check_document ALTER COLUMN created_by DROP NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='payroll_check_document_check'::regclass AND conname='payroll_check_document_check_actor') THEN
  ALTER TABLE payroll_check_document_check ADD CONSTRAINT payroll_check_document_check_actor CHECK((automatic AND action='RETAIN' AND created_by IS NULL) OR (NOT automatic AND created_by IS NOT NULL));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='payroll_check_document'::regclass AND conname='payroll_check_document_actor') THEN
  ALTER TABLE payroll_check_document ADD CONSTRAINT payroll_check_document_actor CHECK((automatic AND created_by IS NULL) OR (NOT automatic AND created_by IS NOT NULL));
 END IF;
END $$;


CREATE TABLE IF NOT EXISTS payroll_check_receipt_acknowledgment (
 issue_id UUID PRIMARY KEY REFERENCES payroll_check_delivery(issue_id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),
 acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_receipt_acknowledgment;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_receipt_acknowledgment FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_check_receipt_acknowledgment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_issue i JOIN payroll_employee_session s ON s.facility_id=i.facility_id AND s.employee_id=i.employee_id WHERE i.id=NEW.issue_id AND i.employee_id=NEW.employee_id AND s.id=NEW.session_id AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()) THEN
  RAISE EXCEPTION 'Check acknowledgment requires the receiving employee session';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_receipt_acknowledgment ON payroll_check_receipt_acknowledgment;
CREATE TRIGGER payroll_guard_check_receipt_acknowledgment BEFORE INSERT ON payroll_check_receipt_acknowledgment FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_receipt_acknowledgment();


CREATE TABLE IF NOT EXISTS payroll_check_stop (
 id UUID PRIMARY KEY,
 issue_id UUID NOT NULL UNIQUE REFERENCES payroll_check_issue(id),
 provider_id UUID NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_check_stop_observation (
 id BIGSERIAL PRIMARY KEY,
 stop_id UUID NOT NULL REFERENCES payroll_check_stop(id),
 source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),
 result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['payroll_check_stop','payroll_check_stop_observation'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',table_name);
  EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',table_name);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_check_stop() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.provider_id::text IS DISTINCT FROM (SELECT result->>'providerId' FROM payroll_check_issue_observation WHERE issue_id=NEW.issue_id AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1) THEN
  RAISE EXCEPTION 'Stop request must identify the original issued check';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_stop ON payroll_check_stop;
CREATE TRIGGER payroll_guard_check_stop BEFORE INSERT ON payroll_check_stop FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_stop();

CREATE OR REPLACE FUNCTION payroll_check_delivery_ready(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_delivery d JOIN payroll_check_document p ON p.issue_id=d.issue_id
 WHERE d.issue_id=target_issue AND NOT EXISTS(SELECT 1 FROM payroll_check_stop WHERE issue_id=d.issue_id) AND (
 EXISTS(SELECT 1 FROM payroll_check_document_check c WHERE c.issue_id=d.issue_id AND c.id=(SELECT id FROM payroll_check_document_check WHERE issue_id=d.issue_id ORDER BY id DESC LIMIT 1) AND c.status IN ('RETAINED','DOWNLOADED') AND c.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp() AND c.metadata->>'providerId'=p.provider_id::text AND c.metadata->>'documentId'=p.document_id::text AND c.metadata->>'sha256'=p.sha256 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation o WHERE o.issue_id=d.issue_id AND o.id=(SELECT id FROM payroll_check_issue_observation WHERE issue_id=d.issue_id ORDER BY id DESC LIMIT 1) AND o.created_at>c.created_at AND (COALESCE(o.result->>'status','')<>'SENT' OR o.result->>'providerId' IS DISTINCT FROM p.provider_id::text OR o.result->>'dateMatches' IS DISTINCT FROM 'true' OR o.result->>'expiryMatches' IS DISTINCT FROM 'true')))
 OR EXISTS(SELECT 1 FROM payroll_check_issue_observation o WHERE o.issue_id=d.issue_id AND o.id=(SELECT id FROM payroll_check_issue_observation WHERE issue_id=d.issue_id ORDER BY id DESC LIMIT 1) AND o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED' AND o.result->>'providerId'=p.provider_id::text AND o.result->>'dateMatches'='true' AND o.result->>'expiryMatches'='true' AND o.result->>'liveMode'='true' AND o.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp())
 ))
$$;

CREATE INDEX IF NOT EXISTS payroll_check_stop_observation_latest ON payroll_check_stop_observation(stop_id,id DESC);


CREATE TABLE IF NOT EXISTS payroll_check_stop_release (
 stop_id UUID PRIMARY KEY REFERENCES payroll_check_stop(id),
 source_observation_id BIGINT NOT NULL REFERENCES payroll_check_stop_observation(id),
 action_id UUID NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_stop_release;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_stop_release FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_check_stop_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation o JOIN payroll_check_stop s ON s.id=o.stop_id WHERE o.id=NEW.source_observation_id AND o.stop_id=NEW.stop_id AND o.id=(SELECT id FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1) AND o.source='RECOVERY' AND o.result->>'status' IN ('FAILED','CANCELLED') AND o.result->>'checkStatus'='SENT' AND o.result->>'actionId'=NEW.action_id::text AND o.result->>'providerId'=s.provider_id::text AND o.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()) THEN
  RAISE EXCEPTION 'Stop release requires matching recent failed-stop evidence';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_stop_release ON payroll_check_stop_release;
CREATE TRIGGER payroll_guard_check_stop_release BEFORE INSERT ON payroll_check_stop_release FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_stop_release();
CREATE OR REPLACE FUNCTION payroll_check_stop_blocks(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_stop s WHERE s.issue_id=target_issue AND NOT EXISTS(
  SELECT 1 FROM payroll_check_stop_release r JOIN payroll_check_stop_observation o ON o.stop_id=r.stop_id
  WHERE r.stop_id=s.id AND o.id=(SELECT id FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1)
  AND o.source='RECOVERY' AND o.result->>'status' IN ('FAILED','CANCELLED') AND o.result->>'actionId'=r.action_id::text AND o.result->>'providerId'=s.provider_id::text AND o.result->>'checkStatus' IN ('SENT','COMPLETED')
  AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation later WHERE later.stop_id=s.id AND later.id>r.source_observation_id AND later.result->>'status'='STOP_CONFIRMED')
  AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation bad WHERE bad.issue_id=s.issue_id AND bad.result->>'status' IN ('STOPPED','RETURNED','REVERSED'))
  AND (o.result->>'checkStatus'='COMPLETED' OR NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation paid WHERE paid.issue_id=s.issue_id AND paid.result->>'status'='COMPLETED'))
 ))
$$;
CREATE OR REPLACE FUNCTION payroll_check_delivery_ready(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_delivery d JOIN payroll_check_document p ON p.issue_id=d.issue_id
 WHERE d.issue_id=target_issue AND NOT payroll_check_stop_blocks(d.issue_id) AND (
 EXISTS(SELECT 1 FROM payroll_check_document_check c WHERE c.issue_id=d.issue_id AND c.id=(SELECT id FROM payroll_check_document_check WHERE issue_id=d.issue_id ORDER BY id DESC LIMIT 1) AND c.status IN ('RETAINED','DOWNLOADED') AND c.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp() AND c.metadata->>'providerId'=p.provider_id::text AND c.metadata->>'documentId'=p.document_id::text AND c.metadata->>'sha256'=p.sha256 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation o WHERE o.issue_id=d.issue_id AND o.id=(SELECT id FROM payroll_check_issue_observation WHERE issue_id=d.issue_id ORDER BY id DESC LIMIT 1) AND o.created_at>c.created_at AND (COALESCE(o.result->>'status','')<>'SENT' OR o.result->>'providerId' IS DISTINCT FROM p.provider_id::text OR o.result->>'dateMatches' IS DISTINCT FROM 'true' OR o.result->>'expiryMatches' IS DISTINCT FROM 'true')))
 OR EXISTS(SELECT 1 FROM payroll_check_issue_observation o WHERE o.issue_id=d.issue_id AND o.id=(SELECT id FROM payroll_check_issue_observation WHERE issue_id=d.issue_id ORDER BY id DESC LIMIT 1) AND o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED' AND o.result->>'providerId'=p.provider_id::text AND o.result->>'dateMatches'='true' AND o.result->>'expiryMatches'='true' AND o.result->>'liveMode'='true' AND o.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp())
 ))
$$;


CREATE TABLE IF NOT EXISTS payroll_check_replacement_review (
 id BIGSERIAL PRIMARY KEY,
 issue_id UUID NOT NULL REFERENCES payroll_check_issue(id),
 basis JSONB NOT NULL,
 basis_fingerprint TEXT NOT NULL CHECK(basis_fingerprint ~ '^[a-f0-9]{64}$'),
 review JSONB NOT NULL,
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_check_replacement_review_latest ON payroll_check_replacement_review(issue_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_replacement_review;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_replacement_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_check_replacement_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_issue i JOIN payroll_check_stop s ON s.issue_id=i.id WHERE i.id=NEW.issue_id AND NEW.basis->>'issueId'=i.id::text AND NEW.basis->>'employeeId'=i.employee_id::text AND NEW.basis->>'runId'=i.payroll_run_id::text AND NEW.basis->>'stopId'=s.id::text AND NEW.basis->>'amountCents'=i.amount_cents::text AND NEW.review->>'amountCents'=i.amount_cents::text AND NEW.basis#>>'{stop,status}'='STOP_CONFIRMED' AND NEW.basis#>>'{check,status}'='STOPPED') THEN
  RAISE EXCEPTION 'Check replacement review must match its original stopped check';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_replacement_review ON payroll_check_replacement_review;
CREATE TRIGGER payroll_guard_check_replacement_review BEFORE INSERT ON payroll_check_replacement_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_replacement_review();

CREATE TABLE IF NOT EXISTS payroll_check_replacement_authorization (
 id UUID PRIMARY KEY,
 issue_id UUID NOT NULL REFERENCES payroll_check_issue(id),
 review_id BIGINT NOT NULL REFERENCES payroll_check_replacement_review(id),
 method TEXT NOT NULL CHECK(method IN ('CHECK','DIRECT_DEPOSIT')),
 amount_cents BIGINT NOT NULL CHECK(amount_cents>0),
 payment_date DATE NOT NULL,
 basis_fingerprint TEXT NOT NULL CHECK(basis_fingerprint ~ '^[a-f0-9]{64}$'),
 encrypted_intent BYTEA NOT NULL,
 account_summary JSONB,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 1000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_check_replacement_cancellation (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_check_replacement_authorization(id),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 1000),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_check_replacement_claim (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_check_replacement_authorization(id),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['payroll_check_replacement_authorization','payroll_check_replacement_cancellation','payroll_check_replacement_claim'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',t);
  EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',t);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_check_replacement_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM payroll_check_issue WHERE id=NEW.issue_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_check_replacement_authorization a WHERE a.issue_id=NEW.issue_id AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_cancellation c WHERE c.authorization_id=a.id)) THEN
  RAISE EXCEPTION 'A check replacement is already authorized';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_check_replacement_review r JOIN payroll_check_issue i ON i.id=r.issue_id JOIN payroll_payment_connection c ON c.id=NEW.connection_id AND c.facility_id=i.facility_id WHERE r.id=NEW.review_id AND r.issue_id=NEW.issue_id AND r.id=(SELECT id FROM payroll_check_replacement_review WHERE issue_id=NEW.issue_id ORDER BY id DESC LIMIT 1) AND r.review->>'taxTreatment'='ORIGINAL_PAYROLL_RETAINED' AND r.review->>'noOtherPaymentConfirmed'='true' AND r.review->>'method'=NEW.method AND r.review->>'amountCents'=NEW.amount_cents::text AND i.amount_cents=NEW.amount_cents AND r.review->>'replacementDate'=NEW.payment_date::text) THEN
  RAISE EXCEPTION 'Check replacement authorization requires its current retained review';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_replacement_authorization ON payroll_check_replacement_authorization;
CREATE TRIGGER payroll_guard_check_replacement_authorization BEFORE INSERT ON payroll_check_replacement_authorization FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_replacement_authorization();
CREATE OR REPLACE FUNCTION payroll_guard_check_replacement_disposition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM payroll_check_replacement_authorization WHERE id=NEW.authorization_id FOR UPDATE;
 IF TG_TABLE_NAME='payroll_check_replacement_claim' THEN
  IF EXISTS(SELECT 1 FROM payroll_check_replacement_cancellation WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled check replacement cannot dispatch'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM payroll_check_replacement_claim WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Claimed check replacement cannot cancel'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_replacement_disposition ON payroll_check_replacement_claim;
CREATE TRIGGER payroll_guard_check_replacement_disposition BEFORE INSERT ON payroll_check_replacement_claim FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_replacement_disposition();
DROP TRIGGER IF EXISTS payroll_guard_check_replacement_disposition ON payroll_check_replacement_cancellation;
CREATE TRIGGER payroll_guard_check_replacement_disposition BEFORE INSERT ON payroll_check_replacement_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_replacement_disposition();

CREATE TABLE IF NOT EXISTS payroll_check_replacement_observation (
 id BIGSERIAL PRIMARY KEY,
 authorization_id UUID NOT NULL REFERENCES payroll_check_replacement_claim(authorization_id),
 source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),
 result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_check_replacement_observation_latest ON payroll_check_replacement_observation(authorization_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_replacement_observation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_replacement_observation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_check_replacement_recovery_check (
 id BIGSERIAL PRIMARY KEY,
 authorization_id UUID NOT NULL REFERENCES payroll_check_replacement_claim(authorization_id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_check_replacement_recovery_latest ON payroll_check_replacement_recovery_check(authorization_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_replacement_recovery_check;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_replacement_recovery_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_check_replacement_document_check (
 id BIGSERIAL PRIMARY KEY,
 authorization_id UUID NOT NULL REFERENCES payroll_check_replacement_claim(authorization_id),
 action TEXT NOT NULL CHECK(action IN ('RETAIN','DOWNLOAD')),
 CHECK(NOT automatic OR action='RETAIN'),
 status TEXT NOT NULL CHECK(status ~ '^[A-Z_]{1,64}$'),
 metadata JSONB NOT NULL,
 created_by BIGINT,
 automatic BOOLEAN NOT NULL DEFAULT false,
 CHECK((automatic AND created_by IS NULL) OR (NOT automatic AND created_by IS NOT NULL)),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_check_replacement_document (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_check_replacement_claim(authorization_id),
 provider_id UUID NOT NULL,
 document_id UUID NOT NULL,
 sha256 TEXT NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 encrypted_pdf BYTEA NOT NULL,
 source_check_id BIGINT NOT NULL REFERENCES payroll_check_replacement_document_check(id),
 created_by BIGINT,
 automatic BOOLEAN NOT NULL DEFAULT false,
 CHECK((automatic AND created_by IS NULL) OR (NOT automatic AND created_by IS NOT NULL)),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['payroll_check_replacement_document','payroll_check_replacement_document_check'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',table_name);
  EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',table_name);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_check_replacement_document_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization WHERE id=NEW.authorization_id AND method='CHECK') THEN RAISE EXCEPTION 'Only CHECK replacements have printable documents'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_check_replacement_document_check c WHERE c.id=NEW.source_check_id AND c.authorization_id=NEW.authorization_id AND c.automatic=NEW.automatic AND c.created_by IS NOT DISTINCT FROM NEW.created_by AND c.action='RETAIN' AND c.status='RETAINED' AND c.metadata->>'providerId'=NEW.provider_id::text AND c.metadata->>'documentId'=NEW.document_id::text AND c.metadata->>'sha256'=NEW.sha256)
 OR NEW.provider_id::text IS DISTINCT FROM (SELECT result->>'providerId' FROM payroll_check_replacement_observation WHERE authorization_id=NEW.authorization_id AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1) THEN
  RAISE EXCEPTION 'Check document must match its verified issued-check evidence';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_replacement_document_source ON payroll_check_replacement_document;
CREATE TRIGGER payroll_guard_check_replacement_document_source BEFORE INSERT ON payroll_check_replacement_document FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_replacement_document_source();

CREATE TABLE IF NOT EXISTS payroll_check_replacement_delivery (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_check_replacement_claim(authorization_id),
 document_check_id BIGINT NOT NULL REFERENCES payroll_check_replacement_document_check(id),
 download_check_id BIGINT NOT NULL REFERENCES payroll_check_replacement_document_check(id),
 delivery_date DATE NOT NULL,
 amount_cents BIGINT NOT NULL CHECK(amount_cents>0),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 200),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_replacement_delivery;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_replacement_delivery FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_check_replacement_delivery_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization i JOIN payroll_check_replacement_document d ON d.authorization_id=i.id JOIN payroll_check_replacement_document_check c ON c.id=NEW.document_check_id AND c.authorization_id=i.id JOIN payroll_check_replacement_document_check p ON p.id=NEW.download_check_id AND p.authorization_id=i.id
 WHERE i.id=NEW.authorization_id AND i.method='CHECK' AND i.amount_cents=NEW.amount_cents AND i.payment_date=NEW.delivery_date
 AND c.id=(SELECT id FROM payroll_check_replacement_document_check WHERE authorization_id=i.id ORDER BY id DESC LIMIT 1)
 AND c.status='RETAINED' AND c.action='RETAIN' AND p.status='DOWNLOADED' AND p.action='DOWNLOAD' AND p.created_by=NEW.created_by
 AND c.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp() AND p.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_observation o WHERE o.authorization_id=i.id AND o.id=(SELECT id FROM payroll_check_replacement_observation WHERE authorization_id=i.id ORDER BY id DESC LIMIT 1) AND o.created_at>c.created_at AND (COALESCE(o.result->>'status','')<>'SENT' OR o.result->>'providerId' IS DISTINCT FROM d.provider_id::text OR o.result->>'dateMatches' IS DISTINCT FROM 'true' OR o.result->>'expiryMatches' IS DISTINCT FROM 'true'))
 AND c.metadata->>'providerId'=d.provider_id::text AND c.metadata->>'documentId'=d.document_id::text AND c.metadata->>'sha256'=d.sha256
 AND p.metadata->>'providerId'=d.provider_id::text AND p.metadata->>'documentId'=d.document_id::text AND p.metadata->>'sha256'=d.sha256
 ) THEN RAISE EXCEPTION 'Check delivery requires matching recent retained and downloaded document evidence'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_replacement_delivery_source ON payroll_check_replacement_delivery;
CREATE TRIGGER payroll_guard_check_replacement_delivery_source BEFORE INSERT ON payroll_check_replacement_delivery FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_replacement_delivery_source();

CREATE TABLE IF NOT EXISTS payroll_check_replacement_receipt_acknowledgment (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_check_replacement_delivery(authorization_id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),
 acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_replacement_receipt_acknowledgment;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_replacement_receipt_acknowledgment FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_check_replacement_receipt_acknowledgment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization a JOIN payroll_check_issue i ON i.id=a.issue_id JOIN payroll_employee_session s ON s.facility_id=i.facility_id AND s.employee_id=i.employee_id WHERE a.id=NEW.authorization_id AND i.employee_id=NEW.employee_id AND s.id=NEW.session_id AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()) THEN
  RAISE EXCEPTION 'Check acknowledgment requires the receiving employee session';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_check_replacement_receipt_acknowledgment ON payroll_check_replacement_receipt_acknowledgment;
CREATE TRIGGER payroll_guard_check_replacement_receipt_acknowledgment BEFORE INSERT ON payroll_check_replacement_receipt_acknowledgment FOR EACH ROW EXECUTE FUNCTION payroll_guard_check_replacement_receipt_acknowledgment();

ALTER TABLE payroll_check_replacement_authorization ADD COLUMN IF NOT EXISTS connection_id BIGINT REFERENCES payroll_payment_connection(id);

CREATE TABLE IF NOT EXISTS payroll_check_stop_case (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 payroll_run_id BIGINT NOT NULL REFERENCES payroll_run(id),
 issue_id UUID NOT NULL REFERENCES payroll_check_issue(id),
 status TEXT NOT NULL CHECK(status IN ('OPEN','CLOSED')),
 issues JSONB NOT NULL,
 evidence JSONB NOT NULL,
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_check_stop_case_latest ON payroll_check_stop_case(issue_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_stop_case;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_stop_case FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_check_stop_case() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_issue WHERE id=NEW.issue_id AND facility_id=NEW.facility_id AND payroll_run_id=NEW.payroll_run_id) THEN RAISE EXCEPTION 'Stopped-check case ownership mismatch.' USING ERRCODE='23514'; END IF;
 IF NEW.status='CLOSED' AND (NEW.issues<>'[]'::jsonb OR NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization a JOIN payroll_check_replacement_observation o ON o.authorization_id=a.id WHERE a.issue_id=NEW.issue_id AND a.id::text=NEW.evidence->>'authorizationId' AND o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED')) THEN RAISE EXCEPTION 'Closed case requires confirmed replacement payment and reconciled evidence.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_check_stop_case ON payroll_check_stop_case;
CREATE TRIGGER payroll_validate_check_stop_case BEFORE INSERT ON payroll_check_stop_case FOR EACH ROW EXECUTE FUNCTION payroll_validate_check_stop_case();


CREATE TABLE IF NOT EXISTS payroll_check_replacement_ach_receipt (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_check_replacement_authorization(id),
 observation_id BIGINT NOT NULL REFERENCES payroll_check_replacement_observation(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION payroll_validate_check_replacement_ach_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization a JOIN payroll_check_replacement_observation o ON o.authorization_id=a.id WHERE a.id=NEW.authorization_id AND a.method='DIRECT_DEPOSIT' AND o.id=NEW.observation_id AND o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED' AND o.result->>'dateMatches'='true' AND o.result->>'liveMode'='true' AND jsonb_typeof(o.result->'settlementEvidence')='array' AND jsonb_array_length(o.result->'settlementEvidence')>0 AND o.result->>'providerId'=(SELECT first.result->>'providerId' FROM payroll_check_replacement_observation first WHERE first.authorization_id=a.id AND first.result->>'providerId' IS NOT NULL ORDER BY first.id LIMIT 1)) THEN
  RAISE EXCEPTION 'Direct-deposit replacement receipt requires matching bank recovery evidence.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_check_replacement_ach_receipt ON payroll_check_replacement_ach_receipt;
CREATE TRIGGER payroll_validate_check_replacement_ach_receipt BEFORE INSERT ON payroll_check_replacement_ach_receipt FOR EACH ROW EXECUTE FUNCTION payroll_validate_check_replacement_ach_receipt();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_replacement_ach_receipt;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_replacement_ach_receipt FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_settlement_automation (
 id BIGSERIAL PRIMARY KEY, facility_id BIGINT NOT NULL REFERENCES facility(id), payroll_run_id BIGINT NOT NULL REFERENCES payroll_run(id), enabled BOOLEAN NOT NULL,
 mapping_id BIGINT REFERENCES payroll_payment_accounting_mapping(id), payroll_journal_id BIGINT REFERENCES payroll_quickbooks_sync(id), realm_id TEXT, environment TEXT,
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'), reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 500), created_by BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK(NOT enabled OR (mapping_id IS NOT NULL AND payroll_journal_id IS NOT NULL AND realm_id IS NOT NULL AND environment IN ('sandbox','production')))
);
CREATE INDEX IF NOT EXISTS payroll_settlement_automation_latest ON payroll_settlement_automation(payroll_run_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_settlement_automation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_settlement_automation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_settlement_automation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_run r WHERE r.id=NEW.payroll_run_id AND r.facility_id=NEW.facility_id AND (NOT NEW.enabled OR r.status='FINALIZED')) OR (NEW.enabled AND NOT EXISTS(SELECT 1 FROM payroll_payment_accounting_mapping m JOIN payroll_quickbooks_sync g ON g.id=NEW.payroll_journal_id WHERE m.id=NEW.mapping_id AND m.facility_id=NEW.facility_id AND g.facility_id=NEW.facility_id AND g.payroll_run_id=NEW.payroll_run_id AND g.realm_id=NEW.realm_id AND g.environment=NEW.environment AND g.status='SYNCED')) THEN RAISE EXCEPTION 'Settlement automation requires scoped finalized payroll and accounting evidence.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_settlement_automation ON payroll_settlement_automation;
CREATE TRIGGER payroll_validate_settlement_automation BEFORE INSERT ON payroll_settlement_automation FOR EACH ROW EXECUTE FUNCTION payroll_validate_settlement_automation();
ALTER TABLE payroll_settlement_journal ADD COLUMN IF NOT EXISTS automation_id BIGINT REFERENCES payroll_settlement_automation(id);
ALTER TABLE payroll_settlement_journal ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE payroll_settlement_journal_claim ALTER COLUMN created_by DROP NOT NULL;
CREATE OR REPLACE FUNCTION payroll_validate_settlement_automation_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='payroll_settlement_journal' THEN
  IF NEW.automation_id IS NULL THEN IF NEW.created_by IS NULL THEN RAISE EXCEPTION 'Manual journal requires its administrator.'; END IF;
  ELSE
   IF NEW.created_by IS NOT NULL OR NOT EXISTS(SELECT 1 FROM payroll_settlement_automation a WHERE a.id=NEW.automation_id AND a.enabled AND a.facility_id=NEW.facility_id AND a.payroll_run_id=NEW.payroll_run_id AND a.mapping_id=NEW.mapping_id AND a.payroll_journal_id=NEW.payroll_journal_id AND a.realm_id=NEW.realm_id AND a.environment=NEW.environment AND a.id=(SELECT max(id) FROM payroll_settlement_automation WHERE facility_id=a.facility_id AND payroll_run_id=a.payroll_run_id)) THEN RAISE EXCEPTION 'Automatic journal requires current matching authorization.'; END IF;
  END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM payroll_settlement_journal j WHERE j.id=NEW.journal_id AND j.created_by IS NOT DISTINCT FROM NEW.created_by) THEN RAISE EXCEPTION 'Journal claim actor does not match retained authorization.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_settlement_automation_job ON payroll_settlement_journal;
CREATE TRIGGER payroll_validate_settlement_automation_job BEFORE INSERT ON payroll_settlement_journal FOR EACH ROW EXECUTE FUNCTION payroll_validate_settlement_automation_job();
DROP TRIGGER IF EXISTS payroll_validate_settlement_automation_job ON payroll_settlement_journal_claim;
CREATE TRIGGER payroll_validate_settlement_automation_job BEFORE INSERT ON payroll_settlement_journal_claim FOR EACH ROW EXECUTE FUNCTION payroll_validate_settlement_automation_job();
CREATE TABLE IF NOT EXISTS payroll_settlement_automation_check(id BIGSERIAL PRIMARY KEY,automation_id BIGINT NOT NULL REFERENCES payroll_settlement_automation(id),created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
CREATE INDEX IF NOT EXISTS payroll_settlement_automation_check_latest ON payroll_settlement_automation_check(automation_id,id DESC);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_settlement_automation_check;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_settlement_automation_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

ALTER TABLE payroll_settlement_journal ADD COLUMN IF NOT EXISTS automation_check_id BIGINT REFERENCES payroll_settlement_automation_check(id);
CREATE TABLE IF NOT EXISTS payroll_settlement_automation_result (
 check_id BIGINT PRIMARY KEY REFERENCES payroll_settlement_automation_check(id),
 status TEXT NOT NULL CHECK(status IN ('COMPLETED','FAILED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_settlement_automation_result;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_settlement_automation_result FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_settlement_automation_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.automation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM payroll_settlement_automation_check c WHERE c.id=NEW.automation_check_id AND c.automation_id=NEW.automation_id) THEN RAISE EXCEPTION 'Automatic journal requires its matching worker attempt.'; END IF;
 IF NEW.automation_id IS NULL AND NEW.automation_check_id IS NOT NULL THEN RAISE EXCEPTION 'Manual journal cannot use an automatic worker attempt.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_settlement_automation_attempt ON payroll_settlement_journal;
CREATE TRIGGER payroll_validate_settlement_automation_attempt BEFORE INSERT ON payroll_settlement_journal FOR EACH ROW EXECUTE FUNCTION payroll_validate_settlement_automation_attempt();

CREATE TABLE IF NOT EXISTS payroll_w2_provider_event (
 event_id TEXT PRIMARY KEY CHECK(length(event_id) BETWEEN 1 AND 100), facility_id BIGINT NOT NULL REFERENCES facility(id), publication_id BIGINT NOT NULL REFERENCES payroll_w2_publication(id), attempt_id BIGINT NOT NULL REFERENCES payroll_w2_notice_attempt(id), delivery_id BIGINT NOT NULL, returned_at TIMESTAMPTZ NOT NULL, evidence JSONB NOT NULL, fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'), signed_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_w2_notice_evidence ON payroll_w2_provider_event;
CREATE TRIGGER payroll_guard_w2_notice_evidence BEFORE UPDATE OR DELETE ON payroll_w2_provider_event FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_notice_evidence();
CREATE OR REPLACE FUNCTION payroll_validate_w2_provider_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_w2_notice_attempt a JOIN payroll_w2_notice_job j ON j.id=a.job_id JOIN email_delivery d ON d.id=NEW.delivery_id AND d.facility_id=j.facility_id AND d.idempotency_key='w2-notice-'||a.dispatch_key::text WHERE a.id=NEW.attempt_id AND j.publication_id=NEW.publication_id AND j.facility_id=NEW.facility_id AND d.provider='smtp:sendgrid' AND d.recipient_hash=NEW.evidence->>'recipientHash' AND d.idempotency_key=NEW.evidence->>'dispatchKey' AND NEW.event_id=NEW.evidence->>'eventId' AND NEW.returned_at>=a.created_at AND NEW.returned_at>=d.created_at) THEN RAISE EXCEPTION 'Provider event requires matching W-2 delivery evidence.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_w2_provider_event ON payroll_w2_provider_event;
CREATE TRIGGER payroll_validate_w2_provider_event BEFORE INSERT ON payroll_w2_provider_event FOR EACH ROW EXECUTE FUNCTION payroll_validate_w2_provider_event();

CREATE TABLE IF NOT EXISTS payroll_w2_provider_processed(event_id TEXT PRIMARY KEY REFERENCES payroll_w2_provider_event(event_id),created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
CREATE TABLE IF NOT EXISTS payroll_w2_provider_check(id BIGSERIAL PRIMARY KEY,publication_id BIGINT NOT NULL REFERENCES payroll_w2_publication(id),created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
CREATE INDEX IF NOT EXISTS payroll_w2_provider_check_latest ON payroll_w2_provider_check(publication_id,id DESC);
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['payroll_w2_provider_processed','payroll_w2_provider_check'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_w2_notice_evidence ON %I',table_name);
  EXECUTE format('CREATE TRIGGER payroll_guard_w2_notice_evidence BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_notice_evidence()',table_name);
 END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS payroll_w2_return_correction (
 id BIGSERIAL PRIMARY KEY, return_id BIGINT NOT NULL REFERENCES payroll_w2_notice_return(id), prior_id BIGINT REFERENCES payroll_w2_return_correction(id),
 provider_event_id TEXT REFERENCES payroll_w2_provider_event(event_id), returned_at TIMESTAMPTZ NOT NULL,
 followup_timezone TEXT NOT NULL, followup_due_on DATE NOT NULL, reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000), created_by BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_w2_return_correction_revision ON payroll_w2_return_correction(return_id,COALESCE(prior_id,0));
CREATE OR REPLACE FUNCTION payroll_validate_w2_return_correction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt BIGINT; started TIMESTAMPTZ; zone TEXT;
BEGIN
 SELECT r.attempt_id,a.created_at,COALESCE((SELECT followup_timezone FROM payroll_w2_return_correction WHERE id=NEW.prior_id),r.followup_timezone,s.timezone) INTO attempt,started,zone FROM payroll_w2_notice_return r JOIN payroll_w2_notice_attempt a ON a.id=r.attempt_id JOIN payroll_w2_notice_job j ON j.id=a.job_id JOIN payroll_settings s ON s.facility_id=j.facility_id WHERE r.id=NEW.return_id;
 IF NEW.followup_timezone IS DISTINCT FROM zone OR NEW.followup_due_on IS DISTINCT FROM ((NEW.returned_at AT TIME ZONE zone)::date+30) THEN RAISE EXCEPTION 'Correction must preserve the return timezone and recalculate its target.'; END IF;
 IF attempt IS NULL OR NEW.returned_at<started OR NEW.returned_at>clock_timestamp() OR NEW.prior_id IS DISTINCT FROM (SELECT max(id) FROM payroll_w2_return_correction WHERE return_id=NEW.return_id) THEN RAISE EXCEPTION 'Return correction requires current retained evidence and a valid time.'; END IF;
 IF NEW.provider_event_id IS NULL THEN
  IF EXISTS(SELECT 1 FROM payroll_w2_provider_event WHERE attempt_id=attempt) THEN RAISE EXCEPTION 'Retained provider return must be reviewed.'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM payroll_w2_provider_event e WHERE e.event_id=NEW.provider_event_id AND e.attempt_id=attempt AND e.returned_at=NEW.returned_at AND e.event_id=(SELECT event_id FROM payroll_w2_provider_event WHERE attempt_id=attempt ORDER BY returned_at,event_id LIMIT 1)) THEN RAISE EXCEPTION 'Correction must use earliest retained provider return.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_w2_return_correction ON payroll_w2_return_correction;
CREATE TRIGGER payroll_validate_w2_return_correction BEFORE INSERT ON payroll_w2_return_correction FOR EACH ROW EXECUTE FUNCTION payroll_validate_w2_return_correction();
DROP TRIGGER IF EXISTS payroll_guard_w2_notice_evidence ON payroll_w2_return_correction;
CREATE TRIGGER payroll_guard_w2_notice_evidence BEFORE UPDATE OR DELETE ON payroll_w2_return_correction FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_notice_evidence();
CREATE OR REPLACE VIEW payroll_w2_effective_return AS
 SELECT r.id,r.attempt_id,CASE WHEN c.id IS NULL THEN r.source_delivery_id ELSE e.delivery_id END AS source_delivery_id,
 COALESCE(c.returned_at,r.returned_at) AS returned_at,COALESCE(c.followup_timezone,r.followup_timezone) AS followup_timezone,COALESCE(c.followup_due_on,r.followup_due_on) AS followup_due_on,
 CASE WHEN c.id IS NULL THEN r.source_kind WHEN e.event_id IS NOT NULL THEN 'MAIL_LOG' ELSE 'ADMIN' END AS source_kind,
 COALESCE(c.reference,r.reference) AS reference,c.id AS correction_id,r.returned_at AS original_returned_at
 FROM payroll_w2_notice_return r LEFT JOIN LATERAL(SELECT * FROM payroll_w2_return_correction WHERE return_id=r.id ORDER BY id DESC LIMIT 1)c ON true LEFT JOIN payroll_w2_provider_event e ON e.event_id=c.provider_event_id;
CREATE INDEX IF NOT EXISTS payroll_w2_provider_attempt_returns ON payroll_w2_provider_event(attempt_id,returned_at,event_id);
CREATE INDEX IF NOT EXISTS payroll_w2_return_correction_latest ON payroll_w2_return_correction(return_id,id DESC);

CREATE TABLE IF NOT EXISTS payroll_w2_return_retraction (
 return_id BIGINT PRIMARY KEY REFERENCES payroll_w2_notice_return(id), correction_id BIGINT REFERENCES payroll_w2_return_correction(id),
 followup_timezone TEXT NOT NULL, reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000), created_by BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_w2_return_retraction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_w2_effective_return r JOIN payroll_w2_notice_return original ON original.id=r.id WHERE r.id=NEW.return_id AND original.source_kind='ADMIN' AND r.source_kind='ADMIN' AND r.followup_timezone=NEW.followup_timezone AND r.correction_id IS NOT DISTINCT FROM NEW.correction_id AND NOT EXISTS(SELECT 1 FROM payroll_w2_provider_event e WHERE e.attempt_id=r.attempt_id)) THEN RAISE EXCEPTION 'Retraction requires current manual return evidence without a verified provider return.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_w2_return_retraction ON payroll_w2_return_retraction;
CREATE TRIGGER payroll_validate_w2_return_retraction BEFORE INSERT ON payroll_w2_return_retraction FOR EACH ROW EXECUTE FUNCTION payroll_validate_w2_return_retraction();
DROP TRIGGER IF EXISTS payroll_guard_w2_notice_evidence ON payroll_w2_return_retraction;
CREATE TRIGGER payroll_guard_w2_notice_evidence BEFORE UPDATE OR DELETE ON payroll_w2_return_retraction FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_notice_evidence();
CREATE OR REPLACE VIEW payroll_w2_current_return AS
 SELECT r.id,r.attempt_id,CASE WHEN x.return_id IS NOT NULL AND e.event_id IS NOT NULL THEN e.delivery_id ELSE r.source_delivery_id END AS source_delivery_id,
 CASE WHEN x.return_id IS NOT NULL AND e.event_id IS NOT NULL THEN e.returned_at ELSE r.returned_at END AS returned_at,
 COALESCE(x.followup_timezone,r.followup_timezone) AS followup_timezone,
 CASE WHEN x.return_id IS NOT NULL AND e.event_id IS NOT NULL THEN (e.returned_at AT TIME ZONE x.followup_timezone)::date+30 ELSE r.followup_due_on END AS followup_due_on,
 CASE WHEN x.return_id IS NOT NULL AND e.event_id IS NOT NULL THEN 'MAIL_LOG' ELSE r.source_kind END AS source_kind,
 r.reference,r.correction_id,r.original_returned_at,
 x.return_id IS NOT NULL AND e.event_id IS NULL AS is_retracted,x.reference AS retraction_reference,x.created_at AS retracted_at,
 x.return_id IS NOT NULL AND e.event_id IS NOT NULL AS provider_reinstated
 FROM payroll_w2_effective_return r LEFT JOIN payroll_w2_return_retraction x ON x.return_id=r.id
 LEFT JOIN LATERAL(SELECT * FROM payroll_w2_provider_event WHERE attempt_id=r.attempt_id ORDER BY returned_at,event_id LIMIT 1)e ON true;
CREATE OR REPLACE VIEW payroll_w2_notice_effective_result AS
 SELECT COALESCE(r.id,c.id,b.id) AS id,a.id AS attempt_id,
 CASE WHEN b.id IS NOT NULL THEN 'NOTICE_RETURNED' WHEN c.id IS NOT NULL THEN 'SMTP_ACCEPTED' ELSE r.outcome END AS outcome,
 COALESCE(b.created_at,c.created_at,r.created_at) AS created_at,r.retry_not_before,
 CASE WHEN b.id IS NOT NULL THEN 'retained_mail_return' WHEN c.id IS NOT NULL THEN 'retained_mail_acceptance' ELSE r.reason END AS reason,
 r.outcome AS original_outcome,c.id AS reconciliation_id,b.returned_at
 FROM payroll_w2_notice_attempt a LEFT JOIN payroll_w2_notice_result r ON r.attempt_id=a.id
 LEFT JOIN payroll_w2_notice_reconciliation c ON c.attempt_id=a.id
 LEFT JOIN (SELECT v.*,original.created_at FROM payroll_w2_current_return v JOIN payroll_w2_notice_return original ON original.id=v.id WHERE NOT v.is_retracted)b ON b.attempt_id=a.id;

CREATE TABLE IF NOT EXISTS payroll_check_replacement_closeout (
 id BIGSERIAL PRIMARY KEY, issue_id UUID NOT NULL REFERENCES payroll_check_issue(id), authorization_id UUID NOT NULL REFERENCES payroll_check_replacement_authorization(id), review_id BIGINT NOT NULL REFERENCES payroll_check_replacement_review(id),
 original_observation_id BIGINT NOT NULL REFERENCES payroll_check_issue_observation(id), stop_observation_id BIGINT NOT NULL REFERENCES payroll_check_stop_observation(id), replacement_observation_id BIGINT NOT NULL REFERENCES payroll_check_replacement_observation(id), evidence JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(issue_id,authorization_id,review_id,original_observation_id,stop_observation_id,replacement_observation_id)
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_replacement_closeout;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_replacement_closeout FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_check_stop_current_action(target UUID) RETURNS TEXT LANGUAGE sql VOLATILE AS $$
 SELECT result->>'actionId' FROM payroll_check_stop_observation WHERE stop_id=target AND result->>'actionId' IS NOT NULL ORDER BY id LIMIT 1
$$;
CREATE OR REPLACE FUNCTION payroll_check_replacement_closeout_proof_ready(target_proof BIGINT) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_replacement_closeout p
 JOIN payroll_check_issue i ON i.id=p.issue_id JOIN payroll_check_delivery d ON d.issue_id=i.id AND d.delivery_date=i.payment_date
 JOIN payroll_check_replacement_authorization a ON a.id=p.authorization_id AND a.issue_id=i.id AND a.amount_cents=i.amount_cents
 JOIN payroll_check_replacement_review r ON r.id=p.review_id AND r.issue_id=i.id
 JOIN payroll_check_issue_observation original ON original.id=p.original_observation_id AND original.issue_id=i.id
 JOIN payroll_check_stop s ON s.issue_id=i.id JOIN payroll_check_stop_observation stop ON stop.id=p.stop_observation_id AND stop.stop_id=s.id
 JOIN payroll_check_replacement_observation paid ON paid.id=p.replacement_observation_id AND paid.authorization_id=a.id
 WHERE p.id=target_proof AND p.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_cancellation WHERE authorization_id=a.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization other WHERE other.issue_id=i.id AND other.id<>a.id AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_cancellation WHERE authorization_id=other.id))
 AND a.connection_id=(SELECT max(id) FROM payroll_payment_connection WHERE facility_id=i.facility_id)
 AND a.method=(SELECT CASE WHEN status='COMPLETE' THEN response->>'method' END FROM payroll_onboarding_task WHERE facility_id=i.facility_id AND employee_id=i.employee_id AND task_key='PAYMENT' ORDER BY id DESC LIMIT 1)
 AND p.evidence->>'wageDate'=i.payment_date::text AND p.evidence->>'replacementDate'=a.payment_date::text AND p.evidence->>'amountCents'=i.amount_cents::text AND p.evidence->>'method'=a.method
 AND jsonb_typeof(p.evidence->'movements')='array' AND jsonb_array_length(p.evidence->'movements')>0
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation WHERE issue_id=i.id AND (result->>'status' IN ('COMPLETED','RETURNED','REVERSED') OR result->>'settlementStatus'='BANK_POSTED'))
 AND original.result->>'providerId'=(SELECT result->>'providerId' FROM payroll_check_issue_observation WHERE issue_id=i.id AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1) AND original.result->>'dateMatches'='true' AND original.result->>'expiryMatches'='true' AND original.result->>'liveMode'='true'
 AND stop.result->>'providerId'=original.result->>'providerId' AND stop.result->>'checkStatus'='STOPPED' AND stop.result->>'actionId'=payroll_check_stop_current_action(s.id)
 AND paid.result->>'providerId'=(SELECT result->>'providerId' FROM payroll_check_replacement_observation WHERE authorization_id=a.id AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1)
 AND jsonb_typeof(paid.result->'settlementEvidence')='array' AND jsonb_array_length(paid.result->'settlementEvidence')>0
 AND r.id=(SELECT max(id) FROM payroll_check_replacement_review WHERE issue_id=i.id) AND r.review->>'taxTreatment'='ORIGINAL_PAYROLL_RETAINED' AND r.review->>'amountCents'=a.amount_cents::text AND r.review->>'method'=a.method AND r.review->>'replacementDate'=a.payment_date::text AND r.review->>'noOtherPaymentConfirmed'='true'
 AND original.id=(SELECT max(id) FROM payroll_check_issue_observation WHERE issue_id=i.id) AND original.source='RECOVERY' AND original.result->>'status'='STOPPED'
 AND stop.id=(SELECT max(id) FROM payroll_check_stop_observation WHERE stop_id=s.id) AND stop.source='RECOVERY' AND stop.result->>'status'='STOP_CONFIRMED'
 AND paid.id=(SELECT max(id) FROM payroll_check_replacement_observation WHERE authorization_id=a.id) AND paid.source='RECOVERY' AND paid.result->>'status'='COMPLETED' AND paid.result->>'settlementStatus'='BANK_POSTED' AND paid.result->>'liveMode'='true' AND paid.result->>'dateMatches'='true'
 AND paid.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()
 AND original.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp() AND stop.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()
 AND (a.method='DIRECT_DEPOSIT' OR EXISTS(SELECT 1 FROM payroll_check_replacement_delivery WHERE authorization_id=a.id))
 )
$$;

CREATE OR REPLACE FUNCTION payroll_check_replacement_closeout_ready(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_replacement_closeout p WHERE p.issue_id=target_issue AND payroll_check_replacement_closeout_proof_ready(p.id))
$$;
CREATE OR REPLACE FUNCTION payroll_validate_check_replacement_closeout() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT payroll_check_replacement_closeout_proof_ready(NEW.id) THEN RAISE EXCEPTION 'Replacement closeout requires current matching handoff, wage review and bank evidence.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_check_replacement_closeout ON payroll_check_replacement_closeout;
CREATE TRIGGER payroll_validate_check_replacement_closeout AFTER INSERT ON payroll_check_replacement_closeout FOR EACH ROW EXECUTE FUNCTION payroll_validate_check_replacement_closeout();
CREATE OR REPLACE FUNCTION payroll_check_closeout_ready(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT payroll_check_delivery_ready(target_issue) OR payroll_check_replacement_closeout_ready(target_issue)
$$;

CREATE OR REPLACE FUNCTION payroll_payment_closeout_ready(target_batch BIGINT,checks JSONB) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_payment_batch b
  WHERE NOT EXISTS(SELECT 1 FROM payroll_check_issue i WHERE i.batch_id=target_batch AND (
   NOT payroll_check_closeout_ready(i.id) OR NOT EXISTS(SELECT 1 FROM payroll_check_delivery d JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(checks)='array' THEN checks ELSE '[]'::jsonb END) c ON true WHERE d.issue_id=i.id AND c->>'employeeId'=i.employee_id::text AND c->>'amountCents'=i.amount_cents::text AND c->>'paymentDate'=d.delivery_date::text AND c->>'reference'=d.reference)
  )) AND b.id=target_batch AND NOT EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=b.id)
  AND jsonb_typeof(checks)='array'
  AND jsonb_array_length(b.plan->'payments')>0
  AND jsonb_array_length(checks)=(SELECT count(*) FROM jsonb_array_elements(b.plan->'payments') p WHERE p->>'method'='CHECK')
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b.plan->'payments') p WHERE NOT (
   (p->>'method'='ZERO_NET' AND (p->>'amountCents')::bigint=0)
   OR (p->>'method'='CHECK' AND (SELECT count(*) FROM jsonb_array_elements(checks) c WHERE c->>'employeeId'=p->>'employeeId' AND c->>'amountCents'=p->>'amountCents' AND c->>'paymentDate'=b.plan->>'paymentDate' AND length(trim(c->>'reference')) BETWEEN 4 AND 200)=1)
   OR (p->>'method'='DIRECT_DEPOSIT' AND EXISTS(
    SELECT 1 FROM payroll_payment_batch_instruction l JOIN payroll_payment_instruction i ON i.id=l.instruction_id
    JOIN payroll_payment_dispatch_attempt a ON a.instruction_id=i.id AND a.batch_id=l.batch_id
    JOIN LATERAL(SELECT * FROM payroll_payment_observation WHERE attempt_id=a.id ORDER BY id DESC LIMIT 1)o ON true
    WHERE l.batch_id=b.id AND i.employee_id=(p->>'employeeId')::bigint AND i.amount_cents=(p->>'amountCents')::bigint AND i.mode='LIVE'
    AND o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED'
    AND o.result->>'dateMatches'='true' AND o.result->>'reconciliationStatus'='reconciled' AND o.result->>'liveMode'='true'
    AND o.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()
   ))
  ))
 )
$$;

ALTER TABLE payroll_payment_closeout ADD COLUMN IF NOT EXISTS replacement_evidence JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE OR REPLACE FUNCTION payroll_retain_replacement_closeout_links() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT COALESCE(jsonb_agg(jsonb_build_object('proofId',p.id,'issueId',p.issue_id,'authorizationId',p.authorization_id,'evidence',p.evidence)),'[]'::jsonb) INTO NEW.replacement_evidence
 FROM payroll_check_issue i JOIN LATERAL(SELECT * FROM payroll_check_replacement_closeout WHERE issue_id=i.id AND payroll_check_replacement_closeout_proof_ready(id) ORDER BY id DESC LIMIT 1)p ON true WHERE i.batch_id=NEW.batch_id;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_retain_replacement_closeout_links ON payroll_payment_closeout;
CREATE TRIGGER payroll_retain_replacement_closeout_links BEFORE INSERT ON payroll_payment_closeout FOR EACH ROW EXECUTE FUNCTION payroll_retain_replacement_closeout_links();

-- Repeated manual return reviews retain every transition after the first retraction.
CREATE TABLE IF NOT EXISTS payroll_w2_return_cycle (
 id BIGSERIAL PRIMARY KEY, return_id BIGINT NOT NULL REFERENCES payroll_w2_notice_return(id),
 prior_id BIGINT REFERENCES payroll_w2_return_cycle(id), correction_id BIGINT NOT NULL REFERENCES payroll_w2_return_correction(id),
 action TEXT NOT NULL CHECK(action IN ('RETURN_RECORDED','RETRACTED')),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000), created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_w2_return_cycle_revision ON payroll_w2_return_cycle(return_id,COALESCE(prior_id,0));
CREATE OR REPLACE FUNCTION payroll_validate_w2_return_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_action TEXT; current_correction BIGINT; attempt BIGINT;
BEGIN
 SELECT attempt_id INTO attempt FROM payroll_w2_notice_return WHERE id=NEW.return_id AND source_kind='ADMIN' FOR UPDATE;
 IF attempt IS NULL OR NOT EXISTS(SELECT 1 FROM payroll_w2_return_retraction WHERE return_id=NEW.return_id)
 OR EXISTS(SELECT 1 FROM payroll_w2_provider_event WHERE attempt_id=attempt)
 OR NEW.prior_id IS DISTINCT FROM (SELECT max(id) FROM payroll_w2_return_cycle WHERE return_id=NEW.return_id)
 OR NOT EXISTS(SELECT 1 FROM payroll_w2_return_correction WHERE id=NEW.correction_id AND return_id=NEW.return_id AND provider_event_id IS NULL)
 OR NEW.correction_id IS DISTINCT FROM (SELECT max(id) FROM payroll_w2_return_correction WHERE return_id=NEW.return_id)
 THEN RAISE EXCEPTION 'Return cycle requires current manual evidence without a verified provider return.'; END IF;
 IF to_regclass('email_delivery') IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM email_delivery d JOIN payroll_w2_notice_attempt a ON d.idempotency_key='w2-notice-'||a.dispatch_key::text JOIN payroll_w2_notice_job j ON j.id=a.job_id WHERE a.id=attempt AND d.facility_id=j.facility_id AND d.status='bounced') THEN RAISE EXCEPTION 'A bounced mail delivery requires provider reconciliation.'; END IF;
 END IF;
 IF NEW.action='RETURN_RECORDED' AND EXISTS(SELECT 1 FROM payroll_w2_notice_effective_result WHERE attempt_id=attempt AND outcome NOT IN ('SMTP_ACCEPTED','UNCERTAIN')) THEN RAISE EXCEPTION 'Current send evidence does not support a returned notice.'; END IF;
 SELECT action,correction_id INTO current_action,current_correction FROM payroll_w2_return_cycle WHERE return_id=NEW.return_id ORDER BY id DESC LIMIT 1;
 IF current_action IS NULL THEN SELECT 'RETRACTED',correction_id INTO current_action,current_correction FROM payroll_w2_return_retraction WHERE return_id=NEW.return_id; END IF;
 IF current_action=NEW.action OR (NEW.action='RETURN_RECORDED' AND NEW.correction_id IS NOT DISTINCT FROM current_correction) THEN RAISE EXCEPTION 'Review the next return transition and its new evidence.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_w2_return_cycle ON payroll_w2_return_cycle;
CREATE TRIGGER payroll_validate_w2_return_cycle BEFORE INSERT ON payroll_w2_return_cycle FOR EACH ROW EXECUTE FUNCTION payroll_validate_w2_return_cycle();
DROP TRIGGER IF EXISTS payroll_guard_w2_notice_evidence ON payroll_w2_return_cycle;
CREATE TRIGGER payroll_guard_w2_notice_evidence BEFORE UPDATE OR DELETE ON payroll_w2_return_cycle FOR EACH ROW EXECUTE FUNCTION payroll_guard_w2_notice_evidence();
CREATE OR REPLACE VIEW payroll_w2_current_return AS
 SELECT r.id,r.attempt_id,CASE WHEN x.return_id IS NOT NULL AND e.event_id IS NOT NULL THEN e.delivery_id ELSE r.source_delivery_id END AS source_delivery_id,
 CASE WHEN x.return_id IS NOT NULL AND e.event_id IS NOT NULL THEN e.returned_at ELSE r.returned_at END AS returned_at,
 COALESCE(x.followup_timezone,r.followup_timezone) AS followup_timezone,
 CASE WHEN x.return_id IS NOT NULL AND e.event_id IS NOT NULL THEN (e.returned_at AT TIME ZONE x.followup_timezone)::date+30 ELSE r.followup_due_on END AS followup_due_on,
 CASE WHEN x.return_id IS NOT NULL AND e.event_id IS NOT NULL THEN 'MAIL_LOG' ELSE r.source_kind END AS source_kind,
 r.reference,r.correction_id,r.original_returned_at,
 x.return_id IS NOT NULL AND e.event_id IS NULL AND COALESCE(v.action,'RETRACTED')='RETRACTED' AS is_retracted,
 x.reference AS retraction_reference,x.created_at AS retracted_at,
 x.return_id IS NOT NULL AND e.event_id IS NOT NULL AS provider_reinstated
 FROM payroll_w2_effective_return r LEFT JOIN payroll_w2_return_retraction x ON x.return_id=r.id
 LEFT JOIN LATERAL(SELECT * FROM payroll_w2_return_cycle WHERE return_id=r.id ORDER BY id DESC LIMIT 1)v ON true
 LEFT JOIN LATERAL(SELECT * FROM payroll_w2_provider_event WHERE attempt_id=r.attempt_id ORDER BY returned_at,event_id LIMIT 1)e ON true;

-- Definite pre-submit check failures can be cancelled after fresh GET-only recovery.
CREATE OR REPLACE FUNCTION payroll_check_preflight_blocked(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_issue WHERE id=target_issue)
 AND EXISTS(SELECT 1 FROM payroll_check_issue_observation WHERE issue_id=target_issue AND source='SUBMISSION' AND result->>'status' IN ('BLOCKED_CHECK_CONFIGURATION','BLOCKED_PAYMENT_DATE','BLOCKED_ACCOUNT_LOOKUP','BLOCKED_PAYEE_OR_FUNDING'))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation WHERE issue_id=target_issue AND (result->>'providerId' IS NOT NULL OR (source='SUBMISSION' AND COALESCE(result->>'status','') NOT IN ('BLOCKED_CHECK_CONFIGURATION','BLOCKED_PAYMENT_DATE','BLOCKED_ACCOUNT_LOOKUP','BLOCKED_PAYEE_OR_FUNDING')) OR COALESCE(result->>'status','') IN ('COMPLETED','SENT','PROCESSING','PROVIDER_APPROVED','AWAITING_PROVIDER_APPROVAL','STOPPED','RETURNED','REVERSED')))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_document WHERE issue_id=target_issue)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_delivery WHERE issue_id=target_issue)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop WHERE issue_id=target_issue)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization WHERE issue_id=target_issue)
$$;
CREATE OR REPLACE FUNCTION payroll_check_preflight_cancellable(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT payroll_check_preflight_blocked(target_issue) AND EXISTS(
 SELECT 1 FROM payroll_check_issue_observation WHERE issue_id=target_issue
 AND id=(SELECT max(id) FROM payroll_check_issue_observation WHERE issue_id=target_issue)
 AND source='RECOVERY' AND result->>'status'='NOT_FOUND' AND result->>'providerId' IS NULL
 AND created_at>=now()-interval '15 minutes' AND created_at<=clock_timestamp())
$$;
CREATE OR REPLACE FUNCTION payroll_payment_batch_cancellable(target_batch BIGINT) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT NOT EXISTS(SELECT 1 FROM payroll_check_issue WHERE batch_id=target_batch AND NOT payroll_check_preflight_cancellable(id)) AND NOT EXISTS (
  SELECT 1 FROM payroll_payment_dispatch_attempt a WHERE a.batch_id=target_batch AND (
   NOT EXISTS(SELECT 1 FROM payroll_payment_observation o WHERE o.attempt_id=a.id AND o.source='SUBMISSION' AND o.result->>'status' IN ('BLOCKED_ACCOUNT_LOOKUP','BLOCKED_ACCOUNT_VERIFICATION'))
   OR EXISTS(SELECT 1 FROM payroll_payment_observation o WHERE o.attempt_id=a.id AND (
    o.result->>'providerId' IS NOT NULL OR (o.source='SUBMISSION' AND COALESCE(o.result->>'status','') NOT IN ('BLOCKED_ACCOUNT_LOOKUP','BLOCKED_ACCOUNT_VERIFICATION'))
   ))
  )
 )
$$;
ALTER TABLE payroll_payment_batch_cancellation ADD COLUMN IF NOT EXISTS check_preflight_evidence JSONB NOT NULL DEFAULT '[]';
CREATE OR REPLACE FUNCTION payroll_retain_check_preflight_cancellation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT COALESCE(jsonb_agg(jsonb_build_object('issueId',i.id,'employeeId',i.employee_id,'amountCents',i.amount_cents,'paymentDate',i.payment_date,'submissionObservationId',s.id,'blockedStatus',s.result->>'status','recoveryObservationId',o.id,'recoveredAt',o.created_at) ORDER BY i.employee_id),'[]') INTO NEW.check_preflight_evidence
 FROM payroll_check_issue i
 JOIN LATERAL(SELECT * FROM payroll_check_issue_observation WHERE issue_id=i.id AND source='SUBMISSION' ORDER BY id LIMIT 1)s ON true
 JOIN LATERAL(SELECT * FROM payroll_check_issue_observation WHERE issue_id=i.id ORDER BY id DESC LIMIT 1)o ON true
 WHERE i.batch_id=NEW.batch_id AND payroll_check_preflight_cancellable(i.id);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_retain_check_preflight_cancellation ON payroll_payment_batch_cancellation;
CREATE TRIGGER payroll_retain_check_preflight_cancellation BEFORE INSERT ON payroll_payment_batch_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_retain_check_preflight_cancellation();

CREATE TABLE IF NOT EXISTS payroll_check_cancellation (
 id UUID PRIMARY KEY, issue_id UUID NOT NULL UNIQUE REFERENCES payroll_check_issue(id), provider_id UUID NOT NULL,
 source_observation_id BIGINT NOT NULL REFERENCES payroll_check_issue_observation(id),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_check_cancellation_observation (
 id BIGSERIAL PRIMARY KEY,cancellation_id UUID NOT NULL REFERENCES payroll_check_cancellation(id),
 source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_check_cancellation_latest ON payroll_check_cancellation_observation(cancellation_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_check_cancel_history_ready(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_issue WHERE id=target_issue)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_document WHERE issue_id=target_issue)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_delivery WHERE issue_id=target_issue)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop WHERE issue_id=target_issue)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization WHERE issue_id=target_issue)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation WHERE issue_id=target_issue AND (
  result->>'reconciliationStatus'='reconciled' OR result->>'settlementStatus'='BANK_POSTED' OR result->>'status' IN ('PROCESSING','SENT','COMPLETED','RETURNED','REVERSED','STOPPED','HELD')
  OR (result->>'providerId' IS NOT NULL AND (COALESCE(result->>'status','') NOT IN ('AWAITING_PROVIDER_APPROVAL','PROVIDER_APPROVED','CANCELLED') OR result->>'providerId' IS DISTINCT FROM (SELECT result->>'providerId' FROM payroll_check_issue_observation WHERE issue_id=target_issue AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1)))))
$$;
CREATE OR REPLACE FUNCTION payroll_check_cancel_reviewable(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT payroll_check_cancel_history_ready(target_issue) AND EXISTS(
 SELECT 1 FROM payroll_check_issue i JOIN payroll_run r ON r.id=i.payroll_run_id
 JOIN LATERAL(SELECT * FROM payroll_check_issue_observation WHERE issue_id=i.id ORDER BY id DESC LIMIT 1)o ON true
 WHERE i.id=target_issue AND r.status='APPROVED' AND NOT EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=i.batch_id)
 AND o.source='RECOVERY' AND o.created_at>=now()-interval '15 minutes' AND o.created_at<=clock_timestamp()
 AND o.result->>'status' IN ('AWAITING_PROVIDER_APPROVAL','PROVIDER_APPROVED','CANCELLED')
 AND o.result->>'reconciliationStatus'='unreconciled' AND o.result->>'dateMatches'='true' AND o.result->>'expiryMatches'='true' AND o.result->>'liveMode'='true'
 AND o.result->>'providerId'=(SELECT result->>'providerId' FROM payroll_check_issue_observation WHERE issue_id=i.id AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1))
$$;
CREATE OR REPLACE FUNCTION payroll_validate_check_cancellation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT payroll_check_cancel_reviewable(NEW.issue_id) OR NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation o WHERE o.id=NEW.source_observation_id AND o.issue_id=NEW.issue_id AND o.id=(SELECT max(id) FROM payroll_check_issue_observation WHERE issue_id=NEW.issue_id) AND o.result->>'providerId'=NEW.provider_id::text) THEN RAISE EXCEPTION 'Recover the current unprocessed check before cancellation.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_check_cancellation ON payroll_check_cancellation;
CREATE TRIGGER payroll_validate_check_cancellation BEFORE INSERT ON payroll_check_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_validate_check_cancellation();
DO $$ DECLARE item TEXT; BEGIN
 FOREACH item IN ARRAY ARRAY['payroll_check_cancellation','payroll_check_cancellation_observation'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_evidence ON %I',item);
  EXECUTE format('CREATE TRIGGER payroll_guard_payment_evidence BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',item);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_check_provider_cancelled(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT payroll_check_cancel_history_ready(target_issue) AND EXISTS(
 SELECT 1 FROM payroll_check_cancellation c
 JOIN LATERAL(SELECT * FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id ORDER BY id DESC LIMIT 1)x ON true
 JOIN LATERAL(SELECT * FROM payroll_check_issue_observation WHERE issue_id=c.issue_id ORDER BY id DESC LIMIT 1)o ON true
 WHERE c.issue_id=target_issue AND x.source='RECOVERY' AND x.result->>'status'='CANCEL_CONFIRMED'
 AND x.created_at>=now()-interval '15 minutes' AND x.created_at<=clock_timestamp()
 AND o.source='RECOVERY' AND o.created_at>=now()-interval '15 minutes' AND o.created_at<=clock_timestamp()
 AND o.result->>'status'='CANCELLED' AND o.result->>'providerId'=c.provider_id::text
 AND o.result->>'reconciliationStatus'='unreconciled' AND x.result->'payment'->>'reconciliationStatus'='unreconciled' AND o.result->>'dateMatches'='true' AND o.result->>'expiryMatches'='true' AND o.result->>'liveMode'='true'
 AND x.result->'payment'->>'providerId'=c.provider_id::text AND x.result->'payment'->>'status'='CANCELLED'
 AND x.result->'payment'->>'dateMatches'='true' AND x.result->'payment'->>'expiryMatches'='true' AND x.result->'payment'->>'liveMode'='true')
$$;
CREATE OR REPLACE FUNCTION payroll_check_cancellation_blocks(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_cancellation c WHERE c.issue_id=target_issue AND NOT EXISTS(SELECT 1 FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id AND source='SUBMISSION' AND result->>'status'='NOT_ELIGIBLE' AND result->>'requestSent'='false'))
$$;
CREATE OR REPLACE FUNCTION payroll_payment_batch_cancellable(target_batch BIGINT) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT NOT EXISTS(SELECT 1 FROM payroll_check_issue WHERE batch_id=target_batch AND NOT (payroll_check_preflight_cancellable(id) OR payroll_check_provider_cancelled(id))) AND NOT EXISTS (
  SELECT 1 FROM payroll_payment_dispatch_attempt a WHERE a.batch_id=target_batch AND (
   NOT EXISTS(SELECT 1 FROM payroll_payment_observation o WHERE o.attempt_id=a.id AND o.source='SUBMISSION' AND o.result->>'status' IN ('BLOCKED_ACCOUNT_LOOKUP','BLOCKED_ACCOUNT_VERIFICATION'))
   OR EXISTS(SELECT 1 FROM payroll_payment_observation o WHERE o.attempt_id=a.id AND (o.result->>'providerId' IS NOT NULL OR (o.source='SUBMISSION' AND COALESCE(o.result->>'status','') NOT IN ('BLOCKED_ACCOUNT_LOOKUP','BLOCKED_ACCOUNT_VERIFICATION'))))
  ))
$$;
ALTER TABLE payroll_payment_batch_cancellation ADD COLUMN IF NOT EXISTS provider_check_evidence JSONB NOT NULL DEFAULT '[]';
CREATE OR REPLACE FUNCTION payroll_retain_provider_check_cancellation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT COALESCE(jsonb_agg(jsonb_build_object('issueId',i.id,'employeeId',i.employee_id,'amountCents',i.amount_cents,'paymentDate',i.payment_date,'cancellationId',c.id,'cancellationObservationId',x.id,'checkObservationId',o.id,'recoveredAt',x.created_at) ORDER BY i.employee_id),'[]') INTO NEW.provider_check_evidence
 FROM payroll_check_issue i JOIN payroll_check_cancellation c ON c.issue_id=i.id
 JOIN LATERAL(SELECT id,created_at FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id ORDER BY id DESC LIMIT 1)x ON true
 JOIN LATERAL(SELECT id FROM payroll_check_issue_observation WHERE issue_id=i.id ORDER BY id DESC LIMIT 1)o ON true
 WHERE i.batch_id=NEW.batch_id AND payroll_check_provider_cancelled(i.id);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_retain_provider_check_cancellation ON payroll_payment_batch_cancellation;
CREATE TRIGGER payroll_retain_provider_check_cancellation BEFORE INSERT ON payroll_payment_batch_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_retain_provider_check_cancellation();
CREATE OR REPLACE FUNCTION payroll_guard_cancelled_check_artifact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF payroll_check_cancellation_blocks(NEW.issue_id) THEN RAISE EXCEPTION 'Recover provider cancellation before retaining or delivering this check.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_cancelled_check_artifact ON payroll_check_document;
CREATE TRIGGER payroll_guard_cancelled_check_artifact BEFORE INSERT ON payroll_check_document FOR EACH ROW EXECUTE FUNCTION payroll_guard_cancelled_check_artifact();
DROP TRIGGER IF EXISTS payroll_guard_cancelled_check_artifact ON payroll_check_delivery;
CREATE TRIGGER payroll_guard_cancelled_check_artifact BEFORE INSERT ON payroll_check_delivery FOR EACH ROW EXECUTE FUNCTION payroll_guard_cancelled_check_artifact();

-- A reviewed cancellation retry is claimed durably before provider transport.
CREATE TABLE IF NOT EXISTS payroll_check_cancellation_retry (
 id UUID PRIMARY KEY,cancellation_id UUID NOT NULL REFERENCES payroll_check_cancellation(id),
 prior_submission_id BIGINT NOT NULL UNIQUE REFERENCES payroll_check_cancellation_observation(id),
 source_observation_id BIGINT NOT NULL REFERENCES payroll_check_issue_observation(id),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE payroll_check_cancellation_observation ADD COLUMN IF NOT EXISTS retry_id UUID REFERENCES payroll_check_cancellation_retry(id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_check_cancel_retry_result ON payroll_check_cancellation_observation(retry_id) WHERE retry_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_check_cancel_initial_result ON payroll_check_cancellation_observation(cancellation_id) WHERE source='SUBMISSION' AND retry_id IS NULL;
CREATE OR REPLACE FUNCTION payroll_check_cancel_no_update(target_cancellation UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_cancellation_observation WHERE cancellation_id=target_cancellation AND source='SUBMISSION' AND retry_id IS NULL AND result->>'requestSent'='false')
 AND NOT EXISTS(SELECT 1 FROM payroll_check_cancellation_observation WHERE cancellation_id=target_cancellation AND source='SUBMISSION' AND (result->>'requestSent') IS DISTINCT FROM 'false')
 AND NOT EXISTS(SELECT 1 FROM payroll_check_cancellation_retry r WHERE r.cancellation_id=target_cancellation AND NOT EXISTS(SELECT 1 FROM payroll_check_cancellation_observation o WHERE o.retry_id=r.id AND o.cancellation_id=r.cancellation_id AND o.source='SUBMISSION' AND o.result->>'requestSent'='false'))
$$;
CREATE OR REPLACE FUNCTION payroll_check_cancel_retryable(target_cancellation UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT payroll_check_cancel_no_update(target_cancellation) AND EXISTS(
 SELECT 1 FROM payroll_check_cancellation c JOIN LATERAL(SELECT * FROM payroll_check_issue_observation WHERE issue_id=c.issue_id ORDER BY id DESC LIMIT 1)o ON true
 WHERE c.id=target_cancellation AND payroll_check_cancel_reviewable(c.issue_id)
 AND o.result->>'status' IN ('AWAITING_PROVIDER_APPROVAL','PROVIDER_APPROVED') AND o.result->>'providerId'=c.provider_id::text)
$$;
CREATE OR REPLACE FUNCTION payroll_validate_check_cancellation_retry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT payroll_check_cancel_retryable(NEW.cancellation_id) OR NOT EXISTS(
 SELECT 1 FROM payroll_check_cancellation c WHERE c.id=NEW.cancellation_id
 AND NEW.prior_submission_id=(SELECT max(id) FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id AND source='SUBMISSION')
 AND NEW.source_observation_id=(SELECT max(id) FROM payroll_check_issue_observation WHERE issue_id=c.issue_id)) THEN RAISE EXCEPTION 'Review current evidence proving no cancellation update was sent before retrying.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_check_cancellation_retry ON payroll_check_cancellation_retry;
CREATE TRIGGER payroll_validate_check_cancellation_retry BEFORE INSERT ON payroll_check_cancellation_retry FOR EACH ROW EXECUTE FUNCTION payroll_validate_check_cancellation_retry();
DROP TRIGGER IF EXISTS payroll_guard_payment_evidence ON payroll_check_cancellation_retry;
CREATE TRIGGER payroll_guard_payment_evidence BEFORE UPDATE OR DELETE ON payroll_check_cancellation_retry FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_check_cancel_retry_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.retry_id IS NOT NULL AND (NEW.source<>'SUBMISSION' OR NOT EXISTS(SELECT 1 FROM payroll_check_cancellation_retry WHERE id=NEW.retry_id AND cancellation_id=NEW.cancellation_id)) THEN RAISE EXCEPTION 'Cancellation retry result must belong to its retained submission.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_check_cancel_retry_result ON payroll_check_cancellation_observation;
CREATE TRIGGER payroll_validate_check_cancel_retry_result BEFORE INSERT ON payroll_check_cancellation_observation FOR EACH ROW EXECUTE FUNCTION payroll_validate_check_cancel_retry_result();
CREATE OR REPLACE FUNCTION payroll_check_cancellation_blocks(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_cancellation c WHERE c.issue_id=target_issue AND NOT (
 payroll_check_cancel_no_update(c.id) AND EXISTS(SELECT 1 FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id AND source='SUBMISSION' AND id=(SELECT max(id) FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id AND source='SUBMISSION') AND result->>'status'='NOT_ELIGIBLE')))
$$;

-- Retain a reviewed disposition when an unsuccessfully cancelled check is sent.
CREATE TABLE IF NOT EXISTS payroll_check_cancellation_continuation (
 cancellation_id UUID PRIMARY KEY REFERENCES payroll_check_cancellation(id),
 cancellation_observation_id BIGINT NOT NULL REFERENCES payroll_check_cancellation_observation(id),
 check_observation_id BIGINT NOT NULL REFERENCES payroll_check_issue_observation(id),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_check_cancel_original_current(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_cancellation c
 JOIN LATERAL(SELECT * FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id ORDER BY id DESC LIMIT 1)x ON true
 JOIN LATERAL(SELECT * FROM payroll_check_issue_observation WHERE issue_id=c.issue_id ORDER BY id DESC LIMIT 1)o ON true
 WHERE c.id=target AND x.source='RECOVERY' AND o.source='RECOVERY'
 AND x.created_at BETWEEN now()-interval '15 minutes' AND clock_timestamp() AND o.created_at BETWEEN now()-interval '15 minutes' AND clock_timestamp()
 AND x.result->>'status' IN ('NOT_ELIGIBLE','NEEDS_REVIEW') AND x.result->'payment'->>'status' IN ('SENT','COMPLETED')
 AND o.result->>'status'=x.result->'payment'->>'status'
 AND (o.result->>'status'='COMPLETED' OR (o.result->>'expiresAt')::timestamptz>clock_timestamp())
 AND o.result->>'providerId'=c.provider_id::text AND x.result->'payment'->>'providerId'=c.provider_id::text
 AND o.result->>'dateMatches'='true' AND o.result->>'expiryMatches'='true' AND o.result->>'liveMode'='true'
 AND x.result->'payment'->>'dateMatches'='true' AND x.result->'payment'->>'expiryMatches'='true' AND x.result->'payment'->>'liveMode'='true'
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation h WHERE h.issue_id=c.issue_id AND (h.result->>'status' IN ('CANCELLED','STOPPED','RETURNED','REVERSED','HELD') OR (h.result->>'providerId' IS NOT NULL AND h.result->>'providerId'<>c.provider_id::text)))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_cancellation_observation h WHERE h.cancellation_id=c.id AND (h.result->>'status'='CANCEL_CONFIRMED' OR h.result->'payment'->>'status' IN ('CANCELLED','STOPPED','RETURNED','REVERSED','HELD') OR (h.result->'payment'->>'providerId' IS NOT NULL AND h.result->'payment'->>'providerId'<>c.provider_id::text))))
$$;
CREATE OR REPLACE FUNCTION payroll_check_cancel_continuable(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT payroll_check_cancel_original_current(target) AND EXISTS(
 SELECT 1 FROM payroll_check_cancellation c JOIN payroll_check_issue i ON i.id=c.issue_id JOIN payroll_run r ON r.id=i.payroll_run_id
 JOIN LATERAL(SELECT * FROM payroll_check_issue_observation WHERE issue_id=i.id ORDER BY id DESC LIMIT 1)o ON true
 WHERE c.id=target AND r.status='APPROVED' AND payroll_check_cancellation_blocks(i.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=i.batch_id)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_cancellation_continuation WHERE cancellation_id=c.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_document WHERE issue_id=i.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_delivery WHERE issue_id=i.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop WHERE issue_id=i.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization WHERE issue_id=i.id)
 AND o.result->>'status'='SENT' AND o.result->>'reconciliationStatus'='unreconciled'
 AND (o.result->>'expiresAt')::timestamptz>clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id AND (result->'payment'->>'status'='COMPLETED' OR result->'payment'->>'reconciliationStatus'='reconciled' OR result->'payment'->>'settlementStatus'='BANK_POSTED'))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation WHERE issue_id=i.id AND (result->>'status'='COMPLETED' OR result->>'reconciliationStatus'='reconciled' OR result->>'settlementStatus'='BANK_POSTED')))
$$;
CREATE OR REPLACE FUNCTION payroll_validate_check_cancel_continuation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT payroll_check_cancel_continuable(NEW.cancellation_id) OR NOT EXISTS(SELECT 1 FROM payroll_check_cancellation c WHERE c.id=NEW.cancellation_id
 AND NEW.cancellation_observation_id=(SELECT max(id) FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id)
 AND NEW.check_observation_id=(SELECT max(id) FROM payroll_check_issue_observation WHERE issue_id=c.issue_id)) THEN RAISE EXCEPTION 'Recover and review the matching sent original check before continuing it.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_check_cancel_continuation ON payroll_check_cancellation_continuation;
CREATE TRIGGER payroll_validate_check_cancel_continuation BEFORE INSERT ON payroll_check_cancellation_continuation FOR EACH ROW EXECUTE FUNCTION payroll_validate_check_cancel_continuation();
DROP TRIGGER IF EXISTS payroll_guard_payment_evidence ON payroll_check_cancellation_continuation;
CREATE TRIGGER payroll_guard_payment_evidence BEFORE UPDATE OR DELETE ON payroll_check_cancellation_continuation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_check_cancellation_blocks(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_cancellation c WHERE c.issue_id=target_issue AND NOT (
 (payroll_check_cancel_no_update(c.id) AND EXISTS(SELECT 1 FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id AND source='SUBMISSION' AND id=(SELECT max(id) FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id AND source='SUBMISSION') AND result->>'status'='NOT_ELIGIBLE'))
 OR (EXISTS(SELECT 1 FROM payroll_check_cancellation_continuation WHERE cancellation_id=c.id) AND payroll_check_cancel_original_current(c.id))))
$$;

CREATE TABLE IF NOT EXISTS payroll_check_stop_retry (
 id UUID PRIMARY KEY,sequence BIGSERIAL UNIQUE NOT NULL,stop_id UUID NOT NULL REFERENCES payroll_check_stop(id),
 prior_observation_id BIGINT UNIQUE NOT NULL REFERENCES payroll_check_stop_observation(id),prior_action_id UUID NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE payroll_check_stop_observation ADD COLUMN IF NOT EXISTS retry_id UUID REFERENCES payroll_check_stop_retry(id);
CREATE INDEX IF NOT EXISTS payroll_check_stop_retry_latest ON payroll_check_stop_observation(stop_id,retry_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_check_stop_current_action(target UUID) RETURNS TEXT LANGUAGE sql VOLATILE AS $$
 SELECT result->>'actionId' FROM payroll_check_stop_observation WHERE stop_id=target
 AND retry_id IS NOT DISTINCT FROM (SELECT id FROM payroll_check_stop_retry WHERE stop_id=target ORDER BY sequence DESC LIMIT 1)
 AND result->>'actionId' IS NOT NULL ORDER BY id LIMIT 1
$$;
CREATE OR REPLACE FUNCTION payroll_check_stop_retryable(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_stop s JOIN payroll_check_issue i ON i.id=s.issue_id JOIN payroll_run r ON r.id=i.payroll_run_id
 JOIN LATERAL(SELECT * FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1)o ON true
 WHERE s.id=target AND r.status IN ('APPROVED','FINALIZED') AND o.source='RECOVERY'
 AND o.retry_id IS NOT DISTINCT FROM (SELECT id FROM payroll_check_stop_retry WHERE stop_id=s.id ORDER BY sequence DESC LIMIT 1)
 AND o.result->>'status' IN ('FAILED','CANCELLED') AND o.result->>'checkStatus'='SENT' AND o.result->>'providerId'=s.provider_id::text
 AND o.result->>'actionId'=payroll_check_stop_current_action(s.id) AND o.created_at BETWEEN now()-interval '15 minutes' AND clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation bad WHERE bad.stop_id=s.id AND bad.retry_id IS NOT DISTINCT FROM o.retry_id AND bad.result->>'actionId' IS NOT NULL AND bad.result->>'actionId'<>payroll_check_stop_current_action(s.id))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_release WHERE stop_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization WHERE issue_id=i.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation WHERE stop_id=s.id AND (result->>'status'='STOP_CONFIRMED' OR result->>'checkStatus' IN ('COMPLETED','STOPPED','RETURNED','REVERSED')))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation WHERE issue_id=i.id AND (result->>'status' IN ('COMPLETED','STOPPED','RETURNED','REVERSED','CANCELLED','HELD') OR result->>'reconciliationStatus'='reconciled' OR result->>'settlementStatus'='BANK_POSTED' OR (result->>'providerId' IS NOT NULL AND result->>'providerId'<>s.provider_id::text))))
$$;
CREATE OR REPLACE FUNCTION payroll_validate_check_stop_retry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT payroll_check_stop_retryable(NEW.stop_id) OR NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation WHERE stop_id=NEW.stop_id AND id=NEW.prior_observation_id AND id=(SELECT max(id) FROM payroll_check_stop_observation WHERE stop_id=NEW.stop_id) AND result->>'actionId'=NEW.prior_action_id::text) THEN RAISE EXCEPTION 'Recover and review the current failed stop before another request.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_check_stop_retry ON payroll_check_stop_retry;
CREATE TRIGGER payroll_validate_check_stop_retry BEFORE INSERT ON payroll_check_stop_retry FOR EACH ROW EXECUTE FUNCTION payroll_validate_check_stop_retry();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_check_stop_retry;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_check_stop_retry FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_stop_retry_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.retry_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_retry WHERE id=NEW.retry_id AND stop_id=NEW.stop_id) THEN RAISE EXCEPTION 'Stop observation must match its retained retry.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_stop_retry_observation ON payroll_check_stop_observation;
CREATE TRIGGER payroll_validate_stop_retry_observation BEFORE INSERT ON payroll_check_stop_observation FOR EACH ROW EXECUTE FUNCTION payroll_validate_stop_retry_observation();

-- A no-action recovery is retryable only with explicit, completed no-send submission evidence for this attempt.
ALTER TABLE payroll_check_stop_retry ALTER COLUMN prior_action_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION payroll_check_stop_not_transmitted(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_stop_observation WHERE stop_id=target AND retry_id IS NOT DISTINCT FROM (SELECT id FROM payroll_check_stop_retry WHERE stop_id=target ORDER BY sequence DESC LIMIT 1) AND source='SUBMISSION' AND result->>'requestSent'='false' AND result->>'status' IN ('UNCERTAIN','CHECK_NEEDS_REVIEW','BLOCKED_STOP'))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation WHERE stop_id=target AND retry_id IS NOT DISTINCT FROM (SELECT id FROM payroll_check_stop_retry WHERE stop_id=target ORDER BY sequence DESC LIMIT 1) AND (result->>'actionId' IS NOT NULL OR result->>'status'='NEEDS_REVIEW' OR (source='SUBMISSION' AND ((result->>'requestSent') IS DISTINCT FROM 'false' OR COALESCE(result->>'status','') NOT IN ('UNCERTAIN','CHECK_NEEDS_REVIEW','BLOCKED_STOP')))))
$$;
CREATE OR REPLACE FUNCTION payroll_check_stop_retryable(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_stop s JOIN payroll_check_issue i ON i.id=s.issue_id JOIN payroll_run r ON r.id=i.payroll_run_id
 JOIN LATERAL(SELECT * FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1)o ON true
 WHERE s.id=target AND r.status IN ('APPROVED','FINALIZED') AND o.source='RECOVERY'
 AND o.retry_id IS NOT DISTINCT FROM (SELECT id FROM payroll_check_stop_retry WHERE stop_id=s.id ORDER BY sequence DESC LIMIT 1)
 AND o.result->>'checkStatus'='SENT' AND o.result->>'providerId'=s.provider_id::text AND o.created_at BETWEEN now()-interval '15 minutes' AND clock_timestamp()
 AND ((o.result->>'status' IN ('FAILED','CANCELLED') AND o.result->>'actionId'=payroll_check_stop_current_action(s.id))
 OR (o.result->>'status'='NOT_FOUND' AND o.result->>'checkDateMatches'='true' AND o.result->>'checkExpiryMatches'='true' AND o.result->>'checkLiveMode'='true' AND o.result->>'checkReconciliationStatus'='unreconciled' AND payroll_check_stop_not_transmitted(s.id)))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation bad WHERE bad.stop_id=s.id AND bad.retry_id IS NOT DISTINCT FROM o.retry_id AND bad.result->>'actionId' IS NOT NULL AND bad.result->>'actionId'<>payroll_check_stop_current_action(s.id))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_release WHERE stop_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization WHERE issue_id=i.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation WHERE stop_id=s.id AND (result->>'status'='STOP_CONFIRMED' OR result->>'checkStatus' IN ('COMPLETED','STOPPED','RETURNED','REVERSED') OR result->>'checkReconciliationStatus'='reconciled' OR (result->>'providerId' IS NOT NULL AND result->>'providerId'<>s.provider_id::text)))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation WHERE issue_id=i.id AND (result->>'status' IN ('COMPLETED','STOPPED','RETURNED','REVERSED','CANCELLED','HELD') OR result->>'reconciliationStatus'='reconciled' OR result->>'settlementStatus'='BANK_POSTED' OR (result->>'providerId' IS NOT NULL AND result->>'providerId'<>s.provider_id::text))))
$$;
CREATE OR REPLACE FUNCTION payroll_validate_check_stop_retry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT payroll_check_stop_retryable(NEW.stop_id) OR NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation WHERE stop_id=NEW.stop_id AND id=NEW.prior_observation_id AND id=(SELECT max(id) FROM payroll_check_stop_observation WHERE stop_id=NEW.stop_id) AND (result->>'actionId') IS NOT DISTINCT FROM NEW.prior_action_id::text) THEN RAISE EXCEPTION 'Recover and review the current failed stop before another request.'; END IF;
 RETURN NEW;
END $$;

-- Continue the same available original after affirmative proof that a stop was never sent.
ALTER TABLE payroll_check_stop_release ALTER COLUMN action_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION payroll_check_stop_no_action_original_current(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT payroll_check_stop_not_transmitted(target) AND EXISTS(
 SELECT 1 FROM payroll_check_stop s
 JOIN LATERAL(SELECT * FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1)o ON true
 JOIN LATERAL(SELECT * FROM payroll_check_issue_observation WHERE issue_id=s.issue_id ORDER BY id DESC LIMIT 1)c ON true
 WHERE s.id=target AND o.source='RECOVERY' AND c.source='RECOVERY'
 AND o.retry_id IS NOT DISTINCT FROM (SELECT id FROM payroll_check_stop_retry WHERE stop_id=s.id ORDER BY sequence DESC LIMIT 1)
 AND o.created_at BETWEEN now()-interval '15 minutes' AND clock_timestamp() AND c.created_at BETWEEN now()-interval '15 minutes' AND clock_timestamp()
 AND o.result->>'status'='NOT_FOUND' AND o.result->>'providerId'=s.provider_id::text AND c.result->>'providerId'=s.provider_id::text
 AND o.result->>'checkStatus' IN ('SENT','COMPLETED') AND c.result->>'status'=o.result->>'checkStatus'
 AND o.result->>'checkDateMatches'='true' AND o.result->>'checkExpiryMatches'='true' AND o.result->>'checkLiveMode'='true'
 AND c.result->>'dateMatches'='true' AND c.result->>'expiryMatches'='true' AND c.result->>'liveMode'='true'
 AND (o.result->>'checkStatus'='COMPLETED' OR ((o.result->>'checkExpiresAt')::timestamptz>clock_timestamp() AND (c.result->>'expiresAt')::timestamptz>clock_timestamp() AND o.result->>'checkReconciliationStatus'='unreconciled' AND c.result->>'reconciliationStatus'='unreconciled'))
 AND (o.result->>'checkStatus'='COMPLETED' OR (NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation h WHERE h.stop_id=s.id AND (h.result->>'checkStatus'='COMPLETED' OR h.result->>'checkReconciliationStatus'='reconciled')) AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation h WHERE h.issue_id=s.issue_id AND (h.result->>'status'='COMPLETED' OR h.result->>'reconciliationStatus'='reconciled' OR h.result->>'settlementStatus'='BANK_POSTED'))))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation h WHERE h.stop_id=s.id AND (h.result->>'status'='STOP_CONFIRMED' OR h.result->>'checkStatus' IN ('CANCELLED','STOPPED','RETURNED','REVERSED','HELD') OR (h.result->>'providerId' IS NOT NULL AND h.result->>'providerId'<>s.provider_id::text)))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation h WHERE h.issue_id=s.issue_id AND (h.result->>'status' IN ('CANCELLED','STOPPED','RETURNED','REVERSED','HELD') OR (h.result->>'providerId' IS NOT NULL AND h.result->>'providerId'<>s.provider_id::text))))
$$;
CREATE OR REPLACE FUNCTION payroll_guard_check_stop_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.action_id IS NULL THEN
  IF NOT payroll_check_stop_retryable(NEW.stop_id) OR NOT payroll_check_stop_no_action_original_current(NEW.stop_id) OR NEW.source_observation_id IS DISTINCT FROM (SELECT max(id) FROM payroll_check_stop_observation WHERE stop_id=NEW.stop_id) THEN RAISE EXCEPTION 'Original continuation requires current proof that the stop was not sent.'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation o JOIN payroll_check_stop s ON s.id=o.stop_id WHERE o.id=NEW.source_observation_id AND o.stop_id=NEW.stop_id AND o.id=(SELECT id FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1) AND o.source='RECOVERY' AND o.result->>'status' IN ('FAILED','CANCELLED') AND o.result->>'checkStatus'='SENT' AND o.result->>'actionId'=NEW.action_id::text AND o.result->>'providerId'=s.provider_id::text AND o.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()) THEN RAISE EXCEPTION 'Stop release requires matching recent failed-stop evidence'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_check_stop_blocks(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_stop s WHERE s.issue_id=target_issue AND NOT EXISTS(
  SELECT 1 FROM payroll_check_stop_release r JOIN payroll_check_stop_observation o ON o.stop_id=r.stop_id
  WHERE r.stop_id=s.id AND o.id=(SELECT id FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1)
  AND ((r.action_id IS NULL AND payroll_check_stop_no_action_original_current(s.id)) OR (r.action_id IS NOT NULL AND o.source='RECOVERY' AND o.result->>'status' IN ('FAILED','CANCELLED') AND o.result->>'actionId'=r.action_id::text AND o.result->>'providerId'=s.provider_id::text AND o.result->>'checkStatus' IN ('SENT','COMPLETED')
  AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation later WHERE later.stop_id=s.id AND later.id>r.source_observation_id AND later.result->>'status'='STOP_CONFIRMED')
  AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation bad WHERE bad.issue_id=s.issue_id AND bad.result->>'status' IN ('STOPPED','RETURNED','REVERSED'))
  AND (o.result->>'checkStatus'='COMPLETED' OR NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation paid WHERE paid.issue_id=s.issue_id AND paid.result->>'status'='COMPLETED'))))
 ))
$$;

-- Repeat stop/continuation cycles while retaining every prior disposition.
ALTER TABLE payroll_check_stop_release ADD COLUMN IF NOT EXISTS id BIGSERIAL;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='payroll_check_stop_release'::regclass AND contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY (stop_id)') THEN
  ALTER TABLE payroll_check_stop_release DROP CONSTRAINT payroll_check_stop_release_pkey;
  ALTER TABLE payroll_check_stop_release ADD PRIMARY KEY(id);
 END IF;
END $$;
ALTER TABLE payroll_check_stop_release ADD COLUMN IF NOT EXISTS attempt_key UUID;
ALTER TABLE payroll_check_stop_release DISABLE TRIGGER payroll_guard_payment_connection;
UPDATE payroll_check_stop_release r SET attempt_key=COALESCE(o.retry_id,r.stop_id) FROM payroll_check_stop_observation o WHERE o.id=r.source_observation_id AND r.attempt_key IS NULL;
ALTER TABLE payroll_check_stop_release ENABLE TRIGGER payroll_guard_payment_connection;
ALTER TABLE payroll_check_stop_release ALTER COLUMN attempt_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_check_stop_release_attempt ON payroll_check_stop_release(stop_id,attempt_key);
ALTER TABLE payroll_check_stop_retry ADD COLUMN IF NOT EXISTS prior_release_id BIGINT REFERENCES payroll_check_stop_release(id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_check_stop_retry_release ON payroll_check_stop_retry(prior_release_id) WHERE prior_release_id IS NOT NULL;
CREATE OR REPLACE FUNCTION payroll_check_stop_current_release(target UUID) RETURNS BIGINT LANGUAGE sql VOLATILE AS $$
 SELECT r.id FROM payroll_check_stop_release r WHERE r.stop_id=target AND r.attempt_key=COALESCE((SELECT id FROM payroll_check_stop_retry WHERE stop_id=target ORDER BY sequence DESC LIMIT 1),target)
$$;
CREATE OR REPLACE FUNCTION payroll_check_stop_attempt_ready(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_stop s JOIN payroll_check_issue i ON i.id=s.issue_id JOIN payroll_run r ON r.id=i.payroll_run_id
 JOIN LATERAL(SELECT * FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1)o ON true
 WHERE s.id=target AND r.status IN ('APPROVED','FINALIZED') AND o.source='RECOVERY'
 AND o.retry_id IS NOT DISTINCT FROM (SELECT id FROM payroll_check_stop_retry WHERE stop_id=s.id ORDER BY sequence DESC LIMIT 1)
 AND o.result->>'checkStatus'='SENT' AND o.result->>'providerId'=s.provider_id::text AND o.created_at BETWEEN now()-interval '15 minutes' AND clock_timestamp()
 AND ((o.result->>'status' IN ('FAILED','CANCELLED') AND o.result->>'actionId'=payroll_check_stop_current_action(s.id))
 OR (o.result->>'status'='NOT_FOUND' AND o.result->>'checkDateMatches'='true' AND o.result->>'checkExpiryMatches'='true' AND o.result->>'checkLiveMode'='true' AND o.result->>'checkReconciliationStatus'='unreconciled' AND payroll_check_stop_not_transmitted(s.id)))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation bad WHERE bad.stop_id=s.id AND bad.retry_id IS NOT DISTINCT FROM o.retry_id AND bad.result->>'actionId' IS NOT NULL AND bad.result->>'actionId'<>payroll_check_stop_current_action(s.id))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization WHERE issue_id=i.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation WHERE stop_id=s.id AND (result->>'status'='STOP_CONFIRMED' OR result->>'checkStatus' IN ('COMPLETED','STOPPED','RETURNED','REVERSED') OR result->>'checkReconciliationStatus'='reconciled' OR (result->>'providerId' IS NOT NULL AND result->>'providerId'<>s.provider_id::text)))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation WHERE issue_id=i.id AND (result->>'status' IN ('COMPLETED','STOPPED','RETURNED','REVERSED','CANCELLED','HELD') OR result->>'reconciliationStatus'='reconciled' OR result->>'settlementStatus'='BANK_POSTED' OR (result->>'providerId' IS NOT NULL AND result->>'providerId'<>s.provider_id::text))))
$$;
CREATE OR REPLACE FUNCTION payroll_check_stop_retryable(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT payroll_check_stop_attempt_ready(target) AND payroll_check_stop_current_release(target) IS NULL
$$;
CREATE OR REPLACE FUNCTION payroll_check_stop_renewable(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT payroll_check_stop_attempt_ready(target) AND payroll_check_stop_current_release(target) IS NOT NULL AND NOT payroll_check_stop_blocks((SELECT issue_id FROM payroll_check_stop WHERE id=target))
$$;
CREATE OR REPLACE FUNCTION payroll_validate_check_stop_retry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.prior_release_id IS NULL AND NOT payroll_check_stop_retryable(NEW.stop_id)) OR (NEW.prior_release_id IS NOT NULL AND (NOT payroll_check_stop_renewable(NEW.stop_id) OR NEW.prior_release_id IS DISTINCT FROM payroll_check_stop_current_release(NEW.stop_id))) OR NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation WHERE stop_id=NEW.stop_id AND id=NEW.prior_observation_id AND id=(SELECT max(id) FROM payroll_check_stop_observation WHERE stop_id=NEW.stop_id) AND (result->>'actionId') IS NOT DISTINCT FROM NEW.prior_action_id::text) THEN RAISE EXCEPTION 'Recover and review the current stop and original-check disposition before another request.'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_check_stop_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation WHERE id=NEW.source_observation_id AND stop_id=NEW.stop_id AND retry_id IS NOT DISTINCT FROM (SELECT id FROM payroll_check_stop_retry WHERE stop_id=NEW.stop_id ORDER BY sequence DESC LIMIT 1) AND (result->>'actionId') IS NOT DISTINCT FROM payroll_check_stop_current_action(NEW.stop_id)) THEN RAISE EXCEPTION 'Continuation must belong to the current stop attempt and action.'; END IF;
 IF payroll_check_stop_current_release(NEW.stop_id) IS NOT NULL THEN RAISE EXCEPTION 'This stop attempt already has an original-check continuation.'; END IF;
 NEW.attempt_key:=COALESCE((SELECT retry_id FROM payroll_check_stop_observation WHERE id=NEW.source_observation_id AND stop_id=NEW.stop_id),NEW.stop_id);
 IF NEW.action_id IS NULL THEN
  IF NOT payroll_check_stop_retryable(NEW.stop_id) OR NOT payroll_check_stop_no_action_original_current(NEW.stop_id) OR NEW.source_observation_id IS DISTINCT FROM (SELECT max(id) FROM payroll_check_stop_observation WHERE stop_id=NEW.stop_id) THEN RAISE EXCEPTION 'Original continuation requires current proof that the stop was not sent.'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation o JOIN payroll_check_stop s ON s.id=o.stop_id WHERE o.id=NEW.source_observation_id AND o.stop_id=NEW.stop_id AND o.id=(SELECT id FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1) AND o.source='RECOVERY' AND o.result->>'status' IN ('FAILED','CANCELLED') AND o.result->>'checkStatus'='SENT' AND o.result->>'actionId'=NEW.action_id::text AND o.result->>'providerId'=s.provider_id::text AND o.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()) THEN RAISE EXCEPTION 'Stop release requires matching recent failed-stop evidence'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_check_stop_blocks(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_stop s WHERE s.issue_id=target_issue AND NOT EXISTS(
  SELECT 1 FROM payroll_check_stop_release r JOIN payroll_check_stop_observation o ON o.stop_id=r.stop_id
  WHERE r.stop_id=s.id AND r.id=payroll_check_stop_current_release(s.id) AND o.id=(SELECT id FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1)
  AND ((r.action_id IS NULL AND payroll_check_stop_no_action_original_current(s.id)) OR (r.action_id IS NOT NULL AND o.source='RECOVERY' AND o.result->>'status' IN ('FAILED','CANCELLED') AND o.result->>'actionId'=r.action_id::text AND o.result->>'providerId'=s.provider_id::text AND o.result->>'checkStatus' IN ('SENT','COMPLETED')
  AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation later WHERE later.stop_id=s.id AND later.id>r.source_observation_id AND later.result->>'status'='STOP_CONFIRMED')
  AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation bad WHERE bad.issue_id=s.issue_id AND bad.result->>'status' IN ('STOPPED','RETURNED','REVERSED'))
  AND (o.result->>'checkStatus'='COMPLETED' OR NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation paid WHERE paid.issue_id=s.issue_id AND paid.result->>'status'='COMPLETED'))))
 ))
$$;

-- Earlier payment facts remain authoritative for first stops and every continuation.
CREATE OR REPLACE FUNCTION payroll_check_original_history_consistent(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_issue i JOIN LATERAL(SELECT result->>'providerId' AS provider_id FROM payroll_check_issue_observation WHERE issue_id=i.id AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1)p ON true WHERE i.id=target
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation h WHERE h.issue_id=i.id AND (h.result->>'status' IN ('CANCELLED','STOPPED','RETURNED','REVERSED','HELD') OR h.result->>'finalCheckStatus' IN ('CANCELLED','STOPPED','RETURNED','REVERSED','HELD') OR (h.result->>'providerId' IS NOT NULL AND h.result->>'providerId'<>p.provider_id) OR (h.result->>'finalProviderId' IS NOT NULL AND h.result->>'finalProviderId'<>p.provider_id)))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation h JOIN payroll_check_stop s ON s.id=h.stop_id WHERE s.issue_id=i.id AND (h.result->>'checkConflictObserved'='true' OR h.result->>'status'='STOP_CONFIRMED' OR h.result->>'checkStatus' IN ('CANCELLED','STOPPED','RETURNED','REVERSED','HELD') OR (h.result->>'providerId' IS NOT NULL AND h.result->>'providerId'<>p.provider_id)))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_cancellation_observation h JOIN payroll_check_cancellation c ON c.id=h.cancellation_id WHERE c.issue_id=i.id AND (h.result->>'status'='CANCEL_CONFIRMED' OR h.result->'payment'->>'status' IN ('CANCELLED','STOPPED','RETURNED','REVERSED','HELD') OR (h.result->'payment'->>'providerId' IS NOT NULL AND h.result->'payment'->>'providerId'<>p.provider_id))))
$$;
CREATE OR REPLACE FUNCTION payroll_check_original_unpaid_history(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT payroll_check_original_history_consistent(target)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation WHERE issue_id=target AND (result->>'status'='COMPLETED' OR result->>'reconciliationStatus'='reconciled' OR result->>'settlementStatus'='BANK_POSTED'))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation h JOIN payroll_check_stop s ON s.id=h.stop_id WHERE s.issue_id=target AND (h.result->>'checkPaidObserved'='true' OR h.result->>'checkStatus'='COMPLETED' OR h.result->>'checkReconciliationStatus'='reconciled'))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_cancellation_observation h JOIN payroll_check_cancellation c ON c.id=h.cancellation_id WHERE c.issue_id=target AND (h.result->'payment'->>'status'='COMPLETED' OR h.result->'payment'->>'reconciliationStatus'='reconciled' OR h.result->'payment'->>'settlementStatus'='BANK_POSTED'))
$$;
CREATE OR REPLACE FUNCTION payroll_check_stop_initial_ready(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT payroll_check_original_unpaid_history(target) AND EXISTS(SELECT 1 FROM payroll_check_issue i JOIN payroll_run r ON r.id=i.payroll_run_id
 JOIN LATERAL(SELECT * FROM payroll_check_issue_observation WHERE issue_id=i.id ORDER BY id DESC LIMIT 1)o ON true
 WHERE i.id=target AND r.status IN ('APPROVED','FINALIZED') AND o.source='RECOVERY' AND o.created_at BETWEEN now()-interval '15 minutes' AND clock_timestamp()
 AND o.result->>'status'='SENT' AND o.result->>'reconciliationStatus'='unreconciled' AND o.result->>'dateMatches'='true' AND o.result->>'expiryMatches'='true' AND o.result->>'liveMode'='true'
 AND NOT EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=i.batch_id) AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization WHERE issue_id=i.id))
$$;
CREATE OR REPLACE FUNCTION payroll_guard_check_stop() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT payroll_check_stop_initial_ready(NEW.issue_id) OR NEW.provider_id::text IS DISTINCT FROM (SELECT result->>'providerId' FROM payroll_check_issue_observation WHERE issue_id=NEW.issue_id AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1) THEN RAISE EXCEPTION 'Stop request requires the current unpaid original without conflicting history.'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_check_stop_original_current(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(
 SELECT 1 FROM payroll_check_stop s
 JOIN LATERAL(SELECT * FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1)o ON true
 JOIN LATERAL(SELECT * FROM payroll_check_issue_observation WHERE issue_id=s.issue_id ORDER BY id DESC LIMIT 1)c ON true
 WHERE s.id=target AND payroll_check_original_history_consistent(s.issue_id) AND o.source='RECOVERY' AND c.source='RECOVERY'
 AND o.retry_id IS NOT DISTINCT FROM (SELECT id FROM payroll_check_stop_retry WHERE stop_id=s.id ORDER BY sequence DESC LIMIT 1)
 AND o.created_at BETWEEN now()-interval '15 minutes' AND clock_timestamp() AND c.created_at BETWEEN now()-interval '15 minutes' AND clock_timestamp()
 AND ((o.result->>'status'='NOT_FOUND' AND payroll_check_stop_not_transmitted(target)) OR (o.result->>'status' IN ('FAILED','CANCELLED') AND o.result->>'actionId'=payroll_check_stop_current_action(target))) AND o.result->>'providerId'=s.provider_id::text AND c.result->>'providerId'=s.provider_id::text
 AND o.result->>'checkStatus' IN ('SENT','COMPLETED') AND c.result->>'status'=o.result->>'checkStatus'
 AND o.result->>'checkDateMatches'='true' AND o.result->>'checkExpiryMatches'='true' AND o.result->>'checkLiveMode'='true'
 AND c.result->>'dateMatches'='true' AND c.result->>'expiryMatches'='true' AND c.result->>'liveMode'='true'
 AND (o.result->>'checkStatus'='COMPLETED' OR ((o.result->>'checkExpiresAt')::timestamptz>clock_timestamp() AND (c.result->>'expiresAt')::timestamptz>clock_timestamp() AND o.result->>'checkReconciliationStatus'='unreconciled' AND c.result->>'reconciliationStatus'='unreconciled'))
 AND (o.result->>'checkStatus'='COMPLETED' OR (NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation h WHERE h.stop_id=s.id AND (h.result->>'checkPaidObserved'='true' OR h.result->>'checkStatus'='COMPLETED' OR h.result->>'checkReconciliationStatus'='reconciled')) AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation h WHERE h.issue_id=s.issue_id AND (h.result->>'status'='COMPLETED' OR h.result->>'reconciliationStatus'='reconciled' OR h.result->>'settlementStatus'='BANK_POSTED'))))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation h WHERE h.stop_id=s.id AND (h.result->>'checkConflictObserved'='true' OR h.result->>'status'='STOP_CONFIRMED' OR h.result->>'checkStatus' IN ('CANCELLED','STOPPED','RETURNED','REVERSED','HELD') OR (h.result->>'providerId' IS NOT NULL AND h.result->>'providerId'<>s.provider_id::text)))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation h WHERE h.issue_id=s.issue_id AND (h.result->>'status' IN ('CANCELLED','STOPPED','RETURNED','REVERSED','HELD') OR (h.result->>'providerId' IS NOT NULL AND h.result->>'providerId'<>s.provider_id::text))))
$$;
CREATE OR REPLACE FUNCTION payroll_check_stop_attempt_ready(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_stop s JOIN payroll_check_issue i ON i.id=s.issue_id JOIN payroll_run r ON r.id=i.payroll_run_id
 JOIN LATERAL(SELECT * FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1)o ON true
 WHERE s.id=target AND payroll_check_original_unpaid_history(i.id) AND r.status IN ('APPROVED','FINALIZED') AND o.source='RECOVERY'
 AND o.retry_id IS NOT DISTINCT FROM (SELECT id FROM payroll_check_stop_retry WHERE stop_id=s.id ORDER BY sequence DESC LIMIT 1)
 AND o.result->>'checkStatus'='SENT' AND o.result->>'providerId'=s.provider_id::text AND o.created_at BETWEEN now()-interval '15 minutes' AND clock_timestamp()
 AND ((o.result->>'status' IN ('FAILED','CANCELLED') AND o.result->>'actionId'=payroll_check_stop_current_action(s.id))
 OR (o.result->>'status'='NOT_FOUND' AND o.result->>'checkDateMatches'='true' AND o.result->>'checkExpiryMatches'='true' AND o.result->>'checkLiveMode'='true' AND o.result->>'checkReconciliationStatus'='unreconciled' AND payroll_check_stop_not_transmitted(s.id)))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation bad WHERE bad.stop_id=s.id AND bad.retry_id IS NOT DISTINCT FROM o.retry_id AND bad.result->>'actionId' IS NOT NULL AND bad.result->>'actionId'<>payroll_check_stop_current_action(s.id))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization WHERE issue_id=i.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation WHERE stop_id=s.id AND (result->>'status'='STOP_CONFIRMED' OR result->>'checkStatus' IN ('COMPLETED','STOPPED','RETURNED','REVERSED') OR result->>'checkReconciliationStatus'='reconciled' OR (result->>'providerId' IS NOT NULL AND result->>'providerId'<>s.provider_id::text)))
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation WHERE issue_id=i.id AND (result->>'status' IN ('COMPLETED','STOPPED','RETURNED','REVERSED','CANCELLED','HELD') OR result->>'reconciliationStatus'='reconciled' OR result->>'settlementStatus'='BANK_POSTED' OR (result->>'providerId' IS NOT NULL AND result->>'providerId'<>s.provider_id::text))))
$$;
CREATE OR REPLACE FUNCTION payroll_check_stop_continuable(target UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT payroll_check_stop_attempt_ready(target) AND payroll_check_stop_original_current(target) AND payroll_check_stop_current_release(target) IS NULL
$$;
CREATE OR REPLACE FUNCTION payroll_guard_check_stop_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT payroll_check_stop_continuable(NEW.stop_id) THEN RAISE EXCEPTION 'Recover current unpaid original-check evidence before continuing this check.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation WHERE id=NEW.source_observation_id AND stop_id=NEW.stop_id AND retry_id IS NOT DISTINCT FROM (SELECT id FROM payroll_check_stop_retry WHERE stop_id=NEW.stop_id ORDER BY sequence DESC LIMIT 1) AND (result->>'actionId') IS NOT DISTINCT FROM payroll_check_stop_current_action(NEW.stop_id)) THEN RAISE EXCEPTION 'Continuation must belong to the current stop attempt and action.'; END IF;
 IF payroll_check_stop_current_release(NEW.stop_id) IS NOT NULL THEN RAISE EXCEPTION 'This stop attempt already has an original-check continuation.'; END IF;
 NEW.attempt_key:=COALESCE((SELECT retry_id FROM payroll_check_stop_observation WHERE id=NEW.source_observation_id AND stop_id=NEW.stop_id),NEW.stop_id);
 IF NEW.action_id IS NULL THEN
  IF NOT payroll_check_stop_retryable(NEW.stop_id) OR NOT payroll_check_stop_no_action_original_current(NEW.stop_id) OR NEW.source_observation_id IS DISTINCT FROM (SELECT max(id) FROM payroll_check_stop_observation WHERE stop_id=NEW.stop_id) THEN RAISE EXCEPTION 'Original continuation requires current proof that the stop was not sent.'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM payroll_check_stop_observation o JOIN payroll_check_stop s ON s.id=o.stop_id WHERE o.id=NEW.source_observation_id AND o.stop_id=NEW.stop_id AND o.id=(SELECT id FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1) AND o.source='RECOVERY' AND o.result->>'status' IN ('FAILED','CANCELLED') AND o.result->>'checkStatus'='SENT' AND o.result->>'actionId'=NEW.action_id::text AND o.result->>'providerId'=s.provider_id::text AND o.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()) THEN RAISE EXCEPTION 'Stop release requires matching recent failed-stop evidence'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_check_stop_blocks(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_stop s WHERE s.issue_id=target_issue AND NOT EXISTS(SELECT 1 FROM payroll_check_stop_release r WHERE r.id=payroll_check_stop_current_release(s.id) AND r.action_id::text IS NOT DISTINCT FROM payroll_check_stop_current_action(s.id) AND payroll_check_stop_original_current(s.id)))
$$;

-- Federal tax remittance review is a retained plan, never evidence of payment.
CREATE TABLE IF NOT EXISTS payroll_federal_remittance_review (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES payroll_settings(facility_id),
 agency TEXT NOT NULL CHECK(agency IN ('IRS_941','IRS_FUTA')),tax_year INTEGER NOT NULL CHECK(tax_year BETWEEN 2000 AND 2200),tax_quarter INTEGER NOT NULL CHECK(tax_quarter BETWEEN 1 AND 4),
 obligation_key TEXT NOT NULL,settlement_date DATE NOT NULL,amount_cents BIGINT NOT NULL CHECK(amount_cents BETWEEN 1 AND 9999999999),
 identity_id BIGINT NOT NULL REFERENCES payroll_filing_identity(id),source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),source_snapshot JSONB NOT NULL,encrypted_instruction BYTEA NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,source_fingerprint)
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_federal_remittance_review;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_federal_remittance_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_federal_remittance_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_filing_identity WHERE id=NEW.identity_id AND facility_id=NEW.facility_id AND subject_key='EMPLOYER') OR NEW.source_snapshot->>'agency' IS DISTINCT FROM NEW.agency OR NEW.source_snapshot->>'identityRevision' IS DISTINCT FROM NEW.identity_id::text OR NEW.source_snapshot->>'amountCents' IS DISTINCT FROM NEW.amount_cents::text OR NEW.source_snapshot->>'year' IS DISTINCT FROM NEW.tax_year::text OR NEW.source_snapshot->>'quarter' IS DISTINCT FROM NEW.tax_quarter::text OR NEW.source_snapshot->>'key' IS DISTINCT FROM NEW.obligation_key OR NEW.source_snapshot->>'settlementDate' IS DISTINCT FROM NEW.settlement_date::text THEN RAISE EXCEPTION 'Federal remittance review must match its employer identity and retained source.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_federal_remittance_review ON payroll_federal_remittance_review;
CREATE TRIGGER payroll_validate_federal_remittance_review BEFORE INSERT ON payroll_federal_remittance_review FOR EACH ROW EXECUTE FUNCTION payroll_validate_federal_remittance_review();

-- Retained carrier-invoice reviews are not payment or accounting confirmations.
CREATE TABLE IF NOT EXISTS payroll_benefit_carrier_invoice (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES payroll_settings(facility_id),
 coverage_month TEXT NOT NULL CHECK(coverage_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 carrier_key TEXT NOT NULL,invoice_key TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),
 invoice JSONB NOT NULL,source_snapshot JSONB NOT NULL,
 source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),payload_fingerprint TEXT NOT NULL CHECK(payload_fingerprint ~ '^[a-f0-9]{64}$'),
 created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,carrier_key,invoice_key,revision),
 CHECK(invoice->>'month'=coverage_month),CHECK(source_snapshot->>'month'=coverage_month),
 CHECK(source_snapshot->>'fingerprint'=source_fingerprint),CHECK(lower(invoice->>'carrier')=carrier_key),CHECK(lower(invoice->>'invoiceNumber')=invoice_key)
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_benefit_carrier_invoice;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_benefit_carrier_invoice FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_benefit_carrier_document (
 id UUID PRIMARY KEY,invoice_id UUID NOT NULL REFERENCES payroll_benefit_carrier_invoice(id),
 filename TEXT NOT NULL,mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','image/png','image/jpeg')),
 content_hash TEXT NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),encrypted_content BYTEA NOT NULL,
 created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(invoice_id,content_hash)
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_benefit_carrier_document;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_benefit_carrier_document FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_carrier_premium_authorization (
 id UUID PRIMARY KEY,invoice_id UUID NOT NULL REFERENCES payroll_benefit_carrier_invoice(id),request_key TEXT NOT NULL CHECK(request_key ~ '^[-a-zA-Z0-9]{16,80}$'),UNIQUE(invoice_id,request_key),
 preview JSONB NOT NULL,fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_carrier_premium_cancellation (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_carrier_premium_authorization(id),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_premium_authorization;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_premium_authorization FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_premium_cancellation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_premium_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_carrier_invoice_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_carrier_premium_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE i.facility_id=NEW.facility_id AND i.carrier_key=NEW.carrier_key AND i.invoice_key=NEW.invoice_key AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation c WHERE c.authorization_id=a.id)) THEN RAISE EXCEPTION 'Cancel the active premium authorization before revising this invoice.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_invoice_revision ON payroll_benefit_carrier_invoice;
CREATE TRIGGER payroll_guard_carrier_invoice_revision BEFORE INSERT ON payroll_benefit_carrier_invoice FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_invoice_revision();
CREATE OR REPLACE FUNCTION payroll_guard_carrier_premium_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i payroll_benefit_carrier_invoice;
BEGIN
 SELECT * INTO i FROM payroll_benefit_carrier_invoice WHERE id=NEW.invoice_id;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=i.facility_id FOR UPDATE;
 IF NEW.invoice_id IS DISTINCT FROM (SELECT id FROM payroll_benefit_carrier_invoice WHERE facility_id=i.facility_id AND carrier_key=i.carrier_key AND invoice_key=i.invoice_key ORDER BY revision DESC LIMIT 1) OR EXISTS(SELECT 1 FROM payroll_carrier_premium_authorization a JOIN payroll_benefit_carrier_invoice v ON v.id=a.invoice_id WHERE v.facility_id=i.facility_id AND v.carrier_key=i.carrier_key AND v.invoice_key=i.invoice_key AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation c WHERE c.authorization_id=a.id)) THEN RAISE EXCEPTION 'Premium authorization requires the latest invoice without another active authorization.'; END IF;
 IF NEW.preview->>'fingerprint' IS DISTINCT FROM NEW.fingerprint THEN RAISE EXCEPTION 'Premium authorization must retain its reviewed fingerprint.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_premium_authorization ON payroll_carrier_premium_authorization;
CREATE TRIGGER payroll_guard_carrier_premium_authorization BEFORE INSERT ON payroll_carrier_premium_authorization FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_premium_authorization();

CREATE TABLE IF NOT EXISTS payroll_carrier_premium_claim (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_carrier_premium_authorization(id),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_carrier_premium_observation (
 id BIGSERIAL PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_carrier_premium_claim(authorization_id),
 result JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_premium_claim;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_premium_claim FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_premium_observation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_premium_observation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_carrier_premium_claim_cancel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM s.facility_id FROM payroll_settings s JOIN payroll_benefit_carrier_invoice i ON i.facility_id=s.facility_id JOIN payroll_carrier_premium_authorization a ON a.invoice_id=i.id WHERE a.id=NEW.authorization_id FOR UPDATE OF s;
 IF TG_TABLE_NAME='payroll_carrier_premium_claim' AND EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled premium authorization cannot be dispatched.'; END IF;
 IF TG_TABLE_NAME='payroll_carrier_premium_cancellation' AND EXISTS(SELECT 1 FROM payroll_carrier_premium_claim WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'A dispatched premium requires recovery and cannot be cancelled.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_premium_claim_cancel ON payroll_carrier_premium_claim;
CREATE TRIGGER payroll_guard_carrier_premium_claim_cancel BEFORE INSERT ON payroll_carrier_premium_claim FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_premium_claim_cancel();
DROP TRIGGER IF EXISTS payroll_guard_carrier_premium_claim_cancel ON payroll_carrier_premium_cancellation;
CREATE TRIGGER payroll_guard_carrier_premium_claim_cancel BEFORE INSERT ON payroll_carrier_premium_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_premium_claim_cancel();

-- Retained proof is written only by a completed first dispatcher that made no create request.
CREATE TABLE IF NOT EXISTS payroll_carrier_premium_no_send (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_carrier_premium_claim(authorization_id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_premium_no_send;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_premium_no_send FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_carrier_premium_can_cancel_claim(target UUID) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_carrier_premium_no_send WHERE authorization_id=target)
 AND COALESCE((SELECT result->>'status'='NOT_FOUND' FROM payroll_carrier_premium_observation WHERE authorization_id=target ORDER BY id DESC LIMIT 1),false)
 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_observation WHERE authorization_id=target AND result->>'status' IN ('SYNCED','NEEDS_REVIEW'))
$$;
CREATE OR REPLACE FUNCTION payroll_guard_carrier_premium_claim_cancel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM s.facility_id FROM payroll_settings s JOIN payroll_benefit_carrier_invoice i ON i.facility_id=s.facility_id JOIN payroll_carrier_premium_authorization a ON a.invoice_id=i.id WHERE a.id=NEW.authorization_id FOR UPDATE OF s;
 IF TG_TABLE_NAME='payroll_carrier_premium_claim' AND EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled premium authorization cannot be dispatched.'; END IF;
 IF TG_TABLE_NAME='payroll_carrier_premium_cancellation' AND EXISTS(SELECT 1 FROM payroll_carrier_premium_claim WHERE authorization_id=NEW.authorization_id) AND NOT payroll_carrier_premium_can_cancel_claim(NEW.authorization_id) THEN RAISE EXCEPTION 'A dispatched premium requires recovery and cannot be cancelled.'; END IF;
 RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS payroll_carrier_reversal_authorization (
 id UUID PRIMARY KEY,premium_authorization_id UUID NOT NULL REFERENCES payroll_carrier_premium_authorization(id),
 request_key TEXT NOT NULL CHECK(request_key ~ '^[-a-zA-Z0-9]{16,80}$'),UNIQUE(premium_authorization_id,request_key),
 preview JSONB NOT NULL,fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK(preview->>'authorizationId'=premium_authorization_id::text),CHECK(preview->>'fingerprint'=fingerprint)
);
ALTER TABLE payroll_carrier_reversal_authorization DROP CONSTRAINT IF EXISTS payroll_carrier_reversal_preview_binding;
ALTER TABLE payroll_carrier_reversal_authorization ADD CONSTRAINT payroll_carrier_reversal_preview_binding CHECK((preview->>'authorizationId') IS NOT DISTINCT FROM premium_authorization_id::text AND (preview->>'fingerprint') IS NOT DISTINCT FROM fingerprint);
CREATE TABLE IF NOT EXISTS payroll_carrier_reversal_cancellation (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_carrier_reversal_authorization(id),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_reversal_authorization;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_reversal_authorization FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_reversal_cancellation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_reversal_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_carrier_reversal_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM s.facility_id FROM payroll_settings s JOIN payroll_benefit_carrier_invoice i ON i.facility_id=s.facility_id JOIN payroll_carrier_premium_authorization a ON a.invoice_id=i.id WHERE a.id=NEW.premium_authorization_id FOR UPDATE OF s;
 IF EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation WHERE authorization_id=NEW.premium_authorization_id)
 OR (SELECT result->>'status' FROM payroll_carrier_premium_observation WHERE authorization_id=NEW.premium_authorization_id ORDER BY id DESC LIMIT 1) IS DISTINCT FROM 'SYNCED'
 OR EXISTS(SELECT 1 FROM payroll_carrier_reversal_authorization r WHERE r.premium_authorization_id=NEW.premium_authorization_id AND NOT EXISTS(SELECT 1 FROM payroll_carrier_reversal_cancellation c WHERE c.authorization_id=r.id)) THEN RAISE EXCEPTION 'Reversal authorization requires a confirmed original journal without another active reversal.'; END IF;
 IF NEW.preview->>'originalFingerprint' IS DISTINCT FROM (SELECT fingerprint FROM payroll_carrier_premium_authorization WHERE id=NEW.premium_authorization_id)
 OR NEW.preview->>'originalJournalId' IS DISTINCT FROM (SELECT result->>'journalId' FROM payroll_carrier_premium_observation WHERE authorization_id=NEW.premium_authorization_id ORDER BY id DESC LIMIT 1) THEN RAISE EXCEPTION 'Reversal authorization must bind the retained original journal evidence.'; END IF;

 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_reversal_authorization ON payroll_carrier_reversal_authorization;
CREATE TRIGGER payroll_guard_carrier_reversal_authorization BEFORE INSERT ON payroll_carrier_reversal_authorization FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_reversal_authorization();

CREATE TABLE IF NOT EXISTS payroll_carrier_reversal_claim (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_carrier_reversal_authorization(id),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_carrier_reversal_observation (
 id BIGSERIAL PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_carrier_reversal_claim(authorization_id),result JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_reversal_claim;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_reversal_claim FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_reversal_observation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_reversal_observation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_carrier_reversal_claim_cancel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM s.facility_id FROM payroll_settings s JOIN payroll_benefit_carrier_invoice i ON i.facility_id=s.facility_id JOIN payroll_carrier_premium_authorization a ON a.invoice_id=i.id JOIN payroll_carrier_reversal_authorization r ON r.premium_authorization_id=a.id WHERE r.id=NEW.authorization_id FOR UPDATE OF s;
 IF TG_TABLE_NAME='payroll_carrier_reversal_claim' AND EXISTS(SELECT 1 FROM payroll_carrier_reversal_cancellation WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled reversal cannot be dispatched.'; END IF;
 IF TG_TABLE_NAME='payroll_carrier_reversal_cancellation' AND EXISTS(SELECT 1 FROM payroll_carrier_reversal_claim WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'A claimed reversal requires recovery and cannot be cancelled.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_reversal_claim_cancel ON payroll_carrier_reversal_claim;
CREATE TRIGGER payroll_guard_carrier_reversal_claim_cancel BEFORE INSERT ON payroll_carrier_reversal_claim FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_reversal_claim_cancel();
DROP TRIGGER IF EXISTS payroll_guard_carrier_reversal_claim_cancel ON payroll_carrier_reversal_cancellation;
CREATE TRIGGER payroll_guard_carrier_reversal_claim_cancel BEFORE INSERT ON payroll_carrier_reversal_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_reversal_claim_cancel();

CREATE TABLE IF NOT EXISTS payroll_carrier_premium_correction (
 premium_authorization_id UUID PRIMARY KEY REFERENCES payroll_carrier_premium_authorization(id),
 reversal_authorization_id UUID NOT NULL UNIQUE REFERENCES payroll_carrier_reversal_authorization(id),evidence JSONB NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_premium_correction;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_premium_correction FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_carrier_premium_correction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original_result JSONB; reversal_result JSONB;
BEGIN
 PERFORM s.facility_id FROM payroll_settings s JOIN payroll_benefit_carrier_invoice i ON i.facility_id=s.facility_id JOIN payroll_carrier_premium_authorization a ON a.invoice_id=i.id WHERE a.id=NEW.premium_authorization_id FOR UPDATE OF s;
 SELECT result INTO original_result FROM payroll_carrier_premium_observation WHERE authorization_id=NEW.premium_authorization_id ORDER BY id DESC LIMIT 1;
 SELECT result INTO reversal_result FROM payroll_carrier_reversal_observation WHERE authorization_id=NEW.reversal_authorization_id ORDER BY id DESC LIMIT 1;
 IF (SELECT premium_authorization_id FROM payroll_carrier_reversal_authorization WHERE id=NEW.reversal_authorization_id) IS DISTINCT FROM NEW.premium_authorization_id
 OR original_result->>'status' IS DISTINCT FROM 'SYNCED' OR reversal_result->>'status' IS DISTINCT FROM 'SYNCED'
 OR NEW.evidence->>'originalJournalId' IS DISTINCT FROM original_result->>'journalId' OR NEW.evidence->>'reversalJournalId' IS DISTINCT FROM reversal_result->>'journalId'
 OR NEW.evidence->>'premiumFingerprint' IS DISTINCT FROM (SELECT fingerprint FROM payroll_carrier_premium_authorization WHERE id=NEW.premium_authorization_id)
 OR NEW.evidence->>'reversalFingerprint' IS DISTINCT FROM (SELECT fingerprint FROM payroll_carrier_reversal_authorization WHERE id=NEW.reversal_authorization_id)
 OR NEW.evidence->>'realmId' IS DISTINCT FROM (SELECT preview->>'realmId' FROM payroll_carrier_premium_authorization WHERE id=NEW.premium_authorization_id)
 OR NEW.evidence->>'environment' IS DISTINCT FROM (SELECT preview->>'environment' FROM payroll_carrier_premium_authorization WHERE id=NEW.premium_authorization_id)
 OR EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation WHERE authorization_id=NEW.premium_authorization_id)
 OR EXISTS(SELECT 1 FROM payroll_carrier_reversal_cancellation WHERE authorization_id=NEW.reversal_authorization_id) THEN RAISE EXCEPTION 'Correction requires confirmed matching original and reversal evidence.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_premium_correction ON payroll_carrier_premium_correction;
CREATE TRIGGER payroll_guard_carrier_premium_correction BEFORE INSERT ON payroll_carrier_premium_correction FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_premium_correction();

CREATE OR REPLACE FUNCTION payroll_guard_carrier_invoice_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_carrier_premium_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE i.facility_id=NEW.facility_id AND i.carrier_key=NEW.carrier_key AND i.invoice_key=NEW.invoice_key AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation c WHERE c.authorization_id=a.id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_correction x WHERE x.premium_authorization_id=a.id)) THEN RAISE EXCEPTION 'Cancel the active premium authorization before revising this invoice.'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION payroll_guard_carrier_premium_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i payroll_benefit_carrier_invoice;
BEGIN
 SELECT * INTO i FROM payroll_benefit_carrier_invoice WHERE id=NEW.invoice_id;
 IF EXISTS(SELECT 1 FROM payroll_carrier_premium_correction c JOIN payroll_carrier_premium_authorization a ON a.id=c.premium_authorization_id WHERE a.invoice_id=NEW.invoice_id) THEN RAISE EXCEPTION 'Revise the reconciled invoice before authorizing another premium journal.'; END IF;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=i.facility_id FOR UPDATE;
 IF NEW.invoice_id IS DISTINCT FROM (SELECT id FROM payroll_benefit_carrier_invoice WHERE facility_id=i.facility_id AND carrier_key=i.carrier_key AND invoice_key=i.invoice_key ORDER BY revision DESC LIMIT 1) OR EXISTS(SELECT 1 FROM payroll_carrier_premium_authorization a JOIN payroll_benefit_carrier_invoice v ON v.id=a.invoice_id WHERE v.facility_id=i.facility_id AND v.carrier_key=i.carrier_key AND v.invoice_key=i.invoice_key AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation c WHERE c.authorization_id=a.id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_correction x WHERE x.premium_authorization_id=a.id)) THEN RAISE EXCEPTION 'Premium authorization requires the latest invoice without another active authorization.'; END IF;
 IF NEW.preview->>'fingerprint' IS DISTINCT FROM NEW.fingerprint THEN RAISE EXCEPTION 'Premium authorization must retain its reviewed fingerprint.'; END IF;
 RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS payroll_carrier_payee (
 id UUID PRIMARY KEY, facility_id BIGINT NOT NULL REFERENCES payroll_settings(facility_id),
 carrier_key TEXT NOT NULL, carrier_name TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 connection_id BIGINT NOT NULL REFERENCES payroll_payment_connection(id),
 encrypted_destination BYTEA NOT NULL, masked_destination JSONB NOT NULL,
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,carrier_key,revision), CHECK(carrier_key=lower(carrier_name))
);
CREATE TABLE IF NOT EXISTS payroll_carrier_payee_check (
 id BIGSERIAL PRIMARY KEY,payee_id UUID NOT NULL REFERENCES payroll_carrier_payee(id),
 status TEXT NOT NULL CHECK(status IN ('VERIFIED','CHANGED','UNAVAILABLE','CONNECTION_CHANGED')),
 created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_guard_carrier_payee() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll-payment-connection:'||NEW.facility_id,0));
 IF NEW.connection_id IS DISTINCT FROM (SELECT id FROM payroll_payment_connection WHERE facility_id=NEW.facility_id ORDER BY id DESC LIMIT 1) THEN RAISE EXCEPTION 'Carrier payee requires the current employer payment connection.'; END IF;
 IF NEW.revision IS DISTINCT FROM (SELECT coalesce(max(revision),0)+1 FROM payroll_carrier_payee WHERE facility_id=NEW.facility_id AND carrier_key=NEW.carrier_key) THEN RAISE EXCEPTION 'Carrier payee revision changed.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_payee ON payroll_carrier_payee;
CREATE TRIGGER payroll_guard_carrier_payee BEFORE INSERT ON payroll_carrier_payee FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_payee();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_payee;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_payee FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_payee_check;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_payee_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_carrier_payment_authorization (
 id UUID PRIMARY KEY,invoice_id UUID NOT NULL REFERENCES payroll_benefit_carrier_invoice(id),
 premium_authorization_id UUID NOT NULL REFERENCES payroll_carrier_premium_authorization(id),
 payee_id UUID NOT NULL REFERENCES payroll_carrier_payee(id),connection_id BIGINT NOT NULL REFERENCES payroll_payment_connection(id),
 amount_cents BIGINT NOT NULL CHECK(amount_cents>0),payment_date DATE NOT NULL,
 preview JSONB NOT NULL,fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 request_key TEXT NOT NULL,reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 outside_activity_reviewed BOOLEAN NOT NULL CHECK(outside_activity_reviewed),
 created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(invoice_id,request_key)
);
CREATE TABLE IF NOT EXISTS payroll_carrier_payment_cancellation (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_carrier_payment_authorization(id),reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_guard_carrier_payment_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i payroll_benefit_carrier_invoice; used BIGINT;
BEGIN
 SELECT * INTO i FROM payroll_benefit_carrier_invoice WHERE id=NEW.invoice_id;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=i.facility_id FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll-payment-connection:'||i.facility_id,0));
 IF NEW.invoice_id IS DISTINCT FROM (SELECT id FROM payroll_benefit_carrier_invoice WHERE facility_id=i.facility_id AND carrier_key=i.carrier_key AND invoice_key=i.invoice_key ORDER BY revision DESC LIMIT 1)
 OR NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_authorization a WHERE a.id=NEW.premium_authorization_id AND a.invoice_id=i.id AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation c WHERE c.authorization_id=a.id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_correction c WHERE c.premium_authorization_id=a.id))
 OR NOT EXISTS(SELECT 1 FROM payroll_carrier_payee p WHERE p.id=NEW.payee_id AND p.facility_id=i.facility_id AND p.carrier_key=i.carrier_key AND p.connection_id=NEW.connection_id)
 OR NEW.payee_id IS DISTINCT FROM (SELECT id FROM payroll_carrier_payee WHERE facility_id=i.facility_id AND carrier_key=i.carrier_key ORDER BY revision DESC LIMIT 1)
 OR NEW.connection_id IS DISTINCT FROM (SELECT id FROM payroll_payment_connection WHERE facility_id=i.facility_id ORDER BY id DESC LIMIT 1)
 OR (SELECT result->>'status' FROM payroll_carrier_premium_observation WHERE authorization_id=NEW.premium_authorization_id ORDER BY id DESC LIMIT 1) IS DISTINCT FROM 'SYNCED'
 OR EXISTS(SELECT 1 FROM payroll_carrier_reversal_authorization r WHERE r.premium_authorization_id=NEW.premium_authorization_id AND NOT EXISTS(SELECT 1 FROM payroll_carrier_reversal_cancellation c WHERE c.authorization_id=r.id)) THEN RAISE EXCEPTION 'Payment authorization requires the current invoice, posted premium, payee and funding without an active reversal.'; END IF;
 IF NEW.preview->>'fingerprint' IS DISTINCT FROM NEW.fingerprint OR NEW.preview->>'invoiceId' IS DISTINCT FROM NEW.invoice_id::text OR NEW.preview->>'premiumAuthorizationId' IS DISTINCT FROM NEW.premium_authorization_id::text OR NEW.preview->>'payeeRevisionId' IS DISTINCT FROM NEW.payee_id::text OR NEW.preview->>'fundingRevisionId' IS DISTINCT FROM NEW.connection_id::text OR NEW.preview->>'amountCents' IS DISTINCT FROM NEW.amount_cents::text OR NEW.preview->>'paymentDate' IS DISTINCT FROM NEW.payment_date::text THEN RAISE EXCEPTION 'Payment authorization must bind its reviewed payment facts.'; END IF;
 SELECT coalesce(sum(a.amount_cents),0) INTO used FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice v ON v.id=a.invoice_id WHERE v.facility_id=i.facility_id AND v.carrier_key=i.carrier_key AND v.invoice_key=i.invoice_key AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation c WHERE c.authorization_id=a.id);
 IF used+NEW.amount_cents>(i.invoice->>'amountCents')::bigint THEN RAISE EXCEPTION 'Carrier payment reservations exceed the invoice amount.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_payment_authorization ON payroll_carrier_payment_authorization;
CREATE TRIGGER payroll_guard_carrier_payment_authorization BEFORE INSERT ON payroll_carrier_payment_authorization FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_payment_authorization();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_payment_authorization;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_payment_authorization FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_payment_cancellation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_payment_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_guard_carrier_payment_correction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i payroll_benefit_carrier_invoice;
BEGIN
 IF TG_TABLE_NAME='payroll_benefit_carrier_invoice' THEN i:=NEW;
 ELSE SELECT v.* INTO i FROM payroll_benefit_carrier_invoice v JOIN payroll_carrier_premium_authorization a ON a.invoice_id=v.id WHERE a.id=NEW.premium_authorization_id; END IF;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=i.facility_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice v ON v.id=a.invoice_id WHERE v.facility_id=i.facility_id AND v.carrier_key=i.carrier_key AND v.invoice_key=i.invoice_key AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation c WHERE c.authorization_id=a.id)) THEN RAISE EXCEPTION 'Resolve active carrier payment authorizations before changing invoice accounting.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_payment_correction ON payroll_benefit_carrier_invoice;
CREATE TRIGGER payroll_guard_carrier_payment_correction BEFORE INSERT ON payroll_benefit_carrier_invoice FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_payment_correction();
DROP TRIGGER IF EXISTS payroll_guard_carrier_payment_correction ON payroll_carrier_reversal_authorization;
CREATE TRIGGER payroll_guard_carrier_payment_correction BEFORE INSERT ON payroll_carrier_reversal_authorization FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_payment_correction();

CREATE TABLE IF NOT EXISTS payroll_carrier_payment_claim (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_carrier_payment_authorization(id),
 encrypted_instruction BYTEA NOT NULL,created_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_carrier_payment_observation (
 id BIGSERIAL PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_carrier_payment_claim(authorization_id),
 source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_guard_carrier_payment_dispatch() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE employer BIGINT;
BEGIN
 SELECT i.facility_id INTO employer FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE a.id=NEW.authorization_id;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=employer FOR UPDATE;
 IF TG_TABLE_NAME='payroll_carrier_payment_claim' THEN
  IF EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled carrier payment cannot be dispatched.'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM payroll_carrier_payment_claim WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Claimed carrier payment requires provider recovery.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_payment_dispatch ON payroll_carrier_payment_claim;
CREATE TRIGGER payroll_guard_carrier_payment_dispatch BEFORE INSERT ON payroll_carrier_payment_claim FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_payment_dispatch();
DROP TRIGGER IF EXISTS payroll_guard_carrier_payment_dispatch ON payroll_carrier_payment_cancellation;
CREATE TRIGGER payroll_guard_carrier_payment_dispatch BEFORE INSERT ON payroll_carrier_payment_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_payment_dispatch();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_payment_claim;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_payment_claim FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_payment_observation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_payment_observation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_carrier_payment_schedule (
 id UUID PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_carrier_payment_authorization(id),
 submit_at TIMESTAMPTZ NOT NULL,reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),
 request_key TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(authorization_id,request_key)
);
CREATE TABLE IF NOT EXISTS payroll_carrier_payment_schedule_cancellation (
 schedule_id UUID PRIMARY KEY REFERENCES payroll_carrier_payment_schedule(id),reference TEXT NOT NULL CHECK(length(reference) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_carrier_payment_schedule_attempt (
 id BIGSERIAL PRIMARY KEY,schedule_id UUID NOT NULL REFERENCES payroll_carrier_payment_schedule(id),status TEXT NOT NULL CHECK(status IN ('CLAIMED','BLOCKED')),message TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_guard_carrier_payment_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE auth UUID;employer BIGINT;
BEGIN
 IF TG_TABLE_NAME='payroll_carrier_payment_schedule' THEN auth:=NEW.authorization_id;
 ELSE SELECT authorization_id INTO auth FROM payroll_carrier_payment_schedule WHERE id=NEW.schedule_id; END IF;
 SELECT i.facility_id INTO employer FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE a.id=auth;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=employer FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_carrier_payment_claim WHERE authorization_id=auth) THEN RAISE EXCEPTION 'Carrier dispatch has already been claimed.'; END IF;
 IF TG_TABLE_NAME='payroll_carrier_payment_schedule' THEN
  IF EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation WHERE authorization_id=auth) OR EXISTS(SELECT 1 FROM payroll_carrier_payment_schedule s WHERE s.authorization_id=auth AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_schedule_cancellation c WHERE c.schedule_id=s.id)) THEN RAISE EXCEPTION 'Carrier authorization is cancelled or already scheduled.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_payment_schedule ON payroll_carrier_payment_schedule;
CREATE TRIGGER payroll_guard_carrier_payment_schedule BEFORE INSERT ON payroll_carrier_payment_schedule FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_payment_schedule();
DROP TRIGGER IF EXISTS payroll_guard_carrier_payment_schedule ON payroll_carrier_payment_schedule_cancellation;
CREATE TRIGGER payroll_guard_carrier_payment_schedule BEFORE INSERT ON payroll_carrier_payment_schedule_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_payment_schedule();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_payment_schedule;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_payment_schedule FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_payment_schedule_cancellation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_payment_schedule_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_payment_schedule_attempt;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_payment_schedule_attempt FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_carrier_settlement_mapping (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 payment_connection_id BIGINT NOT NULL REFERENCES payroll_payment_connection(id),
 connection_generation BIGINT NOT NULL CHECK(connection_generation>=0),
 realm_id TEXT NOT NULL CHECK(realm_id ~ '^[0-9]+$'),
 environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),
 details JSONB NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 500),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_carrier_settlement_mapping_facility ON payroll_carrier_settlement_mapping(facility_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_settlement_mapping() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_connection p WHERE p.id=NEW.payment_connection_id AND p.facility_id=NEW.facility_id AND p.mode=CASE WHEN NEW.environment='production' THEN 'LIVE' ELSE 'TEST' END) OR NOT EXISTS(SELECT 1 FROM payroll_quickbooks_connection q JOIN payroll_settings s ON s.facility_id=q.facility_id WHERE q.facility_id=NEW.facility_id AND q.realm_id=NEW.realm_id AND q.environment=NEW.environment AND s.quickbooks_connection_generation=NEW.connection_generation) THEN
  RAISE EXCEPTION 'Carrier settlement mapping requires matching employer funding and current accounting destination.' USING ERRCODE='23514';
 END IF;
 IF (NEW.details->>'version'='1' AND NEW.details->>'convention'='CARRIER_LIABILITY' AND NEW.details->>'fundingRevisionId'=NEW.payment_connection_id::text AND NEW.details->>'fundingAccountId' ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' AND NEW.details->'bank'->>'id' ~ '^[0-9]+$' AND NEW.details->'liability'->>'id' ~ '^[0-9]+$' AND NEW.details->'bank'->>'id'<>NEW.details->'liability'->>'id' AND NEW.details->'bank'->>'type'='Bank' AND NEW.details->'liability'->>'type'='Other Current Liability' AND NEW.details->'bank'->>'currency'='USD' AND NEW.details->'liability'->>'currency'='USD') IS NOT TRUE THEN
  RAISE EXCEPTION 'Carrier settlement mapping requires exact funding, bank and liability details.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_settlement_mapping ON payroll_carrier_settlement_mapping;
CREATE TRIGGER payroll_validate_carrier_settlement_mapping BEFORE INSERT ON payroll_carrier_settlement_mapping FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_settlement_mapping();
DROP TRIGGER IF EXISTS payroll_guard_carrier_settlement_mapping ON payroll_carrier_settlement_mapping;
CREATE TRIGGER payroll_guard_carrier_settlement_mapping BEFORE UPDATE OR DELETE ON payroll_carrier_settlement_mapping FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_carrier_settlement_authorization (
 id UUID PRIMARY KEY,payment_authorization_id UUID NOT NULL REFERENCES payroll_carrier_payment_authorization(id),mapping_id BIGINT NOT NULL REFERENCES payroll_carrier_settlement_mapping(id),preview JSONB NOT NULL,fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),request_key TEXT NOT NULL,reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),auto_post BOOLEAN NOT NULL CHECK(auto_post),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(payment_authorization_id,request_key)
);
CREATE TABLE IF NOT EXISTS payroll_carrier_settlement_cancellation (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_carrier_settlement_authorization(id),reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_carrier_settlement_claim (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_carrier_settlement_authorization(id),created_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_settlement_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pay UUID; employer BIGINT;
BEGIN
 IF TG_TABLE_NAME='payroll_carrier_settlement_authorization' THEN pay:=NEW.payment_authorization_id;
 ELSE SELECT payment_authorization_id INTO pay FROM payroll_carrier_settlement_authorization WHERE id=NEW.authorization_id; END IF;
 SELECT i.facility_id INTO employer FROM payroll_benefit_carrier_invoice i JOIN payroll_carrier_payment_authorization p ON p.invoice_id=i.id WHERE p.id=pay;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=employer FOR UPDATE;
 IF TG_TABLE_NAME='payroll_carrier_settlement_authorization' THEN
  IF EXISTS(SELECT 1 FROM payroll_carrier_settlement_authorization a WHERE a.payment_authorization_id=pay AND NOT EXISTS(SELECT 1 FROM payroll_carrier_settlement_cancellation c WHERE c.authorization_id=a.id)) THEN RAISE EXCEPTION 'Carrier settlement already has an active authorization.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_claim WHERE authorization_id=pay) OR EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation WHERE authorization_id=pay) OR NOT EXISTS(SELECT 1 FROM payroll_carrier_settlement_mapping m JOIN payroll_carrier_payment_authorization p ON p.id=pay WHERE m.id=NEW.mapping_id AND m.facility_id=employer AND m.payment_connection_id=p.connection_id AND m.details->'liability'->>'id'=p.preview->'liabilityAccount'->>'id') THEN RAISE EXCEPTION 'Carrier settlement authorization requires scoped claimed payment and mapping.'; END IF;
  IF (NEW.preview->>'authorizationId'=pay::text AND NEW.preview->>'mappingId'=NEW.mapping_id::text AND NEW.preview->>'fingerprint'=NEW.fingerprint AND NEW.preview->>'status'='PREVIEW_ONLY' AND jsonb_typeof(NEW.preview->'journals')='array' AND jsonb_array_length(NEW.preview->'journals') BETWEEN 1 AND 10) IS NOT TRUE THEN RAISE EXCEPTION 'Carrier settlement authorization must bind its exact preview.'; END IF;
 ELSIF TG_TABLE_NAME='payroll_carrier_settlement_cancellation' THEN
  IF EXISTS(SELECT 1 FROM payroll_carrier_settlement_claim WHERE authorization_id=NEW.authorization_id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_settlement_release WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Claimed carrier settlement requires recovery.'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM payroll_carrier_settlement_cancellation WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled carrier settlement cannot be claimed.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tab TEXT; BEGIN FOREACH tab IN ARRAY ARRAY['payroll_carrier_settlement_authorization','payroll_carrier_settlement_cancellation','payroll_carrier_settlement_claim'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_validate_carrier_settlement_authorization ON %I',tab);
 EXECUTE format('CREATE TRIGGER payroll_validate_carrier_settlement_authorization BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_settlement_authorization()',tab);
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',tab);
 EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',tab);
END LOOP; END $$;

CREATE TABLE IF NOT EXISTS payroll_carrier_settlement_journal (
 id UUID PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_carrier_settlement_claim(authorization_id),facility_id BIGINT NOT NULL REFERENCES facility(id),realm_id TEXT NOT NULL,environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),event_key TEXT NOT NULL,payload JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,realm_id,environment,event_key)
);
CREATE TABLE IF NOT EXISTS payroll_carrier_settlement_observation (
 id BIGSERIAL PRIMARY KEY,journal_id UUID NOT NULL REFERENCES payroll_carrier_settlement_journal(id),source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),result JSONB NOT NULL,create_attempted BOOLEAN NOT NULL DEFAULT false CHECK(NOT create_attempted OR source='SUBMISSION'),created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_settlement_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_carrier_settlement_authorization a JOIN payroll_carrier_payment_authorization p ON p.id=a.payment_authorization_id JOIN payroll_benefit_carrier_invoice i ON i.id=p.invoice_id WHERE a.id=NEW.authorization_id AND i.facility_id=NEW.facility_id AND a.preview->>'realmId'=NEW.realm_id AND a.preview->>'environment'=NEW.environment AND EXISTS(SELECT 1 FROM jsonb_array_elements(a.preview->'journals') j WHERE j->'event'->>'key'=NEW.event_key AND j->'payload'=NEW.payload)) THEN RAISE EXCEPTION 'Carrier settlement journal must match its retained employer and event payload.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_settlement_journal ON payroll_carrier_settlement_journal;
CREATE TRIGGER payroll_validate_carrier_settlement_journal BEFORE INSERT ON payroll_carrier_settlement_journal FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_settlement_journal();
DO $$ DECLARE tab TEXT; BEGIN FOREACH tab IN ARRAY ARRAY['payroll_carrier_settlement_journal','payroll_carrier_settlement_observation'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',tab);
 EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',tab);
END LOOP; END $$;
CREATE TABLE IF NOT EXISTS payroll_carrier_settlement_attempt (
 id BIGSERIAL PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_carrier_settlement_authorization(id),status TEXT NOT NULL CHECK(status IN ('SYNCED','NEEDS_REVIEW','BLOCKED')),message TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_settlement_attempt;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_settlement_attempt FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_carrier_settlement_release (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_carrier_settlement_claim(authorization_id),evidence JSONB NOT NULL,reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_settlement_release() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected INT; actual INT;
BEGIN
 PERFORM s.facility_id FROM payroll_settings s JOIN payroll_benefit_carrier_invoice i ON i.facility_id=s.facility_id JOIN payroll_carrier_payment_authorization p ON p.invoice_id=i.id JOIN payroll_carrier_settlement_authorization a ON a.payment_authorization_id=p.id WHERE a.id=NEW.authorization_id FOR UPDATE OF s;
 SELECT jsonb_array_length(preview->'journals') INTO expected FROM payroll_carrier_settlement_authorization WHERE id=NEW.authorization_id;
 SELECT count(*) INTO actual FROM payroll_carrier_settlement_journal WHERE authorization_id=NEW.authorization_id;
 IF actual=0 OR actual<>expected OR jsonb_typeof(NEW.evidence) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.evidence)<>actual THEN RAISE EXCEPTION 'Every retained settlement journal needs unsent release evidence.'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_carrier_settlement_journal j WHERE j.authorization_id=NEW.authorization_id AND (NOT EXISTS(SELECT 1 FROM payroll_carrier_settlement_observation o WHERE o.journal_id=j.id AND o.source='SUBMISSION' AND NOT o.create_attempted) OR EXISTS(SELECT 1 FROM payroll_carrier_settlement_observation o WHERE o.journal_id=j.id AND (o.create_attempted OR o.result->>'status' IN ('SYNCED','NEEDS_REVIEW'))) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.evidence) e JOIN payroll_carrier_settlement_observation o ON o.id::text=e->>'observationId' AND o.journal_id=j.id WHERE e->>'journalId'=j.id::text AND o.source='RECOVERY' AND o.result->>'status'='NOT_FOUND' AND o.id=(SELECT max(id) FROM payroll_carrier_settlement_observation WHERE journal_id=j.id) AND o.created_at>=clock_timestamp()-interval '5 minutes'))) THEN RAISE EXCEPTION 'Unsent settlement release requires completed no-create evidence and fresh exact absence.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_settlement_release ON payroll_carrier_settlement_release;
CREATE TRIGGER payroll_validate_carrier_settlement_release BEFORE INSERT ON payroll_carrier_settlement_release FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_settlement_release();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_settlement_release;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_settlement_release FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
-- Released event jobs remain immutable. A new authorization may claim the event
-- only after the entire earlier authorization is proven unsent and cancelled.
DO $$ DECLARE constraint_name TEXT; BEGIN FOR constraint_name IN SELECT conname FROM pg_constraint WHERE conrelid='payroll_carrier_settlement_journal'::regclass AND contype='u' LOOP EXECUTE format('ALTER TABLE payroll_carrier_settlement_journal DROP CONSTRAINT %I',constraint_name); END LOOP; END $$;
CREATE OR REPLACE FUNCTION payroll_guard_carrier_settlement_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_carrier_settlement_cancellation WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled settlement cannot add journal claims.'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_carrier_settlement_journal j WHERE j.facility_id=NEW.facility_id AND j.realm_id=NEW.realm_id AND j.environment=NEW.environment AND j.event_key=NEW.event_key AND NOT (EXISTS(SELECT 1 FROM payroll_carrier_settlement_release r WHERE r.authorization_id=j.authorization_id) AND EXISTS(SELECT 1 FROM payroll_carrier_settlement_cancellation c WHERE c.authorization_id=j.authorization_id))) THEN RAISE EXCEPTION 'Carrier bank event already has an unreleased journal claim.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_settlement_event ON payroll_carrier_settlement_journal;
CREATE TRIGGER payroll_guard_carrier_settlement_event BEFORE INSERT ON payroll_carrier_settlement_journal FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_settlement_event();
CREATE INDEX IF NOT EXISTS payroll_carrier_settlement_event_lookup ON payroll_carrier_settlement_journal(facility_id,realm_id,environment,event_key);
-- Unique active reservations complement immutable event history. The primary
-- key enforces exclusion even for callers using repeatable-read snapshots.
CREATE TABLE IF NOT EXISTS payroll_carrier_settlement_event_reservation (
 facility_id BIGINT NOT NULL,realm_id TEXT NOT NULL,environment TEXT NOT NULL,event_key TEXT NOT NULL,journal_id UUID NOT NULL UNIQUE REFERENCES payroll_carrier_settlement_journal(id),PRIMARY KEY(facility_id,realm_id,environment,event_key)
);
CREATE OR REPLACE FUNCTION payroll_guard_carrier_settlement_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Carrier settlement reservations cannot be reassigned.';
 ELSIF TG_OP='DELETE' THEN
  IF NOT EXISTS(SELECT 1 FROM payroll_carrier_settlement_journal j JOIN payroll_carrier_settlement_release r ON r.authorization_id=j.authorization_id JOIN payroll_carrier_settlement_cancellation c ON c.authorization_id=j.authorization_id WHERE j.id=OLD.journal_id) THEN RAISE EXCEPTION 'Reservation release requires retained unsent cancellation.'; END IF;
  RETURN OLD;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM payroll_carrier_settlement_journal j WHERE j.id=NEW.journal_id AND j.facility_id=NEW.facility_id AND j.realm_id=NEW.realm_id AND j.environment=NEW.environment AND j.event_key=NEW.event_key AND NOT EXISTS(SELECT 1 FROM payroll_carrier_settlement_cancellation c WHERE c.authorization_id=j.authorization_id)) THEN RAISE EXCEPTION 'Reservation must match an active retained carrier event.'; END IF;
  RETURN NEW;
 END IF;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_carrier_settlement_reservation ON payroll_carrier_settlement_event_reservation;
CREATE TRIGGER payroll_guard_carrier_settlement_reservation BEFORE INSERT OR UPDATE OR DELETE ON payroll_carrier_settlement_event_reservation FOR EACH ROW EXECUTE FUNCTION payroll_guard_carrier_settlement_reservation();
INSERT INTO payroll_carrier_settlement_event_reservation(facility_id,realm_id,environment,event_key,journal_id)
 SELECT j.facility_id,j.realm_id,j.environment,j.event_key,j.id FROM payroll_carrier_settlement_journal j WHERE NOT EXISTS(SELECT 1 FROM payroll_carrier_settlement_event_reservation s WHERE s.journal_id=j.id) AND NOT (EXISTS(SELECT 1 FROM payroll_carrier_settlement_release r WHERE r.authorization_id=j.authorization_id) AND EXISTS(SELECT 1 FROM payroll_carrier_settlement_cancellation c WHERE c.authorization_id=j.authorization_id));
CREATE OR REPLACE FUNCTION payroll_reserve_carrier_settlement_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO payroll_carrier_settlement_event_reservation(facility_id,realm_id,environment,event_key,journal_id) VALUES(NEW.facility_id,NEW.realm_id,NEW.environment,NEW.event_key,NEW.id); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_reserve_carrier_settlement_event ON payroll_carrier_settlement_journal;
CREATE TRIGGER payroll_reserve_carrier_settlement_event AFTER INSERT ON payroll_carrier_settlement_journal FOR EACH ROW EXECUTE FUNCTION payroll_reserve_carrier_settlement_event();

CREATE TABLE IF NOT EXISTS payroll_carrier_payment_receipt (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_carrier_payment_claim(authorization_id),facility_id BIGINT NOT NULL REFERENCES facility(id),observation_id BIGINT NOT NULL UNIQUE REFERENCES payroll_carrier_payment_observation(id),receipt JSONB NOT NULL,fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_payment_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id JOIN payroll_carrier_payment_observation o ON o.authorization_id=a.id WHERE a.id=NEW.authorization_id AND i.facility_id=NEW.facility_id AND o.id=NEW.observation_id AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED' AND o.result->>'reconciliationStatus'='reconciled' AND o.result->>'dateMatches'='true' AND NEW.receipt->>'id'=a.id::text AND NEW.receipt->>'invoiceId'=a.invoice_id::text AND NEW.receipt->>'invoiceRevision'=a.preview->>'invoiceRevision' AND NEW.receipt->>'amountCents'=a.amount_cents::text AND NEW.receipt->>'paymentDate'=a.preview->>'paymentDate' AND NEW.receipt->'destination'=a.preview->'destination' AND NEW.receipt->'sourceResult'=o.result AND NEW.receipt->>'version'='1' AND NEW.receipt->>'carrier'=a.preview->>'carrier' AND NEW.receipt->>'invoiceNumber'=a.preview->>'invoiceNumber' AND NEW.receipt->>'mode'=CASE WHEN o.result->>'liveMode'='true' THEN 'LIVE' ELSE 'TEST' END AND jsonb_typeof(NEW.receipt->'bankWithdrawals')='array' AND jsonb_array_length(NEW.receipt->'bankWithdrawals')=jsonb_array_length(o.result->'settlementEvidence') AND (SELECT count(DISTINCT w->>'transactionId') FROM jsonb_array_elements(NEW.receipt->'bankWithdrawals') w)=jsonb_array_length(NEW.receipt->'bankWithdrawals') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.receipt->'bankWithdrawals') w WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(o.result->'settlementEvidence') e WHERE w->>'transactionId'=e->>'transactionId' AND w->>'postedDate'=e->>'postedDate' AND w->>'amountCents'=e->>'amountCents'))) THEN RAISE EXCEPTION 'Carrier receipt requires scoped authorized bank settlement evidence.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_payment_receipt ON payroll_carrier_payment_receipt;
CREATE TRIGGER payroll_validate_carrier_payment_receipt BEFORE INSERT ON payroll_carrier_payment_receipt FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_payment_receipt();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_payment_receipt;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_payment_receipt FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_carrier_application (
 id BIGSERIAL PRIMARY KEY,payment_authorization_id UUID NOT NULL REFERENCES payroll_carrier_payment_authorization(id),previous_id BIGINT REFERENCES payroll_carrier_application(id),kind TEXT NOT NULL CHECK(kind IN ('REVIEW','RETRACT')),receipt_fingerprint TEXT,details JSONB NOT NULL,request_key TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(payment_authorization_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_application() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payment payroll_carrier_payment_authorization; employer BIGINT;
BEGIN
 SELECT * INTO payment FROM payroll_carrier_payment_authorization WHERE id=NEW.payment_authorization_id;
 SELECT facility_id INTO employer FROM payroll_benefit_carrier_invoice WHERE id=payment.invoice_id;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=employer FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll-payment-connection:'||employer,0));
 IF NEW.previous_id IS DISTINCT FROM (SELECT id FROM payroll_carrier_application WHERE payment_authorization_id=NEW.payment_authorization_id ORDER BY id DESC LIMIT 1) THEN RAISE EXCEPTION 'Carrier application requires the current review revision.'; END IF;
 IF length(trim(NEW.details->>'reference')) NOT BETWEEN 12 AND 2000 OR NEW.details->>'reference' IS NULL THEN RAISE EXCEPTION 'Carrier application needs a retained evidence reference.'; END IF;
 IF NEW.kind='RETRACT' THEN IF NEW.previous_id IS NULL OR NEW.receipt_fingerprint IS NOT NULL THEN RAISE EXCEPTION 'Retraction requires an earlier carrier review.'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_receipt r WHERE r.authorization_id=NEW.payment_authorization_id AND r.facility_id=employer AND r.fingerprint=NEW.receipt_fingerprint) OR ((NEW.details->>'appliedCents')::bigint>=0 AND (NEW.details->>'unappliedCents')::bigint>=0 AND (NEW.details->>'appliedCents')::bigint+(NEW.details->>'unappliedCents')::bigint=payment.amount_cents) IS NOT TRUE THEN RAISE EXCEPTION 'Carrier application must reconcile the retained payment amount and receipt.'; END IF;
  IF jsonb_typeof(NEW.details->'documentIds') IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.details->'documentIds') d WHERE NOT EXISTS(SELECT 1 FROM payroll_benefit_carrier_document f WHERE f.id::text=d AND f.invoice_id=payment.invoice_id)) THEN RAISE EXCEPTION 'Carrier application documents must belong to its invoice.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_application ON payroll_carrier_application;
CREATE TRIGGER payroll_validate_carrier_application BEFORE INSERT ON payroll_carrier_application FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_application();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_application;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_application FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE UNIQUE INDEX IF NOT EXISTS payroll_carrier_application_chain ON payroll_carrier_application(payment_authorization_id,COALESCE(previous_id,0));

CREATE TABLE IF NOT EXISTS payroll_carrier_reconciliation_assessment (
 id BIGSERIAL PRIMARY KEY, payment_authorization_id UUID NOT NULL REFERENCES payroll_carrier_payment_authorization(id),
 facility_id BIGINT NOT NULL REFERENCES facility(id), previous_id BIGINT REFERENCES payroll_carrier_reconciliation_assessment(id),
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'), assessment JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK(assessment->>'status' IN ('OPEN','RECONCILED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_carrier_reconciliation_chain ON payroll_carrier_reconciliation_assessment(payment_authorization_id,COALESCE(previous_id,0));
CREATE TABLE IF NOT EXISTS payroll_carrier_reconciliation_check (
 id BIGSERIAL PRIMARY KEY, assessment_id BIGINT NOT NULL REFERENCES payroll_carrier_reconciliation_assessment(id),
 checked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_carrier_reconciliation_check_latest ON payroll_carrier_reconciliation_check(assessment_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_reconciliation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE a.id=NEW.payment_authorization_id AND i.facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Carrier reconciliation requires a scoped payment.'; END IF;
 IF NEW.previous_id IS DISTINCT FROM (SELECT id FROM payroll_carrier_reconciliation_assessment WHERE payment_authorization_id=NEW.payment_authorization_id ORDER BY id DESC LIMIT 1) THEN RAISE EXCEPTION 'Carrier reconciliation requires current assessment history.'; END IF;
 IF NEW.assessment->>'status' IS NULL OR jsonb_typeof(NEW.assessment->'checks') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Carrier reconciliation requires retained checks.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_reconciliation ON payroll_carrier_reconciliation_assessment;
CREATE TRIGGER payroll_validate_carrier_reconciliation BEFORE INSERT ON payroll_carrier_reconciliation_assessment FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_reconciliation();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_reconciliation_assessment;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_reconciliation_assessment FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_reconciliation_check;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_reconciliation_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE OR REPLACE FUNCTION payroll_validate_carrier_reconciliation_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE evidence payroll_carrier_reconciliation_assessment;
BEGIN
 SELECT * INTO evidence FROM payroll_carrier_reconciliation_assessment WHERE id=NEW.assessment_id;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=evidence.facility_id FOR UPDATE;
 IF NEW.assessment_id IS DISTINCT FROM (SELECT id FROM payroll_carrier_reconciliation_assessment WHERE payment_authorization_id=evidence.payment_authorization_id ORDER BY id DESC LIMIT 1) THEN RAISE EXCEPTION 'Carrier reconciliation check requires the latest assessment.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_reconciliation_check ON payroll_carrier_reconciliation_check;
CREATE TRIGGER payroll_validate_carrier_reconciliation_check BEFORE INSERT ON payroll_carrier_reconciliation_check FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_reconciliation_check();

CREATE TABLE IF NOT EXISTS payroll_carrier_reconciliation_failure (
 id BIGSERIAL PRIMARY KEY,payment_authorization_id UUID NOT NULL REFERENCES payroll_carrier_payment_authorization(id),facility_id BIGINT NOT NULL REFERENCES facility(id),
 message TEXT NOT NULL,attempted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_carrier_reconciliation_failure_latest ON payroll_carrier_reconciliation_failure(payment_authorization_id,attempted_at DESC);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_reconciliation_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE a.id=NEW.payment_authorization_id AND i.facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Carrier reconciliation failure requires a scoped payment.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_reconciliation_failure ON payroll_carrier_reconciliation_failure;
CREATE TRIGGER payroll_validate_carrier_reconciliation_failure BEFORE INSERT ON payroll_carrier_reconciliation_failure FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_reconciliation_failure();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_reconciliation_failure;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_reconciliation_failure FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE VIEW payroll_carrier_reconciliation_attempt AS
 SELECT a.payment_authorization_id,c.checked_at AS attempted_at FROM payroll_carrier_reconciliation_check c JOIN payroll_carrier_reconciliation_assessment a ON a.id=c.assessment_id
 UNION ALL SELECT payment_authorization_id,attempted_at FROM payroll_carrier_reconciliation_failure;

CREATE TABLE IF NOT EXISTS payroll_carrier_invoice_assessment (
 id BIGSERIAL PRIMARY KEY,invoice_id UUID NOT NULL REFERENCES payroll_benefit_carrier_invoice(id),facility_id BIGINT NOT NULL REFERENCES facility(id),
 previous_id BIGINT REFERENCES payroll_carrier_invoice_assessment(id),fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),assessment JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_carrier_invoice_assessment_chain ON payroll_carrier_invoice_assessment(invoice_id,COALESCE(previous_id,0));
CREATE TABLE IF NOT EXISTS payroll_carrier_invoice_check (
 id BIGSERIAL PRIMARY KEY,invoice_id UUID NOT NULL REFERENCES payroll_benefit_carrier_invoice(id),facility_id BIGINT NOT NULL REFERENCES facility(id),
 assessment_id BIGINT REFERENCES payroll_carrier_invoice_assessment(id),status TEXT NOT NULL CHECK(status IN ('CHECKED','FAILED')),message TEXT,checked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK((status='CHECKED' AND assessment_id IS NOT NULL AND message IS NULL) OR (status='FAILED' AND assessment_id IS NULL AND message IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS payroll_carrier_invoice_check_latest ON payroll_carrier_invoice_check(invoice_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_invoice_assessment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_benefit_carrier_invoice i WHERE i.id=NEW.invoice_id AND i.facility_id=NEW.facility_id AND i.revision::text=NEW.assessment->>'invoiceRevision' AND i.invoice->>'amountCents'=NEW.assessment->>'invoiceAmountCents' AND NEW.assessment->>'invoiceId'=i.id::text) THEN RAISE EXCEPTION 'Invoice assessment must match its scoped revision and amount.'; END IF;
 IF NEW.assessment->>'status' IS NULL OR NEW.assessment->>'status' NOT IN ('OPEN','RECONCILED') THEN RAISE EXCEPTION 'Invoice assessment requires a supported status.'; END IF;
 IF NEW.assessment->>'status'='RECONCILED' AND ((NEW.assessment->>'invoiceAmountCents')::bigint>0 AND NEW.assessment->>'authorizedCents'=NEW.assessment->>'invoiceAmountCents' AND NEW.assessment->>'bankConfirmedCents'=NEW.assessment->>'invoiceAmountCents' AND NEW.assessment->>'appliedCents'=NEW.assessment->>'invoiceAmountCents' AND NEW.assessment->>'reconciledCents'=NEW.assessment->>'invoiceAmountCents' AND NEW.assessment->>'unreservedCents'='0' AND NEW.assessment->>'remainingToApplyCents'='0') IS NOT TRUE THEN RAISE EXCEPTION 'Reconciled invoice assessment requires exact full payment evidence totals.'; END IF;
 IF NEW.previous_id IS DISTINCT FROM (SELECT id FROM payroll_carrier_invoice_assessment WHERE invoice_id=NEW.invoice_id ORDER BY id DESC LIMIT 1) THEN RAISE EXCEPTION 'Invoice assessment requires current history.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_invoice_assessment ON payroll_carrier_invoice_assessment;
CREATE TRIGGER payroll_validate_carrier_invoice_assessment BEFORE INSERT ON payroll_carrier_invoice_assessment FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_invoice_assessment();
CREATE OR REPLACE FUNCTION payroll_validate_carrier_invoice_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_benefit_carrier_invoice WHERE id=NEW.invoice_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Invoice check requires a scoped invoice.'; END IF;
 IF NEW.status='CHECKED' AND NEW.assessment_id IS DISTINCT FROM (SELECT id FROM payroll_carrier_invoice_assessment WHERE invoice_id=NEW.invoice_id AND facility_id=NEW.facility_id ORDER BY id DESC LIMIT 1) THEN RAISE EXCEPTION 'Invoice check requires the current assessment.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_invoice_check ON payroll_carrier_invoice_check;
CREATE TRIGGER payroll_validate_carrier_invoice_check BEFORE INSERT ON payroll_carrier_invoice_check FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_invoice_check();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_invoice_assessment;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_invoice_assessment FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_invoice_check;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_invoice_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_carrier_remittance_recipient (
 id BIGSERIAL PRIMARY KEY, facility_id BIGINT NOT NULL REFERENCES facility(id),
 invoice_id UUID NOT NULL REFERENCES payroll_benefit_carrier_invoice(id), carrier_key TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0), previous_id BIGINT REFERENCES payroll_carrier_remittance_recipient(id),
 action TEXT NOT NULL CHECK(action IN ('REVIEW','REVOKE')), encrypted_contact BYTEA NOT NULL,
 content_sha256 TEXT NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
 request_key UUID NOT NULL, request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
 created_by BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,request_key),UNIQUE(facility_id,carrier_key,revision)
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_carrier_remittance_recipient_chain ON payroll_carrier_remittance_recipient(facility_id,carrier_key,COALESCE(previous_id,0));
CREATE OR REPLACE FUNCTION payroll_validate_carrier_remittance_recipient() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior payroll_carrier_remittance_recipient;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recipient review requires employer settings.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_benefit_carrier_invoice WHERE id=NEW.invoice_id AND facility_id=NEW.facility_id AND carrier_key=NEW.carrier_key) THEN RAISE EXCEPTION 'Recipient review requires a scoped carrier invoice.'; END IF;
 SELECT * INTO prior FROM payroll_carrier_remittance_recipient WHERE facility_id=NEW.facility_id AND carrier_key=NEW.carrier_key ORDER BY revision DESC LIMIT 1;
 IF NEW.previous_id IS DISTINCT FROM prior.id OR NEW.revision<>COALESCE(prior.revision,0)+1 THEN RAISE EXCEPTION 'Recipient review requires current history.'; END IF;
 IF NEW.action='REVOKE' AND prior.action IS DISTINCT FROM 'REVIEW' THEN RAISE EXCEPTION 'Only a current reviewed recipient can be revoked.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_remittance_recipient ON payroll_carrier_remittance_recipient;
CREATE TRIGGER payroll_validate_carrier_remittance_recipient BEFORE INSERT ON payroll_carrier_remittance_recipient FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_remittance_recipient();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_remittance_recipient;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_remittance_recipient FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_carrier_remittance_notice (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),payment_id UUID NOT NULL REFERENCES payroll_carrier_payment_authorization(id),
 recipient_id BIGINT NOT NULL REFERENCES payroll_carrier_remittance_recipient(id),receipt_fingerprint TEXT NOT NULL CHECK(receipt_fingerprint ~ '^[a-f0-9]{64}$'),
 preview_fingerprint TEXT NOT NULL CHECK(preview_fingerprint ~ '^[a-f0-9]{64}$'),encrypted_notice BYTEA NOT NULL,content_sha256 TEXT NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
 request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,request_key)
);
CREATE TABLE IF NOT EXISTS payroll_carrier_remittance_cancellation (
 notice_id UUID PRIMARY KEY REFERENCES payroll_carrier_remittance_notice(id),reference TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_carrier_remittance_claim (
 notice_id UUID PRIMARY KEY REFERENCES payroll_carrier_remittance_notice(id),dispatch_key UUID NOT NULL UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_remittance_notice() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE carrier TEXT;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 SELECT i.carrier_key INTO carrier FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE a.id=NEW.payment_id AND i.facility_id=NEW.facility_id;
 IF carrier IS NULL OR NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_receipt WHERE authorization_id=NEW.payment_id AND facility_id=NEW.facility_id AND fingerprint=NEW.receipt_fingerprint) THEN RAISE EXCEPTION 'Remittance notice requires a scoped retained payment receipt.'; END IF;
 IF NEW.recipient_id IS DISTINCT FROM (SELECT id FROM payroll_carrier_remittance_recipient WHERE facility_id=NEW.facility_id AND carrier_key=carrier ORDER BY revision DESC LIMIT 1) OR NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_recipient WHERE id=NEW.recipient_id AND action='REVIEW') THEN RAISE EXCEPTION 'Remittance notice requires the current reviewed carrier recipient.'; END IF;
 IF NEW.return_review_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_return_review r WHERE r.id=NEW.return_review_id AND r.facility_id=NEW.facility_id AND r.recipient_id=NEW.recipient_id) THEN RAISE EXCEPTION 'Remittance clearance requires a scoped recipient review.'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_carrier_remittance_notice n WHERE n.payment_id=NEW.payment_id AND NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_cancellation c WHERE c.notice_id=n.id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_return_review r WHERE r.notice_id=n.id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_unsent_release u WHERE u.notice_id=n.id)) THEN RAISE EXCEPTION 'An active remittance notice already reserves this payment.'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_validate_carrier_remittance_action() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE employer BIGINT;
BEGIN
 SELECT facility_id INTO employer FROM payroll_carrier_remittance_notice WHERE id=NEW.notice_id;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=employer FOR UPDATE;
 IF TG_TABLE_NAME='payroll_carrier_remittance_cancellation' AND EXISTS(SELECT 1 FROM payroll_carrier_remittance_claim WHERE notice_id=NEW.notice_id) THEN RAISE EXCEPTION 'Claimed remittance notices cannot be cancelled.'; END IF;
 IF TG_TABLE_NAME='payroll_carrier_remittance_claim' AND EXISTS(SELECT 1 FROM payroll_carrier_remittance_cancellation WHERE notice_id=NEW.notice_id) THEN RAISE EXCEPTION 'Cancelled remittance notices cannot be claimed.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_remittance_notice ON payroll_carrier_remittance_notice;
CREATE TRIGGER payroll_validate_carrier_remittance_notice BEFORE INSERT ON payroll_carrier_remittance_notice FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_remittance_notice();
DROP TRIGGER IF EXISTS payroll_validate_carrier_remittance_action ON payroll_carrier_remittance_cancellation;
CREATE TRIGGER payroll_validate_carrier_remittance_action BEFORE INSERT ON payroll_carrier_remittance_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_remittance_action();
DROP TRIGGER IF EXISTS payroll_validate_carrier_remittance_action ON payroll_carrier_remittance_claim;
CREATE TRIGGER payroll_validate_carrier_remittance_action BEFORE INSERT ON payroll_carrier_remittance_claim FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_remittance_action();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_remittance_notice;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_remittance_notice FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_remittance_cancellation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_remittance_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_remittance_claim;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_remittance_claim FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_carrier_remittance_attempt (
 id BIGSERIAL PRIMARY KEY,notice_id UUID NOT NULL REFERENCES payroll_carrier_remittance_claim(notice_id),dispatch_key UUID NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_carrier_remittance_result (
 attempt_id BIGINT PRIMARY KEY REFERENCES payroll_carrier_remittance_attempt(id),outcome TEXT NOT NULL CHECK(outcome IN ('SMTP_ACCEPTED','NOT_SENT','UNCERTAIN')),
 provider_message_id TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_carrier_remittance_acceptance (
 attempt_id BIGINT PRIMARY KEY REFERENCES payroll_carrier_remittance_attempt(id),source_delivery_id BIGINT NOT NULL,source_snapshot JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_carrier_remittance_check (
 id BIGSERIAL PRIMARY KEY,notice_id UUID NOT NULL REFERENCES payroll_carrier_remittance_notice(id),status TEXT NOT NULL,message TEXT,checked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_carrier_remittance_check_latest ON payroll_carrier_remittance_check(notice_id,checked_at DESC);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_remittance_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE employer BIGINT; prior_id BIGINT; prior_outcome TEXT; prior_at TIMESTAMPTZ; total INTEGER;
BEGIN
 SELECT facility_id INTO employer FROM payroll_carrier_remittance_notice WHERE id=NEW.notice_id;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=employer FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_carrier_remittance_cancellation WHERE notice_id=NEW.notice_id) THEN RAISE EXCEPTION 'Cancelled remittance notices cannot be attempted.'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_carrier_remittance_unsent_release WHERE notice_id=NEW.notice_id) THEN RAISE EXCEPTION 'Released remittance notices cannot be attempted.'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_carrier_remittance_provider_event WHERE notice_id=NEW.notice_id) THEN RAISE EXCEPTION 'Returned remittance notices cannot be attempted.'; END IF;
 SELECT count(*) INTO total FROM payroll_carrier_remittance_attempt WHERE notice_id=NEW.notice_id;
 SELECT a.id,r.outcome,a.created_at INTO prior_id,prior_outcome,prior_at FROM payroll_carrier_remittance_attempt a LEFT JOIN payroll_carrier_remittance_result r ON r.attempt_id=a.id WHERE a.notice_id=NEW.notice_id ORDER BY a.id DESC LIMIT 1;
 IF total>=3 OR (prior_id IS NOT NULL AND (prior_outcome IS DISTINCT FROM 'NOT_SENT' OR EXISTS(SELECT 1 FROM payroll_carrier_remittance_acceptance WHERE attempt_id=prior_id) OR NEW.created_at<prior_at+interval '5 minutes')) THEN RAISE EXCEPTION 'Remittance attempts require known non-send evidence and the retry interval.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_remittance_attempt ON payroll_carrier_remittance_attempt;
CREATE TRIGGER payroll_validate_carrier_remittance_attempt BEFORE INSERT ON payroll_carrier_remittance_attempt FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_remittance_attempt();
DO $$ DECLARE tab TEXT; BEGIN
 FOREACH tab IN ARRAY ARRAY['payroll_carrier_remittance_attempt','payroll_carrier_remittance_result','payroll_carrier_remittance_acceptance','payroll_carrier_remittance_check'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',tab);
  EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',tab);
 END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS payroll_carrier_remittance_provider_event (
 event_id TEXT PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),notice_id UUID NOT NULL REFERENCES payroll_carrier_remittance_notice(id),
 attempt_id BIGINT NOT NULL REFERENCES payroll_carrier_remittance_attempt(id),delivery_id BIGINT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('bounce','spamreport','dropped')),returned_at TIMESTAMPTZ NOT NULL,evidence JSONB NOT NULL,
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),signed_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_carrier_remittance_return_notice ON payroll_carrier_remittance_provider_event(notice_id,returned_at DESC);
ALTER TABLE payroll_carrier_remittance_check ADD COLUMN IF NOT EXISTS provider_event_count INTEGER NOT NULL DEFAULT 0 CHECK(provider_event_count>=0);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_remittance_provider_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_attempt a JOIN payroll_carrier_remittance_notice n ON n.id=a.notice_id JOIN email_delivery d ON d.id=NEW.delivery_id WHERE a.id=NEW.attempt_id AND a.notice_id=NEW.notice_id AND n.facility_id=NEW.facility_id AND d.facility_id=n.facility_id AND d.idempotency_key='carrier-remittance-'||a.dispatch_key::text AND d.provider='smtp:sendgrid' AND d.category='payroll_carrier_remittance' AND d.stream='transactional' AND d.template_version='carrier-remittance-v1' AND d.recipient_hash=NEW.evidence->>'recipientHash' AND NEW.evidence->>'dispatchKey'=d.idempotency_key AND NEW.returned_at>=a.created_at AND NEW.returned_at>=d.created_at) THEN RAISE EXCEPTION 'Carrier return requires exact scoped delivery and attempt evidence.'; END IF;
 IF NEW.evidence->>'eventId' IS DISTINCT FROM NEW.event_id OR NEW.evidence->>'kind' IS DISTINCT FROM NEW.kind THEN RAISE EXCEPTION 'Carrier return identity must match its evidence.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_remittance_provider_event ON payroll_carrier_remittance_provider_event;
CREATE TRIGGER payroll_validate_carrier_remittance_provider_event BEFORE INSERT ON payroll_carrier_remittance_provider_event FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_remittance_provider_event();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_remittance_provider_event;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_remittance_provider_event FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_carrier_remittance_return_review (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),notice_id UUID NOT NULL REFERENCES payroll_carrier_remittance_notice(id),
 recipient_id BIGINT NOT NULL REFERENCES payroll_carrier_remittance_recipient(id),target_recipient_hash TEXT NOT NULL CHECK(target_recipient_hash ~ '^[a-f0-9]{64}$'),
 source_event_ids JSONB NOT NULL CHECK(jsonb_typeof(source_event_ids)='array' AND jsonb_array_length(source_event_ids)>0),
 target_event_ids JSONB NOT NULL CHECK(jsonb_typeof(target_event_ids)='array'),
 recipient_requested_delivery BOOLEAN NOT NULL CHECK(recipient_requested_delivery),
 previous_review_id UUID REFERENCES payroll_carrier_remittance_return_review(id),reference TEXT NOT NULL CHECK(length(reference)>=12),
 request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,request_key)
);
CREATE INDEX IF NOT EXISTS payroll_carrier_return_review_latest ON payroll_carrier_remittance_return_review(notice_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS payroll_carrier_return_review_recipient ON payroll_carrier_remittance_return_review(facility_id,recipient_id,created_at DESC,id DESC);
ALTER TABLE payroll_carrier_remittance_notice ADD COLUMN IF NOT EXISTS return_review_id UUID REFERENCES payroll_carrier_remittance_return_review(id);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_return_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE carrier TEXT; original_recipient BIGINT; latest UUID; source_events JSONB; target_events JSONB;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_carrier_remittance_unsent_release WHERE notice_id=NEW.notice_id) THEN RAISE EXCEPTION 'Released notices require release reconciliation before another disposition.'; END IF;
 SELECT i.carrier_key,n.recipient_id INTO carrier,original_recipient FROM payroll_carrier_remittance_notice n JOIN payroll_carrier_payment_authorization a ON a.id=n.payment_id JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE n.id=NEW.notice_id AND n.facility_id=NEW.facility_id;
 IF carrier IS NULL OR NEW.recipient_id=original_recipient OR NEW.recipient_id IS DISTINCT FROM (SELECT id FROM payroll_carrier_remittance_recipient WHERE facility_id=NEW.facility_id AND carrier_key=carrier AND action='REVIEW' ORDER BY revision DESC LIMIT 1) OR EXISTS(SELECT 1 FROM payroll_carrier_remittance_recipient WHERE facility_id=NEW.facility_id AND carrier_key=carrier AND revision>(SELECT revision FROM payroll_carrier_remittance_recipient WHERE id=NEW.recipient_id)) THEN RAISE EXCEPTION 'Return review requires the current freshly reviewed scoped carrier recipient.'; END IF;
 SELECT id INTO latest FROM payroll_carrier_remittance_return_review WHERE notice_id=NEW.notice_id ORDER BY created_at DESC,id DESC LIMIT 1;
 IF latest IS DISTINCT FROM NEW.previous_review_id THEN RAISE EXCEPTION 'Carrier return review changed; reload before saving.'; END IF;
 SELECT COALESCE(jsonb_agg(event_id ORDER BY event_id),'[]'::jsonb) INTO source_events FROM payroll_carrier_remittance_provider_event WHERE notice_id=NEW.notice_id;
 SELECT COALESCE(jsonb_agg(event_id ORDER BY event_id),'[]'::jsonb) INTO target_events FROM payroll_carrier_remittance_provider_event WHERE facility_id=NEW.facility_id AND evidence->>'recipientHash'=NEW.target_recipient_hash;
 IF source_events IS DISTINCT FROM NEW.source_event_ids OR target_events IS DISTINCT FROM NEW.target_event_ids THEN RAISE EXCEPTION 'Return review must bind all current provider events.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_return_review ON payroll_carrier_remittance_return_review;
CREATE TRIGGER payroll_validate_carrier_return_review BEFORE INSERT ON payroll_carrier_remittance_return_review FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_return_review();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_remittance_return_review;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_remittance_return_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_carrier_remittance_unsent_release (
 notice_id UUID PRIMARY KEY REFERENCES payroll_carrier_remittance_notice(id),facility_id BIGINT NOT NULL REFERENCES facility(id),
 evidence JSONB NOT NULL,reference TEXT NOT NULL CHECK(length(reference)>=12),request_key UUID NOT NULL,
 request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_unsent_release() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt_ids JSONB; delivery_ids JSONB;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('carrier-remittance-send:'||NEW.notice_id::text,0));
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_notice n JOIN payroll_carrier_remittance_claim c ON c.notice_id=n.id WHERE n.id=NEW.notice_id AND n.facility_id=NEW.facility_id) OR NEW.evidence->>'noticeId' IS DISTINCT FROM NEW.notice_id::text OR NEW.evidence->>'facilityId' IS DISTINCT FROM NEW.facility_id::text OR COALESCE(NEW.evidence->>'recipientHash','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Non-send release requires scoped claimed notice evidence.'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_carrier_remittance_provider_event WHERE notice_id=NEW.notice_id) OR EXISTS(SELECT 1 FROM payroll_carrier_remittance_return_review WHERE notice_id=NEW.notice_id) OR EXISTS(SELECT 1 FROM payroll_carrier_remittance_cancellation WHERE notice_id=NEW.notice_id) THEN RAISE EXCEPTION 'Returned or already disposed notices cannot use non-send release.'; END IF;
 SELECT jsonb_agg(a.id::text ORDER BY a.id::text) INTO attempt_ids FROM payroll_carrier_remittance_attempt a WHERE a.notice_id=NEW.notice_id;
 IF attempt_ids IS NULL OR attempt_ids IS DISTINCT FROM (SELECT jsonb_agg(e->>'id' ORDER BY e->>'id') FROM jsonb_array_elements(NEW.evidence->'attempts') e) OR EXISTS(SELECT 1 FROM payroll_carrier_remittance_attempt a LEFT JOIN payroll_carrier_remittance_result r ON r.attempt_id=a.id WHERE a.notice_id=NEW.notice_id AND (r.outcome IS DISTINCT FROM 'NOT_SENT' OR EXISTS(SELECT 1 FROM payroll_carrier_remittance_acceptance x WHERE x.attempt_id=a.id))) THEN RAISE EXCEPTION 'Every attempt requires affirmative non-send evidence without recovered acceptance.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.evidence->'attempts') e JOIN payroll_carrier_remittance_attempt a ON a.id::text=e->>'id' WHERE a.notice_id=NEW.notice_id AND (e->>'dispatchKey' IS DISTINCT FROM a.dispatch_key::text OR e->>'outcome' IS DISTINCT FROM 'NOT_SENT')) THEN RAISE EXCEPTION 'Retained non-send evidence must match each attempt.'; END IF;
 PERFORM d.id FROM email_delivery d JOIN payroll_carrier_remittance_attempt a ON d.idempotency_key='carrier-remittance-'||a.dispatch_key::text WHERE a.notice_id=NEW.notice_id FOR SHARE OF d;
 IF EXISTS(SELECT 1 FROM email_delivery d JOIN payroll_carrier_remittance_attempt a ON d.idempotency_key='carrier-remittance-'||a.dispatch_key::text WHERE a.notice_id=NEW.notice_id AND (d.facility_id IS DISTINCT FROM NEW.facility_id OR d.recipient_hash IS DISTINCT FROM NEW.evidence->>'recipientHash' OR d.category IS DISTINCT FROM 'payroll_carrier_remittance' OR d.stream IS DISTINCT FROM 'transactional' OR d.template_version IS DISTINCT FROM 'carrier-remittance-v1' OR d.created_at IS NULL OR d.created_at<a.created_at OR d.status IS NULL OR d.status NOT IN ('queued','suppressed') OR d.accepted_at IS NOT NULL OR d.bounced_at IS NOT NULL OR d.complained_at IS NOT NULL)) THEN RAISE EXCEPTION 'Contradictory delivery evidence prevents non-send release.'; END IF;
 IF EXISTS(SELECT 1 FROM email_delivery d JOIN payroll_carrier_remittance_attempt a ON d.idempotency_key='carrier-remittance-'||a.dispatch_key::text WHERE a.notice_id=NEW.notice_id GROUP BY a.id HAVING count(*)>1) THEN RAISE EXCEPTION 'Conflicting duplicate delivery records prevent release.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.evidence->'deliveries') e JOIN email_delivery d ON d.id::text=e->>'id' WHERE e->>'status' IS DISTINCT FROM d.status OR e->>'idempotencyKey' IS DISTINCT FROM d.idempotency_key OR e->>'recipientHash' IS DISTINCT FROM d.recipient_hash OR e->>'facilityId' IS DISTINCT FROM d.facility_id::text) THEN RAISE EXCEPTION 'Retained non-send evidence must match each delivery record.'; END IF;
 SELECT COALESCE(jsonb_agg(d.id::text ORDER BY d.id::text),'[]'::jsonb) INTO delivery_ids FROM email_delivery d JOIN payroll_carrier_remittance_attempt a ON d.idempotency_key='carrier-remittance-'||a.dispatch_key::text WHERE a.notice_id=NEW.notice_id;
 IF delivery_ids IS DISTINCT FROM COALESCE((SELECT jsonb_agg(e->>'id' ORDER BY e->>'id') FROM jsonb_array_elements(NEW.evidence->'deliveries') e),'[]'::jsonb) THEN RAISE EXCEPTION 'Non-send release must retain every current delivery record.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_unsent_release ON payroll_carrier_remittance_unsent_release;
CREATE TRIGGER payroll_validate_carrier_unsent_release BEFORE INSERT ON payroll_carrier_remittance_unsent_release FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_unsent_release();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_remittance_unsent_release;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_remittance_unsent_release FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_benefit_coverage_review (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 onboarding_cycle INTEGER NOT NULL CHECK(onboarding_cycle>0),plan_id TEXT NOT NULL,coverage_month TEXT NOT NULL CHECK(coverage_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 revision INTEGER NOT NULL CHECK(revision>0),source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),source_snapshot JSONB NOT NULL,review JSONB NOT NULL,
 request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,employee_id,onboarding_cycle,plan_id,coverage_month,revision),UNIQUE(facility_id,request_key)
);
CREATE INDEX IF NOT EXISTS payroll_benefit_coverage_review_month ON payroll_benefit_coverage_review(facility_id,coverage_month,employee_id,revision DESC);
CREATE OR REPLACE FUNCTION payroll_validate_benefit_coverage_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_revision INTEGER;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id) OR NEW.source_snapshot->>'employeeId' IS DISTINCT FROM NEW.employee_id::text OR NEW.source_snapshot->>'onboardingCycle' IS DISTINCT FROM NEW.onboarding_cycle::text OR NEW.source_snapshot->>'planId' IS DISTINCT FROM NEW.plan_id OR NEW.source_snapshot->>'month' IS DISTINCT FROM NEW.coverage_month THEN RAISE EXCEPTION 'Coverage review requires scoped employee, cycle, plan and month evidence.'; END IF;
 SELECT COALESCE(max(revision),0) INTO prior_revision FROM payroll_benefit_coverage_review WHERE facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND onboarding_cycle=NEW.onboarding_cycle AND plan_id=NEW.plan_id AND coverage_month=NEW.coverage_month;
 IF NEW.revision<>prior_revision+1 THEN RAISE EXCEPTION 'Coverage review revision changed; reload current history.'; END IF;
 IF NEW.review->>'disposition'='RETRACTED' AND (prior_revision=0 OR (SELECT review->>'disposition' FROM payroll_benefit_coverage_review WHERE facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND onboarding_cycle=NEW.onboarding_cycle AND plan_id=NEW.plan_id AND coverage_month=NEW.coverage_month ORDER BY revision DESC LIMIT 1)='RETRACTED') THEN RAISE EXCEPTION 'Only an existing coverage review can be retracted.'; END IF;
 IF COALESCE(NEW.review->>'disposition','') NOT IN ('COVERED','NOT_COVERED','RETRACTED') OR length(COALESCE(NEW.review->>'reference',''))<12 OR length(COALESCE(NEW.review->>'carrier',''))<2 THEN RAISE EXCEPTION 'Coverage review needs a carrier, decision and verification reference.'; END IF;
 IF NEW.review->>'disposition'='COVERED' AND ((NEW.review->>'coverageStart')::date IS NULL OR (NEW.review->>'coverageEnd')::date IS NULL OR to_char((NEW.review->>'coverageStart')::date,'YYYY-MM')<>NEW.coverage_month OR to_char((NEW.review->>'coverageEnd')::date,'YYYY-MM')<>NEW.coverage_month OR (NEW.review->>'coverageEnd')::date<(NEW.review->>'coverageStart')::date) THEN RAISE EXCEPTION 'Covered dates must be ordered within the reviewed month.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_benefit_coverage_review ON payroll_benefit_coverage_review;
CREATE TRIGGER payroll_validate_benefit_coverage_review BEFORE INSERT ON payroll_benefit_coverage_review FOR EACH ROW EXECUTE FUNCTION payroll_validate_benefit_coverage_review();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_benefit_coverage_review;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_benefit_coverage_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE TABLE IF NOT EXISTS payroll_benefit_coverage_check (
 facility_id BIGINT NOT NULL REFERENCES facility(id),coverage_month TEXT NOT NULL,checked_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(facility_id,coverage_month)
);

ALTER TABLE payroll_benefit_coverage_check ADD COLUMN IF NOT EXISTS last_status TEXT NOT NULL DEFAULT 'COMPLETE' CHECK(last_status IN ('COMPLETE','FAILED'));

CREATE TABLE IF NOT EXISTS payroll_carrier_alternate_delivery (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),payment_id UUID NOT NULL REFERENCES payroll_carrier_payment_authorization(id),
 revision INTEGER NOT NULL CHECK(revision>0),action TEXT NOT NULL CHECK(action IN ('RECORD','RETRACT')),encrypted_evidence BYTEA NOT NULL,
 request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(payment_id,revision),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_carrier_alternate_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_revision INTEGER; prior_action TEXT;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE a.id=NEW.payment_id AND i.facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Alternate delivery requires a scoped carrier payment.'; END IF;
 SELECT revision,action INTO prior_revision,prior_action FROM payroll_carrier_alternate_delivery WHERE payment_id=NEW.payment_id ORDER BY revision DESC LIMIT 1;
 IF NEW.revision<>COALESCE(prior_revision,0)+1 THEN RAISE EXCEPTION 'Alternate delivery revision changed.'; END IF;
 IF NEW.action='RETRACT' AND (prior_action IS NULL OR prior_action='RETRACT') THEN RAISE EXCEPTION 'Only retained alternate delivery can be retracted.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_carrier_alternate_delivery ON payroll_carrier_alternate_delivery;
CREATE TRIGGER payroll_validate_carrier_alternate_delivery BEFORE INSERT ON payroll_carrier_alternate_delivery FOR EACH ROW EXECUTE FUNCTION payroll_validate_carrier_alternate_delivery();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_carrier_alternate_delivery;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_carrier_alternate_delivery FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE TABLE IF NOT EXISTS payroll_carrier_alternate_delivery_check (
 review_id UUID PRIMARY KEY REFERENCES payroll_carrier_alternate_delivery(id),checked_at TIMESTAMPTZ NOT NULL,status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_retirement_plan_revision (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),tax_year INTEGER NOT NULL CHECK(tax_year=2026),
 plan_id TEXT NOT NULL CHECK(plan_id ~ '^[-a-zA-Z0-9]{1,80}$'),revision INTEGER NOT NULL CHECK(revision>0),effective_on DATE NOT NULL,
 plan JSONB NOT NULL,plan_fingerprint TEXT NOT NULL CHECK(plan_fingerprint ~ '^[a-f0-9]{64}$'),
 request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,tax_year,plan_id,revision),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_plan_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_revision INTEGER;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NEW.plan->>'planId' IS DISTINCT FROM NEW.plan_id OR NEW.plan->>'taxYear' IS DISTINCT FROM NEW.tax_year::text OR NEW.plan->>'effectiveOn' IS DISTINCT FROM NEW.effective_on::text OR NEW.plan->>'fingerprint' IS DISTINCT FROM NEW.plan_fingerprint OR NEW.plan->>'planType' IS DISTINCT FROM 'STANDARD_401K' OR extract(year FROM NEW.effective_on)<>NEW.tax_year THEN RAISE EXCEPTION 'Retirement plan snapshot must match its reviewed identity, year and effective date.'; END IF;
 SELECT COALESCE(max(revision),0) INTO prior_revision FROM payroll_retirement_plan_revision WHERE facility_id=NEW.facility_id AND tax_year=NEW.tax_year AND plan_id=NEW.plan_id;
 IF NEW.revision<>prior_revision+1 THEN RAISE EXCEPTION 'Retirement plan revision changed; reload current history.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_plan_revision ON payroll_retirement_plan_revision;
CREATE TRIGGER payroll_validate_retirement_plan_revision BEFORE INSERT ON payroll_retirement_plan_revision FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_plan_revision();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_plan_revision;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_plan_revision FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_eligibility (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),plan_id TEXT NOT NULL,
 onboarding_cycle INTEGER NOT NULL CHECK(onboarding_cycle>0),revision INTEGER NOT NULL CHECK(revision>0),plan_revision_id UUID NOT NULL REFERENCES payroll_retirement_plan_revision(id),
 source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),source JSONB NOT NULL,review JSONB NOT NULL,
 request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,employee_id,plan_id,revision),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_eligibility() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_revision INTEGER;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE facility_id=NEW.facility_id AND id=NEW.employee_id) OR NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision WHERE id=NEW.plan_revision_id AND facility_id=NEW.facility_id AND plan_id=NEW.plan_id) THEN RAISE EXCEPTION 'Retirement eligibility requires scoped employee and plan evidence.'; END IF;
 IF NEW.source->>'facilityId' IS DISTINCT FROM NEW.facility_id::text OR NEW.source->>'employeeId' IS DISTINCT FROM NEW.employee_id::text OR NEW.source->>'onboardingCycle' IS DISTINCT FROM NEW.onboarding_cycle::text OR NEW.source->>'planId' IS DISTINCT FROM NEW.plan_id OR NEW.source->>'planRevisionId' IS DISTINCT FROM NEW.plan_revision_id::text OR NEW.source->>'fingerprint' IS DISTINCT FROM NEW.source_fingerprint THEN RAISE EXCEPTION 'Retirement eligibility source identity mismatch.'; END IF;
 IF COALESCE(NEW.review->>'disposition','') NOT IN ('ELIGIBLE','NOT_ELIGIBLE','REVIEW_REQUIRED') THEN RAISE EXCEPTION 'Review retirement eligibility disposition.'; END IF;
 SELECT COALESCE(max(revision),0) INTO prior_revision FROM payroll_retirement_eligibility WHERE facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND plan_id=NEW.plan_id;
 IF NEW.revision<>prior_revision+1 THEN RAISE EXCEPTION 'Retirement eligibility revision changed.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_eligibility ON payroll_retirement_eligibility;
CREATE TRIGGER payroll_validate_retirement_eligibility BEFORE INSERT ON payroll_retirement_eligibility FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_eligibility();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_eligibility;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_eligibility FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_election (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),plan_id TEXT NOT NULL,
 onboarding_cycle INTEGER NOT NULL CHECK(onboarding_cycle>0),revision INTEGER NOT NULL CHECK(revision>0),eligibility_id UUID NOT NULL REFERENCES payroll_retirement_eligibility(id),election JSONB NOT NULL,
 request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,employee_session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,employee_id,plan_id,revision),UNIQUE(facility_id,employee_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_election() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_revision INTEGER;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_eligibility WHERE id=NEW.eligibility_id AND facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND plan_id=NEW.plan_id AND onboarding_cycle=NEW.onboarding_cycle AND review->>'disposition'='ELIGIBLE') OR NOT EXISTS(SELECT 1 FROM payroll_employee_session WHERE id=NEW.employee_session_id AND facility_id=NEW.facility_id AND employee_id=NEW.employee_id) THEN RAISE EXCEPTION 'Retirement election requires scoped participant eligibility and session.'; END IF;
 IF NEW.election->'proposal'->>'eligibilityRevisionId' IS DISTINCT FROM NEW.eligibility_id::text OR NEW.election->'proposal'->>'facilityId' IS DISTINCT FROM NEW.facility_id::text OR NEW.election->'proposal'->>'employeeId' IS DISTINCT FROM NEW.employee_id::text OR NEW.election->'proposal'->>'onboardingCycle' IS DISTINCT FROM NEW.onboarding_cycle::text OR NEW.election->'proposal'->>'planId' IS DISTINCT FROM NEW.plan_id OR NEW.election->>'requestKey' IS DISTINCT FROM NEW.request_key::text THEN RAISE EXCEPTION 'Retirement election identity mismatch.'; END IF;
 SELECT COALESCE(max(revision),0) INTO prior_revision FROM payroll_retirement_election WHERE facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND plan_id=NEW.plan_id;
 IF NEW.revision<>prior_revision+1 THEN RAISE EXCEPTION 'Retirement election revision changed.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_election ON payroll_retirement_election;
CREATE TRIGGER payroll_validate_retirement_election BEFORE INSERT ON payroll_retirement_election FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_election();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_election;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_election FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_annual_source (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),plan_id TEXT NOT NULL,tax_year INTEGER NOT NULL CHECK(tax_year=2026),
 revision INTEGER NOT NULL CHECK(revision>0),plan_revision_id UUID NOT NULL REFERENCES payroll_retirement_plan_revision(id),facts JSONB NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,employee_id,plan_id,tax_year,revision),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_annual_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_revision INTEGER;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE facility_id=NEW.facility_id AND id=NEW.employee_id) OR NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision WHERE id=NEW.plan_revision_id AND facility_id=NEW.facility_id AND plan_id=NEW.plan_id AND tax_year=NEW.tax_year) THEN RAISE EXCEPTION 'Annual retirement sources require scoped employee and plan.'; END IF;
 IF NEW.facts->>'taxYear' IS DISTINCT FROM NEW.tax_year::text THEN RAISE EXCEPTION 'Annual retirement source year mismatch.'; END IF;
 SELECT COALESCE(max(revision),0) INTO prior_revision FROM payroll_retirement_annual_source WHERE facility_id=NEW.facility_id AND employee_id=NEW.employee_id AND plan_id=NEW.plan_id AND tax_year=NEW.tax_year;
 IF NEW.revision<>prior_revision+1 THEN RAISE EXCEPTION 'Annual retirement source revision changed.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_annual_source ON payroll_retirement_annual_source;
CREATE TRIGGER payroll_validate_retirement_annual_source BEFORE INSERT ON payroll_retirement_annual_source FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_annual_source();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_annual_source;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_annual_source FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_run_ledger (
 id BIGSERIAL PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),run_id BIGINT NOT NULL REFERENCES payroll_run(id),employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),plan_id TEXT NOT NULL,
 tax_year INTEGER NOT NULL CHECK(tax_year=2026),calculation JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(run_id,employee_id,plan_id)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_run_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee e ON e.payroll_run_id=r.id
 WHERE r.id=NEW.run_id AND r.facility_id=NEW.facility_id AND e.employee_id=NEW.employee_id AND r.status IN ('APPROVED','FINALIZED') AND EXTRACT(YEAR FROM COALESCE(r.payment_date,p.pay_date))=NEW.tax_year
 AND NEW.calculation->>'payDate'=COALESCE(r.payment_date,p.pay_date)::text
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(r.calculation_snapshot->'employees','[]'::jsonb)) employee, jsonb_array_elements(COALESCE(employee->'retirementPlans','[]'::jsonb)) plan WHERE employee->>'employeeId'=NEW.employee_id::text AND plan->>'planId'=NEW.plan_id AND plan->'calculation'=NEW.calculation)) THEN RAISE EXCEPTION 'Retirement ledger requires exact approved employee payroll evidence.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_run_ledger ON payroll_retirement_run_ledger;
CREATE TRIGGER payroll_validate_retirement_run_ledger BEFORE INSERT ON payroll_retirement_run_ledger FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_run_ledger();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_run_ledger;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_run_ledger FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_processing_review (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),plan_id TEXT NOT NULL,plan_revision_id UUID NOT NULL REFERENCES payroll_retirement_plan_revision(id),revision INTEGER NOT NULL CHECK(revision>0),review JSONB NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,plan_id,revision),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_processing_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_revision INTEGER;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision WHERE id=NEW.plan_revision_id AND facility_id=NEW.facility_id AND plan_id=NEW.plan_id AND tax_year=2026) THEN RAISE EXCEPTION 'Processing review requires scoped retirement plan.'; END IF;
 SELECT COALESCE(max(revision),0) INTO prior_revision FROM payroll_retirement_processing_review WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id;
 IF NEW.revision<>prior_revision+1 THEN RAISE EXCEPTION 'Retirement processing revision changed.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_processing_review ON payroll_retirement_processing_review;
CREATE TRIGGER payroll_validate_retirement_processing_review BEFORE INSERT ON payroll_retirement_processing_review FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_processing_review();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_processing_review;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_processing_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

ALTER TABLE payroll_accounting_mapping ADD COLUMN IF NOT EXISTS retirement_liability_account TEXT;

-- Plan-specific retirement remittance destination evidence, separate from carrier payees.
CREATE TABLE IF NOT EXISTS payroll_retirement_destination (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),plan_id TEXT NOT NULL,
 plan_revision_id UUID NOT NULL REFERENCES payroll_retirement_plan_revision(id),revision INTEGER NOT NULL CHECK(revision>0),connection_id BIGINT NOT NULL REFERENCES payroll_payment_connection(id),
 encrypted_destination BYTEA NOT NULL,masked_destination JSONB NOT NULL,fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),reference TEXT NOT NULL,
 request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,plan_id,revision),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_destination() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision p WHERE p.id=NEW.plan_revision_id AND p.facility_id=NEW.facility_id AND p.plan_id=NEW.plan_id AND p.tax_year=2026
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision n WHERE n.facility_id=p.facility_id AND n.plan_id=p.plan_id AND n.tax_year=p.tax_year AND n.revision>p.revision))
 OR NEW.connection_id IS DISTINCT FROM (SELECT id FROM payroll_payment_connection WHERE facility_id=NEW.facility_id ORDER BY id DESC LIMIT 1)
 THEN RAISE EXCEPTION 'Retirement destination requires current employer plan and payment connection.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_destination ON payroll_retirement_destination;
CREATE TRIGGER payroll_validate_retirement_destination BEFORE INSERT ON payroll_retirement_destination FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_destination();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_destination;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_destination FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE TABLE IF NOT EXISTS payroll_retirement_destination_check (
 id BIGSERIAL PRIMARY KEY,destination_id UUID NOT NULL REFERENCES payroll_retirement_destination(id),status TEXT NOT NULL CHECK(status IN ('VERIFIED','CHANGED','UNAVAILABLE','CONNECTION_CHANGED','PLAN_CHANGED')),
 created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_destination_check;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_destination_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_participant_mapping (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),plan_id TEXT NOT NULL,plan_revision_id UUID NOT NULL REFERENCES payroll_retirement_plan_revision(id),
 revision INTEGER NOT NULL CHECK(revision>0),source_fingerprint TEXT NOT NULL,source JSONB NOT NULL,disposition TEXT NOT NULL CHECK(disposition IN ('VERIFIED','SUSPENDED')),
 encrypted_identifiers BYTEA,masked_identifiers JSONB,identity_fingerprint TEXT,reference TEXT NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,employee_id,plan_id,revision),UNIQUE(facility_id,request_key),
 CHECK((disposition='VERIFIED' AND encrypted_identifiers IS NOT NULL AND masked_identifiers IS NOT NULL AND identity_fingerprint IS NOT NULL AND identity_fingerprint ~ '^[a-f0-9]{64}$') OR (disposition='SUSPENDED' AND encrypted_identifiers IS NULL AND masked_identifiers IS NULL AND identity_fingerprint IS NULL))
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_participant_mapping() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE facility_id=NEW.facility_id AND id=NEW.employee_id)
 OR NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision p WHERE p.id=NEW.plan_revision_id AND p.facility_id=NEW.facility_id AND p.plan_id=NEW.plan_id AND p.tax_year=2026
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision n WHERE n.facility_id=p.facility_id AND n.plan_id=p.plan_id AND n.tax_year=p.tax_year AND n.revision>p.revision)) THEN RAISE EXCEPTION 'Participant mapping requires current scoped employee and plan evidence.'; END IF;
 IF NEW.disposition='VERIFIED' AND EXISTS(SELECT 1 FROM payroll_retirement_participant_mapping m WHERE m.facility_id=NEW.facility_id AND m.plan_id=NEW.plan_id AND m.employee_id<>NEW.employee_id AND m.disposition='VERIFIED' AND m.identity_fingerprint=NEW.identity_fingerprint
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_participant_mapping n WHERE n.facility_id=m.facility_id AND n.employee_id=m.employee_id AND n.plan_id=m.plan_id AND n.revision>m.revision)) THEN RAISE EXCEPTION 'Participant identifier already belongs to another employee.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_participant_mapping ON payroll_retirement_participant_mapping;
CREATE TRIGGER payroll_validate_retirement_participant_mapping BEFORE INSERT ON payroll_retirement_participant_mapping FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_participant_mapping();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_participant_mapping;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_participant_mapping FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE INDEX IF NOT EXISTS payroll_retirement_participant_identity_idx ON payroll_retirement_participant_mapping(facility_id,plan_id,identity_fingerprint,employee_id,revision DESC) WHERE disposition='VERIFIED';

CREATE TABLE IF NOT EXISTS payroll_retirement_destination_suspension (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),destination_id UUID NOT NULL UNIQUE REFERENCES payroll_retirement_destination(id),reference TEXT NOT NULL,
 request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_destination_suspension() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_destination d WHERE d.id=NEW.destination_id AND d.facility_id=NEW.facility_id
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_destination n WHERE n.facility_id=d.facility_id AND n.plan_id=d.plan_id AND n.revision>d.revision)) THEN RAISE EXCEPTION 'Suspension requires the current scoped retirement destination.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_destination_suspension ON payroll_retirement_destination_suspension;
CREATE TRIGGER payroll_validate_retirement_destination_suspension BEFORE INSERT ON payroll_retirement_destination_suspension FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_destination_suspension();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_destination_suspension;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_destination_suspension FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

ALTER TABLE payroll_retirement_destination_check ADD COLUMN IF NOT EXISTS automatic BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payroll_retirement_destination_check ALTER COLUMN created_by DROP NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='payroll_retirement_destination_check_actor' AND conrelid='payroll_retirement_destination_check'::regclass) THEN
  ALTER TABLE payroll_retirement_destination_check ADD CONSTRAINT payroll_retirement_destination_check_actor CHECK((automatic AND created_by IS NULL) OR (NOT automatic AND created_by IS NOT NULL));
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS payroll_retirement_timing_review (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),plan_id TEXT NOT NULL,plan_revision_id UUID NOT NULL REFERENCES payroll_retirement_plan_revision(id),revision INTEGER NOT NULL CHECK(revision>0),
 policy JSONB NOT NULL CHECK(policy->>'disposition' IN ('REVIEWED','SUSPENDED')),request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,plan_id,revision),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_timing_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision p WHERE p.id=NEW.plan_revision_id AND p.facility_id=NEW.facility_id AND p.plan_id=NEW.plan_id AND p.tax_year=2026
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision n WHERE n.facility_id=p.facility_id AND n.plan_id=p.plan_id AND n.tax_year=p.tax_year AND n.revision>p.revision)) THEN RAISE EXCEPTION 'Timing requires current scoped plan evidence.'; END IF;
 IF NEW.revision<>(SELECT COALESCE(max(revision),0)+1 FROM payroll_retirement_timing_review WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id) THEN RAISE EXCEPTION 'Timing revision changed.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_timing_review ON payroll_retirement_timing_review;
CREATE TRIGGER payroll_validate_retirement_timing_review BEFORE INSERT ON payroll_retirement_timing_review FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_timing_review();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_timing_review;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_timing_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE TABLE IF NOT EXISTS payroll_retirement_timing_check (
 facility_id BIGINT NOT NULL REFERENCES facility(id),run_id BIGINT NOT NULL REFERENCES payroll_run(id),plan_id TEXT NOT NULL,checked_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(facility_id,run_id,plan_id)
);

CREATE TABLE IF NOT EXISTS payroll_retirement_allocation_format (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),plan_id TEXT NOT NULL,plan_revision_id UUID NOT NULL REFERENCES payroll_retirement_plan_revision(id),revision INTEGER NOT NULL CHECK(revision>0),
 format JSONB NOT NULL CHECK(format->>'disposition' IN ('VERIFIED','SUSPENDED')),request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,plan_id,revision),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_allocation_format() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision p WHERE p.id=NEW.plan_revision_id AND p.facility_id=NEW.facility_id AND p.plan_id=NEW.plan_id AND p.tax_year=2026
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision n WHERE n.facility_id=p.facility_id AND n.plan_id=p.plan_id AND n.tax_year=p.tax_year AND n.revision>p.revision)) THEN RAISE EXCEPTION 'Allocation format requires current scoped plan evidence.'; END IF;
 IF NEW.revision<>(SELECT COALESCE(max(revision),0)+1 FROM payroll_retirement_allocation_format WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id) THEN RAISE EXCEPTION 'Allocation format revision changed.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_allocation_format ON payroll_retirement_allocation_format;
CREATE TRIGGER payroll_validate_retirement_allocation_format BEFORE INSERT ON payroll_retirement_allocation_format FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_allocation_format();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_allocation_format;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_allocation_format FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_remittance_authorization (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),run_id BIGINT NOT NULL REFERENCES payroll_run(id),plan_id TEXT NOT NULL,
 plan_revision_id UUID NOT NULL REFERENCES payroll_retirement_plan_revision(id),destination_id UUID NOT NULL REFERENCES payroll_retirement_destination(id),format_id UUID NOT NULL REFERENCES payroll_retirement_allocation_format(id),timing_id UUID NOT NULL REFERENCES payroll_retirement_timing_review(id),
 amount_cents BIGINT NOT NULL CHECK(amount_cents>0),basis JSONB NOT NULL,encrypted_allocation BYTEA NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,reference TEXT NOT NULL,outside_activity_reviewed BOOLEAN NOT NULL CHECK(outside_activity_reviewed),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,request_key)
);
-- Durable claim boundary for future dispatch. No route currently submits a claim.
CREATE TABLE IF NOT EXISTS payroll_retirement_remittance_claim (
 id UUID PRIMARY KEY,authorization_id UUID NOT NULL UNIQUE REFERENCES payroll_retirement_remittance_authorization(id),created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_retirement_remittance_cancellation (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),authorization_id UUID NOT NULL UNIQUE REFERENCES payroll_retirement_remittance_authorization(id),reference TEXT NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_remittance_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_run WHERE id=NEW.run_id AND facility_id=NEW.facility_id AND status='FINALIZED')
 OR NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision p WHERE p.id=NEW.plan_revision_id AND p.facility_id=NEW.facility_id AND p.plan_id=NEW.plan_id AND NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision n WHERE n.facility_id=p.facility_id AND n.plan_id=p.plan_id AND n.tax_year=p.tax_year AND n.revision>p.revision))
 OR NOT EXISTS(SELECT 1 FROM payroll_retirement_destination d WHERE d.id=NEW.destination_id AND d.facility_id=NEW.facility_id AND d.plan_id=NEW.plan_id AND d.plan_revision_id=NEW.plan_revision_id AND d.connection_id=(SELECT id FROM payroll_payment_connection WHERE facility_id=NEW.facility_id ORDER BY id DESC LIMIT 1) AND NOT EXISTS(SELECT 1 FROM payroll_retirement_destination_suspension s WHERE s.destination_id=d.id) AND NOT EXISTS(SELECT 1 FROM payroll_retirement_destination n WHERE n.facility_id=d.facility_id AND n.plan_id=d.plan_id AND n.revision>d.revision))
 OR NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_format f WHERE f.id=NEW.format_id AND f.facility_id=NEW.facility_id AND f.plan_id=NEW.plan_id AND f.plan_revision_id=NEW.plan_revision_id AND f.format->>'disposition'='VERIFIED' AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_format n WHERE n.facility_id=f.facility_id AND n.plan_id=f.plan_id AND n.revision>f.revision))
 OR NOT EXISTS(SELECT 1 FROM payroll_retirement_timing_review t WHERE t.id=NEW.timing_id AND t.facility_id=NEW.facility_id AND t.plan_id=NEW.plan_id AND t.plan_revision_id=NEW.plan_revision_id AND t.policy->>'disposition'='REVIEWED' AND t.policy->>'effectiveOn'<=(SELECT payment_date::text FROM payroll_run WHERE id=NEW.run_id) AND NOT EXISTS(SELECT 1 FROM payroll_retirement_timing_review n WHERE n.facility_id=t.facility_id AND n.plan_id=t.plan_id AND n.revision>t.revision AND n.policy->>'effectiveOn'<=(SELECT payment_date::text FROM payroll_run WHERE id=NEW.run_id)))
 THEN RAISE EXCEPTION 'Remittance authorization requires current scoped finalized contributions and configuration.'; END IF;
 IF NEW.amount_cents IS DISTINCT FROM (SELECT SUM((calculation->>'totalCents')::bigint) FROM payroll_retirement_run_ledger WHERE facility_id=NEW.facility_id AND run_id=NEW.run_id AND plan_id=NEW.plan_id) THEN RAISE EXCEPTION 'Remittance authorization must match exact plan contributions.'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_retirement_remittance_authorization a WHERE a.facility_id=NEW.facility_id AND a.run_id=NEW.run_id AND a.plan_id=NEW.plan_id AND NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation c WHERE c.authorization_id=a.id)) THEN RAISE EXCEPTION 'Retirement contributions are already reserved.'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_validate_retirement_remittance_disposition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE employer BIGINT;
BEGIN
 SELECT facility_id INTO employer FROM payroll_retirement_remittance_authorization WHERE id=NEW.authorization_id;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=employer FOR UPDATE;
 IF TG_TABLE_NAME='payroll_retirement_remittance_claim' THEN
  IF EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled remittance cannot be claimed.'; END IF;
 ELSE
  IF NEW.facility_id IS DISTINCT FROM employer OR EXISTS(SELECT 1 FROM payroll_retirement_remittance_claim WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancellation requires scoped unclaimed remittance.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_remittance_authorization ON payroll_retirement_remittance_authorization;
CREATE TRIGGER payroll_validate_retirement_remittance_authorization BEFORE INSERT ON payroll_retirement_remittance_authorization FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_remittance_authorization();
DROP TRIGGER IF EXISTS payroll_validate_retirement_remittance_disposition ON payroll_retirement_remittance_claim;
CREATE TRIGGER payroll_validate_retirement_remittance_disposition BEFORE INSERT ON payroll_retirement_remittance_claim FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_remittance_disposition();
DROP TRIGGER IF EXISTS payroll_validate_retirement_remittance_disposition ON payroll_retirement_remittance_cancellation;
CREATE TRIGGER payroll_validate_retirement_remittance_disposition BEFORE INSERT ON payroll_retirement_remittance_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_remittance_disposition();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_remittance_authorization;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_remittance_authorization FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_remittance_claim;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_remittance_claim FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_remittance_cancellation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_remittance_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

ALTER TABLE payroll_retirement_remittance_claim ADD COLUMN IF NOT EXISTS encrypted_instruction BYTEA;
ALTER TABLE payroll_retirement_remittance_claim ADD COLUMN IF NOT EXISTS created_by BIGINT;
ALTER TABLE payroll_retirement_remittance_claim ADD COLUMN IF NOT EXISTS bank_instruction_reference TEXT;
CREATE TABLE IF NOT EXISTS payroll_retirement_remittance_observation (
 id BIGSERIAL PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_retirement_remittance_authorization(id),source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),result JSONB NOT NULL,created_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_remittance_observation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_remittance_observation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
ALTER TABLE payroll_retirement_remittance_claim ADD COLUMN IF NOT EXISTS outside_activity_reviewed BOOLEAN NOT NULL DEFAULT false;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='payroll_retirement_claim_outside_review' AND conrelid='payroll_retirement_remittance_claim'::regclass) THEN
  ALTER TABLE payroll_retirement_remittance_claim ADD CONSTRAINT payroll_retirement_claim_outside_review CHECK(encrypted_instruction IS NULL OR outside_activity_reviewed) NOT VALID;
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS payroll_retirement_sftp_configuration (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),plan_id TEXT NOT NULL,
 plan_revision_id UUID NOT NULL REFERENCES payroll_retirement_plan_revision(id),format_id UUID NOT NULL REFERENCES payroll_retirement_allocation_format(id),
 revision INTEGER NOT NULL CHECK(revision>0),disposition TEXT NOT NULL CHECK(disposition IN ('REVIEWED','SUSPENDED')),
 encrypted_configuration BYTEA,display_configuration JSONB NOT NULL,reference TEXT NOT NULL,
 request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK((disposition='REVIEWED')=(encrypted_configuration IS NOT NULL)),UNIQUE(facility_id,plan_id,revision),UNIQUE(facility_id,request_key)
);
CREATE TABLE IF NOT EXISTS payroll_retirement_sftp_check (
 id BIGSERIAL PRIMARY KEY,configuration_id UUID NOT NULL REFERENCES payroll_retirement_sftp_configuration(id),status TEXT NOT NULL CHECK(status IN ('VERIFIED','UNAVAILABLE','CONFIGURATION_CHANGED')),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_sftp_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest payroll_retirement_sftp_configuration%ROWTYPE;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 SELECT * INTO latest FROM payroll_retirement_sftp_configuration WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id ORDER BY revision DESC LIMIT 1;
 IF NEW.revision<>COALESCE(latest.revision,0)+1 THEN RAISE EXCEPTION 'SFTP configuration revision changed.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision WHERE id=NEW.plan_revision_id AND facility_id=NEW.facility_id AND plan_id=NEW.plan_id)
 OR NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_format WHERE id=NEW.format_id AND facility_id=NEW.facility_id AND plan_id=NEW.plan_id) THEN RAISE EXCEPTION 'SFTP configuration requires scoped plan and format.'; END IF;
 IF NEW.disposition='REVIEWED' THEN
  IF NEW.plan_revision_id IS DISTINCT FROM (SELECT id FROM payroll_retirement_plan_revision WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id AND tax_year=2026 ORDER BY revision DESC LIMIT 1)
  OR NEW.format_id IS DISTINCT FROM (SELECT id FROM payroll_retirement_allocation_format WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id ORDER BY revision DESC LIMIT 1)
  OR NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_format WHERE id=NEW.format_id AND plan_revision_id=NEW.plan_revision_id AND format->>'disposition'='VERIFIED') THEN RAISE EXCEPTION 'SFTP setup requires current reviewed allocation format.'; END IF;
 ELSIF latest.id IS NULL OR latest.disposition<>'REVIEWED' OR NEW.plan_revision_id<>latest.plan_revision_id OR NEW.format_id<>latest.format_id THEN RAISE EXCEPTION 'Suspend the current reviewed SFTP configuration.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_sftp_configuration ON payroll_retirement_sftp_configuration;
CREATE TRIGGER payroll_validate_retirement_sftp_configuration BEFORE INSERT ON payroll_retirement_sftp_configuration FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_sftp_configuration();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_sftp_configuration;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_sftp_configuration FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_sftp_check;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_sftp_check FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_allocation_authorization (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),remittance_id UUID NOT NULL REFERENCES payroll_retirement_remittance_authorization(id),configuration_id UUID NOT NULL REFERENCES payroll_retirement_sftp_configuration(id),
 file_name TEXT NOT NULL CHECK(file_name ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}\.csv$' AND position('..' in file_name)=0),reference TEXT NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,request_key),UNIQUE(facility_id,file_name)
);
CREATE TABLE IF NOT EXISTS payroll_retirement_allocation_claim (
 id UUID PRIMARY KEY,authorization_id UUID NOT NULL UNIQUE REFERENCES payroll_retirement_allocation_authorization(id),reference TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_retirement_allocation_cancellation (
 id UUID PRIMARY KEY,authorization_id UUID NOT NULL UNIQUE REFERENCES payroll_retirement_allocation_authorization(id),request_key UUID NOT NULL UNIQUE,request_fingerprint TEXT NOT NULL,reference TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_retirement_allocation_observation (
 id BIGSERIAL PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_retirement_allocation_authorization(id),source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),result JSONB NOT NULL,created_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_allocation_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r payroll_retirement_remittance_authorization%ROWTYPE;c payroll_retirement_sftp_configuration%ROWTYPE;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 SELECT * INTO r FROM payroll_retirement_remittance_authorization WHERE id=NEW.remittance_id;
 SELECT * INTO c FROM payroll_retirement_sftp_configuration WHERE id=NEW.configuration_id;
 IF r.id IS NULL OR r.facility_id<>NEW.facility_id OR c.id IS NULL OR c.facility_id<>NEW.facility_id OR c.plan_id<>r.plan_id OR c.plan_revision_id<>r.plan_revision_id OR c.format_id<>r.format_id OR c.disposition<>'REVIEWED'
 OR EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation WHERE authorization_id=r.id)
 OR EXISTS(SELECT 1 FROM payroll_retirement_sftp_configuration WHERE facility_id=NEW.facility_id AND plan_id=r.plan_id AND revision>c.revision)
 OR (SELECT status FROM payroll_retirement_sftp_check WHERE configuration_id=c.id ORDER BY id DESC LIMIT 1) IS DISTINCT FROM 'VERIFIED'
 THEN RAISE EXCEPTION 'Allocation authorization requires current scoped remittance and verified delivery setup.'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_retirement_allocation_authorization a WHERE a.remittance_id=r.id AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation x WHERE x.authorization_id=a.id)) THEN RAISE EXCEPTION 'Allocation delivery is already authorized.'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_validate_retirement_allocation_disposition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a payroll_retirement_allocation_authorization%ROWTYPE;
BEGIN
 SELECT * INTO a FROM payroll_retirement_allocation_authorization WHERE id=NEW.authorization_id;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=a.facility_id FOR UPDATE;
 IF TG_TABLE_NAME='payroll_retirement_allocation_claim' THEN
  IF EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation WHERE authorization_id=a.id) OR EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation WHERE authorization_id=a.remittance_id) THEN RAISE EXCEPTION 'Cancelled allocation cannot be claimed.'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM payroll_retirement_allocation_claim WHERE authorization_id=a.id) THEN RAISE EXCEPTION 'Claimed allocation requires outcome recovery.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_retirement_allocation_parent_cancel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_retirement_allocation_authorization a JOIN payroll_retirement_allocation_claim c ON c.authorization_id=a.id WHERE a.remittance_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Allocation dispatch has been claimed; retain its contribution reservation.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_allocation_authorization ON payroll_retirement_allocation_authorization;
CREATE TRIGGER payroll_validate_retirement_allocation_authorization BEFORE INSERT ON payroll_retirement_allocation_authorization FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_allocation_authorization();
DROP TRIGGER IF EXISTS payroll_validate_retirement_allocation_disposition ON payroll_retirement_allocation_claim;
CREATE TRIGGER payroll_validate_retirement_allocation_disposition BEFORE INSERT ON payroll_retirement_allocation_claim FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_allocation_disposition();
DROP TRIGGER IF EXISTS payroll_validate_retirement_allocation_disposition ON payroll_retirement_allocation_cancellation;
CREATE TRIGGER payroll_validate_retirement_allocation_disposition BEFORE INSERT ON payroll_retirement_allocation_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_allocation_disposition();
DROP TRIGGER IF EXISTS payroll_guard_retirement_allocation_parent_cancel ON payroll_retirement_remittance_cancellation;
CREATE TRIGGER payroll_guard_retirement_allocation_parent_cancel BEFORE INSERT ON payroll_retirement_remittance_cancellation FOR EACH ROW EXECUTE FUNCTION payroll_guard_retirement_allocation_parent_cancel();
DO $$ DECLARE t TEXT;BEGIN
 FOREACH t IN ARRAY ARRAY['payroll_retirement_allocation_authorization','payroll_retirement_allocation_claim','payroll_retirement_allocation_cancellation','payroll_retirement_allocation_observation'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',t);
 EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',t);
 END LOOP;
END $$;

ALTER TABLE payroll_retirement_allocation_observation ADD COLUMN IF NOT EXISTS automatic BOOLEAN NOT NULL DEFAULT false;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='payroll_retirement_allocation_automatic_actor' AND conrelid='payroll_retirement_allocation_observation'::regclass) THEN
  ALTER TABLE payroll_retirement_allocation_observation ADD CONSTRAINT payroll_retirement_allocation_automatic_actor CHECK(NOT automatic OR (source='RECOVERY' AND created_by IS NULL));
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS payroll_retirement_dispatch_schedule (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),kind TEXT NOT NULL CHECK(kind IN ('BANK','FILE')),target_id UUID NOT NULL,
 submit_at TIMESTAMPTZ NOT NULL,cutoff TIMESTAMPTZ NOT NULL CHECK(submit_at<cutoff),reference TEXT NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,request_key)
);
CREATE TABLE IF NOT EXISTS payroll_retirement_dispatch_schedule_cancellation (
 schedule_id UUID PRIMARY KEY REFERENCES payroll_retirement_dispatch_schedule(id),reference TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_retirement_dispatch_schedule_attempt (
 id BIGSERIAL PRIMARY KEY,schedule_id UUID NOT NULL REFERENCES payroll_retirement_dispatch_schedule(id),status TEXT NOT NULL CHECK(status IN ('CLAIMED','BLOCKED','EXPIRED')),created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE payroll_retirement_remittance_claim ADD COLUMN IF NOT EXISTS scheduled_id UUID REFERENCES payroll_retirement_dispatch_schedule(id);
ALTER TABLE payroll_retirement_allocation_claim ADD COLUMN IF NOT EXISTS scheduled_id UUID REFERENCES payroll_retirement_dispatch_schedule(id);
ALTER TABLE payroll_retirement_allocation_claim ALTER COLUMN created_by DROP NOT NULL;
CREATE OR REPLACE FUNCTION payroll_validate_retirement_dispatch_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE employer BIGINT;target UUID;dispatch_kind TEXT;has_claim BOOLEAN;
BEGIN
 IF TG_TABLE_NAME='payroll_retirement_dispatch_schedule' THEN employer=NEW.facility_id;target=NEW.target_id;dispatch_kind=NEW.kind;
 ELSE SELECT facility_id,target_id,kind INTO employer,target,dispatch_kind FROM payroll_retirement_dispatch_schedule WHERE id=NEW.schedule_id;
 END IF;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=employer FOR UPDATE;
 IF dispatch_kind='BANK' THEN
  IF NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_authorization WHERE id=target AND facility_id=employer) THEN RAISE EXCEPTION 'Schedule requires scoped bank authorization.'; END IF;
  SELECT EXISTS(SELECT 1 FROM payroll_retirement_remittance_claim WHERE authorization_id=target) INTO has_claim;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_authorization WHERE id=target AND facility_id=employer) THEN RAISE EXCEPTION 'Schedule requires scoped file authorization.'; END IF;
  SELECT EXISTS(SELECT 1 FROM payroll_retirement_allocation_claim WHERE authorization_id=target) INTO has_claim;
 END IF;
 IF has_claim THEN RAISE EXCEPTION 'Dispatch is claimed; recover its outcome.'; END IF;
 IF TG_TABLE_NAME='payroll_retirement_dispatch_schedule' AND EXISTS(SELECT 1 FROM payroll_retirement_dispatch_schedule s WHERE s.facility_id=employer AND s.kind=dispatch_kind AND s.target_id=target AND NOT EXISTS(SELECT 1 FROM payroll_retirement_dispatch_schedule_cancellation c WHERE c.schedule_id=s.id)) THEN RAISE EXCEPTION 'Cancel the prior dispatch schedule first.'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_validate_retirement_scheduled_claim() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s payroll_retirement_dispatch_schedule%ROWTYPE;
BEGIN
 IF NEW.scheduled_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO s FROM payroll_retirement_dispatch_schedule WHERE id=NEW.scheduled_id;
 IF s.id IS NULL OR s.target_id<>NEW.authorization_id OR (TG_TABLE_NAME='payroll_retirement_remittance_claim' AND s.kind<>'BANK') OR (TG_TABLE_NAME='payroll_retirement_allocation_claim' AND s.kind<>'FILE') OR EXISTS(SELECT 1 FROM payroll_retirement_dispatch_schedule_cancellation WHERE schedule_id=s.id) THEN RAISE EXCEPTION 'Scheduled claim requires its active authorization schedule.'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t TEXT;BEGIN
 FOREACH t IN ARRAY ARRAY['payroll_retirement_dispatch_schedule','payroll_retirement_dispatch_schedule_cancellation'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_validate_retirement_dispatch_schedule ON %I',t);
 EXECUTE format('CREATE TRIGGER payroll_validate_retirement_dispatch_schedule BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_dispatch_schedule()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['payroll_retirement_remittance_claim','payroll_retirement_allocation_claim'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_validate_retirement_scheduled_claim ON %I',t);
 EXECUTE format('CREATE TRIGGER payroll_validate_retirement_scheduled_claim BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_scheduled_claim()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['payroll_retirement_dispatch_schedule','payroll_retirement_dispatch_schedule_cancellation','payroll_retirement_dispatch_schedule_attempt'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',t);
 EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',t);
 END LOOP;
END $$;
ALTER TABLE payroll_retirement_allocation_observation DROP CONSTRAINT IF EXISTS payroll_retirement_allocation_automatic_actor;
ALTER TABLE payroll_retirement_allocation_observation ADD CONSTRAINT payroll_retirement_allocation_automatic_actor CHECK(NOT automatic OR created_by IS NULL);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='payroll_retirement_allocation_claim_actor' AND conrelid='payroll_retirement_allocation_claim'::regclass) THEN
 ALTER TABLE payroll_retirement_allocation_claim ADD CONSTRAINT payroll_retirement_allocation_claim_actor CHECK(created_by IS NOT NULL OR scheduled_id IS NOT NULL);
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS payroll_retirement_allocation_unsent_release (
 id UUID PRIMARY KEY,authorization_id UUID NOT NULL UNIQUE REFERENCES payroll_retirement_allocation_authorization(id),facility_id BIGINT NOT NULL REFERENCES facility(id),
 submission_observation_id BIGINT NOT NULL REFERENCES payroll_retirement_allocation_observation(id),evidence JSONB NOT NULL,reference TEXT NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_allocation_unsent_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_authorization a JOIN payroll_retirement_allocation_claim c ON c.authorization_id=a.id WHERE a.id=NEW.authorization_id AND a.facility_id=NEW.facility_id)
 OR NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_observation o WHERE o.id=NEW.submission_observation_id AND o.authorization_id=NEW.authorization_id AND o.source='SUBMISSION' AND o.result->'noWriteProof'='true'::jsonb AND o.result->'writeAttempted'='false'::jsonb AND o.result->'promotionAttempted'='false'::jsonb AND o.result->>'status' IN ('CLAIM_NOT_CONFIRMED','TRANSPORT_UNCERTAIN'))
 OR (SELECT count(*) FROM payroll_retirement_allocation_observation WHERE authorization_id=NEW.authorization_id AND source='SUBMISSION')<>1
 OR EXISTS(SELECT 1 FROM payroll_retirement_allocation_observation WHERE authorization_id=NEW.authorization_id AND (result->'writeAttempted'='true'::jsonb OR result->'promotionAttempted'='true'::jsonb OR COALESCE(result->>'status','') NOT IN ('CLAIM_NOT_CONFIRMED','TRANSPORT_UNCERTAIN','RECOVERY_UNAVAILABLE','REMOTE_FILE_NOT_FOUND')))
 OR EXISTS(SELECT 1 FROM payroll_retirement_receipt_observation WHERE allocation_id=NEW.authorization_id AND transport_status='READ')
 OR NEW.evidence->>'remoteStatus' IS DISTINCT FROM 'REMOTE_PATHS_ABSENT'
 THEN RAISE EXCEPTION 'Release requires scoped affirmative non-write and remote absence evidence.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_allocation_unsent_release ON payroll_retirement_allocation_unsent_release;
CREATE TRIGGER payroll_validate_retirement_allocation_unsent_release BEFORE INSERT ON payroll_retirement_allocation_unsent_release FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_allocation_unsent_release();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_allocation_unsent_release;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_allocation_unsent_release FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_retirement_allocation_disposition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a payroll_retirement_allocation_authorization%ROWTYPE;
BEGIN
 SELECT * INTO a FROM payroll_retirement_allocation_authorization WHERE id=NEW.authorization_id;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=a.facility_id FOR UPDATE;
 IF TG_TABLE_NAME='payroll_retirement_allocation_claim' THEN
  IF EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation WHERE authorization_id=a.id) OR EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation WHERE authorization_id=a.remittance_id) OR EXISTS(SELECT 1 FROM payroll_retirement_allocation_unsent_release WHERE authorization_id=a.id) THEN RAISE EXCEPTION 'Cancelled allocation cannot be claimed.'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM payroll_retirement_allocation_claim WHERE authorization_id=a.id) AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_unsent_release WHERE authorization_id=a.id) THEN RAISE EXCEPTION 'Claimed allocation requires outcome recovery.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_retirement_allocation_parent_cancel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_retirement_allocation_authorization a JOIN payroll_retirement_allocation_claim c ON c.authorization_id=a.id WHERE a.remittance_id=NEW.authorization_id AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_unsent_release r WHERE r.authorization_id=a.id)) THEN RAISE EXCEPTION 'Allocation dispatch has been claimed; retain its contribution reservation.'; END IF;
 RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS payroll_retirement_bank_unsent_release (
 id UUID PRIMARY KEY,authorization_id UUID NOT NULL UNIQUE REFERENCES payroll_retirement_remittance_authorization(id),facility_id BIGINT NOT NULL REFERENCES facility(id),submission_observation_id BIGINT NOT NULL REFERENCES payroll_retirement_remittance_observation(id),evidence JSONB NOT NULL,reference TEXT NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_bank_unsent_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_authorization a JOIN payroll_retirement_remittance_claim c ON c.authorization_id=a.id WHERE a.id=NEW.authorization_id AND a.facility_id=NEW.facility_id)
 OR NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_observation o WHERE o.id=NEW.submission_observation_id AND o.authorization_id=NEW.authorization_id AND o.source='SUBMISSION' AND o.result->'noSendProof'='true'::jsonb AND o.result->'submissionAttempted'='false'::jsonb AND o.result->>'status' IN ('UNCERTAIN','BLOCKED_ACCOUNT_LOOKUP','BLOCKED_ACCOUNT_VERIFICATION','BLOCKED_CUTOFF'))
 OR (SELECT count(*) FROM payroll_retirement_remittance_observation WHERE authorization_id=NEW.authorization_id AND source='SUBMISSION')<>1
 OR EXISTS(SELECT 1 FROM payroll_retirement_remittance_observation WHERE authorization_id=NEW.authorization_id AND (result->'submissionAttempted'='true'::jsonb OR result->>'providerId' IS NOT NULL OR result->'reused'='true'::jsonb OR COALESCE(result->>'status','') NOT IN ('UNCERTAIN','BLOCKED_ACCOUNT_LOOKUP','BLOCKED_ACCOUNT_VERIFICATION','BLOCKED_CUTOFF','NOT_FOUND','RECOVERY_UNAVAILABLE')))
 OR EXISTS(SELECT 1 FROM payroll_retirement_allocation_authorization a JOIN payroll_retirement_allocation_claim c ON c.authorization_id=a.id WHERE a.remittance_id=NEW.authorization_id AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_unsent_release r WHERE r.authorization_id=a.id))
 OR NEW.evidence->>'remoteStatus' IS DISTINCT FROM 'NOT_FOUND'
 THEN RAISE EXCEPTION 'Bank release requires scoped affirmative non-send evidence, provider absence and resolved allocation claims.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_bank_unsent_release ON payroll_retirement_bank_unsent_release;
CREATE TRIGGER payroll_validate_retirement_bank_unsent_release BEFORE INSERT ON payroll_retirement_bank_unsent_release FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_bank_unsent_release();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_bank_unsent_release;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_bank_unsent_release FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
CREATE OR REPLACE FUNCTION payroll_validate_retirement_remittance_disposition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE employer BIGINT;
BEGIN
 SELECT facility_id INTO employer FROM payroll_retirement_remittance_authorization WHERE id=NEW.authorization_id;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=employer FOR UPDATE;
 IF TG_TABLE_NAME='payroll_retirement_remittance_claim' THEN
  IF EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation WHERE authorization_id=NEW.authorization_id) OR EXISTS(SELECT 1 FROM payroll_retirement_bank_unsent_release WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled remittance cannot be claimed.'; END IF;
 ELSE
  IF NEW.facility_id IS DISTINCT FROM employer OR (EXISTS(SELECT 1 FROM payroll_retirement_remittance_claim WHERE authorization_id=NEW.authorization_id) AND NOT EXISTS(SELECT 1 FROM payroll_retirement_bank_unsent_release WHERE authorization_id=NEW.authorization_id)) THEN RAISE EXCEPTION 'Cancellation requires scoped unclaimed or verified unsent remittance.'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS payroll_retirement_receipt_contract (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),plan_id TEXT NOT NULL,plan_revision_id UUID NOT NULL REFERENCES payroll_retirement_plan_revision(id),allocation_format_id UUID NOT NULL REFERENCES payroll_retirement_allocation_format(id),revision INTEGER NOT NULL CHECK(revision>0),disposition TEXT NOT NULL CHECK(disposition IN ('REVIEWED','SUSPENDED')),contract JSONB NOT NULL,reference TEXT NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,plan_id,revision),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_receipt_contract() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest payroll_retirement_receipt_contract%ROWTYPE;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 SELECT * INTO latest FROM payroll_retirement_receipt_contract WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id ORDER BY revision DESC LIMIT 1;
 IF NEW.revision<>COALESCE(latest.revision,0)+1 THEN RAISE EXCEPTION 'Receipt contract revision changed.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision WHERE id=NEW.plan_revision_id AND facility_id=NEW.facility_id AND plan_id=NEW.plan_id) OR NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_format WHERE id=NEW.allocation_format_id AND facility_id=NEW.facility_id AND plan_id=NEW.plan_id AND plan_revision_id=NEW.plan_revision_id) THEN RAISE EXCEPTION 'Receipt contract requires scoped plan and allocation format.'; END IF;
 IF NEW.disposition='REVIEWED' THEN
  IF NEW.plan_revision_id IS DISTINCT FROM (SELECT id FROM payroll_retirement_plan_revision WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id AND tax_year=2026 ORDER BY revision DESC LIMIT 1) OR NEW.allocation_format_id IS DISTINCT FROM (SELECT id FROM payroll_retirement_allocation_format WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id ORDER BY revision DESC LIMIT 1) OR NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_format WHERE id=NEW.allocation_format_id AND format->>'disposition'='VERIFIED') THEN RAISE EXCEPTION 'Receipt review requires current verified sources.'; END IF;
 ELSIF latest.id IS NULL OR latest.disposition<>'REVIEWED' OR NEW.plan_revision_id<>latest.plan_revision_id OR NEW.allocation_format_id<>latest.allocation_format_id OR NEW.contract IS DISTINCT FROM latest.contract THEN RAISE EXCEPTION 'Suspension must preserve the latest reviewed receipt contract.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_receipt_contract ON payroll_retirement_receipt_contract;
CREATE TRIGGER payroll_validate_retirement_receipt_contract BEFORE INSERT ON payroll_retirement_receipt_contract FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_receipt_contract();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_receipt_contract;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_receipt_contract FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_receipt_binding (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),allocation_id UUID NOT NULL REFERENCES payroll_retirement_allocation_authorization(id),claim_id UUID NOT NULL REFERENCES payroll_retirement_allocation_claim(id),configuration_id UUID NOT NULL REFERENCES payroll_retirement_sftp_configuration(id),contract_id UUID NOT NULL REFERENCES payroll_retirement_receipt_contract(id),revision INTEGER NOT NULL CHECK(revision>0),disposition TEXT NOT NULL CHECK(disposition IN ('REVIEWED','SUSPENDED')),directory TEXT NOT NULL,file_name TEXT NOT NULL,reference TEXT NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,allocation_id,revision),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_receipt_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest payroll_retirement_receipt_binding%ROWTYPE; a payroll_retirement_allocation_authorization%ROWTYPE;r payroll_retirement_remittance_authorization%ROWTYPE;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 SELECT * INTO latest FROM payroll_retirement_receipt_binding WHERE facility_id=NEW.facility_id AND allocation_id=NEW.allocation_id ORDER BY revision DESC LIMIT 1;
 SELECT * INTO a FROM payroll_retirement_allocation_authorization WHERE id=NEW.allocation_id;
 SELECT * INTO r FROM payroll_retirement_remittance_authorization WHERE id=a.remittance_id;
 IF NEW.revision<>COALESCE(latest.revision,0)+1 OR a.id IS NULL OR a.facility_id<>NEW.facility_id OR a.configuration_id<>NEW.configuration_id OR NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_claim WHERE id=NEW.claim_id AND authorization_id=a.id) OR NOT EXISTS(SELECT 1 FROM payroll_retirement_receipt_contract WHERE id=NEW.contract_id AND facility_id=NEW.facility_id AND plan_id=r.plan_id AND plan_revision_id=r.plan_revision_id AND allocation_format_id=r.format_id AND disposition='REVIEWED') THEN RAISE EXCEPTION 'Receipt binding requires scoped original claim, setup, contract and current revision.'; END IF;
 IF NEW.disposition='REVIEWED' THEN
  IF EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation WHERE authorization_id=a.id) OR EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation WHERE authorization_id=r.id) OR (SELECT disposition FROM payroll_retirement_receipt_contract WHERE facility_id=NEW.facility_id AND plan_id=r.plan_id ORDER BY revision DESC LIMIT 1)='SUSPENDED' THEN RAISE EXCEPTION 'Cancelled allocation or suspended contract cannot bind new receipt interpretation.'; END IF;
 ELSIF latest.id IS NULL OR latest.disposition<>'REVIEWED' OR NEW.contract_id<>latest.contract_id OR NEW.directory<>latest.directory OR NEW.file_name<>latest.file_name OR NEW.claim_id<>latest.claim_id OR NEW.configuration_id<>latest.configuration_id THEN RAISE EXCEPTION 'Receipt suspension must preserve its original reviewed binding.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_receipt_binding ON payroll_retirement_receipt_binding;
CREATE TRIGGER payroll_validate_retirement_receipt_binding BEFORE INSERT ON payroll_retirement_receipt_binding FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_receipt_binding();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_receipt_binding;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_receipt_binding FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='payroll_retirement_receipt_location_shape' AND conrelid='payroll_retirement_receipt_binding'::regclass) THEN
 ALTER TABLE payroll_retirement_receipt_binding ADD CONSTRAINT payroll_retirement_receipt_location_shape CHECK(length(directory)<=512 AND directory ~ '^/([A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+$' AND length(file_name)<=124 AND file_name ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}\.csv$' AND position('..' in file_name)=0);
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS payroll_retirement_receipt_observation (
 id UUID PRIMARY KEY,sequence BIGSERIAL NOT NULL UNIQUE,facility_id BIGINT NOT NULL REFERENCES facility(id),allocation_id UUID NOT NULL REFERENCES payroll_retirement_allocation_authorization(id),binding_id UUID NOT NULL REFERENCES payroll_retirement_receipt_binding(id),request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,
 transport_status TEXT NOT NULL CHECK(transport_status IN ('READ','NOT_FOUND','CHANGED','UNSUPPORTED','UNAVAILABLE')),decision TEXT NOT NULL CHECK(decision IN ('NOT_EVALUATED','RECONCILIATION_REQUIRED','RECONCILED','STALE','CONFLICT','REGRESSION')),summary JSONB NOT NULL,encrypted_receipt BYTEA,encrypted_result BYTEA,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,request_key),
 CHECK((transport_status='READ')=(encrypted_receipt IS NOT NULL)),CHECK((decision IN ('RECONCILED','STALE','CONFLICT','REGRESSION'))=(encrypted_result IS NOT NULL)),CHECK((summary->>'decision') IS NOT DISTINCT FROM decision)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_receipt_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_receipt_binding b JOIN payroll_retirement_allocation_authorization a ON a.id=b.allocation_id JOIN payroll_retirement_allocation_claim c ON c.id=b.claim_id WHERE b.id=NEW.binding_id AND b.facility_id=NEW.facility_id AND b.allocation_id=NEW.allocation_id AND a.facility_id=NEW.facility_id AND c.authorization_id=a.id AND b.disposition='REVIEWED') THEN RAISE EXCEPTION 'Receipt observation requires its scoped original reviewed binding and claim.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_receipt_observation ON payroll_retirement_receipt_observation;
CREATE TRIGGER payroll_validate_retirement_receipt_observation BEFORE INSERT ON payroll_retirement_receipt_observation FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_receipt_observation();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_receipt_observation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_receipt_observation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();


-- Receipt checks run without inventing a human actor for scheduled work.
ALTER TABLE payroll_retirement_receipt_observation ADD COLUMN IF NOT EXISTS automatic BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payroll_retirement_receipt_observation ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE payroll_retirement_receipt_observation DROP CONSTRAINT IF EXISTS payroll_retirement_receipt_actor;
ALTER TABLE payroll_retirement_receipt_observation ADD CONSTRAINT payroll_retirement_receipt_actor CHECK((automatic AND created_by IS NULL) OR (NOT automatic AND created_by IS NOT NULL));

CREATE TABLE IF NOT EXISTS payroll_retirement_settlement_mapping (
 id BIGSERIAL PRIMARY KEY,
 plan_id TEXT NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,UNIQUE(facility_id,request_key),
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 payment_connection_id BIGINT NOT NULL REFERENCES payroll_payment_connection(id),
 connection_generation BIGINT NOT NULL CHECK(connection_generation>=0),
 realm_id TEXT NOT NULL CHECK(realm_id ~ '^[0-9]+$'),
 environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),
 details JSONB NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 500),
 created_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_retirement_settlement_mapping_facility ON payroll_retirement_settlement_mapping(facility_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_settlement_mapping() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_connection p WHERE p.id=NEW.payment_connection_id AND p.facility_id=NEW.facility_id AND p.mode=CASE WHEN NEW.environment='production' THEN 'LIVE' ELSE 'TEST' END) OR NOT EXISTS(SELECT 1 FROM payroll_quickbooks_connection q JOIN payroll_settings s ON s.facility_id=q.facility_id WHERE q.facility_id=NEW.facility_id AND q.realm_id=NEW.realm_id AND q.environment=NEW.environment AND s.quickbooks_connection_generation=NEW.connection_generation) THEN
  RAISE EXCEPTION 'Retirement settlement mapping requires matching employer funding and current accounting destination.' USING ERRCODE='23514';
 END IF;
 IF (NEW.details->>'version'='1' AND NEW.details->>'convention'='RETIREMENT_LIABILITY' AND NEW.details->>'fundingRevisionId'=NEW.payment_connection_id::text AND NEW.details->>'fundingAccountId' ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' AND NEW.details->'bank'->>'id' ~ '^[0-9]+$' AND NEW.details->'liability'->>'id' ~ '^[0-9]+$' AND NEW.details->'bank'->>'id'<>NEW.details->'liability'->>'id' AND NEW.details->'bank'->>'type'='Bank' AND NEW.details->'liability'->>'type'='Other Current Liability' AND NEW.details->'bank'->>'currency'='USD' AND NEW.details->'liability'->>'currency'='USD') IS NOT TRUE THEN
  RAISE EXCEPTION 'Retirement settlement mapping requires exact funding, bank and liability details.' USING ERRCODE='23514';
 END IF;
 IF NEW.details->>'planId' IS DISTINCT FROM NEW.plan_id OR NOT EXISTS(SELECT 1 FROM payroll_retirement_plan_revision WHERE facility_id=NEW.facility_id AND plan_id=NEW.plan_id) THEN RAISE EXCEPTION 'Retirement settlement mapping requires a scoped retained plan.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_settlement_mapping ON payroll_retirement_settlement_mapping;
CREATE TRIGGER payroll_validate_retirement_settlement_mapping BEFORE INSERT ON payroll_retirement_settlement_mapping FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_settlement_mapping();
DROP TRIGGER IF EXISTS payroll_guard_retirement_settlement_mapping ON payroll_retirement_settlement_mapping;
CREATE TRIGGER payroll_guard_retirement_settlement_mapping BEFORE UPDATE OR DELETE ON payroll_retirement_settlement_mapping FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();


CREATE TABLE IF NOT EXISTS payroll_retirement_settlement_authorization (
 id UUID PRIMARY KEY,payment_authorization_id UUID NOT NULL REFERENCES payroll_retirement_remittance_authorization(id),mapping_id BIGINT NOT NULL REFERENCES payroll_retirement_settlement_mapping(id),preview JSONB NOT NULL,fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),request_key TEXT NOT NULL,reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),auto_post BOOLEAN NOT NULL CHECK(auto_post),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(payment_authorization_id,request_key)
);
CREATE TABLE IF NOT EXISTS payroll_retirement_settlement_cancellation (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_retirement_settlement_authorization(id),reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_retirement_settlement_claim (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_retirement_settlement_authorization(id),created_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_settlement_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pay UUID; employer BIGINT;
BEGIN
 IF TG_TABLE_NAME='payroll_retirement_settlement_authorization' THEN pay:=NEW.payment_authorization_id;
 ELSE SELECT payment_authorization_id INTO pay FROM payroll_retirement_settlement_authorization WHERE id=NEW.authorization_id; END IF;
 SELECT p.facility_id INTO employer FROM payroll_retirement_remittance_authorization p WHERE p.id=pay;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=employer FOR UPDATE;
 IF TG_TABLE_NAME='payroll_retirement_settlement_authorization' THEN
  IF EXISTS(SELECT 1 FROM payroll_retirement_settlement_authorization a WHERE a.payment_authorization_id=pay AND NOT EXISTS(SELECT 1 FROM payroll_retirement_settlement_cancellation c WHERE c.authorization_id=a.id)) THEN RAISE EXCEPTION 'Retirement settlement already has an active authorization.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_claim WHERE authorization_id=pay) OR EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation WHERE authorization_id=pay) OR NOT EXISTS(SELECT 1 FROM payroll_retirement_settlement_mapping m JOIN payroll_retirement_remittance_authorization p ON p.id=pay WHERE m.id=NEW.mapping_id AND m.facility_id=employer AND m.payment_connection_id=(p.basis->>'fundingRevisionId')::bigint AND m.plan_id=p.plan_id AND m.details->'liability'->>'id'=NEW.preview->'accounts'->'liability'->>'id') THEN RAISE EXCEPTION 'Retirement settlement authorization requires scoped claimed payment and mapping.'; END IF;
  IF (NEW.preview->>'authorizationId'=pay::text AND NEW.preview->>'mappingId'=NEW.mapping_id::text AND NEW.preview->>'fingerprint'=NEW.fingerprint AND NEW.preview->>'status'='PREVIEW_ONLY' AND jsonb_typeof(NEW.preview->'journals')='array' AND jsonb_array_length(NEW.preview->'journals') BETWEEN 1 AND 10) IS NOT TRUE THEN RAISE EXCEPTION 'Retirement settlement authorization must bind its exact preview.'; END IF;
 ELSIF TG_TABLE_NAME='payroll_retirement_settlement_cancellation' THEN
  IF EXISTS(SELECT 1 FROM payroll_retirement_settlement_claim WHERE authorization_id=NEW.authorization_id) AND NOT EXISTS(SELECT 1 FROM payroll_retirement_settlement_release WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Claimed retirement settlement requires recovery.'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM payroll_retirement_settlement_cancellation WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled retirement settlement cannot be claimed.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tab TEXT; BEGIN FOREACH tab IN ARRAY ARRAY['payroll_retirement_settlement_authorization','payroll_retirement_settlement_cancellation','payroll_retirement_settlement_claim'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_validate_retirement_settlement_authorization ON %I',tab);
 EXECUTE format('CREATE TRIGGER payroll_validate_retirement_settlement_authorization BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_settlement_authorization()',tab);
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',tab);
 EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',tab);
END LOOP; END $$;

CREATE TABLE IF NOT EXISTS payroll_retirement_settlement_journal (
 id UUID PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_retirement_settlement_claim(authorization_id),facility_id BIGINT NOT NULL REFERENCES facility(id),realm_id TEXT NOT NULL,environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),event_key TEXT NOT NULL,payload JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,realm_id,environment,event_key)
);
CREATE TABLE IF NOT EXISTS payroll_retirement_settlement_observation (
 id BIGSERIAL PRIMARY KEY,journal_id UUID NOT NULL REFERENCES payroll_retirement_settlement_journal(id),source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),result JSONB NOT NULL,create_attempted BOOLEAN NOT NULL DEFAULT false CHECK(NOT create_attempted OR source='SUBMISSION'),created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_settlement_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_settlement_authorization a JOIN payroll_retirement_remittance_authorization p ON p.id=a.payment_authorization_id WHERE a.id=NEW.authorization_id AND p.facility_id=NEW.facility_id AND a.preview->>'realmId'=NEW.realm_id AND a.preview->>'environment'=NEW.environment AND EXISTS(SELECT 1 FROM jsonb_array_elements(a.preview->'journals') j WHERE j->'event'->>'key'=NEW.event_key AND j->'payload'=NEW.payload)) THEN RAISE EXCEPTION 'Retirement settlement journal must match its retained employer and event payload.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_settlement_journal ON payroll_retirement_settlement_journal;
CREATE TRIGGER payroll_validate_retirement_settlement_journal BEFORE INSERT ON payroll_retirement_settlement_journal FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_settlement_journal();
DO $$ DECLARE tab TEXT; BEGIN FOREACH tab IN ARRAY ARRAY['payroll_retirement_settlement_journal','payroll_retirement_settlement_observation'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',tab);
 EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',tab);
END LOOP; END $$;
CREATE TABLE IF NOT EXISTS payroll_retirement_settlement_attempt (
 id BIGSERIAL PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_retirement_settlement_authorization(id),status TEXT NOT NULL CHECK(status IN ('SYNCED','NEEDS_REVIEW','BLOCKED')),message TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_settlement_attempt;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_settlement_attempt FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_contribution_assessment (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 authorization_id UUID NOT NULL REFERENCES payroll_retirement_remittance_authorization(id),
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 summary JSONB NOT NULL,
 created_by BIGINT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_retirement_contribution_assessment_history ON payroll_retirement_contribution_assessment(facility_id,authorization_id,id DESC);
CREATE TABLE IF NOT EXISTS payroll_retirement_contribution_checkpoint (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_retirement_remittance_authorization(id),
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 assessment_id BIGINT NOT NULL REFERENCES payroll_retirement_contribution_assessment(id),
 checked_at TIMESTAMPTZ NOT NULL
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_contribution_assessment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_authorization a WHERE a.id=NEW.authorization_id AND a.facility_id=NEW.facility_id) THEN
  RAISE EXCEPTION 'Contribution assessment requires a scoped retirement authorization.';
 END IF;
 IF TG_TABLE_NAME='payroll_retirement_contribution_assessment' THEN
  IF (jsonb_typeof(NEW.summary)='object' AND NEW.summary->>'authorizationId'=NEW.authorization_id::text AND NEW.summary->>'status' IN ('REVIEW_REQUIRED','RECONCILED','REPLACEMENT_RECONCILED','CANCELLED') AND jsonb_typeof(NEW.summary->'issues')='array' AND NEW.summary->>'amountCents'=(SELECT amount_cents::text FROM payroll_retirement_remittance_authorization WHERE id=NEW.authorization_id)) IS NOT TRUE THEN
   RAISE EXCEPTION 'Contribution assessment must retain its exact authorization and amount.';
  END IF;
  IF NEW.summary->>'status'='RECONCILED' AND (NEW.summary->>'payrollStatus'='MATCHED' AND NEW.summary->>'bankStatus'='BANK_POSTED' AND NEW.summary->>'receiptStatus'='POSTED' AND NEW.summary->>'accountingStatus'='MATCHED' AND COALESCE(NEW.summary->>'returnAccountingStatus','NOT_REQUIRED')='NOT_REQUIRED' AND COALESCE(NEW.summary->>'returnReviewRequired','false')='false' AND NEW.summary->>'postedCents'=NEW.summary->>'amountCents' AND NEW.summary->'issues'='[]'::jsonb) IS NOT TRUE THEN
   RAISE EXCEPTION 'Reconciled contribution requires matching evidence in every component.';
  END IF;
  IF NEW.summary->>'status'='REPLACEMENT_RECONCILED' AND (
   NEW.summary->>'replacementCaseStatus'='CLOSED' AND NEW.summary->>'returnReviewRequired'='false' AND NEW.summary->>'payrollStatus'='MATCHED' AND NEW.summary->>'bankStatus'='RETURN_CREDIT_POSTED' AND NEW.summary->>'receiptStatus'='REVERSED' AND NEW.summary->>'returnAccountingStatus'='MATCHED' AND NEW.summary->>'reversedAllocationCents'=NEW.summary->>'amountCents' AND NEW.summary->'issues'='[]'::jsonb
   AND NEW.summary->'replacementEvidence'->>'originalAuthorizationId'=NEW.authorization_id::text AND NEW.summary->'replacementEvidence'->>'status'='RECONCILED' AND NEW.summary->'replacementEvidence'->>'caseStatus'='CLOSED' AND NEW.summary->'replacementEvidence'->>'originalEvidenceStatus'='MATCHED' AND NEW.summary->'replacementEvidence'->>'bankStatus'='BANK_POSTED' AND NEW.summary->'replacementEvidence'->>'receiptStatus'='POSTED' AND NEW.summary->'replacementEvidence'->>'deliveryStatus'='MATCHED' AND NEW.summary->'replacementEvidence'->>'accountingStatus'='MATCHED' AND NEW.summary->'replacementEvidence'->>'returnReviewRequired'='false' AND NEW.summary->'replacementEvidence'->>'amountCents'=NEW.summary->>'amountCents' AND NEW.summary->'replacementEvidence'->>'postedCents'=NEW.summary->>'amountCents'
   AND EXISTS(SELECT 1 FROM payroll_retirement_replacement_authorization r WHERE r.id::text=NEW.summary->'replacementEvidence'->>'authorizationId' AND r.original_authorization_id=NEW.authorization_id AND r.facility_id=NEW.facility_id AND NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_cancellation c WHERE c.authorization_id=r.id))
  ) IS NOT TRUE THEN RAISE EXCEPTION 'Replacement closure requires matching original return, scoped replacement and accounting evidence.'; END IF;
 ELSE
  IF TG_OP='UPDATE' AND (NEW.authorization_id<>OLD.authorization_id OR NEW.facility_id<>OLD.facility_id OR NEW.checked_at<OLD.checked_at) THEN
   RAISE EXCEPTION 'Contribution checkpoint identity and time cannot move backwards.';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM payroll_retirement_contribution_assessment h WHERE h.id=NEW.assessment_id AND h.facility_id=NEW.facility_id AND h.authorization_id=NEW.authorization_id AND h.created_at<=NEW.checked_at AND NOT EXISTS(SELECT 1 FROM payroll_retirement_contribution_assessment newer WHERE newer.authorization_id=h.authorization_id AND newer.id>h.id)) THEN
   RAISE EXCEPTION 'Contribution checkpoint requires the latest scoped assessment.';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_contribution_assessment ON payroll_retirement_contribution_assessment;
CREATE TRIGGER payroll_validate_retirement_contribution_assessment BEFORE INSERT ON payroll_retirement_contribution_assessment FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_contribution_assessment();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_contribution_assessment;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_contribution_assessment FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
DROP TRIGGER IF EXISTS payroll_validate_retirement_contribution_assessment ON payroll_retirement_contribution_checkpoint;
CREATE TRIGGER payroll_validate_retirement_contribution_assessment BEFORE INSERT OR UPDATE ON payroll_retirement_contribution_checkpoint FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_contribution_assessment();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_contribution_checkpoint;
CREATE TRIGGER payroll_guard_payment_connection BEFORE DELETE ON payroll_retirement_contribution_checkpoint FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_contribution_failure (
 id BIGSERIAL PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),
 authorization_id UUID NOT NULL REFERENCES payroll_retirement_remittance_authorization(id),
 message TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS payroll_retirement_contribution_failure_history ON payroll_retirement_contribution_failure(facility_id,authorization_id,id DESC);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_contribution_failure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_authorization WHERE id=NEW.authorization_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Contribution failure requires a scoped retirement authorization.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_contribution_failure ON payroll_retirement_contribution_failure;
CREATE TRIGGER payroll_validate_retirement_contribution_failure BEFORE INSERT ON payroll_retirement_contribution_failure FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_contribution_failure();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_contribution_failure;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_contribution_failure FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_settlement_release (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_retirement_settlement_claim(authorization_id),
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 evidence JSONB NOT NULL CHECK(jsonb_typeof(evidence)='array'),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_settlement_release() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected INTEGER; job RECORD;
BEGIN
 PERFORM s.facility_id FROM payroll_settings s JOIN payroll_retirement_remittance_authorization p ON p.facility_id=s.facility_id JOIN payroll_retirement_settlement_authorization a ON a.payment_authorization_id=p.id WHERE a.id=NEW.authorization_id FOR UPDATE OF s;
 SELECT jsonb_array_length(preview->'journals') INTO expected FROM payroll_retirement_settlement_authorization WHERE id=NEW.authorization_id;
 IF expected IS NULL OR expected<1 OR jsonb_array_length(NEW.evidence)<>expected OR (SELECT count(*) FROM payroll_retirement_settlement_journal WHERE authorization_id=NEW.authorization_id)<>expected THEN RAISE EXCEPTION 'Release requires every original journal.'; END IF;
 FOR job IN SELECT * FROM payroll_retirement_settlement_journal WHERE authorization_id=NEW.authorization_id LOOP
  IF (SELECT count(*) FROM payroll_retirement_settlement_observation WHERE journal_id=job.id AND source='SUBMISSION')<>1 OR (SELECT source FROM payroll_retirement_settlement_observation WHERE journal_id=job.id ORDER BY id LIMIT 1) IS DISTINCT FROM 'SUBMISSION' OR EXISTS(SELECT 1 FROM payroll_retirement_settlement_observation WHERE journal_id=job.id AND source='RECOVERY' AND result->>'status' IS DISTINCT FROM 'NOT_FOUND') OR (SELECT count(*) FROM payroll_retirement_settlement_observation WHERE journal_id=job.id AND source='SUBMISSION' AND NOT create_attempted AND result->>'status'='NOT_SENT')<>1 OR EXISTS(SELECT 1 FROM payroll_retirement_settlement_observation WHERE journal_id=job.id AND (create_attempted OR result->>'status' IS NULL OR result->>'status' NOT IN ('NOT_SENT','NOT_FOUND'))) THEN RAISE EXCEPTION 'Release requires affirmative non-send without contradictory observations.'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(NEW.evidence) e WHERE e->>'journalId'=job.id::text AND EXISTS(SELECT 1 FROM payroll_retirement_settlement_observation o WHERE o.id::text=e->>'observationId' AND o.journal_id=job.id AND o.source='RECOVERY' AND NOT o.create_attempted AND o.result->>'status'='NOT_FOUND' AND NOT EXISTS(SELECT 1 FROM payroll_retirement_settlement_observation newer WHERE newer.journal_id=job.id AND newer.id>o.id)))<>1 THEN RAISE EXCEPTION 'Release requires latest retained journal absence.'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_settlement_release ON payroll_retirement_settlement_release;
CREATE TRIGGER payroll_validate_retirement_settlement_release BEFORE INSERT ON payroll_retirement_settlement_release FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_settlement_release();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_settlement_release;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_settlement_release FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

-- Preserve every old job while allowing a new authorization to reserve an
-- event only after its original claimed authorization has proven release.
DO $$ DECLARE c RECORD; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='payroll_retirement_settlement_journal'::regclass AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (facility_id, realm_id, environment, event_key)' LOOP
  EXECUTE format('ALTER TABLE payroll_retirement_settlement_journal DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_retirement_settlement_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_retirement_settlement_journal j WHERE j.facility_id=NEW.facility_id AND j.realm_id=NEW.realm_id AND j.environment=NEW.environment AND j.event_key=NEW.event_key AND NOT EXISTS(SELECT 1 FROM payroll_retirement_settlement_release r JOIN payroll_retirement_settlement_cancellation c ON c.authorization_id=r.authorization_id WHERE r.authorization_id=j.authorization_id)) THEN RAISE EXCEPTION 'Retirement bank event already has an unreleased settlement journal.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_retirement_settlement_event ON payroll_retirement_settlement_journal;
CREATE TRIGGER payroll_guard_retirement_settlement_event BEFORE INSERT ON payroll_retirement_settlement_journal FOR EACH ROW EXECUTE FUNCTION payroll_guard_retirement_settlement_event();

CREATE TABLE IF NOT EXISTS payroll_retirement_return_authorization (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),
 payment_authorization_id UUID NOT NULL REFERENCES payroll_retirement_remittance_authorization(id),
 original_settlement_id UUID NOT NULL REFERENCES payroll_retirement_settlement_authorization(id),
 preview JSONB NOT NULL,fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 request_key UUID NOT NULL,reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),
 auto_post BOOLEAN NOT NULL CHECK(auto_post),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,request_key)
);
CREATE TABLE IF NOT EXISTS payroll_retirement_return_cancellation (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_retirement_return_authorization(id),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_retirement_return_claim (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_retirement_return_authorization(id),created_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_return_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE employer BIGINT;
BEGIN
 IF TG_TABLE_NAME='payroll_retirement_return_authorization' THEN employer:=NEW.facility_id;
 ELSE SELECT facility_id INTO employer FROM payroll_retirement_return_authorization WHERE id=NEW.authorization_id; END IF;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=employer FOR UPDATE;
 IF TG_TABLE_NAME='payroll_retirement_return_authorization' THEN
  IF NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_authorization p JOIN payroll_retirement_settlement_authorization s ON s.payment_authorization_id=p.id WHERE p.id=NEW.payment_authorization_id AND p.facility_id=employer AND s.id=NEW.original_settlement_id AND NOT EXISTS(SELECT 1 FROM payroll_retirement_settlement_cancellation c WHERE c.authorization_id=s.id)) THEN RAISE EXCEPTION 'Return approval requires its scoped active original settlement.'; END IF;
  IF EXISTS(SELECT 1 FROM payroll_retirement_return_authorization a WHERE a.payment_authorization_id=NEW.payment_authorization_id AND NOT EXISTS(SELECT 1 FROM payroll_retirement_return_cancellation c WHERE c.authorization_id=a.id)) THEN RAISE EXCEPTION 'Contribution already has an active return approval.'; END IF;
  IF (NEW.preview->>'status'='RETURN_PREVIEW_ONLY' AND NEW.preview->>'fingerprint'=NEW.fingerprint AND NEW.preview->>'paymentAuthorizationId'=NEW.payment_authorization_id::text AND NEW.preview->'source'->>'authorizationId'=NEW.original_settlement_id::text AND NEW.preview->'event'->>'authorizationId'=NEW.payment_authorization_id::text AND NEW.preview->'event'->>'kind'='RETIREMENT_RETURN_CREDIT' AND NEW.preview->'event'->>'facilityId'=employer::text AND NEW.preview->>'amountCents'=(SELECT amount_cents::text FROM payroll_retirement_remittance_authorization WHERE id=NEW.payment_authorization_id) AND jsonb_typeof(NEW.preview->'payload'->'Line')='array' AND jsonb_array_length(NEW.preview->'payload'->'Line')=2) IS NOT TRUE THEN RAISE EXCEPTION 'Return approval must bind exact employer contribution and journal evidence.'; END IF;
 ELSIF TG_TABLE_NAME='payroll_retirement_return_cancellation' THEN
  IF EXISTS(SELECT 1 FROM payroll_retirement_return_claim WHERE authorization_id=NEW.authorization_id) AND NOT EXISTS(SELECT 1 FROM payroll_retirement_return_release WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Claimed return accounting requires recovery.'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM payroll_retirement_return_cancellation WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled return accounting cannot be claimed.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tab TEXT; BEGIN FOREACH tab IN ARRAY ARRAY['payroll_retirement_return_authorization','payroll_retirement_return_cancellation','payroll_retirement_return_claim'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_validate_retirement_return_authorization ON %I',tab);
 EXECUTE format('CREATE TRIGGER payroll_validate_retirement_return_authorization BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_return_authorization()',tab);
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',tab);
 EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',tab);
END LOOP; END $$;

CREATE TABLE IF NOT EXISTS payroll_retirement_return_journal (
 id UUID PRIMARY KEY,authorization_id UUID NOT NULL UNIQUE REFERENCES payroll_retirement_return_claim(authorization_id),
 facility_id BIGINT NOT NULL REFERENCES facility(id),realm_id TEXT NOT NULL,environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),
 event_key TEXT NOT NULL,payload JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,realm_id,environment,event_key)
);
CREATE TABLE IF NOT EXISTS payroll_retirement_return_observation (
 id BIGSERIAL PRIMARY KEY,journal_id UUID NOT NULL REFERENCES payroll_retirement_return_journal(id),
 source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),result JSONB NOT NULL,
 create_attempted BOOLEAN NOT NULL CHECK(NOT create_attempted OR source='SUBMISSION'),created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_return_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_return_authorization a WHERE a.id=NEW.authorization_id AND a.facility_id=NEW.facility_id AND a.preview->>'realmId'=NEW.realm_id AND a.preview->>'environment'=NEW.environment AND a.preview->'event'->>'key'=NEW.event_key AND a.preview->'payload'=NEW.payload) THEN RAISE EXCEPTION 'Return journal requires exact retained employer, company and payload.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_return_journal ON payroll_retirement_return_journal;
CREATE TRIGGER payroll_validate_retirement_return_journal BEFORE INSERT ON payroll_retirement_return_journal FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_return_journal();
DO $$ DECLARE tab TEXT; BEGIN FOREACH tab IN ARRAY ARRAY['payroll_retirement_return_journal','payroll_retirement_return_observation'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',tab);
 EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',tab);
END LOOP; END $$;

CREATE TABLE IF NOT EXISTS payroll_retirement_return_attempt (
 id BIGSERIAL PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_retirement_return_authorization(id),
 status TEXT NOT NULL CHECK(status IN ('SYNCED','NEEDS_REVIEW','BLOCKED')),message TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_return_attempt;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_return_attempt FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_return_release (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_retirement_return_claim(authorization_id),
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 evidence JSONB NOT NULL CHECK(jsonb_typeof(evidence)='array'),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 12 AND 2000),
 created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_return_release() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected INTEGER; job RECORD;
BEGIN
 PERFORM s.facility_id FROM payroll_settings s JOIN payroll_retirement_remittance_authorization p ON p.facility_id=s.facility_id JOIN payroll_retirement_return_authorization a ON a.payment_authorization_id=p.id WHERE a.id=NEW.authorization_id FOR UPDATE OF s;
 SELECT 1 INTO expected FROM payroll_retirement_return_authorization WHERE id=NEW.authorization_id;
 IF expected IS NULL OR expected<1 OR jsonb_array_length(NEW.evidence)<>expected OR (SELECT count(*) FROM payroll_retirement_return_journal WHERE authorization_id=NEW.authorization_id)<>expected THEN RAISE EXCEPTION 'Release requires every original journal.'; END IF;
 FOR job IN SELECT * FROM payroll_retirement_return_journal WHERE authorization_id=NEW.authorization_id LOOP
  IF (SELECT count(*) FROM payroll_retirement_return_observation WHERE journal_id=job.id AND source='SUBMISSION')<>1 OR (SELECT source FROM payroll_retirement_return_observation WHERE journal_id=job.id ORDER BY id LIMIT 1) IS DISTINCT FROM 'SUBMISSION' OR EXISTS(SELECT 1 FROM payroll_retirement_return_observation WHERE journal_id=job.id AND source='RECOVERY' AND result->>'status' IS DISTINCT FROM 'NOT_FOUND') OR (SELECT count(*) FROM payroll_retirement_return_observation WHERE journal_id=job.id AND source='SUBMISSION' AND NOT create_attempted AND result->>'status'='NOT_SENT')<>1 OR EXISTS(SELECT 1 FROM payroll_retirement_return_observation WHERE journal_id=job.id AND (create_attempted OR result->>'status' IS NULL OR result->>'status' NOT IN ('NOT_SENT','NOT_FOUND'))) THEN RAISE EXCEPTION 'Release requires affirmative non-send without contradictory observations.'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(NEW.evidence) e WHERE e->>'journalId'=job.id::text AND EXISTS(SELECT 1 FROM payroll_retirement_return_observation o WHERE o.id::text=e->>'observationId' AND o.journal_id=job.id AND o.source='RECOVERY' AND NOT o.create_attempted AND o.result->>'status'='NOT_FOUND' AND NOT EXISTS(SELECT 1 FROM payroll_retirement_return_observation newer WHERE newer.journal_id=job.id AND newer.id>o.id)))<>1 THEN RAISE EXCEPTION 'Release requires latest retained journal absence.'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_settlement_release ON payroll_retirement_return_release;
DROP TRIGGER IF EXISTS payroll_validate_retirement_return_release ON payroll_retirement_return_release;
CREATE TRIGGER payroll_validate_retirement_return_release BEFORE INSERT ON payroll_retirement_return_release FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_return_release();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_return_release;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_return_release FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

-- Preserve every old job while allowing a new authorization to reserve an
-- event only after its original claimed authorization has proven release.
DO $$ DECLARE c RECORD; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='payroll_retirement_return_journal'::regclass AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (facility_id, realm_id, environment, event_key)' LOOP
  EXECUTE format('ALTER TABLE payroll_retirement_return_journal DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_retirement_return_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_retirement_return_journal j WHERE j.facility_id=NEW.facility_id AND j.realm_id=NEW.realm_id AND j.environment=NEW.environment AND j.event_key=NEW.event_key AND NOT EXISTS(SELECT 1 FROM payroll_retirement_return_release r JOIN payroll_retirement_return_cancellation c ON c.authorization_id=r.authorization_id WHERE r.authorization_id=j.authorization_id)) THEN RAISE EXCEPTION 'Retirement bank event already has an unreleased return journal.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_retirement_return_event ON payroll_retirement_return_journal;
CREATE TRIGGER payroll_guard_retirement_return_event BEFORE INSERT ON payroll_retirement_return_journal FOR EACH ROW EXECUTE FUNCTION payroll_guard_retirement_return_event();


CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_authorization (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),
 original_authorization_id UUID NOT NULL REFERENCES payroll_retirement_remittance_authorization(id),
 return_authorization_id UUID NOT NULL REFERENCES payroll_retirement_return_authorization(id),
 receipt_id UUID NOT NULL REFERENCES payroll_retirement_receipt_observation(id),
 file_name TEXT NOT NULL CHECK(file_name ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}\.csv$' AND position('..' in file_name)=0),
 preview JSONB NOT NULL,fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 encrypted_allocation BYTEA NOT NULL,inputs JSONB NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,
 auto_process BOOLEAN NOT NULL CHECK(auto_process),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,request_key),UNIQUE(facility_id,file_name)
);
CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_cancellation (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_retirement_replacement_authorization(id),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 20 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_claim (
 authorization_id UUID NOT NULL REFERENCES payroll_retirement_replacement_authorization(id),
 kind TEXT NOT NULL CHECK(kind IN ('BANK','ALLOCATION')),created_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(authorization_id,kind)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_replacement_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_authorization p JOIN payroll_retirement_return_authorization r ON r.payment_authorization_id=p.id JOIN payroll_retirement_receipt_observation o ON o.id=NEW.receipt_id JOIN payroll_retirement_allocation_authorization d ON d.id=o.allocation_id WHERE p.id=NEW.original_authorization_id AND p.facility_id=NEW.facility_id AND r.id=NEW.return_authorization_id AND r.facility_id=NEW.facility_id AND r.fingerprint=NEW.preview->>'returnFingerprint' AND d.remittance_id=p.id AND o.facility_id=NEW.facility_id AND o.decision='RECONCILED' AND o.summary->>'status'='REVERSED' AND NOT EXISTS(SELECT 1 FROM payroll_retirement_return_cancellation c WHERE c.authorization_id=r.id)) THEN RAISE EXCEPTION 'Replacement requires scoped original return and participant reversal evidence.'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_retirement_replacement_authorization a WHERE a.original_authorization_id=NEW.original_authorization_id AND NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_cancellation c WHERE c.authorization_id=a.id)) THEN RAISE EXCEPTION 'An active replacement already reserves this contribution.'; END IF;
 IF (NEW.preview->>'status'='REPLACEMENT_PREVIEW_ONLY' AND NEW.preview->>'fingerprint'=NEW.fingerprint AND NEW.preview->>'originalAuthorizationId'=NEW.original_authorization_id::text AND NEW.preview->>'returnAuthorizationId'=NEW.return_authorization_id::text AND NEW.preview->>'receiptId'=NEW.receipt_id::text AND NEW.preview->>'fileName'=NEW.file_name AND NEW.preview->>'amountCents'=(SELECT amount_cents::text FROM payroll_retirement_remittance_authorization WHERE id=NEW.original_authorization_id) AND NEW.preview->>'newAllocationRequired'='true' AND NEW.preview->>'priorBatchReversedConfirmed'='true' AND NEW.preview->>'outsideActivityReviewed'='true' AND NEW.preview->>'lateCorrectionReviewed'='true') IS NOT TRUE THEN RAISE EXCEPTION 'Replacement approval must retain the exact reviewed instruction evidence.'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_validate_retirement_replacement_disposition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM s.facility_id FROM payroll_settings s JOIN payroll_retirement_replacement_authorization a ON a.facility_id=s.facility_id WHERE a.id=NEW.authorization_id FOR UPDATE OF s;
 IF TG_TABLE_NAME='payroll_retirement_replacement_claim' THEN
  IF EXISTS(SELECT 1 FROM payroll_retirement_replacement_cancellation WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled replacement cannot be claimed.'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM payroll_retirement_replacement_claim WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Claimed replacement requires outcome recovery.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_retirement_allocation_filename() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_retirement_allocation_authorization WHERE facility_id=NEW.facility_id AND file_name=NEW.file_name) OR EXISTS(SELECT 1 FROM payroll_retirement_replacement_authorization WHERE facility_id=NEW.facility_id AND file_name=NEW.file_name) THEN RAISE EXCEPTION 'Use a never-reserved retirement allocation filename.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_replacement_authorization ON payroll_retirement_replacement_authorization;
CREATE TRIGGER payroll_validate_retirement_replacement_authorization BEFORE INSERT ON payroll_retirement_replacement_authorization FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_replacement_authorization();
DO $$ DECLARE tab TEXT; BEGIN
 FOREACH tab IN ARRAY ARRAY['payroll_retirement_replacement_claim','payroll_retirement_replacement_cancellation'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_validate_retirement_replacement_disposition ON %I',tab);
  EXECUTE format('CREATE TRIGGER payroll_validate_retirement_replacement_disposition BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_replacement_disposition()',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['payroll_retirement_replacement_authorization','payroll_retirement_replacement_claim','payroll_retirement_replacement_cancellation'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',tab);
  EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['payroll_retirement_replacement_authorization','payroll_retirement_allocation_authorization'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_retirement_allocation_filename ON %I',tab);
  EXECUTE format('CREATE TRIGGER payroll_guard_retirement_allocation_filename BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_retirement_allocation_filename()',tab);
 END LOOP;
END $$;

ALTER TABLE payroll_retirement_replacement_claim ADD COLUMN IF NOT EXISTS review_reference TEXT CHECK(review_reference IS NULL OR length(trim(review_reference)) BETWEEN 20 AND 2000);
CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_observation (
 id BIGSERIAL PRIMARY KEY,authorization_id UUID NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('BANK','ALLOCATION')),
 source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),result JSONB NOT NULL,created_by BIGINT,
 automatic BOOLEAN NOT NULL DEFAULT false CHECK(NOT automatic OR created_by IS NULL),created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(authorization_id,kind) REFERENCES payroll_retirement_replacement_claim(authorization_id,kind)
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_replacement_observation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_replacement_observation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_attempt (
 id BIGSERIAL PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_retirement_replacement_authorization(id),
 kind TEXT NOT NULL CHECK(kind IN ('BANK','ALLOCATION')),status TEXT NOT NULL,message TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_replacement_attempt;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_replacement_attempt FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
ALTER TABLE payroll_retirement_replacement_claim ADD COLUMN IF NOT EXISTS automatic BOOLEAN NOT NULL DEFAULT false CHECK(NOT automatic OR created_by IS NULL);

ALTER TABLE payroll_retirement_replacement_claim ADD COLUMN IF NOT EXISTS encrypted_instruction BYTEA;

CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_receipt_binding (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),allocation_id UUID NOT NULL REFERENCES payroll_retirement_replacement_authorization(id),claim_id UUID NOT NULL REFERENCES payroll_retirement_replacement_authorization(id),configuration_id UUID NOT NULL REFERENCES payroll_retirement_sftp_configuration(id),contract_id UUID NOT NULL REFERENCES payroll_retirement_receipt_contract(id),revision INTEGER NOT NULL CHECK(revision>0),disposition TEXT NOT NULL CHECK(disposition IN ('REVIEWED','SUSPENDED')),directory TEXT NOT NULL,file_name TEXT NOT NULL,reference TEXT NOT NULL,request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,allocation_id,revision),UNIQUE(facility_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_replacement_receipt_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest payroll_retirement_replacement_receipt_binding%ROWTYPE;a payroll_retirement_replacement_authorization%ROWTYPE;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 SELECT * INTO latest FROM payroll_retirement_replacement_receipt_binding WHERE facility_id=NEW.facility_id AND allocation_id=NEW.allocation_id ORDER BY revision DESC LIMIT 1;
 SELECT * INTO a FROM payroll_retirement_replacement_authorization WHERE id=NEW.allocation_id;
 IF NEW.revision<>COALESCE(latest.revision,0)+1 OR a.id IS NULL OR a.facility_id<>NEW.facility_id OR a.preview->>'configurationId'<>NEW.configuration_id::text OR NEW.claim_id<>a.id OR NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_claim WHERE authorization_id=a.id AND kind='ALLOCATION') OR NOT EXISTS(SELECT 1 FROM payroll_retirement_receipt_contract WHERE id=NEW.contract_id AND facility_id=NEW.facility_id AND plan_id=a.preview->>'planId' AND plan_revision_id::text=a.preview->'allocation'->>'planRevisionId' AND allocation_format_id::text=a.preview->'allocation'->>'formatId' AND disposition='REVIEWED') THEN RAISE EXCEPTION 'Replacement receipt binding requires scoped claim, setup, contract and current revision.'; END IF;
 IF NEW.disposition='REVIEWED' THEN
  IF EXISTS(SELECT 1 FROM payroll_retirement_replacement_cancellation WHERE authorization_id=a.id) OR (SELECT disposition FROM payroll_retirement_receipt_contract WHERE facility_id=NEW.facility_id AND plan_id=a.preview->>'planId' ORDER BY revision DESC LIMIT 1)='SUSPENDED' THEN RAISE EXCEPTION 'Cancelled replacement or suspended contract cannot bind receipt interpretation.'; END IF;
 ELSIF latest.id IS NULL OR latest.disposition<>'REVIEWED' OR NEW.contract_id<>latest.contract_id OR NEW.directory<>latest.directory OR NEW.file_name<>latest.file_name OR NEW.claim_id<>latest.claim_id OR NEW.configuration_id<>latest.configuration_id THEN RAISE EXCEPTION 'Replacement receipt suspension must preserve its reviewed binding.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_replacement_receipt_binding ON payroll_retirement_replacement_receipt_binding;
CREATE TRIGGER payroll_validate_retirement_replacement_receipt_binding BEFORE INSERT ON payroll_retirement_replacement_receipt_binding FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_replacement_receipt_binding();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_replacement_receipt_binding;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_replacement_receipt_binding FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();


CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_receipt_observation (
 id UUID PRIMARY KEY,sequence BIGSERIAL NOT NULL UNIQUE,facility_id BIGINT NOT NULL REFERENCES facility(id),allocation_id UUID NOT NULL REFERENCES payroll_retirement_replacement_authorization(id),binding_id UUID NOT NULL REFERENCES payroll_retirement_replacement_receipt_binding(id),request_key UUID NOT NULL,request_fingerprint TEXT NOT NULL,
 transport_status TEXT NOT NULL CHECK(transport_status IN ('READ','NOT_FOUND','CHANGED','UNSUPPORTED','UNAVAILABLE')),decision TEXT NOT NULL CHECK(decision IN ('NOT_EVALUATED','RECONCILIATION_REQUIRED','RECONCILED','STALE','CONFLICT','REGRESSION')),summary JSONB NOT NULL,encrypted_receipt BYTEA,encrypted_result BYTEA,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,request_key),
 CHECK((transport_status='READ')=(encrypted_receipt IS NOT NULL)),CHECK((decision IN ('RECONCILED','STALE','CONFLICT','REGRESSION'))=(encrypted_result IS NOT NULL)),CHECK((summary->>'decision') IS NOT DISTINCT FROM decision)
);
CREATE OR REPLACE FUNCTION payroll_validate_retirement_replacement_receipt_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_receipt_binding b JOIN payroll_retirement_replacement_authorization a ON a.id=b.allocation_id JOIN payroll_retirement_replacement_claim c ON c.authorization_id=b.claim_id AND c.kind='ALLOCATION' WHERE b.id=NEW.binding_id AND b.facility_id=NEW.facility_id AND b.allocation_id=NEW.allocation_id AND a.facility_id=NEW.facility_id AND c.authorization_id=a.id AND b.disposition='REVIEWED') THEN RAISE EXCEPTION 'Receipt observation requires its scoped original reviewed binding and claim.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_retirement_replacement_receipt_observation ON payroll_retirement_replacement_receipt_observation;
CREATE TRIGGER payroll_validate_retirement_replacement_receipt_observation BEFORE INSERT ON payroll_retirement_replacement_receipt_observation FOR EACH ROW EXECUTE FUNCTION payroll_validate_retirement_replacement_receipt_observation();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_replacement_receipt_observation;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_replacement_receipt_observation FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();


-- Receipt checks run without inventing a human actor for scheduled work.
ALTER TABLE payroll_retirement_replacement_receipt_observation ADD COLUMN IF NOT EXISTS automatic BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payroll_retirement_replacement_receipt_observation ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE payroll_retirement_replacement_receipt_observation DROP CONSTRAINT IF EXISTS payroll_retirement_replacement_receipt_actor;
ALTER TABLE payroll_retirement_replacement_receipt_observation ADD CONSTRAINT payroll_retirement_replacement_receipt_actor CHECK((automatic AND created_by IS NULL) OR (NOT automatic AND created_by IS NOT NULL));

-- Replacement bank accounting has separate immutable claims and journal identities.
CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_settlement_authorization (
 id UUID PRIMARY KEY,facility_id BIGINT NOT NULL REFERENCES facility(id),
 replacement_id UUID NOT NULL REFERENCES payroll_retirement_replacement_authorization(id),
 mapping_id BIGINT NOT NULL REFERENCES payroll_retirement_settlement_mapping(id),preview JSONB NOT NULL,
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),request_key UUID NOT NULL,
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 20 AND 2000),auto_post BOOLEAN NOT NULL CHECK(auto_post),
 created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(facility_id,request_key)
);
CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_settlement_cancellation (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_retirement_replacement_settlement_authorization(id),
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 20 AND 2000),created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_settlement_claim (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_retirement_replacement_settlement_authorization(id),created_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_settlement_journal (
 id UUID PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_retirement_replacement_settlement_claim(authorization_id),facility_id BIGINT NOT NULL REFERENCES facility(id),
 realm_id TEXT NOT NULL,environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),event_key TEXT NOT NULL,payload JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE(authorization_id,event_key),UNIQUE(facility_id,realm_id,environment,event_key)
);
CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_settlement_observation (
 id BIGSERIAL PRIMARY KEY,journal_id UUID NOT NULL REFERENCES payroll_retirement_replacement_settlement_journal(id),source TEXT NOT NULL CHECK(source IN ('SUBMISSION','RECOVERY')),
 result JSONB NOT NULL,create_attempted BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),CHECK(source<>'RECOVERY' OR NOT create_attempted)
);
CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_settlement_attempt (
 id BIGSERIAL PRIMARY KEY,authorization_id UUID NOT NULL REFERENCES payroll_retirement_replacement_settlement_authorization(id),status TEXT NOT NULL CHECK(status IN ('SYNCED','NEEDS_REVIEW','BLOCKED')),message TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_replacement_settlement_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE employer BIGINT;
BEGIN
 IF TG_TABLE_NAME='payroll_retirement_replacement_settlement_authorization' THEN employer:=NEW.facility_id;
 ELSE SELECT facility_id INTO employer FROM payroll_retirement_replacement_settlement_authorization WHERE id=NEW.authorization_id; END IF;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=employer FOR UPDATE;
 IF TG_TABLE_NAME='payroll_retirement_replacement_settlement_authorization' THEN
  IF NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_authorization p JOIN payroll_retirement_settlement_mapping m ON m.id=NEW.mapping_id WHERE p.id=NEW.replacement_id AND p.facility_id=NEW.facility_id AND m.facility_id=p.facility_id AND m.realm_id=NEW.preview->>'realmId' AND m.environment=NEW.preview->>'environment' AND p.id::text=NEW.preview->>'authorizationId' AND p.original_authorization_id::text=NEW.preview->>'originalAuthorizationId' AND p.return_authorization_id::text=NEW.preview->>'returnAuthorizationId' AND p.preview->'amountCents'=NEW.preview->'amountCents' AND p.preview->'planId'=NEW.preview->'planId' AND p.preview->'runId'=NEW.preview->'runId' AND m.id::text=NEW.preview->>'mappingId' AND NEW.fingerprint=NEW.preview->>'fingerprint' AND jsonb_array_length(NEW.preview->'journals')>0 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_cancellation c WHERE c.authorization_id=p.id)) THEN RAISE EXCEPTION 'Replacement settlement requires exact scoped approval and mapping.'; END IF;
  IF EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_authorization a WHERE a.replacement_id=NEW.replacement_id AND NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_cancellation c WHERE c.authorization_id=a.id)) THEN RAISE EXCEPTION 'Replacement settlement already has an active approval.'; END IF;
 ELSIF TG_TABLE_NAME='payroll_retirement_replacement_settlement_cancellation' THEN
  IF EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_claim WHERE authorization_id=NEW.authorization_id) AND NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_release WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Claimed replacement settlement requires recovery.'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_cancellation WHERE authorization_id=NEW.authorization_id) THEN RAISE EXCEPTION 'Cancelled replacement settlement cannot be claimed.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tab TEXT; BEGIN FOREACH tab IN ARRAY ARRAY['payroll_retirement_replacement_settlement_authorization','payroll_retirement_replacement_settlement_cancellation','payroll_retirement_replacement_settlement_claim'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_validate_replacement_settlement_approval ON %I',tab);
 EXECUTE format('CREATE TRIGGER payroll_validate_replacement_settlement_approval BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION payroll_validate_replacement_settlement_approval()',tab);
END LOOP; END $$;
CREATE OR REPLACE FUNCTION payroll_validate_replacement_settlement_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_authorization a CROSS JOIN LATERAL jsonb_array_elements(a.preview->'journals') j WHERE a.id=NEW.authorization_id AND a.facility_id=NEW.facility_id AND a.preview->>'realmId'=NEW.realm_id AND a.preview->>'environment'=NEW.environment AND j->'event'->>'key'=NEW.event_key AND j->'payload'=NEW.payload) THEN RAISE EXCEPTION 'Replacement journal requires exact retained employer, company and payload.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_replacement_settlement_journal ON payroll_retirement_replacement_settlement_journal;
CREATE TRIGGER payroll_validate_replacement_settlement_journal BEFORE INSERT ON payroll_retirement_replacement_settlement_journal FOR EACH ROW EXECUTE FUNCTION payroll_validate_replacement_settlement_journal();
DO $$ DECLARE tab TEXT; BEGIN FOREACH tab IN ARRAY ARRAY['payroll_retirement_replacement_settlement_authorization','payroll_retirement_replacement_settlement_cancellation','payroll_retirement_replacement_settlement_claim','payroll_retirement_replacement_settlement_journal','payroll_retirement_replacement_settlement_observation','payroll_retirement_replacement_settlement_attempt'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON %I',tab);
 EXECUTE format('CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection()',tab);
END LOOP; END $$;


CREATE TABLE IF NOT EXISTS payroll_retirement_replacement_settlement_release (
 authorization_id UUID PRIMARY KEY REFERENCES payroll_retirement_replacement_settlement_claim(authorization_id),
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 evidence JSONB NOT NULL CHECK(jsonb_typeof(evidence)='array'),
 reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 20 AND 2000),
 created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION payroll_validate_replacement_settlement_release() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected INTEGER; job RECORD;
BEGIN
 PERFORM s.facility_id FROM payroll_settings s JOIN payroll_retirement_replacement_settlement_authorization a ON a.facility_id=s.facility_id WHERE a.id=NEW.authorization_id FOR UPDATE OF s;
 SELECT jsonb_array_length(preview->'journals') INTO expected FROM payroll_retirement_replacement_settlement_authorization WHERE id=NEW.authorization_id;
 IF expected IS NULL OR expected<1 OR jsonb_array_length(NEW.evidence)<>expected OR (SELECT count(*) FROM payroll_retirement_replacement_settlement_journal WHERE authorization_id=NEW.authorization_id)<>expected THEN RAISE EXCEPTION 'Release requires every original journal.'; END IF;
 FOR job IN SELECT * FROM payroll_retirement_replacement_settlement_journal WHERE authorization_id=NEW.authorization_id LOOP
  IF (SELECT count(*) FROM payroll_retirement_replacement_settlement_observation WHERE journal_id=job.id AND source='SUBMISSION')<>1 OR (SELECT source FROM payroll_retirement_replacement_settlement_observation WHERE journal_id=job.id ORDER BY id LIMIT 1) IS DISTINCT FROM 'SUBMISSION' OR EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_observation WHERE journal_id=job.id AND source='RECOVERY' AND result->>'status' IS DISTINCT FROM 'NOT_FOUND') OR (SELECT count(*) FROM payroll_retirement_replacement_settlement_observation WHERE journal_id=job.id AND source='SUBMISSION' AND NOT create_attempted AND result->>'status'='NOT_SENT')<>1 OR EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_observation WHERE journal_id=job.id AND (create_attempted OR result->>'status' IS NULL OR result->>'status' NOT IN ('NOT_SENT','NOT_FOUND'))) THEN RAISE EXCEPTION 'Release requires affirmative non-send without contradictory observations.'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(NEW.evidence) e WHERE e->>'journalId'=job.id::text AND EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_observation o WHERE o.id::text=e->>'observationId' AND o.journal_id=job.id AND o.source='RECOVERY' AND NOT o.create_attempted AND o.result->>'status'='NOT_FOUND' AND NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_observation newer WHERE newer.journal_id=job.id AND newer.id>o.id)))<>1 THEN RAISE EXCEPTION 'Release requires latest retained journal absence.'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_replacement_settlement_release ON payroll_retirement_replacement_settlement_release;
CREATE TRIGGER payroll_validate_replacement_settlement_release BEFORE INSERT ON payroll_retirement_replacement_settlement_release FOR EACH ROW EXECUTE FUNCTION payroll_validate_replacement_settlement_release();
DROP TRIGGER IF EXISTS payroll_guard_payment_connection ON payroll_retirement_replacement_settlement_release;
CREATE TRIGGER payroll_guard_payment_connection BEFORE UPDATE OR DELETE ON payroll_retirement_replacement_settlement_release FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();

-- Preserve every old job while allowing a new authorization to reserve an
-- event only after its original claimed authorization has proven release.
DO $$ DECLARE c RECORD; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='payroll_retirement_replacement_settlement_journal'::regclass AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (facility_id, realm_id, environment, event_key)' LOOP
  EXECUTE format('ALTER TABLE payroll_retirement_replacement_settlement_journal DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION payroll_guard_replacement_settlement_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_journal j WHERE j.facility_id=NEW.facility_id AND j.realm_id=NEW.realm_id AND j.environment=NEW.environment AND j.event_key=NEW.event_key AND NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_release r JOIN payroll_retirement_replacement_settlement_cancellation c ON c.authorization_id=r.authorization_id WHERE r.authorization_id=j.authorization_id)) THEN RAISE EXCEPTION 'Retirement bank event already has an unreleased settlement journal.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_replacement_settlement_event ON payroll_retirement_replacement_settlement_journal;
CREATE TRIGGER payroll_guard_replacement_settlement_event BEFORE INSERT ON payroll_retirement_replacement_settlement_journal FOR EACH ROW EXECUTE FUNCTION payroll_guard_replacement_settlement_event();


-- Retained employee/employer agreement for per-period Maryland additions.
CREATE TABLE IF NOT EXISTS payroll_maryland_additional_agreement (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 revision INTEGER NOT NULL CHECK(revision>0),
 status TEXT NOT NULL CHECK(status IN ('ACTIVE','SUSPENDED')),
 agreement JSONB NOT NULL CHECK(jsonb_typeof(agreement)='object'),
 effective_on DATE NOT NULL,
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 source_reference TEXT NOT NULL CHECK(length(source_reference) BETWEEN 20 AND 2000),
 request_key UUID NOT NULL,
 request_hash TEXT NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 verified_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(employee_id,revision),
 UNIQUE(employee_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_guard_maryland_additional_agreement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Maryland additional-withholding agreement history is immutable.'; END IF;
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee e WHERE e.id=NEW.employee_id AND e.facility_id=NEW.facility_id) OR NEW.agreement->>'employeeId' IS DISTINCT FROM NEW.employee_id::text THEN RAISE EXCEPTION 'Maryland agreement employee scope mismatch.'; END IF;
 IF NEW.revision<>(SELECT COALESCE(MAX(revision),0)+1 FROM payroll_maryland_additional_agreement WHERE employee_id=NEW.employee_id) THEN RAISE EXCEPTION 'Maryland agreement revision mismatch.'; END IF;
 IF NEW.agreement->'version' IS DISTINCT FROM '1'::jsonb OR NEW.agreement->'verified' IS DISTINCT FROM 'true'::jsonb OR NEW.agreement->>'periodBasis' IS DISTINCT FROM 'PAYMENT_DATE' OR COALESCE(NEW.agreement->>'payFrequency','') NOT IN ('WEEKLY','BIWEEKLY','SEMIMONTHLY','MONTHLY') OR COALESCE(NEW.agreement->>'electionFingerprint','') !~ '^[a-f0-9]{64}$' OR jsonb_typeof(NEW.agreement->'amountCents') IS DISTINCT FROM 'number' OR COALESCE(NEW.agreement->>'amountCents','') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Maryland agreement payload is invalid.'; END IF;
 IF (NEW.agreement->>'amountCents')::numeric>9007199254740991 OR length(btrim(NEW.source_reference))<20 OR NEW.source_reference ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Maryland agreement amount or reference is invalid.'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_maryland_additional_agreement WHERE employee_id=NEW.employee_id AND effective_on>NEW.effective_on) THEN RAISE EXCEPTION 'Maryland agreement effective date cannot move backward.'; END IF;
 IF NEW.status='ACTIVE' AND EXTRACT(YEAR FROM NEW.effective_on)<>2026 THEN RAISE EXCEPTION 'Maryland active agreement requires a supported tax year.'; END IF;
 IF NEW.status='SUSPENDED' AND NOT EXISTS(SELECT 1 FROM payroll_maryland_additional_agreement a WHERE a.employee_id=NEW.employee_id AND a.revision=NEW.revision-1 AND a.status='ACTIVE' AND a.agreement=NEW.agreement) THEN RAISE EXCEPTION 'Maryland suspension must preserve the active agreement.'; END IF;

 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_maryland_additional_agreement ON payroll_maryland_additional_agreement;
CREATE TRIGGER payroll_guard_maryland_additional_agreement BEFORE INSERT OR UPDATE OR DELETE ON payroll_maryland_additional_agreement FOR EACH ROW EXECUTE FUNCTION payroll_guard_maryland_additional_agreement();

CREATE TABLE IF NOT EXISTS payroll_maryland_agreement_proposal (
 id UUID PRIMARY KEY, facility_id BIGINT NOT NULL REFERENCES facility(id), employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 revision INTEGER NOT NULL CHECK(revision>0), terms JSONB NOT NULL CHECK(jsonb_typeof(terms)='object'),
 fingerprint TEXT NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'), created_by BIGINT NOT NULL,
 request_key UUID NOT NULL, request_hash TEXT NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(employee_id,revision), UNIQUE(employee_id,request_key)
);
CREATE TABLE IF NOT EXISTS payroll_maryland_agreement_signature (
 id UUID PRIMARY KEY, facility_id BIGINT NOT NULL REFERENCES facility(id), employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 proposal_id UUID NOT NULL UNIQUE REFERENCES payroll_maryland_agreement_proposal(id),
 decision TEXT NOT NULL CHECK(decision IN ('ACCEPT','DECLINE')), signature TEXT NOT NULL CHECK(length(btrim(signature)) BETWEEN 3 AND 200),
 agreement_id BIGINT REFERENCES payroll_maryland_additional_agreement(id), employee_session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),
 request_key UUID NOT NULL, request_hash TEXT NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(employee_id,request_key), CHECK((decision='ACCEPT')=(agreement_id IS NOT NULL))
);
CREATE OR REPLACE FUNCTION payroll_guard_maryland_agreement_signing() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Maryland signing records are immutable.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee WHERE id=NEW.employee_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Maryland signing employee scope mismatch.'; END IF;
 IF TG_TABLE_NAME='payroll_maryland_agreement_proposal' THEN
  IF NEW.revision<>(SELECT COALESCE(MAX(revision),0)+1 FROM payroll_maryland_agreement_proposal WHERE employee_id=NEW.employee_id) THEN RAISE EXCEPTION 'Maryland proposal revision mismatch.'; END IF;
  IF NEW.terms->'version' IS DISTINCT FROM '1'::jsonb OR NEW.terms->'agreement'->'version' IS DISTINCT FROM '1'::jsonb OR NEW.terms->'agreement'->'verified' IS DISTINCT FROM 'true'::jsonb OR NEW.terms->'agreement'->>'employeeId' IS DISTINCT FROM NEW.employee_id::text OR NEW.terms->'agreement'->>'periodBasis' IS DISTINCT FROM 'PAYMENT_DATE' OR COALESCE(NEW.terms->'agreement'->>'payFrequency','') NOT IN ('WEEKLY','BIWEEKLY','SEMIMONTHLY','MONTHLY') OR COALESCE(NEW.terms->'agreement'->>'electionFingerprint','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Maryland proposal agreement terms are invalid.'; END IF;
  IF jsonb_typeof(NEW.terms->'agreement'->'amountCents') IS DISTINCT FROM 'number' OR COALESCE(NEW.terms->'agreement'->>'amountCents','') !~ '^[0-9]+$' OR jsonb_typeof(NEW.terms->'expectedAgreementRevision') IS DISTINCT FROM 'number' OR COALESCE(NEW.terms->>'expectedAgreementRevision','') !~ '^[0-9]+$' OR COALESCE(NEW.terms->>'effectiveOn','') !~ '^2026-[0-9]{2}-[0-9]{2}$' OR COALESCE(NEW.terms->>'hireDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR jsonb_typeof(NEW.terms->'onboardingCycles') IS DISTINCT FROM 'array' OR jsonb_typeof(NEW.terms->'employeeTerms') IS DISTINCT FROM 'string' OR length(btrim(COALESCE(NEW.terms->>'employeeTerms',''))) NOT BETWEEN 20 AND 4000 OR NEW.terms->>'employeeTerms' ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Maryland proposal source is invalid.'; END IF;
  IF (NEW.terms->'agreement'->>'amountCents')::numeric>9007199254740991 OR (NEW.terms->>'expectedAgreementRevision')::numeric>2147483646 OR (NEW.terms->>'effectiveOn')::date::text<>NEW.terms->>'effectiveOn' OR (NEW.terms->>'hireDate')::date::text<>NEW.terms->>'hireDate' THEN RAISE EXCEPTION 'Maryland proposal source amount or date is invalid.'; END IF;

 ELSE
  IF NOT EXISTS(SELECT 1 FROM payroll_maryland_agreement_proposal WHERE id=NEW.proposal_id AND employee_id=NEW.employee_id AND facility_id=NEW.facility_id) OR NOT EXISTS(SELECT 1 FROM payroll_employee_session WHERE id=NEW.employee_session_id AND employee_id=NEW.employee_id AND facility_id=NEW.facility_id) THEN RAISE EXCEPTION 'Maryland signing source scope mismatch.'; END IF;
  IF NEW.signature ~ '[[:cntrl:]]' OR NOT EXISTS(SELECT 1 FROM payroll_employee_session WHERE id=NEW.employee_session_id AND revoked_at IS NULL AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'Maryland signing session or signature is invalid.'; END IF;
  IF NEW.proposal_id IS DISTINCT FROM (SELECT id FROM payroll_maryland_agreement_proposal WHERE employee_id=NEW.employee_id AND facility_id=NEW.facility_id ORDER BY revision DESC LIMIT 1) THEN RAISE EXCEPTION 'Maryland signing proposal was superseded.'; END IF;
  IF NEW.agreement_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM payroll_maryland_additional_agreement a JOIN payroll_maryland_agreement_proposal p ON p.id=NEW.proposal_id WHERE a.id=NEW.agreement_id AND a.employee_id=NEW.employee_id AND a.facility_id=NEW.facility_id AND a.status='ACTIVE' AND a.agreement=p.terms->'agreement' AND a.effective_on=(p.terms->>'effectiveOn')::date AND a.revision=(p.terms->>'expectedAgreementRevision')::integer+1 AND a.verified_by=p.created_by AND a.source_reference='Internal employee agreement acceptance for proposal '||p.id::text) THEN RAISE EXCEPTION 'Maryland signed agreement does not match the accepted proposal.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_maryland_agreement_proposal ON payroll_maryland_agreement_proposal;
CREATE TRIGGER payroll_guard_maryland_agreement_proposal BEFORE INSERT OR UPDATE OR DELETE ON payroll_maryland_agreement_proposal FOR EACH ROW EXECUTE FUNCTION payroll_guard_maryland_agreement_signing();
DROP TRIGGER IF EXISTS payroll_guard_maryland_agreement_signature ON payroll_maryland_agreement_signature;
CREATE TRIGGER payroll_guard_maryland_agreement_signature BEFORE INSERT OR UPDATE OR DELETE ON payroll_maryland_agreement_signature FOR EACH ROW EXECUTE FUNCTION payroll_guard_maryland_agreement_signing();


-- Native W-4 review and signing evidence. Sensitive answers/signatures stay encrypted.
CREATE TABLE IF NOT EXISTS payroll_w4_review (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 task_id BIGINT NOT NULL REFERENCES payroll_onboarding_task(id),
 onboarding_cycle integer NOT NULL CHECK(onboarding_cycle>0),
 employee_session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),
 encrypted_review BYTEA NOT NULL CHECK(octet_length(encrypted_review)>28),
 preview_sha256 TEXT NOT NULL CHECK(preview_sha256 ~ '^[a-f0-9]{64}$'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()+interval '30 minutes',
 CHECK(expires_at>created_at)
);
CREATE TABLE IF NOT EXISTS payroll_w4_page_visit (
 review_id BIGINT NOT NULL REFERENCES payroll_w4_review(id),
 page_number integer NOT NULL CHECK(page_number BETWEEN 1 AND 5),
 visited_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(review_id,page_number)
);
CREATE TABLE IF NOT EXISTS payroll_w4_submission (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 task_id BIGINT NOT NULL REFERENCES payroll_onboarding_task(id),
 onboarding_cycle integer NOT NULL CHECK(onboarding_cycle>0),
 employee_session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id),
 review_id BIGINT NOT NULL UNIQUE REFERENCES payroll_w4_review(id),
 document_id BIGINT NOT NULL UNIQUE REFERENCES payroll_private_document(id),
 request_key UUID NOT NULL,
 request_hash TEXT NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 encrypted_signature BYTEA NOT NULL CHECK(octet_length(encrypted_signature)>28),
 signed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(facility_id,employee_id,request_key)
);
CREATE OR REPLACE FUNCTION payroll_guard_w4_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'W-4 review and signing evidence must be retained unchanged.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_onboarding_task t WHERE t.id=NEW.task_id AND t.facility_id=NEW.facility_id AND t.employee_id=NEW.employee_id AND t.onboarding_cycle=NEW.onboarding_cycle AND t.task_key='W4' AND t.owner='EMPLOYEE' AND t.status IN ('OPEN','SUBMITTED','CHANGES_REQUESTED')) THEN RAISE EXCEPTION 'W-4 evidence requires the current open employee step.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee_session s JOIN payroll_employee e ON e.id=s.employee_id AND e.facility_id=s.facility_id WHERE s.id=NEW.employee_session_id AND s.employee_id=NEW.employee_id AND s.facility_id=NEW.facility_id AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND e.employment_status IN ('ONBOARDING','ACTIVE','LEAVE')) THEN RAISE EXCEPTION 'W-4 evidence requires a current employee session.' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='payroll_w4_submission' THEN
  IF (SELECT count(*) FROM payroll_w4_page_visit WHERE review_id=NEW.review_id)<>5 THEN RAISE EXCEPTION 'All five W-4 pages must be visited before signing.' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM payroll_w4_review r WHERE r.id=NEW.review_id AND r.facility_id=NEW.facility_id AND r.employee_id=NEW.employee_id AND r.task_id=NEW.task_id AND r.onboarding_cycle=NEW.onboarding_cycle AND r.employee_session_id=NEW.employee_session_id AND r.expires_at>clock_timestamp() AND NOT EXISTS(SELECT 1 FROM payroll_w4_review newer WHERE newer.task_id=r.task_id AND newer.onboarding_cycle=r.onboarding_cycle AND newer.id>r.id)) THEN RAISE EXCEPTION 'W-4 signature requires the latest unexpired scoped preview.' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM payroll_private_document d WHERE d.id=NEW.document_id AND d.facility_id=NEW.facility_id AND d.employee_id=NEW.employee_id AND d.task_id=NEW.task_id AND d.onboarding_cycle=NEW.onboarding_cycle AND d.mime_type='application/pdf') THEN RAISE EXCEPTION 'W-4 signature requires the matching retained PDF.' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w4_review ON payroll_w4_review;
CREATE TRIGGER payroll_guard_w4_review BEFORE INSERT OR UPDATE OR DELETE ON payroll_w4_review FOR EACH ROW EXECUTE FUNCTION payroll_guard_w4_evidence();
DROP TRIGGER IF EXISTS payroll_guard_w4_submission ON payroll_w4_submission;
CREATE TRIGGER payroll_guard_w4_submission BEFORE INSERT OR UPDATE OR DELETE ON payroll_w4_submission FOR EACH ROW EXECUTE FUNCTION payroll_guard_w4_evidence();

CREATE OR REPLACE FUNCTION payroll_guard_w4_page_visit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'W-4 page visits must be retained unchanged.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_w4_review r JOIN payroll_employee_session s ON s.id=r.employee_session_id JOIN payroll_onboarding_task t ON t.id=r.task_id WHERE r.id=NEW.review_id AND r.expires_at>clock_timestamp() AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND t.onboarding_cycle=r.onboarding_cycle AND t.status IN ('OPEN','SUBMITTED','CHANGES_REQUESTED') AND NOT EXISTS(SELECT 1 FROM payroll_w4_review n WHERE n.task_id=r.task_id AND n.onboarding_cycle=r.onboarding_cycle AND n.id>r.id)) THEN RAISE EXCEPTION 'W-4 page visits require a current scoped review.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w4_page_visit ON payroll_w4_page_visit;
CREATE TRIGGER payroll_guard_w4_page_visit BEFORE INSERT OR UPDATE OR DELETE ON payroll_w4_page_visit FOR EACH ROW EXECUTE FUNCTION payroll_guard_w4_page_visit();

CREATE TABLE IF NOT EXISTS payroll_w4_draft (
 facility_id BIGINT NOT NULL REFERENCES facility(id), employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 task_id BIGINT NOT NULL REFERENCES payroll_onboarding_task(id), onboarding_cycle integer NOT NULL CHECK(onboarding_cycle>0),
 revision integer NOT NULL CHECK(revision>0), base_submission_id BIGINT REFERENCES payroll_w4_submission(id),
 encrypted_draft BYTEA CHECK(encrypted_draft IS NULL OR octet_length(encrypted_draft)>28),
 employee_session_id BIGINT NOT NULL REFERENCES payroll_employee_session(id), request_key UUID, request_revision integer,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(task_id,onboarding_cycle)
);

CREATE OR REPLACE FUNCTION payroll_guard_w4_draft() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Clear W-4 draft content while retaining its revision.' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW.task_id<>OLD.task_id OR NEW.onboarding_cycle<>OLD.onboarding_cycle OR NEW.facility_id<>OLD.facility_id OR NEW.employee_id<>OLD.employee_id OR NEW.revision<>OLD.revision+1) THEN RAISE EXCEPTION 'W-4 draft scope and revision must be preserved.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_onboarding_task WHERE id=NEW.task_id AND employee_id=NEW.employee_id AND facility_id=NEW.facility_id AND onboarding_cycle=NEW.onboarding_cycle AND task_key='W4' AND owner='EMPLOYEE' AND status IN ('OPEN','SUBMITTED','CHANGES_REQUESTED')) THEN RAISE EXCEPTION 'W-4 draft requires the current open employee step.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_employee_session WHERE id=NEW.employee_session_id AND employee_id=NEW.employee_id AND facility_id=NEW.facility_id AND revoked_at IS NULL AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'W-4 draft requires a current scoped session.' USING ERRCODE='23514'; END IF;
 IF NEW.base_submission_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM payroll_w4_submission WHERE id=NEW.base_submission_id AND employee_id=NEW.employee_id AND facility_id=NEW.facility_id AND task_id=NEW.task_id AND onboarding_cycle=NEW.onboarding_cycle) THEN RAISE EXCEPTION 'W-4 draft signature basis must have matching scope.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_guard_w4_draft ON payroll_w4_draft;
CREATE TRIGGER payroll_guard_w4_draft BEFORE INSERT OR UPDATE OR DELETE ON payroll_w4_draft FOR EACH ROW EXECUTE FUNCTION payroll_guard_w4_draft();
