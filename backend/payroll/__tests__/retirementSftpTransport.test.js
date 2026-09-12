import {createRetirementSftpServer as fixture,syntheticSftpPrivateKey as privateKey} from '../testing/retirementSftpServer.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementSftpConfiguration,retirementSftpPublicAddress,transferRetirementAllocation,verifyRetirementSftpConnection} from '../retirementSftpTransport.js'
const file={name:'retirement_123.csv',bytes:Buffer.from('"participant","pretax"\r\n"00001","12.34"\r\n')}
test('SFTP endpoint review rejects unsafe addresses, ambiguous paths and missing pinned identity',()=>{
 for(const ip of ['127.0.0.1','10.2.3.4','169.254.169.254','100.64.1.1','192.168.1.1','0.0.0.0','::1','::ffff:127.0.0.1','2002:7f00:1::','2001:db8::1'])assert.equal(retirementSftpPublicAddress(ip),false,ip)
 for(const ip of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert.equal(retirementSftpPublicAddress(ip),true,ip)
 const c={host:'recordkeeper.example.com',port:22,username:'payroll',privateKey,hostKeySha256:'01'.repeat(32),stagingDirectory:'/staging',deliveryDirectory:'/incoming'}
 for(const changes of [{host:'localhost'},{host:'https://example.com'},{host:'example.local'},{hostKeySha256:''},{stagingDirectory:'/incoming/staging'},{deliveryDirectory:'/incoming/../private'},{username:'bad\nuser'}])assert.throws(()=>retirementSftpConfiguration({...c,...changes}))
 assert.equal(retirementSftpConfiguration({...c,hostKeySha256:'SHA256:'+Buffer.from(c.hostKeySha256,'hex').toString('base64').replace(/=$/,'')}).hostKeySha256,c.hostKeySha256)
})
test('real SFTP submission verifies bytes and repeated submission/recovery never rewrite the delivery',async()=>{
 const h=await fixture();let claims=0
 try{
  const first=await transferRetirementAllocation(h.config,file,{...h.options,mode:'SUBMIT',beforeWrite:async evidence=>{claims++;assert.equal(h.state.writes,0);assert.equal(evidence.byteLength,file.bytes.length);return true}})
  assert.equal(first.status,'REMOTE_FILE_VERIFIED');assert.equal(first.recordkeeperAcceptance,'UNVERIFIED');assert.equal(first.promotionAttempted,true);assert.deepEqual(h.files.get('/incoming/'+file.name),file.bytes)
  for(const mode of ['SUBMIT','RECOVER'])assert.equal((await transferRetirementAllocation(h.config,file,{...h.options,mode,beforeWrite:async()=>{throw new Error('Must not claim again')}})).status,'REMOTE_FILE_VERIFIED')
  assert.equal(claims,1);assert.equal(h.state.writes,1);assert.equal(h.state.renames,1)
 }finally{await h.close()}
})
test('lost rename response recovers exact remote bytes while consumed files remain uncertain and are never resent',async()=>{
 const h=await fixture();h.state.loseRename=true
 try{
  const r=await transferRetirementAllocation(h.config,file,{...h.options,mode:'SUBMIT',beforeWrite:async()=>true});assert.equal(r.status,'TRANSPORT_UNCERTAIN');assert.equal(r.promotionAttempted,true)
  assert.equal((await transferRetirementAllocation(h.config,file,h.options)).status,'REMOTE_FILE_VERIFIED')
  h.files.clear();assert.equal((await transferRetirementAllocation(h.config,file,h.options)).status,'REMOTE_FILE_NOT_FOUND');assert.equal(h.state.writes,1);assert.equal(h.state.renames,1)
 }finally{await h.close()}
})
test('wrong server key and mixed private DNS answers prevent authentication or writes',async()=>{
 const h=await fixture()
 try{
  assert.equal((await transferRetirementAllocation({...h.config,hostKeySha256:'00'.repeat(32)},file,h.options)).status,'TRANSPORT_UNCERTAIN');assert.equal(h.state.auths,0)
  let sockets=0;const r=await transferRetirementAllocation(h.config,file,{...h.options,resolve:async()=>[{address:'8.8.8.8'},{address:'127.0.0.1'}],socketFactory:()=>{sockets++;throw new Error('Must not connect')}})
  assert.equal(r.status,'TRANSPORT_UNCERTAIN');assert.equal(sockets,0);assert.equal(h.state.writes,0)
 }finally{await h.close()}
})
test('conflicting delivery, retained partial upload, corrupt staging and unconfirmed claims never promote',async()=>{
 const h=await fixture()
 try{
  h.files.set('/incoming/'+file.name,Buffer.alloc(file.bytes.length,1));assert.equal((await transferRetirementAllocation(h.config,file,h.options)).status,'REMOTE_FILE_CONFLICT');h.files.clear()
  assert.equal((await transferRetirementAllocation(h.config,file,{...h.options,mode:'SUBMIT',beforeWrite:async()=>false})).status,'CLAIM_NOT_CONFIRMED');assert.equal(h.state.writes,0)
  h.state.loseWrite=true;assert.equal((await transferRetirementAllocation(h.config,file,{...h.options,mode:'SUBMIT',beforeWrite:async()=>true})).status,'TRANSPORT_UNCERTAIN')
  assert.equal((await transferRetirementAllocation(h.config,file,{...h.options,mode:'SUBMIT',beforeWrite:async()=>{throw new Error('No new claim')}})).status,'STAGED_FILE_REQUIRES_REVIEW');assert.equal(h.state.writes,1)
  h.files.clear();h.state.loseWrite=false;h.state.corrupt=true;assert.equal((await transferRetirementAllocation(h.config,file,{...h.options,mode:'SUBMIT',beforeWrite:async()=>true})).status,'STAGED_FILE_CONFLICT');assert.equal(h.state.renames,0)
 }finally{await h.close()}
})
test('operation and DNS deadlines stop the transport and cannot connect after expiration',async()=>{
 const h=await fixture()
 try{
  h.files.set('/incoming/'+file.name,file.bytes);h.state.stallRead=true
  const started=Date.now();assert.equal((await transferRetirementAllocation(h.config,file,{...h.options,timeoutMs:500})).status,'TRANSPORT_UNCERTAIN');assert.ok(Date.now()-started<2000)
  let sockets=0;assert.equal((await transferRetirementAllocation(h.config,file,{...h.options,timeoutMs:100,resolve:async()=>{await new Promise(r=>setTimeout(r,200));return [{address:'8.8.8.8'}]},socketFactory:()=>{sockets++;throw new Error('Late connection')}})).status,'TRANSPORT_UNCERTAIN')
  await new Promise(r=>setTimeout(r,150));assert.equal(sockets,0)
 }finally{await h.close()}
})
test('concurrent large-file attempts produce one complete delivery without overwriting or using mutated caller bytes',async()=>{
 const h=await fixture(),bytes=Buffer.alloc(100000,65),large={name:'large.csv',bytes},original=Buffer.from(bytes)
 try{
  let claims=0
  const options={...h.options,mode:'SUBMIT',beforeWrite:async()=>{claims++;bytes.fill(66);return true}}
  const results=await Promise.all([transferRetirementAllocation(h.config,large,options),transferRetirementAllocation(h.config,large,options)])
  assert.ok(results.some(r=>r.status==='REMOTE_FILE_VERIFIED'));assert.equal(h.state.renames,1);assert.equal(h.state.created,1);assert.equal(h.state.bytesWritten,original.length);assert.ok(h.state.writes>1);assert.deepEqual(h.files.get('/incoming/large.csv'),original);assert.ok(claims>=1)
 }finally{await h.close()}
})
test('failed authentication and an authorization callback returning after deadline cannot upload',async()=>{
 const h=await fixture()
 try{
  const wrong=await transferRetirementAllocation({...h.config,username:'wrong'},file,{...h.options,mode:'SUBMIT',beforeWrite:async()=>true});assert.equal(wrong.status,'TRANSPORT_UNCERTAIN');assert.equal(wrong.writeAttempted,false)
  const delayed=await transferRetirementAllocation(h.config,file,{...h.options,timeoutMs:100,mode:'SUBMIT',beforeWrite:async()=>{await new Promise(r=>setTimeout(r,200));return true}})
  assert.equal(delayed.status,'TRANSPORT_UNCERTAIN');assert.equal(delayed.writeAttempted,false);await new Promise(r=>setTimeout(r,200));assert.equal(h.state.writes,0)
 }finally{await h.close()}
})

test('connection verification checks pinned identity and real directories without touching allocation files',async()=>{
 const h=await fixture();try{assert.deepEqual(await verifyRetirementSftpConnection(h.config,h.options),{status:'VERIFIED'});assert.equal(h.files.size,0);assert.equal(h.state.writes,0);assert.equal(h.state.renames,0)}finally{await h.close()}
})
