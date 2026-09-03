-- Split the initial storefront categories into flexible front-desk product
-- tags. Existing snacks stay food; products explicitly named or SKU-tagged
-- as drinks retain the more specific drink tag.

ALTER TABLE store_product
  DROP CONSTRAINT IF EXISTS store_product_category_check;

UPDATE store_product
   SET category = CASE
     WHEN category = 'apparel' THEN 'clothing'
     WHEN category = 'food_drink'
       AND (name ILIKE '%drink%' OR sku ILIKE '%drink%') THEN 'drink'
     WHEN category = 'food_drink' THEN 'food'
     ELSE category
   END;

ALTER TABLE store_product
  ALTER COLUMN category SET DEFAULT 'clothing',
  ADD CONSTRAINT store_product_category_check
  CHECK (category IN ('clothing', 'equipment', 'food', 'drink', 'other'));

ALTER TABLE store_product
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE store_product
   SET tags = ARRAY[category]
 WHERE cardinality(tags) = 0;

ALTER TABLE store_product
  ADD CONSTRAINT store_product_tags_check
  CHECK (
    cardinality(tags) > 0
    AND tags <@ ARRAY['clothing', 'equipment', 'food', 'drink', 'other']::TEXT[]
  );
