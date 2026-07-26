-- USA Gymnastics T&T Development Program (2025-2029) power tumbling.
-- Unique compulsory elements introduced across Levels 1-7.
-- Narrative coaching language is original; official documents control.

WITH source_data (
  name, slug, description, instructions, levels, difficulty_value,
  athlete_cue, coach_focus, prerequisite_slug, next_name, next_slug
) AS (
  VALUES
    ('T&T Forward Roll — Tuck', 'usag-tt-forward-roll-tuck',
      'A forward rotation through hand and shoulder support in a compact tuck, returning to the feet.',
      'Reach forward, place both hands, round continuously from upper back to hips, keep the heels close, and stand without pushing off the track behind the body.',
      ARRAY['Tumbling Level 1'], NULL,
      'Look at the middle, make a round back, and finish on your feet.',
      'Continuous rotation, symmetric hand contact, head protected, compact tuck, and no extra hand support on the stand.',
      NULL, 'Cartwheel step-in', 'usag-tt-cartwheel-step-in'),
    ('T&T Cartwheel Step-in', 'usag-tt-cartwheel-step-in',
      'A sideward hand-supported rotation that closes the feet into a step-in finish for continued tumbling.',
      'Start from a long lunge, place hands sequentially on the travel line, pass through a split inverted shape, and pull the second leg quickly to the first for a forward-facing finish.',
      ARRAY['Tumbling Level 1'], NULL,
      'Hand, hand, foot, close—finish ready for the next skill.',
      'Long entry, straight support arms, extended split legs, accurate line, and a deliberate feet-closing step-in.',
      'usag-tt-forward-roll-tuck', 'Step cartwheel', 'usag-tt-step-cartwheel'),
    ('T&T Straight Jump Rebound', 'usag-tt-straight-jump-rebound',
      'A two-foot elastic rebound with a straight body and immediate controlled return to the track.',
      'Land the preceding element through the balls of the feet, keep the trunk stacked, extend ankles-knees-hips together, and rise vertically with legs joined and toes extended.',
      ARRAY['Tumbling Level 1'], NULL,
      'Bounce tall like one straight spring and land in the same place.',
      'No deep squat or travel, arms coordinated, body straight at flight peak, feet together, and quiet elastic contact.',
      NULL, 'Round-off rebound', 'usag-tt-roundoff-rebound'),
    ('T&T Backward Roll — Tuck', 'usag-tt-backward-roll-tuck',
      'A backward rotation in tuck through hand support, finishing on the feet.',
      'Sit close to the heels, roll over a rounded back, place hands beside the ears with fingers toward shoulders, push evenly to clear the head, and bring feet under the center.',
      ARRAY['Tumbling Levels 1–2'], NULL,
      'Stay tucked, place both hands by your ears, and push the floor away.',
      'Centered backward path, protected neck, simultaneous hand push, compact tuck, and balanced two-foot finish.',
      'usag-tt-forward-roll-tuck', 'Back roll pike to push-up', 'usag-tt-back-roll-pike-push-up'),
    ('T&T Back Roll Pike to Push-up', 'usag-tt-back-roll-pike-push-up',
      'A backward roll that extends to a piked turnover and finishes in straight-arm front support.',
      'Roll with legs extended toward the face, place hands early, push the shoulders away from the floor, and open the hips only as the feet travel over to finish in a braced push-up line.',
      ARRAY['Tumbling Level 1'], NULL,
      'Keep the legs long, push early, and land in one strong plank.',
      'Straight knees, active hand push, no head loading, controlled hip opening, and shoulders-hips-heels aligned at finish.',
      'usag-tt-backward-roll-tuck', 'Hollow push-up hold', 'usag-tt-hollow-push-up-hold'),
    ('T&T Hollow Push-up Hold — 3 Seconds', 'usag-tt-hollow-push-up-hold',
      'A straight-arm front-support hold with a visibly hollow, fully braced body line.',
      'Place shoulders above the hands, push the upper back away, draw ribs and pelvis toward each other, extend the knees and ankles, and remain motionless for the full count.',
      ARRAY['Tumbling Level 1'], NULL,
      'Push tall, zip ribs to hips, and freeze for three.',
      'Straight arms, scapular push, contained ribs, joined extended legs, no sag or pike, and a complete three-second hold.',
      'usag-tt-back-roll-pike-push-up', 'Handstand forward roll', 'usag-tt-handstand-forward-roll'),
    ('T&T Handstand Forward Roll', 'usag-tt-handstand-forward-roll',
      'A controlled handstand that transitions forward through a rounded roll to the feet.',
      'Kick to a stacked handstand, push tall, shift shoulders slightly beyond the hands, tuck the chin, soften through straight arms with control, and round smoothly to stand.',
      ARRAY['Tumbling Level 2'], NULL,
      'Show the handstand first, tuck your chin, then roll round to your feet.',
      'Recognizable vertical handstand, straight legs, controlled lowering rather than collapse, protected head, and balanced finish.',
      'handstand', 'Power hurdle round-off', 'usag-tt-power-hurdle-roundoff'),
    ('T&T Step Cartwheel', 'usag-tt-step-cartwheel',
      'A traveling cartwheel initiated from a step and finished with separated feet.',
      'Step into a long lunge, reach hand-hand along the center line, kick through an extended split, and land foot-foot without turning the skill into a round-off.',
      ARRAY['Tumbling Level 2'], NULL,
      'Reach long, split wide upside down, and land one foot then the other.',
      'Sequential contacts, straight support arms, extended knees and toes, vertical split passage, line control, and ordered foot landing.',
      'usag-tt-cartwheel-step-in', 'Cartwheel', 'usag-tt-cartwheel'),
    ('T&T Cartwheel', 'usag-tt-cartwheel',
      'A sideward hand-supported rotation with sequential hand and foot contacts.',
      'Use a long lunge, turn the hands onto the travel line, drive the back leg over the top, maintain an open split through inversion, and finish in the opposite lunge.',
      ARRAY['Tumbling Level 2'], '0.1 when difficulty is awarded under the T&T formula',
      'Make a big wheel: hand, hand, foot, foot on one line.',
      'Rhythm of four contacts, vertical hips, straight arms and legs, amplitude, center-line control, and a stable lunge finish.',
      'usag-tt-step-cartwheel', 'Round-off', 'round-off'),
    ('T&T Power Hurdle Round-off', 'usag-tt-power-hurdle-roundoff',
      'A power hurdle directly into a round-off, finishing with feet together and backward-directed rebound.',
      'Convert the hurdle into a long low lunge, place hands on line, join the legs by vertical, block through the shoulders, and snap the feet under together without pausing.',
      ARRAY['Tumbling Levels 2–4'], 'Round-off: 0.1 when difficulty is awarded',
      'Hurdle long, close the legs upside down, and snap to a tall rebound.',
      'Controlled hurdle, no reach-down collapse, straight support, early leg closure, aggressive block, feet together, and central-axis direction.',
      'usag-tt-cartwheel', 'Round-off back handspring', 'round-off-back-handspring'),
    ('T&T Whipback', 'usag-tt-whipback',
      'A fast backward somersault in an extended, slightly arched linking shape without hand support.',
      'Enter from a rising connected skill, drive the hips while keeping the head neutral, pass rapidly through a long open shape, and place the feet behind the center to continue bounding.',
      ARRAY['Tumbling Levels 6–7'], '0.2',
      'Rise, stretch long through the air, and snap the feet behind you to keep moving.',
      'Clear no-hand flight, extended body rather than tuck, adequate height, central-axis travel, fast turnover, and uninterrupted rhythm into the next element.',
      'back-handspring', 'Whipback series', 'usag-tt-whipback-series'),
    ('T&T Back Somersault — Pike', 'usag-tt-back-somersault-pike',
      'A backward single somersault held in pike, used as the final element of the Level 6 first compulsory routine.',
      'Create upward lift from the connected pass, close at the hips with knees extended, rotate without throwing the head, then open early enough to prepare a controlled landing.',
      ARRAY['Tumbling Level 6'], '0.6 (0.5 single somersault + 0.1 pike-position bonus)',
      'Lift first, fold with straight legs, then open and see the landing.',
      'Height and rhythm from the pass, pike angles within recognition limits, joined straight knees and pointed toes, timely opening, and landing control.',
      'back-tuck', 'Back somersault straight', 'usag-tt-back-somersault-straight'),
    ('T&T Back Somersault — Straight', 'usag-tt-back-somersault-straight',
      'A backward single somersault maintained in a straight body position, used to finish the Level 7 second compulsory routine.',
      'Set upward from the final linking skill, keep shoulders-hips-knees in one extended line during flight, rotate from the whole body, and prepare the landing without an early pike-down.',
      ARRAY['Tumbling Level 7'], '0.6 (0.5 single somersault + 0.1 straight-position bonus)',
      'Rise tall, stay one long shape, and hold the line until it is time to land.',
      'Height, continuous straight shape, legs and feet together, pointed toes, no early hip closure, central-axis travel, and three-second landing control.',
      'usag-tt-back-somersault-pike', 'Back somersault straight with twist', 'usag-tt-back-layout-full')
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics',
    'discipline', 'Trampoline & Tumbling',
    'event', 'Power Tumbling',
    'program', 'Development Program 2025–2029',
    'official_name', d.name,
    'usa_gymnastics_levels', to_jsonb(d.levels),
    'difficulty_value', d.difficulty_value,
    'status', 'verified',
    'last_verified', '2026-07-25',
    'athlete_cues', jsonb_build_array(d.athlete_cue, 'Stay on the center line and finish every shape.'),
    'coach_checkpoints', jsonb_build_array(d.coach_focus, 'Confirm exact compulsory order and exceptions on the current USA Gymnastics routine sheet.'),
    'safety_and_readiness', jsonb_build_array(
      'Teach on regulation-appropriate progressive surfaces with a qualified T&T coach.',
      'Do not advance until the preceding skill is repeatable with center-line and landing control.',
      'Use hands-on spotting only within the coach''s training and the skill''s recognized progressions.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault', 'Lack of form, control, height, or rhythm', 'deduction', '0.1–0.5 per element', 'cue', 'Finish the shape and preserve pass speed.'),
      jsonb_build_object('fault', 'Bent knees in pike/straight flight', 'deduction', '0.1–0.2', 'cue', 'Lock the knees before peak flight.'),
      jsonb_build_object('fault', 'Feet or knees apart / toes not pointed', 'deduction', 'Up to 0.2 combined for the listed leg/foot faults', 'cue', 'Glue the legs and finish the feet.'),
      jsonb_build_object('fault', 'Loss of speed', 'deduction', '0.1–0.2', 'cue', 'Connect through active feet without pausing.'),
      jsonb_build_object('fault', 'Deviation from track center axis', 'deduction', '0.1', 'cue', 'Drive and land on the center line.'),
      jsonb_build_object('fault', 'Unstable completed-routine landing / no three-second control', 'deduction', '0.1–0.3', 'cue', 'Absorb, lift the chest, and freeze.'),
      jsonb_build_object('fault', 'Hands touch after landing', 'deduction', '0.5; 1.0 if hands support the whole body', 'cue', 'Keep the chest over the feet.'),
      jsonb_build_object('fault', 'Fall to knees, seat, front, or back after landing', 'deduction', '1.0', 'cue', 'Open on time and finish over the base of support.')
    ),
    'scoring_summary', 'Tumbling execution judges deduct 0.1–0.2 for slight, 0.3–0.4 for substantial, and 0.5 for major element faults. Form/control/height/rhythm may total 0.1–0.5 per element. A routine with too few elements receives a 2.0 penalty; an interruption ends credit for later elements. Difficulty shown here follows the 2025–2029 formula where applicable. The current Code, Guide to Judging, routine sheet, and technical updates control.',
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title', 'Learn ' || d.name, 'purpose', 'learning',
        'description', 'Show prerequisite shapes and drills first, then the skill on a progressive surface with spotting, followed by the compulsory entry and exit. Use side and end-on views; freeze at takeoff/support, peak shape, and landing.'),
      jsonb_build_object('title', d.name || ' — perfect-form model', 'purpose', 'model',
        'description', 'Show full-speed and slow-motion regulation-track examples emphasizing exact body position, amplitude, center-axis travel, preserved rhythm, joined legs, pointed feet, and a controlled finish.')
    ),
    'next_progressions', jsonb_build_array(jsonb_build_object('name', d.next_name, 'slug', d.next_slug)),
    'sources', jsonb_build_array(
      jsonb_build_object('title', 'USA Gymnastics T&T Tumbling Compulsory Routines', 'url', 'https://static.usagym.org/PDFs/T%26T/Rules/devcop/routines_tu25.pdf', 'organization', 'USA Gymnastics', 'effective_cycle', '2025–2029', 'accessed_on', '2026-07-25'),
      jsonb_build_object('title', 'USA Gymnastics T&T Development Code of Points — Tumbling', 'url', 'https://static.usagym.org/PDFs/T%26T/Rules/devcop/tu.pdf', 'organization', 'USA Gymnastics', 'effective_cycle', '2025–2029', 'accessed_on', '2026-07-25'),
      jsonb_build_object('title', 'USA Gymnastics T&T Guide to Judging', 'url', 'https://static.usagym.org/PDFs/T%26T/judges/guide.pdf', 'organization', 'USA Gymnastics', 'effective_cycle', '2025–2029', 'accessed_on', '2026-07-25')
    ),
    'editorial_note', 'Original coaching summary. USA Gymnastics publications and current technical updates take precedence.'
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
  p.name, p.slug, p.description, p.instructions,
  (SELECT id FROM coaching.sport WHERE key = 'gymnastics'),
  CASE
    WHEN p.levels && ARRAY['Tumbling Level 1','Tumbling Levels 1–2'] THEN 'EARLY_STAGE'::public.skill_level
    WHEN p.levels && ARRAY['Tumbling Level 2','Tumbling Levels 2–4'] THEN 'BEGINNER'::public.skill_level
    ELSE 'INTERMEDIATE'::public.skill_level
  END,
  'skill', 'execution', 10,
  'Power tumbling — regulation track and qualified coaching required',
  TRUE, 'facility', p.metadata
