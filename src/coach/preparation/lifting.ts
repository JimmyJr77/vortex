import type { DisciplinePreparationRoutine, PreparationDuration, PreparationExercise, PreparationStep } from './types'

const travelRaise: PreparationExercise = {
  id: 'lifting-easy-travel-arm-sweep',
  name: 'Easy lane travel + relaxed arm sweeps',
  purposes: ['Raise', 'Integrate'],
  equipment: ['Cones marking one 10 m lane'],
  whyHere: 'Raises movement gradually while the coach checks gait, comfortable shoulder motion and available space before loading.',
  setup: ['Use one athlete per lane, with all implements outside the travel path.', 'Travel easily for 5 m, slow, walk the turn, and return; the remaining lane length is a buffer.'],
  executionSteps: ['Begin with brisk walking, adding an easy jog only if comfortable.', 'Alternate relaxed forward arm swings with small, unforced arm circles while walking.', 'Keep the turns slow and finish standing near the pre-staged equipment.'],
  coachCues: ['Easy conversation pace.', 'Walk the turn.', 'Shoulders move freely without shrugging.'],
  athleteCues: ['Warm up gradually.', 'Stay in my lane.', 'Finish ready to listen.'],
  qualityGates: ['Travel remains relaxed and controlled.', 'Arm movement does not change balance or force shoulder range.', 'The athlete can speak comfortably at the finish.'],
  commonFaults: ['Racing short shuttles.', 'Cutting sharply at the turn.', 'Forcing large arm circles.'],
  scaling: ['Walk throughout or march in place with comfortable arm movement.', 'Use a smaller arm sweep where the lane width limits clearance.'],
  stopSigns: ['Pain, limping or unusual distress.', 'Dizziness.', 'Any loss of lane clearance.'],
}

const thoracicReach: PreparationExercise = {
  id: 'lifting-side-lying-open-book',
  name: 'Side-lying thoracic rotation + reach',
  purposes: ['Mobilize'],
  equipment: ['Clear floor space'],
  whyHere: 'Explores comfortable upper-back rotation and shoulder reach before the trunk must stay organized during pressing and pulling.',
  setup: ['Lie on one side with hips and knees comfortably bent and knees stacked.', 'Reach both arms forward at chest height; leave space behind the opening arm.'],
  executionSteps: ['Exhale and turn the upper arm and chest away from the lower arm.', 'Keep the knees together and stop before the pelvis rolls or the shoulder strains.', 'Return slowly, complete the prescribed repetitions, then change sides.'],
  coachCues: ['Turn through the upper back.', 'Knees stay stacked.', 'The hand need not reach the floor.'],
  athleteCues: ['Follow my opening hand.', 'Keep my hips quiet.', 'Use my comfortable range.'],
  qualityGates: ['Knees remain stacked through the movement.', 'Both sides can be completed without breath holding or forced range.', 'The return is as controlled as the opening.'],
  commonFaults: ['Rolling the pelvis to manufacture range.', 'Dropping the arm abruptly.', 'Pressing the hand to the floor.'],
  scaling: ['Reduce opening range.', 'Use standing, arms-crossed upper-back turns with a quiet pelvis if floor positioning is unsuitable.'],
  stopSigns: ['Shoulder, neck or back pain.', 'New tingling or numbness.', 'Inability to find a comfortable position.'],
}

const wristRocks: PreparationExercise = {
  id: 'lifting-quadruped-wrist-rock',
  name: 'Quadruped wrist rocks',
  purposes: ['Mobilize', 'Activate'],
  equipment: ['Clear non-slip floor'],
  whyHere: 'Checks tolerance to hand support and gradual wrist loading before plank or pressing positions.',
  setup: ['Set hands approximately under shoulders and knees under hips.', 'Spread the fingers and use a comfortable hand angle rather than turning the fingers backward.'],
  executionSteps: ['Gently shift forward a few centimetres with palms in contact.', 'Return to the start without collapsing onto the wrists.', 'Keep elbows soft and use only the prescribed small, controlled rocks.'],
  coachCues: ['Spread pressure across the hand.', 'Small shift, quiet elbows.', 'Stop before discomfort.'],
  athleteCues: ['Keep my whole hand down.', 'Move slowly.', 'Use the range I own.'],
  qualityGates: ['Palms remain evenly loaded without pain.', 'The athlete can reverse the shift smoothly.', 'The trunk stays supported.'],
  commonFaults: ['Rocking rapidly into end range.', 'Peeling up the palms.', 'Locking the elbows and dropping the chest.'],
  scaling: ['Reduce the forward shift or move the hips back.', 'Use unloaded wrist flexion and extension while standing; omit loaded hand support if it is not comfortable.'],
  stopSigns: ['Wrist pain, tingling or numbness.', 'Sudden loss of hand support.', 'Persistent discomfort after reducing the shift.'],
}

const scapularPress: PreparationExercise = {
  id: 'lifting-quadruped-scapular-press',
  name: 'Quadruped scapular press',
  purposes: ['Activate', 'Integrate'],
  equipment: ['Clear non-slip floor'],
  whyHere: 'Rehearses shoulder-blade motion on a supported trunk without accumulating full push-up fatigue.',
  setup: ['Place hands under shoulders and knees under hips.', 'Keep elbows straight but not forced into lockout and the neck in line with the trunk.'],
  executionSteps: ['Allow the chest to settle slightly between the shoulder blades without bending the elbows.', 'Press the floor away so the shoulder blades spread around the ribs.', 'Pause briefly, then repeat while keeping the pelvis still.'],
  coachCues: ['Move the shoulder blades, not the elbows.', 'Push the floor away.', 'Keep the ribs and pelvis connected.'],
  athleteCues: ['Long neck.', 'Quiet hips.', 'Small, smooth movement.'],
  qualityGates: ['Elbows remain steady through each repetition.', 'The chest moves without lumbar sagging.', 'Shoulders move without pinching or shrugging.'],
  commonFaults: ['Turning the drill into push-ups.', 'Dropping the abdomen toward the floor.', 'Shrugging the shoulders toward the ears.'],
  scaling: ['Reduce the movement range.', 'Use an inspected stable bench at a suitable height for a lighter inclined version; skip hand-supported work if no comfortable position exists.'],
  stopSigns: ['Shoulder or wrist pain.', 'Repeated collapse through the trunk.', 'Unstable or slippery support.'],
}

