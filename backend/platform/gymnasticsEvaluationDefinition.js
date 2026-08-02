export const GYMNASTICS_EVALUATION_DEFINITION = [
  { key: 'forward_roll', label: 'Forward Roll', components: [
    ['entry_support', 'Entry & hand support', ['Hands too close to feet', 'Hands too far from feet', 'Weight does not transfer through hands']],
    ['head_neck', 'Head & neck safety', ['Chin not tucked', 'Top of head contacts mat', 'Weight loads onto neck']],
    ['rotation_shape', 'Tuck & round shape', ['Knees separate', 'Tuck opens early', 'Back stays flat', 'Body rolls to one side']],
    ['finish', 'Landing & stand', ['Hard landing', 'Feet separate on landing', 'Hands push off floor to stand', 'Loses balance standing']],
  ] },
  { key: 'back_roll', label: 'Back Roll', components: [
    ['tuck_shape', 'Chin tuck & round shape', ['Chin not tucked', 'Knees separate', 'Tuck opens early', 'Back stays flat']],
    ['hand_placement', 'Hand placement', ['Hands arrive late', 'Hands not beside ears', 'Fingers point away from shoulders', 'Hands placed unevenly']],
    ['arm_push', 'Push off with hands & neck clearance', ['No visible push through hands', 'Elbows flare outward', 'Elbows remain deeply bent', 'Weight loads onto neck']],
    ['rotation_path', 'Rotation path', ['Roll travels to one side', 'Hips do not pass over shoulders', 'Feet contact before hands clear']],
    ['finish', 'Landing & stand', ['Feet separate on landing', 'Knees collapse inward', 'Hands remain on floor', 'Loses balance standing']],
  ] },
  { key: 'cartwheel', label: 'Cartwheel', variants: ['Left', 'Right'], components: [
    ['entry', 'Lunge entry & direction', ['Lead knee not over lead foot', 'Arms not beside ears', 'Entry steps across line', 'Shoulders turn before reaching']],
    ['hand_sequence', 'Hand placement & sequence', ['First hand misses line', 'Second hand misses line', 'Hands land simultaneously', 'Hand-hand-foot-foot order breaks']],
    ['support_line', 'Shoulder support & body line', ['Arms bend in support', 'Shoulders collapse toward hands', 'Hips pass around the side', 'Body travels off line']],
    ['leg_split', 'Leg extension & split', ['Lead leg bends', 'Trail leg bends', 'Legs separate less than expected', 'Knees turn inward']],
    ['foot_form', 'Foot & toe form', ['Lead foot flexes', 'Trail foot flexes', 'Feet sickle']],
    ['finish', 'Balance & lunge finish', ['Wrong foot lands first', 'Feet land together', 'Arms finish below ears', 'Extra step after landing', 'Loses balance']],
  ] },
  { key: 'handstand', label: 'Handstand', components: [
    ['entry', 'Hand placement & entry', ['Hands land unevenly', 'Hands placed too wide', 'Lead leg does not drive upward', 'Crashes into wall', 'Overkicks entry']],
    ['shoulder_support', 'Arm support & shoulder line', ['Elbows bend', 'Shoulders close', 'Shoulders sit behind hands', 'Head lifts out of line']],
    ['trunk_line', 'Rib, hip & trunk alignment', ['Ribs flare', 'Back arches', 'Hips pike', 'Does not squeeze butt', 'Body twists']],
    ['leg_line', 'Straight legs together', ['Knees bend', 'Legs separate', 'Legs drift past vertical']],
    ['foot_line', 'Pointed toes & foot line', ['Feet flex', 'Feet sickle', 'Toe point is uneven']],
    ['balance_exit', 'Balance & exit control', ['Cannot pause in vertical', 'Feet touch wall for support', 'Hands step repeatedly', 'Falls out without control', 'Exit lands off line']],
  ] },
  { key: 'bridge', label: 'Bridge', components: [
    ['setup', 'Hands, feet & setup', ['Hands set wider than shoulders', 'Hands turn outward', 'Feet set wider than hips', 'Feet turn outward']],
    ['arm_support', 'Arm support', ['Elbows bend', 'Elbows flare outward', 'Weight shifts away from hands']],
    ['shoulder_line', 'Shoulder opening', ['Shoulders remain behind wrists', 'Chest does not move through arms', 'Head presses into mat']],
    ['hip_leg_line', 'Hip, knee & leg line', ['Hips remain low', 'Knees separate', 'Knees collapse inward', 'Heels lift']],
    ['hold_exit', 'Hold & exit control', ['Cannot hold two seconds', 'Position shifts during hold', 'Collapses onto head', 'Drops out without control']],
  ] },
  { key: 'back_walkover', label: 'Back Walkover', components: [
    ['entry', 'Start position & reach', ['Front leg bends before movement', 'Arms leave ears', 'Head releases before arms reach', 'Chest drops instead of lifting']],
    ['backbend', 'Backbend path', ['Hips do not shift forward', 'Hands reach off line', 'Hands land unevenly', 'Movement drops too quickly']],
    ['support', 'Arm support & shoulder opening', ['Elbows bend', 'Shoulders close', 'Head contacts floor', 'Weight stalls behind hands']],
    ['split_kick', 'Split & kickover', ['Lead leg bends', 'Trail leg bends', 'Leg split is insufficient', 'Lead leg stops before vertical', 'Trail leg does not push from floor']],
    ['transition', 'Inverted transition', ['Hips pike through vertical', 'Legs close before passing vertical', 'Body twists off line', 'Shoulders collapse during push']],
    ['finish', 'Lunge finish & balance', ['Wrong leg finishes in front', 'Front knee collapses inward', 'Arms finish below ears', 'Extra step after landing', 'Loses balance']],
  ] },
  { key: 'splits', label: 'Front Split', variants: ['Left', 'Right'], components: [
    ['front_leg_line', 'Front leg line', ['Front knee bends', 'Front knee rotates inward', 'Front heel leaves floor']],
    ['back_leg_line', 'Back leg line', ['Back knee bends', 'Back knee turns outward', 'Back leg drifts sideways']],
    ['square_hips', 'Square hip position', ['Front hip pulls backward', 'Back hip opens outward', 'Torso rotates away from front leg']],
    ['depth_hold', 'Depth & hold', ['Hips remain above floor', 'Hands carry most body weight', 'Cannot hold two seconds']],
    ['foot_line', 'Foot & toe line', ['Feet flex', 'Feet sickle', 'Foot lines are uneven']],
  ] },
  { key: 'middle_split', label: 'Middle Split', components: [
    ['leg_line', 'Knee & leg line', ['Knees bend', 'Knees roll forward', 'Legs are uneven']],
    ['hip_line', 'Hip & pelvis position', ['Hips stay behind heels', 'Pelvis rolls backward', 'Torso collapses forward']],
    ['depth_hold', 'Depth & hold', ['Hips remain above floor', 'Heels leave floor', 'Hands carry most body weight', 'Cannot hold two seconds']],
    ['foot_line', 'Foot & toe line', ['Feet flex', 'Feet sickle', 'Foot lines are uneven']],
  ] },
  { key: 'backbend', label: 'Backbend', components: [
    ['start', 'Start position & reach', ['Feet set too wide', 'Knees bend before descent', 'Arms leave ears', 'Chest drops instead of lifting']],
    ['descent', 'Descent path & control', ['Hips shift backward', 'Head releases before arms reach', 'Hands reach off line', 'Descent accelerates uncontrollably']],
    ['hand_support', 'Hand placement & arm support', ['Hands land unevenly', 'Hands land too wide', 'Elbows bend on contact', 'Head contacts floor']],
    ['shoulder_line', 'Shoulder opening', ['Shoulders remain behind wrists', 'Chest does not move through arms', 'Weight remains almost entirely in feet']],
    ['finish_shape', 'Bridge shape & finish', ['Hips remain low', 'Knees separate', 'Knees collapse inward', 'Feet turn outward', 'Cannot hold finish']],
  ] },
].map((movement) => ({
  ...movement,
  components: movement.components.map(([key, label, defaultIssues, variants]) => ({ key, label, defaultIssues, variants })),
}))

export function buildGymnasticsFocusReport(evaluation) {
  const focus = []
  const strengths = []
  for (const movement of evaluation.movements) {
    const name = `${movement.label}${movement.variant ? ` — ${movement.variant}` : ''}`
    for (const component of movement.components) {
      const issues = component.issues ?? []
      if (component.score != null && component.score <= 3) {
        focus.push({ movement: name, component: component.label, text: `Build more consistency in ${component.label.toLowerCase()}.` })
      }
      for (const issue of issues) focus.push({ movement: name, component: component.label, text: `Focus on ${component.label.toLowerCase()}: ${issue}.` })
      if (component.score != null && component.score >= 4 && issues.length === 0) {
        strengths.push({ movement: name, component: component.label, text: `Strong ${component.label.toLowerCase()}.` })
      }
    }
  }
  return { focus, strengths, coachNote: evaluation.coachNote || null }
}
