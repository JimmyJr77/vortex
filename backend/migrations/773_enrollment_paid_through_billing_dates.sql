-- Give unambiguous legacy prepaid enrollment charges a real service month, then
-- advance only subscriptions whose charge for that month is fully covered.

INSERT INTO billing_account_activity (
  event_key, family_billing_account_id, member_id, signup_id, related_charge_id,
  event_type, summary, before_value, after_value, details, actor_type
)
SELECT
  'enrollment-charge-service-period-backfill:' || charge.id,
  charge.family_billing_account_id,
  charge.member_id,
  signup.id,
  charge.id,
  'enrollment_charge_service_period_repaired',
  'Prepaid enrollment charge assigned to its unambiguous service month',
  jsonb_build_object('servicePeriodStart', charge.service_period_start, 'servicePeriodEnd', charge.service_period_end),
  jsonb_build_object(
    'servicePeriodStart', subscription.next_bill_date,
    'servicePeriodEnd', (subscription.next_bill_date + INTERVAL '1 month - 1 day')::date
  ),
  jsonb_build_object('migration', 773, 'reason', 'future_or_month_boundary_enrollment'),
  'system'
FROM billing_charge charge
JOIN billing_subscription subscription ON subscription.id = charge.subscription_id
JOIN scheduling_signup signup
  ON subscription.source_type = 'scheduling_signup'
 AND subscription.source_id ~ '^[0-9]+$'
 AND signup.id = subscription.source_id::bigint
WHERE charge.charge_type = 'recurring'
  AND charge.source_type = 'scheduling_signup'
  AND charge.service_period_start IS NULL
  AND charge.service_period_end IS NULL
  AND subscription.next_bill_date IS NOT NULL
  AND charge.amount_cents = subscription.net_monthly_cents
  AND signup.enrollment_start_date >= subscription.next_bill_date - 1
  AND signup.enrollment_start_date < subscription.next_bill_date + INTERVAL '1 month'
ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING;

UPDATE billing_charge charge
SET service_period_start = subscription.next_bill_date,
    service_period_end = (subscription.next_bill_date + INTERVAL '1 month - 1 day')::date
FROM billing_subscription subscription, scheduling_signup signup
WHERE subscription.id = charge.subscription_id
  AND subscription.source_type = 'scheduling_signup'
  AND subscription.source_id ~ '^[0-9]+$'
  AND signup.id = subscription.source_id::bigint
  AND charge.charge_type = 'recurring'
  AND charge.source_type = 'scheduling_signup'
  AND charge.service_period_start IS NULL
  AND charge.service_period_end IS NULL
  AND subscription.next_bill_date IS NOT NULL
  AND charge.amount_cents = subscription.net_monthly_cents
  AND signup.enrollment_start_date >= subscription.next_bill_date - 1
  AND signup.enrollment_start_date < subscription.next_bill_date + INTERVAL '1 month';

INSERT INTO billing_account_activity (
  event_key, family_billing_account_id, member_id, signup_id,
  event_type, summary, before_value, after_value, details, actor_type
)
SELECT
  'enrollment-paid-through-next-bill:' || subscription.id || ':' || paid_through.paid_through_date,
  subscription.family_billing_account_id,
  subscription.member_id,
  CASE
    WHEN subscription.source_type = 'scheduling_signup' AND subscription.source_id ~ '^[0-9]+$'
      THEN subscription.source_id::bigint
    ELSE NULL
  END,
  'enrollment_next_bill_advanced',
  'Next enrollment bill advanced through the fully paid service month',
  jsonb_build_object('nextBillDate', subscription.next_bill_date),
  jsonb_build_object('nextBillDate', paid_through.paid_through_date + 1),
  jsonb_build_object('migration', 773, 'paidThroughDate', paid_through.paid_through_date),
  'system'
FROM billing_subscription subscription
JOIN LATERAL (
  SELECT MAX(charge.service_period_end) AS paid_through_date
  FROM billing_charge charge
  WHERE charge.subscription_id = subscription.id
    AND charge.charge_type = 'recurring'
    AND charge.service_period_end IS NOT NULL
    AND COALESCE((
      SELECT SUM(CASE
        WHEN application.application_kind = 'reversal' THEN -application.amount_cents
        ELSE application.amount_cents
      END)
      FROM billing_payment_application application
      WHERE application.billing_charge_id = charge.id
    ), 0) >= charge.amount_cents
) paid_through ON paid_through.paid_through_date IS NOT NULL
WHERE subscription.status = 'active'
  AND subscription.next_bill_date IS NOT NULL
  AND paid_through.paid_through_date + 1 > subscription.next_bill_date
ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING;

WITH paid_through AS (
  SELECT charge.subscription_id, MAX(charge.service_period_end) AS paid_through_date
  FROM billing_charge charge
  WHERE charge.charge_type = 'recurring'
    AND charge.service_period_end IS NOT NULL
    AND COALESCE((
      SELECT SUM(CASE
        WHEN application.application_kind = 'reversal' THEN -application.amount_cents
        ELSE application.amount_cents
      END)
      FROM billing_payment_application application
      WHERE application.billing_charge_id = charge.id
    ), 0) >= charge.amount_cents
  GROUP BY charge.subscription_id
)
UPDATE billing_subscription subscription
SET next_bill_date = paid_through.paid_through_date + 1,
    updated_at = now()
FROM paid_through
WHERE paid_through.subscription_id = subscription.id
  AND subscription.status = 'active'
  AND subscription.next_bill_date IS NOT NULL
  AND paid_through.paid_through_date IS NOT NULL
  AND paid_through.paid_through_date + 1 > subscription.next_bill_date;
