import {useCallback,useEffect,useRef,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
const wageFields=[['socialSecurityWagesCents','Social Security wages'],['medicareWagesCents','Medicare wages'],['futaWagesCents','Federal unemployment wages'],['marylandUnemploymentWagesCents','Maryland unemployment wages']] as const
const annualFields=[['federalWagesCents','Federal reporting wages'],['marylandWagesCents','Maryland reporting wages'],['socialSecurityReportedWagesCents','Social Security reporting wages after the annual limit'],['additionalMedicareWagesCents','Wages subject to Additional Medicare'],['federalWithheldCents','Federal income tax withheld'],['marylandWithheldCents','Maryland income tax withheld'],['socialSecurityWithheldCents','Social Security tax withheld'],['medicareWithheldCents','Regular Medicare tax withheld'],['additionalMedicareWithheldCents','Additional Medicare tax withheld'],['qualifiedOvertimePremiumCents','Qualified FLSA overtime premium']] as const
const employerFields=[['socialSecurityCents','Employer Social Security tax'],['medicareCents','Employer Medicare tax'],['futaCents','Employer FUTA tax'],['marylandUnemploymentCents','Employer Maryland unemployment tax']] as const
type EmployerKey=typeof employerFields[number][0]
type EmployerDraft={enabled:boolean;amounts:Partial<Record<EmployerKey,string>>;reference:string;confirmed:boolean}
const annualChecks=[['registerReconciledConfirmed','I reconciled the separate withholding amounts to the original payroll register.'],['reportingWagesConfirmed','I verified reporting wages after applicable annual limits separately from uncapped opening balances.'],['qualifiedOvertimeReviewed','I reviewed the FLSA-qualified overtime premium; zero means reviewed and none applies.']] as const
type AnnualKey=typeof annualFields[number][0]
type AnnualCheck=typeof annualChecks[number][0]
type AnnualDraft={employer:EmployerDraft;enabled:boolean;amounts:Partial<Record<AnnualKey,string>>;reference:string}&Record<AnnualCheck,boolean>
const blankAnnual=():AnnualDraft=>({employer:{enabled:false,amounts:{},reference:'',confirmed:false},enabled:false,amounts:{},reference:'',registerReconciledConfirmed:false,reportingWagesConfirmed:false,qualifiedOvertimeReviewed:false})
type WageKey=typeof wageFields[number][0]
type Payment={paymentId:string;paymentDate:string;periodStart:string;periodEnd:string;grossCents:number;reference:string|null}
type Review={disposition:string;reference:string;payments?:{paymentId:string;wages:Record<WageKey,number>;annualDetail?:Record<AnnualKey,number>&{reference:string;employerTaxes?:Record<EmployerKey,number>&{reference:string}}}[]}
type Model={employee:{legal_first_name:string;legal_last_name:string};status:string;source:{fingerprint:string;payments:Payment[]};history:{id:string;revision:number;review:Review}[]}
type Draft=Record<string,Record<WageKey,string>>
async function request(path:string,body?:string){
 const response=await adminApiRequest(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body}:undefined)
 const value=await response.json().catch(()=>({}))
 if(!response.ok)throw Object.assign(new Error(value.message||'Unable to review imported taxable wages.'),{status:response.status})
 return value.data
}
const cents=(value:string)=>{
 if(!/^\d+(\.\d{1,2})?$/.test(value))return null
 const [whole,fraction='']=value.split('.'),amount=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))
 return amount<=BigInt(Number.MAX_SAFE_INTEGER)?Number(amount):null
}
const blank=(model:Model):Draft=>Object.fromEntries(model.source.payments.map(p=>[p.paymentId,Object.fromEntries(wageFields.map(([key])=>[key,'']))])) as Draft

