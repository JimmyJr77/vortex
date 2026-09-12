import {createHash,timingSafeEqual} from 'node:crypto'
import {lookup} from 'node:dns/promises'
import {BlockList,createConnection,isIP} from 'node:net'
import {posix} from 'node:path'
import ssh2 from 'ssh2'
const {Client}=ssh2
const fail=message=>Object.assign(new Error(message),{status:400})
const digest=b=>createHash('sha256').update(b).digest('hex')
const blocked=new BlockList()
for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])blocked.addSubnet(address,prefix,'ipv4')
const globalV6=new BlockList();globalV6.addSubnet('2000::',3,'ipv6')
for(const [address,prefix] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]])blocked.addSubnet(address,prefix,'ipv6')
export function retirementSftpPublicAddress(address){const family=isIP(address);return family===4?!blocked.check(address,'ipv4'):family===6&&globalV6.check(address,'ipv6')&&!blocked.check(address,'ipv6')}
export function retirementSftpConfiguration(input){
 const c=input||{},host=typeof c.host==='string'?c.host.toLowerCase():''
 if(host.length>253||!host.includes('.')||!host.split('.').every(s=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s))||host.endsWith('.localhost')||host.endsWith('.local')||!Number.isInteger(c.port)||c.port<1||c.port>65535)throw fail('Review the SFTP hostname and port.')
 if(typeof c.username!=='string'||!/^[-a-zA-Z0-9_.@]{1,128}$/.test(c.username)||typeof c.privateKey!=='string'||c.privateKey.length<100||c.privateKey.length>32768||c.passphrase!==undefined&&(typeof c.passphrase!=='string'||c.passphrase.length>4096))throw fail('Review SFTP authentication.')
 let fingerprint=c.hostKeySha256
 if(typeof fingerprint==='string'&&/^SHA256:[A-Za-z0-9+/]{43}=?$/.test(fingerprint))fingerprint=Buffer.from(fingerprint.slice(7),'base64').toString('hex')
 if(typeof fingerprint!=='string'||!/^[a-fA-F0-9]{64}$/.test(fingerprint))throw fail('Retain the independently verified SFTP SHA-256 host key.')
 for(const key of ['stagingDirectory','deliveryDirectory'])if(typeof c[key]!=='string'||c[key].length>512||!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(c[key])||posix.normalize(c[key])!==c[key])throw fail('Review absolute SFTP staging and delivery directories.')
 if(c.stagingDirectory===c.deliveryDirectory||c.stagingDirectory.startsWith(c.deliveryDirectory+'/'))throw fail('Staging must be outside the recordkeeper delivery directory.')
 return {...c,host,hostKeySha256:fingerprint.toLowerCase()}
}
// This transport does not reserve money, authorize delivery, or prove recordkeeper
// acceptance. The caller must durably claim the exact file before first writing.
export async function transferRetirementAllocation(configuration,file,{mode='RECOVER',beforeWrite,resolve=host=>lookup(host,{all:true,verbatim:true}),socketFactory=options=>createConnection(options),timeoutMs=30000}={}){
 const c=retirementSftpConfiguration(configuration)
 if(!file||!Buffer.isBuffer(file.bytes)||file.bytes.length===0||file.bytes.length>10*1024*1024||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}\.csv$/.test(file.name||'')||file.name.includes('..')||!['SUBMIT','RECOVER','VERIFY','VERIFY_ABSENCE','READ_RECEIPT'].includes(mode)||mode==='SUBMIT'&&typeof beforeWrite!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>60000)throw fail('Review the retained allocation file and claimed delivery action.')
 const bytes=Buffer.from(file.bytes),fileName=file.name
 const fingerprint=digest(bytes),target=posix.join(c.deliveryDirectory,fileName),staged=posix.join(c.stagingDirectory,fileName+'.part')
 let active=true,client,socket,timer,writeAttempted=false,promotionAttempted=false
 const check=()=>{if(!active)throw new Error('Transport ended')}
 const call=(sftp,method,...args)=>new Promise((resolve,reject)=>{check();sftp[method](...args,(error,...values)=>error?reject(error):resolve(values))})
 const remote=async()=>{
  const addresses=await resolve(c.host);check()
  if(!Array.isArray(addresses)||!addresses.length||addresses.some(a=>!retirementSftpPublicAddress(a.address)))throw new Error('Destination address requires review')
  socket=socketFactory({host:addresses[0].address,port:c.port});client=new Client()
  const sftp=await new Promise((resolve,reject)=>{
   client.on('error',reject);client.once('close',()=>reject(new Error('Connection closed')));socket.on('error',reject)
   client.once('ready',()=>client.sftp((error,sftp)=>error?reject(error):resolve(sftp)))
   client.connect({sock:socket,host:c.host,port:c.port,username:c.username,privateKey:c.privateKey,passphrase:c.passphrase,hostHash:'sha256',hostVerifier:key=>typeof key==='string'&&/^[a-f0-9]{64}$/.test(key)&&timingSafeEqual(Buffer.from(key,'hex'),Buffer.from(c.hostKeySha256,'hex')),readyTimeout:timeoutMs,keepaliveInterval:5000,keepaliveCountMax:1})
  });check()
  for(const directory of [c.stagingDirectory,c.deliveryDirectory]){const [canonical]=await call(sftp,'realpath',directory);if(canonical!==directory)throw new Error('Directory binding changed');const [attrs]=await call(sftp,'lstat',directory);if(!attrs.isDirectory())throw new Error('Reviewed directory unavailable')}
  if(mode==='VERIFY')return {status:'CONNECTION_VERIFIED'}
  const stat=async path=>{try{return (await call(sftp,'lstat',path))[0]}catch(e){if(e.code===2)return null;throw e}}
  if(mode==='READ_RECEIPT'){
   const initial=await stat(target);if(!initial)return {status:'RECEIPT_NOT_FOUND'}
   if(!initial.isFile()||!Number.isSafeInteger(initial.size)||initial.size<=0||initial.size>10*1024*1024)return {status:'RECEIPT_UNSUPPORTED'}
   const consistent=attrs=>attrs?.isFile()&&attrs.size===initial.size&&attrs.mtime===initial.mtime
   const read=async()=>{
    const [handle]=await call(sftp,'open',target,'r')
    try{
     if(!consistent((await call(sftp,'fstat',handle))[0]))return null
     const content=Buffer.alloc(initial.size);let offset=0
     while(offset<content.length){const length=Math.min(32768,content.length-offset),[n]=await call(sftp,'read',handle,content,offset,length,offset);if(!Number.isInteger(n)||n<=0||n>length)return null;offset+=n}
     return consistent((await call(sftp,'fstat',handle))[0])?content:null
    }finally{await call(sftp,'close',handle)}
   }
   const first=await read();if(!first)return {status:'RECEIPT_CHANGED'}
   const second=await read(),after=await stat(target)
   if(!second||!first.equals(second)||!consistent(after))return {status:'RECEIPT_CHANGED'}
   return {status:'RECEIPT_READ',bytes:first}
  }
  const matches=async path=>{
   const attrs=await stat(path);if(!attrs)return null
   if(!attrs.isFile()||attrs.size!==bytes.length)return false
   const [handle]=await call(sftp,'open',path,'r')
   try{
    const [opened]=await call(sftp,'fstat',handle);if(!opened.isFile()||opened.size!==bytes.length)return false
    const hash=createHash('sha256');let offset=0
    while(offset<bytes.length){const buffer=Buffer.alloc(Math.min(32768,bytes.length-offset));const [n]=await call(sftp,'read',handle,buffer,0,buffer.length,offset);if(!Number.isInteger(n)||n<=0||n>buffer.length)return false;hash.update(buffer.subarray(0,n));offset+=n}
    const [after]=await call(sftp,'fstat',handle)
    return after.isFile()&&after.size===bytes.length&&hash.digest('hex')===fingerprint
   }finally{await call(sftp,'close',handle)}
  }
  const existing=await matches(target)
  if(existing!==null)return {status:existing?'REMOTE_FILE_VERIFIED':'REMOTE_FILE_CONFLICT',reused:true}
  if(mode==='RECOVER')return {status:'REMOTE_FILE_NOT_FOUND'}
  if(await stat(staged))return {status:'STAGED_FILE_REQUIRES_REVIEW'}
  if(mode==='VERIFY_ABSENCE')return {status:'REMOTE_PATHS_ABSENT'}
  if(await beforeWrite({fileName,sha256:fingerprint,byteLength:bytes.length})!==true)return {status:'CLAIM_NOT_CONFIRMED'}
  check();writeAttempted=true
  const [handle]=await call(sftp,'open',staged,'wx',0o600)
  try{for(let offset=0;offset<bytes.length;offset+=32768){const length=Math.min(32768,bytes.length-offset);await call(sftp,'write',handle,bytes,offset,length,offset)}}finally{await call(sftp,'close',handle)}
  if(await matches(staged)!==true)return {status:'STAGED_FILE_CONFLICT'}
  if(await stat(target))return {status:'REMOTE_FILE_CONFLICT'}
  check();promotionAttempted=true
  await call(sftp,'rename',staged,target)
  const final=await matches(target)
  return {status:final===true?'REMOTE_FILE_VERIFIED':final===false?'REMOTE_FILE_CONFLICT':'REMOTE_FILE_NOT_FOUND',reused:false}
 }
 try{
  const result=await Promise.race([remote(),new Promise((_,reject)=>{timer=setTimeout(()=>{active=false;reject(new Error('Transport deadline elapsed'))},timeoutMs)})])
  return {...result,sha256:mode==='READ_RECEIPT'&&result.bytes?digest(result.bytes):fingerprint,byteLength:mode==='READ_RECEIPT'&&result.bytes?result.bytes.length:bytes.length,writeAttempted,promotionAttempted,noWriteProof:mode==='SUBMIT'&&!writeAttempted&&!promotionAttempted&&result.status==='CLAIM_NOT_CONFIRMED',recordkeeperAcceptance:'UNVERIFIED'}
 }catch{return {status:'TRANSPORT_UNCERTAIN',sha256:fingerprint,byteLength:bytes.length,writeAttempted,promotionAttempted,noWriteProof:mode==='SUBMIT'&&!writeAttempted&&!promotionAttempted,recordkeeperAcceptance:'UNVERIFIED'}}
 finally{active=false;clearTimeout(timer);client?.destroy();socket?.destroy()}
}

