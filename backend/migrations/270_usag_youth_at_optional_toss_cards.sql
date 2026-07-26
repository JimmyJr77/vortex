-- USA Gymnastics Youth Acrobatics & Tumbling Development Program.
-- Complete 2025-26 optional Toss Table of Elements (Levels 3-5), page 87.
-- Coaching prose is original; the linked Code and current errata control.

WITH source_data (
  ordinal, slug, official_name, direction, start_value, prerequisite_slug, next_slug
) AS (
  VALUES
    (1, 'usag-at-toss-front-tuck-open', 'Front Tuck Open', 'Forward', 9.00, 'usag-at-l3-toss-front-tuck-open', 'usag-at-toss-front-pike-open'),
    (2, 'usag-at-toss-front-pike-open', 'Front Flip Pike Open', 'Forward', 9.30, 'usag-at-toss-front-tuck-open', 'usag-at-toss-front-layout'),
    (3, 'usag-at-toss-front-layout', 'Front Flip Layout', 'Forward', 9.40, 'usag-at-toss-front-pike-open', 'usag-at-toss-kick-front-layout'),
    (4, 'usag-at-toss-kick-front-layout', 'Kick Front Flip Layout', 'Forward', 9.50, 'usag-at-toss-front-layout', 'usag-at-toss-front-pike-open-360'),
    (5, 'usag-at-toss-front-pike-open-360', 'Front Flip Pike Open 360', 'Forward', 9.65, 'usag-at-toss-front-pike-open', 'usag-at-toss-front-layout-360'),
    (6, 'usag-at-toss-front-layout-360', 'Front Flip Layout 360', 'Forward', 9.75, 'usag-at-toss-front-layout', 'usag-at-toss-kick-front-layout-360'),
    (7, 'usag-at-toss-kick-front-layout-360', 'Kick Front Flip Layout 360', 'Forward', 9.85, 'usag-at-toss-kick-front-layout', NULL),
    (8, 'usag-at-toss-straight-ride', 'Straight Ride (Level 3 only)', 'Backward', 7.00, 'usag-at-l2-toss-straight-ride', 'usag-at-toss-back-tuck'),
    (9, 'usag-at-toss-back-tuck', 'Back Salto Tuck', 'Backward', 9.50, 'usag-at-l5-toss-back-tuck', 'usag-at-toss-back-layout'),
    (10, 'usag-at-toss-back-layout', 'Back Salto Layout', 'Backward', 9.65, 'usag-at-toss-back-tuck', 'usag-at-toss-kick-back-layout'),
    (11, 'usag-at-toss-kick-back-layout', 'Kick Back Salto Layout', 'Backward', 9.75, 'usag-at-toss-back-layout', 'usag-at-toss-back-layout-360'),
    (12, 'usag-at-toss-back-layout-360', 'Back Salto Layout 360', 'Backward', 9.90, 'usag-at-toss-back-layout', 'usag-at-toss-kick-back-layout-360'),
    (13, 'usag-at-toss-kick-back-layout-360', 'Kick Back Salto Layout 360', 'Backward', 10.00, 'usag-at-toss-kick-back-layout', NULL),
    (14, 'usag-at-toss-arabian-tuck-open', 'Arabian Flip Tuck Open', 'Arabian', 9.40, 'usag-at-toss-front-tuck-open', 'usag-at-toss-arabian-pike-open'),
    (15, 'usag-at-toss-arabian-pike-open', 'Arabian Flip Pike Open', 'Arabian', 9.45, 'usag-at-toss-arabian-tuck-open', 'usag-at-toss-arabian-layout'),
    (16, 'usag-at-toss-arabian-layout', 'Arabian Flip Layout', 'Arabian', 9.50, 'usag-at-toss-arabian-pike-open', 'usag-at-toss-arabian-tuck-open-360'),
    (17, 'usag-at-toss-arabian-tuck-open-360', 'Arabian Flip Tuck Open 360', 'Arabian', 9.70, 'usag-at-toss-arabian-tuck-open', 'usag-at-toss-arabian-pike-open-360'),
    (18, 'usag-at-toss-arabian-pike-open-360', 'Arabian Flip Pike Open 360', 'Arabian', 9.80, 'usag-at-toss-arabian-pike-open', 'usag-at-toss-arabian-layout-360'),
    (19, 'usag-at-toss-arabian-layout-360', 'Arabian Flip Layout 360', 'Arabian', 9.90, 'usag-at-toss-arabian-layout', NULL)
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics',
    'discipline', 'Acrobatics & Tumbling',
    'event', 'Optional Toss',
    'program', 'Youth Acrobatics & Tumbling Development Program 2025–2026',
    'official_name', d.official_name,
    'usa_gymnastics_levels', CASE
      WHEN d.slug = 'usag-at-toss-straight-ride' THEN jsonb_build_array('Youth A&T Level 3')
      ELSE jsonb_build_array('Youth A&T Level 3', 'Youth A&T Level 4', 'Youth A&T Level 5')
    END,
    'difficulty_value', to_char(d.start_value, 'FM90.00') || ' start value',
    'status', 'verified',
    'last_verified', '2026-07-25',
    'athlete_cues', jsonb_build_array(
      'Bases dip and drive together, release through extended arms, track the top through the declared ' || lower(d.direction) || ' flight, and receive high before absorbing to cradle.',
      CASE
        WHEN d.official_name ILIKE '%layout%' THEN 'Top: rise first, hold one long layout line, complete any kick/twist without breaking shape, then prepare for the catch.'
        WHEN d.official_name ILIKE '%pike%' THEN 'Top: rise, close to a clear pike, open on time, complete any twist, and present a safe catch shape.'
        WHEN d.official_name ILIKE '%tuck%' THEN 'Top: rise, show a compact tuck, open visibly, complete any twist, and present for the catch.'
        ELSE 'Top: stay stretched through the straight ride, show control at peak, and present for the catch.'
      END
    ),
    'coach_checkpoints', jsonb_build_array(
      'Four bases and one top create a centered, vertical release with simultaneous leg/arm drive and no early throw.',
      'Judge recognizable body position, declared direction, height, rotation/twist completion, top posture, base tracking, and a high controlled cradle.',
      'For synchronized Heat 2, both groups must use identical tosses, angle in the same direction, and match release, flight, and catch timing.'
    ),
    'safety_and_readiness', jsonb_build_array(
      'Train only with qualified toss coaches, complete groups, regulation progressions, appropriate mats, and an agreed emergency catch plan.',
      'The top and every base must own the preceding body-position, release, tracking, and cradle drills before adding rotation, kick, or twist.',
      'Do not use a competition start value as a readiness test; regress whenever height, direction, rotation, or catch control is inconsistent.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault', 'Flexed feet', 'deduction', '−0.1 per occurrence', 'cue', 'Finish flight lines through the toes.'),
      jsonb_build_object('fault', 'Bent arms or legs', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Extend the throw, flight, and catch positions.'),
      jsonb_build_object('fault', 'Under/over rotation or insufficient amplitude', 'deduction', 'Up to −0.3 per category per occurrence', 'cue', 'Create height before rotation and open on time.'),
      jsonb_build_object('fault', 'Incorrect body position or insufficient stretch', 'deduction', 'Up to −0.2 per category per occurrence', 'cue', 'Make the declared tuck, pike, layout, kick, and twist unmistakable.'),
      jsonb_build_object('fault', 'Incorrect catch posture', 'deduction', 'Up to −0.2 per occurrence', 'cue', 'Top presents; bases receive high and centered.'),
      jsonb_build_object('fault', 'Improper base catch', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Track together and secure the cradle before absorbing.'),
      jsonb_build_object('fault', 'Deviation from square/straight', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Release and catch on the planned axis.'),
      jsonb_build_object('fault', 'Lack of synchronization', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Match dip, release, peak, opening, and catch.'),
      jsonb_build_object('fault', 'Fall', 'deduction', '−0.5 per occurrence', 'cue', 'Regress until the group can catch reliably.')
    ),
    'scoring_summary', 'Official listed start value: ' || to_char(d.start_value, 'FM90.00') ||
      '. Level 3 and Level 4 optional Toss are capped at 9.40; Level 5 has no difficulty restriction. Heat 2 requires two synchronized identical five-athlete groups. Execution and neutral deductions apply under the current Code.',
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title', 'Teach ' || d.official_name, 'purpose', 'learning',
        'description', 'Show base grips and load position, synchronized dip/drive, straight-ride height drills, the body-position progression, and catch timing. Use front, side, and overhead views before showing the complete toss.'),
      jsonb_build_object('title', d.official_name || ' — ideal competition model', 'purpose', 'model',
        'description', 'Show full speed and synchronized slow motion. Highlight vertical release, peak height, exact body shape and rotation/twist, square flight, top presentation, high catch, and matched groups when synchronized.')
    ),
    'prerequisite_slug', d.prerequisite_slug,
    'next_progressions', CASE WHEN d.next_slug IS NULL THEN '[]'::jsonb ELSE
      jsonb_build_array(jsonb_build_object('name', 'Next official toss progression', 'slug', d.next_slug)) END,
    'sources', jsonb_build_array(jsonb_build_object(
      'title', 'USA Gymnastics Youth Acrobatics & Tumbling Rules & Policies / Code of Points — Toss Table',
      'url', 'https://static.usagym.org/PDFs/gfa/at/25rp_cop.pdf#page=87',
      'organization', 'USA Gymnastics',
      'effective_cycle', '2025–2026',
      'accessed_on', '2026-07-25',
      'note', 'Official optional Toss element name, start value, level restriction, and direction rules.'
    )),
    'editorial_note', 'Original coaching summary; the official Code, tariff declaration, current videos, and errata take precedence.'
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
  'A&T Optional Toss — ' || p.official_name,
  p.slug,
  'An official Youth A&T optional ' || lower(p.direction) || ' toss valued at ' || to_char(p.start_value, 'FM90.00') || '.',
  'From the regulation four-base load, dip and drive as one group, release the top vertically into the declared ' ||
    p.official_name || ', complete the body position and rotation/twist at height, then catch securely in cradle.',
  (SELECT id FROM coaching.sport WHERE key = 'gymnastics'),
  CASE
    WHEN p.start_value <= 9.00 THEN 'INTERMEDIATE'::public.skill_level
    WHEN p.start_value <= 9.50 THEN 'ADVANCED'::public.skill_level
    ELSE 'ELITE'::public.skill_level
  END,
  'partner', 'execution', p.start_value,
  'Five-athlete toss group: four bases and one top',
  TRUE, 'facility', p.metadata
FROM prepared p
ON CONFLICT (facility_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  skill_level = EXCLUDED.skill_level,
  execution_max_score = EXCLUDED.execution_max_score,
  assistance_note = EXCLUDED.assistance_note,
  official_metadata = EXCLUDED.official_metadata,
  updated_at = NOW();
