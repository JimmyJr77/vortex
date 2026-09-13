/** Shared Vortex preparation guidance used by coaches and the AI programming staff. */
const freeze = (value) => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
export const VORTEX_PREPARATION_FRAMEWORK_VERSION = '1.0.0'
export const VORTEX_PREPARATION_PURPOSES = Object.freeze(['raise', 'mobilize', 'activate', 'integrate', 'potentiate_bridge'])
export const VORTEX_PREPARATION_SECTION = freeze({
    id: 'prepare',
    title: 'Prepare & Access: familiar base, specific finish',
    intro: 'Retain the Vortex preparation framework: Raise → Mobilize → Activate → Integrate → Potentiate Bridge. These are preparation purposes, not five extra timed blocks. Several purposes can occur in the same drill. A predictable routine reduces explanation and lets coaches notice readiness changes.',
    points: [
      'Use the sequence below as the familiar full routine in the 15-minute allocation. Distances are short teaching lanes, not quotas. Scale travel, repetitions and complexity to the group. Athletes should finish warm, organized and ready to move quickly.',
      'In 10 minutes, use about 7 minutes for the base: easy jog; backpedal and shuffle; walking and lateral lunges; one crawl sequence; snap-down; A-march or A-skip; ankling or low pogos; hinge and squat checks. Use the remaining 3 minutes for two daily-specific rehearsals. Rotate carioca and B/C-skips into suitable sessions instead of rushing all 16 drills.',
      'Finish the base with a bodyweight hinge and squat so the coach can observe foot pressure, hip and knee control, trunk position and comfortable range. Cue hips back for the hinge and a stable trunk in both; do not force depth, knee position or an exaggerated back arch.',
      'Then use exactly two purposeful preparation tasks: one position/mechanics rehearsal and one progressive version of today’s explosive task. Acceleration: start position → progressive starts. Cutting: controlled brake/plant → quicker cut. Jumping: small jump-and-stick → purposeful practice jump. Throwing: light pattern → progressive throw. Upright sprinting: rhythm rehearsal → buildup.',
      'Replace a drill that is painful, too complex or mismatched to today’s work. Preparation is observation and practice, not a medical screen or a guarantee against injury. Do not exhaust stabilizers or count warm-up hops as a reason to add more impact later.',
    ],
    table: {
      columns: ['Order', 'Full base routine', 'Starting dose'],
      rows: [
        ['1', 'Easy jog', '60 seconds'],
        ['2', 'Backpedal', '10 m'],
        ['3', 'Lateral shuffle', '10 m each direction'],
        ['4', 'Carioca', '10 m each direction'],
        ['5', 'Walking lunge with rotation/reach', '5 m'],
        ['6', 'Lateral lunge with reach', '5 m'],
        ['7', 'Inchworm → plank → bear crawl → downward dog', 'Up to 10 m; shorten the sequence as needed'],
        ['8', 'Traveling snap-down to athletic stick', 'A few controlled repetitions over 10 m'],
        ['9–12', 'A-march, A-skip, B-skip, C-skip', '10 m each; use mastered variations'],
        ['13', 'Ankling', '10 m'],
        ['14', 'Low two-foot pogos', 'Up to 10 quiet, controlled contacts'],
        ['15', 'Bodyweight hip hinge with reach', '5 repetitions'],
        ['16', 'Squat-to-stand with overhead reach', '5 comfortable repetitions'],
      ],
    },
  })
