import type { FlipFitProgram, FlipFitTrainingDay } from './flipFitProgram'

export interface FlipFitSessionOverride {
  objective?: string
  coachNotes?: string
}

export type FlipFitSessionOverrides = Record<string, FlipFitSessionOverride>

interface OverriddenTrainingDay extends FlipFitTrainingDay {
  coachNotes?: string
}

const SESSION_ID_PATTERN = /^flip-fit-w(?:0[1-9]|1[0-2])-d[1-5]$/

function boundedText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function normalizeFlipFitSessionOverrides(raw: unknown): FlipFitSessionOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const normalized: FlipFitSessionOverrides = {}
  for (const [sessionId, value] of Object.entries(raw)) {
    if (!SESSION_ID_PATTERN.test(sessionId) || !value || typeof value !== 'object' || Array.isArray(value)) continue
    const objective = boundedText((value as Record<string, unknown>).objective, 2_000)
    const coachNotes = boundedText((value as Record<string, unknown>).coachNotes, 4_000)
    if (objective || coachNotes) normalized[sessionId] = {
      ...(objective ? { objective } : {}),
      ...(coachNotes ? { coachNotes } : {}),
    }
  }
  return normalized
}

export function applyFlipFitSessionOverrides(
  program: FlipFitProgram,
  rawOverrides: unknown,
): FlipFitProgram {
  const overrides = normalizeFlipFitSessionOverrides(rawOverrides)
  if (Object.keys(overrides).length === 0) return program

  const sessions = program.sessions.map((session): OverriddenTrainingDay => {
    const override = overrides[session.id]
    if (!override) return session
    return {
      ...session,
      objective: override.objective || session.objective,
      ...(override.coachNotes ? { coachNotes: override.coachNotes } : {}),
    }
  })
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  return {
    ...program,
    sessions,
    weeks: program.weeks.map((week) => ({
      ...week,
      days: week.days.map((day) => sessionById.get(day.id) ?? day),
    })),
  }
}

export function flipFitCoachNotes(session: FlipFitTrainingDay) {
  return (session as OverriddenTrainingDay).coachNotes ?? ''
}
