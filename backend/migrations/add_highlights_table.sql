-- Highlights: admin-managed popups per site
CREATE TABLE IF NOT EXISTS highlights (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('event', 'document', 'custom')),
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  document_mime VARCHAR(100),
  document_data TEXT,
  custom_content JSONB,
  site_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_frequency VARCHAR(20) NOT NULL DEFAULT 'first_visit'
    CHECK (display_frequency IN ('first_visit', 'every_visit', 'daily', 'weekly', 'never')),
  published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  button_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  button_label VARCHAR(100),
  button_url TEXT,
  button_text_above TEXT,
  button_text_below TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_highlights_published ON highlights(published);
CREATE INDEX IF NOT EXISTS idx_highlights_sort_order ON highlights(sort_order);
