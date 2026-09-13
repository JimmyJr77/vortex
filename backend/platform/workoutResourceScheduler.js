import { requiredEquipment, equipmentQuantityPerStation, canonicalSupervisionCapacity } from './canonicalExerciseSelection.js'
import { ProgrammingPrescriptionError, prescriptionInteger } from './canonicalProgrammingDose.js'
import { immutableProgrammingValue, programmingValueHash, allocateProgrammingComponentBudgets } from './workoutProgrammingRequest.js'
import { normalizeSessionComponentPlan } from './sessionComponentContract.js'

export const RESOURCE_SCHEDULER_VERSION = '1.0.0'
const error = (code, message, details) => { throw new ProgrammingPrescriptionError(code, message, details) }

/**
 * One reviewed exercise, complete group, explicit repeated waves. Each physical
 * station/lane has one active athlete; equipment is released after reset.
 * Other athletes wait/recover in their assigned wave, never do invented filler.
 */
export function scheduleCanonicalExercise({ activityId, card, profile, method, dose, request, component, startSeconds = 0 }) {
  if (typeof activityId !== 'string' || !activityId) error('invalid_activity_id', 'A stable activity ID is required')
  prescriptionInteger(startSeconds, 'startSeconds')
  const participants = request.athletes.flatMap((cohort) => Array.from({ length: cohort.athleteCount }, (_, i) => `${cohort.key}:${i + 1}`))
  const required = requiredEquipment(card, profile)
  const { equipment } = component
  const coachControl = request.components.find((entry) => entry.key === component.key)
  if (!coachControl) error('component_control_mismatch', 'Activity is not in the coach request')
  const expectedEquipment = normalizeSessionComponentPlan({ durationMinutes: request.logistics.totalBookedMinutes,
    equipment: { available: request.equipment.available, quantities: request.equipment.quantities, excluded: request.equipment.excluded },
    components: [{ key: component.key, budgetSeconds: 1, equipment: coachControl.equipment }],
  }).components[0].equipment
  if (programmingValueHash(equipment) !== programmingValueHash(expectedEquipment)) error('component_control_mismatch', 'Scheduler cannot change coach equipment controls or inventory')
  const quantitiesPerStation = Object.fromEntries(required.map((key) => [key,
    prescriptionInteger(equipmentQuantityPerStation(card, key), `${key} quantity per station`, 1, 1000),
  ]))
  for (const key of required) {
    if (!equipment.allowed.includes(key)) error('unavailable_equipment', `Required equipment is unavailable: ${key}`)
    if (equipment.quantities[key] == null) error('unknown_equipment_quantity', `Resolve the available quantity of ${key} before scheduling`)
    prescriptionInteger(equipment.quantities[key], `${key} inventory`, 0, 1000)
  }
  const logistics = profile.logistics ?? {}
  const needsLanes = method.workout_builder_rules?.requires_lanes === true || method.workout_builder_rules?.requires_clear_runout === true
    || logistics.requiresLanes === true || logistics.requiresClearRunout === true
  const stationCapacity = prescriptionInteger(logistics.stationCapacity ?? card.environment?.stationCapacity, 'reviewed station capacity', 1, 100)
  // Shared resources never imply that everyone assigned to a station can use
  // one implement at once. Floor-only drills can use the reviewed group capacity.
  const athletesPerStation = needsLanes || required.length ? 1 : stationCapacity
  let stations = Math.min(request.logistics.stationCount, Math.ceil(participants.length / athletesPerStation))
  if (needsLanes) {
    if (!request.logistics.laneCount) error('missing_lanes', 'This activity requires clear lanes')
    stations = Math.min(stations, request.logistics.laneCount)
    const laneLength = card.environment?.laneLengthFeet ?? logistics.laneLengthFeet
    if (laneLength == null || request.logistics.space.laneLengthFeet == null) error('unknown_lane_length', 'Resolve required and available lane length before scheduling')
    if (request.logistics.space.laneLengthFeet < laneLength) error('insufficient_lane_length', 'Available lane length is shorter than the reviewed requirement')
  }
  for (const key of required) stations = Math.min(stations, Math.floor(equipment.quantities[key] / quantitiesPerStation[key]))
  const areaPerStation = card.environment?.floorAreaSquareFeet
  if (areaPerStation == null || request.logistics.space.floorAreaSquareFeet == null) error('unknown_floor_area', 'Resolve the station footprint and available floor area before scheduling')
  prescriptionInteger(areaPerStation, 'station footprint', 1, 100000)
  stations = Math.min(stations, Math.floor(request.logistics.space.floorAreaSquareFeet / areaPerStation))
  const supervision = canonicalSupervisionCapacity(card)
  if (participants.length > request.logistics.coachCount * supervision.maxAthletesPerCoach) {
    error('coach_supervision_capacity', 'The full group, including waiting athletes, exceeds the canonical coaching ratio')
  }
  if (stations < 1) error('insufficient_station_resources', 'No usable station can be staffed and equipped')
  const activeCapacity = stations * athletesPerStation
  const waveGroups = []
  for (let i = 0; i < participants.length; i += activeCapacity) waveGroups.push(participants.slice(i, i + activeCapacity))
  const time = profile.timeModel ?? {}
  const timing = Object.fromEntries(['setupSeconds', 'demonstrationSeconds', 'transitionSeconds', 'resetSeconds', 'cleanupSeconds'].map((key) => [key,
    prescriptionInteger(time[key] ?? profile[key] ?? logistics[key] ?? 0, key, 0, 3600),
  ]))
  // A missing teaching/setup estimate is not proof of zero overhead.
  const timingAssumptions = ['setupSeconds', 'demonstrationSeconds', 'transitionSeconds', 'resetSeconds', 'cleanupSeconds']
    .filter((key) => time[key] == null && profile[key] == null && logistics[key] == null).map((key) => `${key} requires coach confirmation; the current draft uses zero.`)
  const workSeconds = prescriptionInteger(dose.workSeconds, 'workSeconds', 1, 3600)
  const restSeconds = prescriptionInteger(dose.restSeconds, 'restSeconds', 0, 3600)
  const sets = prescriptionInteger(dose.sets, 'sets', 1, 100)
  const restBetweenRoundsSeconds = prescriptionInteger(dose.restBetweenRoundsSeconds, 'restBetweenRoundsSeconds', 0, 3600)
  const beforeWork = timing.setupSeconds + timing.demonstrationSeconds + timing.transitionSeconds
  const waveSpacing = workSeconds + timing.resetSeconds
  const roundSpacing = Math.max(waveGroups.length * waveSpacing, workSeconds + Math.max(restSeconds, restBetweenRoundsSeconds))
  const events = []
  if (sets * waveGroups.length > 5000) error('schedule_complexity_budget', 'This activity exceeds the bounded scheduling event limit')
  for (let set = 0; set < sets; set += 1) for (let wave = 0; wave < waveGroups.length; wave += 1) {
    const athletes = waveGroups[wave]
    const begin = startSeconds + beforeWork + set * roundSpacing + wave * waveSpacing
    const occupiedStations = Math.ceil(athletes.length / athletesPerStation)
    events.push({ set: set + 1, wave: wave + 1, startSeconds: begin, endSeconds: begin + workSeconds,
      resourceReleaseSeconds: begin + workSeconds + timing.resetSeconds, athleteKeys: athletes,
      stationAssignments: Array.from({ length: occupiedStations }, (_, station) => ({ station: station + 1,
        lane: needsLanes ? station + 1 : null, athleteKeys: athletes.slice(station * athletesPerStation, (station + 1) * athletesPerStation) })),
      equipmentUse: Object.fromEntries(required.map((key) => [key, occupiedStations * quantitiesPerStation[key]])),
    })
  }
  const lastWorkEnd = events.at(-1).endSeconds
  const recoveryCompleteSeconds = lastWorkEnd + Math.max(restSeconds, timing.resetSeconds)
  const endSeconds = recoveryCompleteSeconds + timing.cleanupSeconds
  if (endSeconds - startSeconds > component.budgetSeconds) error('component_time_exceeded', 'Reviewed work, recovery and group rotations do not fit the component budget',
    { requiredSeconds: endSeconds - startSeconds, budgetSeconds: component.budgetSeconds })
  return immutableProgrammingValue({ schemaVersion: RESOURCE_SCHEDULER_VERSION, activityId, componentKey: component.key,
    startSeconds, endSeconds, elapsedSeconds: endSeconds - startSeconds, recoveryCompleteSeconds,
    participantCount: participants.length, stationCount: stations, athletesPerStation, waveCount: waveGroups.length,
    requiredEquipment: required, quantitiesPerStation, requiresLanes: needsLanes, areaPerStation,
    timing, timingAssumptions, needsCoachTimingConfirmation: timingAssumptions.length > 0,
    workSecondsPerAthlete: sets * workSeconds, restSecondsPerAthleteBetweenSets: roundSpacing - workSeconds,
    events, doseHash: programmingValueHash(dose),
  })
}

