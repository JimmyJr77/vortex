-- Cancelled signups can outlive deleted slots; keep history without blocking deletes.
ALTER TABLE scheduling_signup ALTER COLUMN time_slot_id DROP NOT NULL;
