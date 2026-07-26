-- USA Gymnastics Youth Acrobatics & Tumbling: every compulsory Acro element
-- in Levels 1 and 2 (13 cards). Original coaching summaries; official Code controls.

WITH source_data (
  name, slug, level_name, step_number, official_notation, description, instructions,
  athlete_cue, coach_focus, prerequisite_slug, next_name, next_slug, source_page
) AS (
  VALUES
    ('A&T L1 Acro 1 — Assisted Straddle Inversion', 'usag-at-l1-acro-1-assisted-straddle-inversion',
      'Youth A&T Level 1', 1, '2-2; FC; GRD-GRD; VER-INV NON HS',
      'From ground level, a top straddles a lying primary base and rises to a vertical inverted non-handstand shape while an assisting athlete maintains full contact.',
      'Primary base faces the required left side with knees bent and arms presented at 90°. Top places hands on the base''s thighs, loads shoulders into the base''s hands, extends to the inverted straddle, then lowers through the same controlled pathway.',
      'Press evenly into the base, stretch the straddle tall, and move down as one unit.',
      'Verify primary-base direction, legal hand contacts, assisting athlete behind with continuous full-contact help, vertical non-handstand recognition, and controlled straddle descent.',
      NULL, 'Shoulder sit climb', 'usag-at-l1-acro-2-shoulder-sit', 36),
    ('A&T L1 Acro 2 — Shoulder Sit Climb', 'usag-at-l1-acro-2-shoulder-sit',
      'Youth A&T Level 1', 2, '2-2 primary bases — shoulder sit',
      'The top climbs from behind to a shoulder sit on the primary base while a second base supports the top at the waist.',
      'Primary base establishes a stable torso and shoulder platform. The top steps close, uses the agreed climb contact, centers the seat and legs, and shows control while the assisting base remains behind at the waist.',
      'Climb close, sit centered, and stay tall over the base.',
      'Stable primary base, top centered on shoulders, assisting-base waist contact from behind, no uncontrolled pulling, and matched timing in both groups.',
      'usag-at-l1-acro-1-assisted-straddle-inversion', 'Shoulder-level pop-off', 'usag-at-l1-acro-3-shoulder-popoff', 36),
    ('A&T L1 Acro 3 — Shoulder-level Pop-off', 'usag-at-l1-acro-3-shoulder-popoff',
      'Youth A&T Level 1', 3, '2-2; FC; SHD-GRD; VER-VER — back spot throughout',
      'From the shoulder-level stand/sit sequence, the primary base pops the top to a vertical ground landing while an assisting athlete maintains full-contact support from behind.',
      'Confirm the top is organized before the dip. Primary base and top bend and extend together; the top stays vertical while the assisting athlete tracks the waist and the primary base guides the top to a two-foot landing.',
      'Stay tall through the pop and finish over two feet.',
      'Back spot remains engaged throughout, lift is vertical, top does not pitch forward, landing assistance is continuous, and both groups finish simultaneously.',
      'usag-at-l1-acro-2-shoulder-sit', 'Sponge to prep', 'usag-at-l1-acro-4-sponge-to-prep', 36),
    ('A&T L1 Acro 4 — Sponge to Two-foot Prep', 'usag-at-l1-acro-4-sponge-to-prep',
      'Youth A&T Level 1', 4, '3-3; FC; GRD-SHD; VER-VER; 2FT',
      'Three bases load a vertical top from the ground sponge position to a two-foot shoulder-level prep.',
      'Bases establish identical grips and spacing, absorb the top''s load together, then extend to shoulder level while the top drives through both feet, braces the trunk, and finishes vertical.',
      'Load evenly, stand through both feet, and arrive tall at prep.',
      'Three-base formation, correct full-contact entry, synchronized dip/drive, even foot platform, vertical top posture, and no base or top step.',
      'usag-at-l1-acro-3-shoulder-popoff', 'Prep to sponge dismount', 'usag-at-l1-acro-5-prep-sponge-dismount', 36),
    ('A&T L1 Acro 5 — Prep to Sponge Front Dismount', 'usag-at-l1-acro-5-prep-sponge-dismount',
      'Youth A&T Level 1', 5, '3-3; FC; SHD-GRD; VER-BLW SHD',
      'From two-foot prep, the three-base group returns the top through sponge below shoulder level and dismounts to the front.',
      'Bases lower together without dropping the platform. Top remains braced and vertical through sponge, then steps or is guided to the prescribed front landing with all required contacts maintained.',
      'Ride the lowering, stay tight in sponge, and land together in front.',
      'Continuous full contact, level platform, synchronized lowering, clear below-shoulder sponge, front dismount direction, and balanced landing.',
      'usag-at-l1-acro-4-sponge-to-prep', 'Half-up to shoulder stand', 'usag-at-l2-acro-1-half-up-shoulder-stand', 36),

    ('A&T L2 Acro 1 — Half-up to Shoulder Stand', 'usag-at-l2-acro-1-half-up-shoulder-stand',
      'Youth A&T Level 2', 1, '2-1; FC; H-H; GRD-SHD; VER-VER; TWIST 180',
      'Two athletes initiate a hand-to-hand half-up; the top completes 180° of twist and finishes standing at shoulder level on one primary base.',
      'Primary base faces the left side. Establish hand-to-hand contact, coordinate the shared dip, lift the top close to the base''s center, guide the half turn during ascent, and secure the vertical shoulder stand before transition.',
      'Rise close, turn one half, and finish tall over the base.',
      'Left-facing primary base, continuous required contact, exactly 180° twist, vertical top line, secure shoulder-level finish, and synchronized groups.',
      'usag-at-l1-acro-5-prep-sponge-dismount', 'Shoulder stand to inverted extension', 'usag-at-l2-acro-2-shoulder-to-invert', 44),
    ('A&T L2 Acro 2 — Shoulder Stand to Inverted Extension', 'usag-at-l2-acro-2-shoulder-to-invert',
      'Youth A&T Level 2', 2, '1-2; FC; SHD-EXT; VER-INV NON HS',
      'From a one-base shoulder stand, the top transfers to two bases and finishes extended in an inverted non-handstand shape.',
      'The starting base stabilizes the vertical top while the receiving base establishes the next contact. Partners lift to extended level as the top controls the inversion through the center rather than arching or falling away.',
      'Stay connected, lift through the center, and show the inverted shape at extension.',
      'One base starts and two finish, full contact is visible, extension level is achieved, inverted non-handstand body position is recognizable, and timing matches.',
      'usag-at-l2-acro-1-half-up-shoulder-stand', 'Inverted straight-down dismount', 'usag-at-l2-acro-3-invert-straight-down', 44),
    ('A&T L2 Acro 3 — Inverted Straight-down Dismount', 'usag-at-l2-acro-3-invert-straight-down',
      'Youth A&T Level 2', 3, '2-2; FC; EXT-GRD; INV NON HS-VER',
      'Two bases lower an extended inverted non-handstand top straight through their center to a vertical ground landing.',
      'Bases keep the top over the shared center, lower at the same rate, and rotate the body only as required to place the feet underneath. The top maintains tension and finds the floor without twisting out.',
      'Stay tight, travel straight between the bases, and place both feet under you.',
      'Extended start, two-base full contact, straight center pathway, inverted-to-vertical recognition, no unlisted twist, and controlled two-foot ground finish.',
      'usag-at-l2-acro-2-shoulder-to-invert', 'Assisted front support at extension', 'usag-at-l2-acro-4-assisted-front-support', 44),
    ('A&T L2 Acro 4 — Assisted Front Support at Extension', 'usag-at-l2-acro-4-assisted-front-support',
      'Youth A&T Level 2', 4, '2-2; FC; GRD-EXT; VER-VER; VER HSUP “I”',
      'Two bases raise a vertical top from ground to an extended straight-body front-support position with assistance maintained from beginning to end.',
      'Back base assists at the permitted waist or thighs while the primary base establishes the hand-support platform. Lift the top as one straight unit, finish horizontal and extended, and avoid bending through hips or knees.',
      'Push through the support and hold one long straight body.',
      'Assistance is continuous at waist/thighs, ground-to-extension pathway is controlled, front support is straight and horizontal, arms and legs are extended, and groups match.',
      'usag-at-l2-acro-3-invert-straight-down', 'Front-support 90° dismount', 'usag-at-l2-acro-5-front-support-90-dismount', 44),
    ('A&T L2 Acro 5 — Front-support 90° Dismount', 'usag-at-l2-acro-5-front-support-90-dismount',
      'Youth A&T Level 2', 5, '1-2; FC; EXT-GRD; VER-VER; VER HSUP “I”; primary base TWIST 90°',
      'From extended front support, the top descends to a vertical ground landing as an assisting athlete helps the catch and the primary base turns 90°.',
      'Initiate lowering only after the support shape is stable. Primary base completes the quarter turn while maintaining the top''s center; assisting athlete joins the catch, and both guide the top to an upright two-foot finish.',
      'Stay straight as the base turns, then bring feet under for the catch.',
      'Stable extended start, exact 90° primary-base turn, assisting athlete present on catch, controlled height change, vertical top landing, and no extra rotation.',
      'usag-at-l2-acro-4-assisted-front-support', 'Sponge to prep', 'usag-at-l2-acro-6-sponge-to-prep', 44),
    ('A&T L2 Acro 6 — Three-base Sponge to Prep', 'usag-at-l2-acro-6-sponge-to-prep',
      'Youth A&T Level 2', 6, '3-3; FC; GRD-SHD; VER-VER; 2FT',
      'Three bases load a vertical top from ground sponge to a two-foot shoulder-level prep.',
      'Set platform grips and foot placement before loading. Bases bend and drive on one count; top stands through both feet and finishes with hips, ribs, and head stacked above the platform.',
      'Load evenly, stand tall, and arrive together at prep.',
      'Correct three-base contacts, level platform, matched dip/drive, vertical top, two-foot finish, and no loss of formation.',
      'usag-at-l2-acro-5-front-support-90-dismount', 'Prep to cradle', 'usag-at-l2-acro-7-prep-to-cradle', 44),
    ('A&T L2 Acro 7 — Prep to Cradle', 'usag-at-l2-acro-7-prep-to-cradle',
      'Youth A&T Level 2', 7, '3-3; R; SHD-CRDL; VER-HOZ',
      'Three bases release a vertical top from shoulder-level prep and receive the top horizontally in cradle.',
      'Use a small synchronized dip, direct the release upward through the top''s center, have the top transition to the required horizontal cradle shape, and catch high with bases absorbing together.',
      'Ride up, shape horizontal, and wait for the cradle catch.',
      'Release is visible, top travels vertically without drifting, horizontal shape is organized before catch, bases receive securely and softly, and timing matches.',
      'usag-at-l2-acro-6-sponge-to-prep', 'Cradle barrel roll 360°', 'usag-at-l2-acro-8-cradle-barrel-roll', 44),
    ('A&T L2 Acro 8 — Cradle Barrel Roll 360°', 'usag-at-l2-acro-8-cradle-barrel-roll',
      'Youth A&T Level 2', 8, '3-3; R; CRDL-CRDL; HOZ-HOZ; TWIST 360',
      'From cradle, the bases pop the horizontal top through a complete 360° barrel roll and recatch in cradle before a front ground dismount.',
      'Bases agree on release height and direction, pop through the top''s longitudinal axis, keep the top in a tight horizontal line for one full turn, recatch at safe height, then coordinate the prescribed front dismount.',
      'Stay long and tight, roll one full turn, and show the cradle before dismount.',
      'Cradle start and finish, clear release, exactly 360° twist, horizontal body maintained, secure three-base recatch, and controlled front dismount.',
      'usag-at-l2-acro-7-prep-to-cradle', 'Level 3 shoulder-stand/front-support sequence', 'usag-at-l3-acro-1-shoulder-stand', 44)
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics',
    'discipline', 'Acrobatics & Tumbling',
    'event', 'Compulsory Acro — element ' || d.step_number,
    'program', 'Youth Acrobatics & Tumbling Development Program 2025–2026',
    'official_name', d.name,
    'element_code', d.official_notation,
    'usa_gymnastics_levels', jsonb_build_array(d.level_name),
    'status', 'verified',
    'last_verified', '2026-07-25',
    'athlete_cues', jsonb_build_array(d.athlete_cue, 'Call the shared count and keep every grip active until the element is complete.'),
    'coach_checkpoints', jsonb_build_array(d.coach_focus, 'Two four-athlete groups perform the compulsory sequence synchronized; athletes may change positions only within their original group.'),
    'safety_and_readiness', jsonb_build_array(
      'Use qualified A&T coaching, approved surfaces, and trained spotters for all loaded partner elements.',
      'Verify every athlete understands base, top, and assisting responsibilities before the full element.',
      'Progress load, height, release, rotation, and catch separately before combining them.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault', 'Bent arms or legs', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Extend every partner shape.'),
      jsonb_build_object('fault', 'Leg/foot separation', 'deduction', 'Up to −0.2 per occurrence', 'cue', 'Join and finish the legs.'),
      jsonb_build_object('fault', 'Under/over rotation or insufficient amplitude', 'deduction', 'Up to −0.3 per occurrence for each category', 'cue', 'Match the drive and complete rotation before catch.'),
      jsonb_build_object('fault', 'Incorrect body position or insufficient extension', 'deduction', 'Up to −0.2 per occurrence for each category', 'cue', 'Make the coded start and finish shapes clear.'),
      jsonb_build_object('fault', 'Improper base catch', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Catch high, close, and together.'),
      jsonb_build_object('fault', 'Deviation from square/straight', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Keep the structure centered and aligned.'),
      jsonb_build_object('fault', 'Lack of continuity', 'deduction', 'Up to −0.2 per occurrence', 'cue', 'Move through the official count without hesitation.'),
      jsonb_build_object('fault', 'Lack of synchronization', 'deduction', 'Up to −0.3 per occurrence per heat', 'cue', 'Match dips, releases, catches, and finishes.'),
      jsonb_build_object('fault', 'Fall', 'deduction', '−0.5 per occurrence', 'cue', 'Protect the catch and finish in control.')
    ),
    'scoring_summary', 'The compulsory Acro heat starts from 10.0. Complete omission of a special requirement is −2.0 and partial completion is −1.0. Wrong required spacing/direction is an event violation of −0.50. Spotting assistance beyond required contacts is −1.0. Execution deductions apply per occurrence; a fall is −0.5. Official Code and current errata control.',
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title', 'Teach ' || d.name, 'purpose', 'learning',
        'description', 'Identify each role and decode the start-contact-height-position-finish notation. Demonstrate grips at ground level, then load and shape drills, assisted full pathway, and the synchronized element. Freeze at every hand change, release, and catch.'),
      jsonb_build_object('title', d.name || ' — perfect synchronized model', 'purpose', 'model',
        'description', 'Show front, side, and overhead views of both groups at full speed and slow motion. Highlight identical start shapes, partner timing, height, coded body position, rotation, catch mechanics, and controlled finish.')
    ),
    'next_progressions', jsonb_build_array(jsonb_build_object('name', d.next_name, 'slug', d.next_slug)),
    'sources', jsonb_build_array(jsonb_build_object(
      'title', 'USA Gymnastics Youth Acrobatics & Tumbling Rules & Policies / Code of Points',
      'url', 'https://static.usagym.org/PDFs/gfa/at/25rp_cop.pdf#page=' || d.source_page,
      'organization', 'USA Gymnastics',
      'effective_cycle', '2025–2026',
      'accessed_on', '2026-07-25',
      'note', 'Compulsory Acro notation, description, and deduction schedule.'
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
  CASE WHEN p.level_name = 'Youth A&T Level 1' THEN 'EARLY_STAGE'::public.skill_level ELSE 'BEGINNER'::public.skill_level END,
  'skill', 'execution', 10,
  'Loaded partner element — qualified A&T coaching required',
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
SELECT child.id, parent.id, 'Direct preceding compulsory Acro element or development progression.'
FROM (
  VALUES
    ('usag-at-l1-acro-2-shoulder-sit', 'usag-at-l1-acro-1-assisted-straddle-inversion'),
    ('usag-at-l1-acro-3-shoulder-popoff', 'usag-at-l1-acro-2-shoulder-sit'),
    ('usag-at-l1-acro-4-sponge-to-prep', 'usag-at-l1-acro-3-shoulder-popoff'),
    ('usag-at-l1-acro-5-prep-sponge-dismount', 'usag-at-l1-acro-4-sponge-to-prep'),
    ('usag-at-l2-acro-1-half-up-shoulder-stand', 'usag-at-l1-acro-5-prep-sponge-dismount'),
    ('usag-at-l2-acro-2-shoulder-to-invert', 'usag-at-l2-acro-1-half-up-shoulder-stand'),
    ('usag-at-l2-acro-3-invert-straight-down', 'usag-at-l2-acro-2-shoulder-to-invert'),
    ('usag-at-l2-acro-4-assisted-front-support', 'usag-at-l2-acro-3-invert-straight-down'),
    ('usag-at-l2-acro-5-front-support-90-dismount', 'usag-at-l2-acro-4-assisted-front-support'),
    ('usag-at-l2-acro-6-sponge-to-prep', 'usag-at-l2-acro-5-front-support-90-dismount'),
    ('usag-at-l2-acro-7-prep-to-cradle', 'usag-at-l2-acro-6-sponge-to-prep'),
    ('usag-at-l2-acro-8-cradle-barrel-roll', 'usag-at-l2-acro-7-prep-to-cradle')
) AS edge(child_slug, parent_slug)
JOIN coaching.skill child ON child.slug = edge.child_slug
JOIN coaching.skill parent ON parent.slug = edge.parent_slug AND parent.facility_id = child.facility_id
ON CONFLICT DO NOTHING;
