import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  ExternalLink,
  MapPin,
  Minus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Segment = 'Youth athletics' | 'Gymnastics'

type Competitor = {
  name: string
  segment: Segment
  threat: 'High' | 'Medium' | 'Low'
  location: string
  distance: string
  ages: string
  model: string
  programs: string[]
  publicPrice: string
  trial: string
  strengths: string[]
  gaps: string[]
  response: string
  score: number
  source: string
  sourceLabel: string
}

const competitors: Competitor[] = [
  {
    name: 'Redline Athletics Bowie',
    segment: 'Youth athletics',
    threat: 'High',
    location: '4891 Tesla Dr, Bowie',
    distance: '< 1 mile',
    ages: '8–18',
    model: 'Recurring group memberships, semi-private elite, private training',
    programs: ['Speed & agility', 'Strength & power', 'Mobility', '90-day testing', 'Facility rental'],
    publicPrice: 'Flex Unlimited $49.99; Flex Limited $28.99 (billing cadence not clearly stated)',
    trial: 'Intro / get-started offer promoted',
    strengths: ['Same micro-market', 'Hourly sessions', 'National brand system', 'Quarterly testing', 'Character curriculum'],
    gaps: ['No gymnastics pathway', 'Narrower age range', 'Pricing cadence is unclear online'],
    response: 'Lead with gymnastics-first transfer, ages 2+, richer movement disciplines, and make measurable progress visible to parents.',
    score: 92,
    source: 'https://redlineathletics.com/location/bowie/',
    sourceLabel: 'Official location page',
  },
  {
    name: 'The GOAT Lab',
    segment: 'Youth athletics',
    threat: 'Medium',
    location: 'Bowie / DMV',
    distance: 'Local',
    ages: 'Youth–college',
    model: 'Small-group and specialized performance training',
    programs: ['Speed', 'Strength', 'Soccer IQ', 'Football development', 'Club-neutral training'],
    publicPrice: 'Not published',
    trial: 'Inquiry-led',
    strengths: ['Serious-athlete positioning', 'Sport-specific credibility', 'Science-based message'],
    gaps: ['Football/soccer concentration', 'No gymnastics', 'Low price transparency'],
    response: 'Own the multi-sport athlete category and show how body control, power, and telemetry transfer into every field or court sport.',
    score: 72,
    source: 'https://www.goatlabperformance.com/about-g-o-a-t-football-group-in-bowie-md',
    sourceLabel: 'Official about page',
  },
  {
    name: 'Taylor Tuff Athletics',
    segment: 'Youth athletics',
    threat: 'Low',
    location: 'Prince George’s County',
    distance: 'Regional',
    ages: 'Children & adolescents',
    model: 'Youth development, sports instruction, and mentorship',
    programs: ['Athletic training', 'Teamwork', 'Leadership', 'Mentorship', 'Wildcats community'],
    publicPrice: 'Not published',
    trial: 'Contact form',
    strengths: ['Community identity', 'Life-skills message', 'PG County reach'],
    gaps: ['Limited program detail', 'No measurement story', 'No gymnastics pathway'],
    response: 'Keep Vortex outcomes concrete: disciplines, class duration, coach expertise, telemetry, and a clear next enrollment step.',
    score: 48,
    source: 'https://www.taylortuffathletics.com/',
    sourceLabel: 'Official website',
  },
  {
    name: 'MGA Gymnastics',
    segment: 'Gymnastics',
    threat: 'High',
    location: '521 Commerce Dr, Upper Marlboro',
    distance: '≈ 12 miles',
    ages: '2+',
    model: 'Recreational classes, teams, camps, tumbling, and ninja',
    programs: ['Preschool', 'Girls gymnastics', 'Boys gymnastics', 'Tumbling', 'Ninja', 'Summer camps'],
    publicPrice: 'Not consistently published on core site',
    trial: 'Introductory offers appear through promotions',
    strengths: ['Long local history', 'Broad rec funnel', 'Boys program', 'Camps and ninja', 'Established teams'],
    gaps: ['Limited performance-tech story', 'Less multi-sport positioning', 'Core pricing not transparent'],
    response: 'Differentiate on technology, extended training time, multi-discipline competitive paths, and the bridge from gymnastics to total athleticism.',
    score: 87,
    source: 'https://www.mga-gymnastics.com/',
    sourceLabel: 'Official website',
  },
  {
    name: 'Silver Stars Gymnastics',
    segment: 'Gymnastics',
    threat: 'Medium',
    location: 'Bowie / Silver Spring',
    distance: 'Local listing',
    ages: 'Preschool–youth',
    model: 'Classes plus camps, open gym, parties, and kids’ nights',
    programs: ['Recreational gymnastics', 'Camps', 'Open gym', 'Kids’ Night Out', 'Birthday parties'],
    publicPrice: 'Not verified in this snapshot',
    trial: 'Class inquiry / registration',
    strengths: ['Bowie brand awareness', 'Multiple family revenue products', 'Event-led acquisition'],
    gaps: ['Public Bowie details are sparse', 'No visible athletics pathway', 'No telemetry story'],
    response: 'Use events and camps as a stronger feeder while emphasizing competitive depth and a single home for siblings with different goals.',
    score: 68,
    source: 'https://dmv.kidsoutandabout.com/content/silver-star-gymnastics-md',
    sourceLabel: 'Regional directory listing',
  },
  {
    name: 'i.e. Acro',
    segment: 'Gymnastics',
    threat: 'Medium',
    location: '2404 Crofton Blvd, Crofton',
    distance: '≈ 9 miles',
    ages: 'Young athletes',
    model: 'Acrobatics, tumbling, and gymnastics classes',
    programs: ['Movement', 'Tumbling', 'Gymnastics', 'Acrobatics'],
    publicPrice: 'Not visible in public class overview',
    trial: 'Registration-led',
    strengths: ['Close to Crofton families', 'Focused acro identity', 'Clear progressive class concept'],
    gaps: ['Narrower breadth', 'No broad sports-performance offer', 'Limited public comparison detail'],
    response: 'Protect the Crofton corridor with Vortex’s broader discipline menu, competitive progression, and measurable athlete-development story.',
    score: 64,
    source: 'https://ieacro.com/classes/',
    sourceLabel: 'Official classes page',
  },
]

