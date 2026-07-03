-- Member-requested enrollment cancellations take effect on the 1st of the month.
-- Until then the signup stays confirmed; billing stops on the next 1st (next_bill_date cleared).

ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS cancel_effective_date DATE;
ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ;
