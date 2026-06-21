-- Allow spend_volume discount rules (monthly spend system discount).
DO $$
DECLARE
  cname TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'discount_rule'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%spend_volume%'
  ) THEN
    RETURN;
  END IF;

  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'discount_rule'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%type%'
    AND pg_get_constraintdef(con.oid) LIKE '%IN%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE discount_rule DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE discount_rule ADD CONSTRAINT discount_rule_type_check
    CHECK (type IN (
      'promo_code', 'school', 'city', 'multi_class', 'multi_child', 'free_classes', 'spend_volume'
    ));
END $$;
