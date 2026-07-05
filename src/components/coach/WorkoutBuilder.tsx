import { useCallback, useEffect, useState } from 'react'
import { Clock, Loader2, Plus, Save, Search, Trash2, ChevronUp, ChevronDown, FolderOpen, GripVertical, X, Pencil } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import { useCoachBuilderStore, blockSeconds, workoutSeconds } from '../../coach/useCoachBuilderStore'
import type { BlockFormat, Exercise, Workout, WorkoutType } from '../../coach/types'

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

const BLOCK_FORMAT_LABELS: Record<BlockFormat, string> = {
  straight_sets: 'Straight Sets',
  circuit: 'Circuit',
  amrap: 'AMRAP',
  emom: 'EMOM',
  for_time: 'For Time',
  stations: 'Stations',
}

export default function WorkoutBuilder({ defaultType = 'workout' }: { defaultType?: WorkoutType }) {
  const { taxonomy } = useTaxonomy()
  const { workout, patchWorkout, addBlock, updateBlock, removeBlock, addItem, updateItem, removeItem, moveItem, reorderItem, reset, setWorkout } =
    useCoachBuilderStore()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickerBlock, setPickerBlock] = useState<number | null>(null)
  const [saved, setSaved] = useState<Workout[]>([])
  const [previewWorkout, setPreviewWorkout] = useState<Workout | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (!workout.title && workout.blocks.length <= 1 && workout.type !== defaultType) {
      reset(defaultType)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultType])

  const [minMinutes, setMinMinutes] = useState<number | ''>('')
  const [maxMinutes, setMaxMinutes] = useState<number | ''>('')
  const [drag, setDrag] = useState<{ block: number; index: number } | null>(null)

  const loadSaved = useCallback(async () => {
    try {
      const params = new URLSearchParams({ type: defaultType })
      if (minMinutes !== '') params.set('minMinutes', String(minMinutes))
      if (maxMinutes !== '') params.set('maxMinutes', String(maxMinutes))
      const data = await coachFetch<Workout[]>(`/api/coach/workouts?${params.toString()}`)
      setSaved(data)
    } catch {
      /* non-fatal */
    }
  }, [defaultType, minMinutes, maxMinutes])

  useEffect(() => {
    void loadSaved()
  }, [loadSaved])

  const totalSeconds = workoutSeconds(workout)

  const save = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const body = JSON.stringify({ ...workout, type: workout.type || defaultType })
      const result = workout.id
        ? await coachFetch<Workout>(`/api/coach/workouts/${workout.id}`, { method: 'PUT', body })
        : await coachFetch<Workout>('/api/coach/workouts', { method: 'POST', body })
      setWorkout(result)
      setMessage('Saved.')
      void loadSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workout')
    } finally {
      setSaving(false)
    }
  }

  const openPreview = async (id?: number) => {
    if (!id) return
    setPreviewLoading(true)
    setError(null)
    try {
      const data = await coachFetch<Workout>(`/api/coach/workouts/${id}`)
      setPreviewWorkout(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open workout')
    } finally {
      setPreviewLoading(false)
    }
  }

  const loadIntoBuilder = (workout: Workout) => {
    setWorkout(workout)
    setPreviewWorkout(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 capitalize">{defaultType} Builder</h2>
          <p className="text-sm text-gray-500">Assemble blocks and exercises; the clock updates live.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black text-white rounded-lg px-4 py-2">
            <Clock className="w-4 h-4 text-vortex-red" />
            <span className="font-bold text-lg">{fmt(totalSeconds)}</span>
            {workout.target_minutes ? <span className="text-xs text-gray-300">/ {workout.target_minutes}m target</span> : null}
          </div>
          <button type="button" onClick={() => reset(defaultType)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">New</button>
          <button type="button" onClick={() => void save()} disabled={saving || !workout.title} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {message && <div className="rounded-lg bg-green-50 text-green-700 px-4 py-2 text-sm">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm md:col-span-2">
              <span className="block font-semibold text-gray-700 mb-1">Title</span>
              <input value={workout.title} onChange={(e) => patchWorkout({ title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder={`${defaultType} name`} />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Sport</span>
              <select value={workout.sport_id ?? ''} onChange={(e) => patchWorkout({ sport_id: e.target.value ? Number(e.target.value) : null })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Universal</option>
                {taxonomy?.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Target minutes</span>
              <input type="number" value={workout.target_minutes ?? ''} onChange={(e) => patchWorkout({ target_minutes: e.target.value ? Number(e.target.value) : null })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
          </div>

          {workout.blocks.map((block, bi) => (
            <div key={bi} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <input
                  value={block.label ?? ''}
                  onChange={(e) => updateBlock(bi, { label: e.target.value })}
                  className="font-semibold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-vortex-red outline-none"
                  placeholder="Block label"
                />
                <div className="flex items-center gap-2 text-xs">
                  <select value={block.block_format} onChange={(e) => updateBlock(bi, { block_format: e.target.value as never })} className="border border-gray-300 rounded px-2 py-1">
                    <option value="straight_sets">Straight Sets</option>
                    <option value="circuit">Circuit</option>
                    <option value="amrap">AMRAP</option>
                    <option value="emom">EMOM</option>
                    <option value="for_time">For Time</option>
                    <option value="stations">Stations</option>
                  </select>
                  <label className="flex items-center gap-1">Rounds
                    <input type="number" value={block.rounds} min={1} onChange={(e) => updateBlock(bi, { rounds: Number(e.target.value) || 1 })} className="w-14 border border-gray-300 rounded px-2 py-1" />
                  </label>
                  <span className="text-gray-500">{fmt(blockSeconds(block))}</span>
                  <button type="button" onClick={() => removeBlock(bi)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {block.items.map((item, ii) => (
                  <div
                    key={ii}
                    draggable
                    onDragStart={() => setDrag({ block: bi, index: ii })}
                    onDragOver={(e) => { if (drag && drag.block === bi) e.preventDefault() }}
                    onDrop={(e) => { e.preventDefault(); if (drag && drag.block === bi) reorderItem(bi, drag.index, ii); setDrag(null) }}
                    onDragEnd={() => setDrag(null)}
                    className={`grid grid-cols-[16px_1fr_repeat(3,56px)_auto] gap-2 items-center text-sm rounded ${drag && drag.block === bi && drag.index === ii ? 'opacity-50' : ''}`}
                  >
                    <span className="cursor-grab text-gray-300 hover:text-gray-500" title="Drag to reorder"><GripVertical className="w-4 h-4" /></span>
                    <div className="font-medium text-gray-800 truncate">{item.exercise_name ?? 'Exercise'}</div>
                    <input type="number" value={item.sets ?? ''} placeholder="sets" onChange={(e) => updateItem(bi, ii, { sets: e.target.value ? Number(e.target.value) : null })} className="border border-gray-300 rounded px-2 py-1" />
                    <input type="number" value={item.reps ?? ''} placeholder="reps" onChange={(e) => updateItem(bi, ii, { reps: e.target.value ? Number(e.target.value) : null })} className="border border-gray-300 rounded px-2 py-1" />
                    <input type="number" value={item.rest_seconds ?? ''} placeholder="rest" onChange={(e) => updateItem(bi, ii, { rest_seconds: e.target.value ? Number(e.target.value) : null })} className="border border-gray-300 rounded px-2 py-1" />
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveItem(bi, ii, -1)} className="text-gray-300 hover:text-gray-700"><ChevronUp className="w-4 h-4" /></button>
                      <button type="button" onClick={() => moveItem(bi, ii, 1)} className="text-gray-300 hover:text-gray-700"><ChevronDown className="w-4 h-4" /></button>
                      <button type="button" onClick={() => removeItem(bi, ii)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setPickerBlock(bi)} className="flex items-center gap-1 text-sm text-vortex-red font-medium mt-1">
                  <Plus className="w-4 h-4" /> Add exercise
                </button>
              </div>
            </div>
          ))}

          <button type="button" onClick={addBlock} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:border-vortex-red hover:text-vortex-red">
            <Plus className="w-4 h-4" /> Add block
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 h-fit">
          <div className="flex items-center gap-2 font-semibold text-gray-700 mb-2"><FolderOpen className="w-4 h-4" /> Saved {defaultType}s</div>
          <div className="flex items-center gap-2 mb-2 text-xs">
            <input type="number" value={minMinutes} onChange={(e) => setMinMinutes(e.target.value ? Number(e.target.value) : '')} placeholder="min" className="w-16 border border-gray-300 rounded px-2 py-1" />
            <span className="text-gray-400">-</span>
            <input type="number" value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value ? Number(e.target.value) : '')} placeholder="max" className="w-16 border border-gray-300 rounded px-2 py-1" />
            <span className="text-gray-400">min</span>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {saved.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => void openPreview(w.id)}
                className="w-full text-left border border-gray-100 rounded-lg px-3 py-2.5 hover:bg-gray-50 hover:border-gray-200 transition-colors"
              >
                <div className="font-medium text-gray-800">{w.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {w.sport_name ?? 'Universal'} · {w.computed_minutes ?? 0} min
                </div>
              </button>
            ))}
            {saved.length === 0 && <div className="text-sm text-gray-500">None saved yet.</div>}
          </div>
        </div>
      </div>

      {previewLoading && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl px-5 py-4 flex items-center gap-2 text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading workout...
          </div>
        </div>
      )}

      {previewWorkout && (
        <WorkoutPreviewModal
          workout={previewWorkout}
          onClose={() => setPreviewWorkout(null)}
          onEdit={() => loadIntoBuilder(previewWorkout)}
        />
      )}

      {pickerBlock !== null && (
        <ExercisePicker
          onClose={() => setPickerBlock(null)}
          onPick={(ex) => {
            addItem(pickerBlock, {
              exercise_id: ex.id,
              exercise_name: ex.name,
              sets: ex.default_sets ?? 3,
              reps: ex.default_reps ?? null,
              rest_seconds: ex.default_rest_seconds ?? 30,
              work_seconds: ex.default_work_seconds ?? null,
              est_seconds_per_set: ex.est_seconds_per_set,
            })
            setPickerBlock(null)
          }}
        />
      )}
    </div>
  )
}

function WorkoutPreviewModal({
  workout,
  onClose,
  onEdit,
}: {
  workout: Workout
  onClose: () => void
  onEdit: () => void
}) {
  const totalSeconds = workoutSeconds(workout)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{workout.title}</h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
              <span className="capitalize">{workout.type}</span>
              <span>{workout.sport_name ?? 'Universal'}</span>
              <span>{fmt(totalSeconds)} total</span>
              {workout.computed_minutes != null && <span>{workout.computed_minutes} min computed</span>}
              {workout.target_minutes != null && <span>{workout.target_minutes} min target</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {workout.description && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{workout.description}</p>
            </div>
          )}
          {workout.notes && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{workout.notes}</p>
            </div>
          )}

          {workout.blocks.map((block, bi) => (
            <div key={block.id ?? bi} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="font-semibold text-gray-900">{block.label || `Block ${bi + 1}`}</div>
                <span className="text-xs text-gray-500">{fmt(blockSeconds(block))}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                <span>{BLOCK_FORMAT_LABELS[block.block_format] ?? block.block_format}</span>
                <span>{block.rounds} round{block.rounds === 1 ? '' : 's'}</span>
                {block.rest_between_rounds_seconds > 0 && (
                  <span>{block.rest_between_rounds_seconds}s rest between rounds</span>
                )}
                {block.cap_minutes != null && <span>{block.cap_minutes} min cap</span>}
              </div>
              <ul className="mt-3 space-y-2">
                {block.items.map((item, ii) => (
                  <li key={item.id ?? ii} className="text-sm border-t border-gray-100 first:border-t-0 first:pt-0 pt-2">
                    <div className="font-medium text-gray-800">{item.exercise_name ?? 'Exercise'}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                      {item.sets != null && <span>{item.sets} sets</span>}
                      {item.reps != null && <span>{item.reps} reps</span>}
                      {item.work_seconds != null && <span>{item.work_seconds}s work</span>}
                      {item.rest_seconds != null && <span>{item.rest_seconds}s rest</span>}
                      {item.load && <span>Load: {item.load}</span>}
                      {item.tempo && <span>Tempo: {item.tempo}</span>}
                    </div>
                    {item.coaching_note && (
                      <p className="text-xs text-gray-600 mt-1 italic">{item.coaching_note}</p>
                    )}
                  </li>
                ))}
                {block.items.length === 0 && <li className="text-xs text-gray-400">No exercises in this block.</li>}
              </ul>
            </div>
          ))}
          {workout.blocks.length === 0 && <div className="text-sm text-gray-500">This workout has no blocks yet.</div>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">
            Close
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold"
          >
            <Pencil className="w-4 h-4" /> Edit in Builder
          </button>
        </div>
      </div>
    </div>
  )
}

function ExercisePicker({ onClose, onPick }: { onClose: () => void; onPick: (ex: Exercise) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await coachFetch<Exercise[]>(`/api/coach/exercises?q=${encodeURIComponent(q)}`)
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [q])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises..." className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm" />
          </div>
        </div>
        <div className="overflow-y-auto p-2">
          {loading && <div className="flex items-center gap-2 text-gray-500 text-sm p-3"><Loader2 className="w-4 h-4 animate-spin" /> Searching...</div>}
          {results.map((ex) => (
            <button key={ex.id} type="button" onClick={() => onPick(ex)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50">
              <div className="font-medium text-gray-800">{ex.name}</div>
              <div className="text-xs text-gray-500">{ex.sport_name ?? 'Universal'} · {ex.est_seconds_per_set}s/set</div>
            </button>
          ))}
          {!loading && results.length === 0 && <div className="text-sm text-gray-500 p-3">No matches.</div>}
        </div>
        <div className="p-3 border-t border-gray-100 text-right">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Close</button>
        </div>
      </div>
    </div>
  )
}
