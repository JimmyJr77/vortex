import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import type { Game, GameAgeBracket, GameGroupStructure, GameKind, GameType } from '../../coach/types'
import {
  GAME_AGE_BRACKETS,
  GAME_CONTACT_OPTIONS,
  GAME_GROUP_STRUCTURES,
  GAME_INTENSITY_OPTIONS,
  GAME_KINDS,
  GAME_TYPES,
} from '../../coach/gameTypes'
import { SESSION_PHASE_ORDER } from '../../coach/taxonomy'
import { phaseDisplayName } from '../../coach/sessionPhaseKeys'
import GameDetailModal from './GameDetailModal'
import LibraryCardMenu from './LibraryCardMenu'
import LibraryCard from './LibraryCard'
import LibraryExportControls from './LibraryExportControls'
import LibraryResultCount from './LibraryResultCount'
import GameLibraryCard from './GameLibraryCard'

interface FilterState {
  q: string
  age_bracket: GameAgeBracket | ''
  game_type: GameType | ''
  tenet: number | ''
  min_players: number | ''
  group_structure: GameGroupStructure | ''
  game_kind: GameKind | ''
  intensity: string
  phase: string
}

const emptyFilters: FilterState = {
  q: '',
  age_bracket: '',
  game_type: '',
  tenet: '',
  min_players: '',
  group_structure: '',
  game_kind: '',
  intensity: '',
  phase: '',
}

type ExportFormat = 'full-json' | 'simple-json'

