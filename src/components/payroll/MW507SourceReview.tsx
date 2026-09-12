import {workforceApi} from '../../utils/workforceApi'
import {useState} from 'react'
export type NativeMW507={submissionId:string;documentId:string;receivedOn:string;fingerprint:string;reviewed:boolean;choices:{filingStatus:string|null;exemptions:number|null;extraWithholdingCents:number;claim:{kind:string};stateExempt:boolean;localExempt:boolean};requirements:{comptrollerSubmissionReasons:string[];noLiabilityWeeklyWageReviewRequired:boolean;additionalAgreementRequired:boolean;attachmentsRequired:string[];renewBy:string|null;revocationAndCorrectnessReviewRequired:boolean}}
const reasons:Record<string,string>={MORE_THAN_TEN_EXEMPTIONS:'More than ten exemptions claimed',NONRESIDENCE_CLAIM:'Nonresidence exemption claimed',MILITARY_SPOUSE_CLAIM:'Military-spouse exemption claimed'}
const claims:Record<string,string>={NONE:'No exemption claimed',NO_LIABILITY:'No Maryland tax liability',RECIPROCAL:'Reciprocal-state domicile',PENNSYLVANIA:'Pennsylvania domicile',MILITARY_SPOUSE:'Military spouse'}
export default function MW507SourceReview({source}:{source:NativeMW507}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const {choices,requirements}=source
 return <section aria-label="Signed Maryland certificate review" className="mt-3 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
  <h3 className="font-bold">Signed internal MW507 #{source.submissionId}</h3>
  <p>Received {source.receivedOn}. {source.reviewed?'Hiring checklist review completed.':'Hiring checklist review is pending.'} These choices come from the retained certificate. The employee must sign an amendment to change them.</p>
  <button type="button" className="font-bold underline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await workforceApi.download(Number(source.documentId),'Form-MW507-2026-signed.pdf',true)}catch(e){setError(e instanceof Error?e.message:'Unable to download certificate.')}finally{setBusy(false)}}}>Download signed MW507 for review</button>
  {error?<p role="alert">{error}</p>:null}
  <dl className="grid gap-2 sm:grid-cols-2">
   <div><dt className="font-bold">Withholding rate selection</dt><dd>{choices.filingStatus==='JOINT'?'Married rate':choices.filingStatus==='SINGLE'?'Single rate':'Blank on signed form'}</dd></div>
   <div><dt className="font-bold">Exemptions claimed</dt><dd>{choices.exemptions??'Blank on signed form'}</dd></div>
   <div><dt className="font-bold">Additional per pay period</dt><dd>${(choices.extraWithholdingCents/100).toFixed(2)}</dd></div>
   <div><dt className="font-bold">Exemption basis</dt><dd>{claims[choices.claim.kind]||choices.claim.kind}</dd></div>
   <div><dt className="font-bold">State income tax exemption</dt><dd>{choices.stateExempt?'Claimed':'Not claimed'}</dd></div>
   <div><dt className="font-bold">Local income tax exemption</dt><dd>{choices.localExempt?'Claimed':'Not claimed'}</dd></div>
  </dl>
  <h4 className="font-bold">Required employer review</h4>
  <ul className="list-disc space-y-1 pl-5">
   <li>Check correctness and any Comptroller revocation. A new certificate after revocation requires Comptroller approval before implementation.</li>
   {requirements.comptrollerSubmissionReasons.map(reason=><li key={reason}>Submit the certificate and accompanying attachments to the Comptroller: {reasons[reason]||reason}.</li>)}
   {requirements.noLiabilityWeeklyWageReviewRequired?<li>Review expected weekly wages; a no-liability certificate must be submitted if wages are expected to exceed $200 weekly.</li>:null}
   {requirements.additionalAgreementRequired?<li>Retain an employer–employee agreement for the additional withholding amount and applicable payment dates.</li>:null}
   {requirements.attachmentsRequired.length?<li>Review both Form MW507M and the spousal military identification attachment.</li>:null}
   {requirements.renewBy?<li>Collect a renewed exemption certificate by {requirements.renewBy}.</li>:null}
  </ul>
  <p>These requirements are not completed by downloading or viewing this certificate. Applying internal Maryland certificates to payroll is pending the structured employer review workflow.</p>
 </section>
}
