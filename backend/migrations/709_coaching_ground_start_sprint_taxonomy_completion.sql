WITH additions(key,name,ordinal) AS (
  VALUES
    ('ground_start_to_sprint','Ground Start to Sprint',1),
    ('push_up_or_prone_transition','Push-Up or Prone Transition',2)
), offset_value AS (
  SELECT COALESCE(MAX(sort_order), 0) AS offset FROM coaching.movement_pattern
)
INSERT INTO coaching.movement_pattern(key,name,sort_order)
SELECT additions.key, additions.name, offset_value.offset + additions.ordinal
FROM additions CROSS JOIN offset_value
ON CONFLICT(key) DO UPDATE SET name=EXCLUDED.name;
