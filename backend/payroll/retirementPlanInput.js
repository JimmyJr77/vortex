import {createHash} from 'node:crypto'
const fail=message=>Object.assign(new Error(message),{status:400})
const text=(value,label,min,max,multiline=false)=>{if(typeof value!=='string'||value.trim().length<min||value.length>max||(multiline?/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/:/[\u0000-\u001f\u007f]/).test(value))throw fail(`Review ${label}.`);return value.trim()}
const day=value=>typeof value==='string'&&/^2026-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
// A reviewed configuration is evidence, not proof that a plan is legally
// established or ready for payroll/provider execution. No implicit defaults.
export function retirementPlanInput(body){
 const b=body||{}
 if(b.taxYear!==2026||b.planType!=='STANDARD_401K'||!day(b.effectiveOn)||b.confirmed!==true)throw fail('Confirm a reviewed 2026 standard 401(k) configuration and effective date.')
 if(typeof b.planId!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(b.planId))throw fail('Use a stable retirement plan identifier.')
 for(const field of ['allowsPretax','allowsRoth','allowsCatchUp','allowsHigherCatchUp'])if(typeof b[field]!=='boolean')throw fail('Review every contribution feature explicitly.')
 if(!b.allowsPretax&&!b.allowsRoth)throw fail('An elective-deferral plan must identify an available contribution treatment.')
 if(b.allowsHigherCatchUp&&!b.allowsCatchUp)throw fail('Higher catch-up requires catch-up permission.')
 if(!['NOT_APPLICABLE','APPLICABLE','UNRESOLVED'].includes(b.automaticEnrollment))throw fail('Review automatic enrollment applicability.')
 if(!['NONE','MATCH','NONELECTIVE','MATCH_AND_NONELECTIVE','UNRESOLVED'].includes(b.employerContributions))throw fail('Review employer contribution applicability.')
 const compensationKinds=['REGULAR','OVERTIME','BONUS','PAID_LEAVE']
 if(!b.compensation||typeof b.compensation!=='object'||Array.isArray(b.compensation)||Object.keys(b.compensation).length!==compensationKinds.length||compensationKinds.some(key=>typeof b.compensation[key]!=='boolean')||!compensationKinds.some(key=>b.compensation[key]))throw fail('Explicitly review included and excluded compensation categories.')
 for(const field of ['planOrdinaryDeferralLimitCents','planCatchUpLimitCents'])if(b[field]!==null&&(!Number.isSafeInteger(b[field])||b[field]<0))throw fail('Use reviewed nonnegative plan limits in cents, or explicit null when no additional plan dollar cap applies.')
 if(!b.allowsCatchUp&&b.planCatchUpLimitCents!==0)throw fail('A plan without catch-up must have a zero catch-up cap.')
 const result={version:1,taxYear:2026,planType:b.planType,planId:b.planId,effectiveOn:b.effectiveOn,name:text(b.name,'the plan name',2,200),providerName:text(b.providerName,'the recordkeeper/provider name',2,200),planReference:text(b.planReference,'the retained plan document reference',12,2000),eligibilityTerms:text(b.eligibilityTerms,'eligibility and entry-date terms',12,4000,true),compensationTerms:text(b.compensationTerms,'the plan compensation definition',12,4000,true),employeeTerms:text(b.employeeTerms,'employee-facing election and change terms',12,4000,true),allowsPretax:b.allowsPretax,allowsRoth:b.allowsRoth,allowsCatchUp:b.allowsCatchUp,allowsHigherCatchUp:b.allowsHigherCatchUp,automaticEnrollment:b.automaticEnrollment,employerContributions:b.employerContributions,compensation:Object.fromEntries(compensationKinds.map(key=>[key,b.compensation[key]])),planOrdinaryDeferralLimitCents:b.planOrdinaryDeferralLimitCents,planCatchUpLimitCents:b.planCatchUpLimitCents,reviewReference:text(b.reviewReference,'the administrator review reference',12,2000)}
 if(b.automaticEnrollment!=='NOT_APPLICABLE')result.automaticEnrollmentTerms=text(b.automaticEnrollmentTerms,'automatic enrollment applicability and terms',12,4000,true)
 if(b.employerContributions!=='NONE')result.employerContributionTerms=text(b.employerContributionTerms,'employer contribution applicability and formula',12,4000,true)
 // Absence preserves existing signed plan fingerprints and means unreviewed.
 // Taken paid leave does not establish the treatment of an unused-leave cashout.
 if(b.unusedPto!==undefined){
  const p=b.unusedPto,fields=['inServiceDeferrals','postSeveranceDeferrals','postSeverance415','limitationYear','terms']
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==fields.length||fields.some(key=>!Object.hasOwn(p,key)))throw fail('Review every unused PTO payout plan term explicitly.')
  for(const key of fields.slice(0,3))if(!['INCLUDED','EXCLUDED','REVIEW_REQUIRED'].includes(p[key]))throw fail('Review unused PTO deferral and post-employment compensation treatment.')
  if(!['CALENDAR_YEAR','NON_CALENDAR_YEAR','REVIEW_REQUIRED'].includes(p.limitationYear))throw fail('Review the retirement plan limitation year.')
  result.unusedPto={inServiceDeferrals:p.inServiceDeferrals,postSeveranceDeferrals:p.postSeveranceDeferrals,postSeverance415:p.postSeverance415,limitationYear:p.limitationYear,terms:text(p.terms,'unused PTO payout plan terms and supporting document reference',20,4000,true)}
 }
 return {...result,fingerprint:createHash('sha256').update(JSON.stringify(result)).digest('hex')}
}
