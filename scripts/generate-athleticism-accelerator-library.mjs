#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  acceleratorExerciseKey,
  acceleratorOwnedSlug,
  cleanAcceleratorExerciseName,
  YOUTUBE_WATCH_URL,
} from './lib/accelerator-exercise-library.mjs'
import { buildSlugMap } from './lib/exercise-youtube-migration.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const programsPath = path.join(root, 'src/coach/data/acceleratorPrograms.json')
const accessPreparePath = path.join(root, 'src/coach/accessPrepareStandard.ts')
const manifestPath = path.join(root, 'scripts/data/athleticism-accelerator-library-manifest.json')
const migrationPath = path.join(root, 'backend/migrations/818_coaching_athleticism_accelerator_library.sql')
const programs = JSON.parse(fs.readFileSync(programsPath, 'utf8'))

function readAccessPrepareRoutine() {
  const source = fs.readFileSync(accessPreparePath, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports }, { filename: accessPreparePath })
  return module.exports.ACCESS_PREPARE_STANDARD
}

const accessPrepareRoutine = readAccessPrepareRoutine()

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') field += char
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function canonicalYoutubeUrl(value) {
  const text = String(value ?? '').trim()
  const id = text.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1]
  return id ? `https://www.youtube.com/watch?v=${id}` : null
}

function readYoutubeDonors() {
  const donors = []
  const docsDir = path.join(root, 'docs')
  for (const file of fs.readdirSync(docsDir).filter((name) => /^exercise-youtube-links-\d+\.(?:md|json)$/.test(name))) {
    const text = fs.readFileSync(path.join(docsDir, file), 'utf8')
    try {
      const entries = file.endsWith('.json')
        ? JSON.parse(text)
        : JSON.parse(text.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? '[]')
      for (const entry of entries) {
        const links = [...new Set((entry.youtube_links ?? []).map(canonicalYoutubeUrl).filter(Boolean))]
        if (entry.name && links.length >= 3) donors.push({ name: entry.name, links, source: file })
      }
    } catch {
      // Non-data documentation files are ignored.
    }
  }

  const dataDir = path.join(root, 'scripts/data')
  for (const file of fs.readdirSync(dataDir).filter((name) => name.endsWith('.json') && name !== path.basename(manifestPath))) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
      for (const card of data.cards ?? []) {
        const links = [...new Set([...(card.mediaReferences ?? []), ...(card.youtubeLinks ?? [])]
          .map(canonicalYoutubeUrl).filter(Boolean))]
        if (card.name && links.length >= 3) donors.push({ name: card.name, links, source: file })
      }
    } catch {
      // Some data files are JavaScript or prose despite living beside JSON sources.
    }
  }
  return donors
}

const TOKEN_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'of', 'with', 'from', 'for', 'on', 'at', 'in', 'into', 'out',
  'no', 'low', 'light', 'supported', 'stationary', 'standing', 'seated', 'single', 'double', 'two', 'one',
  'three', 'four', 'short', 'rapid', 'controlled', 'proposed', 'addition', 'variant', 'exact', 'execution',
  'primary', 'anchor', 'bilateral', 'unilateral', 'hand', 'hands', 'foot', 'feet', 'leg', 'arms', 'arm',
  'dumbbell', 'dumbbells', 'loaded', 'bodyweight', 'floor', 'each', 'same', 'other', 'fixed',
])

