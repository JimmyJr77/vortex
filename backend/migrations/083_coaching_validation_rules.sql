-- Validation rules with educational why content.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.validation_rule (
  id                    BIGSERIAL PRIMARY KEY,
  key                   TEXT NOT NULL UNIQUE,
  severity              TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('error', 'warning', 'recommendation')),
  message_template      TEXT NOT NULL,
  education_content_id  BIGINT REFERENCES coaching.education_content(id) ON DELETE SET NULL,
  rule_logic_json       JSONB NOT NULL DEFAULT '{}',
  can_override          BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO coaching.education_content (entity_type, entity_key, entity_id, title, why_it_matters, programming_guidance, common_misuse) VALUES
  ('validation_rule', 'freshness_required_after_fatigue', NULL, 'Freshness Required After Fatigue',
   'High-quality speed, power, and plyometric work depends on freshness, neural drive, and clean mechanics.',
   'Move freshness-required exercises before Capacity, Control, or Fitness phases.',
   'Placing box jumps, sprints, or max plyometrics after HIIT or heavy eccentrics.'),
  ('validation_rule', 'hiit_before_skill_output', NULL, 'HIIT Before Skill or Output',
   'Conditioning fatigue reduces skill learning, speed, power, and landing quality.',
   'Place HIIT and hard conditioning in Fitness/Repeatability near the end of the session.',
   'Starting sessions with HIIT before skill or output work.'),
  ('validation_rule', 'static_flex_before_output', NULL, 'Static Flexibility Before Output',
   'Long passive stretching before power or speed can reduce readiness and elastic stiffness.',
   'Use dynamic mobility in Prepare; save long static work for Restore.',
   'Long static stretching immediately before jumps or sprints.'),
  ('validation_rule', 'phase_order_violation', NULL, 'Phase Order Violation',
   'The Athleticism Accelerator order protects fatigue-sensitive qualities.',
   'Follow Prepare → Skill → Output → Capacity → Control → Fitness → Restore unless the session objective intentionally overrides.',
   'Reordering phases without adjusting volume and intent.')
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  why_it_matters = EXCLUDED.why_it_matters,
  programming_guidance = EXCLUDED.programming_guidance,
  updated_at = now();

INSERT INTO coaching.validation_rule (key, severity, message_template, education_content_id, rule_logic_json, can_override) VALUES
  (
    'freshness_required_after_fatigue',
    'warning',
    '{exercise} is placed after {prior_phase}. High-quality work may be compromised.',
    (SELECT id FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'freshness_required_after_fatigue' LIMIT 1),
    '{"type":"freshness_after_fatigue","min_prior_fatigue_cost":3}'::jsonb,
    TRUE
  ),
  (
    'hiit_before_skill_output',
    'warning',
    'Conditioning appears before Skill or Output phases.',
    (SELECT id FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'hiit_before_skill_output' LIMIT 1),
    '{"type":"phase_before","blocked_prior_phases":["fitness_repeatability"],"protected_phases":["skill_movement_intelligence","output"]}'::jsonb,
    TRUE
  ),
  (
    'phase_order_violation',
    'warning',
    'Phase {phase} appears out of recommended order.',
    (SELECT id FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'phase_order_violation' LIMIT 1),
    '{"type":"phase_order"}'::jsonb,
    TRUE
  ),
  (
    'exercise_avoid_in_phase',
    'error',
    '{exercise} has role=avoid in phase {phase}.',
    NULL,
    '{"type":"role_avoid"}'::jsonb,
    FALSE
  )
ON CONFLICT (key) DO UPDATE SET
  message_template = EXCLUDED.message_template,
  rule_logic_json = EXCLUDED.rule_logic_json,
  education_content_id = EXCLUDED.education_content_id;
