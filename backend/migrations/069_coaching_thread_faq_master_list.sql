-- Thread FAQ master list (member-facing curated FAQs) + facility-scoped library entries

ALTER TABLE coaching.thread_faq
  ADD COLUMN IF NOT EXISTS facility_id BIGINT REFERENCES public.facility(id) ON DELETE CASCADE;

ALTER TABLE coaching.thread_faq
  ADD COLUMN IF NOT EXISTS in_master_list BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE coaching.thread_faq
  ADD COLUMN IF NOT EXISTS master_sort_order INT;

ALTER TABLE coaching.thread_faq
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE coaching.thread_faq tf
SET facility_id = t.facility_id
FROM coaching.message_thread t
WHERE t.id = tf.thread_id
  AND tf.facility_id IS NULL;

ALTER TABLE coaching.thread_faq
  ALTER COLUMN thread_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_thread_faq_facility
  ON coaching.thread_faq(facility_id);

CREATE INDEX IF NOT EXISTS idx_thread_faq_master
  ON coaching.thread_faq(facility_id, in_master_list)
  WHERE in_master_list = TRUE;
