-- Normalize the anatomical-region vocabulary already used by active canonical
-- cards.  This adds stable controlled keys only; it does not alter exercise
-- meaning, scores, delivery, or human review state.
WITH additions(key, name, ordinal) AS (
  VALUES
    ('forearm', 'Forearm', 1),
    ('groin', 'Groin / Adductor Region', 2),
    ('heel', 'Heel', 3),
    ('lower_leg', 'Lower Leg', 4),
    ('lumbopelvic_complex', 'Lumbopelvic Complex', 5),
    ('thigh', 'Thigh', 6),
    ('upper_arm', 'Upper Arm', 7),
    ('upper_back', 'Upper Back', 8)
), offset_value AS (
  SELECT COALESCE(MAX(sort_order), 0) AS offset FROM coaching.body_region
)
INSERT INTO coaching.body_region(key, name, sort_order)
SELECT additions.key, additions.name, offset_value.offset + additions.ordinal
FROM additions CROSS JOIN offset_value
ON CONFLICT (key) DO NOTHING;
