import { immutableProgrammingValue } from './workoutProgrammingRequest.js'

export class ProgrammingStaffError extends Error {
  constructor(code, message) { super(message); this.name = 'ProgrammingStaffError'; this.code = code }
}

/** Registration is server-owned; role alone grants no database or approval tools. */
export function createProgrammingStaffRegistry(definitions = []) {
  const capabilities = new Map()
  const register = (definition) => {
    if (!definition || !/^[a-z0-9][a-z0-9_/-]{0,79}$/.test(definition.id) || typeof definition.role !== 'string'
      || !definition.role || typeof definition.version !== 'string' || !definition.version || typeof definition.invoke !== 'function') {
      throw new TypeError('A capability requires an ID, role, version and invoke function')
    }
    if (capabilities.has(definition.id)) throw new TypeError(`Duplicate capability ${definition.id}`)
    const sourceReferences = definition.sourceReferences ?? []
    if (!Array.isArray(sourceReferences) || sourceReferences.length > 30 || sourceReferences.some((ref) =>
      !ref || typeof ref.id !== 'string' || !ref.id || typeof ref.title !== 'string' || !ref.title
      || typeof ref.url !== 'string' || !/^https:\/\//.test(ref.url))
      || new Set(sourceReferences.map((ref) => ref.id)).size !== sourceReferences.length) throw new TypeError('Capability source references require unique IDs, titles and HTTPS URLs')
    capabilities.set(definition.id, Object.freeze({ id: definition.id, role: definition.role, version: definition.version, invoke: definition.invoke,
      sourceReferences: immutableProgrammingValue(structuredClone(sourceReferences)) }))
  }
  definitions.forEach(register)
  return Object.freeze({
    register,
    get(id, expectedRole) {
      const capability = capabilities.get(id)
      if (!capability) throw new ProgrammingStaffError('capability_unavailable', `Capability ${id} is unavailable`)
      if (capability.role !== expectedRole) throw new ProgrammingStaffError('authority_violation', `${id} is not registered for ${expectedRole}`)
      return capability
    },
    list: () => [...capabilities.values()].map(({ id, role, version }) => ({ id, role, version })),
  })
}

/** Bounded execution. No hidden model retries, and no model output can finalize a run. */
export function createProgrammingStaffRun(registry, options = {}) {
  const limits = { maxCalls: 5, timeoutMs: 60000, perCallTimeoutMs: 20000, maxOutputTokens: 6000, perCallOutputTokens: 1600, maxInputCharacters: 200000, ...options }
  const externalSignal = limits.signal
  delete limits.signal
  if (externalSignal !== undefined && (typeof externalSignal?.aborted !== 'boolean'
    || typeof externalSignal.addEventListener !== 'function' || typeof externalSignal.removeEventListener !== 'function')) throw new TypeError('signal must be an AbortSignal')
  if (Object.keys(limits).some((key) => !['maxCalls', 'timeoutMs', 'perCallTimeoutMs', 'maxOutputTokens', 'perCallOutputTokens', 'maxInputCharacters'].includes(key))) throw new TypeError('Unknown programming run limit')
  for (const [key, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${key} must be a positive integer`)
  const startedAt = Date.now()
  const calls = []
  let outputTokensReserved = 0
  let active = false
  const budgetError = (message) => new ProgrammingStaffError('budget_exhausted', message)
  return Object.freeze({
    async call({ capabilityId, role, input, outputSchema, parseOutput }) {
      if (active) throw new ProgrammingStaffError('concurrent_staff_call', 'Use ordered capability calls within one session revision')
      if (externalSignal?.aborted) throw new ProgrammingStaffError('canceled', 'Programming run was canceled')
      const remainingMs = limits.timeoutMs - (Date.now() - startedAt)
      if (remainingMs <= 0) throw new ProgrammingStaffError('deadline_exceeded', 'Programming run deadline exceeded')
      if (calls.length >= limits.maxCalls) throw budgetError('Programming capability-call budget exhausted')
      const maxOutputTokens = Math.min(limits.perCallOutputTokens, limits.maxOutputTokens - outputTokensReserved)
      if (maxOutputTokens <= 0) throw budgetError('Programming output-token budget exhausted')
      const capability = registry.get(capabilityId, role)
      const payload = immutableProgrammingValue(structuredClone(input))
      if (JSON.stringify(payload).length > limits.maxInputCharacters) throw budgetError('Programming capability input exceeds configured size')
      if (typeof parseOutput !== 'function') throw new TypeError('A runtime output parser is required')
      const controller = new AbortController()
      const entry = { capabilityId, role, capabilityVersion: capability.version, status: 'running', startedAt: new Date().toISOString(),
        latencyMs: 0, modelVersion: null, usage: null, errorCode: null }
      const callStart = Date.now()
      let timer
      let onAbort
      calls.push(entry)
      outputTokensReserved += maxOutputTokens
      active = true
      try {
        const canceled = new Promise((_, reject) => {
          onAbort = () => {
            controller.abort()
            reject(new ProgrammingStaffError('canceled', 'Programming run was canceled'))
          }
          externalSignal?.addEventListener('abort', onAbort, { once: true })
          timer = setTimeout(() => {
            controller.abort()
            reject(new ProgrammingStaffError('deadline_exceeded', `Capability ${capabilityId} timed out`))
          }, Math.min(remainingMs, limits.perCallTimeoutMs))
        })
        const response = await Promise.race([
          Promise.resolve().then(() => capability.invoke(payload, { signal: controller.signal, maxOutputTokens, outputSchema })),
          canceled,
        ])
        if (externalSignal?.aborted) throw new ProgrammingStaffError('canceled', 'Programming run was canceled')
        if (!response || !Object.hasOwn(response, 'output')) throw new ProgrammingStaffError('invalid_output', 'Capability did not return structured output')
        if (typeof response.modelVersion === 'string') entry.modelVersion = response.modelVersion.slice(0, 200)
        if (response.usage != null) {
          const { inputTokens, outputTokens } = response.usage
          if (![inputTokens, outputTokens].every((number) => Number.isSafeInteger(number) && number >= 0)) {
            throw new ProgrammingStaffError('invalid_usage', 'Capability usage must contain nonnegative token counts')
          }
          entry.usage = { inputTokens, outputTokens }
          if (outputTokens > maxOutputTokens) throw budgetError('Capability exceeded its output-token allocation')
          outputTokensReserved -= maxOutputTokens - outputTokens
        }
        let parsed
        try { parsed = parseOutput(response.output) } catch (error) {
          throw new ProgrammingStaffError('invalid_output', error.message)
        }
        entry.status = 'validated'
        return immutableProgrammingValue(structuredClone(parsed))
      } catch (error) {
        entry.status = 'failed'
        const failure = error instanceof ProgrammingStaffError ? error : new ProgrammingStaffError('capability_failed',
          error instanceof Error ? error.message : 'Capability execution failed')
        entry.errorCode = failure.code
        throw failure
      } finally {
        clearTimeout(timer)
        externalSignal?.removeEventListener('abort', onAbort)
        entry.latencyMs = Date.now() - callStart
        active = false
      }
    },
    telemetry: () => immutableProgrammingValue({ calls: structuredClone(calls), elapsedMs: Date.now() - startedAt, outputTokensReserved }),
  })
}
