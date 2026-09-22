import {retirement401kTaxWages} from './retirement401kTaxWages.js'
// Qualified accident/health insurance premiums paid through a written Section
// 125 plan. The server-side collection resolver must establish plan/participant
// qualification and employee authorization before creating this typed input.
// A PRETAX catalog label or generic adjustment is not a qualification review.
export function health125TaxWages({grossCents,annualBonusCents,year,workState,residenceState,health125,retirement}){
 const fail=message=>{throw new Error(message)}
 const cents=value=>Number.isSafeInteger(value)&&value>=0
 if(year!==2026||workState!=='MD'||residenceState!=='MD')fail('Use reviewed 2026 Maryland-resident Section 125 health-premium treatment.')
 if(!cents(grossCents)||!cents(annualBonusCents)||annualBonusCents>grossCents)fail('Health-premium wage components must be explicit nonnegative integer cents.')
 if(health125?.version!==1||health125.classification!=='SECTION125_ACCIDENT_HEALTH_PREMIUM'||!Array.isArray(health125.items)||!health125.items.length||health125.items.length>20)fail('Retain classified Section 125 health premiums and their qualification evidence.')
 const plans=new Set(),fingerprint=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
 let total=0n,bonus=0n
 const items=health125.items.map(item=>{
  if(!item||typeof item.planId!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(item.planId)||plans.has(item.planId)||typeof item.optionId!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(item.optionId)||item.optionId==='WAIVE')fail('Health deductions require one selected coverage option per plan.')
  plans.add(item.planId)
  if(!cents(item.deductionCents)||!cents(item.annualBonusDeductionCents)||item.annualBonusDeductionCents>item.deductionCents)fail('Health deductions require explicit valid amounts and bonus allocations.')
  if(!fingerprint(item.qualificationFingerprint)||!fingerprint(item.authorizationFingerprint))fail('Retain the exact health qualification and signed authorization fingerprints.')
  total+=BigInt(item.deductionCents);bonus+=BigInt(item.annualBonusDeductionCents)
  return {planId:item.planId,optionId:item.optionId,deductionCents:item.deductionCents,annualBonusDeductionCents:item.annualBonusDeductionCents,qualificationFingerprint:item.qualificationFingerprint,authorizationFingerprint:item.authorizationFingerprint}
 }).sort((a,b)=>a.planId.localeCompare(b.planId))
 if(total>BigInt(grossCents)||bonus>BigInt(annualBonusCents)||total-bonus>BigInt(grossCents-annualBonusCents))fail('Health deductions and their bonus allocation must fit the corresponding wages.')
 const deductionCents=Number(total),annualBonusDeductionCents=Number(bonus)
 if(retirement!==undefined&&retirement!==null)retirement=retirement401kTaxWages({...retirement,grossCents,annualBonusCents,year,workState,residenceState})
 const retirementPretax=retirement?.pretaxCents??0,retirementRoth=retirement?.rothCents??0,retirementBonus=retirement?.pretaxAnnualBonusCents??0
 if([retirementPretax,retirementRoth,retirementBonus].some(value=>!cents(value))||retirementBonus>retirementPretax)fail('Retain reconciled retirement components alongside health premiums.')
 if(retirementPretax>grossCents-deductionCents||retirementRoth>grossCents-deductionCents-retirementPretax||retirementBonus>annualBonusCents-annualBonusDeductionCents||retirementPretax-retirementBonus>grossCents-annualBonusCents-(deductionCents-annualBonusDeductionCents))fail('Combined health and retirement deductions exceed their corresponding wages.')
 const employmentWages=grossCents-deductionCents,incomeWages=employmentWages-retirementPretax
 return {version:1,classification:health125.classification,items,deductionCents,annualBonusDeductionCents,grossWagesCents:grossCents,federalWagesCents:incomeWages,marylandWagesCents:incomeWages,marylandAnnualBonusWagesCents:annualBonusCents-annualBonusDeductionCents-retirementBonus,marylandRegularWagesCents:grossCents-annualBonusCents-(deductionCents-annualBonusDeductionCents)-(retirementPretax-retirementBonus),socialSecurityWagesCents:employmentWages,medicareWagesCents:employmentWages,futaWagesCents:employmentWages,marylandUnemploymentWagesCents:employmentWages}
}
