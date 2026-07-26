-- USA Gymnastics Acrobatic Development Program compulsory skill-card batch.
-- Coverage: recurring named pair/group and individual elements in Levels 2-5.
-- Text is an original coaching summary. The linked official Code controls.

WITH source_data (
  name, slug, description, instructions, levels, category, hold_seconds,
  athlete_cue, coach_focus, prerequisite_slug, next_name, next_slug, source_page
) AS (
  VALUES
    ('Acro Straddle on Thighs', 'usag-acro-straddle-on-thighs',
      'A top shows a wide straddle supported above a kneeling base''s thighs.',
      'Build the base position first, enter with continuous partner contact, lengthen both knees, and establish a still, centered shape before the official hold count begins.',
      ARRAY['Level 2 Pair','Level 4 Pair'], 'balance', 3,
      'Sit tall through the hips; stretch both legs and toes away.',
      'Center the top over the base, support under the legs, and make the beginning and end of the three-second hold unmistakable.',
      NULL, 'Supported handstand on floor', 'usag-acro-supported-handstand-floor', 12),
    ('Acro Mountain on Table', 'usag-acro-mountain-on-table',
      'A top steps onto the thighs of a base holding a stable table shape and finishes in a straight-legged mountain.',
      'Stabilize the base''s shoulders, trunk, and knees before the top transfers weight. The top steps one foot at a time, keeps pressure through the partner connection, and reaches a balanced vertical finish.',
      ARRAY['Level 2 Pair'], 'balance', 3,
      'Step softly, stand tall, and keep pressure even through both feet.',
      'Do not let the base''s table collapse or rotate; verify straight top legs and a controlled three-second position.',
      NULL, 'Stand on shoulders', 'usag-acro-stand-on-shoulders', 12),
    ('Acro Toe Pitch on Knees — Straight Jump', 'usag-acro-toe-pitch-knees-straight-jump',
      'From a kneeling toe-pitch grip, the partners coordinate a straight jump by the top to the floor with landing support.',
      'Set the foot and shoulder contacts before loading. Top and base bend together, extend on the same count, keep the top''s body long, and continue assistance through a balanced two-foot landing.',
      ARRAY['Level 2 Pair','Level 3 Pair','Level 3 Group'], 'dynamic', NULL,
      'Push through the loaded foot, stay long in the air, and show a quiet landing.',
      'Match the dip and drive, create visible flight, keep the top vertical, and support rather than pull the landing.',
      NULL, 'Toe pitch straight jump', 'usag-acro-toe-pitch-straight-jump', 12),
    ('Acro Straight Jump off Thighs', 'usag-acro-straight-jump-off-thighs',
      'A top stands on a kneeling base''s thighs and performs an assisted straight jump to the floor.',
      'Confirm the top is balanced before the dip. Partners move together, the top finishes full extension in flight, and the base maintains safe assistance through landing without interrupting the top''s straight line.',
      ARRAY['Level 2 Pair'], 'dynamic', NULL,
      'Stand first, jump tall, and land with feet together.',
      'Require control before takeoff, visible flight, straight body alignment, and a supported stable landing.',
      'usag-acro-straddle-on-thighs', 'Toe pitch straight jump', 'usag-acro-toe-pitch-straight-jump', 12),
    ('Acro Plank Pyramid', 'usag-acro-plank-pyramid',
      'The top is lifted to a straight front-support shape while bases provide the prescribed leg and knee supports.',
      'Set base positions symmetrically, transfer the top as one unit, and finish with shoulders, hips, knees, and ankles in one line. Begin counting only after motion has stopped.',
      ARRAY['Level 2 Group','Level 3 Pair','Level 4 Pair'], 'balance', 3,
      'Push the shoulders tall and squeeze one straight line.',
      'Check legal support locations, level shoulders and hips, extended knees, and a clearly stationary three-second hold.',
      NULL, 'Supported handstand on floor', 'usag-acro-supported-handstand-floor', 13),
    ('Acro T-Lift', 'usag-acro-t-lift',
      'Partners lift a top held beneath the upper arms while the top maintains a T-shaped body and arm position; there is no release.',
      'Agree on the dip count, keep the top''s trunk braced, lift vertically without swinging, and return through the same path to a displayed landing position.',
      ARRAY['Level 2 Group','Level 3 Pair'], 'dynamic', NULL,
      'Stay braced like a letter T and rise straight up.',
      'Hands remain at the required upper-arm area, partners extend together, no release occurs, and the landing shape is shown.',
      NULL, 'T-boost with release and recatch', 'usag-acro-t-boost', 13),
    ('Acro Column Pyramid with Rear Scale', 'usag-acro-column-pyramid-rear-scale',
      'A kneeling base and standing middle form a column while the top completes a rear scale using the prescribed partner support.',
      'Build from the floor upward. Lock the base position, center the middle over the thighs, then place the top and extend the scale without shifting the column.',
      ARRAY['Level 2 Group'], 'balance', 3,
      'Lift the chest and reach the back leg long without tipping the column.',
      'Confirm each level is vertically organized, contacts match the compulsory description, and the rear scale is still for three seconds.',
      NULL, 'Three-person column pyramid', 'usag-acro-three-person-column', 13),
    ('Acro Supported Handstand on Floor', 'usag-acro-supported-handstand-floor',
      'The top jumps or presses to a floor handstand while a kneeling base supports at the waist or legs.',
      'Place the top''s hands first, coordinate the leg drive or press, and use only the permitted waist/leg support. Establish straight arms and a controlled inverted line before counting.',
      ARRAY['Level 3 Pair','Level 4 Pair'], 'balance', 3,
      'Push the floor away and stack shoulders, hips, and toes.',
      'Support only at the allowed area; look for locked elbows, elevated shoulders, vertical control, and a distinct three-second hold.',
      'handstand', 'Handstand on base thighs', 'usag-acro-handstand-on-thighs', 14),
    ('Acro Stand on Shoulders', 'usag-acro-stand-on-shoulders',
      'A top climbs with assistance to stand on a kneeling base''s shoulders, shows control, and returns to the floor with maintained hand contact.',
      'Use an agreed climb pathway and hand grip. The base stays tall through the torso while the top places each foot securely, stands without rushing, then dismounts in front under control.',
      ARRAY['Level 3 Pair','Level 4 Pair','Level 5 Pair'], 'balance', NULL,
      'Step close to the base, stand over the middle, and keep the hand grip.',
      'Watch foot placement, base posture, centered top alignment, continuous required contact, and a controlled front dismount.',
      'usag-acro-mountain-on-table', 'Low foot-to-hand stand', 'usag-acro-low-foot-to-hand', 14),
    ('Acro Handstand Pyramid', 'usag-acro-handstand-pyramid',
      'A top reaches handstand on a kneeling base''s thighs with additional leg support from a middle partner.',
      'Build the base and middle positions before inversion. The top cartwheels or jumps to hand support, closes to a straight handstand, and becomes still while both partners maintain legal support.',
      ARRAY['Level 3 Group'], 'balance', 3,
      'Reach long, close the legs, and push tall between both partners.',
      'Verify legal support at waist/legs, straight elbows and knees, centered weight, synchronized stabilization, and a full three-second hold.',
      'usag-acro-supported-handstand-floor', 'Handstand on thighs to supported straddle', 'usag-acro-handstand-to-supported-straddle', 15),
    ('Acro Shoulder Stand', 'usag-acro-shoulder-stand',
      'A top climbs to stand on the shoulders of a base who is upright on one or both knees, then returns to a floor landing.',
      'The base establishes a tall kneeling platform before the top climbs. Partners maintain the agreed grip, show a centered position without the base sitting on heels, and coordinate the descent.',
      ARRAY['Level 4 Pair','Level 5 Pair'], 'balance', NULL,
      'Stand through both feet and keep your body over the base.',
      'Base remains lifted off the heels, top weight is centered, the position is controlled, and the dismount finishes in landing posture.',
      'usag-acro-stand-on-shoulders', 'Standing shoulder platform dismount', 'usag-acro-shoulder-platform-dismount', 16),
    ('Acro T-Boost', 'usag-acro-t-boost',
      'Partners coordinate a vertical boost in which the base releases and then recatches the top at the upper arms before landing.',
      'Develop the no-release T-lift first. Use matching bend and extension, release only after vertical lift is established, keep the top braced, and recatch high enough to guide a stable landing.',
      ARRAY['Level 4 Pair'], 'dynamic', NULL,
      'Jump straight up, hold the T shape, and wait for the recatch.',
      'Look for synchronized takeoff, genuine but controlled release, consistent body shape, secure recatch, and no travel on landing.',
      'usag-acro-t-lift', 'Boost straight jump', 'usag-acro-boost-straight-jump', 16),
    ('Acro Toe Pitch Straight Jump', 'usag-acro-toe-pitch-straight-jump',
      'A standing or rising base pitches a top from one loaded foot into a straight-body jump and assists the landing.',
      'Align the loaded foot and shoulder contacts, use a shared dip, and extend through legs and arms in sequence. The top finishes a long body line before descending to a supported two-foot landing.',
      ARRAY['Level 4 Pair','Level 5 Pair'], 'dynamic', NULL,
      'Drive through the foot, finish tall, and spot the landing.',
      'Check grip and foot placement, simultaneous drive, adequate flight, no pike or arch, and controlled landing assistance.',
      'usag-acro-toe-pitch-knees-straight-jump', 'Toe pitch to low foot-to-hand', 'usag-acro-toe-pitch-low-foot-to-hand', 16),
    ('Acro Handstand on Base Thighs', 'usag-acro-handstand-on-thighs',
      'A top cartwheels or jumps to handstand on the thighs of a kneeling base and is supported in the inverted hold.',
      'The base presents stable thighs and active arms. The top reaches to the target, passes through an aligned handstand, joins and extends the legs, then holds without the base chasing the balance.',
      ARRAY['Level 5 Women''s Pair','Level 5 Men''s Pair','Level 5 Mixed Pair'], 'balance', 3,
      'Place the hands, push tall, and finish one straight upside-down line.',
      'Require stable base posture, accurate hand contact, permitted support, straight joints, and a stationary three-second hold.',
      'usag-acro-supported-handstand-floor', 'Handstand to supported straddle', 'usag-acro-handstand-to-supported-straddle', 20),
    ('Acro Handstand to Supported Straddle', 'usag-acro-handstand-to-supported-straddle',
      'From a supported handstand on the base''s thighs, the top lowers by press action into a supported straddle hold.',
      'First establish the credited handstand. The top controls shoulder lean and hip compression while the base follows the center of mass, then both partners stop in a wide, extended straddle.',
      ARRAY['Level 5 Women''s Pair','Level 5 Mixed Pair'], 'balance', 3,
      'Press slowly, keep the legs straight, and stop the straddle before the count.',
      'See a controlled transition rather than a drop, continuous legal support, extended knees/toes, even straddle, and a three-second finish.',
      'usag-acro-handstand-on-thighs', 'Low handstand partner balance', 'usag-acro-low-handstand-balance', 20),
    ('Acro Fish or Wrap Lift', 'usag-acro-fish-wrap-lift',
      'A base lifts a jumping top from under-arm contact into a fish or wrap position without release.',
      'Rehearse the receiving shape on the floor. Partners dip together, the top jumps into the selected compact position, and the base absorbs and stabilizes the load without throwing or releasing.',
      ARRAY['Level 5 Women''s Pair','Level 5 Mixed Pair'], 'dynamic', NULL,
      'Jump to the shape and stay connected to the base.',
      'Confirm no release, safe under-arm contact, coordinated lift, recognizable fish/wrap shape, and a controlled return.',
      'usag-acro-t-lift', 'Forearm catch', 'usag-acro-forearm-catch', 20),
    ('Acro Low Foot-to-Hand Stand', 'usag-acro-low-foot-to-hand',
      'With the base lying in a low bent-arm position, the top steps into the base''s hands and holds a balanced stand.',
      'Set wrist, elbow, and shoulder alignment before loading. The top steps close to the base''s center, transfers weight gradually, and stands through both feet while partners use a consistent hand connection.',
      ARRAY['Level 5 Men''s Pair','Level 5 Mixed Pair'], 'balance', 3,
      'Step over the base, press evenly through both feet, and stand tall.',
      'Check base elbows remain controlled, feet are centered in the hands, top posture is vertical, and the balance is still for three seconds.',
      'usag-acro-stand-on-shoulders', 'Low foot-to-hand with straight-jump dismount', 'usag-acro-low-foot-to-hand-dismount', 21),
    ('Acro Basket Stand', 'usag-acro-basket-stand',
      'A top climbs to stand hands-free on the basket formed by the bases, who then show a controlled bend and return.',
      'Build and test the basket grip at low height. The top climbs through the center, distributes weight evenly, releases hand support only after balance is secure, and stays organized as the bases bend and extend.',
      ARRAY['Level 3 Group','Level 5 Group'], 'balance', NULL,
      'Stand over the basket, squeeze tall, and move with the bases.',
      'Verify secure basket construction, controlled climb, hands-free top balance, synchronized base bend/return, and a safe descent.',
      'usag-acro-plank-pyramid', 'Basket straight jump or salto', 'usag-acro-basket-dynamic', 15)
),
prepared AS (
  SELECT
    d.*,
    jsonb_build_object(
      'governing_body', 'USA Gymnastics',
      'discipline', 'Acrobatic Gymnastics',
      'event', 'Combined exercise — ' || CASE WHEN d.category = 'balance' THEN 'balance' ELSE 'dynamic' END || ' element',
      'program', 'Development Program 2025–2028',
      'official_name', d.name,
      'usa_gymnastics_levels', to_jsonb(d.levels),
      'status', 'verified',
      'last_verified', '2026-07-25',
      'athlete_cues', jsonb_build_array(d.athlete_cue, 'Listen for the shared count and finish in control.'),
      'coach_checkpoints', jsonb_build_array(d.coach_focus, 'Verify grips, support locations, entry, finish, and hold duration against the current official text.'),
      'safety_and_readiness', jsonb_build_array(
        'Teach only with a qualified acrobatic gymnastics coach, progressive surfaces, and active spotters.',
        'Partners must demonstrate the required individual shapes, strength, and communication before loading the full element.',
        'Stop immediately for lost grip, unsafe alignment, pain, or an unplanned fall.'
      ),
      'common_faults', jsonb_build_array(
        jsonb_build_object('fault', 'Required row or element not completed', 'deduction', '−1.0 Special Requirement', 'cue', 'Make the prescribed element and finish unmistakable.'),
        jsonb_build_object('fault', CASE WHEN d.category = 'balance' THEN 'Static hold finishes early' ELSE 'Insufficient or unclear flight' END,
          'deduction', CASE WHEN d.category = 'balance' THEN '−0.3 for each second short; incomplete static element: −0.9 and no difficulty value' ELSE 'Amplitude execution deductions; minimal flight is required for credit' END,
          'cue', CASE WHEN d.category = 'balance' THEN 'Become still before the count starts.' ELSE 'Finish the shared drive and show flight.' END),
        jsonb_build_object('fault', 'Fall to or on the floor/partner without a controlled landing', 'deduction', '−1.0 fall', 'cue', 'Protect the catch and finish on the feet in control.'),
        jsonb_build_object('fault', 'Bent joints, poor body shape, instability, or inaccurate partner position', 'deduction', 'Execution deductions; individual element deductions may total up to −1.0 per athlete', 'cue', 'Finish shapes and organize every partner before the count.')
      ),
      'scoring_summary', 'For Levels 2–5, every prescribed row is required; a missing row receives a −1.0 Special Requirement penalty. Execution judges evaluate each partner''s form, stability, amplitude, and landing. Static pair/group timing faults are −0.3 per second short; an uncompleted static element receives −0.9 and no difficulty value. A fall is −1.0. The current official Code and any technical updates control.',
      'video_briefs', jsonb_build_array(
        jsonb_build_object('title', 'Learn ' || d.name, 'purpose', 'learning',
          'description', 'Open with partner roles, legal grips, support locations, and spotter positions. Show the shape unloaded, then low assisted entry, full entry, required hold or flight, and controlled exit. Freeze at each load transfer and annotate the shared count.'),
        jsonb_build_object('title', d.name || ' — competition model', 'purpose', 'model',
          'description', 'Show front and side views at full speed and slow motion. Highlight simultaneous partner timing, exact compulsory positions, extended lines, still balance or visible flight, secure catch, and a controlled finish.')
      ),
      'next_progressions', jsonb_build_array(jsonb_build_object('name', d.next_name, 'slug', d.next_slug)),
      'sources', jsonb_build_array(jsonb_build_object(
        'title', 'USA Gymnastics Acrobatic Gymnastics Development Program Code of Points',
        'url', 'https://static.usagym.org/PDFs/Acro/Rules/devcop_2528.pdf#page=' || d.source_page,
        'organization', 'USA Gymnastics',
        'effective_cycle', '2025–2028',
        'accessed_on', '2026-07-25',
        'note', 'Compulsory element text and Level 2–5 scoring rules.'
      )),
      'editorial_note', 'Original coaching summary based on the linked official publication; the official text and current updates take precedence.'
    ) AS metadata
  FROM source_data d
)
INSERT INTO coaching.skill (
  facility_id, name, slug, description, instructions, sport_id, skill_level,
  skill_kind, evaluation_mode, min_hold_seconds, default_hold_seconds,
  execution_max_score, assistance_note, is_published, visibility, official_metadata
)
SELECT
  (SELECT id FROM public.facility ORDER BY id LIMIT 1),
  p.name, p.slug, p.description, p.instructions,
  (SELECT id FROM coaching.sport WHERE key = 'gymnastics'),
  CASE
    WHEN p.levels && ARRAY['Level 2 Pair','Level 2 Group'] THEN 'EARLY_STAGE'::public.skill_level
    WHEN p.levels && ARRAY['Level 3 Pair','Level 3 Group'] THEN 'BEGINNER'::public.skill_level
    ELSE 'INTERMEDIATE'::public.skill_level
  END,
  'skill', 'execution', p.hold_seconds, p.hold_seconds, 10,
  'Partner element — qualified coaching and spotting required',
  TRUE, 'facility', p.metadata
