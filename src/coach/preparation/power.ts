import { ACCESS_PREPARE_STANDARD } from '../accessPrepareStandard'
import type { DisciplinePreparationRoutine, PreparationExercise, PreparationStep } from './types'

const standard = (id: string): PreparationExercise => {
  const source = ACCESS_PREPARE_STANDARD.exercises.find((exercise) => exercise.id === id)
  if (!source) throw new Error(`Unknown preparation exercise: ${id}`)
  // Reuse coaching notes, never the Standard routine's order or dose.
  return {
    id: source.id, name: source.name, purposes: source.purposes, equipment: source.equipment,
    whyHere: source.whyHere, setup: source.setup, executionSteps: source.executionSteps,
    coachCues: source.coachCues, athleteCues: source.athleteCues, qualityGates: source.qualityGates,
    commonFaults: source.commonFaults, scaling: source.scaling, stopSigns: source.stopSigns,
    versionNote: source.versionNote,
  }
}

const raise: PreparationExercise = {
  id: 'power-march-arm-sweep', name: 'Brisk march + relaxed arm sweeps', purposes: ['Raise', 'Mobilize'], equipment: ['Bodyweight'],
  whyHere: 'Raises movement tempo while taking the shoulders through comfortable arm swings without occupying a travel or throwing path.',
  setup: ['Stand in the center of the lane with full arm clearance.', 'Listen to the coach’s route, stop cue and comfort check while starting with an easy march.'],
  executionSteps: ['March in place with relaxed opposite arm and leg action.', 'Gradually quicken the steps without stamping; add small forward and backward arm sweeps.', 'Keep breathing easy and shoulders away from the ears.'],
  coachCues: ['Easy rhythm first.', 'Move the arms without arching the back.'], athleteCues: ['Warm, relaxed and in my own space.', 'I can still talk.'],
  qualityGates: ['Foot contacts remain quiet and symmetrical.', 'Arm range and breathing remain comfortable.'], commonFaults: ['Turning the march into hard high-knee conditioning.', 'Forcing the shoulders overhead or leaning backward.'],
  scaling: ['March more slowly with smaller arm swings.', 'Keep the arms below shoulder height if overhead movement is not comfortable.'], stopSigns: ['Pain, altered gait or dizziness.', 'Breathlessness that prevents easy conversation or unsafe clearance.'],
}

const pivot: PreparationExercise = {
  id: 'throw-foot-led-turn', name: 'Foot-led hip turn + thoracic reach', purposes: ['Mobilize', 'Integrate'], equipment: ['Bodyweight'],
  whyHere: 'Rehearses ground-to-hip-to-trunk sequencing before adding an implement or a release.',
  setup: ['Stand side-on in a comfortable split stance, with room to reach inside the lane.', 'Start with the hands lightly together in front of the chest.'],
  executionSteps: ['Let the back heel turn as pressure moves toward the front foot.', 'Turn the pelvis, then allow the rib cage and hands to follow.', 'Finish balanced without twisting over a fixed knee; reset and perform both directions.'],
  coachCues: ['Foot, hip, chest, hands.', 'Let the heel turn.'], athleteCues: ['Turn on my feet.', 'Finish tall and balanced.'],
  qualityGates: ['Rotation follows the feet rather than wrenching the knee or low back.', 'The athlete can pause at the finish on either side.'], commonFaults: ['Spinning only the arms.', 'Locking the back foot while forcing the torso around.'],
  scaling: ['Use a smaller turn and parallel stance.', 'Rehearse a slow weight shift with hands at the chest.'], stopSigns: ['Knee, hip or back pain with the turn.', 'Repeated loss of balance or slipping.'],
}

const shoulder: PreparationExercise = {
  id: 'throw-shoulder-elbow-wrist', name: 'Shoulder circles + elbow and wrist preparation', purposes: ['Mobilize', 'Activate'], equipment: ['Bodyweight'],
  whyHere: 'Accesses comfortable shoulder, elbow and wrist motion before the hand accelerates an object.',
  setup: ['Stand tall with enough space for each arm.', 'Keep the first circles small; do not use momentum to reach behind the body.'],
  executionSteps: ['Make the prescribed slow circles forward and backward with each arm.', 'Bend and straighten the elbows while keeping the shoulders relaxed.', 'Open and close the hands, then gently flex and extend the wrists without a forced end-range stretch.'],
  coachCues: ['Smooth circles, quiet ribs.', 'Open the hands and release the grip.'], athleteCues: ['Use a comfortable circle.', 'Move every joint smoothly.'],
  qualityGates: ['Shoulder motion does not require rib flare.', 'Elbow and wrist movement stays comfortable through the chosen range.'], commonFaults: ['Fast windmilling.', 'Forcing the wrist or locking the elbow.'],
  scaling: ['Use smaller single-arm circles.', 'Support the moving forearm with the other hand for wrist motion.'], stopSigns: ['Pain, catching or new tingling.', 'Loss of comfortable shoulder control.'],
}

