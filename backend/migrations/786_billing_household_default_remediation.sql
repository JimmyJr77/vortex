-- Remediate the interval where migration 774 allowed newly created billing
-- accounts to inherit household collection without an explicit cutover. Keep
-- only accounts with durable evidence that household collection was enabled
-- intentionally, and record every decision before changing account state.

ALTER TABLE family_billing_account
  ALTER COLUMN household_monthly_billing_enabled SET DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS billing_household_default_remediation_audit (
  id                                   BIGSERIAL PRIMARY KEY,
  family_billing_account_id            BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE RESTRICT,
  remediation_key                      TEXT NOT NULL,
  outcome                              TEXT NOT NULL CHECK (outcome IN ('preserved', 'disabled')),
  reason                               TEXT NOT NULL,
  prior_household_billing_enabled      BOOLEAN NOT NULL,
  resulting_household_billing_enabled  BOOLEAN NOT NULL,
  evidence                             JSONB NOT NULL DEFAULT '{}'::jsonb,
  examined_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_billing_account_id, remediation_key),
  CHECK (jsonb_typeof(evidence) = 'object'),
  CHECK (prior_household_billing_enabled = TRUE),
  CHECK (
    (outcome = 'preserved' AND resulting_household_billing_enabled = TRUE)
    OR (outcome = 'disabled' AND resulting_household_billing_enabled = FALSE)
  )
);

CREATE INDEX IF NOT EXISTS idx_billing_household_default_remediation_account
  ON billing_household_default_remediation_audit(family_billing_account_id, examined_at DESC, id DESC);

WITH examined AS MATERIALIZED (
  SELECT
    account.id AS family_billing_account_id,
    canonical.id AS canonical_migration_id,
    activity.id AS explicit_activity_id,
    invoice.id AS household_invoice_id
  FROM family_billing_account account
  LEFT JOIN LATERAL (
    SELECT migration.id
    FROM billing_account_migration migration
    WHERE migration.family_billing_account_id = account.id
      AND migration.state IN ('household_active', 'verified')
      AND migration.household_activated_at IS NOT NULL
      AND migration.target_collection_mode = 'household_monthly'
    ORDER BY migration.household_activated_at DESC, migration.id DESC
    LIMIT 1
  ) canonical ON TRUE
  LEFT JOIN LATERAL (
    SELECT account_activity.id
    FROM billing_account_activity account_activity
    WHERE account_activity.family_billing_account_id = account.id
      AND (
        account_activity.event_type IN (
          'canonical_billing_migration_household_active',
          'household_monthly_billing_migrated',
          'household_monthly_billing_enabled'
        )
        OR (
          -- A retired legacy class collector is durable evidence only after
          -- every non-annual collector on the account has been detached.
          account_activity.event_type IN (
            'legacy_class_stripe_subscription_retired',
            'stripe_class_subscription_retired'
          )
          AND NOT EXISTS (
            SELECT 1
              FROM billing_subscription class_subscription
             WHERE class_subscription.family_billing_account_id = account.id
               AND class_subscription.status <> 'cancelled'
               AND class_subscription.source_type <> 'annual_membership'
               AND COALESCE(class_subscription.pricing_option_key, '') <> 'annual_membership'
               AND NULLIF(BTRIM(class_subscription.stripe_subscription_id), '') IS NOT NULL
          )
        )
      )
    ORDER BY account_activity.occurred_at DESC, account_activity.id DESC
    LIMIT 1
  ) activity ON TRUE
  LEFT JOIN LATERAL (
    SELECT monthly_invoice.id
    FROM billing_monthly_invoice monthly_invoice
    WHERE monthly_invoice.family_billing_account_id = account.id
    ORDER BY monthly_invoice.billing_month DESC, monthly_invoice.id DESC
    LIMIT 1
  ) invoice ON TRUE
  WHERE account.household_monthly_billing_enabled = TRUE
)
INSERT INTO billing_household_default_remediation_audit (
  family_billing_account_id,
  remediation_key,
  outcome,
  reason,
  prior_household_billing_enabled,
  resulting_household_billing_enabled,
  evidence
)
SELECT
  examined.family_billing_account_id,
  '786_billing_household_default_remediation',
  CASE
    WHEN examined.canonical_migration_id IS NOT NULL
      OR examined.explicit_activity_id IS NOT NULL
      OR examined.household_invoice_id IS NOT NULL
    THEN 'preserved'
    ELSE 'disabled'
  END,
  CASE
    WHEN examined.canonical_migration_id IS NOT NULL THEN 'canonical_activation_evidence'
    WHEN examined.explicit_activity_id IS NOT NULL THEN 'explicit_enable_activity'
    WHEN examined.household_invoice_id IS NOT NULL THEN 'existing_household_invoice'
    ELSE 'implicit_default_without_cutover_evidence'
  END,
  TRUE,
  examined.canonical_migration_id IS NOT NULL
    OR examined.explicit_activity_id IS NOT NULL
    OR examined.household_invoice_id IS NOT NULL,
  jsonb_build_object(
    'canonicalMigrationId', examined.canonical_migration_id,
    'explicitActivityId', examined.explicit_activity_id,
    'householdMonthlyInvoiceId', examined.household_invoice_id
  )
FROM examined
ON CONFLICT (family_billing_account_id, remediation_key) DO NOTHING;

UPDATE family_billing_account account
SET household_monthly_billing_enabled = FALSE,
    updated_at = now()
FROM billing_household_default_remediation_audit audit
WHERE audit.family_billing_account_id = account.id
  AND audit.remediation_key = '786_billing_household_default_remediation'
  AND audit.outcome = 'disabled'
  AND account.household_monthly_billing_enabled = TRUE;
