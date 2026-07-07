import { Clock } from 'lucide-react'
import type { Exercise } from '../../coach/types'
import { participantStructureLabel } from '../../coach/types'
import type { Taxonomy } from '../../coach/taxonomy'
import {
  exerciseDosageLabel,
  exerciseFacetLabels,
  exerciseFitnessGoal,
  exerciseIdentityLine,
  exerciseRequirementChips,
  exerciseTenetLabels,
  primaryPhaseProfile,
  whyPreview,
} from '../../coach/exerciseCard'
import { LibraryTag, LibraryTagGroup } from './LibraryTagGroup'

export default function ExerciseLibraryCard({
  exercise,
  taxonomy,
  facetName,
  tenetName,
}: {
  exercise: Exercise
  taxonomy?: Taxonomy | null
  facetName: Map<number | string, string>
  tenetName: Map<number | string, string>
}) {
  const tenets = exerciseTenetLabels(exercise, tenetName)
  const methodologies = exerciseFacetLabels(exercise, 'methodology', facetName, 2)
  const physiology = exerciseFacetLabels(exercise, 'physiology', facetName, 2)
  const identityLine = exerciseIdentityLine(exercise, taxonomy ?? undefined)
  const reqChips = exerciseRequirementChips(exercise)
  const programmingNote = whyPreview(exercise.why)
  const phaseProfile = primaryPhaseProfile(exercise)
  const diff = exercise.difficulty_profile
  const isSkillDrill = exercise.programming_kind === 'skill_drill'
  const youthCap = 6

  const programmingFlags: Array<{ key: string; label: string; variant: 'flag' | 'warning' | 'impact' | 'positive' | 'group' | 'difficulty' }> = []
  if (isSkillDrill) {
    programmingFlags.push({ key: 'kind', label: 'Skill drill', variant: 'group' })
  } else {
    programmingFlags.push({ key: 'kind', label: 'Workout', variant: 'flag' })
  }
  if (diff?.overall != null) {
    programmingFlags.push({
      key: 'difficulty',
      label: `Overall ${diff.overall}/10`,
      variant: diff.overall >= 7 ? 'warning' : 'difficulty',
    })
    if (!isSkillDrill && diff.load > youthCap) {
      programmingFlags.push({ key: 'load', label: 'High load for youth', variant: 'warning' })
    }
  }
  if (phaseProfile?.freshnessRequired) {
    programmingFlags.push({ key: 'freshness', label: 'Freshness required', variant: 'flag' })
  }
  if ((phaseProfile?.fatigueCost ?? 0) >= 4) {
    programmingFlags.push({ key: 'fatigue', label: 'High fatigue', variant: 'warning' })
  }
  if ((phaseProfile?.impactLevel ?? 0) >= 3) {
    programmingFlags.push({ key: 'impact', label: 'High impact', variant: 'impact' })
  }
  if (exercise.regimen_rule?.can_be_daily) {
    programmingFlags.push({ key: 'daily', label: 'Daily OK', variant: 'positive' })
  }
  if (exercise.participant_structure && exercise.participant_structure !== 'individual') {
    programmingFlags.push({
      key: 'structure',
      label: participantStructureLabel(exercise.participant_structure),
      variant: 'group',
    })
  }

  const hasClassification = tenets.length > 0 || methodologies.length > 0 || physiology.length > 0
  const hasRequirements = reqChips.length > 0
  const hasFlags = programmingFlags.length > 0
  const hasTaxonomySection = hasClassification || hasRequirements || hasFlags

  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-3">
      {/* Title + summary always anchor the top-left — optional meta never sits between them */}
      <header className="w-full min-w-0 pr-8">
        <h3 className="text-base font-bold leading-snug text-gray-900">{exercise.name}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600 line-clamp-3">
          {exerciseFitnessGoal(exercise, tenetName)}
        </p>
      </header>

      {(exercise.sport_name || identityLine || diff) && (
        <p className="w-full text-xs leading-snug text-gray-500">
          {[exercise.sport_name, identityLine].filter(Boolean).join(' · ')}
          {diff && (
            <span className="block mt-1 text-gray-600" title={`Technical ${diff.technical} · Load ${diff.load}${diff.source === 'derived' ? ' · estimated' : ''}`}>
              Difficulty: overall {diff.overall}/10 · T{diff.technical} · L{diff.load}
              {!isSkillDrill && exercise.difficulty_profile?.recommended_age_min != null ? ` · Ages ${exercise.difficulty_profile.recommended_age_min}+` : ''}
              {isSkillDrill ? ' · Class/level gated' : ''}
            </span>
          )}
        </p>
      )}

      <div className="flex w-full items-center gap-1.5 text-xs text-gray-500">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{exerciseDosageLabel(exercise)}</span>
      </div>

      {programmingNote && (
        <p className="w-full text-xs leading-relaxed text-gray-500 line-clamp-2">{programmingNote}</p>
      )}

      {hasTaxonomySection && (
        <div className="flex w-full flex-col gap-2.5 border-t border-gray-100 pt-3">
          {hasClassification && (
            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-2.5">
              {tenets.length > 0 && (
                <LibraryTagGroup label="Tenets" className="min-w-0 flex-1 sm:min-w-[8rem]">
                  {tenets.map((label) => (
                    <LibraryTag key={label} variant="tenet">{label}</LibraryTag>
                  ))}
                </LibraryTagGroup>
              )}
              {methodologies.length > 0 && (
                <LibraryTagGroup label="Method" className="min-w-0 flex-1 sm:min-w-[8rem]">
                  {methodologies.map((label) => (
                    <LibraryTag key={label} variant="methodology">{label}</LibraryTag>
                  ))}
                </LibraryTagGroup>
              )}
              {physiology.length > 0 && (
                <LibraryTagGroup label="Physiology" className="min-w-0 flex-1 sm:min-w-[8rem]">
                  {physiology.map((label) => (
                    <LibraryTag key={label} variant="physiology">{label}</LibraryTag>
                  ))}
                </LibraryTagGroup>
              )}
            </div>
          )}

          {hasRequirements && (
            <LibraryTagGroup label="Movement demands">
              {reqChips.map((chip) => (
                <LibraryTag key={chip} variant="requirement">{chip}</LibraryTag>
              ))}
            </LibraryTagGroup>
          )}

          {hasFlags && (
            <LibraryTagGroup label="Programming flags">
              {programmingFlags.map((flag) => (
                <LibraryTag key={flag.key} variant={flag.variant}>{flag.label}</LibraryTag>
              ))}
            </LibraryTagGroup>
          )}
        </div>
      )}
    </div>
  )
}
