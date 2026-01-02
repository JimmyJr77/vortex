-- Add tags columns to events table
-- Tags will be stored as JSONB arrays for flexibility

ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_type VARCHAR(50) DEFAULT 'all_classes_and_parents';
ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_class_ids INTEGER[] DEFAULT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_category_ids INTEGER[] DEFAULT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_all_parents BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_boosters BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_volunteers BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN events.tag_type IS 'Type of tagging: all_classes_and_parents, specific_classes, specific_categories, all_parents, boosters, volunteers';
COMMENT ON COLUMN events.tag_class_ids IS 'Array of program IDs when tag_type is specific_classes';
COMMENT ON COLUMN events.tag_category_ids IS 'Array of category IDs when tag_type is specific_categories';
COMMENT ON COLUMN events.tag_all_parents IS 'True when event is tagged for all parents';
COMMENT ON COLUMN events.tag_boosters IS 'True when event is tagged for boosters (not applicable yet)';
COMMENT ON COLUMN events.tag_volunteers IS 'True when event is tagged for volunteers (not applicable yet)';