const wristScapBrace: PreparationExercise = {
  id: 'lifting-wrist-scapular-brace-flow',
  name: 'Wrist rock → scapular press → bird-dog reach',
  purposes: ['Mobilize', 'Activate', 'Integrate'],
  equipment: ['Clear non-slip floor'],
  whyHere: 'Combines hand-support tolerance, scapular motion and trunk control in one floor position for the shorter routines.',
  setup: ['Set hands under shoulders and knees under hips, leaving reaching space inside the lane.', 'Use the scheduled instruction and transition allowance to explain the three parts; extend the routine if a fuller demonstration or movement teaching is needed.'],
  executionSteps: ['Perform the prescribed small forward-and-back wrist rocks with palms down.', 'Keep the elbows straight and perform small scapular presses by letting the chest settle and then pushing the floor away.', 'Slide opposite hand and foot away, briefly reach, then return; alternate sides without lifting the ribs or rotating the pelvis.'],
  coachCues: ['Small wrist shift.', 'Shoulder blades move around the ribs.', 'Reach long; keep the belt line level.'],
  athleteCues: ['Keep my hands comfortable.', 'Push the floor away.', 'Move one opposite pair at a time.'],
  qualityGates: ['Each component stays controlled without hurried transitions.', 'No wrist or shoulder discomfort appears under support.', 'Opposite reaches leave the trunk and pelvis steady.'],
  commonFaults: ['Bouncing into wrist range.', 'Bending elbows during scapular motion.', 'Arching the back to lift the reaching leg.'],
  scaling: ['Use smaller rocks and keep the reaching hand or foot sliding on the floor.', 'If hand support is unsuitable, use standing unloaded wrist motion and arm reaches followed by supine heel slides for the brace component.'],
  stopSigns: ['Wrist, shoulder or back pain.', 'Tingling or numbness.', 'Repeated trunk collapse or loss of support.'],
}

const bandRow: PreparationExercise = {
  id: 'lifting-self-anchored-band-row',
  name: 'Standing self-anchored light-band row',
  purposes: ['Activate', 'Integrate'],
  equipment: ['One inspected light resistance band per active athlete'],
  whyHere: 'Adds a low-load pulling pattern while the hips and trunk provide a stable base; no installed anchor is required.',
  setup: ['Stand on the centre of a suitable band with both shod feet and hold the ends securely.', 'Use an intact band long enough for the setup; hinge slightly and keep its line away from the face.', 'If secure self-anchoring is not possible, use very light dumbbells or an unloaded row.'],
  executionSteps: ['Brace gently and keep the torso still in a shallow hinge.', 'Draw the elbows toward the back pockets without pulling the shoulders toward the ears.', 'Return the hands under control and finish well before arm or grip fatigue.'],
  coachCues: ['Own the band under both feet.', 'Elbows back, torso still.', 'Control the return.'],
  athleteCues: ['Keep my ribs quiet.', 'Pull smoothly.', 'Leave plenty of repetitions unused.'],
  qualityGates: ['Band position and grip remain secure.', 'The pull occurs without trunk heaving.', 'Shoulders remain comfortable throughout the range.'],
  commonFaults: ['Using a band too short or heavy for control.', 'Standing up to finish the row.', 'Allowing the band to slip beneath the feet.'],
  scaling: ['Reduce tension or range.', 'Use a very light dumbbell row or unloaded row when the band cannot be secured.'],
  stopSigns: ['Band damage, slipping or an insecure grip.', 'Shoulder, elbow or back pain.', 'Repeated loss of torso position.'],
}

const deadBug: PreparationExercise = {
  id: 'lifting-exhale-brace-heel-slide',
  name: 'Exhale-and-brace alternating heel slide',
  purposes: ['Activate', 'Integrate'],
  equipment: ['Clear floor space'],
  whyHere: 'Practises a repeatable breath and trunk position while the limbs move, then carries that organization into loaded lifts.',
  setup: ['Lie on the back with knees bent and feet on the floor.', 'Place hands lightly on the lower ribs and find a comfortable neutral trunk position.'],
  executionSteps: ['Exhale gently to settle the ribs without forcefully flattening the back.', 'Maintain gentle abdominal tension while sliding one heel away.', 'Bring the heel back, breathe normally and change sides without pelvis movement.'],
  coachCues: ['Exhale, organize, then move.', 'The pelvis stays quiet.', 'Keep breathing behind the brace.'],
  athleteCues: ['Slide only as far as I can control.', 'Keep my ribs calm.', 'Reset my breath each time.'],
  qualityGates: ['The pelvis and rib position remain steady.', 'Breathing stays controlled without a prolonged breath hold.', 'Both sides use a comparable comfortable range.'],
  commonFaults: ['Reaching so far that the back arches.', 'Holding the breath through the entire set.', 'Tensing the neck or forcing the back flat.'],
  scaling: ['Shorten the slide or lift only the heel slightly.', 'Use standing exhale-and-brace practice if floor positioning is unsuitable.'],
  stopSigns: ['Back or hip pain.', 'Dizziness associated with breathing changes.', 'Inability to maintain a comfortable resting position.'],
}

const pushPrimer: PreparationExercise = {
  id: 'lifting-controlled-kneeling-push-up',
  name: 'Controlled kneeling push-up',
  purposes: ['Activate', 'Integrate'],
  equipment: ['Non-slip floor; optional inspected stable bench'],
  whyHere: 'Rehearses a horizontal push with coordinated shoulder, elbow and trunk positions before the main lift.',
  setup: ['Start on hands and knees, then move the knees back enough to form a comfortable shoulder-to-knee line.', 'Set hands just outside shoulder width; choose an easier incline on a stable bench if necessary.'],
  executionSteps: ['Brace gently and lower the chest between the hands over about two seconds.', 'Keep elbows at a comfortable angle and stop before the trunk sags or shoulders complain.', 'Press smoothly away from the floor; stop at the prescribed small dose.'],
  coachCues: ['Chest and hips travel together.', 'Choose an easy version.', 'Finish each rep with control.'],
  athleteCues: ['Keep one long line.', 'Push smoothly.', 'Save my strength for the lift.'],
  qualityGates: ['All prescribed repetitions remain easy and evenly paced.', 'The trunk stays organized on descent and ascent.', 'Hands, elbows and shoulders remain comfortable.'],
  commonFaults: ['Using a variation too hard for preparation.', 'Leading the movement with the head or hips.', 'Performing extra repetitions until tired.'],
  scaling: ['Shorten the lowering range.', 'Use an inspected stable bench incline, or substitute unloaded floor-press motion if no comfortable hand-supported push is available.'],
  stopSigns: ['Shoulder, elbow or wrist pain.', 'Repeated trunk collapse.', 'Sliding hands or movement of the support.'],
}

const pushPullPrimer: PreparationExercise = {
  id: 'lifting-unloaded-push-pull-primer',
  name: 'Standing unloaded press + row rehearsal',
  purposes: ['Activate', 'Integrate'],
  equipment: ['None'],
  whyHere: 'Gives the short upper-body routine an efficient check of pushing, pulling, hand position and rib control without implement changes.',
  setup: ['Stand tall with feet at a comfortable width and elbows by the sides.', 'Leave arm reach space within the lane.'],
  executionSteps: ['Press both empty hands forward from chest height with wrists in line with the forearms.', 'Draw the elbows back into a comfortable row while keeping the shoulders away from the ears.', 'Repeat slowly, then check one comfortable overhead reach only if the day includes overhead lifting.'],
  coachCues: ['Press and pull without moving the ribs.', 'Keep wrists stacked.', 'Comfortable shoulder range.'],
  athleteCues: ['Move smoothly both ways.', 'Keep my neck relaxed.', 'Feel the setup before loading it.'],
  qualityGates: ['Press and row ranges remain comfortable.', 'The trunk does not rock to create movement.', 'Wrist position stays controlled.'],
  commonFaults: ['Arching the back to extend the arms.', 'Shrugging during the row.', 'Forcing the elbows excessively behind the trunk.'],
  scaling: ['Shorten the arm excursion.', 'Use one arm at a time if that makes position easier to observe.'],
  stopSigns: ['Shoulder or elbow pain.', 'New tingling or numbness.', 'Symptoms that persist after reducing the range.'],
}

