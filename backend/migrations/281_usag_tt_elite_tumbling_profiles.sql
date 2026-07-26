-- USA Gymnastics Elite T&T 2025-2029: tumbling level overlays.
-- Exact moves use the eight voluntary-element family cards from migration 280;
-- these four cards attach the division-specific eligibility, caps, and penalties.

WITH source_data (
  slug, division, age, max_dd, requirements, bonus_rule, predecessor
) AS (
  VALUES
    ('usag-tt-youth-elite-11-12-tumbling', 'Youth Elite 11-12', '11-12', '2.8',
      'Two 8-element routines. Both finish with a somersault, include at least four somersaults, and contain one double somersault; routine 2 also requires a somersault with at least 360 degrees of twist.',
      'For both sexes, the second and each additional element valued at least 2.0 receives +2.0 difficulty.', 'usag-tt-optional-double-untwisted-salto'),
    ('usag-tt-youth-elite-13-14-tumbling', 'Youth Elite 13-14', '13-14', '4.3',
      'Two 8-element routines. Both finish with a somersault, include at least four somersaults, and contain one double somersault; routine 2 also requires a somersault with at least 360 degrees of twist.',
      'For both sexes, the second and each additional element valued at least 2.0 receives +2.0 difficulty.', 'usag-tt-youth-elite-11-12-tumbling'),
    ('usag-tt-junior-elite-tumbling', 'Junior Elite', '15-16', '4.3',
      'Two 8-element routines. Both finish with a somersault, include at least four somersaults, and contain one double somersault; routine 2 also requires a somersault with at least 360 degrees of twist.',
      'For both sexes, the second and each additional element valued at least 2.0 receives +2.0 difficulty.', 'usag-tt-youth-elite-13-14-tumbling'),
    ('usag-tt-senior-intermediate-elite-tumbling', 'Senior / Intermediate Elite', '17+ / 17-21', 'No USA special cap',
      'Two 8-element routines, each ending in a somersault. No element may repeat across the two routines in the applicable round; one reverse-direction element is permitted only as the last element.',
      'Women: second and later elements valued at least 2.0 receive +2.0. Men: second and later elements valued at least 4.4 receive +1.0.', 'usag-tt-junior-elite-tumbling')
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body','USA Gymnastics / FIG',
    'discipline','Trampoline & Tumbling',
    'event','Elite Tumbling',
    'program','USA Gymnastics Elite T&T 2025-2029',
    'official_name',d.division || ' Tumbling',
    'official_code','Age ' || d.age || '; maximum element DD ' || d.max_dd,
    'usa_gymnastics_levels',jsonb_build_array(d.division),
    'status','verified',
    'last_verified','2026-07-25',
    'prerequisites',jsonb_build_array(jsonb_build_object('slug',d.predecessor,'relationship','division or element-family predecessor')),
    'next_progressions','[]'::jsonb,
    'athlete_cues',jsonb_build_array('Know the identity and DD of every element across both routines.', d.requirements, d.bonus_rule),
    'coach_checkpoints',jsonb_build_array(
      d.requirements, d.bonus_rule,
      'Use the FIG 2025-2028 Tumbling element definitions and USA elite repetition rules. Elements/routines from qualification may repeat in finals, but the round-specific two-routine audit still applies.'
    ),
    'safety_and_readiness',jsonb_build_array(
      'Elite division eligibility does not establish physical readiness. Use qualified elite power-tumbling coaches, progressive tracks/pits, landing systems, spotting aids, and medical/emergency planning.',
      'Select exact variants from the voluntary-element family cards only after proven connection, rotation, twist-phase, opening, and landing consistency.'
    ),
    'common_faults',jsonb_build_array(
      jsonb_build_object('fault','Routine requirement missed or exceeded','deduction','-2.0 per violation','cue','Audit eight elements, final salto, double, somersault count, twist requirement, and direction.'),
      jsonb_build_object('fault','Repeated element across the two routines in a round','deduction','No difficulty / applicable repetition consequence','cue','Audit exact element identity and permitted exceptions.'),
      jsonb_build_object('fault','Youth/Junior element exceeds maximum DD','deduction','Difficulty capped at division maximum','cue','11-12 cap 2.8; 13-14/Junior cap 4.3.'),
      jsonb_build_object('fault','Execution, interruption, boundary, or landing error','deduction','Per FIG Code and USA special requirements','cue','Apply the performed-element and landing criteria.')
    ),
    'scoring_summary',d.requirements || ' ' || d.bonus_rule || ' A -2.0 penalty applies for each routine-requirement violation; execution, difficulty, repetition, interruption, direction, boundary, and landing rules also apply.',
    'video_briefs',jsonb_build_array(
      jsonb_build_object('title','Build a legal ' || d.division || ' tumbling pair','purpose','learning','description','Walk through both eight-element routine cards, label every element family and DD, mark the double/twist/final-salto requirements, then show safe staged pass construction and repetition auditing.'),
      jsonb_build_object('title',d.division || ' ideal competition model','purpose','model','description','Show two complete routines with element-by-element notation, DD, bonus eligibility, direction, execution checkpoints, landing-zone control, and a final compliance summary.')
    ),
    'sources',jsonb_build_array(
      jsonb_build_object('title','USA Gymnastics U.S. Elite T&T Special Requirements 2025-2029','url','https://static.usagym.org/PDFs/T%26T/Rules/cop_elite.pdf#page=19','organization','USA Gymnastics','effective_cycle','2025-2029','accessed_on','2026-07-25','note','Elite tumbling divisions, routines, element caps, bonus, repetition, and penalties.'),
      jsonb_build_object('title','FIG Trampoline Gymnastics Code of Points 2025-2028 - Tumbling','url','https://www.gymnastics.sport/publicdir/rules/files/en_1.1%20-%20TRA%20CoP%202025-2028.pdf','organization','FIG / World Gymnastics','effective_cycle','2025-2028','accessed_on','2026-07-25','note','Governing elite element and execution rules incorporated by USA Gymnastics.'),
      jsonb_build_object('title','USA Gymnastics T&T Rules','url','https://usagym.org/tt/rules/','organization','USA Gymnastics','effective_cycle','current','accessed_on','2026-07-25','note','Current official rules landing page.')
    ),
    'editorial_note','Division overlay card; select exact skills from the parametric optional-element family cards.'
  ) metadata
  FROM source_data d
)
INSERT INTO coaching.skill (
  facility_id, name, slug, description, instructions, sport_id, skill_level,
  skill_kind, evaluation_mode, execution_max_score, assistance_note,
  is_published, visibility, official_metadata
)
SELECT
  (SELECT id FROM public.facility ORDER BY id LIMIT 1),
  'T&T - ' || p.division || ' Tumbling', p.slug, p.requirements,
  'Construct two legal eight-element passes from the official voluntary-element families, then audit direction, repetition, difficulty cap, required saltos, twist, bonus, and landing.',
  (SELECT id FROM coaching.sport WHERE key='gymnastics'),
  'ELITE'::public.skill_level, 'individual', 'execution', 10,
  'Elite division profile; maximum element DD ' || p.max_dd,
  TRUE, 'facility', p.metadata
FROM prepared p
ON CONFLICT (facility_id, slug) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, instructions=EXCLUDED.instructions,
  sport_id=EXCLUDED.sport_id, skill_level=EXCLUDED.skill_level, skill_kind=EXCLUDED.skill_kind,
  evaluation_mode=EXCLUDED.evaluation_mode, execution_max_score=EXCLUDED.execution_max_score,
  assistance_note=EXCLUDED.assistance_note, is_published=EXCLUDED.is_published,
  visibility=EXCLUDED.visibility, official_metadata=EXCLUDED.official_metadata, updated_at=NOW();
