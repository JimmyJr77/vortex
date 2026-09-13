import { randomUUID } from 'node:crypto'
import { storageFixtures, storageSourcePool, memoryStorageDatabase } from './workoutProgrammingStorageFixtures.js'
import { persistWorkoutProgrammingRun } from '../workoutProgrammingRepository.js'
import { createProgrammingStaffRegistry } from '../programmingStaffRuntime.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'

export function modificationRequest(saved, patch = {}) {
  const { assumptions, ...original } = structuredClone(saved.workout.intent)
  return { ...original, requestId: randomUUID(), revision: randomUUID(), mode: 'modify_existing', instruction: 'Revise strength and account for its effects on Capacity.',
    modification: { workoutId: saved.persistedWorkoutId, expectedRevision: saved.workout.revision, regenerateComponentKeys: ['strength'], blockEdits: [] }, ...patch }
}

// Shared synthetic model behavior for backend and browser tests; production contracts still parse every result.
export function modificationFixtureRegistry(base, { transformBuilder, transformPrepare, calls = [] } = {}) {
  const selection = (choice, block) => ({ ...choice, sourceBlockId: block?.blockId ?? null,
    deliveryProfileId: block?.edit?.exercise?.deliveryProfileId ?? (block?.lockedFields.includes('exercises') ? block.ref.deliveryProfileId : choice.deliveryProfileId),
    programmingMethodId: block?.edit?.programmingMethodId ?? (block?.lockedFields.includes('method') ? block.programmingMethodId : choice.programmingMethodId) })
  return createProgrammingStaffRegistry(base.list().map(({ id, role }) => {
    const capability = base.get(id, role)
    return { ...capability, async invoke(input, context) {
      calls.push({ role, input })
      const result = await capability.invoke(input, context)
      if (!input.modification) return result
      if (role === 'session_builder') {
        result.output.components = result.output.components.map((component) => {
          if (input.modification.preservedComponentKeys.includes(component.key)) return structuredClone(input.modification.previousProposal.components.find((entry) => entry.key === component.key))
          const source = input.modification.sourceBlocks.filter((block) => block.componentKey === component.key)
          return { ...component, selections: component.selections.map((choice, index) => {
            const block = source[index]
            return selection(choice, block)
          }) }
        })
        transformBuilder?.(result.output, input)
      }
      if (role === 'prepare_access') {
        const source = input.modification.sourceBlocks.filter((block) => block.componentKey === 'prepare_and_access')
        result.output.selections = result.output.selections.map((choice, index) => selection(choice, source[index]))
        transformPrepare?.(result.output, input)
      }
      return result
    } }
  }))
}

export async function modificationFixtures(options = {}) {
  const fixtures = await storageFixtures()
  const database = memoryStorageDatabase()
  const pool = storageSourcePool(database, fixtures)
  const saved = await persistWorkoutProgrammingRun({ pool, context: SCOPE, workflow: fixtures.workflow })
  const calls = []
  const registry = modificationFixtureRegistry(fixtures.registry, { ...options, calls })
  return { fixtures, database, pool, saved, registry, calls }
}