const shoulderRotation: PreparationExercise = {
  id: 'lifting-side-lying-unloaded-shoulder-rotation',
  name: 'Side-lying unloaded shoulder external rotation',
  purposes: ['Mobilize', 'Activate'],
  equipment: ['Clear floor space'],
  whyHere: 'Adds an easy, observable shoulder-rotation exposure to the longer upper-body routines without using a heavy band or fatiguing the arm.',
  setup: ['Lie comfortably on one side and rest the top upper arm against the ribs.', 'Bend the top elbow approximately 90 degrees with the forearm across the abdomen; keep the hand empty.'],
  executionSteps: ['Rotate the forearm upward while the elbow stays gently beside the ribs.', 'Stop before the trunk rolls or the shoulder pinches.', 'Lower slowly and change sides after the prescribed repetitions.'],
  coachCues: ['Rotate around a quiet elbow.', 'No trunk roll.', 'A small clear movement is enough.'],
  athleteCues: ['Keep my elbow beside me.', 'Move without forcing range.', 'Lower as smoothly as I lift.'],
  qualityGates: ['The upper arm stays beside the trunk.', 'Each side remains comfortable and controlled.', 'No added load is needed to make the position clear.'],
  commonFaults: ['Rolling backward to lift the hand higher.', 'Pulling the elbow away from the body.', 'Adding resistance and turning preparation into a working set.'],
  scaling: ['Reduce range.', 'Stand with the elbow by the side and practise the same unloaded rotation if side-lying is unsuitable.'],
  stopSigns: ['Shoulder pain or catching.', 'Tingling or numbness.', 'No comfortable range after scaling.'],
}

const ankleRocks: PreparationExercise = {
  id: 'lifting-split-stance-ankle-rock',
  name: 'Split-stance ankle rock',
  purposes: ['Mobilize', 'Activate'],
  equipment: ['None'],
  whyHere: 'Checks controlled forward shin travel with a grounded heel before squat and split-stance loading.',
  setup: ['Take a short split stance and bend the front knee slightly.', 'Keep the front heel, base of the big toe and base of the little toe in contact with the floor.'],
  executionSteps: ['Move the front knee gradually forward over the direction of the toes.', 'Stop before the heel lifts or the foot rolls inward.', 'Return, complete the small prescribed dose and change sides.'],
  coachCues: ['Heel stays down.', 'Knee follows the toes.', 'Use the range you can reverse.'],
  athleteCues: ['Keep three points of my foot down.', 'Move slowly forward and back.', 'Compare both sides without forcing them equal.'],
  qualityGates: ['Heel contact and balance remain intact.', 'Knee travel stays aligned with the foot.', 'The athlete returns smoothly from the chosen range.'],
  commonFaults: ['Lifting the heel to reach farther.', 'Rolling onto the inside edge of the foot.', 'Bouncing against the end range.'],
  scaling: ['Shorten the stance and reduce forward travel.', 'Use fingertips on an inspected stable bench if balance alone limits the drill.'],
  stopSigns: ['Ankle or knee pain.', 'Repeated loss of balance.', 'A pinching sensation that remains after reducing range.'],
}

const lateralHip: PreparationExercise = {
  id: 'lifting-lateral-hip-shift',
  name: 'Lateral hip shift + return',
  purposes: ['Mobilize', 'Integrate'],
  equipment: ['None'],
  whyHere: 'Adds a controlled side-to-side hip exposure before lower-body lifting, complementing the forward squat and hinge patterns.',
  setup: ['Stand somewhat wider than the usual squat stance with both feet pointing comfortably forward.', 'Leave lateral clearance within the stationary lane space.'],
  executionSteps: ['Shift the hips toward one side, bending that knee while the other leg stays long but not locked.', 'Keep both feet grounded and the trunk long.', 'Push back to centre and repeat on the other side without dropping into a deep stretch.'],
  coachCues: ['Sit toward the hip.', 'Ground both feet.', 'Return under control.'],
  athleteCues: ['Move sideways, then centre.', 'Use a comfortable depth.', 'Keep my whole foot connected.'],
  qualityGates: ['The bent knee follows the foot direction.', 'The athlete returns without pushing off the floor with the hands.', 'Both directions remain controlled and comfortable.'],
  commonFaults: ['Forcing a wide stance or deep groin stretch.', 'Rolling the foot edges off the floor.', 'Rotating the trunk instead of shifting the hips.'],
  scaling: ['Narrow the stance or reduce the shift.', 'Use a small side step and shallow knee bend instead of the wide-stance version.'],
  stopSigns: ['Groin, hip or knee pain.', 'Foot slipping.', 'Repeated loss of balance on the return.'],
}

const hinge: PreparationExercise = {
  id: 'lifting-bodyweight-hip-hinge',
  name: 'Bodyweight hip hinge + pause',
  purposes: ['Mobilize', 'Activate', 'Integrate'],
  equipment: ['None'],
  whyHere: 'Makes the hip-driven pattern and trunk position visible before any deadlift, row or other hinged load.',
  setup: ['Stand with feet approximately hip width and knees softly bent.', 'Place hands on the hip creases or reach them forward without pulling the shoulders up.'],
  executionSteps: ['Send the hips backward while keeping the shins relatively quiet.', 'Stop at a comfortable hip range with a long trunk and balanced foot pressure.', 'Pause briefly, then push through the floor to stand without leaning backward.'],
  coachCues: ['Hips back, trunk long.', 'Keep pressure through the whole foot.', 'Stand tall without leaning back.'],
  athleteCues: ['Close my hip creases.', 'Keep the load path close even without a weight.', 'Own the pause.'],
  qualityGates: ['The movement clearly comes from the hips.', 'The trunk remains organized during the pause.', 'The athlete stands without lumbar overextension.'],
  commonFaults: ['Turning the hinge into a deep squat.', 'Rounding the trunk to reach lower.', 'Throwing the hips forward at the finish.'],
  scaling: ['Reduce the depth.', 'Practise hands-on-hip movement slowly; use a stable bench for light balance support if needed.'],
  stopSigns: ['Back or hip pain.', 'New radiating symptoms.', 'Inability to control the shallow version.'],
}

const squatReach: PreparationExercise = {
  id: 'lifting-squat-to-standing-reach',
  name: 'Controlled squat → standing overhead reach',
  purposes: ['Mobilize', 'Activate', 'Integrate'],
  equipment: ['None'],
  whyHere: 'Links ankle, knee and hip motion to a controlled overhead position while keeping squat depth and shoulder range individually adjustable.',
  setup: ['Choose a comfortable squat stance with toes turned out only as needed.', 'Keep enough overhead and lateral clearance for an unloaded reach.'],
  executionSteps: ['Squat to a comfortable depth while keeping foot contact and knees aligned.', 'Stand through the whole foot.', 'Reach the empty hands overhead only as far as possible without rib flare, then lower and reset.'],
  coachCues: ['Own the depth.', 'Stand before reaching.', 'Reach tall without arching.'],
  athleteCues: ['Keep my heels down.', 'Let my knees follow my toes.', 'Keep my ribs quiet when I reach.'],
  qualityGates: ['Squat depth remains controlled on every repetition.', 'The standing reach does not produce a backward lean.', 'No joint discomfort appears in either component.'],
  commonFaults: ['Chasing depth as the heels lift.', 'Collapsing the knees inward.', 'Using a back arch to force the hands overhead.'],
  scaling: ['Use a shallower squat or an inspected stable box as a depth reference.', 'Reach forward or to shoulder height if overhead reach is not comfortable; plan a non-overhead first lift if required.'],
  stopSigns: ['Knee, hip, back or shoulder pain.', 'Repeated loss of foot contact or balance.', 'Inability to complete the scaled range comfortably.'],
}

