-- USA Gymnastics Youth A&T Level 1-5 compulsory Pyramid and Toss cards.
-- Completes all compulsory skill-event requirements for the 2025-26 program.

WITH source_data (
  name, slug, level_name, event_name, official_notation, description, instructions,
  athlete_cue, coach_focus, prerequisite_slug, next_name, next_slug, source_page
) AS (
  VALUES
    ('A&T L1 Pyramid — Thighstand with Mid-base', 'usag-at-l1-pyramid-thighstand',
      'Youth A&T Level 1', 'Pyramid', '2.1.0 — primary bases/thighstand; mid-base standing on thighs',
      'Two synchronized groups build a thighstand structure with the mid-base standing on the primary bases’ thighs, arms extended overhead, for a two-second hold.',
      'Primary bases establish matching thigh platforms. Mid-base steps close, rises with front-assist support, aligns vertically with arms overhead, becomes still for two seconds, then dismounts in front without assistance.',
      'Stand tall on the thighs, reach overhead, freeze for two, and step down in front.',
      'Eight athletes total across two groups; front assist moves to the right side after support; structure is square, hold is two full seconds, and front dismount is unassisted.',
      NULL, 'Level 2 front-support pyramid', 'usag-at-l2-pyramid-front-support', 36),
    ('A&T L1 Toss — Balance to Cradle Pop', 'usag-at-l1-toss-balance-cradle-pop',
      'Youth A&T Level 1', 'Toss', '4-4 FC GRD-BLW SHD VER-VER → BLW SHD-CRDL VER-HOZ → 4-4 R CRDL-CRDL',
      'Two synchronized five-athlete groups load the top to a supported balance, transition through tuck into cradle, pop and recatch in cradle, then dismount in front.',
      'Two side, one back, and one front base create the load. Top stands to balance, bends to a braced tuck, lays back into the prepared cradle, stays horizontal during the controlled pop, and waits for the recatch.',
      'Balance first, tuck with the bases, lie back long, ride the pop, and wait for cradle.',
      'Correct four-base roles, supported balance below shoulder, clear cradle shape, visible release and same-group recatch, horizontal top, synchronized groups, and safe front dismount.',
      NULL, 'Level 2 straight ride toss', 'usag-at-l2-toss-straight-ride', 36),

    ('A&T L2 Pyramid — Unassisted Front-support Hold', 'usag-at-l2-pyramid-front-support',
      'Youth A&T Level 2', 'Pyramid', '3.1.1 — front support at peak; 2-second unassisted hold',
      'A thighstand structure receives a top from a separate prep structure into straight-body front support for a two-second unassisted hold.',
      'Build both structures before transfer. Side bases lift the top from prep to the mid-base’s extended overhead support; back base assists the entry, then all assistance leaves the top for the full two-second “I” hold before return to prep and sponge dismount.',
      'Stay straight over the support, push tall, and freeze without help for two.',
      'Eight athletes, two structures, straight “I” front support, assistance removed for complete hold, legal return to prep, sponge dismount, and front dismount of structure one.',
      'usag-at-l1-pyramid-thighstand', 'Level 3 front-support pyramid with half-down', 'usag-at-l3-pyramid-front-support-half-down', 44),
    ('A&T L2 Toss — Straight Ride to Cradle', 'usag-at-l2-toss-straight-ride',
      'Youth A&T Level 2', 'Toss', 'Four-base straight ride toss to cradle',
      'Two synchronized five-athlete groups perform a straight ride toss from the load to cradle catch and front ground dismount.',
      'Back base controls the top’s load while side and front bases set the platform. All four bases dip and extend together; top stands tall through release, maintains a straight vertical ride, then transitions to horizontal cradle for a high coordinated catch.',
      'Stand through the toss, ride tall, then open to cradle and wait.',
      'Two side/one front/one back base, vertical straight ride with amplitude, no early pike, horizontal cradle before catch, secure synchronized catch, and controlled front dismount.',
      'usag-at-l1-toss-balance-cradle-pop', 'Level 3 front tuck open toss', 'usag-at-l3-toss-front-tuck-open', 45),

    ('A&T L3 Pyramid — Front Support with Half-down', 'usag-at-l3-pyramid-front-support-half-down',
      'Youth A&T Level 3', 'Pyramid', '2.1.1; shoulder-level entry to straight “I” front support; 180° descent',
      'A seven-athlete thighstand pyramid receives the top from a shoulder stand into an unassisted straight front-support hold, then two catchers lower the top with a half twist.',
      'Build the thighstand/mid-base structure and the rear shoulder stand. Top takes the mid-base’s hands, rises to peak front support, shows two seconds without assistance, then descends with two catchers through exactly 180° to vertical feet.',
      'Push straight at the peak, freeze for two, then turn one half to the catchers.',
      'One tosser/two catchers, shoulder-level entry, straight-body “I” hold for two seconds, assistance absent during hold, controlled half-down, and distinct ground finish.',
      'usag-at-l2-pyramid-front-support', 'Level 4 half-up/front-support pyramid', 'usag-at-l4-pyramid-half-up-front-support', 53),
    ('A&T L3 Toss — Front Tuck Open 270°', 'usag-at-l3-toss-front-tuck-open',
      'Youth A&T Level 3', 'Toss', '270° front tuck open toss to cradle',
      'Two synchronized four-base groups toss a left-facing top through 270° of forward tuck rotation, opening to a cradle catch.',
      'Load evenly with two side, one front, and one back base. Top drives vertically, closes to an efficient front tuck, completes the prescribed rotation, then opens early enough to show the horizontal catch shape.',
      'Ride up, tuck forward, open before the cradle, and wait for the catch.',
      'Top faces left, four correct base roles, vertical amplitude, 270° forward rotation, recognizable tuck and open, secure horizontal cradle, and matched groups.',
      'usag-at-l2-toss-straight-ride', 'Level 4 front layout open toss', 'usag-at-l4-toss-front-layout', 53),

    ('A&T L4 Pyramid — Half-up Front-support Pyramid', 'usag-at-l4-pyramid-half-up-front-support',
      'Youth A&T Level 4', 'Pyramid', '2-1-1 GRD-PK; VER-HSUP “I”; TWIST 180 entry and exit',
      'Two tossers place the top from ground to the peak thighstand structure with a 180° twist into straight front support; two catchers return the top with a 180° descent.',
      'Set the thighstand and overhead mid-base platform first. Tossers drive the top through a controlled half-up to the “I” support, establish the required hold, then catchers coordinate the half-twist descent to vertical ground.',
      'Half turn up to one straight line, hold, then half turn down to feet.',
      'Seven athletes, two tossers/two catchers, correct 180° entry and exit, peak straight support, square structure, legal support/catch, and synchronized timing.',
      'usag-at-l3-pyramid-front-support-half-down', 'Level 5 half-up straddle pyramid', 'usag-at-l5-pyramid-half-up-straddle', 61),
    ('A&T L4 Toss — Front Layout Open 270°', 'usag-at-l4-toss-front-layout',
      'Youth A&T Level 4', 'Toss', '270° front layout toss to cradle',
      'Two synchronized four-base groups toss a left-facing top through 270° of forward rotation in layout to cradle catch.',
      'Create vertical lift before forward turnover. Top holds a stretched straight/hollow body through the rotation, avoids a tuck or early pike, then prepares the horizontal cradle shape as bases meet the catch high.',
      'Ride tall, hold one long layout, then shape for cradle.',
      'Top faces left, four-base load, 270° forward rotation, sustained layout with hip rise, adequate amplitude, horizontal cradle, and synchronized secure catch.',
      'usag-at-l3-toss-front-tuck-open', 'Level 5 back tuck 450° toss', 'usag-at-l5-toss-back-tuck', 61),

    ('A&T L5 Pyramid — Half-up Straddle Pyramid', 'usag-at-l5-pyramid-half-up-straddle',
      'Youth A&T Level 5', 'Pyramid', '2-1-1 GRD-PK; VER-HSUP “S”; TWIST 180 entry and exit',
      'A tosser places the top from ground to the peak thighstand pyramid with a 180° twist into straddle hand support; two catchers lower the top with a half twist.',
      'Build the seven-athlete structure and overhead platform. Tosser directs the half-up to a clear extended “S” straddle support; top pushes and extends the legs, then descends through the prescribed half turn to two catchers.',
      'Half turn up, push a wide straddle at peak, then half turn down to feet.',
      'One tosser/two catchers, exact 180° entry and exit, clear straddle hand support, straight knees/toes, stable peak structure, and controlled ground landing.',
      'usag-at-l4-pyramid-half-up-front-support', 'Optional Level 5 pyramid tariffs', NULL, 69),
    ('A&T L5 Toss — Back Tuck 450°', 'usag-at-l5-toss-back-tuck',
      'Youth A&T Level 5', 'Toss', '450° back tuck salto toss to cradle',
      'Two synchronized four-base groups toss a front-facing top through 450° of backward tucked rotation to cradle catch.',
      'Load with two side, one front, and one back base. Drive the top vertically, allow lift before the top closes to tuck, track the 450° backward rotation, and catch the opened horizontal top high and close.',
      'Ride up, tuck backward, open to the front, and wait for cradle.',
      'Top faces front, four correct base roles, vertical amplitude, compact back tuck, complete 450°, timely opening, horizontal cradle, and synchronized secure catch.',
      'usag-at-l4-toss-front-layout', 'Optional Level 5 toss tariffs', NULL, 69)
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics',
    'discipline', 'Acrobatics & Tumbling',
    'event', 'Compulsory ' || d.event_name,
    'program', 'Youth Acrobatics & Tumbling Development Program 2025–2026',
    'official_name', d.name,
    'element_code', d.official_notation,
    'usa_gymnastics_levels', jsonb_build_array(d.level_name),
    'status', 'verified',
    'last_verified', '2026-07-25',
    'athlete_cues', jsonb_build_array(d.athlete_cue, 'Use the shared count and protect every load, release, hold, and catch.'),
    'coach_checkpoints', jsonb_build_array(d.coach_focus, 'Check official athlete count, group spacing, direction, and identical synchronization before scoring execution.'),
    'safety_and_readiness', jsonb_build_array(
      'Use qualified A&T coaches, approved competition-equivalent surfaces, and trained spotters.',
      'Rehearse every role, grip, emergency catch, and descent at reduced height before full release.',
      'Do not combine height, rotation, and synchronization until each is independently reliable.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault', 'Bent arms or legs', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Finish every support and flight line.'),
      jsonb_build_object('fault', 'Leg/foot separation', 'deduction', 'Up to −0.2 per occurrence', 'cue', 'Join legs unless the required shape is split/straddle.'),
      jsonb_build_object('fault', 'Under/over rotation or insufficient amplitude', 'deduction', 'Up to −0.3 per occurrence for each category', 'cue', 'Drive vertically and finish rotation before catch.'),
      jsonb_build_object('fault', 'Incorrect body position or insufficient extension', 'deduction', 'Up to −0.2 per occurrence for each category', 'cue', 'Make the coded shape unmistakable.'),
      jsonb_build_object('fault', 'Failure to maintain required two-second hold', 'deduction', 'Up to −0.2 per occurrence', 'cue', 'Become still before counting.'),
      jsonb_build_object('fault', 'Improper base catch or deviation', 'deduction', 'Up to −0.3 per occurrence for each category', 'cue', 'Catch high, close, square, and together.'),
      jsonb_build_object('fault', 'Lack of synchronization', 'deduction', 'Up to −0.3 per occurrence per heat', 'cue', 'Match every dip, release, hold, and catch.'),
      jsonb_build_object('fault', 'Fall', 'deduction', '−0.5 per occurrence', 'cue', 'Protect the top and complete a controlled catch.')
    ),
    'scoring_summary', 'Each compulsory Pyramid or Toss heat starts from 10.0. Complete omission of a special requirement is −2.0; partial completion is −1.0. Wrong mandatory spacing/direction is −0.50, additional spotting contact is −1.0, and incorrect athlete count is −0.20 per occurrence (or void where specified). Execution deductions apply per occurrence; a fall is −0.5. Official Code and errata control.',
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title', 'Teach ' || d.name, 'purpose', 'learning',
        'description', 'Name every role and demonstrate grips, platform/catch position, and emergency procedures. Progress from static shapes to assisted load, reduced-height release or transfer, full element, then synchronized second group. Annotate the official count.'),
      jsonb_build_object('title', d.name || ' — perfect synchronized model', 'purpose', 'model',
        'description', 'Show front, side, and overhead views at full speed and slow motion. Highlight identical formations, vertical drive, coded body position/rotation, required hold, high close catch, safe descent, and matching timing.')
    ),
    'next_progressions', jsonb_build_array(jsonb_build_object('name', d.next_name, 'slug', d.next_slug)),
    'sources', jsonb_build_array(jsonb_build_object(
      'title', 'USA Gymnastics Youth Acrobatics & Tumbling Rules & Policies / Code of Points',
      'url', 'https://static.usagym.org/PDFs/gfa/at/25rp_cop.pdf#page=' || d.source_page,
      'organization', 'USA Gymnastics',
      'effective_cycle', '2025–2026',
      'accessed_on', '2026-07-25',
      'note', 'Compulsory Pyramid/Toss requirement and deductions.'
    )),
    'editorial_note', 'Original coaching summary. Official Code, compulsory video/count sheet, and current errata take precedence.'
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
    WHEN p.level_name = 'Youth A&T Level 1' THEN 'EARLY_STAGE'::public.skill_level
    WHEN p.level_name IN ('Youth A&T Level 2', 'Youth A&T Level 3') THEN 'INTERMEDIATE'::public.skill_level
    ELSE 'ADVANCED'::public.skill_level
  END,
  'skill', 'execution', 10,
  'Loaded group element — qualified A&T coaching required',
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