FROM prepared p
WHERE (SELECT id FROM public.facility ORDER BY id LIMIT 1) IS NOT NULL
ON CONFLICT (facility_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  skill_level = EXCLUDED.skill_level,
  min_hold_seconds = EXCLUDED.min_hold_seconds,
  default_hold_seconds = EXCLUDED.default_hold_seconds,
  assistance_note = EXCLUDED.assistance_note,
  official_metadata = EXCLUDED.official_metadata,
  updated_at = now();

-- Development edges for this batch. Missing future targets are intentionally
-- represented in next_progressions metadata until their catalog batch lands.
INSERT INTO coaching.skill_prerequisite (skill_id, prerequisite_skill_id, note)
SELECT child.id, parent.id, 'USA Gymnastics card development progression.'
FROM (
  VALUES
    ('usag-acro-straight-jump-off-thighs', 'usag-acro-straddle-on-thighs'),
    ('usag-acro-t-boost', 'usag-acro-t-lift'),
    ('usag-acro-toe-pitch-straight-jump', 'usag-acro-toe-pitch-knees-straight-jump'),
    ('usag-acro-handstand-pyramid', 'usag-acro-supported-handstand-floor'),
    ('usag-acro-handstand-on-thighs', 'usag-acro-supported-handstand-floor'),
    ('usag-acro-handstand-to-supported-straddle', 'usag-acro-handstand-on-thighs'),
    ('usag-acro-fish-wrap-lift', 'usag-acro-t-lift'),
    ('usag-acro-low-foot-to-hand', 'usag-acro-stand-on-shoulders'),
    ('usag-acro-basket-stand', 'usag-acro-plank-pyramid')
) AS edge(child_slug, parent_slug)
JOIN coaching.skill child ON child.slug = edge.child_slug
JOIN coaching.skill parent
  ON parent.slug = edge.parent_slug
 AND parent.facility_id = child.facility_id
ON CONFLICT DO NOTHING;
