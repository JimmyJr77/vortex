import {retirementReceiptEvolution} from '../retirementReceiptEvolution.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomBytes} from 'node:crypto'
import {retirementReceiptFields,retirementReceiptContractInput,retirementReceiptCsv,reconcileRetirementAllocationReceipt} from '../retirementAllocationReceipt.js'
import {allocationFields} from '../retirementAllocationFormat.js'
import {retirementAllocationCsv} from '../retirementAllocationFile.js'
const quote=v=>'"'+String(v).replaceAll('"','""')+'"'
const csv=(columns,rows)=>Buffer.from([columns.map(c=>quote(c.header)).join(','),...rows.map(row=>columns.map(c=>quote(row[c.field])).join(','))].join('\r\n')+'\r\n')
const contract=()=>({confirmed:true,sourceHashConfirmed:true,cumulativeAmountsConfirmed:true,participantPostingConfirmed:true,reference:'Reviewed actual provider cumulative receipt and participant credit specification',amountFormat:'CENTS',dateFormat:'ISO',columns:retirementReceiptFields.map(field=>({field,header:field})),statusValues:{PENDING:'Waiting',ACCEPTED:'Imported',POSTED:'Credited',REJECTED:'Rejected'}})
function fixture(){
 const columns=allocationFields.map(field=>({field,header:field})),allocations=[{employeeId:10,ordinaryPretaxCents:1000,ordinaryRothCents:400,catchUpPretaxCents:0,catchUpRothCents:0,totalCents:1400},{employeeId:20,ordinaryPretaxCents:2000,ordinaryRothCents:0,catchUpPretaxCents:300,catchUpRothCents:200,totalCents:2500}]
 const sourceRows=allocations.map((a,i)=>({...a,providerPlanId:'Private Plan',participantId:`Participant, "${i}"`,withheldDate:'2026-09-10'})),basis={amountFormat:'DOLLARS',dateFormat:'US',columns,includeHeader:true,allocations,withheldDate:'2026-09-10',amountCents:3900,rowCount:2}
 const allocationBytes=Buffer.from(retirementAllocationCsv(basis,sourceRows)),fileName='retirement_2026.csv',sourceSha256=createHash('sha256').update(allocationBytes).digest('hex'),c=contract()
 const rows=sourceRows.map(row=>({...row,sourceFileName:fileName,sourceSha256,batchId:'Batch 123',status:'Credited',recordedAt:'2026-09-19T09:00:00-04:00'}))
 const input={allocationBytes,basis,fileName,contract:c,claimedAt:'2026-09-19T12:00:00Z',now:new Date('2026-10-02T12:00:00Z')}
 return {rows,input,run:(next=rows,changes={})=>reconcileRetirementAllocationReceipt({...input,receiptBytes:csv(c.columns,next),...changes})}
}
test('receipt matches original encrypted-file representation, reordered participants and category totals without exposing identifiers',()=>{
 const f=fixture(),r=f.run([...f.rows].reverse());assert.equal(r.status,'POSTED');assert.equal(r.postedCents,3900);assert.deepEqual(r.participants.map(p=>p.employeeId),['10','20']);assert.equal(r.participants[0].recordedAt,'2026-09-19T13:00:00.000Z');assert.ok(!JSON.stringify(r).includes('Participant'));assert.ok(!JSON.stringify(r).includes('Private Plan'))
 const c={...contract(),amountFormat:'DOLLARS',dateFormat:'US',columns:[...contract().columns].reverse()},rows=f.rows.map(r=>({...r,withheldDate:'09/10/2026',ordinaryPretaxCents:(r.ordinaryPretaxCents/100).toFixed(2),ordinaryRothCents:(r.ordinaryRothCents/100).toFixed(2),catchUpPretaxCents:(r.catchUpPretaxCents/100).toFixed(2),catchUpRothCents:(r.catchUpRothCents/100).toFixed(2),totalCents:(r.totalCents/100).toFixed(2)}))
 assert.equal(f.run(rows,{contract:c,receiptBytes:csv(c.columns,rows)}).status,'POSTED')
})
test('accepted, partial, rejected and pending receipts never imply full participant posting',()=>{
 const f=fixture();assert.equal(f.run(f.rows.map(r=>({...r,status:'Imported'}))).status,'ACCEPTED')
 const partial=[{...f.rows[0],status:'Imported',ordinaryPretaxCents:500,totalCents:900},{...f.rows[1],status:'Imported'}];assert.equal(f.run(partial).status,'PARTIALLY_ACCEPTED')
 partial[0].status='Credited';assert.equal(f.run(partial).status,'PARTIALLY_POSTED');assert.equal(f.run(partial).postedCents,900)
 const zero=status=>f.rows.map(r=>({...r,status,ordinaryPretaxCents:0,ordinaryRothCents:0,catchUpPretaxCents:0,catchUpRothCents:0,totalCents:0}))
 assert.equal(f.run(zero('Rejected')).status,'REJECTED');assert.equal(f.run(zero('Waiting')).status,'PENDING');assert.equal(f.run([zero('Rejected')[0],zero('Waiting')[1]]).status,'PARTIALLY_REJECTED');assert.throws(()=>f.run(zero('Credited')),/status and cumulative/)
})
test('receipt rejects wrong file/hash/batch, missing, extra, duplicate and unexpected participant rows',()=>{
 const f=fixture();for(const change of [{sourceFileName:'other.csv'},{sourceSha256:'0'.repeat(64)},{batchId:'Different batch'},{participantId:'Unexpected person'},{providerPlanId:'Wrong plan'},{withheldDate:'2026-09-11'}])assert.throws(()=>f.run([{...f.rows[0],...change},f.rows[1]]))
 assert.throws(()=>f.run(f.rows.slice(0,1)),/every original participant/);assert.throws(()=>f.run([...f.rows,f.rows[0]]),/every original participant/);assert.throws(()=>f.run([f.rows[0],f.rows[0]]),/duplicated/)
})
test('receipt rejects fractional, unsafe, redistributed and contradictory amounts and invalid timestamps',()=>{
 const f=fixture();for(const change of [{ordinaryPretaxCents:'1.2'},{ordinaryPretaxCents:'1e3'},{ordinaryPretaxCents:'-1'},{ordinaryPretaxCents:'9007199254740992'},{ordinaryPretaxCents:900,totalCents:1400},{ordinaryPretaxCents:999,ordinaryRothCents:401},{status:'Rejected'},{status:'Unknown'},{recordedAt:'2026-09-19T11:59:59Z'},{recordedAt:'2026-10-03T00:00:00Z'},{recordedAt:'2026-09-31T12:00:00Z'},{recordedAt:'2026-09-19T24:00:00Z'},{recordedAt:'2026-09-19T13:00:00'}])assert.throws(()=>f.run([{...f.rows[0],...change},f.rows[1]]))
})
test('receipt rejects a corrupt retained allocation, incorrect totals and mismatched employee attribution',()=>{
 const f=fixture();for(const changes of [{amountCents:1},{rowCount:3},{withheldDate:'2026-09-11'},{amountFormat:'UNKNOWN'},{allocations:[f.input.basis.allocations[1],f.input.basis.allocations[0]]},{allocations:f.input.basis.allocations.map(a=>({...a,employeeId:10}))},{columns:f.input.basis.columns.slice(1)}])assert.throws(()=>f.run(f.rows,{basis:{...f.input.basis,...changes}}))
 assert.throws(()=>f.run(f.rows,{allocationBytes:Buffer.from('bad source')}))
})
test('CSV parsing is bounded and strict about encoding, quoting and row dimensions',()=>{
 assert.deepEqual(retirementReceiptCsv(Buffer.from('\ufeff"A","B"\r\n"a,""b""","two\nlines"\r\n')),[['A','B'],['a,"b"','two\nlines']])
 for(const bytes of [Buffer.from([0xc3,0x28]),Buffer.from('"unfinished'),Buffer.from('"closed"junk'),Buffer.from('unquoted"quote'),Buffer.from('one\rtwo'),Buffer.from('x'.repeat(8193)),Buffer.from('x\n'.repeat(10002)),Buffer.from(Array(65).fill('x').join(',')),Buffer.alloc(10*1024*1024+1)])assert.throws(()=>retirementReceiptCsv(bytes))
 const f=fixture();assert.throws(()=>f.run(f.rows,{receiptBytes:Buffer.from('wrong,headers\n1,2\n')}),/headers/)
})
test('receipt contract requires reviewed semantics and unique field/status mappings',()=>{
 const c=contract();assert.equal(retirementReceiptContractInput(c).version,1)
 for(const change of [{sourceHashConfirmed:false},{cumulativeAmountsConfirmed:false},{participantPostingConfirmed:false},{reference:'short'},{columns:c.columns.slice(1)},{columns:c.columns.map((x,i)=>i===1?c.columns[0]:x)},{statusValues:{...c.statusValues,POSTED:c.statusValues.ACCEPTED}}])assert.throws(()=>retirementReceiptContractInput({...c,...change}))
})
test('receipt evaluator consumes the exact retained payroll authorization basis from PostgreSQL',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const {createHarness}=await import('../testing/harness.js'),{retirementRemittanceAuthorizationFixture}=await import('../testing/retirementRemittanceAuthorizationFixture.js'),{retirementDestinationProvider}=await import('../testing/retirementDestinationProvider.js'),{decryptDocument}=await import('../onboarding.js')
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T12:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z')})
 try{const f=await retirementRemittanceAuthorizationFixture(h),a=await f.api(f.path,f.body),stored=(await h.pool.query('SELECT * FROM payroll_retirement_remittance_authorization WHERE id=$1',[a.id])).rows[0],bytes=decryptDocument(stored.encrypted_allocation,`payroll-retirement-remittance:1:${a.id}`),source=retirementReceiptCsv(bytes),columns=source.shift(),c=contract(),fileName='retained.csv'
 const rows=source.map(values=>{const r=Object.fromEntries(columns.map((k,i)=>[k,values[i]]));return {...r,...Object.fromEntries(allocationFields.filter(k=>k.endsWith('Cents')).map(k=>[k,String(Math.round(Number(r[k])*100))])),sourceFileName:fileName,sourceSha256:createHash('sha256').update(bytes).digest('hex'),batchId:'Test batch',status:'Credited',recordedAt:'2026-09-19T13:00:00Z'}})
 const result=reconcileRetirementAllocationReceipt({receiptBytes:csv(c.columns,rows),contract:c,allocationBytes:bytes,basis:stored.basis,fileName,claimedAt:'2026-09-19T12:00:00Z',now:new Date('2026-09-19T14:00:00Z')});assert.equal(result.status,'POSTED');assert.equal(result.postedCents,1400)
 }finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})