const scapula: PreparationExercise = {
  id: 'throw-scapular-reach', name: 'Standing scapular reach + overhead return', purposes: ['Mobilize', 'Activate'], equipment: ['Bodyweight'],
  whyHere: 'Coordinates shoulder-blade motion with the rib cage before a throw or overhead lift of the ball.',
  setup: ['Stand with feet under the hips and arms reaching forward at chest height.', 'Keep the abdomen lightly engaged without holding the breath.'],
  executionSteps: ['Reach the hands forward gently and allow the shoulder blades to wrap around the ribs.', 'Draw the arms back without pinching the shoulder blades hard.', 'Sweep the arms up only as far as the ribs stay stacked, then return to the starting reach.'],
  coachCues: ['Shoulder blades move with the arms.', 'Reach up without leaning back.'], athleteCues: ['Long arms and quiet ribs.', 'Breathe through the reach.'],
  qualityGates: ['The shoulder blades move smoothly without neck tension.', 'Overhead range ends before the trunk extends.'], commonFaults: ['Shrugging throughout the movement.', 'Forcing the arms up by flaring the ribs.'],
  scaling: ['Keep the sweep below shoulder height.', 'Perform just the forward reach and return while maintaining control.'], stopSigns: ['Shoulder pain or a catching sensation.', 'New neck or arm symptoms.'],
}

const rotation: PreparationExercise = {
  id: 'throw-light-band-external-rotation', name: 'Light-band external rotation at the sides', purposes: ['Activate'], equipment: ['Light band; no anchor required'],
  whyHere: 'Adds a brief, low-effort shoulder rotation exposure while keeping the arm close to the body before larger throwing movements.',
  setup: ['Inspect a light band and hold it between the hands with elbows bent to about 90 degrees.', 'Keep elbows near the ribs and wrists straight; start with minimal band tension.'],
  executionSteps: ['Rotate the forearms gently outward while the upper arms remain close to the trunk.', 'Pause briefly without shrugging or arching.', 'Return slowly and release tension between repetitions.'],
  coachCues: ['Small controlled rotation.', 'Keep the elbows near the ribs.'], athleteCues: ['Open gently, return slowly.', 'No shoulder burn.'],
  qualityGates: ['Each repetition stays easy with substantial reserve.', 'Wrists stay aligned and elbows do not drift behind the body.'], commonFaults: ['Choosing a band that makes the shoulders shrug.', 'Pulling the elbows backward instead of rotating.'],
  scaling: ['Use a lighter band or shorten the range.', 'Without a suitable band, perform unloaded external rotation with the same elbow position and dose; it rehearses motion without equivalent resistance.'], stopSigns: ['Shoulder pain or new arm symptoms.', 'Band damage, slipping grip or inability to control the return.'],
}

const lunge: PreparationExercise = {
  ...standard('walking-lunge-rotation-reach'), id: 'power-stationary-split-reach', name: 'Stationary split-stance lunge + reach',
  whyHere: 'Accesses a controlled hip position and front-leg support for a throwing plant or jump takeoff without repeated travel and turns.',
  setup: ['Stand in a short split stance inside the lane, with the entire front foot supported.', 'Keep enough side clearance for a comfortable trunk reach.'],
  executionSteps: ['Lower through a small, controlled split squat.', 'Pause over the front foot and reach gently toward the front-leg side.', 'Return to standing in the same stance; complete the dose, then switch legs.'],
  coachCues: ['Set the stance, own the lunge, then reach.', 'Front foot stays planted.', 'Rotate through a comfortable range.'],
  commonFaults: ['Rotating before balance is established.', 'Front heel lifting or knee collapsing inward.', 'Using a stance too long or narrow to control.'],
  scaling: ['Reduce lunge depth and shorten the stationary stance.', 'Use a split-stance hold with a small reach.', 'Omit the reach and rehearse a shallow split-stance knee bend if balance is limiting.'],
  versionNote: 'Stationary version of the standard walking lunge: no 5 m travel is added to the dose.',
}

const throwRehearsal: PreparationExercise = {
  id: 'throw-retained-ball-sequence', name: 'Light medicine-ball hip-to-hand rehearsal', purposes: ['Integrate', 'Potentiate Bridge'], equipment: ['Light, grippable medicine ball; bodyweight alternative'],
  whyHere: 'Links a stable plant, hip turn and arm path while the athlete retains the ball, allowing technique review before any release.',
  setup: ['Stand in a short split stance, holding a light ball close to the chest.', 'The coach selects the upcoming throw family: chest pass, rotational projection or overhead action. Keep all arm motion within the lane.'],
  executionSteps: ['For chest-pass preparation, shift toward the front foot and press the ball forward without releasing.', 'For rotational preparation, turn the feet and hips before carrying the ball across toward the finish; for overhead preparation, use a comfortable lift and controlled downward path.', 'Stop the ball smoothly with both hands, reset the stance and alternate sides where relevant. Use one selected family for the entire stated dose.'],
  coachCues: ['Feet organize the throw.', 'Keep the ball in the hands.'], athleteCues: ['Legs, body, hands.', 'Own the finish before resetting.'],
  qualityGates: ['The ball remains controlled throughout the selected path.', 'The athlete can pause at the plant and finish without trunk collapse.'], commonFaults: ['Releasing before a throwing area has been established.', 'Using a heavy ball that changes the arm path or pulls the athlete off balance.'],
  scaling: ['Rehearse the same movement with empty hands.', 'Shorten the arm path and omit the step or turn until the standing pattern is stable.'], stopSigns: ['Pain during the plant or arm path.', 'Slipping ball, uncontrolled finish or a person entering the lane.'],
}

