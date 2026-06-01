/** Creates analytics-related tables (idempotent). Called from initDatabase(). */
export async function initAnalyticsTables(pool) {
  await pool.query(`
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(64)
  `)
  await pool.query(`
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS landing_page TEXT
  `)
  await pool.query(`
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100)
  `)
  await pool.query(`
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100)
  `)
  await pool.query(`
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100)
  `)
  await pool.query(`
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS utm_content VARCHAR(100)
  `)
  await pool.query(`
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS utm_term VARCHAR(100)
  `)
  await pool.query(`
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS lead_status VARCHAR(30) DEFAULT 'new'
  `)
  await pool.query(`
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS first_contacted_at TIMESTAMPTZ
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGSERIAL PRIMARY KEY,
      event_id UUID NOT NULL UNIQUE,
      event_name VARCHAR(80) NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      visitor_id VARCHAR(64) NOT NULL,
      session_id VARCHAR(64) NOT NULL,
      page_path TEXT,
      hostname VARCHAR(255),
      properties JSONB DEFAULT '{}',
      consent_analytics BOOLEAN DEFAULT FALSE,
      consent_marketing BOOLEAN DEFAULT FALSE,
      is_staff BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time
    ON analytics_events(event_name, occurred_at)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_time
    ON analytics_events(visitor_id, occurred_at)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitor_sessions (
      id BIGSERIAL PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL UNIQUE,
      visitor_id VARCHAR(64) NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ,
      landing_path TEXT,
      referrer TEXT,
      device_type VARCHAR(20),
      geo_region VARCHAR(100),
      utm_source VARCHAR(100),
      utm_medium VARCHAR(100),
      utm_campaign VARCHAR(100),
      hostname VARCHAR(255),
      is_staff BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_visitor_sessions_started ON visitor_sessions(started_at)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS consent_records (
      id BIGSERIAL PRIMARY KEY,
      visitor_id VARCHAR(64) NOT NULL,
      policy_version VARCHAR(20) NOT NULL,
      analytics BOOLEAN NOT NULL DEFAULT FALSE,
      marketing BOOLEAN NOT NULL DEFAULT FALSE,
      ip_country VARCHAR(2),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS utm_attribution (
      id BIGSERIAL PRIMARY KEY,
      visitor_id VARCHAR(64),
      inquiry_id INTEGER REFERENCES registrations(id) ON DELETE SET NULL,
      touch_type VARCHAR(10) NOT NULL,
      source VARCHAR(100),
      medium VARCHAR(100),
      campaign VARCHAR(100),
      content VARCHAR(100),
      term VARCHAR(100),
      landing_page TEXT,
      click_ids JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitor_identities (
      id BIGSERIAL PRIMARY KEY,
      visitor_id VARCHAR(64) NOT NULL,
      inquiry_id INTEGER REFERENCES registrations(id) ON DELETE SET NULL,
      member_id BIGINT,
      linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      link_method VARCHAR(30) NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      admin_user_id BIGINT,
      action VARCHAR(80) NOT NULL,
      details JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_daily_traffic (
      id BIGSERIAL PRIMARY KEY,
      date DATE NOT NULL,
      hostname VARCHAR(255),
      source VARCHAR(30) NOT NULL DEFAULT 'first_party',
      sessions INTEGER DEFAULT 0,
      users INTEGER DEFAULT 0,
      page_views INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (date, hostname, source)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seo_keywords (
      id BIGSERIAL PRIMARY KEY,
      query TEXT NOT NULL,
      page TEXT,
      device VARCHAR(20) DEFAULT 'all',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seo_rankings (
      id BIGSERIAL PRIMARY KEY,
      keyword_id BIGINT REFERENCES seo_keywords(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      position NUMERIC(8,2),
      ctr NUMERIC(8,4),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (keyword_id, date)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_campaigns (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      channel VARCHAR(50),
      utm_campaign VARCHAR(100),
      budget NUMERIC(12,2),
      start_date DATE,
      end_date DATE,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS competitors (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      website_url TEXT,
      gbp_place_id TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS competitor_snapshots (
      id SERIAL PRIMARY KEY,
      competitor_id INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      rating NUMERIC(3,2),
      review_count INTEGER,
      programs_json JSONB,
      notes TEXT,
      source VARCHAR(30) NOT NULL DEFAULT 'manual',
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  console.log('✅ Analytics tables initialized')
}
