import { useEffect, useState } from 'react'
import { Loader2, Pencil, X, Link2 } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type { Skill } from '../../coach/types'
import { EVALUATION_LABELS, formatSkillMetric } from '../../coach/skillCard'

function ReadOnlyField({ label, value }: { label: string; value?: string | number | null }) {
  const text = value != null && String(value).trim() !== '' ? String(value) : null
  if (!text) return null
  return (
    <div className="text-sm">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <p className="text-gray-800 mt-0.5 whitespace-pre-wrap">{text}</p>
    </div>
  )
}

export default function SkillDetailModal({
  skillId,
  preview,
  onClose,
  onEdit,
}: {
  skillId: number
  preview?: Skill | null
  onClose: () => void
  onEdit?: () => void
}) {
  const [skill, setSkill] = useState<Skill | null>(preview ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    coachFetch<Skill>(`/api/coach/skills/${skillId}`)
      .then(setSkill)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load skill'))
      .finally(() => setLoading(false))
  }, [skillId])

  const metric = skill ? formatSkillMetric(skill) : null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-gray-900 truncate">{skill?.name ?? preview?.name ?? 'Skill'}</h3>
            {skill && (
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-[11px] bg-blue-50 text-blue-800 rounded px-2 py-0.5">
                  {skill.skill_kind === 'combo' ? 'Combo' : 'Skill'}
                </span>
                <span className="text-[11px] bg-amber-50 text-amber-800 rounded px-2 py-0.5">
                  {EVALUATION_LABELS[skill.evaluation_mode ?? 'execution']}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <button type="button" onClick={onEdit} className="flex items-center gap-1 text-sm text-vortex-red font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:border-vortex-red">
                <Pencil className="w-4 h-4" /> Edit
              </button>
            )}
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading && !skill && (
          <div className="flex items-center justify-center gap-2 p-12 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading skill...
          </div>
        )}
        {error && <div className="m-5 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

        {skill && (
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {metric && (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Proficiency metric</div>
                <p className="text-gray-800 mt-1 font-medium">{metric}</p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Description" value={skill.description} />
              <ReadOnlyField label="Coaching notes" value={skill.instructions} />
              <ReadOnlyField label="Sport" value={skill.sport_name ?? 'Universal'} />
              <ReadOnlyField label="Skill level" value={skill.skill_level?.replace(/_/g, ' ')} />
              <ReadOnlyField label="Assistance / variation" value={skill.assistance_note} />
              <ReadOnlyField label="Linked exercise (training)" value={skill.exercise_name} />
              <ReadOnlyField label="Visibility" value={skill.visibility === 'private' ? 'Private' : 'Facility (shared)'} />
            </div>

            {skill.skill_kind === 'combo' && (skill.components?.length ?? 0) > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Combo sequence</div>
                <p className="text-sm text-gray-800 flex items-start gap-1">
                  <Link2 className="w-4 h-4 mt-0.5 shrink-0 text-purple-600" />
                  {(skill.components ?? []).map((c) => c.name).filter(Boolean).join(' → ')}
                </p>
              </div>
            )}

            {(skill.prerequisites?.length ?? 0) > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prerequisites</div>
                <ul className="space-y-2">
                  {(skill.prerequisites ?? []).map((p) => (
                    <li key={p.prerequisite_skill_id} className="text-sm border border-gray-100 rounded-lg px-3 py-2">
                      <span className="font-medium text-gray-800">{p.name}</span>
                      {p.note && <p className="text-xs text-gray-500 mt-1">{p.note}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-100 text-right shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
