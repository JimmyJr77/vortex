-- Allow specific_date benefit unit on free pass templates.

ALTER TABLE free_pass_template DROP CONSTRAINT IF EXISTS free_pass_template_benefit_unit_check;

ALTER TABLE free_pass_template
  ADD CONSTRAINT free_pass_template_benefit_unit_check
  CHECK (benefit_unit IN ('slot','offering','day','week','month','hour','specific_date'));