function mediaTokens(value) {
  return String(value).toLowerCase()
    .replace(/medicine[- ]ball/g, ' medball ')
    .replace(/kettlebell/g, ' kb ')
    .replace(/romanian deadlift|\brdl\b/g, ' rdl ')
    .replace(/battle[- ]rope/g, ' battlerope ')
    .replace(/countermovement/g, ' cmj ')
    .replace(/round[- ]house/g, ' roundhouse ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim().split(/\s+/)
    .filter((token) => token.length > 1 && !TOKEN_STOP_WORDS.has(token))
}

function mediaCategory(value) {
  const text = String(value).toLowerCase()
  if (/roundhouse|chamber|crescent|kick stance|kick line|thigh whip|hip-unwind|shadow (?:sweep|hook)/.test(text)) return 'kick'
  if (/battle.?rope|rope (?:pull|whip|pulse|chop)/.test(text)) return 'battle_rope'
  if (/medicine.?ball|med.?ball|scoop|shot.?put|slam|ball throw|ball pass/.test(text)) return /rotat|lateral|backhand|side/.test(text) ? 'rotational_throw' : 'throw'
  if (/\b(?:opponent|intercept\w*|pursuit|choice|arrival|prediction|closeout|denial|escape|pounce)\b|gap-preservation|pass-lane|two-junction|three-intent/.test(text)) return 'reactive'
  if (/squat|lunge|step.?up|step.?down|sit.?to.?stand/.test(text)) return 'squat'
  if (/deadlift|hinge|swing|hip thrust|bridge|hamstring/.test(text)) return 'hinge'
  if (/row|pull|curl/.test(text)) return 'pull'
  if (/press|push.?up|serratus|fly|shoulder|wrist|forearm/.test(text)) return 'push'
  if (/backhand|uppercut|hand drive|speed sweep|shadow hook/.test(text)) return 'rotational_throw'
  if (/rotat|\bcross\b|hook|sweep|chop/.test(text)) return 'rotational'
  if (/\b(?:pogo|rebound|bounce|bound|hop|hurdle)\b|line jump/.test(text)) return 'elastic'
  if (/jump|takeoff|box/.test(text)) return 'jump'
  if (/calf|soleus|ankle|toe|foot/.test(text)) return 'lower_leg'
  if (/\b(?:cut\w*|shuffle|decel\w*|reversal|turn|route|retreat|redirect\w*|stop|restart)\b/.test(text)) return 'agility'
  if (/\b(?:sprint\w*|acceleration|start|run|dribble|skip|a-switch)\b|knee drive|arm action|step-over/.test(text)) return 'sprint'
  if (/\b(?:react\w*|opponent|partner|cue|intercept\w*|pursuit|gate|chase|read|choice|arrival|prediction|closeout|denial|escape|pounce)\b|gap-preservation|pass-lane/.test(text)) return 'reactive'
  if (/plank|pallof|hold|iso|core/.test(text)) return 'control'
  return 'general'
}

function donorScore(exerciseName, donorName) {
  const exercise = mediaTokens(exerciseName)
  const donor = mediaTokens(donorName)
  const exerciseSet = new Set(exercise)
  const donorSet = new Set(donor)
  let overlap = 0
  for (const token of exerciseSet) if (donorSet.has(token)) overlap += 1
  const union = new Set([...exerciseSet, ...donorSet]).size || 1
  let score = overlap / union
  if (exercise.join(' ') === donor.join(' ')) score += 3
  if (exercise.length && (exercise.every((token) => donorSet.has(token)) || donor.every((token) => exerciseSet.has(token)))) score += 0.5
  if (mediaCategory(exerciseName) === mediaCategory(donorName)) score += 0.75
  else score -= 0.6
  for (let index = 0; index < exercise.length - 1; index += 1) {
    if (donor.join(' ').includes(`${exercise[index]} ${exercise[index + 1]}`)) score += 0.2
  }
  return score
}

const donors = readYoutubeDonors()
if (!donors.length) throw new Error('No local YouTube research sources were found')

const curatedVideoFamilies = [
  {
    matches: /^easy jog$/,
    name: 'Relaxed jogging and running form technique',
    source: 'curated YouTube family research (2026-09-14)',
    links: [
      'https://www.youtube.com/watch?v=_kGESn8ArrU',
      'https://www.youtube.com/watch?v=brFHyOtTwH4',
      'https://www.youtube.com/watch?v=ZTBRQ5MEJsE',
    ],
  },
  {
    matches: /^b-skip$/,
    name: 'B-skip running drill technique',
    source: 'curated YouTube family research (2026-09-14)',
    links: [
      'https://www.youtube.com/watch?v=JeMBzS2ctK8',
      'https://www.youtube.com/watch?v=kgAM5sYzLOk',
      'https://www.youtube.com/watch?v=Zy97yNE7WEE',
    ],
  },
  {
    matches: /^c-skip$/,
    name: 'C-skip running drill technique',
    source: 'curated YouTube family research (2026-09-14)',
    links: [
      'https://www.youtube.com/watch?v=0yqta_g4Plw',
      'https://www.youtube.com/watch?v=2pjIvs-LuYI',
      'https://www.youtube.com/watch?v=ZzTRFQnhNZg',
    ],
  },
  {
    matches: /^low two-foot pogos$/,
    name: 'Low bilateral pogo technique',
    source: 'curated YouTube family research (2026-09-14)',
    links: [
      'https://www.youtube.com/watch?v=W0nK_eBArXM',
      'https://www.youtube.com/watch?v=j0nl5dWuqN4',
      'https://www.youtube.com/watch?v=012N1s1j9-Q',
    ],
  },
  {
    matches: /^inchworm.*plank.*bear crawl.*downward dog$/,
    name: 'Inchworm, bear-plank, and downward-dog flow components',
    source: 'curated YouTube family research (2026-09-14)',
    links: [
      'https://www.youtube.com/watch?v=ttxQ_UPOwWc',
      'https://www.youtube.com/watch?v=NO1j4vkhuq0',
      'https://www.youtube.com/watch?v=bmBKKWMp1Lg',
    ],
  },
  {
    matches: /^walking lunge \+ rotation\/reach$/,
    name: 'Walking lunge with rotation and reach technique',
    source: 'curated YouTube family research (2026-09-14)',
    links: [
      'https://www.youtube.com/watch?v=G65aplILBXs',
      'https://www.youtube.com/watch?v=6pNdX48WNmQ',
      'https://www.youtube.com/watch?v=1Y2o9Tw0uDg',
    ],
  },
  {
    matches: /^lateral shuffle$/,
    name: 'Lateral shuffle mechanics walkthrough',
    source: 'exercise-youtube-links-2.md',
    links: [
      'https://www.youtube.com/watch?v=lMVtip30M-0',
      'https://www.youtube.com/watch?v=y0xgAiQ4KGw',
      'https://www.youtube.com/watch?v=mziPKITnPeQ',
    ],
  },
  {
    matches: /^carioca \/ karaoke$/,
    name: 'Carioca and grapevine walkthrough',
    source: 'exercise-youtube-links-2.md',
    links: [
      'https://www.youtube.com/watch?v=X4-1Uk977sw',
      'https://www.youtube.com/watch?v=R3__Q_SulyM',
      'https://www.youtube.com/watch?v=ViOHs1b6jGc',
    ],
  },
  {
    matches: /battle.?rope/,
    name: 'Battle rope waves, slams, and rotational technique',
    source: 'curated YouTube family research (2026-09-14)',
    links: [
      'https://www.youtube.com/watch?v=UG_XNll_4cQ',
      'https://www.youtube.com/watch?v=iCwYSDVILaU',
      'https://www.youtube.com/watch?v=nzlmTiKqno0',
    ],
  },
  {
    matches: /roundhouse|chamber|crescent|kick stance|kick line|thigh whip|hip-unwind|shadow (?:sweep|hook)/,
    name: 'Roundhouse kick chamber, pivot, and re-chamber technique',
    source: 'curated YouTube family research (2026-09-14)',
    links: [
      'https://www.youtube.com/watch?v=BZmIA4Sseco',
      'https://www.youtube.com/watch?v=GoevMondYIs',
      'https://www.youtube.com/watch?v=9G5Bd_DaP24',
    ],
  },
]

function selectDonor(name) {
  if (/battle.?rope.*(?:traction|pull)|hand-over-hand battle.?rope/i.test(name)) {
    const ropePull = donors.find((donor) => donor.name === 'Rope Hand-over-Hand Sled Pull')
    if (ropePull) return ropePull
  }
  const curated = curatedVideoFamilies.find((family) => family.matches.test(name.toLowerCase()))
  if (curated) return curated
  let best = null
  for (const donor of donors) {
    const score = donorScore(name, donor.name)
    if (!best || score > best.score) best = { ...donor, score }
  }
  if (!best) throw new Error(`No YouTube donor found for ${name}`)
  return best
}

const usesByKey = new Map()
for (const [programId, sessions] of Object.entries(programs)) {
  for (const session of sessions) {
    for (const exercise of [...(session.prepareExercises ?? []), ...(session.exercises ?? [])]) {
      const name = cleanAcceleratorExerciseName(exercise.name)
      const key = acceleratorExerciseKey(name)
      const use = { ...exercise, name, sourceName: cleanAcceleratorExerciseName(exercise.sourceName ?? name), programId, classNumber: session.n }
      const existing = usesByKey.get(key)
      if (!existing) usesByKey.set(key, { key, name, phase: exercise.id?.startsWith('E') ? 'output' : exercise.id?.startsWith('S') ? 'resilience' : exercise.id?.startsWith('P') ? 'capacity' : 'prepare_and_access', uses: [use], representative: use })
      else {
        existing.uses.push(use)
        if (String(use.instruction ?? '').length > String(existing.representative.instruction ?? '').length) existing.representative = use
      }
    }
  }
}
for (const exercise of accessPrepareRoutine.exercises) {
  const name = cleanAcceleratorExerciseName(exercise.name)
  const key = acceleratorExerciseKey(name)
  const use = {
    id: `AP${exercise.order}`,
    name,
    sourceName: name,
    dose: exercise.dose,
    description: exercise.whyHere,
    prescription: exercise.dose,
    rest: 'Use the continuous coached routine flow; pause to restore spacing or movement quality.',
    purpose: exercise.whyHere,
    instruction: exercise.executionSteps.join(' '),
    preparation: null,
    equipment: exercise.equipment,
    setup: exercise.setup,
    executionSteps: exercise.executionSteps,
    coachCues: exercise.coachCues,
    athleteCues: exercise.athleteCues,
    qualityGates: exercise.qualityGates,
    commonFaults: exercise.commonFaults,
    scaling: exercise.scaling,
    stopSigns: exercise.stopSigns,
    programId: accessPrepareRoutine.id,
    classNumber: null,
  }
  usesByKey.set(key, { key, name, phase: 'prepare_and_access', uses: [use], representative: use, forceNew: true })
}

const difficultyRows = parseCsv(fs.readFileSync(path.join(root, 'docs/exercise-difficulty-review.csv'), 'utf8'))
const difficultyHeader = difficultyRows.shift()
const slugColumn = difficultyHeader.indexOf('slug')
const nameColumn = difficultyHeader.indexOf('name')
const existingByKey = new Map()
for (const row of difficultyRows) {
  const slug = row[slugColumn]
  const name = row[nameColumn]
  if (slug && name) existingByKey.set(acceleratorExerciseKey(name), { slug, name })
}

const slugByName = buildSlugMap(root)
const linksByExistingSlug = new Map()
for (const donor of donors) {
  const slug = slugByName.get(String(donor.name).trim().toLowerCase()) ?? existingByKey.get(acceleratorExerciseKey(donor.name))?.slug
  if (slug && donor.links.length >= 3) linksByExistingSlug.set(slug, donor.links)
}

function containsAny(text, expressions) {
  return expressions.some((expression) => expression.test(text))
}

function phaseMetadata(phase, name) {
  const text = name.toLowerCase()
  if (phase === 'output') {
    if (containsAny(text, [/react/, /opponent/, /partner/, /cue/, /intercept/, /pursuit/, /choice/, /read/, /gate/, /chase/])) return { subrole: 'reactive_agility_tumbling_output', slot: 'accelerator_output_reactive', family: 'Reactive agility output', orderIndex: 9095 }
    if (containsAny(text, [/cut/, /decel/, /shuffle/, /reversal/, /turn/, /redirect/, /route/, /retreat/])) return { subrole: 'deceleration_cod_power', slot: 'accelerator_output_deceleration_cod', family: 'Deceleration and change-of-direction output', orderIndex: 9094 }
    if (containsAny(text, [/sprint/, /acceleration/, /\bstart\b/, /\brun\b/, /dribble/, /skip/])) return { subrole: 'acceleration_start_speed', slot: 'accelerator_output_acceleration', family: 'Acceleration and speed output', orderIndex: 9091 }
    if (containsAny(text, [/pogo/, /rebound/, /bound/, /hop/, /hurdle/, /rope bounce/, /line jump/])) return { subrole: 'elastic_stiffness_plyometric_rudiments', slot: 'accelerator_output_elastic', family: 'Elastic and plyometric output', orderIndex: 9093 }
    return { subrole: 'jump_throw_explosive_power', slot: 'accelerator_output_jump_throw', family: 'Jump, throw, and explosive power', orderIndex: 9092 }
  }
  if (phase === 'resilience') {
    if (containsAny(text, [/landing/, /stick/, /decel/, /step.?down/])) return { subrole: 'landing_braking_control', slot: 'accelerator_resilience_landing', family: 'Landing and braking resilience', orderIndex: 9191 }
    if (containsAny(text, [/single.?leg/, /ankle/, /calf/, /soleus/, /toe/, /foot/, /hip (?:ab|ad)duction/, /clamshell/, /airplane/])) return { subrole: 'single_leg_balance_foot_ankle_hip_control', slot: 'accelerator_resilience_single_leg', family: 'Single-leg and lower-limb resilience', orderIndex: 9192 }
    if (containsAny(text, [/shoulder/, /scap/, /wrist/, /hand support/, /external rotation/])) return { subrole: 'scapular_wrist_hand_support_resilience', slot: 'accelerator_resilience_upper_support', family: 'Shoulder, wrist, and hand-support resilience', orderIndex: 9194 }
    if (containsAny(text, [/plank/, /pallof/, /dead bug/, /bird dog/, /trunk/, /suitcase/, /bridge hold/])) return { subrole: 'trunk_pelvis_anti_movement_control', slot: 'accelerator_resilience_trunk', family: 'Trunk and pelvic resilience', orderIndex: 9193 }
    return { subrole: 'slow_eccentric_isometric_joint_resilience', slot: 'accelerator_resilience_tissue', family: 'Joint and tissue resilience', orderIndex: 9195 }
  }
  if (phase === 'capacity') {
    if (containsAny(text, [/squat/, /lunge/, /step.?up/, /step.?down/, /sit.?to.?stand/])) return { subrole: 'squat_knee_dominant_strength', slot: 'accelerator_capacity_squat', family: 'Squat and knee-dominant strength', orderIndex: 9291 }
    if (containsAny(text, [/deadlift/, /hinge/, /swing/, /hip thrust/, /bridge/, /hamstring/])) return { subrole: 'hinge_posterior_chain_strength', slot: 'accelerator_capacity_hinge', family: 'Hinge and posterior-chain strength', orderIndex: 9292 }
    if (containsAny(text, [/row/, /pull/, /curl/, /chin/, /traction/])) return { subrole: 'pull_hang_grip_strength', slot: 'accelerator_capacity_pull', family: 'Pull, hang, and grip strength', orderIndex: 9294 }
    if (containsAny(text, [/press/, /push/, /fly/, /raise/, /serratus/])) return { subrole: 'upper_body_push_strength', slot: 'accelerator_capacity_push', family: 'Upper-body push strength', orderIndex: 9293 }
    if (containsAny(text, [/carry/, /loaded march/, /suitcase hold/])) return { subrole: 'carry_trunk_loaded_bracing_strength', slot: 'accelerator_capacity_carry', family: 'Carry and loaded bracing strength', orderIndex: 9295 }
    return { subrole: 'tissue_capacity_isometric_eccentric_accessory', slot: 'accelerator_capacity_accessory', family: 'Accessory and tissue capacity', orderIndex: 9296 }
  }
  return { subrole: 'integrate', slot: 'accelerator_prepare_integrate', family: 'Prepare and access', orderIndex: 179 }
}

function primaryPattern(name) {
  const text = name.toLowerCase()
  if (/rotat|pivot|turn|backhand|roundhouse|chamber|crescent/.test(text)) return 'rotate'
  if (/jump|hop|bound|pogo|rebound|takeoff|skip/.test(text)) return 'jump'
  if (/sprint|run|jog|shuffle|crawl|gallop|chase|route|retreat/.test(text)) return 'locomote'
  if (/squat|lunge|step.?up|step.?down|sit.?to.?stand|calf/.test(text)) return 'squat'
  if (/deadlift|hinge|swing|hip thrust|bridge|hamstring/.test(text)) return 'hinge'
  if (/row|pull|curl|chin/.test(text)) return 'pull'
  if (/press|push|throw|toss|slam|heave|shot.?put|serratus|fly/.test(text)) return 'push'
  if (/carry/.test(text)) return 'carry'
  return 'brace'
}

function equipmentKey(exercise) {
  const text = `${exercise.name} ${(exercise.equipment ?? []).join(' ')}`.toLowerCase()
  if (/slam ball/.test(text)) return 'slam_ball'
  if (/medicine ball|med ball/.test(text)) return 'medicine_ball'
  if (/battle rope|loose rope/.test(text)) return 'battle_rope'
  if (/jump rope/.test(text)) return 'jump_rope'
  if (/dumbbell/.test(text)) return 'dumbbell'
  if (/kettlebell/.test(text)) return 'kettlebell'
  if (/landmine/.test(text)) return 'landmine'
  if (/cable/.test(text)) return 'cable_machine'
  if (/band/.test(text)) return 'bands'
  if (/sled/.test(text)) return 'sled'
  if (/pull-up bar|pull up bar/.test(text)) return 'pull_up_bar'
  if (/box|step|bench/.test(text)) return /bench/.test(text) ? 'bench' : 'box'
  if (/wall/.test(text)) return 'wall'
  if (/cone|lane|marked space|gate/.test(text)) return 'cones'
  if (/partner|opponent|handoff/.test(text)) return 'partner'
  return 'none'
}

function bodyRegion(name) {
  const text = name.toLowerCase()
  if (/wrist|forearm|hand/.test(text)) return 'wrist'
  if (/shoulder|press|push|row|pull|throw|toss|slam|serratus|fly|curl/.test(text)) return 'shoulder'
  if (/plank|pallof|dead bug|trunk|core|carry/.test(text)) return 'core'
  if (/ankle|calf|soleus|toe|foot|pogo/.test(text)) return 'ankle'
  if (/hip|hinge|deadlift|swing|bridge|lunge|squat|jump|hop|bound|sprint|run|kick/.test(text)) return 'hip'
  return 'full_body'
}

function sentences(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean)
}

