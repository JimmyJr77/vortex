-- ============================================================
-- Coaching Module: Live Sessions & Attendance (Phase E)
-- Migration: 021_coaching_sessions_attendance.sql
--
-- Connects the coaching plan layer to what actually happens on the gym
-- floor. A `session` is a dated instance of a class (optionally linked to a
-- scheduled calendar slot and an assigned workout). `session_attendance`
-- records who showed up, and `completion_log.session_id` ties "what they did"
-- to that session so the coach can log the whole class at once.
--
-- IDEMPOTENT: safe to re-run on every boot.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.session (
  id                 BIGSERIAL PRIMARY KEY,
  facility_id        BIGINT NOT NULL,
  coach_user_id      BIGINT NOT NULL,
  assignment_id      BIGINT,            -- public.coach_class_assignment.id (loose ref)
  program_id         BIGINT,            -- public.program.id (loose ref)
  class_iteration_id BIGINT,            -- public.class_iteration.id (loose ref)
  workout_id         BIGINT REFERENCES coaching.workout(id) ON DELETE SET NULL,
  calendar_event_key TEXT,              -- scheduling event key (formId:slotGroupId:timeSlotId:date)
  session_date       DATE NOT NULL,
  start_time         TEXT,
  end_time           TEXT,
  title              TEXT,
  status             TEXT NOT NULL DEFAULT 'planned',  -- planned | in_progress | completed | cancelled
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One persisted session per scheduled calendar instance per coach.
CREATE UNIQUE INDEX IF NOT EXISTS uq_coaching_session_event
  ON coaching.session(coach_user_id, calendar_event_key)
  WHERE calendar_event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coaching_session_coach_date
  ON coaching.session(coach_user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_coaching_session_facility_date
  ON coaching.session(facility_id, session_date);

CREATE TABLE IF NOT EXISTS coaching.session_attendance (
  id           BIGSERIAL PRIMARY KEY,
  session_id   BIGINT NOT NULL REFERENCES coaching.session(id) ON DELETE CASCADE,
  member_id    BIGINT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'present',  -- present | absent | late | excused
  check_in_at  TIMESTAMPTZ,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_coaching_session_attendance_session
  ON coaching.session_attendance(session_id);

-- Link completion logs to the session they were performed in.
ALTER TABLE coaching.completion_log
  ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES coaching.session(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coaching_completion_session
  ON coaching.completion_log(session_id);
