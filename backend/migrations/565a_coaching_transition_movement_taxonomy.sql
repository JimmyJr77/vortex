-- Controlled taxonomy required by ordered floor-to-stand candidates.
INSERT INTO coaching.movement_pattern (key, name, sort_order)
VALUES ('transition', 'Transition', 13)
ON CONFLICT (key) DO UPDATE
SET name=EXCLUDED.name, sort_order=EXCLUDED.sort_order;