function parseDose(exercise, phase) {
  const text = `${exercise.dose ?? ''} ${exercise.prescription ?? ''}`
  const setRep = text.match(/(\d+)\s*[×x]\s*(\d+)/)
  const work = text.match(/(\d+)\s*(?:s|sec(?:onds)?)\b/i)
  const distance = text.match(/(\d+)\s*m(?:et(?:er|re)s?)?\b/i)
  const contacts = text.match(/(\d+)\s*contacts?\b/i)
  const repetitions = text.match(/(\d+)\s*(?:repetitions?|reps?)\b/i)
  const sets = Number(setRep?.[1] ?? (phase === 'output' ? 2 : phase === 'capacity' ? 2 : 1))
  const reps = Number(setRep?.[2] ?? distance?.[1] ?? contacts?.[1] ?? repetitions?.[1] ?? (work ? 1 : phase === 'output' ? 3 : 6))
  const restMatch = String(exercise.rest ?? '').match(/(\d+)\s*(?:s|sec(?:onds)?)/i)
  const rest = Number(restMatch?.[1] ?? (phase === 'output' ? 90 : phase === 'capacity' ? 90 : 45))
  return {
    volume_unit: work && !setRep ? 'seconds' : distance ? 'distance' : /attempt/i.test(text) ? 'attempts' : /contact/i.test(text) ? 'contacts' : 'reps',
    default_sets: Math.max(1, sets),
    default_reps: Math.max(1, reps),
    default_work_seconds: work && !setRep ? Number(work[1]) : null,
    default_rest_seconds: Math.max(0, rest),
    est_seconds_per_set: phase === 'capacity' ? 60 : phase === 'output' ? 45 : 50,
    default_rpe_min: phase === 'capacity' ? 6 : phase === 'output' ? 7 : 3,
    default_rpe_max: phase === 'capacity' ? 8 : phase === 'output' ? 9 : 6,
  }
}