/** Independent verification over event intervals, participants, recovery and resources. */
export function validateWorkoutResourceSchedule(activities, request) {
  const issues = []
  if (!Array.isArray(activities) || activities.length > 100) error('schedule_complexity_budget', 'A session can validate at most 100 activities')
  const expectedAthletes = request.athletes.flatMap((cohort) => Array.from({ length: cohort.athleteCount }, (_, i) => `${cohort.key}:${i + 1}`))
  const allEvents = []
  const seenIds = new Set()
  for (const { schedule, dose } of activities) {
    if (seenIds.has(schedule.activityId)) issues.push({ code: 'duplicate_activity_id', activityId: schedule.activityId })
    seenIds.add(schedule.activityId)
    if (schedule.doseHash !== programmingValueHash(dose)) issues.push({ code: 'stale_dose_schedule', activityId: schedule.activityId })
    if (schedule.startSeconds < 0 || schedule.endSeconds > request.logistics.totalBookedMinutes * 60) issues.push({ code: 'booked_time_exceeded', activityId: schedule.activityId })
    if (schedule.needsCoachTimingConfirmation) issues.push({ code: 'unconfirmed_overhead', activityId: schedule.activityId })
    for (const key of expectedAthletes) {
      const events = schedule.events.filter((entry) => entry.athleteKeys.includes(key)).sort((a, b) => a.startSeconds - b.startSeconds)
      if (events.length !== dose.sets || new Set(events.map((entry) => entry.set)).size !== dose.sets) issues.push({ code: 'athlete_dose_mismatch', activityId: schedule.activityId, athleteKey: key })
      for (let i = 0; i < events.length; i += 1) {
        if (events[i].endSeconds - events[i].startSeconds !== dose.workSeconds) issues.push({ code: 'work_clock_mismatch', activityId: schedule.activityId, athleteKey: key })
        if (i && events[i].startSeconds - events[i - 1].endSeconds < Math.max(dose.restSeconds, dose.restBetweenRoundsSeconds)) {
          issues.push({ code: 'insufficient_recovery', activityId: schedule.activityId, athleteKey: key })
        }
      }
      if (events.length && events.at(-1).endSeconds + dose.restSeconds > schedule.recoveryCompleteSeconds) issues.push({ code: 'final_recovery_missing', activityId: schedule.activityId, athleteKey: key })
    }
    for (const event of schedule.events) {
      if (event.athleteKeys.some((key) => !expectedAthletes.includes(key)) || new Set(event.athleteKeys).size !== event.athleteKeys.length) issues.push({ code: 'invalid_participant_assignment', activityId: schedule.activityId })
      if (event.startSeconds < schedule.startSeconds || event.endSeconds > schedule.endSeconds || event.resourceReleaseSeconds < event.endSeconds) issues.push({ code: 'invalid_event_interval', activityId: schedule.activityId })
      const assigned = event.stationAssignments.flatMap((station) => station.athleteKeys)
      if (assigned.length !== event.athleteKeys.length || new Set(assigned).size !== assigned.length || event.athleteKeys.some((key) => !assigned.includes(key))
        || event.stationAssignments.some((station) => !Number.isInteger(station.station) || station.station < 1 || station.station > schedule.stationCount
          || station.athleteKeys.length < 1 || station.athleteKeys.length > schedule.athletesPerStation)
        || new Set(event.stationAssignments.map((station) => station.station)).size !== event.stationAssignments.length) {
        issues.push({ code: 'invalid_station_assignment', activityId: schedule.activityId })
      }
      if (event.stationAssignments.some((station) => schedule.requiresLanes
        ? !Number.isInteger(station.lane) || station.lane < 1 || station.lane > request.logistics.laneCount : station.lane !== null)) {
        issues.push({ code: 'invalid_lane_assignment', activityId: schedule.activityId })
      }
      if (schedule.requiresLanes && new Set(event.stationAssignments.map((station) => station.lane)).size !== event.stationAssignments.length) {
        issues.push({ code: 'duplicate_lane_assignment', activityId: schedule.activityId })
      }
      for (const key of schedule.requiredEquipment) if (event.equipmentUse[key] !== event.stationAssignments.length * schedule.quantitiesPerStation[key]) {
        issues.push({ code: 'equipment_assignment_mismatch', activityId: schedule.activityId, equipmentKey: key })
      }
      allEvents.push({ ...event, schedule, dose })
    }
  }
  if (allEvents.length > 10000) error('schedule_complexity_budget', 'This session exceeds the bounded scheduling event limit')
  for (const key of expectedAthletes) {
    const events = allEvents.filter((event) => event.athleteKeys.includes(key)).sort((a, b) => a.startSeconds - b.startSeconds)
    for (let i = 1; i < events.length; i += 1) if (events[i].schedule.activityId !== events[i - 1].schedule.activityId
      && events[i].startSeconds - events[i - 1].endSeconds < events[i - 1].dose.restSeconds) {
      issues.push({ code: 'cross_activity_recovery_missing', athleteKey: key, activityId: events[i].schedule.activityId })
    }
  }
  const boundaries = [...new Set(allEvents.flatMap((event) => [event.startSeconds, event.resourceReleaseSeconds]))].sort((a, b) => a - b)
  for (const second of boundaries) {
    const concurrent = allEvents.filter((event) => event.startSeconds <= second && second < event.resourceReleaseSeconds)
    const stations = concurrent.reduce((sum, event) => sum + event.stationAssignments.length, 0)
    const lanes = concurrent.reduce((sum, event) => sum + (event.schedule.requiresLanes ? event.stationAssignments.length : 0), 0)
    const floorArea = concurrent.reduce((sum, event) => sum + event.stationAssignments.length * event.schedule.areaPerStation, 0)
    if (stations > request.logistics.stationCount) issues.push({ code: 'station_overbooking', second })
    if (lanes > request.logistics.laneCount) issues.push({ code: 'lane_overbooking', second })
    if (floorArea > request.logistics.space.floorAreaSquareFeet) issues.push({ code: 'floor_area_overbooking', second })
    for (const key of new Set(concurrent.flatMap((event) => event.schedule.requiredEquipment))) {
      const needed = concurrent.reduce((sum, event) => sum + event.stationAssignments.length * (event.schedule.quantitiesPerStation[key] ?? 0), 0)
      if (request.equipment.quantities[key] == null || needed > request.equipment.quantities[key]) issues.push({ code: 'equipment_overbooking', equipmentKey: key, second })
    }
    const activeAthletes = concurrent.flatMap((event) => second < event.endSeconds ? event.athleteKeys : [])
    if (new Set(activeAthletes).size !== activeAthletes.length) issues.push({ code: 'athlete_double_booked', second })
  }
  return immutableProgrammingValue({ status: issues.length ? 'REVISE' : 'PASS', issues })
}