const throwProgressive: PreparationExercise = {
  id: 'throw-progressive-rehearsal', name: 'Progressive throw pattern + controlled finish', purposes: ['Potentiate Bridge'], equipment: ['Bodyweight or very light medicine ball', 'Optional non-rebounding slam ball on an approved impact floor'],
  whyHere: 'Raises the intent of the selected throwing pattern in a small dose while confirming the plant, sequence and finish.',
  setup: ['Default to the same retained-ball or empty-hand pattern used in Bridge 1.', 'For a downward-throw session only, the coach may select a non-rebounding slam ball after confirming floor approval, grip, containment and complete lane clearance. No throw-rated wall or partner is assumed.'],
  executionSteps: ['Follow this row’s attempt count and progression: begin smoothly and easily, then increase intent only on the later attempts specified in its dose and only if the finish remains controlled.', 'Retain the medicine ball; never use maximal arm speed while abruptly stopping a held load.', 'For the optional floor release, lift only to a controlled height, direct the non-rebounding ball down just in front of the feet, finish balanced and wait until it is still before retrieving.', 'Reset fully between attempts; finish with the same quality as the first.'],
  coachCues: ['Build the sequence, not fatigue.', 'Recover the finish before the next attempt.'], athleteCues: ['A little sharper, still controlled.', 'Ball still, then retrieve.'],
  qualityGates: ['Intent increases only while the same plant and trunk organization remain visible.', 'Every retained ball stays in the hands; every optional release stays contained and is retrieved only after stopping.'], commonFaults: ['Trying to manufacture maximal throwing speed in a short indoor lane.', 'Using a rebounding ball for a downward release.', 'Rushing retrieval into another athlete’s path.'],
  scaling: ['Use empty-hand rehearsal at smooth speed.', 'Keep every attempt at the first easy intent; remove release when floor approval or containment is uncertain.'], stopSigns: ['Shoulder, elbow, back or plant-leg pain.', 'Loss of ball control, unexpected rebound or unsafe shared space.'],
  versionNote: 'This indoor bridge prepares the throwing sequence. It does not replace progressive throws with the actual sporting implement in an appropriate throwing area.',
}

const ankle: PreparationExercise = {
  id: 'jump-ankle-rock-foot-pressure', name: 'Ankle rocks + tripod foot pressure', purposes: ['Mobilize', 'Activate'], equipment: ['Bodyweight'],
  whyHere: 'Prepares controlled knee travel over a planted foot and makes the foot pressure used in takeoff and landing observable.',
  setup: ['Use a staggered stance inside the lane with the front heel fully down.', 'Keep pressure through the heel and bases of the big and little toes.'],
  executionSteps: ['Move the front knee forward in line with the foot while the heel stays supported.', 'Pause briefly at the comfortable limit, then return.', 'Complete both sides without rolling onto the inside edge of the foot.'],
  coachCues: ['Heel down, knee follows the toes.', 'Use the range you can own.'], athleteCues: ['Keep all three foot points.', 'Rock slowly, no bounce.'],
  qualityGates: ['The front heel stays down.', 'Both directions of the rock remain controlled without forcing depth.'], commonFaults: ['Lifting the heel to gain range.', 'Collapsing the arch or driving the knee inward.'],
  scaling: ['Shorten the forward rock.', 'Use the other foot as extra balance support, keeping most pressure on the front foot.'], stopSigns: ['Ankle or knee pain.', 'Repeated loss of foot pressure or balance.'],
}

const calf: PreparationExercise = {
  id: 'jump-calf-raise-straight-bent', name: 'Straight-knee + bent-knee calf raises', purposes: ['Activate'], equipment: ['Bodyweight'],
  whyHere: 'Exposes the ankle plantarflexors to controlled force in two knee positions before introducing flight and repeated contacts.',
  setup: ['Stand with feet about hip width and full floor contact.', 'Use both feet together; this is an easy bilateral preparation, not a single-leg strength test.'],
  executionSteps: ['Rise smoothly onto the forefeet with the knees comfortably straight, then lower the heels quietly.', 'After the specified straight-knee repetitions, bend the knees slightly and repeat with the knee angle held steady.', 'Use a modest height and complete the stated dose only.'],
  coachCues: ['Rise through both feet evenly.', 'Quiet, controlled heels.'], athleteCues: ['Up together, down slowly.', 'Leave plenty in reserve.'],
  qualityGates: ['Pressure stays even across both forefeet.', 'Knee position remains recognizable and effort stays easy.'], commonFaults: ['Rolling onto the outside of the feet.', 'Bouncing quickly or continuing until the calves burn.'],
  scaling: ['Reduce height and repetitions.', 'If balance is uncertain, use a verified stable support or replace with seated heel lifts at an inspected bench.'], stopSigns: ['Calf, Achilles or foot pain.', 'Cramping or persistent balance loss.'],
}

