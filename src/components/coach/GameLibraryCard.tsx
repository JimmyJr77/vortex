import { Clock, Users } from 'lucide-react'
import type { Game } from '../../coach/types'
import {
  gameAgeLabel,
  gameDurationLabel,
  gamePlayerLabel,
  gameSummaryLine,
  gameTenetLabels,
} from '../../coach/gameCard'
import { gameKindLabel, gameTypeLabel } from '../../coach/gameTypes'
import { LibraryTag, LibraryTagGroup } from './LibraryTagGroup'

function kindBadgeClass(kind: string) {
  if (kind === 'competition') return 'bg-amber-50 text-amber-800'
  if (kind === 'both') return 'bg-purple-50 text-purple-800'
  return 'bg-sky-50 text-sky-800'
}

function intensityBadgeClass(level: string) {
  if (level === 'high') return 'bg-orange-50 text-orange-800'
  if (level === 'low') return 'bg-green-50 text-green-800'
  return 'bg-amber-50 text-amber-800'
}

export default function GameLibraryCard({
  game,
  tenetName,
}: {
  game: Game
  tenetName: Map<number | string, string>
}) {
  const tenets = game.primary_tenets?.length ? game.primary_tenets : gameTenetLabels(game, tenetName)
  const summary = gameSummaryLine(game)
  const players = gamePlayerLabel(game)
  const duration = gameDurationLabel(game)
  const ages = gameAgeLabel(game)

  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-3">
      <header className="w-full min-w-0 pr-8">
        <span className="text-[11px] uppercase tracking-wide text-indigo-700 font-semibold">
          {game.game_type_label ?? gameTypeLabel(game.game_type)}
        </span>
        <h3 className="text-base font-bold leading-snug text-gray-900 mt-1">{game.name}</h3>
        {summary && (
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600 line-clamp-3">{summary}</p>
        )}
      </header>

      <div className="flex flex-wrap gap-1">
        <span className={`text-[11px] rounded px-2 py-0.5 ${kindBadgeClass(game.game_kind)}`}>
          {game.game_kind_label ?? gameKindLabel(game.game_kind)}
        </span>
        <span className="text-[11px] bg-gray-100 text-gray-600 rounded px-2 py-0.5 inline-flex items-center gap-1">
          <Users className="w-3 h-3" /> {players}
        </span>
        {duration && (
          <span className="text-[11px] bg-gray-100 text-gray-600 rounded px-2 py-0.5 inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> {duration}
          </span>
        )}
        <span className={`text-[11px] rounded px-2 py-0.5 ${intensityBadgeClass(game.intensity_level)}`}>
          {game.intensity_level} intensity
        </span>
      </div>

      {ages && <p className="text-xs text-gray-500">Ages: {ages}</p>}

      {tenets.length > 0 && (
        <div className="w-full border-t border-gray-100 pt-3">
          <LibraryTagGroup label="Tenets">
            {tenets.map((label) => (
              <LibraryTag key={label} variant="tenet">{label}</LibraryTag>
            ))}
          </LibraryTagGroup>
        </div>
      )}
    </div>
  )
}
