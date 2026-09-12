import {createHash} from 'node:crypto'
// Diagnostic of tax-bearing fields, not full NACHA validation or bank acceptance.
export function federalRemittanceBankFields(file,instruction){
 if(typeof file!=='string'||!file.length||Buffer.byteLength(file)>1000000||/[^\x20-\x7e\r\n]/.test(file))throw Object.assign(new Error('Choose an ASCII ACH file no larger than 1 MB.'),{status:400})
 const normalized=file.replace(/\r\n/g,'\n');if(normalized.includes('\r'))throw Object.assign(new Error('Use fixed-width ACH records with LF or CRLF separators.'),{status:400})
 const records=normalized.includes('\n')?normalized.replace(/\n$/,'').split('\n'):normalized.match(/.{1,94}/g)
 if(!records?.length||records.some(r=>r.length!==94))throw Object.assign(new Error('Every ACH record must contain exactly 94 characters.'),{status:400})
 const entries=records.map((record,index)=>({record,index})).filter(r=>r.record[0]==='6')
 if(entries.length!==1)throw Object.assign(new Error('Use a bank sample containing exactly one tax payment entry.'),{status:400})
 const {record:entry,index}=entries[0],batch=records.slice(0,index).reverse().find(r=>r[0]==='5'),addenda=records[index+1]
 if(!batch||records[index-1]!==batch||addenda?.slice(0,3)!=='705')throw Object.assign(new Error('The tax entry needs a preceding batch header and an immediately following CCD+ addenda record.'),{status:400})
 const checks=[],check=(field,matches)=>checks.push({field,matches})
 check('CCD service class',batch.slice(50,53)==='CCD'&&batch.slice(1,4)==='220')
 check('Employer identification in batch header',batch.slice(40,50).trim()===instruction.ein||batch.slice(40,50)===`1${instruction.ein}`)
 check('Tax-payment description',batch.slice(53,63).replace(/ /g,'').toUpperCase()===instruction.statementDescriptor)
 check('Planned settlement date',batch.slice(69,75)===instruction.settlementDate.slice(2).replaceAll('-',''))
 check('Credit transaction',entry.slice(1,3)==='22')
 check('Treasury routing',entry.slice(3,12)===instruction.receivingRoutingNumber)
 check('Treasury account',entry.slice(12,29).trim()===instruction.receivingAccountNumber)
 check('Tax amount',entry.slice(29,39)===String(instruction.amountCents).padStart(10,'0'))
 check('Taxpayer identification in entry detail',entry.slice(39,54).trim()===instruction.entryIdentification)
 check('Receiving company',entry.slice(54,76).trim()===instruction.receivingCompanyName)
 check('Tax addenda indicator',entry[78]==='1')
 check('Tax period and amount in addenda',addenda.slice(3,83).trimEnd()===instruction.addenda)
 check('Addenda sequence',addenda.slice(83,87)==='0001'&&/^\d{15}$/.test(entry.slice(79))&&addenda.slice(87)===entry.slice(87))
 check('Originating bank trace prefix',/^\d{8}$/.test(batch.slice(79,87))&&entry.slice(79,87)===batch.slice(79,87))
 return {status:checks.every(c=>c.matches)?'TAX_FIELDS_MATCH':'TAX_FIELDS_DIFFER',checks,fileFingerprint:createHash('sha256').update(file).digest('hex'),executionStatus:'NOT_CONNECTED'}
}
