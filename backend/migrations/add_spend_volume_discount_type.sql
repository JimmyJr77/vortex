-- Allow spend_volume discount rules (monthly spend system discount).
DO $$
DECLARE
  cname TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'discount_rule'
  ) THEN
    RETURN;
  END IF;

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
    AND (
      con.conname = 'discount_rule_type_check'
      OR pg_get_constraintdef(con.oid) LIKE '%promo_code%'
    )
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE discount_rule DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE discount_rule ADD CONSTRAINT discount_rule_type_check
    CHECK (type IN (
      'promo_code', 'school', 'city', 'multi_class', 'multi_child', 'free_classes', 'spend_volume'
    ));
END $$;
