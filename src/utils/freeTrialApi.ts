import { getApiUrl } from './api'
import type { DropInClass, DropInSession } from './dropInApi'

export type FreeTrialProgram = 'gymnastics' | 'fit-flip'

export interface GymnasticsTrialAnswers {
  gymnasticsTrack?: 'mommy-me' | 'preschool' | 'beginner' | 'experienced'
  pottyTrained?: boolean
  experience?: 'none' | 'experienced'
}

export interface FreeTrialSession extends DropInSession {
  /** Confirmed athletes only; pending places still count toward capacity. */
  enrolledCount: number
  timeZone?: string
  facilityId?: number
}

export interface FreeTrialAvailability {
  program: FreeTrialProgram
  age: number
  ageBand: { min: number; max: number } | null
  gymnasticsRouting?: { track: 'mommy-me' | 'preschool' | 'school-age' | 'contact'; reason?: string } | null
  classes: DropInClass[]
  sessions: FreeTrialSession[]
}

export async function fetchFreeTrialAvailability(
  program: FreeTrialProgram,
  age: number,
  signal?: AbortSignal,
  answers: GymnasticsTrialAnswers = {},
): Promise<FreeTrialAvailability> {
  const query = new URLSearchParams({ program, age: String(age) })
  if (program === 'gymnastics') {
    if (answers.gymnasticsTrack) query.set('gymnasticsTrack', answers.gymnasticsTrack)
    if (answers.pottyTrained !== undefined) query.set('pottyTrained', String(answers.pottyTrained))
    if (answers.experience) query.set('experience', answers.experience)
  }
  const response = await fetch(`${getApiUrl()}/api/public/free-trials?${query}`, {
    cache: 'no-store',
    signal,
  })
  const body = await response.json()
  if (!response.ok || body.success !== true) {
    throw new Error(body.message || 'We couldn’t load available trial classes. Please try again.')
  }
  return body.data as FreeTrialAvailability
}