const hingeSquat: PreparationExercise = {
  id: 'lifting-hinge-squat-brace-check',
  name: 'Hinge → squat → standing brace check',
  purposes: ['Mobilize', 'Activate', 'Integrate'],
  equipment: ['None'],
  whyHere: 'Protects both fundamental lower-body patterns and a trunk check within the five-minute routine.',
  setup: ['Stand at the stationary end of the lane with feet at a comfortable width.', 'Explain the difference between hips-back hinging and a knees-and-hips squat before beginning.'],
  executionSteps: ['Complete the prescribed bodyweight hinges with softly bent knees and a long trunk.', 'Reset the stance and complete controlled squats to a comfortable depth.', 'Finish tall, exhale gently and practise a brief brace while breathing normally.'],
  coachCues: ['Hinge first, then change the pattern.', 'Keep foot pressure balanced.', 'Organize the ribs before the load.'],
  athleteCues: ['Send my hips back in the hinge.', 'Bend hips and knees in the squat.', 'Keep breathing when I brace.'],
  qualityGates: ['Hinge and squat remain visibly distinct.', 'The chosen depth preserves trunk and foot control.', 'The athlete can set a brace without a prolonged breath hold.'],
  commonFaults: ['Blending every rep into the same movement.', 'Rushing the squat to fit more reps.', 'Overarching or breath holding during the brace.'],
  scaling: ['Use shallower hinge and squat ranges.', 'Use an inspected stable bench for light balance support if necessary.'],
  stopSigns: ['Hip, knee or back pain.', 'Dizziness.', 'Repeated loss of balance or position in the shallow version.'],
}

const splitStance: PreparationExercise = {
  id: 'lifting-reverse-step-split-squat',
  name: 'Reverse step → shallow split squat',
  purposes: ['Mobilize', 'Activate', 'Integrate'],
  equipment: ['Clear floor space'],
  whyHere: 'Checks a split base, hip control and leg-to-leg coordination before lower-body lifting without adding jumping or long travel.',
  setup: ['Stand at the lane end with enough clear space for one backward step.', 'Keep feet on two parallel tracks rather than one narrow line.'],
  executionSteps: ['Step one foot backward and settle the split stance.', 'Lower both knees a small comfortable amount with a tall trunk.', 'Push through the front foot to return and change sides; pause if balance needs resetting.'],
  coachCues: ['Two tracks.', 'Settle before lowering.', 'Front foot owns the return.'],
  athleteCues: ['Make a stable base.', 'Keep my knee with my toes.', 'Finish balanced.'],
  qualityGates: ['The stance settles before the lowering phase.', 'The front foot remains grounded.', 'The athlete returns without a hop or large trunk sway.'],
  commonFaults: ['Stepping onto a tightrope.', 'Dropping into the lunge before balance is established.', 'Pushing off the rear foot to rush the return.'],
  scaling: ['Use a stationary split stance and shallower bend.', 'Use light fingertip support on an inspected stable bench for balance.'],
  stopSigns: ['Knee, hip or ankle pain.', 'Repeated stumbling.', 'Inability to hold a comfortable split stance.'],
}

const calfRise: PreparationExercise = {
  id: 'lifting-controlled-calf-raise',
  name: 'Two-foot calf raise + controlled lower',
  purposes: ['Activate', 'Integrate'],
  equipment: ['None'],
  whyHere: 'Checks forefoot pressure and ankle control before standing lower-body loads without adding reactive contacts.',
  setup: ['Stand with feet approximately hip width on a level, non-slip surface.', 'Keep knees soft and weight spread between both feet.'],
  executionSteps: ['Rise smoothly onto the forefeet without rolling onto the outside edges.', 'Pause briefly at a comfortable height.', 'Lower the heels over about two seconds and reset fully between repetitions.'],
  coachCues: ['Rise through the big-toe side too.', 'Level heels.', 'Control the lowering.'],
  athleteCues: ['Keep both feet working.', 'Balance at the top.', 'Lower quietly.'],
  qualityGates: ['Both heels rise and lower under control.', 'Foot pressure stays balanced.', 'The calf work remains easy without burning fatigue.'],
  commonFaults: ['Bouncing through the bottom.', 'Rolling outward.', 'Performing extra reps until the calves tire.'],
  scaling: ['Reduce rise height.', 'Use fingertip support on an inspected stable bench if balance limits control.'],
  stopSigns: ['Foot, ankle or calf pain.', 'Sudden loss of strength or balance.', 'An unstable support or slippery surface.'],
}

const hingeRow: PreparationExercise = {
  id: 'lifting-unloaded-hinge-row',
  name: 'Bodyweight hinge + unloaded row',
  purposes: ['Mobilize', 'Activate', 'Integrate'],
  equipment: ['None'],
  whyHere: 'Combines posterior-chain positioning, pulling mechanics and trunk control in one efficient full-body preparation drill.',
  setup: ['Stand at a comfortable hip-width stance with knees softly bent.', 'Keep hands empty and ensure elbow movement remains inside the lane.'],
  executionSteps: ['Hinge the hips backward into a shallow, stable position.', 'Hold the trunk still while drawing the elbows back in an unloaded row.', 'Reach the arms down, stand tall and reset before the next repetition.'],
  coachCues: ['Hinge before rowing.', 'Quiet ribs during the pull.', 'Stand without leaning back.'],
  athleteCues: ['Keep my hips back.', 'Pull without swinging.', 'Reset every rep.'],
  qualityGates: ['The hinge is controlled before the row begins.', 'The trunk angle does not change during the row.', 'Standing and reset remain balanced.'],
  commonFaults: ['Using a shallow squat instead of a hinge.', 'Heaving the chest up with the elbows.', 'Shrugging at the end of the pull.'],
  scaling: ['Reduce the hinge depth.', 'Separate the hinge and standing unloaded row if combining them obscures control.'],
  stopSigns: ['Back, hip or shoulder pain.', 'Dizziness during position changes.', 'Repeated loss of trunk control.'],
}

