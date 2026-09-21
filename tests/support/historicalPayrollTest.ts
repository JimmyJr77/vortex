import {test as base,expect} from '@playwright/test'
import {createHarness as createRealHarness} from '../../backend/payroll/testing/harness.js'

// Explicit opt-in for historical payroll scenarios; ordinary duration tests use real time.
const referenceTime='2026-09-13T16:00:00.000Z'
export const test=base.extend<{historicalPayrollClock:void}>({
 historicalPayrollClock:[async({page},use)=>{
  const RealDate=globalThis.Date,timestamp=RealDate.parse(referenceTime)
  globalThis.Date=new Proxy(RealDate,{
   construct(target,args){return Reflect.construct(target,args.length?args:[timestamp])},
   apply(){return new RealDate(timestamp).toString()},
   get(target,key){return key==='now'?()=>timestamp:Reflect.get(target,key)},
  })
  try{await page.clock.setFixedTime(new RealDate(referenceTime));await use()}
  finally{globalThis.Date=RealDate}
 },{auto:true}],
})
export {expect}
export const createHarness=(options:Parameters<typeof createRealHarness>[0]={})=>createRealHarness({...options,databaseNow:referenceTime})