function buildCard(group, librarySlug) {
  const exercise = group.representative
  const { phase, name } = group
  const meta = phaseMetadata(phase, name)
  const text = name.toLowerCase()
  const pattern = primaryPattern(name)
  const highImpact = phase === 'output' && /jump|hop|bound|pogo|rebound|hurdle|takeoff|landing/.test(text)
  const impact = highImpact ? 3 : phase === 'output' || (phase === 'prepare_and_access' && /jog|skip|ankling|pogo|snap.?down/.test(text)) ? 1 : 0
  const loaded = /dumbbell|kettlebell|landmine|barbell|loaded|medicine.?ball|med.?ball|cable|band|slam ball/.test(text)
  const technical = phase === 'output' ? (/(?:react|opponent|partner|cut|turn|kick)/.test(text) ? 6 : 5) : phase === 'capacity' ? 4 : 4
  const load = phase === 'capacity' ? (loaded ? 6 : 4) : highImpact ? 6 : loaded ? 4 : 3
  const complexity = /react|opponent|partner|cue|choice|intercept|handoff/.test(text) ? 6 : 3
  const overall = Math.max(technical, load, complexity)
  const rawInstruction = String(exercise.instruction || exercise.description || exercise.purpose || `${name} performed with the exact Accelerator prescription.`).replace(/\s+/g, ' ').trim()
  const instructionSentences = sentences(rawInstruction)
  const donor = selectDonor(name)
  const youtube = donor.links.slice(0, 3)
  if (youtube.length < 3 || youtube.some((url) => !YOUTUBE_WATCH_URL.test(url))) throw new Error(`Invalid YouTube coverage for ${name}`)
  const equipment = equipmentKey(exercise)
  const participantStructure = /partner|opponent|handoff|passer|receiver/.test(text) ? 'pairs' : 'individual'
  const phasePurpose = phase === 'output'
    ? 'Express speed or power while fresh, using full recovery and stopping before output quality falls.'
    : phase === 'capacity'
      ? 'Build force capacity with controlled repetitions, appropriate loading, and clean reps held in reserve.'
      : phase === 'resilience'
        ? 'Build control and tissue tolerance without turning the drill into conditioning or pre-fatiguing later work.'
        : 'Increase readiness without creating meaningful fatigue.'
  const physiology = phase === 'output' ? (/pogo|hop|bound|jump|rebound/.test(text) ? 'ssc_stiffness' : 'neural_output_readiness') : phase === 'capacity' ? 'force_tissue_capacity' : 'control_stability'
  const methodology = phase === 'output' ? (/jump|hop|bound|pogo|rebound|throw|toss|slam/.test(text) ? 'plyometrics' : 'neural') : phase === 'capacity' ? 'resistance_calisthenics' : /eccentric|lower|adduction|abduction|calf|soleus|hamstring/.test(text) ? 'eccentric_negative' : 'balance_stability'
  const tenet = phase === 'output' ? 'explosiveness' : phase === 'capacity' ? 'strength' : /balance|stick|single.?leg/.test(text) ? 'balance' : 'body_control'
  const dose = parseDose(exercise, phase)
  const displayDose = String(exercise.dose || exercise.prescription || 'Use the prescribed Accelerator dose.')
  const summary = String(exercise.purpose || exercise.description || phasePurpose).replace(/\s+/g, ' ').trim()
  const equipmentLabel = (exercise.equipment ?? []).join(', ') || 'a clear, stable bodyweight station'
  const exactScaling = (exercise.scaling ?? []).join(' ')
  return {
    slug: librarySlug,
    name,
    family: meta.family,
    primaryPhaseKey: phase,
    subrole: meta.subrole,
    slot: meta.slot,
    cardSummary: summary,
    bestPlacement: `Use in the Accelerator ${phase.replace(/_/g, ' ')} block with the listed dose and recovery. ${phasePurpose}`,
    description: rawInstruction,
    coachLanguage: `This card represents the exact Accelerator-listed identity “${name}.” Preserve its declared stance, direction, support, landing or receiving condition, and equipment boundary.`,
    athleteLanguage: phase === 'output' ? 'Make every effort fast and clean; reset fully before the next one.' : phase === 'capacity' ? 'Own the position and finish every rep with two or three good reps still available.' : 'Move with control and stop before the position changes.',
    participantStructure,
    tenets: [{ key: tenet, weight: 5 }],
    methodologies: [{ key: methodology, weight: 5 }],
    physiology: [{ key: physiology, weight: 5 }],
    patterns: [{ key: pattern, weight: 5 }],
    equipment: [{ key: equipment, weight: 5 }],
    body_regions: [{ key: bodyRegion(name), weight: 5 }],
    whyItWorks: summary,
    whyItGoesHere: `${phasePurpose} The ${meta.subrole.replace(/_/g, ' ')} placement matches this exercise’s dominant job in the written Accelerator class.`,
    commonMisuse: phase === 'output' ? 'Do not shorten recovery, add fatigue reps, or continue after speed, landing, direction, or release quality declines.' : phase === 'capacity' ? 'Do not turn the strength prescription into a timed circuit, grind failed repetitions, or add load before the exact position is controlled.' : 'Do not chase fatigue, force range, or continue through a loss of joint, trunk, landing, or balance control.',
    scalingGuidance: 'Scale one variable at a time—load, range, speed, distance, support, or decision demand—while preserving the named movement identity.',
    movementRequirements: {
      primary_joint_actions: [pattern === 'locomote' ? 'coordinated_lower_body_locomotion' : `${pattern}_pattern_control`],
      primary_tissues: [bodyRegion(name)],
      primary_motor_control_demands: [meta.subrole],
      breathing_demand: 'continuous breathing without bracing or breath-holding drift',
      balance_demand: /single.?leg|stick|landing|balance/.test(text) ? 'moderate-to-high' : 'moderate',
      coordination_demand: complexity >= 6 ? 'high' : 'moderate',
      impact_level: impact,
    },
    coachingExecution: {
      movement_description: rawInstruction,
      setup: exercise.setup?.length ? exercise.setup : [`Prepare ${equipmentLabel}; inspect the surface, anchors, clearances, and retrieval path that apply.`, instructionSentences[0] || `Set the exact start position for ${name}.`],
      execution_steps: exercise.executionSteps?.length ? exercise.executionSteps : [...instructionSentences.slice(0, 4), `Complete ${displayDose}; preserve the written recovery before repeating.`],
      coach_cues: exercise.coachCues?.length ? exercise.coachCues : ['Preserve the named stance, direction, support, and finish.', phase === 'output' ? 'Full reset; fast and clean, never fatigued.' : 'Control the full usable range and stop before compensation.'],
      athlete_cues: exercise.athleteCues?.length ? exercise.athleteCues : [phase === 'output' ? 'Fast, clean, then reset.' : 'Own the position from start to finish.', 'Stop if the rep changes or symptoms appear.'],
      breathing_cues: ['Breathe continuously; do not hold the breath to force a rep.'],
      common_faults: exercise.commonFaults?.length ? exercise.commonFaults : [phase === 'output' ? 'Shortening recovery and turning quality work into conditioning.' : 'Adding load, range, or speed after position quality changes.', 'Changing the listed stance, direction, support, landing, or equipment and treating it as the same variation.'],
      quality_gate: exercise.qualityGates?.length ? exercise.qualityGates : ['All prescribed reps match the named setup and finish with stable, repeatable control.'],
      stop_signs: exercise.stopSigns?.length ? exercise.stopSigns : ['Pain, dizziness, unsafe equipment or surface, loss of control, or inability to preserve the named variation.'],
    },
    dosage: dose,
    scaling: {
      youth_beginner: exactScaling || 'Reduce load, range, speed, distance, impact, and decision demand. Use one coached rep at a time and stop at the first loss of control.',
      youth_intermediate: exactScaling || 'Use the written pattern at a conservative dose; progress one variable only after repeated clean sessions.',
      teen: 'Use the class prescription when readiness and technique support it; keep full recovery for explosive work and clean reps in reserve for strength.',
      adult_beginner: 'Begin below the written load, range, or speed and increase only after the exact start and finish remain repeatable.',
      adult_advanced: 'Use the written variation and progress one measurable constraint at a time without changing the movement identity.',
      older_adult: 'Reduce impact, speed, range, and balance demand; add stable support and longer transitions as needed.',
      pregnancy_postpartum: 'Use an individually cleared lower-impact, lower-load option; avoid breath holding, unstable balance, uncomfortable positions, and symptom-provoking impact.',
    },
    genderSpecificNotes: 'No default gender-based load split; scale to current technique, training history, symptoms, recovery, and pregnancy/postpartum considerations.',
    pairsWellAfter: phase === 'output' ? ['Prepare & Access movement matching the exercise pattern'] : ['Low-fatigue movement preparation'],
    pairsWellBefore: phase === 'output' ? ['Full prescribed recovery before the next output exposure'] : [],
    doNotUseWhen: ['The exact station, equipment, supervision, or clearance cannot be established.', 'Pain, dizziness, unusual breathlessness, instability, or a participant request to stop is present.', 'The athlete cannot preserve the named setup and finish at the planned dose.'],
    goodForSessions: [phase === 'output' ? 'athletic_output' : phase === 'capacity' ? 'strength_capacity' : phase === 'prepare_and_access' ? 'movement_preparation' : 'resilience'],
    mediaReferences: youtube,
    mediaInternalNotes: [`Three embeddable YouTube references are attached. Closest researched movement-family source: ${donor.name} (${donor.source}).`, 'The written card is authoritative for the exact Accelerator stance, direction, support, finish, dose, and safety boundary; do not infer an unshown variation from a video.'],
    difficultyProfile: { technical, load, complexity, overall, recommended_age_min: overall >= 7 ? 13 : overall >= 6 ? 9 : 6, recommended_age_max: null, attention_demand: complexity >= 6 ? 'high' : 'moderate', notes: 'Exercise difficulty describes the task; workout readiness remains athlete-specific.' },
    safety: { risk_level: highImpact ? 3 : loaded ? 2 : 1, impact_level: impact, requires_spotting: false, requires_coach_supervision: phase === 'output' || loaded ? 'recommended' : 'optional', readiness_checks: ['Confirm the exact station, equipment, surface, clearance, and stop signal.', 'Confirm the athlete can demonstrate the named start and finish at a lower rehearsal intensity.', 'Confirm current symptoms, fatigue, and recent workload permit the prescribed exposure.'], contraindications: ['Pain, acute injury concern, unsafe equipment or surface, or inability to follow the stop signal.'], common_substitutions: exercise.scaling?.length ? exercise.scaling : ['Use the documented class substitution only after its equipment, dose, duration, and loading are rechecked.'] },
    regimen: { can_be_daily: phase === 'prepare_and_access', weekly_max_frequency: phase === 'prepare_and_access' ? 7 : phase === 'resilience' ? 4 : 3, minimum_hours_between_hard_exposures: phase === 'output' || phase === 'capacity' ? 24 : 12, counts_as_high_intensity: phase === 'output', counts_as_high_impact: highImpact, counts_as_neural: phase === 'output', counts_as_tissue_stress: phase !== 'output' || highImpact, counts_as_conditioning: false },
    phaseProfile: { role: 'primary', fit_weight: 5, freshness_required: phase === 'output', fatigue_cost: phase === 'output' ? 4 : phase === 'capacity' ? 3 : 2, fatigue_sensitivity: phase === 'output' ? 4 : 2, technical_complexity: Math.min(5, Math.ceil(technical / 2)), impact_level: impact, intensity_ceiling: phase === 'output' ? 'max' : phase === 'capacity' ? 'high' : 'moderate' },
    videoDonor: donor.name,
  }
}