const splitReach: PreparationExercise = {
  id: 'lifting-split-squat-small-rotation',
  name: 'Shallow split squat + small chest turn',
  purposes: ['Mobilize', 'Activate', 'Integrate'],
  equipment: ['None'],
  whyHere: 'Adds split-stance control and comfortable upper-back motion after the full-body squat and hinge patterns are established.',
  setup: ['Take a stationary split stance on two parallel tracks.', 'Place hands at the chest and use only enough depth to hold balance.'],
  executionSteps: ['Lower into a shallow split squat and settle.', 'Turn the chest slightly toward the front leg without forcing the pelvis to twist.', 'Return the chest to centre, stand and repeat; change the lead leg after the prescribed repetitions.'],
  coachCues: ['Set the legs first.', 'A small chest turn.', 'Come back to centre before standing.'],
  athleteCues: ['Keep my front foot down.', 'Move my chest smoothly.', 'Stay balanced on both sides.'],
  qualityGates: ['The stance and knee alignment remain stable during the turn.', 'Rotation stays comfortable and unforced.', 'The athlete can stop and reverse each phase.'],
  commonFaults: ['Twisting through the planted knee.', 'Narrowing the base.', 'Turning while falling into the split squat.'],
  scaling: ['Reduce split-squat depth and chest-turn range.', 'Perform the small chest turn from a tall parallel stance if split-stance balance is not ready.'],
  stopSigns: ['Knee, hip or back pain.', 'Repeated balance loss.', 'Discomfort during a small, controlled turn.'],
}

const floorPress: PreparationExercise = {
  id: 'lifting-first-lift-floor-press',
  name: 'First upper-body lift — dumbbell floor press',
  purposes: ['Integrate', 'Potentiate Bridge'],
  equipment: ['Very light dumbbells appropriate to the athlete; clear floor'],
  whyHere: 'Transfers the preceding wrist, shoulder and brace work into the actual opening lift. The concrete default is a dumbbell floor press when that is the first lift of the session.',
  setup: ['Confirm the first programmed lift before starting; if it is a row or overhead press, replace this exercise in both final steps with that exact lift and its setup.', 'For the floor-press default, lie with knees bent and feet grounded; arrange a safe dumbbell pickup and return before the clock starts.', 'Use empty hands for the initial rehearsal if even the lightest dumbbells would alter technique.'],
  executionSteps: ['Set wrists over forearms, elbows at a comfortable angle and ribs controlled against the floor.', 'Lower slowly until the upper arms meet the floor gently; do not bounce.', 'Press smoothly and stop short of any uncontrolled elbow lockout.', 'Finish the prescribed set and return the dumbbells by the pre-briefed route.'],
  coachCues: ['Wrists stacked.', 'Touch the floor softly.', 'Repeat the same press path.'],
  athleteCues: ['Set my breath and grip.', 'Lower under control.', 'Leave several easy reps available.'],
  qualityGates: ['The first-lift identity and setup match the coming session.', 'Every repetition has a controlled path and comfortable shoulder position.', 'The chosen light load allows at least four additional clean repetitions without grinding.'],
  commonFaults: ['Using the default press when the session begins with a different lift.', 'Bouncing upper arms on the floor.', 'Increasing weight because the timer still has space.'],
  scaling: ['Keep the same light load or use empty hands if control is uncertain.', 'Use a comfortable partial range; if no comfortable pressing range exists, stop and select an appropriate alternative with the coach.'],
  stopSigns: ['Shoulder, elbow or wrist pain.', 'An unstable grip or uncontrolled implement.', 'Any repetition that requires straining or loses the established path.'],
  versionNote: 'Exactly two final steps: one technique rehearsal, then a small progressive exposure to the same first lift. This is preparation, not the complete loading sequence for heavy lifting.',
}

const gobletSquat: PreparationExercise = {
  id: 'lifting-first-lift-goblet-squat',
  name: 'First lower-body lift — dumbbell goblet squat',
  purposes: ['Integrate', 'Potentiate Bridge'],
  equipment: ['One very light dumbbell appropriate to the athlete; optional inspected box'],
  whyHere: 'Transfers the ankle, hip, squat and brace checks into the actual opening lift. The concrete default is a dumbbell goblet squat when that is the first programmed lift.',
  setup: ['Confirm the first programmed lift; if it is a deadlift, split squat or other pattern, use that exact lift in both final steps instead.', 'For the goblet default, use a securely held light dumbbell at the chest with feet in the rehearsed stance.', 'Arrange safe pickup and set-down, and rehearse with empty hands when the minimum implement is too heavy.'],
  executionSteps: ['Set a comfortable breath and brace before lowering.', 'Squat through the hips and knees with heels grounded and the load close.', 'Pause only if prescribed, then stand smoothly without bouncing or leaning backward.', 'Complete the assigned repetitions and set the dumbbell down under control.'],
  coachCues: ['Keep the load close.', 'Use the depth you just earned.', 'Stand through the whole foot.'],
  athleteCues: ['Set, lower, stand.', 'Knees follow my feet.', 'Finish each rep in balance.'],
  qualityGates: ['The movement matches the actual first lift.', 'Load and range preserve the unloaded movement quality.', 'The athlete could perform at least four more clean repetitions without grinding.'],
  commonFaults: ['Adding depth simply because a weight is present.', 'Letting the weight pull the trunk forward.', 'Using a challenging set as the progressive preparation step.'],
  scaling: ['Retain the initial load or use bodyweight.', 'Use an inspected stable box as a controlled depth target without sitting or rocking backward.'],
  stopSigns: ['Knee, hip or back pain.', 'An insecure grip or uncontrolled load.', 'Repeated heel lift, balance loss or straining after scaling.'],
  versionNote: 'The goblet squat is a concrete default, not a substitute for rehearsing a different first lift. Additional lift-specific ramp sets remain necessary before heavy work.',
}

const fullBodyLift: PreparationExercise = {
  id: 'lifting-first-lift-dumbbell-squat-press',
  name: 'First full-body lift — dumbbell front squat → strict press',
  purposes: ['Integrate', 'Potentiate Bridge'],
  equipment: ['Two very light dumbbells appropriate to the athlete'],
  whyHere: 'Links the prepared squat, trunk and overhead positions to the actual opening full-body lift. The default is a front squat followed by a separate strict press, without a ballistic clean or throw.',
  setup: ['Confirm that this combination is the first programmed lift; otherwise replace both final steps with the actual first lift.', 'Use empty hands or very light dumbbells in a comfortable front-rack position; check overhead clearance.', 'Review safe pickup and set-down during the instruction allowance; use empty hands for the entire squat-and-press combination if a suitable dumbbell pair is unavailable.'],
  executionSteps: ['Brace gently and perform one controlled front squat to the rehearsed depth.', 'Stand fully and reset the ribs before pressing.', 'Press the dumbbells through a comfortable overhead path without leg drive or back extension.', 'Lower to the shoulders and reset; one squat followed by one press is one combination repetition.'],
  coachCues: ['Stand first, then press.', 'Ribs stay stacked under the hands.', 'Quiet weights on the return.'],
  athleteCues: ['Own two clear parts.', 'Keep my heels down in the squat.', 'Reach without leaning back.'],
  qualityGates: ['The exercise matches the actual first lift and the athlete has comfortable overhead range.', 'Squat and press remain distinct with a controlled pause between them.', 'The load is easy enough to leave at least four clean combination repetitions available.'],
  commonFaults: ['Turning the combination into an explosive thruster.', 'Pressing while still rising from the squat.', 'Arching the lower back to finish overhead.'],
  scaling: ['Use empty hands or keep the same very light load.', 'If overhead range is not comfortable, select the actual non-overhead first lift with the coach and rehearse that in both final steps.'],
  stopSigns: ['Shoulder, knee, hip or back pain.', 'Loss of overhead control or clearance.', 'A strained press, insecure grip or repeated rib flare.'],
  versionNote: 'This default uses no rack and no ballistic lift. Preparation ends before demanding loading; any heavy or technically complex first lift still needs additional specific ramp sets.',
}