const comparisonRows = [
  { label: 'Ages 2–5 pathway', vortex: true, redline: false, mga: true, goat: false },
  { label: 'Cross-sport athletic development', vortex: true, redline: true, mga: false, goat: true },
  { label: 'Developmental gymnastics', vortex: true, redline: false, mga: true, goat: false },
  { label: 'Multiple competitive disciplines', vortex: true, redline: false, mga: true, goat: false },
  { label: 'Performance data / telemetry', vortex: true, redline: true, mga: false, goat: false },
  { label: 'Ninja / obstacle training', vortex: true, redline: false, mga: true, goat: false },
  { label: 'Single multi-sport + gymnastics home', vortex: true, redline: false, mga: false, goat: false },
]

const updatePrompt = `Update the Vortex admin competitor intelligence page.

Scope:
- File: src/components/admin/AdminCompetitors.tsx
- Market: Bowie, Maryland and the practical family-drive radius
- Segments: Youth athletics and Gymnastics
- Verify every competitor's official website, location, ages, programs, pricing, trial offer, positioning, and current status.
- Search for newly opened or closed competitors.
- Prefer official sources; use reputable directories only when an official source is unavailable.
- Never invent pricing. Use "Not published" when it cannot be verified.
- Update the "Market snapshot" date, competitor cards, threat scores, feature matrix, watch list, and source links.
- Preserve the existing design and interactions.
- Run npm run build and fix any errors.

Return a short change log with: material changes, pricing changes, new/closed competitors, and strategic implications for Vortex.`

const StatusIcon = ({ value }: { value: boolean }) =>
  value ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Yes" /> : <Minus className="mx-auto h-4 w-4 text-gray-300" aria-label="No" />

