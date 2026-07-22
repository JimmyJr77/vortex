-- Remove the unused legacy class rows that were recreated by the old
-- initDatabase boot seed. Keep any row that has acquired scheduling or
-- enrollment data.

WITH removable AS (
  SELECT p.id
  FROM program p
  WHERE p.name IN (
    'dust_devils',
    'little_twisters_preschool',
    'cyclones_gymnastics',
    'tornadoes_athleticism',
    'cyclones_athleticism',
    'vortex_elite_athleticism'
  )
    AND NOT EXISTS (
      SELECT 1
      FROM scheduling_form sf
      JOIN scheduling_offering so ON so.form_id = sf.id
      WHERE sf.program_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM scheduling_form sf
      JOIN scheduling_slot_group sg ON sg.form_id = sf.id
      WHERE sf.program_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM scheduling_form sf
      JOIN scheduling_signup ss ON ss.form_id = sf.id
      WHERE sf.program_id = p.id
    )
)
DELETE FROM program p
USING removable r
WHERE p.id = r.id;
