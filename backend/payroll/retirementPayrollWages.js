const fail=message=>Object.assign(new Error(message),{status:409})
const valid=value=>Number.isSafeInteger(value)&&value>=0
const add=(a,b)=>{if(!valid(a)||!valid(b)||!Number.isSafeInteger(a+b))throw fail('Retirement payroll wages must be complete integer cents.');return a+b}
// Derive plan categories from the existing engine snapshot. Gross wage
// reconciliation catches new earning kinds until their treatment is defined.
export function retirementPayrollWages(preview,plan){
 if(!preview||!Array.isArray(preview.payItems)||!Array.isArray(preview.warnings)||preview.warnings.some(w=>w.blocking)||preview.netPayCents===null)throw fail('Resolve payroll calculation blockers before retirement processing.')
 if(preview.retirement401k||preview.payItems.some(i=>i.kind?.startsWith('RETIREMENT_')))throw fail('Derive retirement wages before applying retirement deductions.')
 const compensation={REGULAR:add(0,preview.regularPayCents),OVERTIME:add(0,preview.overtimePayCents),BONUS:0,PAID_LEAVE:0}
 const ignored=new Set(['REIMBURSEMENT','POSTTAX_DEDUCTION','GARNISHMENT'])
 let annualBonusCents=0
 for(const item of preview.payItems){
  add(0,item.amountCents)
  if(item.kind==='SALARY_EXTRA_STRAIGHT_TIME')compensation.REGULAR=add(compensation.REGULAR,item.amountCents)
  else if(item.kind==='BONUS_OVERTIME')compensation.OVERTIME=add(compensation.OVERTIME,item.amountCents)
  else if(item.kind==='BONUS'){
   if(item.bonusReview?.paymentType!=='ANNUAL_LUMP_SUM')throw fail('Review the retirement bonus wage and withholding allocation.')
   compensation.BONUS=add(compensation.BONUS,item.amountCents);annualBonusCents=add(annualBonusCents,item.amountCents)
  }else if(item.kind==='PAID_LEAVE'){
   if(item.includedInSalary){
    if(item.amountCents!==0||plan.compensation.REGULAR!==plan.compensation.PAID_LEAVE)throw fail('Allocate salary-covered leave under the retirement plan compensation definition.')
   }else compensation.PAID_LEAVE=add(compensation.PAID_LEAVE,item.amountCents)
  }else if(!ignored.has(item.kind))throw fail(`Review retirement wage allocation for ${item.kind||'unknown earnings'}.`)
 }
 const total=Object.values(compensation).reduce(add,0)
 if(total!==preview.grossPayCents||compensation.PAID_LEAVE!==preview.paidLeavePayCents)throw fail('Retirement compensation categories do not reconcile to payroll wages.')
 return {compensation,compensation415Cents:total,annualBonusCents}
}