export default function AdminCompetitors() {
  const [segment, setSegment] = useState<'All' | Segment>('All')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Competitor | null>(null)
  const [showUpdate, setShowUpdate] = useState(false)
  const [copied, setCopied] = useState(false)

  const filtered = useMemo(
    () => competitors.filter((item) =>
      (segment === 'All' || item.segment === segment) &&
      `${item.name} ${item.location} ${item.programs.join(' ')}`.toLowerCase().includes(query.toLowerCase())),
    [query, segment],
  )

  const copyUpdatePrompt = async () => {
    await navigator.clipboard.writeText(updatePrompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2200)
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="overflow-hidden rounded-2xl bg-[#111214] text-white shadow-sm">
        <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              <span>Market intelligence</span><span className="h-1 w-1 rounded-full bg-vortex-red" />
              <span>Snapshot: July 25, 2026</span>
            </div>
            <h2 className="max-w-3xl text-3xl font-bold leading-tight md:text-4xl">Know the field. Sharpen the edge.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              A decision-ready view of the businesses competing for Vortex families across youth performance and gymnastics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowUpdate(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-vortex-red px-5 text-sm font-bold text-white transition hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" /> Run Codex update
          </button>
        </div>
        <div className="grid border-t border-white/10 sm:grid-cols-3">
          {[
            ['6', 'tracked competitors'],
            ['2', 'market segments'],
            ['2', 'high-threat rivals'],
          ].map(([value, label]) => (
            <div key={label} className="border-white/10 px-6 py-4 sm:border-r last:border-r-0">
              <span className="text-2xl font-bold">{value}</span>
              <span className="ml-2 text-sm text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-950">Competitive pressure</h3>
              <p className="mt-1 text-sm text-gray-500">Composite threat score based on proximity, overlap, offer breadth, and market strength.</p>
            </div>
            <Target className="h-5 w-5 text-vortex-red" />
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={competitors} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0f2" />
                <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} fontSize={11} />
                <YAxis type="category" dataKey="name" width={122} tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip cursor={{ fill: '#f7f7f8' }} formatter={(value) => [`${value}/100`, 'Threat score']} />
                <Bar dataKey="score" radius={[0, 5, 5, 0]} barSize={16}>
                  {competitors.map((entry) => <Cell key={entry.name} fill={entry.threat === 'High' ? '#dc2626' : entry.threat === 'Medium' ? '#f59e0b' : '#94a3b8'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-950"><Sparkles className="h-4 w-4 text-vortex-red" /> Vortex advantage</div>
          <p className="mt-4 text-xl font-bold leading-snug text-gray-950">No rival in this set combines broad gymnastics pathways with cross-sport development and telemetry.</p>
          <div className="mt-5 space-y-3">
            {[
              'Own “the complete athlete” with proof, not only positioning.',
              'Turn telemetry into parent-friendly progress reports.',
              'Use ages 2+ and sibling-friendly breadth as a household advantage.',
              'Publish simple pricing anchors where rivals force an inquiry.',
            ].map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-5 text-gray-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-bold text-gray-950">Competitor directory</h3>
            <p className="mt-1 text-sm text-gray-500">Open any profile for positioning, gaps, and the recommended Vortex response.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search competitors" className="h-9 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-gray-400 sm:w-52" />
            </div>
            <div className="flex rounded-lg bg-gray-100 p-1">
              {(['All', 'Youth athletics', 'Gymnastics'] as const).map((item) => (
                <button key={item} type="button" onClick={() => setSegment(item)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${segment === item ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>{item}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <button key={item.name} type="button" onClick={() => setSelected(item)} className="group rounded-xl border border-gray-200 p-4 text-left transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{item.segment}</span>
                  <h4 className="mt-1 font-bold text-gray-950">{item.name}</h4>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${item.threat === 'High' ? 'bg-red-50 text-red-700' : item.threat === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{item.threat}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500"><MapPin className="h-3.5 w-3.5" /> {item.location} · {item.distance}</div>
              <p className="mt-4 line-clamp-2 text-sm leading-5 text-gray-600">{item.model}</p>
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs font-bold text-gray-950">
                Threat score {item.score}
                <ArrowUpRight className="h-4 w-4 transition group-hover:text-vortex-red" />
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <h3 className="font-bold text-gray-950">Head-to-head capability matrix</h3>
          <p className="mt-1 text-sm text-gray-500">The closest direct competitors in each segment. “Yes” reflects a clearly marketed public capability.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3 text-left">Capability</th><th className="px-4 py-3">Vortex</th><th className="px-4 py-3">Redline</th><th className="px-4 py-3">MGA</th><th className="px-4 py-3">GOAT Lab</th></tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label} className="border-t border-gray-100">
                  <td className="px-5 py-3.5 font-medium text-gray-700">{row.label}</td>
                  <td className="bg-red-50/40 px-4 py-3.5"><StatusIcon value={row.vortex} /></td>
                  <td className="px-4 py-3.5"><StatusIcon value={row.redline} /></td>
                  <td className="px-4 py-3.5"><StatusIcon value={row.mga} /></td>
                  <td className="px-4 py-3.5"><StatusIcon value={row.goat} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['Immediate watch', 'Redline is effectively next door and has the cleanest flexible-training message. Monitor offer and pricing changes monthly.', ShieldAlert],
          ['Conversion opening', 'Most rivals obscure pricing. A clear “starting at” price plus trial pathway can reduce comparison friction.', ExternalLink],
          ['Next research pass', 'Mystery-shop response speed, trial experience, class length, coach ratio, fees, and cancellation policy.', Clock3],
        ].map(([title, body, Icon]) => (
          <div key={title as string} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <Icon className="h-5 w-5 text-vortex-red" />
            <h4 className="mt-4 font-bold text-gray-950">{title as string}</h4>
            <p className="mt-2 text-sm leading-6 text-gray-600">{body as string}</p>
          </div>
        ))}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/35 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={`${selected.name} competitor profile`} onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><span className="text-xs font-bold uppercase tracking-wider text-vortex-red">{selected.segment}</span><h3 className="mt-1 text-2xl font-bold text-gray-950">{selected.name}</h3><p className="mt-2 flex items-center gap-1.5 text-sm text-gray-500"><MapPin className="h-4 w-4" /> {selected.location} · {selected.distance}</p></div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 p-4"><div className="text-xs font-bold uppercase text-gray-400">Ages</div><div className="mt-1 font-semibold">{selected.ages}</div></div>
              <div className="rounded-xl bg-gray-50 p-4"><div className="text-xs font-bold uppercase text-gray-400">Threat</div><div className="mt-1 font-semibold">{selected.threat} · {selected.score}/100</div></div>
            </div>
            <div className="mt-6 space-y-6 text-sm">
              <div><h4 className="font-bold text-gray-950">Business model</h4><p className="mt-2 leading-6 text-gray-600">{selected.model}</p></div>
              <div><h4 className="font-bold text-gray-950">Programs</h4><div className="mt-2 flex flex-wrap gap-2">{selected.programs.map((program) => <span key={program} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">{program}</span>)}</div></div>
              <div className="grid gap-4 sm:grid-cols-2"><div><h4 className="font-bold text-gray-950">Public pricing</h4><p className="mt-2 leading-6 text-gray-600">{selected.publicPrice}</p></div><div><h4 className="font-bold text-gray-950">Trial / entry point</h4><p className="mt-2 leading-6 text-gray-600">{selected.trial}</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2"><div><h4 className="font-bold text-gray-950">Strengths</h4><ul className="mt-2 space-y-2 text-gray-600">{selected.strengths.map((value) => <li key={value} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{value}</li>)}</ul></div><div><h4 className="font-bold text-gray-950">Gaps to exploit</h4><ul className="mt-2 space-y-2 text-gray-600">{selected.gaps.map((value) => <li key={value} className="flex gap-2"><Minus className="mt-0.5 h-4 w-4 shrink-0 text-vortex-red" />{value}</li>)}</ul></div></div>
              <div className="rounded-xl bg-[#111214] p-5 text-white"><h4 className="font-bold">Recommended Vortex response</h4><p className="mt-2 leading-6 text-gray-300">{selected.response}</p></div>
              <a href={selected.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-bold text-vortex-red hover:underline">{selected.sourceLabel}<ExternalLink className="h-4 w-4" /></a>
            </div>
          </div>
        </div>
      )}

      {showUpdate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Run Codex competitor update" onClick={() => setShowUpdate(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-wider text-vortex-red">Fast refresh</span><h3 className="mt-1 text-2xl font-bold text-gray-950">Update with Codex</h3><p className="mt-2 text-sm leading-6 text-gray-600">Copy this research brief into a Codex task from the Vortex workspace. Codex will verify sources, update the page, and run the build.</p></div><button type="button" onClick={() => setShowUpdate(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5" /></button></div>
            <pre className="mt-5 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-950 p-4 text-xs leading-5 text-gray-200">{updatePrompt}</pre>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowUpdate(false)} className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-bold text-gray-700 hover:bg-gray-50">Close</button>
              <button type="button" onClick={copyUpdatePrompt} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-vortex-red px-4 text-sm font-bold text-white hover:bg-red-700">{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? 'Copied — paste into Codex' : 'Copy update task'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
