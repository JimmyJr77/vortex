import test from 'node:test'
import assert from 'node:assert/strict'
import {federalRemittanceBankFields} from '../federalRemittanceBankFields.js'
import {federalRemittanceInstruction} from '../federalRemittanceInstruction.js'
import {federalRemittanceBankSample} from '../testing/federalRemittanceBankSample.js'
const instruction=federalRemittanceInstruction({agency:'IRS_941',year:2026,quarter:3,ein:'123456789',amountCents:12345,settlementDate:'2026-10-15'})
test('bank tax-field diagnostic checks actual entry EIN independently from TXP addenda',()=>{
 const file=federalRemittanceBankSample(instruction)
 for(const variant of [file,file+'\n',file.replaceAll('\n','\r\n')+'\r\n',file.replaceAll('\n','')]){const result=federalRemittanceBankFields(variant,instruction);assert.equal(result.status,'TAX_FIELDS_MATCH');assert.equal(JSON.stringify(result).includes(instruction.ein),false)}
 for(const [line,start,end,label] of [[0,40,50,'Employer identification in batch header'],[0,69,75,'Planned settlement date'],[1,3,12,'Treasury routing'],[1,12,29,'Treasury account'],[1,29,39,'Tax amount'],[1,39,54,'Taxpayer identification in entry detail'],[1,78,79,'Tax addenda indicator'],[2,3,83,'Tax period and amount in addenda'],[2,87,94,'Addenda sequence']]){
  const records=file.split('\n');records[line]=records[line].slice(0,start)+'0'.repeat(end-start)+records[line].slice(end);const result=federalRemittanceBankFields(records.join('\n'),instruction);assert.equal(result.status,'TAX_FIELDS_DIFFER');assert.equal(result.checks.find(c=>c.field===label).matches,false)
 }
 for(const invalid of ['',file+' ',file.replace('SYNTHETIC','SYNTHÉTIC'),file.replaceAll('\n','\r'),file+'\n'+file,' '.repeat(1000001),file.split('\n').slice(1).join('\n')])assert.throws(()=>federalRemittanceBankFields(invalid,instruction))
})