/** Fixed component windows; complete-group activities run in order inside them. */
export function scheduleProgrammingSession({ request, componentPlan, components }) {
  const budgets = allocateProgrammingComponentBudgets(request)
  const expectedPlan = normalizeSessionComponentPlan({ durationMinutes: request.logistics.totalBookedMinutes,
    equipment: { available: request.equipment.available, quantities: request.equipment.quantities, excluded: request.equipment.excluded },
    components: request.components.filter((entry) => budgets[entry.key] > 0).map((entry) => ({ key: entry.key, budgetSeconds: budgets[entry.key], equipment: entry.equipment })),
  })
  if (programmingValueHash(componentPlan) !== programmingValueHash(expectedPlan)) error('component_control_mismatch', 'Schedule does not match immutable coach clocks and equipment')
  if (!Array.isArray(components) || components.length !== componentPlan.components.length
    || components.some((entry, index) => entry.key !== componentPlan.components[index].key)) error('component_order_mismatch', 'Schedule must follow the complete active component plan')
  let cursor = 0
  const activities = []
  const scheduledComponents = componentPlan.components.map((control, index) => {
    const startSeconds = cursor
    const componentEnd = startSeconds + control.budgetSeconds
    const entries = components[index].activities
    if (!Array.isArray(entries) || entries.length > 30) error('invalid_component_activities', 'A component requires at most 30 activities')
    const scheduled = entries.map((entry) => {
      const schedule = scheduleCanonicalExercise({ ...entry, request, startSeconds: cursor,
        component: { ...control, budgetSeconds: componentEnd - cursor } })
      activities.push({ schedule, dose: entry.dose })
      cursor = schedule.endSeconds
      return schedule
    })
    const reserveSeconds = componentEnd - cursor
    cursor = componentEnd
    return { key: control.key, startSeconds, endSeconds: componentEnd, reserveSeconds, activities: scheduled }
  })
  const validation = validateWorkoutResourceSchedule(activities, request)
  const incomplete = scheduledComponents.filter((component) => !component.activities.length || component.reserveSeconds > 0)
  return immutableProgrammingValue({ schemaVersion: RESOURCE_SCHEDULER_VERSION, components: scheduledComponents,
    bookedSeconds: componentPlan.bookedSeconds, sessionReserveSeconds: componentPlan.reserveSeconds,
    resourceValidation: validation, status: validation.status === 'PASS' && !incomplete.length && !componentPlan.reserveSeconds ? 'SCHEDULED' : 'NEEDS_COMPOSITION',
    validatedWorkout: false,
  })
}
