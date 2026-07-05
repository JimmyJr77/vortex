-- Calendar item ↔ class associations for schedule visibility

CREATE TABLE IF NOT EXISTS coaching.event_calendar_item_class (
  calendar_item_id  BIGINT NOT NULL REFERENCES coaching.event_calendar_item(id) ON DELETE CASCADE,
  scheduling_form_id BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
  PRIMARY KEY (calendar_item_id, scheduling_form_id)
);

CREATE INDEX IF NOT EXISTS idx_event_calendar_item_class_form
  ON coaching.event_calendar_item_class(scheduling_form_id);