function exportGames(games: Game[], format: ExportFormat) {
  const blob = new Blob([
    JSON.stringify(
      format === 'simple-json'
        ? games.map((g) => ({ name: g.name, summary: g.card_summary ?? g.coach_summary, type: g.game_type_label }))
        : games,
      null,
      2,
    ),
  ], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `games-library-${format === 'simple-json' ? 'simple' : 'full'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export default function GamesLibraryPanel() {
  const { taxonomy } = useTaxonomy()
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Game | null>(null)
  const [editing, setEditing] = useState<Game | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.q) params.set('q', filters.q)
      if (filters.age_bracket) params.set('age_bracket', filters.age_bracket)
      if (filters.game_type) params.set('game_type', filters.game_type)
      if (filters.tenet) params.set('tenet', String(filters.tenet))
      if (filters.min_players !== '') params.set('min_players', String(filters.min_players))
      if (filters.group_structure) params.set('group_structure', filters.group_structure)
      if (filters.game_kind) params.set('game_kind', filters.game_kind)
      if (filters.intensity) params.set('intensity', filters.intensity)
      if (filters.phase) params.set('phase', filters.phase)
      const data = await coachFetch<Game[]>(`/api/coach/games?${params.toString()}`)
      setGames(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [load])

  const tenetName = useMemo(() => {
    const map = new Map<number | string, string>()
    for (const t of taxonomy?.tenets ?? []) {
      if (t.id != null) {
        map.set(Number(t.id), t.name)
        map.set(`tenet:${t.id}`, t.name)
      }
    }
    return map
  }, [taxonomy])

  const handleDelete = async (game: Game) => {
    if (!window.confirm(`Delete "${game.name}"? This cannot be undone.`)) return
    try {
      await coachFetch(`/api/coach/games/${game.id}`, { method: 'DELETE' })
      if (viewing?.id === game.id) setViewing(null)
      if (editing?.id === game.id) setEditing(null)
      void load()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete game')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Games & Competitions</h2>
          <p className="text-sm text-gray-500">
            Play-based activities that grow athleticism through fun — filter by age bracket, group size, tenet, and game type.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <LibraryExportControls
            disabled={loading || games.length === 0}
            filenameStem="games-library"
            options={[
              { value: 'full-json', label: 'Full JSON' },
              { value: 'simple-json', label: 'Simple JSON (name & summary)' },
            ]}
            onExport={(format) => exportGames(games, format as ExportFormat)}
          />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center justify-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
          >
            <Plus className="w-4 h-4" /> New Game
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search games..."
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Age bracket</label>
          <select
            value={filters.age_bracket}
            onChange={(e) => setFilters((f) => ({ ...f, age_bracket: e.target.value as GameAgeBracket | '' }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Any age</option>
            {GAME_AGE_BRACKETS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Game type</label>
          <select
            value={filters.game_type}
            onChange={(e) => setFilters((f) => ({ ...f, game_type: e.target.value as GameType | '' }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            {GAME_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Tenet</label>
          <select
            value={filters.tenet}
            onChange={(e) => setFilters((f) => ({ ...f, tenet: e.target.value ? Number(e.target.value) : '' }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Any tenet</option>
            {(taxonomy?.tenets ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Min players (group size)</label>
          <select
            value={filters.min_players}
            onChange={(e) => setFilters((f) => ({ ...f, min_players: e.target.value ? Number(e.target.value) : '' }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            {[2, 4, 6, 8, 10, 15].map((n) => <option key={n} value={n}>{n}+ athletes</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Structure</label>
          <select
            value={filters.group_structure}
            onChange={(e) => setFilters((f) => ({ ...f, group_structure: e.target.value as GameGroupStructure | '' }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            {GAME_GROUP_STRUCTURES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Kind</label>
          <select
            value={filters.game_kind}
            onChange={(e) => setFilters((f) => ({ ...f, game_kind: e.target.value as GameKind | '' }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Games & competitions</option>
            {GAME_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Intensity</label>
          <select
            value={filters.intensity}
            onChange={(e) => setFilters((f) => ({ ...f, intensity: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            {GAME_INTENSITY_OPTIONS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
          </select>
        </div>
        <div className="lg:col-span-4 grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Best session phase</label>
            <select
              value={filters.phase}
              onChange={(e) => setFilters((f) => ({ ...f, phase: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Any phase</option>
              {SESSION_PHASE_ORDER.map((k) => (
                <option key={k} value={k}>{phaseDisplayName(k)}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={() => setFilters(emptyFilters)} className="self-end text-sm text-gray-500 hover:text-gray-800 underline">
            Clear filters
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <LibraryResultCount count={games.length} loading={loading} singular="game" plural="games" />

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading games...</div>
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <LibraryCard
              key={game.id}
              onClick={() => setViewing(game)}
              menu={
                <LibraryCardMenu
                  itemLabel={game.name}
                  onEdit={() => setEditing(game)}
                  onDelete={() => { void handleDelete(game) }}
                />
              }
            >
              <GameLibraryCard game={game} tenetName={tenetName} />
            </LibraryCard>
          ))}
          {games.length === 0 && <div className="text-sm text-gray-500 col-span-full">No games match your filters.</div>}
        </div>
      )}

      {viewing && (
        <GameDetailModal
          gameId={viewing.id}
          preview={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null) }}
        />
      )}

      {(creating || editing) && (
        <GameEditor
          game={editing}
          taxonomy={taxonomy}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => { setCreating(false); setEditing(null); void load() }}
        />
      )}
    </div>
  )
}

function GameEditor({
  game,
  taxonomy,
  onClose,
  onSaved,
}: {
  game: Game | null
  taxonomy: ReturnType<typeof useTaxonomy>['taxonomy']
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: game?.name ?? '',
    description: game?.description ?? '',
    card_summary: game?.card_summary ?? '',
    coach_summary: game?.coach_summary ?? '',
    athlete_summary: game?.athlete_summary ?? '',
    game_kind: (game?.game_kind ?? 'game') as GameKind,
    game_type: (game?.game_type ?? 'tag_and_chase') as GameType,
    group_structure: (game?.group_structure ?? 'pairs') as GameGroupStructure,
    min_players: game?.min_players ?? 2,
    max_players: game?.max_players ?? '',
    ideal_players: game?.ideal_players ?? '',
    age_brackets: (game?.age_brackets ?? []) as GameAgeBracket[],
    intensity_level: game?.intensity_level ?? 'moderate',
    contact_level: game?.contact_level ?? 'none',
    duration_typical_min: game?.duration_typical_min ?? '',
    duration_typical_max: game?.duration_typical_max ?? '',
    best_session_phase: game?.best_session_phase ?? 'movement_intelligence',
    coaching_notes: game?.coaching_notes ?? '',
    setup_text: stringifyList(game?.rules?.setup),
    steps_text: stringifyList(game?.rules?.execution_steps),
    scoring: typeof game?.rules?.scoring === 'string' ? game.rules.scoring : '',
    win_condition: typeof game?.rules?.win_condition === 'string' ? game.rules.win_condition : '',
    stop_signs_text: stringifyList(game?.safety?.stop_signs),
  })
  const [tenetIds, setTenetIds] = useState<number[]>(
    (game?.tags ?? []).filter((t) => t.facet_type === 'tenet').map((t) => t.facet_id),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!game) return
    coachFetch<Game>(`/api/coach/games/${game.id}`)
      .then((full) => {
        setForm({
          name: full.name,
          description: full.description ?? '',
          card_summary: full.card_summary ?? '',
          coach_summary: full.coach_summary ?? '',
          athlete_summary: full.athlete_summary ?? '',
          game_kind: full.game_kind,
          game_type: full.game_type,
          group_structure: full.group_structure,
          min_players: full.min_players,
          max_players: full.max_players ?? '',
          ideal_players: full.ideal_players ?? '',
          age_brackets: full.age_brackets ?? [],
          intensity_level: full.intensity_level,
          contact_level: full.contact_level,
          duration_typical_min: full.duration_typical_min ?? '',
          duration_typical_max: full.duration_typical_max ?? '',
          best_session_phase: full.best_session_phase ?? 'movement_intelligence',
          coaching_notes: full.coaching_notes ?? '',
          setup_text: stringifyList(full.rules?.setup),
          steps_text: stringifyList(full.rules?.execution_steps),
          scoring: typeof full.rules?.scoring === 'string' ? full.rules.scoring : '',
          win_condition: typeof full.rules?.win_condition === 'string' ? full.rules.win_condition : '',
          stop_signs_text: stringifyList(full.safety?.stop_signs),
        })
        setTenetIds((full.tags ?? []).filter((t) => t.facet_type === 'tenet').map((t) => t.facet_id))
      })
      .catch(() => {/* keep list values */})
  }, [game])

  const toggleAge = (key: GameAgeBracket) => {
    setForm((f) => ({
      ...f,
      age_brackets: f.age_brackets.includes(key)
        ? f.age_brackets.filter((a) => a !== key)
        : [...f.age_brackets, key],
    }))
  }

  const toggleTenet = (id: number) => {
    setTenetIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        card_summary: form.card_summary || null,
        coach_summary: form.coach_summary || null,
        athlete_summary: form.athlete_summary || null,
        game_kind: form.game_kind,
        game_type: form.game_type,
        group_structure: form.group_structure,
        min_players: Number(form.min_players) || 2,
        max_players: form.max_players !== '' ? Number(form.max_players) : null,
        ideal_players: form.ideal_players || null,
        age_brackets: form.age_brackets,
        intensity_level: form.intensity_level,
        contact_level: form.contact_level,
        duration_typical_min: form.duration_typical_min !== '' ? Number(form.duration_typical_min) : null,
        duration_typical_max: form.duration_typical_max !== '' ? Number(form.duration_typical_max) : null,
        best_session_phase: form.best_session_phase || null,
        compatible_phases: form.best_session_phase ? [form.best_session_phase] : [],
        coaching_notes: form.coaching_notes || null,
        rules: {
          setup: parseList(form.setup_text),
          execution_steps: parseList(form.steps_text),
          scoring: form.scoring || null,
          win_condition: form.win_condition || null,
        },
        safety: {
          stop_signs: parseList(form.stop_signs_text),
        },
        tags: tenetIds.map((facet_id, i) => ({
          facet_type: 'tenet',
          facet_id,
          weight: i === 0 ? 5 : 4,
        })),
      }
      if (game) {
        await coachFetch(`/api/coach/games/${game.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await coachFetch('/api/coach/games', { method: 'POST', body: JSON.stringify(body) })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save game')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-lg">{game ? 'Edit Game' : 'New Game'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="md:col-span-2 text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Kind</span>
              <select value={form.game_kind} onChange={(e) => setForm({ ...form, game_kind: e.target.value as GameKind })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {GAME_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Game type</span>
              <select value={form.game_type} onChange={(e) => setForm({ ...form, game_type: e.target.value as GameType })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {GAME_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Group structure</span>
              <select value={form.group_structure} onChange={(e) => setForm({ ...form, group_structure: e.target.value as GameGroupStructure })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {GAME_GROUP_STRUCTURES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Min players</span>
              <input type="number" min={1} value={form.min_players} onChange={(e) => setForm({ ...form, min_players: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Max players</span>
              <input type="number" min={1} value={form.max_players} onChange={(e) => setForm({ ...form, max_players: e.target.value ? Number(e.target.value) : '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Unlimited" />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block font-semibold text-gray-700 mb-1">Ideal group size</span>
              <input value={form.ideal_players} onChange={(e) => setForm({ ...form, ideal_players: e.target.value })} placeholder="e.g. 8–12" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block font-semibold text-gray-700 mb-1">Card summary</span>
              <textarea value={form.card_summary} onChange={(e) => setForm({ ...form, card_summary: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block font-semibold text-gray-700 mb-1">Coach summary</span>
              <textarea value={form.coach_summary} onChange={(e) => setForm({ ...form, coach_summary: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block font-semibold text-gray-700 mb-1">Athlete language</span>
              <input value={form.athlete_summary} onChange={(e) => setForm({ ...form, athlete_summary: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Intensity</span>
              <select value={form.intensity_level} onChange={(e) => setForm({ ...form, intensity_level: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {GAME_INTENSITY_OPTIONS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Contact</span>
              <select value={form.contact_level} onChange={(e) => setForm({ ...form, contact_level: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {GAME_CONTACT_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Typical duration (min)</span>
              <div className="flex gap-2">
                <input type="number" value={form.duration_typical_min} onChange={(e) => setForm({ ...form, duration_typical_min: e.target.value ? Number(e.target.value) : '' })} placeholder="Min" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                <input type="number" value={form.duration_typical_max} onChange={(e) => setForm({ ...form, duration_typical_max: e.target.value ? Number(e.target.value) : '' })} placeholder="Max" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Best session phase</span>
              <select value={form.best_session_phase} onChange={(e) => setForm({ ...form, best_session_phase: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {SESSION_PHASE_ORDER.map((k) => (
                  <option key={k} value={k}>{phaseDisplayName(k)}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-2">Age brackets</span>
            <div className="flex flex-wrap gap-2">
              {GAME_AGE_BRACKETS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => toggleAge(a.key)}
                  className={`text-xs rounded px-2 py-1 border ${form.age_brackets.includes(a.key) ? 'bg-vortex-red text-white border-vortex-red' : 'bg-white text-gray-700 border-gray-300'}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-2">Tenets developed</span>
            <div className="flex flex-wrap gap-2">
              {(taxonomy?.tenets ?? []).map((t) => t.id != null && (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTenet(Number(t.id))}
                  className={`text-xs rounded px-2 py-1 border ${tenetIds.includes(Number(t.id)) ? 'bg-vortex-red text-white border-vortex-red' : 'bg-white text-gray-700 border-gray-300'}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="block font-semibold text-gray-700 mb-1">Setup (one step per line)</span>
            <textarea value={form.setup_text} onChange={(e) => setForm({ ...form, setup_text: e.target.value })} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs" />
          </label>
          <label className="block text-sm">
            <span className="block font-semibold text-gray-700 mb-1">How to play (one step per line)</span>
            <textarea value={form.steps_text} onChange={(e) => setForm({ ...form, steps_text: e.target.value })} rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs" />
          </label>
          <label className="block text-sm">
            <span className="block font-semibold text-gray-700 mb-1">Scoring</span>
            <input value={form.scoring} onChange={(e) => setForm({ ...form, scoring: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="block font-semibold text-gray-700 mb-1">Win condition</span>
            <input value={form.win_condition} onChange={(e) => setForm({ ...form, win_condition: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="block font-semibold text-gray-700 mb-1">Stop signs (one per line)</span>
            <textarea value={form.stop_signs_text} onChange={(e) => setForm({ ...form, stop_signs_text: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs" />
          </label>
          <label className="block text-sm">
            <span className="block font-semibold text-gray-700 mb-1">Coaching notes</span>
            <textarea value={form.coaching_notes} onChange={(e) => setForm({ ...form, coaching_notes: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving || !form.name} className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Game'}
          </button>
        </div>
      </div>
    </div>
  )
}

function stringifyList(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map(String).join('\n')
}

function parseList(text: string): string[] {
  return text.split('\n').map((s) => s.trim()).filter(Boolean)
}
