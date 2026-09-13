import { readFileSync, writeFileSync } from 'node:fs'
import ts from 'typescript'

const sourceUrl = new URL('../src/coach/vortexTrainingPhilosophy.ts', import.meta.url)
const { outputText } = ts.transpileModule(readFileSync(sourceUrl, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
})
const content = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const { VORTEX_PHILOSOPHY: philosophy, VORTEX_DEVELOPMENT_COMPONENTS: components,
  VORTEX_PHILOSOPHY_SECTIONS: sections, VORTEX_PHILOSOPHY_SOURCES: sources,
  VORTEX_PHILOSOPHY_EVIDENCE_NOTE: evidenceNote } = content

const lines = [
  `# ${philosophy.title}`, '',
  '> Coaching reference · Merged September 12, 2026', '',
  `**${philosophy.identity}**`, '', philosophy.mission, '', philosophy.standard, '',
  '## Four development components', '',
  ...components.map((component, index) => `${index + 1}. **${component.name}:** ${component.purpose}`), '',
]
const escapeCell = (value) => value.replaceAll('|', '\\|').replaceAll('\n', ' ')
for (const section of sections) {
  lines.push(`## ${section.title}`, '', section.intro, '')
  if (section.table) {
    lines.push(`| ${section.table.columns.map(escapeCell).join(' | ')} |`,
      `| ${section.table.columns.map(() => '---').join(' | ')} |`,
      ...section.table.rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`), '')
  }
  lines.push(...section.points.map((point) => `- ${point}`), '')
}
lines.push('## Evidence and coaching judgment', '', evidenceNote, '',
  ...sources.map((source) => `- [${source.title}](${source.url}): ${source.note}`), '',
  '## Relationship to existing Vortex programming', '',
  'This merged philosophy preserves the eight Athleticism Accelerator tenets and Vortex’s Raise → Mobilize → Activate → Integrate → Potentiate Bridge preparation framework. It replaces seven mandatory time blocks with four developmental components, embeds movement intelligence and resilience, and makes conditioning optional.', '',
  'Existing library keys remain available: prepare_and_access maps to Prepare & Access; output describes explosive work; capacity describes strength work; movement_intelligence and resilience identify qualities embedded across components; sustained_capacity identifies optional conditioning; restore identifies the downshift. Body Control / Tumbling remains separately programmed. These tags are not extra required minutes.', '',
  'This is the coaching standard and an update to the philosophy views. It does not migrate saved workouts, change the existing Flip & Fit schedule, alter exercise IDs, or implement new generator validation. Older session templates and automated rules remain software references and require explicit reconciliation before they can be described as enforcing this philosophy.', '',
  'Editorial source: src/coach/vortexTrainingPhilosophy.ts. Regenerate this document with node scripts/export-training-philosophy.mjs.', '')
writeFileSync(new URL('../docs/VORTEX_TRAINING_PHILOSOPHY.md', import.meta.url), lines.join('\n'))
console.log('Exported docs/VORTEX_TRAINING_PHILOSOPHY.md')
