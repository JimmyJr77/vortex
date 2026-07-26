-- USA Gymnastics Youth Acrobatics & Tumbling Development Program.
-- Complete 2025-26 Standing Tumbling Table of Elements (Levels 3-5), page 98.
-- Coaching prose is original; the linked Code and current errata control.

WITH source_data (ordinal, slug, pass_code, start_value) AS (
  VALUES
    (1, 'usag-at-stand-001', 'BHS', 7.00),
    (2, 'usag-at-stand-002', 'SJ BHS', 7.05),
    (3, 'usag-at-stand-003', 'BHS BHS', 7.10),
    (4, 'usag-at-stand-004', 'CW BHS', 7.10),
    (5, 'usag-at-stand-005', 'BHS BHS BHS', 7.20),
    (6, 'usag-at-stand-006', 'CW BHS BHS', 7.20),
    (7, 'usag-at-stand-007', 'ACW BHS', 7.90),
    (8, 'usag-at-stand-008', 'CW BHS BHS BT', 8.30),
    (9, 'usag-at-stand-009', 'BHS BHS BHS BT', 8.35),
    (10, 'usag-at-stand-010', 'BT', 8.40),
    (11, 'usag-at-stand-011', 'CW BHS BT', 8.40),
    (12, 'usag-at-stand-012', 'BHS BHS BT', 8.40),
    (13, 'usag-at-stand-013', 'SJ BT', 8.45),
    (14, 'usag-at-stand-014', 'SJ BHS BHS BT', 8.45),
    (15, 'usag-at-stand-015', 'BHS BT', 8.50),
    (16, 'usag-at-stand-016', 'CW BT', 8.50),
    (17, 'usag-at-stand-017', 'SJ SJ BT', 8.50),
    (18, 'usag-at-stand-018', 'SJ SJ BHS BHS BT', 8.50),
    (19, 'usag-at-stand-019', 'SJ BHS BT', 8.55),
    (20, 'usag-at-stand-020', 'BHS BHS BHS BL', 8.55),
    (21, 'usag-at-stand-021', 'BHS BHS BL', 8.60),
    (22, 'usag-at-stand-022', 'BHS BL', 8.60),
    (23, 'usag-at-stand-023', 'CW BT BHS BHS BT', 8.65),
    (24, 'usag-at-stand-024', 'SJ BHS BHS BL', 8.65),
    (25, 'usag-at-stand-025', 'CW BL', 8.70),
    (26, 'usag-at-stand-026', 'SJ SJ BHS BHS BL', 8.70),
    (27, 'usag-at-stand-027', 'BT BHS BHS BHS BT', 8.70),
    (28, 'usag-at-stand-028', 'ACW BHS BHS BT', 8.70),
    (29, 'usag-at-stand-029', 'SJ BHS BL', 8.75),
    (30, 'usag-at-stand-030', 'BT BHS BHS BT', 8.75),
    (31, 'usag-at-stand-031', 'CW BT BHS BT', 8.75),
    (32, 'usag-at-stand-032', 'ACW BHS BT', 8.80),
    (33, 'usag-at-stand-033', 'SJ BHS BT BHS BT', 8.80),
    (34, 'usag-at-stand-034', 'SJ BT BHS BHS BT', 8.80),
    (35, 'usag-at-stand-035', 'SJ SJ BT BHS BHS BT', 8.85),
    (36, 'usag-at-stand-036', 'CW BT BT', 8.85),
    (37, 'usag-at-stand-037', 'BT BHS BHS BHS BL', 8.90),
    (38, 'usag-at-stand-038', 'BT BHS BHS BL', 8.95),
    (39, 'usag-at-stand-039', 'SJ SJ BT BHS BT', 8.95),
    (40, 'usag-at-stand-040', 'SJ BT BHS BHS BL', 9.00),
    (41, 'usag-at-stand-041', 'SJ SJ BT BHS BHS BL', 9.05),
    (42, 'usag-at-stand-042', 'ACW BT BHS BHS BT', 9.05),
    (43, 'usag-at-stand-043', 'SJ SJ SJ BT BHS BHS BL', 9.10),
    (44, 'usag-at-stand-044', 'CW BT BT BT', 9.10),
    (45, 'usag-at-stand-045', 'SJ SJ BT BHS BL', 9.15),
    (46, 'usag-at-stand-046', 'ACW BT BHS BT', 9.15),
    (47, 'usag-at-stand-047', 'BT BT', 9.25),
    (48, 'usag-at-stand-048', 'ACW BT BHS BHS BL', 9.25),
    (49, 'usag-at-stand-049', 'SJ BT BT', 9.30),
    (50, 'usag-at-stand-050', 'ACW BT', 9.30),
    (51, 'usag-at-stand-051', 'SJ SJ BT BT', 9.35),
    (52, 'usag-at-stand-052', 'ACW BL', 9.50),
    (53, 'usag-at-stand-053', 'CW BHS BHS BL360', 9.50),
    (54, 'usag-at-stand-054', 'BHS BHS BHS BL360', 9.55),
    (55, 'usag-at-stand-055', 'BT BT BT', 9.55),
    (56, 'usag-at-stand-056', 'ACW BT BT', 9.60),
    (57, 'usag-at-stand-057', 'CW BT360', 9.60),
    (58, 'usag-at-stand-058', 'BHS BHS BL360', 9.70),
    (59, 'usag-at-stand-059', 'CW BL360', 9.70),
    (60, 'usag-at-stand-060', 'BT360', 9.80),
    (61, 'usag-at-stand-061', 'SJ BHS BHS BL360', 9.80),
    (62, 'usag-at-stand-062', 'CW BT BHS BHS BHS BL360', 9.85),
    (63, 'usag-at-stand-063', 'BHS BL360', 9.90),
    (64, 'usag-at-stand-064', 'SJ SJ BHS BHS BL360', 9.90),
    (65, 'usag-at-stand-065', 'SJ BHS BL360', 10.00),
    (66, 'usag-at-stand-066', 'CW BT BHS BHS BL360', 10.00),
    (67, 'usag-at-stand-067', 'CW BHS BHS BL540', 10.00),
    (68, 'usag-at-stand-068', 'BHS BHS BHS BL540', 10.00),
    (69, 'usag-at-stand-069', 'BHS BHS BL540', 10.00),
    (70, 'usag-at-stand-070', 'BT BHS BHS BHS BL360', 10.00),
    (71, 'usag-at-stand-071', 'ACW BT360', 10.00),
    (72, 'usag-at-stand-072', 'ACW BT BHS BHS BL360', 10.00),
    (73, 'usag-at-stand-073', 'CW BL540', 10.00),
    (74, 'usag-at-stand-074', 'BT540', 10.00),
    (75, 'usag-at-stand-075', 'SJ BHS BHS BL540', 10.00),
    (76, 'usag-at-stand-076', 'CW BT BHS BL360', 10.00),
    (77, 'usag-at-stand-077', 'BT360 BT', 10.00),
    (78, 'usag-at-stand-078', 'BT BT360', 10.00),
    (79, 'usag-at-stand-079', 'CW BT BHS BHS BHS BL540', 10.00),
    (80, 'usag-at-stand-080', 'BHS BL540', 10.00),
    (81, 'usag-at-stand-081', 'SJ SJ BHS BHS BL540', 10.00),
    (82, 'usag-at-stand-082', 'CW BL360 BT', 10.00)
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics',
    'discipline', 'Acrobatics & Tumbling',
    'event', 'Team Event Standing Tumbling',
    'program', 'Youth Acrobatics & Tumbling Development Program 2025–2026',
    'official_name', d.pass_code,
    'official_code', d.pass_code,
    'usa_gymnastics_levels', jsonb_build_array('Youth A&T Level 3', 'Youth A&T Level 4', 'Youth A&T Level 5'),
    'difficulty_value', to_char(d.start_value, 'FM90.00') || ' start value',
    'status', 'verified',
    'last_verified', '2026-07-25',
    'athlete_cues', jsonb_build_array(
      'Read the pass left to right: SJ standing jump; CW cartwheel; ACW aerial cartwheel; BHS back handspring; BT back tuck; BL back layout; twist numbers are degrees.',
      'Begin without a step or hop, make every connection continuous, rise into each salto, complete the declared shape and twist, and control the finish.'
    ),
    'coach_checkpoints', jsonb_build_array(
      'Verify the athlete starts from standing without previous forward or backward momentum and performs exactly: ' || d.pass_code || '.',
      'Look for safe direction, continuous connections, straight support arms, complete salto shapes and twists, adequate amplitude, and landing control.',
      'For synchronized team segments, passes must originate from the same side, travel parallel in reasonable 6–12 foot proximity, and match timing and execution.'
    ),
    'safety_and_readiness', jsonb_build_array(
      'Every component and connection must be independently mastered before assembling the listed pass.',
      'Use qualified coaching, progressive surfaces, spotting systems, resi/pit progressions, and safe spacing between simultaneous passes.',
      'The table is a competition-value menu, not a readiness ladder; select only skills the athlete can perform safely and consistently.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault', 'Flexed foot', 'deduction', '−0.1 per occurrence', 'cue', 'Extend through the toes.'),
      jsonb_build_object('fault', 'Bent arms or legs', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Finish every support and flight line.'),
      jsonb_build_object('fault', 'Leg/foot separation', 'deduction', 'Up to −0.2 per occurrence', 'cue', 'Join the legs when required.'),
      jsonb_build_object('fault', 'Under/over rotation', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Finish rotation before landing.'),
      jsonb_build_object('fault', 'Insufficient amplitude', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Create lift before shape or twist.'),
      jsonb_build_object('fault', 'Incorrect body position or insufficient stretch', 'deduction', 'Up to −0.2 per category per occurrence', 'cue', 'Make tuck, layout, and twist positions clear.'),
      jsonb_build_object('fault', 'Lack of continuity', 'deduction', 'Up to −0.2 per occurrence', 'cue', 'Connect on active feet without a pause.'),
      jsonb_build_object('fault', 'Lack of synchronization', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Match takeoffs, contacts, flight, and finish.'),
      jsonb_build_object('fault', 'Step', 'deduction', '−0.1 each occurrence', 'cue', 'Land centered and hold.'),
      jsonb_build_object('fault', 'Fall', 'deduction', '−0.5 each occurrence', 'cue', 'Reduce difficulty until control is repeatable.')
    ),
    'scoring_summary', 'Official listed start value: ' || to_char(d.start_value, 'FM90.00') ||
      '. In Team Event, Level 3 standing tumbling has 8.20 points possible, Level 4 has 9.00, and Level 5 has 10.00. Eight total passes are required at Level 3 and ten at Levels 4–5; four must be synchronized. Execution and neutral deductions apply under the current Code.',
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title', 'Teach ' || d.pass_code, 'purpose', 'learning',
        'description', 'Demonstrate the no-step standing start, each component separately, then two-element connections and the whole pass. Use side and end views and pause at support, set, salto shape, twist completion, and landing.'),
      jsonb_build_object('title', d.pass_code || ' — ideal team model', 'purpose', 'model',
        'description', 'Show a full-speed regulation-floor pass, then synchronized slow motion when applicable. Highlight identical standing starts, rising amplitude, exact shapes, direct connections, parallel travel, and controlled finishes.')
    ),
    'next_progressions', '[]'::jsonb,
    'sources', jsonb_build_array(jsonb_build_object(
      'title', 'USA Gymnastics Youth Acrobatics & Tumbling Rules & Policies / Code of Points — Standing Tumbling Table',
      'url', 'https://static.usagym.org/PDFs/gfa/at/25rp_cop.pdf#page=98',
      'organization', 'USA Gymnastics',
      'effective_cycle', '2025–2026',
      'accessed_on', '2026-07-25',
      'note', 'Official Team Event standing-tumbling shorthand and start value.'
    )),
    'editorial_note', 'Original coaching summary. No single direct progression is asserted because this official table branches across jumps, cartwheels/aerials, handsprings, saltos, twists, and connections.'
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
  'A&T Standing Tumbling — ' || p.pass_code,
  p.slug,
  'An official Youth A&T Levels 3–5 Team Event standing-tumbling pass valued at ' || to_char(p.start_value, 'FM90.00') || '.',
  'Start from a stationary standing position without steps or hops and perform continuously: ' || p.pass_code ||
    '. Preserve recognizable shapes and twists, safe direction, direct rhythm, amplitude, and landing control.',
  (SELECT id FROM coaching.sport WHERE key = 'gymnastics'),
  CASE
    WHEN p.start_value <= 8.20 THEN 'INTERMEDIATE'::public.skill_level
    WHEN p.start_value <= 9.00 THEN 'ADVANCED'::public.skill_level
    ELSE 'ELITE'::public.skill_level
  END,
  'combo', 'execution', p.start_value,
  'Team Event standing-tumbling pass; level requirements and spacing rules apply',
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
