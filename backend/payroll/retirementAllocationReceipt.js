import {createHash} from 'node:crypto'
import {allocationFields} from './retirementAllocationFormat.js'
const fail=message=>Object.assign(new Error(message),{status:409})
export const retirementReceiptFields=['sourceFileName','sourceSha256','batchId',...allocationFields,'status','recordedAt']
const categories=['ordinaryPretaxCents','ordinaryRothCents','catchUpPretaxCents','catchUpRothCents']
const statuses=['PENDING','ACCEPTED','POSTED','REJECTED']
const receiptStatuses=contract=>contract.participantReversalConfirmed===true?[...statuses,'REVERSED']:statuses
const safeText=(x,max=200)=>typeof x==='string'&&x.length>0&&x.length<=max&&!/[\u0000-\u001f\u007f]/.test(x)
const sum=values=>{const n=values.reduce((a,b)=>a+b,0);if(!Number.isSafeInteger(n))throw fail('Receipt amounts exceed exact integer capacity.');return n}
export function retirementReceiptContractInput(b){
 if(!b||b.confirmed!==true||b.sourceHashConfirmed!==true||b.cumulativeAmountsConfirmed!==true||b.participantPostingConfirmed!==true||!safeText(b.reference,2000)||b.reference.trim().length<20)throw fail('Review the actual provider receipt specification, source-file hash, cumulative category amounts and participant-posting meaning.')
 if(!['CENTS','DOLLARS'].includes(b.amountFormat)||!['ISO','US'].includes(b.dateFormat)||!Array.isArray(b.columns)||b.columns.length!==retirementReceiptFields.length)throw fail('Review every receipt column and its exact amount and date formats.')
 const fields=new Set(),headers=new Set(),columns=b.columns.map(c=>{if(!retirementReceiptFields.includes(c?.field)||fields.has(c.field)||typeof c.header!=='string'||!/^[A-Za-z][A-Za-z0-9 _().-]{0,79}$/.test(c.header)||headers.has(c.header.toLowerCase()))throw fail('Receipt fields and headers must be unique and complete.');fields.add(c.field);headers.add(c.header.toLowerCase());return {field:c.field,header:c.header}})
 const values=new Set(),statusValues={}
 if((b.statusValues?.REVERSED!==undefined||b.participantReversalConfirmed===true)&&b.participantReversalConfirmed!==true)throw fail('Independently verify that REVERSED means the full original participant allocation was reversed with no remaining credit.')
 for(const status of receiptStatuses(b)){const value=b.statusValues?.[status];if(!safeText(value,80)||value!==value.trim()||values.has(value))throw fail('Review distinct provider values for pending, accepted, posted and rejected.');values.add(value);statusValues[status]=value}
 return {version:b.participantReversalConfirmed===true?2:1,...(b.participantReversalConfirmed===true?{participantReversalConfirmed:true}:{}),confirmed:true,sourceHashConfirmed:true,cumulativeAmountsConfirmed:true,participantPostingConfirmed:true,reference:b.reference.trim(),columns,statusValues,amountFormat:b.amountFormat,dateFormat:b.dateFormat,encoding:'UTF-8',delimiter:',',includeHeader:true}
}
// Bounded UTF-8 CSV parsing; malformed quoting, dimensions and encoding fail closed.
export function retirementReceiptCsv(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>10*1024*1024)throw fail('Receipt file size is unsupported.')
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw fail('Receipt must contain valid UTF-8.')}
 if(text.charCodeAt(0)===0xfeff)text=text.slice(1)
 const rows=[];let row=[],field='',quoted=false,closed=false,started=false
 const append=char=>{field+=char;if(field.length>8192)throw fail('Receipt field exceeds the supported size.')}
 const cell=()=>{row.push(field);if(row.length>64)throw fail('Receipt has too many columns.');field='';closed=false;started=false}
 const line=()=>{cell();rows.push(row);if(rows.length>10001)throw fail('Receipt has too many rows.');row=[]}
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(quoted){if(c==='"'){if(text[i+1]==='"'){append('"');i++}else{quoted=false;closed=true}}else append(c);continue}
  if(c===','){cell();continue}
  if(c==='\n'||c==='\r'){if(c==='\r'){if(text[i+1]!=='\n')throw fail('Receipt has an unsupported line ending.');i++}line();continue}
  if(closed)throw fail('Receipt contains data after a closed quoted field.')
  if(c==='"'){if(started)throw fail('Receipt contains a quote inside an unquoted field.');quoted=true;started=true;continue}
  append(c);started=true
 }
 if(quoted)throw fail('Receipt contains an unterminated quoted field.')
 if(started||closed||field||row.length)line()
 if(!rows.length)throw fail('Receipt contains no rows.')
 return rows
}
function cents(value,format){
 if(typeof value!=='string'||!(format==='CENTS'?/^(0|[1-9]\d*)$/:/^(0|[1-9]\d*)\.\d{2}$/).test(value))throw fail('Receipt amounts must be exact nonnegative cents without rounding.')
 const n=format==='CENTS'?Number(value):Number(value.replace('.',''));if(!Number.isSafeInteger(n))throw fail('Receipt amount exceeds exact integer capacity.');return n
}
function date(value,format){
 if(typeof value!=='string')throw fail('Receipt withholding date is invalid.')
 const iso=format==='US'&&/^\d{2}\/\d{2}\/\d{4}$/.test(value)?`${value.slice(6)}-${value.slice(0,2)}-${value.slice(3,5)}`:value
 if((format==='US'&&!/^\d{2}\/\d{2}\/\d{4}$/.test(value))||!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!Number.isFinite(Date.parse(iso))||new Date(iso).toISOString().slice(0,10)!==iso)throw fail('Receipt withholding date is invalid.');return iso
}
const amounts=(row,format)=>{const values=Object.fromEntries([...categories,'totalCents'].map(k=>[k,cents(row[k],format)]));if(sum(categories.map(k=>values[k]))!==values.totalCents)throw fail('Receipt contribution categories do not reconcile to the total.');return values}
function records(bytes,format,headerRequired){
 const rows=retirementReceiptCsv(bytes),columns=format.columns
 if(!Array.isArray(columns)||new Set(columns.map(c=>c.field)).size!==columns.length)throw fail('Retained allocation column evidence is invalid.')
 if(headerRequired){const header=rows.shift();if(header.length!==columns.length||header.some((v,i)=>v!==columns[i].header))throw fail('File headers do not match the reviewed column contract.')}
 return rows.map(row=>{if(row.length!==columns.length)throw fail('File row does not match the reviewed column count.');return Object.fromEntries(columns.map((c,i)=>[c.field,row[i]]))})
}
export function reconcileRetirementAllocationReceipt({receiptBytes,contract,allocationBytes,basis,fileName,claimedAt,now=new Date()}){
 const reviewed=retirementReceiptContractInput(contract),claimTime=+new Date(claimedAt),checkedAt=+new Date(now)
 if(!safeText(fileName,124)||!Number.isFinite(claimTime)||!Number.isFinite(checkedAt)||claimTime>checkedAt||!basis||!Array.isArray(basis.allocations)||!['CENTS','DOLLARS'].includes(basis.amountFormat)||!['ISO','US'].includes(basis.dateFormat)||typeof basis.includeHeader!=='boolean')throw fail('Retain the original file, claim time and allocation evidence before interpreting a receipt.')
 if(!Array.isArray(basis.columns)||basis.columns.length!==allocationFields.length||allocationFields.some(f=>!basis.columns.some(c=>c.field===f)))throw fail('Original allocation columns are incomplete.')
 const sourceRows=records(allocationBytes,basis,basis.includeHeader),receiptRows=records(receiptBytes,reviewed,true),sourceHash=createHash('sha256').update(allocationBytes).digest('hex')
 if(sourceRows.length!==basis.rowCount||sourceRows.length!==basis.allocations.length||receiptRows.length!==sourceRows.length||!sourceRows.length)throw fail('Receipt must account for every original participant exactly once.')
 const original=new Map(),employees=new Set()
 const key=row=>JSON.stringify([row.providerPlanId,row.participantId])
 for(let i=0;i<sourceRows.length;i++){
  const row=sourceRows[i],a=basis.allocations[i],employeeId=typeof a?.employeeId==='string'?a.employeeId:Number.isSafeInteger(a?.employeeId)?String(a.employeeId):'',value=amounts(row,basis.amountFormat),withheldDate=date(row.withheldDate,basis.dateFormat)
  if(!safeText(row.providerPlanId)||!safeText(row.participantId)||original.has(key(row))||!(/^[1-9]\d{0,18}$/).test(employeeId)||BigInt(employeeId)>9223372036854775807n||employees.has(employeeId)||[...categories,'totalCents'].some(k=>value[k]!==a[k])||withheldDate!==basis.withheldDate||value.totalCents<=0)throw fail('Retained participant allocation evidence does not reconcile.')
  employees.add(employeeId);original.set(key(row),{...value,employeeId,withheldDate})
 }
 if(sum([...original.values()].map(x=>x.totalCents))!==basis.amountCents)throw fail('Retained file total does not match authorized contributions.')
 const seen=new Set(),participants=[];let batchId=null
 for(const row of receiptRows){
  if(row.sourceFileName!==fileName||row.sourceSha256!==sourceHash||!safeText(row.batchId,128)||batchId!==null&&batchId!==row.batchId)throw fail('Receipt does not identify one exact original file and provider batch.')
  batchId=row.batchId;const participant=original.get(key(row)),status=receiptStatuses(reviewed).find(s=>reviewed.statusValues[s]===row.status),reported=amounts(row,reviewed.amountFormat)
  if(!participant||seen.has(key(row))||date(row.withheldDate,reviewed.dateFormat)!==participant.withheldDate)throw fail('Receipt contains an unexpected, duplicated or wrong-date participant.')
  seen.add(key(row))
  if(!status||categories.some(k=>reported[k]>participant[k])||['PENDING','REJECTED','REVERSED'].includes(status)&&reported.totalCents!==0||['ACCEPTED','POSTED'].includes(status)&&reported.totalCents===0)throw fail('Receipt status and cumulative contribution amounts require reconciliation.')
  if(typeof row.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(row.recordedAt)||!Number.isFinite(Date.parse(row.recordedAt))||!Number.isFinite(Date.parse(row.recordedAt.slice(0,19)+'Z'))||new Date(row.recordedAt.slice(0,19)+'Z').toISOString().slice(0,19)!==row.recordedAt.slice(0,19)||Date.parse(row.recordedAt)<claimTime||Date.parse(row.recordedAt)>checkedAt)throw fail('Receipt timestamp must be valid, after the claim and no later than the check.')
  participants.push({employeeId:participant.employeeId,status,recordedAt:new Date(row.recordedAt).toISOString(),authorizedCents:participant.totalCents,reported,fullyAccounted:reported.totalCents===participant.totalCents,...(status==='REVERSED'?{reversedAllocationCents:participant.totalCents}:{})})
 }
 const rejectedCents=sum(participants.filter(p=>p.status==='REJECTED').map(p=>p.authorizedCents)),totalCents=sum(participants.map(p=>p.reported.totalCents)),postedCents=sum(participants.filter(p=>p.status==='POSTED').map(p=>p.reported.totalCents))
 const reversedAllocationCents=sum(participants.filter(p=>p.status==='REVERSED').map(p=>p.reversedAllocationCents))
 const status=reversedAllocationCents===basis.amountCents?'REVERSED':reversedAllocationCents>0?'PARTIALLY_REVERSED':postedCents===basis.amountCents?'POSTED':postedCents>0?'PARTIALLY_POSTED':totalCents===basis.amountCents?'ACCEPTED':totalCents>0?'PARTIALLY_ACCEPTED':participants.every(p=>p.status==='REJECTED')?'REJECTED':rejectedCents>0?'PARTIALLY_REJECTED':'PENDING'
 return {version:reviewed.version,status,...(reviewed.participantReversalConfirmed?{reversedAllocationCents}:{}),batchId,sourceSha256:sourceHash,receiptSha256:createHash('sha256').update(receiptBytes).digest('hex'),authorizedCents:basis.amountCents,reportedCents:totalCents,postedCents,rejectedCents,unreportedCents:basis.amountCents-totalCents-reversedAllocationCents,participants:participants.sort((a,b)=>a.employeeId.length-b.employeeId.length||(a.employeeId<b.employeeId?-1:a.employeeId>b.employeeId?1:0))}
}
