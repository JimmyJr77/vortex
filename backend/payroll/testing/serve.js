import { randomBytes } from 'node:crypto'
import { createHarness } from './harness.js'
process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
const harness=await createHarness()
console.log(`Isolated payroll test API: ${harness.url}`)
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await harness.close();process.exit(0)})
