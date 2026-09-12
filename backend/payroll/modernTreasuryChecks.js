import {createHash} from 'node:crypto'
import {modernTreasuryTransport,readBankSettlement} from './modernTreasuryPayments.js'
const BASE='https://app.moderntreasury.com/api'
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
const name=v=>typeof v==='string'&&v.trim().length>=2&&v.length<=200&&!/[\u0000-\u001f\u007f]/.test(v)
const states={needs_approval:'AWAITING_PROVIDER_APPROVAL',approved:'PROVIDER_APPROVED',processing:'PROCESSING',sent:'SENT',completed:'COMPLETED',returned:'RETURNED',reversed:'REVERSED',failed:'FAILED',denied:'DENIED',cancelled:'CANCELLED',held:'HELD',stopped:'STOPPED'}
function payeeInput(input){if(!uuid(input?.id)||!name(input.payeeName)||!['LIVE','TEST'].includes(input.mode))throw new Error('Retain the check recipient identity and mode.');return {...input,payeeName:input.payeeName.trim()}}
// Each create operation requires its own committed coordinator claim. Recovery
// defaults to GET only; an absent record never permits an implicit retry POST.
export async function provisionPayrollCheckPayee(raw,config,{operation='COUNTERPARTY',counterpartyId,allowCreate=false}={}){
 const input=payeeInput(raw);if(!['COUNTERPARTY','ACCOUNT'].includes(operation)||(operation==='ACCOUNT'&&!uuid(counterpartyId)))throw new Error('Choose a retained check-payee operation.')
 const request=modernTreasuryTransport(config),externalId=`vortex_check_${operation==='COUNTERPARTY'?'holder':'payee'}_${input.id}`,path=operation==='COUNTERPARTY'?'/counterparties':'/external_accounts'
 const selected=row=>{
  if(!uuid(row?.id)||row.external_id!==externalId||row.live_mode!==(input.mode==='LIVE'))return {status:'NEEDS_REVIEW'}
  if(operation==='COUNTERPARTY')return row.name===input.payeeName?{status:'RECORDED',counterpartyId:row.id}:{status:'NEEDS_REVIEW'}
  return row.counterparty_id===counterpartyId&&row.party_name===input.payeeName&&row.party_type==='individual'&&row.account_type==='other'&&Array.isArray(row.account_details)&&row.account_details.length===0&&Array.isArray(row.routing_details)&&row.routing_details.length===0?{status:'RECORDED',accountId:row.id,counterpartyId}:{status:'NEEDS_REVIEW'}
 }
 try{
  const found=await request(`${path}?${new URLSearchParams({external_id:externalId,per_page:'2'})}`);if(!found.ok)return {status:'UNCERTAIN'}
  const rows=await found.json();if(!Array.isArray(rows)||rows.length>1)return {status:'NEEDS_REVIEW'};if(rows.length)return selected(rows[0]);if(allowCreate!==true)return {status:'NOT_FOUND'}
  const body=operation==='COUNTERPARTY'?{external_id:externalId,name:input.payeeName,send_remittance_advice:false}:{external_id:externalId,counterparty_id:counterpartyId,party_name:input.payeeName,party_type:'individual',account_type:'other'}
  const response=await request(path,{method:'POST',headers:{'Idempotency-Key':externalId},body:JSON.stringify(body)});return response.ok?selected(await response.json()):{status:'UNCERTAIN'}
 }catch{return {status:'UNCERTAIN'}}
}
export function digitalCheckInstruction(intent){
 if(![intent?.id,intent?.originatingAccountId,intent?.receivingAccountId,intent?.counterpartyId].every(uuid)||!['LIVE','TEST'].includes(intent.mode)||!name(intent.payeeName)||!date(intent.paymentDate)||![intent.facilityId,intent.runId,intent.employeeId,intent.amountCents].every(v=>Number.isSafeInteger(v)&&v>0))throw new Error('Retain the exact check amount, date, funding and payee identities.')
 const days=intent.expiryDays??90;if(!Number.isInteger(days)||days<1||days>180)throw new Error('Choose a check expiration from 1 to 180 days.')
 return {external_id:`vortex_payroll_check_${intent.id}`,type:'check',subtype:'digital',direction:'credit',currency:'USD',amount:intent.amountCents,effective_date:intent.paymentDate,originating_account_id:intent.originatingAccountId,receiving_account_id:intent.receivingAccountId,remittance_information:'Payroll',expires_at:new Date(Date.parse(`${intent.paymentDate}T00:00:00Z`)+days*86400000).toISOString(),send_remittance_advice:false,metadata:{facility_id:String(intent.facilityId),payroll_run_id:String(intent.runId),employee_id:String(intent.employeeId)}}
}
export function digitalCheckReceipt(order,intent){
 const expected=digitalCheckInstruction(intent)
 if(!uuid(order?.id)||order.live_mode!==(intent.mode==='LIVE')||order.counterparty_id!==intent.counterpartyId||['external_id','type','subtype','direction','currency','amount','originating_account_id','receiving_account_id'].some(k=>order[k]!==expected[k]))throw new Error('Provider check does not match its retained instruction.')
 const dateMatches=order.effective_date===intent.paymentDate,expiryMatches=typeof order.expires_at==='string'&&Date.parse(order.expires_at)===Date.parse(expected.expires_at)
 return {providerId:order.id,externalId:order.external_id,status:states[order.status]||'REVIEW_REQUIRED',liveMode:order.live_mode,dateMatches,expiryMatches,effectiveDate:date(order.effective_date)?order.effective_date:null,expiresAt:expiryMatches?expected.expires_at:null,reconciliationStatus:order.reconciliation_status==='reconciled'?'reconciled':'unreconciled'}
}
export async function readPayrollDigitalCheck(intent,config){
 const expected=digitalCheckInstruction(intent),request=modernTreasuryTransport(config)
 let paidEvidence=null
 try{
  const response=await request(`/payment_orders/${expected.external_id}`);if(response.status===404)return {status:'NOT_FOUND'};if(!response.ok)return {status:'UNCERTAIN'}
  const order=await response.json(),receipt=digitalCheckReceipt(order,intent)
  if(receipt.status==='COMPLETED')paidEvidence=receipt
  if(!receipt.dateMatches||!receipt.expiryMatches)return {...receipt,settlementStatus:'NEEDS_REVIEW'}
  if(receipt.status!=='COMPLETED')return {...receipt,settlementStatus:['SENT','PROCESSING','PROVIDER_APPROVED','AWAITING_PROVIDER_APPROVAL'].includes(receipt.status)?'PENDING':'EXCEPTION'}
  if(receipt.reconciliationStatus!=='reconciled')return {...receipt,settlementStatus:'UNRECONCILED'}
  const bank=await readBankSettlement(order,intent,request)
  const fresh=await request(`/payment_orders/${expected.external_id}`);if(!fresh.ok)return {...receipt,settlementStatus:'UNAVAILABLE'}
  const freshOrder=await fresh.json(),checked=digitalCheckReceipt(freshOrder,intent)
  if(checked.providerId!==receipt.providerId||checked.status!=='COMPLETED'||!checked.dateMatches||!checked.expiryMatches||checked.reconciliationStatus!=='reconciled'||JSON.stringify([...(freshOrder.transaction_ids||[])].sort())!==JSON.stringify([...(order.transaction_ids||[])].sort()))return {...receipt,settlementStatus:'NEEDS_REVIEW',finalCheckStatus:checked.status,finalProviderId:checked.providerId}
  return {...receipt,...bank}
 }catch{return paidEvidence?{...paidEvidence,settlementStatus:'UNAVAILABLE'}:{status:'UNCERTAIN'}}
}
export async function submitPayrollDigitalCheck(intent,config,{allowCreate=false,now=()=>new Date()}={}){
 const expected=digitalCheckInstruction(intent),request=modernTreasuryTransport(config)
 try{
  const existing=await request(`/payment_orders/${expected.external_id}`)
  if(existing.ok)return {...digitalCheckReceipt(await existing.json(),intent),reused:true}
  if(existing.status!==404)return {status:'UNCERTAIN'}
  if(allowCreate!==true)return {status:'NOT_FOUND'}
  if(config.digitalChecksEnabled!==true||typeof config.timezone!=='string')return {status:'BLOCKED_CHECK_CONFIGURATION'}
  if(intent.paymentDate<new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now()))return {status:'BLOCKED_PAYMENT_DATE'}
  const funding=await request(`/internal_accounts/${intent.originatingAccountId}`),payee=await request(`/external_accounts/${intent.receivingAccountId}`),holder=await request(`/counterparties/${intent.counterpartyId}`)
  if(!funding.ok||!payee.ok||!holder.ok)return {status:'BLOCKED_ACCOUNT_LOOKUP'}
  const f=await funding.json(),p=await payee.json(),h=await holder.json(),live=intent.mode==='LIVE'
  if(f.id!==intent.originatingAccountId||f.live_mode!==live||f.currency!=='USD'||p.id!==intent.receivingAccountId||p.counterparty_id!==intent.counterpartyId||p.live_mode!==live||p.account_type!=='other'||p.party_name!==intent.payeeName||p.party_type!=='individual'||!Array.isArray(p.account_details)||p.account_details.length!==0||!Array.isArray(p.routing_details)||p.routing_details.length!==0||h.id!==intent.counterpartyId||h.name!==intent.payeeName||h.live_mode!==live)return {status:'BLOCKED_PAYEE_OR_FUNDING'}
  const result=await request('/payment_orders',{method:'POST',headers:{'Idempotency-Key':`payroll_check_${intent.id}`},body:JSON.stringify(expected)})
  if(!result.ok)return {status:'UNCERTAIN'}
  return {...digitalCheckReceipt(await result.json(),intent),reused:false}
 }catch{return {status:'UNCERTAIN'}}
}
const checkDocument=(row,providerId)=>uuid(row?.id)&&row.source==='modern_treasury'&&row.document_type==='rendered_check'&&row.documentable_type==='payment_order'&&row.documentable_id===providerId&&row.file?.content_type==='application/pdf'
export async function downloadPayrollDigitalCheck(intent,config,{allowedDownloadOrigins=[],now=()=>new Date()}={}){
 const expected=digitalCheckInstruction(intent),request=modernTreasuryTransport(config)
 try{
  const payment=await readPayrollDigitalCheck(intent,config)
  if(!['SENT','COMPLETED'].includes(payment.status)||!payment.dateMatches||!payment.expiryMatches)return {status:'CHECK_NOT_READY'}
  if(now().getTime()>=Date.parse(payment.expiresAt))return {status:'CHECK_EXPIRED'}
  const listed=await request(`/documents?${new URLSearchParams({documentable_type:'payment_order',documentable_id:payment.providerId,document_type:'rendered_check',per_page:'2'})}`)
  if(!listed.ok)return {status:'UNCERTAIN'}
  const docs=await listed.json();if(!Array.isArray(docs)||docs.length!==1||!checkDocument(docs[0],payment.providerId))return {status:'DOCUMENT_NEEDS_REVIEW'}
  const doc=docs[0],headers={Authorization:`Basic ${Buffer.from(`${config.organizationId}:${config.apiKey}`).toString('base64')}`},signal=AbortSignal.timeout(30000)
  let response=await config.fetcher(`${BASE}/documents/${doc.id}/download`,{headers,redirect:'manual',signal})
  if([301,302,303,307,308].includes(response.status)){
   const url=new URL(response.headers.get('location'),BASE)
   if(url.protocol!=='https:'||url.username||url.password||url.port||!['https://app.moderntreasury.com',...allowedDownloadOrigins].includes(url.origin))return {status:'DOWNLOAD_ORIGIN_REVIEW'}
   await response.body?.cancel()
   response=await config.fetcher(url.href,{headers:{},redirect:'error',signal})
  }
  if(!response.ok||response.headers.get('content-type')?.split(';')[0].trim()!=='application/pdf')return {status:'DOCUMENT_NEEDS_REVIEW'}
  const max=5*1024*1024;if(Number(response.headers.get('content-length'))>max){await response.body?.cancel();return {status:'DOCUMENT_TOO_LARGE'}}
  const reader=response.body?.getReader();if(!reader)return {status:'DOCUMENT_NEEDS_REVIEW'}
  const chunks=[];let length=0
  try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>max){await reader.cancel();return {status:'DOCUMENT_TOO_LARGE'}}chunks.push(Buffer.from(part.value))}}finally{reader.releaseLock()}
  const bytes=Buffer.concat(chunks);if(bytes.length<8||bytes.subarray(0,5).toString()!=='%PDF-')return {status:'DOCUMENT_NEEDS_REVIEW'}
  const finalResponse=await request(`/payment_orders/${expected.external_id}`);if(!finalResponse.ok)return {status:'UNCERTAIN'}
  const final=digitalCheckReceipt(await finalResponse.json(),intent)
  if(final.providerId!==payment.providerId||!['SENT','COMPLETED'].includes(final.status)||!final.dateMatches||!final.expiryMatches)return {status:'CHECK_CHANGED'}
  return {status:'PDF_READY',documentId:doc.id,providerId:payment.providerId,sha256:createHash('sha256').update(bytes).digest('hex'),bytes}
 }catch{return {status:'UNCERTAIN'}}
}
