import {useState} from 'react'
import {w4Deductions2026,type W4DeductionsResult} from '../../utils/w4Deductions2026.js'
const style='mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const dollars=(cents:number)=>`${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}`
const fields=[
 ['qualifiedTipsCents','Line 1(a): qualified tips','Enter eligible tips. The worksheet caps them at $25,000 and requires total income below $150,000 ($300,000 for joint filers).'],
 ['qualifiedOvertimeCents','Line 1(b): qualified overtime compensation','Enter only the eligible “and-a-half” portion of time-and-a-half pay. The cap is $12,500 ($25,000 for joint filers); the same income limit as tips applies.'],
 ['vehicleInterestCents','Line 1(c): qualified passenger vehicle loan interest','Enter eligible interest. The cap is $10,000; total income must be below $100,000 ($200,000 for joint filers) for this worksheet.'],
 ['adjustmentsCents','Line 5: eligible Schedule 1 adjustments','Estimate deductible student loan interest, IRA contributions, educator expenses, alimony and other eligible Schedule 1, Part II adjustments.'],
 ['medicalExpensesCents','Line 6(a): qualifying medical and dental expenses','Enter eligible expenses before the income floor. We subtract 7.5% of your total income and use zero if the result is negative.'],
 ['stateLocalTaxesCents','Line 6(b): qualifying state and local taxes','We cap this at $40,400 ($20,200 if married filing separately). This worksheet requires income below $505,000 ($252,500 if filing separately).'],
 ['mortgageInterestCents','Line 6(c): qualifying home mortgage interest','Include qualifying mortgage insurance premiums. Enter your home acquisition debt below to check the worksheet range.'],
 ['acquisitionDebtCents','Home acquisition debt','The printed worksheet requires debt below $750,000 ($375,000 if married filing separately) when claiming mortgage interest.'],
 ['charitableGiftsCents','Line 6(d): qualifying charitable gifts for itemizing','Enter eligible contributions before the floor. We subtract 0.5% of total income and use zero if the result is negative.'],
 ['otherItemizedCents','Line 6(e): other eligible itemized deductions','Enter only amounts eligible for Schedule A that you have not included above.'],
 ['cashGiftsCents','Line 12: qualifying cash gifts if taking the standard deduction','We compare the standard-deduction option using up to $1,000 of eligible cash gifts ($2,000 for joint filers). This is an alternative to itemizing; gifts are not deducted twice.'],
] as const
type Key=typeof fields[number][0]
const empty=()=>Object.fromEntries(fields.map(([key])=>[key,''])) as Record<Key,string>
const labels:Record<string,string>={'1a':'Qualified tips','1b':'Qualified overtime','1c':'Vehicle loan interest','2':'Total of lines 1(a)–1(c)','3a':'Your senior deduction','3b':'Spouse senior deduction','4':'Total senior deduction','5':'Schedule 1 adjustments','6a':'Medical/dental above the floor','6b':'State/local taxes','6c':'Mortgage interest','6d':'Charitable gifts above the floor','6e':'Other itemized deductions','7':'Total itemized deductions','8a':'Total income','8b':'Income less senior deduction','9':'Itemized deduction limitation threshold','10':'Itemized deductions after limitation','11':'Standard deduction','12':'Cash gifts with standard deduction','13':'Standard deduction plus cash gifts','14':'Additional deduction amount','15':'Total for Step 4(b)'}
const lineOrder=['1a','1b','1c','2','3a','3b','4','5','6a','6b','6c','6d','6e','7','8a','8b','9','10','11','12','13','14','15']
function cents(text:string,allowBlank=true){
 if(allowBlank&&!text.trim())return 0
 if(!/^\d+(\.\d{1,2})?$/.test(text))throw new Error('Enter dollar amounts with at most two decimal places. Total income is required; blank optional amounts mean zero.')
 const [whole,fraction='']=text.split('.'),value=Number(whole)*100+Number(fraction.padEnd(2,'0'))
 if(!Number.isSafeInteger(value))throw new Error('This dollar amount is too large.')
 return value
}
export default function W4DeductionsWorksheet({filingStatus,exempt,onApply}:{filingStatus:string;exempt:boolean;onApply:(value:string)=>void}){
 const [status,setStatus]=useState(''),[income,setIncome]=useState(''),[values,setValues]=useState(empty),[selfSenior,setSelfSenior]=useState(false),[spouseSenior,setSpouseSenior]=useState(false),[reviewed,setReviewed]=useState(false),[separateStandard,setSeparateStandard]=useState('')
 const [calculation,setCalculation]=useState<{key:string;result:W4DeductionsResult}|null>(null),[error,setError]=useState('')
 const key=JSON.stringify({filingStatus,status,income,values,selfSenior,spouseSenior,separateStandard,exempt})
 const result=calculation?.key===key&&!exempt?calculation.result:null
 const calculate=()=>{
  setError('');setCalculation(null);setReviewed(false)
  try{
   if(exempt)throw new Error('An exempt W-4 leaves Steps 2–4 blank.')
   if(status==='MARRIED_SEPARATELY'&&separateStandard!=='YES')throw new Error('This worksheet uses the standard deduction. Confirm you may claim it; if your spouse itemizes or another restriction applies, review the IRS instructions before entering Step 4(b).')
   setCalculation({key,result:w4Deductions2026({status,filingStatus,totalIncomeCents:cents(income,false),selfSenior,spouseSenior,...Object.fromEntries(fields.map(([name])=>[name,cents(values[name])]))} as Parameters<typeof w4Deductions2026>[0])})
  }catch(e){setError(e instanceof Error?e.message:'Unable to calculate the deductions worksheet.')}
 }
 const display=(line:string)=>result?.lines[line]===null?'Skipped':`$${dollars(result!.lines[line]!)}`
 const download=()=>{
  if(!result)return
  const text=['2026 Form W-4 - Deductions Worksheet','Source: IRS Form W-4 (2026), page 4','Keep for your records. This is not a signed W-4.',`Detailed filing status: ${status}`,`Total income: $${income}`,`Your senior eligibility: ${selfSenior}`,`Spouse senior eligibility: ${spouseSenior}`,...fields.map(([name,label])=>`${label}: $${dollars(cents(values[name]))}`),...lineOrder.map(line=>`Line ${line}: ${labels[line]}: ${display(line)}`),`Step 4(b): $${dollars(result.step4bCents)}`,'Amounts are employee-provided eligible estimates. Percentage results round to cents. This annual worksheet does not account for year-to-date withholding.'].join('\n')
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a')
  link.href=url;link.download='W4-2026-deductions-worksheet.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 return <details className="rounded-xl border border-slate-300 bg-white p-3">
  <summary className="cursor-pointer font-semibold">Calculate Step 4(b): Deductions Worksheet</summary>
  <section aria-label="Deductions Worksheet" className="mt-3 space-y-3">
   <p className="text-sm">Estimate eligible annual deductions using page 4 of the 2026 W-4. Review Schedule 1-A eligibility for tips, overtime, vehicle interest and seniors, and Schedule A eligibility for itemized deductions. Enter amounts in dollars; blank optional amounts mean zero. Estimates stay on this screen. Only the result you apply is kept when you save your W-4 draft.</p>
   <p className="text-sm">For multiple jobs, complete Steps 3–4(b) on only one W-4, preferably the highest paying job. This annual worksheet does not account for tax already withheld or changes during the year. You can still enter a separately determined Step 4(b) amount on the main form.</p>
   <label className="block text-sm font-semibold">Detailed deductions filing status<select className={style} value={status} onChange={e=>setStatus(e.target.value)}><option value="">Choose the status that matches Step 1(c)</option><option value="SINGLE">Single</option><option value="MARRIED_SEPARATELY">Married filing separately</option><option value="MARRIED_JOINTLY">Married filing jointly</option><option value="SURVIVING_SPOUSE">Qualifying surviving spouse</option><option value="HEAD_OF_HOUSEHOLD">Head of household</option></select></label>
   {status==='MARRIED_SEPARATELY'?<label className="block text-sm font-semibold">May you claim a standard deduction?<select className={style} value={separateStandard} onChange={e=>setSeparateStandard(e.target.value)}><option value="">Choose after reviewing your situation</option><option value="YES">Yes, my spouse does not itemize and no restriction applies</option><option value="NO">No or unsure</option></select></label>:null}
   <label className="block text-sm font-semibold">Estimated total annual income<input className={style} inputMode="decimal" autoComplete="off" value={income} onChange={e=>setIncome(e.target.value)}/></label>
   <p className="text-sm">Senior deductions require total income below $75,000 ($150,000 for joint filers). Married taxpayers must file jointly. Select only if the age and Social Security number requirements are met.</p>
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={selfSenior} onChange={e=>setSelfSenior(e.target.checked)}/>I qualify for line 3(a): age 65 or older before year-end and a valid Social Security number.</label>
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={spouseSenior} onChange={e=>setSpouseSenior(e.target.checked)}/>My spouse qualifies for line 3(b): joint return, age 65 or older before year-end and a Social Security number valid for employment.</label>
   {fields.map(([name,label,help])=><div key={name}><label className="block text-sm font-semibold">{label}<input className={style} inputMode="decimal" autoComplete="off" value={values[name]} onChange={e=>setValues(current=>({...current,[name]:e.target.value}))}/></label><p className="mt-1 text-sm">{help}</p></div>)}
   <button type="button" disabled={exempt} onClick={calculate} className="rounded-lg bg-slate-800 px-3 py-2 font-semibold text-white disabled:opacity-40">Calculate deductions worksheet</button>
   {error?<p role="alert" className="text-sm text-red-800">{error}</p>:null}
   {result?<div className="space-y-3">
    <dl className="space-y-2 text-sm">{lineOrder.map(line=><div key={line} className="flex flex-wrap justify-between gap-2"><dt>Line {line}: {labels[line]}</dt><dd className="font-semibold">{display(line)}</dd></div>)}</dl>
    <p className="text-sm">{result.usesItemized?'The itemized deduction option produces the larger worksheet amount.':'The standard deduction option produces at least as large a worksheet amount.'} Applying replaces Step 4(b) with ${dollars(result.step4bCents)}. Percentage calculations round to cents.</p>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed my eligible estimates and will use this deduction amount on only one W-4.</label>
    <div className="flex flex-wrap gap-3"><button type="button" disabled={!reviewed} className="rounded-lg bg-slate-950 px-3 py-2 font-semibold text-white disabled:opacity-40" onClick={()=>onApply(dollars(result.step4bCents))}>Apply worksheet to Step 4(b)</button><button type="button" className="font-semibold underline" onClick={download}>Download deductions worksheet</button></div>
   </div>:null}
  </section>
 </details>
}
