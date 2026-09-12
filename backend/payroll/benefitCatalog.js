const fail=message=>{throw Object.assign(new Error(message),{status:400})}
export function validateBenefitPlans(plans){
 if(!Array.isArray(plans)||plans.length>20)fail('Publish at most 20 benefit plans.')
 const ids=new Set()
 const text=(v,label,max=2000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(`Provide ${label} within ${max} characters.`);return v.trim()}
 const id=v=>{if(typeof v!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(v)||v==='WAIVE'||ids.has(v))fail('Benefit plans and coverage options need unique identifiers.');ids.add(v);return v}
 return plans.map(p=>{if(!p||typeof p!=='object')fail('Provide valid benefit plan details.');return ({id:id(p.id),name:text(p.name,'the plan name',150),description:text(p.description,'plan eligibility and coverage terms'),options:(()=>{
  if(!Array.isArray(p.options)||!p.options.length||p.options.length>10)fail('Each benefit plan requires 1–10 coverage options.')
  return p.options.map(o=>{if(!o||typeof o!=='object')fail('Provide valid coverage option details.');for(const key of ['employeeCostCents','employerCostCents'])if(!Number.isSafeInteger(o[key])||o[key]<0||o[key]>10000000)fail('Monthly benefit costs must be nonnegative whole cents within $100,000.')
   if(!['PRETAX','POSTTAX','EMPLOYER_PAID'].includes(o.taxTreatment)||o.taxTreatment==='EMPLOYER_PAID'&&o.employeeCostCents!==0)fail('Choose the published tax treatment; employer-paid coverage cannot include an employee contribution.')
   return {id:id(o.id),label:text(o.label,'the coverage option',150),employeeCostCents:o.employeeCostCents,employerCostCents:o.employerCostCents,taxTreatment:o.taxTreatment,costFrequency:'MONTHLY'}
  })
 })()})})
}
export function benefitPlans(policy){return policy?.benefitCatalog?validateBenefitPlans(JSON.parse(policy.benefitCatalog)):[]}
export function benefitsTerms(policy){
 const base=String(policy?.benefitsText||''),plans=benefitPlans(policy)
 if(!plans.length)return base
 const dollars=n=>`$${(n/100).toFixed(2)}`
 return `${base}\n\nPublished benefit plans\n${plans.map(p=>`${p.name}\n${p.description}\n${p.options.map(o=>`${o.label}: employee ${dollars(o.employeeCostCents)}/month; employer ${dollars(o.employerCostCents)}/month; ${o.taxTreatment.toLowerCase().replaceAll('_',' ')}.`).join('\n')}`).join('\n\n')}`.trim()
}
export function selectedBenefits(body,plans){
 if(!Array.isArray(body.selections)||body.selections.length!==plans.length)fail('Choose coverage or decline for each published benefit plan.')
 const selected=new Map()
 for(const s of body.selections){if(!s||selected.has(s.planId)||!plans.some(p=>p.id===s.planId))fail('Choose each published benefit plan exactly once.');selected.set(s.planId,s.optionId)}
 const selections=plans.map(p=>{const optionId=selected.get(p.id),option=p.options.find(o=>o.id===optionId);if(optionId!=='WAIVE'&&!option)fail('A selected coverage option is no longer offered. Refresh the benefits choices.');return {planId:p.id,planName:p.name,optionId,...(option?{optionLabel:option.label,employeeCostCents:option.employeeCostCents,employerCostCents:option.employerCostCents,taxTreatment:option.taxTreatment,costFrequency:option.costFrequency}:{})}})
 const choice=selections.some(s=>s.optionId!=='WAIVE')?'ENROLL':'WAIVE'
 if(body.choice!==choice)fail('The overall benefits choice does not match the selected plans.')
 return selections
}
