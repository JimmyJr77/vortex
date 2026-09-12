const BASE='https://app.moderntreasury.com/api'
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
export function modernTreasuryInstruction(intent){
 if(![intent.id,intent.originatingAccountId,intent.receivingAccountId].every(uuid)||!['TEST','LIVE'].includes(intent.mode)||!Number.isSafeInteger(intent.amountCents)||intent.amountCents<=0||![intent.facilityId,intent.runId,intent.employeeId].every(id=>Number.isSafeInteger(id)&&id>0)||!/^\d{4}-\d{2}-\d{2}$/.test(intent.paymentDate)||!Number.isFinite(Date.parse(intent.paymentDate))||new Date(intent.paymentDate).toISOString().slice(0,10)!==intent.paymentDate)throw new Error('Complete the retained payroll payment instruction.')
 return {external_id:`vortex_payroll_${intent.id}`,type:'ach',subtype:'PPD',amount:intent.amountCents,direction:'credit',currency:'USD',originating_account_id:intent.originatingAccountId,receiving_account_id:intent.receivingAccountId,effective_date:intent.paymentDate,priority:'normal',statement_descriptor:'PAYROLL',send_remittance_advice:false,metadata:{facility_id:String(intent.facilityId),payroll_run_id:String(intent.runId),employee_id:String(intent.employeeId)}}
}
export function modernTreasuryReceipt(order,intent){
 const expected=modernTreasuryInstruction(intent)
 if(!uuid(order?.id)||order.live_mode!==(intent.mode==='LIVE')||['external_id','type','subtype','amount','direction','currency','originating_account_id','receiving_account_id'].some(key=>order[key]!==expected[key]))throw new Error('Provider payment does not match the retained instruction.')
 const states={needs_approval:'AWAITING_PROVIDER_APPROVAL',approved:'PROVIDER_APPROVED',processing:'PROCESSING',sent:'SENT',completed:'COMPLETED',returned:'RETURNED',reversed:'REVERSED',failed:'FAILED',denied:'DENIED',cancelled:'CANCELLED',held:'HELD',stopped:'STOPPED'}
 return {providerId:order.id,externalId:order.external_id,status:Object.hasOwn(states,order.status)?states[order.status]:'REVIEW_REQUIRED',providerStatus:Object.hasOwn(states,order.status)?order.status:'unknown',dateMatches:order.effective_date===intent.paymentDate,effectiveDate:date(order.effective_date)?order.effective_date:null,reconciliationStatus:['reconciled','unreconciled'].includes(order.reconciliation_status)?order.reconciliation_status:'unknown',transactionIds:Array.isArray(order.transaction_ids)?order.transaction_ids.filter(uuid):[],liveMode:order.live_mode}
}
function transport({organizationId,apiKey,fetcher}={}){
 if(!uuid(organizationId)||typeof apiKey!=='string'||!apiKey.trim()||/[\r\n]/.test(apiKey)||typeof fetcher!=='function')throw new Error('A configured payroll payment transport is required.')
 const headers={Authorization:`Basic ${Buffer.from(`${organizationId}:${apiKey}`).toString('base64')}`,'Content-Type':'application/json'}
 return (path,options={})=>fetcher(`${BASE}${path}`,{...options,headers:{...headers,...options.headers},redirect:'error',signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)})
}
export async function verifyModernTreasuryFundingAccount(config){
 if(!uuid(config.originatingAccountId)||!['TEST','LIVE'].includes(config.mode))throw new Error('A valid employer funding account and environment are required.')
 const request=transport(config)
 try{
  const response=await request(`/internal_accounts/${config.originatingAccountId}`)
  if(!response.ok)return {status:[401,403,404].includes(response.status)?'FAILED':'UNAVAILABLE',reason:[401,403].includes(response.status)?'CREDENTIALS_OR_ACCESS':response.status===404?'ACCOUNT_NOT_FOUND':'PROVIDER_UNAVAILABLE'}
  const account=await response.json()
  if(account.id!==config.originatingAccountId||account.live_mode!==(config.mode==='LIVE')||account.currency!=='USD')return {status:'FAILED',reason:'ACCOUNT_OR_ENVIRONMENT_MISMATCH'}
  return {status:'VERIFIED',reason:'FUNDING_ACCOUNT_MATCHED'}
 }catch{return {status:'UNAVAILABLE',reason:'PROVIDER_UNAVAILABLE'}}
}
export async function readModernTreasuryEmployeeAccount(config,accountId){
 if(!uuid(accountId)||!['TEST','LIVE'].includes(config.mode))throw new Error('A valid employee account and environment are required.')
 const request=transport(config)
 try{
  const response=await request(`/external_accounts/${accountId}`)
  if(!response.ok)return {status:'UNAVAILABLE'}
  const account=await response.json()
  const details=Array.isArray(account.account_details)?account.account_details:[]
  const suffixes=[...new Set(details.map(d=>d.account_number_safe).filter(value=>typeof value==='string'&&/^\d{4}$/.test(value)))]
  if(account.id!==accountId||account.live_mode!==(config.mode==='LIVE')||account.verification_status!=='verified'||!uuid(account.counterparty_id)||!['checking','savings'].includes(account.account_type)||account.party_type!=='individual'||typeof account.party_name!=='string'||!account.party_name.trim()||account.party_name.length>200||/[\u0000-\u001f\u007f]/.test(account.party_name)||suffixes.length!==1)return {status:'NEEDS_REVIEW'}
  return {status:'VERIFIED',account:{accountId,counterpartyId:account.counterparty_id,accountType:account.account_type,accountLast4:suffixes[0],holderName:account.party_name.trim(),mode:config.mode}}
 }catch{return {status:'UNAVAILABLE'}}
}
// Recovery and status refresh are strictly read-only, including after a missing
// provider response. NOT_FOUND does not prove an earlier send never happened.
export async function readModernTreasuryPayment(intent,config){
 const instruction=modernTreasuryInstruction(intent),request=transport(config)
 try{
  const response=await request(`/payment_orders/${instruction.external_id}`)
  if(response.status===404)return {status:'NOT_FOUND'}
  if(!response.ok)return {status:'UNCERTAIN',httpStatus:response.status}
  const order=await response.json(),receipt=modernTreasuryReceipt(order,intent)
  if(receipt.status==='RETURNED')return {...receipt,settlementStatus:'EXCEPTION',...await readReturnedBankEvidence(order,intent,request)}
  if(receipt.status!=='COMPLETED'||receipt.reconciliationStatus!=='reconciled')return {...receipt,settlementStatus:['RETURNED','REVERSED','FAILED','DENIED','CANCELLED','STOPPED'].includes(receipt.status)?'EXCEPTION':'PENDING'}
  const settlement=await readBankSettlement(order,intent,request)
  if(settlement.settlementStatus==='BANK_POSTED'){
   const freshResponse=await request(`/payment_orders/${instruction.external_id}`)
   if(!freshResponse.ok)return {...receipt,settlementStatus:'UNAVAILABLE',settlementEvidence:[]}
   const fresh=modernTreasuryReceipt(await freshResponse.json(),intent)
   if(JSON.stringify(fresh)!==JSON.stringify(receipt))return {...fresh,settlementStatus:'NEEDS_REVIEW',settlementEvidence:[]}
  }
  return {...receipt,...settlement}
 }catch{return {status:'UNCERTAIN'}}
}

