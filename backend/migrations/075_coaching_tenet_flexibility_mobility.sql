-- Rename flexibility tenet display label for coach portal taxonomy.
UPDATE coaching.tenet
SET name = 'Flexibility/Mobility'
WHERE key = 'flexibility'
  AND name = 'Flexibility';
