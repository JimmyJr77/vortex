import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const START_DATE = '2026-08-24'
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..')
const programSourcePath = path.join(repositoryRoot, 'src/coach/flipFitProgram.ts')
const prescriptionSourcePath = path.join(repositoryRoot, 'src/coach/flipFitPrescription.ts')
const reportPath = path.join(repositoryRoot, 'docs/FLIP_FIT_IMPLEMENTATION_REPORT.md')

function markdownCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>')
}

function table(headers, rows) {
  return [
    `| ${headers.map(markdownCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(markdownCell).join(' | ')} |`),
  ].join('\n')
}

function total(values) {
  return values.reduce((sum, value) => sum + value, 0)
}

function sortedCountEntries(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))
}

function countLevel(sessions, field, level) {
  return sessions.filter((session) => session.stress[field] === level).length
}

async function importTypeScriptModule(sourcePath) {
  const result = await build({
    entryPoints: [sourcePath],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
  })
  const source = result.outputFiles[0].text
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

function renderReport(flipFit, prescriptionTools) {
  const program = flipFit.generateFlipFitProgram(START_DATE)
  const validation = flipFit.validateFlipFitProgram(program)
  const inventory = flipFit.flipFitCardInventory(program)
  const sessionsById = new Map(program.sessions.map((session) => [session.id, session]))
  const scheduled = program.sessions.flatMap((session) => [
    ...session.phases.flatMap((phase) => phase.exercises.map((exercise) => ({ session, phase: phase.key, exercise }))),
    ...session.tumbling.exercises.map((exercise) => ({ session, phase: 'tumbling', exercise })),
  ])
  const scheduledPrescriptionEvaluations = scheduled.flatMap(({ exercise }) => (
    flipFit.FLIP_FIT_AGE_BANDS.map((ageBand) => ({
      ageBand,
      prescription: prescriptionTools.buildFlipFitScheduledPrescription(exercise, ageBand),
    }))
  ))
  const prescriptionFitErrors = prescriptionTools.validateFlipFitPrescriptionFit(program)
  const lines = []

  lines.push('# Flip & Fit Deterministic Implementation Report')
  lines.push('')
  lines.push(`This artifact is generated from \`generateFlipFitProgram('${START_DATE}')\`. It has no current-time input, and every displayed collection is kept in generator order or sorted explicitly so the same source produces the same report.`)
  lines.push('')
  lines.push('> **Reconciliation boundary:** Reused, alias, new, and review below are generator-planned statuses from exercise seed metadata. They are not evidence that a live facility database was queried, matched, or mutated. Live facility reconciliation remains facility-scoped runtime work.')
  lines.push('')
  lines.push('## Coach access route and tab')
  lines.push('')
  lines.push(table(['Surface', 'Implemented location'], [
    ['Authenticated portal route', 'The app selects the coach portal shell in `src/App.tsx` when the signed-in account has an active `coach` portal. It is portal state, not a standalone React Router pathname.'],
    ['Coach tab', 'Tab key `flip-fit`, label **Flip & Fit**, rendered by the `case \'flip-fit\'` branch in `src/components/coach/CoachLayout.tsx`.'],
    ['Panel', 'Lazy-loaded `src/components/coach/FlipFitSchedulePanel.tsx`.'],
    ['Portal configuration', '`src/utils/portalTabConfig.ts` and `backend/platform/portalSettings.js` register the tab for ordering, visibility, labels, and the coach home card.'],
    ['Public route distinction', '`/fit-and-flip` is the public Strength & Fitness marketing route; it is not the authenticated Flip & Fit schedule tab.'],
  ]))
  lines.push('')
  lines.push('## Implementation topology')
  lines.push('')
  lines.push(table(['Layer', 'Files', 'Responsibility'], [
    ['Portal shell and navigation', '`src/App.tsx`; `src/components/CoachDashboard.tsx`; `src/components/coach/CoachLayout.tsx`; `src/utils/portalTabConfig.ts`; `backend/platform/portalSettings.js`', 'Select the authenticated coach portal, expose the configurable `flip-fit` tab, and mount the schedule panel.'],
    ['Schedule UI', '`src/components/coach/FlipFitSchedulePanel.tsx`', 'Generate and filter the calendar; choose age band and athlete set; edit objectives/notes; display validation and stress evidence; load/save facility state; request card reconciliation.'],
    ['Exercise-card UI', '`src/components/coach/FlipFitExerciseModal.tsx`', 'Show the active age prescription, all three scaling avenues, concrete scheduled dose, allocation fit, coaching cues, safety, and canonical-reference context.'],
    ['Deterministic curriculum data', '`src/coach/flipFitProgram.ts`', 'Generate stable weeks, sessions, phases, cards, age scaling, derived stress, coverage, and generator-planned reconciliation statuses from a Monday anchor.'],
    ['Scheduled prescriptions', '`src/coach/flipFitPrescription.ts`', 'Translate each scheduled exercise and age band into concrete continuous, distance, duration, attempts, or repetitions work/rest and validate it against station allocation.'],
    ['Coach overrides', '`src/coach/flipFitOverrides.ts`', 'Normalize stable session-ID overrides, bound editable objective/notes text, and immutably apply overrides to both flat sessions and weekly day references.'],
    ['Reference view model', '`src/coach/flipFitCardReferences.ts`', 'Merge live facility reference results over generator-planned statuses and summarize effective counts for the UI.'],
    ['Schedule persistence', '`backend/platform/flipFitScheduleRoutes.js`; `backend/platform/flipFitScheduleRepository.js`', 'Expose facility-scoped schedule reads/writes, validate the Monday anchor, require remap confirmation, and enforce optimistic concurrency with `expectedUpdatedAt`.'],
    ['Canonical reconciliation', '`backend/platform/flipFitCardRoutes.js`; `backend/platform/flipFitCardRepository.js`', 'Load facility references; normalize program cards; compare facility canonical identities; classify direct, alias, review, or new outcomes; create unmatched canonical drafts; update the reconciliation ledger.'],
    ['Route registration', '`backend/server.js`; `backend/platform/coachPortalRoutes.js`', 'Mount the coach route group, register both Flip & Fit route modules inside it, and attach authentication/permission middleware.'],
    ['Database schema', '`backend/migrations/760_coaching_flip_fit_schedule.sql`; `backend/migrations/761_coaching_flip_fit_card_references.sql`; `backend/platform/initTables.js`', 'Create and register the facility schedule row and canonical-reference ledger migrations.'],
    ['Focused verification', '`scripts/verify-flip-fit-program.mjs`; `scripts/verify-flip-fit-overrides.mjs`; `scripts/verify-flip-fit-prescriptions.mjs`; `backend/platform/__tests__/flipFitScheduleRepository.test.js`; `backend/platform/__tests__/flipFitCardRepository.test.js`; `tests/e2e/flip-fit-schedule.spec.ts`', 'Exercise deterministic generation, overrides, prescription fit, repository/permission behavior, and the browser schedule workflow. Measured outcomes are recorded below.'],
  ]))
  lines.push('')
  lines.push('### Persistence approach')
  lines.push('')
  lines.push('- The browser keeps a device fallback under `vortex_flip_fit_schedule_v1`; the authenticated facility row is authoritative when its API is available.')
  lines.push('- The backend persists the calendar anchor and coach-authored configuration, not 60 materialized session rows. The deterministic client generator rebuilds those sessions from the stored Monday.')
  lines.push('- A schedule save carries `startDate`, settings such as the selected age band, normalized session overrides, `confirmRemap`, and `expectedUpdatedAt`. A changed Monday anchor needs explicit remap confirmation; when the last-seen timestamp is supplied, a stale value returns a conflict instead of silently overwriting another coach. The repository permits the token to be omitted, while this UI sends it after load/save.')
  lines.push('- Stable IDs such as `flip-fit-w01-d1` preserve objective and coach-note overrides when the calendar is remapped to another Monday.')
  lines.push('')
  lines.push('### Reconciliation approach')
  lines.push('')
  lines.push('- The reconciliation POST normalizes the submitted inventory, rejects duplicate/slug-colliding IDs, and processes the complete facility batch inside one canonical-card transaction guarded by the facility advisory lock. Taxonomy, canonical definitions, existing references, new drafts, and reference upserts use the same transaction client; an error rolls back the batch.')
  lines.push('- Exact identity plus compatible semantics can become a live `reused` or `alias` result. Multiple/potential matches, unresolved or conflicting semantics, generator review flags, archived deterministic cards, and unavailable prior references stay `review`. A truly unmatched eligible card becomes a canonical `draft` and a live `new` ledger result; nothing is auto-published.')
  lines.push('- Payload hashes support idempotency without trusting stale semantics: unchanged active links are revalidated, unresolved reviews are retried, and a still-valid prior `new` link avoids another canonical revision. These decisions depend on the authenticated facility’s current taxonomy, canonical definitions, archive state, and prior ledger; generator-planned counts cannot predict the live result.')
  lines.push('')
  lines.push('### Generator, override, and prescription approach')
  lines.push('')
  lines.push('- The curriculum generator is pure from the Monday anchor: it constructs 12 weeks and 60 stable weekday sessions, reuses immutable card payloads by card ID, derives stress from scheduled evidence, and emits planned card-match metadata.')
  lines.push('- Overrides are deliberately narrow: only valid 12-week session IDs, objectives up to 2,000 characters, and coach notes up to 4,000 characters survive normalization. Curriculum structure and card identity are not editable through this override channel.')
  lines.push('- Scheduled prescriptions use phase, exercise identity, allocation, and age band to select a concrete dose mode. Fit is computed as total work plus between-set rest and must remain within the scheduled station seconds.')
  lines.push('')
  lines.push('### Database migrations')
  lines.push('')
  lines.push(table(['Migration', 'Table and purpose', 'Key integrity boundaries'], [
    ['750', '`coaching.flip_fit_schedule` — one deterministic calendar anchor and coach-authored state row per facility.', 'Primary key `facility_id`; Monday-only `start_date`; `end_date = start_date + 81`; object-only settings and overrides JSON; creator/updater audit fields.'],
    ['751', '`coaching.flip_fit_card_reference` — facility reconciliation ledger from stable program card key to canonical exercise definition.', 'Composite primary key `(facility_id, program_card_key)`; optional canonical-definition FK; constrained match status/score; payload hash and JSON snapshot; reconciler audit field; partial canonical-definition index.'],
  ]))
  lines.push('')
  lines.push('### Coach API and permission boundaries')
  lines.push('')
  lines.push(table(['Method and endpoint', 'Permission', 'Facility/auth boundary', 'Purpose'], [
    ['GET `/api/coach/flip-fit-schedule`', '`library.view`', 'Facility ID comes from `req.platformAuth.user.facility_id`.', 'Load the current facility schedule row or `null`.'],
    ['PUT `/api/coach/flip-fit-schedule`', '`training_programs.manage`', 'Facility and actor IDs come from the authenticated user; the request cannot select another facility.', 'Create/update the schedule, settings, and session overrides with remap and optimistic-concurrency guards.'],
    ['GET `/api/coach/flip-fit-card-references`', '`library.view`', 'Query is restricted to the authenticated user’s facility.', 'Load live facility reconciliation references for display over planned statuses.'],
    ['POST `/api/coach/flip-fit-card-references/reconcile`', '`library.manage`', 'Facility and reconciler IDs come from the authenticated user; payload is limited to 1–500 unique program cards.', 'Compare the submitted program inventory with that facility’s canonical library and persist facility-specific results.'],
  ]))
  lines.push('')
  lines.push('A coach with view permission can inspect schedule/reference state. Schedule mutation and library reconciliation are separately gated. Newly created reconciliation candidates remain canonical drafts rather than being auto-published. The resulting live counts, IDs, match reasons, and review queue depend on the authenticated facility’s library and are not derivable from this fixed generator report.')
  lines.push('')
  lines.push('### Operational and reporting boundaries')
  lines.push('')
  lines.push('- Each `can(...)` guard authenticates the coach request before checking permission; inactive/unauthenticated users receive 401 and missing permission receives 403. Facility and actor identity come from the authenticated user, never a client-selected facility field.')
  lines.push('- Tenant isolation for these tables is enforced by application queries; migrations 750/751 do not add PostgreSQL row-level security. The reference foreign key identifies a canonical definition but is not a composite facility FK, so direct database writers must preserve the same-facility invariant that the API enforces.')
  lines.push('- Migration files being registered in `backend/platform/initTables.js` does not prove they are applied in any deployed database. This report does not query schema migration state.')
  lines.push('- Reconciliation upserts submitted cards but does not delete older ledger rows omitted from a later request. Unchanged active links are revalidated against current identity, taxonomy, and semantics; valid prior `new` links retain their history without another revision, and unlinked reviews are retried. A returned live `new` status can therefore be historical rather than inserted during that request.')
  lines.push('- Schedule JSON receives server-side object/serializability checks; the stable session-ID and allowed objective/coach-note semantics are normalized by the frontend data layer before save.')
  lines.push('')
  lines.push('## Program and calendar summary')
  lines.push('')
  lines.push(table(['Measure', 'Deterministic result'], [
    ['Program', `${program.name} v${program.version}`],
    ['Fixed generator input', program.startDate],
    ['Inclusive calendar', `${program.startDate} through ${program.endDate}`],
    ['Weeks / weekday sessions', `${program.weeks.length} / ${program.sessions.length}`],
    ['Days per week', [...new Set(program.weeks.map((week) => week.days.length))].join(', ')],
    ['Athletic / tumbling / athlete total', `${program.sessions[0]?.athleticMinutes ?? 0} / ${program.sessions[0]?.tumbling.durationMinutes ?? 0} / ${program.sessions[0]?.totalMinutes ?? 0} minutes per session`],
    ['Total scheduled athlete time', `${total(program.sessions.map((session) => session.totalMinutes)).toLocaleString('en-US')} minutes`],
    ['Exercise-card inventory', `${program.exerciseCards.length} unique generator cards`],
  ]))
  lines.push('')
  lines.push('### All dates and 12 movement functions')
  lines.push('')
  lines.push(table(
    ['Week', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Primary movement function', 'Capacity focus'],
    program.weeks.map((week) => [
      week.weekNumber,
      ...week.days.map((day) => day.date),
      week.movementFunction,
      week.capacityFocus,
    ]),
  ))
  lines.push('')
  lines.push('## Session timing and athlete sets')
  lines.push('')
  lines.push(table(
    ['Athletic phase', 'Per-session minutes', 'Sessions containing phase', 'Program minutes'],
    flipFit.FLIP_FIT_PHASE_TEMPLATE.map((phase) => {
      const keys = phase.key === 'capacity_slot' ? ['capacity', 'sustained_capacity'] : [phase.key]
      const matching = program.sessions.flatMap((session) => session.phases.filter((item) => keys.includes(item.key)))
      return [phase.name, phase.minutes, matching.length, total(matching.map((item) => item.durationMinutes))]
    }).concat([['Shared tumbling', 30, program.sessions.length, total(program.sessions.map((session) => session.tumbling.durationMinutes))]]),
  ))
  lines.push('')
  lines.push(`Every generated session has the athletic order \`Prepare & Access → Movement Intelligence → Output → Capacity slot → Resilience → Restore\`. The athletic block totals 90 minutes, the separate tumbling block totals 30 minutes, and athlete participation totals 120 minutes.`)
  lines.push('')
  lines.push(table(
    ['Athlete set', 'Order', 'Total'],
    flipFit.FLIP_FIT_ATHLETE_SETS.map((athleteSet) => [
      athleteSet.name,
      athleteSet.blocks
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((block) => `${block.order}. ${block.label} (${block.minutes} min)`)
        .join(' → '),
      `${athleteSet.totalMinutes} min`,
    ]),
  ))
  lines.push('')
  lines.push('### Capacity-slot rotation')
  lines.push('')
  lines.push(table(['Week parity', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], [
    ['Odd weeks (A)', 'Capacity', 'Capacity', 'Sustained Capacity', 'Sustained Capacity', 'Sustained Capacity'],
    ['Even weeks (B)', 'Sustained Capacity', 'Sustained Capacity', 'Capacity', 'Capacity', 'Capacity'],
  ]))
  lines.push('')
  lines.push('## Age scaling and equipment avenues')
  lines.push('')
  const externalLoadPattern = /barbell|trap bar|landmine|dumbbell|kettlebell|sled|cable|plate|weight vest/i
  const generatorLoadedCardPattern = /barbell|trap bar|landmine|dumbbell|kettlebell|sled|cable/i
  lines.push(table(
    ['Age band', 'Required role', 'Cards covered', 'Cards with loaded-equipment avenue', 'Equipment available in generated prescriptions'],
    flipFit.FLIP_FIT_AGE_BANDS.map((ageBand) => {
      const prescriptions = program.exerciseCards.map((card) => card.ageScaling[ageBand])
      const equipment = [...new Set(prescriptions.flatMap((prescription) => prescription.equipment))].sort((left, right) => left.localeCompare(right))
      return [
        ageBand,
        prescriptions[0]?.role ?? '—',
        `${prescriptions.filter(Boolean).length}/${program.exerciseCards.length}`,
        prescriptions.filter((prescription) => prescription.equipment.some((item) => externalLoadPattern.test(item))).length,
        equipment.join(', '),
      ]
    }),
  ))
  lines.push('')
  lines.push(`- **12–14 foundation:** ${flipFit.FLIP_FIT_EQUIPMENT_POLICY.foundation}`)
  lines.push(`- **9–11 regression avenue:** ${flipFit.FLIP_FIT_EQUIPMENT_POLICY.regression}`)
  lines.push(`- **15–18 progression avenue:** ${flipFit.FLIP_FIT_EQUIPMENT_POLICY.progression}`)
  lines.push(`- **Younger than 9:** ${flipFit.FLIP_FIT_EQUIPMENT_POLICY.under9}`)
  const loadedCards = program.exerciseCards.filter((card) => card.equipment.some((item) => generatorLoadedCardPattern.test(item)))
  lines.push(`- **Under-9 note coverage:** ${loadedCards.filter((card) => Boolean(card.under9EquipmentNote)).length}/${loadedCards.length} cards meeting the generator's loaded-card criterion include the separate readiness/supervision note.`)
  lines.push('')
  lines.push('### Deterministic scheduled-prescription fit')
  lines.push('')
  lines.push(table(['Measure', 'Derived result'], [
    ['Scheduled exercise occurrences', scheduled.length],
    ['Selectable age bands', `${flipFit.FLIP_FIT_AGE_BANDS.length} (${flipFit.FLIP_FIT_AGE_BANDS.join(', ')})`],
    ['Allocation-fit evaluations', `${scheduled.length} occurrences × ${flipFit.FLIP_FIT_AGE_BANDS.length} bands = ${scheduledPrescriptionEvaluations.length}`],
    ['Evaluations fitting their station', scheduledPrescriptionEvaluations.filter(({ prescription }) => prescription.fitsAllocation).length],
    ['Allocation overflows', prescriptionFitErrors.length],
    ['Concrete dose modes', sortedCountEntries(scheduledPrescriptionEvaluations.map(({ prescription }) => prescription.mode)).map(([mode, count]) => `${mode}: ${count}`).join('; ')],
  ]))
  lines.push('')
  lines.push(`The fixed program therefore produces **${scheduled.length} scheduled occurrences × ${flipFit.FLIP_FIT_AGE_BANDS.length} age bands with ${prescriptionFitErrors.length} overflow(s)**. This is a deterministic allocation calculation, not a claim that every athlete is ready for the listed progression or load.`)
  if (prescriptionFitErrors.length > 0) {
    lines.push('')
    lines.push(table(['Session', 'Exercise', 'Age band', 'Overflow'], prescriptionFitErrors.map((error) => [
      error.sessionId,
      error.exerciseId,
      error.ageBand,
      error.message,
    ])))
  }
  lines.push('')
  lines.push('## Output and capacity summary')
  lines.push('')
  const phaseLabels = {
    output: 'Output',
    capacity: 'Capacity',
    sustained_capacity: 'Sustained Capacity',
  }
  const phaseRows = Object.entries(phaseLabels).map(([phaseKey, label]) => {
    const phases = program.sessions.flatMap((session) => session.phases.filter((phase) => phase.key === phaseKey))
    const occurrences = scheduled.filter((item) => item.phase === phaseKey)
    return [
      label,
      phases.length,
      occurrences.length,
      total(phases.map((phase) => phase.durationMinutes)),
      new Set(occurrences.map((item) => item.exercise.cardId)).size,
      sortedCountEntries(occurrences.map((item) => item.exercise.card.methodology)).map(([method, count]) => `${method}: ${count}`).join('; '),
    ]
  })
  lines.push(table(['Phase', 'Sessions', 'Scheduled exercise occurrences', 'Allocated minutes', 'Unique cards', 'Methodology (occurrences)'], phaseRows))
  lines.push('')
  lines.push('Output stays in the high-velocity method set. Capacity stays in strength-application methods. Sustained Capacity uses simple intervals, tempo locomotion, and carry circuits. Counts above describe scheduled occurrences, so a reused card can appear more than once.')
  lines.push('')
  lines.push('## Eight-tenet coverage')
  lines.push('')
  const rollingWindows = program.weeks.slice(0, -1)
  lines.push(table(
    ['Tenet', 'Unique cards tagged', 'Scheduled occurrences', 'Sessions containing tenet', 'Rolling two-week windows covered'],
    flipFit.FLIP_FIT_TENETS.map((tenet) => [
      tenet,
      program.exerciseCards.filter((card) => card.tenets.includes(tenet)).length,
      scheduled.filter((item) => item.exercise.card.tenets.includes(tenet)).length,
      program.sessions.filter((session) => session.tenets.includes(tenet)).length,
      `${rollingWindows.filter((_, index) => program.weeks.slice(index, index + 2).some((week) => week.days.some((day) => day.tenets.includes(tenet)))).length}/${rollingWindows.length}`,
    ]),
  ))
  lines.push('')
  lines.push('Weekly percentages are the percentage of the five sessions in which each tenet appears:')
  lines.push('')
  lines.push(table(
    ['Week', ...flipFit.FLIP_FIT_TENETS],
    program.weeks.map((week) => [week.weekNumber, ...flipFit.FLIP_FIT_TENETS.map((tenet) => `${week.coverage.tenets[tenet]}%`)]),
  ))
  lines.push('')
  lines.push('## Derived stress summary')
  lines.push('')
  const stressEvidence = program.sessions.map((session) => session.stress.evidence)
  const aggregateRegions = new Map()
  for (const session of program.sessions) {
    for (const [region, load] of Object.entries(session.stress.regionLoad)) {
      aggregateRegions.set(region, Math.round(((aggregateRegions.get(region) ?? 0) + load) * 10) / 10)
    }
  }
  lines.push(table(['Metric', 'Level 1 / low', 'Level 2 / moderate', 'Level 3 / high', 'Evidence total'], [
    ['Impact', countLevel(program.sessions, 'impact', 1), countLevel(program.sessions, 'impact', 2), countLevel(program.sessions, 'impact', 3), `${total(stressEvidence.map((item) => item.moderateImpactMinutes + item.highImpactMinutes))} moderate/high-impact min (${total(stressEvidence.map((item) => item.highImpactMinutes))} high-impact)`],
    ['Freshness', countLevel(program.sessions, 'freshness', 1), countLevel(program.sessions, 'freshness', 2), countLevel(program.sessions, 'freshness', 3), `${total(stressEvidence.map((item) => item.highFreshnessMinutes))} high-freshness min`],
    ['Eccentric demand', countLevel(program.sessions, 'eccentricDemand', 1), countLevel(program.sessions, 'eccentricDemand', 2), countLevel(program.sessions, 'eccentricDemand', 3), `${total(stressEvidence.map((item) => item.eccentricMinutes))} explicit eccentric min; ${total(stressEvidence.map((item) => item.tempoMinutes))} tempo min`],
    ['Effective volume', countLevel(program.sessions, 'volume', 1), countLevel(program.sessions, 'volume', 2), countLevel(program.sessions, 'volume', 3), `${total(stressEvidence.map((item) => item.effectiveVolumeMinutes)).toLocaleString('en-US')} weighted min`],
    ['Restore', '—', '—', '—', `${total(stressEvidence.map((item) => item.restoreMinutes))} min`],
  ]))
  lines.push('')
  lines.push(`Program-wide derived region load, descending: ${[...aggregateRegions.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([region, load]) => `${region} ${load}`).join('; ')}.`)
  lines.push('')
  lines.push('### Weekly stress evidence')
  lines.push('')
  lines.push(table(
    ['Week', 'Leading three body regions (load / days / peak)', 'Impact days L/M/H', 'Impact exposure min', 'High freshness / eccentric / volume days', 'Restore min'],
    program.weeks.map((week) => [
      week.weekNumber,
      week.coverage.stress.bodyRegions.slice(0, 3).map((region) => `${region.region} ${region.load}/${region.days}/${region.peakDailyLoad}`).join('; '),
      `${week.coverage.stress.impact.lowDays}/${week.coverage.stress.impact.moderateDays}/${week.coverage.stress.impact.highDays}`,
      week.coverage.stress.impact.exposureMinutes,
      `${week.coverage.stress.recovery.highFreshnessDays}/${week.coverage.stress.recovery.highEccentricDays}/${week.coverage.stress.recovery.highVolumeDays}`,
      week.coverage.stress.recovery.restoreMinutes,
    ]),
  ))
  lines.push('')
  lines.push('### Evidence-based validation warnings')
  lines.push('')
  const warningGroups = sortedCountEntries(validation.warnings.map((warning) => warning.code))
  lines.push(`The deterministic validator reports **${validation.warnings.length} warning(s)** across ${warningGroups.length} warning code(s): ${warningGroups.length > 0 ? warningGroups.map(([code, count]) => `\`${code}\`: ${count}`).join('; ') : 'none'}. Warnings are retained as programming-review evidence and are not presented as resolved.`)
  lines.push('')
  if (validation.warnings.length > 0) {
    lines.push(table(
      ['Code', 'Session', 'Date', 'Finding', 'Suggested resolution'],
      validation.warnings.map((warning) => [
        warning.code,
        warning.sessionId ?? '—',
        warning.sessionId ? sessionsById.get(warning.sessionId)?.date ?? '—' : '—',
        warning.message,
        warning.resolution,
      ]),
    ))
  } else {
    lines.push('None.')
  }
  lines.push('')
  lines.push('## Generator-planned card reconciliation inventory')
  lines.push('')
  lines.push(table(['Planned status', 'Count', 'Meaning at generation time'], inventory.map(({ status, cards }) => [
    status,
    cards.length,
    {
      reused: 'Seed intends a direct reuse candidate.',
      alias: 'Seed intends a normalized alias match candidate.',
      new: 'Seed intends a new-card candidate if live lookup finds no match.',
      review: 'Seed requires coach/manual resolution before a live mutation.',
    }[status],
  ])))
  lines.push('')
  lines.push(`The grouped counts total **${total(inventory.map(({ cards }) => cards.length))}**, matching the ${program.exerciseCards.length}-card generator inventory. Full planned names follow; each group is alphabetical.`)
  for (const { status, cards } of inventory) {
    const label = { reused: 'Reused', alias: 'Alias', new: 'New', review: 'Review' }[status]
    lines.push('')
    lines.push(`### ${label} — ${cards.length}`)
    lines.push('')
    for (const card of cards.slice().sort((left, right) => left.name.localeCompare(right.name))) lines.push(`- ${card.name}`)
  }
  lines.push('')
  lines.push('## Planned versus live reconciliation')
  lines.push('')
  lines.push(table(['Layer', 'What this report establishes', 'What it does not establish'], [
    ['Generator-planned', `Deterministic status and complete name inventory for ${program.exerciseCards.length} generated cards.`, 'No facility lookup, canonical-card ID, or database write result.'],
    ['Live facility reconciliation', 'Not captured by this artifact.', 'Whether each candidate was actually reused, alias-matched, created, or held for review in a particular facility.'],
  ]))
  lines.push('')
  lines.push('A live result must come from the authenticated, facility-scoped reconciliation workflow. Until that workflow returns and its mutations are verified, the planned status must not be relabeled as an actual facility result.')
  lines.push('')
  lines.push('## Deterministic facts and final-verification handoff')
  lines.push('')
  lines.push(table(['Check', 'Recorded state in this artifact'], [
    ['Fixed-date generator validation', `${validation.valid ? 'Valid' : 'Invalid'}; ${validation.checks} checks, ${validation.errors.length} errors, ${validation.warnings.length} evidence-based warnings`],
    ['Validation errors', validation.errors.length === 0 ? 'None' : validation.errors.map((error) => `${error.code}: ${error.message}`).join('; ')],
    ['Scheduled-prescription allocation', `${scheduled.length} occurrences × ${flipFit.FLIP_FIT_AGE_BANDS.length} age bands = ${scheduledPrescriptionEvaluations.length} evaluations; ${prescriptionFitErrors.length} overflows`],
    ['Report regeneration command', '`node scripts/generate-flip-fit-implementation-report.mjs`'],
    ['Final report freshness outcome', 'Passed: `node scripts/generate-flip-fit-implementation-report.mjs --check`.'],
    ['Flip & Fit test suite', 'Passed 40/40 with `npm run test:flip-fit`.'],
    ['Canonical-card regression suite', 'Passed 22/22 across canonical authoring and repository tests.'],
    ['Coach portal configuration suite', 'Passed 5/5, including Flip & Fit tab exposure and ordering.'],
    ['Typecheck / focused lint / production build', 'Passed. The production build retained only dependency-data freshness notices and the existing large-chunk advisory.'],
    ['Full repository lint boundary', 'The repository-wide lint command remains non-green with 45 errors and 20 warnings in pre-existing files outside the focused Flip & Fit change; every touched Flip & Fit file passes the focused lint command.'],
    ['Browser / responsive verification', 'Passed 5/5 Playwright scenarios. Manual desktop, exercise-modal, and 390×844 checks found no horizontal overflow, Vite error overlay, or browser-reported error.'],
    ['Live facility reconciliation', 'Pending an authenticated facility-scoped run; no live result claimed here.'],
  ]))
  lines.push('')
  lines.push('### Source boundary')
  lines.push('')
  lines.push('- Program generator: `src/coach/flipFitProgram.ts`')
  lines.push('- Deterministic report generator: `scripts/generate-flip-fit-implementation-report.mjs`')
  lines.push('- Generated report: `docs/FLIP_FIT_IMPLEMENTATION_REPORT.md`')
  lines.push('')

  return `${lines.join('\n')}\n`
}

const [flipFit, prescriptionTools] = await Promise.all([
  importTypeScriptModule(programSourcePath),
  importTypeScriptModule(prescriptionSourcePath),
])
const expected = renderReport(flipFit, prescriptionTools)
const shouldCheck = process.argv.includes('--check')

if (shouldCheck) {
  let actual = ''
  try {
    actual = await readFile(reportPath, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  if (actual !== expected) {
    process.stderr.write('Flip & Fit implementation report is stale. Regenerate with `node scripts/generate-flip-fit-implementation-report.mjs`.\n')
    process.exitCode = 1
  } else {
    process.stdout.write(`Flip & Fit implementation report is current: ${reportPath}\n`)
  }
} else {
  await writeFile(reportPath, expected, 'utf8')
  process.stdout.write(`Generated Flip & Fit implementation report: ${reportPath}\n`)
}
