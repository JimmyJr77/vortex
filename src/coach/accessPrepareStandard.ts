export const ACCESS_PREPARE_PURPOSES = [
  'Raise',
  'Mobilize',
  'Activate',
  'Integrate',
  'Potentiate Bridge',
] as const

export type AccessPreparePurpose = typeof ACCESS_PREPARE_PURPOSES[number]

export type AccessPrepareRoutineExercise = {
  order: number
  id: string
  name: string
  dose: string
  purposes: readonly AccessPreparePurpose[]
  equipment: readonly string[]
  whyHere: string
  setup: readonly string[]
  executionSteps: readonly string[]
  coachCues: readonly string[]
  athleteCues: readonly string[]
  qualityGates: readonly string[]
  commonFaults: readonly string[]
  scaling: readonly string[]
  stopSigns: readonly string[]
  versionNote?: string
}

export type AccessPrepareDaySpecificDrill = {
  order: 1 | 2
  role: 'Movement or position rehearsal' | 'Progressive version of the upcoming task'
  purpose: string
  selection: string
  delivery: readonly string[]
  qualityGates: readonly string[]
}

export type AccessPrepareRoutine = {
  id: string
  title: string
  durationMinutes: number
  purpose: string
  summary: string
  purposes: readonly AccessPreparePurpose[]
  equipment: readonly string[]
  space: readonly string[]
  timing: {
    target: string
    delivery: readonly string[]
  }
  memorizationNote: string
  endCheckpointNote: string
  safety: readonly string[]
  exercises: readonly AccessPrepareRoutineExercise[]
  daySpecificFinish: {
    outsideFixedSequence: true
    drillCount: 2
    placement: 'After the fixed 16-exercise sequence'
    instruction: string
    drills: readonly [AccessPrepareDaySpecificDrill, AccessPrepareDaySpecificDrill]
  }
}

