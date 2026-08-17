-- Adds the missing controlled movement taxonomy term needed by the exact
-- fixed-base pressure-transfer card. This is not a free-text escape hatch:
-- candidate materialization still rejects every key not present in this table.
INSERT INTO coaching.movement_pattern (key, name, sort_order)
VALUES ('weight_shift', 'Weight Shift / Pressure Transfer', 20)
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;