const snap: PreparationExercise = {
  ...standard('traveling-snap-down-athletic-stick'), id: 'jump-stationary-snap-stick', name: 'Stationary snap-down → landing stick',
  whyHere: 'Checks foot, knee, hip and trunk organization in the landing shape without adding flight contacts.',
  setup: ['Stand tall on flat feet in the center of the lane.', 'Keep a clear area for the full landing stance; no box, step or forward travel is needed.'],
  executionSteps: ['Move briskly from standing into a shallow athletic stance without jumping.', 'Bend the hips and knees together, keep the whole feet supported and hold for two seconds.', 'Stand slowly, reset fully and repeat only the stated dose.'],
  athleteCues: ['Settle balanced.', 'Knees follow feet.', 'Hold, stand, reset.'],
  qualityGates: ['Every repetition ends in a stable two-foot position without leaving the floor.', 'The athlete bends through a comfortable ankle-knee-hip range without collapse.', 'The held finish is quiet and controlled before standing to reset.'],
  scaling: ['Lower slowly into a shallow athletic stance without a brisk snap.', 'Reduce speed and stance depth until each hold is stable.'],
  stopSigns: ['Pain while lowering or holding the stance.', 'Repeated loss of balance or uncontrolled knee movement.', 'Inability to remain within the stationary footprint.'],
  versionNote: 'Stationary, no-flight version. These are landing-shape repetitions, not jump contacts.',
}

const pogo: PreparationExercise = {
  ...standard('low-two-foot-pogos'), id: 'jump-low-pogo-preparation', name: 'Low two-foot pogos in place',
  whyHere: 'Introduces a small number of low-amplitude elastic contacts after foot pressure, calf loading and landing control have been observed.',
  executionSteps: ['Begin tall with knees soft and arms relaxed or held in a consistent position.', 'Make a small two-foot hop using a quick ankle-led push.', 'Land on both feet in the same footprint with a quiet, controlled contact.', 'Complete only the stated contacts in each set, settle to a balanced stop and take the prescribed recovery before any second set.'],
  qualityGates: ['Every prescribed contact stays low, quiet and in place.', 'Feet leave and meet the floor together without the knees collapsing inward.', 'The athlete can stop in balance at the end of each stated set.'],
  versionNote: 'Each landing counts as one contact. Keep flight low; finish the stated contacts and recover rather than bouncing throughout the work window.',
}

const jumpRehearsal: PreparationExercise = {
  id: 'jump-takeoff-landing-rehearsal', name: 'Low jump → two-second landing hold', purposes: ['Integrate', 'Potentiate Bridge'], equipment: ['Bodyweight', 'Cones to define the landing area'],
  whyHere: 'Connects the chosen takeoff direction to an observable landing before a small increase in intent.',
  setup: ['Choose the direction of the first main jump: vertical, short forward or short lateral.', 'Use a bilateral takeoff and landing for this preparation. For forward or lateral work, use a small displacement that leaves generous clearance inside the lane.'],
  executionSteps: ['Use a shallow countermovement and coordinated arm swing.', 'Make a low jump in the selected direction.', 'Land on both feet with comfortable knee and hip bend; hold two seconds, stand and reset.', 'For lateral work alternate directions, splitting the total contacts equally.'],
  coachCues: ['Take off softly; land where planned.', 'Own the landing for two seconds.'], athleteCues: ['Small jump, quiet feet.', 'Freeze, then reset.'],
  qualityGates: ['Both feet land under control without an extra stabilizing hop.', 'Knees track with the feet and the trunk stays balanced.'], commonFaults: ['Chasing height or distance before the landing is controlled.', 'Landing stiff-legged or immediately rebounding.'],
  scaling: ['Use the no-flight snap-down with the same number of repetitions.', 'Select a vertical jump if horizontal or lateral clearance is insufficient.'], stopSigns: ['Pain at takeoff or landing.', 'Repeated extra hops, knee collapse or loss of lane clearance.'],
}

const jumpProgressive: PreparationExercise = {
  ...jumpRehearsal, id: 'jump-progressive-direction', name: 'Progressive task-direction jumps',
  whyHere: 'Increases intent in the upcoming jump direction after a successful low-jump rehearsal, while preserving a very small total contact dose.',
  setup: ['Keep the same direction and marked landing area used in Bridge 1.', 'Use rebound pairs only when this row explicitly lists that option, the main session calls for rebounding and stable repeated landing control has been observed. Otherwise keep separate held landings; the five-minute version always uses held landings.'],
  executionSteps: ['Start with the prescribed easy pair, then make later attempts moderately more purposeful if quality remains stable.', 'Reset between isolated jumps and hold the final landing of every attempt.', 'Only when this row permits the rebound option, replace two separate jumps with one low two-contact pair: first landing rebounds immediately, second landing sticks. Keep both contacts inside the marked area and preserve the same total contact allowance.', 'For lateral rebound pairs, make a small jump out and rebound back to the starting footprint so each pair contains one leftward and one rightward contact. For isolated lateral jumps, alternate directions equally.', 'Walk back only after stopping; recover fully before the next attempt or pair.'],
  coachCues: ['A little more intent, same landing.', 'Stop before the contacts become heavy.'], athleteCues: ['Keep my best landing.', 'Recover between attempts.'],
  qualityGates: ['The later attempts retain the first attempt’s balance and landing control.', 'A rebound option stays low with a controlled final stop.'],
  commonFaults: ['Treating preparation as a maximal jump test.', 'Adding extra jumps to fill the clock.', 'Using rebound pairs before the athlete can stick a single jump.'],
  scaling: ['Keep every jump at the initial low height or replace with no-flight snap-downs.', 'Use isolated jumps instead of rebound pairs; retain the same or fewer contacts.'],
  versionNote: 'No drop jumps, boxes, maximal bounds or unilateral impact progression are implied. Those tasks need their own readiness check and staged exposure.',
}