const associations = []
const newCards = []
for (const group of [...usesByKey.values()].sort((a, b) => a.key.localeCompare(b.key))) {
  const existing = existingByKey.get(group.key)
  const reuseExisting = !group.forceNew && existing && (linksByExistingSlug.get(existing.slug)?.length ?? 0) >= 3
  const librarySlug = reuseExisting ? existing.slug : acceleratorOwnedSlug(group.name)
  const card = reuseExisting ? null : buildCard(group, librarySlug)
  const youtubeReferences = reuseExisting
    ? linksByExistingSlug.get(existing.slug).slice(0, 3)
    : card.mediaReferences
  associations.push({
    exerciseKey: group.key,
    exerciseName: group.name,
    librarySlug,
    phase: group.phase,
    source: reuseExisting ? 'existing_library' : 'accelerator_card',
    youtubeReferences,
    occurrenceCount: group.uses.length,
  })
  if (card) newCards.push(card)
}

const manifest = {
  schemaVersion: 1,
  sources: ['src/coach/data/acceleratorPrograms.json', 'src/coach/accessPrepareStandard.ts'],
  cardGuide: 'docs/exercise_card_details_for_llm.md',
  minimumYoutubeReferences: 3,
  associationCount: associations.length,
  newCardCount: newCards.length,
  reusedCardCount: associations.length - newCards.length,
  prescriptionCount: [...usesByKey.values()].reduce((total, group) => total + group.uses.length, 0),
  preparePrescriptionCount: [...usesByKey.values()].filter((group) => group.phase === 'prepare_and_access').reduce((total, group) => total + group.uses.length, 0),
  associations,
}

