-- USA Gymnastics Youth Acrobatics & Tumbling Development Program.
-- Complete 2025-26 optional Pyramid Sequence table (Levels 3-5), pages 83-86.
-- Official notation is preserved as factual data; coaching prose is original.

WITH source_data (
  slug, pyramid_number, category, structure_text, entry_text, modifier_text,
  tossers, dismount_text, catchers, start_value, source_page
) AS (
  VALUES
    ('usag-at-pyramid-phs1', 'PHS1', 'Hand Support',
      '2.1.1 primary bases: one thighstand group; mid-base stands on thighs with arms extended overhead',
      'FC; GRD-PK; VER HSUP "I"-VER; NO TWIST', NULL, 2,
      'FC; PK-GRD; VER HSUP "I"-VER; TWIST 180', 2, 9.10, 83),
    ('usag-at-pyramid-phs2', 'PHS2-S/L', 'Hand Support',
      '3.1.1 primary bases: one thighstand group and one support in back; mid-base stands on thighs with arms extended overhead',
      'FC; GRD-PK; VER HSUP "S"/"L"-VER; TWIST 180', NULL, 2,
      'FC; PK-GRD; VER HSUP "S"/"L"-VER; TWIST 180', 2, 9.35, 83),
    ('usag-at-pyramid-phs3', 'PHS3-S/L', 'Hand Support',
      '2.1.1 primary bases: one thighstand group; mid-base stands on thighs with arms extended overhead',
      'FC; SHD-PK; VER-VER HSUP "S"/"L"', NULL, 1,
      'FC; PK-GRD; VER HSUP "S"/"L"-VER; TWIST 180', 2, 9.60, 83),
    ('usag-at-pyramid-phs4', 'PHS4-S/L', 'Hand Support',
      '1.1.1 primary base standing; mid-base shoulder sit with arms extended overhead',
      'FC; SHD-PK; VER-VER HSUP "S"/"L"', NULL, 1,
      'FC; PK-GRD; VER HSUP "S"/"L"-VER; TWIST 180', 1, 9.70, 83),
    ('usag-at-pyramid-phs5', 'PHS5-S/L', 'Hand Support',
      '2.1.1 primary bases: one thighstand group; mid-base stands on thighs with arms extended overhead',
      'FC; GRD-PK; VER-VER HSUP "S"/"L"; TWIST 180', NULL, 1,
      'FC; PK-GRD; VER HSUP "S"/"L"-VER; TWIST 360', 2, 9.70, 83),
    ('usag-at-pyramid-phs6', 'PHS6-S/L', 'Hand Support',
      '1.1.1 primary base in crab; mid-base stands with arms extended overhead',
      'FC; GRD-PK; VER-VER HSUP "S"/"L"; TWIST 180', NULL, 2,
      'FC; PK-GRD; VER HSUP "S"/"L"-VER; TWIST 180', 2, 9.80, 83),
    ('usag-at-pyramid-phs7', 'PHS7', 'Hand Support',
      '1.1.1 primary base standing; mid-base shoulder sit with arms extended overhead',
      'FC; SHD-PK; VER-VER HSUP "I"; TWIST 180', NULL, 2,
      'FC; PK-GRD; VER HSUP "I"-VER; TWIST 180', 2, 9.00, 84),
    ('usag-at-pyramid-phs8', 'PHS8', 'Hand Support',
      '2.1.1 primary bases: one thighstand group; mid-base stands on thighs with arms extended overhead',
      'FC; GRD-PK; VER-VER HSUP "I"; TWIST 180', NULL, 2,
      'FC; PK-GRD; VER HSUP "I"-VER; TWIST 180', 2, 9.10, 84),
    ('usag-at-pyramid-phs9', 'PHS9-S/L', 'Hand Support',
      '2.1.1 primary bases: one thighstand group; mid-base stands on thighs with arms extended overhead',
      'FC; GRD-PK; VER-VER HSUP "S"/"L"; TWIST 180', NULL, 2,
      'FC; PK-GRD; VER HSUP "S"/"L"-VER; TWIST 180', 2, 9.50, 84),
    ('usag-at-pyramid-phs10', 'PHS10', 'Hand Support',
      '1.1.1 primary base standing; mid-base shoulder sit with arms extended overhead',
      'FC; SHD-PK; VER-VER HSUP "I"; TWIST 180', NULL, 1,
      'FC; PK-GRD; VER HSUP "I"-VER; TWIST 180', 2, 9.50, 84),
    ('usag-at-pyramid-phs11', 'PHS11-S/L', 'Hand Support',
      '2.1.1 primary bases: one thighstand group; mid-base stands on thighs with arms extended overhead',
      'FC; GRD-PK; VER-VER HSUP "S"/"L"; TWIST 180; mid-base uses one hand', NULL, 1,
      'FC; PK-GRD; VER HSUP "S"/"L"-VER; TWIST 180', 2, 10.00, 84),
    ('usag-at-pyramid-phs12', 'PHS12', 'Hand Support',
      '1.1.1 primary base standing; mid-base shoulder sit with arms extended overhead',
      'FC; SHD-PK; VER-VER HSUP "I"', NULL, 1,
      'FC; PK-GRD; VER HSUP "I"-VER; TWIST 180', 1, 9.50, 84),
    ('usag-at-pyramid-phs13', 'PHS13', 'Hand Support',
      '2.1.1 primary bases: one thighstand group; mid-base stands on thighs with arms extended overhead',
      'FC; SHD-PK; VER-VER HSUP "I"', NULL, 1,
      'FC; PK-GRD; VER HSUP "I"-VER; TWIST 180', 2, 9.00, 84),
    ('usag-at-pyramid-phs14', 'PHS14', 'Hand Support',
      '2.1.1 primary bases: one thighstand group; mid-base stands on thighs with arms extended overhead',
      'FC; GRD-PK; VER-VER HSUP "S"; TWIST 180', NULL, 1,
      'FC; PK-CRDL; VER HSUP "S"-HOZ; FLIP 90', 2, 9.70, 84),
    ('usag-at-pyramid-phs15', 'PHS15', 'Hand Support',
      '1.1.1 primary base in crab; mid-base free-standing with arms at shoulder level',
      'FC; GRD-PK; VER-VER HSUP "S"; TWIST 180', NULL, 1,
      'FC; PK-CRDL; VER HSUP "S"-HOZ; FLIP 90', 2, 10.00, 84),
    ('usag-at-pyramid-phs16', 'PHS16-S/L', 'Hand Support',
      '1.1.1 primary base in crab; mid-base free-standing with arms at shoulder level',
      'FC; GRD-PK; VER-VER HSUP "S"/"L"; TWIST 180', NULL, 1,
      'FC; PK-GRD; VER HSUP "S"/"L"-VER; TWIST 360', 2, 10.00, 84),
    ('usag-at-pyramid-pv1', 'PV1', 'Vertical',
      '2.1.1 primary bases: one thighstand group; mid-base stands on thighs with arms at shoulder level',
      'FC; SHD-PK; VER-VER 2FT', NULL, 1,
      'FC; PK-CRDL; VER 2FT-HOZ; FLIP 270 (front flip off to cradle)', 2, 9.30, 85),
    ('usag-at-pyramid-pv2', 'PV2', 'Vertical',
      '1.1.1 primary base in crab; mid-base free-standing with arms at shoulder level',
      'FC; SHD-PK; VER-VER 2FT; TWIST 180', NULL, 2,
      'R; PK-CRDL; VER 2FT-HOZ; FLIP 270 (front flip off to cradle)', 2, 9.70, 85),
    ('usag-at-pyramid-pv3', 'PV3', 'Vertical',
      '4.2.1 primary bases: two thighstand groups; mid-bases stand on thighs with arms at shoulder level',
      'FC; BLW SHD-PK; VER-VER 2FT; TWIST 180', NULL, 2,
      'R; PK-CRDL; VER 2FT-HOZ; TWIST 180', 3, 9.50, 85),
    ('usag-at-pyramid-pv4', 'PV4', 'Vertical',
      '4.2.1 primary bases: two thighstand groups; mid-bases stand on thighs with arms at shoulder level',
      'FC; BLW SHD-PK; VER-VER 2FT; TWIST 180', 'FC; H-F; 2FT SHD-EXT', 2,
      'R; PK-CRDL; VER 2FT-HOZ; TWIST 180', 3, 9.80, 85),
    ('usag-at-pyramid-pv5', 'PV5', 'Vertical',
      '2.1.1 primary bases: one thighstand group; mid-base stands on thighs with arms at shoulder level',
      'FC; SHD-PK; VER-VER 2FT', NULL, 1,
      'FC; PK-CRDL; VER 2FT-HOZ; TWIST 180', 3, 9.40, 85),
    ('usag-at-pyramid-pi1', 'PI1', 'Inverted',
      '3.1.1 primary bases stand holding feet at shoulder level; two under half-extension and one supports rear seat; mid-base squats with arms extended overhead',
      'FC; BLW SHD-PK; VER-INV NON HS; INV 180', NULL, 2,
      'R; PK-CRDL; INV NON HS-HOZ; INV 90; TWIST 180', 2, 9.50, 86),
    ('usag-at-pyramid-pi2', 'PI2', 'Inverted',
      '2.2.1 primary bases standing; mid-bases in shoulder sits with arms extended overhead',
      'FC; SHD-PK; VER-INV NON HS; INV 180', NULL, 2,
      'FC; PK-GRD; INV NON HS-VER; INV 180', 2, 9.60, 86),
    ('usag-at-pyramid-pi3', 'PI3', 'Inverted',
      '2.2.1 primary bases in crab; mid-bases stand on thighs with arms extended overhead',
      'FC; GRD-PK; VER-INV NON HS; INV 180', NULL, 1,
      'R; PK-GRD; INV NON HS-VER; INV 180; TWIST 90', 1, 9.80, 86),
    ('usag-at-pyramid-pi4', 'PI4', 'Inverted',
      '1.2.1 primary base in crab; mid-bases free-standing on thighs and shoulders with arms extended overhead',
      'FC; GRD-PK; VER-INV NON HS; INV 180', NULL, 1,
      'R; PK-CRDL; INV NON HS-HOZ; FLIP 90', 2, 10.00, 86),
    ('usag-at-pyramid-pi5', 'PI5', 'Inverted',
      '3.1.1 primary bases: one thighstand and one support in back; mid-base stands on thighs with arms at shoulder level',
      'FC; GRD-PK; VER-VER 2FT; TWIST 180', 'H-H; VER 2FT-INV 2H HS; INV 180 (non-press)', 1,
      'FC; H-H; PK-CRDL; INV 2HS-HOZ; FLIP 90', 2, 10.00, 86),
    ('usag-at-pyramid-pi6', 'PI6', 'Inverted',
      '2.2.1 primary bases standing; mid-bases in shoulder sits with arms extended overhead',
      'FC; SHD-PK; VER-INV NON HS; INV 180', NULL, 3,
      'R; PK-CRDL; INV NON HS-HOZ; TWIST 180', 3, 9.70, 86)
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics',
    'discipline', 'Acrobatics & Tumbling',
    'event', 'Optional Pyramid',
    'program', 'Youth Acrobatics & Tumbling Development Program 2025–2026',
    'official_name', d.pyramid_number || ' - ' || d.category,
    'official_code', d.pyramid_number,
    'usa_gymnastics_levels', jsonb_build_array('Youth A&T Level 3', 'Youth A&T Level 4', 'Youth A&T Level 5'),
    'difficulty_value', to_char(d.start_value, 'FM90.00') || ' start value',
    'status', 'verified',
    'last_verified', '2026-07-25',
    'notation', jsonb_build_object(
      'structure', d.structure_text,
      'entry', d.entry_text,
      'modifier', d.modifier_text,
      'tossers', d.tossers,
      'dismount', d.dismount_text,
      'catchers', d.catchers
    ),
    'athlete_cues', jsonb_build_array(
      'Build the prescribed base structure before the entry; every athlete holds their assigned level, contact, and direction.',
      'Top: show the declared ' || lower(d.category) || ' peak shape for two seconds, then wait for the group count before the exact dismount.',
      'Bases and mid-bases: lift through legs and shoulders together, keep the structure square, track the top, and complete the stated catch.'
    ),
    'coach_checkpoints', jsonb_build_array(
      'Verify structure and roles exactly: ' || d.structure_text || '.',
      'Entry must match: ' || d.entry_text || CASE WHEN d.modifier_text IS NULL THEN '.' ELSE '. Modifier: ' || d.modifier_text || '.' END,
      'Require a static two-second peak, correct top shape/contact, stable base proximity, and the declared dismount with ' || d.catchers || ' catcher(s).',
      'For synchronized Level 4-5 Heat 2, the two pyramids must be identical in structure, entry, modifier, peak, and dismount.'
    ),
    'safety_and_readiness', jsonb_build_array(
      'Use only qualified pyramid coaches, complete role assignments, progressive height, regulation mats, and trained spot/catch plans.',
      'Every base tier must hold the isolated structure and every top must own the entry, peak shape, and dismount progression before building the full pyramid.',
      'Stop immediately for shifting base levels, lost grips, compressed shoulders, uncontrolled inversion, or an unclear catch path.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault', 'Bent arms or legs', 'deduction', 'Up to -0.3 per occurrence', 'cue', 'Extend every support and peak line.'),
      jsonb_build_object('fault', 'Incorrect body position or insufficient stretch', 'deduction', 'Up to -0.2 per category per occurrence', 'cue', 'Make the hand-support, vertical, or inverted position unmistakable.'),
      jsonb_build_object('fault', 'Failure to maintain two-second hold', 'deduction', 'Up to -0.2 per occurrence', 'cue', 'Start the count only when the top is static.'),
      jsonb_build_object('fault', 'Incorrect landing/catch posture', 'deduction', 'Up to -0.2 per occurrence', 'cue', 'Present the top and receive high before absorbing.'),
      jsonb_build_object('fault', 'Improper catch by bases', 'deduction', 'Up to -0.3 per occurrence', 'cue', 'Track and secure the declared catch together.'),
      jsonb_build_object('fault', 'Deviation from square/straight', 'deduction', 'Up to -0.3 per occurrence', 'cue', 'Stack each tier over the planned footprint.'),
      jsonb_build_object('fault', 'Base-structure proximity', 'deduction', '-0.1 per occurrence', 'cue', 'Maintain the prescribed spacing between structures.'),
      jsonb_build_object('fault', 'Lack of synchronization', 'deduction', 'Up to -0.3 per occurrence', 'cue', 'Match load, rise, hold count, release, and catch.'),
      jsonb_build_object('fault', 'Fall', 'deduction', '-0.5 per occurrence', 'cue', 'Regress height or complexity until stable.')
    ),
    'scoring_summary', 'Official listed start value: ' || to_char(d.start_value, 'FM90.00') ||
      '. Level 3 optional Pyramid is capped at 9.5; Level 4 at 9.7; Level 5 has no difficulty restriction. Peak and modifier elements require a two-second hold. Execution and neutral deductions apply under the current Code.',
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title', 'Teach ' || d.pyramid_number, 'purpose', 'learning',
        'description', 'Identify every role on screen, build the lowest tier first, show grips and load positions close-up, then add entry, two-second peak, modifier if any, and dismount. Use front, side, and overhead spacing views.'),
      jsonb_build_object('title', d.pyramid_number || ' - ideal competition model', 'purpose', 'model',
        'description', 'Show full speed and synchronized slow motion. Highlight exact structure, simultaneous rise, square stacking, static peak and hold count, declared dismount path, active tracking, and secure catch.')
    ),
    'next_progressions', '[]'::jsonb,
    'sources', jsonb_build_array(jsonb_build_object(
      'title', 'USA Gymnastics Youth Acrobatics & Tumbling Rules & Policies / Code of Points - Pyramid Table',
      'url', 'https://static.usagym.org/PDFs/gfa/at/25rp_cop.pdf#page=' || d.source_page,
      'organization', 'USA Gymnastics',
      'effective_cycle', '2025-2026',
      'accessed_on', '2026-07-25',
      'note', 'Official optional Pyramid number, structure, entry, modifier, tossers, dismount, catchers, and start value.'
    )),
    'editorial_note', 'Original coaching summary. No single direct progression is asserted because the official pyramid table branches by structure, contact, height, top shape, twist, and dismount.'
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
  'A&T Optional Pyramid ' || p.pyramid_number || ' - ' || p.category,
  p.slug,
  'An official Youth A&T optional ' || lower(p.category) || ' pyramid sequence valued at ' || to_char(p.start_value, 'FM90.00') || '.',
  'Build ' || p.structure_text || '. Perform entry ' || p.entry_text ||
    CASE WHEN p.modifier_text IS NULL THEN '. ' ELSE ', then modifier ' || p.modifier_text || '. ' END ||
    'Hold the peak for two seconds and perform dismount ' || p.dismount_text ||
    ' using ' || p.tossers || ' tosser(s) and ' || p.catchers || ' catcher(s).',
  (SELECT id FROM coaching.sport WHERE key = 'gymnastics'),
  CASE
    WHEN p.start_value <= 9.40 THEN 'INTERMEDIATE'::public.skill_level
    WHEN p.start_value <= 9.70 THEN 'ADVANCED'::public.skill_level
    ELSE 'ELITE'::public.skill_level
  END,
  'partner', 'execution', p.start_value,
  'Multi-tier optional pyramid; exact roles, hold, tossers, and catchers apply',
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
