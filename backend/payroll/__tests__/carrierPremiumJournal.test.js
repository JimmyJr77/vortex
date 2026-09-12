import {carrierPremiumReversalPayload} from '../carrierPremiumReversal.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {carrierPremiumJournal} from '../carrierPremiumJournal.js'
test('carrier premium journal balances the actual invoice allocation and rejects ambiguous accounts',()=>{
 const invoice={invoiceDate:'2026-09-01',amountCents:57500,allocation:{employerExpenseCents:45000,employeeContributionCents:12500}},accounts={expense:'7',carrier:'8',deductions:'5'}
 const p=carrierPremiumJournal('synthetic-invoice',invoice,accounts);assert.deepEqual(p.Line.map(l=>[l.JournalEntryLineDetail.PostingType,l.Amount,l.JournalEntryLineDetail.AccountRef.value]),[['Debit',450,'7'],['Debit',125,'5'],['Credit',575,'8']]);assert.equal(p.CurrencyRef.value,'USD');assert.equal(p.TxnDate,'2026-09-01')
 assert.deepEqual(carrierPremiumJournal('synthetic-invoice',invoice,accounts),p)
 assert.throws(()=>carrierPremiumJournal('synthetic-invoice',invoice,{...accounts,carrier:'5'}),/distinct/)
 assert.throws(()=>carrierPremiumJournal('synthetic-invoice',{...invoice,amountCents:57501},accounts),/allocation/)
 assert.throws(()=>carrierPremiumJournal('synthetic-invoice',{...invoice,invoiceDate:'2026-02-30'},accounts),/date/)
 assert.equal(carrierPremiumJournal('synthetic-invoice',{...invoice,allocation:{employerExpenseCents:57500,employeeContributionCents:0}},{...accounts,deductions:null}).Line.length,2)
})

test('premium reversal offsets every original account without mutating its retained journal',()=>{
 const original=carrierPremiumJournal('synthetic-invoice',{invoiceDate:'2026-09-01',amountCents:57500,allocation:{employerExpenseCents:45000,employeeContributionCents:12500}},{expense:'7',carrier:'8',deductions:'5'}),before=JSON.stringify(original),id='01234567-1234-1234-1234-012345678901'
 const reversal=carrierPremiumReversalPayload(id,original,'2026-09-02'),balances=new Map()
 for(const line of [...original.Line,...reversal.Line]){const account=line.JournalEntryLineDetail.AccountRef.value;balances.set(account,(balances.get(account)||0)+Math.round(line.Amount*100)*(line.JournalEntryLineDetail.PostingType==='Debit'?1:-1))}
 assert.deepEqual([...balances.values()],[0,0,0]);assert.equal(JSON.stringify(original),before);assert.notEqual(reversal.DocNumber,original.DocNumber)
 assert.throws(()=>carrierPremiumReversalPayload(id,original,'2026-08-31'),/precede/);assert.throws(()=>carrierPremiumReversalPayload(id,original,'2026-02-30'),/date/)
 assert.throws(()=>carrierPremiumReversalPayload(id,{...original,Line:original.Line.slice(1)},'2026-09-02'),/verified/)
})
