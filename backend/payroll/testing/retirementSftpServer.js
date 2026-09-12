import {createHash,generateKeyPairSync} from 'node:crypto'
import {createConnection} from 'node:net'
import ssh2 from 'ssh2'
const {Server,utils}=ssh2,{STATUS_CODE:S,OPEN_MODE:O}=utils.sftp
const key=()=>generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey
const hostKey=key(),privateKey=key(),publicKey=utils.parseKey(privateKey)
export async function createRetirementSftpServer(){
 const files=new Map(),clients=new Set(),state={fileMode:null,reads:0,onRead:null,disconnectRead:false,writes:0,bytesWritten:0,created:0,renames:0,auths:0,loseRename:false,loseWrite:false,stallRead:false,corrupt:false}
 const server=new Server({hostKeys:[hostKey]},client=>{
  clients.add(client);client.on('error',()=>{});client.on('close',()=>clients.delete(client))
  client.on('authentication',ctx=>{state.auths++;if(ctx.method==='publickey'&&ctx.username==='payroll'&&ctx.key.data.equals(publicKey.getPublicSSH())&&(!ctx.signature||publicKey.verify(ctx.blob,ctx.signature,ctx.hashAlgo)))ctx.accept();else ctx.reject()})
  client.on('ready',()=>client.on('session',accept=>accept().on('sftp',accept=>{
   const sftp=accept(),handles=new Map();let next=0
   const attrs=path=>({mode:state.fileMode??0o100600,size:files.get(path).length,uid:1,gid:1,atime:0,mtime:0})
   sftp.on('REALPATH',(id,path)=>sftp.name(id,[{filename:path,longname:path,attrs:{}}]))
   sftp.on('LSTAT',(id,path)=>['/staging','/incoming'].includes(path)?sftp.attrs(id,{mode:0o40700,size:0,uid:1,gid:1,atime:0,mtime:0}):files.has(path)?sftp.attrs(id,attrs(path)):sftp.status(id,S.NO_SUCH_FILE))
   sftp.on('OPEN',(id,path,flags)=>{
    if(flags&O.WRITE){if(files.has(path)||!(flags&O.EXCL))return sftp.status(id,S.FAILURE);state.created++;files.set(path,Buffer.alloc(0))}
    if(!files.has(path))return sftp.status(id,S.NO_SUCH_FILE)
    const h=Buffer.alloc(4);h.writeUInt32BE(++next);handles.set(next,path);sftp.handle(id,h)
   })
   sftp.on('FSTAT',(id,h)=>sftp.attrs(id,attrs(handles.get(h.readUInt32BE()))))
   sftp.on('READ',(id,h,offset,length)=>{state.reads++;const path=handles.get(h.readUInt32BE());state.onRead?.({path,offset,length,count:state.reads});if(state.disconnectRead){client.end();return}if(state.stallRead)return;const b=files.get(path);if(offset>=b.length)return sftp.status(id,S.EOF);sftp.data(id,b.subarray(offset,offset+length))})
   sftp.on('WRITE',(id,h,offset,data)=>{state.writes++;state.bytesWritten+=data.length;const path=handles.get(h.readUInt32BE()),prior=files.get(path),b=Buffer.alloc(Math.max(prior.length,offset+data.length));prior.copy(b);data.copy(b,offset);if(state.corrupt)b[0]^=1;files.set(path,b);if(state.loseWrite){client.end();return}sftp.status(id,S.OK)})
   sftp.on('CLOSE',(id,h)=>{handles.delete(h.readUInt32BE());sftp.status(id,S.OK)})
   sftp.on('RENAME',(id,from,to)=>{state.renames++;if(files.has(to)||!files.has(from))return sftp.status(id,S.FAILURE);files.set(to,files.get(from));files.delete(from);if(state.loseRename){client.end();return}sftp.status(id,S.OK)})
  })))
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const config={host:'recordkeeper.example.com',port:22,username:'payroll',privateKey,hostKeySha256:createHash('sha256').update(utils.parseKey(hostKey).getPublicSSH()).digest('hex'),stagingDirectory:'/staging',deliveryDirectory:'/incoming'}
 const options={resolve:async()=>[{address:'8.8.8.8'}],socketFactory:()=>createConnection({host:'127.0.0.1',port:server.address().port}),timeoutMs:1500}
 return {config,options,files,state,close:async()=>{for(const c of clients)c.end();await new Promise(resolve=>server.close(resolve))}}
}

export {privateKey as syntheticSftpPrivateKey}
