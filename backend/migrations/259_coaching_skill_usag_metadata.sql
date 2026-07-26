-- Structured USA Gymnastics metadata for coach- and athlete-ready skill cards.
-- Narrative fields are original summaries; official publications are linked, not reproduced.

-- Optional USAG catalogs use ELITE for values above the ADVANCED threshold.
-- Add it here, before those catalog migrations run, so fresh migration chains
-- and existing installations share the same controlled level vocabulary.
ALTER TYPE public.skill_level ADD VALUE IF NOT EXISTS 'ELITE';

-- Partner/group skills are structurally different from individual skills and
-- combinations, and later USAG catalogs intentionally classify them as such.
ALTER TABLE coaching.skill
  DROP CONSTRAINT IF EXISTS skill_skill_kind_check;
ALTER TABLE coaching.skill
  ADD CONSTRAINT skill_skill_kind_check
  CHECK (skill_kind IN ('skill', 'combo', 'hold', 'partner'));

ALTER TABLE coaching.skill
  ADD COLUMN IF NOT EXISTS official_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_coaching_skill_official_metadata
  ON coaching.skill USING GIN (official_metadata);

COMMENT ON COLUMN coaching.skill.official_metadata IS
  'Structured governing-body classification, judging, coaching, athlete, media, progression, and source metadata.';