function step(exercise: PreparationExercise, dose: string, workSeconds: number, recoverySeconds: number, transitionSeconds: number, delivery: string, effort = 'Easy, about 2–3/10 effort; smooth repetitions with no muscular burn.', stage: PreparationStep['stage'] = 'base'): PreparationStep {
  return { exercise, dose, seconds: workSeconds + recoverySeconds + transitionSeconds, workSeconds, recoverySeconds, transitionSeconds, delivery, effort, stage }
}

function bridge(exercise: PreparationExercise, duration: PreparationDuration): readonly PreparationStep[] {
  const combination = exercise.id === fullBodyLift.id
  const rehearsalReps = combination ? (duration === 5 ? 3 : 4) : (duration === 5 ? 4 : 5)
  const progressionReps = combination ? 3 : 4
  const rehearsalSeconds = duration === 5 ? 45 : duration === 10 ? (exercise.id === floorPress.id ? 60 : 90) : 120
  const progressiveSeconds = duration === 5 ? 60 : duration === 10 ? (exercise.id === floorPress.id ? 60 : 90) : 120
  const replacementDoseNote = 'Displayed repetitions and time windows apply to the bilateral default. For a unilateral replacement, the coach must state a dose for both sides and include side changes; extend the routine if that complete dose cannot fit without rushing.'
  return [
    step(exercise, `1 × ${rehearsalReps} ${combination ? 'combination ' : ''}reps with empty hands or the lightest controllable load`, combination ? 30 : 25, rehearsalSeconds - (combination ? 30 : 25) - 10, 10,
      `Use this slot for the actual first lift: the displayed exercise is the concrete default. ${replacementDoseNote} Coach one key setup point, then complete only ${rehearsalReps} controlled ${combination ? 'squat-then-press combination ' : ''}repetitions for the default, or the stated both-side replacement dose. The work window includes position resets; unused work time is rest. Observe one coach-selected correction during the allocated recovery; stage the next suitable load in the transition.`,
      'Technical rehearsal, about 2/10 effort; empty hands or a very light load.', 'rehearsal'),
    step(exercise, duration === 15 ? `2 × ${progressionReps} ${combination ? 'combination ' : ''}reps; 25 seconds rest between sets` : `1 × ${progressionReps} ${combination ? 'combination ' : ''}reps at a slightly more demanding but still easy load`, duration === 15 ? (combination ? 60 : 40) : (combination ? 30 : 25), progressiveSeconds - (duration === 15 ? (combination ? 60 : 40) : (combination ? 30 : 25)) - 10, 10,
      duration === 15
        ? `${replacementDoseNote} Set 1: use the rehearsal load or the smallest suitable increase. Rest 25 seconds from the recovery allowance, then perform set 2 only if the first set is clean; hold the load if the next increment is too large. Work time is the total for both controlled sets and resets; remaining recovery is observation and rest. Move to the main-lift ramp sets after the final transition.`
        : `${replacementDoseNote} Keep the exact first-lift pattern. Add only the smallest suitable load increase if rehearsal was clean; otherwise repeat the same load or regress. Complete the one prescribed easy set, then recover; unused work-window time is rest. If a suitable increment is unavailable, improve the repeatability of the same setup and motion. Continue with any required main-lift ramp sets after the transition.`,
      'Light preparation, about 3–4/10 effort; retain at least four clean reps in reserve, with no grinding or fixed percentage of maximum.', 'progressive'),
  ]
}

const commonSetup = [
  'Three separate 10 m lanes; time one wave of up to three athletes with one athlete per lane. Keep waiting athletes outside travel and implement paths.',
  'Pre-stage appropriately light implements at the stationary end of each lane. Use the scheduled instruction and transition allowances for concise exercise explanations and setup; extend preparation if more teaching is needed. Equipment quantities and minimum loads are unconfirmed.',
  'If there are too few suitable implements, stagger the wave and extend the session or select a longer routine; shared-equipment queues are not hidden inside these clocks.',
  'Inspect floor grip, implement condition, safe pickup and set-down space. No rack, cable machine, installed band anchor or throw-rated wall is assumed.',
] as const

function routine(discipline: 'lifting-upper' | 'lifting-lower' | 'lifting-full', title: string, durationMinutes: PreparationDuration, summary: string, coverage: readonly string[], steps: readonly PreparationStep[], equipment: readonly string[]): DisciplinePreparationRoutine {
  return {
    id: `access-prepare-${discipline}-${durationMinutes}`,
    discipline,
    title,
    durationMinutes,
    summary,
    purpose: `Prepare the positions and coordination needed for ${title.toLowerCase()} and finish with two specific exposures to the actual first programmed lift, preserving energy for the session.`,
    equipment,
    setup: commonSetup,
    entryCriteria: [
      'Confirm the day’s actual first lift and any known range or load restrictions; the coach has selected a suitable light starting implement.',
      'Athletes can follow the briefed positions and move through the selected ranges comfortably; shorten the range or choose the stated regression where necessary.',
      'The five-minute version is for a group familiar with these movements, with concise instructions included in the clock. If an athlete needs movement teaching, added readiness work or equipment changes, use the longer duration or extend preparation.',
    ],
    coverage,
    timeBudgetNote: `The clock totals exactly ${durationMinutes} minutes for one familiar wave, including the listed work, recovery and transitions with concise instruction. Work windows allow the stated controlled repetitions and resets; unused time becomes rest, never bonus repetitions. The final two slots are included.`,
    limitations: [
      'This routine does not complete the loading progression for heavy, near-maximal or technically unfamiliar lifting. Perform additional lift-specific ramp sets afterward as the planned lift and athlete require.',
      'No fixed percentage of one-repetition maximum is assumed. Minimum implement loads and increments must suit the athlete; retaining an easy load is an appropriate progression decision.',
      'A generic first-lift default cannot prepare every lifting pattern. Replace both final steps with the actual first lift; add a specific preparation drill or more time if its positions are not covered.',
      'The clock is a delivery target, not a reason to rush symptoms, movement learning, shared-equipment queues or necessary recovery. Stop the affected drill for pain, dizziness or lost control.',
    ],
    exitCriteria: [
      'The day’s required ranges are comfortable and repeatable, with controlled foot, wrist and trunk positions as relevant to the lift.',
      'Both final first-lift steps are complete with controlled repetitions, normal recovery and no meaningful preparation fatigue.',
      'The coach has identified the next suitable ramp load or retained the present load; athletes are not cleared for heavy work merely because the timer ended.',
    ],
    progression: 'Progress from comfortable unloaded range to the actual first-lift setup, then to a small, still-easy load exposure. Increase only one loading variable if quality stays consistent; otherwise repeat or scale. Record the actual lift, load and any changed range before the main ramp sets.',
    steps,
  }
}

const upperCoverage = ['Easy whole-body movement', 'Upper-back rotation and shoulder reach', 'Wrist loading and scapular control', 'Horizontal pushing and pulling', 'Breath and trunk organization', 'Actual first upper-body lift: technique rehearsal, then light progression']
const lowerCoverage = ['Easy whole-body movement', 'Ankle range and foot contact', 'Hip motion and hinge versus squat control', 'Split-stance balance', 'Breath and trunk organization', 'Actual first lower-body lift: technique rehearsal, then light progression']
const fullCoverage = ['Easy whole-body movement', 'Ankle and squat range', 'Hinge and pulling pattern', 'Wrist, scapular and shoulder organization', 'Trunk control through upper- and lower-body movement', 'Actual first full-body lift: technique rehearsal, then light progression']

