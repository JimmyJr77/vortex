-- Covering indexes for admin enrollment/class roster hot paths.
-- Active (non-orphaned, non-archived) signups are filtered constantly by form,
-- slot group, and status; cancel-effective jobs scan by date.

CREATE INDEX IF NOT EXISTS idx_scheduling_signup_active_form_slot_status
  ON scheduling_signup (form_id, slot_group_id, status)
  WHERE orphaned_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_signup_active_slot_group_status
  ON scheduling_signup (slot_group_id, status, created_at, id)
  WHERE orphaned_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_signup_cancel_effective_due
  ON scheduling_signup (cancel_effective_date)
  WHERE cancel_effective_date IS NOT NULL
    AND orphaned_at IS NULL
    AND status IN ('confirmed', 'waitlisted', 'paused');
