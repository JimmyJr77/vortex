import test from 'node:test'
import assert from 'node:assert/strict'
import {carrierInvoiceAllocation} from '../carrierInvoiceAllocation.js'
test('carrier invoice accounting split requires explicit support and reconciles integer cents',()=>{
 assert.equal(carrierInvoiceAllocation(undefined,57500),null)
 const input={employerExpenseCents:45000,employeeContributionCents:12500,reference:'Matched retained September employee contributions',confirmed:true}
 assert.equal(carrierInvoiceAllocation(input,57500).employeeContributionCents,12500)
 for(const bad of [{...input,confirmed:false},{...input,employerExpenseCents:-1},{...input,employeeContributionCents:12500.5},{...input,employerExpenseCents:44000},{...input,reference:''}])assert.throws(()=>carrierInvoiceAllocation(bad,57500))
 assert.equal(carrierInvoiceAllocation({...input,employerExpenseCents:57500,employeeContributionCents:0},57500).employerExpenseCents,57500)
})
