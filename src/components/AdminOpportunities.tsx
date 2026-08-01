import { useEffect, useMemo, useState } from 'react'
import { Bot, ExternalLink, Mail, MapPin, Pencil, Plus, Search, Star, Target, X } from 'lucide-react'
import { adminApiRequest } from '../utils/api'

type Opportunity = {
  id: number; name: string; category: string; kind: string; status: string; priority: string
  location: string; eventDate: string | null; deadline: string | null; contactName: string
  contactEmail: string; contactPhone: string; websiteUrl: string; sourceUrl: string
  audience: string; supportOffer: string; edgeStrategy: string; notes: string; lastVerifiedAt: string
  opportunityValue: number; isFavorite: boolean
}
type OpportunityDraft = Omit<Opportunity, 'id' | 'lastVerifiedAt'>
const blank: OpportunityDraft = { name: '', category: 'Community events', kind: 'event', status: 'new', priority: 'medium', location: '', eventDate: null, deadline: null, contactName: '', contactEmail: '', contactPhone: '', websiteUrl: '', sourceUrl: '', audience: '', supportOffer: '', edgeStrategy: '', notes: '', opportunityValue: 0, isFavorite: false }
const fmt = (v: string | null) => v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : ''

export default function AdminOpportunities() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'value' | 'date' | 'favorite'>('value')
  const [editing, setEditing] = useState<(Opportunity | OpportunityDraft) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aiEnabled, setAiEnabled] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [asking, setAsking] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminApiRequest('/api/admin/opportunities')
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Unable to load')
      setItems(json.data.opportunities); setCategories(json.data.categories); setAiEnabled(json.data.aiEnabled); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const visible = useMemo(() => items.filter(item => {
    if (category !== 'All' && item.category !== category) return false
    const needle = query.toLowerCase()
    return !needle || [item.name, item.location, item.audience, item.contactName].some(v => v.toLowerCase().includes(needle))
  }).sort((a, b) => sort === 'date'
    ? (b.eventDate || '9999').localeCompare(a.eventDate || '9999')
    : sort === 'favorite' ? Number(b.isFavorite) - Number(a.isFavorite) || b.opportunityValue - a.opportunityValue
      : b.opportunityValue - a.opportunityValue || Number(b.isFavorite) - Number(a.isFavorite)), [items, category, query, sort])

  const toggleFavorite = async (item: Opportunity) => {
    try {
      const res = await adminApiRequest(`/api/admin/opportunities/${item.id}/favorite`, { method: 'PATCH', body: JSON.stringify({ isFavorite: !item.isFavorite }) })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Unable to update favorite')
      setItems(current => current.map(row => row.id === item.id ? json.data : row))
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update favorite') }
  }

  const save = async (markVerified = false) => {
    if (!editing?.name.trim()) return
    try {
      const exists = 'id' in editing
      const res = await adminApiRequest(exists ? `/api/admin/opportunities/${editing.id}` : '/api/admin/opportunities', { method: exists ? 'PUT' : 'POST', body: JSON.stringify({ ...editing, markVerified }) })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Unable to save')
      setEditing(null); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save') }
  }
  const ask = async () => {
    if (!question.trim()) return
    setAsking(true); setAnswer('')
    try {
      const res = await adminApiRequest('/api/admin/opportunities/ai-support', { method: 'POST', body: JSON.stringify({ question }) })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'AI unavailable')
      setAnswer(json.data.answer)
    } catch (e) { setAnswer(e instanceof Error ? e.message : 'AI unavailable') } finally { setAsking(false) }
  }

  return <div className="space-y-5">
    <section className="rounded-2xl bg-gradient-to-br from-gray-950 to-red-950 p-6 text-white">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-300"><Target className="h-4 w-4" /> Opportunity intelligence</div><h2 className="mt-2 text-3xl font-bold">Where Vortex can help next</h2><p className="mt-2 text-sm text-gray-300">Events, venues, contacts, support ideas and a practical edge—organized in one editable pipeline.</p></div><button onClick={() => setEditing({ ...blank })} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold"><Plus className="h-4 w-4" /> Add opportunity</button></div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">{[['Open', items.filter(i => !['won','passed'].includes(i.status)).length], ['High priority', items.filter(i => i.priority === 'high').length], ['Contacted', items.filter(i => ['contacted','negotiating'].includes(i.status)).length], ['Won', items.filter(i => i.status === 'won').length]].map(([label,value]) => <div key={label} className="rounded-xl bg-white/10 p-3"><div className="text-2xl font-bold">{value}</div><div className="text-xs text-gray-400">{label}</div></div>)}</div>
    </section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-red-600" /><h3 className="font-bold">ChatGPT support</h3><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{aiEnabled ? 'Ready' : 'Needs server key'}</span></div>
      <p className="mt-1 text-sm text-gray-500">Grounded in saved records. It can prioritize or draft outreach, but cannot contact people or change data.</p>
      <div className="mt-3 flex gap-2"><input disabled={!aiEnabled} maxLength={800} value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void ask() }} placeholder="Draft outreach for our best family event…" className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm disabled:bg-gray-50" /><button disabled={!aiEnabled || asking} onClick={() => void ask()} className="rounded-xl bg-gray-950 px-4 text-sm font-semibold text-white disabled:opacity-40">{asking ? 'Thinking…' : 'Ask AI'}</button></div>
      {answer && <div className="mt-3 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm leading-6">{answer}</div>}<p className="mt-2 text-xs text-gray-400">Guardrails: short prompts, 350-token output cap, 20 requests/hour, no paid research loops.</p>
    </section>

    <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2">{['All', ...categories].map(c => <button key={c} onClick={() => setCategory(c)} className={`rounded-full px-3 py-2 text-xs font-semibold ${category === c ? 'bg-red-600 text-white' : 'bg-gray-100'}`}>{c}</button>)}</div><div className="flex flex-wrap items-center gap-2"><label className="text-xs font-semibold text-gray-500">Sort <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="ml-1 rounded-lg border px-2 py-2 text-sm font-normal text-gray-900"><option value="value">Opportunity value</option><option value="date">Date</option><option value="favorite">Favorites</option></select></label><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="New search…" className="rounded-xl border py-2.5 pl-9 pr-3 text-sm" /></label></div></div>
    {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {loading ? <div className="p-10 text-center text-gray-500">Loading research…</div> : <div className="grid gap-4 xl:grid-cols-2">{visible.map(item => <article key={item.id} className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex justify-between gap-3"><div><div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase"><span className="rounded-full bg-gray-100 px-2 py-1">{item.category}</span><span className="rounded-full bg-red-100 px-2 py-1 text-red-700">{item.priority}</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">{item.status}</span></div><h3 className="mt-2 text-xl font-bold">{item.name}</h3></div><div className="flex items-center gap-2"><button aria-label={item.isFavorite ? 'Remove favorite' : 'Add favorite'} onClick={() => void toggleFavorite(item)}><Star className={`h-5 w-5 ${item.isFavorite ? 'fill-amber-400 text-amber-500' : 'text-gray-400'}`} /></button><button onClick={() => setEditing(item)}><Pencil className="h-4 w-4 text-gray-500" /></button></div></div>
      <div className="mt-3 space-y-1.5 text-sm text-gray-600">{item.location && <div className="flex gap-2"><MapPin className="h-4 w-4 text-red-500" />{item.location}</div>}{item.eventDate && <div>{fmt(item.eventDate)}{item.deadline && ` · Apply by ${fmt(item.deadline)}`}</div>}{item.contactEmail && <a href={`mailto:${item.contactEmail}`} className="flex gap-2"><Mail className="h-4 w-4" />{item.contactName && `${item.contactName} · `}{item.contactEmail}</a>}{item.contactPhone && <div>{item.contactPhone}</div>}</div>
      <div className="mt-4 space-y-3"><Info label="What we can do" text={item.supportOffer} /><Info label="How we get an edge" text={item.edgeStrategy} red /></div>
      <div className="mt-4 flex justify-between text-xs text-gray-400"><span>Verified {fmt(item.lastVerifiedAt)}</span>{(item.websiteUrl || item.sourceUrl) && <a target="_blank" rel="noreferrer" href={item.websiteUrl || item.sourceUrl} className="flex items-center gap-1 text-red-600">Open source <ExternalLink className="h-3 w-3" /></a>}</div>
    </article>)}</div>}

    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white"><div className="sticky top-0 flex justify-between border-b bg-white p-5"><h3 className="font-bold">{'id' in editing ? 'Update' : 'Add'} opportunity</h3><button onClick={() => setEditing(null)}><X /></button></div><div className="grid gap-4 p-5 md:grid-cols-2">
      <Edit label="Name" wide value={editing.name} set={v => setEditing({...editing,name:v})} /><Pick label="Category" value={editing.category} options={categories} set={v => setEditing({...editing,category:v})} /><Pick label="Type" value={editing.kind} options={['event','venue','partner']} set={v => setEditing({...editing,kind:v})} /><Pick label="Status" value={editing.status} options={['new','researching','contacted','negotiating','won','passed']} set={v => setEditing({...editing,status:v})} /><Pick label="Priority" value={editing.priority} options={['high','medium','low']} set={v => setEditing({...editing,priority:v})} />
      {([['location','Location'],['contactName','Contact name'],['contactEmail','Contact email'],['contactPhone','Contact phone'],['websiteUrl','Website'],['sourceUrl','Source URL']] as const).map(([key,label]) => <Edit key={key} label={label} value={editing[key]} set={v => setEditing({...editing,[key]:v})} wide={key === 'location' || key === 'sourceUrl'} />)}
      <Edit label="Opportunity value (0–100)" type="number" value={String(editing.opportunityValue ?? 0)} set={v => setEditing({...editing,opportunityValue:Math.max(0, Math.min(100, Number(v) || 0))})} />
      <Edit label="Event date" type="date" value={editing.eventDate?.slice(0,10) || ''} set={v => setEditing({...editing,eventDate:v || null})} /><Edit label="Deadline" type="date" value={editing.deadline?.slice(0,10) || ''} set={v => setEditing({...editing,deadline:v || null})} />
      {([['audience','Audience'],['supportOffer','What Vortex can do'],['edgeStrategy','How we get an edge'],['notes','Research notes']] as const).map(([key,label]) => <Area key={key} label={label} value={editing[key]} set={v => setEditing({...editing,[key]:v})} />)}
    </div><div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white p-4"><button onClick={() => setEditing(null)} className="rounded-xl border px-4 py-2">Cancel</button>{'id' in editing && <button onClick={() => void save(true)} className="rounded-xl border border-red-200 px-4 py-2 text-red-700">Save + verify</button>}<button onClick={() => void save()} className="rounded-xl bg-gray-950 px-5 py-2 text-white">Save</button></div></div></div>}
  </div>
}
function Info({label,text,red=false}:{label:string;text:string;red?:boolean}) { return <div className={`rounded-xl p-3 ${red?'bg-red-50':'bg-gray-50'}`}><div className="text-[11px] font-bold uppercase text-gray-500">{label}</div><p className="mt-1 text-sm">{text}</p></div> }
function Edit({label,value,set,wide=false,type='text'}:{label:string;value:string;set:(v:string)=>void;wide?:boolean;type?:string}) { return <label className={wide?'md:col-span-2':''}><b className="mb-1 block text-xs uppercase text-gray-500">{label}</b><input type={type} value={value} onChange={e=>set(e.target.value)} className="w-full rounded-xl border px-3 py-2.5" /></label> }
function Pick({label,value,options,set}:{label:string;value:string;options:string[];set:(v:string)=>void}) { return <label><b className="mb-1 block text-xs uppercase text-gray-500">{label}</b><select value={value} onChange={e=>set(e.target.value)} className="w-full rounded-xl border px-3 py-2.5">{options.map(o=><option key={o}>{o}</option>)}</select></label> }
function Area({label,value,set}:{label:string;value:string;set:(v:string)=>void}) { return <label className="md:col-span-2"><b className="mb-1 block text-xs uppercase text-gray-500">{label}</b><textarea rows={3} value={value} onChange={e=>set(e.target.value)} className="w-full rounded-xl border px-3 py-2.5" /></label> }
