import { setTimeout as delay } from 'node:timers/promises'
import { TAXONOMY_V2_FACETS } from '../taxonomyV2.js'
import { createProgrammingStaffRegistry } from '../programmingStaffRuntime.js'

export const syntheticInterpretationTaxonomy = () => Object.entries(TAXONOMY_V2_FACETS).flatMap(([facet_type, terms]) => terms.map((term, index) => ({
  id: index + 1, facet_type, key: term.key, name: term.name, domain: term.domain, allowed_scopes: term.scopes, status: 'active', sort_order: index, metadata_json: {},
})))

// Synthetic rows pass through the production snapshot and existing SQL catalog reader.
export function withSyntheticInterpretationTaxonomy(pool, taxonomy) {
  return { async connect() {
    const client = await pool.connect()
    return { async query(sql, values) {
      if (sql.includes('FROM coaching.taxonomy_term_v2\n')) return { rows: structuredClone(taxonomy) }
      if (sql.includes('FROM coaching.taxonomy_alias_v2 alias')) return { rows: [] }
      return client.query(sql, values)
    }, release: (error) => client.release(error) }
  } }
}

// Scripted model responses only: this harness does not implement or claim natural-language understanding.
export function scriptedInterpretationRegistry(base, state) {
  return createProgrammingStaffRegistry(base.list().map(({ id, role }) => {
    const capability = base.get(id, role)
    return { ...capability, async invoke(input, context) {
      if (role !== 'director' || input.task !== 'interpret_revision_controls') return capability.invoke(input, context)
      state.calls.push(input); state.inFlight++
      try {
        if (state.delayMs) await delay(state.delayMs, undefined, { signal: context.signal })
        return { output: { requestRevision: input.request.revision, summary: 'Review the proposed changes to the synthetic session.',
          questions: structuredClone(state.questions), operations: state.operations.map((entry) => ({ ...structuredClone(entry), instructionQuote: entry.instructionQuote ?? input.instruction })) },
          modelVersion: 'scripted-preview-interpreter', usage: { inputTokens: 100, outputTokens: 300 } }
      } finally { state.inFlight-- }
    } }
  }))
}
