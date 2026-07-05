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
  await pool.query(`
    ALTER TABLE coaching.message
      ADD COLUMN IF NOT EXISTS sender_portal TEXT
  `)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'message_sender_portal_check'
          AND conrelid = 'coaching.message'::regclass
      ) THEN
        ALTER TABLE coaching.message
          ADD CONSTRAINT message_sender_portal_check
          CHECK (sender_portal IS NULL OR sender_portal IN ('admin', 'coach', 'member'));
      END IF;
    END $$
  `)
  await pool.query(`
    UPDATE coaching.message
    SET sender_portal = 'member'
    WHERE sender_portal IS NULL AND sender_member_id IS NOT NULL
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_thread_favorite (
      id            BIGSERIAL PRIMARY KEY,
      thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      favorited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_favorite_user
      ON coaching.message_thread_favorite(thread_id, user_id)
      WHERE user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_favorite_member
      ON coaching.message_thread_favorite(thread_id, member_id)
      WHERE member_id IS NOT NULL
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_thread_inbox_hide (
      id          BIGSERIAL PRIMARY KEY,
      thread_id   BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      user_id     BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id   BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      hidden_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_inbox_hide_user
      ON coaching.message_thread_inbox_hide(thread_id, user_id)
      WHERE user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_inbox_hide_member
      ON coaching.message_thread_inbox_hide(thread_id, member_id)
      WHERE member_id IS NOT NULL
  `)
  await pool.query(`
    ALTER TABLE coaching.message ADD COLUMN IF NOT EXISTS attachment_url TEXT
  `)
  await pool.query(`
    ALTER TABLE coaching.message ADD COLUMN IF NOT EXISTS attachment_name TEXT
  `)
  await pool.query(`
    ALTER TABLE coaching.message ADD COLUMN IF NOT EXISTS attachment_mime TEXT
  `)
  await ensureCoachingMessagePlatformSchema(pool)
}

let messagePlatformSchemaPromise = null

export async function ensureCoachingMessagePlatformSchema(pool) {
  if (!messagePlatformSchemaPromise) {
    messagePlatformSchemaPromise = applyCoachingMessagePlatformSchema(pool).catch((err) => {
      messagePlatformSchemaPromise = null
      throw err
    })
  }
  return messagePlatformSchemaPromise
}

async function applyCoachingMessagePlatformSchema(pool) {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS coaching`)

  await pool.query(`ALTER TABLE coaching.message_thread ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'general'`)
  await pool.query(`ALTER TABLE coaching.message_thread ADD COLUMN IF NOT EXISTS linked_thread_id BIGINT`)
  await pool.query(`ALTER TABLE coaching.message_thread ADD COLUMN IF NOT EXISTS space_id BIGINT`)
  await pool.query(`ALTER TABLE coaching.message_thread ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'participants'`)
  await pool.query(`ALTER TABLE coaching.message_thread ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`)
  await pool.query(`ALTER TABLE coaching.message_thread ADD COLUMN IF NOT EXISTS locked_by_user_id BIGINT`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_space (
      id            BIGSERIAL PRIMARY KEY,
      facility_id   BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      slug          TEXT NOT NULL,
      object_type   TEXT,
      object_id     BIGINT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (facility_id, slug)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_message_space_facility ON coaching.message_space(facility_id)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_thread_tag (
      id            BIGSERIAL PRIMARY KEY,
      facility_id   BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
      slug          TEXT NOT NULL,
      label         TEXT NOT NULL,
      sort_order    INT NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (facility_id, slug)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_thread_tag_link (
      thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      tag_id        BIGINT NOT NULL REFERENCES coaching.message_thread_tag(id) ON DELETE CASCADE,
      PRIMARY KEY (thread_id, tag_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_thread_link (
      id            BIGSERIAL PRIMARY KEY,
      thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      object_type   TEXT NOT NULL,
      object_id     BIGINT NOT NULL,
      link_role     TEXT NOT NULL DEFAULT 'related',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (thread_id, object_type, object_id, link_role)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_message_thread_link_object ON coaching.message_thread_link(object_type, object_id)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_thread_info (
      thread_id     BIGINT PRIMARY KEY REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      info_json     JSONB NOT NULL DEFAULT '{}',
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_thread_read (
      id                    BIGSERIAL PRIMARY KEY,
      thread_id             BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      user_id               BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id             BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      last_read_message_id  BIGINT,
      last_read_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_read_user
      ON coaching.message_thread_read(thread_id, user_id) WHERE user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_read_member
      ON coaching.message_thread_read(thread_id, member_id) WHERE member_id IS NOT NULL
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_pin (
      id            BIGSERIAL PRIMARY KEY,
      thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      message_id    BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
      pinned_by_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
      pinned_by_member_id BIGINT REFERENCES public.member(id) ON DELETE SET NULL,
      pinned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (thread_id, message_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_pin_group (
      id          BIGSERIAL PRIMARY KEY,
      thread_id   BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      user_id     BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id   BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_message_pin_group_thread_user
      ON coaching.message_pin_group(thread_id, user_id)
      WHERE user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_message_pin_group_thread_member
      ON coaching.message_pin_group(thread_id, member_id)
      WHERE member_id IS NOT NULL
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_pin_group_item (
      group_id    BIGINT NOT NULL REFERENCES coaching.message_pin_group(id) ON DELETE CASCADE,
      message_id  BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, message_id)
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_message_pin_group_item_message
      ON coaching.message_pin_group_item(message_id)
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_thread_editor (
      id            BIGSERIAL PRIMARY KEY,
      thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      can_edit_info BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_editor_user
      ON coaching.message_thread_editor(thread_id, user_id) WHERE user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_editor_member
      ON coaching.message_thread_editor(thread_id, member_id) WHERE member_id IS NOT NULL
  `)

  await pool.query(`ALTER TABLE coaching.message ADD COLUMN IF NOT EXISTS is_critical BOOLEAN NOT NULL DEFAULT FALSE`)
  await pool.query(`ALTER TABLE coaching.message ADD COLUMN IF NOT EXISTS requires_ack BOOLEAN NOT NULL DEFAULT FALSE`)
  await pool.query(`ALTER TABLE coaching.message ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ`)
  await pool.query(`ALTER TABLE coaching.message ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_file (
      id              BIGSERIAL PRIMARY KEY,
      message_id      BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
      thread_id       BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      facility_id     BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
      url             TEXT NOT NULL,
      name            TEXT NOT NULL,
      mime            TEXT,
      size_bytes      BIGINT,
      version         INT NOT NULL DEFAULT 1,
      tag_slug        TEXT,
      uploaded_by_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
      uploaded_by_member_id BIGINT REFERENCES public.member(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_message_file_thread ON coaching.message_file(thread_id, created_at DESC)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_message_file_facility ON coaching.message_file(facility_id, created_at DESC)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_ack (
      id            BIGSERIAL PRIMARY KEY,
      message_id    BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
      user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_ack_user
      ON coaching.message_ack(message_id, user_id) WHERE user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_ack_member
      ON coaching.message_ack(message_id, member_id) WHERE member_id IS NOT NULL
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.notification_preference (
      id                    BIGSERIAL PRIMARY KEY,
      facility_id           BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
      user_id               BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id             BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      allow_critical_email  BOOLEAN NOT NULL DEFAULT FALSE,
      allow_critical_sms    BOOLEAN NOT NULL DEFAULT FALSE,
      phone_e164            TEXT,
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preference_user
      ON coaching.notification_preference(facility_id, user_id) WHERE user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preference_member
      ON coaching.notification_preference(facility_id, member_id) WHERE member_id IS NOT NULL
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_read (
      id            BIGSERIAL PRIMARY KEY,
      message_id    BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
      user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      read_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_read_user
      ON coaching.message_read(message_id, user_id) WHERE user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_read_member
      ON coaching.message_read(message_id, member_id) WHERE member_id IS NOT NULL
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_poll (
      id            BIGSERIAL PRIMARY KEY,
      message_id    BIGINT NOT NULL UNIQUE REFERENCES coaching.message(id) ON DELETE CASCADE,
      question      TEXT NOT NULL,
      options_json  JSONB NOT NULL DEFAULT '[]',
      closes_at     TIMESTAMPTZ,
      is_closed     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`ALTER TABLE coaching.message_poll ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_poll_vote (
      id            BIGSERIAL PRIMARY KEY,
      poll_id       BIGINT NOT NULL REFERENCES coaching.message_poll(id) ON DELETE CASCADE,
      option_index  INT NOT NULL,
      user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      voted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_checklist (
      id            BIGSERIAL PRIMARY KEY,
      message_id    BIGINT NOT NULL UNIQUE REFERENCES coaching.message(id) ON DELETE CASCADE,
      title         TEXT NOT NULL DEFAULT 'Signup list',
      sheet_type    TEXT NOT NULL DEFAULT 'items',
      items_json    JSONB NOT NULL DEFAULT '[]',
      config_json   JSONB NOT NULL DEFAULT '{}',
      closes_at     TIMESTAMPTZ,
      is_closed     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`ALTER TABLE coaching.message_checklist ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Signup list'`)
  await pool.query(`ALTER TABLE coaching.message_checklist ADD COLUMN IF NOT EXISTS sheet_type TEXT NOT NULL DEFAULT 'items'`)
  await pool.query(`ALTER TABLE coaching.message_checklist ADD COLUMN IF NOT EXISTS config_json JSONB NOT NULL DEFAULT '{}'`)
  await pool.query(`ALTER TABLE coaching.message_checklist ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ`)
  await pool.query(`ALTER TABLE coaching.message_checklist ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE`)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'message_checklist_sheet_type_check'
          AND conrelid = 'coaching.message_checklist'::regclass
      ) THEN
        ALTER TABLE coaching.message_checklist
          ADD CONSTRAINT message_checklist_sheet_type_check
          CHECK (sheet_type IN ('rsvp', 'items', 'support'));
      END IF;
    END $$
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_signup_response (
      id            BIGSERIAL PRIMARY KEY,
      checklist_id  BIGINT NOT NULL REFERENCES coaching.message_checklist(id) ON DELETE CASCADE,
      user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      response_json JSONB NOT NULL DEFAULT '{}',
      responded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_signup_response_user
      ON coaching.message_signup_response(checklist_id, user_id) WHERE user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_signup_response_member
      ON coaching.message_signup_response(checklist_id, member_id) WHERE member_id IS NOT NULL
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.thread_faq (
      id            BIGSERIAL PRIMARY KEY,
      thread_id     BIGINT REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      facility_id   BIGINT REFERENCES public.facility(id) ON DELETE CASCADE,
      question      TEXT NOT NULL,
      answer        TEXT NOT NULL,
      sort_order    INT NOT NULL DEFAULT 0,
      in_master_list BOOLEAN NOT NULL DEFAULT FALSE,
      master_sort_order INT,
      created_by_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`ALTER TABLE coaching.thread_faq ADD COLUMN IF NOT EXISTS facility_id BIGINT REFERENCES public.facility(id) ON DELETE CASCADE`)
  await pool.query(`ALTER TABLE coaching.thread_faq ADD COLUMN IF NOT EXISTS in_master_list BOOLEAN NOT NULL DEFAULT FALSE`)
  await pool.query(`ALTER TABLE coaching.thread_faq ADD COLUMN IF NOT EXISTS master_sort_order INT`)
  await pool.query(`ALTER TABLE coaching.thread_faq ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_thread_faq_facility
      ON coaching.thread_faq(facility_id)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_thread_faq_master
      ON coaching.thread_faq(facility_id, in_master_list)
      WHERE in_master_list = TRUE
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_reaction (
      id            BIGSERIAL PRIMARY KEY,
      message_id    BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
      emoji         TEXT NOT NULL,
      user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reaction_user
      ON coaching.message_reaction(message_id, emoji, user_id) WHERE user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reaction_member
      ON coaching.message_reaction(message_id, emoji, member_id) WHERE member_id IS NOT NULL
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_mention (
      id            BIGSERIAL PRIMARY KEY,
      message_id    BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
      user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_thread_mute (
      thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
      user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
      member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      muted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.message_audit_log (
      id            BIGSERIAL PRIMARY KEY,
      facility_id   BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
      thread_id     BIGINT REFERENCES coaching.message_thread(id) ON DELETE SET NULL,
      message_id    BIGINT REFERENCES coaching.message(id) ON DELETE SET NULL,
      actor_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
      actor_member_id BIGINT REFERENCES public.member(id) ON DELETE SET NULL,
      action        TEXT NOT NULL,
      detail_json   JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_message_audit_facility ON coaching.message_audit_log(facility_id, created_at DESC)`)

  await pool.query(`
    INSERT INTO coaching.message_thread_tag (facility_id, slug, label, sort_order)
    SELECT f.id, v.slug, v.label, v.sort_order
    FROM public.facility f
    CROSS JOIN (VALUES
      ('team-comms', 'Team Comms', 1),
      ('event-info', 'Event Info', 2),
      ('scheduling', 'Scheduling', 3),
      ('billing', 'Billing', 4),
      ('announcements', 'Announcements', 5),
      ('training', 'Training', 6)
    ) AS v(slug, label, sort_order)
    ON CONFLICT (facility_id, slug) DO NOTHING
  `)
}
