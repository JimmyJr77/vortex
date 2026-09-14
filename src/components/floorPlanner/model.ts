import { randomUUID } from '../../utils/uuid'
import { expandScheduleLines, type ClassSetupOverviewRow } from '../../utils/classSetupOverviewApi'
import type { SchedulingCalendarEvent } from '../../utils/schedulingApi'

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const UNASSIGNED_LOCATION = 'floor-planner-unassigned'
export const BLOCK_HEIGHT = 84
export const LANE_HEIGHT = 94
export const LOCATION_OPTIONS = ['Main floor', 'Spring floor', 'Tumbling track', 'Vault', 'Bars', 'Beam', 'Trampoline', 'Ninja course', 'Strength area']
export interface Location { id: string; name: string }
export interface PlannerClass { id: string; name: string; program: string; duration: number; coaches: string[]; schedule?: string; idea?: boolean }
export interface Block { id: string; instanceId: string; classId: string; name: string; program: string; day: number; locationId: string; start: number; end: number; color: number; coaches: string[] }
export interface Plan { version: 1; increment: number; start: number; end: number; locations: Location[]; classes: PlannerClass[]; blocks: Block[] }
export interface Coach { id: number; name: string; assignments: { programsId?: number; classId?: number; formId?: number; offeringId?: number; timeSlotId?: number }[] }
export const newPlan = (): Plan => ({ version: 1, increment: 15, start: 8 * 60, end: 21 * 60, locations: LOCATION_OPTIONS.slice(0, 3).map((name) => ({ id: randomUUID(), name })), classes: [], blocks: [] })
export const timeValue = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
export const minutes = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m }
export const timeLabel = (minute: number) => `${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${minute >= 720 && minute < 1440 ? 'PM' : 'AM'}`
export const snap = (minute: number, increment: number) => Math.round(minute / increment) * increment
export const nextColor = (blocks: Block[]) => Math.max(-1, ...blocks.map((b) => b.color)) + 1
export const colorStyle = (index: number) => {
  const hue = (index * 137.508 + 210) % 360
  return { backgroundColor: `hsl(${hue} 82% 94%)`, borderColor: `hsl(${hue} 62% 45%)`, color: `hsl(${hue} 65% 23%)` }
}
export function buildLibrary(rows: ClassSetupOverviewRow[], coaches: Coach[]): PlannerClass[] {
  return rows.filter((row) => !row.classArchived && !row.programArchived && row.classIsActive).flatMap((row) => {
    const unique = new Map<string, PlannerClass>()
    for (const line of expandScheduleLines(row).filter((s) => s.isActive !== false)) {
      const match = /^(\d{1,2}:\d{2})[–-](\d{1,2}:\d{2})$/.exec(line.times)
      const duration = match ? (minutes(match[2]) || 1440) - minutes(match[1]) : 60
      if (duration < 5) continue
      const assigned = coaches.filter((coach) => coach.assignments.some((a) => {
        if (a.timeSlotId != null) return Number(a.timeSlotId) === line.timeSlotId
        if (a.offeringId != null) return row.slotGroups.some((g) => g.slotGroupId === line.slotGroupId && g.offeringId === Number(a.offeringId))
        if (a.formId != null) return Number(a.formId) === row.formId
        if (a.classId != null) return Number(a.classId) === row.classId
        return a.programsId != null && Number(a.programsId) === row.programsId
      })).map((c) => c.name)
      const key = `${row.classId}:${duration}:${assigned.slice().sort().join(',')}`
      const existing = unique.get(key)
      const schedule = match ? `${line.days} · ${line.times}` : 'No schedule yet · 60 min default'
      if (existing) { if (!existing.schedule?.includes(schedule)) existing.schedule += `; ${schedule}` }
      else unique.set(key, { id: `scheduled:${row.classId}:${row.formId}:${duration}:${line.timeSlotId ?? line.slotGroupId ?? unique.size}`, name: row.className, program: row.programName || 'Classes', duration, coaches: assigned, schedule })
    }
    return [...unique.values()]
  })
}

export function currentWeekRange(today = new Date()) {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (today.getDay() + 6) % 7)
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return { startDate: iso(monday), endDate: iso(sunday) }
}

