-- Controlled terms required by the exact Partner Point Reactive Sprint contract.
WITH additions(key,name,ordinal) AS (
  VALUES
    ('reactive_agility','Reactive Agility',1),
    ('multidirectional_acceleration','Multidirectional Acceleration',2),
    ('live_visual_choice_reaction','Live Visual Choice Reaction',3)
), offset_value AS (
  SELECT COALESCE(MAX(sort_order), 0) AS offset FROM coaching.movement_pattern
)
INSERT INTO coaching.movement_pattern(key,name,sort_order)
SELECT additions.key, additions.name, offset_value.offset + additions.ordinal
FROM additions CROSS JOIN offset_value
ON CONFLICT(key) DO UPDATE SET name=EXCLUDED.name;
