import type { Skill, SkillEvaluationMode } from './types'

export const EVALUATION_LABELS: Record<SkillEvaluationMode, string> = {
  execution: 'Execution',
  duration: 'Duration',
  repetitions: 'Repetitions',
}

export function formatSkillMetric(skill: Pick<
  Skill,
  'evaluation_mode' | 'min_hold_seconds' | 'default_hold_seconds' | 'min_reps' | 'default_reps' | 'target_reps' | 'execution_max_score'
>): string | null {
  if (skill.evaluation_mode === 'duration') {
    const parts: string[] = []
    if (skill.min_hold_seconds != null) parts.push(`min ${skill.min_hold_seconds}s`)
    if (skill.default_hold_seconds != null) parts.push(`target ${skill.default_hold_seconds}s`)
    return parts.length ? parts.join(' · ') : 'Timed hold'
  }
  if (skill.evaluation_mode === 'repetitions') {
    const parts: string[] = []
    if (skill.min_reps != null) parts.push(`min ${skill.min_reps} reps`)
    if (skill.default_reps != null) parts.push(`typical ${skill.default_reps}`)
    if (skill.target_reps != null) parts.push(`target ${skill.target_reps}`)
    return parts.length ? parts.join(' · ') : 'Rep count'
  }
  if (skill.execution_max_score != null) {
    return `Scored / ${skill.execution_max_score}`
  }
  return 'Quality of execution'
}
