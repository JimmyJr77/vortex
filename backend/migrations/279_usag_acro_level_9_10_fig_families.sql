-- USA Gymnastics Acrobatic Gymnastics Level 9/10 and International Track.
-- The incorporated FIG Tables of Difficulty are combinatorial: positions, motions,
-- mounts, base positions, catches, rotations, twists, and links combine by rule.
-- These cards cover every controlling table family and teach athletes to identify
-- the exact FIG drawing number/value on the tariff sheet without reproducing it.

WITH source_data (
  slug, family, event_type, disciplines, tod_pages, description, coaching_focus, predecessor
) AS (
  VALUES
    ('usag-acro-fig-pair-balance-static', 'Pair static holds', 'Balance', ARRAY['Women''s Pair','Men''s Pair','Mixed Pair'], '18-26',
      'All rated pair balance elements created by combining an official base position with a static top position from the FIG Tables of Difficulty.',
      'Lock the base geometry first, place the exact rated contact, stack the top position over the support, show the declared leg/body variation, and complete the required static hold.', 'usag-acro-l8-wp-bal-1a'),
    ('usag-acro-fig-pair-balance-top-motion', 'Pair top motions', 'Balance', ARRAY['Women''s Pair','Men''s Pair','Mixed Pair'], '18-26',
      'All rated transitions in which the top changes between FIG static positions while the base position remains prescribed.',
      'Separate the start hold, continuous top motion, and finish hold; preserve the rated support point and finish the exact destination position without an intermediate stop.', 'usag-acro-l8-wp-bal-3a'),
    ('usag-acro-fig-pair-balance-base-motion', 'Pair base motions', 'Balance', ARRAY['Women''s Pair','Men''s Pair','Mixed Pair'], '18-26',
      'All rated transitions in which the base changes position beneath a prescribed static top.',
      'Keep the top centered and motionless relative to the base, move through the declared base pathway without extra support, and stabilize the final base position before the finish count.', 'usag-acro-l8-wp-bal-4a'),
    ('usag-acro-fig-pair-balance-mount', 'Pair balance mounts', 'Balance', ARRAY['Women''s Pair','Men''s Pair','Mixed Pair'], '27-34',
      'All FIG-rated pair mounts from a prescribed start point into an official pair balance position.',
      'Declare start and end drawings, create a continuous legal route, maintain contact requirements, arrive without assistance or extra support, and hold the rated finish when required.', 'usag-acro-l8-wp-bal-2a'),
    ('usag-acro-fig-pair-dynamic-straight-flight', 'Pair straight-flight dynamic elements', 'Dynamic', ARRAY['Women''s Pair','Men''s Pair','Mixed Pair'], '37-48',
      'All FIG pair dynamic throws, pitches, boosts, releases, catches, and dismounts whose flight is evaluated without a salto.',
      'Produce vertical amplitude before longitudinal twist, maintain the declared straight or shaped flight, track continuously, and present the exact contact early for a centered catch or landing.', 'usag-acro-l8-wp-dyn-1a'),
    ('usag-acro-fig-pair-dynamic-salto', 'Pair salto dynamic elements', 'Dynamic', ARRAY['Women''s Pair','Men''s Pair','Mixed Pair'], '37-48',
      'All FIG pair dynamic elements combining front, back, or side salto rotation with declared shape, twist, start support, catch, or floor landing.',
      'Identify rotation and twist separately, create flight before initiating rotation, show the tariffed body position, finish twist before presentation, and absorb through the assigned catch line.', 'usag-acro-l8-wp-dyn-4a'),
    ('usag-acro-fig-wg-balance-top-work', 'Women’s-group balance top holds and motions', 'Balance', ARRAY['Women''s Group'], '49-57',
      'Every rated women’s-group static top position and top motion used on an eligible pyramid base.',
      'Match the exact top drawing, support point, direction, leg variation, and motion path; complete distinct holds and keep the base pyramid unchanged unless a base transition is declared.', 'usag-acro-l8-wg-bal-1a'),
    ('usag-acro-fig-wg-balance-pyramid', 'Women’s-group pyramid bases', 'Balance', ARRAY['Women''s Group'], '58-64',
      'Every FIG-rated women’s-group pyramid base formation, including permitted top work and linked structures.',
      'Map every athlete and contact from the tariff drawing, build from the lowest load path upward, prevent repeated pyramid categories where prohibited, and show the full structure and hold.', 'usag-acro-l8-wg-bal-4a'),
    ('usag-acro-fig-wg-dynamic', 'Women’s-group dynamic elements', 'Dynamic', ARRAY['Women''s Group'], '65-75',
      'Every FIG-rated women’s-group pitch, throw, twist, salto, catch, dismount, and permitted link.',
      'Assign all launch and catch roles, synchronize force, create sufficient amplitude, complete the declared rotation/twist and shape, execute any link without an unlisted stop, and secure the finish.', 'usag-acro-l8-wg-dyn-4a'),
    ('usag-acro-fig-mg-balance-transition-mount', 'Men’s-group balance transitions and mounts', 'Balance', ARRAY['Men''s Group'], '77-80',
      'Every FIG-rated men’s-group transition or mount into, within, or between eligible pyramid positions.',
      'Declare the exact start and finish drawings, preserve legal contacts through the pathway, move all partners on the intended count, and stabilize the destination without extra support.', 'usag-acro-l8-mg-bal-1a'),
    ('usag-acro-fig-mg-balance-top-work', 'Men’s-group balance top holds and motions', 'Balance', ARRAY['Men''s Group'], '81-84',
      'Every rated men’s-group static top position and top motion performed on an eligible pyramid base.',
      'Match the tariffed top position and motion symbol, keep support points and direction exact, show uninterrupted control, and complete each required hold distinctly.', 'usag-acro-l8-mg-bal-2a'),
    ('usag-acro-fig-mg-balance-pyramid', 'Men’s-group pyramid bases', 'Balance', ARRAY['Men''s Group'], '85-92',
      'Every FIG-rated men’s-group pyramid base position and its permitted top work.',
      'Resolve every base, middle, and top role from the drawing, stack load paths through legal contacts, manage head-support restrictions, and hold the completed pyramid without correction.', 'usag-acro-l8-mg-bal-2c'),
    ('usag-acro-fig-mg-dynamic', 'Men’s-group dynamic elements', 'Dynamic', ARRAY['Men''s Group'], '93-108',
      'Every FIG-rated men’s-group throw, pitch, twist, salto, catch, dismount, base switch, and permitted link.',
      'Assign launcher and catcher roles, coordinate the release vector, preserve amplitude and axis, complete the declared phases, switch bases only as drawn, and finish in the exact catch or landing.', 'usag-acro-l8-mg-dyn-4a'),
    ('usag-acro-fig-individual-flexibility', 'Individual flexibility elements', 'Individual Balance', ARRAY['All pair/group disciplines'], '111-118',
      'Every FIG-rated individual flexibility element eligible for Acro balance composition.',
      'Establish the required support, joint line, split or back-flexibility amplitude, direction, and finish; show control without using momentum to disguise missing range.', 'usag-acro-front-attitude-scale'),
    ('usag-acro-fig-individual-static-balance', 'Individual static-balance elements', 'Individual Balance', ARRAY['All pair/group disciplines'], '111-118',
      'Every FIG-rated individual static balance, including handstand and non-handstand variants.',
      'Place the support precisely, align the center of mass, show the exact leg and trunk position, begin counting after stillness, and exit without a corrective step.', 'usag-acro-supported-handstand-floor'),
    ('usag-acro-fig-individual-agility', 'Individual agility elements', 'Individual Balance', ARRAY['All pair/group disciplines'], '111-118',
      'Every FIG-rated individual agility element used in Acro balance exercises.',
      'Identify the exact start, direction, turn, support sequence, and end position; move continuously with extended lines and finish under control.', 'usag-acro-synchronized-cartwheel'),
    ('usag-acro-fig-individual-tumbling', 'Individual tumbling elements', 'Individual Dynamic', ARRAY['All pair/group disciplines'], '119',
      'Every FIG-rated individual tumbling element eligible for Acro dynamic composition.',
      'Use an appropriate entry, create lift and rotation from the floor, show the declared tuck/pike/straight shape and twist, finish rotation before landing, and control the rebound or connection.', 'round-off')
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics / FIG',
    'discipline', 'Acrobatic Gymnastics',
    'event', d.event_type,
    'program', 'USA Gymnastics Levels 9-10 and International Track / FIG 2025-2028',
    'official_name', d.family,
    'official_code', 'FIG ToD pages ' || d.tod_pages,
    'usa_gymnastics_levels', jsonb_build_array('Acro Level 9','Acro Level 10','International 11-16','International 12-18','International 13-19','Senior Elite'),
    'status', 'verified',
    'last_verified', '2026-07-25',
    'prerequisites', jsonb_build_array(jsonb_build_object('slug', d.predecessor, 'relationship', 'developmental predecessor')),
    'next_progressions', '[]'::jsonb,
    'athlete_cues', jsonb_build_array(d.coaching_focus, 'Know the exact FIG page, drawing number, value parts, and declared hold before the tariff sheet is submitted.'),
    'coach_checkpoints', jsonb_build_array(
      d.description, d.coaching_focus,
      'Verify the precise FIG drawing number and all component values. Stylistic variants in one box share the same identity unless the Tables explicitly distinguish them.',
      'Level 9/10 follow FIG 12-18 rules except USA Gymnastics difficulty bands and the three-individual-element requirement.'
    ),
    'safety_and_readiness', jsonb_build_array(
      'These are advanced and elite element families. Use appropriately credentialed Acro coaches, progressive pits and mats, assigned spotters/catchers, and an emergency plan.',
      'Clear every start position, component motion, body shape, release, rotation/twist phase, catch, and exit independently before assembling a tariffed element.',
      'Do not progress from a table-family card alone; the exact FIG drawing and current USA Gymnastics/FIG restrictions must be reviewed for the selected element.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault', 'Level 9 minimum difficulty not met', 'deduction', '-1.0 DJ', 'cue', 'Balance minimum 35; Dynamic minimum 25.'),
      jsonb_build_object('fault', 'Level 10 minimum difficulty not met', 'deduction', '-1.0 DJ', 'cue', 'Balance minimum 55; Dynamic minimum 45.'),
      jsonb_build_object('fault', 'Missing individual element', 'deduction', '-1.0 SR each', 'cue', 'Include three individual elements.'),
      jsonb_build_object('fault', 'Incorrect tariff drawing/value, unrecognized variant, or prohibited element', 'deduction', 'No difficulty plus applicable DJ/CJP consequences', 'cue', 'Audit current ToD ID, value parts, restrictions, and tariff drawing.'),
      jsonb_build_object('fault', 'Technical shape, amplitude, instability, catch, landing, or hold error', 'deduction', 'Per FIG/USA technical-fault tables', 'cue', 'Score the performed element, not the intended tariff.'),
      jsonb_build_object('fault', 'Starts or ends after music / exceeds time', 'deduction', '-0.3 CJP as applicable', 'cue', 'Balance limit 2:30; Dynamic limit 2:00.'),
      jsonb_build_object('fault', 'No music', 'deduction', '-1.0', 'cue', 'Verify music and backup playback.')
    ),
    'scoring_summary', 'Level 9: Balance difficulty 35-45 (allowance 65), Dynamic 25-35 (allowance 55). Level 10: Balance 55-65 (allowance 85), Dynamic 45-55 (allowance 75). Missing the minimum is -1.0 DJ; each missing individual element is -1.0 SR. Exact element value is calculated from the selected FIG drawing and component tables.',
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title', 'How to read and train ' || d.family, 'purpose', 'learning', 'description', 'Open on the exact FIG table page and tariff drawing. Label every role, support, value component, start/end point, motion or flight phase, then show progressive stations and the complete element from judging angles.'),
      jsonb_build_object('title', d.family || ' - ideal tariff model', 'purpose', 'model', 'description', 'Show the exact drawing number and value calculation beside synchronized full-speed, slow-motion, and freeze-frame views. Mark contacts, body shape, axis, amplitude, hold timing, catch/landing, and any link.')
    ),
    'sources', jsonb_build_array(
      jsonb_build_object('title','USA Gymnastics Acro Development Program Code 2025-2028 - Levels 9 and 10','url','https://static.usagym.org/PDFs/Acro/Rules/devcop_2528.pdf#page=51','organization','USA Gymnastics','effective_cycle','2025-2028','accessed_on','2026-07-25','note','USA difficulty bands, composition exceptions, penalties, and International Track incorporation.'),
      jsonb_build_object('title','FIG Acrobatic Gymnastics Tables of Difficulty 2025-2028','url','https://www.gymnastics.sport/publicdir/rules/files/en_2025-2028%20ACRO%20Table%20of%20Difficulty.pdf#page=' || split_part(d.tod_pages,'-',1),'organization','FIG / World Gymnastics','effective_cycle','2025-2028','accessed_on','2026-07-25','note','Controlling drawings, IDs, component values, and variants for this family.'),
      jsonb_build_object('title','FIG Youth and Junior Acro Rules 2025-2028','url','https://www.gymnastics.sport/publicdir/rules/files/en_1.5%20-%20Youth%20%26%20Junior%20Rules%202025-2028.pdf','organization','FIG / World Gymnastics','effective_cycle','2025-2028','accessed_on','2026-07-25','note','Rules incorporated by USA Gymnastics for Level 9, Level 10, and international age groups.')
    ),
    'editorial_note', 'This is a parametric table-family card. The FIG ToD creates elements by combining drawings and value parts, so the exact selected drawing—not a copied diagram—is controlling.'
  ) metadata
  FROM source_data d
)
INSERT INTO coaching.skill (
  facility_id, name, slug, description, instructions, sport_id, skill_level,
  skill_kind, evaluation_mode, execution_max_score, assistance_note,
  is_published, visibility, official_metadata
)
SELECT
  (SELECT id FROM public.facility ORDER BY id LIMIT 1),
  'Acro FIG - ' || p.family, p.slug, p.description, p.coaching_focus,
  (SELECT id FROM coaching.sport WHERE key = 'gymnastics'),
  'ELITE'::public.skill_level, 'partner', 'execution', 10,
  array_to_string(p.disciplines, ', ') || '; FIG ToD pages ' || p.tod_pages,
  TRUE, 'facility', p.metadata
FROM prepared p
ON CONFLICT (facility_id, slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, instructions = EXCLUDED.instructions,
  sport_id = EXCLUDED.sport_id, skill_level = EXCLUDED.skill_level,
  skill_kind = EXCLUDED.skill_kind, evaluation_mode = EXCLUDED.evaluation_mode,
  execution_max_score = EXCLUDED.execution_max_score, assistance_note = EXCLUDED.assistance_note,
  is_published = EXCLUDED.is_published, visibility = EXCLUDED.visibility,
  official_metadata = EXCLUDED.official_metadata, updated_at = NOW();
