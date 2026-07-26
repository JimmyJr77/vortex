-- USA Gymnastics Acrobatic Gymnastics Development Program 2025-2028.
-- Complete Level 8 Women's Group and Men's Group Balance/Dynamic boxes.

WITH source_data (
  slug, discipline, event_type, box_code, row_name, official_name, description, source_page
) AS (
  VALUES
    ('usag-acro-l8-wg-bal-1a', 'Women''s Group', 'Balance', '1A', 'Row 1 / Category 1', 'Twin-base standing column', 'Two standing bases each support one upper partner overhead; the selected top position is held for 3 seconds in tuck, pike, straddle, crocodile, or handstand.', 47),
    ('usag-acro-l8-wg-bal-1b', 'Women''s Group', 'Balance', '1B', 'Row 1 / Category 1', 'Twin-base low inverted column', 'Two bases in low supine or seated support each receive one upper partner in an inverted support; the selected top position is held for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-1c', 'Women''s Group', 'Balance', '1C', 'Row 1 / Category 1', 'Facing low-base arch', 'Two low bases face one another and support a shared top position above the center; the top holds tuck, pike, straddle, crocodile, or handstand for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-1d', 'Women''s Group', 'Balance', '1D', 'Row 1 / Category 1', 'Facing handstand-base arch', 'Two bases hold facing handstands and create the shared support for the top, who holds tuck, pike, straddle, crocodile, or handstand for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-2a', 'Women''s Group', 'Balance', '2A', 'Row 2 / Category 2', 'Two-level supine stack', 'A lower partner supports a middle partner above the torso while the top and middle each show a declared tuck, pike, straddle, crocodile, or handstand position for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-2b', 'Women''s Group', 'Balance', '2B', 'Row 2 / Category 2', 'Bridge-base two-level stack', 'A bridge-shaped base supports the middle/top stack in either official orientation; both top and middle hold a declared position for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-2c', 'Women''s Group', 'Balance', '2C', 'Row 2 / Category 2', 'Split-base vertical stack', 'A base in split supports a vertical middle and top; the top holds a declared position or high/low handstand and the middle holds a 2:1 straddle, crocodile, or handstand for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-2d', 'Women''s Group', 'Balance', '2D', 'Row 2 / Category 2', 'Lunge-base front/back-leg stack', 'The middle establishes straddle, crocodile, or handstand on the base''s front or back leg while supporting the top in a declared position or high/low handstand; both holds last 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-3a', 'Women''s Group', 'Balance', '3A', 'Row 3 / Category 3', 'Nested bridge pyramid', 'Base and middle form a nested arched support while the top holds tuck, pike, straddle, crocodile, or handstand for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-3b', 'Women''s Group', 'Balance', '3B', 'Row 3 / Category 3', 'Boxed inverted pyramid', 'Base and middle form the compact rectangular inverted support shown in box 3B while the top holds a declared tuck, pike, straddle, crocodile, or handstand for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-3c', 'Women''s Group', 'Balance', '3C', 'Row 3 / Category 3', 'Split-base side column', 'A split base and side supporting partner build either official 3C orientation beneath a standing middle; the top holds a declared position or high/low handstand for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-3d', 'Women''s Group', 'Balance', '3D', 'Row 3 / Category 3', 'Seated-base vertical column', 'A seated or squat base supports the middle/top vertical column; the top holds a declared tuck, pike, straddle, crocodile, or high/low handstand for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-4a', 'Women''s Group', 'Balance', '4A', 'Row 4 / Categories 4-6', 'Central column with lateral supports', 'A central base and middle create the vertical support while the remaining partners extend laterally; the top holds a declared position for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-4b', 'Women''s Group', 'Balance', '4B', 'Row 4 / Categories 4-6', 'Inverted base-middle column', 'The base and inverted middle form the official vertical support while the top holds tuck, pike, straddle, crocodile, or handstand for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-4c', 'Women''s Group', 'Balance', '4C', 'Row 4 / Categories 4-6', 'Counterbalanced horizontal pyramid', 'The group creates the official low counterbalanced structure with a horizontal upper partner; the top holds a declared position for 3 seconds.', 47),
    ('usag-acro-l8-wg-bal-4d', 'Women''s Group', 'Balance', '4D', 'Row 4 / Categories 4-6', 'Standing arch-supported pyramid', 'Two standing bases support the arched middle structure and top; the top holds tuck, pike, straddle, crocodile, or handstand for 3 seconds.', 47),

    ('usag-acro-l8-wg-dyn-1a', 'Women''s Group', 'Dynamic', '1A', 'Row 1', 'Handstand boost quarter salto to forearms', 'From supported handstand, the group boosts a one-quarter front or back tuck, pike, or layout to forearm catch.', 48),
    ('usag-acro-l8-wg-dyn-1b', 'Women''s Group', 'Dynamic', '1B', 'Row 1', 'Log roll', 'The group performs a log roll with 360, 540, or 720 degrees of longitudinal rotation to the prescribed catch.', 48),
    ('usag-acro-l8-wg-dyn-1c', 'Women''s Group', 'Dynamic', '1C', 'Row 1', 'Handstand three-quarter salto to forearms', 'From supported handstand, the group throws a three-quarter front or back tuck, pike, or layout to forearm catch.', 48),
    ('usag-acro-l8-wg-dyn-1d', 'Women''s Group', 'Dynamic', '1D', 'Row 1', 'Helicopter', 'The group performs the helicopter element with two-quarter or four-quarter rotation to the prescribed catch.', 48),
    ('usag-acro-l8-wg-dyn-2a', 'Women''s Group', 'Dynamic', '2A', 'Row 2', 'Pitch quarter salto to forearms', 'From basket, double toe pitch, foot-to-hand, or double foot-to-hand, the top performs a one-quarter front or back tuck, pike, or layout to forearm catch.', 48),
    ('usag-acro-l8-wg-dyn-2b', 'Women''s Group', 'Dynamic', '2B', 'Row 2', 'Pitch three-quarter salto to forearms', 'From basket, double toe pitch, foot-to-hand, or double foot-to-hand, the top performs a three-quarter front or back tuck, pike, or layout to forearm catch.', 48),
    ('usag-acro-l8-wg-dyn-2c', 'Women''s Group', 'Dynamic', '2C', 'Row 2', 'Cradle three-quarter salto dismount', 'From cradle, the top performs a three-quarter front or back tuck, pike, or layout dismount to floor.', 48),
    ('usag-acro-l8-wg-dyn-2d', 'Women''s Group', 'Dynamic', '2D', 'Row 2', 'Cradle five-quarter salto to forearms', 'From cradle, the top performs a five-quarter front or back tuck, pike, or layout to forearm catch.', 48),
    ('usag-acro-l8-wg-dyn-3a', 'Women''s Group', 'Dynamic', '3A', 'Row 3', 'Pitch half salto to supported handstand', 'From basket, double toe pitch, or toe-pitch boost, the top performs a half front or back tuck, pike, or layout to supported-handstand catch.', 48),
    ('usag-acro-l8-wg-dyn-3b', 'Women''s Group', 'Dynamic', '3B', 'Row 3', 'Handstand release-recatch', 'From supported handstand, both hands release during a zero-quarter throw and the top is recaught in supported handstand.', 48),
    ('usag-acro-l8-wg-dyn-3c', 'Women''s Group', 'Dynamic', '3C', 'Row 3', 'Straight pitch to low foot-to-hand', 'From basket, double toe pitch, or toe-pitch boost, the top performs a zero-quarter straight flight to low foot-to-hand or double foot-to-hand.', 48),
    ('usag-acro-l8-wg-dyn-3d', 'Women''s Group', 'Dynamic', '3D', 'Row 3', 'Straight pitch to basket', 'From basket, double toe pitch, or toe-pitch boost, the top performs a zero-quarter straight flight to basket catch.', 48),
    ('usag-acro-l8-wg-dyn-4a', 'Women''s Group', 'Dynamic', '4A', 'Row 4', 'Swing full salto to forearms', 'From swing, the top performs a full front or back tuck, pike, or layout to forearm catch.', 48),
    ('usag-acro-l8-wg-dyn-4b', 'Women''s Group', 'Dynamic', '4B', 'Row 4', 'Boost full salto dismount', 'From toe-pitch boost, front/back boost, or scoop boost, the top performs a full front or back tuck, pike, or layout dismount.', 48),
    ('usag-acro-l8-wg-dyn-4c', 'Women''s Group', 'Dynamic', '4C', 'Row 4', 'Pitch full salto dismount', 'From basket, double toe pitch, foot-to-hand, or double foot-to-hand, the top performs a full front or back tuck, pike, or layout dismount.', 48),
    ('usag-acro-l8-wg-dyn-4d', 'Women''s Group', 'Dynamic', '4D', 'Row 4', 'Handstand one-and-a-half salto dismount', 'From supported handstand, the top performs a one-and-a-half front or back tuck, pike, or layout dismount.', 48),

    ('usag-acro-l8-mg-bal-1a', 'Men''s Group', 'Balance', '1A', 'Row 1 / Category 1', 'Shoulderstand or supported-handstand diagonal', 'The group builds the official diagonal support with top or middle in shoulderstand or supported handstand for 3 seconds.', 49),
    ('usag-acro-l8-mg-bal-1b', 'Men''s Group', 'Balance', '1B', 'Row 1 / Category 1', 'Diagonal with secondary supported handstand', 'On the official diagonal base structure, top or middle holds tuck, pike, straddle, crocodile, or high/low handstand while another top/middle shows supported handstand; holds last 3 seconds.', 49),
    ('usag-acro-l8-mg-bal-1c', 'Men''s Group', 'Balance', '1C', 'Row 1 / Category 1', 'Split-base diagonal variants', 'The group uses either official split-base diagonal orientation while top or middle holds tuck, pike, straddle, crocodile, or high/low handstand for 3 seconds.', 49),
    ('usag-acro-l8-mg-bal-1d', 'Men''s Group', 'Balance', '1D', 'Row 1 / Category 1', 'Lunge-base multi-level support', 'A lunge base supports the multi-level arrangement; top or middle holds tuck, pike, straddle, or crocodile for 3 seconds.', 49),
    ('usag-acro-l8-mg-bal-2a', 'Men''s Group', 'Balance', '2A', 'Row 2 / Categories 1-2', 'Facing standing-base column', 'Two standing bases create the facing support beneath the top, who holds tuck, pike, straddle, crocodile, or high/low handstand for 3 seconds.', 49),
    ('usag-acro-l8-mg-bal-2b', 'Men''s Group', 'Balance', '2B', 'Row 2 / Categories 1-2', 'Lunge-base vertical column', 'A lunge base and supporting middle build the vertical column; the top holds tuck, pike, straddle, crocodile, or high/low handstand for 3 seconds.', 49),
    ('usag-acro-l8-mg-bal-2c', 'Men''s Group', 'Balance', '2C', 'Row 2 / Categories 1-2', 'Three-base central column', 'Three bases stabilize the central support beneath the top, who holds tuck, pike, straddle, crocodile, or high/low handstand for 3 seconds.', 49),
    ('usag-acro-l8-mg-bal-2d', 'Men''s Group', 'Balance', '2D', 'Row 2 / Categories 1-2', 'Nested bridge stack', 'Base and middle form a nested bridge structure while top or middle holds tuck, pike, straddle, crocodile, or high/low handstand for 3 seconds.', 49),

    ('usag-acro-l8-mg-dyn-1a', 'Men''s Group', 'Dynamic', '1A', 'Row 1', 'Low foot-to-hand straight to basket', 'From low foot-to-hand, the top performs a zero-quarter straight flight to basket catch.', 50),
    ('usag-acro-l8-mg-dyn-1b', 'Men''s Group', 'Dynamic', '1B', 'Row 1', 'Three-man basket straight recatch', 'From a three-man basket, the top performs a zero-quarter straight flight and is recaught in basket.', 50),
    ('usag-acro-l8-mg-dyn-1c', 'Men''s Group', 'Dynamic', '1C', 'Row 1', 'Basket straight recatch with base switch', 'From basket, the top performs a zero-quarter straight flight to basket while the catching base assignment changes.', 50),
    ('usag-acro-l8-mg-dyn-1d', 'Men''s Group', 'Dynamic', '1D', 'Row 1', 'Double toe pitch to basket with base switch', 'A double toe pitch produces zero-quarter straight flight to basket while the catching base assignment changes.', 50),
    ('usag-acro-l8-mg-dyn-2a', 'Men''s Group', 'Dynamic', '2A', 'Row 2', 'Basket straight to low foot-to-hand', 'From basket, the top performs a zero-quarter straight flight to low foot-to-hand.', 50),
    ('usag-acro-l8-mg-dyn-2b', 'Men''s Group', 'Dynamic', '2B', 'Row 2', 'Low handstand half-back to basket', 'From low supported handstand, the top performs a half-back tuck, pike, or layout to basket catch.', 50),
    ('usag-acro-l8-mg-dyn-2c', 'Men''s Group', 'Dynamic', '2C', 'Row 2', 'Toe pitch or shoulderstand straight to basket', 'From toe pitch or a shoulderstand straight jump, the top performs zero-quarter straight flight to basket.', 50),
    ('usag-acro-l8-mg-dyn-2d', 'Men''s Group', 'Dynamic', '2D', 'Row 2', 'Three-man basket full-back to basket', 'From a three-man basket, the top performs a full back tuck to basket catch.', 50),
    ('usag-acro-l8-mg-dyn-3a', 'Men''s Group', 'Dynamic', '3A', 'Row 3', 'Double toe-pitch full-back dismount', 'A double toe pitch produces a full back tuck, pike, or layout dismount to floor.', 50),
    ('usag-acro-l8-mg-dyn-3b', 'Men''s Group', 'Dynamic', '3B', 'Row 3', 'Three-man toe-pitch straight dismount', 'A three-man toe pitch produces a zero-quarter straight dismount to floor.', 50),
    ('usag-acro-l8-mg-dyn-3c', 'Men''s Group', 'Dynamic', '3C', 'Row 3', 'Three-man basket full-back dismount', 'From a three-man basket, the top performs a full back tuck, pike, or layout dismount to floor.', 50),
    ('usag-acro-l8-mg-dyn-3d', 'Men''s Group', 'Dynamic', '3D', 'Row 3', 'Paired toe-pitch full-back dismount', 'From the paired toe-pitch pathway, the top performs a full back tuck, pike, or layout dismount to floor.', 50),
    ('usag-acro-l8-mg-dyn-4a', 'Men''s Group', 'Dynamic', '4A', 'Row 4', 'Swing full salto to forearms with base switch', 'From swing, the top performs a full front or back tuck, pike, or layout to forearm catch with a base switch.', 50),
    ('usag-acro-l8-mg-dyn-4b', 'Men''s Group', 'Dynamic', '4B', 'Row 4', 'Basket five-quarter salto to forearms', 'From basket, the top performs a five-quarter front or back tuck, pike, or layout to forearm catch with a base switch; the official optional link continues three-quarter to floor.', 50),
    ('usag-acro-l8-mg-dyn-4c', 'Men''s Group', 'Dynamic', '4C', 'Row 4', 'Handstand three-quarter salto to forearms', 'From supported handstand, the top performs a three-quarter front or back tuck, pike, or layout to forearm catch with a base switch; an optional log-roll link may follow.', 50),
    ('usag-acro-l8-mg-dyn-4d', 'Men''s Group', 'Dynamic', '4D', 'Row 4', 'Basket three-quarter salto to forearms', 'From basket, the top performs a three-quarter front or back tuck, pike, or layout to forearm catch with a base switch; an optional log-roll link may follow.', 50)
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics',
    'discipline', 'Acrobatic Gymnastics',
    'event', 'Level 8 ' || d.discipline || ' ' || d.event_type,
    'program', 'Acrobatic Gymnastics Development Program 2025-2028',
    'official_name', d.official_name,
    'official_code', 'Level 8 ' || d.discipline || ' ' || d.event_type || ' ' || d.box_code,
    'usa_gymnastics_levels', jsonb_build_array('Acro Level 8'),
    'status', 'verified',
    'last_verified', '2026-07-25',
    'athlete_cues', CASE WHEN d.event_type = 'Balance' THEN jsonb_build_array(
      'Build from the floor upward: lock every base position, establish each contact, then place the top without chasing the shape.',
      'Start the 3-second count only after the whole pyramid and declared top or middle position are motionless.'
    ) ELSE jsonb_build_array(
      'Share one load count, drive flight upward before rotation, show the declared shape, and present early to the assigned catch.',
      'Know the exact start, rotation fraction, body shape, catch, base-switch assignment, and any optional link before mounting.'
    ) END,
    'coach_checkpoints', jsonb_build_array(
      d.description,
      CASE WHEN d.event_type = 'Balance'
        THEN 'Confirm the diagram-specific base and middle orientation, all legal support contacts, straight load paths, the declared body position, a visible 3-second hold, and controlled exit.'
        ELSE 'Confirm start contact, synchronized load, release direction, amplitude, exact rotation fraction, shape, tracking, base switch when prescribed, and controlled catch or landing.'
      END,
      CASE WHEN d.discipline = 'Women''s Group'
        THEN CASE WHEN d.event_type = 'Balance'
          THEN 'Women''s Group Balance uses one compulsory from two different rows plus one FIG ToD optional (minimum V1); pyramid categories may not repeat, three total 3-second holds are required, and top or middle must show one unsupported handstand.'
          ELSE 'Women''s Group Dynamic uses one compulsory from each row plus two FIG Group Dynamic optionals valued 1-13.'
        END
        ELSE CASE WHEN d.event_type = 'Balance'
          THEN 'Men''s Group Balance uses one compulsory from each row plus one FIG ToD optional (minimum V1); three total 3-second holds and one unsupported handstand by top or middle are required.'
          ELSE 'Men''s Group Dynamic uses one compulsory from each row plus two FIG Group Dynamic optionals valued 1-13.'
        END
      END
    ),
    'safety_and_readiness', jsonb_build_array(
      'Use a qualified Acro coach, regulation mats, assigned spotters and catch roles, progressive height, and an rehearsed emergency plan.',
      CASE WHEN d.event_type = 'Balance'
        THEN 'Every partner must independently own the body shape and contact position. Build the formation in low stations, then raise one layer at a time without sacrificing alignment.'
        ELSE 'Master the pitch or support, straight-flight drill, body shape, rotation progression, tracking, and catch on lowered stations before full height.'
      END,
      'Regress for shifting contacts, bent load paths, timing disagreement, low amplitude, off-axis flight, lost tracking, collapsing catches, or uncontrolled exits.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault', 'Missing required group skill or individual element', 'deduction', '-1.0 SR each', 'cue', 'Audit every required row, optional, and individual element.'),
      jsonb_build_object('fault', 'All required content not performed', 'deduction', 'Additional -1.0 SR', 'cue', 'Complete every composition category.'),
      jsonb_build_object('fault', 'Repeated compulsory box or prohibited category repetition', 'deduction', 'No requirement credit / applicable SR penalty', 'cue', 'Map distinct boxes and categories before tariff submission.'),
      jsonb_build_object('fault', 'Additional pair/group value skill', 'deduction', '-1.0 DJ once per exercise', 'cue', 'Stay within the prescribed number of group skills.'),
      jsonb_build_object('fault', CASE WHEN d.event_type = 'Balance' THEN 'Hold shorter than 3 seconds or unstable pyramid' ELSE 'Insufficient amplitude, incomplete rotation, shape, catch, or landing error' END,
        'deduction', 'Per technical-fault tables', 'cue', CASE WHEN d.event_type = 'Balance' THEN 'Finish the structure before counting and hold without visible correction.' ELSE 'Create height, finish rotation and shape, then present early.' END),
      jsonb_build_object('fault', 'No music', 'deduction', '-1.0 CJP', 'cue', 'Verify music and backup playback.'),
      jsonb_build_object('fault', 'Exercise exceeds the Level 8 time limit', 'deduction', '-0.3 CJP', 'cue', 'Time from first movement; Balance/Combined limit 2:30 and Dynamic limit 2:00.')
    ),
    'scoring_summary', CASE WHEN d.event_type = 'Balance'
      THEN 'Level 8 has no difficulty score. Composition requires the prescribed compulsory boxes, FIG optional content, three individual elements, and three 3-second holds. Missing content is -1.0 SR each; hold, composition, technical, music, and time penalties apply.'
      ELSE 'Level 8 has no difficulty score. Group Dynamic requires four compulsory boxes, two FIG Group Dynamic optional elements valued 1-13, and three individual elements. Missing content is -1.0 SR each; composition, technical, music, and time penalties apply.'
    END,
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title', 'Teach ' || d.official_name, 'purpose', 'learning',
        'description', CASE WHEN d.event_type = 'Balance'
          THEN 'Identify every partner and contact on a freeze-frame of the official diagram. Show floor stations, low build, assisted full formation, legal 3-second count, and controlled exit from front and side views.'
          ELSE 'Show start grips and catch roles, straight-flight stations, body-shape and rotation drills, then the complete element. Include front, side, overhead, and catch-perspective slow motion.'
        END),
      jsonb_build_object('title', d.official_name || ' - ideal Level 8 model', 'purpose', 'model',
        'description', CASE WHEN d.event_type = 'Balance'
          THEN 'Show the exact box structure at full speed and in a still overlay: stable base geometry, legal contacts, stacked load paths, precise declared shapes, an unmistakable 3-second hold, and a controlled exit.'
          ELSE 'Show full speed and slow motion with the box code: simultaneous force, rising amplitude, exact shape and rotation, centered axis, early presentation, secure assigned catch, and still finish.'
        END)
    ),
    'next_progressions', '[]'::jsonb,
    'sources', jsonb_build_array(jsonb_build_object(
      'title', 'USA Gymnastics Acrobatic Gymnastics Development Program Code of Points 2025-2028',
      'url', 'https://static.usagym.org/PDFs/Acro/Rules/devcop_2528.pdf#page=' || d.source_page,
      'organization', 'USA Gymnastics',
      'effective_cycle', '2025-2028',
      'accessed_on', '2026-07-25',
      'note', 'Official Level 8 group ' || d.event_type || ' box, diagram, and composition requirements.'
    )),
    'editorial_note', 'Original coaching summary. The official diagram remains controlling for exact contacts and orientation. Level 9 progressions branch through FIG 12-18 rules and the Tables of Difficulty, so no single direct next element is asserted.'
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
  'Acro L8 ' || p.discipline || ' ' || p.event_type || ' ' || p.box_code || ' - ' || p.official_name,
  p.slug, p.description,
  CASE WHEN p.event_type = 'Balance'
    THEN 'Build the exact diagrammed structure from the base upward, establish every legal contact and declared body position, hold the completed pyramid motionless for 3 seconds, then exit under control.'
    ELSE 'Establish the prescribed start contact, coordinate the group load and release, create sufficient flight, complete the declared rotation and shape, then finish in the exact catch or controlled floor landing.'
  END,
  (SELECT id FROM coaching.sport WHERE key = 'gymnastics'),
  'ADVANCED'::public.skill_level,
  'partner', 'execution', 10,
  p.discipline || ' Level 8 ' || p.event_type || ' compulsory box ' || p.box_code || ' (' || p.row_name || ')',
  TRUE, 'facility', p.metadata
FROM prepared p
ON CONFLICT (facility_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  sport_id = EXCLUDED.sport_id,
  skill_level = EXCLUDED.skill_level,
  skill_kind = EXCLUDED.skill_kind,
  evaluation_mode = EXCLUDED.evaluation_mode,
  execution_max_score = EXCLUDED.execution_max_score,
  assistance_note = EXCLUDED.assistance_note,
  is_published = EXCLUDED.is_published,
  visibility = EXCLUDED.visibility,
  official_metadata = EXCLUDED.official_metadata,
  updated_at = NOW();
