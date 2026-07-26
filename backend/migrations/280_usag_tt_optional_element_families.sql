-- USA Gymnastics T&T Development Program 2025-2029, Tumbling Levels 8-Open.
-- Voluntary tumbling elements are parametric combinations of direction, somersault
-- rotation, twist, body position, and (for multiples) twist phase. These cards
-- represent every scoring family; the exact variant/value is calculated by rule.

WITH source_data (
  slug, official_name, base_value, description, instruction, predecessor, next_step
) AS (
  VALUES
    ('usag-tt-optional-support-elements', 'Cartwheel, aerial, handspring, and round-off family', '0.1',
      'All cartwheels, aerials, back handsprings, round-offs, and front handsprings used as voluntary tumbling elements; each carries 0.1 difficulty when completed to the feet.',
      'Drive through a long hurdle or connection, place or pass the shoulders over the support line, maintain straight legs and pointed toes, block through the floor, and finish at the exact rebound angle needed for the next element.',
      'usag-tt-cartwheel', 'usag-tt-whipback'),
    ('usag-tt-optional-whipback-family', 'Whipback family', '0.2',
      'All legal whipback connections; a whipback carries 0.2 difficulty and is one of the elements exempted from ordinary repetition treatment.',
      'Reach long from the preceding rebound, keep an open body through flight, snap the feet under only after the shoulders travel, land high through the forefoot, and preserve backward speed without turning it into a tucked salto.',
      'back-handspring', 'back-tuck'),
    ('usag-tt-optional-single-untwisted-salto', 'Single untwisted somersault family', '0.5 back / 0.6 front, plus position bonus',
      'Every front, back, or side single somersault without twist in tuck, pike, or straight position. Each 360 degrees of somersault is 0.5, front receives 0.1, and pike/straight untwisted singles receive a 0.1 position bonus.',
      'Convert the connection into upward flight, set the chosen direction, show one unambiguous tuck, pike, or straight shape, open before the landing line, and finish on two feet with the torso controlled.',
      'back-tuck', 'usag-tt-optional-single-twisting-salto'),
    ('usag-tt-optional-single-twisting-salto', 'Single twisting somersault family', 'Somersault value + twist value',
      'Every front, back, or side single somersault with continuous twist in half-turn increments. Each half twist is 0.2 through two twists, 0.3 beyond two twists, and 0.4 beyond three twists; twist must continue in one direction.',
      'Create the salto axis before pulling the twist, keep the body long and centered, count exact half-turn increments, avoid reversing direction, spot after the final half turn, and complete rotation before the two-foot landing.',
      'usag-tt-optional-single-untwisted-salto', 'usag-tt-optional-double-twisting-salto'),
    ('usag-tt-optional-double-untwisted-salto', 'Double untwisted somersault family', 'Doubled element value; +0.1 pike / +0.2 straight before doubling',
      'Every front or back double somersault without twist in tuck, pike, straight, or—at Levels 10/Open—split-leg straight (Y) position.',
      'Rise before the first turnover, maintain the declared shape through both somersault phases, keep the axis traveling down the track, open with enough height to finish the second rotation, and land on two feet without collapse.',
      'usag-tt-optional-single-untwisted-salto', 'usag-tt-optional-double-twisting-salto'),
    ('usag-tt-optional-double-twisting-salto', 'Double twisting somersault family', 'Doubled sum of somersault, twist, and position values',
      'Every front or back double somersault with twist distributed through its two recognized phases. Half-twist increments add 0.1 through one twist, 0.2 beyond one, 0.3 beyond two, and 0.4 beyond three before the total element value is doubled.',
      'Declare twist in each phase, set the salto first, finish each phase on its planned count, keep the axis centered, show the body position outside permitted twisting adjustments, and open only after the final rotation/twist is complete.',
      'usag-tt-optional-double-untwisted-salto', 'usag-tt-optional-triple-salto'),
    ('usag-tt-optional-double-y-salto', 'Double split-leg straight (Y) somersault family', 'Straight double value',
      'Level 10/Open double somersaults, with or without twist, performed in the straight split-leg Y position. At least 60 degrees of leg separation is required and the legs must close by body-horizontal on descent.',
      'Establish a true straight double axis, open both legs symmetrically to at least 60 degrees without piking, close them together by the 3-o’clock body position, finish any twist, and prepare a two-foot landing.',
      'usag-tt-optional-double-untwisted-salto', NULL),
    ('usag-tt-optional-triple-salto', 'Triple somersault family', 'Tripled sum of somersault, twist, and position values',
      'Every permitted front or back triple somersault in tuck, pike, or straight position, with twist declared by somersault phase. Pike adds 0.2 and straight adds 0.4 before tripling; twist increments use 0.3 up to one twist and 0.4 beyond one.',
      'Use an elite-level rising set, maintain a precise phase plan through all three somersaults, preserve the declared shape and longitudinal axis, complete twist in the declared phase, and open with sufficient height for a controlled two-foot landing.',
      'usag-tt-optional-double-twisting-salto', NULL)
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics',
    'discipline', 'Trampoline & Tumbling',
    'event', 'Tumbling',
    'program', 'T&T Development Program 2025-2029 - Levels 8, 9, 10, Open',
    'official_name', d.official_name,
    'official_code', d.base_value,
    'usa_gymnastics_levels', jsonb_build_array('T&T Level 8','T&T Level 9','T&T Level 10','T&T Open'),
    'status', 'verified',
    'last_verified', '2026-07-25',
    'prerequisites', CASE WHEN d.predecessor IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('slug',d.predecessor,'relationship','developmental predecessor')) END,
    'next_progressions', CASE WHEN d.next_step IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('slug',d.next_step,'relationship','direct family progression')) END,
    'athlete_cues', jsonb_build_array(d.instruction, 'Land every counted element on the feet, preserve direction down the track, and make tuck, pike, straight, twist, and phase choices visually unmistakable.'),
    'coach_checkpoints', jsonb_build_array(
      d.description, d.instruction,
      'Calculate the exact variant from somersault direction/rotation, half-twist count, body position, and twist phase. Apply the level/pass element-DD cap before routine construction.',
      'An element is distinct when its rotation, body position, or recognized twist phase differs under the repetition rules.'
    ),
    'safety_and_readiness', jsonb_build_array(
      'Use a qualified power-tumbling coach, rod/fiberglass track progressions, pits and landing mats, appropriate hand spotting or belts, and a documented emergency plan.',
      'Prove the takeoff connection, straight and shaped timers, rotation, twist phase, opening, and landing separately before assembling the full element.',
      'Multiple somersaults and high-twist variants are advanced/elite skills; do not infer readiness from the level label or difficulty value alone.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault','Legs/feet separated or feet not pointed','deduction','0.1-0.2 per element','cue','Zip inner legs and finish through the toes.'),
      jsonb_build_object('fault','Incorrect tuck, pike, or straight angles / failure to hold shape','deduction','Up to 0.5 per element under execution criteria; D judge may recognize the less difficult position','cue','Show one clear shape before the 1-o’clock recognition point.'),
      jsonb_build_object('fault','Twist reversal in a single somersault','deduction','No difficulty for the element; possible additional -2.0 requirement penalty','cue','Twist continuously in one direction.'),
      jsonb_build_object('fault','Repeated element within/across the two routines','deduction','No difficulty; possible -2.0 if routine minimum is then missed','cue','Audit preceding element, shape, rotation, and phase identity.'),
      jsonb_build_object('fault','Element exceeds pass maximum DD','deduction','Routine interruption at that element plus CJP consequences','cue','Check Level 8/9/10/Open element caps before competition.'),
      jsonb_build_object('fault','Landing touch with hands','deduction','0.5; 1.0 if hands support the body','cue','Finish rotation high enough to absorb through the legs.'),
      jsonb_build_object('fault','Fall to knees, hands-and-knees, seat, front, or back','deduction','1.0','cue','Open and square before contacting the landing zone.'),
      jsonb_build_object('fault','Leaves landing zone/track after landing','deduction','1.0','cue','Control horizontal speed and stick within the marked area.')
    ),
    'scoring_summary', 'Difficulty is calculated from somersault rotation, direction, half-twist increments, body-position bonus, and—on multiples—the declared phase and multiplier. Level 8 caps are 0.9/1.3; Level 9 0.9/2.2; Level 10 3.2; Open 4.8. Completed routines that miss or exceed a requirement receive -2.0 per occurrence; repeats receive no difficulty.',
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title','Build ' || d.official_name,'purpose','learning','description','Show the prerequisite connection, timer, body-shape station, rotation progression, twist-phase drill, pit landing, competition landing, and exact DD calculation. Use side, end, and overhead slow motion.'),
      jsonb_build_object('title',d.official_name || ' - ideal power-tumbling model','purpose','model','description','Show continuous full-speed pass context and isolated slow motion. Overlay direction, somersault count, twist by phase, body-position angles, DD, axis travel, opening point, and two-foot landing control.')
    ),
    'sources', jsonb_build_array(
      jsonb_build_object('title','USA Gymnastics T&T Development Program Code of Points - Tumbling 2025-2029','url','https://static.usagym.org/PDFs/T%26T/Rules/devcop/tu.pdf#page=11','organization','USA Gymnastics','effective_cycle','2025-2029','accessed_on','2026-07-25','note','Official difficulty formulas, body-position definitions, repetition rules, execution faults, and Level 8-Open requirements.'),
      jsonb_build_object('title','USA Gymnastics T&T Rules','url','https://usagym.org/tt/rules/','organization','USA Gymnastics','effective_cycle','current','accessed_on','2026-07-25','note','Current rules landing page and updates.')
    ),
    'editorial_note', 'Parametric family card: every exact voluntary variant is produced by the official direction/rotation/twist/shape/phase formula and bounded by the level/pass difficulty cap.'
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
  'T&T Optional - ' || p.official_name, p.slug, p.description, p.instruction,
  (SELECT id FROM coaching.sport WHERE key = 'gymnastics'),
  'ELITE'::public.skill_level, 'individual', 'execution', 10,
  'Levels 8-Open parametric voluntary element family; base/formula ' || p.base_value,
  TRUE, 'facility', p.metadata
FROM prepared p
ON CONFLICT (facility_id, slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, instructions = EXCLUDED.instructions,
  sport_id = EXCLUDED.sport_id, skill_level = EXCLUDED.skill_level,
  skill_kind = EXCLUDED.skill_kind, evaluation_mode = EXCLUDED.evaluation_mode,
  execution_max_score = EXCLUDED.execution_max_score, assistance_note = EXCLUDED.assistance_note,
  is_published = EXCLUDED.is_published, visibility = EXCLUDED.visibility,
  official_metadata = EXCLUDED.official_metadata, updated_at = NOW();
