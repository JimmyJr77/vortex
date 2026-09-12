import type {BenefitsReview} from '../../utils/workforceApi'
const input='mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900'
const benefitsDecisions:Record<string,string>={NOT_OFFERED:'No employer benefit plan offered',NOT_ELIGIBLE:'Not eligible under the plan',WAIVED:'Employee waived coverage',ENROLLED:'Enrollment confirmed',ENROLLED_EMPLOYER_FUNDED:'Enrolled — employer funds all group health premiums',WAITING_PERIOD:'Waiting for eligibility date'}
export default function HiringBenefitsReview({saved,value,onChange,policy,current}:{saved:BenefitsReview|null;value:BenefitsReview;onChange?:(value:BenefitsReview)=>void;policy:string;current:boolean}){
 const set=(key:string,next:unknown)=>onChange?.({...value,confirmed:false,...(!['confirmed','employerFundingConfirmed'].includes(key)?{employerFundingConfirmed:false}:{}),[key]:next,...(key==='employerFundingConfirmed'?{fundingTreatment:'EXCLUDED_GROUP_HEALTH_PREMIUM'}:{})})
 return <div className="mt-4 space-y-3 rounded-xl border border-slate-200 p-3 text-sm">
  <h4 className="font-bold">Benefits eligibility & enrollment</h4>
  {saved?<div className="space-y-1"><p className="font-semibold">{benefitsDecisions[saved.disposition]} · {saved.effectiveOn}</p><p className="whitespace-pre-wrap">{saved.summary}</p>{!current?<p className="text-amber-900">Your hiring admin needs to renew this benefits review.</p>:null}</div>:<p>Your hiring admin has not recorded a benefits decision.</p>}
  {onChange?<>
   <p className="whitespace-pre-wrap text-slate-600">{policy||'No benefits policy text has been published. Verify the employer’s actual plan offering and explain the decision below.'}</p>
   <label className="block font-semibold">Benefits disposition<select aria-label="Benefits disposition" value={value.disposition} onChange={e=>set('disposition',e.target.value)} className={input}><option value="">Choose reviewed disposition</option>{Object.entries(benefitsDecisions).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label className="block font-semibold">Benefits effective or eligibility date<input type="date" value={value.effectiveOn} onChange={e=>set('effectiveOn',e.target.value)} className={input}/></label>
   <label className="block font-semibold">Benefits explanation for employee<textarea maxLength={2000} value={value.summary} onChange={e=>set('summary',e.target.value)} className={input}/></label>
   <label className="block font-semibold">Benefits review evidence<input maxLength={2000} value={value.evidenceReference||''} onChange={e=>set('evidenceReference',e.target.value)} className={input} placeholder="Plan eligibility rule, employee waiver or enrollment confirmation"/></label>
   {value.disposition==='ENROLLED_EMPLOYER_FUNDED'?<label className="flex items-start gap-2"><input type="checkbox" checked={value.employerFundingConfirmed===true} onChange={e=>set('employerFundingConfirmed',e.target.checked)}/>The employer assumes every published employee contribution from this date. These are excluded group medical, dental or vision premiums for an eligible employee; no taxable shareholder, individual-policy reimbursement, or other taxable benefit treatment applies. Coverage remains enrolled. Carrier payments and accounting must be reconciled separately.</label>:null}
   <p className="text-slate-600">A waiting-period decision creates a follow-up when eligibility arrives. Recording enrollment does not enroll the employee with a carrier or create payroll deductions.</p>
   <label className="flex items-start gap-2"><input type="checkbox" checked={value.confirmed===true} onChange={e=>set('confirmed',e.target.checked)}/>I verified the benefits disposition, effective date and supporting evidence.</label>
  </>:null}
 </div>
}
