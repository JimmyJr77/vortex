const date=value=>new Date(value).toISOString().slice(0,10)

// Calculate earnings by employment agreement, then let the caller calculate
// taxes and deductions once against the combined payment.
export function splitCompensationEarnings({employee,entries,adjustments,payPeriod,workweekStartsOn,timezone,calculate,weekFor}){
 const segments=employee.compensationSegments
 const groups=[]
 for(const segment of segments){
  let group=groups.find(g=>g.employmentStart===segment.employmentStart)
  if(!group){group={employmentStart:segment.employmentStart,employmentEnd:segment.employmentEnd,payType:segment.payType,segments:[]};groups.push(group)}
  group.segments.push(segment)
 }
 const warnings=[],calculations=[],weekOwners=new Map()
 for(const group of groups){
  const first=group.segments[0],last=group.segments.at(-1)
  for(let cursor=new Date(`${first.start}T12:00:00Z`);date(cursor)<=last.end;cursor.setUTCDate(cursor.getUTCDate()+1)){
   const week=weekFor(date(cursor),workweekStartsOn,timezone)
   if(weekOwners.has(week)&&weekOwners.get(week)!==group.employmentStart)warnings.push({code:'MIXED_EMPLOYMENT_WORKWEEK',severity:'critical',blocking:true,message:`The workweek starting ${week} spans employment agreements and requires combined regular-rate reconciliation.`})
   weekOwners.set(week,group.employmentStart)
  }
  if(group.payType==='SALARY'&&group.segments.length>1)warnings.push({code:'SALARY_CHANGE_PERIOD_BOUNDARY',severity:'critical',blocking:true,message:'Multiple salary agreements inside a pay period require salary-boundary reconciliation.'})
  const inGroup=day=>day>=first.start&&day<=last.end
  const selected=entries.filter(e=>inGroup(e.workDate||date(e.clockIn)))
  const review=first.salaryReview
  const terms={...employee,compensationSegments:undefined,payType:group.payType,hourlyRateCents:first.hourlyRateCents,annualSalaryCents:first.annualSalaryCents,
   salaryReview:review,overtimeClassification:group.payType==='HOURLY'?'NONEXEMPT':review?.classification,
   jobTitle:review?.jobTitle||employee.jobTitle,workState:review?.workState||employee.workState,
   hireDate:group.employmentStart,terminationDate:group.employmentEnd,employmentPeriods:[{start:group.employmentStart,end:group.employmentEnd}]}
  const result=calculate(terms,selected,adjustments.filter(a=>a.kind==='PAID_LEAVE'&&inGroup(a.leaveDate)),group)
  calculations.push({employmentStart:group.employmentStart,employmentEnd:group.employmentEnd,payType:group.payType,start:first.start,end:last.end,result})
 }
 const sum=key=>calculations.reduce((n,c)=>n+Number(c.result[key]||0),0)
 // Non-earning validation is repeated by the parent on the combined payment.
 const ignored=new Set(['WITHHOLDING_ENGINE_NOT_CONFIGURED','EMPLOYER_TAX_SETUP_REQUIRED','NEGATIVE_NET_PAY'])
 for(const c of calculations)warnings.push(...c.result.warnings.filter(w=>!ignored.has(w.code)))
 return {calculations,warnings,regularPayCents:sum('regularPayCents'),overtimePayCents:sum('overtimePayCents'),regularMinutes:sum('regularMinutes'),overtimeMinutes:sum('overtimeMinutes'),
  paidLeavePayCents:sum('paidLeavePayCents'),paidLeaveMinutes:sum('paidLeaveMinutes'),otherTaxablePayCents:sum('otherTaxablePayCents'),
  salaryExtraCents:calculations.reduce((n,c)=>n+Number(c.result.salaryCalculation?.extraStraightTimePayCents||0),0),
  leaveBasisMinutes:calculations.reduce((n,c)=>n+(c.result.salaryCalculation?.leaveBasisMinutes??c.result.regularMinutes+c.result.overtimeMinutes),0),
  entries:calculations.flatMap(c=>c.result.entries),rateBreakdown:calculations.flatMap(c=>c.result.rateBreakdown),workweekEarnings:calculations.flatMap(c=>c.result.workweekEarnings),workweekPayments:calculations.flatMap(c=>c.result.workweekPayments),
  payItems:calculations.flatMap(c=>c.result.payItems.map(item=>({...item,employmentStart:c.employmentStart,...(item.kind==='SALARY_EXTRA_STRAIGHT_TIME'?{salaryStandardWeeklyHours:c.result.salaryCalculation.standardWeeklyHours}:{})}))),weightedOvertimeApplied:calculations.some(c=>c.result.weightedOvertimeApplied),
  evidence:calculations.map(c=>({employmentStart:c.employmentStart,employmentEnd:c.employmentEnd,payType:c.payType,start:c.start,end:c.end,regularPayCents:c.result.regularPayCents,overtimePayCents:c.result.overtimePayCents,paidLeavePayCents:c.result.paidLeavePayCents,regularMinutes:c.result.regularMinutes,overtimeMinutes:c.result.overtimeMinutes,rateBreakdown:c.result.rateBreakdown,salaryCalculation:c.result.salaryCalculation})),
 }
}
