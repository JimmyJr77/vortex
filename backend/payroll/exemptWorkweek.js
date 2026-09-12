// Sunday through Saturday; the legacy policy is eight hours Monday–Friday.
export function exemptLeaveWorkweek(value){
 const minutes=value===undefined?[0,480,480,480,480,480,0]:value
 if(!Array.isArray(minutes)||minutes.length!==7||minutes.some(v=>!Number.isSafeInteger(v)||v<0||v>1440)||minutes.reduce((sum,v)=>sum+v,0)<=0||minutes.reduce((sum,v)=>sum+v,0)>2400)throw Object.assign(new Error('Exempt leave workweeks require seven daily minute amounts totaling more than zero and no more than 40 hours.'),{status:400})
 return [...minutes]
}
