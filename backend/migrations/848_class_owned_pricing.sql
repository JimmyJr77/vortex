-- Freeze inherited pricing per class without rewriting enrollments, subscriptions,
-- charges, discount assignments, form IDs, groups, or slots. Retain legacy options
-- and allocation flags so existing multi-class/frequency arrangements keep working.
ALTER TABLE scheduling_form ADD COLUMN IF NOT EXISTS class_program_pricing JSONB;
ALTER TABLE scheduling_form ADD COLUMN IF NOT EXISTS class_monthly_price_cents INTEGER CHECK (class_monthly_price_cents >= 0);

-- Older unscheduled classes still need a canonical form to own their price.
INSERT INTO scheduling_form (program_id, programs_id, title, description, is_active)
SELECT c.id,c.programs_id,c.display_name,c.description,c.is_active
FROM program c WHERE NOT EXISTS (SELECT 1 FROM scheduling_form f WHERE f.program_id=c.id AND f.deleted_at IS NULL);

UPDATE scheduling_form f SET class_program_pricing = COALESCE((
  SELECT to_jsonb(p) FROM programs p
  WHERE p.id = CASE WHEN EXISTS (SELECT 1 FROM program c WHERE c.id=f.program_id)
    THEN (SELECT c.programs_id FROM program c WHERE c.id=f.program_id AND c.facility_id=p.facility_id)
    ELSE f.programs_id END
), '{}'::jsonb)
WHERE f.class_program_pricing IS NULL;
-- New classes never inherit a program price. Existing snapshots are immutable
-- unless the class's own pricing is explicitly edited.
ALTER TABLE scheduling_form ALTER COLUMN class_program_pricing SET DEFAULT '{}'::jsonb;
ALTER TABLE scheduling_form ALTER COLUMN class_program_pricing SET NOT NULL;

CREATE OR REPLACE FUNCTION preserve_class_owned_pricing() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    -- New forms have no inherited pricing or program-wide allocation scope.
    NEW.pricing_overrides_program := TRUE;
  ELSE
    IF OLD.pricing_overrides_program AND NOT NEW.pricing_overrides_program THEN
      RAISE EXCEPTION 'Pricing is managed per class. Program price resets are no longer supported.';
    END IF;
    -- Keep old-admin scheduling price edits in sync with the simplified editor.
    IF (NEW.cost_amount_cents,NEW.cost_unit,NEW.slot_cost_monthly_cents) IS DISTINCT FROM
       (OLD.cost_amount_cents,OLD.cost_unit,OLD.slot_cost_monthly_cents) THEN
      NEW.class_monthly_price_cents := CASE WHEN NEW.cost_unit='per_month' THEN COALESCE(NEW.cost_amount_cents,NEW.slot_cost_monthly_cents,0) ELSE NULL END;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS class_owned_pricing_guard ON scheduling_form;
CREATE TRIGGER class_owned_pricing_guard BEFORE INSERT OR UPDATE ON scheduling_form FOR EACH ROW EXECUTE FUNCTION preserve_class_owned_pricing();

-- Keep legacy columns for historical option references, but prevent any admin
-- screen from making them a live default again.
CREATE OR REPLACE FUNCTION reject_program_price_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.pricing_slot_cost_monthly_cents,NEW.pricing_cost_amount_cents,NEW.pricing_cost_unit,NEW.pricing_cost_options)
    IS DISTINCT FROM (OLD.pricing_slot_cost_monthly_cents,OLD.pricing_cost_amount_cents,OLD.pricing_cost_unit,OLD.pricing_cost_options) THEN
    RAISE EXCEPTION 'Set prices on individual classes; program default prices are retired.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS program_price_readonly ON programs;
CREATE TRIGGER program_price_readonly BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION reject_program_price_change();