-- Upgrade the existing foundational floor/tumbling cards. These are coaching
-- summaries, not reproductions of USA Gymnastics manuals. Level placement and
-- scoring must be read in the named program/cycle because the same element can
-- be treated differently across disciplines and programs.
UPDATE coaching.skill AS skill
SET official_metadata = catalog.metadata
FROM (
  VALUES
  (
    'handstand',
    jsonb_build_object(
      'governing_body', 'USA Gymnastics',
      'discipline', 'Women''s and Men''s Artistic; Acrobatic; T&T',
      'event', 'Floor / individual element',
      'official_name', 'Handstand',
      'usa_gymnastics_levels', jsonb_build_array('Foundational element; exact competitive use varies by program'),
      'status', 'general-coaching',
      'athlete_cues', jsonb_build_array('Push the floor tall through straight arms.', 'Show one long line from hands through toes.', 'Squeeze legs together and keep eyes between the hands.'),
      'coach_checkpoints', jsonb_build_array('Hands shoulder-width with fingers spread.', 'Elbows extended and shoulders elevated.', 'Ribs contained, pelvis neutral, knees and ankles extended.', 'Controlled entry and return without stepping.'),
      'safety_and_readiness', jsonb_build_array('Demonstrate a weight-bearing lunge and straight-arm support first.', 'Use wall and coach spotting progressions before unsupported attempts.', 'Stop for wrist, elbow, shoulder, neck, or back pain.'),
      'common_faults', jsonb_build_array(
        jsonb_build_object('fault', 'Bent arms or knees', 'deduction', 'Execution fault; size determines deduction', 'cue', 'Push tall and finish the knees.'),
        jsonb_build_object('fault', 'Arched or piked body line', 'deduction', 'Execution/body-shape fault', 'cue', 'Zip ribs to hips and reach toes upward.'),
        jsonb_build_object('fault', 'Steps or loss of balance', 'deduction', 'Landing/control fault', 'cue', 'Finish the line before returning to lunge.')
      ),
      'scoring_summary', 'There is no universal standalone handstand score. Judges apply the active program''s body-shape, support, balance, direction, and landing deductions when the handstand appears in an element or routine.',
      'video_briefs', jsonb_build_array(
        jsonb_build_object('title', 'Learn the stacked handstand', 'purpose', 'learning', 'description', 'Show lunge-to-lever, wall line, spotted kick-up, then independent handstand. Pause at hand support and overlay wrist–shoulder–hip–ankle alignment. Film side and front views.'),
        jsonb_build_object('title', 'Perfect-form reference', 'purpose', 'model', 'description', 'Show a competition-ready handstand in real time and slow motion: quiet hands, locked elbows, elevated shoulders, neutral trunk, joined straight legs, pointed feet, and a controlled return.')
      ),
      'next_progressions', jsonb_build_array(
        jsonb_build_object('name', 'Cartwheel', 'slug', 'cartwheel'),
        jsonb_build_object('name', 'Front Handspring', 'slug', 'front-handspring')
      ),
      'sources', jsonb_build_array(
        jsonb_build_object('title', 'USA Gymnastics Women''s Development Program', 'url', 'https://usagym.org/women/development/', 'organization', 'USA Gymnastics'),
        jsonb_build_object('title', 'USA Gymnastics Men''s Development Program', 'url', 'https://usagym.org/men/development/', 'organization', 'USA Gymnastics')
      ),
      'editorial_note', 'Original coaching summary. Confirm current element credit and deductions in the linked program materials.'
    )
  ),
  (
    'round-off',
    jsonb_build_object(
      'governing_body', 'USA Gymnastics',
      'discipline', 'Artistic Gymnastics; Trampoline & Tumbling',
      'event', 'Floor / Tumbling',
      'official_name', 'Round-off',
      'usa_gymnastics_levels', jsonb_build_array('Appears throughout developmental floor and tumbling progressions; routine placement varies by current cycle'),
      'status', 'general-coaching',
      'athlete_cues', jsonb_build_array('Reach long into the hurdle and lunge.', 'Turn through a straight, tight handstand shape.', 'Snap feet down together and rebound with chest tall.'),
      'coach_checkpoints', jsonb_build_array('Long hurdle without reaching down early.', 'Sequential hand placement on the intended line.', 'Legs join at or before vertical.', 'Fast shoulder block and hollow snap-down.', 'Feet land together, facing the entry direction, ready to connect.'),
      'safety_and_readiness', jsonb_build_array('Consistent cartwheel on both a line and panel mat.', 'Handstand snap-down and rebound with straight arms.', 'Use an open lane and progressive surfaces before adding backward saltos.'),
      'common_faults', jsonb_build_array(
        jsonb_build_object('fault', 'Hands or feet off the intended line', 'deduction', 'Direction/deviation fault', 'cue', 'Place hands and feet on one track.'),
        jsonb_build_object('fault', 'Bent arms or legs / separated legs', 'deduction', 'Execution fault; severity governs value', 'cue', 'Push straight and close the legs by vertical.'),
        jsonb_build_object('fault', 'Deep, low landing with no rebound', 'deduction', 'Posture/amplitude and connection risk', 'cue', 'Snap to tall through the floor.')
      ),
      'scoring_summary', 'Execution judges evaluate body shape, line, direction, support, amplitude, and landing. When used in a connected pass, loss of continuity can also prevent connection or requirement credit under the active code.',
      'video_briefs', jsonb_build_array(
        jsonb_build_object('title', 'Round-off learning sequence', 'purpose', 'learning', 'description', 'Demonstrate cartwheel step-in, quarter-turn cartwheel, handstand snap-down, and full round-off. Use overhead and side views; freeze at hand placement, vertical leg closure, and feet-together rebound.'),
        jsonb_build_object('title', 'Competition model round-off', 'purpose', 'model', 'description', 'Show straight entry, long reach, tight inverted line, aggressive shoulder block, feet meeting before contact, and immediate tall backward-moving rebound with no extra step.')
      ),
      'next_progressions', jsonb_build_array(
        jsonb_build_object('name', 'Round-off Back Handspring', 'slug', 'round-off-back-handspring')
      ),
      'sources', jsonb_build_array(
        jsonb_build_object('title', 'USA Gymnastics T&T Development Program', 'url', 'https://usagym.org/tt/development/', 'organization', 'USA Gymnastics', 'effective_cycle', '2025–2029'),
        jsonb_build_object('title', 'USA Gymnastics T&T Rules & Code of Points', 'url', 'https://usagym.org/tt/rules/', 'organization', 'USA Gymnastics')
      ),
      'editorial_note', 'Original coaching summary. Program-specific element recognition and deductions remain controlled by the current official code.'
    )
  ),
  (
    'back-handspring',
    jsonb_build_object(
      'governing_body', 'USA Gymnastics',
      'discipline', 'Artistic Gymnastics; Trampoline & Tumbling; Acrobatics & Tumbling',
      'event', 'Floor / Tumbling',
      'official_name', 'Back handspring',
      'aliases', jsonb_build_array('Flic-flac', 'Flic'),
      'usa_gymnastics_levels', jsonb_build_array('Program-specific developmental and optional levels'),
      'status', 'general-coaching',
      'athlete_cues', jsonb_build_array('Sit and swing, then jump backward—not upward only.', 'Reach long to the floor with straight arms.', 'Push through the shoulders and snap feet underneath.'),
      'coach_checkpoints', jsonb_build_array('Balanced set with knees tracking over feet.', 'Open shoulder angle before hand contact.', 'Straight elbows and active shoulder block.', 'Tight arch-to-hollow action without head throw.', 'Feet land together with momentum available for connection.'),
      'safety_and_readiness', jsonb_build_array('Requires qualified hands-on spotting and appropriate mats during acquisition.', 'Confirm backward roll, bridge/shoulder flexibility, handstand snap-down, and jump-back mechanics.', 'Do not self-teach or attempt on hard surfaces.'),
      'common_faults', jsonb_build_array(
        jsonb_build_object('fault', 'Bent arms or knees', 'deduction', 'Execution fault; severity governs deduction', 'cue', 'Reach long and finish every joint.'),
        jsonb_build_object('fault', 'Insufficient height/length or shoulder push', 'deduction', 'Amplitude/technique fault', 'cue', 'Drive back, then block tall.'),
        jsonb_build_object('fault', 'Leg separation or staggered landing', 'deduction', 'Execution/landing fault', 'cue', 'Glue legs together through the snap.')
      ),
      'scoring_summary', 'Codes evaluate shape, amplitude, support phase, direction, rhythm, and landing. In series, a pause, extra step, or incomplete element may remove connection, pass, or special-requirement credit in addition to execution deductions.',
      'video_briefs', jsonb_build_array(
        jsonb_build_object('title', 'Back-handspring progression', 'purpose', 'learning', 'description', 'Show seated jump-back, spotted snap to handstand, back handspring over a trainer, and independent skill. Identify set, first flight, hand support/block, second flight, and landing. Include explicit spotter and mat placement.'),
        jsonb_build_object('title', 'Perfect back handspring', 'purpose', 'model', 'description', 'Side and end views show a long accelerating skill with straight arms, open shoulders, joined straight legs, quick block, tight snap-down, aligned feet, and uninterrupted rebound.')
      ),
      'next_progressions', jsonb_build_array(
        jsonb_build_object('name', 'Double Back Handspring', 'slug', 'double-back-handspring'),
        jsonb_build_object('name', 'Round-off Back Handspring', 'slug', 'round-off-back-handspring')
      ),
      'sources', jsonb_build_array(
        jsonb_build_object('title', 'USA Gymnastics T&T Development Program', 'url', 'https://usagym.org/tt/development/', 'organization', 'USA Gymnastics', 'effective_cycle', '2025–2029'),
        jsonb_build_object('title', 'USA Gymnastics Acrobatics & Tumbling Development Program', 'url', 'https://usagym.org/gfa/development/', 'organization', 'USA Gymnastics', 'effective_cycle', '2025–2026')
      ),
      'editorial_note', 'Original coaching summary; not a substitute for current code, professional instruction, or Safe Sport/safety requirements.'
    )
  ),
  (
    'front-handspring',
    jsonb_build_object(
      'governing_body', 'USA Gymnastics',
      'discipline', 'Artistic Gymnastics; Trampoline & Tumbling; Acrobatics & Tumbling',
      'event', 'Floor / Tumbling',
      'official_name', 'Front handspring',
      'usa_gymnastics_levels', jsonb_build_array('Program-specific developmental and optional levels'),
      'status', 'general-coaching',
      'athlete_cues', jsonb_build_array('Hurdle long and punch through the lunge.', 'Kick through a straight-arm handstand.', 'Block the floor away and lift the chest to land.'),
      'coach_checkpoints', jsonb_build_array('Forward speed maintained through hurdle.', 'Hands contact ahead of shoulders without collapsing.', 'Fast heel drive and shoulder block.', 'Visible second flight after hand support.', 'Upright controlled landing or immediate rebound.'),
      'safety_and_readiness', jsonb_build_array('Master handstand, handstand flat-back, front limber shapes, and hurdle mechanics.', 'Use qualified spotting and progressive mats until landing control is repeatable.'),
      'common_faults', jsonb_build_array(
        jsonb_build_object('fault', 'Bent arms / shoulder collapse', 'deduction', 'Support and execution fault', 'cue', 'Push before the hands leave.'),
        jsonb_build_object('fault', 'Low or absent second flight', 'deduction', 'Amplitude fault', 'cue', 'Drive heels, then block tall.'),
        jsonb_build_object('fault', 'Piked hips or low chest on landing', 'deduction', 'Body-shape/posture fault', 'cue', 'Finish hips open and eyes forward.')
      ),
      'scoring_summary', 'Judging focuses on recognizable support and flight phases, straight-body execution, amplitude, direction, and landing. Exact values and deductions depend on the discipline, level, and active code.',
      'video_briefs', jsonb_build_array(
        jsonb_build_object('title', 'Front-handspring learning sequence', 'purpose', 'learning', 'description', 'Show hurdle-lunge, handstand flat-back, handspring to raised landing, and floor execution. Slow motion highlights heel drive, hand contact, shoulder block, and second flight.'),
        jsonb_build_object('title', 'Perfect-form front handspring', 'purpose', 'model', 'description', 'Side view shows uninterrupted forward speed, extended joints, an active block, clear post-hand flight, hips open before landing, feet together, and stable rebound.')
      ),
      'next_progressions', jsonb_build_array(
        jsonb_build_object('name', 'Front Tuck', 'slug', 'front-tuck'),
        jsonb_build_object('name', 'Front Handspring Front Tuck', 'note', 'Connect only after both elements are independently controlled.')
      ),
      'sources', jsonb_build_array(
        jsonb_build_object('title', 'USA Gymnastics T&T Rules & Code of Points', 'url', 'https://usagym.org/tt/rules/', 'organization', 'USA Gymnastics'),
        jsonb_build_object('title', 'USA Gymnastics Women''s Development Program', 'url', 'https://usagym.org/women/development/', 'organization', 'USA Gymnastics')
      ),
      'editorial_note', 'Original coaching summary. Verify recognition and value in the current discipline-specific materials.'
    )
  )
) AS catalog(slug, metadata)
WHERE skill.slug = catalog.slug;
