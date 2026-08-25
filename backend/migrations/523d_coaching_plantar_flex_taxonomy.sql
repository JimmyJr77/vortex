-- Makes the already-established heel-raise action available to candidate
-- materialization before later historical family migrations run.
INSERT INTO coaching.movement_pattern (key, name, sort_order)
VALUES ('plantar_flex', 'Plantar Flex / Heel Raise', 18)
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;
