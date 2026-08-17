-- Controlled body-region taxonomy required to record explicit head-clearance
-- boundaries for floor-rolling candidates without making a medical claim.
INSERT INTO coaching.body_region (key, name, sort_order)
VALUES ('head', 'Head', 23)
ON CONFLICT (key) DO UPDATE
SET name=EXCLUDED.name, sort_order=EXCLUDED.sort_order;