async function readReturnedBankEvidence(order,intent,providerRequest){
 const review={returnEvidenceStatus:'NEEDS_REVIEW',returnEvidence:null},signal=AbortSignal.timeout(45000)
 const request=path=>{signal.throwIfAborted();return providerRequest(path,{signal})}
 const returnId=order.current_return?.id
 if(!uuid(returnId))return review
 const matches=returned=>returned.id===returnId&&returned.returnable_type==='payment_order'&&returned.returnable_id===order.id&&returned.type==='ach'&&returned.live_mode===(intent.mode==='LIVE')&&returned.currency==='USD'&&returned.amount===intent.amountCents&&returned.internal_account_id===intent.originatingAccountId&&returned.status==='completed'&&returned.reconciliation_status==='reconciled'&&!returned.current_return&&uuid(returned.transaction_id)&&uuid(returned.transaction_line_item_id)
 try{
  const response=await request(`/returns/${returnId}`)
  if(!response.ok)return {returnEvidenceStatus:'UNAVAILABLE',returnEvidence:null}
  const returned=await response.json()
  if(!matches(returned))return review
  const bankResponse=await request(`/transactions/${returned.transaction_id}`)
  if(!bankResponse.ok)return {returnEvidenceStatus:'UNAVAILABLE',returnEvidence:null}
  const bank=await bankResponse.json()
  if(bank.id!==returned.transaction_id||bank.live_mode!==(intent.mode==='LIVE')||bank.internal_account_id!==intent.originatingAccountId||bank.currency!=='USD'||bank.direction!=='credit'||bank.posted!==true||!date(bank.as_of_date)||!Number.isSafeInteger(bank.amount)||bank.amount<intent.amountCents)return review
  const lineResponse=await request(`/transaction_line_items?${new URLSearchParams({'id[]':returned.transaction_line_item_id})}`)
  if(!lineResponse.ok)return {returnEvidenceStatus:'UNAVAILABLE',returnEvidence:null}
  const lines=await lineResponse.json(),line=Array.isArray(lines)&&lines.length===1?lines[0]:null
  if(!line||line.id!==returned.transaction_line_item_id||line.transaction_id!==returned.transaction_id||line.transactable_type!=='return'||line.transactable_id!==returnId||line.amount!==intent.amountCents||line.live_mode!==(intent.mode==='LIVE'))return review
  const freshResponse=await request(`/returns/${returnId}`)
  if(!freshResponse.ok)return {returnEvidenceStatus:'UNAVAILABLE',returnEvidence:null}
  const fresh=await freshResponse.json()
  if(!matches(fresh)||fresh.transaction_id!==returned.transaction_id||fresh.transaction_line_item_id!==returned.transaction_line_item_id)return review
  const orderResponse=await request(`/payment_orders/${order.external_id}`)
  if(!orderResponse.ok)return {returnEvidenceStatus:'UNAVAILABLE',returnEvidence:null}
  const freshOrder=await orderResponse.json(),freshReceipt=modernTreasuryReceipt(freshOrder,intent)
  if(freshReceipt.status!=='RETURNED'||freshOrder.current_return?.id!==returnId)return review
  return {returnEvidenceStatus:'BANK_CREDIT_POSTED',returnEvidence:{returnId,code:typeof fresh.code==='string'&&/^R\d{2}$/.test(fresh.code)?fresh.code:null,transactionId:bank.id,lineItemId:line.id,amountCents:line.amount,postedDate:bank.as_of_date}}
 }catch{return {returnEvidenceStatus:'UNAVAILABLE',returnEvidence:null}}
}