const step = (exercise: PreparationExercise, dose: string, seconds: number, workSeconds: number, recoverySeconds: number, delivery: string, stage: PreparationStep['stage'] = 'base', effort = 'Easy and controlled; stop at the stated dose.') : PreparationStep => ({
  exercise, dose, seconds, workSeconds, recoverySeconds, transitionSeconds: seconds - workSeconds - recoverySeconds, delivery, stage, effort,
})
const hinge: PreparationExercise = {
  ...standard('bodyweight-hip-hinge-reach'),
  equipment: ['Bodyweight'],
  whyHere: 'Checks a controlled hip hinge, supported foot pressure and comfortable trunk position before the more specific power preparation.',
  setup: ['Stand with feet about hip-width and clear reach space in front.', 'Soften the knees and place the hands briefly at the hip creases to identify the hinge; no wall, dowel or support is required.'],
  scaling: ['Reduce the hinge depth while keeping the feet supported.', 'Keep the hands at the hip creases instead of reaching if the reach disrupts balance.', 'Use a small hip-back weight shift and return to standing if a deeper hinge is not controlled.'],
}
const squat: PreparationExercise = {
  ...standard('squat-to-stand-overhead-reach'),
  whyHere: 'Observes a comfortable squat, stand and overhead reach before introducing more specific takeoff and landing work.',
  executionSteps: ['Sit between the feet into a comfortable squat while keeping the feet supported.', 'Pause briefly in the lowest controlled position.', 'Press through the feet and stand tall without rushing.', 'Reach both arms overhead only as far as trunk and rib position remain controlled.', 'Return the arms, reset and complete only the stated repetitions.'],
  qualityGates: ['The athlete descends and stands with the feet supported and knees tracking with the feet.', 'Squat depth remains controlled and repeatable throughout the stated dose.', 'The overhead reach occurs without forced range, rib flare or loss of balance.'],
}

const throwingShared = {
  discipline: 'throwing', title: 'Throwing',
  purpose: 'Prepare foot-to-hand force transfer, comfortable shoulder motion and a controlled release pattern while keeping shoulder and trunk fatigue low.',
  equipment: ['Cones for three 10 m lanes', 'Light bands held between the hands; no anchor', 'Light medicine ball per active athlete, or empty-hand rehearsal', 'Optional non-rebounding slam balls only for an approved downward-throw station'],
  setup: ['Keep warm-up stations stationary in each lane; verify full arm and ball clearance.', 'Stage bands and balls to the side of the active footprint. If quantities are insufficient, use the stated unloaded rehearsal or stagger athletes and extend the clock.', 'Select chest, rotational or overhead movement before starting. All medicine-ball work retains the ball; floor release is an optional substitution for a downward-throw day only.'],
  entryCriteria: ['The athlete understands the selected throw pattern and the no-release default.', 'Shoulder, elbow, wrist and plant-leg motion is comfortable at the initial easy range.'],
  exitCriteria: ['The plant, hip turn, trunk and hands move in a clear sequence.', 'Shoulder motion and the finish remain comfortable without shrugging or back extension.', 'The final attempts remain sharp and controlled without arm fatigue.'],
  progression: 'Proceed to progressively dosed throws with the actual main-session implement in a verified throwing area. Increase one demand at a time and preserve recovery; retained-ball rehearsal does not establish readiness for maximal or sport-specific throwing.',
} as const

const jumpingShared = {
  discipline: 'jumping', title: 'Jumping',
  purpose: 'Prepare foot and ankle force, knee and hip access, coordinated takeoff and controlled absorption before the day’s selected jump direction or rebound demand.',
  equipment: ['Cones for three 10 m lanes', 'Bodyweight; no boxes, hurdles or force plates required'],
  setup: ['Give each athlete an inspected lane with enough width for the entire arm swing and landing.', 'Use low in-place jumps unless a short forward or lateral displacement fits comfortably inside the lane. No takeoff or landing crosses into an adjacent lane.', 'Keep the selected jump direction the same through both bridge drills. All jumps default to bilateral; no drop height or unilateral landing is introduced.'],
  entryCriteria: ['The athlete can show a comfortable bilateral squat and no-flight landing shape.', 'Foot, ankle, knee and hip loading is comfortable; actual recent jump exposure is considered before adding contacts.'],
  exitCriteria: ['Foot pressure, knee tracking and trunk control remain stable through takeoff and landing.', 'The athlete can hold the final landing for two seconds without an extra hop.', 'The final jumps retain intent without heavy contacts, calf fatigue or reduced control.'],
  progression: 'Progress the actual main jump in direction, height, distance or rebound demand only as control allows. High drops, maximal jumps and unilateral work still need specific rehearsal. Count these warm-up contacts in the day’s total.',
} as const

