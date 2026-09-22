// Retained consent must remain complete when payroll later consumes it.
// Session expiry/revocation after signing does not erase a valid prior signature.
export function healthElectionProofCurrent(election,proposal,timeZone,createdAt){
 if(election?.version!==1||!['ELECT','DECLINE'].includes(election.action)||election.confirmed!==true||election.disclosureConfirmed!==true||election.electionRulesConfirmed!==true)return false
 if(typeof election.signature!=='string'||election.signature.trim().length<2||election.signature.length>200||/[\u0000-\u001f\u007f]/.test(election.signature))return false
 if(typeof timeZone!=='string'||!timeZone||typeof election.signedAt!=='string'||!Number.isFinite(Date.parse(election.signedAt)))return false
 const signedTime=Date.parse(election.signedAt),retainedTime=new Date(createdAt).getTime()
 if(!Number.isFinite(retainedTime)||signedTime>retainedTime||retainedTime-signedTime>300000)return false
 try{
  const signedDay=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(election.signedAt))
  return typeof proposal?.electionDeadline==='string'&&typeof proposal.effectiveOn==='string'&&signedDay<=proposal.electionDeadline&&signedDay<=proposal.effectiveOn
 }catch{return false}
}