const upper5 = [
  step(travelRaise, '30 seconds easy travel with relaxed arm sweeps', 30, 5, 10, 'Use controlled 5 m out-and-back segments; walk all turns. Move to the clear floor during the transition.'),
  step(thoracicReach, '2 slow reps per side', 30, 5, 10, 'Allow roughly 5 seconds per opening and return, including one side change. Rest after the prescribed four repetitions.'),
  step(wristScapBrace, '4 small wrist rocks + 4 scapular presses + 2 opposite reaches per side', 45, 5, 10, 'Remain in one quadruped setup. Use about 2 seconds per rock and press, and 4–5 seconds per reach; unused work time is rest.'),
  step(pushPullPrimer, '4 slow press-and-row cycles', 25, 10, 10, 'Use about 5 seconds per complete press-and-row cycle. Coach wrist and rib position, then set up the first lift during transition.'),
  ...bridge(floorPress, 5),
]
const upper10 = [
  step(travelRaise, '60 seconds easy travel with arm sweeps during walking', 60, 5, 10, 'Alternate easy travel and walking turns; add only comfortable arm motion.'),
  step(thoracicReach, '3 slow reps per side', 40, 10, 10, 'Open and return in about 5 seconds per repetition; take time to change sides.'),
  step(wristRocks, '6 small controlled rocks', 20, 15, 10, 'Use about 3 seconds per rock, then unload the hands while the coach checks comfort.'),
  step(scapularPress, '6 reps with a one-second finish pause', 25, 25, 10, 'Keep the elbows quiet. Observe one correction during recovery rather than adding more reps.'),
  step(bandRow, '6 easy reps, controlled return', 30, 20, 10, 'Use a light self-anchored band or the stated light-dumbbell substitute; spare time is recovery.'),
  step(deadBug, '3 heel slides per side', 35, 15, 10, 'Exhale, slide, return and reset the breath on each rep. Keep the work easy and unhurried.'),
  step(pushPrimer, '4 easy reps with a two-second lower', 20, 30, 10, 'Choose the knee or inspected bench version that stays easy; stop after four clean reps.'),
  step(shoulderRotation, '3 slow unloaded reps per side', 30, 20, 10, 'Include one side change and stop before any shoulder pinching. Prepare the first lift during transition.'),
  ...bridge(floorPress, 10),
]
const upper15 = [
  step(travelRaise, '75 seconds easy travel with arm sweeps during walking', 75, 5, 10, 'Build gradually within conversational effort and walk every turn.'),
  step(thoracicReach, '4 slow reps per side', 50, 30, 10, 'Use about 5 seconds per opening and return; recover while the coach compares control on each side.'),
  step(wristRocks, '6 small rocks; pause briefly at the comfortable forward limit', 25, 25, 10, 'Use small deliberate shifts, then unload the hands. Recovery provides time for a grip-position check.'),
  step(scapularPress, '2 × 4 reps; 15 seconds rest between sets', 35, 30, 10, 'Use about 4 seconds per rep. Take 15 seconds of the recovery allowance between sets and the remainder afterward; the second set repeats one corrected cue.'),
  step(bandRow, '2 × 5 easy reps; 20 seconds rest between sets', 40, 40, 10, 'Use the same light tension for both sets. Recovery includes the 20-second between-set rest; hold the hinge and keep the remaining rest.'),
  step(deadBug, '4 heel slides per side', 45, 20, 10, 'Use one controlled breath-and-slide cycle per rep; finish without prolonged breath holding.'),
  step(pushPrimer, '2 × 3 easy reps; 20 seconds rest between sets', 30, 50, 10, 'Keep the same easy variation for both sets. Allocate 20 seconds recovery between sets and use the remaining recovery for one technique check.'),
  step(shoulderRotation, '4 slow unloaded reps per side', 40, 40, 10, 'Use the smallest comfortable range that shows rotation clearly; no dumbbells are added. Recover and pre-stage the actual first lift.'),
  ...bridge(floorPress, 15),
]

const lower5 = [
  step(travelRaise, '30 seconds easy travel', 30, 5, 10, 'Use easy 5 m segments with walking turns, then remain standing at the lane end.'),
  step(ankleRocks, '4 controlled rocks per side', 30, 5, 10, 'Allow about 3 seconds per rock; use the remaining work window to switch sides.'),
  step(hingeSquat, '3 hinges + 3 squats + 2 gentle brace breaths', 40, 10, 10, 'Take about 4 seconds per hinge or squat and about 5 seconds per brace breath. Protect the distinction between the two patterns.'),
  step(splitStance, '2 shallow split-squat reps per side', 25, 10, 10, 'Settle the backward step before each shallow bend; alternate sides and leave equipment pickup for the transition.'),
  ...bridge(gobletSquat, 5),
]
const lower10 = [
  step(travelRaise, '60 seconds easy travel', 60, 5, 10, 'Use relaxed straight segments and deliberate walking turns.'),
  step(ankleRocks, '5 controlled rocks per side', 35, 15, 10, 'Keep the heels grounded; use the recovery to compare comfortable range without forcing symmetry.'),
  step(lateralHip, '4 small shifts per side', 35, 15, 10, 'Alternate sides in a smooth rhythm and return fully to centre after each shift.'),
  step(hinge, '5 reps with a one-second hinge pause', 25, 25, 10, 'Use the pause for the coach to see foot pressure and trunk position; do not chase floor reach.'),
  step(squatReach, '5 controlled squat-and-reach reps', 30, 20, 10, 'Stand fully before the reach. Shorten the reach if the lower-body session does not require overhead range.'),
  step(splitStance, '3 shallow split-squat reps per side', 35, 15, 10, 'Use deliberate step, settle, bend and return phases; stop after the prescribed six repetitions.'),
  step(calfRise, '5 reps with a two-second lower', 25, 10, 10, 'Use a small controlled top pause; check foot contact before picking up the first-lift load.'),
  ...bridge(gobletSquat, 10),
]
const lower15 = [
  step(travelRaise, '75 seconds easy travel', 75, 5, 10, 'Build movement gradually with controlled walking turns and comfortable arm motion.'),
  step(ankleRocks, '6 controlled rocks per side', 45, 35, 10, 'Use about 3 seconds per rock with time to change stance. The recovery lets the coach check how the chosen range carries into the next squat.'),
  step(lateralHip, '5 small shifts per side', 45, 35, 10, 'Alternate sides, using a brief stable finish before returning to centre. Do not hold a deep stretch.'),
  step(hinge, '2 × 4 reps with a one-second pause; 20 seconds rest between sets', 40, 40, 10, 'Allocate 20 seconds of recovery between sets; apply one observed correction in set 2 without adding load.'),
  step(squatReach, '2 × 4 controlled reps; 20 seconds rest between sets', 45, 35, 10, 'Recovery includes 20 seconds between sets. Repeat the same controlled depth and separate standing from reaching.'),
  step(splitStance, '4 shallow split-squat reps per side', 45, 35, 10, 'Use one settled backward step per repetition and keep the recovery instead of increasing depth or speed.'),
  step(calfRise, '6 reps with a two-second lower', 30, 20, 10, 'Keep the dose easy with no bouncing and no extra contacts.'),
  step(deadBug, '3 heel slides per side', 35, 15, 10, 'Set the same gentle brace that will be used in the main-lift rehearsal; pre-stage the load during transition.'),
  ...bridge(gobletSquat, 15),
]

