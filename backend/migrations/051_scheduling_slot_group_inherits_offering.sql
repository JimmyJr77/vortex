-- Slot groups created with "inherit from offering" active dates track the offering row.
ALTER TABLE scheduling_slot_group
  ADD COLUMN IF NOT EXISTS inherits_offering_dates BOOLEAN NOT NULL DEFAULT FALSE;
