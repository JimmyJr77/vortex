import {resolvePayrollCheckStop} from '../modernTreasuryCheckStop.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {digitalCheckInstruction,digitalCheckReceipt,provisionPayrollCheckPayee,submitPayrollDigitalCheck,readPayrollDigitalCheck,downloadPayrollDigitalCheck} from '../modernTreasuryChecks.js'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const intent={id:id(1),originatingAccountId:id(2),receivingAccountId:id(3),counterpartyId:id(4),facilityId:1,runId:2,employeeId:3,amountCents:5970,paymentDate:'2026-09-18',payeeName:'Synthetic Employee',mode:'LIVE'}
const config={organizationId:id(9),apiKey:'synthetic-check-key',digitalChecksEnabled:true,timezone:'America/New_York'}
const now=()=>new Date('2026-09-18T12:00:00Z')
const order=()=>({...digitalCheckInstruction(intent),id:id(5),counterparty_id:id(4),live_mode:true,status:'sent',reconciliation_status:'unreconciled',transaction_ids:[]})
const payee={id:id(3),counterparty_id:id(4),party_name:intent.payeeName,party_type:'individual',account_type:'other',live_mode:true,account_details:[],routing_details:[]}
function fixture(){
 const state={posts:0,current:null,invalidPayee:false,lose:false,methods:[],changedTransactions:false,paymentReads:0}
 state.fetcher=async(url,options={})=>{
  state.methods.push(options.method||'GET')
  if(url.includes('/internal_accounts/'))return Response.json({id:id(2),live_mode:true,currency:'USD'})
  if(url.includes('/external_accounts/'))return Response.json({...payee,...(state.invalidPayee?{party_name:'Different Person'}:{})})
  if(url.includes('/counterparties/'))return Response.json({id:id(4),name:intent.payeeName,live_mode:true})
  if(url.includes('/payment_orders/')){state.paymentReads++;const current=state.current?structuredClone(state.current):null;if(current&&state.changedTransactions&&state.paymentReads>1)current.transaction_ids=[id(99)];return Response.json(current||{},{status:current?200:404})}
  if(url.endsWith('/payment_orders')&&options.method==='POST'){state.posts++;state.current={...JSON.parse(options.body),id:id(5),counterparty_id:id(4),live_mode:true,status:'sent',reconciliation_status:'unreconciled',transaction_ids:[]};if(state.lose)throw new Error('Synthetic lost check response');return Response.json(state.current)}
  if(url.includes('/transactions/'))return Response.json({id:id(6),live_mode:true,internal_account_id:id(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-19',amount:5970})
  if(url.includes('/transaction_line_items?'))return Response.json([{id:id(7),transaction_id:id(6),transactable_type:'payment_order',transactable_id:id(5),live_mode:true,type:'originating',amount:5970}])
  throw new Error('Unexpected synthetic endpoint')
 }
 return state
}
test('digital check retains exact identities, amount, date and explicit expiry without bank-number collection',()=>{
 const payload=digitalCheckInstruction(intent);assert.equal(payload.type,'check');assert.equal(payload.subtype,'digital');assert.equal(payload.amount,5970);assert.equal(payload.expires_at,'2026-12-17T00:00:00.000Z');assert.equal(payload.send_remittance_advice,false)
 for(const change of [{amountCents:0},{paymentDate:'2026-02-30'},{expiryDays:181},{payeeName:'Bad\nName'}])assert.throws(()=>digitalCheckInstruction({...intent,...change}))
 assert.equal(digitalCheckReceipt({...order(),effective_date:'2026-09-19'},intent).dateMatches,false)
 assert.equal(digitalCheckReceipt({...order(),expires_at:'2027-01-01T00:00:00Z'},intent).expiryMatches,false)
 assert.throws(()=>digitalCheckReceipt({...order(),amount:5971},intent),/does not match/)
})
for(const operation of ['COUNTERPARTY','ACCOUNT'])test(`check ${operation} setup is idempotent and recovery never recreates missing data`,async()=>{
 let stored=null,posts=0,lose=true
 const fetcher=async(url,options={})=>{if(options.method!=='POST')return Response.json(stored?[stored]:[]);posts++;const body=JSON.parse(options.body);assert.equal(body.account_details,undefined);assert.equal(body.routing_details,undefined);stored={...body,id:operation==='COUNTERPARTY'?id(4):id(3),live_mode:true,...(operation==='ACCOUNT'?{account_details:[],routing_details:[]}:{} )};if(lose){lose=false;throw new Error('Synthetic lost payee response')}return Response.json(stored)}
 const raw={id:id(11),payeeName:intent.payeeName,mode:'LIVE'},options={operation,counterpartyId:id(4)}
 assert.equal((await provisionPayrollCheckPayee(raw,{...config,fetcher},options)).status,'NOT_FOUND');assert.equal(posts,0)
 assert.equal((await provisionPayrollCheckPayee(raw,{...config,fetcher},{...options,allowCreate:true})).status,'UNCERTAIN');assert.equal(posts,1)
 assert.equal((await provisionPayrollCheckPayee(raw,{...config,fetcher},options)).status,'RECORDED');assert.equal(posts,1)
 stored.live_mode=false;assert.equal((await provisionPayrollCheckPayee(raw,{...config,fetcher},options)).status,'NEEDS_REVIEW')
})
test('check submission requires explicit write eligibility, enabled funding and current date',async()=>{
 const f=fixture(),c={...config,fetcher:f.fetcher}
 assert.equal((await submitPayrollDigitalCheck(intent,c,{now})).status,'NOT_FOUND')
 assert.equal((await submitPayrollDigitalCheck(intent,{...c,digitalChecksEnabled:false},{allowCreate:true,now})).status,'BLOCKED_CHECK_CONFIGURATION')
 assert.equal((await submitPayrollDigitalCheck(intent,c,{allowCreate:true,now:()=>new Date('2026-09-19T12:00:00Z')})).status,'BLOCKED_PAYMENT_DATE')
 f.invalidPayee=true;assert.equal((await submitPayrollDigitalCheck(intent,c,{allowCreate:true,now})).status,'BLOCKED_PAYEE_OR_FUNDING');assert.equal(f.posts,0)
})
test('lost check submission recovers by identity with no second payment',async()=>{
 const f=fixture(),c={...config,fetcher:f.fetcher};f.lose=true
 assert.equal((await submitPayrollDigitalCheck(intent,c,{allowCreate:true,now})).status,'UNCERTAIN');assert.equal(f.posts,1)
 assert.equal((await readPayrollDigitalCheck(intent,c)).status,'SENT')
 assert.equal((await submitPayrollDigitalCheck(intent,c,{allowCreate:true,now})).reused,true);assert.equal(f.posts,1)
 f.current.amount=1;assert.equal((await readPayrollDigitalCheck(intent,c)).status,'UNCERTAIN');assert.equal(f.posts,1)
})
test('completed check needs matched posted bank evidence and a stable final provider read',async()=>{
 const f=fixture();f.current={...order(),status:'completed',reconciliation_status:'reconciled',transaction_ids:[id(6)]}
 const c={...config,fetcher:f.fetcher};assert.equal((await readPayrollDigitalCheck(intent,c)).settlementStatus,'BANK_POSTED');assert.ok(f.methods.every(m=>m==='GET'))
 f.paymentReads=0;f.changedTransactions=true;assert.equal((await readPayrollDigitalCheck(intent,c)).settlementStatus,'NEEDS_REVIEW')
})
for(const variant of ['VALID','FOREIGN_DOCUMENT','AMBIGUOUS','STOPPED','EXPIRED','BAD_BYTES','TOO_LARGE','STREAM_TOO_LARGE','REDIRECT','UNTRUSTED_REDIRECT','UNKNOWN_HTTPS_ORIGIN'])test(`digital check PDF retrieval validates ownership and bounded delivery (${variant})`,async()=>{
 const f=fixture();f.current=order();let downloaded=false,redirectHeaders
 const pdf=Buffer.from('%PDF-1.4\nsynthetic check fixture\n%%EOF'),document={id:id(8),source:'modern_treasury',document_type:'rendered_check',documentable_type:'payment_order',documentable_id:variant==='FOREIGN_DOCUMENT'?id(99):id(5),file:{content_type:'application/pdf'}}
 const fetcher=async(url,options={})=>{
  assert.notEqual(options.method,'POST')
  if(url.includes('/documents?'))return Response.json(variant==='AMBIGUOUS'?[document,document]:[document])
  if(url.includes('/documents/')&&url.endsWith('/download')){downloaded=true;if(['REDIRECT','UNTRUSTED_REDIRECT','UNKNOWN_HTTPS_ORIGIN'].includes(variant))return new Response(null,{status:302,headers:{location:variant==='REDIRECT'?'https://checks.example.test/signed.pdf':variant==='UNKNOWN_HTTPS_ORIGIN'?'https://untrusted.example.test/check.pdf':'http://127.0.0.1/private'}});if(variant==='STOPPED')f.current.status='stopped';return new Response(variant==='BAD_BYTES'?'not a check':variant==='STREAM_TOO_LARGE'?Buffer.alloc(5*1024*1024+1):pdf,{headers:{'content-type':'application/pdf',...(variant==='TOO_LARGE'?{'content-length':String(6*1024*1024)}:{})}})}
  if(url==='https://checks.example.test/signed.pdf'){redirectHeaders=options.headers;assert.equal(options.redirect,'error');return new Response(pdf,{headers:{'content-type':'application/pdf'}})}
  return f.fetcher(url,options)
 }
 const result=await downloadPayrollDigitalCheck(intent,{...config,fetcher},{now:variant==='EXPIRED'?()=>new Date('2026-12-18T12:00:00Z'):now,allowedDownloadOrigins:['https://checks.example.test']})
 if(['VALID','REDIRECT'].includes(variant)){assert.equal(result.status,'PDF_READY');assert.deepEqual(result.bytes,pdf);assert.match(result.sha256,/^[a-f0-9]{64}$/);if(variant==='REDIRECT')assert.deepEqual(redirectHeaders,{})}
 else assert.equal(result.status,{FOREIGN_DOCUMENT:'DOCUMENT_NEEDS_REVIEW',AMBIGUOUS:'DOCUMENT_NEEDS_REVIEW',STOPPED:'CHECK_CHANGED',EXPIRED:'CHECK_EXPIRED',BAD_BYTES:'DOCUMENT_NEEDS_REVIEW',TOO_LARGE:'DOCUMENT_TOO_LARGE',STREAM_TOO_LARGE:'DOCUMENT_TOO_LARGE',UNKNOWN_HTTPS_ORIGIN:'DOWNLOAD_ORIGIN_REVIEW',UNTRUSTED_REDIRECT:'DOWNLOAD_ORIGIN_REVIEW'}[variant])
 if(['FOREIGN_DOCUMENT','AMBIGUOUS','EXPIRED'].includes(variant))assert.equal(downloaded,false)
})

for(const scenario of ['PAGINATED','CURSOR_LOOP','PRIOR_CHANGED','FOREIGN_PRIOR','MULTIPLE_NEW'])test(`stop retry reconciles all prior actions before creating another (${scenario})`,async()=>{
 const f=fixture();f.current=order();let posts=0,created=null,pages=0
 const action=(n,status)=>({id:id(n),type:'stop',actionable_id:id(5),actionable_type:'payment_order',internal_account_id:id(2),live_mode:true,status})
 const prior=[action(30,scenario==='PRIOR_CHANGED'?'acknowledged':'failed'),action(31,'cancelled')];if(scenario==='FOREIGN_PRIOR')prior[0].internal_account_id=id(99)
 const fetcher=async(url,options={})=>{
  if(!url.includes('/payment_actions'))return f.fetcher(url,options)
  if(options.method==='POST'){posts++;assert.equal(options.headers['Idempotency-Key'],`payroll_check_stop_${id(40)}`);created=action(32,'pending');throw new Error('Synthetic lost stop retry response')}
  pages++;const cursor=new URL(url).searchParams.get('after_cursor')
  if(!cursor)return Response.json([],{headers:{'X-After-Cursor':'second'}})
  if(cursor==='second')return Response.json(prior,{headers:{'X-After-Cursor':scenario==='CURSOR_LOOP'?'second':'third'}})
  assert.equal(cursor,'third');return Response.json(scenario==='MULTIPLE_NEW'?[action(32,'pending'),action(33,'pending')]:created?[created]:[])
 }
 const result=await resolvePayrollCheckStop(intent,{id:id(40),providerId:id(5)},{...config,fetcher,stopPaymentsEnabled:true},{allowCreate:true,priorActions:[id(30),id(31)]})
 assert.equal(result.status,scenario==='PAGINATED'?'UNCERTAIN':'NEEDS_REVIEW');assert.equal(result.requestSent,scenario==='PAGINATED');assert.equal(posts,scenario==='PAGINATED'?1:0)
 if(scenario==='PAGINATED'){assert.equal(pages,3);const recovered=await resolvePayrollCheckStop(intent,{id:id(40),providerId:id(5)},{...config,fetcher,stopPaymentsEnabled:true},{priorActions:[id(30),id(31)]});assert.equal(recovered.status,'PENDING');assert.equal(recovered.actionId,id(32));assert.equal(recovered.requestSent,false);assert.equal(posts,1)}
})

test('a pre-transmission stop failure retains the paid check it observed',async()=>{
 const f=fixture();f.current={...order(),status:'completed',reconciliation_status:'reconciled'};let posts=0
 const fetcher=async(url,options={})=>{if(url.includes('/payment_actions')){if(options.method==='POST')posts++;return Response.json([])}return f.fetcher(url,options)}
 const result=await resolvePayrollCheckStop(intent,{id:id(40),providerId:id(5)},{...config,fetcher,stopPaymentsEnabled:true},{allowCreate:true})
 assert.equal(result.status,'BLOCKED_STOP');assert.equal(result.requestSent,false);assert.equal(result.checkStatus,'COMPLETED');assert.equal(result.checkReconciliationStatus,'reconciled');assert.equal(posts,0)
})

for(const failure of ['REVERTED','THROWN'])test(`paid check evidence survives a later recovery failure (${failure})`,async()=>{
 const f=fixture();f.current={...order(),status:'completed',reconciliation_status:'reconciled',transaction_ids:[id(6)]};let reads=0
 const fetcher=async(url,options)=>{if(url.includes('/payment_orders/')){reads++;if(reads===2){if(failure==='THROWN')throw new Error('Synthetic final lookup failed');return Response.json({...order(),status:'sent'})}}return f.fetcher(url,options)}
 const result=await readPayrollDigitalCheck(intent,{...config,fetcher});assert.equal(result.status,'COMPLETED');assert.equal(result.reconciliationStatus,'reconciled');assert.equal(result.settlementStatus,failure==='THROWN'?'UNAVAILABLE':'NEEDS_REVIEW');assert.equal(f.posts,0)
})

test('stop recovery retains paid evidence observed before a sent reversion',async()=>{
 const f=fixture();let checks=0
 const fetcher=async(url,options)=>{if(url.includes('/payment_actions'))return Response.json([{id:id(30),type:'stop',actionable_id:id(5),actionable_type:'payment_order',internal_account_id:id(2),live_mode:true,status:'failed'}]);if(url.includes('/payment_orders/')){checks++;return Response.json({...order(),status:checks===1?'completed':'sent'})}return f.fetcher(url,options)}
 const result=await resolvePayrollCheckStop(intent,{id:id(40),providerId:id(5)},{...config,fetcher});assert.equal(result.status,'FAILED');assert.equal(result.checkStatus,'SENT');assert.equal(result.checkPaidObserved,true);assert.equal(result.requestSent,false)
})
