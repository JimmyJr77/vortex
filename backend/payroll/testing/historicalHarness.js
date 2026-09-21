import {createHarness} from './harness.js'

// For fixtures whose signed authorizations and payroll dates are historical.
// Only Date is mocked; timers, network IO and lock contention keep real time.
// The caller's node:test context restores Date automatically after the test.
export async function createHistoricalHarness(t,options={},referenceTime='2026-09-13T16:00:00.000Z'){
 const timestamp=Date.parse(referenceTime)
 if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString()!==referenceTime)throw new Error('Use an ISO UTC historical fixture timestamp.')
 t.mock.timers.enable({apis:['Date'],now:timestamp})
 return createHarness({...options,databaseNow:referenceTime})
}