const full5 = [
  step(travelRaise, '30 seconds easy travel with relaxed arm sweeps', 30, 5, 10, 'Use walking turns and finish at the stationary end of the lane.'),
  step(squatReach, '4 controlled squat-and-reach reps', 25, 10, 10, 'Use about 5 seconds per combination; the squat checks ankle/hip access and the reach checks overhead control.'),
  step(wristScapBrace, '4 wrist rocks + 4 scapular presses + 2 opposite reaches per side', 45, 5, 10, 'Stay in one floor position and keep the movements small; transition to standing under control.'),
  step(hingeRow, '4 controlled hinge-and-row reps', 25, 10, 10, 'Hinge, row, return the arms and stand once per rep; unused time is rest before the first-lift setup.'),
  ...bridge(fullBodyLift, 5),
]
const full10 = [
  step(travelRaise, '60 seconds easy travel with relaxed arm sweeps', 60, 5, 10, 'Build gradually, with controlled walking turns and no fast shuttles.'),
  step(ankleRocks, '4 controlled rocks per side', 30, 5, 10, 'Use about 3 seconds per rock; maintain grounded heels and allow a stance change.'),
  step(squatReach, '5 controlled squat-and-reach reps', 30, 20, 10, 'Set squat depth and overhead range separately; neither should borrow motion from the lower back.'),
  step(wristScapBrace, '4 wrist rocks + 4 scapular presses + 2 opposite reaches per side', 45, 5, 10, 'Use the scheduled instruction and transition allowance for a concise flow cue. Keep the bird-dog reach low enough to preserve the pelvis position; extend preparation if the athlete needs further teaching.'),
  step(hingeRow, '5 controlled hinge-and-row reps', 30, 20, 10, 'Pause in the hinge before rowing; recover after five repetitions.'),
  step(splitReach, '3 shallow split-squat-and-turn reps per side', 35, 15, 10, 'Set the legs, use a small chest turn, return to centre and stand; no fast twisting.'),
  step(deadBug, '3 heel slides per side', 35, 15, 10, 'Reset breathing each repetition; use the transition to arrange the actual first-lift setup.'),
  ...bridge(fullBodyLift, 10),
]
const full15 = [
  step(travelRaise, '75 seconds easy travel with relaxed arm sweeps', 75, 5, 10, 'Stay conversational and use controlled turns throughout.'),
  step(ankleRocks, '5 controlled rocks per side', 35, 15, 10, 'Check heel contact and return control on both sides before the squat flow.'),
  step(squatReach, '2 × 4 controlled reps; 20 seconds rest between sets', 45, 35, 10, 'Recovery includes 20 seconds between sets. Apply one squat or reach cue in set 2; do not deepen the range automatically.'),
  step(wristScapBrace, '6 wrist rocks + 6 scapular presses + 3 opposite reaches per side', 60, 20, 10, 'Use about 2 seconds per rock and press, then 4–5 seconds per opposite reach. Remain low-volume and controlled; keep the recovery after the flow.'),
  step(hingeRow, '2 × 4 controlled reps; 20 seconds rest between sets', 45, 35, 10, 'Rest 20 seconds between sets from the recovery allowance; repeat a stable hinge and quiet row in set 2.'),
  step(splitReach, '4 shallow split-squat-and-turn reps per side', 45, 35, 10, 'Keep the turn small and use the recovery for a coach check of the split base and front-knee alignment.'),
  step(deadBug, '4 heel slides per side', 45, 35, 10, 'Use deliberate exhale-and-slide cycles without prolonged breath holds; finish fresh.'),
  step(bandRow, '6 easy reps with a controlled return', 30, 20, 10, 'Add a small external pulling load after the unloaded hinge-row; no extra repetitions. Stage the actual first lift during transition.'),
  ...bridge(fullBodyLift, 15),
]

export const LIFTING_PREPARATION_ROUTINES: readonly DisciplinePreparationRoutine[] = [
  routine('lifting-upper', 'Lifting: Upper body', 15, 'A detailed upper-body preparation: thoracic motion, wrist and scapular control, light push/pull practice and breathing, with time to correct positions before two first-lift bridge steps.', upperCoverage, upper15, ['Cones', 'Appropriately light dumbbells', 'Inspected light bands; light dumbbells can substitute', 'Optional inspected stable bench']),
  routine('lifting-upper', 'Lifting: Upper body', 10, 'A balanced upper-body sequence covering comfortable shoulder motion, hand support, pushing, pulling and bracing before the actual first lift.', upperCoverage, upper10, ['Cones', 'Appropriately light dumbbells', 'Inspected light bands; light dumbbells can substitute', 'Optional inspected stable bench']),
  routine('lifting-upper', 'Lifting: Upper body', 5, 'The familiar-group essentials: raise, rotate, combine wrist/scapular/brace work, check push/pull positions, then rehearse and lightly progress the actual first lift.', upperCoverage, upper5, ['Cones', 'Appropriately light dumbbells']),
  routine('lifting-lower', 'Lifting: Lower body', 15, 'A thorough lower-body preparation with ankle and hip access, distinct squat and hinge checks, split-stance and foot control, and extra time for first-lift correction.', lowerCoverage, lower15, ['Cones', 'One appropriately light dumbbell per active athlete', 'Optional inspected stable bench or box']),
  routine('lifting-lower', 'Lifting: Lower body', 10, 'A balanced progression through ankle, lateral hip, hinge, squat, split stance and calf control before two specific exposures to the first lower-body lift.', lowerCoverage, lower10, ['Cones', 'One appropriately light dumbbell per active athlete', 'Optional inspected stable bench or box']),
  routine('lifting-lower', 'Lifting: Lower body', 5, 'The familiar-group essentials: easy movement, ankle access, a combined hinge/squat/brace check and split stance, with protected time for the actual first lift.', lowerCoverage, lower5, ['Cones', 'One appropriately light dumbbell per active athlete']),
  routine('lifting-full', 'Lifting: Full body', 15, 'A coordinated full-body sequence covering squat, hinge, push-support, pulling, split stance and bracing, with repeatable corrections and two specific first-lift bridge steps.', fullCoverage, full15, ['Cones', 'Appropriately light dumbbells', 'Inspected light band; light dumbbells can substitute']),
  routine('lifting-full', 'Lifting: Full body', 10, 'An efficient whole-body preparation that connects ankle and hip motion to shoulder, wrist and trunk control before the actual opening lift.', fullCoverage, full10, ['Cones', 'Appropriately light dumbbells']),
  routine('lifting-full', 'Lifting: Full body', 5, 'Four compact whole-body preparation drills cover the key positions, followed by technique rehearsal and a light progressive set of the actual first lift.', fullCoverage, full5, ['Cones', 'Appropriately light dumbbells']),
]
