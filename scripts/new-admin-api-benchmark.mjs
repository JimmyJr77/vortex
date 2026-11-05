import fs from 'node:fs/promises'
import {performance} from 'node:perf_hooks'

const base=process.env.NEW_ADMIN_API_URL || 'http://127.0.0.1:3101'
const parsed=new URL(base)
if(!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)) throw new Error('Benchmark accepts only the local rehearsal API.')
const authResponse=await fetch(`${base}/api/admin/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usernameOrEmail:'admin2',password:'adminadmin'})})
const auth=await authResponse.json()
if(!authResponse.ok||!auth.token) throw new Error('Local admin2 login failed. Run the local setup and server first.')
const endpoints=[
 ['legacy classes','/api/admin/class-setup/overview'],
 ['New Admin classes','/api/admin/new-admin/classes?pageSize=25'],
 ['legacy full member compatibility endpoint','/api/admin/members'],
 ['existing Admin directory (50 rows)','/api/admin/account-directory?record=active&sortBy=member&sortDir=asc&page=1&pageSize=50'],
 ['New Admin directory (25 rows)','/api/admin/account-directory?record=active&sortBy=member&sortDir=asc&page=1&pageSize=25'],
 ['legacy leads','/api/admin/registrations'],
 ['New Admin leads','/api/admin/new-admin/leads?pageSize=25'],
 ['member detail','/api/admin/new-admin/members/2'],
 ['account billing','/api/admin/customer-billing/families/1/overview'],
]
const results=[]
for(const [label,path] of endpoints) {
 const samples=[]
 for(let index=0;index<8;index++) {
  const start=performance.now()
  const response=await fetch(`${base}${path}`,{headers:{Authorization:`Bearer ${auth.token}`}})
  const body=await response.text()
  if(!response.ok) throw new Error(`${label}: ${response.status} ${body.slice(0,200)}`)
  if(index>0) samples.push({ms:Number((performance.now()-start).toFixed(2)),bytes:Buffer.byteLength(body)})
 }
 const sorted=samples.map(row=>row.ms).sort((a,b)=>a-b)
 results.push({label,path,medianMs:sorted[3],p90Ms:sorted[6],bytes:samples[0].bytes,samples})
}
const output={measuredAt:new Date().toISOString(),environment:'Loopback Express/PostgreSQL; fictional seed; Stripe and email disabled; one warmup and seven measured requests per endpoint.',comparison:'Retained legacy endpoints and New Admin on the same database. Full collections/detail payloads differ from New Admin 25-row summaries. Both actual member screens reuse account-directory; their page sizes differ (50 versus 25). The full member compatibility endpoint is not the existing directory screen. This measures data delivery, not identical SQL workloads or production latency.',results}
const file=process.env.NEW_ADMIN_BENCHMARK_OUTPUT || 'docs/new-admin-api-measurements.json'
await fs.writeFile(file,JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify(results.map(({label,medianMs,p90Ms,bytes})=>({label,medianMs,p90Ms,bytes})),null,2))
