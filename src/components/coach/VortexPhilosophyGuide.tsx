import { useState } from 'react'
import {
  VORTEX_DEVELOPMENT_COMPONENTS,
  VORTEX_PHILOSOPHY,
  VORTEX_PHILOSOPHY_EVIDENCE_NOTE,
  VORTEX_PHILOSOPHY_SECTIONS,
  VORTEX_PHILOSOPHY_SOURCES,
} from '../../coach/vortexTrainingPhilosophy'

export default function VortexPhilosophyGuide() {
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const sections = VORTEX_PHILOSOPHY_SECTIONS.filter((section) =>
    !query || [section.title, section.intro, ...section.points, ...(section.table?.rows.flat() ?? [])]
      .some((text) => text.toLowerCase().includes(query)),
  )

  return (
    <div className="space-y-5" data-testid="vortex-philosophy-guide">
      <div className="rounded-xl bg-gray-950 p-5 text-white md:p-7">
        <p className="text-xl font-bold md:text-2xl">{VORTEX_PHILOSOPHY.identity}</p>
        <p className="mt-3 max-w-4xl leading-relaxed text-gray-200">{VORTEX_PHILOSOPHY.mission}</p>
        <ol aria-label="Vortex training progression" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {VORTEX_DEVELOPMENT_COMPONENTS.map((component, index) => (
            <li key={component.key} className="rounded-lg border border-white/20 p-4">
              <p className="font-semibold"><span className="mr-2 text-red-400">{index + 1}.</span>{component.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">{component.purpose}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm font-medium text-gray-200">{VORTEX_PHILOSOPHY.standard}</p>
      </div>

      <div>
        <label htmlFor="vortex-philosophy-search" className="mb-2 block text-sm font-semibold text-gray-800">Find coaching guidance</label>
        <input id="vortex-philosophy-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder="Search timing, tenets, recovery, tumbling…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-vortex-red focus:outline-none focus:ring-2 focus:ring-vortex-red/20" />
        {query && <p role="status" className="mt-2 text-sm text-gray-600">{sections.length ? `${sections.length} matching section${sections.length === 1 ? '' : 's'}` : 'No matching guidance. Try another term.'}</p>}
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <details key={`${section.id}-${query ? 'search' : 'browse'}`} open={query ? true : undefined}
            className="group overflow-hidden rounded-xl border border-gray-200 bg-white">
            <summary className="cursor-pointer px-5 py-4 font-semibold text-gray-900 focus-visible:outline-vortex-red">{section.title}</summary>
            <div className="space-y-4 border-t border-gray-100 px-5 py-5 text-sm leading-relaxed text-gray-700">
              <p>{section.intro}</p>
              {section.table && (
                <div className="overflow-x-auto rounded-lg border border-gray-200" role="region" aria-label={`${section.title} table`} tabIndex={0}>
                  <table className="w-full min-w-[34rem] text-left text-sm">
                    <caption className="sr-only">{section.title}</caption>
                    <thead className="bg-gray-100 text-gray-900">
                      <tr>{section.table.columns.map((column) => <th key={column} scope="col" className="px-3 py-3 font-semibold">{column}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {section.table.rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => index === 0
                        ? <th key={index} scope="row" className="px-3 py-3 align-top font-medium text-gray-900">{cell}</th>
                        : <td key={index} className="px-3 py-3 align-top">{cell}</td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
              )}
              <ul className="list-disc space-y-3 pl-5">{section.points.map((point) => <li key={point}>{point}</li>)}</ul>
            </div>
          </details>
        ))}
      </div>

      <details className="rounded-xl border border-gray-200 bg-white">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-800">Evidence and coaching judgment</summary>
        <div className="space-y-3 px-5 pb-5 text-sm text-gray-600">
          <p>{VORTEX_PHILOSOPHY_EVIDENCE_NOTE}</p>
          <ul className="space-y-3">{VORTEX_PHILOSOPHY_SOURCES.map((source) => (
            <li key={source.url}><a className="font-medium text-vortex-red underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p className="mt-1">{source.note}</p></li>
          ))}</ul>
        </div>
      </details>
    </div>
  )
}
