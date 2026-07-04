/**
 * Idempotent coaching schema helpers for production when SQL migrations lag behind code deploys.
 */

let notificationSchemaPromise = null
let messageThreadSchemaPromise = null

export async function ensureCoachingNotificationSchema(pool) {
  if (!notificationSchemaPromise) {
    notificationSchemaPromise = applyCoachingNotificationSchema(pool).catch((err) => {
      notificationSchemaPromise = null
      throw err
    })
  }
  return notificationSchemaPromise
}

async function applyCoachingNotificationSchema(pool) {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS coaching`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.notification (
      id                  BIGSERIAL PRIMARY KEY,
      facility_id         BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
      recipient_member_id BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      recipient_user_id   BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      kind                TEXT NOT NULL CHECK (kind IN (
        'assignment', 'personal_record', 'message', 'achievement', 'system'
      )),
      title               TEXT NOT NULL,
      body                TEXT,
      payload             JSONB NOT NULL DEFAULT '{}',
      read_at             TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (recipient_member_id IS NOT NULL OR recipient_user_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_coaching_notification_member_unread
      ON coaching.notification(recipient_member_id, read_at)
      WHERE recipient_member_id IS NOT NULL
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_coaching_notification_user_unread
      ON coaching.notification(recipient_user_id, read_at)
      WHERE recipient_user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_coaching_notification_facility_created
      ON coaching.notification(facility_id, created_at DESC)
  `)
}

export async function ensureCoachingMessageThreadSchema(pool) {
  if (!messageThreadSchemaPromise) {
    messageThreadSchemaPromise = applyCoachingMessageThreadSchema(pool).catch((err) => {
      messageThreadSchemaPromise = null
      throw err
    })
  }
  return messageThreadSchemaPromise
}

async function applyCoachingMessageThreadSchema(pool) {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS coaching`)
  await pool.query(`
    ALTER TABLE coaching.message_thread
      ADD COLUMN IF NOT EXISTS subject_locked BOOLEAN NOT NULL DEFAULT FALSE
  `)
  await pool.query(`
    ALTER TABLE coaching.message_thread
      ALTER COLUMN member_id DROP NOT NULL
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_thread_participant (
      id          BIGSERIAL PRIMARY KEY,
      thread_id   BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      user_id     BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id   BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_message_thread_participant_thread
      ON coaching.message_thread_participant(thread_id)
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_participant_user
      ON coaching.message_thread_participant(thread_id, user_id)
      WHERE user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_participant_member
      ON coaching.message_thread_participant(thread_id, member_id)
      WHERE member_id IS NOT NULL
  `)
  await pool.query(`
    INSERT INTO coaching.message_thread_participant (thread_id, member_id)
    SELECT t.id, t.member_id
    FROM coaching.message_thread t
    WHERE t.member_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM coaching.message_thread_participant p
        WHERE p.thread_id = t.id AND p.member_id = t.member_id
      )
  `)
  await pool.query(`
    INSERT INTO coaching.message_thread_participant (thread_id, user_id)
    SELECT t.id, t.coach_user_id
    FROM coaching.message_thread t
    WHERE t.coach_user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM coaching.message_thread_participant p
        WHERE p.thread_id = t.id AND p.user_id = t.coach_user_id
      )
  `)
}
