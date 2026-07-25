import { useEffect, useState } from 'react'
import { AlertTriangle, FilePlus2, Loader2, RefreshCw, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { CanonicalCardEditor } from './CanonicalCardEditor'
import { CanonicalRelationshipPanel } from './CanonicalRelationshipPanel'
import { CanonicalCalibrationWorkspace } from './CanonicalCalibrationWorkspace'
import type { CanonicalCard, CanonicalCardStatus, CanonicalCardSummary } from './canonicalCardTypes'

const STATUSES: Array<CanonicalCardStatus | 'all'> = ['all', 'draft', 'review', 'published', 'deprecated', 'archived']

export function CanonicalCardLibraryPanel() {
  const [workspace, setWorkspace] = useState<'cards' | 'calibration'>('cards')
  const [cards, setCards] = useState<CanonicalCardSummary[]>([])
  const [status, setStatus] = useState<CanonicalCardStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorCard, setEditorCard] = useState<CanonicalCard | null | undefined>(undefined)
  const [aiNotes, setAiNotes] = useState('')
  const [aiDrafting, setAiDrafting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      if (search.trim()) params.set('search', search.trim())
      setCards(await coachFetch<CanonicalCardSummary[]>(`/api/coach/canonical/cards?${params}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load canonical cards.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // Search runs explicitly to avoid issuing a request for every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const edit = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      setEditorCard(await coachFetch<CanonicalCard>(`/api/coach/canonical/cards/${id}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open canonical card.')
    } finally {
      setLoading(false)
    }
  }

  const draftWithAi = async () => {
    if (aiNotes.trim().length < 20) return
    setAiDrafting(true)
    setError(null)
    try {
      const result = await coachFetch<{ draft: CanonicalCard }>('/api/coach/canonical/cards/ai-draft', {
        method: 'POST',
        body: JSON.stringify({ notes: aiNotes }),
      })
      setEditorCard(result.draft)
      setAiNotes('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create quarantined AI draft.')
    } finally {
      setAiDrafting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b border-gray-200">
        <button type="button" onClick={() => setWorkspace('cards')} className={`border-b-2 px-2 py-2 text-sm font-semibold ${workspace === 'cards' ? 'border-indigo-700 text-indigo-700' : 'border-transparent text-gray-500'}`}>Card governance</button>
        <button type="button" onClick={() => setWorkspace('calibration')} className={`border-b-2 px-2 py-2 text-sm font-semibold ${workspace === 'calibration' ? 'border-indigo-700 text-indigo-700' : 'border-transparent text-gray-500'}`}>Score calibration</button>
      </div>
      {workspace === 'calibration' ? <CanonicalCalibrationWorkspace /> : (
        <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-950"><ShieldCheck className="h-5 w-5 text-indigo-700" />Canonical card governance</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Author versioned cards, verify exact-match media, obtain independent review, and maintain explicit progression and substitution edges.</p>
        </div>
        <button type="button" onClick={() => setEditorCard(null)} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white"><FilePlus2 className="h-4 w-4" />New draft</button>
      </header>

      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Search canonical cards</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load() }} placeholder="Search name, slug, or family" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm" />
        </label>
        <select aria-label="Filter by lifecycle status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      <section className="rounded-xl border border-violet-200 bg-violet-50 p-4" aria-labelledby="ai-draft-heading">
        <h3 id="ai-draft-heading" className="flex items-center gap-2 font-semibold text-violet-950"><Sparkles className="h-4 w-4" />Quarantined AI draft assistant</h3>
        <p className="mt-1 text-xs text-violet-800">AI may structure coach notes, but it cannot approve media, publish a card, or exceed 60/100 inferred confidence. Every result opens as an unsaved draft.</p>
        <label className="mt-3 block text-sm text-violet-950">Coach source notes
          <textarea value={aiNotes} onChange={(event) => setAiNotes(event.target.value)} minLength={20} maxLength={4000} rows={3} placeholder="Describe the movement, intended athletes, delivery contexts, coaching cues, stop conditions, equipment, and any uncertainties." className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2" />
        </label>
        <button type="button" disabled={aiDrafting || aiNotes.trim().length < 20} onClick={() => void draftWithAi()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {aiDrafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Create unverified draft
        </button>
      </section>

      {error && <div role="alert" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white" aria-label="Canonical cards">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading canonical cards</div>
        ) : cards.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No canonical cards match this filter.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {cards.map((card) => (
              <button key={card.id} type="button" onClick={() => void edit(card.id)} className="grid w-full gap-2 px-4 py-3 text-left hover:bg-gray-50 md:grid-cols-[1fr_auto_auto] md:items-center">
                <span>
                  <span className="block font-semibold text-gray-950">{card.display_name}</span>
                  <span className="block text-xs text-gray-500">{card.family_key} · {card.slug}</span>
                </span>
                <span className="text-xs text-gray-600">{card.variant_count} variant(s) · {card.profile_count} profile(s)</span>
                <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${card.status === 'published' ? 'bg-emerald-100 text-emerald-800' : card.status === 'review' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-700'}`}>{card.status}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <CanonicalRelationshipPanel cards={cards} onChanged={() => void load()} />

      {editorCard !== undefined && (
        <CanonicalCardEditor
          source={editorCard}
          onClose={() => setEditorCard(undefined)}
          onSaved={(saved) => {
            setEditorCard(saved)
            void load()
          }}
        />
      )}
        </>
      )}
    </div>
  )
}
