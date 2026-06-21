import { useEffect, useMemo, useState } from 'react'
import { GitBranch, Loader2 } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import { useRosterMembers } from './useRosterMembers'

interface SkillNode {
  id: number
  name: string
  slug?: string | null
  sport_id?: number | null
  sport_name?: string | null
}
interface SkillEdge {
  exercise_id: number
  prerequisite_exercise_id: number
}
type Mastery = Record<string, { score: number; maxScore: number | null; status: 'mastered' | 'in_progress' }>
interface SkillTree {
  nodes: SkillNode[]
  edges: SkillEdge[]
  mastery: Mastery
}

const STATUS_STYLE: Record<string, string> = {
  mastered: 'border-green-300 bg-green-50 text-green-900',
  in_progress: 'border-amber-300 bg-amber-50 text-amber-900',
  locked: 'border-gray-200 bg-white text-gray-700',
}

export default function SkillTreePanel() {
  const { taxonomy } = useTaxonomy()
  const { members } = useRosterMembers()
  const [sportId, setSportId] = useState<number | ''>('')
  const [memberId, setMemberId] = useState<number | ''>('')
  const [tree, setTree] = useState<SkillTree | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (sportId !== '') params.set('sportId', String(sportId))
    if (memberId !== '') params.set('memberId', String(memberId))
    const qs = params.toString()
    coachFetch<SkillTree>(`/api/coach/skill-tree${qs ? `?${qs}` : ''}`)
      .then(setTree)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load skill tree'))
      .finally(() => setLoading(false))
  }, [sportId, memberId])

  // Group nodes into columns by prerequisite depth (longest path to a root).
  const { columns, prereqNames } = useMemo(() => {
    if (!tree) return { columns: [] as SkillNode[][], prereqNames: new Map<number, string[]>() }
    const nameById = new Map(tree.nodes.map((n) => [n.id, n.name]))
    const prereqsOf = new Map<number, number[]>()
    for (const e of tree.edges) {
      const list = prereqsOf.get(e.exercise_id) ?? []
      list.push(e.prerequisite_exercise_id)
      prereqsOf.set(e.exercise_id, list)
    }
    const depthCache = new Map<number, number>()
    const depthOf = (id: number, stack: Set<number>): number => {
      if (depthCache.has(id)) return depthCache.get(id)!
      const prereqs = prereqsOf.get(id) ?? []
      if (prereqs.length === 0 || stack.has(id)) {
        depthCache.set(id, 0)
        return 0
      }
      stack.add(id)
      const d = 1 + Math.max(...prereqs.map((p) => depthOf(p, stack)))
      stack.delete(id)
      depthCache.set(id, d)
      return d
    }
    const byDepth = new Map<number, SkillNode[]>()
    let maxDepth = 0
    for (const n of tree.nodes) {
      const d = depthOf(n.id, new Set())
      maxDepth = Math.max(maxDepth, d)
      const list = byDepth.get(d) ?? []
      list.push(n)
      byDepth.set(d, list)
    }
    const cols: SkillNode[][] = []
    for (let d = 0; d <= maxDepth; d++) {
      cols.push((byDepth.get(d) ?? []).sort((a, b) => a.name.localeCompare(b.name)))
    }
    const names = new Map<number, string[]>()
    for (const [child, prereqs] of prereqsOf) {
      names.set(child, prereqs.map((p) => nameById.get(p) ?? `#${p}`))
    }
    return { columns: cols, prereqNames: names }
  }, [tree])

  const statusFor = (id: number): keyof typeof STATUS_STYLE => {
    if (memberId === '') return 'locked'
    return tree?.mastery[String(id)]?.status ?? 'locked'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><GitBranch className="w-6 h-6 text-vortex-red" /> Skill Tree</h2>
          <p className="text-sm text-gray-500">Prerequisite progressions — what unlocks what. Pick an athlete to overlay mastery.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={sportId} onChange={(e) => setSportId(e.target.value ? Number(e.target.value) : '')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All sports</option>
            {taxonomy?.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={memberId} onChange={(e) => setMemberId(e.target.value ? Number(e.target.value) : '')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">No athlete overlay</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      {memberId !== '' && (
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-green-300 bg-green-50" /> Mastered</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-amber-300 bg-amber-50" /> In progress</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-gray-200 bg-white" /> Not started</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading skill tree…</div>
      ) : !tree || tree.nodes.length === 0 ? (
        <div className="text-sm text-gray-500 py-12 text-center bg-white border border-gray-200 rounded-xl">No exercises yet. Add prerequisites in the Library to grow the tree.</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {columns.map((col, depth) => (
            <div key={depth} className="min-w-[200px] flex-shrink-0">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {depth === 0 ? 'Foundations' : `Level ${depth}`}
              </div>
              <div className="space-y-2">
                {col.map((node) => {
                  const status = statusFor(node.id)
                  const prereqs = prereqNames.get(node.id) ?? []
                  const grade = tree.mastery[String(node.id)]
                  return (
                    <div key={node.id} className={`rounded-lg border p-3 ${STATUS_STYLE[status]}`}>
                      <div className="font-semibold text-sm">{node.name}</div>
                      {node.sport_name && <div className="text-[11px] opacity-70">{node.sport_name}</div>}
                      {memberId !== '' && grade && (
                        <div className="text-[11px] mt-1 font-medium">
                          {grade.score}{grade.maxScore ? ` / ${grade.maxScore}` : ''}
                        </div>
                      )}
                      {prereqs.length > 0 && (
                        <div className="text-[11px] mt-1.5 opacity-70">After: {prereqs.join(', ')}</div>
                      )}
                    </div>
                  )
                })}
                {col.length === 0 && <div className="text-xs text-gray-400">—</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
