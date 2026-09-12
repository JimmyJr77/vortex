import { nextFederalTaxBusinessDay } from './federalTaxDates.js'
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10)
// Form 940 is annual. Allocate recorded FUTA receipts to oldest liabilities in
// that tax year, including amounts carried from earlier quarters.
export function calculateFutaDeposits(rows,year,deposits,today) {
 const receipts=deposits.filter(d=>d.agency==='IRS_FUTA'&&d.status==='RECORDED'&&day(d.paid_on)<=today).sort((a,b)=>day(a.paid_on).localeCompare(day(b.paid_on))||Number(a.id)-Number(b.id)).map(d=>({date:day(d.paid_on),remaining:Number(d.amount_cents)}))
 const chunks=[];let receiptIndex=0,liabilityCents=0
 for(const row of [...rows].sort((a,b)=>day(a.payment_date).localeCompare(day(b.payment_date)))) {
  const date=day(row.payment_date),quarter=Math.ceil(Number(date.slice(5,7))/3)
  let amount=Number(row.futa);liabilityCents+=amount
  while(amount>0){while(receipts[receiptIndex]?.remaining===0)receiptIndex++;const receipt=receipts[receiptIndex],part=receipt?Math.min(amount,receipt.remaining):amount
   chunks.push({quarter,payDate:date,amount:part,paidOn:receipt?.date||null,assigned:false});amount-=part;if(receipt)receipt.remaining-=part
  }
 }
 const quarters=[],obligations=[]
 for(let q=1;q<=4;q++) {
  const end=day(new Date(Date.UTC(year,q*3,0))),dueOn=nextFederalTaxBusinessDay(day(new Date(Date.UTC(year,q*3+1,0))),true)
  // Previously carried amounts deposited by this quarter's end no longer carry.
  for(const chunk of chunks)if(!chunk.assigned&&chunk.quarter<q&&chunk.paidOn&&chunk.paidOn<=end)chunk.assigned=true
  const pending=chunks.filter(c=>!c.assigned&&c.quarter<=q),amount=pending.reduce((n,c)=>n+c.amount,0)
  const previouslyDueUnpaid=chunks.filter(c=>c.assigned&&c.quarter<q&&(!c.paidOn||c.paidOn>end)).reduce((n,c)=>n+c.amount,0)
  const required=amount>50000||q===4
  const carriedCents=required?0:pending.filter(c=>!c.paidOn||c.paidOn>end).reduce((n,c)=>n+c.amount,0)
  quarters.push({quarter:q,end,taxCents:chunks.filter(c=>c.quarter===q).reduce((n,c)=>n+c.amount,0),carriedCents,closed:end<=today})
  if(required&&amount>0){
   const coveredCents=pending.filter(c=>c.paidOn).reduce((n,c)=>n+c.amount,0),lateCoveredCents=pending.filter(c=>c.paidOn&&c.paidOn>dueOn).reduce((n,c)=>n+c.amount,0)
   obligations.push({quarter:q,dueOn,fromQuarter:Math.min(...pending.map(c=>c.quarter)),liabilityCents:amount,coveredCents,lateCoveredCents,balanceCents:amount-coveredCents,rule:q===4&&amount+previouslyDueUnpaid<=50000?'YEAR_END_PAYMENT':'QUARTERLY_DEPOSIT',projected:end>today,status:amount===coveredCents?(lateCoveredCents?'COVERED_LATE':'COVERED'):dueOn<today?'OVERDUE':dueOn===today?'DUE_TODAY':'UPCOMING'})
   pending.forEach(c=>{c.assigned=true})
  }
 }
 return {quarters,obligations,liabilityCents,coveredCents:chunks.filter(c=>c.paidOn).reduce((n,c)=>n+c.amount,0),unappliedCents:receipts.reduce((n,r)=>n+r.remaining,0)}
}
