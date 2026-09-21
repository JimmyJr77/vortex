const fail=message=>Object.assign(new Error(message),{status:400})
const keys=['period','matchCatchUp','matchTiers','nonelectiveBps','compensation','eligibilityTerms','vestingTerms']
const kinds=['REGULAR','OVERTIME','BONUS','PAID_LEAVE']
const exact=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(key=>Object.hasOwn(value,key))
const rate=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max
const terms=(value,label)=>{
 if(typeof value!=='string'||value.trim().length<12||value.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw fail(`Retain reviewed employer ${label} and their plan reference.`)
 return value.trim()
}

// Rates are integer basis points. Tier ceilings are cumulative percentages of
// eligible compensation; each matching rate applies only to its own band.
// This is retained plan evidence, not activation of payroll or remittance.
export function retirementEmployerFormula(value,applicability){
 if(!['MATCH','NONELECTIVE','MATCH_AND_NONELECTIVE'].includes(applicability))throw fail('Resolve employer contribution applicability before retaining a structured formula.')
 if(!exact(value,keys)||!['PER_PAYROLL','ANNUAL_TRUE_UP'].includes(value.period)||typeof value.matchCatchUp!=='boolean')throw fail('Review the employer formula period and catch-up matching treatment explicitly.')
 if(!exact(value.compensation,kinds)||kinds.some(key=>typeof value.compensation[key]!=='boolean')||!kinds.some(key=>value.compensation[key]))throw fail('Review every employer contribution compensation category explicitly.')
 const match=applicability!=='NONELECTIVE',nonelective=applicability!=='MATCH'
 if(!Array.isArray(value.matchTiers)||value.matchTiers.length>(match?10:0)||match&&!value.matchTiers.length||!match&&value.matchCatchUp)throw fail('Retain matching tiers only for a plan with employer matching contributions.')
 let prior=0
 const matchTiers=value.matchTiers.map(tier=>{
  if(!exact(tier,['upToBps','matchBps'])||!rate(tier.upToBps,10000)||tier.upToBps<=prior||!rate(tier.matchBps,100000))throw fail('Matching tiers need increasing compensation ceilings up to 100% and matching rates from 0% to 1,000%.')
  prior=tier.upToBps
  return {upToBps:tier.upToBps,matchBps:tier.matchBps}
 })
 if(match&&!matchTiers.some(tier=>tier.matchBps>0))throw fail('A matching formula must contain a positive matching rate.')
 if(!rate(value.nonelectiveBps,10000)||(nonelective?value.nonelectiveBps===0:value.nonelectiveBps!==0))throw fail('Review a positive nonelective percentage only when nonelective contributions apply.')
 return {period:value.period,matchCatchUp:value.matchCatchUp,matchTiers,nonelectiveBps:value.nonelectiveBps,compensation:Object.fromEntries(kinds.map(key=>[key,value.compensation[key]])),eligibilityTerms:terms(value.eligibilityTerms,'eligibility conditions'),vestingTerms:terms(value.vestingTerms,'vesting terms')}
}
