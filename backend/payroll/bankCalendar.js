// Federal Reserve Banks: Saturday holidays do not close the preceding Friday;
// Sunday holidays close the following Monday. Bank-specific cutoff times are separate.
export function federalReserveHolidays(year) {
 const dates=[]
 const fixed=(month,day)=>{const d=new Date(Date.UTC(year,month-1,day));dates.push(d);if(d.getUTCDay()===0)dates.push(new Date(d.getTime()+86400000))}
 const nth=(month,weekday,n)=>{const d=new Date(Date.UTC(year,month-1,1));d.setUTCDate(1+(weekday-d.getUTCDay()+7)%7+7*(n-1));dates.push(d)}
 fixed(1,1);nth(1,1,3);nth(2,1,3)
 const memorial=new Date(Date.UTC(year,5,0));memorial.setUTCDate(memorial.getUTCDate()-(memorial.getUTCDay()-1+7)%7);dates.push(memorial)
 if(year>=2021)fixed(6,19)
 fixed(7,4);nth(9,1,1);nth(10,1,2);fixed(11,11);nth(11,4,4);fixed(12,25)
 return new Set(dates.map(d=>d.toISOString().slice(0,10)))
}
export function previousBankBusinessDay(value) {
 const day=new Date(`${value}T00:00:00Z`)
 if(!Number.isFinite(day.valueOf())||day.toISOString().slice(0,10)!==value)throw new Error('Invalid pay date.')
 while(day.getUTCDay()===0||day.getUTCDay()===6||federalReserveHolidays(day.getUTCFullYear()).has(day.toISOString().slice(0,10)))day.setUTCDate(day.getUTCDate()-1)
 return day.toISOString().slice(0,10)
}
