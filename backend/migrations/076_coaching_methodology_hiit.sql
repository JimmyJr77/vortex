-- Add HIIT training methodology to coach taxonomy.
INSERT INTO coaching.methodology (key, name, description, sort_order) VALUES
  ('hiit', 'HIIT', 'High-intensity interval training for metabolic conditioning', 9)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
