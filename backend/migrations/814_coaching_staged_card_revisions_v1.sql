-- Stage reviewed changes without changing active canonical definitions or releases.
-- Reuse the immutable canonical revision history; staged snapshots are not library cards.
-- IDEMPOTENT.

ALTER TABLE coaching.exercise_card_revision_v1
  ADD COLUMN IF NOT EXISTS staged_revision_id UUID REFERENCES coaching.exercise_card_revision_v1(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  ADD COLUMN IF NOT EXISTS source_card_version INTEGER CHECK (source_card_version >= 1);

ALTER TABLE coaching.exercise_card_revision_v1
  DROP CONSTRAINT IF EXISTS exercise_card_revision_v1_action_check;
ALTER TABLE coaching.exercise_card_revision_v1
  ADD CONSTRAINT exercise_card_revision_v1_action_check CHECK (action IN (
    'created', 'updated', 'submitted_for_review', 'returned_to_draft', 'published', 'deprecated', 'archived',
    'revision_staged', 'revision_edited', 'revision_submitted', 'revision_returned', 'revision_archived'
  ));

ALTER TABLE coaching.exercise_card_revision_v1
  DROP CONSTRAINT IF EXISTS exercise_card_revision_v1_staged_scope_check;
ALTER TABLE coaching.exercise_card_revision_v1
  ADD CONSTRAINT exercise_card_revision_v1_staged_scope_check CHECK (
    (staged_revision_id IS NULL AND source_card_version IS NULL AND action NOT LIKE 'revision_%')
    OR (staged_revision_id IS NOT NULL AND source_card_version IS NOT NULL AND action LIKE 'revision_%'
      AND to_status IN ('draft','review','archived'))
  );

CREATE INDEX IF NOT EXISTS exercise_card_revision_staged_head_idx
  ON coaching.exercise_card_revision_v1 (facility_id, staged_revision_id, revision_number DESC)
  WHERE staged_revision_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS exercise_card_revision_proposal_origin_idx
  ON coaching.exercise_card_revision_v1 (facility_id, (snapshot_json #>> '{origin,draftAuditId}'), revision_number DESC)
  WHERE staged_revision_id IS NOT NULL;