test('reviewed full participant reversals retain exact allocations and require affirmative evolution evidence',()=>{
 const f=fixture(),contract={...f.input.contract,participantReversalConfirmed:true,statusValues:{...f.input.contract.statusValues,REVERSED:'Reversed credit'}}
 assert.equal(retirementReceiptContractInput(contract).version,2)
 assert.throws(()=>retirementReceiptContractInput({...contract,participantReversalConfirmed:false}))
 assert.throws(()=>retirementReceiptContractInput({...contract,statusValues:{...contract.statusValues,REVERSED:'Credited'}}))
 const rows=f.rows.map(r=>({...r,status:'Reversed credit',recordedAt:'2026-09-24T15:00:00Z',ordinaryPretaxCents:0,ordinaryRothCents:0,catchUpPretaxCents:0,catchUpRothCents:0,totalCents:0})),reverse=f.run(rows,{contract})
 assert.equal(reverse.status,'REVERSED');assert.equal(reverse.reversedAllocationCents,3900);assert.equal(reverse.unreportedCents,0);assert.equal(reverse.postedCents,0)
 assert.equal(retirementReceiptEvolution(null,reverse,{allowReversals:true}),'REGRESSION')
 const original=f.run();assert.equal(retirementReceiptEvolution(original,reverse),'REGRESSION');assert.equal(retirementReceiptEvolution(original,reverse,{allowReversals:true}),'CURRENT')
 assert.equal(retirementReceiptEvolution(reverse,original,{allowReversals:true}),'STALE')
 assert.equal(retirementReceiptEvolution(reverse,{...original,participants:original.participants.map(p=>({...p,recordedAt:'2026-09-25T15:00:00Z'}))},{allowReversals:true}),'REGRESSION')
 assert.equal(retirementReceiptEvolution({...original,participants:original.participants.map(p=>({...p,fullyAccounted:false}))},reverse,{allowReversals:true}),'REGRESSION')
 assert.throws(()=>f.run([{...rows[0],ordinaryPretaxCents:1,totalCents:1},rows[1]],{contract}),/status and cumulative/)
 const partial=f.run([rows[0],f.rows[1]],{contract});assert.equal(partial.status,'PARTIALLY_REVERSED');assert.equal(partial.reversedAllocationCents,1400)
})
