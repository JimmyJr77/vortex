export const GYMNASTICS_EVALUATION_DEFINITION = [
  { key: 'forward_roll', label: 'Forward Roll', components: [
    ['tuck_and_shape', 'Tuck & shape', ['Chin not tucked', 'Loose tuck shape']],
    ['hand_support', 'Hand support', ['Hands do not support the roll']],
    ['finish', 'Finish & landing', ['Hard landing', 'Cannot stand with control']],
  ] },
  { key: 'back_roll', label: 'Back Roll', components: [
    ['tuck_chin', 'Tuck chin', ['Chin not tucked', 'Neck loading']],
    ['hand_placement', 'Hand placement', ['Hands not by shoulders/ears', 'Fingers not facing back']],
    ['push_off', 'Push off with hands', ['Does not push through hands', 'Elbows bend or flare']],
  ] },
  { key: 'cartwheel', label: 'Cartwheel', variants: ['Left', 'Right'], components: [
    ['balance', 'Balance', ['Loses balance', 'Uncontrolled finish']],
    ['pointed_toes', 'Pointed toes', ['Toes not pointed']],
    ['straight_legs', 'Straight legs', ['Bent lead leg', 'Bent trail leg']],
    ['hand_foot_rhythm', 'Hand–hand–foot–foot rhythm', ['Hands/feet out of order', 'Hands miss the line']],
  ] },
  { key: 'handstand', label: 'Handstand', components: [
    ['entry_control', 'Entry control', ['Crashes into wall', 'Overkicks entry']],
    ['straight_legs', 'Straight legs', ['Bent knees']],
    ['pointed_toes', 'Pointed toes', ['Toes not pointed']],
    ['body_tension', 'Body tension', ['Does not squeeze butt', 'Hips piked or arched']],
  ] },
  { key: 'bridge', label: 'Bridge', components: [
    ['hand_placement', 'Hand placement', ['Hands too wide', 'Hands turned out']],
    ['shoulder_opening', 'Shoulder opening', ['Shoulders closed', 'Arms bent']],
    ['hip_height', 'Hip height', ['Hips low', 'Weight shifts into feet']],
  ] },
  { key: 'back_walkover', label: 'Back Walkover', components: [
    ['entry', 'Entry & reach', ['Arms not by ears', 'Hips do not drive back']],
    ['bridge_phase', 'Bridge phase', ['Shoulders closed', 'Hips drop']],
    ['kickover', 'Kickover', ['Legs bend', 'Leg does not kick through']],
    ['finish', 'Finish & balance', ['Loses balance on landing', 'Finish lacks control']],
  ] },
  { key: 'splits', label: 'Splits', variants: ['Left', 'Right', 'Sideways'], components: [
    ['leg_line', 'Leg line', ['Front knee bent', 'Back knee bent']],
    ['hip_position', 'Hip position', ['Hips not square', 'Hips lifted off floor']],
    ['toe_point', 'Toe point', ['Feet not pointed']],
  ] },
  { key: 'backbend', label: 'Backbend', components: [
    ['entry', 'Entry & reach', ['Arms not by ears', 'Drops too quickly']],
    ['shoulder_opening', 'Shoulder opening', ['Shoulders closed', 'Arms bent']],
    ['body_shape', 'Body shape & control', ['Hips low', 'Uneven weight through hands and feet']],
  ] },
].map((movement) => ({
  ...movement,
  components: movement.components.map(([key, label, defaultIssues]) => ({ key, label, defaultIssues })),
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
