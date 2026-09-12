// Reconstruct paid components from the retained native salary rate and minutes,
// then reconcile to the posted payment. This does not determine FLSA coverage.
export function salaryPaidPremium(source){
 const s=source.salaryCalculation,fail=()=>{throw new Error('Retained salary overtime inputs do not reconcile.')},safe=n=>Number.isSafeInteger(n)&&n>=0
 if(!s||s.version!==1||!s.reviewedAt||s.paymentPolicy!=='FULL_PERIOD_SALARY_NO_ABSENCE_DEDUCTIONS'||!safe(s.annualSalaryCents)||!s.annualSalaryCents||![12,24,26,52].includes(s.periodsPerYear)||!safe(source.overtimeMinutes)||!safe(source.overtimePayCents)||!safe(source.regularPayCents)||!['EXEMPT','NONEXEMPT'].includes(s.classification))fail()
 const regular=Number((BigInt(s.annualSalaryCents)*2n+BigInt(s.periodsPerYear))/(2n*BigInt(s.periodsPerYear)))
 if(!safe(regular)||regular!==s.regularPayCents||regular!==source.regularPayCents)fail()
 if(s.classification==='EXEMPT'){if(source.overtimeMinutes!==0||source.overtimePayCents!==0)fail();return 0}
 const hours=s.standardWeeklyHours
 if(!Number.isFinite(hours)||hours<=0||hours>40||!Number.isInteger(hours*4)||s.regularRateNumerator!==s.annualSalaryCents||s.regularRateDenominator!==hours*52)fail()
 const numerator=BigInt(s.annualSalaryCents)*BigInt(source.overtimeMinutes),denominator=BigInt(hours*52)*60n
 const straight=Number((numerator*2n+denominator)/(denominator*2n)),overtime=Number((numerator*3n+denominator)/(denominator*2n))
 if(!safe(straight)||!safe(overtime)||overtime!==source.overtimePayCents||overtime<straight)fail()
 return overtime-straight
}
