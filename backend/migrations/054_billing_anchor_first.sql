-- First-month proration rollout: anchor all recurring billing to the 1st of the month.
-- Existing subscriptions move their next bill to the first 1st on/after the current
-- next_bill_date (never earlier, so no period is double-billed; members get at most a
-- few grace days on their current cycle). Idempotent: safe to re-run on every boot.

-- 1. Push mid-month next_bill_date values forward to the next 1st.
UPDATE billing_subscription
SET next_bill_date = (date_trunc('month', next_bill_date) + INTERVAL '1 month')::date,
    updated_at = now()
WHERE status <> 'cancelled'
  AND next_bill_date IS NOT NULL
  AND EXTRACT(DAY FROM next_bill_date) <> 1;

-- 2. Anchor every subscription to day 1 so future cycles land on the 1st.
UPDATE billing_subscription
SET anchor_day = 1,
    updated_at = now()
WHERE anchor_day IS DISTINCT FROM 1;
