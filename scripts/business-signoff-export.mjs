import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

const artifactsDir = path.resolve(process.cwd(), 'artifacts', 'launch-signoff')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const jsonPath = path.join(artifactsDir, `business-rehearsal-${stamp}.json`)
const mdPath = path.join(artifactsDir, `launch-signoff-${stamp}.md`)

function runRehearsal() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/business-rehearsal.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BUSINESS_REHEARSAL_JSON_OUT: jsonPath,
      },
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      const text = String(chunk)
      stdout += text
      process.stdout.write(text)
    })
    child.stderr.on('data', (chunk) => {
      const text = String(chunk)
      stderr += text
      process.stderr.write(text)
    })
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

function checklistFor(resultOk) {
  const box = (ok) => (ok ? '[x]' : '[ ]')
  return [
    `- ${box(resultOk)} Member login succeeds`,
    `- ${box(resultOk)} Enrollment succeeds`,
    `- ${box(resultOk)} Billing summary generation succeeds`,
    `- ${box(resultOk)} External payment reconciliation succeeds`,
    `- ${box(resultOk)} Member portal reflects statements/payments`,
    `- ${box(resultOk)} Admin portal billing access confirmed`,
  ]
}

async function main() {
  await mkdir(artifactsDir, { recursive: true })
  const startedAt = new Date().toISOString()
  const run = await runRehearsal()
  const endedAt = new Date().toISOString()

  let json = null
  try {
    json = JSON.parse(await readFile(jsonPath, 'utf8'))
  } catch {
    json = null
  }

  const passed = run.code === 0 && Boolean(json?.ok)
  const lines = [
    '# Launch Sign-Off Record',
    '',
    `- **Run started:** ${startedAt}`,
    `- **Run ended:** ${endedAt}`,
    `- **Status:** ${passed ? 'PASS' : 'FAIL'}`,
    `- **Base URL:** ${json?.baseUrl || process.env.BUSINESS_BASE_URL || '(not set)'}`,
    `- **Reference:** ${json?.reference || '(not generated)'}`,
    '',
    '## Checklist',
    ...checklistFor(passed),
    '',
    '## Step Results',
    ...(json?.checks?.length
      ? json.checks.map((item) => `- ${item.ok ? '✅' : '❌'} ${item.step}`)
      : ['- ❌ No structured step results captured']),
    '',
    '## Command Output',
    '```text',
    run.stdout.trim() || '(no stdout)',
    run.stderr.trim() ? `\n--- stderr ---\n${run.stderr.trim()}` : '',
    '```',
    '',
    '## Sign-Off',
    '- [ ] Engineering owner approved',
    '- [ ] Operations owner approved',
    '- [ ] Go-live window approved',
    '',
  ]

  await writeFile(mdPath, lines.join('\n'), 'utf8')
  console.log(`\n📄 Launch sign-off markdown exported: ${mdPath}`)
  if (json) {
    console.log(`📄 Rehearsal JSON exported: ${jsonPath}`)
  }

  if (!passed) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Failed to export launch sign-off artifact:', error.message)
  process.exit(1)
})