INSERT INTO coaching.skill_prerequisite (skill_id, prerequisite_skill_id, note)
SELECT child.id, parent.id, 'Direct preceding compulsory Pyramid/Toss level progression.'
FROM (
  VALUES
    ('usag-at-l2-pyramid-front-support', 'usag-at-l1-pyramid-thighstand'),
    ('usag-at-l3-pyramid-front-support-half-down', 'usag-at-l2-pyramid-front-support'),
    ('usag-at-l4-pyramid-half-up-front-support', 'usag-at-l3-pyramid-front-support-half-down'),
    ('usag-at-l5-pyramid-half-up-straddle', 'usag-at-l4-pyramid-half-up-front-support'),
    ('usag-at-l2-toss-straight-ride', 'usag-at-l1-toss-balance-cradle-pop'),
    ('usag-at-l3-toss-front-tuck-open', 'usag-at-l2-toss-straight-ride'),
    ('usag-at-l4-toss-front-layout', 'usag-at-l3-toss-front-tuck-open'),
    ('usag-at-l5-toss-back-tuck', 'usag-at-l4-toss-front-layout')
) AS edge(child_slug, parent_slug)
JOIN coaching.skill child ON child.slug = edge.child_slug
JOIN coaching.skill parent ON parent.slug = edge.parent_slug AND parent.facility_id = child.facility_id
ON CONFLICT DO NOTHING;
