import type { GameAgeBracket, GameGroupStructure, GameKind, GameType } from './types'

export const GAME_TYPES: Array<{ key: GameType; label: string }> = [
  { key: 'tag_and_chase', label: 'Tag & Chase' },
  { key: 'territory_and_zone', label: 'Territory & Zone' },
  { key: 'relay_and_race', label: 'Relay & Race' },
  { key: 'target_and_accuracy', label: 'Target & Accuracy' },
  { key: 'ball_object_control', label: 'Ball & Object Control' },
  { key: 'reaction_and_decision', label: 'Reaction & Decision' },
  { key: 'balance_body_control', label: 'Balance & Body Control' },
  { key: 'strength_power_play', label: 'Strength & Power Play' },
  { key: 'obstacle_ninja', label: 'Obstacle & Ninja' },
  { key: 'cooperative_team', label: 'Cooperative & Team' },
  { key: 'flexibility_shape', label: 'Flexibility & Shape' },
  { key: 'structured_competition', label: 'Structured Competition' },
]

export const GAME_KINDS: Array<{ key: GameKind; label: string }> = [
  { key: 'game', label: 'Game' },
  { key: 'competition', label: 'Competition' },
  { key: 'both', label: 'Game & Competition' },
]

export const GAME_GROUP_STRUCTURES: Array<{ key: GameGroupStructure; label: string }> = [
  { key: 'individual', label: 'Individual' },
  { key: 'pairs', label: 'Pairs' },
  { key: 'small_group', label: 'Small group' },
  { key: 'large_group', label: 'Large group' },
  { key: 'teams', label: 'Teams' },
]

export const GAME_AGE_BRACKETS: Array<{ key: GameAgeBracket; label: string }> = [
  { key: 'preschool', label: 'Preschool' },
  { key: 'elementary_young', label: 'Elementary 1 (younger)' },
  { key: 'elementary_older', label: 'Elementary 2 (older)' },
  { key: 'middle_school', label: 'Middle school' },
  { key: 'high_school', label: 'High school' },
  { key: 'adult', label: 'Adult' },
]

export const GAME_INTENSITY_OPTIONS = [
  { key: 'low', label: 'Low' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'high', label: 'High' },
]

export const GAME_CONTACT_OPTIONS = [
  { key: 'none', label: 'No contact' },
  { key: 'light', label: 'Light contact' },
  { key: 'moderate', label: 'Moderate contact' },
]

const TYPE_LABEL = Object.fromEntries(GAME_TYPES.map((t) => [t.key, t.label]))
const KIND_LABEL = Object.fromEntries(GAME_KINDS.map((k) => [k.key, k.label]))
const STRUCTURE_LABEL = Object.fromEntries(GAME_GROUP_STRUCTURES.map((g) => [g.key, g.label]))
const AGE_LABEL = Object.fromEntries(GAME_AGE_BRACKETS.map((a) => [a.key, a.label]))

export function gameTypeLabel(key?: string | null) {
  return key ? TYPE_LABEL[key] ?? key : ''
}

export function gameKindLabel(key?: string | null) {
  return key ? KIND_LABEL[key] ?? key : ''
}

export function gameGroupStructureLabel(key?: string | null) {
  return key ? STRUCTURE_LABEL[key] ?? key : ''
}

export function gameAgeBracketLabel(key?: string | null) {
  return key ? AGE_LABEL[key] ?? key : ''
}
