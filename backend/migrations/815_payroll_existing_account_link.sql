CREATE TABLE IF NOT EXISTS payroll_employee_account_link (
  employee_id BIGINT PRIMARY KEY REFERENCES payroll_employee(id),
  facility_id BIGINT NOT NULL REFERENCES payroll_settings(facility_id),
  user_id BIGINT NOT NULL,
  linked_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, user_id)
);
-- app_user identities are validated live during linking and every account
-- sign-in; no household, payer, or shared-email relationship grants access.
