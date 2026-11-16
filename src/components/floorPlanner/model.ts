import { randomUUID } from '../../utils/uuid'
import { expandScheduleLines, type ClassSetupOverviewRow } from '../../utils/classSetupOverviewApi'
import type { SchedulingCalendarEvent } from '../../utils/schedulingApi'

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const UNASSIGNED_LOCATION = 'floor-planner-unassigned'
export const BLOCK_HEIGHT = 84
export const LANE_HEIGHT = 94
export const LOCATION_OPTIONS = ['Main floor', 'Spring floor', 'Tumbling track', 'Vault', 'Bars', 'Beam', 'Trampoline', 'Ninja course', 'Strength area']
export interface Location { id: string; name: string }
export interface PlannerClass { id: string; classId?: string; formId?: number | null; name: string; program: string; duration: number; coaches: string[]; schedule?: string; idea?: boolean }
export interface Block { id: string; instanceId: string; classId: string; name: string; program: string; day: number; locationId: string; start: number; end: number; color: number; coaches: string[] }
export interface Plan { version: 1; increment: number; start: number; end: number; locations: Location[]; classes: PlannerClass[]; blocks: Block[] }
export interface Coach { id: number; name: string; assignments: { programsId?: number; classId?: number; formId?: number; offeringId?: number; timeSlotId?: number }[] }
export const newPlan = (): Plan => ({ version: 1, increment: 15, start: 8 * 60, end: 21 * 60, locations: LOCATION_OPTIONS.slice(0, 3).map((name) => ({ id: randomUUID(), name })), classes: [], blocks: [] })
export const timeValue = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
export const minutes = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m }
export const timeLabel = (minute: number) => `${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${minute >= 720 && minute < 1440 ? 'PM' : 'AM'}`
export const snap = (minute: number, increment: number) => Math.round(minute / increment) * increment
const scheduledClassId = (id: number) => `class:${id}`
const classLabelId = (program: string, name: string) => {
  const labels = [program, name].map((label) => label.trim().toLowerCase())
  return `label:${hashClassId(JSON.stringify(labels))}`
}

function hashClassId(classId: string) {
  let hash = 2166136261
  for (let i = 0; i < classId.length; i++) hash = Math.imul(hash ^ classId.charCodeAt(i), 16777619)
  return hash >>> 0
}

const classColor = (classId: string) => hashClassId(classId) % 1_000_001

export function blockColor(block: Block, classesByForm: ReadonlyMap<number, string>) {
  // Older plans stored one ID for each library variant or calendar slot.
  const libraryClass = /^scheduled:(\d+):(?:\d+|null):\d+:\d+$/.exec(block.classId)
  if (libraryClass) return classColor(scheduledClassId(Number(libraryClass[1])))

  const calendarForm = /^scheduled:(\d+):\d+$/.exec(block.classId)
  if (calendarForm) {
    return classColor(classesByForm.get(Number(calendarForm[1])) ?? classLabelId(block.program, block.name))
  }

  return classColor(block.classId)
}

export function classPlacement(item: PlannerClass, day: number, locationId: string, start: number): Block {
  const classId = item.classId ?? item.id
  return {
    id: randomUUID(), instanceId: randomUUID(), classId, name: item.name, program: item.program,
    day, locationId, start, end: start + item.duration, color: classColor(classId), coaches: [...item.coaches],
  }
}

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
      else unique.set(key, {
        id: `scheduled:${row.classId}:${row.formId}:${duration}:${line.timeSlotId ?? line.slotGroupId ?? unique.size}`,
        classId: scheduledClassId(row.classId), formId: row.formId,
        name: row.className, program: row.programName || 'Classes', duration, coaches: assigned, schedule,
      })
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
export function resetFromSchedule(plan: Plan, events: SchedulingCalendarEvent[], coaches: Coach[], range: ReturnType<typeof currentWeekRange>) {
  const locations = [
    { id: UNASSIGNED_LOCATION, name: 'Unassigned' },
    ...plan.locations.filter((location) => location.id !== UNASSIGNED_LOCATION),
  ]
  if (locations.length > 50) throw new Error('Remove a location to make room for the Unassigned row, then try again.')
  const seen = new Set<string>()
  const blocks: Block[] = []
  const classesByForm = new Map<number, string>()
  const signatureEntries: string[] = []
  let unsupportedTimes = 0
  for (const event of events) {
    // Enrollment visibility is separate from the admin calendar's active class status.
    if (!event.classActive || !event.slotGroupActive || !event.slotActive
      || event.date < range.startDate || event.date > range.endDate) continue
    const key = `${event.date}:${event.formId}:${event.timeSlotId}`
    if (seen.has(key)) continue
    seen.add(key)
    const start = minutes(event.startTime), endMinute = minutes(event.endTime)
    const end = endMinute === 0 && start > 0 ? 1440 : endMinute
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1440 || end - start < 5) {
      unsupportedTimes++
      continue
    }
    const assigned = coaches.filter((coach) => coach.assignments.some((a) => {
      if (a.timeSlotId != null) return Number(a.timeSlotId) === event.timeSlotId
      if (a.offeringId != null) return Number(a.offeringId) === event.offeringId
      if (a.formId != null) return Number(a.formId) === event.formId
      if (a.classId != null) return Number(a.classId) === event.classEventId
      return a.programsId != null && Number(a.programsId) === event.programsId
    })).map((coach) => coach.name)
    const date = new Date(`${event.date}T12:00:00`)
    const program = event.programName || 'Classes'
    const day = (date.getDay() + 6) % 7
    const classId = event.classEventId == null ? classLabelId(program, event.className) : scheduledClassId(event.classEventId)
    if (event.classEventId != null) classesByForm.set(event.formId, classId)
    blocks.push(classPlacement({ id: classId, name: event.className, program, duration: end - start, coaches: assigned }, day, UNASSIGNED_LOCATION, start))
    // Use the occurrence ID so a color change does not invalidate existing schedule drafts.
    signatureEntries.push(JSON.stringify([`scheduled:${event.formId}:${event.timeSlotId}`, event.className, program, day, start, end]))
  }
  if (blocks.length > 3000) throw new Error('This schedule exceeds the 3,000-segment planning limit.')
  return {
    classesByForm, signature: JSON.stringify(signatureEntries.sort()), unsupportedTimes,
    plan: {
      ...plan, locations, blocks,
      start: Math.min(plan.start, ...blocks.map((b) => Math.floor(b.start / plan.increment) * plan.increment)),
      end: Math.max(plan.end, ...blocks.map((b) => Math.ceil(b.end / plan.increment) * plan.increment)),
    },
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
  const instances = new Map<string, string>()
  const copied = source.map((b) => {
    const instanceId = instances.get(b.instanceId) ?? randomUUID()
    instances.set(b.instanceId, instanceId)
    return { ...b, id: randomUUID(), instanceId, coaches: [...b.coaches], day: to }
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
