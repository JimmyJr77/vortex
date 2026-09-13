import assert from 'node:assert/strict'
import test from 'node:test'
import { scheduleCanonicalExercise, scheduleProgrammingSession, validateWorkoutResourceSchedule } from '../workoutResourceScheduler.js'
import { executionActivity, executionPlan, executionRequest } from './workoutProgrammingExecutionFixtures.js'

function schedule(activity = executionActivity(), request = executionRequest(), patch = {}) {
  const component = executionPlan(request).components.find((entry) => entry.key === activity.componentKey)
  return scheduleCanonicalExercise({ ...activity, request, component, ...patch })
}

test('15 athletes and 3 lanes receive full prescribed work with repeated waves and recovery', () => {
  const request = executionRequest()
  const activity = executionActivity()
  const result = schedule(activity, request)
  assert.equal(result.stationCount, 3)
  assert.equal(result.athletesPerStation, 1)
  assert.equal(result.waveCount, 5)
  assert.equal(result.events.length, 15)
  assert.equal(result.workSecondsPerAthlete, 30)
  assert.equal(result.restSecondsPerAthleteBetweenSets, 65)
  assert.equal(result.endSeconds, 355)
  assert.equal(result.events.at(-1).endSeconds + 60, result.recoveryCompleteSeconds)
  for (let athlete = 1; athlete <= 15; athlete += 1) assert.equal(result.events.filter((event) => event.athleteKeys.includes(`youth:${athlete}`)).length, 3)
  assert.equal(validateWorkoutResourceSchedule([{ schedule: result, dose: activity.dose }], request).status, 'PASS')
})

test('limited physical equipment reduces active stations instead of inventing inventory', () => {
  const request = executionRequest({ equipment: { available: ['dumbbell'], quantities: { dumbbell: 4 } } })
  const activity = executionActivity('strength', 4, request)
  activity.card.equipmentRoles = [{ key: 'dumbbell', role: 'required', quantityPerStation: 2 }]
  const result = schedule(activity, request)
  assert.equal(result.stationCount, 2)
  assert.equal(result.waveCount, 8)
  assert.ok(result.events.every((event) => event.equipmentUse.dumbbell <= 4))
  assert.equal(validateWorkoutResourceSchedule([{ schedule: result, dose: activity.dose }], request).status, 'PASS')
})

test('floor-only drills use reviewed group capacity, with no phantom physical inventory', () => {
  const request = executionRequest()
  const activity = executionActivity('strength', 4)
  const result = schedule(activity, request)
  assert.equal(result.athletesPerStation, 4)
  assert.equal(result.waveCount, 2)
  assert.deepEqual(result.requiredEquipment, [])
  assert.equal(validateWorkoutResourceSchedule([{ schedule: result, dose: activity.dose }], request).status, 'PASS')
})

test('unknown quantities, lanes, floor area and insufficient coaches cannot be scheduled as feasible', () => {
  const base = executionRequest()
  for (const [request, code] of [
    [executionRequest({ logistics: { ...base.logistics, laneCount: 0 } }), 'missing_lanes'],
    [executionRequest({ logistics: { ...base.logistics, space: { ...base.logistics.space, laneLengthFeet: null } } }), 'unknown_lane_length'],
    [executionRequest({ logistics: { ...base.logistics, space: { ...base.logistics.space, laneLengthFeet: 1 } } }), 'insufficient_lane_length'],
    [executionRequest({ logistics: { ...base.logistics, space: { ...base.logistics.space, floorAreaSquareFeet: null } } }), 'unknown_floor_area'],
  ]) assert.throws(() => schedule(executionActivity(), request), { code })
  const request = executionRequest({ equipment: { available: ['dumbbell'] } })
  const equipped = executionActivity('strength', 4)
  equipped.card.equipmentRoles = [{ key: 'dumbbell', role: 'required', quantityPerStation: 1 }]
  assert.throws(() => schedule(equipped, request), { code: 'unknown_equipment_quantity' })
  const highRisk = executionActivity()
  highRisk.card.taskDemands.supervisionDemand = 90
  assert.throws(() => schedule(highRisk, base), { code: 'coach_supervision_capacity' })
})

