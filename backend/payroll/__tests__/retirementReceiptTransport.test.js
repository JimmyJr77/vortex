import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {readRetirementSftpReceipt} from '../retirementSftpTransport.js'
const receipt={directory:'/incoming',fileName:'receipt_123.csv'}
test('receipt retrieval reads exact bytes twice without remote writes or exposing connection fields',async()=>{
 const s=await createRetirementSftpServer();try{
  const content=Buffer.from('receipt,data\r\n'+('synthetic,participant\r\n').repeat(10000));s.files.set('/incoming/receipt_123.csv',content)
  let writeCallback=false;const result=await readRetirementSftpReceipt(s.config,receipt,{...s.options,mode:'SUBMIT',beforeWrite:async()=>{writeCallback=true;return true}});assert.equal(writeCallback,false);assert.equal(result.status,'READ');assert.ok(result.bytes.equals(content));assert.equal(result.byteLength,content.length);assert.equal(result.sha256,createHash('sha256').update(content).digest('hex'));assert.ok(s.state.reads>=2);assert.equal(s.state.created,0);assert.equal(s.state.writes,0);assert.equal(s.state.renames,0)
  assert.deepEqual(Object.keys(result).sort(),['byteLength','bytes','sha256','status']);result.bytes[0]^=1;assert.ok(s.files.get('/incoming/receipt_123.csv').equals(content))
 }finally{await s.close()}
})
test('receipt absence, empty/oversized files, unsafe paths and unavailable authentication remain explicit',async()=>{
 const s=await createRetirementSftpServer();try{
  assert.deepEqual(await readRetirementSftpReceipt(s.config,receipt,s.options),{status:'NOT_FOUND'})
  for(const bytes of [Buffer.alloc(0),Buffer.alloc(10*1024*1024+1)]){s.files.set('/incoming/receipt_123.csv',bytes);assert.deepEqual(await readRetirementSftpReceipt(s.config,receipt,s.options),{status:'UNSUPPORTED'})}
  s.files.set('/incoming/receipt_123.csv',Buffer.from('receipt'));s.state.fileMode=0o120777;assert.deepEqual(await readRetirementSftpReceipt(s.config,receipt,s.options),{status:'UNSUPPORTED'});s.state.fileMode=null
  for(const r of [{...receipt,directory:'/incoming/../secrets'},{...receipt,fileName:'../file.csv'},{...receipt,fileName:'unsafe.json'}])await assert.rejects(readRetirementSftpReceipt(s.config,r,s.options))
  assert.deepEqual(await readRetirementSftpReceipt({...s.config,username:'wrong'},receipt,s.options),{status:'UNAVAILABLE'});assert.deepEqual(await readRetirementSftpReceipt({...s.config,hostKeySha256:'0'.repeat(64)},receipt,s.options),{status:'UNAVAILABLE'});assert.equal(s.state.created,0)
 }finally{await s.close()}
})
test('same-size receipt replacement between independent reads cannot be reported as a stable receipt',async()=>{
 const s=await createRetirementSftpServer();try{
  s.files.set('/incoming/receipt_123.csv',Buffer.from('first contents'))
  s.state.onRead=({count})=>{if(count===2)s.files.set('/incoming/receipt_123.csv',Buffer.from('other contents'))}
  assert.deepEqual(await readRetirementSftpReceipt(s.config,receipt,s.options),{status:'CHANGED'});assert.equal(s.state.created,0);assert.equal(s.state.renames,0)
 }finally{await s.close()}
})
test('receipt growth during a read, disconnects and read deadlines never return partial content',async()=>{
 const s=await createRetirementSftpServer();try{
  s.files.set('/incoming/receipt_123.csv',Buffer.from('old contents'));s.state.onRead=()=>s.files.set('/incoming/receipt_123.csv',Buffer.from('new larger contents'))
  assert.deepEqual(await readRetirementSftpReceipt(s.config,receipt,s.options),{status:'CHANGED'})
  s.state.onRead=null;s.state.disconnectRead=true;assert.deepEqual(await readRetirementSftpReceipt(s.config,receipt,{...s.options,timeoutMs:150}),{status:'UNAVAILABLE'})
  s.state.disconnectRead=false;s.state.stallRead=true;assert.deepEqual(await readRetirementSftpReceipt(s.config,receipt,{...s.options,timeoutMs:150}),{status:'UNAVAILABLE'});assert.equal(s.state.created,0);assert.equal(s.state.writes,0)
 }finally{await s.close()}
})
