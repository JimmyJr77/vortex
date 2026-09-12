import {retirementDestinationProvider,id} from './retirementDestinationProvider.js'
export function retirementBankProvider(){
 const accounts=retirementDestinationProvider();let order=null,posts=0,lose=false,mismatch=false,missing=false,beforePost=async()=>{},creditValid=true
 const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body})
 return {...accounts,posts:()=>posts,loseResponse:v=>{lose=v},mismatch:v=>{mismatch=v},missing:v=>{missing=v},beforePost:f=>{beforePost=f},complete:()=>{order={...order,status:'completed',reconciliation_status:'reconciled',transaction_ids:[id(102)]}},returned:()=>{order={...order,status:'returned'}},instruction:()=>order,
 returnedCredit:()=>{order={...order,status:'returned',current_return:{id:id(104)}}},creditValid:v=>{creditValid=v},
 fetcher:async(url,options)=>{
  if(url.endsWith('/payment_orders')&&options.method==='POST'){await beforePost();posts++;order={...JSON.parse(options.body),id:id(101),live_mode:false,status:'sent',reconciliation_status:'unreconciled',transaction_ids:[]};if(lose)throw new Error('Synthetic lost provider response');return response(order,201)}
  if(url.includes('/payment_orders/'))return missing||!order?response({},404):response(mismatch?{...order,amount:order.amount+1}:order)
  if(url.includes('/returns/'))return response({id:id(104),returnable_type:'payment_order',returnable_id:id(101),type:'ach',amount:order.amount,currency:'USD',live_mode:false,internal_account_id:id(2),status:'completed',reconciliation_status:'reconciled',transaction_id:id(105),transaction_line_item_id:id(106),current_return:null,code:'R03',reason:'PRIVATE RETURN REASON'})
  if(url.endsWith(`/transactions/${id(105)}`))return response({id:id(105),live_mode:false,internal_account_id:id(2),currency:'USD',direction:'credit',posted:creditValid,as_of_date:'2026-09-24',amount:order.amount})
  if(url.includes('/transaction_line_items?')&&new URL(url).searchParams.has('id[]'))return response([{id:id(106),transaction_id:id(105),transactable_type:'return',transactable_id:id(104),live_mode:false,amount:order.amount}])
  if(url.includes('/transactions/'))return response({id:id(102),live_mode:false,internal_account_id:id(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-22',amount:order.amount})
  if(url.includes('/transaction_line_items?'))return response([{id:id(103),transaction_id:id(102),transactable_type:'payment_order',transactable_id:id(101),live_mode:false,type:'originating',amount:order.amount}])
  return accounts.fetcher(url,options)
 }}
}
