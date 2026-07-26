-- USA Gymnastics Acrobatic Gymnastics Development Program 2025-2028.
-- Complete Level 8 Women's Pair, Men's Pair, and Mixed Pair Dynamic boxes.

WITH source_data (
  slug, discipline, box_code, row_name, official_name, description, source_page
) AS (
  VALUES
    ('usag-acro-l8-wp-dyn-1a', 'Women''s Pair', '1A', 'Foot to Hand', 'Toe pitch to low foot-to-hand',
      'A zero-quarter toe pitch is caught directly in low foot-to-hand.', 42),
    ('usag-acro-l8-wp-dyn-1b', 'Women''s Pair', '1B', 'Foot to Hand', 'Low foot-to-hand straight jump recatch',
      'From low foot-to-hand, the top performs a zero-quarter straight jump and is recaught in low foot-to-hand.', 42),
    ('usag-acro-l8-wp-dyn-1c', 'Women''s Pair', '1C', 'Foot to Hand', 'Low foot-to-hand straight dismount',
      'From low foot-to-hand, the top performs a zero-quarter straight jump dismount to floor.', 42),
    ('usag-acro-l8-wp-dyn-1d', 'Women''s Pair', '1D', 'Foot to Hand', 'Low foot-to-hand half-twist dismount',
      'From low foot-to-hand, the top performs a zero-quarter straight jump with 180 degrees of twist to floor.', 42),
    ('usag-acro-l8-wp-dyn-2a', 'Women''s Pair', '2A', 'Boost', 'Boost quarter-front to forearm catch',
      'A boost sends the top through one-quarter front rotation to forearm catch, optionally adding 180 degrees of twist.', 42),
    ('usag-acro-l8-wp-dyn-2b', 'Women''s Pair', '2B', 'Boost', 'Boost full-twist straight jump to floor',
      'A zero-quarter boost produces a straight jump with 360 degrees of twist to floor.', 42),
    ('usag-acro-l8-wp-dyn-2c', 'Women''s Pair', '2C', 'Boost', 'Handstand boost quarter-front to forearm',
      'From handstand support, the base boosts the top through one-quarter front rotation to forearm catch.', 42),
    ('usag-acro-l8-wp-dyn-2d', 'Women''s Pair', '2D', 'Boost', 'Round-off rebound quarter-back to back bird',
      'During the top''s rebound from round-off or round-off back handspring, the base boosts one-quarter back rotation to back-bird catch.', 42),
    ('usag-acro-l8-wp-dyn-3a', 'Women''s Pair', '3A', 'Front/Back Bird', 'Bird throw to forearm catch',
      'From front or back bird, a zero-quarter throw finishes in forearm catch, optionally with 180 degrees of twist.', 42),
    ('usag-acro-l8-wp-dyn-3b', 'Women''s Pair', '3B', 'Front/Back Bird', 'Bird half-throw to fish/wrap catch',
      'From front or back bird, a half rotation throw finishes in fish or wrap catch, optionally with 180 degrees of twist.', 42),
    ('usag-acro-l8-wp-dyn-3c', 'Women''s Pair', '3C', 'Front/Back Bird', 'Bird quarter-half-twist dismount',
      'From front or back bird, the top performs a quarter rotation plus 180 degrees of twist to floor.', 42),
    ('usag-acro-l8-wp-dyn-3d', 'Women''s Pair', '3D', 'Front/Back Bird', 'Toe pitch quarter-layout to bird catch',
      'A toe pitch sends a quarter-front layout to front-bird catch, optionally with 180 degrees of twist to back-bird catch.', 42),
    ('usag-acro-l8-wp-dyn-4a', 'Women''s Pair', '4A', 'Salto', 'Leg-pitch full salto dismount',
      'A leg pitch produces a full back tuck, pike, or layout salto dismount to floor.', 42),
    ('usag-acro-l8-wp-dyn-4b', 'Women''s Pair', '4B', 'Salto', 'Toe-pitch full salto dismount',
      'A toe pitch produces a full front or back tuck, pike, or layout salto dismount to floor.', 42),
    ('usag-acro-l8-wp-dyn-4c', 'Women''s Pair', '4C', 'Salto', 'Boost full salto dismount',
      'A boost produces a full front or back tuck, pike, or layout salto dismount to floor.', 42),
    ('usag-acro-l8-wp-dyn-4d', 'Women''s Pair', '4D', 'Salto', 'Low foot-to-hand full salto dismount',
      'From low foot-to-hand, the top performs a full front or back tuck, pike, or layout salto dismount.', 42),

    ('usag-acro-l8-mp-dyn-1a', 'Men''s Pair', '1A', 'Foot to Hand', 'Toe pitch to low foot-to-hand',
      'A zero-quarter toe pitch is caught directly in low foot-to-hand.', 44),
    ('usag-acro-l8-mp-dyn-1b', 'Men''s Pair', '1B', 'Foot to Hand', 'Low foot-to-hand straight jump recatch',
      'From low foot-to-hand, the top performs a zero-quarter straight jump and is recaught in low foot-to-hand.', 44),
    ('usag-acro-l8-mp-dyn-1c', 'Men''s Pair', '1C', 'Foot to Hand', 'Low foot-to-hand straight dismount',
      'From low foot-to-hand, the top performs a zero-quarter straight jump dismount to floor.', 44),
    ('usag-acro-l8-mp-dyn-1d', 'Men''s Pair', '1D', 'Foot to Hand', 'Toe pitch half-turn to low foot-to-hand',
      'A zero-quarter toe pitch with 180 degrees of turn is caught in low foot-to-hand.', 44),
    ('usag-acro-l8-mp-dyn-2a', 'Men''s Pair', '2A', 'Boost', 'Boost/inlocate boost to foot-to-hand',
      'A zero-quarter regular or inlocate boost finishes in foot-to-hand catch.', 44),
    ('usag-acro-l8-mp-dyn-2b', 'Men''s Pair', '2B', 'Boost', 'Boost full-twist straight jump to floor',
      'A zero-quarter boost produces a straight jump with 360 degrees of twist to floor.', 44),
    ('usag-acro-l8-mp-dyn-2c', 'Men''s Pair', '2C', 'Boost', 'Boost half-front tuck/pike to hand-to-hand',
      'A regular or inlocate boost produces a half-front tuck or pike to hand-to-hand catch.', 44),
    ('usag-acro-l8-mp-dyn-2d', 'Men''s Pair', '2D', 'Boost', 'Handstand boost half-front layout',
      'From handstand support, the base boosts the top through a half-front layout to floor.', 44),
    ('usag-acro-l8-mp-dyn-3a', 'Men''s Pair', '3A', 'Hand to Hand', 'Toe pitch half-front to hand-to-hand',
      'A toe pitch produces a half-front rotation to hand-to-hand catch.', 44),
    ('usag-acro-l8-mp-dyn-3b', 'Men''s Pair', '3B', 'Hand to Hand', 'Hand-to-hand half dismount',
      'From hand-to-hand, the top performs a half front or back rotation to floor; a gainer is permitted.', 44),
    ('usag-acro-l8-mp-dyn-3c', 'Men''s Pair', '3C', 'Hand to Hand', 'Cannonball half-front to hang',
      'A cannonball pathway produces a half-front rotation to a hang between the base''s legs.', 44),
    ('usag-acro-l8-mp-dyn-3d', 'Men''s Pair', '3D', 'Hand to Hand', 'Hand-to-hand half-back to catch',
      'From hand-to-hand, the top performs a half-back rotation to foot-to-hand catch or catch on the base''s shoulders.', 44),
    ('usag-acro-l8-mp-dyn-4a', 'Men''s Pair', '4A', 'Salto', 'Toe-pitch full salto dismount',
      'A toe pitch produces a full front or back tuck, pike, or layout salto dismount.', 44),
    ('usag-acro-l8-mp-dyn-4b', 'Men''s Pair', '4B', 'Salto', 'Boost full salto dismount',
      'A boost produces a full front or back tuck, pike, or layout salto dismount.', 44),
    ('usag-acro-l8-mp-dyn-4c', 'Men''s Pair', '4C', 'Salto', 'Low foot-to-hand full salto dismount',
      'From low foot-to-hand, the top performs a full front or back tuck, pike, or layout salto dismount.', 44),
    ('usag-acro-l8-mp-dyn-4d', 'Men''s Pair', '4D', 'Salto', 'Low foot-to-hand full gainer dismount',
      'From low foot-to-hand, the top performs a full front or back gainer in tuck, pike, or layout to floor.', 44),

    ('usag-acro-l8-mxp-dyn-1a', 'Mixed Pair', '1A', 'Foot to Hand', 'Toe pitch to low foot-to-hand',
      'A zero-quarter toe pitch is caught directly in low foot-to-hand.', 46),
    ('usag-acro-l8-mxp-dyn-1b', 'Mixed Pair', '1B', 'Foot to Hand', 'Low foot-to-hand straight jump recatch',
      'From low foot-to-hand, the top performs a zero-quarter straight jump and is recaught in low foot-to-hand.', 46),
    ('usag-acro-l8-mxp-dyn-1c', 'Mixed Pair', '1C', 'Foot to Hand', 'Low foot-to-hand straight dismount',
      'From low foot-to-hand, the top performs a zero-quarter straight jump dismount to floor.', 46),
    ('usag-acro-l8-mxp-dyn-1d', 'Mixed Pair', '1D', 'Foot to Hand', 'Toe pitch half-turn to low foot-to-hand',
      'A zero-quarter toe pitch with 180 degrees of turn is caught in low foot-to-hand.', 46),
    ('usag-acro-l8-mxp-dyn-2a', 'Mixed Pair', '2A', 'Boost', 'Boost quarter to forearm catch',
      'A boost sends the top through one-quarter rotation to forearm catch, optionally adding 180 degrees of twist.', 46),
    ('usag-acro-l8-mxp-dyn-2b', 'Mixed Pair', '2B', 'Boost', 'Boost quarter to fish/wrap',
      'A boost sends the top through one-quarter rotation to fish or wrap catch.', 46),
    ('usag-acro-l8-mxp-dyn-2c', 'Mixed Pair', '2C', 'Boost', 'Handstand boost quarter-front to forearm',
      'From handstand support, the base boosts the top through one-quarter front rotation to forearm catch.', 46),
    ('usag-acro-l8-mxp-dyn-2d', 'Mixed Pair', '2D', 'Boost', 'Handstand boost three-quarter-front to fish/wrap',
      'From handstand support, the base boosts the top through three-quarter front rotation to fish or wrap catch.', 46),
    ('usag-acro-l8-mxp-dyn-3a', 'Mixed Pair', '3A', 'Hand to Hand', 'Toe pitch half-front pike/layout to hand-to-hand',
      'A toe pitch produces a half-front pike or layout to hand-to-hand catch.', 46),
    ('usag-acro-l8-mxp-dyn-3b', 'Mixed Pair', '3B', 'Hand to Hand', 'Hand-to-hand half dismount',
      'From hand-to-hand, the top performs a half front or back rotation to floor.', 46),
    ('usag-acro-l8-mxp-dyn-3c', 'Mixed Pair', '3C', 'Hand to Hand', 'Cannonball half-front to fish/wrap',
      'A cannonball pathway produces a half-front rotation to fish or wrap catch, optionally adding 180 degrees of twist.', 46),
    ('usag-acro-l8-mxp-dyn-3d', 'Mixed Pair', '3D', 'Hand to Hand', 'Hand-to-hand half-back pike/layout to foot-to-hand',
      'From hand-to-hand, the top performs a half-back pike or layout to foot-to-hand catch.', 46),
    ('usag-acro-l8-mxp-dyn-4a', 'Mixed Pair', '4A', 'Salto', 'Toe-pitch full salto dismount',
      'A toe pitch produces a full front or back tuck, pike, or layout salto dismount.', 46),
    ('usag-acro-l8-mxp-dyn-4b', 'Mixed Pair', '4B', 'Salto', 'Boost full salto dismount',
      'A boost produces a full front or back tuck, pike, or layout salto dismount.', 46),
    ('usag-acro-l8-mxp-dyn-4c', 'Mixed Pair', '4C', 'Salto', 'Low foot-to-hand full salto dismount',
      'From low foot-to-hand, the top performs a full front or back tuck, pike, or layout salto dismount.', 46),
    ('usag-acro-l8-mxp-dyn-4d', 'Mixed Pair', '4D', 'Salto', 'Fish/wrap five-quarter salto dismount',
      'From fish or wrap, the pair throws a five-quarter front or back tuck, pike, or layout salto to floor.', 46)
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics',
    'discipline', 'Acrobatic Gymnastics',
    'event', 'Level 8 ' || d.discipline || ' Dynamic',
    'program', 'Acrobatic Gymnastics Development Program 2025-2028',
    'official_name', d.official_name,
    'official_code', 'Level 8 ' || d.discipline || ' Dynamic ' || d.box_code,
    'usa_gymnastics_levels', jsonb_build_array('Acro Level 8'),
    'status', 'verified',
    'last_verified', '2026-07-25',
    'athlete_cues', jsonb_build_array(
      'Set exact contacts, share one load count, create upward flight before rotation or twist, show the declared shape, and present early for the catch or landing.',
      'Finish the full box as declared; optional twists or shape choices must be decided before the tariff is submitted.'
    ),
    'coach_checkpoints', jsonb_build_array(
      d.description,
      'Check start contact, direction, synchronized force, release, amplitude, exact quarter/full rotation, body shape, twist completion, tracking, and controlled finish.',
      'Pairs require one compulsory box from each of four rows plus two optional FIG Pair Dynamic elements valued 1-13.'
    ),
    'safety_and_readiness', jsonb_build_array(
      'Use qualified Acro coaching, progressive surfaces, regulation landing mats, exact catch assignments, and a trained emergency plan.',
      'Top and base must independently master the entry, straight-flight drill, body shape, rotation/twist progression, tracking, and catch or landing before the complete element.',
      'Regress immediately for low amplitude, early rotation, off-axis flight, lost visual tracking, late presentation, or unstable catches.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault', 'Missing compulsory/optional pair skill or individual element', 'deduction', '-1.0 SR each', 'cue', 'Audit all six pair skills and three individual elements.'),
      jsonb_build_object('fault', 'All required content not performed', 'deduction', 'Additional -1.0 SR', 'cue', 'Complete every content category.'),
      jsonb_build_object('fault', 'Repeated compulsory box', 'deduction', 'No requirement credit / applicable SR penalty', 'cue', 'Use one distinct box from each row.'),
      jsonb_build_object('fault', 'Additional pair/group value skill', 'deduction', '-1.0 DJ once per exercise', 'cue', 'Limit content to four compulsory and two optional skills.'),
      jsonb_build_object('fault', 'Insufficient amplitude, incomplete rotation, shape or catch error', 'deduction', 'Per technical-fault tables', 'cue', 'Create height, finish shape/rotation, and present early.'),
      jsonb_build_object('fault', 'No music', 'deduction', '-1.0 CJP', 'cue', 'Verify music and backup playback.'),
      jsonb_build_object('fault', 'Dynamic exercise exceeds 2:00', 'deduction', '-0.3 CJP', 'cue', 'Time from first movement.')
    ),
    'scoring_summary', 'Level 8 has no difficulty score. Pair Dynamic requires four compulsory boxes, two optional FIG Pair Dynamic elements valued 1-13, and three individual elements. Missing content is -1.0 SR each; repeated boxes, additional value skills, technical execution, music, and time penalties apply.',
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title', 'Teach ' || d.official_name, 'purpose', 'learning',
        'description', 'Show grips and load position, straight-flight and landing/catch drills, then add declared rotation, body shape, twist, and connection. Use side, front, and catch-perspective slow motion.'),
      jsonb_build_object('title', d.official_name || ' - ideal Level 8 model', 'purpose', 'model',
        'description', 'Show full speed and slow motion with the box code. Highlight simultaneous force, rising amplitude, exact shape/rotation, centered axis, early presentation, and a stable catch or landing.')
    ),
    'next_progressions', '[]'::jsonb,
    'sources', jsonb_build_array(jsonb_build_object(
      'title', 'USA Gymnastics Acrobatic Gymnastics Development Program Code of Points 2025-2028',
      'url', 'https://static.usagym.org/PDFs/Acro/Rules/devcop_2528.pdf#page=' || d.source_page,
      'organization', 'USA Gymnastics',
      'effective_cycle', '2025-2028',
      'accessed_on', '2026-07-25',
      'note', 'Official Level 8 pair Dynamic box and composition requirements.'
    )),
    'editorial_note', 'Original coaching summary. Level 9 progressions branch through FIG 12-18 rules and the Tables of Difficulty, so no single direct next element is asserted.'
  ) AS metadata
  FROM source_data d
)
INSERT INTO coaching.skill (
  facility_id, name, slug, description, instructions, sport_id, skill_level,
  skill_kind, evaluation_mode, execution_max_score, assistance_note,
  is_published, visibility, official_metadata
)
SELECT
  (SELECT id FROM public.facility ORDER BY id LIMIT 1),
  'Acro L8 ' || p.discipline || ' Dynamic ' || p.box_code || ' - ' || p.official_name,
  p.slug, p.description,
  'Establish the prescribed start contact, coordinate the load and release, create sufficient flight, complete the declared rotation, shape, and twist, then finish in the exact catch or controlled floor landing.',
  (SELECT id FROM coaching.sport WHERE key = 'gymnastics'),
  'ADVANCED'::public.skill_level,
  'partner', 'execution', 10,
  p.discipline || ' Level 8 Dynamic compulsory box ' || p.box_code || ' (' || p.row_name || ')',
  TRUE, 'facility', p.metadata
FROM prepared p
ON CONFLICT (facility_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  skill_level = EXCLUDED.skill_level,
  assistance_note = EXCLUDED.assistance_note,
  official_metadata = EXCLUDED.official_metadata,
  updated_at = NOW();
