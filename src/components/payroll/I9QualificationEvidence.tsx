import type {I9QualificationState} from '../../utils/workforceApi'
export default function I9QualificationEvidence({qualification}:{qualification?:I9QualificationState['current']}){
 if(!qualification)return null
 const {findings}=qualification
 return <details className="min-w-0 rounded border p-2"><summary className="cursor-pointer font-semibold">Qualification retained at signing · revision {qualification.revision}</summary><p className="break-words">Covered site(s): {String(findings.siteName)}. Observed {String(findings.observedOn)}; recorded {qualification.recordedAt} by admin {qualification.actorUserId}.</p>{([['eVerifyEnrolled','E-Verify enrollment'],['goodStanding','Good standing'],['allSitesEnrolled','Covered site enrollment'],['trainingComplete','Examiner training'],['consistentProcedure','Consistent procedure']] as const).map(([key,label])=><p key={key}>{label}: {findings[key]===true?'Verified':'Not currently verified'}</p>)}<p className="whitespace-pre-wrap break-words">{String(findings.evidence)}</p><p>These findings were retained with this signature. Employer setup shows subsequent qualification changes.</p></details>
}
