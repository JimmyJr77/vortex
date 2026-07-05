import { create } from 'zustand'
import type { ValidationResult, Workout, WorkoutBlock, WorkoutItem, WorkoutType } from './types'
import { SESSION_PHASE_ORDER } from './taxonomy'

function emptyBlock(label = 'Block', phaseKey?: string): WorkoutBlock {
  return {
    label,
    block_format: 'straight_sets',
    rounds: 1,
    rest_between_rounds_seconds: 0,
    phase_key: phaseKey ?? null,
    items: [],
  }
}

function phaseBlocksFromPlan(plan: Array<{ phaseKey?: string; phase?: string; minutes: number; label?: string }>): WorkoutBlock[] {
  return plan.map((p) => {
    const phaseKey = p.phaseKey ?? p.phase ?? ''
    return {
      ...emptyBlock(p.label ?? phaseKey, phaseKey),
      minutes_budget: p.minutes,
      label: p.label ?? phaseKey,
    }
  })
}

function emptyWorkout(type: WorkoutType = 'workout'): Workout {
  return {
    title: '',
    type,
    sport_id: null,
    description: '',
    target_minutes: null,
    notes: '',
    blocks: [emptyBlock(type === 'warmup' ? 'Warmup' : 'Main Work')],
  }
}

/** Mirrors the server-side computeWorkoutMinutes() so the clock is instant. */
export function itemSeconds(item: WorkoutItem): number {
  const sets = Number(item.sets) || 1
  const work = Number(item.work_seconds) || Number(item.est_seconds_per_set) || 45
  const rest = Number(item.rest_seconds) || 0
  return sets * work + sets * rest
}

export function blockSeconds(block: WorkoutBlock): number {
  const rounds = Number(block.rounds) || 1
  const restBetween = Number(block.rest_between_rounds_seconds) || 0
  const itemsSeconds = block.items.reduce((sum, item) => sum + itemSeconds(item), 0)
  return rounds * itemsSeconds + restBetween * Math.max(rounds - 1, 0)
}

export function workoutSeconds(workout: Workout): number {
  return workout.blocks.reduce((sum, block) => sum + blockSeconds(block), 0)
}

interface BuilderState {
  workout: Workout
  dirty: boolean
  wizardComplete: boolean
  validation: ValidationResult | null
  setWorkout: (workout: Workout) => void
  reset: (type?: WorkoutType) => void
  patchWorkout: (patch: Partial<Workout>) => void
  applyPhasePlan: (plan: Array<{ phaseKey?: string; phase?: string; minutes: number; label?: string }>) => void
  setValidation: (validation: ValidationResult | null) => void
  addBlock: () => void
  updateBlock: (index: number, patch: Partial<WorkoutBlock>) => void
  removeBlock: (index: number) => void
  addItem: (blockIndex: number, item: WorkoutItem) => void
  updateItem: (blockIndex: number, itemIndex: number, patch: Partial<WorkoutItem>) => void
  removeItem: (blockIndex: number, itemIndex: number) => void
  moveItem: (blockIndex: number, itemIndex: number, dir: -1 | 1) => void
  reorderItem: (blockIndex: number, from: number, to: number) => void
  setWizardComplete: (complete: boolean) => void
}

export const useCoachBuilderStore = create<BuilderState>((set) => ({
  workout: emptyWorkout(),
  dirty: false,
  wizardComplete: false,
  validation: null,
  setWorkout: (workout) => set({ workout, dirty: false, wizardComplete: Boolean(workout.phase_plan_json?.length) }),
  reset: (type = 'workout') => set({ workout: emptyWorkout(type), dirty: false, wizardComplete: false, validation: null }),
  patchWorkout: (patch) => set((s) => ({ workout: { ...s.workout, ...patch }, dirty: true })),
  applyPhasePlan: (plan) =>
    set((s) => {
      const normalized = plan.map((p) => ({
        phaseKey: p.phaseKey ?? p.phase ?? '',
        minutes: p.minutes,
        label: p.label,
      })).filter((p) => p.phaseKey)
      return {
        workout: {
          ...s.workout,
          phase_plan_json: normalized,
          blocks: phaseBlocksFromPlan(normalized),
          target_minutes: normalized.reduce((sum, p) => sum + (Number(p.minutes) || 0), 0),
        },
        dirty: true,
        wizardComplete: true,
      }
    }),
  setValidation: (validation) => set({ validation }),
  setWizardComplete: (wizardComplete) => set({ wizardComplete }),
  addBlock: () => set((s) => ({ workout: { ...s.workout, blocks: [...s.workout.blocks, emptyBlock(`Block ${s.workout.blocks.length + 1}`)] }, dirty: true })),
  updateBlock: (index, patch) =>
    set((s) => ({
      workout: { ...s.workout, blocks: s.workout.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)) },
      dirty: true,
    })),
  removeBlock: (index) => set((s) => ({ workout: { ...s.workout, blocks: s.workout.blocks.filter((_, i) => i !== index) }, dirty: true })),
  addItem: (blockIndex, item) =>
    set((s) => ({
      workout: {
        ...s.workout,
        blocks: s.workout.blocks.map((b, i) => (i === blockIndex ? { ...b, items: [...b.items, item] } : b)),
      },
      dirty: true,
    })),
  updateItem: (blockIndex, itemIndex, patch) =>
    set((s) => ({
      workout: {
        ...s.workout,
        blocks: s.workout.blocks.map((b, i) =>
          i === blockIndex ? { ...b, items: b.items.map((it, j) => (j === itemIndex ? { ...it, ...patch } : it)) } : b,
        ),
      },
      dirty: true,
    })),
  removeItem: (blockIndex, itemIndex) =>
    set((s) => ({
      workout: {
        ...s.workout,
        blocks: s.workout.blocks.map((b, i) => (i === blockIndex ? { ...b, items: b.items.filter((_, j) => j !== itemIndex) } : b)),
      },
      dirty: true,
    })),
  moveItem: (blockIndex, itemIndex, dir) =>
    set((s) => ({
      workout: {
        ...s.workout,
        blocks: s.workout.blocks.map((b, i) => {
          if (i !== blockIndex) return b
          const items = [...b.items]
          const target = itemIndex + dir
          if (target < 0 || target >= items.length) return b
          ;[items[itemIndex], items[target]] = [items[target], items[itemIndex]]
          return { ...b, items }
        }),
      },
      dirty: true,
    })),
  reorderItem: (blockIndex, from, to) =>
    set((s) => ({
      workout: {
        ...s.workout,
        blocks: s.workout.blocks.map((b, i) => {
          if (i !== blockIndex) return b
          if (from === to || from < 0 || to < 0 || from >= b.items.length || to >= b.items.length) return b
          const items = [...b.items]
          const [moved] = items.splice(from, 1)
          items.splice(to, 0, moved)
          return { ...b, items }
        }),
      },
      dirty: true,
    })),
}))

export { SESSION_PHASE_ORDER, emptyBlock, phaseBlocksFromPlan }