export async function verifyRetirementSftpConnection(configuration,options={}){
 const result=await transferRetirementAllocation(configuration,{name:'verification.csv',bytes:Buffer.from('connection review')},{...options,mode:'VERIFY'})
 return {status:result.status==='CONNECTION_VERIFIED'?'VERIFIED':'UNAVAILABLE'}
}

// Read-only receipt retrieval shares the pinned SSH connection and deadline checks.
// A retrieved file still requires the separately reviewed receipt contract.
export async function readRetirementSftpReceipt(configuration,receipt,options={}){
 if(!receipt||typeof receipt.directory!=='string'||typeof receipt.fileName!=='string')throw fail('Review the exact receipt directory and filename.')
 const result=await transferRetirementAllocation({...configuration,deliveryDirectory:receipt.directory},{name:receipt.fileName,bytes:Buffer.from('receipt retrieval')},{...options,mode:'READ_RECEIPT'})
 if(result.status==='RECEIPT_READ')return {status:'READ',bytes:result.bytes,sha256:result.sha256,byteLength:result.byteLength}
 return {status:result.status==='RECEIPT_NOT_FOUND'?'NOT_FOUND':result.status==='RECEIPT_CHANGED'?'CHANGED':result.status==='RECEIPT_UNSUPPORTED'?'UNSUPPORTED':'UNAVAILABLE'}
}
