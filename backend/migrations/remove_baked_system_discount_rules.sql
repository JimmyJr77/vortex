-- Remove auto-seeded multi-class and monthly-spend system discount rules.
-- Safe to re-run (idempotent).

DELETE FROM discount_rule
WHERE
  (
    type IN ('multi_class', 'multi_child')
    AND (
      config->>'system_key' IN ('multi_class', 'multi_family')
      OR exclusivity_group IN ('multi_class', 'multi_family')
      OR name ILIKE 'multi-class discount%'
    )
  )
  OR (
    type = 'spend_volume'
    AND (
      config->>'system_key' = 'monthly_spend'
      OR exclusivity_group = 'monthly_spend'
      OR name ILIKE 'monthly spend%'
      OR name ILIKE '%monthly family spend%'
    )
  );