test('missing overhead is a review issue and a short clock never removes teaching or rest', () => {
  const activity = executionActivity()
  assert.throws(() => schedule(activity, executionRequest(), { component: { ...executionPlan(executionRequest()).components[1], budgetSeconds: 100 } }),
    { code: 'component_time_exceeded' })
  delete activity.profile.timeModel.setupSeconds
  const result = schedule(activity)
  assert.equal(result.needsCoachTimingConfirmation, true)
  assert.ok(validateWorkoutResourceSchedule([{ schedule: result, dose: activity.dose }], executionRequest()).issues.some((issue) => issue.code === 'unconfirmed_overhead'))
})

test('independent schedule verification detects tampering, shared resource conflicts and missed participants', () => {
  const request = executionRequest()
  const activity = executionActivity()
  const original = schedule(activity, request)
  const second = { ...structuredClone(original), activityId: 'second' }
  const concurrent = validateWorkoutResourceSchedule([{ schedule: original, dose: activity.dose }, { schedule: second, dose: activity.dose }], request)
  for (const code of ['lane_overbooking', 'station_overbooking', 'athlete_double_booked', 'cross_activity_recovery_missing']) assert.ok(concurrent.issues.some((issue) => issue.code === code))
  for (const [mutate, code] of [
    [(copy) => { copy.events[0].athleteKeys.pop() }, 'athlete_dose_mismatch'],
    [(copy) => { copy.events[0].stationAssignments = [] }, 'invalid_station_assignment'],
    [(copy) => { copy.events[0].stationAssignments[0].lane = 99 }, 'invalid_lane_assignment'],
    [(copy) => { copy.recoveryCompleteSeconds = 0 }, 'final_recovery_missing'],
    [(copy) => { copy.events[5].startSeconds = copy.events[0].endSeconds }, 'insufficient_recovery'],
  ]) {
    const copy = structuredClone(original)
    mutate(copy)
    assert.ok(validateWorkoutResourceSchedule([{ schedule: copy, dose: activity.dose }], request).issues.some((issue) => issue.code === code), code)
  }
  assert.ok(validateWorkoutResourceSchedule([{ schedule: original, dose: { ...activity.dose, sets: 2 } }], request).issues.some((issue) => issue.code === 'stale_dose_schedule'))
})

test('full component windows preserve 60/90-minute bookings plus explicit tumbling and unfilled time', () => {
  for (const [athleticMinutes, tumblingMinutes] of [[60, 0], [60, 30], [90, 30]]) {
    const base = executionRequest()
    const request = executionRequest({ logistics: { ...base.logistics, athleticMinutes, tumblingMinutes, totalBookedMinutes: athleticMinutes + tumblingMinutes } })
    const componentPlan = executionPlan(request)
    const components = componentPlan.components.map((component, index) => ({ key: component.key,
      activities: [executionActivity(component.key, index + 1, request)] }))
    const result = scheduleProgrammingSession({ request, componentPlan, components })
    assert.equal(result.bookedSeconds, (athleticMinutes + tumblingMinutes) * 60)
    assert.equal(result.components.at(-1).endSeconds, result.bookedSeconds)
    assert.equal(result.resourceValidation.status, 'PASS')
    assert.equal(result.status, 'NEEDS_COMPOSITION')
    assert.equal(result.validatedWorkout, false)
    assert.ok(result.components.every((component) => component.reserveSeconds >= 0))
  }
})

test('scheduler cannot broaden component equipment or rewrite coach clocks', () => {
  const request = executionRequest()
  const componentPlan = executionPlan(request)
  const component = structuredClone(componentPlan.components[1])
  component.equipment.quantities.dumbbell = 100
  assert.throws(() => schedule(executionActivity(), request, { component }), { code: 'component_control_mismatch' })
  const modified = structuredClone(componentPlan)
  modified.components[1].budgetSeconds += 100
  assert.throws(() => scheduleProgrammingSession({ request, componentPlan: modified, components: [] }), { code: 'component_control_mismatch' })
})
