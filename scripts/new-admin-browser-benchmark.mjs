import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const origin = process.env.BENCHMARK_BASE_URL || 'http://127.0.0.1:4175';
const variant = process.env.BENCHMARK_VARIANT || 'new';
const output = process.env.BENCHMARK_OUTPUT || `/tmp/vortex-admin-${variant}-results.json`;
// Start Vite separately. All API requests are fictional, delayed by 20ms; other network origins are blocked.
const delayMs = 20;
const nClasses = 24;
const date = '2026-11-01T12:00:00.000Z';
const categories = Array.from({length: 4}, (_, index) => ({id:index+1,name:`fixture-program-${index+1}`,displayName:`Fixture Program ${index+1}`,description:'Fictional baseline program',isActive:true,archived:false,createdAt:date,updatedAt:date}));
const classes = Array.from({length:nClasses}, (_, index) => ({id:index+1,name:`fixture-class-${index+1}`,displayName:`Fixture Class ${String(index+1).padStart(3,'0')}`,categoryId:index%4+1,categoryDisplayName:categories[index%4].displayName,programIsActive:true,isActive:true,archived:false,skillLevel:'BEGINNER',ageMin:6,ageMax:12,description:'Fictional baseline class',createdAt:date,updatedAt:date}));
const members = Array.from({length:50},(_,index) => ({id:index+1,firstName:`Fixture ${String(index+1).padStart(3,'0')}`,lastName:'Athlete',email:`fixture${index+1}@example.invalid`,phone:'555-0100',dateOfBirth:'2016-01-01',age:10,ageGroup:'youth',family:{id:Math.floor(index/3)+1,name:`Fixture Family ${Math.floor(index/3)+1}`},recordStatus:'active',portalAccess:{status:'no_login',userId:null},staffAccess:{roles:[],labels:[],status:'none'},household:{isPayer:false,isGuardian:false,isDependent:true,badges:['dependent']},participation:{current:2,upcoming:0,paused:0,waitlisted:0,former:0,total:2,states:['current']},waiver:{status:'current',requiredCount:1,acceptedCount:1,lastAcceptedAt:date},dataQuality:[]}));
function fixture(url) {
  const p=url.pathname;
  if(p==='/api/admin/accounting/options') return {members:[],classes:[],limit:100};
  if(p==='/api/admin/accounting/lines') return {rows:[],total:0,page:1,pageSize:25,totalPages:0,timezone:'America/New_York',generatedAt:date,summary:{billedCents:0,paidCents:0,creditAppliedCents:0,openCents:0,creditCents:0,openCount:0}};
  if(p==='/api/admin/access/me') return {permissions:[],roles:['MASTER_ADMIN'],isMasterAdmin:true,user:{id:1}};
  if(p==='/api/admin/notifications') return {notifications:[],unreadCount:0};
  if(p==='/api/admin/billing/cancellation-requests') return [];
  if(p==='/api/admin/programs') return url.searchParams.get('archived')==='true'?[]:classes;
  if(p==='/api/admin/programs-top') return url.searchParams.get('archived')==='true'?[]:categories;
  if(p.includes('/discipline-tags')) return [];
  if(p.match(/^\/api\/admin\/class-events\/\d+\/scheduling-form$/)) return {id:Number(p.split('/')[4])};
  if(p.match(/^\/api\/admin\/scheduling\/forms\/\d+\/offerings$/)) return [{id:1,startDate:'2026-09-01',endDate:'2027-06-01',isSelected:true}];
  if(p.match(/^\/api\/admin\/scheduling\/forms\/\d+$/)) return {id:Number(p.split('/')[5]),title:'Fixture schedule',slotGroups:[{id:1,offeringId:1,maxParticipants:12,occurrences:[{id:1,dayOfWeek:1,startTime:'16:00',endTime:'17:00'}]}]};
  if(p==='/api/admin/account-directory') { const size=Number(url.searchParams.get('pageSize')) || 50; return {rows:members.slice(0,size),total:500,page:1,pageSize:size,totalPages:Math.ceil(500/size)}; }
  if(p==='/api/admin/new-admin/classes') return {rows:classes.map(item=>({id:item.id,formId:item.id,programsId:item.categoryId,name:item.displayName,programName:item.categoryDisplayName,isActive:true,capacity:12,enrolledCount:8,waitlistCount:1})),total:classes.length,page:1,pageSize:25,totalPages:1};
  if(p==='/api/admin/class-setup/overview') return {rows:[]};
  if(p.includes('consent')) return {analytics:false,marketing:false};
  return [];
}
const browser = await chromium.launch({headless:true});
const results=[];
for (const screen of ['classes','members']) {
  for(let run=1;run<=5;run++) {
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    const page=await context.newPage();
    const requests=[]; const errors=[]; let pending=0; let lastDone=0;
    page.on('pageerror',error=>{errors.push(error.message);console.error('PAGE ERROR',error.message)});
    await page.route('**/*', async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.startsWith('/api/')) {
        pending++;
        const record={path:url.pathname+url.search,started:performance.now()}; requests.push(record);
        await new Promise(resolve=>setTimeout(resolve,delayMs));
        await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({success:true,data:fixture(url)})});
        record.completed=performance.now(); lastDone=record.completed;pending--;
      } else if(url.origin===origin) await route.continue();
      else await route.abort();
    });
    await page.addInitScript((variant)=>{
      const account={id:1,firstName:'Baseline',lastName:'Admin',email:'baseline@example.invalid',roles:['MASTER_ADMIN'],availablePortals:['admin','coach','member'],isAdmin:true};
      localStorage.setItem('vortex_admin_portal',variant==='new'?'new-admin':'admin');
      localStorage.setItem('adminToken','simulated-token');localStorage.setItem('vortex_admin','true');
      localStorage.setItem('vortex_member_token','simulated-token');localStorage.setItem('vortex_member',JSON.stringify(account));
      localStorage.setItem('vortex-admin-info',JSON.stringify({id:1,name:'Baseline Admin',firstName:'Baseline',isMaster:true}));
    },variant);
    const boot=performance.now();
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:variant==='new'?'New Admin':'Welcome, Baseline',exact:true}).waitFor({timeout:90000});
    // Keep screen measurements independent of the portal's current default workspace.
    if(variant==='new') { await page.getByRole('button',{name:'Members & accounts',exact:true}).click(); await page.getByText('Fixture 001 Athlete',{exact:true}).first().waitFor(); }
    const shellReadyMs=performance.now()-boot;
    if(variant==='new' && screen==='members') { await page.getByRole('button',{name:'Classes & schedules',exact:true}).click(); await page.getByText('Fixture Class 001',{exact:true}).first().waitFor(); await page.waitForTimeout(100); }
    if(variant!=='new' && screen==='classes') {
      await page.locator('nav').getByRole('button',{name:'Class Setup',exact:true}).click();
      await page.getByRole('button',{name:'Program & Class Creation',exact:true}).waitFor().catch(async error=>{await writeFile('/tmp/vortex-baseline-failed.html',await page.content());console.error(await page.locator('body').innerText());throw error});
      await page.waitForTimeout(100);
    }
    const before=requests.length;
    const started=performance.now();
    if(screen==='classes') {
      await page.getByRole('button',{name:variant==='new'?'Classes & schedules':'Program & Class Creation',exact:true}).click();
      await page.getByText('Fixture Class 001',{exact:true}).first().waitFor();
    } else {
      await page.locator('nav').getByRole('button',{name:variant==='new'?'Members & accounts':'Accounts',exact:true}).click();
      await page.getByText('Fixture 001 Athlete',{exact:true}).first().waitFor();
    }
    const firstRowsReadyMs=performance.now()-started;
    while(pending || performance.now()-lastDone<100) await page.waitForTimeout(25);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const screenRequests=requests.slice(before);
    const dataSettledMs=Math.max(...screenRequests.map(r=>r.completed))-started;
    const frequency=Object.fromEntries([...new Set(screenRequests.map(r=>r.path))].map(path=>[path,screenRequests.filter(r=>r.path===path).length]));
    results.push({screen,run,shellReadyMs:+shellReadyMs.toFixed(1),firstRowsReadyMs:+firstRowsReadyMs.toFixed(1),dataSettledMs:+dataSettledMs.toFixed(1),screenRequestCount:screenRequests.length,totalRequestCount:requests.length,frequency,errors});
    if(run===1) await page.screenshot({path:`/tmp/vortex-${variant}-${screen}.png`,fullPage:true});
    await context.close();
    console.log(JSON.stringify({...results.at(-1),frequency:undefined}));
  }
}
await browser.close();
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const report={variant,environment:'Current Vite development source; React StrictMode enabled; intercepted fictional API fixtures; 20ms synthetic delay per response; real database and backend not measured',fixture:{classes:nClasses,programs:4,directoryRows:variant==='new'?25:50,directoryTotal:500},measuredAt:new Date().toISOString(),summary:Object.fromEntries(['classes','members'].map(screen=>{const rows=results.filter(r=>r.screen===screen);return [screen,{requestCounts:rows.map(r=>r.screenRequestCount),medianFirstRowsReadyMs:median(rows.map(r=>r.firstRowsReadyMs)),medianDataSettledMs:median(rows.map(r=>r.dataSettledMs)),medianShellReadyMs:median(rows.map(r=>r.shellReadyMs))}]})),results};
await writeFile(output,JSON.stringify(report,null,2));
console.log(JSON.stringify(report.summary,null,2));