export const ACCESS_PREPARE_STANDARD = {
  id: 'access-prepare-standard',
  title: 'Access & Prepare Standard',
  durationMinutes: 15,
  purpose:
    'Raise readiness, access useful positions, activate foundational shapes, integrate locomotion and bridge into the day’s Explosiveness work without turning preparation into fatigue work.',
  summary:
    'A fixed, coach-led 16-exercise sequence that moves from general locomotion through multi-directional mobility, crawling, landing organization, running drills and low-level elasticity, then finishes with observable hinge and squat checkpoints.',
  purposes: ACCESS_PREPARE_PURPOSES,
  equipment: [
    'Cones or floor markers for a 10 m lane',
    'Visible turnaround marks',
    'Optional stable hand support for scaled lunges, hinges or squats',
  ],
  space: [
    'One clear, level 10 m travel lane per athlete or supervised wave',
    'A clear stationary area at the lane end for pogos, hinges and squats',
    'Waiting athletes positioned outside every travel and landing path',
  ],
  timing: {
    target: '15 minutes for the fixed sequence and the two day-specific bridge drills.',
    delivery: [
      'Brief the route and key standards before movement begins.',
      'Use continuous, organized waves where space permits; pause only to restore spacing or movement quality.',
      'Keep early work easy, build intent gradually, and preserve clean repetitions rather than chasing speed.',
      'Protect time for the final hinge and squat observation and for exactly two day-specific Explosiveness bridge drills.',
    ],
  },
  memorizationNote:
    'Keep the base 16-exercise sequence consistent so athletes can memorize the order, organize themselves quickly and devote attention to movement quality.',
  endCheckpointNote:
    'The bodyweight hip hinge and squat-to-stand intentionally finish the fixed sequence so the coach can observe and correct foundational hinge, squat, trunk and reach positions before the day’s work.',
  safety: [
    'Inspect the floor, lane, markers and optional support before starting; keep travel and landing paths clear.',
    'Maintain enough spacing that athletes cannot enter another athlete’s lane, reach or landing area.',
    'Use controlled warm-up ranges and low contacts; do not force depth, speed, bounce height or range.',
    'Stop the affected drill for pain, dizziness, a new symptom, repeated loss of balance or control, or any unsafe surface, equipment or spacing condition.',
    'Change the range, speed, distance or pattern only if the scaled version remains controlled and appropriate for the athlete.',
  ],
  exercises: [
    {
      order: 1,
      id: 'easy-jog',
      name: 'Easy jog',
      dose: '60 seconds',
      purposes: ['Raise'],
      equipment: ['None beyond the marked lane'],
      whyHere: 'Begins the routine with simple continuous movement and gives the coach an early view of comfort, rhythm and spacing.',
      setup: [
        'Use a clear lane or loop with visible boundaries.',
        'Stagger starts so each athlete has room to move and turn.',
      ],
      executionSteps: [
        'Jog continuously at an easy, conversational effort.',
        'Use relaxed arm action and quiet, comfortable steps.',
        'Turn under control and continue until 60 seconds is complete.',
      ],
      coachCues: ['Easy first gear.', 'Tall and relaxed.', 'Own the turn; keep your space.'],
      athleteCues: ['Breathe normally.', 'Light steps.', 'Leave room in front of me.'],
      qualityGates: [
        'Effort remains easy and repeatable for the full interval.',
        'Posture and rhythm remain relaxed through turns.',
        'Spacing stays safe without abrupt stops or passing through another lane.',
      ],
      commonFaults: ['Starting at sprint pace.', 'Crowding the athlete ahead.', 'Leaning or cutting sharply through the turn.'],
      scaling: [
        'Use a brisk walk or walk-jog if an easy jog is not controlled.',
        'Use shorter straight segments with deliberate turns when space is limited.',
      ],
      stopSigns: ['Pain or limping.', 'Dizziness or unusual distress.', 'Unsafe traffic, surface or spacing.'],
    },
    {
      order: 2,
      id: 'backpedal',
      name: 'Backpedal',
      dose: '10 m',
      purposes: ['Raise', 'Integrate'],
      equipment: ['Two lane markers'],
      whyHere: 'Introduces backward travel early while speed is low and reinforces awareness of posture, foot placement and the path behind the athlete.',
      setup: [
        'Mark a straight 10 m lane and confirm it is completely clear.',
        'Face the travel lane before turning to begin; send one athlete per lane or use staggered waves.',
      ],
      executionSteps: [
        'Set a tall athletic posture with softly bent knees.',
        'Travel backward with short, controlled steps and active arms.',
        'Keep the feet under the body and decelerate before the finish mark.',
      ],
      coachCues: ['See the lane first.', 'Short steps under the hips.', 'Stay tall; finish under control.'],
      athleteCues: ['Quick, quiet feet.', 'Chest up.', 'Slow down before the cone.'],
      qualityGates: [
        'The lane remains clear and the athlete stays within it.',
        'Steps remain short enough to preserve balance.',
        'The athlete slows without stumbling or turning blindly.',
      ],
      commonFaults: ['Overstriding behind the body.', 'Looking continuously over one shoulder and rotating off line.', 'Accelerating beyond controllable speed.'],
      scaling: [
        'Back-walk the distance before adding a light backpedal rhythm.',
        'Shorten the distance while preserving a controlled stop.',
      ],
      stopSigns: ['Pain or altered gait.', 'Repeated stumbling or inability to stay in the lane.', 'Any obstruction or person entering the backward path.'],
    },
    {
      order: 3,
      id: 'lateral-shuffle',
      name: 'Lateral shuffle',
      dose: '10 m each direction',
      purposes: ['Raise', 'Mobilize', 'Integrate'],
      equipment: ['Two lane markers'],
      whyHere: 'Adds controlled side-to-side travel and exposes both directions before more complex transverse-plane movement.',
      setup: [
        'Mark a straight 10 m lane with clear side boundaries.',
        'Square the chest and hips across the lane; complete both lead directions.',
      ],
      executionSteps: [
        'Lower into a comfortable athletic stance.',
        'Push the floor away with the trail leg and step laterally with the lead leg.',
        'Bring the trail foot back under the body without crossing the feet.',
        'Stay square, stop under control, then repeat in the opposite direction.',
      ],
      coachCues: ['Push, then replace.', 'Feet do not cross.', 'Hips and chest stay square.'],
      athleteCues: ['Stay low enough to move.', 'Keep space between my feet.', 'Move both ways the same.'],
      qualityGates: [
        'Feet remain uncrossed and under control.',
        'Head and trunk stay organized without excessive side sway.',
        'Both directions are completed with comparable rhythm and range.',
      ],
      commonFaults: ['Clicking or crossing the feet.', 'Feet becoming too narrow to push effectively.', 'Standing up or turning into a run.'],
      scaling: [
        'Use slower side steps with a pause between pushes.',
        'Reduce stance depth or distance while maintaining square alignment.',
      ],
      stopSigns: ['Pain with lateral push-off or landing.', 'Repeated loss of balance.', 'Inability to keep the lane clear.'],
    },
    {
      order: 4,
      id: 'carioca-karaoke',
      name: 'Carioca / karaoke',
      dose: '10 m each direction',
      purposes: ['Raise', 'Mobilize', 'Integrate'],
      equipment: ['Two lane markers'],
      whyHere: 'Adds controlled crossing steps and trunk-pelvis coordination after the simpler lateral shuffle has established side-to-side control.',
      versionNote:
        'Controlled warm-up version: use a smooth step-behind, side-step, step-in-front, side-step pattern at low speed. Range and rhythm stay comfortable; this is not a fast footwork race or an aggressive torso-twisting drill.',
      setup: [
        'Mark a straight 10 m lane and demonstrate the controlled four-step pattern.',
        'Begin side-on with clear space and complete both lead directions.',
      ],
      executionSteps: [
        'Step the trail foot behind the lead leg.',
        'Step laterally with the lead foot to reopen the base.',
        'Step the trail foot in front, then step laterally again with the lead foot.',
        'Repeat smoothly to the marker, stop under control and reverse direction.',
      ],
      coachCues: ['Behind, side, in front, side.', 'Smooth before fast.', 'Let the hips turn; keep the lane.'],
      athleteCues: ['Relax the shoulders.', 'Reopen my feet after each cross.', 'Stay controlled both ways.'],
      qualityGates: [
        'The four-step pattern remains recognizable without tangled feet.',
        'Rotation is comfortable and does not pull the athlete out of the lane.',
        'Both directions are performed under control at warm-up speed.',
      ],
      commonFaults: ['Racing before the pattern is stable.', 'Failing to reopen the stance after a crossing step.', 'Forcing trunk rotation while the feet remain planted.'],
      scaling: [
        'Walk the four-step pattern slowly with pauses at each side step.',
        'Use step-behind only, omitting the step-in-front until coordination is stable.',
        'Shorten the distance while completing both directions.',
      ],
      stopSigns: ['Pain during crossing or rotation.', 'Repeated foot tangling or falls.', 'Loss of lane awareness or unsafe proximity to another athlete.'],
    },
    {
      order: 5,
      id: 'walking-lunge-rotation-reach',
      name: 'Walking lunge + rotation/reach',
      dose: '5 m',
      purposes: ['Mobilize', 'Activate', 'Integrate'],
      equipment: ['None beyond the marked lane'],
      whyHere: 'Moves the athlete through a controlled split stance while coordinating a comfortable reach and trunk turn over a stable base.',
      setup: [
        'Use a clear 5 m lane and enough width for the arm reach.',
        'Stand tall with feet under the hips and hands ready in front of the chest.',
      ],
      executionSteps: [
        'Step forward into a comfortable lunge with the whole front foot supported.',
        'Settle the pelvis and trunk before rotating and reaching toward the front-leg side.',
        'Return the trunk to center, push through the front foot and step into the next lunge.',
        'Alternate legs while traveling the full 5 m.',
      ],
      coachCues: ['Step, own the lunge, then reach.', 'Front foot stays planted.', 'Rotate through a comfortable range.'],
      athleteCues: ['Balance first.', 'Knee follows my foot.', 'Turn without forcing.'],
      qualityGates: [
        'Each lunge is balanced before the rotation begins.',
        'The front knee and foot track in the same general direction.',
        'The reach stays controlled without collapsing or forcing range.',
      ],
      commonFaults: ['Rotating before balance is established.', 'Front heel lifting or knee collapsing inward.', 'Taking a step too long to control.'],
      scaling: [
        'Reduce lunge depth and use a shorter step.',
        'Perform a split-stance hold with a small reach before traveling.',
        'Use a stable hand support and omit rotation if balance is the limiting factor.',
      ],
      stopSigns: ['Pain in the lunge or reach.', 'Repeated knee collapse or loss of balance despite scaling.', 'Dizziness when rising or rotating.'],
    },
    {
      order: 6,
      id: 'lateral-lunge-reach',
      name: 'Lateral lunge + reach',
      dose: '5 m',
      purposes: ['Mobilize', 'Activate', 'Integrate'],
      equipment: ['None beyond the marked lane'],
      whyHere: 'Accesses a supported side-to-side stance and links lateral hip loading with a controlled reach before ground-based locomotion.',
      setup: [
        'Use a clear 5 m lateral travel lane with room for the reach.',
        'Start tall with the feet under the hips and toes facing generally forward.',
      ],
      executionSteps: [
        'Step laterally and sit the hips toward the stepping side through a comfortable range.',
        'Keep the stepping foot supported while the opposite leg remains long but not forced.',
        'Reach forward or toward the stepping foot without losing the base.',
        'Return to tall, bring the feet together and repeat while traveling.',
      ],
      coachCues: ['Step wide enough to sit.', 'Hips back; foot stays down.', 'Reach only as far as you can own.'],
      athleteCues: ['Load one side.', 'Keep my balance.', 'Stand tall between reps.'],
      qualityGates: [
        'The athlete controls the shift into and out of each lateral stance.',
        'The working foot stays supported and the knee follows its direction.',
        'Reach range does not create rounding, twisting or loss of balance.',
      ],
      commonFaults: ['Knee collapsing inward.', 'Rolling to the inside edge of the working foot.', 'Dropping into more range than the athlete can reverse.'],
      scaling: [
        'Use a smaller side step and shallower hip shift.',
        'Practice alternating lateral weight shifts without travel.',
        'Use a stable hand support and reduce the reach.',
      ],
      stopSigns: ['Pain in the hip, groin, knee, ankle or back.', 'Repeated inability to return from the lunge under control.', 'Unsafe slipping or surface condition.'],
    },
    {
      order: 7,
      id: 'inchworm-plank-bear-crawl-downward-dog',
      name: 'Inchworm → plank → bear crawl → downward dog',
      dose: '10 m',
      purposes: ['Mobilize', 'Activate', 'Integrate'],
      equipment: ['Clean floor or exercise mat surface'],
      whyHere: 'Combines controlled fold, hand support, trunk organization, contralateral travel and a comfortable posterior-chain position in one low-speed sequence.',
      setup: [
        'Clear a 10 m floor lane and confirm the surface is suitable for hands.',
        'Remove jewelry or objects that interfere with hand support; stagger athletes by a full body length.',
      ],
      executionSteps: [
        'From standing, soften the knees as needed and walk the hands forward into a controlled plank.',
        'Hold the plank briefly with hands under the shoulders and the trunk organized.',
        'Take small bear-crawl steps with opposite hand and foot moving without rushing.',
        'Press the hips up and back into a comfortable downward-dog shape.',
        'Walk the feet toward the hands, stand with control and repeat to 10 m.',
      ],
      coachCues: ['Small hand steps.', 'Own the plank before you crawl.', 'Quiet crawl; long spine in the finish.'],
      athleteCues: ['Brace gently.', 'Move opposite hand and foot.', 'Bend my knees if I need room.'],
      qualityGates: [
        'Hands remain secure and shoulders tolerate support without collapse.',
        'The trunk stays controlled through plank and crawl.',
        'Transitions remain deliberate, with no forced hamstring or shoulder range.',
      ],
      commonFaults: ['Dropping the hips or shrugging through the plank.', 'Taking large, hurried crawl steps.', 'Locking the knees and forcing the fold or downward-dog range.'],
      scaling: [
        'Walk hands to an elevated stable surface instead of the floor.',
        'Use a knee-supported plank and omit the crawl.',
        'Break the sequence into one controlled shape at a time or shorten the distance.',
      ],
      stopSigns: ['Wrist, shoulder, back or hamstring pain.', 'Loss of hand contact or repeated trunk collapse.', 'Dizziness during the standing-to-floor transitions.'],
    },
    {
      order: 8,
      id: 'traveling-snap-down-athletic-stick',
      name: 'Traveling snap-down → athletic stick',
      dose: '10 m',
      purposes: ['Integrate', 'Potentiate Bridge'],
      equipment: ['Two lane markers'],
      whyHere: 'Rehearses moving into a balanced athletic landing position and holding it before the sequence shifts toward running and elastic drills.',
      setup: [
        'Mark a clear 10 m lane with room to land and hold.',
        'Begin tall; define the athletic stick as a quiet, balanced stop that the athlete can visibly own.',
      ],
      executionSteps: [
        'Travel forward with a small controlled step or low skip.',
        'Reach tall, then quickly organize the arms and hips into an athletic stance.',
        'Land or settle quietly on two feet and hold the stick long enough to show balance.',
        'Reset fully before traveling into the next repetition.',
      ],
      coachCues: ['Reach, snap, stick.', 'Quiet feet.', 'Freeze the shape before the next rep.'],
      athleteCues: ['Land balanced.', 'Knees follow feet.', 'Hold, then go.'],
      qualityGates: [
        'Every repetition ends in a stable two-foot position.',
        'The athlete absorbs through a comfortable ankle-knee-hip bend without collapse.',
        'The held finish is quiet and controlled before travel resumes.',
      ],
      commonFaults: ['Dropping without first becoming organized.', 'Landing stiff, narrow or with knees collapsing inward.', 'Bouncing immediately into the next repetition instead of sticking.'],
      scaling: [
        'Use a rise-to-toes and controlled settle with no leaving the floor.',
        'Remove travel and practice snap-down sticks in place.',
        'Reduce speed and stance depth until each hold is stable.',
      ],
      stopSigns: ['Pain on landing or deceleration.', 'Repeated unstable, loud or uncontrolled contacts.', 'Inability to maintain safe distance from the athlete ahead.'],
    },
    {
      order: 9,
      id: 'a-march',
      name: 'A-march',
      dose: '10 m',
      purposes: ['Activate', 'Integrate'],
      equipment: ['Two lane markers'],
      whyHere: 'Introduces deliberate upright marching rhythm and single-leg organization before the faster skipping drills.',
      setup: [
        'Mark a straight 10 m lane.',
        'Stand tall with eyes forward, arms set to move opposite the legs and feet under the hips.',
      ],
      executionSteps: [
        'Drive one knee up through a comfortable marching range while the opposite arm moves forward.',
        'Keep the stance side tall and the foot under the body.',
        'Place the lifted foot down under the hips, then switch sides.',
        'Travel forward with deliberate, even steps for 10 m.',
      ],
      coachCues: ['Tall on the stance leg.', 'Opposite arm, opposite leg.', 'Step down under the hips.'],
      athleteCues: ['Own each balance.', 'Toe up comfortably.', 'March straight ahead.'],
      qualityGates: [
        'The athlete can briefly balance on each stance leg.',
        'Arm and leg action remain opposite and rhythmic.',
        'Each foot returns beneath the body without reaching forward.',
      ],
      commonFaults: ['Leaning backward to lift the knee.', 'Reaching the lower leg forward before contact.', 'Same-side arm and leg action or wandering out of lane.'],
      scaling: [
        'Reduce knee height and slow the cadence.',
        'Perform in place or use light fingertip support before traveling.',
      ],
      stopSigns: ['Pain during stance or knee lift.', 'Repeated loss of balance despite reduced range.', 'A new limp or inability to keep a clear lane.'],
    },
    {
      order: 10,
      id: 'a-skip',
      name: 'A-skip',
      dose: '10 m',
      purposes: ['Raise', 'Integrate', 'Potentiate Bridge'],
      equipment: ['Two lane markers'],
      whyHere: 'Builds a light skipping rhythm from the A-march pattern while keeping posture and foot placement observable.',
      setup: [
        'Use the same clear 10 m lane as the A-march.',
        'Confirm the athlete can show the march rhythm before adding the skip.',
      ],
      executionSteps: [
        'Begin with the A-march shape and add a small rhythmic hop on the stance leg.',
        'Coordinate opposite arm and knee action.',
        'Place the lifted foot down beneath the body and switch rhythmically.',
        'Travel forward with low, light contacts rather than chasing distance.',
      ],
      coachCues: ['March shape, add a bounce.', 'Up, then down under the hip.', 'Light and rhythmic.'],
      athleteCues: ['Stay tall.', 'Small bounce.', 'Keep the rhythm even.'],
      qualityGates: [
        'The skip remains low and rhythmic without excessive airtime.',
        'Posture stays tall and the foot contacts beneath the body.',
        'The athlete preserves coordination through the full lane.',
      ],
      commonFaults: ['Bounding forward instead of skipping upward lightly.', 'Kicking the lower leg out in front.', 'Losing opposite arm-leg timing.'],
      scaling: [
        'Return to A-march or alternate two marches with one small skip.',
        'Perform a low skip in place before traveling.',
      ],
      stopSigns: ['Pain with hopping or contact.', 'Repeated uncontrolled landings.', 'Loss of coordination that creates unsafe travel.'],
    },
    {
      order: 11,
      id: 'b-skip',
      name: 'B-skip',
      dose: '10 m',
      purposes: ['Mobilize', 'Integrate', 'Potentiate Bridge'],
      equipment: ['Two lane markers'],
      whyHere: 'Adds a controlled lower-leg unfold and downward return to the established skipping rhythm without increasing the travel demand.',
      setup: [
        'Use a straight, clear 10 m lane.',
        'Demonstrate the team’s B-skip as an A-skip shape followed by a comfortable lower-leg unfold and active return under the body.',
      ],
      executionSteps: [
        'Lift the knee into the established A-position with the opposite arm forward.',
        'Unfold the lower leg only through a comfortable range.',
        'Bring the foot down and back beneath the hip rather than reaching for the floor ahead.',
        'Switch sides with a low skipping rhythm and travel for 10 m.',
      ],
      coachCues: ['Knee up, unfold, down under you.', 'Range follows control.', 'Stay tall and rhythmic.'],
      athleteCues: ['Do not force the kick.', 'Bring the foot back under me.', 'Keep the skip small.'],
      qualityGates: [
        'The lower-leg action stays comfortable and controlled.',
        'The foot returns beneath the body without a reaching contact.',
        'Posture and rhythm remain stable as the pattern alternates.',
      ],
      commonFaults: ['Turning the drill into a straight-leg kick.', 'Leaning back or reaching the foot far ahead.', 'Losing the skipping rhythm to chase range.'],
      scaling: [
        'Use a small partial unfold or return to A-skip.',
        'Walk the knee-lift, unfold and step-down pattern before adding a skip.',
      ],
      stopSigns: ['Pain or pulling during the leg unfold.', 'Pain on contact.', 'Repeated overstriding or balance loss despite reduced range.'],
    },
    {
      order: 12,
      id: 'c-skip',
      name: 'C-skip',
      dose: '10 m',
      purposes: ['Raise', 'Mobilize', 'Integrate'],
      equipment: ['Two lane markers'],
      whyHere: 'Adds the team’s coached backside recovery pattern while retaining the same upright, low-intensity skipping framework.',
      versionNote:
        'Use the program’s standard C-skip version: a low skip with a comfortable heel recovery toward the same-side hip, then a return under the body. Keep the knee pointing generally down and do not force heel-to-seat contact.',
      setup: [
        'Mark a straight 10 m lane and demonstrate the heel-recovery path before traveling.',
        'Stand tall with arms ready to move opposite the legs.',
      ],
      executionSteps: [
        'Add a small skip as one heel recovers comfortably toward the same-side hip.',
        'Keep the thigh generally beneath the trunk rather than driving the knee far forward.',
        'Return the foot under the body and alternate sides with opposite arm action.',
        'Travel through the lane with a light, even rhythm.',
      ],
      coachCues: ['Heel recovers; do not force it.', 'Knee points down.', 'Tall, light, alternating rhythm.'],
      athleteCues: ['Small skip.', 'Relax the lower leg.', 'Foot returns under me.'],
      qualityGates: [
        'Heel recovery remains comfortable and does not tip the pelvis forward.',
        'The athlete stays tall with even alternating rhythm.',
        'Contacts remain light and beneath the body.',
      ],
      commonFaults: ['Forcing heel-to-seat range.', 'Knee swinging forward into an A-skip.', 'Arching the back or losing the lane.'],
      scaling: [
        'Use a smaller heel recovery with a marching rhythm.',
        'Practice alternating heel recovery in place before adding the skip.',
      ],
      stopSigns: ['Knee, hamstring or back pain.', 'Pain on repeated contacts.', 'Loss of balance or coordination that persists after slowing.'],
    },
    {
      order: 13,
      id: 'ankling',
      name: 'Ankling',
      dose: '10 m',
      purposes: ['Raise', 'Activate', 'Potentiate Bridge'],
      equipment: ['Two lane markers'],
      whyHere: 'Narrows attention to low, quick foot and ankle contacts before the two-foot pogo contacts.',
      setup: [
        'Mark a clear 10 m lane.',
        'Stand tall with feet under the hips and begin at walking speed.',
      ],
      executionSteps: [
        'Travel forward with very short alternating steps.',
        'Lift one heel as the opposite foot makes a light contact beneath the body.',
        'Use a small ankle-led rise and fall while keeping the knees soft.',
        'Maintain tall posture and a controlled rhythm to 10 m.',
      ],
      coachCues: ['Short steps.', 'Contact under the hips.', 'Tall with soft knees.'],
      athleteCues: ['Stay low to the ground.', 'Light, quick feet.', 'Do not reach forward.'],
      qualityGates: [
        'Contacts stay low, quiet and beneath the body.',
        'The athlete remains tall without stiff knees or exaggerated bouncing.',
        'Rhythm is controlled across the whole lane.',
      ],
      commonFaults: ['Overstriding.', 'Turning the drill into high-knee running.', 'Using rigid knees or loud contacts.'],
      scaling: [
        'Use a slow heel-toe walk with the same short contact position.',
        'Perform in place or shorten the lane.',
      ],
      stopSigns: ['Foot, ankle, shin, knee or Achilles-region pain.', 'Increasingly heavy or uncontrolled contacts.', 'A new limp or loss of balance.'],
    },
    {
      order: 14,
      id: 'low-two-foot-pogos',
      name: 'Low two-foot pogos',
      dose: '10 contacts',
      purposes: ['Activate', 'Potentiate Bridge'],
      equipment: ['Clear, level contact area'],
      whyHere: 'Provides a small, countable two-foot elastic exposure after ankling and before the stationary movement checkpoints.',
      setup: [
        'Stand in a clear area with feet about hip-width and weight evenly distributed.',
        'Keep the contact count visible to the coach and allow full spacing between athletes.',
      ],
      executionSteps: [
        'Begin tall with knees soft and arms relaxed or held in a consistent position.',
        'Make a small two-foot hop using a quick ankle-led push.',
        'Land on both feet in the same footprint with a quiet, controlled contact.',
        'Repeat for exactly 10 contacts, then settle to a balanced stop.',
      ],
      coachCues: ['Low ceiling.', 'Same footprint.', 'Quiet and together; stick the last one.'],
      athleteCues: ['Bounce small.', 'Both feet land together.', 'Finish balanced.'],
      qualityGates: [
        'All 10 contacts remain low, quiet and in place.',
        'Feet leave and meet the floor together without the knees collapsing inward.',
        'The athlete can stop immediately in balance after contact 10.',
      ],
      commonFaults: ['Jumping for height.', 'Drifting forward or separating the feet.', 'Landing stiff or allowing knees to collapse inward.'],
      scaling: [
        'Use rapid calf raises without leaving the floor.',
        'Pause between individual low hops instead of rebounding continuously.',
        'Reduce the number of contacts only when needed to preserve control; do not add contacts.',
      ],
      stopSigns: ['Pain during takeoff or landing.', 'Repeated loud, asymmetric or uncontrolled contacts.', 'Inability to stop in balance.'],
    },
    {
      order: 15,
      id: 'bodyweight-hip-hinge-reach',
      name: 'Bodyweight hip hinge + reach',
      dose: '5 repetitions',
      purposes: ['Mobilize', 'Activate', 'Integrate'],
      equipment: ['Optional wall target or dowel for feedback'],
      whyHere: 'Begins the closing observation checkpoint so the coach can see how the athlete organizes a foundational hip hinge and controlled reach without external load.',
      setup: [
        'Stand with feet about hip-width and clear reach space in front.',
        'Use an optional wall behind the athlete as a gentle hip target; no load is required.',
      ],
      executionSteps: [
        'Soften the knees and send the hips backward while keeping the feet supported.',
        'Let the trunk tip as one organized unit through a comfortable range.',
        'Reach the arms forward without losing trunk or foot position.',
        'Press the feet into the floor, bring the hips forward and finish tall.',
        'Reset and repeat for 5 controlled repetitions.',
      ],
      coachCues: ['Hips back.', 'Long spine; ribs stay organized.', 'Own the bottom, then stand tall.'],
      athleteCues: ['Feel my whole foot.', 'Reach long, not low.', 'Squeeze tall without leaning back.'],
      qualityGates: [
        'Hips move backward with a stable base and only a soft knee bend.',
        'The athlete controls a comfortable range without rounding or overextending.',
        'All 5 repetitions begin and finish in balance.',
      ],
      commonFaults: ['Turning the hinge into a squat.', 'Reaching for depth and rounding the back.', 'Shifting onto the toes or leaning behind the finish.'],
      scaling: [
        'Reduce range and hinge to a wall target.',
        'Use a dowel or coach-approved tactile reference to organize head, trunk and pelvis.',
        'Use a stable hand support if balance limits the pattern.',
      ],
      stopSigns: ['Back, hip, hamstring or knee pain.', 'Loss of balance or inability to control the return.', 'A range that requires visible strain or compensation despite scaling.'],
    },
    {
      order: 16,
      id: 'squat-to-stand-overhead-reach',
      name: 'Squat-to-stand + overhead reach',
      dose: '5 repetitions',
      purposes: ['Mobilize', 'Activate', 'Integrate'],
      equipment: ['Optional stable support or heel lift when coach-selected'],
      whyHere: 'Finishes the fixed sequence with a visible squat, stand and overhead-reach checkpoint before the coach selects the day-specific bridge work.',
      setup: [
        'Stand with a comfortable squat stance and enough overhead clearance.',
        'Choose a range and foot angle the athlete can control without forcing depth.',
      ],
      executionSteps: [
        'Sit between the feet into a comfortable squat while keeping the feet supported.',
        'Pause briefly in the lowest controlled position.',
        'Press through the feet and stand tall without rushing.',
        'Reach both arms overhead only as far as trunk and rib position remain controlled.',
        'Return the arms, reset and complete 5 repetitions.',
      ],
      coachCues: ['Whole foot down.', 'Knees follow the feet.', 'Stand first, then reach tall.'],
      athleteCues: ['Use my comfortable depth.', 'Stay balanced.', 'Reach without arching.'],
      qualityGates: [
        'The athlete descends and stands with the feet supported and knees tracking with the feet.',
        'Squat depth remains controlled and repeatable for all 5 repetitions.',
        'The overhead reach occurs without forced range, rib flare or loss of balance.',
      ],
      commonFaults: ['Heels lifting or weight shifting abruptly.', 'Knees collapsing inward.', 'Combining the stand and reach by arching the back.'],
      scaling: [
        'Reduce squat depth or use a stable target behind the athlete.',
        'Use a stable hand support or coach-selected heel lift.',
        'Reach forward or to a lower angle if overhead range changes trunk position.',
      ],
      stopSigns: ['Pain in the squat, stand or reach.', 'Repeated loss of balance or uncontrolled knee movement.', 'Numbness, dizziness or an overhead position that cannot be controlled.'],
    },
  ],
  daySpecificFinish: {
    outsideFixedSequence: true,
    drillCount: 2,
    placement: 'After the fixed 16-exercise sequence',
    instruction:
      'Add exactly two drills specific to that day’s Explosiveness work. These drills are not part of, and do not change, the memorized 16-exercise base sequence.',
    drills: [
      {
        order: 1,
        role: 'Movement or position rehearsal',
        purpose: 'Rehearse the key shape, stance, direction or landing position required by the upcoming Explosiveness task.',
        selection: 'Choose one simple rehearsal that clearly matches the upcoming task and can be performed with controlled intent.',
        delivery: [
          'Demonstrate the exact position or movement link to the upcoming task.',
          'Use a low-complexity, low-fatigue dose that lets the coach correct the shape.',
          'Complete the rehearsal before progressing to drill 2.',
        ],
        qualityGates: [
          'The athlete can enter, hold or repeat the target position under control.',
          'The rehearsal visibly matches a requirement of the upcoming Explosiveness task.',
        ],
      },
      {
        order: 2,
        role: 'Progressive version of the upcoming task',
        purpose: 'Bridge from the rehearsal into a lower-demand version of the first relevant Explosiveness task.',
        selection: 'Choose one progressive version that preserves the upcoming task’s pattern while reducing speed, range, approach, resistance or complexity.',
        delivery: [
          'Name the one feature that now progresses from drill 1.',
          'Use only enough intent to confirm readiness; keep the dose below the day’s working prescription.',
          'Move into the programmed Explosiveness work only when the athlete meets the stated quality gate.',
        ],
        qualityGates: [
          'The athlete preserves the rehearsed position as task demand increases.',
          'Contacts, catches, landings or stops—when present—remain controlled and repeatable.',
        ],
      },
    ],
  },
} satisfies AccessPrepareRoutine
