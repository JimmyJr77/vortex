import { useEffect, useState } from 'react'
import { Loader2, Pencil, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type { Game } from '../../coach/types'
import { stringifyRulesList } from '../../coach/gameCard'
import {
  gameAgeBracketLabel,
  gameGroupStructureLabel,
  gameKindLabel,
  gameTypeLabel,
} from '../../coach/gameTypes'
import { phaseDisplayName } from '../../coach/sessionPhaseKeys'
import { LibraryTag, LibraryTagGroup } from './LibraryTagGroup'

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

function RulesList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="text-sm">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</div>
      <ul className="mt-1 list-disc pl-5 text-gray-800 space-y-1">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  )
}

export default function GameDetailModal({
  gameId,
  preview,
  onClose,
  onEdit,
}: {
  gameId: number
  preview?: Game | null
  onClose: () => void
  onEdit?: () => void
}) {
  const [game, setGame] = useState<Game | null>(preview ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    coachFetch<Game>(`/api/coach/games/${gameId}`)
      .then(setGame)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load game'))
      .finally(() => setLoading(false))
  }, [gameId])

  const rules = game?.rules ?? {}
  const safety = game?.safety ?? {}

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <span className="text-[11px] uppercase tracking-wide text-indigo-700 font-semibold">
              {game ? gameTypeLabel(game.game_type) : 'Game'}
            </span>
            <h3 className="font-bold text-lg text-gray-900 truncate">{game?.name ?? preview?.name ?? 'Game'}</h3>
            {game && (
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-[11px] bg-sky-50 text-sky-800 rounded px-2 py-0.5">
                  {gameKindLabel(game.game_kind)}
                </span>
                <span className="text-[11px] bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                  {gameGroupStructureLabel(game.group_structure)}
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

        {loading && !game && (
          <div className="flex items-center justify-center gap-2 p-12 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading game...
          </div>
        )}
        {error && <div className="m-5 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

        {game && (
          <div className="overflow-y-auto p-5 space-y-5">
            <ReadOnlyField label="Coach summary" value={game.coach_summary ?? game.card_summary} />
            <ReadOnlyField label="Athlete language" value={game.athlete_summary} />
            <ReadOnlyField label="Description" value={game.description} />

            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyField label="Players" value={`${game.min_players}${game.max_players != null ? `–${game.max_players}` : '+'}`} />
              <ReadOnlyField label="Ideal group" value={game.ideal_players} />
              <ReadOnlyField label="Duration" value={
                game.duration_typical_min != null
                  ? `${game.duration_typical_min}${game.duration_typical_max != null && game.duration_typical_max !== game.duration_typical_min ? `–${game.duration_typical_max}` : ''} min`
                  : null
              } />
              <ReadOnlyField label="Best phase" value={game.best_session_phase ? phaseDisplayName(game.best_session_phase) : null} />
              <ReadOnlyField label="Intensity" value={game.intensity_level} />
              <ReadOnlyField label="Contact" value={game.contact_level} />
            </div>

            {(game.age_brackets?.length ?? 0) > 0 && (
              <LibraryTagGroup label="Age brackets">
                {game.age_brackets.map((b) => (
                  <LibraryTag key={b} variant="phase">{gameAgeBracketLabel(b)}</LibraryTag>
                ))}
              </LibraryTagGroup>
            )}

            {(game.primary_tenets?.length ?? 0) > 0 && (
              <LibraryTagGroup label="Develops">
                {game.primary_tenets!.map((t) => (
                  <LibraryTag key={t} variant="tenet">{t}</LibraryTag>
                ))}
              </LibraryTagGroup>
            )}

            <RulesList title="Setup" items={stringifyRulesList(rules.setup)} />
            <RulesList title="How to play" items={stringifyRulesList(rules.execution_steps)} />
            <ReadOnlyField label="Scoring" value={typeof rules.scoring === 'string' ? rules.scoring : null} />
            <ReadOnlyField label="Win condition" value={typeof rules.win_condition === 'string' ? rules.win_condition : null} />

            {game.age_variations && Object.keys(game.age_variations).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Age variations</div>
                {Object.entries(game.age_variations).map(([key, val]) => (
                  <div key={key} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <div className="font-semibold text-gray-800">{gameAgeBracketLabel(key)}</div>
                    <p className="text-gray-600 mt-0.5">{val.rules ?? val.guidance ?? ''}</p>
                  </div>
                ))}
              </div>
            )}

            <RulesList title="Stop signs" items={stringifyRulesList(safety.stop_signs)} />
            <RulesList title="Contact rules" items={stringifyRulesList(safety.contact_rules)} />
            <ReadOnlyField label="Coaching notes" value={game.coaching_notes} />

            {game.migrated_from_exercise && (
              <p className="text-xs text-gray-500 rounded-lg bg-gray-50 px-3 py-2">
                Migrated from Exercise Library (movement_game). Linked exercise archived; use this card for play rules.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
