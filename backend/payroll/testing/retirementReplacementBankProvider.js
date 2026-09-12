import {id} from './retirementDestinationProvider.js'
export function retirementReplacementBankProvider(original,authorizationId,{beforePost=async()=>{}}={}){
 let order=null,posts=0,lose=true,missing=false
 const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body})
 const external=`vortex_retirement_${authorizationId}`
 return {posts:()=>posts,loseResponse:v=>{lose=v},missing:v=>{missing=v},complete:()=>{order={...order,status:'completed',reconciliation_status:'reconciled',transaction_ids:[id(202)]}},fetcher:async(url,options={})=>{
  if(url.endsWith('/payment_orders')&&options.method==='POST'&&JSON.parse(options.body).external_id===external){await beforePost();posts++;order={...JSON.parse(options.body),id:id(201),live_mode:false,status:'sent',reconciliation_status:'unreconciled',transaction_ids:[]};if(lose)throw new Error('Synthetic lost replacement payment response');return response(order,201)}
  if(url.endsWith(`/payment_orders/${external}`))return missing||!order?response({},404):response(order)
  if(url.endsWith(`/transactions/${id(202)}`))return response({id:id(202),live_mode:false,internal_account_id:id(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-29',amount:order.amount})
  if(url.includes('/transaction_line_items?')&&url.includes(id(202)))return response([{id:id(203),transaction_id:id(202),transactable_type:'payment_order',transactable_id:id(201),live_mode:false,type:'originating',amount:order.amount}])
  return original(url,options)
 }}
}