FROM prepared p
WHERE (SELECT id FROM public.facility ORDER BY id LIMIT 1) IS NOT NULL
ON CONFLICT (facility_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  skill_level = EXCLUDED.skill_level,
  assistance_note = EXCLUDED.assistance_note,
  official_metadata = EXCLUDED.official_metadata,
  updated_at = now();

-- Exact USA Gymnastics compulsory level membership for existing shared cards.
UPDATE coaching.skill
SET official_metadata = official_metadata || jsonb_build_object(
  'governing_body', 'USA Gymnastics',
  'discipline', 'Trampoline & Tumbling',
  'event', 'Power Tumbling',
  'program', 'Development Program 2025–2029',
  'usa_gymnastics_levels', CASE slug
    WHEN 'round-off' THEN jsonb_build_array('Tumbling Levels 2–7')
    WHEN 'back-handspring' THEN jsonb_build_array('Tumbling Levels 3–7')
    WHEN 'back-tuck' THEN jsonb_build_array('Tumbling Levels 5–7')
    ELSE official_metadata->'usa_gymnastics_levels'
  END,
  'sources', jsonb_build_array(
    jsonb_build_object('title', 'USA Gymnastics T&T Tumbling Compulsory Routines', 'url', 'https://static.usagym.org/PDFs/T%26T/Rules/devcop/routines_tu25.pdf', 'organization', 'USA Gymnastics', 'effective_cycle', '2025–2029'),
    jsonb_build_object('title', 'USA Gymnastics T&T Development Code of Points — Tumbling', 'url', 'https://static.usagym.org/PDFs/T%26T/Rules/devcop/tu.pdf', 'organization', 'USA Gymnastics', 'effective_cycle', '2025–2029')
  )
)
WHERE slug IN ('round-off', 'back-handspring', 'back-tuck');

INSERT INTO coaching.skill_prerequisite (skill_id, prerequisite_skill_id, note)
SELECT child.id, parent.id, 'Power tumbling development progression.'
FROM (
  VALUES
    ('usag-tt-cartwheel-step-in', 'usag-tt-forward-roll-tuck'),
    ('usag-tt-back-roll-pike-push-up', 'usag-tt-backward-roll-tuck'),
    ('usag-tt-hollow-push-up-hold', 'usag-tt-back-roll-pike-push-up'),
    ('usag-tt-handstand-forward-roll', 'handstand'),
    ('usag-tt-step-cartwheel', 'usag-tt-cartwheel-step-in'),
    ('usag-tt-cartwheel', 'usag-tt-step-cartwheel'),
    ('usag-tt-power-hurdle-roundoff', 'usag-tt-cartwheel'),
    ('usag-tt-whipback', 'back-handspring'),
    ('usag-tt-back-somersault-pike', 'back-tuck'),
    ('usag-tt-back-somersault-straight', 'usag-tt-back-somersault-pike')
) AS edge(child_slug, parent_slug)
JOIN coaching.skill child ON child.slug = edge.child_slug
JOIN coaching.skill parent ON parent.slug = edge.parent_slug AND parent.facility_id = child.facility_id
ON CONFLICT DO NOTHING;
