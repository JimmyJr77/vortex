import {modernTreasuryTransport,verifyModernTreasuryFundingAccount} from './modernTreasuryPayments.js'
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
export function bankEnrollmentInput(input){
 if(!uuid(input?.id)||(input.providerEnrollmentId!==undefined&&!uuid(input.providerEnrollmentId))||!['LIVE','TEST'].includes(input.mode)||typeof input.holderName!=='string'||input.holderName.trim().length<2||input.holderName.length>200||/[\u0000-\u001f\u007f]/.test(input.holderName)||!['checking','savings'].includes(input.accountType)||typeof input.accountNumber!=='string'||!/^\d{4,17}$/.test(input.accountNumber)||typeof input.routingNumber!=='string'||!/^\d{9}$/.test(input.routingNumber)||/^0+$/.test(input.routingNumber))throw new Error('Enter supported US checking or savings account details.')
 const digits=[...input.routingNumber].map(Number)
 if(digits.reduce((sum,d,i)=>sum+d*[3,7,1][i%3],0)%10!==0)throw new Error('Check the nine-digit routing number.')
 return {...input,holderName:input.holderName.trim()}
}
const counterpartExternalId=input=>`vortex_payroll_holder_${input.providerEnrollmentId||input.id}`
const accountExternalId=input=>`vortex_payroll_bank_${input.providerEnrollmentId||input.id}`
const status=value=>['unverified','pending_verification','verified'].includes(value)?value:null
function accountResult(account,input,counterpartyId){
 if(!uuid(account?.id)||account.external_id!==accountExternalId(input)||account.counterparty_id!==counterpartyId||account.live_mode!==(input.mode==='LIVE')||account.party_name!==input.holderName||account.party_type!=='individual'||account.account_type!==input.accountType||!status(account.verification_status))return {status:'NEEDS_REVIEW'}
 const suffixes=[...new Set((Array.isArray(account.account_details)?account.account_details:[]).map(d=>d.account_number_safe))]
 if(suffixes.length!==1||suffixes[0]!==input.accountNumber.slice(-4))return {status:'NEEDS_REVIEW'}
 return {status:'RECORDED',accountId:account.id,counterpartyId,verificationStatus:account.verification_status,accountLast4:suffixes[0]}
}
// The coordinator must commit a separate durable claim before allowing each POST.
// Recovery defaults to GET only. Absence never implicitly permits another POST.
export async function provisionPayrollCounterparty(raw,config,{allowCreate=false}={}){
 const input=bankEnrollmentInput(raw),request=modernTreasuryTransport(config),externalId=counterpartExternalId(input)
 const selected=value=>uuid(value?.id)&&value.external_id===externalId&&value.name===input.holderName&&value.live_mode===(input.mode==='LIVE')?{status:'RECORDED',counterpartyId:value.id}:{status:'NEEDS_REVIEW'}
 try{
  const lookup=await request(`/counterparties?${new URLSearchParams({external_id:externalId,per_page:'2'})}`)
  if(!lookup.ok)return {status:'UNCERTAIN'}
  const rows=await lookup.json()
  if(!Array.isArray(rows)||rows.length>1)return {status:'NEEDS_REVIEW'}
  if(rows.length)return selected(rows[0])
  if(allowCreate!==true)return {status:'NOT_FOUND'}
  const created=await request('/counterparties',{method:'POST',headers:{'Idempotency-Key':externalId},body:JSON.stringify({external_id:externalId,name:input.holderName,send_remittance_advice:false})})
  return created.ok?selected(await created.json()):{status:'UNCERTAIN'}
 }catch{return {status:'UNCERTAIN'}}
}
export async function provisionPayrollBankAccount(raw,counterpartyId,config,{allowCreate=false}={}){
 const input=bankEnrollmentInput(raw)
 if(!uuid(counterpartyId))throw new Error('A retained counterparty is required.')
 const request=modernTreasuryTransport(config),externalId=accountExternalId(input)
 try{
  const lookup=await request(`/external_accounts?${new URLSearchParams({external_id:externalId,per_page:'2'})}`)
  if(!lookup.ok)return {status:'UNCERTAIN'}
  const rows=await lookup.json()
  if(!Array.isArray(rows)||rows.length>1)return {status:'NEEDS_REVIEW'}
  if(rows.length)return accountResult(rows[0],input,counterpartyId)
  if(allowCreate!==true)return {status:'NOT_FOUND'}
  const created=await request('/external_accounts',{method:'POST',headers:{'Idempotency-Key':externalId},body:JSON.stringify({external_id:externalId,counterparty_id:counterpartyId,party_name:input.holderName,party_type:'individual',account_type:input.accountType,account_details:[{account_number:input.accountNumber}],routing_details:[{routing_number_type:'aba',routing_number:input.routingNumber}]})})
  return created.ok?accountResult(await created.json(),input,counterpartyId):{status:'UNCERTAIN'}
 }catch{return {status:'UNCERTAIN'}}
}
export async function verifyPayrollBankAccount(raw,counterpartyId,accountId,config,{action='READ',operationId,amounts,verificationConsent=false}={}){
 const input=bankEnrollmentInput(raw)
 if(!uuid(counterpartyId)||!uuid(accountId)||!['READ','START','COMPLETE'].includes(action))throw new Error('A retained bank account and verification action are required.')
 if(action!=='READ'&&!uuid(operationId))throw new Error('A retained verification operation is required.')
 if(action==='START'&&(verificationConsent!==true||!uuid(config.originatingAccountId)))throw new Error('Separate micro-deposit credit and recovery-debit consent is required.')
 if(action==='COMPLETE'&&(!Array.isArray(amounts)||amounts.length!==2||!amounts.every(n=>Number.isInteger(n)&&n>0&&n<100)))throw new Error('Enter the two verification amounts in whole cents.')
 const request=modernTreasuryTransport(config)
 const read=async()=>{const response=await request(`/external_accounts/${accountId}`);if(!response.ok)return {status:'UNCERTAIN'};const account=await response.json();if(account.id!==accountId)return {status:'NEEDS_REVIEW'};return accountResult(account,input,counterpartyId)}
 try{
  const current=await read()
  if(current.status!=='RECORDED'||action==='READ'||current.verificationStatus==='verified')return current
  if(action==='START'&&current.verificationStatus==='pending_verification')return current
  if(action==='COMPLETE'&&current.verificationStatus!=='pending_verification')return {status:'NEEDS_REVIEW'}
  if(action==='START'){const funding=await verifyModernTreasuryFundingAccount({...config,mode:input.mode});if(funding.status!=='VERIFIED')return {status:funding.status==='UNAVAILABLE'?'UNCERTAIN':'NEEDS_REVIEW'}}
  const body=action==='START'?{originating_account_id:config.originatingAccountId,payment_type:'ach',currency:'USD',priority:'normal'}:{amounts}
  const response=await request(`/external_accounts/${accountId}/${action==='START'?'verify':'complete_verification'}`,{method:'POST',headers:{'Idempotency-Key':`payroll_bank_verify_${operationId}`},body:JSON.stringify(body)})
  if(!response.ok)return {status:response.status===422?'VERIFICATION_REJECTED':'UNCERTAIN'}
  return await read()
 }catch{return {status:'UNCERTAIN'}}
}
