-- Calendar item packing list (line items), separate from event 5 Ws copy.

ALTER TABLE coaching.event_calendar_item
  ADD COLUMN IF NOT EXISTS what_to_bring JSONB NOT NULL DEFAULT '[]'::jsonb;
