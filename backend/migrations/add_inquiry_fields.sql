-- Add new fields to registrations table for updated inquiry form
-- This migration adds fields for the new inquiry form structure

-- Add interest field (legacy single selection from radio buttons)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS interest VARCHAR(100);

-- Add interests_array field (array of strings for multi-select interests)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS interests_array TEXT[];

-- Add class_types field (array of strings for class type selections)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS class_types TEXT[];

-- Add child_ages field (array of integers for ages 1-18)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS child_ages INTEGER[];

-- Note: The existing 'interests' field is kept for backward compatibility with old inquiries (stores as TEXT string)
-- The new 'interests_array' field stores an array of selected interests (multi-select checkboxes)
-- The 'interest' field is for legacy single radio button selection
-- The 'class_types' field stores an array of selected class types (Adult Classes, Child Classes)
-- The 'child_ages' field stores an array of selected ages when "Child Classes" is selected