function ReviewForm({employeeId,paymentDate,lock}:{employeeId:string;paymentDate:string;lock:(value:boolean)=>void}){
 const path=`/api/admin/payroll/employees/${employeeId}/historical-employment-wages`
 const [data,setData]=useState<Model|null>(null),[basis,setBasis]=useState<Model|null>(null),[draft,setDraft]=useState<Draft>({})
 const [decision,setDecision]=useState(''),[reference,setReference]=useState(''),[checks,setChecks]=useState({same:false,uncapped:false,complete:false,confirmed:false})
 const [annual,setAnnual]=useState<Record<string,AnnualDraft>>({})
 const [pending,setPending]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[readError,setReadError]=useState(false),[notice,setNotice]=useState('')
 const sequence=useRef(0)
 const invalidate=useCallback(()=>{sequence.current++},[])
 const resetChecks=()=>setChecks({same:false,uncapped:false,complete:false,confirmed:false})
 const refresh=useCallback(async()=>{
  const version=++sequence.current
  try{const next=await request(`${path}?paymentDate=${paymentDate}`) as Model;if(version!==sequence.current)return;setData(next);setError('');setReadError(false);setNotice('');setBasis(old=>old||next);setDraft(old=>Object.keys(old).length?old:blank(next))}
  catch(e){if(version===sequence.current){setReadError(true);setError(e instanceof Error?e.message:'Unable to refresh imported wages.')}}
 },[path,paymentDate])
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),30000);return()=>{invalidate();clearInterval(timer)}},[refresh,invalidate])
 useEffect(()=>{lock(busy||!!pending);return()=>lock(false)},[busy,pending,lock])
 const stale=!!basis&&!!data&&(basis.source.fingerprint!==data.source.fingerprint||(basis.history[0]?.revision||0)!==(data.history[0]?.revision||0))
 const validAmounts=!!basis?.source.payments.length&&basis.source.payments.every(p=>wageFields.every(([key])=>{const value=cents(draft[p.paymentId]?.[key]||'');return value!==null&&value<=p.grossCents}))
 const validAnnual=!!basis&&basis.source.payments.every(p=>{const a=annual[p.paymentId];return !a?.enabled||(a.reference.trim().length>=20&&(!a.employer.enabled||a.employer.confirmed&&a.employer.reference.trim().length>=20&&employerFields.every(([key])=>{const value=cents(a.employer.amounts[key]||'');return value!==null&&value<=p.grossCents}))&&annualChecks.every(([key])=>a[key])&&annualFields.every(([key])=>{const value=cents(a.amounts[key]||'');return value!==null&&value<=p.grossCents}))})
 const valid=!!decision&&reference.trim().length>=20&&checks.confirmed&&(decision==='UNRESOLVED'||checks.same&&checks.uncapped&&checks.complete&&validAmounts&&validAnnual)
 const updateAnnual=(id:string,patch:Partial<AnnualDraft>)=>{setAnnual(old=>({...old,[id]:{...(old[id]||blankAnnual()),...patch}}));resetChecks()}
 const save=async()=>{
  if(!basis)return;setBusy(true);setError('');setNotice('')
  const body=pending||JSON.stringify({requestKey:crypto.randomUUID(),expectedRevision:basis.history[0]?.revision||0,paymentDate,sourceFingerprint:basis.source.fingerprint,disposition:decision,reference,confirmed:checks.confirmed,sameEmployerConfirmed:checks.same,uncappedWagesConfirmed:checks.uncapped,completeHistoryConfirmed:checks.complete,payments:basis.source.payments.map(p=>({...(annual[p.paymentId]?.enabled?{annualDetail:{...(annual[p.paymentId].employer.enabled?{employerTaxes:{...Object.fromEntries(employerFields.map(([key])=>[key,cents(annual[p.paymentId].employer.amounts[key]||'')])),reference:annual[p.paymentId].employer.reference,confirmed:annual[p.paymentId].employer.confirmed}}:{}),...Object.fromEntries(annualFields.map(([key])=>[key,cents(annual[p.paymentId].amounts[key]||'')])),...Object.fromEntries(annualChecks.map(([key])=>[key,annual[p.paymentId][key]])),reference:annual[p.paymentId].reference}}:{}),paymentId:p.paymentId,wages:Object.fromEntries(wageFields.map(([key])=>[key,cents(draft[p.paymentId]?.[key]||'')]))}))})
  setPending(body)
  try{await request(path,body);setPending(null);resetChecks();setDecision('');setReference('');setNotice('Imported taxable-wage review retained. Refresh payroll preview to use the current evidence.');const next=await request(`${path}?paymentDate=${paymentDate}`) as Model;sequence.current++;setData(next);setBasis(next);setDraft(blank(next));setAnnual({})}
  catch(e){setError(e instanceof Error?e.message:'Unable to save imported-wage review.');if(e instanceof Error&&'status' in e&&Number(e.status)>=400&&Number(e.status)<500){setPending(null);resetChecks();await refresh();setError(e.message)}}
  finally{setBusy(false)}
 }
 return <section aria-label="Imported taxable-wage review" className="min-w-0 space-y-3 rounded-xl border p-3 text-sm">
  <button type="button" disabled={busy} onClick={()=>void refresh()} className="rounded border px-3 py-2">Refresh imported wage evidence</button>
  {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  {pending?<button type="button" disabled={busy} onClick={()=>void save()} className="rounded border px-3 py-2">Retry original imported-wage review</button>:null}
  {data?<p>Reviewing {data.employee.legal_first_name} {data.employee.legal_last_name} for payroll paid {paymentDate}. Imported wage status: {data.status.replaceAll('_',' ')}</p>:null}
  {stale?<div role="alert"><p>Imported payments or review history changed. Your draft is preserved; review the current evidence before saving.</p><button type="button" disabled={busy||!!pending} onClick={()=>{if(data){setBasis(data);setDraft(blank(data));setAnnual({});resetChecks();setDecision('')}}} className="rounded border px-3 py-2">Review current imported evidence</button><p>Starting the current review clears the prior wage entries so they can be checked again.</p></div>:null}
  {basis?.source.payments.length?<fieldset disabled={busy||!!pending||stale||readError} className="min-w-0 space-y-3">
   <legend className="font-bold">Review prior employment taxable wages</legend>
   <p>Use the original employer payroll register. Enter wages before annual wage limits, separately for each tax. Do not enter tax amounts or wages from another employer.</p>
   <label className="block">Imported wage decision<select aria-label="Imported wage decision" value={decision} onChange={e=>{setDecision(e.target.value);resetChecks()}} className="block w-full rounded border p-2"><option value="">Choose a decision</option><option value="REVIEWED">Reviewed taxable wages</option><option value="UNRESOLVED">Unresolved — payroll needs review</option></select></label>
   {decision==='REVIEWED'?basis.source.payments.map(p=><fieldset key={p.paymentId} aria-label={`Imported payment ${p.paymentId}`} className="min-w-0 space-y-2 rounded border p-3"><legend className="font-semibold">Paid {p.paymentDate}</legend><p className="break-words">{p.reference||'No payment reference'} · Gross ${(p.grossCents/100).toFixed(2)} · Work {p.periodStart} through {p.periodEnd}</p>{wageFields.map(([key,label])=><label key={key} className="block">{label} ($)<input inputMode="decimal" maxLength={20} value={draft[p.paymentId]?.[key]||''} onChange={e=>{setDraft(old=>({...old,[p.paymentId]:{...old[p.paymentId],[key]:e.target.value}}));if(annual[p.paymentId])setAnnual(old=>({...old,[p.paymentId]:{...old[p.paymentId],registerReconciledConfirmed:false,reportingWagesConfirmed:false,qualifiedOvertimeReviewed:false}}));resetChecks()}} className="block w-full rounded border p-2"/></label>)}
    <label className="flex items-start gap-2"><input type="checkbox" checked={annual[p.paymentId]?.enabled||false} onChange={e=>updateAnnual(p.paymentId,{...blankAnnual(),enabled:e.target.checked})}/><span>Include annual reporting detail for this payment</span></label>
    {annual[p.paymentId]?.enabled?<fieldset className="min-w-0 space-y-2 rounded border p-3"><legend className="font-semibold">Annual reporting detail</legend><p>Use recorded reporting wages and actual withheld tax components. Medicare wages come from the reviewed uncapped basis above. Enter every amount, including zero. Qualified overtime is the reviewed FLSA premium, not total overtime pay.</p>
     {annualFields.map(([key,label])=><label key={key} className="block">{label} ($)<input inputMode="decimal" maxLength={20} value={annual[p.paymentId].amounts[key]||''} onChange={e=>updateAnnual(p.paymentId,{amounts:{...annual[p.paymentId].amounts,[key]:e.target.value},registerReconciledConfirmed:false,reportingWagesConfirmed:false,qualifiedOvertimeReviewed:false})} className="block w-full rounded border p-2"/></label>)}
     <label className="block">Annual reporting source reference<textarea value={annual[p.paymentId].reference} maxLength={2000} onChange={e=>updateAnnual(p.paymentId,{reference:e.target.value,registerReconciledConfirmed:false,reportingWagesConfirmed:false,qualifiedOvertimeReviewed:false})} className="block w-full rounded border p-2"/></label>
     <label className="flex items-start gap-2"><input type="checkbox" checked={annual[p.paymentId].employer.enabled} onChange={e=>updateAnnual(p.paymentId,{employer:{enabled:e.target.checked,amounts:{},reference:'',confirmed:false}})}/><span>Include employer tax detail for reconciliation</span></label>
     {annual[p.paymentId].employer.enabled?<fieldset className="min-w-0 space-y-2 rounded border p-3"><legend className="font-semibold">Employer tax liabilities</legend><p>Use actual employer liabilities from the original register, including explicit zeroes. These amounts are separate from employee withholding.</p>
      {employerFields.map(([key,label])=><label key={key} className="block">{label} ($)<input inputMode="decimal" maxLength={20} value={annual[p.paymentId].employer.amounts[key]||''} onChange={e=>updateAnnual(p.paymentId,{employer:{...annual[p.paymentId].employer,amounts:{...annual[p.paymentId].employer.amounts,[key]:e.target.value},confirmed:false}})} className="block w-full rounded border p-2"/></label>)}
      <label className="block">Employer tax source reference<textarea value={annual[p.paymentId].employer.reference} maxLength={2000} onChange={e=>updateAnnual(p.paymentId,{employer:{...annual[p.paymentId].employer,reference:e.target.value,confirmed:false}})} className="block w-full rounded border p-2"/></label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={annual[p.paymentId].employer.confirmed} onChange={e=>updateAnnual(p.paymentId,{employer:{...annual[p.paymentId].employer,confirmed:e.target.checked}})}/><span>I verified these employer tax liabilities against the original register.</span></label>
     </fieldset>:null}
     {annualChecks.map(([key,label])=><label key={key} className="flex items-start gap-2"><input type="checkbox" checked={annual[p.paymentId][key]} onChange={e=>updateAnnual(p.paymentId,{[key]:e.target.checked})}/><span>{label}</span></label>)}
    </fieldset>:null}
   </fieldset>):null}
   {decision==='REVIEWED'?<>{([['same','These wages belong to this employee and the same employer.'],['uncapped','These are uncapped taxable wage bases, not tax amounts or capped reporting totals.'],['complete','I reviewed every imported payment shown against the complete source records.']] as const).map(([key,label])=><label key={key} className="flex items-start gap-2"><input type="checkbox" checked={checks[key]} onChange={e=>setChecks(old=>({...old,[key]:e.target.checked,confirmed:false}))}/><span>{label}</span></label>)}</>:null}
   <label className="block">Imported wage source reference<textarea aria-label="Imported wage source reference" value={reference} maxLength={2000} onChange={e=>{setReference(e.target.value);setChecks(old=>({...old,confirmed:false}))}} className="block w-full rounded border p-2"/></label>
   <label className="flex items-start gap-2"><input type="checkbox" checked={checks.confirmed} onChange={e=>setChecks(old=>({...old,confirmed:e.target.checked}))}/><span>I confirm this review and its retained source evidence.</span></label>
   <button type="button" disabled={!valid} onClick={()=>void save()} className="rounded border px-3 py-2">Retain imported wage review</button>
  </fieldset>:data?<p>No imported payments are recorded through this payment date.</p>:null}
  {data?.history.length?<details><summary>Imported wage review history</summary>{data.history.map(row=><div key={row.id} className="my-3 break-words"><p>Revision {row.revision} · {row.review.disposition}</p><p>{row.review.reference}</p>{row.review.payments?.map(p=><div key={p.paymentId}><p>Payment {p.paymentId}</p>{wageFields.map(([key,label])=><p key={key}>{label}: ${(p.wages[key]/100).toFixed(2)}</p>)}{p.annualDetail?<><p>{p.annualDetail.reference}</p>{annualFields.map(([key,label])=><p key={key}>{label}: ${(p.annualDetail![key]/100).toFixed(2)}</p>)}{p.annualDetail.employerTaxes?<><p>{p.annualDetail.employerTaxes.reference}</p>{employerFields.map(([key,label])=><p key={key}>{label}: ${(p.annualDetail!.employerTaxes![key]/100).toFixed(2)}</p>)}</>:null}</>:<p>Annual reporting detail has not been retained for this payment.</p>}</div>)}</div>)}</details>:null}
 </section>
}