function sqlString(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`
}

function jsonb(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`
}

const slots = [...new Map(newCards.map((card) => {
  const meta = phaseMetadata(card.primaryPhaseKey, card.name)
  return [card.slot, { key: card.slot, name: card.family, phase: card.primaryPhaseKey, subrole: card.subrole, orderIndex: meta.orderIndex }]
})).values()]

let sql = `-- Athleticism Accelerator exact exercise-card coverage.
-- IDEMPOTENT. Generated by scripts/generate-athleticism-accelerator-library.mjs.
-- ${manifest.prescriptionCount} listed prescriptions -> ${manifest.associationCount} stable exercise identities.
-- ${manifest.reusedCardCount} existing rich cards reused; ${manifest.newCardCount} exact Accelerator cards created.

INSERT INTO coaching.equipment (key, name, sort_order)
VALUES ('battle_rope', 'Battle Rope', 990)
ON CONFLICT (key) DO NOTHING;

INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity, subrole_key)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity, v.subrole_key
FROM coaching.session_phase sp
JOIN (VALUES
${slots.map((slot) => `  (${sqlString(slot.key)}, ${sqlString(slot.name)}, ${sqlString(`Accelerator exact-card placement for ${slot.name}.`)}, ${sqlString(slot.phase)}, ${slot.orderIndex}, ${slot.phase === 'output' ? 5 : 2}, ${sqlString(slot.subrole)})`).join(',\n')}
) AS v(key, name, description, phase_key, order_index, freshness_sensitivity, subrole_key)
  ON sp.key = v.phase_key
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  phase_id = EXCLUDED.phase_id,
  order_index = EXCLUDED.order_index,
  freshness_sensitivity = EXCLUDED.freshness_sensitivity,
  subrole_key = EXCLUDED.subrole_key;

CREATE TEMP TABLE accelerator_exercise_card_seed (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  payload JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO accelerator_exercise_card_seed (slug, name, payload) VALUES
${newCards.map((card) => `  (${sqlString(card.slug)}, ${sqlString(card.name)}, ${jsonb(card)})`).join(',\n')};

INSERT INTO coaching.exercise (
  facility_id, name, slug, description, sport_id, skill_level, age_min,
  default_sets, default_reps, default_work_seconds, default_rest_seconds, est_seconds_per_set,
  is_published, visibility, card_summary, coach_language, athlete_language,
  movement_family, primary_phase_key, phase_subrole, primary_order_slot,
  movement_requirements, coaching_execution, pairing_logic, media_library,
  why_publish_ready, participant_structure, programming_kind
)
SELECT
  facility.id, seed.name, seed.slug, seed.payload->>'description',
  (SELECT id FROM coaching.sport WHERE key = 'fitness' LIMIT 1), NULL::public.skill_level,
  (seed.payload->'difficultyProfile'->>'recommended_age_min')::int,
  (seed.payload->'dosage'->>'default_sets')::int,
  (seed.payload->'dosage'->>'default_reps')::int,
  NULLIF(seed.payload->'dosage'->>'default_work_seconds', '')::int,
  (seed.payload->'dosage'->>'default_rest_seconds')::int,
  (seed.payload->'dosage'->>'est_seconds_per_set')::int,
  TRUE, 'facility', seed.payload->>'cardSummary', seed.payload->>'coachLanguage', seed.payload->>'athleteLanguage',
  seed.payload->>'family', seed.payload->>'primaryPhaseKey', seed.payload->>'subrole', seed.payload->>'slot',
  seed.payload->'movementRequirements', seed.payload->'coachingExecution',
  jsonb_build_object(
    'pairs_well_before', COALESCE(seed.payload->'pairsWellBefore', '[]'::jsonb),
    'pairs_well_after', COALESCE(seed.payload->'pairsWellAfter', '[]'::jsonb),
    'do_not_use_when', COALESCE(seed.payload->'doNotUseWhen', '[]'::jsonb),
    'good_for_sessions', COALESCE(seed.payload->'goodForSessions', '[]'::jsonb)
  ),
  jsonb_build_object(
    'demo_video_sources', '[]'::jsonb,
    'coaching_articles', '[]'::jsonb,
    'clinical_or_sport_science_references', seed.payload->'mediaReferences',
    'internal_notes', seed.payload->'mediaInternalNotes'
  ),
  TRUE, seed.payload->>'participantStructure', 'exercise'
FROM accelerator_exercise_card_seed seed
CROSS JOIN public.facility facility
ON CONFLICT (facility_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  age_min = EXCLUDED.age_min,
  default_sets = EXCLUDED.default_sets,
  default_reps = EXCLUDED.default_reps,
  default_work_seconds = EXCLUDED.default_work_seconds,
  default_rest_seconds = EXCLUDED.default_rest_seconds,
  est_seconds_per_set = EXCLUDED.est_seconds_per_set,
  is_published = TRUE,
  visibility = 'facility',
  card_summary = EXCLUDED.card_summary,
  coach_language = EXCLUDED.coach_language,
  athlete_language = EXCLUDED.athlete_language,
  movement_family = EXCLUDED.movement_family,
  primary_phase_key = EXCLUDED.primary_phase_key,
  phase_subrole = EXCLUDED.phase_subrole,
  primary_order_slot = EXCLUDED.primary_order_slot,
  movement_requirements = EXCLUDED.movement_requirements,
  coaching_execution = EXCLUDED.coaching_execution,
  pairing_logic = EXCLUDED.pairing_logic,
  media_library = EXCLUDED.media_library,
  why_publish_ready = TRUE,
  participant_structure = EXCLUDED.participant_structure,
  programming_kind = 'exercise',
  updated_at = now();

DELETE FROM coaching.exercise_tag tag
USING coaching.exercise exercise, accelerator_exercise_card_seed seed
WHERE tag.exercise_id = exercise.id AND exercise.slug = seed.slug
  AND tag.facet_type IN ('tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region');

INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT exercise.id, 'tenet', facet.id, (tag->>'weight')::int
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
CROSS JOIN LATERAL jsonb_array_elements(seed.payload->'tenets') tag
JOIN coaching.tenet facet ON facet.key = tag->>'key'
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT exercise.id, 'methodology', facet.id, (tag->>'weight')::int
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
CROSS JOIN LATERAL jsonb_array_elements(seed.payload->'methodologies') tag
JOIN coaching.methodology facet ON facet.key = tag->>'key'
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT exercise.id, 'physiology', facet.id, (tag->>'weight')::int
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
CROSS JOIN LATERAL jsonb_array_elements(seed.payload->'physiology') tag
JOIN coaching.physiological_emphasis facet ON facet.key = tag->>'key'
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT exercise.id, 'pattern', facet.id, (tag->>'weight')::int
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
CROSS JOIN LATERAL jsonb_array_elements(seed.payload->'patterns') tag
JOIN coaching.movement_pattern facet ON facet.key = tag->>'key'
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT exercise.id, 'equipment', facet.id, (tag->>'weight')::int
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
CROSS JOIN LATERAL jsonb_array_elements(seed.payload->'equipment') tag
JOIN coaching.equipment facet ON facet.key = tag->>'key'
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT exercise.id, 'body_region', facet.id, (tag->>'weight')::int
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
CROSS JOIN LATERAL jsonb_array_elements(seed.payload->'body_regions') tag
JOIN coaching.body_region facet ON facet.key = tag->>'key'
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling, notes
)
SELECT exercise.id, phase.id,
  (seed.payload->'phaseProfile'->>'fit_weight')::int,
  seed.payload->'phaseProfile'->>'role', seed.payload->>'slot', slot.order_index,
  (seed.payload->'phaseProfile'->>'freshness_required')::boolean,
  (seed.payload->'phaseProfile'->>'fatigue_sensitivity')::int,
  (seed.payload->'phaseProfile'->>'fatigue_cost')::int,
  (seed.payload->'phaseProfile'->>'technical_complexity')::int,
  (seed.payload->'phaseProfile'->>'impact_level')::int,
  seed.payload->'phaseProfile'->>'intensity_ceiling',
  'Exact Athleticism Accelerator exercise-card association.'
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
JOIN coaching.session_phase phase ON phase.key = seed.payload->>'primaryPhaseKey'
JOIN coaching.phase_order_slot slot ON slot.key = seed.payload->>'slot' AND slot.phase_id = phase.id
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  fit_weight = EXCLUDED.fit_weight, role = EXCLUDED.role, order_slot = EXCLUDED.order_slot,
  order_index = EXCLUDED.order_index, freshness_required = EXCLUDED.freshness_required,
  fatigue_sensitivity = EXCLUDED.fatigue_sensitivity, fatigue_cost = EXCLUDED.fatigue_cost,
  technical_complexity = EXCLUDED.technical_complexity, impact_level = EXCLUDED.impact_level,
  intensity_ceiling = EXCLUDED.intensity_ceiling, notes = EXCLUDED.notes;

INSERT INTO coaching.exercise_dosage_profile (
  exercise_id, profile_name, is_default, volume_unit, default_sets, default_reps,
  default_work_seconds, default_rest_seconds, est_seconds_per_set, default_rpe_min, default_rpe_max
)
SELECT exercise.id, 'Default', TRUE,
  seed.payload->'dosage'->>'volume_unit',
  (seed.payload->'dosage'->>'default_sets')::int,
  (seed.payload->'dosage'->>'default_reps')::int,
  NULLIF(seed.payload->'dosage'->>'default_work_seconds', '')::int,
  (seed.payload->'dosage'->>'default_rest_seconds')::int,
  (seed.payload->'dosage'->>'est_seconds_per_set')::int,
  (seed.payload->'dosage'->>'default_rpe_min')::int,
  (seed.payload->'dosage'->>'default_rpe_max')::int
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
ON CONFLICT (exercise_id, profile_name) DO UPDATE SET
  is_default = TRUE, volume_unit = EXCLUDED.volume_unit, default_sets = EXCLUDED.default_sets,
  default_reps = EXCLUDED.default_reps, default_work_seconds = EXCLUDED.default_work_seconds,
  default_rest_seconds = EXCLUDED.default_rest_seconds, est_seconds_per_set = EXCLUDED.est_seconds_per_set,
  default_rpe_min = EXCLUDED.default_rpe_min, default_rpe_max = EXCLUDED.default_rpe_max;

INSERT INTO coaching.exercise_scaling_profile (
  exercise_id, cohort_key, label, scale_direction, load_guidance, gender_specific_notes
)
SELECT exercise.id, cohort.key, replace(cohort.key, '_', ' '), 'baseline',
  seed.payload->'scaling'->>cohort.key,
  CASE WHEN cohort.key = 'adult_beginner' THEN seed.payload->>'genderSpecificNotes' ELSE NULL END
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
CROSS JOIN (VALUES
  ('youth_beginner'), ('youth_intermediate'), ('teen'), ('adult_beginner'),
  ('adult_advanced'), ('older_adult'), ('pregnancy_postpartum')
) cohort(key)
ON CONFLICT (exercise_id, cohort_key) WHERE cohort_key IS NOT NULL DO UPDATE SET
  label = EXCLUDED.label, scale_direction = EXCLUDED.scale_direction,
  load_guidance = EXCLUDED.load_guidance, gender_specific_notes = EXCLUDED.gender_specific_notes;

INSERT INTO coaching.exercise_safety_profile (
  exercise_id, risk_level, impact_level, requires_spotting, requires_coach_supervision,
  readiness_checks, stop_signs, contraindications, common_substitutions
)
SELECT exercise.id,
  (seed.payload->'safety'->>'risk_level')::int,
  (seed.payload->'safety'->>'impact_level')::int,
  (seed.payload->'safety'->>'requires_spotting')::boolean,
  seed.payload->'safety'->>'requires_coach_supervision',
  ARRAY(SELECT jsonb_array_elements_text(seed.payload->'safety'->'readiness_checks')),
  ARRAY(SELECT jsonb_array_elements_text(seed.payload->'coachingExecution'->'stop_signs')),
  ARRAY(SELECT jsonb_array_elements_text(seed.payload->'safety'->'contraindications')),
  ARRAY(SELECT jsonb_array_elements_text(seed.payload->'safety'->'common_substitutions'))
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
ON CONFLICT (exercise_id) DO UPDATE SET
  risk_level = EXCLUDED.risk_level, impact_level = EXCLUDED.impact_level,
  requires_spotting = EXCLUDED.requires_spotting,
  requires_coach_supervision = EXCLUDED.requires_coach_supervision,
  readiness_checks = EXCLUDED.readiness_checks, stop_signs = EXCLUDED.stop_signs,
  contraindications = EXCLUDED.contraindications, common_substitutions = EXCLUDED.common_substitutions;

INSERT INTO coaching.exercise_regimen_rule (
  exercise_id, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures,
  counts_as_high_intensity, counts_as_high_impact, counts_as_neural, counts_as_tissue_stress, counts_as_conditioning
)
SELECT exercise.id,
  (seed.payload->'regimen'->>'can_be_daily')::boolean,
  (seed.payload->'regimen'->>'weekly_max_frequency')::int,
  (seed.payload->'regimen'->>'minimum_hours_between_hard_exposures')::int,
  (seed.payload->'regimen'->>'counts_as_high_intensity')::boolean,
  (seed.payload->'regimen'->>'counts_as_high_impact')::boolean,
  (seed.payload->'regimen'->>'counts_as_neural')::boolean,
  (seed.payload->'regimen'->>'counts_as_tissue_stress')::boolean,
  (seed.payload->'regimen'->>'counts_as_conditioning')::boolean
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
ON CONFLICT (exercise_id) DO UPDATE SET
  can_be_daily = EXCLUDED.can_be_daily, weekly_max_frequency = EXCLUDED.weekly_max_frequency,
  minimum_hours_between_hard_exposures = EXCLUDED.minimum_hours_between_hard_exposures,
  counts_as_high_intensity = EXCLUDED.counts_as_high_intensity,
  counts_as_high_impact = EXCLUDED.counts_as_high_impact, counts_as_neural = EXCLUDED.counts_as_neural,
  counts_as_tissue_stress = EXCLUDED.counts_as_tissue_stress,
  counts_as_conditioning = EXCLUDED.counts_as_conditioning;

INSERT INTO coaching.exercise_difficulty_profile (
  exercise_id, technical, load, complexity, overall,
  recommended_age_min, recommended_age_max, attention_demand, notes, source
)
SELECT exercise.id,
  (seed.payload->'difficultyProfile'->>'technical')::int,
  (seed.payload->'difficultyProfile'->>'load')::int,
  (seed.payload->'difficultyProfile'->>'complexity')::int,
  (seed.payload->'difficultyProfile'->>'overall')::int,
  (seed.payload->'difficultyProfile'->>'recommended_age_min')::int,
  NULLIF(seed.payload->'difficultyProfile'->>'recommended_age_max', '')::int,
  seed.payload->'difficultyProfile'->>'attention_demand',
  seed.payload->'difficultyProfile'->>'notes', 'authored'
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
ON CONFLICT (exercise_id) DO UPDATE SET
  technical = EXCLUDED.technical, load = EXCLUDED.load, complexity = EXCLUDED.complexity,
  overall = EXCLUDED.overall, recommended_age_min = EXCLUDED.recommended_age_min,
  recommended_age_max = EXCLUDED.recommended_age_max, attention_demand = EXCLUDED.attention_demand,
  notes = EXCLUDED.notes, source = EXCLUDED.source, updated_at = now();

INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_works, why_it_matters, why_it_goes_here,
  programming_guidance, common_misuse, scaling_guidance
)
SELECT 'exercise', exercise.slug, exercise.id, exercise.name, exercise.card_summary,
  seed.payload->>'description', seed.payload->>'whyItWorks', seed.payload->>'cardSummary',
  seed.payload->>'whyItGoesHere', seed.payload->>'bestPlacement',
  seed.payload->>'commonMisuse', seed.payload->>'scalingGuidance'
FROM accelerator_exercise_card_seed seed
JOIN coaching.exercise exercise ON exercise.slug = seed.slug
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title, short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is, why_it_works = EXCLUDED.why_it_works,
  why_it_matters = EXCLUDED.why_it_matters, why_it_goes_here = EXCLUDED.why_it_goes_here,
  programming_guidance = EXCLUDED.programming_guidance, common_misuse = EXCLUDED.common_misuse,
  scaling_guidance = EXCLUDED.scaling_guidance, is_published = TRUE, updated_at = now();
`