// Match this payment's line items inside posted bank transactions, which may
// include many other employees. Retain only selected, non-sensitive evidence.
export async function readBankSettlement(order,intent,providerRequest){
 const signal=AbortSignal.timeout(45000)
 const request=path=>{signal.throwIfAborted();return providerRequest(path,{signal})}
 const review={settlementStatus:'NEEDS_REVIEW',settlementEvidence:[]}
 const ids=order.transaction_ids
 if(!Array.isArray(ids)||!ids.length||ids.length>10||!ids.every(uuid)||new Set(ids).size!==ids.length||order.effective_date!==intent.paymentDate)return review
 const evidence=[],seen=new Set();let total=0
 try{
  for(const transactionId of ids){
   const response=await request(`/transactions/${transactionId}`)
   if(!response.ok)return {settlementStatus:'UNAVAILABLE',settlementEvidence:[]}
   const transaction=await response.json()
   if(transaction.id!==transactionId||transaction.live_mode!==(intent.mode==='LIVE')||transaction.internal_account_id!==intent.originatingAccountId||transaction.currency!=='USD'||transaction.direction!=='debit'||transaction.posted!==true||!date(transaction.as_of_date)||!Number.isSafeInteger(transaction.amount)||transaction.amount<=0)return review
   let cursor=null,complete=false,matched=0;const lineItems=[]
   for(let page=0;page<10;page++){
    const query=new URLSearchParams({transaction_id:transactionId,per_page:'100',...(cursor?{after_cursor:cursor}:{})})
    const pageResponse=await request(`/transaction_line_items?${query}`)
    if(!pageResponse.ok)return {settlementStatus:'UNAVAILABLE',settlementEvidence:[]}
    const items=await pageResponse.json()
    if(!Array.isArray(items)||items.length>100)return review
    for(const item of items){
     if(!uuid(item.id)||seen.has(item.id)||item.transaction_id!==transactionId)return review
     seen.add(item.id)
     if(item.transactable_type!=='payment_order'||item.transactable_id!==order.id)continue
     if(item.live_mode!==(intent.mode==='LIVE')||item.type!=='originating'||!Number.isSafeInteger(item.amount)||item.amount<=0)return review
     matched+=item.amount;total+=item.amount
     if(!Number.isSafeInteger(total)||total>intent.amountCents||matched>transaction.amount)return review
     lineItems.push({id:item.id,amountCents:item.amount})
    }
    if(items.length<100){complete=true;break}
    cursor=items.at(-1).id
   }
   if(!complete||!matched)return review
   evidence.push({transactionId,postedDate:transaction.as_of_date,amountCents:matched,lineItems})
  }
  return total===intent.amountCents?{settlementStatus:'BANK_POSTED',settlementEvidence:evidence}:review
 }catch{return {settlementStatus:'UNAVAILABLE',settlementEvidence:[]}}
}
// No default transport: the execution coordinator must persist/authorize the
// instruction before injecting a configured sender. This module never finalizes payroll.
export async function submitModernTreasuryPayment(intent,{organizationId,apiKey,fetcher}={}){
 const instruction=modernTreasuryInstruction(intent)
 const request=transport({organizationId,apiKey,fetcher})
 const lookup=async()=>{const response=await request(`/payment_orders/${instruction.external_id}`);if(response.status===404)return null;if(!response.ok)throw new Error('Payment lookup unavailable.');return modernTreasuryReceipt(await response.json(),intent)}
 try{
  const existing=await lookup();if(existing)return {...existing,reused:true}
  const originResponse=await request(`/internal_accounts/${intent.originatingAccountId}`),destinationResponse=await request(`/external_accounts/${intent.receivingAccountId}`)
  if(!originResponse.ok||!destinationResponse.ok)return {status:'BLOCKED_ACCOUNT_LOOKUP'}
  const origin=await originResponse.json(),destination=await destinationResponse.json(),live=intent.mode==='LIVE'
  if(origin.id!==intent.originatingAccountId||destination.id!==intent.receivingAccountId||origin.live_mode!==live||destination.live_mode!==live||origin.currency!=='USD'||destination.verification_status!=='verified')return {status:'BLOCKED_ACCOUNT_VERIFICATION'}
  const response=await request('/payment_orders',{method:'POST',headers:{'Idempotency-Key':`payroll_${intent.id}`},body:JSON.stringify(instruction)})
  if(response.status===409){const existing=await lookup();return existing?{...existing,reused:true}:{status:'UNCERTAIN'}}
  if(!response.ok)return {status:'UNCERTAIN',httpStatus:response.status}
  return {...modernTreasuryReceipt(await response.json(),intent),reused:false}
 }catch{return {status:'UNCERTAIN'}}
}

export {transport as modernTreasuryTransport}