export default function HistoricalEmploymentWageReview({employees}:{employees:{id:number;legalFirstName:string;legalLastName:string}[]}){
 const [employeeId,setEmployeeId]=useState(''),[paymentDate,setPaymentDate]=useState(''),[selected,setSelected]=useState<{employeeId:string;paymentDate:string}|null>(null),[locked,setLocked]=useState(false)
 return <details className="mb-4 min-w-0 rounded-xl border p-4"><summary className="cursor-pointer font-bold">Review imported employment taxable wages</summary><div className="my-3 space-y-3"><fieldset disabled={locked} className="space-y-3"><label className="block">Employee for imported wage review<select aria-label="Employee for imported wage review" value={employeeId} onChange={e=>setEmployeeId(e.target.value)} className="block w-full rounded border p-2"><option value="">Select employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.legalFirstName} {e.legalLastName}</option>)}</select></label><label className="block">Payroll payment date for wage review<input type="date" min="2026-01-01" max="2026-12-31" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} className="block w-full rounded border p-2"/></label><button type="button" disabled={!employeeId||!paymentDate} onClick={()=>setSelected({employeeId,paymentDate})} className="rounded border px-3 py-2">Load imported taxable wages</button></fieldset>{selected?<ReviewForm key={`${selected.employeeId}-${selected.paymentDate}`} {...selected} lock={setLocked}/>:null}</div></details>
}
