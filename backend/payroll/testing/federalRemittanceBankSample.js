// Synthetic fixed-width tax-bearing records for diagnostic tests; not a complete ACH file.
export function federalRemittanceBankSample(i){
 const field=(s,n)=>String(s).padEnd(n,' '),trace='021000020000001'
 return ['5220'+field('SYNTHETIC',16)+' '.repeat(20)+'1'+i.ein+'CCD'+field('TAXPAYMENT',10)+' '.repeat(6)+i.settlementDate.slice(2).replaceAll('-','')+'   '+'1'+trace.slice(0,8)+'0000001','622'+i.receivingRoutingNumber+field(i.receivingAccountNumber,17)+String(i.amountCents).padStart(10,'0')+field(i.ein,15)+field('IRS',22)+'  '+'1'+trace,'705'+field(i.addenda,80)+'0001'+trace.slice(8)].join('\n')
}
