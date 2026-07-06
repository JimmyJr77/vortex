import type { Game, GameTag } from './types'
import { gameAgeBracketLabel } from './gameTypes'

export function gameTenetLabels(game: Game, tenetName?: Map<number | string, string>): string[] {
  const tags = game.tags ?? []
  return tags
    .filter((t) => t.facet_type === 'tenet')
    .sort((a, b) => b.weight - a.weight)
    .map((t) => t.name ?? tenetName?.get(t.facet_id) ?? tenetName?.get(`tenet:${t.facet_id}`) ?? '')
    .filter(Boolean)
}

export function gamePlayerLabel(game: Game): string {
  const min = game.min_players
  const max = game.max_players
  if (game.ideal_players) return `${game.ideal_players} players`
  if (max != null && max === min) return `${min} players`
  if (max != null) return `${min}–${max} players`
  return `${min}+ players`
}

export function gameDurationLabel(game: Game): string | null {
  const min = game.duration_typical_min
  const max = game.duration_typical_max
  if (min == null && max == null) return null
  if (min != null && max != null && min !== max) return `${min}–${max} min`
  return `${min ?? max} min`
}

export function gameAgeLabel(game: Game): string | null {
  const labels = game.age_bracket_labels ?? game.age_brackets?.map(gameAgeBracketLabel) ?? []
  if (labels.length === 0) return null
  if (labels.length <= 2) return labels.join(' · ')
  return `${labels[0]} – ${labels[labels.length - 1]}`
}

export function gameSummaryLine(game: Game): string {
  return game.card_summary ?? game.coach_summary ?? game.description ?? ''
}

export function stringifyRulesList(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map(String)
  return []
}

export function topWeightedTags(tags: GameTag[] | undefined, facetType: string, limit = 3): GameTag[] {
  return (tags ?? [])
    .filter((t) => t.facet_type === facetType)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
}
