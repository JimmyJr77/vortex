-- USA Gymnastics Women's Development Program Compulsory Floor 2021-2029.
-- Distinct required skills and specifically evaluated connections for Levels 1-5.
-- Prose is original; the purchased W316 book/video controls exact choreography.

WITH source_data (
  slug, official_name, levels, description, instruction, predecessor, next_step
) AS (
  VALUES
    ('wag-comp-forward-cartwheel-quarter-in','Forward-entry cartwheel, quarter turn in',ARRAY['1'],'A forward-entry cartwheel finishes with the prescribed quarter turn into the routine facing.','Reach long from lunge, place hands on the line, pass through a split handstand, step down one foot at a time, then complete the quarter turn without extra foot movement.',NULL,'wag-comp-cartwheel-step-in'),
    ('wag-comp-backward-roll-tuck','Backward roll tucked',ARRAY['1'],'A tucked backward roll returns to the prescribed finish with continuous control.','Sit close to the heels, round the back, place hands beside the ears, push the floor to keep weight off the head, and place the feet together without pausing.','usag-acro-synchronized-forward-roll','wag-comp-straight-arm-back-roll-pushup'),
    ('wag-comp-candlestick','Candlestick',ARRAY['1','2'],'A controlled shoulder-supported candlestick shows a straight vertical leg/body line before the specified return.','Roll to the shoulder blades, keep weight off the neck, lift hips and straight legs together, point toes to vertical, show the position, and lower one vertebra at a time.','wag-comp-backward-roll-tuck','wag-comp-candlestick-to-sit'),
    ('wag-comp-passe-balance-releve','Forward passé balance, press to relevé',ARRAY['1'],'A forward passé balance is marked, then the gymnast presses to relevé with posture maintained.','Place the working toe at the supporting knee, square hips, lift through the crown, fix the arms/eyes, then rise through the ball of the foot without losing the passé line.',NULL,'wag-comp-passe-half-turn'),
    ('wag-comp-forward-chasse','Forward chassé',ARRAY['1','2','3','4','5'],'A forward chassé travels with joined feet in flight and prepares the next dance element.','Push from plié, let the trailing foot chase and close to the lead foot in air, land through plié, and maintain turnout, posture, and musical rhythm.',NULL,'wag-comp-chasse-leap-60'),
    ('wag-comp-stretch-jump','Stretch jump',ARRAY['1','3'],'A vertical straight jump shows a fully extended body and controlled two-foot landing.','Swing to a tall set, jump vertically with legs together and toes pointed, keep ribs and hips aligned, and land feet together through plié.',NULL,'wag-comp-stretch-split-jump-90'),
    ('wag-comp-forward-roll-tuck','Forward roll tucked',ARRAY['1'],'A tucked forward roll finishes in the compulsory standing position without hand support on recovery.','Squat, place hands shoulder-width, tuck the chin, roll across the upper back, keep knees and feet together, and reach forward to stand without crossing the feet.','wag-comp-backward-roll-tuck','wag-comp-handstand-forward-roll'),
    ('wag-comp-three-quarter-handstand','Minimum three-quarter handstand',ARRAY['1'],'The gymnast kicks to at least the compulsory three-quarter handstand line and returns with control.','Lunge long, place straight arms by the ears, drive the back leg, push tall through shoulders, reach the minimum angle with straight legs, and step down through the lunge.','handstand','wag-comp-handstand'),

    ('wag-comp-cartwheel-step-in','Cartwheel step-in',ARRAY['2'],'A cartwheel closes the legs on descent and steps into the prescribed two-foot finish for backward tumbling development.','Reach through a square lunge, split through vertical, accelerate the second leg to meet the first, snap the feet under the hips, and lift the chest without an extra step.','wag-comp-forward-cartwheel-quarter-in','round-off'),
    ('wag-comp-straight-arm-back-roll-pushup','Straight-arm backward roll to push-up',ARRAY['2'],'A backward roll passes through straight-arm support and finishes in a tight front-support/push-up position.','Roll with a rounded back, place hands early, push straight through the shoulders, open the hips as feet pass overhead, and land both feet into a hollow front support.','wag-comp-backward-roll-tuck','wag-comp-back-roll-open-45'),
    ('wag-comp-passe-half-turn','Passé relevé heel-snap half turn',ARRAY['2','3'],'A forward-passé relevé initiates a sharp half heel-snap turn and finishes in the prescribed position.','Rise tall before turning, keep the passé knee and hips placed, rotate shoulders and hips together, complete 180 degrees, and lower the heel only after the finish direction is established.','wag-comp-passe-balance-releve','wag-comp-passe-full-turn'),
    ('wag-comp-chasse-leap-60','Chassé to straight-leg leap, 60 degrees',ARRAY['2'],'A forward chassé connects into a straight-leg leap showing at least 60 degrees of split.','Carry chassé rhythm forward, push from the front foot, lift both straight legs into the split line, keep hips square and chest tall, and land through the leading foot.','wag-comp-forward-chasse','wag-comp-chasse-split-leap-90'),
    ('wag-comp-split-jump-60','Split jump, 60 degrees',ARRAY['2'],'A two-foot split jump shows at least 60 degrees of leg separation and lands feet together.','Jump vertically before splitting, keep both legs straight and hips square, point toes, rejoin the legs before landing, and absorb through aligned knees.','wag-comp-stretch-jump','wag-comp-stretch-split-jump-90'),
    ('wag-comp-handstand','Handstand',ARRAY['2'],'A full handstand reaches vertical with a straight aligned body before the controlled step-down.','Kick from lunge to stacked hands-shoulders-hips-ankles, squeeze legs together, push the floor, hold the head neutral, and return through a long lunge.','wag-comp-three-quarter-handstand','wag-comp-handstand-forward-roll'),
    ('wag-comp-candlestick-to-sit','Candlestick to sit',ARRAY['2'],'The candlestick lowers with control into the exact seated position used in choreography.','Show the vertical shoulder-supported line, keep legs together, roll down segment by segment, and arrive in the seated shape without dropping the hips or separating feet.','wag-comp-candlestick','wag-comp-handstand-bridge-kickover'),
    ('wag-comp-bridge-back-kickover','Bridge, back kickover',ARRAY['2'],'From bridge, one leg leads a back kickover to a controlled lunge finish.','Open shoulders over the hands, transfer weight forward, drive the lead leg while the support leg pushes, split through handstand, and step down into a square lunge.','usag-acro-synchronized-bridge','wag-comp-handstand-bridge-kickover'),

    ('wag-comp-handstand-forward-roll','Straight-arm handstand forward roll',ARRAY['3'],'A handstand connects directly into a straight-arm forward roll and controlled stand.','Reach vertical first, lean shoulders forward with arms straight, tuck only as the upper back contacts, keep the head clear, and roll to the feet without extra hand support.','wag-comp-handstand','wag-fx-g4-01'),
    ('wag-comp-chasse-split-leap-90','Chassé to split leap, 90 degrees',ARRAY['3'],'A chassé connects into a split leap showing at least 90 degrees.','Preserve chassé rhythm, push upward and forward, square the split, extend both knees and feet, and land with the torso lifted.','wag-comp-chasse-leap-60','wag-comp-straight-leap-120'),
    ('wag-comp-stretch-split-jump-90','Stretch jump to split jump, 90 degrees',ARRAY['3'],'A stretch jump connects to a split jump showing at least 90 degrees without an extra step or pause.','Land the stretch jump in elastic plié, rebound vertically, split from the hips with straight legs, close before landing, and maintain the music count.','wag-comp-split-jump-60','wag-comp-straddle-jump-120'),
    ('wag-comp-handstand-bridge-kickover','Handstand to bridge, back kickover',ARRAY['3'],'A handstand lowers through controlled arch to bridge and immediately progresses through a back kickover.','Reach vertical, open shoulders while directing feet to bridge, absorb through hands and feet, shift shoulders forward, then kick over through a square split handstand to lunge.','wag-comp-bridge-back-kickover','wag-comp-back-walkover'),
    ('wag-comp-forward-split','Forward split',ARRAY['3','4','5'],'A floor split shows the required front/back leg line, square hips, straight knees, and pointed feet.','Slide under control with hips square, rotate the back thigh toward the floor, extend both knees and ankles, keep the torso lifted, and enter/exit without using hands to force range.','usag-acro-rear-scale','wag-comp-split-leap-150'),
    ('wag-comp-back-roll-open-45','Straight-arm backward roll, open to 45 degrees, lower to push-up',ARRAY['3'],'A straight-arm backward roll opens the body to the required 45-degree line before lowering to front support.','Push early through straight arms, extend hips and knees as feet pass overhead, show the diagonal straight-body line, then lower as one unit to hollow push-up.','wag-comp-straight-arm-back-roll-pushup','wag-comp-back-extension-roll'),
    ('wag-comp-roundoff-bhs-rebound','Round-off, back handspring, rebound, stick',ARRAY['3'],'A round-off connects directly to one back handspring, then a controlled rebound and stick.','Turn the round-off down the line, snap feet together under the hips, sit through a rising back-handspring takeoff, block tall through hands, rebound vertically, and land the prescribed stick.','round-off','wag-comp-roundoff-two-bhs'),

    ('wag-comp-back-walkover','Back walkover',ARRAY['4'],'A back walkover passes continuously through split handstand from one foot to the other.','Lift the lead leg, open shoulders and upper back while reaching behind, push through the support leg, split through vertical with square hips, and step down to lunge without pausing.','wag-comp-handstand-bridge-kickover','wag-fx-g4-02'),
    ('wag-comp-back-extension-roll','Back extension roll',ARRAY['4','5'],'A straight-arm backward roll extends through a vertical or near-vertical handstand line before the prescribed step-in or lower.','Sit and roll with a rounded back, place hands early, push explosively through straight arms, extend hips and knees to the handstand line, then snap or lower with the exact compulsory finish.','wag-comp-back-roll-open-45','wag-fx-g4-02'),
    ('wag-comp-fhs-cartwheel-back-extension-series','Front handspring step-out, cartwheel step-in, back extension roll',ARRAY['4'],'The compulsory forward/side/backward acro series connects all three elements without extra steps or stops.','Carry the front-handspring step-out into lunge, place the cartwheel on line and close the feet, then sit immediately into a straight-arm back extension with continuous rhythm.','front-handspring','wag-comp-two-fhs-cartwheel-back-extension'),
    ('wag-comp-stretch-jump-half','Stretch jump with half turn',ARRAY['4'],'A vertical stretch jump completes 180 degrees and lands with feet together.','Set vertically, initiate the turn from the whole body, keep legs zipped and shape straight, spot the new direction, complete the half turn before landing, and absorb evenly.','wag-comp-stretch-jump','wag-comp-stretch-jump-full'),
    ('wag-comp-straight-leap-120','Straight-leg leap, 120 degrees',ARRAY['4'],'The dance passage includes a straight-leg leap showing at least 120 degrees of split.','Push through the takeoff foot, lift both straight legs from the hips, square the pelvis, show the split at peak height, and land through the leading toe with rhythm.','wag-comp-chasse-split-leap-90','wag-comp-split-leap-150'),
    ('wag-comp-straddle-jump-120','Straddle jump, 120 degrees',ARRAY['4'],'A two-foot straddle jump shows at least 120 degrees with legs lifted toward horizontal.','Set upward, open both legs symmetrically from square hips, keep knees and toes extended, lift thighs toward horizontal, close before landing, and keep the chest from dropping.','wag-comp-stretch-split-jump-90','wag-comp-straddle-jump-150'),
    ('wag-comp-passe-full-turn','Full turn in forward passé',ARRAY['4','5'],'A 360-degree turn in forward passé is completed in high relevé with the prescribed arm position.','Rise fully before rotation, place the passé toe at the knee, keep hips and shoulders together, spot, complete 360 degrees, and lower the heel only after control.','wag-comp-passe-half-turn','wag-fx-g2-01'),
    ('wag-comp-roundoff-two-bhs','Round-off, two back handsprings, rebound, stick',ARRAY['4'],'A round-off connects through two accelerating back handsprings to a vertical rebound and stick.','Finish the round-off with speed, keep both handsprings long and rising with quick shoulder blocks, preserve straight legs, then redirect the final snap-down vertically to rebound and stick.','wag-comp-roundoff-bhs-rebound','wag-comp-roundoff-bhs-back-tuck'),

    ('wag-comp-front-tuck-or-aerial','Front tuck, front aerial, or side aerial choice',ARRAY['5'],'The gymnast performs one approved flight choice: front tuck, front aerial, or side aerial.','Select the mastered option; create a vertical takeoff, preserve the declared forward or side axis and body shape, complete rotation before the landing, and finish without hand support.','wag-fx-g5-02','wag-fx-g6-01'),
    ('wag-comp-two-fhs-cartwheel-back-extension','Two front handspring step-outs, cartwheel step-in, back extension roll',ARRAY['5'],'Two connected front-handspring step-outs flow into cartwheel step-in and straight-arm back extension roll.','Maintain forward speed and alternating step-out rhythm through both handsprings, enter the cartwheel without a pause, snap feet together, and continue directly into the back extension line.','wag-comp-fhs-cartwheel-back-extension-series',NULL),
    ('wag-comp-stretch-jump-full','Stretch jump with full turn',ARRAY['5'],'A vertical stretch jump completes 360 degrees before a controlled two-foot landing.','Set straight upward, keep legs together and body long, turn around a vertical axis, spot after the full rotation, and finish the twist before absorbing the landing.','wag-comp-stretch-jump-half','wag-fx-g1-07'),
    ('wag-comp-split-leap-150','Split leap or switch-leg leap, 150 degrees',ARRAY['5'],'The dance passage uses either a split leap or switch-leg leap showing at least 150 degrees.','Choose the approved leap, create height before opening the legs, square hips, extend knees and toes, show the required split, and land through the lead foot without rhythm loss.','wag-comp-straight-leap-120','wag-fx-g1-02'),
    ('wag-comp-straddle-jump-150','Straddle jump, 150 degrees',ARRAY['5'],'A two-foot straddle jump shows at least 150 degrees with clear amplitude and controlled landing.','Jump vertically, open both legs symmetrically toward horizontal, keep the pelvis neutral and knees straight, close the legs before landing, and absorb feet together.','wag-comp-straddle-jump-120','wag-fx-g1-04'),
    ('wag-comp-roundoff-bhs-back-tuck','Round-off, back handspring, back tuck, stick',ARRAY['5'],'A round-off and back handspring connect directly to a backward tucked salto and controlled stick.','Build speed through the round-off, make the handspring rise, snap down under the hips, set the back tuck upward before closing the tuck, open before the floor, and land on two feet without a step.','wag-comp-roundoff-two-bhs','wag-fx-g8-01')
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body','USA Gymnastics',
    'discipline','Women''s Artistic Gymnastics',
    'event','Compulsory Floor Exercise',
    'program','Women''s Development Program Compulsory 2021-2029',
    'official_name',d.official_name,
    'official_code','WAG compulsory Levels ' || array_to_string(d.levels,', '),
    'usa_gymnastics_levels',to_jsonb(ARRAY(SELECT 'WAG Level ' || x FROM unnest(d.levels) x)),
    'status','verified',
    'last_verified','2026-07-25',
    'prerequisites',CASE WHEN d.predecessor IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('slug',d.predecessor,'relationship','developmental predecessor')) END,
    'next_progressions',CASE WHEN d.next_step IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('slug',d.next_step,'relationship','direct progression')) END,
    'athlete_cues',jsonb_build_array(d.instruction,'Match the official side, direction, arm path, music count, and finish exactly; compulsory choreography is part of the evaluated skill.'),
    'coach_checkpoints',jsonb_build_array(
      d.description,d.instruction,
      'Use W316 to verify exact text, counts, side, arm placement, evaluation points, element value, and level-specific allowable variations.',
      'Judge rhythm, posture, footwork, alignment, amplitude, precision, connection, and finish in addition to skill completion.'
    ),
    'safety_and_readiness',jsonb_build_array(
      'Use a qualified women''s artistic coach, progressive mats/pits, and appropriate spotting. Do not practice full routines on hard surfaces before every element and connection is independent.',
      'Train individual shapes and elements, then short count sections, then full music/choreography. Stop for head/neck loading, wrist pain, uncontrolled arch, under-rotation, or unsafe landings.'
    ),
    'common_faults',jsonb_build_array(
      jsonb_build_object('fault','Omitted element or major portion','deduction','Up to the full value of the element/section','cue','Use an element-and-count checklist.'),
      jsonb_build_object('fault','Incorrect text, side, direction, arm/leg path, or added/omitted movement','deduction','Per compulsory text: small/medium/large or element-specific penalty','cue','Compare the official W316 video count by count.'),
      jsonb_build_object('fault','Bent arms/legs, flexed feet, poor posture/alignment','deduction','Typically 0.05-0.30 according to degree and occurrence','cue','Hold the required line through the entire element.'),
      jsonb_build_object('fault','Insufficient split, amplitude, turn, handstand, or body-position angle','deduction','Per element-specific compulsory criteria','cue','Measure the required angle in video review.'),
      jsonb_build_object('fault','Pause, broken connection, or incorrect rhythm','deduction','Per compulsory rhythm/connection criteria','cue','Keep the written counts and rebound timing.'),
      jsonb_build_object('fault','Fall','deduction','0.50 plus loss of element execution/possible omission consequences','cue','Regress until the element and finish are controlled.')
    ),
    'scoring_summary','Compulsory routines start from the prescribed 10.0 value and are evaluated against exact text, choreography, counts, and element-specific deductions. Judges deduct for omissions, changes, rhythm, alignment, amplitude, precision, landings, and falls. The current W316 book/video is controlling for the exact value and maximum deduction of each section.',
    'video_briefs',jsonb_build_array(
      jsonb_build_object('title','Teach ' || d.official_name,'purpose','learning','description','Show the official level/count reference, prerequisite shapes, two or three progressive drills, spotting position, exact entry and exit choreography, then the complete element from side and judging views.'),
      jsonb_build_object('title',d.official_name || ' - ideal compulsory model','purpose','model','description','Synchronize full speed and slow motion to the official music counts. Overlay required angles, hand/foot placement, body line, direction, connection timing, landing, and the most common deduction checkpoints.')
    ),
    'sources',jsonb_build_array(
      jsonb_build_object('title','USA Gymnastics W316 - 2021-2029 Women''s Development Program Compulsory Materials','url','https://members.usagym.org/pages/education/courses/W316/','organization','USA Gymnastics','effective_cycle','2021-2029','accessed_on','2026-07-25','note','Controlling compulsory book, music, official videos, counts, and deductions; purchase/login required.'),
      jsonb_build_object('title','USA Gymnastics Women''s Compulsory Updates','url','https://usagym.org/women/development/compulsory/','organization','USA Gymnastics','effective_cycle','2021-2029','accessed_on','2026-07-25','note','Official updates and replacement pages.')
    ),
    'editorial_note','Original coaching summary. It intentionally does not reproduce protected compulsory choreography or text; W316 controls exact performance.'
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
  'WAG Compulsory - ' || p.official_name,p.slug,p.description,p.instruction,
  (SELECT id FROM coaching.sport WHERE key='gymnastics'),
  CASE WHEN '5'=ANY(p.levels) THEN 'INTERMEDIATE'::public.skill_level ELSE 'BEGINNER'::public.skill_level END,
  'individual','execution',10,
  'Required in WAG compulsory Level(s) ' || array_to_string(p.levels,', '),
  TRUE,'facility',p.metadata
FROM prepared p
ON CONFLICT (facility_id,slug) DO UPDATE SET
  name=EXCLUDED.name,description=EXCLUDED.description,instructions=EXCLUDED.instructions,
  sport_id=EXCLUDED.sport_id,skill_level=EXCLUDED.skill_level,skill_kind=EXCLUDED.skill_kind,
  evaluation_mode=EXCLUDED.evaluation_mode,execution_max_score=EXCLUDED.execution_max_score,
  assistance_note=EXCLUDED.assistance_note,is_published=EXCLUDED.is_published,
  visibility=EXCLUDED.visibility,official_metadata=EXCLUDED.official_metadata,updated_at=NOW();
