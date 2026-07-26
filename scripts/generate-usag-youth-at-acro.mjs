import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const [rowsPath, jsonPath, sqlPath] = process.argv.slice(2)
if (!rowsPath || !jsonPath || !sqlPath) {
  console.error('usage: node scripts/generate-usag-youth-at-acro.mjs ROWS.tsv OUTPUT.json OUTPUT.sql')
  process.exit(2)
}

function normalizeNotation(value) {
  return value
    .replace(/^(\d-\d)\s+(FC|R);/, '$1; $2;')
    .replace(/\|+$/g, '')
    .replace(/\bBaze\b/gi, 'Base')
    .replace(/\bFC:/g, 'FC;')
    .replace(/\bR:/g, 'R;')
    .replace(/\bTWIST\s*180\b/g, 'TWIST 180')
    .replace(/\bINV180\b/g, 'INV 180')
    .replace(/\b2FT\b/g, '2 FT')
    .replace(/\b1FT\b/g, '1 FT')
    .replace(/HSUP\s+"(?:!|'|1'?|_L|\[)"/g, (match) => match.includes('_L') || match.includes('[') ? 'HSUP "L"' : 'HSUP "I"')
    .replace(/HSUP\s+"1'+/g, 'HSUP "I"')
    .replace(/HSUP\s+"'+S"/g, 'HSUP "S"')
    .replace(/HSUP\s+"(?:s|g|5)"/g, 'HSUP "S"')
    .replace(/HSUP\s+"([LSI])(?=\s*-)/g, 'HSUP "$1"')
    .replace(/HSUP\s+"([LSI])\s*-/g, 'HSUP "$1"-')
    .replace(/\s+-\s*2 FT/g, '-2 FT')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s+/g, ' ')
    .trim()
}

const parsed = fs.readFileSync(rowsPath, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line, index) => {
    const [numberText, ...notationParts] = line.split('\t')
    let elementNumber = Number(numberText)
    if (elementNumber === 259 && notationParts.join('\t').includes('FLIP 360 B (Layout)')) elementNumber = 959

    const notation = normalizeNotation(notationParts.join('\t'))
    const hundred = Math.floor(elementNumber / 100)
    const descending = elementNumber >= 500
    const band = descending ? hundred - 5 : hundred
    const difficultyLetter = ['A', 'B', 'C', 'D', 'E'][band]
    if (!difficultyLetter) throw new Error(`Unsupported element number ${elementNumber} on row ${index + 1}`)

    return {
      elementNumber,
      notation,
      direction: descending ? 'Descending' : 'Ascending',
      difficultyLetter,
      eventValue: Number(((band + 1) * 0.2).toFixed(1)),
      teamValue: Number((9.2 + band * 0.2).toFixed(1)),
      sourcePage: elementNumber < 300 ? 79 : elementNumber < 600 ? 80 : 81,
    }
  })

const seen = new Map()
for (const row of parsed) {
  const occurrence = (seen.get(row.elementNumber) ?? 0) + 1
  seen.set(row.elementNumber, occurrence)
  row.slug = `usag-at-acro-element-${row.elementNumber}${occurrence > 1 ? `-${occurrence}` : ''}`
}

fs.writeFileSync(jsonPath, `${JSON.stringify({
  source: 'https://static.usagym.org/PDFs/gfa/at/25rp_cop.pdf#page=79',
  effectiveCycle: '2025-2026',
  extractedOn: '2026-07-25',
  note: 'Official factual notation extracted from rendered Code pages 79-81 and normalized against the page images.',
  elements: parsed,
}, null, 2)}\n`)

const sqlQuote = (value) => `'${String(value).replaceAll("'", "''")}'`
const values = parsed.map((row) => `    (${[
  row.elementNumber,
  sqlQuote(row.slug),
  sqlQuote(row.notation),
  sqlQuote(row.direction),
  sqlQuote(row.difficultyLetter),
  row.eventValue.toFixed(1),
  row.teamValue.toFixed(1),
  row.sourcePage,
].join(', ')})`).join(',\n')

const sql = `-- USA Gymnastics Youth Acrobatics & Tumbling Development Program.
-- Complete 2025-26 optional Acro ascending/descending element tables, pages 79-81.
-- Official notation is factual data; all explanatory coaching prose is original.

WITH source_data (
  element_number, slug, notation, direction, difficulty_letter,
  event_value, team_value, source_page
) AS (
  VALUES
${values}
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics',
    'discipline', 'Acrobatics & Tumbling',
    'event', 'Optional Acro',
    'program', 'Youth Acrobatics & Tumbling Development Program 2025-2026',
    'official_name', d.direction || ' Acro Element ' || d.element_number,
    'official_code', d.element_number::text,
    'official_notation', d.notation,
    'usa_gymnastics_levels', CASE d.difficulty_letter
      WHEN 'A' THEN jsonb_build_array('Youth A&T Level 3', 'Youth A&T Level 4', 'Youth A&T Level 5')
      WHEN 'B' THEN jsonb_build_array('Youth A&T Level 3', 'Youth A&T Level 4', 'Youth A&T Level 5')
      WHEN 'C' THEN jsonb_build_array('Youth A&T Level 4 (restricted to B value)', 'Youth A&T Level 5')
      ELSE jsonb_build_array('Youth A&T Level 5')
    END,
    'difficulty_value', d.difficulty_letter || ' element: event value ' ||
      to_char(d.event_value, 'FM0.0') || '; Team value ' || to_char(d.team_value, 'FM0.0'),
    'status', 'verified',
    'last_verified', '2026-07-25',
    'athlete_cues', jsonb_build_array(
      'Read every field in the declared notation before training: base count, contact, start and finish levels, top orientation/shape, inversion, twist, and release status.',
      CASE WHEN d.direction = 'Ascending'
        THEN 'Build from stable contacts, coordinate the rise, keep the top stacked through the declared pathway, and finish in the exact peak position.'
        ELSE 'Begin from a stable recognized peak, hold until the shared count, follow the exact descent pathway, and finish in the declared ground or cradle position.'
      END
    ),
    'coach_checkpoints', jsonb_build_array(
      'Tariff and performed element must match official element ' || d.element_number || ': ' || d.notation || '.',
      'Verify base count and roles, full-contact versus release, start/end height, top body position, hand/foot contact, inversion degrees, twist degrees, and final catch or landing.',
      'Static positions must be recognizable and held for two seconds; the count begins only when the position is motionless.',
      'For synchronized sequences, groups must be identical and match entry, contacts, tempo, peak, transition, and dismount.'
    ),
    'safety_and_readiness', jsonb_build_array(
      'Use qualified Acro coaches, complete role assignments, progressive surfaces, trained spot/catch plans, and regulation spacing.',
      'Every athlete must own the isolated base position, top shape, contact, entry, transition, and dismount before connecting the full element.',
      'Stop for shifting grips, collapsed support, uncontrolled inversion, mistimed release, loss of line, or an unclear landing/catch path.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault', 'Bent arms or legs', 'deduction', 'Up to -0.3 per occurrence', 'cue', 'Extend support and top shapes.'),
      jsonb_build_object('fault', 'Leg/foot separation', 'deduction', 'Up to -0.2 per occurrence', 'cue', 'Use the exact declared leg relationship.'),
      jsonb_build_object('fault', 'Under/over rotation or insufficient amplitude', 'deduction', 'Up to -0.3 per category per occurrence', 'cue', 'Create height and complete rotation before the finish.'),
      jsonb_build_object('fault', 'Incorrect body position or insufficient stretch', 'deduction', 'Up to -0.2 per category per occurrence', 'cue', 'Make the declared vertical, horizontal, hand-support, or inverted shape unmistakable.'),
      jsonb_build_object('fault', 'Failure to maintain two-second hold', 'deduction', 'Up to -0.2 per occurrence', 'cue', 'Count only after the position is static.'),
      jsonb_build_object('fault', 'Incorrect landing/catch posture', 'deduction', 'Up to -0.2 per occurrence', 'cue', 'Present the top and receive in the declared position.'),
      jsonb_build_object('fault', 'Improper catch by bases', 'deduction', 'Up to -0.3 per occurrence', 'cue', 'Track and secure the contact together.'),
      jsonb_build_object('fault', 'Deviation from square/straight', 'deduction', 'Up to -0.3 per occurrence', 'cue', 'Keep the element on its planned axis.'),
      jsonb_build_object('fault', 'Lack of continuity', 'deduction', 'Up to -0.2 per occurrence', 'cue', 'Use one coordinated pathway without a pause.'),
      jsonb_build_object('fault', 'Lack of synchronization', 'deduction', 'Up to -0.3 per occurrence', 'cue', 'Match load, rise/descent, peak, and finish.'),
      jsonb_build_object('fault', 'Fall', 'deduction', '-0.5 per occurrence', 'cue', 'Regress until every role is reliable.')
    ),
    'scoring_summary', d.difficulty_letter || ' element. Individual Acro event contribution: ' ||
      to_char(d.event_value, 'FM0.0') || '; published Team value: ' || to_char(d.team_value, 'FM0.0') ||
      '. Level 3 allows A-B; Level 4 allows A-B and restricted C elements valued as B; Level 5 has no difficulty restriction. Execution and neutral deductions apply under the current Code.',
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title', 'Teach Acro Element ' || d.element_number, 'purpose', 'learning',
        'description', 'Label every role and notation field on screen. Show grips and start position close-up, isolate the top pathway and base action, then connect the full element on progressive surfaces from front, side, and overhead views.'),
      jsonb_build_object('title', 'Acro Element ' || d.element_number || ' - ideal model', 'purpose', 'model',
        'description', 'Show full speed and synchronized slow motion. Highlight exact contacts, square stacking, extension, amplitude, inversion/twist completion, two-second hold when applicable, and the declared landing or catch.')
    ),
    'next_progressions', '[]'::jsonb,
    'sources', jsonb_build_array(jsonb_build_object(
      'title', 'USA Gymnastics Youth Acrobatics & Tumbling Rules & Policies / Code of Points - Acro Table',
      'url', 'https://static.usagym.org/PDFs/gfa/at/25rp_cop.pdf#page=' || d.source_page,
      'organization', 'USA Gymnastics',
      'effective_cycle', '2025-2026',
      'accessed_on', '2026-07-25',
      'note', 'Official optional Acro element number, notation, direction, and A-E value.'
    )),
    'editorial_note', 'Original coaching summary. No single direct progression is asserted because the table branches by base count, contact, height, top shape, inversion, twist, release, and dismount.'
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
  'A&T Optional Acro ' || p.element_number || ' - ' || p.direction || ' ' || p.difficulty_letter,
  p.slug,
  'Official Youth A&T ' || lower(p.direction) || ' Acro element ' || p.element_number ||
    ', valued ' || to_char(p.event_value, 'FM0.0') || ' in the Acro event.',
  'Declare and perform every component of the official notation exactly: ' || p.notation ||
    '. Establish safe contacts, coordinate the pathway, show the required position and hold, and complete the declared finish under control.',
  (SELECT id FROM coaching.sport WHERE key = 'gymnastics'),
  CASE p.difficulty_letter
    WHEN 'A' THEN 'INTERMEDIATE'::public.skill_level
    WHEN 'B' THEN 'INTERMEDIATE'::public.skill_level
    WHEN 'C' THEN 'ADVANCED'::public.skill_level
    ELSE 'ELITE'::public.skill_level
  END,
  'partner', 'execution', 10,
  'Optional Acro element; exact tariff notation and level restrictions apply',
  TRUE, 'facility', p.metadata
FROM prepared p
ON CONFLICT (facility_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  skill_level = EXCLUDED.skill_level,
  assistance_note = EXCLUDED.assistance_note,
  official_metadata = EXCLUDED.official_metadata,
  updated_at = NOW();
`

fs.writeFileSync(sqlPath, sql)
console.log(`Generated ${parsed.length} Acro elements`)
