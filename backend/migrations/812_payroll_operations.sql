-- Payroll operations foundation. Sensitive identity and banking values are intentionally
-- excluded; store only secure-provider references when a vetted secrets/document store exists.

CREATE TABLE IF NOT EXISTS payroll_settings (
  facility_id BIGINT PRIMARY KEY REFERENCES facility(id) ON DELETE CASCADE,
  legal_business_name TEXT NOT NULL,
  business_address TEXT,
  ein_last4 CHAR(4),
  ein_status TEXT NOT NULL DEFAULT 'MISSING' CHECK (ein_status IN ('MISSING', 'OWNER_CONFIRMED', 'VERIFIED')),
  workweek_starts_on SMALLINT NOT NULL DEFAULT 1 CHECK (workweek_starts_on BETWEEN 0 AND 6),
  pay_frequency TEXT NOT NULL DEFAULT 'SEMIMONTHLY' CHECK (pay_frequency IN ('WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY')),
  semimonthly_first_day SMALLINT DEFAULT 5 CHECK (semimonthly_first_day BETWEEN 1 AND 28),
  semimonthly_second_day SMALLINT DEFAULT 20 CHECK (semimonthly_second_day BETWEEN 2 AND 31),
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  state_code CHAR(2) NOT NULL DEFAULT 'MD',
  md_crn_status TEXT NOT NULL DEFAULT 'MISSING' CHECK (md_crn_status IN ('MISSING', 'APPLIED', 'ACTIVE')),
  md_ui_status TEXT NOT NULL DEFAULT 'MISSING' CHECK (md_ui_status IN ('MISSING', 'APPLIED', 'ACTIVE')),
  workers_comp_status TEXT NOT NULL DEFAULT 'MISSING' CHECK (workers_comp_status IN ('MISSING', 'QUOTING', 'ACTIVE')),
  payroll_execution_mode TEXT NOT NULL DEFAULT 'RECORD_ONLY' CHECK (payroll_execution_mode IN ('RECORD_ONLY', 'PROVIDER_CONNECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_employee (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  employee_number TEXT NOT NULL,
  legal_first_name TEXT NOT NULL,
  legal_middle_name TEXT,
  legal_last_name TEXT NOT NULL,
  preferred_name TEXT,
  job_title TEXT NOT NULL,
  employment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (employment_status IN ('ONBOARDING', 'ACTIVE', 'LEAVE', 'TERMINATED')),
  worker_classification TEXT NOT NULL DEFAULT 'EMPLOYEE' CHECK (worker_classification IN ('EMPLOYEE', 'CONTRACTOR_REVIEW')),
  overtime_classification TEXT NOT NULL DEFAULT 'NONEXEMPT' CHECK (overtime_classification IN ('NONEXEMPT', 'EXEMPT_REVIEW', 'EXEMPT')),
  pay_type TEXT NOT NULL DEFAULT 'HOURLY' CHECK (pay_type IN ('HOURLY', 'SALARY')),
  hourly_rate_cents INTEGER CHECK (hourly_rate_cents >= 0),
  annual_salary_cents BIGINT CHECK (annual_salary_cents >= 0),
  hire_date DATE NOT NULL,
  termination_date DATE,
  work_state CHAR(2) NOT NULL,
  residence_state CHAR(2) NOT NULL,
  primary_work_location TEXT,
  w4_status TEXT NOT NULL DEFAULT 'MISSING' CHECK (w4_status IN ('MISSING', 'REQUESTED', 'COMPLETE')),
  state_withholding_status TEXT NOT NULL DEFAULT 'MISSING' CHECK (state_withholding_status IN ('MISSING', 'REQUESTED', 'COMPLETE')),
  i9_status TEXT NOT NULL DEFAULT 'MISSING' CHECK (i9_status IN ('MISSING', 'SECTION_1', 'COMPLETE', 'REVERIFY')),
  direct_deposit_status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK (direct_deposit_status IN ('NOT_CONFIGURED', 'INVITED', 'ACTIVE')),
  sick_leave_policy TEXT NOT NULL DEFAULT 'ACCRUAL' CHECK (sick_leave_policy IN ('ACCRUAL', 'FRONTLOAD', 'EXEMPT_REVIEW')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, employee_number)
);

CREATE INDEX IF NOT EXISTS idx_payroll_employee_facility_status
  ON payroll_employee(facility_id, employment_status);

ALTER TABLE payroll_employee
  ADD COLUMN IF NOT EXISTS personal_email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_employee_facility_email
  ON payroll_employee(facility_id, lower(personal_email))
  WHERE personal_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS payroll_employee_document (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('W4', 'STATE_WITHHOLDING', 'I9', 'DIRECT_DEPOSIT', 'WAGE_NOTICE', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'MISSING' CHECK (status IN ('MISSING', 'REQUESTED', 'RECEIVED', 'VERIFIED', 'EXPIRED', 'REVERIFY')),
  completed_at TIMESTAMPTZ,
  expires_on DATE,
  secure_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, document_type)
);

CREATE TABLE IF NOT EXISTS payroll_employee_invitation (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_employee_invitation_active
  ON payroll_employee_invitation(employee_id, expires_at)
  WHERE redeemed_at IS NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS payroll_employee_session (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_employee_session_active
  ON payroll_employee_session(employee_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS payroll_shift (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'INSTRUCTION' CHECK (activity_type IN ('INSTRUCTION', 'PLANNING', 'SETUP', 'MEETING', 'ADMIN', 'OTHER')),
  location TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED')),
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX IF NOT EXISTS idx_payroll_shift_employee_start ON payroll_shift(employee_id, scheduled_start);

CREATE TABLE IF NOT EXISTS payroll_time_entry (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
  shift_id BIGINT REFERENCES payroll_shift(id) ON DELETE SET NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  unpaid_break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (unpaid_break_minutes BETWEEN 0 AND 1440),
  activity_type TEXT NOT NULL DEFAULT 'INSTRUCTION' CHECK (activity_type IN ('INSTRUCTION', 'PLANNING', 'SETUP', 'MEETING', 'ADMIN', 'OTHER')),
  source TEXT NOT NULL DEFAULT 'ADMIN' CHECK (source IN ('EMPLOYEE_CLOCK', 'ADMIN', 'IMPORT', 'RECONSTRUCTION')),
  status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (status IN ('UNVERIFIED', 'EMPLOYEE_ATTESTED', 'APPROVED', 'REJECTED')),
  evidence_note TEXT,
  employee_attested_at TIMESTAMPTZ,
  approved_by BIGINT,
  approved_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (clock_out IS NULL OR clock_out > clock_in)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_one_open_clock
  ON payroll_time_entry(employee_id) WHERE clock_out IS NULL;
CREATE INDEX IF NOT EXISTS idx_payroll_time_employee_clock ON payroll_time_entry(employee_id, clock_in);

CREATE TABLE IF NOT EXISTS payroll_pay_period (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pay_date DATE NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'HISTORICAL_MONTHLY')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'LOCKED', 'PAID', 'VOID')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  UNIQUE (facility_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS payroll_historical_payment (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payment_date DATE NOT NULL,
  method TEXT NOT NULL,
  reference TEXT,
  gross_amount_cents BIGINT NOT NULL CHECK (gross_amount_cents >= 0),
  employee_tax_withheld_cents BIGINT NOT NULL DEFAULT 0,
  net_amount_cents BIGINT NOT NULL,
  reconciliation_status TEXT NOT NULL DEFAULT 'NEEDS_EVIDENCE' CHECK (reconciliation_status IN ('NEEDS_EVIDENCE', 'READY_FOR_SPECIALIST', 'RECONCILED')),
  evidence_note TEXT,
  source TEXT NOT NULL DEFAULT 'OWNER_REPORTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period_start, period_end, payment_date, gross_amount_cents)
);

CREATE TABLE IF NOT EXISTS payroll_run (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  pay_period_id BIGINT REFERENCES payroll_pay_period(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'APPROVED', 'FINALIZED', 'VOID')),
  calculation_version TEXT NOT NULL DEFAULT 'us-md-2026-preview-v1',
  gross_pay_cents BIGINT NOT NULL DEFAULT 0,
  employee_tax_cents BIGINT NOT NULL DEFAULT 0,
  employer_tax_cents BIGINT NOT NULL DEFAULT 0,
  deduction_cents BIGINT NOT NULL DEFAULT 0,
  net_pay_cents BIGINT NOT NULL DEFAULT 0,
  blocking_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by BIGINT,
  reviewed_at TIMESTAMPTZ,
  approved_by BIGINT,
  approved_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_run_employee (
  id BIGSERIAL PRIMARY KEY,
  payroll_run_id BIGINT NOT NULL REFERENCES payroll_run(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES payroll_employee(id) ON DELETE RESTRICT,
  hourly_rate_cents INTEGER,
  regular_minutes INTEGER NOT NULL DEFAULT 0,
  overtime_minutes INTEGER NOT NULL DEFAULT 0,
  regular_pay_cents BIGINT NOT NULL DEFAULT 0,
  overtime_pay_cents BIGINT NOT NULL DEFAULT 0,
  other_taxable_pay_cents BIGINT NOT NULL DEFAULT 0,
  federal_income_tax_cents BIGINT,
  state_income_tax_cents BIGINT,
  social_security_tax_cents BIGINT NOT NULL DEFAULT 0,
  medicare_tax_cents BIGINT NOT NULL DEFAULT 0,
  additional_medicare_tax_cents BIGINT NOT NULL DEFAULT 0,
  other_deductions_cents BIGINT NOT NULL DEFAULT 0,
  net_pay_cents BIGINT,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);

ALTER TABLE payroll_run_employee
  ADD COLUMN IF NOT EXISTS additional_medicare_tax_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE payroll_settings
  ADD COLUMN IF NOT EXISTS business_address TEXT;

ALTER TABLE payroll_run_employee
  ADD COLUMN IF NOT EXISTS hourly_rate_cents INTEGER,
  ADD COLUMN IF NOT EXISTS sick_leave_accrual_minutes INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payroll_compliance_task (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  employee_id BIGINT REFERENCES payroll_employee(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ONBOARDING', 'FEDERAL_TAX', 'STATE_TAX', 'WAGE_HOUR', 'INSURANCE', 'REPORTING', 'LEAVE', 'SECURITY')),
  jurisdiction TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETE', 'NOT_APPLICABLE')),
  severity TEXT NOT NULL DEFAULT 'WARNING' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  description TEXT NOT NULL,
  source_url TEXT,
  source_authority TEXT,
  last_verified_on DATE,
  next_review_on DATE,
  completion_note TEXT,
  completed_at TIMESTAMPTZ,
  completed_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, task_key)
);

CREATE INDEX IF NOT EXISTS idx_payroll_compliance_due
  ON payroll_compliance_task(facility_id, status, due_date);

CREATE TABLE IF NOT EXISTS payroll_audit_log (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  actor_user_id BIGINT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_tax_configuration (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL,
  tax_key TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (status IN ('UNVERIFIED', 'VERIFIED', 'RETIRED')),
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT,
  verified_by BIGINT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, jurisdiction, tax_key, effective_from)
);

CREATE TABLE IF NOT EXISTS payroll_leave_transaction (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'MD_SICK_SAFE',
  transaction_date DATE NOT NULL,
  minutes INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_time_entry_id BIGINT REFERENCES payroll_time_entry(id) ON DELETE SET NULL,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_leave_employee_date
  ON payroll_leave_transaction(employee_id, transaction_date);

CREATE TABLE IF NOT EXISTS payroll_recurring_adjustment (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES payroll_employee(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('BONUS', 'REIMBURSEMENT', 'PRETAX_DEDUCTION', 'POSTTAX_DEDUCTION', 'GARNISHMENT')),
  name TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  active_from DATE NOT NULL,
  active_to DATE,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED')),
  authorization_reference TEXT,
  tax_treatment_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_recurring_adjustment
  ADD COLUMN IF NOT EXISTS tax_treatment_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE payroll_leave_transaction
  ADD COLUMN IF NOT EXISTS source_run_employee_id BIGINT REFERENCES payroll_run_employee(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_leave_run_employee_unique
  ON payroll_leave_transaction(source_run_employee_id, leave_type)
  WHERE source_run_employee_id IS NOT NULL;

ALTER TABLE payroll_run
  ADD COLUMN IF NOT EXISTS reimbursement_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_confirmation_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_recorded_by BIGINT;

ALTER TABLE payroll_run_employee
  ADD COLUMN IF NOT EXISTS reimbursement_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pretax_deduction_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posttax_deduction_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS garnishment_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withholding_source_note TEXT,
  ADD COLUMN IF NOT EXISTS withholding_verified_by BIGINT,
  ADD COLUMN IF NOT EXISTS withholding_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS payroll_accounting_mapping (
  facility_id BIGINT PRIMARY KEY REFERENCES facility(id) ON DELETE CASCADE,
  wages_expense_account TEXT NOT NULL DEFAULT 'Payroll:Wages Expense',
  employer_tax_expense_account TEXT NOT NULL DEFAULT 'Payroll:Employer Tax Expense',
  reimbursement_expense_account TEXT NOT NULL DEFAULT 'Employee Reimbursements',
  tax_liability_account TEXT NOT NULL DEFAULT 'Payroll:Tax Liabilities',
  deduction_liability_account TEXT NOT NULL DEFAULT 'Payroll:Other Deductions Payable',
  payroll_clearing_account TEXT NOT NULL DEFAULT 'Payroll Clearing',
  quickbooks_status TEXT NOT NULL DEFAULT 'CSV_ONLY' CHECK (quickbooks_status IN ('NOT_CONFIGURED', 'CSV_ONLY', 'CONNECTED')),
  verified_by_bookkeeper BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_accounting_mapping
  ADD COLUMN IF NOT EXISTS reimbursement_expense_account TEXT NOT NULL DEFAULT 'Employee Reimbursements',
  ADD COLUMN IF NOT EXISTS deduction_liability_account TEXT NOT NULL DEFAULT 'Payroll:Other Deductions Payable';

CREATE TABLE IF NOT EXISTS payroll_export_log (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  payroll_run_id BIGINT NOT NULL REFERENCES payroll_run(id) ON DELETE RESTRICT,
  export_type TEXT NOT NULL CHECK (export_type IN ('QUICKBOOKS_JOURNAL')),
  content_sha256 CHAR(64) NOT NULL,
  status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'IMPORTED', 'RECONCILED')),
  external_reference TEXT,
  notes TEXT,
  exported_by BIGINT,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reconciled_by BIGINT,
  reconciled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payroll_alert (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DISMISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  dismissed_by BIGINT,
  UNIQUE (facility_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS payroll_compliance_source_review (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  compliance_task_id BIGINT NOT NULL REFERENCES payroll_compliance_task(id) ON DELETE CASCADE,
  checked_url TEXT NOT NULL,
  content_sha256 CHAR(64),
  result TEXT NOT NULL CHECK (result IN ('BASELINE', 'NO_CHANGE', 'REVIEW_REQUIRED', 'FETCH_FAILED')),
  advisory_summary TEXT NOT NULL,
  model_used TEXT,
  checked_by BIGINT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_source_review_task_checked
  ON payroll_compliance_source_review(compliance_task_id, checked_at DESC);

INSERT INTO payroll_accounting_mapping (facility_id)
SELECT id FROM facility
ON CONFLICT (facility_id) DO NOTHING;

INSERT INTO permission (key, description) VALUES
  ('payroll.view', 'View payroll employees, time records, runs, and compliance tasks.'),
  ('payroll.manage', 'Manage payroll employees, time records, runs, and compliance tasks.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key IN ('payroll.view', 'payroll.manage')
WHERE r.key IN ('MASTER_ADMIN', 'ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO payroll_settings (
  facility_id, legal_business_name, business_address, ein_last4, ein_status, workweek_starts_on,
  pay_frequency, semimonthly_first_day, semimonthly_second_day, timezone, state_code,
  md_crn_status, md_ui_status, workers_comp_status
)
SELECT id, 'Vortex Athletics LLC', '4961 Tesla Dr, Suite E, Bowie, MD 20715', '6663', 'OWNER_CONFIRMED', 1,
       'SEMIMONTHLY', 5, 20, COALESCE(timezone, 'America/New_York'), 'MD',
       'MISSING', 'MISSING', 'MISSING'
FROM facility
ON CONFLICT (facility_id) DO NOTHING;

INSERT INTO payroll_employee (
  facility_id, employee_number, legal_first_name, legal_middle_name, legal_last_name,
  preferred_name, job_title, employment_status, worker_classification,
  overtime_classification, pay_type, hourly_rate_cents, hire_date, work_state,
  residence_state, primary_work_location, notes
)
SELECT id, 'VA-0001', 'Maria', 'Alejandra', 'Gutierrez Sanchez', 'Maria',
       'Gymnastics Instructor', 'ACTIVE', 'EMPLOYEE', 'NONEXEMPT', 'HOURLY', 2500,
       DATE '2026-01-01', 'MD', 'MD', '4961 Tesla Dr, Suite E, Bowie, MD 20715',
       'Historical 2026 wages require time-record and payroll-tax reconstruction. No sensitive immigration or banking identifiers are stored.'
FROM facility
ON CONFLICT (facility_id, employee_number) DO UPDATE SET
  legal_first_name = EXCLUDED.legal_first_name,
  legal_middle_name = EXCLUDED.legal_middle_name,
  legal_last_name = EXCLUDED.legal_last_name,
  job_title = EXCLUDED.job_title,
  hourly_rate_cents = EXCLUDED.hourly_rate_cents,
  updated_at = now();

INSERT INTO payroll_employee_document (facility_id, employee_id, document_type, status)
SELECT e.facility_id, e.id, d.document_type, 'MISSING'
FROM payroll_employee e
CROSS JOIN (VALUES ('W4'), ('STATE_WITHHOLDING'), ('I9'), ('DIRECT_DEPOSIT'), ('WAGE_NOTICE')) d(document_type)
WHERE e.employee_number = 'VA-0001'
ON CONFLICT (employee_id, document_type) DO NOTHING;

INSERT INTO payroll_historical_payment (
  facility_id, employee_id, period_start, period_end, payment_date, method,
  reference, gross_amount_cents, net_amount_cents, reconciliation_status, evidence_note
)
SELECT e.facility_id, e.id, v.period_start, v.period_end, v.payment_date, v.method,
       v.reference, v.amount_cents, v.amount_cents, 'NEEDS_EVIDENCE',
       'Owner confirmed this was intended as gross wages. Actual daily/workweek hours, overtime, withholding, and employer taxes remain unverified.'
FROM payroll_employee e
CROSS JOIN (VALUES
  (DATE '2026-01-01', DATE '2026-01-31', DATE '2026-03-12', 'CHECK', 'Check 156 — January allocation', 100000::bigint),
  (DATE '2026-02-01', DATE '2026-02-28', DATE '2026-03-12', 'CHECK', 'Check 156 — February allocation', 200000::bigint),
  (DATE '2026-03-01', DATE '2026-03-31', DATE '2026-04-03', 'ACH', 'Owner-reported ACH', 300000::bigint),
  (DATE '2026-04-01', DATE '2026-04-30', DATE '2026-05-01', 'ACH', 'Owner-reported ACH', 470000::bigint),
  (DATE '2026-05-01', DATE '2026-05-31', DATE '2026-06-05', 'ACH', 'Owner-reported ACH', 423800::bigint),
  (DATE '2026-06-01', DATE '2026-06-30', DATE '2026-07-06', 'ACH', 'Owner-reported ACH', 500000::bigint),
  (DATE '2026-07-01', DATE '2026-07-31', DATE '2026-08-03', 'ACH', 'Owner-reported ACH', 414000::bigint)
) v(period_start, period_end, payment_date, method, reference, amount_cents)
WHERE e.employee_number = 'VA-0001'
ON CONFLICT DO NOTHING;

INSERT INTO payroll_compliance_task (
  facility_id, employee_id, task_key, title, category, jurisdiction, due_date,
  status, severity, description, source_url, source_authority, last_verified_on, next_review_on
)
SELECT f.id, e.id, v.task_key, v.title, v.category, v.jurisdiction, v.due_date,
       v.status, v.severity, v.description, v.source_url, v.source_authority,
       DATE '2026-09-07', v.next_review_on
FROM facility f
JOIN payroll_employee e ON e.facility_id = f.id AND e.employee_number = 'VA-0001'
CROSS JOIN (VALUES
  ('maria-i9', 'Complete Maria''s Form I-9', 'ONBOARDING', 'Federal', DATE '2026-01-06', 'OPEN', 'CRITICAL', 'Complete the late I-9 using acceptable documents chosen by the employee. Do not store document numbers in ordinary payroll notes.', 'https://www.uscis.gov/sites/default/files/document/forms/i-9instr.pdf', 'USCIS', DATE '2026-12-01'),
  ('maria-w4', 'Collect Maria''s signed Form W-4', 'ONBOARDING', 'Federal', DATE '2026-03-12', 'OPEN', 'CRITICAL', 'Federal income tax withholding cannot be finalized without the employee withholding certificate.', 'https://www.irs.gov/businesses/small-businesses-self-employed/hiring-employees', 'IRS', DATE '2026-12-01'),
  ('maria-mw507', 'Collect Maria''s Maryland MW507', 'ONBOARDING', 'Maryland', DATE '2026-03-12', 'OPEN', 'CRITICAL', 'Maryland withholding elections remain missing.', 'https://www.marylandcomptroller.gov/forms/current_forms/MW507.pdf', 'Comptroller of Maryland', DATE '2026-12-01'),
  ('maria-new-hire', 'Report Maria as a Maryland new hire', 'REPORTING', 'Maryland', DATE '2026-01-21', 'OPEN', 'CRITICAL', 'Maryland new-hire reporting was due within 20 days of hire.', 'https://www.mdnewhire.com/', 'Maryland State Directory of New Hires', DATE '2026-12-01'),
  ('workers-comp', 'Obtain workers'' compensation coverage', 'INSURANCE', 'Maryland', DATE '2026-01-01', 'OPEN', 'CRITICAL', 'Maryland generally requires coverage when an employer has one or more employees.', 'https://www.wcc.state.md.us/PDF/Publications/QandA_Emplr.pdf', 'Maryland Workers'' Compensation Commission', DATE '2026-12-01'),
  ('md-crn', 'Register Maryland withholding account', 'STATE_TAX', 'Maryland', DATE '2026-03-12', 'OPEN', 'CRITICAL', 'Vortex needs a Maryland Central Registration Number and withholding account.', 'https://services.marylandcomptroller.gov/taxes/en/employer-withholding-faqs?id=kb_article_view&sysparm_article=KB0010108', 'Comptroller of Maryland', DATE '2026-12-01'),
  ('md-ui', 'Register Maryland unemployment account', 'STATE_TAX', 'Maryland', DATE '2026-01-21', 'OPEN', 'CRITICAL', 'Register the employer and obtain the Maryland unemployment insurance account number.', 'https://labor.maryland.gov/unemployment-insurance/employer-agent/new-employer-get-started.shtml', 'Maryland Department of Labor', DATE '2026-12-01'),
  ('q1-941', 'File and reconcile 2026 Q1 Form 941', 'FEDERAL_TAX', 'Federal', DATE '2026-04-30', 'OPEN', 'CRITICAL', 'Reconstruct January through March wages and tax deposits before filing or correcting the quarter.', 'https://www.irs.gov/instructions/i941', 'IRS', DATE '2026-12-01'),
  ('q2-941', 'File and reconcile 2026 Q2 Form 941', 'FEDERAL_TAX', 'Federal', DATE '2026-07-31', 'OPEN', 'CRITICAL', 'Reconstruct April through June wages and tax deposits before filing or correcting the quarter.', 'https://www.irs.gov/instructions/i941', 'IRS', DATE '2026-12-01'),
  ('q3-941', 'Prepare 2026 Q3 Form 941', 'FEDERAL_TAX', 'Federal', DATE '2026-10-31', 'OPEN', 'WARNING', 'Include corrected July through September payroll records and reconcile deposits.', 'https://www.irs.gov/instructions/i941', 'IRS', DATE '2026-12-01'),
  ('pay-frequency', 'Use a compliant twice-monthly pay schedule', 'WAGE_HOUR', 'Maryland', DATE '2026-09-07', 'IN_PROGRESS', 'CRITICAL', 'The owner selected paydays on the 5th and 20th; document periods and apply the schedule prospectively.', 'https://www.labor.maryland.gov/labor/wagepay/wpfrequency.shtml', 'Maryland Department of Labor', DATE '2026-12-01'),
  ('time-reconstruction', 'Reconstruct actual daily and weekly hours', 'WAGE_HOUR', 'Federal and Maryland', DATE '2026-09-14', 'OPEN', 'CRITICAL', 'Use schedules, calendars, messages, access records, and employee attestation. Do not invent hours to force payment totals to match.', 'https://www.dol.gov/agencies/whd/compliance-assistance/handy-reference-guide-flsa', 'U.S. Department of Labor', DATE '2026-12-01'),
  ('pay-statements', 'Issue compliant Maryland pay statements', 'WAGE_HOUR', 'Maryland', DATE '2026-09-20', 'OPEN', 'WARNING', 'Each payday statement must show employer details, pay-period dates, hours, rates, additions, deductions, gross pay, and net pay.', 'https://www.labor.maryland.gov/labor/wages/esspaystubfaq.shtml', 'Maryland Department of Labor', DATE '2026-12-01'),
  ('sick-leave', 'Adopt and track Maryland sick and safe leave', 'LEAVE', 'Maryland', DATE '2026-01-01', 'OPEN', 'WARNING', 'With fewer than 15 employees, eligible employees generally accrue unpaid sick and safe leave at one hour per 30 hours worked.', 'https://labor.maryland.gov/paidleave/', 'Maryland Department of Labor', DATE '2026-12-01'),
  ('year-end-w2', 'Prepare 2026 Form W-2 and state reconciliation', 'REPORTING', 'Federal and Maryland', DATE '2027-02-01', 'OPEN', 'WARNING', 'Reconcile employee identity, wages, withholding, and filed returns before year-end statements.', 'https://www.irs.gov/instructions/iw2w3', 'IRS', DATE '2026-12-01'),
  ('famli-2027', 'Register for Maryland FAMLI before 2027 withholding', 'REPORTING', 'Maryland', DATE '2026-12-31', 'OPEN', 'WARNING', 'Maryland says employers with one or more Maryland employees must register; payroll withholding begins January 1, 2027.', 'https://paidleave.maryland.gov/employers/make-contributions/', 'Maryland Department of Labor', DATE '2026-12-01'),
  ('federal-deposit-schedule', 'Confirm federal payroll-tax deposit schedule', 'FEDERAL_TAX', 'Federal', DATE '2026-09-14', 'OPEN', 'CRITICAL', 'Determine Vortex''s IRS lookback-period deposit schedule and reconcile every required deposit. Do not infer a schedule from company size.', 'https://www.irs.gov/publications/p15', 'IRS', DATE '2026-12-01'),
  ('federal-withholding-tables', 'Configure and verify 2026 federal withholding tables', 'FEDERAL_TAX', 'Federal', DATE '2026-09-14', 'OPEN', 'CRITICAL', 'Implement Publication 15-T only after W-4 data, pay frequency, rounding method, and an independent test set are available.', 'https://www.irs.gov/publications/p15t', 'IRS', DATE '2026-12-01'),
  ('md-withholding-tables', 'Configure and verify 2026 Maryland and local withholding', 'STATE_TAX', 'Maryland', DATE '2026-09-14', 'OPEN', 'CRITICAL', 'Use the current Maryland employer guide, employee MW507, residence/local jurisdiction, and the filing frequency assigned by the Comptroller.', 'https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/withholding-guide.pdf', 'Comptroller of Maryland', DATE '2026-12-01'),
  ('md-withholding-returns', 'Confirm Maryland withholding return frequency and catch up filings', 'STATE_TAX', 'Maryland', DATE '2026-09-14', 'OPEN', 'CRITICAL', 'Maryland due dates depend on whether the employer is assigned monthly, quarterly, accelerated, or annual filing.', 'https://services.marylandcomptroller.gov/taxes/en/filing-deadlines-and-due-dates?id=kb_article_view', 'Comptroller of Maryland', DATE '2026-12-01'),
  ('md-ui-quarterly', 'File Maryland unemployment contribution and wage reports', 'STATE_TAX', 'Maryland', DATE '2026-09-14', 'OPEN', 'CRITICAL', 'After registration, confirm the assigned unemployment rate and reconcile all required quarterly wage reports and contributions.', 'https://labor.maryland.gov/unemployment-insurance/employer-agent/new-employer-get-started.shtml', 'Maryland Department of Labor', DATE '2026-12-01'),
  ('futa-940', 'Calculate FUTA and prepare 2026 Form 940', 'FEDERAL_TAX', 'Federal', DATE '2027-02-01', 'OPEN', 'WARNING', 'FUTA is employer-paid. Track taxable wages, state unemployment credit, deposits, and the annual return.', 'https://www.irs.gov/businesses/small-businesses-self-employed/employment-tax-due-dates', 'IRS', DATE '2026-12-01'),
  ('record-retention', 'Adopt payroll and time-record retention policy', 'WAGE_HOUR', 'Federal', DATE '2026-09-14', 'OPEN', 'WARNING', 'Keep payroll records at least three years and wage-calculation source records at least two years; confirm any longer state or tax retention rule.', 'https://www.dol.gov/agencies/whd/fact-sheets/21-flsa-recordkeeping', 'U.S. Department of Labor', DATE '2026-12-01'),
  ('workplace-posters', 'Post required federal and Maryland workplace notices', 'ONBOARDING', 'Federal and Maryland', DATE '2026-09-14', 'OPEN', 'WARNING', 'Identify and display the current posters applicable to Vortex and its workforce.', 'https://www.dol.gov/agencies/whd/posters', 'U.S. Department of Labor', DATE '2026-12-01'),
  ('quickbooks-mapping', 'Have bookkeeper verify QuickBooks payroll accounts', 'REPORTING', 'Internal control', DATE '2026-09-20', 'OPEN', 'WARNING', 'Confirm wages expense, employer tax expense, tax liabilities, and payroll clearing account names before importing a journal CSV.', NULL, 'Vortex internal control', DATE '2026-12-01')
) v(task_key, title, category, jurisdiction, due_date, status, severity, description, source_url, source_authority, next_review_on)
ON CONFLICT (facility_id, task_key) DO NOTHING;

INSERT INTO payroll_compliance_task (
  facility_id, task_key, title, category, jurisdiction, due_date, status, severity,
  description, source_url, source_authority, last_verified_on, next_review_on, completion_note, completed_at
)
SELECT id, 'ein', 'Confirm federal EIN', 'FEDERAL_TAX', 'Federal', DATE '2026-01-01',
       'COMPLETE', 'INFO', 'Owner confirmed that Vortex has a federal EIN. Only the last four digits are stored here.',
       'https://www.irs.gov/businesses/small-businesses-self-employed/employer-id-numbers', 'IRS',
       DATE '2026-09-07', DATE '2026-12-01', 'Owner confirmed EIN ending 6663.', now()
FROM facility
ON CONFLICT (facility_id, task_key) DO NOTHING;
