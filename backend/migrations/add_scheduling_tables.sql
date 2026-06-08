-- Scheduling signup system (vortexathletics.com/scheduling)

CREATE TABLE IF NOT EXISTS scheduling_form (
  id          BIGSERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  start_date  DATE,
  end_date    DATE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduling_category (
  id          BIGSERIAL PRIMARY KEY,
  form_id     BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduling_category_field (
  id          BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES scheduling_category(id) ON DELETE CASCADE,
  label       VARCHAR(255) NOT NULL,
  field_type  VARCHAR(50) NOT NULL DEFAULT 'text'
    CHECK (field_type IN ('text', 'textarea', 'select', 'number', 'email', 'phone', 'checkbox')),
  options     JSONB,
  required    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduling_time_slot (
  id               BIGSERIAL PRIMARY KEY,
  form_id          BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
  category_id      BIGINT REFERENCES scheduling_category(id) ON DELETE SET NULL,
  day_of_week      INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  max_participants INTEGER NOT NULL DEFAULT 10 CHECK (max_participants > 0),
  start_date       DATE,
  end_date         DATE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduling_signup (
  id              BIGSERIAL PRIMARY KEY,
  form_id         BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
  category_id     BIGINT NOT NULL REFERENCES scheduling_category(id),
  time_slot_id    BIGINT NOT NULL REFERENCES scheduling_time_slot(id),
  first_name      VARCHAR(255) NOT NULL,
  last_name       VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  phone           VARCHAR(50),
  field_responses JSONB NOT NULL DEFAULT '{}',
  status          VARCHAR(50) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduling_category_form ON scheduling_category(form_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_field_category ON scheduling_category_field(category_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_slot_form ON scheduling_time_slot(form_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_slot_category ON scheduling_time_slot(category_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_signup_form ON scheduling_signup(form_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_signup_slot ON scheduling_signup(time_slot_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_signup_status ON scheduling_signup(status);
