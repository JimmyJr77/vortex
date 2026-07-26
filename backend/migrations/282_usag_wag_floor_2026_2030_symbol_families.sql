-- USA Gymnastics Women's Artistic Development Program Optional Floor 2026-2030.
-- Complete official Floor Exercise symbol inventory: Groups 1-8, 44 numbered
-- families. Each row covers every value-part variant drawn in that symbol family.

WITH source_data (
  slug, group_no, family_no, family_name, category, value_range, description, predecessor
) AS (
  VALUES
    ('wag-fx-g1-01',1,1,'Split leap and split jump','Leaps, jumps, and hops','A-B','Split-position leaps and jumps, including the official takeoff, landing, and leg-change variants.','usag-acro-rear-scale'),
    ('wag-fx-g1-02',1,2,'Switch split leap','Leaps, jumps, and hops','B-D','Switch-leg split leaps and their turn/ring variants.','wag-fx-g1-01'),
    ('wag-fx-g1-03',1,3,'Side split leap','Leaps, jumps, and hops','B','Side-split leap variants with the torso and hips oriented as shown by the official symbols.','wag-fx-g1-01'),
    ('wag-fx-g1-04',1,4,'Straddle and straddle-pike jump','Leaps, jumps, and hops','A-D','Straddle and straddle-pike jumps/leaps, including turn and ring-shape variants.','wag-fx-g1-01'),
    ('wag-fx-g1-05',1,5,'Switch-side and turning straddle leap','Leaps, jumps, and hops','C','Switch-side/turning straddle leap variants requiring the prescribed leg action and split line.','wag-fx-g1-04'),
    ('wag-fx-g1-06',1,6,'Ring leap and ring jump','Leaps, jumps, and hops','B-C','Ring-position leap/jump variants with the required head, upper-back, and rear-leg relationship.','wag-fx-g1-01'),
    ('wag-fx-g1-07',1,7,'Split jump with turn','Leaps, jumps, and hops','B-D','Split jumps and leaps with longitudinal turn, valued by the exact turn shown.','wag-fx-g1-01'),
    ('wag-fx-g1-08',1,8,'Switch-ring and turning ring leap','Leaps, jumps, and hops','B-D','Switch-ring and turning ring-shape leap variants.','wag-fx-g1-06'),
    ('wag-fx-g1-09',1,9,'One-leg hop family','Leaps, jumps, and hops','A-D','Hops from one foot with the free leg in the official forward, side, or rear positions and optional turn.','usag-acro-front-attitude-scale'),
    ('wag-fx-g1-10',1,10,'Stag and turning stag leap','Leaps, jumps, and hops','A-D','Stag-shape leaps/hops and their turning or ring-related variants.','wag-fx-g1-01'),
    ('wag-fx-g1-11',1,11,'Tuck and turning tuck jump','Leaps, jumps, and hops','B-D','Tuck jumps and turning tuck-jump variants, with hips/knees lifted to the required shape.','wag-fx-g1-04'),
    ('wag-fx-g1-12',1,12,'Wolf jump and turning wolf jump','Leaps, jumps, and hops','A-D','Wolf jumps/hops with the free leg extended and optional longitudinal turn.','wag-fx-g1-11'),
    ('wag-fx-g1-13',1,13,'Cat leap and turning cat leap','Leaps, jumps, and hops','A-D','Cat-leap variants showing the prescribed alternating bent-leg action and optional turn.','wag-fx-g1-09'),
    ('wag-fx-g1-14',1,14,'Leg-horizontal hop and turn','Leaps, jumps, and hops','A-E','Hops with the free leg held at the prescribed horizontal line, valued by leg direction and turn amount.','wag-fx-g1-09'),
    ('wag-fx-g1-15',1,15,'Scissor and split-change jump','Leaps, jumps, and hops','A-D','Scissor/split-change jump families, including turn variants.','wag-fx-g1-01'),
    ('wag-fx-g1-16',1,16,'Switch-ring and advanced split-change leap','Leaps, jumps, and hops','B-E','Advanced switch, split-change, ring, and turning combinations shown in family 1.16.','wag-fx-g1-02'),

    ('wag-fx-g2-01',2,1,'Upright turn on one foot','Turns','A-E','Turns on one foot in an upright position, valued by the completed longitudinal rotation.','usag-acro-front-attitude-scale'),
    ('wag-fx-g2-02',2,2,'Turn with free leg forward or side','Turns','B-D','One-foot turns with the free leg held forward or side at the prescribed height.','wag-fx-g2-01'),
    ('wag-fx-g2-03',2,3,'Turn with free leg high / split','Turns','B-D','One-foot turns with a high free leg or split relationship, valued by position and rotation.','wag-fx-g2-02'),
    ('wag-fx-g2-04',2,4,'Turn with rear leg in attitude or ring','Turns','B-D','Attitude/ring-position turns with the rear leg bent and the declared rotation completed in relevé.','wag-fx-g2-02'),
    ('wag-fx-g2-05',2,5,'Low turn to floor','Turns','A-D','Low-level turns that descend to or pass through the prescribed floor-supported position.','wag-fx-g2-01'),
    ('wag-fx-g2-06',2,6,'Wolf turn','Turns','B-E','Wolf turns in low squat with the free leg extended, valued by completed rotation.','wag-fx-g2-05'),
    ('wag-fx-g2-07',2,7,'Illusion turn','Turns','B-C','Illusion-turn variants with the torso and free leg passing through the required vertical relationship.','wag-fx-g2-02'),
    ('wag-fx-g2-08',2,8,'Heel-supported and specialty turn','Turns','B-D','Heel-supported and specialty one-foot turn variants shown in family 2.08.','wag-fx-g2-01'),

    ('wag-fx-g3-01',3,1,'Handstand, press, and pirouette family','Non-flight acrobatics','A-B','Handstands, presses, leg-position changes, and handstand pirouette variants represented by Group 3.01.','handstand'),
    ('wag-fx-g4-01',4,1,'Forward handspring and forward walkover family','Forward acrobatics with hand support','A-C','Forward walkovers, front handsprings, step-out and turning variants with hand support.','front-handspring'),
    ('wag-fx-g4-02',4,2,'Backward extension and backward walkover family','Backward acrobatics with hand support','A-B','Backward rolls/extensions, back walkovers, and related hand-supported backward transitions.','usag-acro-synchronized-bridge'),
    ('wag-fx-g5-01',5,1,'Round-off and back-handspring family','Side/backward flight with hand support','A-B','Round-offs, back handsprings, step-outs, and connected hand-supported backward flight variants.','round-off'),
    ('wag-fx-g5-02',5,2,'Aerial cartwheel and side aerial family','Aerials and no-hand flight','A-C','Cartwheel/side aerial variants with or without hand support and optional turn.','usag-acro-power-entry-cartwheel'),
    ('wag-fx-g5-03',5,3,'Forward aerial and turning aerial family','Aerials and no-hand flight','A-C','Forward aerial/walkover-flight and turning aerial variants.','front-handspring'),
    ('wag-fx-g5-04',5,4,'Cartwheel and specialty side-support family','Side acrobatics','A','Cartwheel and specialty side-support elements shown in family 5.04.','usag-acro-synchronized-cartwheel'),
    ('wag-fx-g5-05',5,5,'Dive and shoulder-roll acrobatics','Non-salto flight/roll','A','Dive, shoulder-roll, and related low-flight acrobatic variants.','usag-acro-synchronized-forward-roll'),
    ('wag-fx-g5-06',5,6,'Back walkover, valdez, and kickover family','Backward acrobatics','A-B','Back walkover/Valdez/kickover-related variants, including the higher-valued no-hand or turn option.','usag-acro-synchronized-bridge'),
    ('wag-fx-g5-07',5,7,'Floor-supported acrobatic transition','Non-flight acrobatics','A','The prescribed low floor-supported transition represented by family 5.07.','wag-fx-g4-02'),
    ('wag-fx-g6-01',6,1,'Forward salto family','Forward saltos','A-E','Single forward saltos in tuck, pike, or layout with longitudinal twist variants through the E range.','back-tuck'),
    ('wag-fx-g6-02',6,2,'Multiple forward salto family','Forward multiple saltos','E','Double/multiple forward salto variants in the body positions and twist patterns shown in family 6.02.','wag-fx-g6-01'),
    ('wag-fx-g7-01',7,1,'Side salto family','Sideward saltos','A-B','Side saltos in the prescribed tuck/pike/straight or aerial-style shapes.','wag-fx-g5-02'),
    ('wag-fx-g7-02',7,2,'Arabian and multiple side-entry salto family','Side-entry / Arabian saltos','B-E','Arabian and side-entry saltos, including multiple-rotation and twist variants through E.','wag-fx-g7-01'),
    ('wag-fx-g8-01',8,1,'Backward single salto with twist','Backward saltos','A-E','Single backward saltos in tuck, pike, or layout with longitudinal twist variants through E.','back-tuck'),
    ('wag-fx-g8-02',8,2,'Backward specialty salto','Backward saltos','A-B','Backward specialty salto shapes and low-twist variants represented by family 8.02.','back-tuck'),
    ('wag-fx-g8-03',8,3,'Double backward salto with twist','Backward multiple saltos','D-E','Double backward saltos with the prescribed twist distribution.','wag-fx-g8-01'),
    ('wag-fx-g8-04',8,4,'Advanced multiple backward salto','Backward multiple saltos','E','Advanced multiple backward salto and twist variants represented by family 8.04.','wag-fx-g8-03'),
    ('wag-fx-g8-05',8,5,'Backward salto from forward takeoff / gainer family','Gainer and specialty backward saltos','A-E','Gainer and forward-takeoff backward salto variants, including advanced twist/multiple forms.','wag-fx-g8-01'),
    ('wag-fx-g8-06',8,6,'Backward salto with delayed or phase twist','Backward saltos','B-C','Backward saltos distinguished by delayed or phase-specific twist placement.','wag-fx-g8-01')
),
prepared AS (
  SELECT d.*,
    jsonb_build_object(
      'governing_body','USA Gymnastics',
      'discipline','Women''s Artistic Gymnastics',
      'event','Floor Exercise',
      'program','Women''s Development Program Optional Code 2026-2030',
      'official_name',d.family_name,
      'official_code','Floor Group ' || d.group_no || '.' || lpad(d.family_no::text,2,'0'),
      'official_notation','See official USA Gymnastics symbol row ' || d.group_no || '.' || lpad(d.family_no::text,2,'0'),
      'usa_gymnastics_levels',jsonb_build_array('WAG Level 6','WAG Level 7','WAG Level 8','WAG Level 9','WAG Level 10'),
      'status','verified',
      'last_verified','2026-07-25',
      'prerequisites',jsonb_build_array(jsonb_build_object('slug',d.predecessor,'relationship','developmental predecessor')),
      'next_progressions','[]'::jsonb,
      'athlete_cues',jsonb_build_array(
        CASE WHEN d.group_no <= 2 THEN 'Show the exact leg/body shape, amplitude, takeoff and landing, and complete every turn in high relevé where required.' ELSE 'Create lift before rotation or twist, maintain the declared body position, finish rotation before landing, and control the connection or finish.' END,
        'Match the exact symbol variant and value letter; variants in one family can carry different A-E values.'
      ),
      'coach_checkpoints',jsonb_build_array(
        d.description,
        'Confirm the official symbol, direction, body position, support/flight, turn or twist amount, takeoff/landing mode, and A-E value before assigning credit.',
        'Apply Level 6-10 allowable/restricted-element rules and the routine special requirements separately from element execution.'
      ),
      'safety_and_readiness',jsonb_build_array(
        'Use a qualified women''s artistic coach, progressive surfaces/pits, appropriate spotting, and landing mats. Higher-value variants require independent readiness clearance.',
        'Train the base shape, takeoff, landing, rotation, twist, and connection separately before the complete value-part variant.',
        'The symbol-family card does not authorize an athlete to attempt every variation shown in its A-E range.'
      ),
      'common_faults',jsonb_build_array(
        jsonb_build_object('fault','Flexed or sickled feet','deduction','0.05 each time','cue','Finish through the ankle and toes.'),
        jsonb_build_object('fault','Crossed or separated legs','deduction','Up to 0.10 crossed / up to 0.20 separated','cue','Maintain one clean leg line unless separation is required.'),
        jsonb_build_object('fault','Insufficient exactness of body shape','deduction','Up to 0.20','cue','Make tuck, pike, layout, split, ring, and turn positions unmistakable.'),
        jsonb_build_object('fault','Incomplete turn or twist','deduction','Up to 0.20; value may be recognized lower','cue','Finish rotation before landing or lowering the heel.'),
        jsonb_build_object('fault','Bent arms or legs','deduction','Up to 0.30','cue','Extend through support and flight.'),
        jsonb_build_object('fault','Insufficient split / dance height / acro flight height','deduction','Up to 0.20 each','cue','Create amplitude before shape.'),
        jsonb_build_object('fault','Insufficient salto height or opening before landing','deduction','Up to 0.30 each','cue','Set upward and open before contact.'),
        jsonb_build_object('fault','Fall or hand support on mat','deduction','0.50','cue','Finish rotation and center the landing.'),
        jsonb_build_object('fault','Restricted element at Level 6-9','deduction','-0.50 off start value; no VP/SR/CC','cue','Check level-specific allowable values.')
      ),
      'scoring_summary','Official value range ' || d.value_range || ' (A=.10, B=.20, C=.30, D=.40, E=.50). Level 6 counts 4A+2B; Level 7 4A+3B; Level 8 4A+4B with 9.8 base and up to 0.2 compositional credit; Level 9 counts 3A+4B+1C with 9.5 base; Level 10 counts 3A+3B+2C with 9.2 base. Missing each special requirement is -0.50 from start value.',
      'video_briefs',jsonb_build_array(
        jsonb_build_object('title','Learn ' || d.family_name,'purpose','learning','description','Begin with the official symbol row and name every variant/value. Show shape and landing stations, prerequisite drills, spotted progressions, connection entry/exit, then the complete selected variant from front, side, and judging angles.'),
        jsonb_build_object('title',d.family_name || ' - ideal USA model','purpose','model','description','Show the exact symbol and value beside full-speed and slow-motion execution. Freeze takeoff, peak shape/amplitude, turn/twist completion, landing position, and connection rhythm; contrast only closely related variants that judges must distinguish.')
      ),
      'sources',jsonb_build_array(
        jsonb_build_object('title','USA Gymnastics 2026-2030 Floor Exercise Symbols, Groups 1-8','url','https://static.usagym.org/PDFs/Women/Rules/dpcop/appendix6.pdf','organization','USA Gymnastics','effective_cycle','2026-2030','accessed_on','2026-07-25','note','Official numbered floor symbol families and A-E value columns.'),
        jsonb_build_object('title','USA Gymnastics 2026-2030 Levels 6-8 Cheat Sheet','url','https://static.usagym.org/PDFs/Women/Rules/dpcop/appendix8.pdf','organization','USA Gymnastics','effective_cycle','2026-2030','accessed_on','2026-07-25','note','Special requirements, start values, restrictions, and execution deductions.'),
        jsonb_build_object('title','USA Gymnastics 2026-2030 Levels 9-10 Cheat Sheet','url','https://static.usagym.org/PDFs/Women/Rules/dpcop/appendix7.pdf','organization','USA Gymnastics','effective_cycle','2026-2030','accessed_on','2026-07-25','note','Special requirements, values, bonus, composition, and execution deductions.')
      ),
      'editorial_note','Original coaching summary of an official numbered symbol family. Consult the purchased 2026-2030 Table of Elements for the controlling name/illustration of a selected variant.'
    ) metadata
  FROM source_data d
)
INSERT INTO coaching.skill (
  facility_id,name,slug,description,instructions,sport_id,skill_level,
  skill_kind,evaluation_mode,execution_max_score,assistance_note,
  is_published,visibility,official_metadata
)
SELECT
  (SELECT id FROM public.facility ORDER BY id LIMIT 1),
  'WAG Floor ' || p.group_no || '.' || lpad(p.family_no::text,2,'0') || ' - ' || p.family_name,
  p.slug,p.description,
  CASE WHEN p.group_no <= 2 THEN 'Establish the declared dance shape and amplitude, complete the exact turn if any, and land with alignment and control.' ELSE 'Use the correct entry, create flight, show the declared support/body/rotation/twist variant, and control the landing or connection.' END,
  (SELECT id FROM coaching.sport WHERE key='gymnastics'),
  CASE WHEN p.value_range LIKE '%E%' THEN 'ELITE'::public.skill_level WHEN p.value_range LIKE '%D%' THEN 'ADVANCED'::public.skill_level ELSE 'INTERMEDIATE'::public.skill_level END,
  'individual','execution',10,
  p.category || '; official family ' || p.group_no || '.' || lpad(p.family_no::text,2,'0') || '; values ' || p.value_range,
  TRUE,'facility',p.metadata
FROM prepared p
ON CONFLICT (facility_id,slug) DO UPDATE SET
  name=EXCLUDED.name,description=EXCLUDED.description,instructions=EXCLUDED.instructions,
  sport_id=EXCLUDED.sport_id,skill_level=EXCLUDED.skill_level,skill_kind=EXCLUDED.skill_kind,
  evaluation_mode=EXCLUDED.evaluation_mode,execution_max_score=EXCLUDED.execution_max_score,
  assistance_note=EXCLUDED.assistance_note,is_published=EXCLUDED.is_published,
  visibility=EXCLUDED.visibility,official_metadata=EXCLUDED.official_metadata,updated_at=NOW();
