import {useRef,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Finding={status:string;eligibleOn:string|null;vestedBps:number|null}
type Review={assessedFrom?:string;assessedThrough:string;reference:string;matching:Finding;nonelective:Finding}
type Data={supportedReviewFields?:string[];source:{fingerprint:string;employerFormula:unknown;employerContributions:string;employmentStatus:string;hireDate:string};history:Array<{id:string;revision:number;status:string;review:Review}>}
const names={matching:'Matching',nonelective:'Nonelective'} as const
const input='mt-1 block w-full rounded border border-slate-300 p-2'
export default function RetirementEmployerEligibility({employeeId,planId}:{employeeId:number;planId:string}){
 const [data,setData]=useState<Data|null>(null),[form,setForm]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const pending=useRef<string|null>(null),path=`/api/admin/payroll/employees/${employeeId}/retirement-employer-eligibility/${encodeURIComponent(planId)}`
 const request=async(body?:string)=>{const response=await adminApiRequest(path,body?{method:'POST',body}:undefined),json=await response.json();if(!response.ok||!json.success)throw Object.assign(new Error(json.message||'Unable to review employer eligibility.'),{status:response.status});return json.data}
 const load=async()=>{setBusy(true);setError('');setConfirmed(false);try{setData(await request())}catch(e){setError(e instanceof Error?e.message:'Unable to load employer eligibility.')}finally{setBusy(false)}}
 const set=(key:string,value:string)=>{setForm(old=>({...old,[key]:value}));setConfirmed(false)}
 const save=async(retry=false)=>{
  if(!data)return
  setBusy(true);setError('');setMessage('')
  try{
   if(!data.supportedReviewFields?.includes('assessedFrom'))throw new Error('Employer assessment date ranges require the current payroll backend. Reload after the backend update.')
   if(!retry){
    const findings=Object.fromEntries(Object.keys(names).map(key=>{
     const status=form[`${key}-status`],percentage=form[`${key}-vesting`]||''
     if(status==='ELIGIBLE'&&!/^\d+(\.\d{1,2})?$/.test(percentage))throw new Error('Enter each reviewed vesting percentage with no more than two decimals.')
     return [key,{status,eligibleOn:status==='ELIGIBLE'?form[`${key}-date`]:null,vestedBps:status==='ELIGIBLE'?Math.round(Number(percentage)*100):null}]
    }))
    pending.current=JSON.stringify({...findings,assessedFrom:form.assessedFrom,assessedThrough:form.assessedThrough,reference:form.reference,confirmed,sourceFingerprint:data.source.fingerprint,expectedRevision:data.history[0]?.revision||0,requestKey:crypto.randomUUID()})
   }
   if(!pending.current)throw new Error('No original employer review is available to retry.')
   await request(pending.current);setData(await request());pending.current=null;setConfirmed(false);setMessage('Employer eligibility retained. Employee elections are unchanged.')
  }catch(e){if(e&&typeof e==='object'&&'status' in e&&[400,404,409].includes(Number(e.status)))pending.current=null;setError(e instanceof Error?e.message:'Unable to retain employer eligibility.')}finally{setBusy(false)}
 }
 return <section aria-label="Employer retirement eligibility" className="space-y-3 rounded border p-3">
  <h4 className="font-bold">Employer retirement eligibility</h4><p>Review matching and nonelective funding separately from employee deferrals. Vesting records ownership; it does not reduce the employer contribution owed.</p>
  <button type="button" disabled={busy} onClick={()=>void load()} className="rounded border px-3 py-2">Load employer eligibility</button>
  {error?<p role="alert">{error}</p>:null}{message?<p role="status">{message}</p>:null}
  {pending.current?<button type="button" disabled={busy} onClick={()=>void save(true)} className="rounded border px-3 py-2">Retry original employer eligibility review</button>:null}
  {data?<><p>Employment: {data.source.employmentStatus} · Hired {data.source.hireDate} · Employer formula: {data.source.employerContributions.replaceAll('_',' ')}</p>
   {data.source.employerFormula&&data.supportedReviewFields?.includes('assessedFrom')?<fieldset disabled={busy||!!pending.current} className="space-y-3"><legend className="font-bold">Employer contribution findings</legend>
    <label className="block">Employer eligibility assessed from<input type="date" value={form.assessedFrom||''} onChange={e=>set('assessedFrom',e.target.value)} className={input}/></label>
    <label className="block">Employer eligibility assessed through<input type="date" value={form.assessedThrough||''} onChange={e=>set('assessedThrough',e.target.value)} className={input}/></label>
    {(Object.entries(names)).map(([key,name])=><div key={key} className="space-y-2 rounded border p-2">
     <label className="block">{name} eligibility<select value={form[`${key}-status`]||''} onChange={e=>set(`${key}-status`,e.target.value)} className={input}><option value="">Review finding</option><option value="ELIGIBLE">Eligible</option><option value="NOT_ELIGIBLE">Not eligible</option><option value="REVIEW_REQUIRED">Requires further review</option><option value="NOT_APPLICABLE">Not applicable under this formula</option></select></label>
     {form[`${key}-status`]==='ELIGIBLE'?<><label className="block">{name} eligible entry date<input type="date" value={form[`${key}-date`]||''} onChange={e=>set(`${key}-date`,e.target.value)} className={input}/></label><label className="block">{name} vested percentage (%)<input inputMode="decimal" value={form[`${key}-vesting`]||''} onChange={e=>set(`${key}-vesting`,e.target.value)} className={input}/></label></>:null}
    </div>)}
    <label className="block">Employer eligibility and vesting evidence<input maxLength={2000} value={form.reference||''} onChange={e=>set('reference',e.target.value)} className={input}/></label>
    <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed employer contribution eligibility, service conditions and vesting through the assessment date.</label>
    <button type="button" disabled={!confirmed} onClick={()=>void save()} className="rounded border px-3 py-2 font-bold">Retain employer eligibility</button>
   </fieldset>:<p>{data.source.employerFormula?'Employer assessment date ranges require the current payroll backend. Reload after the backend update.':'Retain a structured employer formula in Employer setup before reviewing these findings.'}</p>}
   {data.history.map(row=><article key={row.id} className="space-y-1 rounded bg-slate-50 p-3"><p className="font-bold">Employer eligibility revision {row.revision} · {row.status}</p><p>Assessed {row.review.assessedFrom||'start date unreviewed'} through {row.review.assessedThrough}</p>{Object.entries(names).map(([key,name])=>{const finding=row.review[key as keyof typeof names];return <p key={key}>{name}: {finding.status.replaceAll('_',' ')}{finding.eligibleOn?` from ${finding.eligibleOn} · ${finding.vestedBps!/100}% vested`:''}</p>})}<p className="break-words">{row.review.reference}</p></article>)}
  </>:null}
 </section>
}
