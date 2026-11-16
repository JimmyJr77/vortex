ALTER TABLE family_billing_account
  ADD COLUMN IF NOT EXISTS collection_day integer NOT NULL DEFAULT 1
  CONSTRAINT family_billing_account_collection_day_check CHECK (collection_day BETWEEN 1 AND 31);
