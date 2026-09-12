import { federalReserveHolidays } from './bankCalendar.js'
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v).slice(0,10)
const add=(value,n)=>day(new Date(Date.parse(`${value}T00:00:00Z`)+n*86400000))
// Federal tax deposits use DC legal holidays, not the Federal Reserve calendar.
export function federalTaxHolidays(year) {
 const holidays=federalReserveHolidays(year)
 for(const [month,date] of [[1,1],[4,16],[6,19],[7,4],[11,11],[12,25]]) {
  const value=new Date(Date.UTC(year,month-1,date)),key=day(value)
  holidays.add(key)
  if(value.getUTCDay()===6)holidays.add(add(key,-1))
  if(value.getUTCDay()===0)holidays.add(add(key,1))
 }
 // January 1 of the following year can be observed on December 31.
 if(new Date(Date.UTC(year+1,0,1)).getUTCDay()===6)holidays.add(`${year}-12-31`)
 return holidays
}
const business=value=>![0,6].includes(new Date(`${value}T00:00:00Z`).getUTCDay())&&!federalTaxHolidays(Number(value.slice(0,4))).has(value)
export function nextFederalTaxBusinessDay(value,inclusive=false) {
 let next=inclusive?value:add(value,1)
 while(!business(next))next=add(next,1)
 return next
}
