CREATE TABLE IF NOT EXISTS payroll_retirement_employer_run_ledger (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 run_id BIGINT NOT NULL REFERENCES payroll_run(id),
 employee_id BIGINT NOT NULL REFERENCES payroll_employee(id),
 plan_id TEXT NOT NULL,
 tax_year INTEGER NOT NULL CHECK(tax_year=2026),
 calculation JSONB NOT NULL CHECK(jsonb_typeof(calculation)='object'),
 matching_cents BIGINT NOT NULL CHECK(matching_cents BETWEEN 0 AND 9007199254740991),
 nonelective_cents BIGINT NOT NULL CHECK(nonelective_cents BETWEEN 0 AND 9007199254740991),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(run_id,employee_id,plan_id),
 CHECK(matching_cents+nonelective_cents<=9007199254740991)
);
CREATE OR REPLACE FUNCTION payroll_validate_employer_retirement_run_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF NEW.calculation->'requiresPayrollIntegration' IS DISTINCT FROM 'false'::jsonb
 OR NEW.calculation->'previewOnly' IS DISTINCT FROM 'false'::jsonb
 OR NEW.calculation#>>'{contribution,status}' IS DISTINCT FROM 'CALCULATED_NOT_AUTHORIZED'
 OR NEW.calculation#>'{contribution,proposed,matchingCents}' IS DISTINCT FROM to_jsonb(NEW.matching_cents)
 OR NEW.calculation#>'{contribution,proposed,nonelectiveCents}' IS DISTINCT FROM to_jsonb(NEW.nonelective_cents)
 OR NEW.calculation#>'{contribution,proposed,totalCents}' IS DISTINCT FROM to_jsonb(NEW.matching_cents+NEW.nonelective_cents)
 THEN RAISE EXCEPTION 'Employer reservations require exact integrated contribution amounts.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
 JOIN payroll_run_employee e ON e.payroll_run_id=r.id JOIN payroll_employee employee_scope ON employee_scope.id=e.employee_id AND employee_scope.facility_id=r.facility_id
 JOIN payroll_retirement_run_ledger d ON d.run_id=r.id AND d.employee_id=e.employee_id AND d.plan_id=NEW.plan_id AND d.facility_id=r.facility_id
 WHERE r.id=NEW.run_id AND r.facility_id=NEW.facility_id AND e.employee_id=NEW.employee_id AND r.status IN ('APPROVED','FINALIZED')
 AND EXTRACT(YEAR FROM COALESCE(r.payment_date,p.pay_date))=NEW.tax_year
 AND NEW.calculation->>'payDate'=COALESCE(r.payment_date,p.pay_date)::text
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(r.calculation_snapshot->'employees','[]'::jsonb)) employee,
 jsonb_array_elements(COALESCE(employee->'employerRetirementPlans','[]'::jsonb)) plan
 WHERE employee->>'employeeId'=NEW.employee_id::text AND plan->>'planId'=NEW.plan_id AND plan->'calculation'=NEW.calculation))
 THEN RAISE EXCEPTION 'Employer ledger requires exact approved employee payroll and retained deferral evidence.'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_validate_employer_retirement_run_ledger ON payroll_retirement_employer_run_ledger;
CREATE TRIGGER payroll_validate_employer_retirement_run_ledger BEFORE INSERT ON payroll_retirement_employer_run_ledger FOR EACH ROW EXECUTE FUNCTION payroll_validate_employer_retirement_run_ledger();
DROP TRIGGER IF EXISTS payroll_guard_employer_retirement_run_ledger ON payroll_retirement_employer_run_ledger;
CREATE TRIGGER payroll_guard_employer_retirement_run_ledger BEFORE UPDATE OR DELETE ON payroll_retirement_employer_run_ledger FOR EACH ROW EXECUTE FUNCTION payroll_guard_payment_connection();