/** Snapshot actual calendar occurrences; this never writes to scheduling or coach assignments. */
export function resetFromSchedule(plan: Plan, events: SchedulingCalendarEvent[], coaches: Coach[], range: { startDate: string; endDate: string }): Plan {
  const locations = [
    { id: UNASSIGNED_LOCATION, name: 'Unassigned' },
    ...plan.locations.filter((location) => location.id !== UNASSIGNED_LOCATION),
  ]
  if (locations.length > 50) throw new Error('Remove a location to make room for the Unassigned row, then try again.')
  const seen = new Set<string>()
  let color = nextColor(plan.blocks)
  const blocks: Block[] = []
  for (const event of events) {
    // Enrollment visibility is separate from the admin calendar's active class status.
    if (!event.classActive || !event.slotGroupActive || !event.slotActive
      || event.date < range.startDate || event.date > range.endDate) continue
    const key = `${event.date}:${event.formId}:${event.timeSlotId}`
    if (seen.has(key)) continue
    seen.add(key)
    const start = minutes(event.startTime), end = minutes(event.endTime) || 1440
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1440 || end - start < 5) {
      throw new Error(`Check the scheduled times for ${event.programName || 'Classes'} · ${event.className}. The plan has not been reset.`)
    }
    const assigned = coaches.filter((coach) => coach.assignments.some((a) => {
      if (a.timeSlotId != null) return Number(a.timeSlotId) === event.timeSlotId
      if (a.offeringId != null) return Number(a.offeringId) === event.offeringId
      if (a.formId != null) return Number(a.formId) === event.formId
      if (a.classId != null) return Number(a.classId) === event.classEventId
      return a.programsId != null && Number(a.programsId) === event.programsId
    })).map((coach) => coach.name)
    const date = new Date(`${event.date}T12:00:00`)
    blocks.push({
      id: randomUUID(), instanceId: randomUUID(), classId: `scheduled:${event.formId}:${event.timeSlotId}`,
      name: event.className, program: event.programName || 'Classes', day: (date.getDay() + 6) % 7,
      locationId: UNASSIGNED_LOCATION, start, end, color: color++, coaches: assigned,
    })
  }
  if (blocks.length > 3000) throw new Error('This schedule exceeds the 3,000-segment planning limit.')
  return {
    ...plan, locations, blocks,
    start: Math.min(plan.start, ...blocks.map((b) => Math.floor(b.start / plan.increment) * plan.increment)),
    end: Math.max(plan.end, ...blocks.map((b) => Math.ceil(b.end / plan.increment) * plan.increment)),
  }
}

// Only pieces of the same placement merge. Separate instances of the same class never merge.
export function mergeAdjacent(blocks: Block[], instanceId: string): Block[] {
  const result = blocks.filter((b) => b.instanceId !== instanceId)
  const pieces = blocks.filter((b) => b.instanceId === instanceId).sort((a, b) => a.day - b.day || a.locationId.localeCompare(b.locationId) || a.start - b.start)
  for (const block of pieces) {
    const previous = result[result.length - 1]
    if (previous?.instanceId === instanceId && previous.day === block.day && previous.locationId === block.locationId
      && previous.end === block.start && previous.name === block.name
      && previous.coaches.slice().sort().join('\0') === block.coaches.slice().sort().join('\0')) {
      result[result.length - 1] = { ...previous, end: block.end }
    } else result.push(block)
  }
  return result
}
export function copyDay(plan: Plan, from: number, to: number, replace: boolean): Plan {
  const source = plan.blocks.filter((b) => b.day === from)
  const instances = new Map<string, { id: string; color: number }>()
  let color = nextColor(plan.blocks)
  const copied = source.map((b) => {
    if (!instances.has(b.instanceId)) instances.set(b.instanceId, { id: randomUUID(), color: color++ })
    const instance = instances.get(b.instanceId)!
    return { ...b, id: randomUUID(), instanceId: instance.id, color: instance.color, coaches: [...b.coaches], day: to }
  })
  return { ...plan, blocks: [...plan.blocks.filter((b) => !replace || b.day !== to), ...copied] }
}
export function layoutBlocks(blocks: Block[]) {
  const ends: number[] = []
  const items = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end).map((block) => {
    let lane = ends.findIndex((end) => end <= block.start)
    if (lane === -1) lane = ends.length
    ends[lane] = block.end
    return { block, lane }
  })
  return { items, height: Math.max(110, ends.length * LANE_HEIGHT + 16) }
}
export function conflicts(blocks: Block[]) {
  const result = new Map<string, Set<string>>()
  const add = (id: string, message: string) => result.set(id, new Set([...(result.get(id) || []), message]))
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i], b = blocks[j]
    if (a.day !== b.day || a.start >= b.end || b.start >= a.end) continue
    const messages = []
    if (a.locationId === b.locationId && a.locationId !== UNASSIGNED_LOCATION) messages.push('Location overlap')
    const shared = a.coaches.filter((c) => b.coaches.includes(c))
    if (shared.length) messages.push(`Coach overlap: ${shared.join(', ')}`)
    for (const message of messages) { add(a.id, message); add(b.id, message) }
  }
  return result
}