const manifestContents = `${JSON.stringify(manifest, null, 2)}\n`

function writeOrCheckGeneratedFiles(checkOnly = false) {
  if (checkOnly) {
    const stale = []
    if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, 'utf8') !== manifestContents) stale.push(manifestPath)
    if (!fs.existsSync(migrationPath) || fs.readFileSync(migrationPath, 'utf8') !== sql) stale.push(migrationPath)
    if (stale.length) throw new Error(`Generated Accelerator library files are stale:\n${stale.join('\n')}`)
    console.log(`Verified ${manifest.prescriptionCount} prescriptions / ${manifest.associationCount} card associations (${manifest.newCardCount} new, ${manifest.reusedCardCount} reused).`)
    return
  }
  fs.writeFileSync(manifestPath, manifestContents)
  fs.writeFileSync(migrationPath, sql)
  console.log(`Wrote ${manifest.associationCount} associations (${manifest.newCardCount} new cards, ${manifest.reusedCardCount} reused cards)`)
  console.log(`Wrote ${manifestPath}`)
  console.log(`Wrote ${migrationPath}`)
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) writeOrCheckGeneratedFiles(process.argv.includes('--check'))

export { accessPrepareRoutine, associations, buildCard, donorScore, donors, manifest, manifestContents, newCards, selectDonor, sql, writeOrCheckGeneratedFiles }
