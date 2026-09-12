import assert from 'node:assert/strict'
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
export function retirementDestinationProvider(){
 let changed=false,unavailable=false,posts=0,reads=0
 const account={id:id(3),counterparty_id:id(4),party_type:'business',party_name:'Synthetic Retirement Trustee',account_type:'checking',live_mode:false,verification_status:'verified',updated_at:'2026-09-11T12:00:00Z',account_details:[{id:id(5),account_number_safe:'1234'}],routing_details:[{id:id(6),payment_type:'ach',routing_number_type:'aba',routing_number:'021000021'}]}
 return {id,change:v=>{changed=v},unavailable:v=>{unavailable=v},posts:()=>posts,reads:()=>reads,fetcher:async(url,options)=>{reads++;if(options.method==='POST')posts++;assert.equal(options.method,undefined);return {ok:!unavailable,status:unavailable?503:200,json:async()=>url.includes('/internal_accounts/')?{id:id(2),currency:'USD',live_mode:false}:{...account,updated_at:changed?'2026-09-11T12:01:00Z':account.updated_at}}}}
}