export const POWER_PREPARATION_ROUTINES: readonly DisciplinePreparationRoutine[] = [
  {
    ...throwingShared, id: 'access-prepare-throwing-15', durationMinutes: 15,
    summary: 'A full foot-to-hand preparation with joint access, low-effort shoulder activation, plant control and two progressive throwing bridges.',
    coverage: ['Raise temperature and move shoulder, elbow and wrist through comfortable ranges.', 'Activate shoulder rotation and rehearse hip/trunk sequencing.', 'Observe hinge and split-stance support before the two task-specific bridges.'],
    timeBudgetNote: '15:00 total: 10:30 preparation + 2:00 movement rehearsal + 2:30 progressive bridge. Movement, recovery and station changes are included; finish each dose and rest for unused time.',
    limitations: ['The longer clock adds joint preparation and feedback, not heavy throws or shoulder fatigue.', 'Actual sport-specific throws and any safe release area beyond the lanes still require separate preparation.'],
    steps: [
      step(raise, '90 seconds of easy-to-brisk marching with arm sweeps', 120, 90, 10, 'Use the first 15 seconds for the comfort and stop-cue check while marching; use 20 seconds after marching to demonstrate the foot-led turn.'),
      step(pivot, '5 slow turns per side', 90, 50, 20, 'Take about 5 seconds per turn. Use 20 seconds to show the heel turn and change the stance; recover with arms relaxed.'),
      step(shoulder, '3 circles each direction per arm + 6 elbow bends + 6 wrist flex/extend cycles', 90, 55, 15, 'Demonstrate the three motions in the 20-second instruction allowance. Alternate arms; use small comfortable circles.'),
      step(scapula, '6 forward-reach and overhead-return cycles', 90, 40, 30, 'Use about 6 seconds per cycle. The 20-second change includes collecting the band after the last reach.'),
      step(rotation, '1 × 8 easy repetitions', 90, 40, 30, 'Set band tension during 20 seconds of instruction; use a slow return and avoid a shoulder burn.'),
      step(hinge, '5 bodyweight hinges + comfortable reach', 60, 30, 15, 'Put the band down during the 15-second change and show a balanced hinge. No loaded repetitions are added.'),
      step(lunge, '3 stationary lunge-and-reach repetitions per side', 90, 40, 30, 'Use the 20-second allowance to show the plant and change sides. The coach checks the front foot and rib cage.'),
      step(throwRehearsal, '6 controlled attempts in the selected throw family; 3 per side when rotational', 120, 45, 45, 'Use 30 seconds to pick up the light ball, name the main throw and show the retained-ball path. Perform 3 attempts, recover about 20 seconds, then 3 more and recover for the remaining allowance.', 'rehearsal'),
      step(throwProgressive, '2 easy + 2 smooth + 2 moderately purposeful attempts; 6 total', 150, 45, 75, 'Use 30 seconds to confirm the selected version. Recover about 20 seconds between pairs and use the remaining recovery to check the finish and prepare for the main-session handoff.', 'progressive', 'Build toward moderate intent only; retained-ball work stays smooth and every attempt finishes under control.'),
    ],
  },
  {
    ...throwingShared, id: 'access-prepare-throwing-10', durationMinutes: 10,
    summary: 'Balanced throwing preparation that prioritizes the foot-to-hand sequence, shoulder control and a brief progressive bridge.',
    coverage: ['Raise and access the throwing joints.', 'Rehearse a stable plant with shoulder-blade and rotation control.', 'Connect the actual throw family through two low-volume bridges.'],
    timeBudgetNote: '10:00 total: 6:30 preparation + 1:30 movement rehearsal + 2:00 progressive bridge. Equipment is staged first; the row clocks include instruction, resets and recovery.',
    limitations: ['Separate hinge observation and longer corrective practice are omitted; use the 15-minute version if needed.', 'The main sporting implement and higher-intent releases still need gradual preparation in the correct space.'],
    steps: [
      step(raise, '60 seconds of easy-to-brisk marching with arm sweeps', 90, 60, 10, 'Give the comfort check during the opening easy march. Use 20 seconds to introduce the following sequence.'),
      step(pivot, '3 slow turns per side', 60, 30, 15, 'Use 15 seconds to demonstrate the foot-led turn and change sides; recover without adding turns.'),
      step(shoulder, '2 circles each direction per arm + 4 elbow bends + 4 wrist cycles', 60, 35, 10, 'Keep circles small and smooth. Use 15 seconds for instruction; no forced end-range holds.'),
      step(scapula, '4 forward-reach and overhead-return cycles', 60, 25, 20, 'Use about 6 seconds per cycle; the 15-second change includes collecting the band.'),
      step(rotation, '1 × 6 easy repetitions', 60, 30, 15, 'Use 15 seconds to set light band tension; stop at six clean repetitions.'),
      step(lunge, '2 stationary lunge-and-reach repetitions per side', 60, 25, 20, 'Use 15 seconds for the stance change and ball setup; pause over each front foot.'),
      step(throwRehearsal, '4 retained-ball attempts; 2 per side when rotational', 90, 30, 40, 'Use 20 seconds to select and demonstrate the main throw family. Reset after each attempt; distribute the 40-second recovery between and after attempts.', 'rehearsal'),
      step(throwProgressive, '2 easy + 2 moderately purposeful attempts; 4 total', 120, 30, 65, 'Use 25 seconds to confirm the selected pattern or approved floor-release substitution. Recover about 25 seconds between pairs; reserve the remaining recovery for observation and handoff.', 'progressive', 'Moderate intent at most; prioritize a controlled finish.'),
    ],
  },
  {
    ...throwingShared, id: 'access-prepare-throwing-5', durationMinutes: 5,
    summary: 'A familiar, minimal throwing primer: raise, turn, reach, gently activate the shoulder, then rehearse and sharpen the chosen pattern.',
    coverage: ['Combine raising and shoulder movement.', 'Retain hip-to-hand sequencing and easy shoulder rotation.', 'Protect time for both the rehearsal and progressive bridge.'],
    timeBudgetNote: '5:00 total: 3:00 essential preparation + 1:00 rehearsal + 1:00 progressive bridge. Use only already familiar movements with equipment at hand; spare seconds are recovery.',
    limitations: ['Dedicated wrist/elbow work and separate plant/hinge checks are omitted. Use longer preparation when these need attention.', 'This short primer cannot establish readiness for maximal, unfamiliar or high-volume throwing; actual implement progression follows.'],
    steps: [
      step(raise, '45 seconds of easy marching + small arm sweeps', 60, 45, 0, 'Check comfort during the first easy steps; use the 15-second instruction window to establish the foot-led turn.'),
      step(pivot, '2 slow turns per side', 40, 20, 10, 'Use 10 seconds to check stance and change sides. Keep the turn comfortable.'),
      step(scapula, '3 forward-reach and overhead-return cycles', 40, 20, 10, 'Use a slow full cycle; 10 seconds covers the band pickup and cue.'),
      step(rotation, '1 × 4 easy repetitions', 40, 20, 10, 'Use 10 seconds to set or put away the band; the light dose should not create fatigue.'),
      step(throwRehearsal, '2 retained-ball attempts; 1 per side when rotational', 60, 15, 30, 'Use 15 seconds to name the familiar main throw and pick up the light ball. Pause and reset after each attempt; the remainder is recovery.', 'rehearsal'),
      step(throwProgressive, '2 controlled attempts, second slightly more purposeful', 60, 15, 30, 'Use 15 seconds to confirm the version. Allow about 15 seconds between attempts and the remaining recovery for a readiness check; stay with no-release unless the downward-release station was already verified.', 'progressive', 'Smooth to moderately purposeful; no maximal arm action.'),
    ],
  },
  {
    ...jumpingShared, id: 'access-prepare-jumping-15', durationMinutes: 15,
    summary: 'Complete jump preparation from ankle and hip access through calf loading, landing organization, low elasticity and progressive task-direction jumps.',
    coverage: ['Raise, then observe ankle, lunge, hinge and squat positions.', 'Introduce controlled calf force and low elastic contacts.', '26 total flight landings: 16 pogos + 4 rehearsal jumps + 6 progressive jumps.'],
    timeBudgetNote: '15:00 total: 11:00 preparation + 2:00 takeoff/landing rehearsal + 2:00 progressive bridge. The 26 contacts are a ceiling, not a target to complete after quality declines.',
    limitations: ['Stationary snap-downs and calf raises have no flight and are not included in the 26 landing contacts.', 'This block does not include box drops, maximal bounds or high single-leg impact; prepare those tasks separately if selected.'],
    steps: [
      step(raise, '90 seconds of easy-to-brisk marching with arm sweeps', 120, 90, 10, 'Check comfort during the opening march; use 20 seconds to show foot pressure and ankle rocks.'),
      step(ankle, '6 ankle rocks per side', 90, 50, 20, 'Use about 4 seconds per rock and 20 seconds for instruction and the stance change.'),
      step(lunge, '3 stationary lunge-and-reach repetitions per side', 90, 40, 30, 'Use 20 seconds for demonstration and side change. Keep the front foot supported.'),
      step(hinge, '5 bodyweight hinges + reach', 60, 30, 15, 'Use 15 seconds to demonstrate the hip-led movement; the coach views the trunk and foot pressure.'),
      step(squat, '4 squat-to-stands + comfortable overhead reach', 60, 30, 15, 'Use 15 seconds to show the controlled depth and overhead return; avoid bouncing into the squat.'),
      step(calf, '6 straight-knee + 6 bent-knee bilateral calf raises', 90, 50, 20, 'Use a controlled two-second rise and two-second lowering; 20 seconds covers demonstration and knee-position change.'),
      step(snap, '5 no-flight snap-downs with 2-second holds', 90, 35, 35, 'Use 20 seconds for demonstration and feedback. Stand fully and reset after each hold.'),
      step(pogo, '2 × 8 contacts; 16 total', 60, 15, 30, 'Use 15 seconds to cue the low bounce. Rest about 20 seconds between sets, then recover for the remaining allowance.', 'base', 'Low amplitude and light contacts; no chasing height.'),
      step(jumpRehearsal, '4 low jumps with held landings; 4 contacts total', 120, 30, 65, 'Use 25 seconds to select direction and demonstrate. Allow about 15 seconds between attempts and use the remaining recovery to check the last landing.', 'rehearsal'),
      step(jumpProgressive, '2 easy + 2 smooth + 2 moderately purposeful jumps; 6 contacts total', 120, 35, 60, 'Use 25 seconds to confirm the direction. Rest about 20 seconds between pairs, then use the remaining recovery before the main session. Lateral: 3 each direction. Rebound option: 3 low two-contact pairs, same 6 contacts.', 'progressive', 'Build modestly while preserving the same landing; no maximal jumps.'),
    ],
  },
  {
    ...jumpingShared, id: 'access-prepare-jumping-10', durationMinutes: 10,
    summary: 'A compact jump warm-up that retains ankle and hip access, calf preparation, landing control and a small elastic-to-directional progression.',
    coverage: ['Raise and access ankle and split-stance hip positions.', 'Check the landing shape and add low elastic contacts.', '16 flight landings: 8 pogos + 4 rehearsal jumps + 4 progressive jumps.'],
    timeBudgetNote: '10:00 total: 6:30 preparation + 1:30 landing rehearsal + 2:00 progressive bridge. Keep the 16-contact ceiling and take every listed recovery period.',
    limitations: ['Separate hinge and squat-to-stand observation are omitted; use 15 minutes if these need individual attention.', 'More demanding jump heights, drop landings or unilateral work still need specific progression.'],
    steps: [
      step(raise, '60 seconds of easy-to-brisk marching with arm sweeps', 90, 60, 10, 'Use the first easy steps for a comfort check; 20 seconds covers ankle-rock instruction.'),
      step(ankle, '4 rocks per side', 60, 35, 10, 'Use 15 seconds to demonstrate foot pressure and change sides.'),
      step(lunge, '2 stationary lunge-and-reach repetitions per side', 60, 25, 20, 'Use 15 seconds for the stance change and cue; pause before reaching.'),
      step(calf, '4 straight-knee + 4 bent-knee bilateral raises', 60, 35, 10, 'Use about 4 seconds per repetition; 15 seconds covers the knee-position change and demonstration.'),
      step(snap, '4 no-flight snap-downs with 2-second holds', 60, 25, 20, 'Use 15 seconds to cue the shape. Stand and reset between repetitions.'),
      step(pogo, '1 × 8 contacts', 60, 10, 35, 'Use 15 seconds to demonstrate a low bounce, then recover after eight contacts.', 'base', 'Low and quiet; finish well before fatigue.'),
      step(jumpRehearsal, '4 low jumps with 2-second landing holds', 90, 30, 40, 'Use 20 seconds to select direction; distribute 40 seconds of recovery between and after attempts. Lateral: 2 each direction.', 'rehearsal'),
      step(jumpProgressive, '2 easy + 2 moderately purposeful jumps; 4 contacts total', 120, 25, 70, 'Use 25 seconds to check the pattern; recover about 25 seconds between pairs and use the remaining recovery before handoff. Lateral: 2 each direction. Rebound option: 2 low two-contact pairs.', 'progressive', 'Moderate intent with a controlled final landing.'),
    ],
  },
  {
    ...jumpingShared, id: 'access-prepare-jumping-5', durationMinutes: 5,
    summary: 'A minimal familiar jump primer: raise, access the ankles and hips, check the landing shape and perform six progressive jump contacts.',
    coverage: ['Retain temperature, ankle access and split-stance control.', 'Check a no-flight landing before introducing flight.', '6 flight landings total: 2 rehearsal + 4 progressive; no separate pogo block.'],
    timeBudgetNote: '5:00 total: 3:00 essentials + 1:00 low-jump rehearsal + 1:00 progressive bridge. For athletes needing more temperature, technique practice or calf preparation, select a longer routine.',
    limitations: ['Separate calf raises, hinge/squat observation and repeated elasticity work are omitted.', 'Six low contacts do not establish readiness for high drops, maximal jumps or unfamiliar rebound work.'],
    steps: [
      step(raise, '45 seconds of easy marching with arm sweeps', 60, 45, 0, 'Check comfort during the opening steps; use 15 seconds to cue the ankle rocks.'),
      step(ankle, '3 rocks per side', 40, 25, 5, 'Use 10 seconds for the stance change. Preserve heel pressure and comfortable range.'),
      step(lunge, '2 small stationary lunge-and-reach repetitions per side', 40, 25, 5, 'Use 10 seconds to change sides and demonstrate; keep the depth familiar.'),
      step(snap, '3 no-flight snap-downs with 2-second holds', 40, 20, 10, 'Use 10 seconds for the landing cue. Coach checks alignment before any jump.'),
      step(jumpRehearsal, '2 low jumps with held landings; 2 contacts', 60, 15, 30, 'Use 15 seconds to select the direction. Recover about 15 seconds after each attempt. Lateral: 1 each direction.', 'rehearsal'),
      step(jumpProgressive, '2 easy + 2 slightly more purposeful jumps; 4 contacts', 60, 20, 30, 'Use 10 seconds to confirm the pattern; recover 15 seconds between pairs and 15 seconds after the last pair. Lateral: 2 each direction. Use held landings in this short version.', 'progressive', 'Low-to-moderate intent; keep all four landings controlled.'),
    ],
  },
]
