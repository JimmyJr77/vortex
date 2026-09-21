import {test,expect} from '@playwright/test'
import {createServer,type Server} from 'node:http'
import {readFile} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'

// Serve built files with the repository's exact payroll rewrites, deliberately
// without Vite's implicit SPA fallback. This is local routing evidence, not a
// substitute for checking the deployed CDN after release.
let server:Server,url:string
test.beforeAll(async()=>{
 const config=JSON.parse(await readFile('vercel.json','utf8'))
 const root=resolve(process.env.PAYROLL_BROWSER_BUILD_DIR || 'dist')
 const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon'}
 server=createServer(async(req,res)=>{
  const pathname=new URL(req.url!,'http://localhost').pathname
  const rewrite=config.rewrites.find((r:{source:string;destination:string;has?:unknown})=>!r.has&&r.source===pathname)
  const file=resolve(root,'.'+(rewrite?.destination||pathname))
  if(!file.startsWith(root+sep)){res.writeHead(404).end();return}
  try{const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(body)}
  catch{res.writeHead(404).end('Not found')}
 })
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
 const address=server.address();if(!address||typeof address==='string')throw new Error('Missing static test address')
 url=`http://127.0.0.1:${address.port}`
})
test.afterAll(async()=>{if(server)await new Promise<void>((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections()})})

for(const entry of [
 {path:'/employee/payroll',heading:'Vortex employee payroll'},
 {path:'/employee/payroll/preparer',heading:'I-9 preparer / translator certification'},
])test(`built payroll portal opens and reloads directly at ${entry.path}`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 // No account, invitation, backend, or external-service operation is needed to
 // prove the public entry route loads its correct unauthenticated workspace.
 await page.route('**/api/**',route=>route.abort())
 const response=await page.goto(url+entry.path)
 expect(response?.status()).toBe(200)
 await expect(page.getByRole('heading',{name:entry.heading,exact:true})).toBeVisible()
 expect(page.url()).toBe(url+entry.path)
 expect((await page.reload())?.status()).toBe(200)
 await expect(page.getByRole('heading',{name:entry.heading,exact:true})).toBeVisible()
 if(entry.path==='/employee/payroll')await expect(page.getByRole('button',{name:'Sign in to payroll',exact:true})).toBeVisible()
 else await expect(page.getByText('Open your private invitation from the hiring admin to complete your own certification.',{exact:true})).toBeVisible()
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:`/tmp/payroll-static-${entry.path.endsWith('preparer')?'preparer':'employee'}.png`,fullPage:true})
 expect(errors).toEqual([])
})
