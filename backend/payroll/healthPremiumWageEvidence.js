import {health125TaxWages} from './health125TaxWages.js'
import {compensationEvidence} from './employmentCompensation.js'
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
export function healthPremiumWageEvidence(frozen){
 const basis=frozen?.incomeTaxWageBasis,retained=basis?.health125
 const lines=(frozen?.payItems||[]).filter(item=>item.kind==='HEALTH_SECTION125_PRETAX')
 if(!retained){if(frozen?.health125||lines.length)throw new Error('Missing retained health premium wage basis.');return null}
 const annualBonusCents=(frozen.payItems||[]).filter(i=>i.kind==='BONUS'&&i.bonusReview?.paymentType==='ANNUAL_LUMP_SUM').reduce((sum,i)=>sum+i.amountCents,0)
 const expected=health125TaxWages({grossCents:frozen.grossPayCents,annualBonusCents,year:basis.year,workState:basis.workState,residenceState:basis.residenceState,health125:retained,retirement:basis.retirement401k})
 if(!same(expected,retained)||!same(expected,frozen.health125))throw new Error('Retained health premium taxable wages differ from the calculation.')
 const actual=lines.map(item=>({amountCents:item.amountCents,health125:item.health125})).sort((a,b)=>String(a.health125?.planId).localeCompare(String(b.health125?.planId)))
 const wanted=expected.items.filter(item=>item.deductionCents>0).map(item=>({amountCents:item.deductionCents,health125:item}))
 if(!same(actual,wanted))throw new Error('Health premium payroll items differ from retained deductions.')
 return expected
}
