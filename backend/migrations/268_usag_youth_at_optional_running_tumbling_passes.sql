-- USA Gymnastics Youth Acrobatics & Tumbling Development Program.
-- Complete 2025-26 optional Running Tumbling table (Levels 3-5), pages 89-90.
-- Coaching prose is original; the linked Code and current errata control.

WITH source_data (ordinal, slug, pass_code, start_value) AS (
  VALUES
    (1, 'usag-at-run-001', 'RO BHS BHS', 7.00),
    (2, 'usag-at-run-002', 'FHS RO BHS', 7.00),
    (3, 'usag-at-run-003', 'FB RO BHS', 7.00),
    (4, 'usag-at-run-004', 'FHS RO BHS BHS', 7.05),
    (5, 'usag-at-run-005', 'FB RO BHS BHS', 7.05),
    (6, 'usag-at-run-006', 'FT RO', 7.30),
    (7, 'usag-at-run-007', 'FT RO BHS', 7.35),
    (8, 'usag-at-run-008', 'RO BHS BT', 8.00),
    (9, 'usag-at-run-009', 'RO BT', 8.00),
    (10, 'usag-at-run-010', 'FHS FT', 8.00),
    (11, 'usag-at-run-011', 'RO WH BHS BHS', 8.00),
    (12, 'usag-at-run-012', 'FHS RO BT', 8.05),
    (13, 'usag-at-run-013', 'FHS RO BHS BT', 8.05),
    (14, 'usag-at-run-014', 'RO BHS BL', 8.20),
    (15, 'usag-at-run-015', 'RO BL', 8.20),
    (16, 'usag-at-run-016', 'FHS RO BHS BL', 8.25),
    (17, 'usag-at-run-017', 'RO WH BHS BT', 8.30),
    (18, 'usag-at-run-018', 'FT RO BT', 8.30),
    (19, 'usag-at-run-019', 'FT RO BHS BT', 8.30),
    (20, 'usag-at-run-020', 'FHS FT RO BHS BT', 8.40),
    (21, 'usag-at-run-021', 'FHS RO BHS BL180', 8.50),
    (22, 'usag-at-run-022', 'FT RO BHS BL', 8.50),
    (23, 'usag-at-run-023', 'RO BHS BL180', 8.50),
    (24, 'usag-at-run-024', 'RO BL180', 8.50),
    (25, 'usag-at-run-025', 'FT RO BL', 8.50),
    (26, 'usag-at-run-026', 'FHS FB FT', 8.50),
    (27, 'usag-at-run-027', 'FHS RO WH BL', 8.55),
    (28, 'usag-at-run-028', 'FHS FT RO BHS BL', 8.60),
    (29, 'usag-at-run-029', 'RO WH BT', 8.70),
    (30, 'usag-at-run-030', 'RO BHS WH BT', 8.70),
    (31, 'usag-at-run-031', 'FT RO WH BT', 8.80),
    (32, 'usag-at-run-032', 'RO WH BL', 8.90),
    (33, 'usag-at-run-033', 'RO AT RO BHS BT', 9.00),
    (34, 'usag-at-run-034', 'RO AT RO BT', 9.00),
    (35, 'usag-at-run-035', 'RO BHS BL360', 9.00),
    (36, 'usag-at-run-036', 'RO BL360', 9.00),
    (37, 'usag-at-run-037', 'RO AL RO BHS BT', 9.00),
    (38, 'usag-at-run-038', 'RO AL RO BT', 9.00),
    (39, 'usag-at-run-039', 'FT RO WH BL', 9.00),
    (40, 'usag-at-run-040', 'FT RO BL180', 9.00),
    (41, 'usag-at-run-041', 'FHS RO BHS BL360', 9.05),
    (42, 'usag-at-run-042', 'RO WH WH BHS BL180', 9.10),
    (43, 'usag-at-run-043', 'RO AT RO BL', 9.15),
    (44, 'usag-at-run-044', 'RO AT RO BHS BL', 9.20),
    (45, 'usag-at-run-045', 'RO AL RO BHS BL', 9.20),
    (46, 'usag-at-run-046', 'FHS FT RO BL180', 9.20),
    (47, 'usag-at-run-047', 'RO WH BL180', 9.20),
    (48, 'usag-at-run-048', 'FT RO AT RO BT', 9.20),
    (49, 'usag-at-run-049', 'RO WH BHS BL360', 9.30),
    (50, 'usag-at-run-050', 'RO WH AT RO BT', 9.30),
    (51, 'usag-at-run-051', 'RO AT RO BL180', 9.30),
    (52, 'usag-at-run-052', 'RO AT RO BHS BL180', 9.30),
    (53, 'usag-at-run-053', 'RO AT RO BHS BL360', 9.40),
    (54, 'usag-at-run-054', 'RO WH AT RO BL', 9.40),
    (55, 'usag-at-run-055', 'RO BT180 RO BHS BL360', 9.40),
    (56, 'usag-at-run-056', 'FT RO AT RO BL', 9.40),
    (57, 'usag-at-run-057', 'FHS RO AT RO BL360', 9.45),
    (58, 'usag-at-run-058', 'RO AT RO BHS BL360', 9.45),
    (59, 'usag-at-run-059', 'RO AL RO BHS BL360', 9.45),
    (60, 'usag-at-run-060', 'RO AT RO BL360', 9.45),
    (61, 'usag-at-run-061', 'RO AT RO BHS BL360', 9.45),
    (62, 'usag-at-run-062', 'FT RO BHS BL360', 9.50),
    (63, 'usag-at-run-063', 'FHS FT RO BHS BL360', 9.50),
    (64, 'usag-at-run-064', 'FT RO BL360', 9.50),
    (65, 'usag-at-run-065', 'RO BHS BL540', 9.50),
    (66, 'usag-at-run-066', 'RO BL540', 9.50),
    (67, 'usag-at-run-067', 'FHS RO BHS BL540', 9.50),
    (68, 'usag-at-run-068', 'RO BHS WH BL360', 9.50),
    (69, 'usag-at-run-069', 'RO WH BL360', 9.50),
    (70, 'usag-at-run-070', 'FHS FT RO BHS BL360', 9.55),
    (71, 'usag-at-run-071', 'RO AT RO WH BL360', 9.65),
    (72, 'usag-at-run-072', 'RO BHS W360 BT', 9.70),
    (73, 'usag-at-run-073', 'RO WH WH BHS BL360', 9.70),
    (74, 'usag-at-run-074', 'FHS FT RO WH BL360', 9.70),
    (75, 'usag-at-run-075', 'FT FT RO BHS BL360', 9.75),
    (76, 'usag-at-run-076', 'RO WH BHS BHS BL540', 9.80),
    (77, 'usag-at-run-077', 'RO WH BHS BL540', 9.80),
    (78, 'usag-at-run-078', 'RO AT RO WH BL360', 9.80),
    (79, 'usag-at-run-079', 'RO AT RO BHS BL540', 9.85),
    (80, 'usag-at-run-080', 'RO BL540 RO BT', 9.85),
    (81, 'usag-at-run-081', 'RO BHS BL540 RO BT', 9.85),
    (82, 'usag-at-run-082', 'RO AT RO BHS BL540', 9.90),
    (83, 'usag-at-run-083', 'RO WH WH BL360', 9.90),
    (84, 'usag-at-run-084', 'RO AT RO BL540', 9.90),
    (85, 'usag-at-run-085', 'FT RO WH BL360', 9.90),
    (86, 'usag-at-run-086', 'RO AL RO BHS BL540', 9.95),
    (87, 'usag-at-run-087', 'FHS FT RO BHS BL540', 9.95),
    (88, 'usag-at-run-088', 'FT RO BHS BL540', 9.95),
    (89, 'usag-at-run-089', 'FT RO BL540', 9.95),
    (90, 'usag-at-run-090', 'RO BL540 FHS FT', 9.95),
    (91, 'usag-at-run-091', 'RO W360 BHS BHS BL540', 10.00),
    (92, 'usag-at-run-092', 'RO W360 BHS BL540', 10.00),
    (93, 'usag-at-run-093', 'RO BHS W360 BHS BL540', 10.00),
    (94, 'usag-at-run-094', 'RO BHS BL540 RO BL360', 10.00),
    (95, 'usag-at-run-095', 'RO BL540 RO BHS BL360', 10.00),
    (96, 'usag-at-run-096', 'FT RO WH WH BL360', 10.00),
    (97, 'usag-at-run-097', 'RO BL540 RO BL360', 10.00),
    (98, 'usag-at-run-098', 'RO BHS BL540 FHS FT', 10.00),
    (99, 'usag-at-run-099', 'FT FHS FT RO BL360', 10.00),
    (100, 'usag-at-run-100', 'FT RO BL540 RO BL360', 10.00),
    (101, 'usag-at-run-101', 'RO BHS BL540 FT', 10.00),
    (102, 'usag-at-run-102', 'RO BHS WH BL540', 10.00),
    (103, 'usag-at-run-103', 'RO WH BL540', 10.00),
    (104, 'usag-at-run-104', 'FT FT RO BHS BL540', 10.00),
    (105, 'usag-at-run-105', 'RO WH WH WH BL360', 10.00),
    (106, 'usag-at-run-106', 'FHS FT RO WH BL360', 10.00)
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics',
    'discipline', 'Acrobatics & Tumbling',
    'event', 'Optional Running Tumbling',
    'program', 'Youth Acrobatics & Tumbling Development Program 2025–2026',
    'official_name', d.pass_code,
    'official_code', d.pass_code,
    'usa_gymnastics_levels', jsonb_build_array('Youth A&T Level 3', 'Youth A&T Level 4', 'Youth A&T Level 5'),
    'difficulty_value', to_char(d.start_value, 'FM90.00') || ' start value',
    'status', 'verified',
    'last_verified', '2026-07-25',
    'athlete_cues', jsonb_build_array(
      'Read the pass left to right: RO round-off; BHS back handspring; FHS front handspring; FB front bounder; FT front tuck; WH whip; BT back tuck; BL back layout; AT Arabian tuck; AL Arabian layout; W360 full-twisting back handspring; twist numbers are degrees.',
      'Build speed through the entry and connections, rise into each salto, show the declared body shape and twist, then finish under control.'
    ),
    'coach_checkpoints', jsonb_build_array(
      'Verify every element and connection exactly matches the declared official shorthand: ' || d.pass_code || '.',
      'Look for uninterrupted connection rhythm, centered travel, straight support arms, complete body positions and twists, adequate amplitude, and a controlled final landing.',
      'For synchronized heats, identical passes must begin four counts apart as required and match direction, element identity, tempo, and finish.'
    ),
    'safety_and_readiness', jsonb_build_array(
      'Do not teach from the full pass first. Each athlete must independently own every listed salto, twist, handspring, whip/bounder, and connection on progressive surfaces.',
      'Use qualified coaching, appropriate spotting systems, resi/pit progression, and sufficient landing and run-out space.',
      'A published pass option is not an athlete-readiness prescription; choose the level and value only after technical and physical readiness is demonstrated.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault', 'Flexed foot', 'deduction', '−0.1 per occurrence', 'cue', 'Finish each line through the toes.'),
      jsonb_build_object('fault', 'Bent arms or legs', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Extend support and flight shapes.'),
      jsonb_build_object('fault', 'Leg/foot separation', 'deduction', 'Up to −0.2 per occurrence', 'cue', 'Join the legs when the element calls for it.'),
      jsonb_build_object('fault', 'Under/over rotation or insufficient amplitude', 'deduction', 'Up to −0.3 per category per occurrence', 'cue', 'Create lift, finish rotation, and land over the feet.'),
      jsonb_build_object('fault', 'Incorrect body position or insufficient stretch', 'deduction', 'Up to −0.2 per category per occurrence', 'cue', 'Make tuck, layout, and twist positions unmistakable.'),
      jsonb_build_object('fault', 'Lack of continuity', 'deduction', 'Up to −0.2 per occurrence', 'cue', 'Carry active momentum through every declared connection.'),
      jsonb_build_object('fault', 'Lack of synchronization', 'deduction', 'Up to −0.3 per occurrence', 'cue', 'Match starts, contacts, flight, and finishes.'),
      jsonb_build_object('fault', 'Step after landing', 'deduction', '−0.1 each occurrence', 'cue', 'Open on time and finish over the feet.'),
      jsonb_build_object('fault', 'Fall', 'deduction', '−0.5 each occurrence', 'cue', 'Reduce difficulty until control is repeatable.'),
      jsonb_build_object('fault', 'Out of bounds', 'deduction', '−0.1 per occurrence', 'cue', 'Keep the pass in its planned lane.')
    ),
    'scoring_summary', 'Official listed start value: ' || to_char(d.start_value, 'FM90.00') ||
      '. Level 3 optional tumbling is capped at 8.20; Level 4 at 9.05; Level 5 has no difficulty restriction. The execution panel applies deductions from the declared start value. Current Code, tariff requirements, and errata control.',
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title', 'Teach ' || d.pass_code, 'purpose', 'learning',
        'description', 'Show each element alone from side and end views, then two-skill connections on progressive surfaces, then the whole pass. Overlay the official shorthand and pause at takeoff, support, salto shape, twist completion, and landing.'),
      jsonb_build_object('title', d.pass_code || ' — ideal competition model', 'purpose', 'model',
        'description', 'Show a regulation-floor full-speed pass followed by frame-by-frame side and end views. Highlight rising amplitude, exact shapes and twist degrees, direct connections, center-line travel, and the controlled final landing.')
    ),
    'next_progressions', '[]'::jsonb,
    'sources', jsonb_build_array(jsonb_build_object(
      'title', 'USA Gymnastics Youth Acrobatics & Tumbling Rules & Policies / Code of Points — Running Tumbling Table',
      'url', CASE WHEN d.start_value < 9.50
        THEN 'https://static.usagym.org/PDFs/gfa/at/25rp_cop.pdf#page=89'
        ELSE 'https://static.usagym.org/PDFs/gfa/at/25rp_cop.pdf#page=90' END,
      'organization', 'USA Gymnastics',
      'effective_cycle', '2025–2026',
      'accessed_on', '2026-07-25',
      'note', 'Official optional running-tumbling pass shorthand and start value.'
    )),
    'editorial_note', 'Original coaching summary. No single direct next progression is asserted because the official table branches by element, connection, twist, and start value.'
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
  'A&T Optional Running Pass — ' || p.pass_code,
  p.slug,
  'An official Youth A&T Levels 3–5 optional running-tumbling pass valued at ' || to_char(p.start_value, 'FM90.00') || '.',
  'Perform the declared sequence continuously from left to right: ' || p.pass_code ||
    '. Preserve safe progressive technique, recognizable element shapes, completed twists, controlled direction, and the required landing.',
  (SELECT id FROM coaching.sport WHERE key = 'gymnastics'),
  CASE
    WHEN p.start_value <= 8.20 THEN 'INTERMEDIATE'::public.skill_level
    WHEN p.start_value <= 9.05 THEN 'ADVANCED'::public.skill_level
    ELSE 'ELITE'::public.skill_level
  END,
  'combo', 'execution', p.start_value,
  'Optional running-tumbling pass; level caps and athlete restrictions apply',
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
