-- Enrollment presentation order is shared by public and member catalogs.
ALTER TABLE programs ADD COLUMN IF NOT EXISTS enrollment_sort_order INTEGER;
ALTER TABLE program ADD COLUMN IF NOT EXISTS enrollment_sort_order INTEGER;

-- Correct only the specific published team-description typo.
UPDATE programs SET description=replace(description,
  'VTG is the official artistic gymnastics team of Vortex Gymnastics',
  'VGT is the official artistic gymnastics team of Vortex Gymnastics')
WHERE description LIKE '%VTG is the official artistic gymnastics team of Vortex Gymnastics%';
UPDATE program SET description=replace(description,
  'VTG is the official artistic gymnastics team of Vortex Gymnastics',
  'VGT is the official artistic gymnastics team of Vortex Gymnastics')
WHERE description LIKE '%VTG is the official artistic gymnastics team of Vortex Gymnastics%';

-- Seed the development progression once. Explicit admin order is never replaced.
WITH levels AS (
  SELECT c.id,c.programs_id,c.age_min,c.display_name,
    CASE
      WHEN c.display_name ILIKE 'Dirt Devils%' THEN 1
      WHEN c.display_name ILIKE 'Twisters%' THEN 2
      WHEN c.display_name ILIKE 'Tornadoes%' THEN 3
      WHEN c.display_name ILIKE 'Cyclones%' THEN 4
      WHEN c.display_name ILIKE 'Vortex A4 Elite%' THEN 5
    END AS level
  FROM program c JOIN programs p ON p.id=c.programs_id AND p.facility_id=c.facility_id
  WHERE (p.display_name ~* '^development(al)? gymnastics$' OR p.name ~* '^development(al)? gymnastics$')
    AND c.enrollment_sort_order IS NULL
), ordered AS (
  SELECT id,row_number() OVER (PARTITION BY programs_id ORDER BY level,age_min NULLS LAST,display_name,id)-1 AS position
  FROM levels WHERE level IS NOT NULL
)
UPDATE program c SET enrollment_sort_order=ordered.position FROM ordered WHERE c.id=ordered.id;
