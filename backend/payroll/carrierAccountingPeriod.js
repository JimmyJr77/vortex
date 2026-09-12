export function carrierAccountingPeriod(preferences,invoiceDate){
 const fail=message=>{throw Object.assign(new Error(message),{status:409})}
 const accounting=preferences?.AccountingInfoPrefs
 if(!accounting||typeof accounting!=='object'||Array.isArray(accounting))fail('QuickBooks accounting-period preferences could not be verified.')
 const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
 if(!date(invoiceDate))fail('The invoice needs a valid accounting date.')
 const close=accounting.BookCloseDate
 if(close!==undefined&&close!==null&&!date(close))fail('QuickBooks returned an invalid book closing date. Review the company accounting settings.')
 if(close&&invoiceDate<=close)fail(`The invoice date falls in books closed through ${close}. Resolve the accounting period before preparing this journal.`)
 return {invoiceDate,bookCloseDate:close||null}
}
