import {w4MultipleJobsTables2026 as tables} from './w4MultipleJobsTables2026.js'
const money=value=>{if(!Number.isSafeInteger(value)||value<0)throw new Error('Use nonnegative whole-cent annual wages.');return value}
const sum=(a,b)=>money(a+b)
function lookup(status,higher,lower){
 if(lower>12000000)throw new Error('The W-4 worksheet requires additional tables when more than one job pays over $120,000. Review Publication 505 or the IRS estimator.')
 const rows=tables[status],row=rows.findLast(row=>higher>=row.minimumDollars*100)
 const column=Math.min(11,Math.floor(lower/1000000))
 return row.annualDollars[column]*100
}
// Implements only the printed 2026 page-3 worksheet and page-5 tables.
// Wages are annual taxable wages, including a spouse's concurrent jobs for MFJ.
export function w4MultipleJobs2026({filingStatus,annualWagesCents,payPeriods,additionalCents=0}){
 if(!Object.hasOwn(tables,filingStatus))throw new Error('Select your W-4 filing status before calculating.')
 if(!Array.isArray(annualWagesCents)||![2,3].includes(annualWagesCents.length))throw new Error('This worksheet requires two or three concurrent jobs. Additional jobs require Publication 505 or the IRS estimator.')
 if(!Number.isSafeInteger(payPeriods)||payPeriods<1||payPeriods>366)throw new Error('Enter the number of pay periods per year for the highest paying job (1–366).')
 const wages=annualWagesCents.map(money).sort((a,b)=>b-a)
 money(additionalCents)
 const first=lookup(filingStatus,wages[0],wages[1])
 const second=wages.length===3?lookup(filingStatus,sum(wages[0],wages[1]),wages[2]):0
 const annualCents=sum(first,second)
 // Round only the final division to cents, half up, without floating-point drift.
 const divided=(BigInt(annualCents)*2n+BigInt(payPeriods))/(BigInt(payPeriods)*2n)
 const perPayPeriodCents=Number(divided)
 return {line1Cents:wages.length===2?first:null,line2aCents:wages.length===3?first:null,line2bCents:wages.length===3?second:null,line2cCents:wages.length===3?annualCents:null,line3:payPeriods,line4Cents:perPayPeriodCents,additionalCents,step4cCents:sum(perPayPeriodCents,additionalCents)}
}
