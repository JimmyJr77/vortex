-- Event calendar items (5 Ws) and member RSVP

CREATE TABLE IF NOT EXISTS coaching.event_calendar_item (
  id            BIGSERIAL PRIMARY KEY,
  facility_id   BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  event_id      BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  who_text      TEXT,
  what_text     TEXT,
  why_text      TEXT,
  when_start    TIMESTAMPTZ,
  when_end      TIMESTAMPTZ,
  where_text    TEXT,
  ics_uid       TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_calendar_item_event
  ON coaching.event_calendar_item(event_id);

CREATE INDEX IF NOT EXISTS idx_event_calendar_item_when
  ON coaching.event_calendar_item(when_start);

CREATE TABLE IF NOT EXISTS coaching.event_rsvp (
  id            BIGSERIAL PRIMARY KEY,
  event_id      BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id     BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'going'
                CHECK (status IN ('going', 'maybe', 'declined')),
  responded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvp_event
  ON coaching.event_rsvp(event_id);
