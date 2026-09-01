import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

const packageJsonUrl = new URL('../../package.json', import.meta.url)
const renderBlueprintUrl = new URL('../../render.yaml', import.meta.url)
const dockerfileUrl = new URL('../../Dockerfile', import.meta.url)

test('backend start fails closed behind the allowlisted deploy migration command', async () => {
  const packageJson = JSON.parse(await fs.readFile(packageJsonUrl, 'utf8'))

  assert.equal(packageJson.scripts.prestart, 'npm run migrate:deploy')
  assert.equal(packageJson.scripts.start, 'node server.js')
})

test('the Render Blueprint retains the separate deploy migration gate', async () => {
  const blueprint = await fs.readFile(renderBlueprintUrl, 'utf8')
  const webService = blueprint.split('  - type: cron', 1)[0]

  assert.match(webService, /preDeployCommand: npm run migrate:deploy/)
  assert.match(webService, /startCommand: npm start/)
})

test('the production container enters through the guarded npm start lifecycle', async () => {
  const dockerfile = await fs.readFile(dockerfileUrl, 'utf8')

  assert.match(dockerfile, /CMD \["npm", "start"\]/)
})
