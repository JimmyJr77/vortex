-- Short labels for calendar chips (e.g. "T&T" for "Tramp and Tumble").
-- Backfill existing rows with the full display name.

ALTER TABLE programs ADD COLUMN IF NOT EXISTS abridged_name TEXT;
UPDATE programs SET abridged_name = display_name WHERE abridged_name IS NULL;

ALTER TABLE program_categories ADD COLUMN IF NOT EXISTS abridged_name TEXT;
UPDATE program_categories SET abridged_name = display_name WHERE abridged_name IS NULL;

ALTER TABLE program ADD COLUMN IF NOT EXISTS abridged_name TEXT;
UPDATE program SET abridged_name = display_name WHERE abridged_name IS NULL;
